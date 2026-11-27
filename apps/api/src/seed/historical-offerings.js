import mongoose from 'mongoose';
import { AcademicTerm, CourseOffering } from '../models/index.js';
const uri=process.env.MONGODB_URI;
if(process.env.NODE_ENV==='production'||!uri||!['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname))throw new Error('Explicit local development database required.');
await mongoose.connect(uri);
try {
 const active=await AcademicTerm.findOne({isActive:true}).sort({termStart:-1});
 if(!active)throw new Error('An active term is required.');
 const source=await CourseOffering.find({term:active._id}).lean();
 if(!source.length)throw new Error('The active term has no offerings to use as demo source data.');
 const terms=await AcademicTerm.find({termStart:{$lt:active.termStart},season:{$in:['winter','spring','summer']}}).sort({termStart:-1});
 for(const term of terms){
  let added=0;
  for(const item of source){
   const result=await CourseOffering.updateOne({term:term._id,course:item.course},{$setOnInsert:{
    term:term._id,course:item.course,isPublished:true,
    instructors:(item.instructors||[]).map(({fullName,email})=>({fullName,email})),
    eligibleGroups:(item.eligibleGroups||[]).map(({major,semester,studyGroup})=>({major,semester,studyGroup})),
    slots:(item.slots||[]).map(({componentType,groupNumber,day,startMinute,endMinute,room,capacity})=>({componentType,groupNumber,day,startMinute,endMinute,room,capacity,assignedStudentCount:0}))
   }},{upsert:true,runValidators:true});
   added+=result.upsertedCount;
  }
  console.log(`${term.season} ${term.academicYear}: ${await CourseOffering.countDocuments({term:term._id})} offerings (${added} added).`);
 }
 console.log('Historical demo offerings ready. Existing offerings, schedules and requests retained.');
} finally {await mongoose.disconnect();}
