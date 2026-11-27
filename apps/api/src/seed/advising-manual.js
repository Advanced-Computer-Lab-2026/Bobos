import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { majorMatches } from '../utils/major.js';
import { createHash } from 'node:crypto';
import { AcademicTerm, User, StudentProfile, AdvisorAssignment, Course, CourseOffering, CourseAttempt, StudentSchedule, SchedulingPreference, ExtraHoursRequest } from '../models/index.js';

const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === 'production' || !uri || !['localhost','127.0.0.1','[::1]','::1'].includes(new URL(uri).hostname)) throw new Error('Manual-test seed requires a local development database.');
const oid = key => new mongoose.Types.ObjectId(createHash('sha256').update(`bobos-advising-manual-v1:${key}`).digest('hex').slice(0,24));
let inserted = 0;
async function ensure(Model, key, fields) {
  const id = oid(key);
  const existing = await Model.findById(id) || (Model === CourseAttempt ? await Model.findOne({student:fields.student,course:fields.course,term:fields.term,attemptNumber:fields.attemptNumber}) : null);
  if (existing) return existing;
  const record = await Model.create({_id:id,...fields}); inserted++; return record;
}
await mongoose.connect(uri);
try {
  const term = await AcademicTerm.findOne({isActive:true}).sort({termStart:-1});
  const past = await AcademicTerm.findOne({termStart:{$lt:term?.termStart}}).sort({termStart:-1});
  const advisor = await User.findOne({email:'b1.advisor@guc.edu.eg'});
  const coordinator = await User.findOne({email:'b1.coordinator@guc.edu.eg'});
  if (!term || !past || !advisor || !coordinator) throw new Error('Active/past terms and B1 staff must exist first.');
  const passwordHash = await bcrypt.hash('Password123!',10);
  async function student(number, name, semester, reason) {
    const user = await ensure(User,`user:${number}`, {email:`b1.req${number}@student.guc.edu.eg`,fullName:`B1 Req ${number} ${name}`,passwordHash,role:'advisingStudent',isActive:true});
    const profile = await ensure(StudentProfile,`student:${number}`,{user:user._id,studentId:`93-000${number}`,studentType:'advising',major:'CS',faculty:'MET',currentSemester:semester,gpa:2.2,academicStanding:'goodAcademicStanding',advisingReason:reason,assignedAdvisor:advisor._id});
    await ensure(AdvisorAssignment,`assignment:${number}`,{student:profile._id,advisor:advisor._id,assignedBy:coordinator._id});
    return profile;
  }
  const bachelor = await student(60,'Bachelor eligible',8,'transfer');
  const mandatory = await student(63,'Mandatory courses',5,'failedCourses');
  const codes = ['CSEN701','CSEN703','CSEN704','DE303','DE404','CSEN501','CSEN503','DMET501'];
  const courses = [];
  for (const code of codes) {
    const course = await Course.findOne({code});
    if (!course) throw new Error(`Import the Excel curriculum first: ${code} is missing.`);
    let offering = await CourseOffering.findOne({course:course._id,term:term._id});
    if (!offering) throw new Error(`Seed curriculum offerings first: ${code} is missing.`);
    for (const semester of [5,8]) if (!offering.eligibleGroups.some(g=>majorMatches(g.major,'CS') && g.semester===semester)) offering.eligibleGroups.push({major:'CS',semester});
    await offering.save(); courses.push(course);
  }
  // Complete this dedicated student's prerequisite curriculum; existing records are retained.
  const curriculum = await Course.find({isActive:true});
  for (const course of curriculum.filter(c=>(!c.facultyMajors?.length || c.facultyMajors.some(major=>majorMatches(major,bachelor.major))) && (/^(AS|SM|CPS|RPW)\d/.test(c.code) || c.recommendedSemester>=1 && c.recommendedSemester<=6))) {
    await ensure(CourseAttempt,`passed:${bachelor.id}:${course.id}`,{student:bachelor._id,course:course._id,term:past._id,attendance:'attended',result:'passed',grade:'B',attemptNumber:1});
  }
  for (const course of courses.slice(5,7)) await ensure(CourseAttempt,`failed:${mandatory.id}:${course.id}`,{student:mandatory._id,course:course._id,term:past._id,attendance:'attended',result:'failed',grade:'F',attemptNumber:1});
  // Two failed German courses are the permitted bachelor exception; every English course stays passed.
  for (const course of courses.slice(3,5)) await CourseAttempt.updateOne({student:bachelor._id,course:course._id,term:past._id},{$set:{result:'failed',grade:'F'}},{runValidators:true});
  for (const course of courses.slice(5,8)) for (const id of course.prerequisites || []) await ensure(CourseAttempt,`prereq:${mandatory.id}:${id}`,{student:mandatory._id,course:id,term:past._id,attendance:'attended',result:'passed',grade:'B',attemptNumber:1});
  const existing = await StudentProfile.findOne({studentId:'91-00011'});
  const existingSchedule = existing && await StudentSchedule.findOne({student:existing._id,term:term._id});
  const preferences = existing && await SchedulingPreference.exists({student:existing._id,term:term._id});
  let draftStudent=existing;
  if (!existing || existingSchedule || preferences) draftStudent=await student(62,'No preferences draft',5,'unattendedCourses');
  for (const profile of [bachelor,draftStudent,mandatory]) {
    const schedule=await StudentSchedule.findOne({student:profile._id,term:term._id});
    console.log(`${profile.studentId}: ${(await User.findById(profile.user)).fullName}; ${schedule?.status || 'no schedule'}; preferences=${Boolean(await SchedulingPreference.exists({student:profile._id,term:term._id}))}`);
  }
  console.log(`Manual-test fixtures ready for ${term.season} ${term.academicYear}. Inserted ${inserted} records; existing work retained. Password: Password123!`);
} finally {await mongoose.disconnect();}
