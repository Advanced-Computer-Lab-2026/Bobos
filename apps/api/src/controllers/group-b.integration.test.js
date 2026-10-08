import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { SMTPServer } from 'smtp-server';
import app from '../app.js';
import { AdvisorAssignment, StudentProfile, User } from '../models/index.js';
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
  await Promise.all([User.init(), StudentProfile.init(), AdvisorAssignment.init()]);
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
    major: 'CS',
    currentSemester: 4,
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

  assert.equal((await call('/admin/students')).status, 401);
  assert.equal((await call('/admin/students', { role: 'advisor' })).status, 403);
  const directory = await call('/admin/students?studentType=advising&major=CS', { role: 'coordinator' });
  assert.equal(directory.status, 200);
  assert.deepEqual(directory.body.students.map((student) => student.studentId), ['28-10002']);
  assert.equal((await call('/admin/students?search=.*', { role: 'coordinator' })).body.students.length, 0);
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
  const reactivation = await call(`/admin/users/${users.normalStudent._id}/status`, {
    role: 'administrator', method: 'PATCH', body: { isActive: true },
  });
  assert.equal(reactivation.status, 200);
  assert.equal((await call('/identity/profile', { role: 'normalStudent' })).status, 401);
  assert.equal((await call(`/admin/users/${users.normalStudent._id}/status`, {
    role: 'coordinator', method: 'PATCH', body: { isActive: true },
  })).status, 403);
});
