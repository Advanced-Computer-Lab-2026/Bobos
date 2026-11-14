import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { CourseAttempt } from "../models/academics.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { FinancialTransaction } from "../models/finance.js";
import { StudentProfile, User } from "../models/identity.js";
import { ExitExamRequest, ExtraHoursRequest, GraduationPlan } from "../models/requests.js";

let database, databasePath, server, base, users, student, terms, courses;

before(async () => {
  databasePath = await mkdtemp(join(process.cwd(), ".mongo-graduation-"));
  database = await MongoMemoryServer.create({ instance: { dbPath: databasePath } });
  await mongoose.connect(database.getUri());
  await Promise.all([AcademicTerm.init(), Course.init(), CourseOffering.init(), CourseAttempt.init(), ExitExamRequest.init(),
    ExtraHoursRequest.init(), FinancialTransaction.init(), GraduationPlan.init(), StudentProfile.init(), User.init()]);
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
  await Promise.all([AcademicTerm, Course, CourseOffering, CourseAttempt, ExitExamRequest, ExtraHoursRequest,
    FinancialTransaction, GraduationPlan, StudentProfile, User].map((model) => model.deleteMany({})));
  users = {};
  for (const [name, role] of Object.entries({ owner: "advisor", other: "advisor", coordinator: "coordinator", student: "advisingStudent" })) {
    users[name] = await User.create({
      role,
      fullName: name,
      email: `${name}@${name === "student" ? "student." : ""}guc.edu.eg`,
      passwordHash: "test-hash",
    });
  }
  student = await StudentProfile.create({
    user: users.student._id, assignedAdvisor: users.owner._id, studentId: "52-12345",
    studentType: "advising", advisingReason: "failedCourses", academicStanding: "goodAcademicStanding",
    gpa: 2.5, currentSemester: 9, major: "CS",
  });
  const day = 86_400_000;
  const now = Date.now();
  terms = await AcademicTerm.create(["winter", "spring", "summer", "firstMakeup"].map((season, index) => {
    const start = now + day * (30 + index * 60);
    return {
      code: season, season, academicYear: "2026/2027", termStart: start, termEnd: start + day * 50,
      teachingStart: start, teachingEnd: start + day * 45, registrationStart: start - day * 14,
      registrationEnd: start, advisingDeadline: start, wholeScheduleSwapDeadline: start,
    };
  }));
  const common = { facultyMajors: ["CSEN"], courseType: "core", creditHours: 6 };
  const first = await Course.create({ ...common, code: "CS101", name: "Intro", offeringSeasons: ["winter", "spring"] });
  const second = await Course.create({ ...common, code: "CS102", name: "Advanced", prerequisites: [first._id], offeringSeasons: ["winter", "spring"] });
  courses = [first, second];
  const electives = await Course.create(Array.from({ length: 4 }, (_, index) => ({
    code: `ELEC${index}`, name: `Completed elective ${index}`, creditHours: 4, courseType: "elective", facultyMajors: ["CS"],
  })));
  await CourseAttempt.create(electives.map((course) => ({
    course: course._id, student: student._id, term: terms[0]._id, attendance: "attended", result: "passed", grade: "A",
  })));
});

async function apiCall(path, { user = "owner", method = "GET", body } = {}) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${generateToken(users[user])}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const result = await fetch(`${base}${path}`, {
    method, headers, body: JSON.stringify(body),
  });
  return { status: result.status, data: result.status === 204 ? null : await result.json() };
}

const call = (suffix = "", options) => apiCall(`/advisor/students/${student._id}/graduation-plans${suffix}`, options);
const review = (suffix, options) => apiCall(`/graduation${suffix}`, options);

const assignments = (...entries) => ({
  termPlans: entries.map(([term, ...selected]) => ({ term: String(term._id), courses: selected.map((course) => String(course._id)) })),
});

const recordFailure = (course) => CourseAttempt.create({
  course: course._id, student: student._id, term: terms[0]._id, attendance: "attended", result: "failed", grade: "F",
});

