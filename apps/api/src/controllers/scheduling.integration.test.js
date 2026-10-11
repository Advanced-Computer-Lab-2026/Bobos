import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { CourseAttempt, ScheduleTemplate, SchedulingPreference, StudentSchedule } from "../models/academics.js";
import { StudentProfile, User } from "../models/identity.js";
import { ExtraHoursRequest, MandatoryCourseRemovalRequest } from "../models/requests.js";
import { generateToken } from "../middleware/auth.middleware.js";

let database, databasePath, server, base, users, profiles, term, courses, offerings, templates;

before(async () => {
  databasePath = await mkdtemp(join(process.cwd(), ".mongo-scheduling-"));
  database = await MongoMemoryServer.create({ instance: { dbPath: databasePath } });
  await mongoose.connect(database.getUri());
  await Promise.all([User.init(), StudentProfile.init(), AcademicTerm.init(), Course.init(), CourseOffering.init(), ScheduleTemplate.init(), StudentSchedule.init(), SchedulingPreference.init(), CourseAttempt.init(), ExtraHoursRequest.init()]);
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
  await Promise.all([StudentSchedule.deleteMany({}), SchedulingPreference.deleteMany({}), CourseAttempt.deleteMany({}), ExtraHoursRequest.deleteMany({}), MandatoryCourseRemovalRequest.deleteMany({}), ScheduleTemplate.deleteMany({}), CourseOffering.deleteMany({}), Course.deleteMany({}), AcademicTerm.deleteMany({}), StudentProfile.deleteMany({}), User.deleteMany({})]);
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
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots.find((slot) => slot.groupNumber === "2").assignedStudentCount, 0, "drafts do not reserve seats");

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
