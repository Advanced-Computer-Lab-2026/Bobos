import assert from "node:assert/strict";
import test, { before, beforeEach, after } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { User, StudentProfile, AcademicTerm, Course, CourseAttempt, StudentSchedule, ExtraHoursRequest,
  FinancialTransaction, FinancialReversalRequest, Notification, GraduationPlan, ExitExamRequest } from "../models/index.js";
import { getWallet } from "../models/academics.js";
import { calculateDraftCreditPolicy } from "../utils/credit-allowance.js";

const gap = (reason) => process.env.A_AUDIT_STRICT === "1" ? {} : { todo: reason };
let database, server, origin, users, student, terms, past, courses;
before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});
beforeEach(async () => {
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
  users = {};
  for (const [name, role] of Object.entries({ advisor: "advisor", otherAdvisor: "advisor", coordinator: "coordinator", administrator: "administrator", student: "advisingStudent", otherStudent: "advisingStudent" })) {
    users[name] = await User.create({ fullName: name, email: `${name}@${role === "advisingStudent" ? "student." : ""}guc.edu.eg`, role, passwordHash: "not-used", isAdvisorInSystem: role === "advisor" });
  }
  student = await StudentProfile.create({ user: users.student._id, studentId: "80-00001", studentType: "advising", assignedAdvisor: users.advisor._id,
    academicStanding: "goodAcademicStanding", advisingReason: "unattendedCourses", major: "CS", currentSemester: 5, gpa: 2 });
  const day = 86400000, now = Date.now();
  terms = await AcademicTerm.create(["winter", "spring", "summer"].map((season, index) => {
    const start = now + (30 + 80 * index) * day;
    return { code: `AA${index}`, season, academicYear: "2026/2027", termStart: start, termEnd: start + 50 * day,
      teachingStart: start, teachingEnd: start + 45 * day, registrationStart: start - 14 * day, registrationEnd: start,
      advisingDeadline: now + day, wholeScheduleSwapDeadline: now + day, isActive: index === 0 };
  }));
  past = await AcademicTerm.create({ ...terms[0].toObject(), _id: undefined, code: "AA-PAST", academicYear: "2025/2026", isActive: false,
    termStart: now - day * 180, termEnd: now - day * 30, teachingStart: now - day * 179, teachingEnd: now - day * 31,
    registrationStart: now - day * 194, registrationEnd: now - day * 181, advisingDeadline: now - day * 180, wholeScheduleSwapDeadline: now - day * 180 });
  courses = await Course.create([
    { code: "AEX501", name: "Extra course", creditHours: 3, courseType: "core", facultyMajors: ["CS"], offeringSeasons: ["winter", "spring", "summer"] },
    { code: "ABASE502", name: "Base course", creditHours: 4, courseType: "core", facultyMajors: ["CS"], offeringSeasons: ["winter", "spring", "summer"] },
  ]);
  const electives = await Course.create(Array.from({ length: 4 }, (_, index) => ({ code: `AELEC${index}`, name: "Completed elective", creditHours: 4, courseType: "elective", facultyMajors: ["CS"] })));
  await CourseAttempt.insertMany(electives.map((course) => ({ student: student._id, course: course._id, term: past._id, result: "passed", attendance: "attended", grade: "A" })));
});
async function call(path, { role = "coordinator", method = "GET", body } = {}) {
  const headers = role ? { Authorization: `Bearer ${generateToken(users[role])}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(origin + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.headers.get("content-type")?.includes("json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data, headers: response.headers };
}
const requestBody = () => ({ studentId: String(student._id), termId: String(terms[0]._id), courseIds: [String(courses[0]._id)], graduatingWithinOneYear: false });
async function extra(overrides = {}) {
  return ExtraHoursRequest.create({ student: student._id, advisor: users.advisor._id, term: terms[0]._id,
    courses: [{ course: courses[0]._id, hours: 3, pricePerHour: 800, subtotal: 2400, isRepeated: false }], requestedHours: 3, totalCost: 2400,
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 33, isProbation: false, graduatingWithinOneYear: false },
    decisionStatus: "pending", settlementStatus: "none", ...overrides });
}
const settle = (request, body, role = "student") => call(`/extra-hours/${request._id}/settlement`, { role, method: "POST", body });
const decide = (request, body) => call(`/extra-hours/${request._id}/decision`, { method: "POST", body });
const inbox = (role = "coordinator") => call("/notifications", { role });
const planPath = () => `/advisor/students/${student._id}/graduation-plans`;
async function submitPlan() {
  const created = await call(planPath(), { role: "advisor", method: "POST", body: { termPlans: [{ term: String(terms[0]._id), courses: courses.map((course) => String(course._id)) }] } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const submitted = await call(`${planPath()}/${created.data._id}/submit`, { role: "advisor", method: "POST", body: {} });
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
  return created.data._id;
}
async function requestExam() {
  await Course.updateOne({ _id: courses[0]._id }, { offeringSeasons: ["firstMakeup"] });
  await CourseAttempt.create({ student: student._id, course: courses[0]._id, term: past._id, result: "failed", attendance: "attended", grade: "F" });
  const result = await call(`${planPath()}/exit-exam-requests`, { role: "advisor", method: "POST", body: { courseId: String(courses[0]._id), reason: "Cannot repeat before graduation" } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data._id;
}

test("A1 Req 84-86: coordinator list/details, exact student search and all four filters compose", async () => {
  const pending = await extra();
  const approved = await extra({ decisionStatus: "approved", settlementStatus: "deferred", settlementOption: "deferred" });
  assert.equal((await call("/extra-hours", { role: "student" })).status, 403);
  const listed = await call(`/extra-hours?studentId=${student.studentId}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.data.length, 2);
  const query = `advisorId=${users.advisor._id}&decisionStatus=approved&settlementOption=deferred&settlementStatus=deferred`;
  const filtered = await call(`/extra-hours?${query}`);
  assert.equal(filtered.data.length, 1);
  assert.equal(filtered.data[0]._id, String(approved._id));
  const detail = await call(`/extra-hours/${pending._id}`);
  assert.equal(detail.data.courses[0].pricePerHour, 800);
  assert.equal(detail.data.courses[0].subtotal, 2400);
  assert.equal(detail.data.student.studentId, student.studentId);
  assert.ok(detail.data.createdAt && detail.data.eligibilitySnapshot);
  assert.deepEqual((await call("/extra-hours?studentId=nonexistent")).data, []);
});