test("a private draft can be resumed, edited, and deleted only by its creator", async () => {
  assert.equal((await call("", { user: null })).status, 401);
  assert.equal((await call("", { user: "student" })).status, 403);
  assert.equal((await call("", { user: "coordinator" })).status, 403);
  const created = await call("", { method: "POST", body: assignments() });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.status, "draft");
  const url = `/${created.data._id}`;
  assert.deepEqual((await call("", { user: "other" })).data.plans, []);
  assert.equal((await call(url, { user: "other" })).status, 404);
  assert.equal((await call(url, { method: "PUT", user: "other", body: assignments() })).status, 404);
  assert.equal((await call(url, { method: "DELETE", user: "other" })).status, 404);
  const edited = await call(url, { method: "PUT", body: { ...assignments([terms[1], courses[1]]), version: created.data.version } });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  assert.match(edited.data.missing.join(" "), /CS101/);
  assert.equal((await call(url)).data.termPlans[0].courses[0], String(courses[1]._id));
  assert.equal((await call(url, { method: "PUT", body: { ...assignments(), version: created.data.version } })).status, 409);
  assert.equal((await call(url, { method: "DELETE", body: { version: created.data.version } })).status, 409);
  assert.equal((await call(`${url}/submit`, { method: "POST" })).status, 422);
  assert.equal((await call(url, { method: "DELETE" })).status, 204);
  assert.equal((await call(url)).status, 404);
});

test("plan validation requires eligible terms and earlier prerequisites, then locks submission", async () => {
  const workspace = await call();
  assert.deepEqual(workspace.data.terms.map((term) => term.season), ["winter", "spring", "summer"]);
  for (const body of [
    assignments([terms[0], ...courses]),
    assignments([terms[1], courses[0]], [terms[0], courses[1]]),
    assignments([terms[2], courses[0]]),
    assignments([terms[3], courses[0]]),
    assignments([terms[0], courses[0]], [terms[1], courses[0]]),
  ]) {
    assert.equal((await call("", { method: "POST", body })).status, 422);
  }
  const body = assignments([terms[0], courses[0]], [terms[1], courses[1]]);
  const draft = await call("", { method: "POST", body });
  assert.equal(draft.status, 201);
  const url = `/${draft.data._id}`;
  const results = await Promise.all([1, 2].map(() => call(`${url}/submit`, { method: "POST" })));
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await call(url)).data.status, "submitted");
  assert.equal((await call(url, { method: "PUT", body })).status, 409);
  assert.equal((await call(url, { method: "DELETE" })).status, 409);
});

test("credits are term-specific, activated, course-specific, and rechecked for reversals at submission", async () => {
  const additional = await Course.create({ code: "CS103", name: "Project", courseType: "core", creditHours: 22, offeringSeasons: ["winter"] });
  const body = assignments([terms[0], courses[0], additional], [terms[1], courses[1]]);
  const request = await ExtraHoursRequest.create({
    student: student._id, advisor: users.owner._id, term: terms[0]._id, decisionStatus: "approved",
    settlementStatus: "awaitingChoice", requestedHours: 6, totalCost: 4800,
    courses: [{ course: courses[0]._id, hours: 6, isRepeated: false, pricePerHour: 800, subtotal: 4800 }],
    eligibilitySnapshot: { standardAllowance: 24, hoursBeforeRequest: 22, hoursAfterRequest: 28, isProbation: false, graduatingWithinOneYear: true },
  });
  assert.equal((await call("", { method: "POST", body })).status, 422);
  await ExtraHoursRequest.updateOne({ _id: request._id }, { settlementStatus: "paid" });
  const draft = await call("", { method: "POST", body });
  assert.equal(draft.status, 201, JSON.stringify(draft.data));
  await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "refund", status: "succeeded", amount: 4800 });
  assert.equal((await call(`/${draft.data._id}/submit`, { method: "POST" })).status, 422);
});

