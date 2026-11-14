import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { CourseAttempt, ScheduleTemplate, SchedulingPreference, StudentSchedule } from "../models/academics.js";
import { StudentProfile, User } from "../models/identity.js";
import { ExtraHoursRequest, MandatoryCourseRemovalRequest, SlotChangeRequest } from "../models/requests.js";
import { generateToken } from "../middleware/auth.middleware.js";

let database, databasePath, server, base, users, profiles, term, courses, offerings, templates;

before(async () => {
  databasePath = await mkdtemp(join(tmpdir(), "bobos-scheduling-"));
  database = await MongoMemoryReplSet.create({ instanceOpts: [{ dbPath: databasePath }], replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  await Promise.all([User.init(), StudentProfile.init(), AcademicTerm.init(), Course.init(), CourseOffering.init(), ScheduleTemplate.init(), StudentSchedule.init(), SchedulingPreference.init(), CourseAttempt.init(), ExtraHoursRequest.init(), SlotChangeRequest.init()]);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
  if (databasePath) await rm(databasePath, { recursive: true, force: true });
});

beforeEach(async () => {
  await Promise.all([StudentSchedule.deleteMany({}), SlotChangeRequest.deleteMany({}), SchedulingPreference.deleteMany({}), CourseAttempt.deleteMany({}), ExtraHoursRequest.deleteMany({}), MandatoryCourseRemovalRequest.deleteMany({}), ScheduleTemplate.deleteMany({}), CourseOffering.deleteMany({}), Course.deleteMany({}), AcademicTerm.deleteMany({}), StudentProfile.deleteMany({}), User.deleteMany({})]);
  users = {};
  for (const role of ["coordinator", "administrator", "advisor", "normalStudent", "advisingStudent"]) {
    const studentRole = ["normalStudent", "advisingStudent"].includes(role);
    users[role] = await User.create({
      email: `${role}@${studentRole ? "student.guc.edu.eg" : "guc.edu.eg"}`,
      fullName: `${role} User`,
      passwordHash: "test-hash",
      role,
    });
  }
  term = await AcademicTerm.create({
    code: "W26",
    academicYear: "2026/2027",
    season: "winter",
    termStart: new Date("2026-10-01"),
    termEnd: new Date("2027-02-01"),
    teachingStart: new Date("2026-10-05"),
    teachingEnd: new Date("2027-01-20"),
    registrationStart: new Date("2026-09-01"),
    registrationEnd: new Date("2026-10-10"),
    advisingDeadline: new Date("2026-10-15"),
    wholeScheduleSwapDeadline: new Date("2026-10-20"),
    isActive: true,
  });
  courses = await Course.create([
    { code: "CSEN 501", name: "Data Base I", creditHours: 6, courseType: "core", facultyMajors: ["CS"] },
    { code: "MATH 501", name: "Discrete Mathematics", creditHours: 4, courseType: "core", facultyMajors: ["CS"] },
  ]);
  offerings = [];
  for (let i = 0; i < courses.length; i += 1) {
    offerings.push(await CourseOffering.create({
      course: courses[i]._id,
      academicYear: term.academicYear,
      term: term._id,
      instructors: [{ fullName: `Dr. Course ${i + 1}`, email: `course${i + 1}@guc.edu.eg` }],
      eligibleGroups: [1, 2, 3].map((group) => ({ major: "CS", semester: 5, studyGroup: String(group) })),
      isPublished: true,
      slots: [1, 2, 3].map((group) => ({
        componentType: "lecture",
        groupNumber: String(group),
        day: i === 0 ? "Saturday" : "Sunday",
        startMinute: 8 * 60 + 15 + (group - 1) * 120,
        endMinute: 10 * 60 + (group - 1) * 120,
        room: `H${i + group}`,
        capacity: 2,
      })),
    }));
  }
  templates = {};
  for (const group of ["1", "2", "3"]) {
    templates[group] = await ScheduleTemplate.create({
      term: term._id,
      major: "CS",
      semester: 5,
      studyGroup: group,
      isPublished: true,
      courses: courses.map((course, index) => {
        const offering = offerings[index];
        const slot = offering.slots.find((item) => item.groupNumber === group);
        return { course: course._id, courseOffering: offering._id, slots: [{ componentType: "lecture", courseOffering: offering._id, slotGroupId: slot._id }] };
      }),
    });
  }
  profiles = {};
  profiles.normal = await StudentProfile.create({ user: users.normalStudent._id, studentId: "52-00001", studentType: "normal", major: "CS", currentSemester: 5, gpa: 3, academicStanding: "goodAcademicStanding" });
  profiles.advising = await StudentProfile.create({ user: users.advisingStudent._id, studentId: "49-00001", studentType: "advising", advisingReason: "probation", major: "CS", currentSemester: 5, gpa: 2, academicStanding: "probation", assignedAdvisor: users.advisor._id });
});

async function call(path, { role, method = "GET", body } = {}) {
  const headers = {};
  if (role) headers.Authorization = `Bearer ${generateToken(users[role])}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, body: result, headers: response.headers };
}

test("Group C schedule requirements use the active Development API and shared models", async () => {
  assert.equal((await call("/group-assignments/terms")).status, 401);
  assert.equal((await call("/group-assignments/terms", { role: "normalStudent" })).status, 403);
  assert.equal((await call("/group-assignments/terms", { role: "coordinator" })).body.terms[0]._id, String(term._id));

  const list = await call(`/group-assignments/students?termId=${term._id}&search=%5B`, { role: "coordinator" });
  assert.equal(list.status, 200);
  assert.equal(list.body.count, 0, "search metacharacters are treated literally");
  assert.equal((await call(`/group-assignments/groups?termId=${term._id}`, { role: "administrator" })).body.count, 3);
  assert.equal((await call("/group-assignments", { role: "administrator", method: "POST", body: { studentId: String(profiles.normal._id), termId: String(term._id), studyGroup: "1" } })).status, 403);

  const assigned = await call("/group-assignments", { role: "coordinator", method: "POST", body: { studentId: String(profiles.normal._id), termId: String(term._id), studyGroup: "1" } });
  assert.equal(assigned.status, 201);
  assert.equal(assigned.body.student.assignment.studyGroup, "1");
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots[0].assignedStudentCount, 1);

  const token = { headers: { Authorization: `Bearer ${generateToken(users.normalStudent)}` } };
  const ownSchedule = await fetch(`${base}/schedules/me?termId=${term._id}`, token);
  assert.equal(ownSchedule.status, 200);
  const schedule = await ownSchedule.json();
  assert.equal(schedule.schedule.totalCreditHours, 10);
  assert.equal(schedule.schedule.week.Saturday.length, 1);
  assert.deepEqual(schedule.schedule.daysOff, ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const registered = await call(`/schedules/me/courses?termId=${term._id}`, { role: "normalStudent" });
  assert.equal(registered.body.totalCreditHours, 10);
  assert.equal(registered.body.courseCount, 2);
  const details = await call(`/schedules/me/courses/${courses[0]._id}?termId=${term._id}`, { role: "normalStudent" });
  assert.equal(details.body.components.lecture.room, "H1");
  assert.deepEqual(details.body.instructors.map((item) => item.fullName), ["Dr. Course 1"]);
  assert.equal((await call(`/schedules/me/courses/${courses[1]._id}?termId=${term._id}`, { role: "normalStudent" })).body.components.lab, null);

  const swaps = await call(`/swaps/eligible-groups?termId=${term._id}`, { role: "normalStudent" });
  assert.deepEqual(swaps.body.eligibleGroups.map((group) => group.studyGroup), ["2", "3"]);
  assert.equal((await call(`/swaps/eligible-groups?termId=${term._id}`, { role: "advisingStudent" })).status, 403);
  const pdf = await call(`/schedules/me/download?termId=${term._id}`, { role: "normalStudent" });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(pdf.body.subarray(0, 5).toString(), "%PDF-");

  const reassigned = await call("/group-assignments", { role: "coordinator", method: "POST", body: { studentId: String(profiles.normal._id), termId: String(term._id), studyGroup: "2" } });
  assert.equal(reassigned.status, 200);
  assert.equal(String((await StudentProfile.findById(profiles.normal._id)).studyGroup), "2");
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots[0].assignedStudentCount, 0);
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots[1].assignedStudentCount, 1);
  assert.equal((await call(`/group-assignments/${profiles.normal._id}?termId=${term._id}`, { role: "coordinator" })).body.student.assignment.studyGroup, "2");

  const staffList = await call(`/schedules/students?termId=${term._id}`, { role: "advisor" });
  assert.equal(staffList.status, 200);
  assert.equal(staffList.body.count, 1, "advisors only see their own advising roster");
  assert.equal((await call(`/schedules/student/${profiles.normal._id}?termId=${term._id}`, { role: "advisor" })).status, 403);
  assert.equal((await call(`/schedules/student/${profiles.normal._id}?termId=${term._id}`, { role: "administrator" })).status, 200);

  const unassigned = await call(`/group-assignments/${profiles.normal._id}?termId=${term._id}`, { role: "coordinator", method: "DELETE" });
  assert.equal(unassigned.status, 200);
  assert.equal((await call(`/schedules/me?termId=${term._id}`, { role: "normalStudent" })).status, 404);
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots[1].assignedStudentCount, 0);
  assert.equal((await StudentProfile.findById(profiles.normal._id)).studyGroup, undefined);
});

test("advising schedule visibility and download status follow the student workflow", async () => {
  await StudentSchedule.create({ student: profiles.advising._id, term: term._id, scheduleType: "advising", status: "draft", courses: [], createdBy: users.coordinator._id });
  assert.equal((await call(`/schedules/me?termId=${term._id}`, { role: "advisingStudent" })).status, 404);
  assert.equal((await call(`/schedules/students?termId=${term._id}`, { role: "advisor" })).body.students[0].scheduleStatus, "draft");
  await StudentSchedule.updateOne({ student: profiles.advising._id, term: term._id }, { $set: { status: "readyForStudentReview" } });
  assert.equal((await call(`/schedules/me?termId=${term._id}`, { role: "advisingStudent" })).status, 200);
  const download = await call(`/schedules/me/download?termId=${term._id}`, { role: "advisingStudent" });
  assert.equal(download.status, 409);
  assert.match(download.body.message, /not final yet/i);
});

test("Req 58 lets staff send a validated advising draft to student review", async () => {
  const path = `/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`;
  const empty = await call(path, {
    role: "coordinator", method: "PUT", body: { version: 0, courses: [], submitForReview: true },
  });
  assert.equal(empty.status, 409);
  assert.match(empty.body.message, /at least one course/i);

  const submitted = await call(path, {
    role: "advisor", method: "PUT", body: {
      version: 0,
      courses: [{ courseOffering: String(offerings[0]._id), groups: [{ componentType: "lecture", groupNumber: "2" }] }],
      submitForReview: true,
    },
  });
  assert.equal(submitted.status, 201);
  assert.equal(submitted.body.schedule.status, "readyForStudentReview");
  assert.match(submitted.body.message, /sent for student review/i);

  const visibleToStudent = await call(`/schedules/me?termId=${term.code}`, { role: "advisingStudent" });
  assert.equal(visibleToStudent.status, 200);
  assert.equal(visibleToStudent.body.schedule.status, "readyForStudentReview");
  assert.equal(visibleToStudent.body.schedule.courses[0].courseCode, courses[0].code);

  const editClosedDraft = await call(path, {
    role: "coordinator", method: "PUT", body: { version: 1, courses: [], submitForReview: false },
  });
  assert.equal(editClosedDraft.status, 409);
});

test("Req 58: staff see the latest ranked preferences while creating and updating an advising draft", async () => {
  await SchedulingPreference.create({
    student: profiles.advising._id,
    term: term._id,
    preferredDays: [{ day: "Wednesday", priority: 2 }, { day: "Monday", priority: 1 }],
    avoidedTimes: [{ startMinute: 480, endMinute: 540, priority: 1 }],
    preferredGroups: [
      { course: courses[0]._id, componentType: "lecture", groupNumber: "3", priority: 2 },
      { course: courses[0]._id, componentType: "lecture", groupNumber: "2", priority: 1 },
    ],
    note: "Prefer a later lecture if seats permit.",
  });
  const submittedAt = (await SchedulingPreference.findOne({ student: profiles.advising._id, term: term._id })).updatedAt;

  const loaded = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "advisor" });
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.preferenceLastUpdatedAt, submittedAt.toISOString());
  assert.deepEqual(loaded.body.preference.preferredDays.map((item) => item.day), ["Monday", "Wednesday"]);
  assert.deepEqual(loaded.body.preference.preferredGroups.map((item) => item.groupNumber), ["2", "3"]);
  assert.equal(loaded.body.preference.preferredGroups[0].course.code, courses[0].code);
  assert.equal(loaded.body.offerings.find((item) => item.course.code === courses[0].code).groups.find((item) => item.groupNumber === "2").preferredPriorities[0], 1);
  assert.equal(loaded.body.offerings.find((item) => item.course.code === courses[0].code).groups.find((item) => item.groupNumber === "3").preferredPriorities[0], 2);
  assert.equal(loaded.body.schedule, null);

  const firstSave = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: [{ courseOffering: String(offerings[0]._id), groups: [{ componentType: "lecture", groupNumber: "2" }] }] },
  });
  assert.equal(firstSave.status, 201);
  assert.equal(firstSave.body.schedule.status, "draft");
  assert.equal(firstSave.body.schedule.version, 1);
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots.find((slot) => slot.groupNumber === "2").assignedStudentCount, 1, "a saved draft reserves its selected seat");

  const reopened = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "advisor" });
  assert.equal(reopened.body.schedule.version, 1);
  assert.deepEqual(reopened.body.schedule.courses[0].groups, [{ componentType: "lecture", groupNumber: "2" }]);
  assert.equal(reopened.body.preferenceLastUpdatedAt, submittedAt.toISOString(), "latest student preference remains available during edits");
  const secondSave = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "coordinator", method: "PUT", body: { version: 1, courses: [{ courseOffering: String(offerings[1]._id), groups: [{ componentType: "lecture", groupNumber: "3" }] }] },
  });
  assert.equal(secondSave.status, 200);
  assert.equal(secondSave.body.schedule.version, 2);
  assert.equal(secondSave.body.schedule.courses.length, 1);
  assert.equal(String(secondSave.body.schedule.courses[0].course), String(courses[1]._id));
  await CourseOffering.updateOne({ _id: offerings[1]._id }, { $set: { isPublished: false } });
  const staleDraft = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "coordinator" });
  assert.equal(staleDraft.body.schedule.staleCourseCount, 1);
  assert.deepEqual(staleDraft.body.schedule.courses, [], "unpublished course selections are clearly marked for removal before an edit is saved");
});

test("Req 58: missing preferences do not block a draft, while advisor ownership and draft version are enforced", async () => {
  const loaded = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "coordinator" });
  assert.equal(loaded.status, 200);
  assert.equal(loaded.body.preference, null);
  assert.equal(loaded.body.preferenceLastUpdatedAt, null);
  const emptyDraft = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "coordinator", method: "PUT", body: { version: 0, courses: [] } });
  assert.equal(emptyDraft.status, 201);
  assert.equal(emptyDraft.body.schedule.status, "draft");
  assert.equal((await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "normalStudent" })).status, 403);

  const anotherAdvisor = await User.create({ email: "other.advisor@guc.edu.eg", fullName: "Other advisor", passwordHash: "test-hash", role: "advisor" });
  await StudentProfile.updateOne({ _id: profiles.advising._id }, { $set: { assignedAdvisor: anotherAdvisor._id } });
  assert.equal((await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "advisor" })).status, 403);
  const stale = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "coordinator", method: "PUT", body: { version: 0, courses: [] } });
  assert.equal(stale.status, 409);
  await StudentSchedule.updateOne({ student: profiles.advising._id, term: term._id }, { $set: { status: "readyForStudentReview" } });
  const closed = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "coordinator", method: "PUT", body: { version: 1, courses: [] } });
  assert.equal(closed.status, 409);
});

test("Req 58 preserves semester credit limits and only counts activated extra-hours approvals", async () => {
  const addOffering = async (code, creditHours, day) => {
    const course = await Course.create({ code, name: code, creditHours, courseType: "core", facultyMajors: ["CS"] });
    const offering = await CourseOffering.create({
      course: course._id,
      academicYear: term.academicYear,
      term: term._id,
      instructors: [{ fullName: `Dr. ${code}`, email: `${code.toLowerCase()}@guc.edu.eg` }],
      eligibleGroups: [{ major: "CS", semester: 5 }],
      isPublished: true,
      slots: [{ componentType: "lecture", groupNumber: "1", day, startMinute: 600, endMinute: 660, room: "C1", capacity: 5 }],
    });
    return { course, offering };
  };
  const makeSelection = (rows) => rows.map(({ offering }) => ({ courseOffering: String(offering._id), groups: [{ componentType: "lecture", groupNumber: "1" }] }));
  await StudentProfile.updateOne({ _id: profiles.advising._id }, { $set: { advisingReason: "failedCourses", academicStanding: "goodAcademicStanding" } });
  const twenty = await addOffering("CREDIT20", 20, "Tuesday");
  const three = await addOffering("CREDIT3", 3, "Wednesday");
  const four = await addOffering("CREDIT4", 4, "Thursday");
  const twentyOne = await addOffering("CREDIT21", 21, "Thursday");
  const twentyFour = await addOffering("CREDIT24", 24, "Monday");

  const loaded = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "advisor" });
  assert.equal(loaded.body.creditPolicy.standardAllowance, 30);
  assert.equal(loaded.body.creditPolicy.maximumCreditHours, 30);

  const overWithoutApproval = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: makeSelection([{ offering: offerings[0] }, { offering: offerings[1] }, twentyOne]) },
  });
  assert.equal(overWithoutApproval.status, 409);
  assert.match(overWithoutApproval.body.message, /above the allowed 30/);

  await ExtraHoursRequest.create({
    student: profiles.advising._id,
    advisor: users.advisor._id,
    term: term._id,
    courses: [{ course: three.course._id, hours: 3, isRepeated: false, pricePerHour: 800, subtotal: 2400 }],
    requestedHours: 3,
    totalCost: 2400,
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 33, isProbation: false, graduatingWithinOneYear: false },
    decisionStatus: "approved",
    settlementStatus: "awaitingChoice",
  });
  const notActivated = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: makeSelection([{ offering: offerings[0] }, { offering: offerings[1] }, twenty, three]) },
  });
  assert.equal(notActivated.status, 409, "approval without payment/deferred settlement grants no hours");

  await ExtraHoursRequest.updateOne({ student: profiles.advising._id, term: term._id }, { $set: { settlementStatus: "deferred", settlementOption: "deferred" } });
  const activated = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: makeSelection([{ offering: offerings[0] }, { offering: offerings[1] }, twenty, three]) },
  });
  assert.equal(activated.status, 201);
  assert.equal(activated.body.schedule.courses.reduce((sum, course) => sum + course.creditHoursSnapshot, 0), 33);
  assert.equal(activated.body.schedule.courses.find((course) => String(course.course) === String(three.course._id)).isExtraHours, true);

  await StudentSchedule.deleteMany({ student: profiles.advising._id, term: term._id });
  await ExtraHoursRequest.deleteMany({ student: profiles.advising._id, term: term._id });
  await ExtraHoursRequest.create({
    student: profiles.advising._id,
    advisor: users.advisor._id,
    term: term._id,
    courses: [{ course: four.course._id, hours: 4, isRepeated: false, pricePerHour: 800, subtotal: 3200 }],
    requestedHours: 4,
    totalCost: 3200,
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 34, isProbation: false, graduatingWithinOneYear: true },
    decisionStatus: "approved",
    settlementStatus: "paid",
    settlementOption: "wallet",
  });
  const graduating = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: makeSelection([{ offering: offerings[0] }, { offering: offerings[1] }, twenty, four]) },
  });
  assert.equal(graduating.status, 201, "a paid approved request can reach the 34-hour graduation ceiling");
  assert.equal(graduating.body.schedule.courses.reduce((sum, course) => sum + course.creditHoursSnapshot, 0), 34);

  await StudentSchedule.deleteMany({ student: profiles.advising._id, term: term._id });
  await ExtraHoursRequest.deleteMany({ student: profiles.advising._id, term: term._id });
  await StudentProfile.updateOne({ _id: profiles.advising._id }, { $set: { advisingReason: "probation", academicStanding: "probation" } });
  const probation = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "coordinator" });
  assert.equal(probation.body.creditPolicy.baseAllowance, 23, "30 hours reduced by 25%, rounded up");
  const overProbation = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "coordinator", method: "PUT", body: { version: 0, courses: makeSelection([twentyFour]) },
  });
  assert.equal(overProbation.status, 409);
  assert.match(overProbation.body.message, /allowed 23 probation hours/);
});

test("advising drafts preserve failed-course requirements unless removal is approved", async () => {
  await CourseAttempt.create({ student: profiles.advising._id, course: courses[0]._id, term: term._id, attendance: "attended", result: "failed", grade: "F" });
  const loaded = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "advisor" });
  assert.deepEqual(loaded.body.mandatoryCourses.map((course) => course.code), [courses[0].code]);

  const omitted = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: [{ courseOffering: String(offerings[1]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] }] },
  });
  assert.equal(omitted.status, 409);
  assert.match(omitted.body.message, /Add the required failed\/unattended courses/);

  const valid = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: [{ courseOffering: String(offerings[0]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] }] },
  });
  assert.equal(valid.status, 201);
  assert.equal(valid.body.schedule.courses[0].isMandatory, true);
  await MandatoryCourseRemovalRequest.create({ student: profiles.advising._id, course: courses[0]._id, advisor: users.advisor._id, term: term._id, reason: "completedHours", explanation: "Approved removal for the test scenario.", status: "approved" });
  const afterApproval = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, { role: "advisor" });
  assert.deepEqual(afterApproval.body.mandatoryCourses, []);
  const updated = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 1, courses: [{ courseOffering: String(offerings[1]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] }] },
  });
  assert.equal(updated.status, 200);
});

test("advising drafts reject clashes, full groups, passed courses and unmet prerequisites", async () => {
  await Course.updateOne({ _id: courses[0]._id }, { $set: { prerequisites: [courses[1]._id] } });
  const prerequisite = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: [{ courseOffering: String(offerings[0]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] }] },
  });
  assert.equal(prerequisite.status, 409);
  assert.match(prerequisite.body.message, /requires previously passed/);

  await CourseAttempt.create({ student: profiles.advising._id, course: courses[1]._id, term: term._id, attendance: "attended", result: "passed", grade: "A" });
  await CourseOffering.updateOne({ _id: offerings[0]._id }, { $set: { "slots.0.assignedStudentCount": 2 } });
  const full = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: [{ courseOffering: String(offerings[0]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] }] },
  });
  assert.equal(full.status, 409);
  assert.match(full.body.message, /is full/);

  await Course.updateOne({ _id: courses[0]._id }, { $set: { prerequisites: [] } });
  await CourseAttempt.deleteMany({ student: profiles.advising._id });
  await CourseOffering.updateOne({ _id: offerings[0]._id }, { $set: { "slots.0.assignedStudentCount": 0 } });
  await CourseOffering.updateOne({ _id: offerings[1]._id }, { $set: { "slots.0.day": "Saturday", "slots.0.startMinute": 500, "slots.0.endMinute": 580 } });
  const clash = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`, {
    role: "advisor", method: "PUT", body: { version: 0, courses: [
      { courseOffering: String(offerings[0]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] },
      { courseOffering: String(offerings[1]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] },
    ] },
  });
  assert.equal(clash.status, 409);
  assert.match(clash.body.message, /Selected groups overlap/);
  assert.equal(await StudentSchedule.countDocuments({ student: profiles.advising._id, term: term._id }), 0);
});

