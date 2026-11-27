import assert from "node:assert/strict";
import test, { before, beforeEach, after } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { User } from "../models/identity.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { removeOfferingAcademicYear } from "../migrations/remove-offering-academic-year.js";

let database, server, base, user, term, course;
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
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
async function call(path, { method = "GET", body, actor = user } = {}) {
  const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${generateToken(actor)}`, "Content-Type": "application/json" },
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

test("Req 16–17 creates and updates the registration and advising dates as an administrator", async () => {
  const path = "/academic-terms/academicTerm";
  const dates = {
    termStart: "2027-03-01", termEnd: "2027-08-01",
    teachingStart: "2027-03-07", teachingEnd: "2027-07-01",
    registrationStart: "2027-02-01", registrationEnd: "2027-03-07",
    advisingDeadline: "2027-03-10", wholeScheduleSwapDeadline: "2027-03-20",
  };
  const body = { code: "S27", academicYear: "2026/2027", season: "spring", ...dates };
  const coordinator = await User.create({
    fullName: "Read Only Coordinator", email: "catalogue.coordinator@guc.edu.eg", role: "coordinator", passwordHash: "test-only",
  });
  assert.equal((await call(path, { method: "POST", body, actor: coordinator })).status, 403);
  assert.equal((await call(path, { method: "POST", body: { ...body, termEnd: "2027-02-01" } })).status, 400);
  const created = await call(path, { method: "POST", body });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await call(path, { method: "POST", body })).status, 409);
  const detail = path + "/" + created.body._id;
  const changes = { registrationEnd: "2027-03-08", advisingDeadline: "2027-03-11" };
  assert.equal((await call(detail, { method: "PUT", body: changes, actor: coordinator })).status, 403);
  assert.equal((await call(detail, { method: "PUT", body: changes })).status, 200);
  const stored = await AcademicTerm.findById(created.body._id).lean();
  for (const [field, date] of Object.entries({ ...dates, ...changes })) {
    assert.equal(stored[field].toISOString().slice(0, 10), date, field);
  }
});

test("Req 18–21 creates, reads, updates and deletes catalogue courses with reference protection", async () => {
  const path = "/catalogue/courses";
  const draft = { code: "CSEN999", name: "Regression elective", creditHours: 4, courseType: "elective", facultyMajors: ["CS"], prerequisites: [String(course._id)] };
  const created = await call(path, { method: "POST", body: draft });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.match((await call(path, { method: "POST", body: draft })).body.message, /already exists/);
  const detail = path + "/" + created.body._id;
  const list = await call(path);
  assert.equal(list.status, 200);
  assert.ok(list.body.some(row => row._id === created.body._id && row.code === draft.code));
  const result = await call(detail);
  assert.equal(result.status, 200);
  assert.equal(result.body.prerequisites[0].code, course.code);
  assert.equal((await call(path + "/" + course._id, { method: "DELETE" })).status, 409);
  assert.equal((await call(detail, { method: "PUT", body: { name: "Updated elective", creditHours: 5 } })).status, 200);
  assert.equal((await call(detail)).body.creditHours, 5);
  assert.equal((await call(detail)).body.name, "Updated elective");
  assert.equal((await call(detail, { method: "DELETE" })).status, 200);
  assert.equal((await call(detail)).status, 404);
});

test("Req 22–23 and 25–27 persists all offering components, edits, publication and deletion", async () => {
  const slots = ["lecture", "tutorial", "lab"].map((componentType, index) => ({
    componentType, groupNumber: "1", day: ["Saturday", "Sunday", "Monday"][index],
    startMinute: 480, endMinute: 570, room: "R" + index, capacity: 30,
  }));
  const created = await create({ slots, instructors: [{ fullName: "Dr Regression" }], eligibleGroups: [{ major: "CS", semester: 5, studyGroup: "1" }] });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal((await create({ slots })).status, 409);
  const path = "/catalogue/offerings/" + created.body._id;
  const listing = await call("/catalogue/offerings?termId=" + term._id);
  assert.deepEqual(listing.body.offerings.map(row => row._id), [created.body._id]);
  const detail = (await call(path)).body;
  assert.equal(detail.course.code, course.code);
  assert.equal(detail.term.code, term.code);
  assert.deepEqual(detail.slots.map(({ componentType, groupNumber, day, startMinute, endMinute, room, capacity }) =>
    ({ componentType, groupNumber, day, startMinute, endMinute, room, capacity })), slots);
  const labPath = path + "/slots/" + detail.slots[2]._id;
  assert.equal((await call(labPath, { method: "PUT", body: { room: "Updated lab", capacity: 25 } })).status, 200);
  assert.equal((await call(path)).body.slots[2].room, "Updated lab");
  assert.equal((await call(path)).body.slots[2].capacity, 25);
  for (const isPublished of [true, false]) {
    const published = await call(path + "/publish", { method: "PATCH", body: { isPublished } });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal((await call(path)).body.isPublished, isPublished);
  }
  assert.equal((await call(labPath, { method: "DELETE" })).status, 200);
  assert.deepEqual((await call(path)).body.slots.map(row => row.componentType), ["lecture", "tutorial"]);
  assert.equal((await call(path, { method: "DELETE" })).status, 200);
  assert.equal((await call(path)).status, 404);
});

test("Req 128 validates all CSV rows before importing and updates without duplicating courses", async () => {
  const header = "course code,name,credit hours,course type,faculty/major,recommended semester,offering season,prerequisites";
  const row = 'CSEN901,"Systems, applied",4,core,CS,5,winter,';
  const importCsv = (...rows) => call("/catalogue/courses/import", {
    method: "POST", body: { csvText: [header, ...rows].join("\n") },
  });
  const invalid = await importCsv(row, "CSEN902,Project,invalid,elective,CS,6,spring,CSEN901");
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.errors.some(error => error.row === 3 && error.field === "creditHours"));
  assert.equal(await Course.countDocuments({ code: { $in: ["CSEN901", "CSEN902"] } }), 0);
  const secondRow = "CSEN902,Project,5,elective,CS,6,spring,CSEN901";
  const first = await importCsv(row, secondRow);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.created, 2);
  const initial = await Course.findOne({ code: "CSEN901" });
  assert.equal(initial.name, "Systems, applied");
  const retry = await importCsv(row.replace(",4,", ",6,"), secondRow);
  assert.equal(retry.body.created, 0);
  assert.equal(retry.body.updated, 2);
  assert.equal((await Course.findById(initial._id)).creditHours, 6);
  const linked = await Course.findOne({ code: "CSEN902" }).lean();
  assert.deepEqual(linked.prerequisites, [initial._id]);
  assert.deepEqual(linked.offeringSeasons, ["spring"]);
  assert.equal(await Course.countDocuments({ code: { $in: ["CSEN901", "CSEN902"] } }), 2);
});
