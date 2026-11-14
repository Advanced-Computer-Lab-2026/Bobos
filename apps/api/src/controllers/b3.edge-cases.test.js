import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../app.js';
import {
  AcademicTerm,
  Course,
  CourseOffering,
  CourseAttempt,
  StudentProfile,
  StudentSchedule,
  StudentWorkflowState,
  MandatoryCourseRemovalRequest,
  SlotChangeRequest,
  ScheduleActivity,
  AdvisorAssignment,
  User,
} from '../models/index.js';
import { generateToken } from '../middleware/auth.middleware.js';

let database;
let server;
let base;

const createdUserIds = [];
const createdProfileIds = [];
const createdCourseIds = [];
const createdOfferingIds = [];
const createdTermIds = [];
const createdRequestIds = [];
const createdScheduleIds = [];

let counter = 0;
const uniqueId = () => `${Date.now()}_${++counter}_${Math.floor(Math.random() * 100000)}`;

let studentCounter = Math.floor(10000 + Math.random() * 40000);
function nextStudentId() {
  return `98-${studentCounter++}`;
}

let courseCounter = Math.floor(1000 + Math.random() * 8000);
function nextCourseCode() {
  return `CS${courseCounter++}`;
}

async function createTestUser(role, overrides = {}) {
  const uid = uniqueId();
  const isStudent = ['normalStudent', 'advisingStudent'].includes(role);
  const domain = isStudent ? 'student.guc.edu.eg' : 'guc.edu.eg';
  const user = await User.create({
    email: `test_${role}_${uid}@${domain}`,
    fullName: `Test ${role} ${uid}`,
    passwordHash: 'hashed-password-123',
    role,
    isActive: true,
    isAdvisorInSystem: role === 'advisor',
    ...overrides,
  });
  createdUserIds.push(user._id);
  return user;
}

async function createTestStudent(user, advisor, overrides = {}) {
  const profile = await StudentProfile.create({
    user: user._id,
    studentId: nextStudentId(),
    studentType: 'advising',
    faculty: 'MET',
    major: 'CS',
    currentSemester: 4,
    gpa: 2.1,
    academicStanding: 'probation',
    advisingReason: 'probation',
    enrollmentStatus: 'active',
    assignedAdvisor: advisor?._id || null,
    ...overrides,
  });
  createdProfileIds.push(profile._id);

  if (advisor) {
    await AdvisorAssignment.create({
      student: profile._id,
      advisor: advisor._id,
      assignedBy: advisor._id,
      endedAt: null,
    });
  }
  return profile;
}

async function createTestCourse(overrides = {}) {
  const code = nextCourseCode();
  const course = await Course.create({
    code,
    name: `Course ${code}`,
    creditHours: 3,
    courseType: 'core',
    facultyMajors: ['CS'],
    isActive: true,
    prerequisites: [],
    ...overrides,
  });
  createdCourseIds.push(course._id);
  return course;
}

async function getOrCreateTestTerm(overrides = {}) {
  const existing = await AcademicTerm.findOne({ isActive: true });
  if (existing) return existing;
  const uid = uniqueId();
  const year = 2080 + Math.floor(Math.random() * 50);
  const term = await AcademicTerm.create({
    code: `T${uid.slice(-4)}`,
    academicYear: `${year}/${year + 1}`,
    season: 'winter',
    termStart: new Date(`${year}-10-01`),
    termEnd: new Date(`${year + 1}-02-01`),
    teachingStart: new Date(`${year}-10-08`),
    teachingEnd: new Date(`${year + 1}-01-20`),
    registrationStart: new Date(`${year}-09-20`),
    registrationEnd: new Date(`${year}-10-05`),
    advisingDeadline: new Date(`${year}-10-15`),
    wholeScheduleSwapDeadline: new Date(`${year}-10-20`),
    isActive: true,
    ...overrides,
  });
  createdTermIds.push(term._id);
  return term;
}

