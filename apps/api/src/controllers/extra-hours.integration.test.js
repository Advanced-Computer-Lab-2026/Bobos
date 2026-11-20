import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import app from "../app.js";
import {
  StudentProfile,
  User,
  AcademicTerm,
  Course,
  CourseAttempt,
  ExtraHoursRequest,
  FinancialTransaction,
  Notification,
} from "../models/index.js";
import { generateToken } from "../middleware/auth.middleware.js";

let database;
let server;
let base;
let users;
let profiles;
let term;
let courses;

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  await Promise.all([
    User.init(),
    StudentProfile.init(),
    AcademicTerm.init(),
    Course.init(),
    CourseAttempt.init(),
    ExtraHoursRequest.init(),
    FinancialTransaction.init(),
    Notification.init(),
  ]);

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Create Users
  const [advisorUser, coordUser, studentUser, probationStudentUser, normalStudentUser] = await User.create([
    { email: "advisor1@guc.edu.eg", fullName: "Dr. Advisor", role: "advisor", passwordHash, isActive: true, isAdvisorInSystem: true },
    { email: "coordinator1@guc.edu.eg", fullName: "Prof. Coordinator", role: "coordinator", passwordHash, isActive: true },
    { email: "student1@student.guc.edu.eg", fullName: "Advising Student 1", role: "advisingStudent", passwordHash, isActive: true },
    { email: "probation@student.guc.edu.eg", fullName: "Probation Student", role: "advisingStudent", passwordHash, isActive: true },
    { email: "normal@student.guc.edu.eg", fullName: "Normal Student", role: "normalStudent", passwordHash, isActive: true },
  ]);

  users = {
    advisor: advisorUser,
    coordinator: coordUser,
    student: studentUser,
    probationStudent: probationStudentUser,
    normalStudent: normalStudentUser,
  };

  // Create Term
  term = await AcademicTerm.create({
    code: "W26",
    season: "winter",
    academicYear: "2026/2027",
    termStart: new Date("2026-10-01"),
    termEnd: new Date("2027-02-01"),
    teachingStart: new Date("2026-10-05"),
    teachingEnd: new Date("2027-01-20"),
    registrationStart: new Date("2026-09-20"),
    registrationEnd: new Date("2026-10-01"),
    advisingDeadline: new Date("2026-10-15"),
    wholeScheduleSwapDeadline: new Date("2026-10-15"),
    isActive: true,
  });

  // Create Student Profiles
  // Standard allowance for semester 5 is 30 hours
  const regularProfile = await StudentProfile.create({
    user: studentUser._id,
    studentId: "64-11111",
    studentType: "advising",
    major: "CS",
    currentSemester: 5,
    gpa: 2.1,
    academicStanding: "goodAcademicStanding",
    advisingReason: "failedCourses",
    assignedAdvisor: advisorUser._id,
  });

  const probationProfile = await StudentProfile.create({
    user: probationStudentUser._id,
    studentId: "64-22222",
    studentType: "advising",
    major: "CS",
    currentSemester: 5,
    gpa: 3.85, // Probation on GUC scale
    academicStanding: "probation",
    advisingReason: "probation",
    assignedAdvisor: advisorUser._id,
  });

  const normalProfile = await StudentProfile.create({
    user: normalStudentUser._id,
    studentId: "64-33333",
    studentType: "normal",
    major: "CS",
    currentSemester: 5,
    gpa: 1.5,
    academicStanding: "goodAcademicStanding",
  });

  profiles = {
    regular: regularProfile,
    probation: probationProfile,
    normal: normalProfile,
  };

  // Create Courses
  // Course 1: 3 credit hours
  // Course 2: 2 credit hours
  // Course 3: 4 credit hours
  const [c1, c2, c3] = await Course.create([
    { code: "CSEN501", name: "Databases I", creditHours: 3, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 5, offeringSeasons: ["winter"] },
    { code: "CSEN502", name: "Networks", creditHours: 2, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 5, offeringSeasons: ["winter"] },
    { code: "CSEN503", name: "Advanced Algorithms", creditHours: 4, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 5, offeringSeasons: ["winter"] },
  ]);
  courses = [c1, c2, c3];

  // Mark Course 1 as attempted/failed previously by regular student so it's a "repeated" course
  await CourseAttempt.create({
    student: regularProfile._id,
    course: c1._id,
    term: term._id,
    attemptNumber: 1,
    attendance: "attended",
    result: "failed",
    grade: "F",
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function apiCall(endpoint, { method = "GET", userRole = "advisor", body = null } = {}) {
  const token = generateToken(users[userRole]);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

test("Req 83: Advisor successfully creates extra credit hours request with repeated and new course pricing", async () => {
  // c1 is 3 credits and repeated (1,000 EGP/hr -> 3,000 EGP)
  // Non-graduating student: max 3 hours allowed above standard
  const res = await apiCall("/extra-hours", {
    method: "POST",
    userRole: "advisor",
    body: {
      studentId: String(profiles.regular._id),
      termId: String(term._id),
      courseIds: [String(courses[0]._id)],
      graduatingWithinOneYear: false,
    },
  });

  assert.equal(res.status, 201, `Failed to create request: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.requestedHours, 3);
  assert.equal(res.body.decisionStatus, "pending");
  assert.equal(res.body.settlementStatus, "none");
  assert.equal(res.body.courses[0].isRepeated, true);
  assert.equal(res.body.courses[0].pricePerHour, 1000);
  assert.equal(res.body.courses[0].subtotal, 3000);
  assert.equal(res.body.totalCost, 3000);
  assert.equal(res.body.eligibilitySnapshot.isProbation, false);
  assert.equal(res.body.eligibilitySnapshot.standardAllowance, 30);
  assert.equal(res.body.eligibilitySnapshot.hoursBeforeRequest, 30);
  assert.equal(res.body.eligibilitySnapshot.hoursAfterRequest, 33);
});

test("Req 83: Pricing for a new (unattempted) course is 800 EGP/hr", async () => {
  // Clean up any pending request first
  await ExtraHoursRequest.deleteMany({});

  // c2 is 2 credits, never attempted -> 800 EGP/hr -> 1600 EGP
  const res = await apiCall("/extra-hours", {
    method: "POST",
    userRole: "advisor",
    body: {
      studentId: profiles.regular.studentId, // Using studentId string
      termId: term.code, // Using term code
      courseIds: [String(courses[1]._id)],
      graduatingWithinOneYear: false,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.courses[0].isRepeated, false);
  assert.equal(res.body.courses[0].pricePerHour, 800);
  assert.equal(res.body.courses[0].subtotal, 1600);
  assert.equal(res.body.totalCost, 1600);
});

test("Req 83: Non-graduating student cannot request more than 3 extra hours", async () => {
  await ExtraHoursRequest.deleteMany({});

  // c3 is 4 credit hours (> 3 hours above standard allowance)
  const res = await apiCall("/extra-hours", {
    method: "POST",
    userRole: "advisor",
    body: {
      studentId: String(profiles.regular._id),
      courseIds: [String(courses[2]._id)], // 4 credits
      graduatingWithinOneYear: false,
    },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /at most 3 hours/i);
});

test("Req 83: Graduating student can request more than 3 extra hours up to 34 total", async () => {
  await ExtraHoursRequest.deleteMany({});

  // Semester 5 standard is 30. Adding 4 credits = 34 total.
  // Allowed when graduatingWithinOneYear = true.
  const res = await apiCall("/extra-hours", {
    method: "POST",
    userRole: "advisor",
    body: {
      studentId: String(profiles.regular._id),
      courseIds: [String(courses[2]._id)], // 4 credits
      graduatingWithinOneYear: true,
    },
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.requestedHours, 4);
  assert.equal(res.body.eligibilitySnapshot.hoursAfterRequest, 34);
});

test("Req 83: Probation students cannot receive extra credit hours", async () => {
  const res = await apiCall("/extra-hours", {
    method: "POST",
    userRole: "advisor",
    body: {
      studentId: String(profiles.probation._id),
      courseIds: [String(courses[0]._id)],
    },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /probation/i);
});

test("Req 83: Normal student cannot receive extra credit hours", async () => {
  const res = await apiCall("/extra-hours", {
    method: "POST",
    userRole: "advisor",
    body: {
      studentId: String(profiles.normal._id),
      courseIds: [String(courses[0]._id)],
    },
  });

  assert.equal(res.status, 400);
  assert.match(res.body.message, /advising students/i);
});

test("Req 96: Advisor can withdraw a pending extra-hours request", async () => {
  await ExtraHoursRequest.deleteMany({});

  const createRes = await apiCall("/extra-hours", {
    method: "POST",
    userRole: "advisor",
    body: {
      studentId: String(profiles.regular._id),
      courseIds: [String(courses[0]._id)],
    },
  });

  const requestId = createRes.body._id;
  assert.ok(requestId);

  const withdrawRes = await apiCall(`/extra-hours/${requestId}/withdraw`, {
    method: "POST",
    userRole: "advisor",
  });

  assert.equal(withdrawRes.status, 200);
  assert.equal(withdrawRes.body.decisionStatus, "withdrawn");

  // Attempting to withdraw again must fail
  const repeatWithdraw = await apiCall(`/extra-hours/${requestId}/withdraw`, {
    method: "POST",
    userRole: "advisor",
  });
  assert.equal(repeatWithdraw.status, 400);
});

test("Req 117 delivers extra-hours decisions, payment outcomes, deferred charges and reversals to the owner", async () => {
  await Promise.all([ExtraHoursRequest.deleteMany({}), Notification.deleteMany({}), FinancialTransaction.deleteMany({})]);
  const submit = async () => {
    const response = await apiCall("/extra-hours", {
      method: "POST",
      body: { studentId: String(profiles.regular._id), courseIds: [String(courses[0]._id)] },
    });
    assert.equal(response.status, 201, response.body.message);
    return response.body._id;
  };
  const decide = (id, decision, responseNote) => apiCall(`/extra-hours/${id}/decision`, {
    method: "POST", userRole: "coordinator", body: { decision, responseNote },
  });
  const settle = (id, body, userRole = "student") => apiCall(`/extra-hours/${id}/settlement`, { method: "POST", userRole, body });
  const inbox = async (userRole = "student") => {
    const response = await apiCall("/notifications", { userRole });
    assert.equal(response.status, 200, response.body.message);
    return response.body.notifications;
  };

  const rejectedId = await submit();
  assert.deepEqual(await inbox(), []);
  assert.equal((await decide(rejectedId, "rejected", "This course needs a different term.")).status, 200);
  const paidId = await submit();
  const approvals = await Promise.all([decide(paidId, "approved", "Approved for this term."), decide(paidId, "approved", "Approved for this term.")]);
  assert.deepEqual(approvals.map(response => response.status).sort(), [200, 409]);

  const gateway = { option: "now", method: "gateway" };
  assert.equal((await settle(paidId, gateway, "probationStudent")).status, 404);
  assert.equal((await settle(paidId, { ...gateway, gatewayResult: "failed" })).body.transaction.status, "failed");
  const paid = await settle(paidId, gateway);
  assert.equal(paid.status, 200, paid.body.message);
  assert.equal(paid.body.transaction.status, "succeeded");
  assert.equal((await settle(paidId, gateway)).status, 409);

  const walletId = await submit();
  assert.equal((await decide(walletId, "approved")).status, 200);
  const wallet = { option: "now", method: "wallet" };
  assert.equal((await settle(walletId, wallet)).status, 409);
  await FinancialTransaction.create({ student: profiles.regular._id, kind: "walletTopUp", status: "succeeded", amount: 3000 });
  const walletPayment = await settle(walletId, wallet);
  assert.equal(walletPayment.status, 200, walletPayment.body.message);
  assert.equal(walletPayment.body.transaction.kind, "extraHoursWalletPayment");

  const deferredId = await submit();
  assert.equal((await decide(deferredId, "approved")).status, 200);
  const deferred = await settle(deferredId, { option: "deferred" });
  assert.equal(deferred.status, 200, deferred.body.message);
  assert.equal(deferred.body.request.settlementStatus, "deferred");

  // The finance workflow publishes the outcome in the ledger when a reversal completes.
  await FinancialTransaction.create([
    { student: profiles.regular._id, extraHoursRequest: paidId, kind: "refund", amount: paid.body.transaction.amount,
      status: "succeeded", settlementOption: "wallet", relatedTransaction: paid.body.transaction._id },
    { student: profiles.regular._id, extraHoursRequest: deferredId, kind: "deferredChargeCancellation",
      amount: deferred.body.transaction.amount, status: "succeeded", settlementOption: "deferred",
      relatedTransaction: deferred.body.transaction._id },
    { student: profiles.regular._id, extraHoursRequest: paidId, kind: "refund", amount: 100, status: "failed" },
  ]);

  assert.deepEqual(await inbox("probationStudent"), []);
  assert.deepEqual(await inbox("normalStudent"), []);
  const notifications = await inbox();
  assert.deepEqual((await inbox()).map(item => item._id).sort(), notifications.map(item => item._id).sort());
  assert.ok(notifications.every(item => item.recipient === String(users.student._id)));
  const titles = notifications.map(item => item.title).sort();
  assert.deepEqual(titles, [
    "Deferred extra-hours charge cancelled", "Extra-hours charge deferred", "Extra-hours payment failed",
    "Extra-hours payment succeeded", "Extra-hours payment succeeded", "Extra-hours refund issued",
    "Extra-hours request approved", "Extra-hours request approved", "Extra-hours request approved",
    "Extra-hours request rejected",
  ]);
  assert.match(notifications.find(item => item.title === "Extra-hours request rejected").message, /This course needs a different term/);
});
