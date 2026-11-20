import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { User, StudentProfile } from "../models/identity.js";
import { AcademicTerm } from "../models/catalogue.js";
import { FinancialTransaction } from "../models/finance.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { getWallet } from "../models/academics.js";

let database, server, base;
let adminUser, coordinatorUser, student1User, student2User, advisorUser, normalStudentUser;
let student1Profile, student2Profile;
let adminToken, coordinatorToken, student1Token, student2Token, advisorToken, normalToken;
let record1, record2, record3, record4;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());

  // 1. Create users
  adminUser = await User.create({
    email: "admin.finance@guc.edu.eg",
    fullName: "Finance Administrator",
    passwordHash: "not-used",
    role: "administrator",
  });
  coordinatorUser = await User.create({
    email: "coord.finance@guc.edu.eg",
    fullName: "Finance Coordinator",
    passwordHash: "not-used",
    role: "coordinator",
  });
  advisorUser = await User.create({
    email: "advisor.finance@guc.edu.eg",
    fullName: "Academic Advisor",
    passwordHash: "not-used",
    role: "advisor",
  });
  normalStudentUser = await User.create({
    email: "normal.finance@student.guc.edu.eg",
    fullName: "Normal Student",
    passwordHash: "not-used",
    role: "normalStudent",
  });
  student1User = await User.create({
    email: "alice.johnson@student.guc.edu.eg",
    fullName: "Alice Johnson",
    passwordHash: "not-used",
    role: "advisingStudent",
  });
  student2User = await User.create({
    email: "bob.smith@student.guc.edu.eg",
    fullName: "Bob Smith",
    passwordHash: "not-used",
    role: "advisingStudent",
  });

  // 2. Generate tokens
  adminToken = generateToken(adminUser);
  coordinatorToken = generateToken(coordinatorUser);
  advisorToken = generateToken(advisorUser);
  normalToken = generateToken(normalStudentUser);
  student1Token = generateToken(student1User);
  student2Token = generateToken(student2User);

  // 3. Create student profiles
  student1Profile = await StudentProfile.create({
    user: student1User._id,
    studentId: "28-11111",
    studentType: "advising",
    advisingReason: "probation",
    faculty: "MET",
    major: "CS",
    currentSemester: 5,
    gpa: 2.1,
    academicStanding: "probation",
  });

  student2Profile = await StudentProfile.create({
    user: student2User._id,
    studentId: "28-22222",
    studentType: "advising",
    advisingReason: "failedCourses",
    faculty: "IET",
    major: "Networks",
    currentSemester: 6,
    gpa: 2.4,
    academicStanding: "goodAcademicStanding",
  });

  // 4. Create terms
  const termDates = {
    termStart: "2025-09-01",
    termEnd: "2026-01-31",
    teachingStart: "2025-09-01",
    teachingEnd: "2026-01-01",
    registrationStart: "2025-08-01",
    registrationEnd: "2025-08-31",
    advisingDeadline: "2025-09-20",
    wholeScheduleSwapDeadline: "2025-09-25",
  };
  await AcademicTerm.create({ ...termDates, code: "W25", academicYear: "2025/2026", season: "winter" });
  await AcademicTerm.create({ ...termDates, code: "S26", academicYear: "2025/2026", season: "spring" });

  // 5. Create financial transactions
  record1 = await FinancialTransaction.create({
    student: student1Profile._id,
    type: "TUITION",
    kind: "TUITION",
    amount: 5000,
    currency: "EGP",
    status: "COMPLETED",
    term: "W25",
    referenceNumber: "REF-1001",
    receiptId: "REC-1001",
    lineItems: [{ description: "Semester Tuition", amount: 5000, quantity: 1 }],
    occurredAt: new Date("2025-09-10T10:00:00Z"),
  });

  record2 = await FinancialTransaction.create({
    student: student1Profile._id,
    type: "EXTRA_HOURS",
    kind: "extraHoursWalletPayment",
    amount: 1500,
    currency: "EGP",
    status: "COMPLETED",
    term: "W25",
    settlementOption: "wallet",
    referenceNumber: "REF-1002",
    receiptId: "REC-1002",
    lineItems: [{ description: "Extra Hours (3 credits)", amount: 1500, quantity: 3, rate: 500 }],
    occurredAt: new Date("2025-09-15T12:00:00Z"),
  });

  record3 = await FinancialTransaction.create({
    student: student2Profile._id,
    type: "FEE",
    kind: "FEE",
    amount: 300,
    currency: "EGP",
    status: "PENDING",
    term: "S26",
    referenceNumber: "REF-2001",
    receiptId: "REC-2001",
    lineItems: [{ description: "Lab Replacement Fee", amount: 300, quantity: 1 }],
    occurredAt: new Date("2026-02-01T09:00:00Z"),
  });

  record4 = await FinancialTransaction.create({
    student: student2Profile._id,
    type: "EXTRA_HOURS",
    kind: "deferredCharge",
    amount: 2000,
    currency: "EGP",
    status: "FAILED",
    term: "S26",
    settlementOption: "deferred",
    referenceNumber: "REF-2002",
    receiptId: "REC-2002",
    lineItems: [{ description: "Extra Hours Deferred", amount: 2000, quantity: 4, rate: 500 }],
    occurredAt: new Date("2026-02-05T14:00:00Z"),
  });

  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/finance`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

const req = (path, token, options = {}) => {
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  return fetch(`${base}${path}`, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
  });
};

// ==========================================
// Req 97: Advising student view own records
// ==========================================
test("Req 97: advising student can view only their own extra-hours and payment records", async () => {
  const res = await req("/records", student1Token);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(Array.isArray(data.records));
  assert.equal(data.total, 2);
  assert.equal(data.records.length, 2);
  assert.ok(data.records.every((r) => r.student.studentId === "28-11111"));

  // Check student 2 gets only student 2 records
  const res2 = await req("/records", student2Token);
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.total, 2);
  assert.ok(data2.records.every((r) => r.student.studentId === "28-22222"));
});

// ==========================================
// Req 98: Pagination & View financial ledger
// ==========================================
test("Req 97 & 98: coordinator and administrator can view paginated financial ledger", async () => {
  // Unauthenticated user is rejected
  const unauth = await req("/records");
  assert.equal(unauth.status, 401);

  // Unauthorized roles (normalStudent, advisor) are rejected
  const forbidden1 = await req("/records", normalToken);
  assert.equal(forbidden1.status, 403);
  const forbidden2 = await req("/records", advisorToken);
  assert.equal(forbidden2.status, 403);

  // Administrator can view all records with pagination
  const res = await req("/records?page=1&limit=2", adminToken);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.total, 4);
  assert.equal(data.page, 1);
  assert.equal(data.totalPages, 2);
  assert.equal(data.records.length, 2);

  // Page 2
  const page2 = await req("/records?page=2&limit=2", coordinatorToken);
  assert.equal(page2.status, 200);
  const dataPage2 = await page2.json();
  assert.equal(dataPage2.page, 2);
  assert.equal(dataPage2.records.length, 2);
  assert.notEqual(data.records[0]._id, dataPage2.records[0]._id);
});

// ==========================================
// Req 98: Multi-field search
// ==========================================
test("Req 98: multi-field search across student ID, name, receipt/transaction reference", async () => {
  // Search by Student ID substring
  const byStudentId = await (await req("/records?search=11111", adminToken)).json();
  assert.equal(byStudentId.total, 2);
  assert.ok(byStudentId.records.every((r) => r.student.studentId === "28-11111"));

  // Search by Student Name (case-insensitive substring)
  const byName = await (await req("/records?search=alice", adminToken)).json();
  assert.equal(byName.total, 2);
  assert.equal(byName.records[0].student.name, "Alice Johnson");

  const byName2 = await (await req("/records?search=smith", adminToken)).json();
  assert.equal(byName2.total, 2);
  assert.equal(byName2.records[0].student.name, "Bob Smith");

  // Search by Reference Number
  const byRef = await (await req("/records?search=REF-1002", adminToken)).json();
  assert.equal(byRef.total, 1);
  assert.equal(byRef.records[0].referenceNumber, "REF-1002");

  // Search by Receipt ID
  const byReceipt = await (await req("/records?search=REC-2001", adminToken)).json();
  assert.equal(byReceipt.total, 1);
  assert.equal(byReceipt.records[0].receiptId, "REC-2001");

  // Special regex characters in search should not crash the server
  const specialChars = await req("/records?search=[*+?^${}()", adminToken);
  assert.equal(specialChars.status, 200);
});

// ==========================================
// Req 99: Dynamic filtering
// ==========================================
test("Req 99: dynamic filtering by type, status, term, settlementOption, and date range", async () => {
  // Filter by type
  const tuitionOnly = await (await req("/records?type=TUITION", adminToken)).json();
  assert.equal(tuitionOnly.total, 1);
  assert.equal(tuitionOnly.records[0].type, "TUITION");

  const extraHoursOnly = await (await req("/records?type=EXTRA_HOURS", adminToken)).json();
  assert.equal(extraHoursOnly.total, 2);
  assert.ok(extraHoursOnly.records.every((r) => r.type === "EXTRA_HOURS"));

  // Filter by status
  const completedOnly = await (await req("/records?status=COMPLETED", adminToken)).json();
  assert.equal(completedOnly.total, 2);
  assert.ok(completedOnly.records.every((r) => ["COMPLETED", "succeeded"].includes(r.status)));

  const pendingOnly = await (await req("/records?status=PENDING", adminToken)).json();
  assert.equal(pendingOnly.total, 1);
  assert.equal(pendingOnly.records[0].status, "PENDING");

  // Filter by academic term
  const termW25 = await (await req("/records?term=W25", adminToken)).json();
  assert.equal(termW25.total, 2);

  // Filter by settlement option
  const walletOption = await (await req("/records?settlementOption=wallet", adminToken)).json();
  assert.equal(walletOption.total, 1);
  assert.equal(walletOption.records[0].settlementOption, "wallet");

  // Filter by date range
  const dateFiltered = await (await req("/records?startDate=2025-09-01&endDate=2025-09-30", adminToken)).json();
  assert.equal(dateFiltered.total, 2);

  // Combined filters: type + status + term
  const combined = await (await req("/records?type=EXTRA_HOURS&status=COMPLETED&term=W25", adminToken)).json();
  assert.equal(combined.total, 1);
  assert.equal(combined.records[0].referenceNumber, "REF-1002");
});

// ==========================================
// Req 100: Detailed record breakdown
// ==========================================
test("Req 100: get single record details with populated student and transactional metadata", async () => {
  const res = await req(`/${record1._id}`, adminToken);
  assert.equal(res.status, 200);
  const detail = await res.json();

  assert.equal(detail._id, String(record1._id));
  assert.equal(detail.amount, 5000);
  assert.equal(detail.status, "COMPLETED");
  assert.equal(detail.type, "TUITION");
  assert.equal(detail.referenceNumber, "REF-1001");
  assert.equal(detail.receiptId, "REC-1001");

  // Populated student details
  assert.equal(detail.student.studentId, "28-11111");
  assert.equal(detail.student.name, "Alice Johnson");
  assert.equal(detail.student.email, "alice.johnson@student.guc.edu.eg");
  assert.equal(detail.student.faculty, "MET");

  // Line items and timestamps
  assert.ok(Array.isArray(detail.lineItems));
  assert.equal(detail.lineItems.length, 1);
  assert.equal(detail.lineItems[0].description, "Semester Tuition");
  assert.ok(detail.timestamps.createdAt);

  // Advising student can view their own record details
  const ownDetail = await req(`/${record1._id}`, student1Token);
  assert.equal(ownDetail.status, 200);

  // Advising student CANNOT view another student's record details (403)
  const otherDetail = await req(`/${record3._id}`, student1Token);
  assert.equal(otherDetail.status, 403);

  // Non-existent record returns 404
  const notFound = await req(`/${new mongoose.Types.ObjectId()}`, adminToken);
  assert.equal(notFound.status, 404);

  // Malformed ID returns 404
  const malformed = await req("/invalid-object-id", adminToken);
  assert.equal(malformed.status, 404);
});

// ==========================================
// Req 101 & 102: Refund processing & validation
// ==========================================
test("Req 101 & 102: refund processing, balance update, audit log and duplicate prevention", async () => {
  // Verify initial wallet balance for student 1
  const initialWallet = await getWallet(student1Profile._id);
  const initialBalance = initialWallet.balance;

  // 1. Unauthorized roles cannot process refunds (403)
  const studentRefundAttempt = await req(`/${record1._id}/refund`, student1Token, { method: "POST" });
  assert.equal(studentRefundAttempt.status, 403);

  const advisorRefundAttempt = await req(`/${record1._id}/refund`, advisorToken, { method: "POST" });
  assert.equal(advisorRefundAttempt.status, 403);

  const normalRefundAttempt = await req(`/${record1._id}/refund`, normalToken, { method: "POST" });
  assert.equal(normalRefundAttempt.status, 403);

  // 2. Cannot refund a non-completed transaction (record 3 is PENDING, record 4 is FAILED)
  const pendingRefund = await req(`/${record3._id}/refund`, adminToken, { method: "POST" });
  assert.equal(pendingRefund.status, 400);
  assert.match((await pendingRefund.json()).message, /eligible/i);

  const failedRefund = await req(`/${record4._id}/refund`, coordinatorToken, { method: "POST" });
  assert.equal(failedRefund.status, 400);

  // 3. Successful refund by Administrator
  const refundRes = await req(`/${record1._id}/refund`, adminToken, {
    method: "POST",
    body: { reason: "Overpayment course dropped during add/drop period" },
  });
  assert.equal(refundRes.status, 200);
  const refundData = await refundRes.json();
  assert.equal(refundData.success, true);
  assert.equal(refundData.originalTransaction.status, "REFUNDED");
  assert.ok(refundData.refundRecord);
  assert.equal(refundData.refundRecord.amount, 5000);
  assert.equal(refundData.refundRecord.kind, "refund");

  // Verify original transaction in DB
  const updatedOriginal = await FinancialTransaction.findById(record1._id);
  assert.equal(updatedOriginal.status, "REFUNDED");
  assert.ok(updatedOriginal.refundedAt);
  assert.equal(String(updatedOriginal.refundedBy), String(adminUser._id));
  assert.equal(updatedOriginal.refundReason, "Overpayment course dropped during add/drop period");

  // Verify wallet balance atomically updated
  const updatedWallet = await getWallet(student1Profile._id);
  assert.equal(updatedWallet.balance, initialBalance + 5000);

  // 4. Duplicate refund attempt must be rejected with 400
  const duplicateRefund = await req(`/${record1._id}/refund`, coordinatorToken, { method: "POST" });
  assert.equal(duplicateRefund.status, 400);
  assert.match((await duplicateRefund.json()).message, /already been refunded/i);

  // 5. Refund on non-existent transaction returns 404
  const notFoundRefund = await req(`/${new mongoose.Types.ObjectId()}/refund`, adminToken, { method: "POST" });
  assert.equal(notFoundRefund.status, 404);
});

// ==========================================
// Req 127: Financial records export (CSV format)
// ==========================================
test("Req 127: export filtered financial records as CSV with attachment headers", async () => {
  // Unauthorized users cannot export
  const unauthExport = await req("/export");
  assert.equal(unauthExport.status, 401);

  const studentExport = await req("/export", student1Token);
  assert.equal(studentExport.status, 403);

  const advisorExport = await req("/export", advisorToken);
  assert.equal(advisorExport.status, 403);

  // Coordinator export
  const res = await req("/export", coordinatorToken);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.match(res.headers.get("content-disposition"), /attachment;\s*filename="financial_records\.csv"/);

  const csvText = await res.text();
  const lines = csvText.trim().split("\n");

  // Verify headers
  assert.equal(lines[0], "Transaction ID,Student ID,Student Name,Type,Amount,Status,Term,Date");

  // Verify content contains expected student records
  assert.ok(csvText.includes("28-11111"));
  assert.ok(csvText.includes("Alice Johnson"));
  assert.ok(csvText.includes("28-22222"));
  assert.ok(csvText.includes("Bob Smith"));

  // Filtered export (e.g. only TUITION or REFUND)
  const filteredExport = await req("/export?type=EXTRA_HOURS", adminToken);
  assert.equal(filteredExport.status, 200);
  const filteredCsv = await filteredExport.text();
  const filteredLines = filteredCsv.trim().split("\n");

  // Header + 2 EXTRA_HOURS records
  assert.equal(filteredLines.length, 3);
  assert.ok(filteredCsv.includes("REF-1002"));
  assert.ok(filteredCsv.includes("REF-2002"));
  assert.ok(!filteredCsv.includes("REF-2001")); // FEE record should be excluded
});
