import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { User, StudentProfile } from "../models/identity.js";
import { AcademicTerm, Course } from "../models/catalogue.js";
import { CourseAttempt } from "../models/academics.js";
import { FinancialTransaction } from "../models/finance.js";
import { Notification } from "../models/communications.js";
import { MandatoryCourseRemovalRequest } from "../models/requests.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { writeFile } from "node:fs/promises";

let database, server, base, token, staffToken, student, other;
before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  const user = await User.create({ email: "records@student.guc.edu.eg", fullName: "Records Student", passwordHash: "unused", role: "advisingStudent" });
  const advisor = await User.create({ email: "advisor@guc.edu.eg", fullName: "Assigned Advisor", passwordHash: "unused", role: "advisor" });
  staffToken = generateToken(advisor);
  student = await StudentProfile.create({ user: user._id, studentId: "28-10001", studentType: "advising", advisingReason: "probation", major: "CS", currentSemester: 4, gpa: 2, academicStanding: "goodAcademicStanding", assignedAdvisor: advisor._id });
  other = (await isolatedStudent()).profile._id;
  token = generateToken(user);
  const dates = { termStart: "2025-09-01", termEnd: "2026-01-31", teachingStart: "2025-09-01", teachingEnd: "2026-01-01", registrationStart: "2025-08-01", registrationEnd: "2025-08-31", advisingDeadline: "2025-09-20", wholeScheduleSwapDeadline: "2025-09-25" };
  const term = await AcademicTerm.create({ ...dates, code: "W25", academicYear: "2025/2026", season: "winter" });
  const courses = await Course.create(["Passed", "Failed", "Current", "Remaining"].map((name, i) => ({ code: `CS${i}`, name, creditHours: 3, courseType: "core", facultyMajors: ["CS"] })));
  await CourseAttempt.create(courses.slice(0, 3).map((course, i) => ({ student: student._id, course: course._id, term: term._id, result: ["passed", "failed", "current"][i], attendance: "attended", grade: i === 0 ? "A" : i === 1 ? "F" : undefined })));
  await FinancialTransaction.create([
    { kind: "walletTopUp", amount: 100, status: "succeeded" },
    { kind: "extraHoursWalletPayment", amount: 30, status: "succeeded" },
    { kind: "refund", amount: 10, status: "succeeded" },
    { kind: "walletTopUp", amount: 999, status: "pending" },
  ].map(tx => ({ ...tx, student: student._id })));
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/identity/students`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});
const request = (path, authenticated = true, id = student._id) => fetch(`${base}/${id}/${path}`, { headers: authenticated ? { Authorization: `Bearer ${token}` } : {} });
const staffRequest = (path, id = student._id) => fetch(`${base}/${id}/${path}`, { headers: { Authorization: `Bearer ${staffToken}` } });

test("all student record routes reject anonymous users and other students", async () => {
  for (const path of ["history", "transcript?year=2025/2026", "transcript/download?year=2025/2026", "failed-courses", "wallet"]) {
    assert.equal((await request(path, false)).status, 401);
    assert.equal((await request(path, true, other)).status, 403);
  }
  assert.equal((await request("history", true, "bad-id")).status, 400);
});
test("academic history resolves advisor, credits and courses still required", async () => {
  const response = await request("history");
  assert.equal(response.status, 200);
  const history = await response.json();
  assert.equal(history.studentProfile.advisor, "Assigned Advisor");
  assert.equal(history.studentProfile.completedHours, 3);
  assert.deepEqual(history.remainingCourses.map(c => c.name).sort(), ["Failed", "Remaining"]);
  assert.equal(history.currentCourses.length, 1);
});
test("transcript uses academicYear and PDF downloads contain PDF data", async () => {
  const response = await request("transcript?year=2025/2026");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).terms.winter.length, 3);
  assert.equal((await request("transcript?year=invalid")).status, 400);
  assert.equal((await request("transcript?year=2030/2031")).status, 404);
  const pdf = await request("transcript/download?year=2025/2026");
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition"), /28-10001_2025-2026/);
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
});
test("failed courses and wallet report persisted records", async () => {
  assert.equal((await (await staffRequest("failed-courses")).json()).length, 1);
  const wallet = await (await request("wallet")).json();
  assert.equal(wallet.balance, 80);
  assert.equal(wallet.transactions.length, 4);
});
test("profile and notifications use authenticated identity with persisted data", async () => {
  const origin = base.split('/api/identity/students')[0];
  const headers = { Authorization: `Bearer ${token}` };
  const own = await Notification.create({ recipient: student.user, type: "paymentUpdated", title: "Wallet updated", message: "Payment received" });
  const foreign = await Notification.create({ recipient: other, type: "paymentUpdated", title: "Private", message: "Other student" });
  const profile = await (await fetch(`${origin}/api/profile`, { headers })).json();
  assert.equal(profile.profile.studentId, "28-10001");
  assert.equal(profile.profile.assignedAdvisor.fullName, "Assigned Advisor");
  const list = await (await fetch(`${origin}/api/notifications?userId=${other}`, { headers })).json();
  assert.equal(list.count, 1);
  assert.equal(list.notifications[0]._id, String(own._id));
  assert.equal((await fetch(`${origin}/api/notifications/${foreign._id}/read`, { method: "PATCH", headers })).status, 403);
  assert.equal((await fetch(`${origin}/api/notifications/${own._id}/read`, { method: "PATCH", headers })).status, 200);
  assert.ok((await Notification.findById(own._id)).readAt);
});

let edgeNumber = 10;
async function isolatedStudent() {
  const number = ++edgeNumber;
  const user = await User.create({ email: `edge${number}@student.guc.edu.eg`, fullName: "Edge Student", passwordHash: "unused", role: "advisingStudent" });
  const profile = await StudentProfile.create({ user: user._id, studentId: `28-${10000 + number}`, studentType: "advising", advisingReason: "probation", major: "EDGE", currentSemester: 1, gpa: 0, academicStanding: "goodAcademicStanding" });
  const headers = { Authorization: `Bearer ${generateToken(user)}` };
  return { user, profile, headers, get: path => fetch(`${base}/${profile._id}/${path}`, { headers }) };
}

test("equivalent uppercase ObjectIds retain ownership", async () => {
  assert.equal((await request("wallet", true, String(student._id).toUpperCase())).status, 200);
});

test("workbook role matrix: advisors/coordinators access records, administrators do not", async () => {
  for (const role of ["advisor", "coordinator", "administrator"]) {
    const user = await User.create({ email: `edge${role}@guc.edu.eg`, fullName: role, passwordHash: "unused", role });
    for (const path of ["history", "transcript?year=2025/2026", "transcript/download?year=2025/2026", "failed-courses", "wallet"]) {
      const allowed = role !== "administrator" && path !== "wallet";
      assert.equal((await fetch(`${base}/${student._id}/${path}`, { headers: { Authorization: `Bearer ${generateToken(user)}` } })).status, allowed ? 200 : 403);
    }
  }
});

test("empty records have usable consistent response shapes", async () => {
  const edge = await isolatedStudent();
  const history = await (await edge.get("history")).json();
  assert.equal(history.studentProfile.advisor, "Unassigned");
  assert.equal(history.studentProfile.completedHours, 0);
  assert.deepEqual(history.completedCourses, []);
  assert.deepEqual(history.currentCourses, []);
  assert.deepEqual(await (await staffRequest("failed-courses", edge.profile._id)).json(), []);
  const wallet = await (await edge.get("wallet")).json();
  assert.equal(wallet.balance, 0);
  assert.deepEqual(wallet.transactions, []);
  for (const path of ["transcript?year=2030/2031", "transcript/download?year=2030/2031"]) {
    assert.equal((await edge.get(path)).status, 404);
  }
});

test("wallet handles decimal money, all statuses and non-wallet payment kinds", async () => {
  const edge = await isolatedStudent();
  await FinancialTransaction.create([
    { kind: "walletTopUp", amount: 0.1, status: "succeeded" },
    { kind: "walletTopUp", amount: 0.2, status: "succeeded" },
    ...["pending", "failed", "cancelled"].map(status => ({ kind: "walletTopUp", amount: 500, status })),
    ...["gatewayPayment", "deferredCharge", "deferredChargeCancellation"].map(kind => ({ kind, amount: 100, status: "succeeded" })),
  ].map(tx => ({ ...tx, student: edge.profile._id })));
  const wallet = await (await edge.get("wallet")).json();
  assert.equal(wallet.balance, 0.3);
  assert.equal(wallet.currency, "EGP");
  assert.equal(wallet.transactions.length, 5);
  assert.equal(wallet.transactions[0].resultingBalance, 0.3);
});

test("retakes earn credits once, and inactive or unrelated courses are excluded", async () => {
  const edge = await isolatedStudent();
  const term = await AcademicTerm.findOne();
  const passed = await Course.create({ code: "EDGE-P", name: "Passed twice", creditHours: 3, courseType: "core", facultyMajors: ["EDGE"] });
  await CourseAttempt.create([1, 2].map(attemptNumber => ({ student: edge.profile._id, course: passed._id, term: term._id, attemptNumber, attendance: "attended", result: "passed", grade: "A" })));
  await Course.create([
    { code: "EDGE-I", name: "Inactive", isActive: false, facultyMajors: ["EDGE"] },
    { code: "EDGE-U", name: "Unrelated", facultyMajors: ["OTHER"] },
    { code: "EDGE-R", name: "Still required", facultyMajors: ["EDGE"] },
  ].map(course => ({ ...course, creditHours: 3, courseType: "core" })));
  const history = await (await edge.get("history")).json();
  assert.equal(history.studentProfile.completedHours, 3);
  assert.deepEqual(history.remainingCourses.map(c => c.name), ["Still required"]);
});

test("transcript separates all five seasons, academic years and orphan term references", async () => {
  const edge = await isolatedStudent();
  const existing = (await AcademicTerm.findOne()).toObject();
  const seasons = ["winter", "spring", "summer", "firstMakeup", "secondMakeup"];
  const course = await Course.findOne();
  for (const [index, season] of seasons.entries()) {
    const term = await AcademicTerm.create({ ...existing, _id: new mongoose.Types.ObjectId(), code: `EDGE-${season}`, academicYear: "2024/2025", season });
    await CourseAttempt.create({ student: edge.profile._id, course: course._id, term: term._id, attendance: "attended", result: "passed", grade: "A", attemptNumber: index + 1 });
  }
  const absentCourse = await Course.create({ code: 'EDGE-ABS', name: 'Unattended course', creditHours: 3, courseType: 'core' });
  await CourseAttempt.create({ student: edge.profile._id, course: absentCourse._id, term: new mongoose.Types.ObjectId(), attendance: "unattended", result: "failed", grade: "F", attemptNumber: 7 });
  const transcript = await (await edge.get("transcript?year=2024/2025")).json();
  for (const season of seasons) assert.equal(transcript.terms[season].length, 1);
  assert.equal((await edge.get("transcript?year=2025/2026")).status, 404);
  const failed = await (await staffRequest("failed-courses", edge.profile._id)).json();
  assert.equal(failed.length, 1);
  assert.equal(failed[0].term, null);
  assert.deepEqual((await (await edge.get('transcript/years')).json()).academicYears, ['2024/2025']);
  for (const suffix of ["", "?year=bad", "?year=2024&year=2025", "?year[$ne]=x", "?year=%0D%0Aevil"]) {
    for (const path of ["transcript", "transcript/download"]) assert.equal((await edge.get(path + suffix)).status, 400);
  }
});

test("normal students and staff cannot view wallets, and missing profiles do not invent data", async () => {
  const edge = await isolatedStudent();
  edge.user.role = 'normalStudent';
  await edge.user.save();
  for (const path of ['history', 'transcript?year=2025/2026', 'transcript/download?year=2025/2026', 'transcript/years', 'failed-courses', 'wallet']) {
    assert.equal((await edge.get(path)).status, 403);
  }
  await StudentProfile.deleteOne({ _id: edge.profile._id });
  const origin = base.split('/api/identity/students')[0];
  assert.equal((await fetch(`${origin}/api/profile`, { headers: edge.headers })).status, 404);
  assert.equal((await staffRequest('history', edge.profile._id)).status, 404);
});

test("mandatory candidates honor only approved removals in the selected term", async () => {
  const edge = await isolatedStudent();
  const term = await AcademicTerm.findOne({ code: 'W25' });
  const advisor = await User.findOne({ role: 'advisor' });
  const courses = await Course.create(['Approved', 'Pending', 'Rejected', 'Unattended'].map((name, i) => ({ code: `REMOVE${i}`, name, creditHours: 3, courseType: 'core' })));
  await CourseAttempt.create(courses.map((course, i) => ({ student: edge.profile._id, course: course._id, term: term._id, attendance: i === 3 ? 'unattended' : 'attended', result: i === 3 ? 'current' : 'failed', grade: i === 3 ? undefined : 'F' })));
  await MandatoryCourseRemovalRequest.create(courses.slice(0, 3).map((course, i) => ({ student: edge.profile._id, course: course._id, advisor: advisor._id, term: term._id, reason: 'other', explanation: 'Test removal', status: ['approved', 'pending', 'rejected'][i] })));
  const response = await staffRequest(`failed-courses?term=${term._id}`, edge.profile._id);
  assert.equal(response.status, 200);
  const candidates = await response.json();
  assert.deepEqual(candidates.map(a => a.course.name).sort(), ['Pending', 'Rejected', 'Unattended']);
  assert.ok(candidates.every(a => a.isMandatory));
  assert.equal((await staffRequest('failed-courses?term=bad', edge.profile._id)).status, 400);
  assert.equal((await staffRequest(`failed-courses?term=${new mongoose.Types.ObjectId()}`, edge.profile._id)).status, 404);
  const otherTerm = await AcademicTerm.findOne({ code: 'EDGE-spring' });
  assert.equal((await (await staffRequest(`failed-courses?term=${otherTerm._id}`, edge.profile._id)).json()).length, 4);
});

test("wallet history includes dates, links, debit/credit direction and running balances", async () => {
  const edge = await isolatedStudent();
  const relatedRequest = new mongoose.Types.ObjectId();
  const payment = await FinancialTransaction.create({ student: edge.profile._id, kind: 'walletTopUp', amount: 100, status: 'succeeded', occurredAt: '2026-01-01' });
  const debit = await FinancialTransaction.create({ student: edge.profile._id, kind: 'extraHoursWalletPayment', amount: 25.5, status: 'succeeded', occurredAt: '2026-01-02', extraHoursRequest: relatedRequest, transactionReference: 'EDGE-PAYMENT' });
  await FinancialTransaction.create({ student: edge.profile._id, kind: 'refund', amount: 10, status: 'succeeded', occurredAt: '2026-01-03', extraHoursRequest: relatedRequest, relatedTransaction: debit._id });
  const wallet = await (await edge.get('wallet')).json();
  assert.equal(wallet.balance, 84.5);
  assert.deepEqual(wallet.transactions.map(tx => tx.resultingBalance), [84.5, 74.5, 100]);
  assert.deepEqual(wallet.transactions.map(tx => tx.direction), ['credit', 'debit', 'credit']);
  assert.equal(wallet.transactions[0].relatedTransaction, String(debit._id));
  assert.equal(wallet.transactions[1].extraHoursRequest, String(relatedRequest));
  assert.equal(wallet.transactions[1].transactionReference, 'EDGE-PAYMENT');
  assert.equal(wallet.transactions[2].occurredAt, payment.occurredAt.toISOString());
});

test("concurrent first reads record one consistent notification timestamp", async () => {
  const edge = await isolatedStudent();
  const notification = await Notification.create({ recipient: edge.user._id, type: 'paymentUpdated', title: 'Concurrent read', message: 'Test' });
  const origin = base.split('/api/identity/students')[0];
  const results = await Promise.all(Array.from({ length: 12 }, () => fetch(`${origin}/api/notifications/${notification._id}/read`, { method: 'PATCH', headers: edge.headers }).then(r => r.json())));
  assert.ok(results.every(r => r.success));
  assert.equal(new Set(results.map(r => r.notification.readAt)).size, 1);
});

test("record database failures return sanitized errors", async (t) => {
  t.mock.method(CourseAttempt, 'find', () => { throw new Error('private-db-host-and-query'); });
  const response = await request('history');
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(await response.json()).includes('private-db-host'), false);
});

test("notification database failures do not expose private details", async (t) => {
  t.mock.method(Notification, 'find', () => { throw new Error('private-notifications-db'); });
  const origin = base.split('/api/identity/students')[0];
  const response = await fetch(`${origin}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(await response.json()).includes('private-notifications-db'), false);
});

