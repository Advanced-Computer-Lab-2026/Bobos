import assert from "node:assert/strict";
import test, { before, beforeEach, after } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { User, StudentProfile, AcademicTerm, Course, CourseOffering, CourseAttempt, StudentSchedule, ExtraHoursRequest,
  FinancialTransaction, FinancialReversalRequest, UniversityInstallment, Notification, GraduationPlan, ExitExamRequest } from "../models/index.js";
import { getWallet } from "../models/academics.js";
import { calculateDraftCreditPolicy } from "../utils/credit-allowance.js";
import { linkOutstandingDeferredCharges } from "../services/university-installments.js";
import { mockStripeCheckout } from "./stripe-checkout.fixture.js";

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
  await Promise.all(courses.map((course, index) => publishFixture(course, index)));
  await publishFixture(courses[0], 0, terms[1]);
  const electives = await Course.create(Array.from({ length: 4 }, (_, index) => ({ code: `AELEC${index}`, name: "Completed elective", creditHours: 4, courseType: "elective", facultyMajors: ["CS"] })));
  await CourseAttempt.insertMany(electives.map((course) => ({ student: student._id, course: course._id, term: past._id, result: "passed", attendance: "attended", grade: "A" })));
});
function publishFixture(course, index = 2, term = terms[0]) {
  const startMinute = 480 + index * 60;
  return CourseOffering.create({
    course: course._id, term: term._id, isPublished: true,
    instructors: [{ fullName: "Fixture Instructor" }], eligibleGroups: [{ major: "CS" }],
    slots: [{ componentType: "lecture", groupNumber: "1", day: "Monday", startMinute, endMinute: startMinute + 60, room: "Fixture room", capacity: 20 }],
  });
}
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

test("A1 Req 86: requesting advisor filter includes advisors outside the active directory", async () => {
  const path = "/extra-hours/requesting-advisors";
  assert.deepEqual((await call(path)).data, []);
  assert.equal((await call(path, { role: "student" })).status, 403);
  await extra();
  const historical = await extra({ advisor: users.otherAdvisor._id });
  await extra({ advisor: users.otherAdvisor._id, decisionStatus: "rejected" });

  await User.updateOne({ _id: users.otherAdvisor._id }, { isAdvisorInSystem: false });
  const expected = [users.advisor, users.otherAdvisor].map(({ _id, fullName }) => ({ _id: String(_id), fullName }));
  const outsideDirectory = await call(path);
  assert.equal(outsideDirectory.status, 200);
  assert.deepEqual(outsideDirectory.data, expected);
  const directory = await call("/advisor/advisors");
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.data.map(advisor => advisor._id), [String(users.advisor._id)]);

  await User.updateOne({ _id: users.otherAdvisor._id }, { isActive: false });
  const inactive = await call(path);
  assert.equal(inactive.status, 200);
  assert.deepEqual(inactive.data, expected);

  const query = new URLSearchParams({ advisorId: String(users.otherAdvisor._id), decisionStatus: "pending" });
  const filtered = await call(`/extra-hours?${query}`);
  assert.equal(filtered.status, 200);
  assert.deepEqual(filtered.data.map(row => row._id), [String(historical._id)]);
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

test("A1 Req 91, 93-94: Stripe checkout retries and only verified payment produces a receipt", async (t) => {
  const stripe = mockStripeCheckout(t);
  const request = await extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" });
  const policy = async () => calculateDraftCreditPolicy(student, await ExtraHoursRequest.find({ student: student._id }).populate("courses.course", "creditHours").lean());
  const checkout = (suffix = "", body = {}, role = "student") =>
    call(`/extra-hours/${request.id}/checkout${suffix}`, { role, method: "POST", body });
  assert.equal((await checkout("", {}, "otherStudent")).status, 404);
  assert.equal((await settle(request, { option: "now", method: "gateway", gatewayResult: "succeeded" })).status, 400);
  assert.equal((await checkout()).status, 201);
  assert.equal((await checkout()).status, 200);
  assert.equal((await checkout("/check")).data.status, "pending");
  assert.equal((await settle(request, { option: "deferred" })).status, 409);
  assert.equal((await checkout("/check", { cancel: true })).data.status, "cancelled");
  assert.equal((await checkout()).status, 201);
  stripe.fail();
  assert.equal((await checkout("/check", { cancel: true })).data.status, "failed");
  assert.equal((await ExtraHoursRequest.findById(request.id)).settlementStatus, "awaitingChoice");
  assert.equal((await policy()).approvedExtraHours, 0);
  assert.equal((await checkout()).status, 201);
  stripe.pay();
  const verified = await Promise.all([checkout("/check"), checkout("/check")]);
  assert.ok(verified.every(({ data }) => data.status === "succeeded"));
  const transactions = await FinancialTransaction.find({ extraHoursRequest: request.id });
  assert.deepEqual(transactions.map((item) => item.status).sort(), ["cancelled", "failed", "succeeded"]);
  assert.equal((await ExtraHoursRequest.findById(request.id)).settlementStatus, "paid");
  assert.equal((await policy()).approvedExtraHours, 3);
  const paid = transactions.find((item) => item.status === "succeeded");
  assert.equal(paid.transactionReference, "pi_receipt");
  const receiptPath = `/extra-hours/mine/financial-history/${paid.id}/download`;
  const receipt = await call(receiptPath, { role: "student" });
  assert.equal(receipt.status, 200, JSON.stringify(receipt.data));
  assert.match(receipt.headers.get("content-type"), /application\/pdf/);
  assert.match(receipt.data.subarray(0, 5).toString(), /%PDF-/);
  assert.match(receipt.headers.get("content-disposition"), /extra-hours-receipt/);
  assert.equal((await call(receiptPath, { role: "otherStudent" })).status, 404);
});

test("Req 83 and 87: a graduation assertion cannot bypass the academic credit limit", async () => {
  await Course.insertMany(Array.from({ length: 16 }, (_, index) => ({
    code: `CLEARWIN${index}`, name: `Remaining course ${index}`, creditHours: 4,
    courseType: "core", facultyMajors: ["CS"], offeringSeasons: ["winter"],
  })));
  const course = courses[1];
  const result = await call("/extra-hours", { role: "advisor", method: "POST", body: {
    ...requestBody(), courseIds: [course.id], graduatingWithinOneYear: true,
  } });
  assert.equal(result.status, 400);
  assert.match(result.data.message, /at most 3 hours/i);
  const legacy = await extra({
    courses: [{ course: course.id, hours: 4, pricePerHour: 800, subtotal: 3200, isRepeated: false }],
    requestedHours: 4, totalCost: 3200,
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 34, isProbation: false, graduatingWithinOneYear: true },
  });
  assert.equal((await decide(legacy, { decision: "approved", responseNote: "Confirm" })).status, 409);
  assert.equal((await ExtraHoursRequest.findById(legacy.id)).decisionStatus, "pending");
});

