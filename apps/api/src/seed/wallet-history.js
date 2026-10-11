import mongoose from 'mongoose';
import { AcademicTerm, Course, ExtraHoursRequest, FinancialTransaction, StudentProfile } from '../models/index.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI before seeding wallet history.');

let hostname;
try {
  hostname = new URL(uri).hostname.toLowerCase();
} catch {
  throw new Error('MONGODB_URI is not a valid MongoDB URL.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
  throw new Error('Wallet demo data can only be seeded in a local MongoDB database.');
}

const DEMO_STUDENT_ID = '26-54321';
const DEMO_MARKER = 'Wallet history demo request';

async function ensureRequest(student, term, courseCode, suffix) {
  const course = await Course.findOne({ code: courseCode }).lean();
  if (!course) throw new Error(`Course ${courseCode} is missing. Seed the curriculum first.`);
  if (!student.assignedAdvisor) throw new Error(`${DEMO_STUDENT_ID} needs an assigned advisor.`);

  const hours = Number(course.creditHours);
  const pricePerHour = 800;
  const totalCost = hours * pricePerHour;
  return ExtraHoursRequest.findOneAndUpdate(
    { student: student._id, term: term._id, decisionNote: `${DEMO_MARKER} ${suffix}` },
    { $setOnInsert: {
      student: student._id,
      advisor: student.assignedAdvisor,
      term: term._id,
      courses: [{ course: course._id, hours, isRepeated: false, pricePerHour, subtotal: totalCost }],
      requestedHours: hours,
      totalCost,
      currency: 'EGP',
      eligibilitySnapshot: {
        standardAllowance: 34,
        hoursBeforeRequest: 20,
        hoursAfterRequest: 20 + hours,
        isProbation: student.academicStanding === 'probation',
        graduatingWithinOneYear: false,
      },
      decisionStatus: 'approved',
      decisionNote: `${DEMO_MARKER} ${suffix}`,
      decidedBy: student.assignedAdvisor,
      decidedAt: new Date(`2026-02-${suffix === 'A' ? '02' : '15'}T10:00:00.000Z`),
      settlementStatus: 'refunded',
      settlementOption: 'wallet',
    } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
}

async function ensureTransaction(student, reference, fields) {
  return FinancialTransaction.findOneAndUpdate(
    { student: student._id, transactionReference: reference },
    { $setOnInsert: { student: student._id, transactionReference: reference, currency: 'EGP', status: 'succeeded', ...fields } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
}

async function seedWalletHistory() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000 });
  try {
    const [student, term] = await Promise.all([
      StudentProfile.findOne({ studentId: DEMO_STUDENT_ID, studentType: 'advising' }),
      AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 }),
    ]);
    if (!student) throw new Error(`Advising student ${DEMO_STUDENT_ID} is missing. Run the evaluation seed first.`);
    if (!term) throw new Error('An active academic term is required.');

    const [requestA, requestB] = await Promise.all([
      ensureRequest(student, term, 'CSEN301', 'A'),
      ensureRequest(student, term, 'CSEN202', 'B'),
    ]);
    const paymentA = await ensureTransaction(student, 'DEMO-LAYLA-EXTRA-PAYMENT-001', {
      kind: 'extraHoursWalletPayment', amount: requestA.totalCost, settlementOption: 'wallet', extraHoursRequest: requestA._id,
      occurredAt: new Date('2026-02-03T10:15:00.000Z'),
    });
    const paymentB = await ensureTransaction(student, 'DEMO-LAYLA-EXTRA-PAYMENT-002', {
      kind: 'extraHoursWalletPayment', amount: requestB.totalCost, settlementOption: 'wallet', extraHoursRequest: requestB._id,
      occurredAt: new Date('2026-02-16T12:30:00.000Z'),
    });
    await ensureTransaction(student, 'DEMO-LAYLA-WALLET-TOPUP-001', {
      kind: 'walletTopUp', amount: 5000, settlementOption: 'gateway', occurredAt: new Date('2026-01-20T08:45:00.000Z'),
    });
    await ensureTransaction(student, 'DEMO-LAYLA-REFUND-001', {
      kind: 'refund', amount: Math.round(Number(paymentA.amount) * 25) / 100,
      extraHoursRequest: requestA._id, relatedTransaction: paymentA._id,
      occurredAt: new Date('2026-02-10T14:00:00.000Z'),
    });
    await ensureTransaction(student, 'DEMO-LAYLA-REFUND-002', {
      kind: 'refund', amount: paymentB.amount,
      extraHoursRequest: requestB._id, relatedTransaction: paymentB._id,
      occurredAt: new Date('2026-02-20T11:10:00.000Z'),
    });
    await ensureTransaction(student, 'DEMO-LAYLA-WALLET-TOPUP-002', {
      kind: 'walletTopUp', amount: 750, settlementOption: 'gateway', occurredAt: new Date('2026-03-01T09:20:00.000Z'),
    });

    console.log(`Wallet demo history ready for ${DEMO_STUDENT_ID}: 2 payment debits, 2 refund credits, and 2 wallet top-ups. Existing transactions were preserved.`);
    console.log(`Demo active term: ${term.code}. Refund transaction is linked to payment ${paymentA.transactionReference} and its extra-hours request.`);
    console.log(`Second payment reference: ${paymentB.transactionReference}; the seeded requests are marked refunded and do not activate extra hours.`);
  } finally {
    await mongoose.disconnect();
  }
}

seedWalletHistory().catch((error) => {
  console.error(`Wallet history seed failed: ${error.message}`);
  process.exitCode = 1;
});