test("mandatory candidates do not duplicate retakes or include successfully completed courses", async () => {
  const edge = await isolatedStudent();
  const term = await AcademicTerm.findOne({ code: 'W25' });
  const courses = await Course.create(['Resolved failure', 'Repeated failure'].map((name, i) => ({ code: `RETAKE-${i}`, name, creditHours: 3, courseType: 'core' })));
  await CourseAttempt.create([
    { course: courses[0]._id, result: 'failed', grade: 'F', attemptNumber: 1 },
    { course: courses[0]._id, result: 'passed', grade: 'A', attemptNumber: 2 },
    { course: courses[1]._id, result: 'failed', grade: 'F', attemptNumber: 1 },
    { course: courses[1]._id, result: 'failed', grade: 'F', attemptNumber: 2 },
  ].map(attempt => ({ ...attempt, student: edge.profile._id, term: term._id, attendance: 'attended' })));
  const candidates = await (await staffRequest(`failed-courses?term=${term._id}`, edge.profile._id)).json();
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].course.name, 'Repeated failure');
  assert.equal(candidates[0].attemptNumber, 2);
});

test("large transcript PDF finishes across multiple pages with every course result", async () => {
  const edge = await isolatedStudent();
  const term = await AcademicTerm.findOne({ code: 'W25' });
  const course = await Course.create({ code: 'PDF-LONG', name: 'A long course title for testing readable wrapped transcript rows without losing academic results', creditHours: 3, courseType: 'core' });
  await CourseAttempt.create(Array.from({ length: 150 }, (_, i) => ({ student: edge.profile._id, course: course._id, term: term._id, attendance: 'attended', result: 'passed', grade: `RESULT${String(i + 1).padStart(3, '0')}`, attemptNumber: i + 1 })));
  const response = await edge.get('transcript/download?year=2025/2026');
  assert.equal(response.status, 200);
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(data.subarray(0, 5).toString(), '%PDF-');
  assert.match(data.subarray(-20).toString(), /%%EOF/);
  assert.ok((data.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length > 1);
  if (process.env.GROUP_A_PDF_SAMPLE_PATH) await writeFile(process.env.GROUP_A_PDF_SAMPLE_PATH, data);
});

test("notifications reject invalid IDs, preserve read timestamps and return empty lists", async () => {
  const edge = await isolatedStudent();
  const origin = base.split('/api/identity/students')[0];
  const url = `${origin}/api/notifications`;
  const empty = await (await fetch(url, { headers: edge.headers })).json();
  assert.equal(empty.count, 0);
  assert.deepEqual(empty.notifications, []);
  const update = id => fetch(`${url}/${id}/read`, { method: "PATCH", headers: edge.headers });
  assert.equal((await update("bad-id")).status, 400);
  assert.equal((await update(new mongoose.Types.ObjectId())).status, 404);
  const notification = await Notification.create({ recipient: edge.user._id, type: "paymentUpdated", title: "Read once", message: "Test" });
  assert.equal((await update(notification._id)).status, 200);
  const first = (await Notification.findById(notification._id)).readAt;
  await Promise.all(Array.from({ length: 5 }, () => update(notification._id)));
  assert.equal((await Notification.findById(notification._id)).readAt.getTime(), first.getTime());
});