test("C2 Req 24 copies only offering structure, reports both conflicts, and skips existing courses on retry", async () => {
  const target = await AcademicTerm.create({
    ...term.toObject(), _id: undefined, code: "W27", academicYear: "2027/2028", isActive: false,
    termStart: new Date("2027-10-01"), termEnd: new Date("2028-02-01"),
    teachingStart: new Date("2027-10-05"), teachingEnd: new Date("2028-01-20"),
  });
  const source = offerings[0];
  const targetExisting = await CourseOffering.create({
    term: target._id, academicYear: target.academicYear, course: courses[1]._id,
    instructors: source.instructors, eligibleGroups: source.eligibleGroups, isPublished: true,
    slots: [{ ...source.slots[0].toObject(), _id: undefined, capacity: 7, assignedStudentCount: 1 }],
  });
  await CourseOffering.updateOne({ _id: source._id }, { $set: { "slots.0.assignedStudentCount": 2 } });
  const path = "/catalogue/offerings/duplicate";
  const body = { sourceAcademicYear: term.academicYear, sourceSeason: term.season, targetTermId: String(target._id) };
  assert.equal((await call(path, { role: "coordinator", method: "POST", body })).status, 403);
  assert.equal((await call(path, { role: "administrator", method: "POST", body: { ...body, targetTermId: term.code } })).status, 400);
  const copySelection = (offeringIds) => call(path, { role: "administrator", method: "POST", body: { ...body, offeringIds } });
  assert.equal((await copySelection([])).status, 400);
  assert.equal((await copySelection([String(source._id), String(targetExisting._id)])).status, 400);
  assert.equal(await CourseOffering.countDocuments({ term: target._id }), 1);

  const copied = await copySelection([String(source._id)]);
  assert.equal(copied.status, 201);
  assert.deepEqual(copied.body.skipped, [], "unselected offerings are omitted from the copy and skip report");
  assert.deepEqual(copied.body.conflicts.map(({ type }) => type).sort(), ["instructor", "room"]);
  const [draft] = copied.body.created;
  assert.equal(draft.course, String(courses[0]._id));
  assert.equal(draft.term, String(target._id));
  assert.equal(draft.academicYear, target.academicYear);
  assert.equal(draft.isPublished, false);
  assert.deepEqual(draft.instructors, source.instructors.map((item) => item.toObject()));
  assert.deepEqual(draft.eligibleGroups, source.eligibleGroups.map((item) => item.toObject()));
  for (const [index, slot] of draft.slots.entries()) {
    const original = source.slots[index];
    assert.notEqual(slot._id, String(original._id));
    for (const key of ["componentType", "groupNumber", "day", "startMinute", "endMinute", "room", "capacity"]) {
      assert.equal(slot[key], original[key]);
    }
    assert.equal(slot.assignedStudentCount, 0);
    assert.equal(slot.remainingCapacity, slot.capacity);
  }
  const visible = await call(`/catalogue/offerings?termId=${target.code}`, { role: "advisor" });
  assert.deepEqual(visible.body.offerings.map(({ _id }) => _id), [String(targetExisting._id)]);
  assert.equal((await CourseOffering.findById(targetExisting._id)).slots[0].assignedStudentCount, 1);
  assert.equal((await CourseOffering.findById(source._id)).slots[0].assignedStudentCount, 2);

  const retry = await call(path, { role: "administrator", method: "POST", body });
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body.created, []);
  assert.deepEqual(retry.body.skipped.sort(), courses.map(({ code }) => code).sort());
  assert.equal(await CourseOffering.countDocuments({ term: target._id }), 2);
});