test("Req 87: current credits, term availability and repeat pricing gate coordinator approval", async () => {
  const request = await extra();
  const approve = () => decide(request, { decision: "approved", responseNote: "Confirm" });
  await Course.updateOne({ _id: courses[0]._id }, { creditHours: 2 });
  let response = await approve();
  assert.equal(response.status, 409);
  assert.match(response.data.message, /credits or prices have changed/);
  await Course.updateOne({ _id: courses[0]._id }, { creditHours: 3 });
  await CourseOffering.updateOne({ course: courses[0]._id, term: terms[0]._id }, { isPublished: false });
  response = await approve();
  assert.equal(response.status, 409);
  assert.match(response.data.message, /unpublished/);
  await CourseOffering.deleteOne({ course: courses[0]._id, term: terms[0]._id });
  response = await approve();
  assert.equal(response.status, 409);
  assert.match(response.data.message, /unavailable/);
  await publishFixture(courses[0], 0);
  await CourseAttempt.create({ student: student._id, course: courses[0]._id, term: past._id, result: "failed", attendance: "attended", grade: "F" });
  response = await approve();
  assert.equal(response.status, 409);
  assert.match(response.data.message, /credits or prices have changed/);
  assert.equal((await ExtraHoursRequest.findById(request.id)).decisionStatus, "pending");
});