test("A1 Req 87-88,90,92: approval does not activate hours; deferred confirmation activates once without wallet charge", async () => {
  const request = await extra();
  assert.equal((await settle(request, { option: "deferred" })).status, 409);
  const approved = await decide(request, { decision: "approved", responseNote: "Checked" });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.settlementStatus, "awaitingChoice");
  const policy = async () => calculateDraftCreditPolicy(student, await ExtraHoursRequest.find({ student: student._id }).populate("courses.course", "creditHours").lean());
  assert.equal((await policy()).approvedExtraHours, 0);
  const owned = await call(`/extra-hours/${request._id}`, { role: "student" });
  assert.equal(owned.status, 200);
  assert.equal(owned.data.totalCost, 2400);
  assert.equal((await call(`/extra-hours/${request._id}`, { role: "otherStudent" })).status, 403);
  const results = await Promise.all([settle(request, { option: "deferred" }), settle(request, { option: "deferred" })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await policy()).approvedExtraHours, 3);
  assert.equal(await FinancialTransaction.countDocuments({ extraHoursRequest: request._id, kind: "deferredCharge" }), 1);
  assert.equal(await FinancialTransaction.countDocuments({ extraHoursRequest: request._id, kind: { $in: ["gatewayPayment", "extraHoursWalletPayment"] } }), 0);
  assert.equal((await getWallet(student._id)).balance, 0);
});

