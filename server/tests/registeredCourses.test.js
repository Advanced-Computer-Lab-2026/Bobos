// Requirement 32 - registered courses, per-course and total credit hours.
import request from 'supertest';
import { connectTestDb, dropTestDb, clearCollections, buildFixture, tokenFor } from './helpers.js';
import app from '../src/app.js';
import { StudentSchedule } from '../src/models/StudentSchedule.js';
import { NO_VISIBLE_SCHEDULE } from '../src/utils/scheduleAccess.js';
import { buildRegisteredCourses } from '../src/utils/registeredCourses.js';

describe('buildRegisteredCourses (pure)', () => {
  test('empty / missing entries -> no courses, total 0', () => {
    expect(buildRegisteredCourses([])).toEqual({ courses: [], totalCreditHours: 0, courseCount: 0 });
    expect(buildRegisteredCourses(undefined)).toEqual({ courses: [], totalCreditHours: 0, courseCount: 0 });
  });

  test('sums credit hours, sorts by code, maps course -> courseId and courseType', () => {
    const types = new Map([['b', 'huma'], ['a', 'core']]);
    const out = buildRegisteredCourses(
      [
        { course: 'b', courseCode: 'SM 101', courseName: 'Scientific Methods', creditHours: 2, slots: [] },
        { course: { _id: 'a' }, courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6 },
        { course: 'x', courseCode: 'MATH 501', courseName: 'Math V', creditHours: 4 }
      ],
      types
    );
    expect(out.courses.map((c) => c.courseCode)).toEqual(['CSEN 501', 'MATH 501', 'SM 101']);
    expect(out.courses[0]).toEqual({ courseId: 'a', courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, courseType: 'core' });
    expect(out.courses[1].courseType).toBeNull(); // not in the catalogue map
    expect(out.totalCreditHours).toBe(12);
    expect(out.courseCount).toBe(3);
  });
});

let fx;
let advisingToken;

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await dropTestDb(); });
beforeEach(async () => {
  await clearCollections();
  fx = await buildFixture();
  advisingToken = tokenFor(fx.users.advisingUser);
});

function makeSchedule(student, status = 'processed') {
  const { dbOffering, mathOffering } = fx.offerings;
  return StudentSchedule.create({
    student: student._id, term: fx.term._id, studyGroup: '1', template: fx.templates.g1._id, status,
    entries: [
      // stored out of order on purpose: the response must be sorted by code
      { course: fx.courses.math501._id, courseCode: 'MATH 501', courseName: 'Mathematics V (Discrete Math)', creditHours: 4, offering: mathOffering._id, slots: [] },
      { course: fx.courses.csen501._id, courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, offering: dbOffering._id, slots: [] }
    ],
    assignedAt: new Date()
  });
}

const PATH = '/api/schedules/me/courses';
const get = (path, token) => {
  const req = request(app).get(path);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('GET /api/schedules/me/courses', () => {
  test('401 without a token', async () => {
    expect((await get(PATH)).status).toBe(401);
  });

  test('normal student with a processed schedule sees courses, credit hours and the total', async () => {
    await makeSchedule(fx.students.normalStudent);
    const res = await get(PATH, fx.tokens.student);
    expect(res.status).toBe(200);
    expect(res.body.term).toMatchObject({ academicYear: '2026/2027', season: 'Winter' });
    expect(res.body.student).toMatchObject({ studentId: '52-0001', studentType: 'normal', fullName: 'Normal Student', major: 'CS', currentSemester: 5 });
    expect(res.body.status).toBe('processed');
    expect(res.body.studyGroup).toBe('1');
    expect(res.body.courses).toEqual([
      { courseId: String(fx.courses.csen501._id), courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, courseType: 'core' },
      { courseId: String(fx.courses.math501._id), courseCode: 'MATH 501', courseName: 'Mathematics V (Discrete Math)', creditHours: 4, courseType: 'core' }
    ]);
    expect(res.body.totalCreditHours).toBe(10);
    expect(res.body.totalCreditHours).toBe(res.body.courses.reduce((s, c) => s + c.creditHours, 0));
    expect(res.body.courseCount).toBe(2);
  });

  test('advising student: processed and ready_for_student_review visible', async () => {
    const schedule = await makeSchedule(fx.students.advisingStudent, 'processed');
    let res = await get(PATH, advisingToken);
    expect(res.status).toBe(200);
    expect(res.body.totalCreditHours).toBe(10);

    schedule.status = 'ready_for_student_review';
    await schedule.save();
    res = await get(PATH, advisingToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready_for_student_review');
  });

  test('advising draft -> 404 with exactly the "no schedule" body', async () => {
    const noSchedule = await get(PATH, advisingToken);
    expect(noSchedule.status).toBe(404);

    await makeSchedule(fx.students.advisingStudent, 'draft');
    const draft = await get(PATH, advisingToken);
    expect(draft.status).toBe(404);
    expect(draft.body).toEqual(noSchedule.body);
    expect(draft.body).toEqual({ message: NO_VISIBLE_SCHEDULE });
  });

  test('normal student with no schedule -> 404', async () => {
    const res = await get(PATH, fx.tokens.student);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: NO_VISIBLE_SCHEDULE });
  });

  test('staff roles get 403', async () => {
    for (const role of ['advisor', 'coordinator', 'administrator']) {
      expect((await get(PATH, fx.tokens[role])).status).toBe(403);
    }
  });

  test('invalid termId -> 400', async () => {
    await makeSchedule(fx.students.normalStudent);
    const res = await get(`${PATH}?termId=not-an-id`, fx.tokens.student);
    expect(res.status).toBe(400);
  });
});
