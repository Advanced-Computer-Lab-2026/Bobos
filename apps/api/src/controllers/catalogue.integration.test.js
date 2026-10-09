import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { User } from "../models/identity.js";
import { generateToken } from "../middleware/auth.middleware.js";

let database, server, base, users, term;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([User.init(), AcademicTerm.init(), Course.init(), CourseOffering.init()]);
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
  users = {};
  for (const role of ["administrator", "coordinator", "advisor", "normalStudent"]) {
    const student = role === "normalStudent";
    users[role] = await User.create({
      email: `${role}@${student ? "student.guc.edu.eg" : "guc.edu.eg"}`,
      fullName: role,
      passwordHash: "unused-test-hash",
      role,
    });
  }
  term = await AcademicTerm.create(termPayload());
});

function termPayload(overrides = {}) {
  return {
    code: "SPR26",
    academicYear: "2025/2026",
    season: "spring",
    termStart: "2026-02-01",
    termEnd: "2026-06-30",
    teachingStart: "2026-02-08",
    teachingEnd: "2026-06-15",
    registrationStart: "2026-01-20",
    registrationEnd: "2026-02-10",
    advisingDeadline: "2026-02-15",
    wholeScheduleSwapDeadline: "2026-02-20",
    isActive: true,
    ...overrides,
  };
}

