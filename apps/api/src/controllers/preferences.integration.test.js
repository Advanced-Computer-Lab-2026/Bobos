import assert from 'node:assert/strict';
import test, { before, beforeEach, after } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { User, StudentProfile } from '../models/identity.js';
import { AcademicTerm, Course, CourseOffering } from '../models/catalogue.js';
import { SchedulingPreference, StudentSchedule, CourseAttempt } from '../models/academics.js';
import { FinancialTransaction } from '../models/finance.js';
import { generateToken } from '../middleware/auth.middleware.js';

let database, server, origin, users, students, term, course, offering;
before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await SchedulingPreference.init();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}/api/identity/students`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});
beforeEach(async () => {
  await Promise.all([User, StudentProfile, AcademicTerm, Course, CourseOffering, SchedulingPreference, StudentSchedule, CourseAttempt, FinancialTransaction].map(model => model.deleteMany({})));
  users = {};
  for (const role of ['normalStudent', 'advisingStudent', 'advisor', 'coordinator', 'administrator', 'otherStudent', 'otherAdvisor']) {
    const actualRole = role === 'otherStudent' ? 'advisingStudent' : role === 'otherAdvisor' ? 'advisor' : role;
    const domain = ['normalStudent', 'advisingStudent'].includes(actualRole) ? 'student.guc.edu.eg' : 'guc.edu.eg';
    users[role] = await User.create({ email: `${role.toLowerCase()}@${domain}`, fullName: role, role: actualRole, passwordHash: 'unused' });
  }
  students = {};
  for (const [i, role] of ['normalStudent', 'advisingStudent', 'otherStudent'].entries()) {
    students[role] = await StudentProfile.create({ user: users[role]._id, studentId: `28-0010${i}`, studentType: role === 'normalStudent' ? 'normal' : 'advising', advisingReason: role === 'normalStudent' ? undefined : 'probation', currentSemester: 4, major: 'CS', gpa: 2, academicStanding: 'goodAcademicStanding', assignedAdvisor: users.advisor._id });
  }
  const day = n => new Date(Date.now() + n * 86400000);
  term = await AcademicTerm.create({ code: 'PREF26', academicYear: '2026/2027', season: 'winter', termStart: day(-10), termEnd: day(100), teachingStart: day(-5), teachingEnd: day(90), registrationStart: day(-20), registrationEnd: day(-11), advisingDeadline: day(2), wholeScheduleSwapDeadline: day(3), isActive: true });
  course = await Course.create({ code: 'PREF101', name: 'Databases', creditHours: 6, courseType: 'core', facultyMajors: ['CS'] });
  offering = await CourseOffering.create({ course: course._id, term: term._id, isPublished: true, instructors: [{ fullName: 'Professor' }], eligibleGroups: [{ major: 'CS', semester: 4 }], slots: [{ componentType: 'lecture', groupNumber: '1', day: 'Monday', startMinute: 540, endMinute: 600, room: 'C1', capacity: 1, assignedStudentCount: 1 }] });
});

async function request({ role = 'advisingStudent', student = students.advisingStudent, selectedTerm = term._id, body, method = body === undefined ? 'GET' : 'PUT', query } = {}) {
  const headers = {};
  if (role) headers.Authorization = `Bearer ${generateToken(users[role])}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const suffix = query ?? (selectedTerm === null ? '' : `?term=${selectedTerm}`);
  const response = await fetch(`${origin}/${student._id ?? student}/preferences${suffix}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const payload = () => ({
  preferredDays: [{ day: 'Wednesday', priority: 3 }, { day: 'Monday', priority: 1 }],
  avoidedDays: [{ day: 'Friday' }],
  preferredTimes: [{ startMinute: 540, endMinute: 720, priority: 2 }],
  avoidedTimes: [{ startMinute: 900, endMinute: 1440 }],
  preferredGroups: [{ course: String(course._id), componentType: 'lecture', groupNumber: '1', priority: 1 }],
  desiredDaysOff: [{ day: 'Saturday' }],
  note: '  Prefer mornings if feasible.  ',
});

test('57: save every preference category; staff see ranked latest data and update time', async () => {
  const saved = await request({ body: payload() });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.submitted, true);
  assert.equal(saved.body.advisoryOnly, true);
  assert.deepEqual(saved.body.preferences.preferredDays.map(day => day.day), ['Monday', 'Wednesday']);
  assert.equal(saved.body.preferences.avoidedDays[0].priority, 1);
  assert.equal(saved.body.preferences.note, 'Prefer mornings if feasible.');
  assert.equal(saved.body.preferences.preferredGroups[0].course.code, 'PREF101');
  assert.ok(Number.isFinite(Date.parse(saved.body.lastUpdatedAt)));
  for (const role of ['advisor', 'coordinator', 'otherAdvisor']) {
    const read = await request({ role });
    assert.equal(read.status, 200);
    assert.deepEqual(read.body.preferences, saved.body.preferences);
    assert.equal(read.body.lastUpdatedAt, saved.body.lastUpdatedAt);
  }
  const updated = await request({ body: { note: 'Latest replacement', preferredDays: [{ day: 'Tuesday' }] } });
  assert.equal(updated.body.preferences._id, saved.body.preferences._id);
  assert.equal(updated.body.preferences.note, 'Latest replacement');
  assert.deepEqual(updated.body.preferences.preferredGroups, []);
  assert.equal(await SchedulingPreference.countDocuments(), 1);
  const staffRead = await request({ role: 'coordinator' });
  assert.equal(staffRead.body.preferences.note, 'Latest replacement');
});

test('58: no preferences returns a successful null result and does not create a record', async () => {
  for (const role of ['advisor', 'coordinator', 'advisingStudent']) {
    const read = await request({ role });
    assert.equal(read.status, 200);
    assert.deepEqual(read.body, { success: true, submitted: false, advisoryOnly: true, preferences: null, lastUpdatedAt: null });
  }
  assert.equal(await SchedulingPreference.countDocuments(), 0);
});

test('57/58: role and ownership matrix covers both read and write', async (t) => {
  for (const role of ['normalStudent', 'advisingStudent', 'otherStudent', 'advisor', 'otherAdvisor', 'coordinator', 'administrator']) {
    await t.test(role, async () => {
      assert.equal((await request({ role, body: { note: role } })).status, role === 'advisingStudent' ? 200 : 403);
      const allowedRead = ['advisingStudent', 'advisor', 'otherAdvisor', 'coordinator'].includes(role);
      assert.equal((await request({ role })).status, allowedRead ? 200 : 403);
    });
  }
  assert.equal((await request({ role: null, body: {} })).status, 401);
  assert.equal((await request({ role: null })).status, 401);
  assert.equal((await request({ role: 'advisor', student: students.normalStudent })).status, 403);
  assert.equal((await request({ student: 'bad-id' })).status, 400);
  assert.equal((await request({ student: new mongoose.Types.ObjectId() })).status, 404);
  assert.equal((await request({ student: String(students.advisingStudent._id).toUpperCase(), body: {} })).status, 200);
});

test('57: expired deadline blocks creation and updates, but staff can read prior preferences', async () => {
  const saved = await request({ body: { note: 'Before deadline' } });
  await AcademicTerm.updateOne({ _id: term._id }, { $set: { advisingDeadline: new Date(Date.now() - 1) } });
  assert.equal((await request({ body: { note: 'Too late' } })).status, 403);
  assert.equal((await request({ role: 'otherStudent', student: students.otherStudent, body: {} })).status, 403);
  const read = await request({ role: 'advisor' });
  assert.equal(read.body.preferences.note, 'Before deadline');
  assert.equal(read.body.lastUpdatedAt, saved.body.lastUpdatedAt);
  assert.equal(await SchedulingPreference.countDocuments(), 1);
});

test('57: the exact deadline is closed', async (t) => {
  const deadline = term.advisingDeadline.getTime();
  t.mock.method(Date, 'now', () => deadline);
  assert.equal((await request({ body: {} })).status, 403);
  assert.equal(await SchedulingPreference.countDocuments(), 0);
});

test('57: a deadline changed during group validation is rechecked before writing', async (t) => {
  const originalFind = CourseOffering.find;
  t.mock.method(CourseOffering, 'find', function (...args) {
    const query = originalFind.apply(this, args);
    const originalLean = query.lean.bind(query);
    query.lean = async () => {
      const result = await originalLean();
      await AcademicTerm.updateOne({ _id: term._id }, { $set: { advisingDeadline: new Date(Date.now() - 1) } });
      return result;
    };
    return query;
  });
  assert.equal((await request({ body: payload() })).status, 403);
  assert.equal(await SchedulingPreference.countDocuments(), 0);
});

test('57: an invalid stored deadline prevents a submission', async () => {
  await AcademicTerm.collection.updateOne({ _id: term._id }, { $unset: { advisingDeadline: '' } });
  assert.equal((await request({ body: {} })).status, 409);
  assert.equal(await SchedulingPreference.countDocuments(), 0);
});

test('term selection rejects invalid/unknown/ambiguous terms and defaults to one active term', async () => {
  assert.equal((await request({ selectedTerm: null, body: {} })).status, 200);
  assert.equal((await request({ selectedTerm: 'bad' })).status, 400);
  assert.equal((await request({ query: '?term[$ne]=x' })).status, 400);
  assert.equal((await request({ query: '?term=bad&term=bad' })).status, 400);
  assert.equal((await request({ selectedTerm: new mongoose.Types.ObjectId() })).status, 404);
  await AcademicTerm.updateOne({ _id: term._id }, { $set: { isActive: false } });
  assert.equal((await request({ selectedTerm: null })).status, 404);
  const second = await AcademicTerm.create({ ...term.toObject(), _id: new mongoose.Types.ObjectId(), code: 'OTHER26', academicYear: '2027/2028', isActive: true });
  await AcademicTerm.updateOne({ _id: term._id }, { $set: { isActive: true } });
  assert.equal((await request({ selectedTerm: null })).status, 409);
  assert.equal((await request({ selectedTerm: second._id, body: { note: 'Other term' } })).status, 200);
  assert.equal((await request()).body.preferences.note, '');
});

test('57: malformed fields, integer boundaries, duplicates and body tampering cannot write', async (t) => {
  const invalid = [null, [], 'text', { student: String(students.otherStudent._id) }, { term: String(term._id) },
    { preferredDays: null }, { preferredDays: 'Monday' }, { preferredDays: ['Monday'] },
    { preferredDays: [{ day: 'Funday' }] }, { preferredDays: [{ day: 'Monday', priority: 0 }] },
    { preferredDays: [{ day: 'Monday', priority: 1.5 }] }, { preferredDays: [{ day: 'Monday', priority: '1' }] },
    { preferredDays: [{ day: 'Monday', priority: null }] }, { preferredDays: [{ day: 'Monday', extra: true }] },
    { preferredDays: [{ day: 'Monday' }, { day: 'Monday' }] },
    { preferredTimes: [{ startMinute: -1, endMinute: 100 }] }, { preferredTimes: [{ startMinute: 100, endMinute: 100 }] },
    { preferredTimes: [{ startMinute: 100, endMinute: 1441 }] }, { preferredTimes: [{ startMinute: 1.5, endMinute: 100 }] },
    { preferredGroups: [{ course: { $ne: null }, componentType: 'lecture', groupNumber: '1' }] },
    { preferredGroups: [{ course: String(course._id), componentType: 'exam', groupNumber: '1' }] },
    { preferredGroups: [{ course: String(course._id), componentType: 'lecture', groupNumber: '' }] },
    { note: 123 }, { note: 'x'.repeat(1001) }, { $set: { note: 'Injected' } }];
  for (const [i, body] of invalid.entries()) await t.test(String(i + 1), async () => assert.equal((await request({ body })).status, 400));
  assert.equal(await SchedulingPreference.countDocuments(), 0);
  const valid = await request({ body: { preferredTimes: [{ startMinute: 0, endMinute: 1440 }], note: 'x'.repeat(1000) } });
  assert.equal(valid.status, 200);
  assert.equal((await request({ body: {} })).status, 200);
  assert.equal((await request()).body.preferences.note, '');
});

test('group hints must reference an actual published group in this term', async () => {
  for (const group of [{ course: String(new mongoose.Types.ObjectId()), componentType: 'lecture', groupNumber: '1' }, { course: String(course._id), componentType: 'lab', groupNumber: '1' }, { course: String(course._id), componentType: 'lecture', groupNumber: '99' }]) {
    assert.equal((await request({ body: { preferredGroups: [group] } })).status, 400);
  }
  await CourseOffering.updateOne({ _id: offering._id }, { $set: { isPublished: false } });
  assert.equal((await request({ body: payload() })).status, 400);
  assert.equal(await SchedulingPreference.countDocuments(), 0);
});

test('group hints reject inactive courses and offerings belonging to another term', async () => {
  await Course.updateOne({ _id: course._id }, { $set: { isActive: false } });
  assert.equal((await request({ body: payload() })).status, 400);
  await Course.updateOne({ _id: course._id }, { $set: { isActive: true } });
  const otherTerm = await AcademicTerm.create({ ...term.toObject(), _id: new mongoose.Types.ObjectId(), code: 'FUTURE26', academicYear: '2027/2028', isActive: false });
  assert.equal((await request({ selectedTerm: otherTerm._id, body: payload() })).status, 400);
  assert.equal(await SchedulingPreference.countDocuments(), 0);
});

test('read order is derived from priority even for older unsorted records; equal ranks are allowed', async () => {
  await SchedulingPreference.create({ student: students.advisingStudent._id, term: term._id, preferredDays: [{ day: 'Friday', priority: 3 }, { day: 'Monday', priority: 1 }] });
  assert.deepEqual((await request({ role: 'advisor' })).body.preferences.preferredDays.map(day => day.day), ['Monday', 'Friday']);
  const saved = await request({ body: { preferredDays: [{ day: 'Tuesday', priority: 1 }, { day: 'Wednesday', priority: 1 }] } });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.preferences.preferredDays.map(day => day.day), ['Tuesday', 'Wednesday']);
});

test('preferences never allocate full seats or mutate schedules, attempts or payments', async () => {
  const schedule = await StudentSchedule.create({ student: students.advisingStudent._id, term: term._id, scheduleType: 'advising', createdBy: users.advisor._id, courses: [{ course: course._id, courseOffering: offering._id, isMandatory: true, creditHoursSnapshot: 6, slots: [{ componentType: 'lecture', courseOffering: offering._id, slotGroupId: offering.slots[0]._id }] }] });
  const attempt = await CourseAttempt.create({ student: students.advisingStudent._id, course: course._id, term: term._id, attendance: 'attended', result: 'failed', grade: 'F' });
  const payment = await FinancialTransaction.create({ student: students.advisingStudent._id, kind: 'extraHoursWalletPayment', amount: 200, status: 'succeeded' });
  const before = (await CourseOffering.findById(offering._id)).toObject();
  assert.equal((await request({ body: payload() })).status, 200);
  const after = (await CourseOffering.findById(offering._id)).toObject();
  assert.deepEqual(after, before);
  for (const [model, record] of [[StudentSchedule, schedule], [CourseAttempt, attempt], [FinancialTransaction, payment]]) {
    assert.equal(await model.countDocuments(), 1);
    assert.deepEqual((await model.findById(record._id)).toObject(), record.toObject());
  }
});

test('inactive accounts cannot read or update preferences', async () => {
  await User.updateOne({ _id: users.advisingStudent._id }, { $set: { isActive: false } });
  assert.equal((await request()).status, 401);
  assert.equal((await request({ body: {} })).status, 401);
  assert.equal(await SchedulingPreference.countDocuments(), 0);
});

test('concurrent first submissions retain exactly one complete preference record', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => request({ body: { note: `Submission ${i}`, preferredDays: [{ day: i % 2 ? 'Monday' : 'Tuesday' }] } })));
  assert.ok(results.every(result => result.status === 200));
  assert.equal(await SchedulingPreference.countDocuments(), 1);
  const record = (await request({ role: 'advisor' })).body.preferences;
  const i = Number(record.note.split(' ')[1]);
  assert.equal(record.preferredDays[0].day, i % 2 ? 'Monday' : 'Tuesday');
});

test('storage failures return sanitized errors for reads and writes', async (t) => {
  t.mock.method(SchedulingPreference, 'findOne', () => { throw new Error('private-db-address'); });
  const read = await request({ role: 'advisor' });
  assert.equal(read.status, 500);
  assert.equal(JSON.stringify(read.body).includes('private-db-address'), false);
  t.mock.method(SchedulingPreference, 'findOneAndUpdate', () => { throw new Error('private-db-address'); });
  const write = await request({ body: {} });
  assert.equal(write.status, 500);
  assert.equal(JSON.stringify(write.body).includes('private-db-address'), false);
});