test("C2 Req 74–78 resumes partial drafts and reserves, changes, and releases seats", async () => {
  const offering = offerings[0];
  offering.slots[0].capacity = 1;
  offering.slots.push({ componentType: "lab", groupNumber: "L1", day: "Tuesday", startMinute: 600, endMinute: 660, room: "LAB", capacity: 1 });
  await offering.save();
  const path = `/schedules/advising/${profiles.advising._id}/draft?termId=${term.code}`;
  const selection = (groupNumber) => [{ courseOffering: String(offering._id), groups: groupNumber ? [{ componentType: "lecture", groupNumber }] : [] }];
  const save = (version, groupNumber, submitForReview = false) => call(path, {
    role: "advisor", method: "PUT", body: { version, courses: selection(groupNumber), submitForReview },
  });
  const counts = async () => (await CourseOffering.findById(offering._id)).slots.map((slot) => slot.assignedStudentCount);

  assert.equal((await save(0)).status, 201);
  const resumed = await call(path, { role: "coordinator" });
  assert.deepEqual(resumed.body.schedule.courses, selection());
  assert.deepEqual(resumed.body.validationIssues.map(({ code }) => code), ["missingSlot", "missingSlot"]);
  assert.equal((await save(1, "1", true)).status, 409);
  assert.deepEqual(await counts(), [0, 0, 0, 0]);
  assert.equal((await save(1, "1")).status, 200);
  const assigned = await call(path, { role: "advisor" });
  assert.deepEqual(assigned.body.schedule.courses, selection("1"));
  const lecture = assigned.body.offerings.find(({ _id }) => _id === String(offering._id)).groups[0];
  assert.equal(lecture.availableSeats, 0);
  assert.equal(lecture.slots[0].remainingCapacity, 0);
  assert.equal(lecture.reservedForStudent, true);

  assert.equal((await save(2, "1")).status, 200, "retaining the last reserved seat succeeds");
  assert.deepEqual(await counts(), [1, 0, 0, 0]);
  assert.equal((await save(3, "2")).status, 200);
  assert.deepEqual(await counts(), [0, 1, 0, 0]);
  assert.equal((await save(4)).status, 200);
  assert.deepEqual(await counts(), [0, 0, 0, 0]);
  assert.deepEqual((await call(path, { role: "advisor" })).body.schedule.courses, selection());
});

