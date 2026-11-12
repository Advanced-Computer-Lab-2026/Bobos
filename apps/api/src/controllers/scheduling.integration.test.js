import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { CourseAttempt, ScheduleTemplate, SchedulingPreference, StudentSchedule } from "../models/academics.js";
import { Notification } from "../models/communications.js";
import { StudentProfile, User } from "../models/identity.js";
import { ExitExamRequest, ExtraHoursRequest, GraduationPlan, MandatoryCourseRemovalRequest, SlotChangeRequest, WholeScheduleSwapRequest } from "../models/requests.js";
import { generateToken } from "../middleware/auth.middleware.js";

let database, databasePath, server, base, users, profiles, term, courses, offerings, templates;

before(async () => {
  databasePath = await mkdtemp(join(process.cwd(), ".mongo-scheduling-"));
  database = await MongoMemoryReplSet.create({ instanceOpts: [{ dbPath: databasePath }], replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  await Promise.all([WholeScheduleSwapRequest.init(), Notification.init()]);
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
  await WholeScheduleSwapRequest.deleteMany({});
  await Promise.all([StudentSchedule.deleteMany({}), SchedulingPreference.deleteMany({}), CourseAttempt.deleteMany({}), ExtraHoursRequest.deleteMany({}), MandatoryCourseRemovalRequest.deleteMany({}), ScheduleTemplate.deleteMany({}), CourseOffering.deleteMany({}), Course.deleteMany({}), AcademicTerm.deleteMany({}), StudentProfile.deleteMany({}), User.deleteMany({}), Notification.deleteMany({}), SlotChangeRequest.deleteMany({}), GraduationPlan.deleteMany({}), ExitExamRequest.deleteMany({})]);
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

async function inbox(role) {
  const response = await call("/notifications", { role });
  assert.equal(response.status, 200, response.body.message);
  return response.body.notifications;
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

test("a student may have only one open whole schedule swap request across terms", async () => {
  const deadline = new Date(Date.now() + 60 * 60 * 1000);
  await AcademicTerm.updateOne({ _id: term._id }, { wholeScheduleSwapDeadline: deadline });
  const { _id: currentTermId, ...termFields } = term.toObject();
  const otherTerm = await AcademicTerm.create({
    ...termFields, code: "S27", season: "spring", isActive: false, wholeScheduleSwapDeadline: deadline,
  });
  const otherSchedule = await StudentSchedule.create({
    student: profiles.normal._id, term: otherTerm._id, scheduleType: "normal",
    status: "processed", createdBy: users.coordinator._id,
  });
  const requestFields = {
    student: profiles.normal._id, term: otherTerm._id, currentSchedule: otherSchedule._id,
    currentGroup: "1", desiredGroups: ["2"], courseCodesSnapshot: courses.map(course => course.code),
    expiresAt: deadline,
  };
  const existingRequest = await WholeScheduleSwapRequest.create(requestFields);
  const assigned = await call("/group-assignments", {
    role: "coordinator", method: "POST",
    body: { studentId: String(profiles.normal._id), termId: String(currentTermId), studyGroup: "1" },
  });
  assert.equal(assigned.status, 201);

  const submit = () => call(`/swaps/requests?termId=${currentTermId}`, {
    role: "normalStudent", method: "POST", body: { desiredGroups: ["2", "3"] },
  });
  const blocked = await submit();
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /already have an open swap request/i);
  await assert.rejects(WholeScheduleSwapRequest.create({
    ...requestFields, term: currentTermId, currentSchedule: assigned.body.student.assignment.scheduleId,
  }), { code: 11000 });

  await WholeScheduleSwapRequest.updateOne({ _id: existingRequest._id }, {
    expiresAt: new Date(Date.now() - 60 * 1000),
  });
  const accepted = await submit();
  assert.equal(accepted.status, 201);
  assert.deepEqual(accepted.body.request.desiredGroups, ["2", "3"]);
  assert.equal((await WholeScheduleSwapRequest.findById(existingRequest._id)).status, "expired");
  assert.equal(await WholeScheduleSwapRequest.countDocuments({ student: profiles.normal._id, status: "open" }), 1);
});

test("Req 36 lists only eligible open swaps and keeps the requester anonymous", async () => {
  const deadline = new Date(Date.now() + 60 * 60 * 1000);
  await AcademicTerm.updateOne({ _id: term._id }, { wholeScheduleSwapDeadline: deadline });
  users.swapRequester = await User.create({
    email: "swap.requester@student.guc.edu.eg", fullName: "Swap Requester",
    passwordHash: "test-hash", role: "normalStudent",
  });
  const requester = await StudentProfile.create({
    user: users.swapRequester._id, studentId: "52-00002", studentType: "normal",
    major: "CS", currentSemester: 5, gpa: 3, academicStanding: "goodAcademicStanding",
  });
  for (const [student, studyGroup] of [[profiles.normal, "1"], [requester, "2"]]) {
    const assigned = await call("/group-assignments", {
      role: "coordinator", method: "POST",
      body: { studentId: String(student._id), termId: String(term._id), studyGroup },
    });
    assert.equal(assigned.status, 201);
  }

  users.differentCourses = await User.create({
    email: "different.courses@student.guc.edu.eg", fullName: "Different Courses",
    passwordHash: "test-hash", role: "normalStudent",
  });
  const different = await StudentProfile.create({
    user: users.differentCourses._id, studentId: "52-00003", studentType: "normal",
    major: "CS", currentSemester: 5, gpa: 3, academicStanding: "goodAcademicStanding",
  });
  const viewerSchedule = await StudentSchedule.findOne({ student: profiles.normal._id, term: term._id });
  await StudentSchedule.create({
    student: different._id, term: term._id, scheduleType: "normal", status: "processed",
    template: viewerSchedule.template, courses: viewerSchedule.courses.slice(0, 1), createdBy: users.coordinator._id,
  });

  const created = await call(`/swaps/requests?termId=${term._id}`, {
    role: "swapRequester", method: "POST", body: { desiredGroups: ["1", "3"] },
  });
  assert.equal(created.status, 201);
  const requestId = created.body.request._id;
  const alerts = await inbox("normalStudent");
  assert.deepEqual(alerts.map(item => item.type), ["scheduleSwapOpened"]);
  assert.match(alerts[0].message, /Group 2/);
  assert.doesNotMatch(alerts[0].message, /Swap Requester|52-00002|swap\.requester/);
  for (const role of ["swapRequester", "differentCourses", "advisingStudent", "coordinator"]) {
    assert.deepEqual(await inbox(role), []);
  }
  const requesterSchedule = await StudentSchedule.findOne({ student: requester._id, term: term._id });
  const requesterTimetable = await call(`/schedules/me?termId=${term._id}`, { role: "swapRequester" });
  assert.equal(requesterTimetable.status, 200);
  const path = `/swaps/requests/open?termId=${term._id}`;
  const list = () => call(path, { role: "normalStudent" });
  const available = await list();
  assert.equal(available.status, 200);
  assert.deepEqual(available.body.requests, [{
    _id: requestId, currentGroup: "2", desiredGroups: ["1", "3"],
    courseCodes: courses.map(course => course.code),
    week: requesterTimetable.body.schedule.week, daysOff: requesterTimetable.body.schedule.daysOff,
  }]);

  async function expectHidden(reason) {
    const result = await list();
    assert.equal(result.status, 200, reason);
    assert.deepEqual(result.body.requests, [], reason);
  }
  const requestState = { status: "open", desiredGroups: ["1", "3"], expiresAt: deadline, term: term._id };
  const otherTermId = new mongoose.Types.ObjectId();
  const expiredAt = new Date(Date.now() - 60 * 1000);
  for (const [reason, changes] of [
    ["current group is not desired", { desiredGroups: ["3"] }],
    ["request has expired", { expiresAt: expiredAt }],
    ["request is withdrawn", { status: "withdrawn" }],
    ["request belongs to another term", { term: otherTermId }],
  ]) {
    await WholeScheduleSwapRequest.updateOne({ _id: requestId }, { ...requestState, ...changes });
    await expectHidden(reason);
  }
  await WholeScheduleSwapRequest.updateOne({ _id: requestId }, requestState);

  const scheduleState = { status: "processed", term: term._id, courses: requesterSchedule.courses };
  for (const [reason, changes] of [
    ["requester schedule is a draft", { status: "draft" }],
    ["requester schedule belongs to another term", { term: otherTermId }],
    ["requester course set changed", { courses: requesterSchedule.courses.slice(0, 1) }],
  ]) {
    await StudentSchedule.updateOne({ _id: requesterSchedule._id }, { ...scheduleState, ...changes });
    await expectHidden(reason);
  }
  await StudentSchedule.updateOne({ _id: requesterSchedule._id }, scheduleState);

  await AcademicTerm.updateOne({ _id: term._id }, { wholeScheduleSwapDeadline: expiredAt });
  await expectHidden("the term's swap deadline has passed");
  assert.equal((await call(path, { role: "advisingStudent" })).status, 403);
  await StudentSchedule.updateOne({ student: profiles.normal._id, term: term._id }, { status: "draft" });
  assert.equal((await list()).status, 404);
});

async function setupSwapParticipants() {
  const deadline = new Date(Date.now() + 60 * 60 * 1000);
  await AcademicTerm.updateOne({ _id: term._id }, { wholeScheduleSwapDeadline: deadline });
  const participants = [
    { role: "normalStudent", group: "1", student: profiles.normal },
    { role: "swapRequester", group: "2" },
    { role: "swapCompetitor", group: "3" },
  ];
  for (const participant of participants.slice(1)) {
    const account = await User.create({
      email: `${participant.role}@student.guc.edu.eg`, fullName: participant.role,
      passwordHash: "test-hash", role: "normalStudent",
    });
    users[participant.role] = account;
    participant.student = await StudentProfile.create({
      user: account._id, studentId: `52-0000${participant.group}`, studentType: "normal",
      major: "CS", currentSemester: 5, gpa: 3, academicStanding: "goodAcademicStanding",
    });
  }

  const offering = offerings[0];
  for (const { group } of participants) {
    for (const [componentType, day] of [["tutorial", "Monday"], ["lab", "Tuesday"]]) {
      const startMinute = 480 + 120 * (Number(group) - 1);
      offering.slots.push({ componentType, groupNumber: group, day, startMinute,
        endMinute: startMinute + 60, room: `H${group}`, capacity: 2 });
      templates[group].courses[0].slots.push({
        componentType, courseOffering: offering._id, slotGroupId: offering.slots.at(-1)._id,
      });
    }
    await templates[group].save();
  }
  await offering.save();

  for (const participant of participants) {
    const assigned = await call("/group-assignments", {
      role: "coordinator", method: "POST",
      body: { studentId: String(participant.student._id), termId: String(term._id), studyGroup: participant.group },
    });
    assert.equal(assigned.status, 201, assigned.body.message);
  }
  const created = await call("/swaps/requests", {
    role: "swapRequester", method: "POST", body: { desiredGroups: ["1", "3"] },
  });
  assert.equal(created.status, 201, created.body.message);
  return { participants, deadline, requestId: created.body.request._id };
}

async function readSwapTimetable(role) {
  const result = await call(`/schedules/me?termId=${term._id}`, { role });
  assert.equal(result.status, 200, result.body.message);
  return result.body.schedule;
}

test("Req 37 revalidates eligibility when the student confirms a swap", async () => {
  const { deadline, requestId } = await setupSwapParticipants();
  const request = await WholeScheduleSwapRequest.findById(requestId).lean();
  const requesterSchedule = await StudentSchedule.findById(request.currentSchedule).lean();
  const visible = await call("/swaps/requests/open", { role: "normalStudent" });
  assert.deepEqual(visible.body.requests.map(item => item._id), [requestId]);
  const before = await readSwapTimetable("normalStudent");
  const expiredAt = new Date(Date.now() - 60 * 1000);
  const complete = (role = "normalStudent") => call(`/swaps/requests/${requestId}/complete`, { role, method: "POST" });
  assert.equal((await complete("advisingStudent")).status, 403);
  assert.equal((await complete("swapRequester")).status, 409);

  const mutations = [
    ["term deadline has passed", AcademicTerm, term._id, { wholeScheduleSwapDeadline: expiredAt }, { wholeScheduleSwapDeadline: deadline }],
    ["request has expired", WholeScheduleSwapRequest, requestId, { expiresAt: expiredAt }, { expiresAt: deadline }],
    ["request was withdrawn", WholeScheduleSwapRequest, requestId, { status: "withdrawn" }, { status: "open" }],
    ["viewer group is no longer desired", WholeScheduleSwapRequest, requestId, { desiredGroups: ["3"] }, { desiredGroups: ["1", "3"] }],
    ["viewer schedule is no longer processed", StudentSchedule, before._id, { status: "draft" }, { status: "processed" }],
    ["requester schedule is no longer processed", StudentSchedule, requesterSchedule._id, { status: "draft" }, { status: "processed" }],
    ["requester schedule is in a different term", StudentSchedule, requesterSchedule._id, { term: new mongoose.Types.ObjectId() }, { term: term._id }],
    ["requester courses changed", StudentSchedule, requesterSchedule._id, { courses: requesterSchedule.courses.slice(0, 1) }, { courses: requesterSchedule.courses }],
  ];
  for (const [reason, Model, id, changes, original] of mutations) {
    await Model.updateOne({ _id: id }, { $set: changes });
    assert.equal((await complete()).status, 409, reason);
    await Model.updateOne({ _id: id }, { $set: original });
  }
  assert.deepEqual(await readSwapTimetable("normalStudent"), before);
  assert.equal((await WholeScheduleSwapRequest.findById(requestId)).status, "open");
  assert.deepEqual((await inbox("normalStudent")).map(item => item.type), ["scheduleSwapOpened"]);
  assert.deepEqual(await inbox("swapRequester"), []);
});

test("Req 37–38 swaps all slots once and records the groups for both participants", async () => {
  const { participants, requestId } = await setupSwapParticipants();
  const [viewer, requester, competitor] = participants;
  const before = Object.fromEntries(await Promise.all(participants.map(async ({ role }) => [role, await readSwapTimetable(role)])));
  const completions = await Promise.all([viewer, competitor].map(({ role }) =>
    call(`/swaps/requests/${requestId}/complete`, { role, method: "POST" })));
  assert.deepEqual(completions.map(result => result.status).sort(), [200, 409]);
  const winner = completions[0].status === 200 ? viewer : competitor;
  const loser = winner === viewer ? competitor : viewer;

  const requesterAfter = await readSwapTimetable(requester.role);
  const winnerAfter = await readSwapTimetable(winner.role);
  assert.equal(requesterAfter.studyGroup, winner.group);
  assert.equal(winnerAfter.studyGroup, requester.group);
  assert.deepEqual(requesterAfter.week, before[winner.role].week);
  assert.deepEqual(winnerAfter.week, before[requester.role].week);
  assert.deepEqual(Object.values(winnerAfter.week).flat().map(slot => slot.type).sort(), ["lab", "lecture", "lecture", "tutorial"]);
  assert.deepEqual(await readSwapTimetable(loser.role), before[loser.role]);
  for (const [participant, schedule] of [[requester, requesterAfter], [winner, winnerAfter]]) {
    const registered = await call("/schedules/me/courses", { role: participant.role });
    assert.deepEqual(registered.body.courses.map(course => course.courseCode).sort(), courses.map(course => course.code).sort());
    assert.equal((await StudentProfile.findById(participant.student._id)).studyGroup, schedule.studyGroup);
  }

  for (const [participant, other, role] of [[requester, winner, "requester"], [winner, requester, "accepter"]]) {
    const history = await call("/swaps/requests/me", { role: participant.role });
    assert.equal(history.status, 200);
    assert.equal(history.body.requests.length, 1);
    const [item] = history.body.requests;
    assert.equal(item._id, requestId);
    assert.equal(item.role, role);
    assert.equal(item.status, "completed");
    assert.equal(item.fromGroup, participant.group);
    assert.equal(item.toGroup, other.group);
    assert.deepEqual(item.desiredGroups, ["1", "3"]);
    assert.ok(item.completedAt);
    assert.ok(!("student" in item) && !("completedWith" in item));
  }
  assert.deepEqual((await call("/swaps/requests/me", { role: loser.role })).body.requests, []);
  assert.deepEqual((await call("/swaps/requests/open", { role: loser.role })).body.requests, []);
  assert.equal((await call(`/swaps/requests/${requestId}/withdraw`, { role: requester.role, method: "POST" })).status, 409);
  for (const { role } of [requester, winner]) {
    assert.equal((await inbox(role)).filter(item => item.type === "scheduleSwapCompleted").length, 1);
  }
  assert.deepEqual((await inbox(loser.role)).map(item => item.type), ["scheduleSwapOpened"]);
});

test("Req 38–39 shows history across terms and only withdraws the owner's open requests", async () => {
  const { deadline, requestId } = await setupSwapParticipants();
  const withdraw = (id, role = "swapRequester") => call(`/swaps/requests/${id}/withdraw`, { role, method: "POST" });
  const history = (termId = "") => call(`/swaps/requests/me${termId ? `?termId=${termId}` : ""}`, { role: "swapRequester" });
  assert.equal((await history()).body.requests[0].status, "open");
  assert.equal((await withdraw(requestId, "normalStudent")).status, 409);

  const { _id: oldTermId, ...termFields } = term.toObject();
  await AcademicTerm.updateOne({ _id: oldTermId }, { isActive: false });
  const nextTerm = await AcademicTerm.create({
    ...termFields, code: "S27", season: "spring", isActive: true, wholeScheduleSwapDeadline: deadline,
  });
  assert.deepEqual((await history(nextTerm._id)).body.requests, []);
  assert.equal((await history()).body.requests[0].term.code, term.code);
  assert.equal((await withdraw(requestId)).status, 200);
  assert.equal((await withdraw(requestId)).status, 409);
  const withdrawn = (await history()).body.requests[0];
  assert.equal(withdrawn.status, "withdrawn");
  assert.ok(withdrawn.withdrawnAt);

  const created = await call(`/swaps/requests?termId=${oldTermId}`, {
    role: "swapRequester", method: "POST", body: { desiredGroups: ["1"] },
  });
  assert.equal(created.status, 201, created.body.message);
  const expiredRequestId = created.body.request._id;
  const expiredAt = new Date(Date.now() - 60 * 1000);
  await WholeScheduleSwapRequest.updateOne({ _id: expiredRequestId }, { expiresAt: expiredAt });
  assert.equal((await withdraw(expiredRequestId)).status, 409);
  assert.equal((await history()).body.requests.find(item => item._id === expiredRequestId).status, "expired");
  await WholeScheduleSwapRequest.updateOne({ _id: expiredRequestId }, { expiresAt: deadline });
  await AcademicTerm.updateOne({ _id: oldTermId }, { wholeScheduleSwapDeadline: expiredAt });
  assert.equal((await withdraw(expiredRequestId)).status, 409);
  assert.equal((await history()).body.requests.find(item => item._id === expiredRequestId).status, "expired");
  assert.equal((await WholeScheduleSwapRequest.findById(expiredRequestId)).withdrawnAt, null);
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

test("Req 117 notifies the advising student when their schedule moves through review, processing and reopening", async () => {
  const schedulePath = `/schedules/advising/${profiles.advising._id}`;
  const courses = [{ courseOffering: String(offerings[0]._id), groups: [{ componentType: "lecture", groupNumber: "2" }] }];
  const draft = await call(`${schedulePath}/draft`, { role: "advisor", method: "PUT", body: { version: 0, courses } });
  assert.equal(draft.status, 201, draft.body.message);
  assert.deepEqual(await inbox("advisingStudent"), []);
  const review = await call(`${schedulePath}/draft`, {
    role: "advisor", method: "PUT", body: { version: draft.body.schedule.version, courses, submitForReview: true },
  });
  assert.equal(review.status, 200, review.body.message);
  assert.deepEqual((await inbox("advisingStudent")).map(item => item.type), ["scheduleReadyForReview"]);

  const processed = await Promise.all(["advisor", "coordinator"].map(role => call(`${schedulePath}/process`, { role, method: "POST" })));
  assert.deepEqual(processed.map(result => result.status).sort(), [200, 409]);
  const reopen = (reason) => call(`${schedulePath}/reopen`, { role: "coordinator", method: "POST", body: { reason } });
  assert.equal((await reopen("")).status, 400);
  assert.equal((await reopen("Review the lab assignment.")).status, 200);
  assert.equal((await reopen("Review the lab assignment.")).status, 409);

  const notifications = await inbox("advisingStudent");
  assert.deepEqual(notifications.map(item => item.type), ["scheduleReopened", "scheduleProcessed", "scheduleReadyForReview"]);
  assert.match(notifications[0].message, /Review the lab assignment/);
  assert.equal((await call(`/notifications/${notifications[0]._id}/read`, { role: "normalStudent", method: "PATCH" })).status, 403);
  assert.equal((await call(`/notifications/${notifications[0]._id}/read`, { role: "advisingStudent", method: "PATCH" })).status, 200);
  assert.equal((await inbox("advisingStudent"))[0].isRead, true);
  assert.deepEqual(await inbox("normalStudent"), []);
});

test("Req 117 delivers stored slot-change, graduation plan and exit-exam decisions once to their owner", async () => {
  const owner = { student: profiles.advising._id, advisor: users.advisor._id };
  const [slotChange, plan, exam] = await Promise.all([
    SlotChangeRequest.create({
      student: owner.student, term: term._id, schedule: new mongoose.Types.ObjectId(),
      course: courses[0]._id, componentType: "lecture", currentOffering: offerings[0]._id,
      currentSlotGroupId: offerings[0].slots[0]._id,
    }),
    GraduationPlan.create({ ...owner, termPlans: [{ term: term._id, courses: [courses[0]._id] }] }),
    ExitExamRequest.create({ ...owner, course: courses[0]._id, reason: "One failed course remains." }),
  ]);
  assert.deepEqual(await inbox("advisingStudent"), []);
  const decision = { decidedAt: new Date(), decidedBy: users.coordinator._id };
  await Promise.all([
    SlotChangeRequest.updateOne({ _id: slotChange._id }, { ...decision, status: "rejected", responseNote: "The requested slot is full." }),
    GraduationPlan.updateOne({ _id: plan._id }, { ...decision, status: "draft", responseNote: "Revise the summer course list." }),
    ExitExamRequest.updateOne({ _id: exam._id }, { ...decision, status: "approved", responseNote: "Exam approved." }),
  ]);
  const expected = ["exitExamDecision", "graduationPlanDecision", "slotChangeDecision"];
  const requests = await Promise.all([inbox("advisingStudent"), inbox("advisingStudent")]);
  for (const notifications of requests) {
    assert.deepEqual(notifications.map(item => item.type).sort(), expected);
    assert.ok(notifications.every(item => item.recipient === String(users.advisingStudent._id) && item.channels.join() === "inApp"));
  }
  assert.deepEqual(await inbox("normalStudent"), []);
  assert.deepEqual((await inbox("advisor")).map(item => item.type), ["slotChangeSubmitted"]);
  const returned = requests[0].find(item => item.type === "graduationPlanDecision");
  assert.match(returned.message, /returned to your advisor.*Revise the summer course list/);
  const marked = await call(`/notifications/${returned._id}/read`, { role: "advisingStudent", method: "PATCH" });
  assert.equal(marked.status, 200);
  await GraduationPlan.updateOne({ _id: plan._id }, { ...decision, status: "accepted", responseNote: "",
    decidedAt: new Date(decision.decidedAt.getTime() + 1) });
  const updated = await inbox("advisingStudent");
  const planAlerts = updated.filter(item => item.type === "graduationPlanDecision");
  assert.equal(planAlerts.length, 2);
  assert.match(planAlerts.find(item => item._id !== returned._id).message, /accepted/);
  assert.equal(planAlerts.find(item => item._id === returned._id).isRead, true);
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
