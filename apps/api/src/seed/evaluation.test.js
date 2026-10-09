import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AcademicTerm, Course, CourseOffering } from '../models/catalogue.js';
import { CourseAttempt, StudentSchedule } from '../models/academics.js';
import { StudentProfile, User } from '../models/identity.js';
import { FinancialTransaction } from '../models/finance.js';

let database;
let seedEvaluationData;
let previousMongoUri;

before(async () => {
  database = await MongoMemoryServer.create();
  previousMongoUri = process.env.MONGODB_URI;
  process.env.MONGODB_URI = database.getUri();
  ({ seedEvaluationData } = await import('./evaluation.js'));
});

after(async () => {
  await mongoose.disconnect();
  if (database) await database.stop();
  if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = previousMongoUri;
});

async function runQuietSeed() {
  const originalLog = console.log;
  console.log = () => {};
  try {
    await seedEvaluationData();
  } finally {
    console.log = originalLog;
  }
}

async function seededCounts() {
  await mongoose.connect(database.getUri());
  try {
    return {
      terms: await AcademicTerm.countDocuments(),
      courses: await Course.countDocuments(),
      offerings: await CourseOffering.countDocuments(),
      users: await User.countDocuments(),
      normalProfiles: await StudentProfile.countDocuments({ studentType: 'normal' }),
      advisingProfiles: await StudentProfile.countDocuments({ studentType: 'advising' }),
      attempts: await CourseAttempt.countDocuments(),
      processedNormalSchedules: await StudentSchedule.countDocuments({ scheduleType: 'normal', status: 'processed' }),
      evaluationWalletTransactions: await FinancialTransaction.countDocuments({ transactionReference: /^evaluation-/ }),
    };
  } finally {
    await mongoose.disconnect();
  }
}

test('evaluation seed creates demo records for every student flow and is idempotent', async () => {
  await runQuietSeed();
  const first = await seededCounts();

  await runQuietSeed();
  const second = await seededCounts();

  assert.deepEqual(second, first);
  await mongoose.connect(database.getUri());
  try {
    const normal = await User.findOne({ email: 'evaluation.normal@student.guc.edu.eg' });
    const normalProfile = await StudentProfile.findOne({ user: normal._id });
    const schedule = await StudentSchedule.findOne({ student: normalProfile._id }).lean();
    assert.equal(first.normalProfiles, 1);
    assert.equal(first.advisingProfiles, 10);
    assert.equal(first.attempts, 2);
    assert.equal(first.processedNormalSchedules, 1);
    assert.equal(first.evaluationWalletTransactions, 3);
    assert.equal(schedule.courses.length, 2);
    assert.equal(await CourseAttempt.countDocuments({ student: { $exists: true }, result: 'failed' }), 1);
  } finally {
    await mongoose.disconnect();
  }
});