test("Req 91–92: stale approval cannot debit a wallet, defer a charge or open Stripe checkout", async (t) => {
  mockStripeCheckout(t);
  const request = await extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" });
  await FinancialTransaction.create({ student: student._id, kind: "walletTopUp", amount: 3000, status: "succeeded" });
  await Course.updateOne({ _id: courses[0]._id }, { creditHours: 2 });
  const results = await Promise.all([
    settle(request, { option: "now", method: "wallet" }),
    settle(request, { option: "deferred" }),
    call(`/extra-hours/${request.id}/checkout`, { role: "student", method: "POST", body: {} }),
  ]);
  assert.ok(results.every(({ status, data }) => status === 409 && /credits or prices have changed/.test(data.message)));
  await Course.updateOne({ _id: courses[0]._id }, { creditHours: 3 });
  await CourseOffering.deleteOne({ course: courses[0]._id, term: terms[0]._id });
  const missingOffering = await settle(request, { option: "deferred" });
  assert.equal(missingOffering.status, 409);
  assert.match(missingOffering.data.message, /unavailable/);
  assert.equal((await getWallet(student._id)).balance, 3000);
  assert.equal(await FinancialTransaction.countDocuments({ extraHoursRequest: request.id }), 0);
  assert.equal(await UniversityInstallment.countDocuments(), 0);
  assert.equal((await ExtraHoursRequest.findById(request.id)).settlementStatus, "awaitingChoice");
});

test("Req 91: Stripe capture after a course change produces one wallet credit across simultaneous confirmations", async (t) => {
  const stripe = mockStripeCheckout(t);
  const request = await extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" });
  const checkout = (suffix = "") => call(`/extra-hours/${request.id}/checkout${suffix}`, { role: "student", method: "POST", body: {} });
  assert.equal((await checkout()).status, 201);
  await Course.updateOne({ _id: courses[0]._id }, { creditHours: 2 });
  stripe.pay();
  const results = await Promise.all([checkout("/check"), checkout("/check")]);
  assert.deepEqual(results.map(({ data }) => data.status), ["refunded", "refunded"]);
  assert.equal((await checkout("/check")).data.status, "refunded");
  const capture = await FinancialTransaction.findOne({ extraHoursRequest: request.id, kind: "gatewayPayment" });
  assert.equal(capture.status, "REFUNDED");
  assert.equal(capture.transactionReference, "pi_receipt");
  const refunded = await FinancialTransaction.find({ extraHoursRequest: request.id, kind: "refund" });
  assert.equal(refunded.length, 1);
  assert.equal(String(refunded[0].relatedTransaction), capture.id);
  assert.equal((await getWallet(student._id)).balance, 2400);
  const state = await ExtraHoursRequest.findById(request.id).populate("courses.course", "creditHours").lean();
  assert.equal(state.settlementStatus, "refunded");
  assert.equal(calculateDraftCreditPolicy(student, [state]).approvedExtraHours, 0);
  assert.equal(await Notification.countDocuments({ recipient: users.student._id, type: "refundIssued" }), 1);
});

test("A1 Req 94: deferred confirmation download is not labelled a paid receipt", async () => {
  const request = await extra({ decisionStatus: "approved", settlementStatus: "awaitingChoice" });
  const result = await settle(request, { option: "deferred" });
  assert.equal(result.status, 200);
  assert.equal(result.data.confirmation.type, "deferredPaymentConfirmation");
  assert.ok(result.data.confirmation.installment && result.data.confirmation.confirmedAt);
  const installment = await UniversityInstallment.findById(result.data.confirmation.installmentId);
  assert.equal(String(installment.student), String(student._id));
  assert.equal(String(installment.term), String(terms[0]._id));
  assert.equal(installment.label, result.data.confirmation.installment);
  assert.equal(result.data.transaction.installmentId, String(installment._id));
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

async function assertCoordinatorAlert(type) {
  for (let refresh = 0; refresh < 2; refresh++) {
    const result = await inbox();
    assert.equal(result.status, 200);
    assert.equal(result.data.notifications.filter(notification => notification.type === type).length, 1);
  }
}

test("A2 Req 120: submitted graduation plans notify coordinators", async () => {
  const id = await submitPlan();
  assert.equal((await call(`/graduation/plans/${id}/decision`, {
    method: "POST", body: { decision: "reject", responseNote: "Please revisit the plan." },
  })).status, 200);
  await assertCoordinatorAlert("graduationPlanSubmitted");
});

test("A2 Req 120: new exit-exam requests notify coordinators", async () => {
  const id = await requestExam();
  assert.equal((await call(`/graduation/exit-exams/${id}/decision`, {
    method: "POST", body: { decision: "approve", responseNote: "Eligibility verified." },
  })).status, 200);
  await assertCoordinatorAlert("exitExamRequested");
});

test("A2 Req 120: mandatory-removal requests notify coordinators", async () => {
  await CourseAttempt.create({ student: student._id, course: courses[0]._id, term: past._id, attendance: "attended", result: "failed", grade: "F" });
  const result = await call("/mandatory-removals", { role: "advisor", method: "POST", body: { studentProfileId: String(student._id), courseId: String(courses[0]._id), termId: String(terms[0]._id), reason: "other", explanation: "Audit request" } });
  assert.equal(result.status, 201);
  assert.equal((await call(`/mandatory-removals/${result.data._id}/decision`, {
    method: "PATCH", body: { decision: "approved", responseNote: "Checked transcript." },
  })).status, 200);
  await assertCoordinatorAlert("mandatoryCourseRemovalRequested");
});

test("A2 Req 120: pending financial reversals notify coordinators", async () => {
  const request = await extra();
  const paid = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, amount: 2400, kind: "gatewayPayment", status: "succeeded" });
  await FinancialReversalRequest.create({ student: student._id, extraHoursRequest: request._id, originalTransaction: paid._id, requestedBy: users.advisor._id, reversalType: "refundToWallet" });
  await assertCoordinatorAlert("financialReversalRequested");
});

