import mongoose from 'mongoose';
import { AcademicTerm, Course, CourseOffering, StudentProfile, StudentSchedule, ScheduleActivity, User } from '../models/index.js';
const uri=process.env.MONGODB_URI;
if(process.env.NODE_ENV==='production'||!uri||!['127.0.0.1','localhost','[::1]'].includes(new URL(uri).hostname))throw new Error('Explicit local development database required.');
await mongoose.connect(uri);
try {
const term=await AcademicTerm.findOne({isActive:true}).sort({termStart:-1});
if(!term)throw new Error('No active term.');
const actor=await User.findOne({email:'nadia.coordinator@guc.edu.eg'});
if(!actor)throw new Error('Seed standard demo accounts first.');
const specs=[['CSEN 701','Embedded Systems',5,[['lecture','Sunday',510,'C2.301'],['tutorial','Tuesday',600,'C2.204']]],
['CSEN 703','Analysis & Design of Algorithms',5,[['tutorial','Sunday',720,'C3.104'],['lecture','Tuesday',510,'C3.202']]],
['CSEN 704','Advanced Computer Lab',4,[['lab','Monday',600,'C7.102'],['lecture','Tuesday',840,'C7.301']]],
['DMET 701','Computer Graphics',5,[['lecture','Wednesday',720,'C1.201']]]];
const entries=[];
for(const [code,name,credits,meetings] of specs){
 let course=await Course.findOne({code});
 if(!course)course=await Course.create({code,name,creditHours:credits,courseType:'core',facultyMajors:['CS','DMET'],recommendedSemester:7,offeringSeasons:['winter','spring']});
 let offering=await CourseOffering.findOne({course:course._id,term:term._id});
 if(!offering)offering=await CourseOffering.create({course:course._id,term:term._id,isPublished:true,eligibleGroups:[{major:'CS',semester:7},{major:'DMET',semester:7}],instructors:[{fullName:'Group 4 Demo Faculty',email:'group4.faculty@guc.edu.eg'}],slots:meetings.map(([componentType,day,startMinute,room])=>({componentType,day,startMinute,endMinute:startMinute+90,room,groupNumber:'4',capacity:100}))});
 entries.push({course:course._id,courseOffering:offering._id,creditHoursSnapshot:course.creditHours,slots:offering.slots.map(slot=>({componentType:slot.componentType,courseOffering:offering._id,slotGroupId:slot._id}))});
}
const affected=new Set(entries.map(e=>String(e.courseOffering)));
for(const email of ['layla.advising@student.guc.edu.eg','karim.normal@student.guc.edu.eg']){
 const user=await User.findOne({email});const student=user&&await StudentProfile.findOne({user:user._id});if(!student)throw new Error(`Missing ${email}`);
 let schedule=await StudentSchedule.findOne({student:student._id,term:term._id,scheduleType:student.studentType});
 for(const e of schedule?.courses||[])affected.add(String(e.courseOffering));
 const same=schedule?.status==='processed'&&schedule.courses.length===entries.length&&entries.every(e=>schedule.courses.some(c=>String(c.courseOffering)===String(e.courseOffering)&&c.slots.length===e.slots.length&&e.slots.every(slot=>c.slots.some(saved=>String(saved.slotGroupId)===String(slot.slotGroupId)))));
 if(!same){
 if(!schedule)schedule=new StudentSchedule({student:student._id,term:term._id,scheduleType:student.studentType,createdBy:actor._id});
 else schedule.version++;
 schedule.courses=entries;schedule.status='processed';schedule.seatsReserved=true;schedule.processedBy=actor._id;schedule.processedAt=new Date();await schedule.save();
 if(student.studentType==='advising')await ScheduleActivity.create({student:student._id,term:term._id,schedule:schedule._id,action:'processed',scheduleVersion:schedule.version,actor:actor._id,actorName:actor.fullName,actorEmail:actor.email,actorRole:actor.role});
 }
 student.studyGroup='4';await student.save();
 console.log(`${email}: processed Group 4, ${entries.length} courses, ${entries.reduce((n,e)=>n+e.creditHoursSnapshot,0)} credits.`);
}
for(const id of affected){const o=await CourseOffering.findById(id);if(!o)continue;for(const slot of o.slots){const count=await StudentSchedule.countDocuments({seatsReserved:true,'courses.slots.slotGroupId':slot._id});await CourseOffering.updateOne({_id:o._id,'slots._id':slot._id},{$set:{'slots.$.assignedStudentCount':count}});}}
console.log('Group 4 fixtures use the existing illustrated start times and rooms; each meeting lasts 90 minutes. Other student schedules are unchanged.');
}finally{await mongoose.disconnect();}
