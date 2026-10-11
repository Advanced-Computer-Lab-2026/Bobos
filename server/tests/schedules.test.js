// Requirement 31 - view a student's current weekly schedule (API).
import request from 'supertest';
import { connectTestDb, dropTestDb, clearCollections, buildFixture, tokenFor } from './helpers.js';
import app from '../src/app.js';
import { StudentSchedule } from '../src/models/StudentSchedule.js';

let fx;
let advisingToken;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await dropTestDb();
});

beforeEach(async () => {
  await clearCollections();
  fx = await buildFixture();
  advisingToken = tokenFor(fx.users.advisingUser);
});

// Group-1 snapshot of the fixture: CSEN 501 (lec Sat, tut Sun, lab Mon) and
// MATH 501 (lec Tue, tut Wed, NO lab).
function entriesForGroup1() {
  const { dbOffering, mathOffering } = fx.offerings;
  const pick = (offering, type) => {
    const s = offering.slots.find((x) => x.type === type && x.groupNumber === '1');
    return { slotId: s._id, type, groupNumber: '1', day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room };
  };
  return [
    {
      course: fx.courses.csen501._id, courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6,
      offering: dbOffering._id, slots: [pick(dbOffering, 'lab'), pick(dbOffering, 'lecture'), pick(dbOffering, 'tutorial')]
    },
    {
      course: fx.courses.math501._id, courseCode: 'MATH 501', courseName: 'Mathematics V (Discrete Math)', creditHours: 4,
      offering: mathOffering._id, slots: [pick(mathOffering, 'lecture'), pick(mathOffering, 'tutorial')]
    }
  ];
}

function makeSchedule(student, status = 'processed') {
  return StudentSchedule.create({
    student: student._id, term: fx.term._id, studyGroup: '1', template: fx.templates.g1._id,
    status, entries: entriesForGroup1(), assignedAt: new Date()
  });
}

const get = (path, token) => {
  const req = request(app).get(path);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('GET /api/schedules/me', () => {
  test('401 without a token', async () => {
    expect((await get('/api/schedules/me')).status).toBe(401);
  });

  test('normal student sees their own processed schedule with the full calendar', async () => {
    await makeSchedule(fx.students.normalStudent);
    const res = await get('/api/schedules/me', fx.tokens.student);

    expect(res.status).toBe(200);
    expect(res.body.readOnly).toBe(false);
    expect(res.body.term).toMatchObject({ academicYear: '2026/2027', season: 'Winter' });
    expect(res.body.student).toMatchObject({ studentId: '52-0001', studentType: 'normal', fullName: 'Normal Student' });
    const { schedule } = res.body;
    expect(schedule.status).toBe('processed');
    expect(schedule.studyGroup).toBe('1');
    expect(schedule.totalCreditHours).toBe(10);
    expect(schedule.courses.map((c) => c.courseCode)).toEqual(['CSEN 501', 'MATH 501']);
    // the null lab component of MATH 501 is simply absent
    expect(schedule.courses[1].slots.map((s) => s.type)).toEqual(['lecture', 'tutorial']);
    expect(schedule.courses[0].slots[0]).toMatchObject({ type: 'lecture', day: 'Saturday', startTime: '08:15', endTime: '10:00', room: 'H1' });
    expect(schedule.week.Saturday).toEqual([
      { courseCode: 'CSEN 501', courseName: 'Data Base I', type: 'lecture', groupNumber: '1', startTime: '08:15', endTime: '10:00', room: 'H1' }
    ]);
    expect(schedule.week.Tuesday[0]).toMatchObject({ courseCode: 'MATH 501', type: 'lecture', room: 'H4' });
    expect(schedule.week.Thursday).toEqual([]);
    expect(schedule.daysOff).toEqual(['Thursday', 'Friday']);
  });

  test('normal student with no schedule gets 404', async () => {
    const res = await get('/api/schedules/me', fx.tokens.student);
    expect(res.status).toBe(404);
  });

  test('advising student: draft hidden (404, no leak), review-ready and processed visible', async () => {
    const schedule = await makeSchedule(fx.students.advisingStudent, 'draft');
    let res = await get('/api/schedules/me', advisingToken);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'No schedule is available to view yet.' });
    expect(JSON.stringify(res.body)).not.toMatch(/draft/i);

    schedule.status = 'ready_for_student_review';
    await schedule.save();
    res = await get('/api/schedules/me', advisingToken);
    expect(res.status).toBe(200);
    expect(res.body.schedule.status).toBe('ready_for_student_review');

    schedule.status = 'processed';
    await schedule.save();
    res = await get('/api/schedules/me', advisingToken);
    expect(res.status).toBe(200);
    expect(res.body.schedule.status).toBe('processed');
  });

  test('staff get 403 pointing at the per-student endpoint', async () => {
    const res = await get('/api/schedules/me', fx.tokens.coordinator);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/\/api\/schedules\/student/);
  });
});