test("C2 Req 76–77 concurrent draft edits award the last seat once and roll back the losing edit", async () => {
  const otherUser = await User.create({ email: "other@student.guc.edu.eg", fullName: "Other Student", passwordHash: "test-hash", role: "advisingStudent" });
  const other = await StudentProfile.create({ user: otherUser._id, studentId: "49-00002", studentType: "advising", advisingReason: "probation", major: "CS", currentSemester: 5, gpa: 2, academicStanding: "probation" });
  const offering = offerings[0];
  await CourseOffering.updateOne({ _id: offering._id }, { $set: { "slots.0.capacity": 1 } });
  const save = (student, version, groupNumber) => call(`/schedules/advising/${student._id}/draft?termId=${term.code}`, {
    role: "coordinator", method: "PUT", body: { version, courses: [{ courseOffering: String(offering._id), groups: [{ componentType: "lecture", groupNumber }] }] },
  });
  const students = [profiles.advising, other];
  for (const [index, student] of students.entries()) assert.equal((await save(student, 0, String(index + 2))).status, 201);
  const race = await Promise.all(students.map((student) => save(student, 1, "1")));
  assert.deepEqual(race.map(({ status }) => status).sort(), [200, 409]);
  const loser = race.findIndex(({ status }) => status === 409);
  assert.match(race[loser].body.message, /is full/);
  const saved = await StudentSchedule.findOne({ student: students[loser]._id, term: term._id });
  assert.equal(saved.version, 1);
  assert.equal(String(saved.courses[0].slots[0].slotGroupId), String(offering.slots[loser + 1]._id));
  const updated = await CourseOffering.findById(offering._id);
  assert.deepEqual(updated.slots.map((slot) => slot.assignedStudentCount), loser === 0 ? [1, 1, 0] : [1, 0, 1]);
});

