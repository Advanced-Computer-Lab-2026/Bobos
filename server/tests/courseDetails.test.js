// Requirement 33 - a student selects a registered course and views its
// assigned lecture, tutorial and lab.
import request from 'supertest';
import mongoose from 'mongoose';
import { connectTestDb, dropTestDb, clearCollections, buildFixture, tokenFor } from './helpers.js';
import app from '../src/app.js';
import { StudentSchedule } from '../src/models/StudentSchedule.js';
import { Course } from '../src/models/Course.js';
import { NO_VISIBLE_SCHEDULE } from '../src/utils/scheduleAccess.js';
import { buildCourseDetails, findCourseEntry } from '../src/utils/courseDetails.js';

const NOT_MINE = { message: 'This course is not in your registered courses.' };

describe('buildCourseDetails (pure)', () => {
  const entry = {
    course: 'c1', courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, offering: 'o1',
    slots: [
      { slotId: 's3', type: 'lab', groupNumber: '1', day: 'Monday', startTime: '08:15', endTime: '10:00', room: 'Lab 1' },
      { slotId: 's2', type: 'tutorial', groupNumber: '1', day: 'Sunday', startTime: '10:15', endTime: '12:00', room: 'C7.1' },
      { slotId: 's1', type: 'lecture', groupNumber: '1', day: 'Sunday', startTime: '08:15', endTime: '10:00', room: 'H1' }
    ]
  };

  test('all three components, sessions sorted by day then start time, slotId dropped', () => {
    const out = buildCourseDetails(entry, { courseType: 'core', instructors: ['Dr. X'] });
    expect(out.course).toEqual({ courseId: 'c1', courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, courseType: 'core' });
    expect(out.instructors).toEqual(['Dr. X']);
    expect(out.components.lecture).toEqual({ type: 'lecture', groupNumber: '1', day: 'Sunday', startTime: '08:15', endTime: '10:00', room: 'H1' });
    expect(out.components.tutorial.room).toBe('C7.1');
    expect(out.components.lab.room).toBe('Lab 1');
    expect(out.sessions.map((s) => s.type)).toEqual(['lecture', 'tutorial', 'lab']);
  });

  test('missing component is null; no slots / no options are handled', () => {
    const noLab = { ...entry, slots: entry.slots.filter((s) => s.type !== 'lab') };
    const out = buildCourseDetails(noLab);
    expect(out.components.lab).toBeNull();
    expect(out.sessions).toHaveLength(2);
    expect(out.instructors).toEqual([]);
    expect(out.course.courseType).toBeNull();
    const empty = buildCourseDetails({ course: 'c', courseCode: 'X', slots: [] });
    expect(empty.components).toEqual({ lecture: null, tutorial: null, lab: null });
    expect(empty.sessions).toEqual([]);
  });

  test('two slots of one type: component is the first, sessions holds both', () => {
    const twoLectures = {
      ...entry,
      slots: [
        ...entry.slots,
        { type: 'lecture', groupNumber: '1', day: 'Saturday', startTime: '12:15', endTime: '14:00', room: 'H9' }
      ]
    };
    const out = buildCourseDetails(twoLectures);
    expect(out.components.lecture.room).toBe('H1');
    expect(out.sessions.filter((s) => s.type === 'lecture')).toHaveLength(2);
    expect(out.sessions[0].day).toBe('Saturday');
  });

  test('findCourseEntry matches raw or populated ids', () => {
    expect(findCourseEntry([{ course: 'a' }, { course: { _id: 'b' } }], 'b')).toEqual({ course: { _id: 'b' } });
    expect(findCourseEntry([{ course: 'a' }], 'z')).toBeNull();
    expect(findCourseEntry(undefined, 'z')).toBeNull();
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

// Snapshot of group 1 (as assignment writes it). `only` limits the courses.
function makeSchedule(student, status = 'processed', only = ['csen501', 'math501']) {
  const { dbOffering, mathOffering } = fx.offerings;
  const snap = (offering, type) => {
    const s = offering.slots.find((x) => x.type === type && x.groupNumber === '1');
    return { slotId: s._id, type, groupNumber: s.groupNumber, day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room };
  };
  const all = {
    csen501: {
      course: fx.courses.csen501._id, courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, offering: dbOffering._id,
      slots: [snap(dbOffering, 'lab'), snap(dbOffering, 'lecture'), snap(dbOffering, 'tutorial')]
    },
    math501: {
      course: fx.courses.math501._id, courseCode: 'MATH 501', courseName: 'Mathematics V (Discrete Math)', creditHours: 4, offering: mathOffering._id,
      slots: [snap(mathOffering, 'lecture'), snap(mathOffering, 'tutorial')]
    }
  };
  return StudentSchedule.create({
    student: student._id, term: fx.term._id, studyGroup: '1', template: fx.templates.g1._id, status,
    entries: only.map((k) => all[k]), assignedAt: new Date()
  });
}

const pathFor = (courseId) => `/api/schedules/me/courses/${courseId}`;
const get = (path, token) => {
  const req = request(app).get(path);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('GET /api/schedules/me/courses/:courseId', () => {
  test('401 without a token', async () => {
    expect((await get(pathFor(fx.courses.csen501._id))).status).toBe(401);
  });

  test('normal student, processed: lecture + tutorial + lab from the snapshot', async () => {
    await makeSchedule(fx.students.normalStudent);
    const res = await get(pathFor(fx.courses.csen501._id), fx.tokens.student);
    expect(res.status).toBe(200);
    expect(res.body.term).toMatchObject({ academicYear: '2026/2027', season: 'Winter' });
    expect(res.body.student).toMatchObject({ studentId: '52-0001', studentType: 'normal', fullName: 'Normal Student' });
    expect(res.body.status).toBe('processed');
    expect(res.body.studyGroup).toBe('1');
    expect(res.body.course).toEqual({
      courseId: String(fx.courses.csen501._id), courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, courseType: 'core'
    });
    expect(res.body.instructors).toEqual(['Dr. Test']);
    expect(res.body.components).toEqual({
      lecture: { type: 'lecture', groupNumber: '1', day: 'Saturday', startTime: '08:15', endTime: '10:00', room: 'H1' },
      tutorial: { type: 'tutorial', groupNumber: '1', day: 'Sunday', startTime: '08:15', endTime: '10:00', room: 'C7.1' },
      lab: { type: 'lab', groupNumber: '1', day: 'Monday', startTime: '08:15', endTime: '10:00', room: 'Lab 1' }
    });
    expect(res.body.sessions.map((s) => s.type)).toEqual(['lecture', 'tutorial', 'lab']);
  });

  test('values come from the snapshot, not the live offering', async () => {
    await makeSchedule(fx.students.normalStudent);
    const { dbOffering } = fx.offerings;
    dbOffering.slots.find((s) => s.type === 'lecture' && s.groupNumber === '1').room = 'MOVED';
    await dbOffering.save();
    const res = await get(pathFor(fx.courses.csen501._id), fx.tokens.student);
    expect(res.body.components.lecture.room).toBe('H1');
  });

  test('course without a lab -> lab: null and absent from sessions', async () => {
    await makeSchedule(fx.students.normalStudent);
    const res = await get(pathFor(fx.courses.math501._id), fx.tokens.student);
    expect(res.status).toBe(200);
    expect(res.body.components.lab).toBeNull();
    expect(res.body.components.lecture).toMatchObject({ day: 'Tuesday', room: 'H4' });
    expect(res.body.components.tutorial).toMatchObject({ day: 'Wednesday', room: 'C7.4' });
    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.sessions.some((s) => s.type === 'lab')).toBe(false);
  });

  test('advising student: processed and ready_for_student_review -> 200', async () => {
    const schedule = await makeSchedule(fx.students.advisingStudent, 'processed');
    expect((await get(pathFor(fx.courses.csen501._id), advisingToken)).status).toBe(200);
    schedule.status = 'ready_for_student_review';
    await schedule.save();
    const res = await get(pathFor(fx.courses.csen501._id), advisingToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready_for_student_review');
  });

  test('advising draft -> 404 identical to "no schedule"', async () => {
    const none = await get(pathFor(fx.courses.csen501._id), advisingToken);
    expect(none.status).toBe(404);
    await makeSchedule(fx.students.advisingStudent, 'draft');
    const draft = await get(pathFor(fx.courses.csen501._id), advisingToken);
    expect(draft.status).toBe(404);
    expect(draft.body).toEqual(none.body);
    expect(draft.body).toEqual({ message: NO_VISIBLE_SCHEDULE });
  });

  test('existing course not in my schedule, and unknown course id -> same neutral 404', async () => {
    await makeSchedule(fx.students.normalStudent, 'processed', ['csen501']);
    const other = await get(pathFor(fx.courses.math501._id), fx.tokens.student);
    expect(other.status).toBe(404);
    expect(other.body).toEqual(NOT_MINE);
    const unknown = await get(pathFor(new mongoose.Types.ObjectId()), fx.tokens.student);
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual(other.body);
  });

  test("a course in ANOTHER student's schedule but not mine -> 404", async () => {
    await makeSchedule(fx.students.normalStudent, 'processed', ['csen501']);
    await makeSchedule(fx.students.advisingStudent, 'processed', ['csen501', 'math501']);
    const res = await get(pathFor(fx.courses.math501._id), fx.tokens.student);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_MINE);
  });

  test('a catalogue course nobody is registered in -> 404', async () => {
    await makeSchedule(fx.students.normalStudent);
    const lonely = await Course.create({ code: 'CSEN 999', name: 'Unused', creditHours: 2, courseType: 'elective', major: 'ALL', recommendedSemester: 5 });
    const res = await get(pathFor(lonely._id), fx.tokens.student);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_MINE);
  });

  test('invalid courseId -> 400', async () => {
    await makeSchedule(fx.students.normalStudent);
    expect((await get(pathFor('not-an-id'), fx.tokens.student)).status).toBe(400);
  });

  test('invalid termId -> 400', async () => {
    await makeSchedule(fx.students.normalStudent);
    expect((await get(`${pathFor(fx.courses.csen501._id)}?termId=nope`, fx.tokens.student)).status).toBe(400);
  });

  test('staff roles get 403', async () => {
    await makeSchedule(fx.students.normalStudent);
    for (const role of ['advisor', 'coordinator', 'administrator']) {
      expect((await get(pathFor(fx.courses.csen501._id), fx.tokens[role])).status).toBe(403);
    }
  });
});
