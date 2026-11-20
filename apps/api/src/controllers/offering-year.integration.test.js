import assert from "node:assert/strict";
import test, { before, beforeEach, after } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { User } from "../models/identity.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { removeOfferingAcademicYear } from "../migrations/remove-offering-academic-year.js";

let database, server, base, user, term, course;
before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([AcademicTerm.init(), Course.init(), CourseOffering.init(), User.init()]);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});
beforeEach(async () => {
  await Promise.all([CourseOffering.deleteMany({}), Course.deleteMany({}), AcademicTerm.deleteMany({}), User.deleteMany({})]);
  user = await User.create({ fullName: "Year Administrator", email: "year@guc.edu.eg", role: "administrator", passwordHash: "test-only" });
  term = await AcademicTerm.create({ code: "YEAR26", academicYear: "2026/2027", season: "winter", termStart: new Date("2026-10-01"), termEnd: new Date("2027-03-01"),
    teachingStart: new Date("2026-10-05"), teachingEnd: new Date("2027-01-20"), registrationStart: new Date("2026-09-01"), registrationEnd: new Date("2026-10-10"),
    advisingDeadline: new Date("2026-10-15"), wholeScheduleSwapDeadline: new Date("2026-10-20"), isActive: true });
  course = await Course.create({ code: "CSEN501", name: "Year test course", creditHours: 4, courseType: "core", facultyMajors: ["CS"] });
});
async function call(path, { method = "GET", body } = {}) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${generateToken(user)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const create = (extra = {}) => call("/catalogue/offerings", { method: "POST", body: { course: String(course._id), term: term.code, ...extra } });

test("offering create inherits the selected term year without persisting a duplicate", async () => {
  const result = await create();
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.academicYear, term.academicYear);
  assert.equal(result.body.term.academicYear, term.academicYear);
  const stored = await CourseOffering.collection.findOne({ _id: new mongoose.Types.ObjectId(result.body._id) });
  assert.equal(Object.hasOwn(stored, "academicYear"), false);
  assert.equal(CourseOffering.schema.path("academicYear"), undefined);
});

test("legacy callers may send the same year but cannot create an inconsistent offering", async () => {
  const invalid = await create({ academicYear: "1999/2000" });
  assert.equal(invalid.status, 400);
  assert.match(invalid.body.message, /inherited from the selected term/);
  assert.equal(await CourseOffering.countDocuments(), 0);
  const compatible = await create({ academicYear: ` ${term.academicYear} ` });
  assert.equal(compatible.status, 201);
  assert.equal(compatible.body.academicYear, term.academicYear);
  for (const value of ["", 2026, null]) assert.equal((await create({ academicYear: value })).status, 400);
});

test("offering edits cannot independently change year and still update instructors/groups", async () => {
  const created = await create();
  const path = `/catalogue/offerings/${created.body._id}`;
  const mismatch = await call(path, { method: "PUT", body: { academicYear: "2020/2021", instructors: [{ fullName: "Must not save" }] } });
  assert.equal(mismatch.status, 400);
  assert.equal((await CourseOffering.findById(created.body._id)).instructors.length, 0);
  const saved = await call(path, { method: "PUT", body: { instructors: [{ fullName: "Dr Updated" }], eligibleGroups: [{ major: "CS", semester: 5 }] } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.instructors[0].fullName, "Dr Updated");
  assert.equal(saved.body.academicYear, term.academicYear);
  assert.equal((await call(path, { method: "PUT", body: { academicYear: term.academicYear } })).status, 200);
});

test("term year changes immediately appear in offering list/details without rewriting offerings", async () => {
  const created = await create();
  const updated = await call(`/academic-terms/academicTerm/${term._id}`, { method: "PUT", body: { academicYear: "2027/2028" } });
  assert.equal(updated.status, 200);
  const listing = await call(`/catalogue/offerings?termId=${term._id}`);
  assert.equal(listing.body.term.academicYear, "2027/2028");
  assert.equal(listing.body.offerings[0].academicYear, "2027/2028");
  const detail = await call(`/catalogue/offerings/${created.body._id}`);
  assert.equal(detail.body.academicYear, "2027/2028");
  assert.equal(detail.body.term.academicYear, "2027/2028");
});

test("legacy stale stored copies never override the linked term in API responses", async () => {
  const legacy = new mongoose.Types.ObjectId();
  await CourseOffering.collection.insertOne({ _id: legacy, course: course._id, term: term._id, academicYear: "1999/2000", instructors: [], eligibleGroups: [], slots: [], isPublished: false });
  const detail = await call(`/catalogue/offerings/${legacy}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.academicYear, term.academicYear);
  const listing = await call(`/catalogue/offerings?termId=${term.code}`);
  assert.equal(listing.body.offerings[0].academicYear, term.academicYear);
  const notPopulated = await CourseOffering.findById(legacy);
  assert.equal(notPopulated.toJSON().academicYear, undefined, "do not present a stale fallback if the term is not populated");
});

test("legacy cleanup is dry-run by default, preserves records, drops obsolete index and is idempotent", async () => {
  const id = new mongoose.Types.ObjectId();
  await CourseOffering.collection.insertOne({ _id: id, course: course._id, term: term._id, academicYear: "1999/2000", instructors: [], eligibleGroups: [], slots: [], isPublished: false });
  await CourseOffering.collection.createIndex({ academicYear: 1 });
  const preview = await removeOfferingAcademicYear();
  assert.deepEqual(preview, { applied: false, redundantFields: 1, orphanedOfferings: 0, mismatchedYears: 1 });
  assert.equal((await CourseOffering.collection.findOne({ _id: id })).academicYear, "1999/2000");
  const result = await removeOfferingAcademicYear({ apply: true });
  assert.equal(result.removedFields, 1);
  assert.deepEqual(result.droppedIndexes, ["academicYear_1"]);
  assert.equal(await CourseOffering.countDocuments(), 1);
  assert.equal(String((await CourseOffering.collection.findOne({ _id: id })).term), String(term._id));
  assert.equal((await AcademicTerm.findById(term._id)).academicYear, term.academicYear);
  const indexNames = (await CourseOffering.collection.indexes()).map((index) => index.name);
  assert.ok(indexNames.includes("term_1_course_1"), "unique per-course/per-term constraint retained");
  assert.equal((await removeOfferingAcademicYear({ apply: true })).removedFields, 0);
});

test("cleanup refuses to discard a legacy year while its term reference is orphaned", async () => {
  const id = new mongoose.Types.ObjectId();
  await CourseOffering.collection.insertOne({ _id: id, course: course._id, term: new mongoose.Types.ObjectId(), academicYear: "1999/2000" });
  assert.equal((await removeOfferingAcademicYear()).orphanedOfferings, 1);
  await assert.rejects(removeOfferingAcademicYear({ apply: true }), /Repair orphaned/);
  assert.equal((await CourseOffering.collection.findOne({ _id: id })).academicYear, "1999/2000");
});