test("C2 Req 79 previews simultaneous issues without mutating the draft or reserving seats", async () => {
  const required = await Course.create({ code: "REQ 100", name: "Required Course", creditHours: 4, courseType: "core" });
  await CourseAttempt.create({ student: profiles.advising._id, course: required._id, term: term._id, attendance: "attended", result: "failed", grade: "F" });
  await Course.updateOne({ _id: courses[0]._id }, { $set: { prerequisites: [required._id], creditHours: 22 } });
  offerings[0].slots[0].assignedStudentCount = 2;
  offerings[0].slots.push({ componentType: "tutorial", groupNumber: "T1", day: "Monday", startMinute: 600, endMinute: 660, room: "T1", capacity: 2 });
  await offerings[0].save();
  await CourseOffering.updateOne({ _id: offerings[1]._id }, { $set: { "slots.0.day": "Saturday" } });
  const draftOffering = await CourseOffering.create({ course: required._id, term: term._id, academicYear: term.academicYear });
  const selected = [
    ...offerings.map((offering) => ({ courseOffering: String(offering._id), groups: [{ componentType: "lecture", groupNumber: "1" }] })),
    { courseOffering: String(draftOffering._id), groups: [] },
  ];
  const path = `/schedules/advising/${profiles.advising._id}/draft/validate?termId=${term.code}`;
  const result = await call(path, { role: "advisor", method: "POST", body: { courses: selected } });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.validationIssues.map(({ code }) => code).sort(), [
    "capacity", "creditHours", "missingMandatoryCourse", "missingSlot", "prerequisites", "timetableClash", "unavailableOffering",
  ]);
  assert.equal((await call(path, { role: "advisingStudent", method: "POST", body: { courses: selected } })).status, 403);
  assert.equal(await StudentSchedule.countDocuments({}), 0);
  assert.equal((await CourseOffering.findById(offerings[1]._id)).slots[0].assignedStudentCount, 0);
});

test("assignment rejects inactive/non-normal students, unknown terms, unpublished templates and full slots", async () => {
  const inactive = await StudentProfile.create({ user: (await User.create({ email: "inactive@student.guc.edu.eg", fullName: "Inactive", passwordHash: "hash", role: "normalStudent" }))._id, studentId: "52-00002", studentType: "normal", major: "CS", currentSemester: 5, gpa: 2, academicStanding: "goodAcademicStanding", enrollmentStatus: "inactive" });
  const baseBody = { termId: String(term._id), studyGroup: "1" };
  assert.equal((await call("/group-assignments", { role: "coordinator", method: "POST", body: { ...baseBody, studentId: String(inactive._id) } })).status, 400);
  assert.equal((await call("/group-assignments", { role: "coordinator", method: "POST", body: { ...baseBody, studentId: String(profiles.advising._id) } })).status, 400);
  assert.equal((await call("/group-assignments", { role: "coordinator", method: "POST", body: { ...baseBody, studentId: String(profiles.normal._id), termId: "bad" } })).status, 404);
  await ScheduleTemplate.updateOne({ _id: templates["1"]._id }, { $set: { isPublished: false } });
  assert.equal((await call("/group-assignments", { role: "coordinator", method: "POST", body: { ...baseBody, studentId: String(profiles.normal._id) } })).status, 409);
  await ScheduleTemplate.updateOne({ _id: templates["1"]._id }, { $set: { isPublished: true } });
  await CourseOffering.updateOne({ _id: offerings[0]._id, "slots.groupNumber": "1" }, { $set: { "slots.$.assignedStudentCount": 2 } });
  const full = await call("/group-assignments", { role: "coordinator", method: "POST", body: { ...baseBody, studentId: String(profiles.normal._id) } });
  assert.equal(full.status, 409);
});

test("assignment rejects stale slot references and timetable clashes", async () => {
  await ScheduleTemplate.updateOne({ _id: templates["1"]._id }, { $set: { "courses.1.slots.0.slotGroupId": new mongoose.Types.ObjectId() } });
  const stale = await call("/group-assignments", { role: "coordinator", method: "POST", body: { studentId: String(profiles.normal._id), termId: String(term._id), studyGroup: "1" } });
  assert.equal(stale.status, 409);
  await ScheduleTemplate.updateOne({ _id: templates["1"]._id }, { $set: { "courses.1.slots.0.slotGroupId": offerings[1].slots[0]._id } });
  await CourseOffering.updateOne({ _id: offerings[1]._id, "slots.groupNumber": "1" }, { $set: { "slots.$.day": "Saturday", "slots.$.startMinute": 500, "slots.$.endMinute": 580 } });
  const clash = await call("/group-assignments", { role: "coordinator", method: "POST", body: { studentId: String(profiles.normal._id), termId: String(term._id), studyGroup: "1" } });
  assert.equal(clash.status, 409);
});

test("C1 Req 59 shows advising reason, credit allowance, status and bachelor-project eligibility", async () => {
  const path = `/schedules/advising/${profiles.advising._id}/overview?termId=${term._id}`;
  assert.equal((await call(path)).status, 401);
  assert.equal((await call(path, { role: "advisingStudent" })).status, 403);
  await StudentProfile.updateOne({ _id: profiles.advising._id }, { assignedAdvisor: null });
  assert.equal((await call(path, { role: "advisor" })).status, 403, "unassigned advisor");
  assert.equal((await call(`/schedules/advising/${profiles.normal._id}/overview`, { role: "coordinator" })).status, 400);

  const first = await call(path, { role: "coordinator" });
  assert.equal(first.status, 200);
  assert.equal(first.body.advisingReason, "probation");
  assert.equal(first.body.scheduleStatus, "notStarted");
  assert.equal(first.body.creditHours.standardAllowance, 30);
  assert.equal(first.body.creditHours.allowedHours, 23, "30 * 0.75 = 22.5 rounds up");
  assert.equal(first.body.creditHours.reductionForProbation, 7);
  assert.equal(first.body.creditHours.extraHoursAllowed, false);

  await StudentProfile.updateOne({ _id: profiles.advising._id }, { assignedAdvisor: users.advisor._id });
  assert.equal((await call(path, { role: "advisor" })).status, 200);
  assert.equal((await call(path, { role: "administrator" })).status, 200);

  const extra = await Course.create([
    { code: "CSEN 101", name: "Intro", creditHours: 4, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 1 },
    { code: "CSEN 301", name: "Algorithms", creditHours: 4, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 3 },
    { code: "CSEN 701", name: "Late", creditHours: 4, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 7 },
    { code: "RPW401", name: "Research Paper Writing", creditHours: 2, courseType: "huma", facultyMajors: [], recommendedSemester: 4 },
  ]);
  const [c101, c301, , rpw] = extra;
  const attempt = (course, result) => CourseAttempt.create({ student: profiles.advising._id, course: course._id, term: term._id, attendance: "attended", result, grade: result === "passed" ? "A" : "F" });
  await attempt(c101, "passed");
  await attempt(c301, "failed");
  let overview = (await call(path, { role: "coordinator" })).body;
  assert.equal(overview.bachelorProject.eligible, false, "RPW and CS courses 5-6 missing");

  await Course.deleteMany({ _id: { $in: courses.map((course) => course._id) } }); // semester-less fixture courses are irrelevant
  overview = (await call(path, { role: "coordinator" })).body;
  assert.equal(overview.bachelorProject.eligible, false);
  assert.match(overview.bachelorProject.reasons[0], /RPW401/);

  await attempt(rpw, "passed");
  overview = (await call(path, { role: "coordinator" })).body;
  assert.equal(overview.bachelorProject.eligible, true, "one failed course with all English complete stays eligible");
  assert.equal(overview.bachelorProject.eligibleWithFailedCourses, true);
});

