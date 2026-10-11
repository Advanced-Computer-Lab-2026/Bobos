// Requirement 49 - download the processed schedule as a PDF (API + pure model).
import request from 'supertest';
import { connectTestDb, dropTestDb, clearCollections, buildFixture, tokenFor } from './helpers.js';
import app from '../src/app.js';
import { StudentSchedule } from '../src/models/StudentSchedule.js';
import { NO_VISIBLE_SCHEDULE } from '../src/utils/scheduleAccess.js';
import { buildWeeklyCalendar } from '../src/utils/weeklyCalendar.js';
import { buildPdfModel, renderSchedulePdf, scheduleFileName } from '../src/utils/schedulePdf.js';

let fx;
let advisingToken;

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await dropTestDb(); });
beforeEach(async () => {
  await clearCollections();
  fx = await buildFixture();
  advisingToken = tokenFor(fx.users.advisingUser);
});

function entriesForGroup1() {
  const { dbOffering, mathOffering } = fx.offerings;
  const pick = (offering, type) => {
    const s = offering.slots.find((x) => x.type === type && x.groupNumber === '1');
    return { slotId: s._id, type, groupNumber: '1', day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room };
  };
  return [
    {
      course: fx.courses.csen501._id, courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6,
      offering: dbOffering._id, slots: [pick(dbOffering, 'lecture'), pick(dbOffering, 'tutorial'), pick(dbOffering, 'lab')]
    },
    {
      course: fx.courses.math501._id, courseCode: 'MATH 501', courseName: 'Mathematics V (Discrete Math)', creditHours: 4,
      offering: mathOffering._id, slots: [pick(mathOffering, 'lecture'), pick(mathOffering, 'tutorial')]
    }
  ];
}

const makeSchedule = (student, status = 'processed') => StudentSchedule.create({
  student: student._id, term: fx.term._id, studyGroup: '1', template: fx.templates.g1._id,
  status, entries: entriesForGroup1(), assignedAt: new Date()
});

const binary = (res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

const download = (token, query = '') => {
  const req = request(app).get(`/api/schedules/me/download${query}`).buffer(true).parse(binary);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

const expectPdf = (res, fileName) => {
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/^application\/pdf/);
  expect(res.headers['content-disposition']).toBe(`attachment; filename="${fileName}"`);
  expect(Buffer.isBuffer(res.body)).toBe(true);
  expect(res.body.length).toBeGreaterThan(2000);
  expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  expect(res.body.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
};

describe('GET /api/schedules/me/download', () => {
  test('401 without a token', async () => {
    expect((await download(null)).status).toBe(401);
  });

  test('normal student with a processed schedule gets a PDF attachment', async () => {
    await makeSchedule(fx.students.normalStudent);
    expectPdf(await download(fx.tokens.student), 'schedule-52-0001-2026-2027-Winter.pdf');
  });

  test('advising student with a processed schedule gets a PDF', async () => {
    await makeSchedule(fx.students.advisingStudent);
    expectPdf(await download(advisingToken), 'schedule-49-0001-2026-2027-Winter.pdf');
  });

  test('advising ready_for_student_review -> 409 (viewable but not downloadable)', async () => {
    await makeSchedule(fx.students.advisingStudent, 'ready_for_student_review');
    const res = await download(advisingToken);
    expect(res.status).toBe(409);
    expect(JSON.parse(res.body.toString())).toEqual({
      message: 'Your schedule is not final yet. You can download it once it has been processed.'
    });
  });

  test('advising draft -> 404 identical to "no schedule" (draft never revealed)', async () => {
    const none = await download(advisingToken);
    await makeSchedule(fx.students.advisingStudent, 'draft');
    const draft = await download(advisingToken);
    expect(none.status).toBe(404);
    expect(draft.status).toBe(404);
    expect(draft.body.toString()).toBe(none.body.toString());
    expect(JSON.parse(draft.body.toString())).toEqual({ message: NO_VISIBLE_SCHEDULE });
  });

  test('normal student with no schedule -> 404', async () => {
    const res = await download(fx.tokens.student);
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body.toString())).toEqual({ message: NO_VISIBLE_SCHEDULE });
  });

  test('staff -> 403', async () => {
    for (const role of ['advisor', 'coordinator', 'administrator']) {
      expect((await download(fx.tokens[role])).status).toBe(403);
    }
  });

  test('invalid termId -> 400, unknown termId -> 404', async () => {
    await makeSchedule(fx.students.normalStudent);
    expect((await download(fx.tokens.student, '?termId=nope')).status).toBe(400);
    const unknown = await download(fx.tokens.student, '?termId=64b000000000000000000000');
    expect(unknown.status).toBe(404);
    expect(JSON.parse(unknown.body.toString()).message).toBe('Academic term not found');
  });

  test('explicit termId of the current term works', async () => {
    await makeSchedule(fx.students.normalStudent);
    expectPdf(await download(fx.tokens.student, `?termId=${fx.term._id}`), 'schedule-52-0001-2026-2027-Winter.pdf');
  });
});