test("A1 Req 91: insufficient wallets are rejected and concurrent payment of one request debits once", async () => {
  const request = await extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" });
  assert.equal((await settle(request, { option: "now", method: "wallet" })).status, 409);
  await FinancialTransaction.create({ student: student._id, kind: "walletTopUp", amount: 2400, status: "succeeded" });
  const results = await Promise.all([settle(request, { option: "now", method: "wallet" }), settle(request, { option: "now", method: "wallet" })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await getWallet(student._id)).balance, 0);
  assert.equal(await FinancialTransaction.countDocuments({ kind: "extraHoursWalletPayment" }), 1);
});

test("A1 Req 93-94: cancelled/failed gateway attempts can retry; paid receipt downloads through the real route", async () => {
  const request = await extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" });
  for (const gatewayResult of ["cancelled", "failed"]) {
    const attempt = await settle(request, { option: "now", method: "gateway", gatewayResult });
    assert.equal(attempt.status, 200);
    assert.equal(attempt.data.transaction.status, gatewayResult);
    assert.equal((await call(`/extra-hours/mine/financial-history/${attempt.data.transaction._id}/download`, { role: "student" })).status, 404);
  }
  const paid = await settle(request, { option: "now", method: "gateway", gatewayResult: "succeeded" });
  assert.equal(paid.status, 200);
  assert.ok(paid.data.confirmation.transactionReference);
  const receiptPath = `/extra-hours/mine/financial-history/${paid.data.transaction._id}/download`;
  const receipt = await call(receiptPath, { role: "student" });
  assert.equal(receipt.status, 200, JSON.stringify(receipt.data));
  assert.match(receipt.headers.get("content-type"), /application\/pdf/);
  assert.match(receipt.data.subarray(0, 5).toString(), /%PDF-/);
  assert.match(receipt.headers.get("content-disposition"), /extra-hours-receipt/);
  assert.equal((await call(receiptPath, { role: "otherStudent" })).status, 404);
});

test("A1 Req 94: deferred confirmation download is not labelled a paid receipt", async () => {
  const request = await extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" });
  const result = await settle(request, { option: "deferred" });
  assert.equal(result.status, 200);
  assert.equal(result.data.confirmation.type, "deferredPaymentConfirmation");
  assert.ok(result.data.confirmation.installment && result.data.confirmation.confirmedAt);
  const document = await call(`/extra-hours/mine/financial-history/${result.data.transaction._id}/download`, { role: "student" });
  assert.equal(document.status, 200);
  assert.match(document.headers.get("content-disposition"), /deferred-payment-confirmation/);
  assert.equal(document.data.subarray(0, 5).toString(), "%PDF-");
});

test("A1 Req 95-96: decision/settlement history persists and withdrawal is limited to the creating advisor's pending request", async () => {
  const request = await extra({ history: [{ action: "submitted", actor: users.advisor._id, note: "Submitted" }] });
  assert.equal((await call(`/extra-hours/${request._id}/withdraw`, { role: "otherAdvisor", method: "POST", body: {} })).status, 403);
  assert.equal((await call(`/extra-hours/${request._id}/withdraw`, { role: "advisor", method: "POST", body: {} })).status, 200);
  assert.equal((await call(`/extra-hours/${request._id}/withdraw`, { role: "advisor", method: "POST", body: {} })).status, 400);
  const approved = await extra();
  assert.equal((await decide(approved, { decision: "approved", responseNote: "Approved" })).status, 200);
  assert.equal((await call(`/extra-hours/${approved._id}/withdraw`, { role: "advisor", method: "POST", body: {} })).status, 400);
  await settle(approved, { option: "deferred" });
  const detail = await call(`/extra-hours/${approved._id}`, { role: "student" });
  assert.deepEqual(detail.data.history.map((event) => event.action), ["approved", "deferred"]);
  assert.equal(detail.data.history[0].note, "Approved");
  assert.equal(detail.data.settlementStatus, "deferred");
});

