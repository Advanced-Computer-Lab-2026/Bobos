// Requirement 34 - eligible destination groups for a whole-schedule swap.
import request from 'supertest';
import { connectTestDb, dropTestDb, clearCollections, buildFixture, tokenFor } from './helpers.js';
import app from '../src/app.js';
import { AcademicTerm } from '../src/models/AcademicTerm.js';
import { Course } from '../src/models/Course.js';
import { CourseOffering } from '../src/models/CourseOffering.js';
import { ScheduleTemplate } from '../src/models/ScheduleTemplate.js';
import { StudentSchedule } from '../src/models/StudentSchedule.js';
import { NO_VISIBLE_SCHEDULE } from '../src/utils/scheduleAccess.js';
import { isExactCourseSet, courseCodeSet, findEligibleGroups } from '../src/utils/swapEligibility.js';

let fx;

beforeAll(async () => { await connectTestDb(); });
afterAll(async () => { await dropTestDb(); });
beforeEach(async () => {
  await clearCollections();
  fx = await buildFixture();
});

const get = (path, token) => {
  const req = request(app).get(path);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

const slotOf = (offering, type, group) => offering.slots.find((s) => s.type === type && s.groupNumber === group);

function entriesFor(group, { withMath = true } = {}) {
  const { dbOffering, mathOffering } = fx.offerings;
  const out = [{
    offering: dbOffering._id,
    lectureSlotId: slotOf(dbOffering, 'lecture', group)._id,
    tutorialSlotId: slotOf(dbOffering, 'tutorial', group)._id,
    labSlotId: slotOf(dbOffering, 'lab', group)._id
  }];
  if (withMath) {
    out.push({
      offering: mathOffering._id,
      lectureSlotId: slotOf(mathOffering, 'lecture', group)._id,
      tutorialSlotId: slotOf(mathOffering, 'tutorial', group)._id,
      labSlotId: null
    });
  }
  return out;
}

// Group-1 snapshot of the fixture, as requirement 30 would have written it.
function snapshotGroup1() {
  const { dbOffering, mathOffering } = fx.offerings;
  const pick = (o, type) => {
    const s = slotOf(o, type, '1');
    return { slotId: s._id, type, groupNumber: '1', day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room };
  };
  return [
    { course: fx.courses.csen501._id, courseCode: 'CSEN 501', courseName: 'Data Base I', creditHours: 6, offering: dbOffering._id,
      slots: [pick(dbOffering, 'lecture'), pick(dbOffering, 'tutorial'), pick(dbOffering, 'lab')] },
    { course: fx.courses.math501._id, courseCode: 'MATH 501', courseName: 'Mathematics V (Discrete Math)', creditHours: 4, offering: mathOffering._id,
      slots: [pick(mathOffering, 'lecture'), pick(mathOffering, 'tutorial')] }
  ];
}

function assign(student, { status = 'processed', template = fx.templates.g1 } = {}) {
  return StudentSchedule.create({
    student: student._id, term: fx.term._id, studyGroup: template.studyGroup, template: template._id,
    status, entries: snapshotGroup1(), assignedAt: new Date()
  });
}

// Decoys around the fixture's CS 5 groups 1-4.
async function addDecoys() {
  const extraCourse = await Course.create({ code: 'PHYS 501', name: 'Physics V', creditHours: 2, courseType: 'core', major: 'ALL', recommendedSemester: 5 });
  const extraOffering = await CourseOffering.create({
    course: extraCourse._id, term: fx.term._id, instructors: ['Dr. Test'], eligibleMajors: ['CS'], eligibleSemesters: [5], isPublished: true,
    slots: [{ type: 'lecture', groupNumber: '1', day: 'Thursday', startTime: '08:15', endTime: '10:00', room: 'H9', maxCapacity: 30, assignedCount: 0 }]
  });
  const otherTerm = await AcademicTerm.create({
    academicYear: '2025/2026', season: 'Spring', termStart: new Date('2026-02-01'), termEnd: new Date('2026-06-01'), isCurrent: false
  });
  const withExtra = [...entriesFor('2'), { offering: extraOffering._id, lectureSlotId: extraOffering.slots[0]._id, tutorialSlotId: null, labSlotId: null }];
  const docs = await ScheduleTemplate.create([
    { term: fx.term._id, major: 'CS', semester: 5, studyGroup: '5', isPublished: true, entries: withExtra }, // extra course
    { term: fx.term._id, major: 'CS', semester: 5, studyGroup: '6', isPublished: true, entries: entriesFor('2', { withMath: false }) }, // missing course
    { term: otherTerm._id, major: 'CS', semester: 5, studyGroup: '7', isPublished: true, entries: entriesFor('2') }, // other term
    { term: fx.term._id, major: 'DMET', semester: 5, studyGroup: '9', isPublished: true, entries: [withExtra[2]] }, // different major + set
    { term: fx.term._id, major: 'DMET', semester: 5, studyGroup: '1', isPublished: true, entries: entriesFor('2') } // other cohort, identical set
  ]);
  return { extra: docs[0], missing: docs[1], otherTerm: docs[2], dmetDifferent: docs[3], dmetSame: docs[4] };
}

describe('GET /api/swaps/eligible-groups', () => {
  test('returns exactly the other published groups with an identical course-code set', async () => {
    await assign(fx.students.normalStudent);
    const decoys = await addDecoys();
    const res = await get('/api/swaps/eligible-groups', fx.tokens.student);

    expect(res.status).toBe(200);
    const ids = res.body.eligibleGroups.map((g) => String(g.templateId));
    // own group 1 excluded by template id, yet DMET group "1" (same string, identical set) included
    expect(res.body.eligibleGroups.map((g) => `${g.major}-${g.studyGroup}`)).toEqual(['DMET-1', 'CS-2', 'CS-3']);
    expect(ids).not.toContain(String(fx.templates.g1._id));
    expect(ids).toContain(String(decoys.dmetSame._id));
    for (const excluded of [fx.templates.g4Unpublished, decoys.extra, decoys.missing, decoys.otherTerm, decoys.dmetDifferent]) {
      expect(ids).not.toContain(String(excluded._id));
    }
    expect(res.body.count).toBe(3);
    expect(res.body.currentGroup).toMatchObject({
      templateId: String(fx.templates.g1._id), studyGroup: '1', major: 'CS', semester: 5,
      courseCodes: ['CSEN 501', 'MATH 501'], totalCreditHours: 10
    });
    expect(res.body.term).toMatchObject({ academicYear: '2026/2027', season: 'Winter' });
    expect(res.body.term).toHaveProperty('swapDeadline');
    expect(res.body.student).toMatchObject({ studentId: '52-0001', fullName: 'Normal Student', major: 'CS', currentSemester: 5 });
  });

  test('each eligible group carries its complete weekly schedule', async () => {
    await assign(fx.students.normalStudent);
    const res = await get('/api/swaps/eligible-groups', fx.tokens.student);
    expect(res.status).toBe(200);
    expect(res.body.eligibleGroups.map((g) => g.studyGroup)).toEqual(['2', '3']);

    const g2 = res.body.eligibleGroups[0];
    expect(g2.totalCreditHours).toBe(10);
    expect(g2.minRemainingCapacity).toBe(30);
    expect(g2.courses.map((c) => c.courseCode)).toEqual(['CSEN 501', 'MATH 501']);
    expect(g2.courses[0].slots.map((s) => s.type)).toEqual(['lecture', 'tutorial', 'lab']);
    expect(g2.courses[1].slots.map((s) => s.type)).toEqual(['lecture', 'tutorial']); // null lab absent
    expect(g2.courses[0].slots[0]).toEqual({ type: 'lecture', groupNumber: '2', day: 'Saturday', startTime: '10:15', endTime: '12:00', room: 'H2' });
    expect(g2.week.Saturday).toEqual([
      { courseCode: 'CSEN 501', courseName: 'Data Base I', type: 'lecture', groupNumber: '2', startTime: '10:15', endTime: '12:00', room: 'H2' }
    ]);
    expect(g2.daysOff).toEqual(['Thursday', 'Friday']);
    // capacity is informational only: group 3's full lecture does not exclude it
    expect(res.body.eligibleGroups[1].minRemainingCapacity).toBe(0);
  });

  test('week entries are sorted by start time', async () => {
    await assign(fx.students.normalStudent);
    const { dbOffering, mathOffering } = fx.offerings;
    // a group whose Saturday has the later CSEN lecture listed first in the template
    await ScheduleTemplate.create({
      term: fx.term._id, major: 'CS', semester: 5, studyGroup: '8', isPublished: true,
      entries: [
        { offering: mathOffering._id, lectureSlotId: slotOf(mathOffering, 'lecture', '3')._id, tutorialSlotId: slotOf(mathOffering, 'tutorial', '3')._id, labSlotId: null },
        { offering: dbOffering._id, lectureSlotId: slotOf(dbOffering, 'lecture', '2')._id, tutorialSlotId: slotOf(dbOffering, 'tutorial', '1')._id, labSlotId: slotOf(dbOffering, 'lab', '3')._id }
      ]
    });
    const res = await get('/api/swaps/eligible-groups', fx.tokens.student);
    const g8 = res.body.eligibleGroups.find((g) => g.studyGroup === '8');
    expect(g8).toBeDefined();
    for (const list of Object.values(g8.week)) {
      const starts = list.map((s) => s.startTime);
      expect(starts).toEqual([...starts].sort());
    }
  });

  test('200 with an empty list when no other group matches', async () => {
    await assign(fx.students.normalStudent);
    await ScheduleTemplate.updateMany({ _id: { $in: [fx.templates.g2._id, fx.templates.g3Full._id] } }, { isPublished: false });
    const res = await get('/api/swaps/eligible-groups', fx.tokens.student);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.eligibleGroups).toEqual([]);
  });

  test('a template pointing at an unpublished offering is ineligible, not a crash', async () => {
    await assign(fx.students.normalStudent);
    await CourseOffering.updateOne({ _id: fx.offerings.mathOffering._id }, { isPublished: false });
    const res = await get('/api/swaps/eligible-groups', fx.tokens.student);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  test('404 when the normal student has no processed schedule', async () => {
    const res = await get('/api/swaps/eligible-groups', fx.tokens.student);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe(NO_VISIBLE_SCHEDULE);
  });

  test('advising student -> 403, even with a draft or processed schedule', async () => {
    await assign(fx.students.advisingStudent, { status: 'draft' });
    const token = tokenFor(fx.users.advisingUser);
    let res = await get('/api/swaps/eligible-groups', token);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Advising students cannot swap/);
    await StudentSchedule.updateOne({ student: fx.students.advisingStudent._id }, { status: 'processed' });
    res = await get('/api/swaps/eligible-groups', token);
    expect(res.status).toBe(403);
  });

  test.each(['advisor', 'coordinator', 'administrator'])('%s -> 403', async (role) => {
    const res = await get('/api/swaps/eligible-groups', fx.tokens[role]);
    expect(res.status).toBe(403);
  });

  test('401 without a token', async () => {
    expect((await get('/api/swaps/eligible-groups')).status).toBe(401);
  });

  test('400 for an invalid termId, 404 for an unknown one', async () => {
    await assign(fx.students.normalStudent);
    expect((await get('/api/swaps/eligible-groups?termId=nope', fx.tokens.student)).status).toBe(400);
    expect((await get('/api/swaps/eligible-groups?termId=0123456789abcdef01234567', fx.tokens.student)).status).toBe(404);
  });

  test('explicit termId of a term without the student schedule -> 404', async () => {
    await assign(fx.students.normalStudent);
    const other = await AcademicTerm.create({
      academicYear: '2025/2026', season: 'Spring', termStart: new Date('2026-02-01'), termEnd: new Date('2026-06-01'), isCurrent: false
    });
    const res = await get(`/api/swaps/eligible-groups?termId=${other._id}`, fx.tokens.student);
    expect(res.status).toBe(404);
  });
});

describe('swapEligibility (unit)', () => {
  test('isExactCourseSet: order/case/space-insensitive, no extra, no missing', () => {
    expect(isExactCourseSet(['CSEN 501', 'MATH 501'], ['MATH 501', 'csen 501 '])).toBe(true);
    expect(isExactCourseSet(['CSEN 501'], ['CSEN 501', 'MATH 501'])).toBe(false);
    expect(isExactCourseSet(['CSEN 501', 'MATH 501'], ['CSEN 501'])).toBe(false);
    expect(isExactCourseSet(['CSEN 501', 'MATH 501'], ['CSEN 501', 'PHYS 501'])).toBe(false);
    expect(courseCodeSet(['A', 'A', '', null]).size).toBe(1);
  });

  const course = (code) => ({ _id: `c-${code}`, code, name: `${code} name`, creditHours: 3 });
  const slot = (id, type, day, start) => ({ _id: id, type, groupNumber: '1', day, startTime: start, endTime: '10:00', room: 'R', maxCapacity: 10, assignedCount: 4 });
  const offerings = new Map([
    ['oA', { _id: 'oA', isPublished: true, course: course('A'), slots: [slot('a1', 'lecture', 'Sunday', '08:15')] }],
    ['oB', { _id: 'oB', isPublished: true, course: course('B'), slots: [slot('b1', 'lecture', 'Monday', '08:15')] }],
    ['oC', { _id: 'oC', isPublished: true, course: course('C'), slots: [slot('c1', 'lecture', 'Tuesday', '08:15')] }]
  ]);
  const entry = (o, lec) => ({ offering: o, lectureSlotId: lec, tutorialSlotId: null, labSlotId: null });
  const tpl = (id, studyGroup, entries, extra = {}) => ({ _id: id, studyGroup, major: 'CS', semester: 7, isPublished: true, entries, ...extra });

  test('findEligibleGroups filters and sorts numerically', () => {
    const templates = [
      tpl('t10', '10', [entry('oA', 'a1'), entry('oB', 'b1')]),
      tpl('t2', '2', [entry('oB', 'b1'), entry('oA', 'a1')]),
      tpl('tOwn', '1', [entry('oA', 'a1'), entry('oB', 'b1')]),
      tpl('tUnpub', '3', [entry('oA', 'a1'), entry('oB', 'b1')], { isPublished: false }),
      tpl('tExtra', '4', [entry('oA', 'a1'), entry('oB', 'b1'), entry('oC', 'c1')]),
      tpl('tMissing', '5', [entry('oA', 'a1')]),
      tpl('tGhost', '6', [entry('oA', 'a1'), entry('oX', null)]),
      tpl('tStale', '7', [entry('oA', 'a1'), entry('oB', 'zzz')])
    ];
    const out = findEligibleGroups({ studentCourseCodes: ['A', 'B'], currentTemplateId: 'tOwn', templates, offeringsById: offerings });
    expect(out.map((g) => g.studyGroup)).toEqual(['2', '10']);
    expect(out[0]).toMatchObject({ templateId: 't2', totalCreditHours: 6, minRemainingCapacity: 6 });
    expect(out[0].daysOff).toEqual(['Saturday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(out[0].week.Sunday[0]).toMatchObject({ courseCode: 'A', type: 'lecture' });
  });

  test('a student with no subjects has no eligible group', () => {
    expect(findEligibleGroups({ studentCourseCodes: [], templates: [tpl('t', '1', [])], offeringsById: offerings })).toEqual([]);
  });
});
