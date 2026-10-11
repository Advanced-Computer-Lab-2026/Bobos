import mongoose from 'mongoose';
import {
  AcademicTerm,
  Course,
  ExtraHoursRequest,
  MandatoryCourseRemovalRequest,
  SlotChangeRequest,
  StudentProfile,
  StudentSchedule,
  WholeScheduleSwapRequest,
} from '../models/index.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI before seeding pending requests.');

let hostname;
try {
  hostname = new URL(uri).hostname.toLowerCase();
} catch {
  throw new Error('MONGODB_URI is not a valid MongoDB URL.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
  throw new Error('Pending request demo data can only be seeded in a local MongoDB database.');
}

async function profile(studentId) {
  const student = await StudentProfile.findOne({ studentId, studentType: 'advising' });
  if (!student) throw new Error(`Advising student ${studentId} is missing. Run the evaluation seed first.`);
  return student;
}

async function seed() {
  await mongoose.connect(uri);
  try {
    const term = await AcademicTerm.findOne({ isActive: true });
    if (!term) throw new Error('An active academic term is required.');

    const slotStudent = await profile('26-54321');
    const schedule = await StudentSchedule.findOne({ student: slotStudent._id, term: term._id, scheduleType: 'advising' });
    const scheduledCourse = schedule?.courses.find((item) => item.slots.length > 0);
    const slot = scheduledCourse?.slots[0];
    if (!slot) throw new Error('The demo slot change needs an existing scheduled course and slot for 26-54321.');
    const slotFilter = { student: slotStudent._id, term: term._id, preferenceNote: 'Demo pending slot change for advisor filter' };
    if (!await SlotChangeRequest.exists(slotFilter)) {
      await SlotChangeRequest.create({
        ...slotFilter,
        schedule: schedule._id,
        course: scheduledCourse.course,
        componentType: slot.componentType,
        currentOffering: slot.courseOffering,
        currentSlotGroupId: slot.slotGroupId,
        status: 'pending',
      });
      console.log('Created pending slot change for 26-54321.');
    }

    const extraStudent = await profile('61-00002');
    if (!extraStudent.assignedAdvisor) throw new Error('61-00002 needs an assigned advisor.');
    const extraCourse = await Course.findOne({ code: 'PHYS202' });
    if (!extraCourse) throw new Error('PHYS202 is missing. Run the evaluation seed first.');
    if (!await ExtraHoursRequest.exists({ student: extraStudent._id, term: term._id })) {
      const hours = extraCourse.creditHours;
      const allowance = 21;
      await ExtraHoursRequest.create({
        student: extraStudent._id,
        advisor: extraStudent.assignedAdvisor,
        term: term._id,
        courses: [{ course: extraCourse._id, hours, isRepeated: false, pricePerHour: 800, subtotal: hours * 800 }],
        requestedHours: hours,
        totalCost: hours * 800,
        currency: 'EGP',
        eligibilitySnapshot: {
          standardAllowance: allowance,
          hoursBeforeRequest: allowance,
          hoursAfterRequest: allowance + hours,
          isProbation: extraStudent.academicStanding === 'probation',
          graduatingWithinOneYear: false,
        },
        decisionStatus: 'pending',
        settlementStatus: 'none',
      });
      console.log('Created pending extra hours request for 61-00002.');
    }

    const removalStudent = await profile('61-00003');
    if (!removalStudent.assignedAdvisor) throw new Error('61-00003 needs an assigned advisor.');
    const removalCourse = await Course.findOne({ code: 'CSEN301' });
    if (!removalCourse) throw new Error('CSEN301 is missing. Run the evaluation seed first.');
    if (!await MandatoryCourseRemovalRequest.exists({ student: removalStudent._id, term: term._id, course: removalCourse._id })) {
      await MandatoryCourseRemovalRequest.create({
        student: removalStudent._id,
        course: removalCourse._id,
        advisor: removalStudent.assignedAdvisor,
        term: term._id,
        reason: 'incorrectMandatoryDesignation',
        explanation: 'Demo request to review the mandatory course designation.',
        status: 'pending',
      });
      console.log('Created pending course removal request for 61-00003.');
    }

    const openSwaps = await WholeScheduleSwapRequest.countDocuments({ term: term._id, status: 'open' });
    console.log(`Active term ${term.code}: ${openSwaps} existing open schedule swap request(s).`);
    if (openSwaps === 0) console.warn('No open schedule swap exists. Create one through a normal student account to populate that filter.');
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