test("A2 Req 117: actual A3 acceptance and exit decisions reach only the subject student's inbox", async () => {
  const id = await submitPlan();
  assert.equal((await call(`/graduation/plans/${id}/decision`, { method: "POST", body: { decision: "accept", responseNote: "Accepted" } })).status, 200);
  const examId = await requestExam();
  assert.equal((await call(`/graduation/exit-exams/${examId}/decision`, { method: "POST", body: { decision: "approve", responseNote: "Exam approved" } })).status, 200);
  const own = await inbox("student");
  assert.ok(own.data.notifications.some((notification) => notification.type === "graduationPlanDecision"));
  assert.ok(own.data.notifications.some((notification) => notification.type === "exitExamDecision"));
  assert.deepEqual((await inbox("otherStudent")).data.notifications, []);
});

test("Req 83: advisors cannot submit requests for another advisor's student", async () => {
  const result = await call("/extra-hours", { role: "otherAdvisor", method: "POST", body: requestBody() });
  assert.equal(result.status, 403);
});

test("Req 83: separate approved requests cannot cumulatively exceed the allowed extra hours", async () => {
  await extra({ decisionStatus: "approved", settlementStatus: "paid" });
  const additionalCourse = await Course.create({ code: "AEX503", name: "Another extra course", creditHours: 3, courseType: "core", facultyMajors: ["CS"], offeringSeasons: ["winter"] });
  const result = await call("/extra-hours", { role: "advisor", method: "POST", body: { ...requestBody(), courseIds: [String(additionalCourse._id)] } });
  assert.ok([400, 409, 422].includes(result.status), `second request above the non-graduating 3-hour limit accepted: ${result.status}`);
});

test("Req 87: a coordinator decision requires a response note", async () => {
  const request = await extra();
  const result = await decide(request, { decision: "approved", responseNote: "   " });
  assert.equal(result.status, 400);
});

test("Req 87: eligibility is rechecked at approval after the student enters probation", async () => {
  const request = await extra();
  await StudentProfile.updateOne({ _id: student._id }, { gpa: 3.8, academicStanding: "probation", advisingReason: "probation" });
  const result = await decide(request, { decision: "approved", responseNote: "Checked" });
  assert.ok([400, 409, 422].includes(result.status), `probation request approved: ${result.status}`);
});

test("Req 91: simultaneous payments of different requests cannot overspend the same wallet", async () => {
  const requests = await Promise.all([extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" }), extra({ term: terms[1]._id, decisionStatus: "approved", settlementStatus: "awaitingChoice" })]);
  await FinancialTransaction.create({ student: student._id, kind: "walletTopUp", amount: 2400, status: "succeeded" });
  const results = await Promise.all(requests.map((request) => settle(request, { option: "now", method: "wallet" })));
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  assert.ok((await getWallet(student._id)).balance >= 0);
});

test("Req 95: a completed refund is reflected in the request's status/history", async () => {
  const request = await extra({ decisionStatus: "withdrawn", settlementStatus: "paid", settlementOption: "gateway" });
  const paid = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, amount: 2400, kind: "gatewayPayment", status: "succeeded", settlementOption: "gateway" });
  await FinancialReversalRequest.create({ student: student._id, extraHoursRequest: request._id, originalTransaction: paid._id, requestedBy: users.advisor._id, reversalType: "refundToWallet" });
  assert.equal((await call(`/finance/${paid._id}/refund`, { method: "POST", body: {} })).status, 200);
  const result = await call(`/extra-hours/${request._id}`, { role: "student" });
  assert.equal(result.data.settlementStatus, "refunded");
  assert.ok(result.data.history.some((entry) => entry.action === "refunded"));
});

test("GAP A2 Req 120: submitted graduation plans notify coordinators", gap("No coordinator graduation submission alert"), async () => {
  await submitPlan();
  assert.ok((await inbox()).data.notifications.some((notification) => notification.type === "graduationPlanSubmitted"));
});

test("GAP A2 Req 120: new exit-exam requests notify coordinators", gap("No coordinator exit-exam request alert"), async () => {
  await requestExam();
  assert.ok((await inbox()).data.notifications.some((notification) => notification.type === "exitExamRequested"));
});

