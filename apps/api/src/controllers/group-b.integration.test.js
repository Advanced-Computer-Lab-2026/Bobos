import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { SMTPServer } from 'smtp-server';
import app from '../app.js';
import { AdvisorAssignment, StudentProfile, User } from '../models/index.js';
import { AcademicTerm, Course } from '../models/catalogue.js';
import { StudentSchedule, StudentWorkflowState } from '../models/academics.js';
import { ExtraHoursRequest, MandatoryCourseRemovalRequest, SlotChangeRequest, WholeScheduleSwapRequest } from '../models/requests.js';
import { ScheduleActivity } from '../models/communications.js';
import { generateToken } from '../middleware/auth.middleware.js';

let database;
let server;
let smtp;
let base;
let users;
let profiles;
const mailMessages = [];

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  await Promise.all([
    User.init(), StudentProfile.init(), AdvisorAssignment.init(), AcademicTerm.init(),
    StudentSchedule.init(), StudentWorkflowState.init(), WholeScheduleSwapRequest.init(), SlotChangeRequest.init(),
    ScheduleActivity.init(), MandatoryCourseRemovalRequest.init(), ExtraHoursRequest.init(), Course.init(),
  ]);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ['AUTH', 'STARTTLS'],
    disableReverseLookup: true,
    onData(stream, _session, callback) {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        mailMessages.push(Buffer.concat(chunks).toString());
        callback();
      });
    },
  });
  await new Promise((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(0, '127.0.0.1', resolve);
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (smtp) await new Promise((resolve) => smtp.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function call(path, { role, method = 'GET', body } = {}) {
  const headers = {};
  if (role) headers.Authorization = `Bearer ${generateToken(users[role])}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('Group B directory and advisor APIs enforce roles, filters, and assignment history', async () => {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_FROM;
  users = {};
  for (const role of ['normalStudent', 'advisingStudent', 'advisor', 'secondAdvisor', 'coordinator', 'administrator']) {
    const actualRole = role === 'secondAdvisor' ? 'advisor' : role;
    const domain = ['normalStudent', 'advisingStudent'].includes(actualRole) ? 'student.guc.edu.eg' : 'guc.edu.eg';
    users[role] = await User.create({
      email: `${role.toLowerCase()}@${domain}`,
      fullName: `${role} Account`,
      passwordHash: 'not-used',
      role: actualRole,
    });
  }
  profiles = {};
  profiles.normal = await StudentProfile.create({
    user: users.normalStudent._id,
    studentId: '28-10001',
    studentType: 'normal',
    major: 'DMET',
    currentSemester: 3,
    gpa: 3,
    academicStanding: 'goodAcademicStanding',
  });
  profiles.advising = await StudentProfile.create({
    user: users.advisingStudent._id,
    studentId: '28-10002',
    studentType: 'advising',
    advisingReason: 'probation',
    major: 'CS',
    currentSemester: 4,
    gpa: 2,
    academicStanding: 'probation',
  });
  const term = await AcademicTerm.create({
    code: 'GB26',
    academicYear: '2026/2027',
    season: 'winter',
    termStart: new Date('2026-10-01'),
    termEnd: new Date('2027-02-01'),
    teachingStart: new Date('2026-10-05'),
    teachingEnd: new Date('2027-01-20'),
    registrationStart: new Date('2026-09-01'),
    registrationEnd: new Date('2026-10-10'),
    advisingDeadline: new Date('2026-10-15'),
    wholeScheduleSwapDeadline: new Date('2026-10-20'),
    isActive: true,
  });

  assert.equal((await call('/admin/students')).status, 401);
  assert.equal((await call('/admin/students', { role: 'advisor' })).status, 403);
  const initialDirectory = await call('/admin/students', { role: 'coordinator' });
  assert.equal(initialDirectory.body.students.length, 2);
  assert.deepEqual(new Set(initialDirectory.body.students.map((student) => student.studentType)), new Set(['normal', 'advising']));
  const unstarted = initialDirectory.body.students.find((student) => student.studentId === '28-10002');
  assert.equal(unstarted.workflowStatus, 'notStarted');
  assert.equal(unstarted.blockingStep, 'Create advising schedule');
  const studentDetails = await call(`/admin/students/${profiles.normal._id}`, { role: 'administrator' });
  assert.equal(studentDetails.status, 200);
  assert.equal(studentDetails.body.studentId, '28-10001');
  assert.equal(studentDetails.body.user.fullName, 'normalStudent Account');
  const directory = await call('/admin/students?studentType=advising&major=CS', { role: 'coordinator' });
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.body.students.map((student) => student.studentId), ['28-10002']);
  assert.equal((await call('/admin/students?search=.*', { role: 'coordinator' })).body.students.length, 0);
  for (const search of ['28-10001', 'normalStudent Account', 'normalstudent@student.guc.edu.eg']) {
    const result = await call(`/admin/students?search=${encodeURIComponent(search)}`, { role: 'coordinator' });
    assert.deepEqual(result.body.students.map((student) => student.studentId), ['28-10001']);
  }

  const normalSchedule = await StudentSchedule.create({
    student: profiles.normal._id,
    term: term._id,
    scheduleType: 'normal',
    status: 'processed',
    createdBy: users.coordinator._id,
    processedBy: users.coordinator._id,
    processedAt: new Date(),
  });
  const advisingSchedule = await StudentSchedule.create({
    student: profiles.advising._id,
    term: term._id,
    scheduleType: 'advising',
    status: 'draft',
    createdBy: users.coordinator._id,
  });
  await StudentWorkflowState.create([
    { student: profiles.normal._id, term: term._id, studentType: 'normal', status: 'swapCompleted', blockingStep: 'seeded-step', lastActivityAt: new Date('2000-01-01') },
    { student: profiles.advising._id, term: term._id, studentType: 'advising', status: 'processed', lastActivityAt: new Date('2000-01-01') },
  ]);
  const currentStatuses = await call('/admin/students', { role: 'coordinator' });
  const normalStatus = currentStatuses.body.students.find((student) => student.studentId === '28-10001');
  const advisingStatus = currentStatuses.body.students.find((student) => student.studentId === '28-10002');
  assert.equal(normalStatus.workflowStatus, 'scheduleAssigned');
  assert.equal(normalStatus.lastUpdatedAt, normalSchedule.updatedAt.toISOString());
  assert.equal(normalStatus.blockingStep, null);
  assert.equal(advisingStatus.workflowStatus, 'draft');
  assert.equal(advisingStatus.blockingStep, 'Complete draft schedule');
  assert.equal(advisingStatus.lastUpdatedAt, advisingSchedule.updatedAt.toISOString());
  assert.ok(currentStatuses.body.filters.blockingSteps.includes('Complete draft schedule'));
  assert.equal((await call('/admin/students?workflowStatus=draft', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  assert.equal((await call('/admin/students?blockingStep=Complete%20draft%20schedule', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  const reopenActivity = await ScheduleActivity.create({
    student: profiles.advising._id,
    term: term._id,
    schedule: advisingSchedule._id,
    action: 'reopened',
    scheduleVersion: advisingSchedule.version,
    actor: users.coordinator._id,
    actorName: users.coordinator.fullName,
    actorEmail: users.coordinator.email,
    actorRole: 'coordinator',
    reason: 'Correct a schedule issue',
  });
  const reopened = await call('/admin/students?workflowStatus=reopened', { role: 'coordinator' });
  assert.equal(reopened.body.students[0].workflowStatus, 'reopened');
  assert.equal(reopened.body.students[0].blockingStep, 'Complete reopened schedule');
  assert.equal(reopened.body.students[0].lastUpdatedAt, reopenActivity.occurredAt.toISOString());
  await ScheduleActivity.deleteMany({ student: profiles.advising._id });
  await StudentSchedule.updateOne({ _id: advisingSchedule._id }, { $set: { status: 'readyForStudentReview' } });
  assert.equal((await call('/admin/students?workflowStatus=readyForStudentReview', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  const course = await Course.create({ code: 'CSEN101', name: 'Intro to CS', creditHours: 3, courseType: 'core' });
  const slotChange = await SlotChangeRequest.create({
    student: profiles.advising._id,
    schedule: advisingSchedule._id,
    term: term._id,
    course: course._id,
    componentType: 'lecture',
    currentOffering: new mongoose.Types.ObjectId(),
    currentSlotGroupId: new mongoose.Types.ObjectId(),
  });
  const pendingSlotChange = await call('/admin/students?workflowStatus=changeRequestPending', { role: 'coordinator' });
  assert.equal(pendingSlotChange.body.students[0].studentId, '28-10002');
  assert.equal(pendingSlotChange.body.students[0].blockingStep, 'Resolve pending slot-change requests');
  await slotChange.deleteOne();
  await StudentSchedule.updateOne({ _id: advisingSchedule._id }, { $set: { status: 'processed' } });
  assert.equal((await call('/admin/students?workflowStatus=processed', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  await StudentSchedule.updateOne({ _id: advisingSchedule._id }, { $set: { status: 'draft' } });
  const pendingRemoval = await MandatoryCourseRemovalRequest.create({
    student: profiles.advising._id,
    course: course._id,
    advisor: users.advisor._id,
    term: term._id,
    reason: 'other',
    explanation: 'Awaiting review',
  });
  const pendingApproval = await call('/admin/students?workflowStatus=pendingApproval', { role: 'coordinator' });
  assert.equal(pendingApproval.body.students[0].workflowStatus, 'pendingApproval');
  assert.equal(pendingApproval.body.students[0].blockingStep, 'Resolve pending coordinator approval');
  assert.ok(pendingApproval.body.filters.blockingSteps.includes('Resolve pending coordinator approval'));
  await MandatoryCourseRemovalRequest.updateOne({ _id: pendingRemoval._id }, { $set: { status: 'approved' } });
  await StudentSchedule.updateOne({ _id: advisingSchedule._id }, { $set: { status: 'readyForStudentReview' } });
  assert.equal((await call('/admin/students?workflowStatus=readyToProcess', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  await pendingRemoval.deleteOne();
  const extraHours = await ExtraHoursRequest.create({
    student: profiles.advising._id,
    advisor: users.advisor._id,
    term: term._id,
    courses: [{ course: course._id, hours: 1, isRepeated: false, pricePerHour: 800, subtotal: 800 }],
    requestedHours: 1,
    totalCost: 800,
    eligibilitySnapshot: {
      standardAllowance: 34,
      hoursBeforeRequest: 10,
      hoursAfterRequest: 11,
      isProbation: false,
      graduatingWithinOneYear: false,
    },
    decisionStatus: 'approved',
  });
  const awaitingPayment = await call('/admin/students?workflowStatus=awaitingPaymentChoice', { role: 'coordinator' });
  assert.equal(awaitingPayment.body.students[0].blockingStep, 'Choose payment option');
  await ExtraHoursRequest.updateOne({ _id: extraHours._id }, { $set: { settlementStatus: 'deferred' } });
  assert.equal((await call('/admin/students?workflowStatus=deferredToNextInstallment', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  await ExtraHoursRequest.updateOne({ _id: extraHours._id }, { $set: { settlementStatus: 'paid' } });
  assert.equal((await call('/admin/students?workflowStatus=readyToProcess', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  await extraHours.deleteOne();

  const priorRemoval = await MandatoryCourseRemovalRequest.create({
    student: profiles.advising._id,
    course: course._id,
    advisor: users.advisor._id,
    term: term._id,
    reason: 'other',
    explanation: 'Resolved in an earlier schedule cycle',
    status: 'approved',
  });
  const oldDate = new Date('2000-01-01');
  await MandatoryCourseRemovalRequest.updateOne(
    { _id: priorRemoval._id },
    { $set: { createdAt: oldDate, updatedAt: oldDate } },
    { timestamps: false },
  );
  const currentCycleReopen = await ScheduleActivity.create({
    student: profiles.advising._id,
    term: term._id,
    schedule: advisingSchedule._id,
    action: 'reopened',
    scheduleVersion: advisingSchedule.version,
    actor: users.coordinator._id,
    actorName: users.coordinator.fullName,
    actorEmail: users.coordinator.email,
    actorRole: 'coordinator',
    reason: 'Start a new schedule cycle',
  });
  await StudentSchedule.updateOne({ _id: advisingSchedule._id }, { $set: { status: 'readyForStudentReview' } });
  assert.equal((await call('/admin/students?workflowStatus=readyForStudentReview', { role: 'coordinator' })).body.students[0].studentId, '28-10002');
  assert.equal((await call('/admin/students?workflowStatus=readyToProcess', { role: 'coordinator' })).body.students.length, 0);
  await currentCycleReopen.deleteOne();
  await priorRemoval.deleteOne();
  assert.equal((await call('/admin/students?blockingStep=seeded-step', { role: 'coordinator' })).body.students.length, 0);

  const swapRequest = await WholeScheduleSwapRequest.create({
    student: profiles.normal._id,
    term: term._id,
    currentSchedule: normalSchedule._id,
    currentGroup: '1',
    desiredGroups: ['2'],
    courseCodesSnapshot: ['CSEN101'],
    expiresAt: new Date(Date.now() + 60_000),
  });
  assert.equal((await call('/admin/students?workflowStatus=swapRequestOpen', { role: 'coordinator' })).body.students[0].studentId, '28-10001');
  await WholeScheduleSwapRequest.updateOne({ _id: swapRequest._id }, { $set: { status: 'completed' } });
  assert.equal((await call('/admin/students?workflowStatus=swapCompleted', { role: 'coordinator' })).body.students[0].studentId, '28-10001');
  await WholeScheduleSwapRequest.updateOne({ _id: swapRequest._id }, { $set: { status: 'withdrawn' } });
  assert.equal((await call('/admin/students?workflowStatus=swapWithdrawn', { role: 'coordinator' })).body.students[0].studentId, '28-10001');
  const expiredAt = new Date(Date.now() - 60_000);
  const scheduleBeforeExpiry = new Date(expiredAt.getTime() - 60_000);
  await StudentSchedule.updateOne({ _id: normalSchedule._id }, { $set: { updatedAt: scheduleBeforeExpiry } }, { timestamps: false });
  await WholeScheduleSwapRequest.updateOne({ _id: swapRequest._id }, { $set: { status: 'open', expiresAt: expiredAt } });
  const expired = await call('/admin/students?workflowStatus=swapExpired', { role: 'coordinator' });
  assert.equal(expired.body.students[0].studentId, '28-10001');
  assert.equal(expired.body.students[0].lastUpdatedAt, new Date(Math.max(scheduleBeforeExpiry.getTime(), expiredAt.getTime())).toISOString());
  const reassignedAt = new Date(Date.now() + 1000);
  await StudentSchedule.updateOne({ _id: normalSchedule._id }, { $set: { updatedAt: reassignedAt } }, { timestamps: false });
  assert.equal((await call('/admin/students?workflowStatus=scheduleAssigned', { role: 'coordinator' })).body.students[0].studentId, '28-10001');

  assert.equal((await call('/admin/students/not-an-id', { role: 'coordinator' })).status, 400);
  assert.equal((await call('/admin/advisors/lookup?email=bad', { role: 'coordinator' })).status, 400);
  assert.equal((await call('/admin/advisors/lookup?email=missing%40guc.edu.eg', { role: 'coordinator' })).status, 404);
  const advisorLookup = await call(`/admin/advisors/lookup?email=${encodeURIComponent(users.secondAdvisor.email)}`, { role: 'coordinator' });
  assert.equal(advisorLookup.status, 200);
  assert.equal(advisorLookup.body.isAdvisorInSystem, false);

  assert.equal((await call('/admin/advisors', { role: 'coordinator', method: 'POST', body: { email: users.advisor.email } })).status, 201);
  assert.equal((await call('/admin/advisors', { role: 'coordinator', method: 'POST', body: { email: users.secondAdvisor.email } })).status, 201);
  assert.equal((await call('/admin/advisors', { role: 'coordinator', method: 'POST', body: { email: users.secondAdvisor.email } })).status, 409);

  assert.equal((await call('/advisor/students', { role: 'normalStudent' })).status, 403);
  assert.equal((await call('/advisor/students?page=0', { role: 'advisor' })).status, 400);
  const advisingList = await call('/advisor/students?search=.*', { role: 'advisor' });
  assert.equal(advisingList.status, 200);
  assert.equal(advisingList.body.data.length, 0);
  assert.equal((await call('/advisor/my-advisor', { role: 'administrator' })).status, 403);
  assert.equal((await call('/advisor/students/invalid-id/advisor', {
    role: 'coordinator', method: 'PATCH', body: { advisorId: String(users.advisor._id) },
  })).status, 400);
  assert.equal((await call(`/advisor/students/${profiles.advising._id}/advisor`, {
    role: 'coordinator', method: 'PATCH', body: { advisorId: 'invalid-id' },
  })).status, 400);

  const forbiddenAssignment = await call(`/advisor/students/${profiles.advising._id}/advisor`, {
    role: 'normalStudent', method: 'PATCH', body: { advisorId: String(users.advisor._id) },
  });
  assert.equal(forbiddenAssignment.status, 403);
  const firstAssignment = await call(`/advisor/students/${profiles.advising._id}/advisor`, {
    role: 'coordinator', method: 'PATCH', body: { advisorId: String(users.advisor._id) },
  });
  assert.equal(firstAssignment.status, 200);
  assert.equal(String(firstAssignment.body.assignedAdvisor._id), String(users.advisor._id));
  const reassign = await call(`/advisor/students/${profiles.advising._id}/advisor`, {
    role: 'coordinator', method: 'PATCH', body: { advisorId: String(users.secondAdvisor._id) },
  });
  assert.equal(reassign.status, 200);
  await StudentSchedule.updateOne({ _id: advisingSchedule._id }, { $set: { status: 'draft' } });
  const combinedFilters = await call(`/admin/students?studentType=advising&advisor=${users.secondAdvisor._id}&major=CS&currentSemester=4&academicStanding=probation&workflowStatus=draft&accountStatus=active`, { role: 'coordinator' });
  assert.deepEqual(combinedFilters.body.students.map((student) => student.studentId), ['28-10002']);
  for (const [filter, expectedStudentId] of [
    ['studentType=normal', '28-10001'],
    ['advisor=' + users.secondAdvisor._id, '28-10002'],
    ['major=DMET', '28-10001'],
    ['currentSemester=3', '28-10001'],
    ['academicStanding=goodAcademicStanding', '28-10001'],
  ]) {
    const filtered = await call(`/admin/students?${filter}`, { role: 'coordinator' });
    assert.deepEqual(filtered.body.students.map((student) => student.studentId), [expectedStudentId], filter);
  }
  const assignmentHistory = await AdvisorAssignment.find({ student: profiles.advising._id }).sort({ createdAt: 1 });
  assert.equal(assignmentHistory.length, 2);
  assert.ok(assignmentHistory[0].endedAt);
  assert.equal(assignmentHistory[0].endedBy.toString(), users.coordinator._id.toString());
  assert.equal(assignmentHistory[1].endedAt, null);
  const repeatedAssignment = await call(`/advisor/students/${profiles.advising._id}/advisor`, {
    role: 'coordinator', method: 'PATCH', body: { advisorId: String(users.secondAdvisor._id) },
  });
  assert.equal(repeatedAssignment.status, 200);
  assert.equal(await AdvisorAssignment.countDocuments({ student: profiles.advising._id }), 2);

  const myAdvisor = await call('/advisor/my-advisor', { role: 'advisingStudent' });
  assert.equal(myAdvisor.status, 200);
  assert.equal(myAdvisor.body.email, users.secondAdvisor.email);
  assert.equal((await call(`/advisor/students/${profiles.normal._id}`, { role: 'coordinator' })).status, 404);

  const removedAdvisor = await call(`/admin/advisors/${encodeURIComponent(users.secondAdvisor.email)}`, { role: 'coordinator', method: 'DELETE' });
  assert.equal(removedAdvisor.status, 200);
  assert.equal(removedAdvisor.body.assignmentsEnded, 1);
  assert.equal(removedAdvisor.body.emailStatus, 'pending');
  assert.equal((await StudentProfile.findById(profiles.advising._id)).assignedAdvisor, null);

  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(smtp.server.address().port);
  process.env.SMTP_FROM = 'test-sender@guc.edu.eg';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_REQUIRE_TLS = 'false';
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  const delivered = await call('/admin/advisors', { role: 'coordinator', method: 'POST', body: { email: users.secondAdvisor.email } });
  assert.equal(delivered.status, 201);
  assert.equal(delivered.body.emailStatus, 'sent');
  assert.match(mailMessages[0], /You have been added to the advising system/);
  const deliveredRemoval = await call(`/admin/advisors/${encodeURIComponent(users.secondAdvisor.email)}`, { role: 'coordinator', method: 'DELETE' });
  assert.equal(deliveredRemoval.status, 200);
  assert.equal(deliveredRemoval.body.emailStatus, 'sent');
  assert.equal(mailMessages.length, 2);

  const deactivation = await call(`/admin/users/${users.normalStudent._id}/status`, {
    role: 'administrator', method: 'PATCH', body: { isActive: false },
  });
  assert.equal(deactivation.status, 200);
  assert.equal(deactivation.body.isActive, false);
  assert.equal((await call('/identity/profile', { role: 'normalStudent' })).status, 401);
  assert.equal((await call('/admin/students?search=28-10001&accountStatus=inactive', { role: 'coordinator' })).body.students.length, 1);
  assert.equal((await call('/admin/students?search=28-10001&accountStatus=active', { role: 'coordinator' })).body.students.length, 0);
  assert.deepEqual((await call('/admin/students?accountStatus=inactive', { role: 'coordinator' })).body.students.map((student) => student.studentId), ['28-10001']);
  assert.deepEqual((await call('/admin/students?accountStatus=active', { role: 'coordinator' })).body.students.map((student) => student.studentId), ['28-10002']);
  const reactivation = await call(`/admin/users/${users.normalStudent._id}/status`, {
    role: 'administrator', method: 'PATCH', body: { isActive: true },
  });
  assert.equal(reactivation.status, 200);
  assert.equal((await call('/identity/profile', { role: 'normalStudent' })).status, 401);
  assert.equal((await call(`/admin/users/${users.normalStudent._id}/status`, {
    role: 'coordinator', method: 'PATCH', body: { isActive: true },
  })).status, 403);
});
