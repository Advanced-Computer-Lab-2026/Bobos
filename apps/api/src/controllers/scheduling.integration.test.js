import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { ScheduleTemplate, StudentSchedule } from "../models/academics.js";
import { StudentProfile, User } from "../models/identity.js";
import { generateToken } from "../middleware/auth.middleware.js";

let database, databasePath, server, base, users, profiles, term, courses, offerings, templates;

before(async () => {
  databasePath = await mkdtemp(join(process.cwd(), ".mongo-scheduling-"));
  database = await MongoMemoryServer.create({ instance: { dbPath: databasePath } });
  await mongoose.connect(database.getUri());
  await Promise.all([User.init(), StudentProfile.init(), AcademicTerm.init(), Course.init(), CourseOffering.init(), ScheduleTemplate.init(), StudentSchedule.init()]);
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
  await Promise.all([StudentSchedule.deleteMany({}), ScheduleTemplate.deleteMany({}), CourseOffering.deleteMany({}), Course.deleteMany({}), AcademicTerm.deleteMany({}), StudentProfile.deleteMany({}), User.deleteMany({})]);
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
  users.otherAdvisor = await User.create({ email: "other-advisor@guc.edu.eg", fullName: "Other Advisor", passwordHash: "test-hash", role: "advisor" });
  users.otherAdvisingStudent = await User.create({ email: "other-advising@student.guc.edu.eg", fullName: "Other Advising Student", passwordHash: "test-hash", role: "advisingStudent" });
  profiles.otherAdvising = await StudentProfile.create({ user: users.otherAdvisingStudent._id, studentId: "49-00002", studentType: "advising", advisingReason: "failedCourses", major: "CS", currentSemester: 5, gpa: 1.8, academicStanding: "probation", assignedAdvisor: users.otherAdvisor._id });
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
  assert.equal(staffList.body.count, 2, "advisors can view the full advising roster");
  assert.equal((await call(`/schedules/student/${profiles.normal._id}?termId=${term._id}`, { role: "advisor" })).status, 403);
  assert.equal((await call(`/schedules/student/${profiles.normal._id}?termId=${term._id}`, { role: "administrator" })).status, 200);
  assert.equal((await call(`/schedules/student/${profiles.otherAdvising._id}?termId=${term._id}`, { role: "advisor" })).status, 404, "another advisor can view an advising student's record even when no schedule exists yet");

  const unassigned = await call(`/group-assignments/${profiles.normal._id}?termId=${term._id}`, { role: "coordinator", method: "DELETE" });
  assert.equal(unassigned.status, 200);
  assert.equal((await call(`/schedules/me?termId=${term._id}`, { role: "normalStudent" })).status, 404);
  assert.equal((await CourseOffering.findById(offerings[0]._id)).slots[1].assignedStudentCount, 0);
  assert.equal((await StudentProfile.findById(profiles.normal._id)).studyGroup, undefined);
});

test("advising schedule visibility and download status follow the student workflow", async () => {
  await StudentSchedule.create({ student: profiles.advising._id, term: term._id, scheduleType: "advising", status: "draft", courses: [], createdBy: users.coordinator._id });
  await StudentSchedule.create({ student: profiles.otherAdvising._id, term: term._id, scheduleType: "advising", status: "draft", courses: [], createdBy: users.coordinator._id });
  assert.equal((await call(`/schedules/me?termId=${term._id}`, { role: "advisingStudent" })).status, 404);
  const advisorView = await call(`/schedules/student/${profiles.otherAdvising._id}?termId=${term._id}`, { role: "advisor" });
  assert.equal(advisorView.status, 200, "advisors can view a draft schedule across advisor assignments");
  assert.equal(advisorView.body.schedule.status, "draft");
  const advisorRoster = await call(`/schedules/students?termId=${term._id}`, { role: "advisor" });
  assert.equal(advisorRoster.body.count, 2);
  assert.ok(advisorRoster.body.students.every(({ scheduleStatus }) => scheduleStatus === "draft"));
  await StudentSchedule.updateOne({ student: profiles.advising._id, term: term._id }, { $set: { status: "readyForStudentReview" } });
  assert.equal((await call(`/schedules/me?termId=${term._id}`, { role: "advisingStudent" })).status, 200);
  const download = await call(`/schedules/me/download?termId=${term._id}`, { role: "advisingStudent" });
  assert.equal(download.status, 409);
  assert.match(download.body.message, /not final yet/i);
});

test("assignment rejects inactive/non-normal students, unpublished templates, full slots and malformed ids", async () => {
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
  await CourseOffering.updateOne({ _id: offerings[0]._id, "slots.groupNumber": "1" }, { $set: { "slots.$.assignedStudentCount": 0 } });
  const codeLookup = await call("/group-assignments", { role: "coordinator", method: "POST", body: { studentId: String(profiles.normal._id), termId: term.code, studyGroup: "1" } });
  assert.equal(codeLookup.status, 201, "term codes are accepted alongside database IDs");
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