test("A2 Req 121: API startup produces reminders for assigned open schedules near the advising deadline", async () => {
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

test("A3 Req 103,107,113: GPA-based probation limits are checked when saving, submitting and accepting", async () => {
  const setGpa = (gpa) => StudentProfile.updateOne({ _id: student._id }, { gpa });
  await CourseAttempt.insertMany(courses.map((course) => ({ student: student._id, course: course._id, term: past._id, result: "passed", attendance: "attended", grade: "A" })));
  const heavy = await Course.create({ code: "AHEAVY501", name: "25 credits", creditHours: 25, courseType: "core", facultyMajors: ["CS"], offeringSeasons: ["winter"] });
  await publishFixture(heavy);
  const save = () => call(planPath(), { role: "advisor", method: "POST", body: { termPlans: [{ term: String(terms[0]._id), courses: [String(heavy._id)] }] } });
  const assertOverLimit = (result) => {
    assert.equal(result.status, 422, JSON.stringify(result.data));
    assert.ok(result.data.issues.some((issue) => /25 credit hours.*limit.*23/.test(issue)), JSON.stringify(result.data));
  };

  await setGpa(3.70);
  assertOverLimit(await save());
  await setGpa(3.69);
  const created = await save();
  assert.equal(created.status, 201, JSON.stringify(created.data));

  const submit = () => call(`${planPath()}/${created.data._id}/submit`, { role: "advisor", method: "POST", body: {} });
  await setGpa(3.70);
  assertOverLimit(await submit());
  await setGpa(3.69);
  const submitted = await submit();
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));

  const accept = () => call(`/graduation/plans/${created.data._id}/decision`, { method: "POST", body: { decision: "accept", responseNote: "Accepted" } });
  await setGpa(3.70);
  assertOverLimit(await accept());
  await setGpa(3.69);
  const accepted = await accept();
  assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
});

test("A2 Req 121: reminder window, open states, assignment and repeat delivery", async () => {
  const { sendDeadlineReminders } = await import("../services/deadline-reminders.js");
  const deadline = terms[0].advisingDeadline.getTime();
  const schedule = await StudentSchedule.create({ student: student._id, term: terms[0]._id, scheduleType: "advising", status: "readyForStudentReview", createdBy: users.advisor._id });
  const run = offset => sendDeadlineReminders(new Date(deadline + offset));
  const reminders = { type: "advisingDeadlineReminder" };
  await run(-86400001);
  await run(0);
  await run(1);
  await StudentProfile.updateOne({ _id: student._id }, { assignedAdvisor: null });
  await run(-3600000);
  await StudentProfile.updateOne({ _id: student._id }, { assignedAdvisor: users.advisor._id });
  schedule.status = "processed";
  await schedule.save();
  await run(-3600000);
  schedule.scheduleType = "normal";
  schedule.status = "draft";
  await schedule.save();
  await run(-3600000);
  assert.equal(await Notification.countDocuments(reminders), 0);
  schedule.scheduleType = "advising";
  schedule.status = "readyForStudentReview";
  await schedule.save();
  await run(-86400000);
  await run(-3600000);
  const records = await Notification.find(reminders);
  assert.deepEqual(records.map(record => String(record.recipient)).sort(), [users.advisor, users.coordinator].map(user => String(user._id)).sort());
});

