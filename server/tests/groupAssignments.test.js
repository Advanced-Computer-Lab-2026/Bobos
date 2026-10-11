// Requirement 30 - assign / reassign normal students to a standard schedule group.
import request from 'supertest';
import {
  connectTestDb,
  dropTestDb,
  clearCollections,
  buildFixture,
  readSlot
} from './helpers.js';
import app from '../src/app.js';
import { StudentSchedule } from '../src/models/StudentSchedule.js';

let fx;

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await dropTestDb();
});

beforeEach(async () => {
  await clearCollections();
  fx = await buildFixture();
});

const asCoordinator = (req) => req.set('Authorization', `Bearer ${fx.tokens.coordinator}`);

async function assign(studyGroup, studentId = fx.students.normalStudent._id) {
  return asCoordinator(request(app).post('/api/group-assignments')).send({
    studentId: String(studentId),
    termId: String(fx.term._id),
    studyGroup
  });
}

describe('POST /api/group-assignments - assigning', () => {
  test('assigns a normal student to a published group and creates the processed schedule', async () => {
    const res = await assign('1');

    expect(res.status).toBe(201);
    expect(res.body.schedule).toBeDefined();
    expect(res.body.schedule.studyGroup).toBe('1');
    expect(res.body.schedule.status).toBe('processed');
    expect(String(res.body.schedule.template._id)).toBe(String(fx.templates.g1._id));
    expect(res.body.schedule.assignedAt).toBeTruthy();
    expect(res.body.schedule.history).toHaveLength(1);
    expect(res.body.schedule.history[0]).toMatchObject({ action: 'assigned', toGroup: '1' });

    const stored = await StudentSchedule.findOne({
      student: fx.students.normalStudent._id,
      term: fx.term._id
    });
    expect(stored).not.toBeNull();
    expect(stored.studyGroup).toBe('1');
    expect(stored.entries).toHaveLength(2);
  });

  test("the created schedule's entries match the assigned group's template exactly", async () => {
    const res = await assign('1');
    expect(res.status).toBe(201);

    const entries = res.body.schedule.entries;
    expect(entries.map((e) => e.courseCode).sort()).toEqual(['CSEN 501', 'MATH 501']);

    const db = entries.find((e) => e.courseCode === 'CSEN 501');
    expect(db.courseName).toBe('Data Base I');
    expect(db.creditHours).toBe(6);
    expect(db.slots).toHaveLength(3);
    expect(db.slots.map((s) => s.type).sort()).toEqual(['lab', 'lecture', 'tutorial']);
    expect(db.slots.find((s) => s.type === 'lecture')).toMatchObject({
      groupNumber: '1',
      day: 'Saturday',
      startTime: '08:15',
      endTime: '10:00',
      room: 'H1'
    });

    // MATH 501 has no lab: the null component is simply absent.
    const math = entries.find((e) => e.courseCode === 'MATH 501');
    expect(math.creditHours).toBe(4);
    expect(math.slots).toHaveLength(2);
    expect(math.slots.some((s) => s.type === 'lab')).toBe(false);

    // Every stored slotId is one of the template's slot ids.
    const templateSlotIds = fx.templates.g1.entries
      .flatMap((e) => [e.lectureSlotId, e.tutorialSlotId, e.labSlotId])
      .filter(Boolean)
      .map(String);
    const scheduleSlotIds = entries.flatMap((e) => e.slots.map((s) => String(s.slotId)));
    expect(scheduleSlotIds.sort()).toEqual(templateSlotIds.sort());
  });

  test('increments assignedCount on every slot of the assigned group', async () => {
    await assign('1');

    expect((await readSlot(fx.offerings.dbOffering._id, 'lecture', '1')).assignedCount).toBe(1);
    expect((await readSlot(fx.offerings.dbOffering._id, 'tutorial', '1')).assignedCount).toBe(1);
    expect((await readSlot(fx.offerings.dbOffering._id, 'lab', '1')).assignedCount).toBe(1);
    expect((await readSlot(fx.offerings.mathOffering._id, 'lecture', '1')).assignedCount).toBe(1);
    expect((await readSlot(fx.offerings.dbOffering._id, 'lecture', '2')).assignedCount).toBe(0);
  });

  test('accepts the human XX-XXXX student id as well as the Mongo _id', async () => {
    const res = await assign('1', fx.students.normalStudent.studentId);
    expect(res.status).toBe(201);
    expect(res.body.schedule.studyGroup).toBe('1');
  });

  test('falls back to the current term when termId is omitted', async () => {
    const res = await asCoordinator(request(app).post('/api/group-assignments')).send({
      studentId: String(fx.students.normalStudent._id),
      studyGroup: '2'
    });
    expect(res.status).toBe(201);
    expect(String(res.body.schedule.term)).toBe(String(fx.term._id));
  });
});

