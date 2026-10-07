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
import { generateToken } from "../middleware/auth.middleware.js";

let database, server, base, token, student, other;
before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  const user = await User.create({ email: "records@student.guc.edu.eg", fullName: "Records Student", passwordHash: "unused", role: "normalStudent" });
  const advisor = await User.create({ email: "advisor@guc.edu.eg", fullName: "Assigned Advisor", passwordHash: "unused", role: "advisor" });
  student = await StudentProfile.create({ user: user._id, studentId: "28-10001", studentType: "normal", major: "CS", currentSemester: 4, gpa: 2, academicStanding: "goodAcademicStanding", assignedAdvisor: advisor._id });
  other = new mongoose.Types.ObjectId();
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
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
});
test("failed courses and wallet report persisted records", async () => {
  assert.equal((await (await request("failed-courses")).json()).length, 1);
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
