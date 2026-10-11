import mongoose from 'mongoose';
import {
  Course,
  CourseAttempt,
  CourseOffering,
  ExtraHoursRequest,
  MandatoryCourseRemovalRequest,
  ScheduleTemplate,
  SchedulingPreference,
  SlotChangeRequest,
  StudentSchedule,
  WholeScheduleSwapRequest,
} from '../models/index.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI before replacing evaluation courses.');
let hostname;
try {
  hostname = new URL(uri).hostname.toLowerCase();
} catch {
  throw new Error('MONGODB_URI is not a valid MongoDB URL.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
  throw new Error('Evaluation course replacement can only run against a local MongoDB database.');
}

const replacements = new Map([
  ['EVAL2A', 'MATH103'],
  ['EVAL3A', 'CSEN202'],
  ['EVAL6C', 'DMET601'],
  ['EVAL6F', 'DMET603'],
]);

async function replace() {
  await mongoose.connect(uri);
  try {
    const evaluationCourses = await Course.find({ code: /^EVAL/ });
    if (!evaluationCourses.length) {
      console.log('No evaluation courses remain.');
      return;
    }
    const ids = evaluationCourses.map(course => course._id);
    const oldById = new Map(evaluationCourses.map(course => [String(course._id), course.code]));
    const realCourses = await Course.find({ code: { $in: [...replacements.values()] } });
    const realByCode = new Map(realCourses.map(course => [course.code, course]));
    if (realByCode.size !== new Set(replacements.values()).size) throw new Error('A replacement curriculum course is missing.');

    const oldOfferings = await CourseOffering.find({ course: { $in: ids } }).select('_id');
    const offeringIds = oldOfferings.map(offering => offering._id);
    const [schedules, attempts, slotRequests, unsafeCounts] = await Promise.all([
      StudentSchedule.find({ 'courses.course': { $in: ids } }),
      CourseAttempt.find({ course: { $in: ids } }),
      SlotChangeRequest.find({ $or: [
        { course: { $in: ids } },
        { currentOffering: { $in: offeringIds } },
        { replacementOffering: { $in: offeringIds } },
      ] }),
      Promise.all([
        Course.countDocuments({ prerequisites: { $in: ids } }),
        ScheduleTemplate.countDocuments({ $or: [{ 'courses.course': { $in: ids } }, { 'courses.courseOffering': { $in: offeringIds } }] }),
        SchedulingPreference.countDocuments({ 'preferredGroups.course': { $in: ids } }),
        ExtraHoursRequest.countDocuments({ 'courses.course': { $in: ids } }),
        MandatoryCourseRemovalRequest.countDocuments({ course: { $in: ids } }),
        WholeScheduleSwapRequest.countDocuments({ courseCodesSnapshot: /^EVAL/ }),
      ]),
    ]);
    if (unsafeCounts.some(Boolean)) throw new Error('Evaluation courses have additional references; review those before removal.');
    if (schedules.length !== 1 || schedules[0].courses.filter(item => oldById.has(String(item.course))).length !== 2) {
      throw new Error('Expected one two-course evaluation schedule; review changed schedules before removal.');
    }
    if (attempts.some(attempt => !replacements.has(oldById.get(String(attempt.course))))) {
      throw new Error('An evaluation course attempt has no replacement mapping.');
    }
    if (slotRequests.some(request => !replacements.has(oldById.get(String(request.course))) || request.replacementOffering)) {
      throw new Error('A slot-change request needs a manual replacement mapping.');
    }

    const realOfferings = await CourseOffering.find({ course: { $in: realCourses.map(course => course._id) }, term: schedules[0].term, isPublished: true });
    const offeringByCourse = new Map(realOfferings.map(offering => [String(offering.course), offering]));
    for (const oldCode of ['EVAL6C', 'EVAL6F']) {
      const target = realByCode.get(replacements.get(oldCode));
      const offering = offeringByCourse.get(String(target._id));
      if (!offering?.eligibleGroups.some(group => group.major === 'DMET' && group.semester === 6) || !offering.slots.some(slot => slot.componentType === 'lecture' && slot.groupNumber === '1')) {
        throw new Error(`${target.code} needs a published DMET semester 6 offering with lecture group 1.`);
      }
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const schedule = await StudentSchedule.findById(schedules[0]._id).session(session);
        for (const item of schedule.courses) {
          const oldCode = oldById.get(String(item.course));
          if (!oldCode) continue;
          const target = realByCode.get(replacements.get(oldCode));
          const offering = offeringByCourse.get(String(target._id));
          item.course = target._id;
          item.courseOffering = offering._id;
          item.creditHoursSnapshot = target.creditHours;
          item.slots = offering.slots.filter(slot => slot.groupNumber === '1').map(slot => ({
            componentType: slot.componentType,
            courseOffering: offering._id,
            slotGroupId: slot._id,
          }));
        }
        await schedule.save({ session });

        for (const oldRequest of slotRequests) {
          const request = await SlotChangeRequest.findById(oldRequest._id).session(session);
          const target = realByCode.get(replacements.get(oldById.get(String(request.course))));
          const offering = offeringByCourse.get(String(target._id));
          request.course = target._id;
          request.currentOffering = offering._id;
          request.currentSlotGroupId = offering.slots.find(slot => slot.componentType === request.componentType && slot.groupNumber === '1')._id;
          await request.save({ session });
        }

        for (const oldAttempt of attempts) {
          const attempt = await CourseAttempt.findById(oldAttempt._id).session(session);
          attempt.course = realByCode.get(replacements.get(oldById.get(String(attempt.course))))._id;
          await attempt.save({ session });
        }

        await CourseOffering.deleteMany({ course: { $in: ids } }, { session });
        await Course.deleteMany({ _id: { $in: ids } }, { session });
      });
    } finally {
      await session.endSession();
    }
    console.log(`Replaced ${attempts.length} course attempts, one schedule, and ${slotRequests.length} slot-change request(s). Removed ${oldOfferings.length} synthetic offerings and ${evaluationCourses.length} evaluation courses.`);
  } finally {
    await mongoose.disconnect();
  }
}

replace().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