test("an exam request needs one unschedulable failed course and approval before plan submission", async () => {
  const [first, failed] = courses;
  const examBody = { courseId: String(failed._id), reason: "Course is available only in a makeup term." };
  const requestExam = (body = examBody) => call("/exit-exam-requests", { method: "POST", body });
  assert.equal((await requestExam()).status, 422);
  await recordFailure(failed);
  assert.equal((await requestExam()).status, 422);
  await Course.updateOne({ _id: failed._id }, { offeringSeasons: ["firstMakeup"] });
  await recordFailure(first);
  assert.equal((await requestExam()).status, 422);
  await CourseAttempt.deleteOne({ course: first._id });
  assert.equal((await requestExam({ ...examBody, reason: " " })).status, 400);
  const attempts = await Promise.all([requestExam(), requestExam()]);
  assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [201, 409]);
  const request = attempts.find((attempt) => attempt.status === 201).data;
  const stored = await ExitExamRequest.findById(request._id).lean();
  assert.equal(stored.reason, examBody.reason);
  const body = { ...assignments([terms[0], first]), exitExamRequest: request._id };
  assert.equal((await call("", { method: "POST", body })).status, 422);
  await ExitExamRequest.updateOne({ _id: request._id }, { status: "rejected" });
  assert.equal((await call("", { method: "POST", body })).status, 422);
  await ExitExamRequest.updateOne({ _id: request._id }, { status: "approved", decidedBy: users.coordinator._id, decidedAt: new Date() });
  const draft = await call("", { method: "POST", body });
  assert.equal(draft.status, 201, JSON.stringify(draft.data));
  assert.equal((await call(`/${draft.data._id}/submit`, { method: "POST" })).status, 200);
});

test("exam eligibility checks whether the remaining courses can fit around the failed course", async () => {
  const [first, failed] = courses;
  await Course.updateOne({ _id: first._id }, { offeringSeasons: ["winter"], creditHours: 19 });
  await Course.updateOne({ _id: failed._id }, { offeringSeasons: [], prerequisites: [] });
  await recordFailure(failed);
  const body = { courseId: String(failed._id), reason: "The only published term would exceed the credit limit." };
  const request = () => call("/exit-exam-requests", { method: "POST", body });
  assert.match((await request()).data.message, /Confirm offering seasons/);
  await CourseOffering.create({
    course: failed._id,
    term: terms[0]._id,
    academicYear: terms[0].academicYear,
    instructors: [{ fullName: "Instructor" }],
    eligibleGroups: [{ major: "CS" }],
    isPublished: true,
    slots: [{ componentType: "lecture", groupNumber: "1", day: "Monday", startMinute: 600, endMinute: 660, room: "C1", capacity: 25 }],
  });
  assert.equal((await request()).status, 201);
});

test("staff lists respect draft privacy, advisor ownership, and combined search and filters", async () => {
  const submit = (user) => call("", { method: "POST", user, body: assignments([terms[0], courses[0]], [terms[1], courses[1]]) });
  const first = await submit("owner");
  const second = await submit("other");
  const privateDraft = await submit("owner");
  for (const [plan, user] of [[first, "owner"], [second, "other"]]) {
    assert.equal((await call(`/${plan.data._id}/submit`, { method: "POST", user })).status, 200);
  }
  assert.equal((await review("/plans", { user: null })).status, 401);
  assert.equal((await review("/plans", { user: "student" })).status, 403);
  const staff = (query = "") => review(`/plans${query}`, { user: "coordinator" });
  assert.equal((await staff()).data.total, 2);
  assert.deepEqual((await review("/plans", { user: "owner" })).data.plans.map((row) => row._id), [first.data._id]);
  const date = new Date().toISOString().slice(0, 10);
  const filters = new URLSearchParams({ search: "52-12345", status: "submitted", advisor: users.owner._id, from: date, to: date });
  const result = await staff(`?${filters}`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.plans.map((row) => row._id), [first.data._id]);
  assert.equal(result.data.plans[0].termPlans[0].courses[0].code, "CS101");
  assert.equal(result.data.advisors.length, 2);
  assert.equal((await staff("?search=OTHER")).data.total, 1);
  assert.equal((await staff("?search=other%40guc.edu.eg")).data.total, 1);
  assert.equal((await staff("?search=.*")).data.total, 0);
  assert.equal((await staff("?status=draft")).status, 400);
  assert.equal((await staff("?from=2026-02-30")).status, 400);
  assert.equal((await staff("?to=2000-01-01")).data.total, 0);
  const privateDecision = await review(`/plans/${privateDraft.data._id}/decision`, {
    user: "coordinator", method: "POST", body: { decision: "accept", responseNote: "Approved" },
  });
  assert.equal(privateDecision.status, 404);
});