describe('schedulePdf (pure)', () => {
  const student = {
    studentId: '52-0001', fullName: 'Normal Student', email: 'normal.student@student.guc.edu.eg',
    major: 'CS', currentSemester: 5, studentType: 'normal'
  };
  const term = { academicYear: '2026/2027', season: 'Winter' };

  test('the model carries the header, courses, credit hours, total and days off', () => {
    const entries = [
      { courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, slots: [
        { type: 'lecture', groupNumber: '1', day: 'Saturday', startTime: '08:15', endTime: '10:00', room: 'H1' },
        { type: 'lab', groupNumber: '1', day: 'Monday', startTime: '08:15', endTime: '10:00', room: 'Lab 1' }] },
      { courseCode: 'MATH 501', courseName: 'Discrete Math', creditHours: 4, slots: [
        { type: 'tutorial', groupNumber: '1', day: 'Wednesday', startTime: '10:15', endTime: '12:00', room: 'C7.4' }] }
    ];
    const model = buildPdfModel({ student, term, schedule: { status: 'processed', studyGroup: '1' }, calendar: buildWeeklyCalendar(entries) });
    const header = Object.fromEntries(model.header.map((h) => [h.label, h.value]));
    expect(header).toMatchObject({
      'Full name': 'Normal Student', 'Student ID': '52-0001', 'GUC email': 'normal.student@student.guc.edu.eg',
      Major: 'CS', Semester: '5', 'Academic term': 'Winter 2026/2027', 'Study group': '1', Status: 'Processed'
    });
    expect(model.title).toBe('Weekly Schedule');
    expect(model.fileName).toBe('schedule-52-0001-2026-2027-Winter.pdf');
    expect(model.courses.map((c) => [c.courseCode, c.creditHours])).toEqual([['CSEN 501', 6], ['MATH 501', 4]]);
    expect(model.courses[0].sessions).toEqual(['Lecture (1): Saturday 08:15-10:00, H1', 'Lab (1): Monday 08:15-10:00, Lab 1']);
    expect(model.totalCreditHours).toBe(10);
    expect(model.totalLine).toBe('Total credit hours: 10');
    expect(model.daysOff).toEqual(['Sunday', 'Tuesday', 'Thursday', 'Friday']);
    expect(model.daysOffLine).toBe('Days off: Sunday, Tuesday, Thursday, Friday');
    expect(model.days).toEqual(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
    expect(model.grid.blocks.map((b) => `${b.day} ${b.courseCode} ${b.typeLabel} ${b.room}`)).toEqual([
      'Saturday CSEN 501 L H1', 'Monday CSEN 501 Lab Lab 1', 'Wednesday MATH 501 T C7.4'
    ]);
  });

  test('scheduleFileName replaces the slash of the academic year', () => {
    expect(scheduleFileName(student, term)).toBe('schedule-52-0001-2026-2027-Winter.pdf');
  });

  test('long names, many sessions, overlaps and late times render without throwing (multi-page)', async () => {
    const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
    const entries = Array.from({ length: 30 }, (_, i) => ({
      courseCode: `LONG ${100 + i}`,
      courseName: `A very long course name that keeps going ${'and going '.repeat(40)}${i}`,
      creditHours: 2,
      slots: ['lecture', 'tutorial', 'lab'].map((type, k) => ({
        type, groupNumber: String(k + 1), day: days[(i + k) % 6], startTime: '07:00', endTime: '21:30', room: `Room ${i}-${k}`
      }))
    }));
    const calendar = buildWeeklyCalendar(entries);
    const model = buildPdfModel({ student, term, schedule: { status: 'processed', studyGroup: '7' }, calendar });
    expect(model.courses[0].courseName.length).toBeLessThanOrEqual(160);
    expect(model.totalCreditHours).toBe(60);
    expect(model.grid.startMinutes).toBe(7 * 60);
    expect(model.grid.endMinutes).toBe(22 * 60);
    const pdf = await renderSchedulePdf({ model });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    expect(pages).toBeGreaterThan(2);
  });

  test('an empty calendar still renders', async () => {
    const pdf = await renderSchedulePdf({ student, term, schedule: { status: 'processed', studyGroup: '1' }, calendar: buildWeeklyCalendar([]) });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
