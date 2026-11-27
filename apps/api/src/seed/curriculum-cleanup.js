import mongoose from 'mongoose';import {readFile,writeFile} from 'node:fs/promises';import {parseCurriculumCsv} from '../scripts/importCourses.js';import * as models from '../models/index.js';
const uri=process.env.MONGODB_URI;if(!uri||!['localhost','127.0.0.1','[::1]'].includes(new URL(uri).hostname))throw Error('Local database only');
await mongoose.connect(uri);
try{
 const {courses}=parseCurriculumCsv(await readFile(new URL('../scripts/courses.csv',import.meta.url),'utf8'));const allowed=new Set(courses.map(c=>c.code));const all=await models.Course.find().lean();const norm=c=>c.replace(/[^A-Za-z0-9]/g,'').toUpperCase();const invalid=all.filter(c=>!allowed.has(norm(c.code)));const aliases={B1LAB501:'CSEN704',DMET701:'DMET502',R60CORE1:'CSEN701',R60CORE2:'CSEN703',R60CORE3:'CSEN704',R60HUMA1:'DE303',R60HUMA2:'DE404',R60HUMA3:'DE202',R63REQ1:'CSEN501',R63REQ2:'CSEN503',R63OPT1:'DMET501'};
 const idMap=new Map(),removed=new Set(),offeringDeletes=[];const refs=['Course','CourseOffering','StudentSchedule','ScheduleTemplate','CourseAttempt','SchedulingPreference','GraduationPlan','SlotChangeRequest','MandatoryCourseRemovalRequest','ExtraHoursRequest','ExitExamRequest'];
 const backup={};for(const name of refs)backup[name]=await models[name].find().lean();await writeFile(new URL('../../../../work/curriculum-cleanup-backup.json',import.meta.url),JSON.stringify(backup));
 const session=await mongoose.startSession();await session.withTransaction(async()=>{
 for(const c of invalid){const target=all.find(x=>x.code===aliases[norm(c.code)]);if(target)idMap.set(String(c._id),target._id);else removed.add(String(c._id));
  for(const o of backup.CourseOffering.filter(o=>String(o.course)===String(c._id))){const existing=target&&backup.CourseOffering.find(x=>String(x.course)===String(target._id)&&String(x.term)===String(o.term));if(existing){idMap.set(String(o._id),existing._id);for(const slot of o.slots){const replacement=existing.slots.find(s=>s.componentType===slot.componentType&&s.groupNumber===slot.groupNumber)||existing.slots.find(s=>s.componentType===slot.componentType);if(replacement)idMap.set(String(slot._id),replacement._id);else removed.add(String(slot._id));}offeringDeletes.push(o._id);}else if(!target){removed.add(String(o._id));offeringDeletes.push(o._id);}}
 }
 function rewrite(v){if(v instanceof mongoose.Types.ObjectId)return removed.has(String(v))?undefined:idMap.get(String(v))||v;if(v instanceof Date)return v;if(Array.isArray(v))return v.map(rewrite).filter(x=>x!==undefined);if(v&&typeof v==='object'){if(v.course && removed.has(String(v.course)))return undefined;if(v.slotGroupId&&removed.has(String(v.slotGroupId)))return undefined;const out={};for(const[k,x]of Object.entries(v)){const y=rewrite(x);if(y!==undefined)out[k]=y;}if(out.course&&out.creditHoursSnapshot!=null){const c=all.find(c=>String(c._id)===String(out.course));if(c)out.creditHoursSnapshot=c.creditHours;}return out;}return v;}
 for(const name of refs.filter(n=>n!=='Course'))for(const original of backup[name]){
 if(name==='CourseOffering'&&offeringDeletes.some(id=>String(id)===String(original._id)))continue;
 // Synthetic companion approvals are removed; they do not authorize different real courses.
 const syntheticApproval=name==='ExtraHoursRequest'&&original.courses?.some(e=>invalid.some(c=>/^R60/.test(c.code)&&String(c._id)===String(e.course)));
 const updated=syntheticApproval?undefined:rewrite(original);
 if(!updated){await models[name].collection.deleteOne({_id:original._id},{session});continue;}
 if(JSON.stringify(updated)===JSON.stringify(original))continue;
 if(name==='CourseAttempt'){const duplicate=await models.CourseAttempt.findOne({_id:{$ne:original._id},student:updated.student,course:updated.course,term:updated.term,attemptNumber:updated.attemptNumber}).session(session);if(duplicate){await models.CourseAttempt.collection.deleteOne({_id:original._id},{session});continue;}}
 if(['StudentSchedule','ScheduleTemplate'].includes(name)&&updated.courses){const seen=new Set();updated.courses=updated.courses.filter(c=>{const id=String(c.course);if(seen.has(id))return false;seen.add(id);return true;});}
 await models[name].collection.replaceOne({_id:original._id},updated,{session});
 }
 await models.CourseOffering.deleteMany({_id:{$in:offeringDeletes}},{session});await models.Course.deleteMany({_id:{$in:invalid.map(c=>c._id)}},{session});
 });await session.endSession();console.log(`Removed ${invalid.length} non-curriculum courses; mapped demo references to real courses. Backup saved locally.`);
}finally{await mongoose.disconnect();}