for (const method of ["wallet", "deferred"]) {
  test(`Req 50, 52, 102, 120: live ${method} requests reach the roster, reversal queue and coordinator inbox`, async () => {
    const created = await call("/extra-hours", { method: "POST", role: "advisor", body: requestBody() });
    assert.equal(created.status, 201);
    const request = created.data;
    const roster = (status) => call(`/advisor/students?scheduleStatus=${status}`, { role: "advisor" });
    const overview = () => call(`/schedules/advising/${student._id}/overview`, { role: "advisor" });
    assert.equal((await roster("pendingApproval")).data.data[0]._id, String(student._id));
    assert.equal((await overview()).data.scheduleStatus, "pendingApproval");
    assert.equal((await decide(request, { decision: "approved", responseNote: "Checked" })).status, 200);
    assert.equal((await roster("awaitingPaymentChoice")).data.data[0]._id, String(student._id));
    assert.equal((await overview()).data.scheduleStatus, "awaitingPaymentChoice");
    await FinancialTransaction.create({ student: student._id, kind: "walletTopUp", amount: 3000, status: "succeeded" });
    const settled = await settle(request, method === "wallet" ? { option: "now", method } : { option: "deferred" });
    assert.equal(settled.status, 200, JSON.stringify(settled.data));
    if (method === "deferred") {
      assert.equal((await roster("deferredToNextInstallment")).data.data[0]._id, String(student._id));
      assert.equal((await overview()).data.scheduleStatus, "deferredToNextInstallment");
    }
    assert.equal((await roster("awaitingPaymentChoice")).data.data.length, 0);

    const path = `/finance/records/${settled.data.transaction._id}`;
    const open = (role, reason = "Approved course no longer needed") => call(`${path}/reversal-request`, { role, method: "POST", body: { reason } });
    const process = () => call(`${path}/refund`, { method: "POST", body: {} });
    const type = method === "wallet" ? "refundToWallet" : "cancelDeferredCharge";
    const original = await call(path);
    assert.equal(original.data.requestableReversal, type);
    assert.equal(original.data.availableReversal, null);
    assert.equal((await process()).status, 400);
    assert.equal((await open("student")).status, 403);
    assert.equal((await open("administrator", " ")).status, 400);
    const submitted = await Promise.all([open("administrator"), open("administrator")]);
    assert.deepEqual(submitted.map(result => result.status).sort(), [201, 409]);
    const id = submitted.find(result => result.status === 201).data.reversal._id;
    const queued = await call(path);
    assert.equal(queued.data.requestableReversal, null);
    assert.equal(queued.data.availableReversal, type);
    assert.equal(queued.data.reversalReason, "Approved course no longer needed");
    const outcomes = await Promise.all([process(), process()]);
    assert.deepEqual(outcomes.map(result => result.status).sort(), [200, 400]);
    const stored = await FinancialReversalRequest.findById(id);
    assert.equal(stored.status, "completed");
    assert.equal(stored.reason, "Approved course no longer needed");
    assert.equal((await getWallet(student._id)).balance, 3000);
    assert.equal((await ExtraHoursRequest.findById(request._id)).settlementStatus, method === "wallet" ? "refunded" : "cancelled");
    assert.equal(await FinancialTransaction.countDocuments({ relatedTransaction: settled.data.transaction._id }), 1);
    const messages = (await inbox()).data.notifications.filter(item => item.type === "financialReversalRequested");
    assert.equal(messages.length, 1);
    assert.equal((await Notification.findById(messages[0]._id)).relatedId, id);
  });
}

test("Req 117: a returned and resubmitted plan retains both decisions before the first inbox visit", async () => {
  const id = await submitPlan();
  const decidePlan = decision => call(`/graduation/plans/${id}/decision`, {
    method: "POST", body: { decision, responseNote: "Checked." },
  });
  assert.equal((await decidePlan("reject")).status, 200);
  assert.equal((await call(`${planPath()}/${id}/submit`, { role: "advisor", method: "POST" })).status, 200);
  assert.equal((await decidePlan("accept")).status, 200);
  for (let read = 0; read < 2; read++) {
    const decisions = (await inbox("student")).data.notifications.filter(item => item.type === "graduationPlanDecision");
    assert.equal(decisions.length, 2);
    assert.ok(decisions.some(item => item.message.includes("returned")));
    assert.ok(decisions.some(item => item.message.includes("accepted")));
  }
  assert.ok(!(await inbox("otherStudent")).data.notifications.some(item => item.type === "graduationPlanDecision"));
});


