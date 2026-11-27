import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, StudentProfile, AcademicTerm, Course, CourseOffering, ScheduleTemplate, StudentSchedule, WholeScheduleSwapRequest } from '../models/index.js';

const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === 'production' || !uri || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname)) throw new Error('A local development database is required.');
await mongoose.connect(uri);
try {
  const term = await AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 });
  const actor = await User.findOne({ role: 'coordinator', isActive: true });
  const karim = await User.findOne({ email: 'karim.normal@student.guc.edu.eg' });
  const existing = karim && await StudentProfile.findOne({ user: karim._id });
  if (!term || !actor || !existing) throw new Error('Seed the standard local accounts first.');
  const deadline = new Date(Date.now() + 30 * 86400000);
  term.wholeScheduleSwapDeadline = deadline;
  await term.save();
  const specs = [
    ['CSEN401', 'Computer Programming Lab', 4, 'Dr. Hany Samir'],
    ['CSEN501', 'Database I', 6, 'Dr. Salma Adel'],
    ['CSEN601', 'Computer System Architecture', 6, 'Dr. Dina Fouad'],
  ];
  const offerings = [];
  for (const [index, [code, name, creditHours, fullName]] of specs.entries()) {
    let course = await Course.findOne({ code });
    if (!course) course = await Course.create({ code, name, creditHours, courseType: 'core', facultyMajors: ['CS'], recommendedSemester: 4, offeringSeasons: ['spring', 'winter'], lectureHours: 2, tutorialHours: 2, labHours: 2 });
    let offering = await CourseOffering.findOne({ course: course._id, term: term._id });
    if (!offering) offering = new CourseOffering({ course: course._id, term: term._id });
    if (!offering.instructors.length) offering.instructors = [{ fullName }];
    if (!offering.eligibleGroups.some(g => g.major === existing.major && g.semester === existing.currentSemester && !g.studyGroup)) offering.eligibleGroups.push({ major: existing.major, semester: existing.currentSemester });
    for (let group = 91; group <= 94; group++) {
      for (const [component, type] of ['lecture', 'tutorial', 'lab'].entries()) {
        if (offering.slots.some(s => s.groupNumber === String(group) && s.componentType === type)) continue;
        const startMinute = 510 + index * 120;
        offering.slots.push({ componentType: type, groupNumber: String(group), day: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'][(group - 91 + component) % 6], startMinute, endMinute: startMinute + 90, room: `C${index + 2}.${component + 1}01`, capacity: 30 });
      }
    }
    offering.isPublished = true;
    await offering.save();
    offerings.push({ course, offering });
  }
  const templates = new Map();
  for (let group = 91; group <= 94; group++) {
    const courses = offerings.slice(0, group === 94 ? 2 : 3).map(({ course, offering }) => ({ course: course._id, courseOffering: offering._id, slots: offering.slots.filter(s => s.groupNumber === String(group)).map(s => ({ componentType: s.componentType, courseOffering: offering._id, slotGroupId: s._id })) }));
    let template = await ScheduleTemplate.findOne({ term: term._id, major: existing.major, semester: existing.currentSemester, studyGroup: String(group) });
    if (!template) template = await ScheduleTemplate.create({ term: term._id, major: existing.major, semester: existing.currentSemester, studyGroup: String(group), courses, isPublished: true });
    else { template.courses = courses; await template.save(); }
    templates.set(String(group), template);
  }
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const participants = [];
  for (const [i, [email, fullName, group]] of [
    ['karim.normal@student.guc.edu.eg', 'Karim Farouk', '91'],
    ['mariam.swap@student.guc.edu.eg', 'Mariam Mostafa', '92'],
    ['ahmed.swap@student.guc.edu.eg', 'Ahmed Khaled', '93'],
    ['farah.swap@student.guc.edu.eg', 'Farah Mahmoud', '94'],
  ].entries()) {
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ email, fullName, passwordHash, role: 'normalStudent' });
    let student = await StudentProfile.findOne({ user: user._id });
    if (!student) student = await StudentProfile.create({ user: user._id, studentId: `29-99${String(i).padStart(3, '0')}`, studentType: 'normal', major: existing.major, currentSemester: existing.currentSemester, gpa: 3.1 + i * .1, academicStanding: 'goodAcademicStanding', studyGroup: group });
    let schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: 'normal' });
    if (!schedule) {
      const template = templates.get(group);
      schedule = await StudentSchedule.create({ student: student._id, term: term._id, scheduleType: 'normal', status: 'processed', template: template._id, seatsReserved: true, createdBy: actor._id, processedBy: actor._id, processedAt: new Date(), courses: template.courses.map(c => ({ ...c.toObject(), creditHoursSnapshot: offerings.find(o => String(o.course._id) === String(c.course)).course.creditHours })) });
      student.studyGroup = group;
      await student.save();
    }
    // Repair earlier fixture subject codes while preserving completed swaps.
    const fixtureTemplate = [...templates.values()].find(t => String(t._id) === String(schedule.template));
    if (fixtureTemplate) {
      schedule.courses = fixtureTemplate.courses.map(c => ({ ...c.toObject(), creditHoursSnapshot: offerings.find(o => String(o.course._id) === String(c.course)).course.creditHours }));
      await schedule.save();
      await WholeScheduleSwapRequest.updateMany({ student: student._id, term: term._id }, { $set: { courseCodesSnapshot: offerings.slice(0, fixtureTemplate.studyGroup === '94' ? 2 : 3).map(o => o.course.code) } });
    }
    participants.push({ user, student, schedule });
    console.log(`${fullName}: ${email}, Group ${student.studyGroup}`);
  }
  for (const entry of participants.slice(1, 3)) {
    if (await WholeScheduleSwapRequest.exists({ student: entry.student._id, status: 'open' })) continue;
    await WholeScheduleSwapRequest.create({ student: entry.student._id, term: term._id, currentSchedule: entry.schedule._id, currentGroup: entry.student.studyGroup, desiredGroups: ['91', entry.student.studyGroup === '92' ? '93' : '92'], courseCodesSnapshot: offerings.map(o => o.course.code), expiresAt: deadline });
  }
  for (const offering of await CourseOffering.find({ term: term._id, 'slots.groupNumber': { $in: ['91', '92', '93', '94'] } })) {
    for (const slot of offering.slots.filter(s => Number(s.groupNumber) >= 91 && Number(s.groupNumber) <= 94)) {
      const count = await StudentSchedule.countDocuments({ seatsReserved: true, 'courses.slots.slotGroupId': slot._id });
      await CourseOffering.updateOne({ _id: offering._id, 'slots._id': slot._id }, { $set: { 'slots.$.assignedStudentCount': count } });
    }
  }
  console.log('Local swap fixtures ready. New accounts use Password123!; existing passwords and schedules are preserved. Group 94 intentionally has a different subject set.');
} finally { await mongoose.disconnect(); }