test("a plan returns to its creator, can be resubmitted, and becomes visible only to its student after acceptance", async () => {
  const selections = assignments([terms[0], courses[0]], [terms[1], courses[1]]);
  const draft = await call("", { method: "POST", body: selections });
  const path = `/${draft.data._id}`;
  const submitted = await call(`${path}/submit`, { method: "POST" });
  const decide = (decision, responseNote, extra = {}, user = "coordinator") => review(`/plans${path}/decision`, {
    user, method: "POST", body: { decision, responseNote, ...extra },
  });
  const studentView = () => review("/me", { user: "student" });
  assert.deepEqual((await studentView()).data.plans, []);
  assert.equal((await decide("accept", "Verified", {}, "owner")).status, 403);
  assert.equal((await decide("reject", " ")).status, 400);
  const returned = await decide("reject", "  Verify Spring placement.  ");
  assert.equal(returned.status, 200);
  assert.equal(returned.data.status, "draft");
  assert.equal((await call(path)).data.responseNote, "Verify Spring placement.");
  assert.deepEqual((await review("/plans", { user: "coordinator" })).data.plans, []);
  assert.equal((await call(path, { user: "other" })).status, 404);
  assert.deepEqual((await studentView()).data.plans, []);
  const edited = await call(path, { method: "PUT", body: selections });
  assert.equal(edited.status, 200);
  const resubmitted = await call(`${path}/submit`, { method: "POST" });
  assert.equal(resubmitted.status, 200);
  assert.equal((await decide("accept", "Stale", { submittedAt: submitted.data.submittedAt })).status, 409);
  await Course.updateOne({ _id: courses[1]._id }, { offeringSeasons: ["summer"] });
  assert.equal((await decide("accept", "Conflicts with current catalogue")).status, 422);
  await Course.updateOne({ _id: courses[1]._id }, { offeringSeasons: ["spring"] });
  const decisions = await Promise.all([decide("accept", "Completion verified."), decide("accept", "Completion verified.")]);
  assert.deepEqual(decisions.map(({ status }) => status).sort(), [200, 409]);
  const accepted = (await studentView()).data.plans;
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].responseNote, "Completion verified.");
  assert.equal(accepted[0].termPlans[1].term.season, "spring");
  assert.equal(accepted[0].termPlans[1].courses[0].name, "Advanced");
  assert.equal((await review("/plans?status=accepted", { user: "owner" })).data.total, 1);
});

test("coordinator decides exam requests with a note and only the subject student sees the result", async () => {
  const otherStudent = await User.create({
    role: "advisingStudent", fullName: "Another student", email: "another@student.guc.edu.eg", passwordHash: "test-hash",
  });
  users.another = otherStudent;
  const otherProfile = await StudentProfile.create({
    user: otherStudent._id, studentId: "52-54321", studentType: "advising",
    advisingReason: "failedCourses", academicStanding: "goodAcademicStanding", gpa: 2.5, currentSemester: 9,
  });
  const [first, failed] = courses;
  await Course.updateOne({ _id: failed._id }, { offeringSeasons: ["firstMakeup"] });
  await recordFailure(failed);
  const examBody = { courseId: String(failed._id), reason: "Only a makeup offering is available." };
  const request = () => call("/exit-exam-requests", { method: "POST", body: examBody });
  let created = await request();
  assert.equal(created.status, 201);
  const decide = (decision, responseNote, user = "coordinator") => review(`/exit-exams/${created.data._id}/decision`, {
    user, method: "POST", body: { decision, responseNote },
  });
  assert.equal((await review("/exit-exams", { user: "owner" })).status, 403);
  assert.equal((await review("/exit-exams", { user: "coordinator" })).data.requests[0].reason, examBody.reason);
  const pending = await review("/me", { user: "student" });
  assert.equal(pending.data.exams[0].status, "pending");
  assert.equal(pending.data.exams[0].reason, undefined);
  assert.equal((await decide("approve", "Yes", "student")).status, 403);
  assert.equal((await decide("approve", "")).status, 400);
  assert.equal((await decide("reject", "Discuss other scheduling options.")).data.status, "rejected");
  const rejected = (await review("/me", { user: "student" })).data.exams[0];
  assert.equal(rejected.responseNote, "Discuss other scheduling options.");
  assert.equal((await call("", { method: "POST", body: {
    ...assignments([terms[0], first]), exitExamRequest: created.data._id,
  } })).status, 422);
  created = await request();
  const decisions = await Promise.all([decide("approve", "Exam approved."), decide("approve", "Exam approved.")]);
  assert.deepEqual(decisions.map(({ status }) => status).sort(), [200, 409]);
  const draft = await call("", { method: "POST", body: { ...assignments([terms[0], first]), exitExamRequest: created.data._id } });
  assert.equal(draft.status, 201);
  assert.equal((await call(`/${draft.data._id}/submit`, { method: "POST" })).status, 200);
  assert.equal((await review(`/plans/${draft.data._id}/decision`, {
    user: "coordinator", method: "POST", body: { decision: "accept", responseNote: "Plan and exam verified." },
  })).status, 200);
  const mine = await review("/me", { user: "student" });
  assert.equal(mine.data.plans[0].exitExamRequest.course.code, "CS102");
  assert.equal(mine.data.exams[0].responseNote, "Exam approved.");
  assert.deepEqual((await review(`/me?student=${student._id}`, { user: "another" })).data, { plans: [], exams: [] });
  assert.equal(String(otherProfile.user), String(otherStudent._id));
});