test("GAP A2 Req 120: mandatory-removal requests notify coordinators", gap("No coordinator mandatory-removal request alert"), async () => {
  await CourseAttempt.create({ student: student._id, course: courses[0]._id, term: past._id, attendance: "attended", result: "failed", grade: "F" });
  const result = await call("/mandatory-removals", { role: "advisor", method: "POST", body: { studentProfileId: String(student._id), courseId: String(courses[0]._id), termId: String(terms[0]._id), reason: "other", explanation: "Audit request" } });
  assert.equal(result.status, 201);
  assert.ok((await inbox()).data.notifications.some((notification) => notification.type === "mandatoryCourseRemovalRequested"));
});

test("GAP A2 Req 120: pending financial reversals notify coordinators", gap("No coordinator financial-reversal alert"), async () => {
  const request = await extra();
  const paid = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, amount: 2400, kind: "gatewayPayment", status: "succeeded" });
  await FinancialReversalRequest.create({ student: student._id, extraHoursRequest: request._id, originalTransaction: paid._id, requestedBy: users.advisor._id, reversalType: "refundToWallet" });
  assert.ok((await inbox()).data.notifications.some((notification) => notification.type === "financialReversalRequested"));
});

test("GAP A2 Req 121: API startup produces reminders for assigned open schedules near the advising deadline", gap("No reminder sender, timer, or inbox reminder synchronization exists"), async () => {
  await AcademicTerm.updateOne({ _id: terms[0]._id }, { advisingDeadline: new Date(Date.now() + 3600000) });
  await StudentSchedule.create({ student: student._id, term: terms[0]._id, scheduleType: "advising", status: "draft", createdBy: users.advisor._id });
  const child = spawn(process.execPath, ["apps/api/src/index.js"], { env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "group-a-child-test-only-secret", MONGODB_URI: database.getUri(), PORT: "0", PROBATION_WARNINGS_ENABLED: "false" }, stdio: ["ignore", "pipe", "pipe"] });
  const closed = once(child, "close");
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Test API did not start")), 5000);
      child.stdout.on("data", (data) => { if (String(data).includes("API listening")) { clearTimeout(timer); resolve(); } });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await inbox("advisor"); await inbox("coordinator");
    const reminders = await Notification.find({ type: "advisingDeadlineReminder" }).lean();
    for (const role of ["advisor", "coordinator"]) assert.ok(reminders.some((notification) => String(notification.recipient) === String(users[role]._id)), `missing ${role} deadline reminder`);
  } finally { child.kill(); await closed; }
});

test("GAP A3 Req 103,107,113: probation GPA reduces the term limit before saving/submitting/accepting a plan", gap("Shared C1 allowance ignores GPA unless standing/reason also changes"), async () => {
  await StudentProfile.updateOne({ _id: student._id }, { gpa: 3.70 });
  await CourseAttempt.insertMany(courses.map((course) => ({ student: student._id, course: course._id, term: past._id, result: "passed", attendance: "attended", grade: "A" })));
  const heavy = await Course.create({ code: "AHEAVY501", name: "25 credits", creditHours: 25, courseType: "core", facultyMajors: ["CS"], offeringSeasons: ["winter"] });
  const created = await call(planPath(), { role: "advisor", method: "POST", body: { termPlans: [{ term: String(terms[0]._id), courses: [String(heavy._id)] }] } });
  if (created.status === 422) return;
  assert.equal(created.status, 201);
  const submitted = await call(`${planPath()}/${created.data._id}/submit`, { role: "advisor", method: "POST", body: {} });
  const accepted = await call(`/graduation/plans/${created.data._id}/decision`, { method: "POST", body: { decision: "accept", responseNote: "Accepted" } });
  assert.ok([created.status, submitted.status, accepted.status].some((status) => status === 422), "25 credits passed draft, submission and acceptance despite a 23-credit probation limit");
});