describe('POST /api/group-assignments - reassigning', () => {
  test('moves the student, replaces the schedule and corrects assignedCount on both groups', async () => {
    const first = await assign('1');
    expect(first.status).toBe(201);

    const second = await assign('2');
    expect(second.status).toBe(200); // 200 on reassign, 201 on first assign
    expect(second.body.schedule.studyGroup).toBe('2');

    // one schedule document only
    const all = await StudentSchedule.find({ student: fx.students.normalStudent._id });
    expect(all).toHaveLength(1);

    // entries now come from group 2's template
    const lecture = second.body.schedule.entries
      .find((e) => e.courseCode === 'CSEN 501')
      .slots.find((s) => s.type === 'lecture');
    expect(lecture).toMatchObject({ groupNumber: '2', day: 'Saturday', startTime: '10:15', room: 'H2' });

    // counts: group 1 back to 0, group 2 at 1
    expect((await readSlot(fx.offerings.dbOffering._id, 'lecture', '1')).assignedCount).toBe(0);
    expect((await readSlot(fx.offerings.dbOffering._id, 'tutorial', '1')).assignedCount).toBe(0);
    expect((await readSlot(fx.offerings.dbOffering._id, 'lab', '1')).assignedCount).toBe(0);
    expect((await readSlot(fx.offerings.mathOffering._id, 'lecture', '1')).assignedCount).toBe(0);
    expect((await readSlot(fx.offerings.dbOffering._id, 'lecture', '2')).assignedCount).toBe(1);
    expect((await readSlot(fx.offerings.mathOffering._id, 'tutorial', '2')).assignedCount).toBe(1);

    // history records the move
    expect(second.body.schedule.history).toHaveLength(2);
    expect(second.body.schedule.history[1]).toMatchObject({
      action: 'reassigned',
      fromGroup: '1',
      toGroup: '2'
    });
  });
});

describe('POST /api/group-assignments - rejections', () => {
  test('rejects assignment to an UNPUBLISHED template with 409', async () => {
    const res = await assign('4');
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not published/i);
    expect(await StudentSchedule.countDocuments({})).toBe(0);
  });

  test('rejects an ADVISING student with 400', async () => {
    const res = await assign('1', fx.students.advisingStudent._id);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/normal students/i);
    expect(await StudentSchedule.countDocuments({})).toBe(0);
  });

  test('rejects with 409 when one of the group slots is at capacity', async () => {
    const res = await assign('3');
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/full/i);
    expect(res.body.message).toContain('CSEN 501 lecture group 3');
    expect(await StudentSchedule.countDocuments({})).toBe(0);

    // nothing was incremented on the other slots of that group
    expect((await readSlot(fx.offerings.dbOffering._id, 'tutorial', '3')).assignedCount).toBe(0);
  });

  test('404 for an unknown study group', async () => {
    const res = await assign('99');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/No standard schedule group/i);
  });

  test('404 for an unknown student', async () => {
    const res = await assign('1', '0123456789abcdef01234567');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Student not found/i);
  });

  test('400 when the body is invalid', async () => {
    const res = await asCoordinator(request(app).post('/api/group-assignments')).send({});
    expect(res.status).toBe(400);
  });

  test('rejects with 409 when the offering of a template course is unpublished', async () => {
    const { CourseOffering } = await import('../src/models/CourseOffering.js');
    await CourseOffering.updateOne({ _id: fx.offerings.mathOffering._id }, { $set: { isPublished: false } });

    const res = await assign('1');
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('MATH 501');
    expect(res.body.message).toMatch(/not published/i);
  });
});

describe('authorisation', () => {
  test('401 without a token', async () => {
    const res = await request(app).post('/api/group-assignments').send({
      studentId: String(fx.students.normalStudent._id),
      studyGroup: '1'
    });
    expect(res.status).toBe(401);
  });

  test('401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/group-assignments/students')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  test('403 for a non-coordinator role (advisor)', async () => {
    const res = await request(app)
      .post('/api/group-assignments')
      .set('Authorization', `Bearer ${fx.tokens.advisor}`)
      .send({ studentId: String(fx.students.normalStudent._id), studyGroup: '1' });
    expect(res.status).toBe(403);
  });

  test('403 for a student trying to assign', async () => {
    const res = await request(app)
      .post('/api/group-assignments')
      .set('Authorization', `Bearer ${fx.tokens.student}`)
      .send({ studentId: String(fx.students.normalStudent._id), studyGroup: '1' });
    expect(res.status).toBe(403);
  });

  test('an administrator may read the roster but not assign', async () => {
    const read = await request(app)
      .get('/api/group-assignments/students')
      .set('Authorization', `Bearer ${fx.tokens.administrator}`);
    expect(read.status).toBe(200);

    const write = await request(app)
      .post('/api/group-assignments')
      .set('Authorization', `Bearer ${fx.tokens.administrator}`)
      .send({ studentId: String(fx.students.normalStudent._id), studyGroup: '1' });
    expect(write.status).toBe(403);
  });
});

