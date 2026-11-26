import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { AcademicTerm, AdvisorAssignment, Course, CourseOffering, User, StudentProfile, StudentSchedule,
  ScheduleActivity, SlotChangeRequest, MandatoryCourseRemovalRequest, ExtraHoursRequest,
  WholeScheduleSwapRequest, GraduationPlan, ExitExamRequest, FinancialTransaction, FinancialReversalRequest } from '../models/index.js';

const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === 'production' || !uri || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(uri).hostname)) {
  throw new Error('B1 seed requires an explicit local development MONGODB_URI.');
}
const password = 'Password123!';
const oid = key => new mongoose.Types.ObjectId(createHash('sha256').update(`bobos-b1-v1:${key}`).digest('hex').slice(0, 24));
let inserted = 0;
async function ensure(Model, key, fields) {
  const id = oid(key);
  if (await Model.exists({ _id: id })) return Model.findById(id);
  // Validate document hooks as well as field validators before inserting fixtures.
  const document = new Model({ _id: id, ...fields });
  await document.save();
  inserted++;
  return document;
}
const day = 86400000;
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
await mongoose.connect(uri);
try {
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const term = await AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 });
  if (!term) throw new Error('Run npm run seed:evaluation --workspace @bobos/api first to create the active term and curriculum.');
  const hash = await bcrypt.hash(password, 10);
  async function account(key, role, name) {
    return ensure(User, `user:${key}`, { email: `b1.${key}@${role.endsWith('Student') ? 'student.guc.edu.eg' : 'guc.edu.eg'}`,
      fullName: `B1 ${name}`, passwordHash: hash, role, isActive: true, isAdvisorInSystem: role === 'advisor' });
  }
  const coordinator = await account('coordinator', 'coordinator', 'Coordinator');
  await account('admin', 'administrator', 'Administrator');
  const advisor = await account('advisor', 'advisor', 'Advisor Salma');
  const advisor2 = await account('advisor2', 'advisor', 'Advisor Karim');
  const names = ['Calendar ready', 'Reopened draft', 'Slot change pending', 'Course removal pending', 'Extra hours approval',
    'Payment choice needed', 'Deferred payment', 'Future graduation plan', 'Exit exam pending', 'Financial reversal', 'Not started'];
  const students = [];
  for (let i = 0; i < names.length; i++) {
    const user = await account(`student${i + 1}`, 'advisingStudent', names[i]);
    const assignedAdvisor = i % 2 ? advisor2 : advisor;
    const profile = await ensure(StudentProfile, `profile:${i + 1}`, { user: user._id, studentId: `91-${String(i + 1).padStart(5, '0')}`,
      studentType: 'advising', faculty: 'MET', major: 'CS', currentSemester: 5, gpa: 2.2,
      academicStanding: 'goodAcademicStanding', advisingReason: 'unattendedCourses', assignedAdvisor: assignedAdvisor._id });
    await ensure(AdvisorAssignment, `assignment:${i + 1}`, { student: profile._id, advisor: assignedAdvisor._id, assignedBy: coordinator._id });
    students.push(profile);
  }
  const normals = [];
  for (let i = 1; i <= 3; i++) {
    const user = await account(`normal${i}`, 'normalStudent', ['Normal assigned', 'Open group swap', 'Completed group swap'][i - 1]);
    normals.push(await ensure(StudentProfile, `normal:${i}`, { user: user._id, studentId: `92-${String(i).padStart(5, '0')}`,
      studentType: 'normal', major: 'CS', currentSemester: 5, gpa: 2.2, academicStanding: 'goodAcademicStanding', studyGroup: String(i) }));
  }
  const course = await ensure(Course, 'course', { code: 'B1LAB501', name: 'B1 Calendar and Workflow Lab', creditHours: 4,
    courseType: 'core', facultyMajors: ['CS'], recommendedSemester: 5, lectureHours: 1, tutorialHours: 1, labHours: 1,
    offeringSeasons: ['winter', 'spring', 'summer'] });
  const offering = await ensure(CourseOffering, `offering:${term.id}`, { course: course._id, term: term._id, isPublished: true,
    instructors: [{ fullName: 'B1 Test Faculty', email: 'b1.faculty@guc.edu.eg' }], eligibleGroups: [{ major: 'CS', semester: 5 }],
    slots: ['lecture', 'tutorial', 'lab'].flatMap((componentType, i) => [1, 2].map(group => ({
      _id: oid(`slot:${term.id}:${i}:${group}`), componentType, groupNumber: String(group), day: ['Monday', 'Tuesday', 'Wednesday'][i],
      startMinute: 540 + group * 120, endMinute: 600 + group * 120, room: `B1.${i + 1}${group}`, capacity: 100 }))) });
  async function schedule(profile, status, version = 1) {
    return ensure(StudentSchedule, `schedule:${term.id}:${profile.id}`, { student: profile._id, term: term._id,
      scheduleType: profile.studentType, status, version, createdBy: advisor._id, seatsReserved: true,
      ...(status === 'processed' ? { processedBy: coordinator._id, processedAt: new Date(today.getTime() + 8 * 3600000) } : {}),
      courses: [{ course: course._id, courseOffering: offering._id, creditHoursSnapshot: 4,
        slots: offering.slots.filter(slot => slot.groupNumber === '1').map(slot => ({ componentType: slot.componentType, courseOffering: offering._id, slotGroupId: slot._id })) }] });
  }
  const schedules = [];
  for (let i = 0; i < 10; i++) schedules.push(await schedule(students[i], i === 0 ? 'processed' : i === 1 ? 'draft' : 'readyForStudentReview', i < 2 ? 61 : 1));
  const normalSchedules = [];
  for (const profile of normals) normalSchedules.push(await schedule(profile, 'processed'));
  // Only the dedicated fixture offering is reconciled. Other offerings and students are untouched.
  for (const slot of offering.slots) {
    const count = await StudentSchedule.countDocuments({ seatsReserved: true, 'courses.slots.slotGroupId': slot._id });
    await CourseOffering.updateOne({ _id: offering._id, 'slots._id': slot._id }, { $set: { 'slots.$.assignedStudentCount': count } });
  }
  await ensure(SlotChangeRequest, 'slot-request', { student: students[2]._id, schedule: schedules[2]._id, term: term._id,
    course: course._id, componentType: 'lecture', currentOffering: offering._id, currentSlotGroupId: offering.slots[0]._id,
    preferenceNote: 'B1 test: prefer the second lecture group.', status: 'pending' });
  await ensure(MandatoryCourseRemovalRequest, 'removal', { student: students[3]._id, advisor: students[3].assignedAdvisor,
    term: term._id, course: course._id, reason: 'incorrectMandatoryDesignation', explanation: 'B1 test coordinator review.', status: 'pending' });
  async function extra(index, decisionStatus, settlementStatus) {
    return ensure(ExtraHoursRequest, `extra:${index}`, { student: students[index]._id, advisor: students[index].assignedAdvisor, term: term._id,
      courses: [{ course: course._id, hours: 4, isRepeated: false, pricePerHour: 800, subtotal: 3200 }], requestedHours: 4, totalCost: 3200,
      eligibilitySnapshot: { standardAllowance: 21, hoursBeforeRequest: 21, hoursAfterRequest: 25, isProbation: false, graduatingWithinOneYear: true },
      decisionStatus, settlementStatus, ...(settlementStatus === 'deferred' ? { settlementOption: 'deferred' } : {}) });
  }
  await extra(4, 'pending', 'none');
  await extra(5, 'approved', 'none');
  await extra(6, 'approved', 'deferred');
  let future = await AcademicTerm.findOne({ termStart: { $gt: term.termStart } }).sort({ termStart: 1 });
  if (!future) {
    const year = new Date(term.termStart).getUTCFullYear() + 2;
    future = await ensure(AcademicTerm, 'future-term', { code: 'B1FUT', academicYear: `${year}/${year + 1}`, season: 'winter',
      termStart: new Date(`${year}-10-01`), termEnd: new Date(`${year + 1}-03-01`), teachingStart: new Date(`${year}-10-05`), teachingEnd: new Date(`${year + 1}-01-20`),
      registrationStart: new Date(`${year}-09-01`), registrationEnd: new Date(`${year}-10-10`), advisingDeadline: new Date(`${year}-10-10`), wholeScheduleSwapDeadline: new Date(`${year}-10-10`), isActive: false });
  }
  await ensure(GraduationPlan, 'graduation', { student: students[7]._id, advisor: students[7].assignedAdvisor, status: 'submitted', submittedAt: new Date(),
    termPlans: [{ term: future._id, courses: [course._id] }] });
  await ensure(ExitExamRequest, 'exit-exam', { student: students[8]._id, advisor: students[8].assignedAdvisor, course: course._id, reason: 'B1 test final failed course.', status: 'pending' });
  const paid = await extra(9, 'approved', 'paid');
  const payment = await ensure(FinancialTransaction, 'payment', { student: students[9]._id, extraHoursRequest: paid._id, kind: 'gatewayPayment',
    amount: 3200, currency: 'EGP', status: 'succeeded', transactionReference: 'B1-PAYMENT-001', occurredAt: new Date() });
  await ensure(FinancialReversalRequest, 'reversal', { student: students[9]._id, extraHoursRequest: paid._id, originalTransaction: payment._id,
    requestedBy: students[9].assignedAdvisor, reversalType: 'refundToWallet', status: 'pending' });
  for (let i = 1; i < 3; i++) await ensure(WholeScheduleSwapRequest, `swap:${i}`, { student: normals[i]._id, term: term._id,
    currentSchedule: normalSchedules[i]._id, currentGroup: String(i + 1), desiredGroups: ['1'], courseCodesSnapshot: [course.code],
    status: i === 1 ? 'open' : 'completed', expiresAt: new Date(today.getTime() + 30 * day),
    ...(i === 2 ? { completedWith: normals[0]._id, completedFromGroup: '1', completedAt: new Date() } : {}) });
  // 120 events span multiple pages, actions, dates and historical staff snapshots.
  for (let i = 0; i < 120; i++) {
    const index = i % 2;
    const action = index === 0 ? 'processed' : 'reopened';
    const actor = i % 4 < 2 ? coordinator : advisor;
    await ensure(ScheduleActivity, `activity:${i}`, { student: students[index]._id, term: term._id, schedule: schedules[index]._id,
      action, scheduleVersion: Math.floor(i / 2) + 2, actor: actor._id,
      actorName: i < 12 ? 'B1 Former Staff Name' : actor.fullName, actorEmail: actor.email, actorRole: actor.role,
      occurredAt: new Date(today.getTime() - (9 - Math.floor(i / 12)) * day + (i % 12) * 3600000),
      ...(action === 'reopened' ? { reason: `B1 test correction ${i + 1}: review the lab group.` } : {}) });
  }
  console.log(`B1 seed ready in database ${mongoose.connection.name}, active term ${term.code}. Inserted ${inserted} documents; existing fixture records retained.`);
  console.log('Password for all B1 accounts: Password123!');
  console.log('Staff: b1.coordinator@guc.edu.eg; b1.admin@guc.edu.eg; b1.advisor@guc.edu.eg; b1.advisor2@guc.edu.eg');
  console.log('Advising students: b1.student1 through b1.student11 @student.guc.edu.eg. Normal students: b1.normal1 through b1.normal3 @student.guc.edu.eg.');
  console.log('Calendar: sign in as b1.student1@student.guc.edu.eg and connect your own Google account. No OAuth tokens or connections are fabricated.');
} finally { await mongoose.disconnect(); }