test("Req 92 and 102: distinct deferrals share the next installment and cancellation removes only its charge", async () => {
  const shortCourses = await Course.create(["INST1", "INST2"].map(code => ({
    code, name: code, creditHours: 1, courseType: "core", facultyMajors: ["CS"],
  })));
  const requests = [];
  for (const course of shortCourses) {
    await publishFixture(course);
    const created = await call("/extra-hours", { role: "advisor", method: "POST",
      body: { ...requestBody(), courseIds: [String(course._id)] } });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal((await decide(created.data, { decision: "approved", responseNote: "Confirmed" })).status, 200);
    requests.push(created.data);
  }

  const outcomes = await Promise.all(requests.map(request => settle(request, { option: "deferred" })));
  assert.deepEqual(outcomes.map(result => result.status), [200, 200]);
  const [first, second] = outcomes.map(result => result.data.transaction);
  assert.ok(first.installmentId);
  assert.equal(first.installmentId, second.installmentId);
  assert.equal(await UniversityInstallment.countDocuments({ student: student._id, term: terms[0]._id }), 1);
  const history = await call("/extra-hours/mine/financial-history", { role: "student" });
  assert.equal(history.data.filter(record => record.installmentId === first.installmentId).length, 2);
  await StudentProfile.create({ user: users.otherStudent._id, studentId: "80-00002", studentType: "advising", major: "CS", currentSemester: 5, gpa: 2,
    academicStanding: "goodAcademicStanding", advisingReason: "failedCourses" });
  assert.deepEqual((await call("/extra-hours/mine/financial-history", { role: "otherStudent" })).data, []);

  const route = `/finance/records/${first._id}`;
  assert.equal((await call(`${route}/reversal-request`, { method: "POST", body: { reason: "Withdraw one course" } })).status, 201);
  const cancellation = await call(`${route}/refund`, { method: "POST", body: { reason: "Withdraw one course" } });
  assert.equal(cancellation.status, 200);
  assert.equal(cancellation.data.refundRecord.installmentId, first.installmentId);
  const charges = await FinancialTransaction.find({ installmentId: first.installmentId, kind: "deferredCharge", status: "pending" });
  assert.deepEqual(charges.map(charge => charge.id), [second._id]);
  assert.equal((await getWallet(student._id)).balance, 0);
});

test("Req 92 and 94: existing outstanding charges gain a reusable installment link without changing amounts", async () => {
  const legacyCourse = await Course.create({ code: "LEGACY-OLD", name: "Existing course", creditHours: 2, courseType: "core", facultyMajors: ["CS"] });
  const request = await extra({
    courses: [{ course: legacyCourse.id, hours: 2, pricePerHour: 800, subtotal: 1600, isRepeated: false }],
    requestedHours: 2, totalCost: 1600, decisionStatus: "approved", settlementStatus: "deferred", settlementOption: "deferred",
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 32, isProbation: false, graduatingWithinOneYear: false },
  });
  const old = await FinancialTransaction.create({
    student: student._id, extraHoursRequest: request._id, kind: "deferredCharge", status: "PENDING",
    amount: request.totalCost, settlementOption: "deferred", installment: "Next installment",
  });
  await linkOutstandingDeferredCharges();
  await linkOutstandingDeferredCharges();
  const upgraded = await FinancialTransaction.findById(old._id);
  assert.ok(upgraded.installmentId);
  assert.equal(upgraded.amount, old.amount);
  assert.equal(upgraded.status, old.status);
  assert.equal(upgraded.installment, old.installment);
  assert.equal(await UniversityInstallment.countDocuments({ student: student._id, term: terms[0]._id }), 1);

  const course = await Course.create({ code: "LEGACY-INST", name: "Next installment course", creditHours: 1, courseType: "core", facultyMajors: ["CS"] });
  await publishFixture(course);
  const next = await extra({
    courses: [{ course: course.id, hours: 1, pricePerHour: 800, subtotal: 800, isRepeated: false }],
    requestedHours: 1, totalCost: 800, decisionStatus: "approved", settlementStatus: "awaitingChoice",
  });
  const settled = await settle(next, { option: "deferred" });
  assert.equal(settled.status, 200);
  assert.equal(settled.data.transaction.installmentId, String(upgraded.installmentId));
  assert.equal((await call(`/extra-hours/mine/financial-history/${old._id}/download`, { role: "student" })).status, 200);
});