test("C1 Req 60 adds the bachelor project for eligible students and applies the four-course rule", async () => {
  const path = `/schedules/advising/${profiles.advising._id}/bachelor-project?termId=${term._id}`;
  const put = (role, body) => call(path, { role, method: "PUT", body });
  assert.equal((await put(undefined, { season: "winter" })).status, 401);
  assert.equal((await put("administrator", { season: "winter" })).status, 403);
  assert.equal((await put("advisor", { season: "summer" })).status, 400);
  assert.equal((await put("advisor", { season: "winter", extra: 1 })).status, 400);

  const blocker = await Course.create({ code: "RPW401", name: "Research Paper Writing", creditHours: 2, courseType: "huma", facultyMajors: [], recommendedSemester: 4 });
  const ineligible = await put("advisor", { season: "winter" });
  assert.equal(ineligible.status, 409);
  assert.match(ineligible.body.validationIssues[0].message, /RPW401/);
  assert.equal(await StudentSchedule.countDocuments({ student: profiles.advising._id }), 0);

  await CourseAttempt.create({ student: profiles.advising._id, course: blocker._id, term: term._id, attendance: "attended", result: "passed", grade: "A" });
  const added = await put("advisor", { season: "Spring" });
  assert.equal(added.status, 201);
  assert.equal(added.body.schedule.bachelorProject.season, "spring");
  const changed = await put("coordinator", { season: "winter" });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.schedule.version, 2);
  const overview = (await call(`/schedules/advising/${profiles.advising._id}/overview?termId=${term._id}`, { role: "advisor" })).body;
  assert.equal(overview.bachelorProject.selection.season, "winter");
  assert.equal(overview.scheduleStatus, "draft");

  const extraCore = await Course.create({ code: "CSEN 502", name: "Operating Systems", creditHours: 4, courseType: "core", facultyMajors: ["CS"] });
  const german = await Course.create({ code: "DE 101", name: "German 1", creditHours: 4, courseType: "huma", facultyMajors: [] });
  const make = (course, day) => CourseOffering.create({
    course: course._id, academicYear: term.academicYear, term: term._id, isPublished: true,
    instructors: [{ fullName: "Dr. X", email: "x@guc.edu.eg" }],
    eligibleGroups: [{ major: "CS", semester: 5, studyGroup: "1" }],
    slots: [{ componentType: "lecture", groupNumber: "1", day, startMinute: 600, endMinute: 720, room: "H9", capacity: 5 }],
  });
  const [coreOffering, germanOffering] = [await make(extraCore, "Monday"), await make(german, "Tuesday")];
  const pick = (offering) => ({ courseOffering: String(offering._id), groups: [{ componentType: "lecture", groupNumber: "1" }] });
  const validate = (offeringsToPick) => call(`/schedules/advising/${profiles.advising._id}/draft/validate?termId=${term._id}`, { role: "advisor", method: "POST", body: { courses: offeringsToPick.map(pick) } });

  const tooManyCore = await validate([offerings[0], offerings[1], coreOffering]);
  assert.ok(tooManyCore.body.validationIssues.some((issue) => issue.code === "bachelorProjectLimit" && /core/.test(issue.message)));
  const humanities = await validate([offerings[0], germanOffering]);
  const extraIssue = humanities.body.validationIssues.find((issue) => issue.code === "bachelorProjectExtraHours");
  assert.ok(extraIssue && extraIssue.blocksSave === false, "humanities need extra hours but do not block saving a draft");

  const removed = await call(path, { role: "advisor", method: "DELETE" });
  assert.equal(removed.status, 200);
  assert.equal((await call(path, { role: "advisor", method: "DELETE" })).status, 404);
  const afterRemoval = await validate([offerings[0], offerings[1], coreOffering]);
  assert.ok(!afterRemoval.body.validationIssues.some((issue) => issue.code === "bachelorProjectLimit"));

  await StudentSchedule.updateOne({ student: profiles.advising._id }, { status: "readyForStudentReview" });
  assert.equal((await put("advisor", { season: "winter" })).status, 409, "only open drafts can change");
});

test("C1 Req 62 creates one open draft per student and term and shows optional preferences", async () => {
  const path = `/schedules/advising/${profiles.advising._id}/draft?termId=${term._id}`;
  const create = (role) => call(path, { role, method: "POST" });
  assert.equal((await create()).status, 401);
  assert.equal((await create("advisingStudent")).status, 403);
  assert.equal((await create("administrator")).status, 403);
  assert.equal((await call(`/schedules/advising/${profiles.normal._id}/draft?termId=${term._id}`, { role: "coordinator", method: "POST" })).status, 400);
  assert.equal((await call(path, { role: "advisor", method: "POST", body: { courses: [] } })).status, 400);

  const noPreferences = await create("advisor");
  assert.equal(noPreferences.status, 201, "a missing preference record does not block creation");
  assert.equal(noPreferences.body.preference, null);
  assert.equal(noPreferences.body.schedule.status, "draft");
  assert.equal(noPreferences.body.schedule.courses.length, 0);
  assert.equal(noPreferences.body.editable, true);
  assert.equal((await StudentSchedule.findOne({ student: profiles.advising._id })).createdBy.toString(), String(users.advisor._id));

  const duplicate = await create("coordinator");
  assert.equal(duplicate.status, 409);
  assert.match(duplicate.body.message, /open draft already exists/);
  assert.equal(await StudentSchedule.countDocuments({ student: profiles.advising._id }), 1);

  const saved = await call(path, { role: "advisor", method: "PUT", body: { version: noPreferences.body.schedule.version, courses: [] } });
  assert.equal(saved.status, 200, "the created draft can be edited and saved");

  await StudentSchedule.updateOne({ student: profiles.advising._id }, { status: "readyForStudentReview" });
  assert.match((await create("advisor")).body.message, /no longer an open draft/);
});

