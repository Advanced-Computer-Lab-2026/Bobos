import mongoose from 'mongoose';
import { AcademicTerm, Course, CourseAttempt, CourseOffering, StudentProfile, StudentSchedule } from '../models/index.js';
import { getFailedAndUnattended, ScheduleTemplate, StudentWorkflowState } from '../models/academics.js';
import { findFirstClash } from '../../../../server/src/utils/timetable.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI before seeding academic history.');

let hostname;
try {
  hostname = new URL(uri).hostname.toLowerCase();
} catch {
  throw new Error('MONGODB_URI is not a valid MongoDB URL.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
  throw new Error('Academic history demo data can only be seeded in a local MongoDB database.');
}

async function addAttempt(student, course, term, result, grade, attemptNumber = 1, attendance = 'attended') {
  const filter = { student: student._id, course: course._id, term: term._id, attemptNumber };
  const { upsertedCount } = await CourseAttempt.updateOne(filter, {
    $setOnInsert: {
      attendance,
      result,
      ...(grade ? { grade } : {}),
    },
  }, { upsert: true });
  return upsertedCount;
}

async function ensureDemoTerm(season, code, start, end) {
  const existing = await AcademicTerm.findOne({ academicYear: '2025/2026', season });
  if (existing) return existing;
  const day = 24 * 60 * 60 * 1000;
  return AcademicTerm.create({
    code,
    academicYear: '2025/2026',
    season,
    termStart: start,
    termEnd: end,
    teachingStart: new Date(start.getTime() + day),
    teachingEnd: new Date(end.getTime() - day),
    registrationStart: new Date(start.getTime() - 14 * day),
    registrationEnd: new Date(start.getTime() - day),
    advisingDeadline: new Date(start.getTime() + 3 * day),
    wholeScheduleSwapDeadline: new Date(start.getTime() + 3 * day),
    isActive: false,
  });
}

function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

async function markCompleteDemoScheduleReady(student, term) {
  const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: 'advising' });
  if (!schedule?.courses.length) throw new Error(`${student.studentId} needs a populated advising draft for the review-ready example.`);

  const template = await ScheduleTemplate.findOne({
    term: term._id,
    major: student.major,
    semester: student.currentSemester,
    isPublished: true,
  }).populate('courses.course', 'code').lean();
  if (!template?.courses.length) throw new Error(`${student.studentId} needs a published template for the current major and semester.`);

  const requiredCourseIds = new Set(template.courses.map((item) => String(item.course?._id || item.course)));
  const selectedCourseIds = new Set(schedule.courses.map((item) => String(item.course)));
  if (requiredCourseIds.size !== selectedCourseIds.size || [...requiredCourseIds].some((courseId) => !selectedCourseIds.has(courseId))) {
    throw new Error(`${student.studentId}'s review-ready draft must include every course in the published template.`);
  }

  const offeringIds = schedule.courses.map((item) => item.courseOffering);
  const offerings = await CourseOffering.find({ _id: { $in: offeringIds }, term: term._id, isPublished: true })
    .populate('course', 'code creditHours prerequisites')
    .lean();
  const offeringById = new Map(offerings.map((offering) => [String(offering._id), offering]));
  const passed = new Set((await CourseAttempt.distinct('course', { student: student._id, result: 'passed' })).map(String));
  const scheduledSlots = [];
  let totalCredits = 0;

  for (const item of schedule.courses) {
    const offering = offeringById.get(String(item.courseOffering));
    if (!offering || String(offering.course?._id) !== String(item.course)) {
      throw new Error(`${student.studentId}'s draft has a missing or unpublished course offering.`);
    }
    if ((offering.course.prerequisites || []).some((courseId) => !passed.has(String(courseId)))) {
      throw new Error(`${offering.course.code} has a prerequisite the demo student has not passed.`);
    }
    const components = new Set((offering.slots || []).map((slot) => slot.componentType));
    const chosenComponents = new Set();
    if (!components.size || item.slots.length !== components.size) {
      throw new Error(`${offering.course.code} needs a selected group for every required component.`);
    }
    for (const reference of item.slots) {
      if (chosenComponents.has(reference.componentType)) throw new Error(`${offering.course.code} has more than one selected ${reference.componentType} group.`);
      const slot = offering.slots.find((candidate) => String(candidate._id) === String(reference.slotGroupId));
      if (!slot || slot.componentType !== reference.componentType || slot.assignedStudentCount >= slot.capacity) {
        throw new Error(`${offering.course.code} has an invalid or full selected slot.`);
      }
      if (!Number.isInteger(slot.startMinute) || !Number.isInteger(slot.endMinute) || slot.endMinute <= slot.startMinute) {
        throw new Error(`${offering.course.code} has an invalid selected slot time.`);
      }
      chosenComponents.add(reference.componentType);
      scheduledSlots.push({ day: slot.day, startTime: formatTime(slot.startMinute), endTime: formatTime(slot.endMinute), courseCode: offering.course.code });
    }
    if ([...components].some((component) => !chosenComponents.has(component))) {
      throw new Error(`${offering.course.code} is missing a required slot.`);
    }
    totalCredits += Number(offering.course.creditHours || 0);
  }

  const mandatory = await getFailedAndUnattended(student._id, term._id);
  if (mandatory.some((attempt) => !selectedCourseIds.has(String(attempt.course?._id)))) {
    throw new Error(`${student.studentId}'s review-ready draft is missing a mandatory failed or unattended course.`);
  }
  const clash = findFirstClash(scheduledSlots);
  if (clash) throw new Error(`${student.studentId}'s review-ready draft has overlapping slots.`);
  if (totalCredits > 34) throw new Error(`${student.studentId}'s review-ready draft exceeds the 34-hour overall limit.`);

  if (schedule.status !== 'readyForStudentReview') {
    schedule.status = 'readyForStudentReview';
    schedule.processedBy = null;
    schedule.processedAt = null;
    schedule.version += 1;
    await schedule.save();
  }
  const now = new Date();
  await StudentWorkflowState.updateOne(
    { student: student._id, term: term._id },
    { $set: { student: student._id, term: term._id, studentType: 'advising', status: 'readyForStudentReview', blockingStep: null, lastActivityAt: now, calculatedAt: now } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function seed() {
  await mongoose.connect(uri);
  try {
    const [activeTerm, previousSpring, previousWinter] = await Promise.all([
      AcademicTerm.findOne({ isActive: true }),
      AcademicTerm.findOne({ code: '58-' }),
      AcademicTerm.findOne({ code: '59-' }),
    ]);
    if (!activeTerm || !previousSpring || !previousWinter) throw new Error('The active term and evaluation history terms 58-/59- are required.');

    const profiles = await StudentProfile.find({ studentId: { $in: ['26-54321', '61-00001', '61-00002', '61-00003'] }, studentType: 'advising' });
    const students = new Map(profiles.map(profile => [profile.studentId, profile]));
    const [summer, firstMakeup, secondMakeup] = await Promise.all([
      ensureDemoTerm('summer', 'DEMO-25-26-SUM', new Date('2026-06-20T00:00:00Z'), new Date('2026-07-31T00:00:00Z')),
      ensureDemoTerm('firstMakeup', 'DEMO-25-26-M1', new Date('2026-08-01T00:00:00Z'), new Date('2026-08-15T00:00:00Z')),
      ensureDemoTerm('secondMakeup', 'DEMO-25-26-M2', new Date('2026-08-16T00:00:00Z'), new Date('2026-08-31T00:00:00Z')),
    ]);
    const courses = await Course.find({ code: { $in: ['CSEN102', 'CSEN202', 'MATH103', 'COMM401', 'CSEN301', 'MATH203', 'PHYS202', 'DMET601', 'DMET603'] } });
    const catalogue = new Map(courses.map(course => [course.code, course]));
    const examples = [
      ['26-54321', 'CSEN102', previousSpring, 'passed', 'B'],
      ['26-54321', 'MATH103', previousSpring, 'passed', 'C'],
      ['26-54321', 'CSEN202', previousWinter, 'passed', 'B+'],
      ['61-00002', 'CSEN102', previousSpring, 'passed', 'B-'],
      ['61-00002', 'MATH103', previousWinter, 'passed', 'C+'],
      ['61-00003', 'CSEN102', previousSpring, 'passed', 'A-'],
      ['61-00003', 'MATH103', previousWinter, 'passed', 'B'],
      ['61-00003', 'CSEN202', previousWinter, 'failed', 'F'],
      ['26-54321', 'COMM401', summer, 'passed', 'B'],
      ['26-54321', 'CSEN301', firstMakeup, 'failed', 'F', 1],
      ['26-54321', 'CSEN301', secondMakeup, 'passed', 'C', 2],
      // Keep these as open mandatory-course examples for advisor/coordinator testing.
      ['26-54321', 'DMET601', previousWinter, 'failed', 'F'],
      ['26-54321', 'DMET603', previousWinter, 'failed', 'F', 1, 'unattended'],
      ['61-00002', 'MATH203', summer, 'passed', 'B'],
      ['61-00002', 'PHYS202', firstMakeup, 'failed', 'F', 1],
      ['61-00002', 'PHYS202', secondMakeup, 'passed', 'C+', 2],
    ];

    let created = 0;
    for (const [studentId, code, term, result, grade, attemptNumber = 1, attendance = 'attended'] of examples) {
      const student = students.get(studentId);
      const course = catalogue.get(code);
      if (!student || !course) throw new Error(`Missing demo student ${studentId} or course ${code}.`);
      created += await addAttempt(student, course, term, result, grade, attemptNumber, attendance);
    }

    const layla = students.get('26-54321');
    const schedule = await StudentSchedule.findOne({ student: layla._id, term: activeTerm._id, scheduleType: 'advising' });
    if (!schedule?.courses.length) throw new Error('26-54321 needs an advising schedule for current-course examples.');
    if (schedule.status !== 'draft') {
      await StudentSchedule.updateOne({ _id: schedule._id }, {
        $set: { status: 'draft', processedBy: null, processedAt: null },
        $inc: { version: 1 },
      });
    }
    for (const item of schedule.courses) {
      created += await addAttempt(layla, { _id: item.course }, activeTerm, 'current');
    }
    await markCompleteDemoScheduleReady(students.get('61-00001'), activeTerm);
    console.log(`Academic history demo records added: ${created}. Layla's schedule is an editable draft, and 61-00001's complete schedule is Ready for Student Review.`);
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