describe('GET /api/schedules/student/:studentId', () => {
  test("a student cannot view another student's schedule", async () => {
    await makeSchedule(fx.students.advisingStudent, 'processed');
    const res = await get(`/api/schedules/student/${fx.students.advisingStudent._id}`, fx.tokens.student);
    expect(res.status).toBe(403);
  });

  test('a student may use it for themselves (by XX-XXXX id)', async () => {
    await makeSchedule(fx.students.normalStudent);
    const res = await get('/api/schedules/student/52-0001', fx.tokens.student);
    expect(res.status).toBe(200);
  });

  test("advisor views an advising student's schedule in every status", async () => {
    const schedule = await makeSchedule(fx.students.advisingStudent, 'draft');
    for (const status of ['draft', 'ready_for_student_review', 'processed']) {
      schedule.status = status;
      await schedule.save();
      const res = await get(`/api/schedules/student/${fx.students.advisingStudent._id}`, fx.tokens.advisor);
      expect(res.status).toBe(200);
      expect(res.body.schedule.status).toBe(status);
      expect(res.body.readOnly).toBe(false);
    }
  });

  test("advisor cannot view a normal student's schedule", async () => {
    await makeSchedule(fx.students.normalStudent);
    const res = await get(`/api/schedules/student/${fx.students.normalStudent._id}`, fx.tokens.advisor);
    expect(res.status).toBe(403);
  });

  test('coordinator views any student, including drafts', async () => {
    await makeSchedule(fx.students.normalStudent);
    await makeSchedule(fx.students.advisingStudent, 'draft');
    expect((await get('/api/schedules/student/52-0001', fx.tokens.coordinator)).status).toBe(200);
    const res = await get('/api/schedules/student/49-0001', fx.tokens.coordinator);
    expect(res.status).toBe(200);
    expect(res.body.schedule.status).toBe('draft');
  });

  test('administrator views any student read-only', async () => {
    await makeSchedule(fx.students.advisingStudent, 'draft');
    const res = await get('/api/schedules/student/49-0001', fx.tokens.administrator);
    expect(res.status).toBe(200);
    expect(res.body.readOnly).toBe(true);
  });

  test('404 for an unknown student and for a student with no schedule', async () => {
    expect((await get('/api/schedules/student/99-9999', fx.tokens.coordinator)).status).toBe(404);
    const res = await get('/api/schedules/student/52-0001', fx.tokens.coordinator);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/schedules/students', () => {
  test('advisor sees only advising students; coordinator sees all with their status', async () => {
    await makeSchedule(fx.students.advisingStudent, 'draft');
    let res = await get('/api/schedules/students', fx.tokens.advisor);
    expect(res.status).toBe(200);
    expect(res.body.students.map((s) => s.studentId)).toEqual(['49-0001']);
    expect(res.body.students[0].scheduleStatus).toBe('draft');

    res = await get('/api/schedules/students?search=52-', fx.tokens.coordinator);
    expect(res.body.students.map((s) => s.studentId)).toEqual(['52-0001']);
    expect(res.body.students[0].scheduleStatus).toBeNull();
  });

  test('students are forbidden', async () => {
    expect((await get('/api/schedules/students', fx.tokens.student)).status).toBe(403);
  });
});