async function createTestOffering(term, course, overrides = {}) {
  const slotId = new mongoose.Types.ObjectId();
  const offering = await CourseOffering.create({
    course: course._id,
    term: term._id,
    academicYear: term.academicYear,
    isPublished: true,
    instructors: [{ fullName: 'Test Instructor', email: 'instructor@guc.edu.eg' }],
    eligibleGroups: [{ major: 'CS', semester: 4 }],
    slots: [
      {
        _id: slotId,
        componentType: 'lecture',
        groupNumber: '1',
        day: 'Monday',
        startMinute: 540,
        endMinute: 600,
        room: 'C7.201',
        capacity: 50,
        assignedStudentCount: 0,
      },
    ],
    ...overrides,
  });
  createdOfferingIds.push(offering._id);
  return offering;
}

async function call(path, { user, role, method = 'GET', body } = {}) {
  const headers = {};
  if (user) {
    headers.Authorization = `Bearer ${generateToken(user)}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const cleanPath = path.startsWith('/api/') ? path : path.startsWith('/') ? `/api${path}` : `/api/${path}`;
  const response = await fetch(`${base}${cleanPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get('content-type') || '';
  let responseData = null;
  if (contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }
  return { status: response.status, body: responseData };
}

describe('Part B3 Automated Test Suite (Reqs 64–69 and 80–82)', () => {
  let coordinatorUser;
  let advisorUser;
  let otherAdvisorUser;
  let studentUser;
  let defaultTerm;

  before(async () => {
    if (process.env.MONGODB_URI) {
      try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
      } catch {
        database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
        await mongoose.connect(database.getUri());
      }
    } else {
      database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      await mongoose.connect(database.getUri());
    }

    await Promise.all([
      User.init(),
      StudentProfile.init(),
      AcademicTerm.init(),
      Course.init(),
      CourseOffering.init(),
      StudentSchedule.init(),
      StudentWorkflowState.init(),
      MandatoryCourseRemovalRequest.init(),
      SlotChangeRequest.init(),
      ScheduleActivity.init(),
      AdvisorAssignment.init(),
      CourseAttempt.init(),
    ]);

    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;

    coordinatorUser = await createTestUser('coordinator');
    advisorUser = await createTestUser('advisor');
    otherAdvisorUser = await createTestUser('advisor');
    studentUser = await createTestUser('advisingStudent');
    defaultTerm = await getOrCreateTestTerm();
  });

  after(async () => {
    await Promise.all([
      User.deleteMany({ _id: { $in: createdUserIds } }),
      StudentProfile.deleteMany({ _id: { $in: createdProfileIds } }),
      Course.deleteMany({ _id: { $in: createdCourseIds } }),
      CourseOffering.deleteMany({ _id: { $in: createdOfferingIds } }),
      AcademicTerm.deleteMany({ _id: { $in: createdTermIds } }),
      MandatoryCourseRemovalRequest.deleteMany({ _id: { $in: createdRequestIds } }),
      StudentSchedule.deleteMany({ _id: { $in: createdScheduleIds } }),
      CourseAttempt.deleteMany({ student: { $in: createdProfileIds } }),
      SlotChangeRequest.deleteMany({ student: { $in: createdProfileIds } }),
      ScheduleActivity.deleteMany({ student: { $in: createdProfileIds } }),
      StudentWorkflowState.deleteMany({ student: { $in: createdProfileIds } }),
      AdvisorAssignment.deleteMany({ student: { $in: createdProfileIds } }),
    ]);

    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    if (database) await database.stop();
  });

  // =========================================================================
  // 1. Course Removal Request Submission (Req 64)
  // =========================================================================
  describe('Req 64: Course Removal Request Submission', () => {
    it('rejects removal if courseId is not in the student\'s failed/unattended history', async () => {
      const u = await createTestUser('advisingStudent');
      const student = await createTestStudent(u, advisorUser);
      const course = await createTestCourse();

      // Passed attempt instead of failed/unattended
      await CourseAttempt.create({
        student: student._id,
        course: course._id,
        term: defaultTerm._id,
        attemptNumber: 1,
        attendance: 'attended',
        result: 'passed',
        grade: 'A',
      });

      const res = await call('/mandatory-removals', {
        user: advisorUser,
        method: 'POST',
        body: {
          studentProfileId: student._id,
          courseId: course._id,
          termId: defaultTerm._id,
          reason: 'incorrectMandatoryDesignation',
          explanation: 'Requesting removal for passed course',
        },
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /failed or unattended history/i);
    });

    it('rejects removal if reason or explanation is empty', async () => {
      const u = await createTestUser('advisingStudent');
      const student = await createTestStudent(u, advisorUser);
      const course = await createTestCourse();

      await CourseAttempt.create({
        student: student._id,
        course: course._id,
        term: defaultTerm._id,
        attemptNumber: 1,
        attendance: 'attended',
        result: 'failed',
        grade: 'F',
      });

      // Empty reason
      const resNoReason = await call('/mandatory-removals', {
        user: advisorUser,
        method: 'POST',
        body: {
          studentProfileId: student._id,
          courseId: course._id,
          termId: defaultTerm._id,
          reason: '',
          explanation: 'Valid explanation note',
        },
      });
      assert.equal(resNoReason.status, 400);

      // Empty explanation
      const resNoExp = await call('/mandatory-removals', {
        user: advisorUser,
        method: 'POST',
        body: {
          studentProfileId: student._id,
          courseId: course._id,
          termId: defaultTerm._id,
          reason: 'makeupEligibility',
          explanation: '   ',
        },
      });
      assert.equal(resNoExp.status, 400);
    });

    it('rejects submission if requested by unauthorized roles (e.g., student)', async () => {
      const u = await createTestUser('advisingStudent');
      const student = await createTestStudent(u, advisorUser);
      const course = await createTestCourse();

      const res = await call('/mandatory-removals', {
        user: studentUser,
        method: 'POST',
        body: {
          studentProfileId: student._id,
          courseId: course._id,
          termId: defaultTerm._id,
          reason: 'other',
          explanation: 'Student self request',
        },
      });
      assert.equal(res.status, 403);
    });

    it('successfully creates request with status "pending" when valid', async () => {
      const u = await createTestUser('advisingStudent');
      const student = await createTestStudent(u, advisorUser);
      const course = await createTestCourse();

      await CourseAttempt.create({
        student: student._id,
        course: course._id,
        term: defaultTerm._id,
        attemptNumber: 1,
        attendance: 'attended',
        result: 'failed',
        grade: 'F',
      });

      const res = await call('/mandatory-removals', {
        user: advisorUser,
        method: 'POST',
        body: {
          studentProfileId: student._id,
          courseId: course._id,
          termId: defaultTerm._id,
          reason: 'completedHours',
          explanation: 'Student fulfilled total credit requirement.',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.status, 'pending');
      assert.equal(String(res.body.student._id || res.body.student), String(student._id));
      assert.equal(String(res.body.course._id || res.body.course), String(course._id));
      createdRequestIds.push(res.body._id);
    });
  });

  // =========================================================================
  // 2. Coordinator Request Listing & Authorization (Req 65)
  // =========================================================================
  describe('Req 65: Coordinator Request Listing & Authorization', () => {
    it('GET /api/mandatory-removals returns list of removal requests for Coordinator', async () => {
      const res = await call('/mandatory-removals', {
        user: coordinatorUser,
        method: 'GET',
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 1);
    });

    it('blocks unauthorized roles (e.g., student) with HTTP 403', async () => {
      const res = await call('/mandatory-removals', {
        user: studentUser,
        method: 'GET',
      });

      assert.equal(res.status, 403);
    });
  });

  // =========================================================================
  // 3. Search Removal Requests (Req 66)
  // =========================================================================
  describe('Req 66: Search Removal Requests', () => {
    let searchableStudentA;
    let searchableCourseA;
    let searchableCourseB;

    before(async () => {
      const uA = await createTestUser('advisingStudent');
      searchableStudentA = await createTestStudent(uA, advisorUser);
      searchableCourseA = await createTestCourse();
      searchableCourseB = await createTestCourse();

      await CourseAttempt.create([
        {
          student: searchableStudentA._id,
          course: searchableCourseA._id,
          term: defaultTerm._id,
          attendance: 'unattended',
          result: 'failed',
          grade: 'F',
        },
        {
          student: searchableStudentA._id,
          course: searchableCourseB._id,
          term: defaultTerm._id,
          attendance: 'unattended',
          result: 'failed',
          grade: 'F',
        },
      ]);

      const reqA = await MandatoryCourseRemovalRequest.create({
        student: searchableStudentA._id,
        course: searchableCourseA._id,
        advisor: advisorUser._id,
        term: defaultTerm._id,
        reason: 'other',
        explanation: 'Search test request A',
        status: 'pending',
      });
      createdRequestIds.push(reqA._id);

      const reqB = await MandatoryCourseRemovalRequest.create({
        student: searchableStudentA._id,
        course: searchableCourseB._id,
        advisor: advisorUser._id,
        term: defaultTerm._id,
        reason: 'other',
        explanation: 'Search test request B',
        status: 'pending',
      });
      createdRequestIds.push(reqB._id);
    });

    it('returns only requests matching that student or course when queried with search parameter', async () => {
      // Search by student ID
      const resStudent = await call(`/mandatory-removals?search=${searchableStudentA.studentId}`, {
        user: coordinatorUser,
      });
      assert.equal(resStudent.status, 200);
      assert.ok(Array.isArray(resStudent.body));
      assert.ok(resStudent.body.length >= 2);
      for (const item of resStudent.body) {
        assert.equal(item.student.studentId, searchableStudentA.studentId);
      }

      // Search by course code
      const resCourse = await call(`/mandatory-removals?search=${searchableCourseA.code}`, {
        user: coordinatorUser,
      });
      assert.equal(resCourse.status, 200);
      assert.ok(Array.isArray(resCourse.body));
      assert.ok(resCourse.body.length >= 1);
      assert.ok(resCourse.body.some((r) => r.course.code === searchableCourseA.code));
      assert.ok(!resCourse.body.some((r) => r.course.code === searchableCourseB.code));
    });

    it('returns an empty list [] when searching for a non-existent ID', async () => {
      const res = await call('/mandatory-removals?search=NONEXISTENT_XYZ_99999', {
        user: coordinatorUser,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 0);
    });
  });

  // =========================================================================
  // 4. Filter Removal Requests (Req 67)
  // =========================================================================
  describe('Req 67: Filter Removal Requests', () => {
    let pendingRequest;
    let approvedRequest;
    let rejectedRequest;
    let otherAdvisorRequest;

    before(async () => {
      const u1 = await createTestUser('advisingStudent');
      const s1 = await createTestStudent(u1, advisorUser);
      const c1 = await createTestCourse();
      const c2 = await createTestCourse();
      const c3 = await createTestCourse();

      const u2 = await createTestUser('advisingStudent');
      const s2 = await createTestStudent(u2, otherAdvisorUser);
      const c4 = await createTestCourse();

      pendingRequest = await MandatoryCourseRemovalRequest.create({
        student: s1._id,
        course: c1._id,
        advisor: advisorUser._id,
        term: defaultTerm._id,
        reason: 'other',
        explanation: 'Filter test pending',
        status: 'pending',
      });
      createdRequestIds.push(pendingRequest._id);

      approvedRequest = await MandatoryCourseRemovalRequest.create({
        student: s1._id,
        course: c2._id,
        advisor: advisorUser._id,
        term: defaultTerm._id,
        reason: 'makeupEligibility',
        explanation: 'Filter test approved',
        status: 'approved',
        decidedBy: coordinatorUser._id,
        responseNote: 'Approved for filter test',
        decidedAt: new Date(),
      });
      createdRequestIds.push(approvedRequest._id);

      rejectedRequest = await MandatoryCourseRemovalRequest.create({
        student: s1._id,
        course: c3._id,
        advisor: advisorUser._id,
        term: defaultTerm._id,
        reason: 'completedHours',
        explanation: 'Filter test rejected',
        status: 'rejected',
        decidedBy: coordinatorUser._id,
        responseNote: 'Rejected for filter test',
        decidedAt: new Date(),
      });
      createdRequestIds.push(rejectedRequest._id);

      otherAdvisorRequest = await MandatoryCourseRemovalRequest.create({
        student: s2._id,
        course: c4._id,
        advisor: otherAdvisorUser._id,
        term: defaultTerm._id,
        reason: 'other',
        explanation: 'Other advisor request',
        status: 'pending',
      });
      createdRequestIds.push(otherAdvisorRequest._id);
    });

    it('returns only pending requests when filtering by status=pending', async () => {
      const res = await call('/mandatory-removals?status=pending', {
        user: coordinatorUser,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 2);
      assert.ok(res.body.every((r) => r.status === 'pending'));
    });

    it('returns only requests created by that advisor when filtering by advisor=<advisorId>', async () => {
      const res = await call(`/mandatory-removals?advisor=${otherAdvisorUser._id}`, {
        user: coordinatorUser,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 1);
      assert.ok(
        res.body.every(
          (r) => String(r.advisor?._id || r.advisor) === String(otherAdvisorUser._id)
        )
      );
    });

    it('returns all active requests when omitting filters', async () => {
      const res = await call('/mandatory-removals', {
        user: coordinatorUser,
      });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 4);
    });
  });

  // =========================================================================
  // 5. Coordinator Decision & Cascade (Req 68, 69)
  // =========================================================================
  describe('Req 68 & 69: Coordinator Decision & Cascade', () => {
    let testStudent;
    let courseA;
    let courseB;
    let offeringA;
    let offeringB;
    let removalReq;

    before(async () => {
      const u = await createTestUser('advisingStudent');
      testStudent = await createTestStudent(u, advisorUser);
      courseA = await createTestCourse();
      courseB = await createTestCourse();

      offeringA = await createTestOffering(defaultTerm, courseA);
      offeringB = await createTestOffering(defaultTerm, courseB);

      await CourseAttempt.create({
        student: testStudent._id,
        course: courseA._id,
        term: defaultTerm._id,
        attendance: 'attended',
        result: 'failed',
        grade: 'F',
      });

      // Draft schedule containing courseA and courseB
      const draftSchedule = await StudentSchedule.create({
        student: testStudent._id,
        term: defaultTerm._id,
        scheduleType: 'advising',
        status: 'draft',
        version: 1,
        createdBy: advisorUser._id,
        courses: [
          {
            course: courseA._id,
            courseOffering: offeringA._id,
            slots: [
              {
                componentType: 'lecture',
                courseOffering: offeringA._id,
                slotGroupId: offeringA.slots[0]._id,
              },
            ],
            creditHoursSnapshot: 3,
          },
          {
            course: courseB._id,
            courseOffering: offeringB._id,
            slots: [
              {
                componentType: 'lecture',
                courseOffering: offeringB._id,
                slotGroupId: offeringB.slots[0]._id,
              },
            ],
            creditHoursSnapshot: 3,
          },
        ],
      });
      createdScheduleIds.push(draftSchedule._id);

      removalReq = await MandatoryCourseRemovalRequest.create({
        student: testStudent._id,
        course: courseA._id,
        advisor: advisorUser._id,
        term: defaultTerm._id,
        reason: 'incorrectMandatoryDesignation',
        explanation: 'Testing coordinator cascade decision',
        status: 'pending',
      });
      createdRequestIds.push(removalReq._id);
    });

    it('Req 68: GET /api/mandatory-removals/:id returns request details', async () => {
      const res = await call(`/mandatory-removals/${removalReq._id}`, {
        user: coordinatorUser,
      });

      assert.equal(res.status, 200);
      assert.equal(String(res.body._id), String(removalReq._id));
      assert.equal(res.body.student.studentId, testStudent.studentId);
      assert.equal(res.body.course.code, courseA.code);
    });

    it('rejects approval/rejection if responseNote is missing or whitespace', async () => {
      const resEmpty = await call(`/mandatory-removals/${removalReq._id}/decision`, {
        user: coordinatorUser,
        method: 'PATCH',
        body: { decision: 'approved', responseNote: '' },
      });
      assert.equal(resEmpty.status, 400);

      const resWhitespace = await call(`/mandatory-removals/${removalReq._id}/decision`, {
        user: coordinatorUser,
        method: 'PATCH',
        body: { decision: 'rejected', responseNote: '     ' },
      });
      assert.equal(resWhitespace.status, 400);
    });

    it('on approval: updates request status to "approved" and strips course from draft schedule', async () => {
      const res = await call(`/mandatory-removals/${removalReq._id}/decision`, {
        user: coordinatorUser,
        method: 'PATCH',
        body: {
          decision: 'approved',
          responseNote: 'Approved: Course requirements completed.',
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.request.status, 'approved');
      assert.equal(res.body.request.responseNote, 'Approved: Course requirements completed.');

      // Verify draft schedule was automatically stripped of courseA
      const updatedSchedule = await StudentSchedule.findOne({
        student: testStudent._id,
        term: defaultTerm._id,
        scheduleType: 'advising',
      });

      assert.ok(updatedSchedule);
      const hasCourseA = updatedSchedule.courses.some(
        (c) => String(c.course) === String(courseA._id)
      );
      const hasCourseB = updatedSchedule.courses.some(
        (c) => String(c.course) === String(courseB._id)
      );

      assert.equal(hasCourseA, false, 'Course A should have been removed from the draft schedule');
      assert.equal(hasCourseB, true, 'Course B should remain in the draft schedule');
    });

    it('rejects approval/rejection if request status is already "approved" or "rejected"', async () => {
      const resAlreadyDecided = await call(`/mandatory-removals/${removalReq._id}/decision`, {
        user: coordinatorUser,
        method: 'PATCH',
        body: {
          decision: 'rejected',
          responseNote: 'Attempting to change decision on already approved request',
        },
      });

      assert.equal(resAlreadyDecided.status, 409);
    });
  });

  // =========================================================================
  // 6. Schedule Workflow & Guards (Req 80, 81, 82)
  // =========================================================================
  describe('Req 80, 81, 82: Schedule Workflow & Guards', () => {
    let workflowStudent;
    let workflowCourse;
    let workflowOffering;
    let workflowSchedule;

    before(async () => {
      const u = await createTestUser('advisingStudent');
      workflowStudent = await createTestStudent(u, advisorUser);
      workflowCourse = await createTestCourse();
      workflowOffering = await createTestOffering(defaultTerm, workflowCourse);

      workflowSchedule = await StudentSchedule.create({
        student: workflowStudent._id,
        term: defaultTerm._id,
        scheduleType: 'advising',
        status: 'draft',
        version: 1,
        createdBy: advisorUser._id,
        courses: [
          {
            course: workflowCourse._id,
            courseOffering: workflowOffering._id,
            slots: [
              {
                componentType: 'lecture',
                courseOffering: workflowOffering._id,
                slotGroupId: workflowOffering.slots[0]._id,
              },
            ],
            creditHoursSnapshot: 3,
          },
        ],
      });
      createdScheduleIds.push(workflowSchedule._id);
    });

    it('Req 80: successfully transitions valid schedule from draft to readyForStudentReview', async () => {
      const res = await call(`/schedules/advising/${workflowStudent._id}/draft?termId=${defaultTerm._id}`, {
        user: advisorUser,
        method: 'PUT',
        body: {
          version: 1,
          submitForReview: true,
          courses: [
            {
              courseOffering: String(workflowOffering._id),
              groups: [{ componentType: 'lecture', groupNumber: '1' }],
            },
          ],
        },
      });

      assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
      assert.equal(res.body.schedule.status, 'readyForStudentReview');

      const saved = await StudentSchedule.findById(workflowSchedule._id);
      assert.equal(saved.status, 'readyForStudentReview');
    });

    it('Req 81 (Guard): blocks process schedule when student has a pending SlotChangeRequest', async () => {
      const slotReq = await SlotChangeRequest.create({
        student: workflowStudent._id,
        schedule: workflowSchedule._id,
        term: defaultTerm._id,
        course: workflowCourse._id,
        componentType: 'lecture',
        currentOffering: workflowOffering._id,
        currentSlotGroupId: workflowOffering.slots[0]._id,
        preferenceNote: 'Testing blocking guard for process schedule',
        status: 'pending',
      });

      const res = await call(`/schedules/advising/${workflowStudent._id}/process`, {
        user: advisorUser,
        method: 'POST',
        body: { termId: defaultTerm._id },
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /pending slot-change request/i);

      // Clean up the slot change request
      await SlotChangeRequest.deleteOne({ _id: slotReq._id });
    });

    it('Req 81 (Success): updates schedule status to processed when no pending requests exist', async () => {
      const res = await call(`/schedules/advising/${workflowStudent._id}/process`, {
        user: advisorUser,
        method: 'POST',
        body: { termId: defaultTerm._id },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.schedule.status, 'processed');

      const saved = await StudentSchedule.findById(workflowSchedule._id);
      assert.equal(saved.status, 'processed');
      assert.ok(saved.processedAt);
      assert.equal(String(saved.processedBy), String(advisorUser._id));
    });

    it('Req 82 (Guard): returns HTTP 400 when calling reopen schedule without a reason', async () => {
      const res = await call(`/schedules/advising/${workflowStudent._id}/reopen`, {
        user: advisorUser,
        method: 'POST',
        body: {
          reason: '   ',
          termId: defaultTerm._id,
        },
      });

      assert.equal(res.status, 400);
      assert.match(res.body.message, /reason/i);
    });

    it('Req 82 (Invalid state): returns error when calling reopen schedule on a non-processed schedule', async () => {
      const uOther = await createTestUser('advisingStudent');
      const studentOther = await createTestStudent(uOther, advisorUser);
      const draftSched = await StudentSchedule.create({
        student: studentOther._id,
        term: defaultTerm._id,
        scheduleType: 'advising',
        status: 'draft',
        version: 1,
        createdBy: advisorUser._id,
      });
      createdScheduleIds.push(draftSched._id);

      const res = await call(`/schedules/advising/${studentOther._id}/reopen`, {
        user: advisorUser,
        method: 'POST',
        body: {
          reason: 'Attempting to reopen draft schedule',
          termId: defaultTerm._id,
        },
      });

      assert.ok(
        [400, 409].includes(res.status),
        `Expected 400 or 409 for reopening non-processed schedule, got ${res.status}`
      );
    });

    it('Req 82 (Success): reverts schedule to draft with incremented version on reopen with valid reason', async () => {
      const res = await call(`/schedules/advising/${workflowStudent._id}/reopen`, {
        user: advisorUser,
        method: 'POST',
        body: {
          reason: 'Student needs adjustments after registration week',
          termId: defaultTerm._id,
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.schedule.status, 'draft');

      const saved = await StudentSchedule.findById(workflowSchedule._id);
      assert.equal(saved.status, 'draft');
      assert.ok(saved.version >= 2);

      const activity = await ScheduleActivity.findOne({
        student: workflowStudent._id,
        schedule: workflowSchedule._id,
        action: 'reopened',
      });
      assert.ok(activity);
      assert.equal(activity.reason, 'Student needs adjustments after registration week');
    });
  });
});