describe('DELETE /api/group-assignments/:studentId - unassigning', () => {
  test('removes the schedule and decrements the slot counts', async () => {
    await assign('1');
    expect((await readSlot(fx.offerings.dbOffering._id, 'lecture', '1')).assignedCount).toBe(1);

    const res = await request(app)
      .delete(`/api/group-assignments/${fx.students.normalStudent._id}?termId=${fx.term._id}`)
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);

    expect(res.status).toBe(200);
    expect(res.body.unassignedFrom).toBe('1');
    expect(res.body.history[res.body.history.length - 1]).toMatchObject({
      action: 'unassigned',
      fromGroup: '1'
    });

    expect(await StudentSchedule.countDocuments({})).toBe(0);
    expect((await readSlot(fx.offerings.dbOffering._id, 'lecture', '1')).assignedCount).toBe(0);
    expect((await readSlot(fx.offerings.dbOffering._id, 'tutorial', '1')).assignedCount).toBe(0);
    expect((await readSlot(fx.offerings.dbOffering._id, 'lab', '1')).assignedCount).toBe(0);
    expect((await readSlot(fx.offerings.mathOffering._id, 'lecture', '1')).assignedCount).toBe(0);
  });

  test('404 when the student has no assignment', async () => {
    const res = await request(app)
      .delete(`/api/group-assignments/${fx.students.normalStudent._id}`)
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/group-assignments/students', () => {
  test('lists normal students only, with their current assignment', async () => {
    await assign('1');

    const res = await request(app)
      .get(`/api/group-assignments/students?termId=${fx.term._id}`)
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);

    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(1); // the advising student is excluded
    const row = res.body.students[0];
    expect(row).toMatchObject({
      studentId: '52-0001',
      fullName: 'Normal Student',
      email: 'normal.student@student.guc.edu.eg',
      major: 'CS',
      currentSemester: 5,
      academicStanding: 'Good Academic Standing',
      isActive: true
    });
    expect(row.assignment).toMatchObject({ studyGroup: '1', courseCount: 2 });
  });

  test('reports an unassigned student with assignment null and supports the assigned filter', async () => {
    const res = await request(app)
      .get('/api/group-assignments/students?assigned=false')
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].assignment).toBeNull();

    const assigned = await request(app)
      .get('/api/group-assignments/students?assigned=true')
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    expect(assigned.body.students).toHaveLength(0);
  });

  test('search matches student id, full name and email case-insensitively', async () => {
    const byName = await request(app)
      .get('/api/group-assignments/students?search=normal%20stu')
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    expect(byName.body.students).toHaveLength(1);

    const byId = await request(app)
      .get('/api/group-assignments/students?search=52-0001')
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    expect(byId.body.students).toHaveLength(1);

    const miss = await request(app)
      .get('/api/group-assignments/students?search=zzzz')
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    expect(miss.body.students).toHaveLength(0);
  });
});

describe('GET /api/group-assignments/groups', () => {
  test('lists only PUBLISHED templates with their preview data', async () => {
    const res = await request(app)
      .get(`/api/group-assignments/groups?termId=${fx.term._id}&major=CS&semester=5`)
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);

    expect(res.status).toBe(200);
    expect(res.body.groups.map((g) => g.studyGroup).sort()).toEqual(['1', '2', '3']);

    const g1 = res.body.groups.find((g) => g.studyGroup === '1');
    expect(g1.courseCount).toBe(2);
    expect(g1.courseCodes.sort()).toEqual(['CSEN 501', 'MATH 501']);
    expect(g1.totalCreditHours).toBe(10);
    expect(g1.assignedStudents).toBe(0);
    expect(g1.minRemainingCapacity).toBe(30);
    expect(g1.slots).toHaveLength(5);

    // group 3 has the full lecture slot
    const g3 = res.body.groups.find((g) => g.studyGroup === '3');
    expect(g3.minRemainingCapacity).toBe(0);
  });

  test('assignedStudents reflects real assignments', async () => {
    await assign('1');
    const res = await request(app)
      .get(`/api/group-assignments/groups?termId=${fx.term._id}`)
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    const g1 = res.body.groups.find((g) => g.studyGroup === '1');
    expect(g1.assignedStudents).toBe(1);
    expect(g1.minRemainingCapacity).toBe(29);
  });
});

describe('GET /api/group-assignments/:studentId', () => {
  test('returns the current assignment and the full processed schedule', async () => {
    await assign('2');

    const res = await request(app)
      .get(`/api/group-assignments/${fx.students.normalStudent._id}?termId=${fx.term._id}`)
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);

    expect(res.status).toBe(200);
    expect(res.body.student.assignment.studyGroup).toBe('2');
    expect(res.body.schedule.entries).toHaveLength(2);
    expect(res.body.schedule.template.studyGroup).toBe('2');
  });

  test('returns schedule null for an unassigned student', async () => {
    const res = await request(app)
      .get(`/api/group-assignments/${fx.students.normalStudent._id}`)
      .set('Authorization', `Bearer ${fx.tokens.coordinator}`);
    expect(res.status).toBe(200);
    expect(res.body.schedule).toBeNull();
    expect(res.body.student.assignment).toBeNull();
  });
});