test("a historical current record cannot hide a later failure or an inactive graduation requirement", async () => {
  await CourseAttempt.create({
    course: courses[0]._id, student: student._id, term: terms[0]._id, attendance: "attended", result: "current",
  });
  await CourseAttempt.create({
    course: courses[0]._id, student: student._id, term: terms[1]._id, attendance: "attended", result: "failed", grade: "F",
  });
  await Course.updateOne({ _id: courses[1]._id }, { isActive: false });
  const workspace = await call();
  assert.equal(workspace.data.courses.find((course) => course.code === "CS101").failed, true);
  assert.deepEqual(workspace.data.courses.find((course) => course.code === "CS102").termIds, []);
  const draft = await call("", { method: "POST", body: assignments() });
  const submitted = await call(`/${draft.data._id}/submit`, { method: "POST" });
  assert.equal(submitted.status, 422);
  assert.match(submitted.data.issues.join(" "), /CS101/);
  assert.match(submitted.data.issues.join(" "), /CS102/);
});

test("electives are choices and submission checks remaining count and hours", async () => {
  const completed = await Course.find({ courseType: "elective" }).lean();
  await CourseAttempt.deleteMany({ course: { $in: completed.map((course) => course._id) } });
  await Course.deleteMany({ _id: { $in: completed.map((course) => course._id) } });
  const choices = await Course.create(Array.from({ length: 6 }, (_, index) => ({
    code: `CHOICE${index}`, name: `Elective ${index}`, creditHours: 4, courseType: "elective",
    offeringSeasons: ["winter"], facultyMajors: ["CS"],
  })));
  const body = assignments([terms[0], courses[0], ...choices.slice(0, 4)], [terms[1], courses[1]]);
  const draft = await call("", { method: "POST", body });
  assert.equal(draft.status, 201);
  assert.equal((await call(`/${draft.data._id}/submit`, { method: "POST" })).status, 200);
  const short = await call("", { method: "POST", body: assignments([terms[0], courses[0], ...choices.slice(0, 3)], [terms[1], courses[1]]) });
  assert.equal((await call(`/${short.data._id}/submit`, { method: "POST" })).status, 422);
});

test("passing a course after submission does not prevent Coordinator acceptance", async () => {
  const draft = await call("", { method: "POST", body: assignments([terms[0], courses[0]], [terms[1], courses[1]]) });
  assert.equal((await call(`/${draft.data._id}/submit`, { method: "POST" })).status, 200);
  await CourseAttempt.create({
    course: courses[0]._id, student: student._id, term: terms[0]._id, attendance: "attended", result: "passed", grade: "A",
  });
  const accepted = await review(`/plans/${draft.data._id}/decision`, {
    user: "coordinator", method: "POST", body: { decision: "accept", responseNote: "Verified against updated transcript." },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
});
