import mongoose from "mongoose";
import { AcademicTerm, FinancialTransaction, Notification, StudentProfile, User } from "../models/index.js";

const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === "production" || !uri || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(uri).hostname)) {
  throw new Error("Use an explicit local development database for the Administrator preview.");
}

await mongoose.connect(uri);
try {
  const [term, administrator, layla, karim] = await Promise.all([
    AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 }),
    User.findOne({ email: "admin@guc.edu.eg", role: "administrator" }),
    StudentProfile.findOne({ studentId: "61-90001" }),
    StudentProfile.findOne({ studentId: "61-90002" }),
  ]);
  if (!term || !administrator || !layla || !karim) {
    throw new Error("Load the standard local portal accounts and active term first.");
  }

  const day = 86_400_000;
  const now = Date.now();
  const transactions = [
    [layla, "TUITION", "COMPLETED", 28_500, "Tuition installment", 4],
    [karim, "TUITION", "COMPLETED", 28_500, "Tuition installment", 3],
    [layla, "FEE", "FAILED", 450, "Transcript fee", 2],
    [layla, "FEE", "COMPLETED", 450, "Transcript fee", 1],
    [karim, "FEE", "COMPLETED", 300, "Student services fee", 0],
  ];
  for (const [index, [student, kind, status, amount, description, daysAgo]] of transactions.entries()) {
    const referenceNumber = `AP-${term.code}-${index + 1}`;
    const idempotencyKey = `admin-preview:${referenceNumber}`;
    if (await FinancialTransaction.exists({ idempotencyKey })) continue;
    await FinancialTransaction.create({
      idempotencyKey, referenceNumber, student: student._id, term: term._id, kind, status, amount,
      settlementOption: "gateway", occurredAt: new Date(now - daysAgo * day),
      lineItems: [{ description, amount, quantity: 1, rate: amount }],
    });
  }

  const notices = [
    ["advisingDeadlineReminder", "Advising deadline", "Check Academic terms for the advising and whole-schedule swap deadlines.", null],
    ["scheduleProcessed", "Schedule processing complete", "The processed timetable can be viewed in Student schedules.", new Date(now)],
    ["paymentUpdated", "Tuition installment received", "The installment and its line items are available in Financial records.", null],
  ];
  for (const [type, title, message, readAt] of notices) {
    const deduplicationKey = `admin-preview:${administrator.id}:${term.code}:${type}`;
    await Notification.updateOne({ deduplicationKey }, {
      $setOnInsert: { recipient: administrator._id, type, title, message, readAt, channels: ["inApp"], createdAt: new Date(now), updatedAt: new Date(now) },
    }, { upsert: true, runValidators: true, timestamps: false });
  }
  console.log("Administrator preview includes tuition and fee entries, plus read and unread inbox notices.");
} finally {
  await mongoose.disconnect();
}