test("C1 Req 62 returns the latest submitted preferences when the draft is created", async () => {
  await SchedulingPreference.create({ student: profiles.advising._id, term: term._id, preferredDays: [{ day: "Sunday", priority: 1 }], note: "No early starts" });
  const created = await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term._id}`, { role: "coordinator", method: "POST" });
  assert.equal(created.status, 201);
  assert.equal(created.body.preference.preferredDays[0].day, "Sunday");
  assert.equal(created.body.preference.note, "No early starts");
  assert.ok(created.body.preferenceLastUpdatedAt);
});

test("C1 Req 63 selects mandatory courses before others and tracks the hours they consume", async () => {
  const path = `/schedules/advising/${profiles.advising._id}/mandatory-courses?termId=${term._id}`;
  const put = (role, ids) => call(path, { role, method: "PUT", body: { courses: ids } });
  const attempt = (course, result, attendance = "attended") => CourseAttempt.create({ student: profiles.advising._id, course: course._id, term: term._id, attendance, result, grade: result === "failed" ? "F" : undefined });
  assert.equal((await put(undefined, [])).status, 401);
  assert.equal((await put("administrator", [])).status, 403);
  assert.equal((await put("advisor", ["nope"])).status, 400);
  assert.equal((await put("advisor", [String(courses[0]._id)])).status, 400, "a course that is not mandatory is rejected");

  await attempt(courses[0], "failed");
  await attempt(courses[1], "failed", "unattended");
  const first = await put("advisor", [String(courses[0]._id)]);
  assert.equal(first.status, 201, "creates the open draft when none exists");
  assert.equal(first.body.creditHours.mandatoryHours, 6);
  assert.equal(first.body.creditHours.allowedHours, 23);
  assert.equal(first.body.creditHours.remainingAllowedHours, 17);
  assert.equal(first.body.selectedMandatoryCourses.length, 1);
  assert.equal(first.body.unselectedMandatoryCourses[0].code, "MATH 501");

  const both = await put("coordinator", [String(courses[0]._id), String(courses[1]._id)]);
  assert.equal(both.status, 200);
  assert.equal(both.body.creditHours.mandatoryHours, 10);
  assert.equal(both.body.schedule.version, 2);
  const draft = (await call(`/schedules/advising/${profiles.advising._id}/draft?termId=${term._id}`, { role: "advisor" })).body;
  assert.equal(draft.schedule.courses.length, 2);
  assert.ok(draft.mandatoryCourses.every((course) => course.inDraft));
  assert.equal(draft.mandatorySummary.mandatoryHours, 10);
  assert.ok(!draft.validationIssues.some((issue) => issue.code === "missingMandatoryCourse"));

  const stored = await StudentSchedule.findOne({ student: profiles.advising._id });
  assert.ok(stored.courses.every((entry) => entry.isMandatory && entry.slots.length === 0));

  const trimmed = await put("advisor", [String(courses[0]._id)]);
  assert.equal(trimmed.status, 200);
  assert.equal(trimmed.body.creditHours.mandatoryHours, 6);

  stored.courses[0].slots.push({ componentType: "lecture", courseOffering: offerings[0]._id, slotGroupId: offerings[0].slots[0]._id });
  await stored.save();
  const blocked = await put("advisor", []);
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /Remove its slots/);

  const big = await Course.create({ code: "CSEN 599", name: "Huge", creditHours: 30, courseType: "core", facultyMajors: ["CS"] });
  await CourseOffering.create({ course: big._id, academicYear: term.academicYear, term: term._id, isPublished: true, instructors: [{ fullName: "Dr. B", email: "b@guc.edu.eg" }], eligibleGroups: [{ major: "CS", semester: 5, studyGroup: "1" }], slots: [{ componentType: "lecture", groupNumber: "1", day: "Monday", startMinute: 600, endMinute: 720, room: "H1", capacity: 5 }] });
  await attempt(big, "failed");
  const over = await put("advisor", [String(courses[0]._id), String(big._id)]);
  assert.equal(over.status, 409);
  assert.match(over.body.message, /above the 23 hours/);

  await StudentSchedule.updateOne({ student: profiles.advising._id }, { status: "readyForStudentReview" });
  assert.equal((await put("advisor", [String(courses[0]._id)])).status, 409, "only open drafts can change");
});

test("C1 Req 70 lists only courses the student may take, with reasons for the rest", async () => {
  const path = `/schedules/advising/${profiles.advising._id}/eligible-courses?termId=${term._id}`;
  assert.equal((await call(path)).status, 401);
  assert.equal((await call(path, { role: "administrator" })).status, 403);
  const make = async (fields, semester = 5) => {
    const course = await Course.create({ creditHours: 3, courseType: "core", facultyMajors: ["CS"], ...fields });
    await CourseOffering.create({ course: course._id, academicYear: term.academicYear, term: term._id, isPublished: true, instructors: [{ fullName: "Dr. Z", email: "z@guc.edu.eg" }], eligibleGroups: [{ major: "CS", semester, studyGroup: "1" }], slots: [{ componentType: "lecture", groupNumber: "1", day: "Monday", startMinute: 600, endMinute: 720, room: "H2", capacity: 5 }] });
    return course;
  };
  const needsPrereq = await make({ code: "CSEN 510", name: "Needs Prereq", prerequisites: [courses[0]._id] });
  await make({ code: "CSEN 511", name: "Spring Only", offeringSeasons: ["spring"] });
  await make({ code: "CSEN 512", name: "Any Season", offeringSeasons: ["winter", "spring"] });
  await make({ code: "CSEN 513", name: "Other Semester" }, 7);
  await CourseAttempt.create({ student: profiles.advising._id, course: courses[1]._id, term: term._id, attendance: "attended", result: "passed", grade: "A" });
  await CourseAttempt.create({ student: profiles.advising._id, course: courses[0]._id, term: term._id, attendance: "attended", result: "failed", grade: "F" });

  const result = await call(path, { role: "advisor" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.courses.map((entry) => entry.course.code), ["CSEN 512"]);
  const reasons = Object.fromEntries(result.body.excluded.map((entry) => [entry.code, entry.reason]));
  assert.equal(reasons["MATH 501"], "alreadyCompleted");
  assert.equal(reasons["CSEN 510"], "unmetPrerequisites");
  assert.equal(reasons["CSEN 511"], "notOfferedInSeason");
  assert.ok(!("CSEN 501" in reasons) && !("CSEN 513" in reasons), "mandatory and other-semester courses are not listed");
  assert.equal((await call(`${path}&search=zzz`, { role: "advisor" })).body.count, 0);

  await CourseAttempt.create({ student: profiles.advising._id, course: courses[0]._id, term: term._id, attemptNumber: 2, attendance: "attended", result: "passed", grade: "B" });
  const unlocked = await call(path, { role: "advisor" });
  assert.ok(unlocked.body.courses.some((entry) => entry.course.code === "CSEN 510"), "a met prerequisite makes the course eligible");
  assert.equal(needsPrereq.code, "CSEN 510");
});

test("C1 Req 71-73 adds and removes non-mandatory courses and reports credit hours", async () => {
  const base = `/schedules/advising/${profiles.advising._id}`;
  const q = `?termId=${term._id}`;
  const add = (role, courseOffering) => call(`${base}/courses${q}`, { role, method: "POST", body: { courseOffering: String(courseOffering) } });
  const del = (role, courseOffering) => call(`${base}/courses/${courseOffering}${q}`, { role, method: "DELETE" });
  assert.equal((await add(undefined, offerings[1]._id)).status, 401);
  assert.equal((await add("administrator", offerings[1]._id)).status, 403);
  assert.equal((await call(`${base}/courses${q}`, { role: "advisor", method: "POST", body: {} })).status, 400);

  const none = await call(`${base}/credit-hours${q}`, { role: "advisor" });
  assert.equal(none.status, 200);
  assert.equal(none.body.creditHours.selectedHours, 0);
  assert.equal(none.body.creditHours.allowedHours, 23);
  assert.equal(none.body.creditHours.remainingHours, 23);

  const first = await add("advisor", offerings[1]._id);
  assert.equal(first.status, 201);
  assert.equal(first.body.creditHours.selectedHours, 4);
  assert.equal(first.body.creditHours.remainingAllowedHours, 19);
  assert.equal(first.body.creditHours.extraSelectedHours, 0);
  assert.equal((await add("coordinator", offerings[1]._id)).status, 409, "no duplicates");
  assert.equal((await del("advisor", offerings[0]._id)).status, 404, "course not in the draft");

  const big = await Course.create({ code: "CSEN 598", name: "Heavy", creditHours: 24, courseType: "core", facultyMajors: ["CS"] });
  const bigOffering = await CourseOffering.create({ course: big._id, academicYear: term.academicYear, term: term._id, isPublished: true, instructors: [{ fullName: "Dr. H", email: "h@guc.edu.eg" }], eligibleGroups: [{ major: "CS", semester: 5, studyGroup: "1" }], slots: [{ componentType: "lecture", groupNumber: "1", day: "Monday", startMinute: 600, endMinute: 720, room: "H3", capacity: 5 }] });
  const tooMany = await add("advisor", bigOffering._id);
  assert.equal(tooMany.status, 409);
  assert.match(tooMany.body.message, /above the allowed 23/);

  const saved = await call(`${base}/draft${q}`, { role: "advisor", method: "PUT", body: { version: first.body.schedule.version, courses: [{ courseOffering: String(offerings[1]._id), groups: [{ componentType: "lecture", groupNumber: "1" }] }] } });
  assert.equal(saved.status, 200);
  assert.equal((await CourseOffering.findById(offerings[1]._id)).slots.find((slot) => slot.groupNumber === "1").assignedStudentCount, 1);
  const removed = await del("advisor", offerings[1]._id);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.creditHours.selectedHours, 0);
  assert.equal((await CourseOffering.findById(offerings[1]._id)).slots.find((slot) => slot.groupNumber === "1").assignedStudentCount, 0, "seats are released");

  await CourseAttempt.create({ student: profiles.advising._id, course: courses[0]._id, term: term._id, attendance: "attended", result: "failed", grade: "F" });
  const blockedByMandatory = await add("advisor", offerings[1]._id);
  assert.equal(blockedByMandatory.status, 409);
  assert.match(blockedByMandatory.body.message, /mandatory courses before/);
  assert.equal((await add("advisor", offerings[0]._id)).status, 400, "mandatory courses use the mandatory endpoint");
  const select = await call(`${base}/mandatory-courses${q}`, { role: "advisor", method: "PUT", body: { courses: [String(courses[0]._id)] } });
  assert.equal(select.status, 200, "draft already exists");
  const afterMandatory = await add("advisor", offerings[1]._id);
  assert.equal(afterMandatory.status, 201);
  assert.equal(afterMandatory.body.creditHours.mandatoryHours, 6);
  assert.equal(afterMandatory.body.creditHours.otherHours, 4);
  assert.equal((await del("advisor", offerings[0]._id)).status, 409, "mandatory course cannot be removed here");

  await StudentSchedule.updateOne({ student: profiles.advising._id }, { status: "readyForStudentReview" });
  assert.equal((await del("advisor", offerings[1]._id)).status, 409);
  assert.equal((await add("advisor", offerings[1]._id)).status, 409);
});
test("C3: only the assigned advisor and coordinators can resolve a student's request", async () => {
  const route = "/slot-changes";
  const student = "advisingStudent";
  const [current, replacement, full] = offerings[0].slots;
  const submit = (slot = current) => call(route, { role: student, method: "POST",
    body: { courseId: courses[0].id, slotId: String(slot._id), preferenceNote: "Group 2, please." } });
  assert.equal((await submit()).status, 409);
  await AcademicTerm.updateOne({ _id: term._id }, { $set: { advisingDeadline: new Date(Date.now() + 600_000) } });
  await CourseOffering.updateOne({ _id: offerings[0]._id, "slots._id": full._id }, { $set: { "slots.$.assignedStudentCount": full.capacity } });
  const draft = await call(`/schedules/advising/${profiles.advising._id}/draft`, {
    role: "advisor", method: "PUT", body: { version: 0, submitForReview: true,
      courses: [{ courseOffering: offerings[0].id, groups: [{ componentType: "lecture", groupNumber: current.groupNumber }] }] },
  });
  assert.equal(draft.status, 201);
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots.id(current._id).assignedStudentCount, 1);
  assert.equal((await submit(replacement)).status, 400);
  const submitted = await submit();
  assert.equal(submitted.status, 201);
  const id = submitted.body.request._id;
  const decide = (role, decision, slot = replacement, requestId = id) => call(`${route}/${requestId}/decision`, {
    role, method: "POST", body: { decision, replacementSlotId: String(slot._id), responseNote: "Reviewed." },
  });
  const withdraw = (requestId) => call(`${route}/${requestId}/withdraw`, { role: student, method: "POST" });
  assert.equal((await submit()).status, 409);
  assert.equal((await call(route, { role: "administrator" })).status, 403);
  assert.equal((await call(`${route}/${id}`, { role: student })).status, 403);
  assert.equal((await call(route, { role: "advisor" })).body.requests[0].student.user.fullName, users[student].fullName);
  await StudentProfile.updateOne({ _id: profiles.advising._id }, { $set: { assignedAdvisor: null } });
  assert.deepEqual((await call(route, { role: "advisor" })).body.requests, []);
  assert.equal((await call(`${route}/${id}`, { role: "advisor" })).status, 404);
  assert.equal((await decide("advisor", "approved")).status, 404);
  await StudentProfile.updateOne({ _id: profiles.advising._id }, { $set: { assignedAdvisor: users.advisor._id } });
  const detail = await call(`${route}/${id}`, { role: "coordinator" });
  assert.equal(detail.status, 200);
  assert.equal(detail.body.request.preferenceNote, "Group 2, please.");
  assert.deepEqual(detail.body.alternatives.map(({ remainingSeats }) => remainingSeats), [2, 0]);
  assert.equal((await decide("coordinator", "approved", full)).status, 409);
  assert.equal((await withdraw(id)).status, 200);
  const rejectedId = (await submit()).body.request._id;
  assert.equal((await withdraw(id)).status, 409);
  assert.equal((await decide("advisor", "rejected", replacement, rejectedId)).status, 200);
  assert.equal((await withdraw(rejectedId)).status, 409);
  const approvedId = (await submit()).body.request._id;
  await AcademicTerm.updateOne({ _id: term._id }, { $set: { advisingDeadline: new Date(Date.now() - 600_000) } });
  assert.equal((await submit()).status, 409);
  assert.equal((await decide("coordinator", "approved", replacement, approvedId)).status, 200);
  assert.equal((await withdraw(approvedId)).status, 409);
  const history = await call(`${route}/me`, { role: student });
  assert.deepEqual(new Set(history.body.requests.map(({ status }) => status)), new Set(["approved", "rejected", "withdrawn"]));
  const approved = history.body.requests.find(({ status }) => status === "approved");
  assert.equal(approved.replacementSlotGroupId, String(replacement._id));
  assert.equal(approved.responseNote, "Reviewed.");
  assert.equal(approved.decidedBy.fullName, users.coordinator.fullName);
  const schedule = await call("/schedules/me", { role: student });
  assert.equal(schedule.body.schedule.status, "readyForStudentReview");
  assert.equal(schedule.body.schedule.courses[0].slots[0].groupNumber, replacement.groupNumber);
  assert.deepEqual((await CourseOffering.findById(offerings[0]._id)).slots.map(({ assignedStudentCount }) => assignedStudentCount), [0, 1, 2]);
});

test("C3: clash checks and concurrent approvals protect the timetable and final seat", async () => {
  const [current, replacement, clash] = offerings[0].slots;
  const conflict = offerings[1].slots[0];
  await CourseOffering.updateOne({ _id: offerings[0]._id, "slots._id": clash._id },
    { $set: { "slots.$.day": conflict.day, "slots.$.startMinute": conflict.startMinute, "slots.$.endMinute": conflict.endMinute } });
  await CourseOffering.updateOne({ _id: offerings[0]._id, "slots._id": replacement._id }, { $set: { "slots.$.capacity": 1 } });
  await AcademicTerm.updateOne({ _id: term._id }, { $set: { advisingDeadline: new Date(Date.now() + 600_000) } });
  users.secondStudent = await User.create({ email: "second@student.guc.edu.eg", fullName: "Second Student", role: "advisingStudent", passwordHash: "test-hash" });
  const other = await StudentProfile.create({ user: users.secondStudent._id, studentId: "49-00002", studentType: "advising",
    advisingReason: "probation", major: "CS", currentSemester: 5, gpa: 2, academicStanding: "probation" });
  const ids = [];
  for (const [profile, role] of [[profiles.advising, "advisingStudent"], [other, "secondStudent"]]) {
    const result = await call(`/schedules/advising/${profile._id}/draft`, { role: "coordinator", method: "PUT",
      body: { version: 0, submitForReview: true, courses: offerings.map((offering) => ({
        courseOffering: offering.id, groups: [{ componentType: "lecture", groupNumber: "1" }],
      })) } });
    assert.equal(result.status, 201);
    const submitted = await call("/slot-changes", { role, method: "POST", body: { courseId: courses[0].id, slotId: String(current._id) } });
    assert.equal(submitted.status, 201);
    ids.push(submitted.body.request._id);
  }
  const decide = (id, slot) => call(`/slot-changes/${id}/decision`, {
    role: "coordinator", method: "POST", body: { decision: "approved", replacementSlotId: String(slot._id) },
  });
  const detail = await call(`/slot-changes/${ids[0]}`, { role: "coordinator" });
  assert.match(detail.body.alternatives.find(({ slotId }) => slotId === String(clash._id)).clashes[0], /MATH 501/);
  assert.equal((await decide(ids[0], clash)).status, 409);
  const results = await Promise.all(ids.map((id) => decide(id, replacement)));
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 409]);
  assert.deepEqual((await CourseOffering.findById(offerings[0]._id)).slots.map(({ assignedStudentCount }) => assignedStudentCount), [1, 1, 0]);
  const readySchedules = await StudentSchedule.find({ status: "readyForStudentReview" });
  assert.deepEqual(readySchedules.map((schedule) => String(schedule.courses[0].slots[0].slotGroupId)).sort(),
    [String(current._id), String(replacement._id)].sort());
  assert.equal(await SlotChangeRequest.countDocuments({ status: "pending" }), 1);
});