async function call(path, { role, method = "GET", body } = {}) {
  const headers = {};
  if (role) headers.Authorization = `Bearer ${generateToken(users[role])}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const coursePayload = (overrides = {}) => ({
  code: "CSEN901",
  name: "Test Systems",
  creditHours: 3,
  courseType: "core",
  facultyMajors: ["CS"],
  recommendedSemester: 1,
  offeringSeasons: ["spring"],
  ...overrides,
});

const validSlot = (overrides = {}) => ({
  componentType: "lecture",
  groupNumber: "1",
  day: "Monday",
  startMinute: 540,
  endMinute: 600,
  room: "A1.101",
  capacity: 25,
  ...overrides,
});

test("term and course APIs enforce authentication and role permissions while supporting admin CRUD", async () => {
  assert.equal((await call("/academic-terms/academicTerm", { method: "POST", body: termPayload({ code: "NOAUTH" }) })).status, 401);
  assert.equal((await call("/academic-terms/academicTerm", { role: "coordinator", method: "POST", body: termPayload({ code: "COORD" }) })).status, 403);
  assert.equal((await call("/catalogue/courses")).status, 401);
  assert.equal((await call("/catalogue/courses", { role: "advisor" })).status, 403);
  assert.equal((await call("/catalogue/courses", { role: "coordinator" })).status, 200);
  assert.equal((await call("/catalogue/courses", { role: "normalStudent", method: "POST", body: coursePayload() })).status, 403);

  const createdTerm = await call("/academic-terms/academicTerm", { role: "administrator", method: "POST", body: termPayload({ code: "FALL26", academicYear: "2026/2027", season: "winter" }) });
  assert.equal(createdTerm.status, 201);
  assert.equal((await call("/academic-terms/academicTerm", { role: "administrator", method: "POST", body: termPayload({ code: "FALL26", academicYear: "2027/2028", season: "spring" }) })).status, 409);
  const updatedTerm = await call(`/academic-terms/academicTerm/${createdTerm.body.code}`, { role: "administrator", method: "PUT", body: { isActive: false } });
  assert.equal(updatedTerm.status, 200);
  assert.equal(updatedTerm.body.isActive, false);
  const invalidTerm = await call("/academic-terms/academicTerm", { role: "administrator", method: "POST", body: termPayload({ code: "BAD-DATES", termEnd: "2026-01-01" }) });
  assert.equal(invalidTerm.status, 400);

  const createdCourse = await call("/catalogue/courses", { role: "administrator", method: "POST", body: coursePayload() });
  assert.equal(createdCourse.status, 201);
  assert.equal(createdCourse.body.code, "CSEN901");
  assert.equal((await call("/catalogue/courses", { role: "administrator", method: "POST", body: coursePayload() })).status, 400);
  const listed = await call("/catalogue/courses", { role: "coordinator" });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.length, 1);
  assert.equal((await call(`/catalogue/courses/${createdCourse.body._id}`, { role: "coordinator" })).body.name, "Test Systems");
  assert.equal((await call(`/catalogue/courses/${createdCourse.body._id}`, { role: "coordinator", method: "PUT", body: { name: "Forbidden" } })).status, 403);
  const updatedCourse = await call(`/catalogue/courses/${createdCourse.body._id}`, { role: "administrator", method: "PUT", body: { name: "Updated Systems" } });
  assert.equal(updatedCourse.status, 200);
  assert.equal(updatedCourse.body.name, "Updated Systems");
  assert.equal((await call("/catalogue/courses/not-an-id", { role: "administrator", method: "PUT", body: { name: "Bad ID" } })).status, 400);
  assert.equal((await call("/catalogue/courses/not-an-id", { role: "administrator" })).status, 400);
  const dependent = await call("/catalogue/courses", { role: "administrator", method: "POST", body: coursePayload({ code: "CSEN902", prerequisites: [createdCourse.body._id] }) });
  assert.equal(dependent.status, 201);
  assert.equal((await call(`/catalogue/courses/${createdCourse.body._id}`, { role: "administrator", method: "DELETE" })).status, 409);
  assert.equal((await call(`/catalogue/courses/${dependent.body._id}`, { role: "administrator", method: "DELETE" })).status, 200);
  assert.equal((await call(`/catalogue/courses/${createdCourse.body._id}`, { role: "coordinator", method: "DELETE" })).status, 403);
  assert.equal((await call(`/catalogue/courses/${createdCourse.body._id}`, { role: "administrator", method: "DELETE" })).status, 200);
});

test("course CSV import validates the whole file before creating or updating any course", async () => {
  const csv = [
    "Course Code,Course Name,Credit Hours,Course Type,Faculty/Major,Recommended Semester,Offering Season,Prerequisites",
    "BASE101,Foundations,3,core,CS,1,spring,",
    "NEXT101,Next Course,4,elective,CS;DMET,2,winter,BASE101",
  ].join("\n");
  const imported = await call("/catalogue/courses/import", { role: "administrator", method: "POST", body: { csvText: csv } });
  assert.equal(imported.status, 200);
  assert.deepEqual({ total: imported.body.total, created: imported.body.created, updated: imported.body.updated }, { total: 2, created: 2, updated: 0 });
  const next = await Course.findOne({ code: "NEXT101" }).populate("prerequisites");
  assert.deepEqual(next.prerequisites.map(({ code }) => code), ["BASE101"]);

  const invalid = [
    "Course Code,Course Name,Credit Hours,Course Type,Faculty/Major,Recommended Semester,Offering Season,Prerequisites",
    "ATOMIC1,Would Be Valid,3,core,CS,1,spring,",
    "ATOMIC2,Invalid Season,3,core,CS,1,monsoon,",
  ].join("\n");
  const rejected = await call("/catalogue/courses/import", { role: "administrator", method: "POST", body: { csvText: invalid } });
  assert.equal(rejected.status, 400);
  assert.ok(rejected.body.errors.some(({ field }) => field === "offeringSeasons"));
  assert.equal(await Course.countDocuments({ code: /^ATOMIC/ }), 0, "validation errors produce no partial writes");
  assert.equal((await call("/catalogue/courses/import", { role: "coordinator", method: "POST", body: { csvText: csv } })).status, 403);
  assert.equal((await call("/catalogue/courses/import", { role: "administrator", method: "POST", body: { csvText: 'code,name\n"unterminated' } })).status, 400);
});

test("offering create, list, publish, edit, and delete validate conflicts and capacity", async () => {
  const firstCourse = await Course.create(coursePayload());
  const secondCourse = await Course.create(coursePayload({ code: "CSEN902", name: "Second Course" }));
  const offeringPayload = {
    course: String(firstCourse._id),
    term: term.code,
    instructors: [{ fullName: "Dr. Test", email: "dr.test@guc.edu.eg" }],
    eligibleGroups: [{ major: "CS", semester: 1 }],
    slots: [validSlot()],
    isPublished: true,
  };
  assert.equal((await call("/catalogue/offerings", { method: "POST", body: offeringPayload })).status, 401);
  assert.equal((await call("/catalogue/offerings", { role: "coordinator", method: "POST", body: offeringPayload })).status, 403);
  const created = await call("/catalogue/offerings", { role: "administrator", method: "POST", body: offeringPayload });
  assert.equal(created.status, 201);
  const offeringId = created.body._id;
  const slotId = created.body.slots[0]._id;
  assert.equal((await call("/catalogue/offerings", { role: "administrator", method: "POST", body: offeringPayload })).status, 409);

  const secondPayload = { ...offeringPayload, course: String(secondCourse._id), isPublished: false };
  const conflict = await call("/catalogue/offerings", { role: "administrator", method: "POST", body: secondPayload });
  assert.equal(conflict.status, 409, "room and instructor overlaps are rejected even across courses");
  const list = await call(`/catalogue/offerings?termId=${term.code}&publishedOnly=true`, { role: "coordinator" });
  assert.equal(list.status, 200);
  assert.equal(list.body.count, 1);
  assert.equal((await call(`/catalogue/offerings/${offeringId}`, { role: "coordinator" })).body.slots[0].remainingCapacity, 25);
  assert.equal((await call(`/catalogue/offerings?termId=${term.code}&publishedOnly=maybe`, { role: "coordinator" })).status, 400);

  await CourseOffering.updateOne({ _id: offeringId, "slots._id": slotId }, { $set: { "slots.$.assignedStudentCount": 2 } });
  const underCapacity = await call(`/catalogue/offerings/${offeringId}/slots/${slotId}`, { role: "administrator", method: "PUT", body: { capacity: 1 } });
  assert.equal(underCapacity.status, 400);
  const increased = await call(`/catalogue/offerings/${offeringId}/slots/${slotId}`, { role: "administrator", method: "PUT", body: { capacity: 30, room: "A1.102" } });
  assert.equal(increased.status, 200);
  assert.equal(increased.body.slots[0].remainingCapacity, 28);
  const changed = await call(`/catalogue/offerings/${offeringId}`, { role: "administrator", method: "PUT", body: { academicYear: "2025/2026" } });
  assert.equal(changed.status, 200);
  assert.equal((await call(`/catalogue/offerings/${offeringId}/publish`, { role: "administrator", method: "PATCH", body: { isPublished: false } })).status, 200);
  assert.equal((await call(`/catalogue/offerings/${offeringId}/slots/${slotId}`, { role: "administrator", method: "DELETE" })).status, 400, "assigned slots cannot be deleted");
  await CourseOffering.updateOne({ _id: offeringId, "slots._id": slotId }, { $set: { "slots.$.assignedStudentCount": 0 } });
  assert.equal((await call(`/catalogue/offerings/${offeringId}/slots/${slotId}`, { role: "administrator", method: "DELETE" })).status, 200);
  assert.equal((await call(`/catalogue/offerings/${offeringId}`, { role: "administrator", method: "DELETE" })).status, 200);
});
