/** Pure local-demo rules. These are deliberately separate from presentation.
 * This module does not claim to replace the MongoDB/Express transaction layer.
 */
import { SEED } from './seed.js';
import { DAYS, SEASONS, DEMO_NOW } from './config.js';
export const clone = value => structuredClone(value);
export const courseBy = (s,id) => s.courses.find(c=>c.id===id);
export const termBy = (s,id) => s.terms.find(t=>t.id===id||t.code===id);
export const offeringBy = (s,id) => s.offerings.find(o=>o.id===id);
export const templateBy = (s,id) => s.templates.find(t=>t.id===id);
export const remaining = slot => Math.max(0,Number(slot.capacity)-Number(slot.assigned));
export const minutes = value => { const m=/^(\d{2}):(\d{2})$/.exec(String(value)); return m&&+m[1]<24&&+m[2]<60 ? +m[1]*60 + +m[2] : NaN; };
export const time = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const overlaps = (a,b) => a.day===b.day && a.start<b.end && b.start<a.end;
const unique = values=>[...new Set(values)];
let serial=0;
const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${(++serial).toString(36)}`;
export class DomainError extends Error { constructor(message,issues=[]){super(message);this.name='DomainError';this.issues=issues;} }
const fail=(message,issues=[])=>{throw new DomainError(message,issues);};
const issue=(field,message,extra={})=>({field,message,...extra});
const check=issues=>{if(issues.length)fail('Review the highlighted details. Nothing was changed.',issues);};
const requireRole=(role,needed)=>{if(![].concat(needed).includes(role))fail(`Only ${needed==='coordinator'?'a Coordinator':'an Administrator'} may perform this action.`,[issue('role','This role has read-only access. Production access is enforced by the existing API.')]);};
export function expandEntry(state,entry){
 const o=offeringBy(state,entry.offering);if(!o)return [];
 const keys=new Set(entry.slots.map(id=>o.slots.find(s=>s.id===id)).filter(Boolean).map(s=>`${s.type}|${s.group}`));
 return o.slots.filter(s=>keys.has(`${s.type}|${s.group}`)).map(s=>({...s,offering:o.id,course:o.course}));
}
export function expandTemplate(state,t){return (t?.entries||[]).flatMap(e=>expandEntry(state,e));}
export function studentForTerm(student,term){
 const record=student.termAssignments?.[term]||(student.schedule?.term===term?{assignment:student.assignment,schedule:student.schedule}:null);
 return {...student,assignment:record?.assignment||null,schedule:record?.schedule||null};
}
export function makeSeed(){
 const s=clone(SEED);
 for(const student of s.students){if(student.assignment){const t=templateBy(s,student.assignment);student.schedule={status:'processed',term:t.term,template:t.id,version:t.version,slots:expandTemplate(s,t),courseIds:t.entries.map(e=>offeringBy(s,e.offering).course)};student.termAssignments={[t.term]:{assignment:t.id,schedule:clone(student.schedule)}};}else student.termAssignments={};}
 return s;
}
export function validateTerm(s,t){
 const errors=[];
 for(const field of ['code','year','season','termStart','termEnd','registrationStart','registrationEnd','teachingStart','teachingEnd','advisingDeadline','swapDeadline'])if(!String(t[field]??'').trim())errors.push(issue(field,'This value is required.'));
 if(!SEASONS.includes(t.season))errors.push(issue('season','Choose a supported academic season.'));
 for(const field of ['termStart','termEnd','registrationStart','registrationEnd','teachingStart','teachingEnd','advisingDeadline','swapDeadline'])if(t[field]&&!Number.isFinite(Date.parse(t[field])))errors.push(issue(field,'Enter a valid date.'));
 for(const [start,end] of [['termStart','termEnd'],['registrationStart','registrationEnd'],['teachingStart','teachingEnd']])if(t[start]&&t[end]&&t[end]<t[start])errors.push(issue(end,'End must be on or after the start.'));
 if(t.teachingStart<t.termStart)errors.push(issue('teachingStart','Teaching must begin within the term.'));
 if(t.teachingEnd>t.termEnd)errors.push(issue('teachingEnd','Teaching must end within the term.'));
 if(s.terms.some(x=>x.id!==t.id&&x.code.toLowerCase()===String(t.code).trim().toLowerCase()))errors.push(issue('code','This term code already exists.'));
 if(s.terms.some(x=>x.id!==t.id&&x.year===t.year&&x.season===t.season))errors.push(issue('year','This academic year and season already exists.'));
 return errors;
}
export function validateCourse(s,c,knownIds=s.courses.map(x=>x.id)){
 const errors=[];
 if(!/^[A-Z0-9][A-Z0-9._-]*$/.test(c.code||''))errors.push(issue('code','Use letters, numbers, dots, underscores or hyphens.'));
 if(!String(c.name||'').trim())errors.push(issue('name','Enter the course name.'));
 if(c.credits===''||c.credits==null||!Number.isFinite(Number(c.credits))||Number(c.credits)<0)errors.push(issue('credits','Credit hours must be a number of zero or more.'));
 if(!['core','elective','huma'].includes(c.type))errors.push(issue('type','Choose core, elective or huma.'));
 if(!Number.isInteger(Number(c.semester))||+c.semester<1||+c.semester>10)errors.push(issue('semester','Choose a whole semester from 1 to 10.'));
 if(!Array.isArray(c.majors)||!c.majors.length)errors.push(issue('majors','Choose a major or All.'));
 if(!Array.isArray(c.seasons)||!c.seasons.length||c.seasons.some(x=>!SEASONS.includes(x)))errors.push(issue('seasons','Choose at least one supported offering season.'));
 if(s.courses.some(x=>x.id!==c.id&&x.code===c.code))errors.push(issue('code','This course code already exists. Open it to update it.'));
 if(new Set(c.prerequisites).size!==c.prerequisites.length)errors.push(issue('prerequisites','Remove the repeated prerequisite.'));
 for(const pre of c.prerequisites||[]){if(pre===c.id)errors.push(issue('prerequisites','A course cannot be its own prerequisite.'));else if(!knownIds.includes(pre))errors.push(issue('prerequisites',`Prerequisite ${pre} is not in the catalogue or this batch.`));}
 for(const value of c.hours||[])if(!Number.isFinite(Number(value))||+value<0)errors.push(issue('hours','Contact hours must be numbers of zero or more.'));
 return errors;
}
export function parseCsv(text){
 if(typeof text!=='string'||!text.trim())fail('Choose or paste a non-empty CSV.');
 if(new TextEncoder().encode(text).length>2*1024*1024)fail('CSV files must be 2 MB or smaller.');
 text=text.replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/).find(l=>l.trim())||'';
 const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let cells=[],field='',quoted=false,closed=false,line=1,rowLine=1;
 const push=()=>{cells.push(field);if(cells.some(x=>x.trim()))rows.push({values:cells,row:rowLine});cells=[];field='';closed=false;};
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quoted=false;closed=true;}else{field+=ch;if(ch==='\n')line++;}}
  else if(ch==='"'&&!field&&!closed)quoted=true;
  else if(ch===delimiter){cells.push(field);field='';closed=false;}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;push();line++;rowLine=line;}
  else if(closed&&ch.trim())fail('Invalid CSV after a quoted field.',[issue('CSV','Separate quoted fields with a delimiter.',{row:line})]);
  else field+=ch;
 }
 if(quoted)fail('The CSV has an unfinished quoted field.',[issue('CSV','Close the quotation mark.',{row:rowLine})]);
 if(field||cells.length)push();
 if(rows.length<2)fail('Include a header and at least one course row.');
 if(rows.length>5001)fail('A file can contain at most 5,000 course rows.');
 return rows;
}
const normalizeHeader=v=>String(v).trim().toLowerCase().replace(/\s+/g,' ');
const list=v=>String(v||'').split(/[;|]/).map(x=>x.trim()).filter(Boolean);
const normalizeSeason=v=>SEASONS.find(s=>s.toLowerCase()===v.toLowerCase().replace(/[\s_-]/g,''))||v;
const aliases={code:['course code','code'],name:['course name','course title','name'],credits:['credit hours','credits','credit hour'],type:['course type','type'],majors:['faculty/major','faculty / major','major','majors','faculty majors','faculty/majors','faculty major'],semester:['recommended semester','semester'],seasons:['offering season','offering seasons','season','seasons'],prerequisites:['prerequisites','prerequisite','prerequisite course codes']};
function curriculumRows(rows,seasons){
 const courses=[];const errors=[];const warnings=[];let semester,major,language=false,skipped=0;
 if(!seasons.length)errors.push(issue('seasons','Choose default offering seasons for this curriculum file.',{row:1}));
 for(const {values:r,row}of rows){
  const a=(r[0]||'').trim(), b=(r[1]||'').trim(),name=(r[2]||'').trim();
  const sem=/^(\d+)(?:st|nd|rd|th)\s+Semester$/i.exec(a);
  if(sem){semester=+sem[1];major=null;language=false;continue;}
  if(/^(English|German) courses/i.test(a)){semester=null;major=null;language=true;continue;}
  const majorMatch=r.join(' ').match(/For\s+(CSEN|DMET)\s+Major/i);
  if(majorMatch){major=majorMatch[1].toUpperCase()==='CSEN'?'CS':'DMET';continue;}
  if(!a||!b||!name||/^course code$/i.test(a))continue;
  if(/xxxx/i.test(b)||a.includes('/')){skipped++;continue;}
  const code=(a+b).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const langHours=/^(\d+(?:\.\d+)?)\s*Hours?$/i.exec((r[3]||'').trim());
  const hours=langHours?[+langHours[1],0,0]:r.slice(3,6).map(x=>Number(x||0));
  const total=langHours?+langHours[1]:Number(r[6]);
  if(!langHours&&hours.reduce((n,x)=>n+x,0)!==total){errors.push(issue('Total Hours',`${code}: Total Hours ${r[6]} does not match component hours ${hours.join(' + ')}. Correct or confirm the source; no automatic repair is applied.`,{row}));}
  const next={row,code,name,credits:total,type:language||a==='HUMA'?'huma':'core',majors:major?[major]:['All'],semester:semester||(language?Number(b[0]):''),seasons,prerequisiteCodes:r.slice(7,10).filter(v=>v&&v.toUpperCase()!=='X').map(v=>v.toUpperCase().replace(/[^A-Z0-9]/g,'')),hours};
  const old=courses.find(c=>c.code===code);
  if(old){old.majors=unique([...old.majors,...next.majors]);old.prerequisiteCodes=unique([...old.prerequisiteCodes,...next.prerequisiteCodes]);warnings.push(`${code} is listed twice. The first recommended semester (${old.semester}) is retained, matching the baseline's singular model; review this before committing.`);}else courses.push(next);
 }
 return {courses,errors,warnings,skipped};
}
export function validateCsv(s,text,defaultSeasons=['winter','spring']){
 let rows;try{rows=parseCsv(text);}catch(e){return {errors:e.issues?.length?e.issues:[issue('CSV',e.message,{row:1})],courses:[],warnings:[],created:0,updated:0};}
 const errors=[],warnings=[];let courses=[],skipped=0;
 const curriculum=rows.some(({values:r})=>normalizeHeader(r[0])==='course code'&&normalizeHeader(r[3])==='lecture hours');
 if(curriculum){const result=curriculumRows(rows,defaultSeasons);courses=result.courses;errors.push(...result.errors);warnings.push(...result.warnings);skipped=result.skipped;}
 else{
  const header=rows[0].values.map(normalizeHeader),indices={};
  for(const [key,names]of Object.entries(aliases)){const matches=header.map((v,i)=>names.includes(v)?i:-1).filter(i=>i>=0);if(matches.length!==1)errors.push(issue(key,matches.length?`Column ${names[0]} appears more than once.`:`Missing required column: ${names[0]}.`,{row:rows[0].row}));else indices[key]=matches[0];}
  if(errors.length)return {errors,courses:[],warnings,created:0,updated:0};
  const seen=new Map();
  for(const {values:r,row}of rows.slice(1)){
   const get=k=>String(r[indices[k]]??'').trim();
   const code=get('code').toUpperCase();
   if(seen.has(code))errors.push(issue('code',`${code} is repeated; first seen on row ${seen.get(code)}.`,{row}));else seen.set(code,row);
   courses.push({row,code,name:get('name'),credits:get('credits')===''?'':Number(get('credits')),type:get('type').toLowerCase()==='humanities'?'huma':get('type').toLowerCase(),majors:/^all(?: majors| faculties)?$/i.test(get('majors'))?['All']:list(get('majors')),semester:Number(get('semester')),seasons:list(get('seasons')).map(normalizeSeason),prerequisiteCodes:list(get('prerequisites')).map(v=>v.toUpperCase())});
  }
 }
 const idMap=new Map(s.courses.map(c=>[c.code,c.id]));for(const c of courses)if(!idMap.has(c.code))idMap.set(c.code,c.code);
 for(const c of courses){c.id=idMap.get(c.code);c.prerequisites=c.prerequisiteCodes.map(x=>idMap.get(x)||x);const known=[...idMap.values()];errors.push(...validateCourse(s,c,known).map(e=>({...e,row:c.row})));}
 if(!courses.length)errors.push(issue('CSV','No importable course records were found.',{row:1}));
 const created=courses.filter(c=>!s.courses.some(old=>old.code===c.code)).length;
 return {errors,courses,warnings,skipped,format:curriculum?'curriculum':'standard',created,updated:courses.length-created};
}
export function validateSlot(s,o,slot,{ignoreConflicts=false}={}){
 const errors=[];
 if(!['lecture','tutorial','lab'].includes(slot.type))errors.push(issue('type','Choose a component type.'));
 if(!String(slot.group||'').trim())errors.push(issue('group','Enter a group number.'));
 if(!DAYS.includes(slot.day))errors.push(issue('day','Choose a day.'));
 if(!Number.isInteger(slot.start)||slot.start<0||slot.start>1439)errors.push(issue('start','Enter a valid start time.'));
 if(!Number.isInteger(slot.end)||slot.end<=slot.start||slot.end>1440)errors.push(issue('end','End must be after the start.'));
 if(!String(slot.room||'').trim())errors.push(issue('room','Enter a room.'));
 if(!Number.isInteger(Number(slot.capacity))||+slot.capacity<0)errors.push(issue('capacity','Capacity must be a whole number of zero or more.'));
 if(+slot.capacity<(slot.assigned||0))errors.push(issue('capacity',`${slot.assigned} students are assigned. Move their assignments before reducing capacity below ${slot.assigned}.`));
 if(!ignoreConflicts&&errors.length===0){
  for(const other of s.offerings.filter(x=>x.term===o.term))for(const meeting of other.slots){
   if(meeting.id===slot.id||!overlaps(meeting,slot))continue;
   const room=meeting.room.toLowerCase()===slot.room.trim().toLowerCase();
   const instructor=other.id!==o.id&&other.instructors.some(x=>o.instructors.some(y=>x.email&&x.email===y.email));
   if(room||instructor)errors.push(issue(room?'room':'start',`${room?'Room '+slot.room:'An instructor'} overlaps ${courseBy(s,other.course)?.code} ${meeting.type} ${meeting.group}, ${meeting.day} ${time(meeting.start)}–${time(meeting.end)}.`));
  }
  // Recheck affected student snapshots, including linked meetings.
  for(const student of s.students){const snapshots=Object.values(student.termAssignments||{}).map(x=>x.schedule).filter(Boolean);if(!snapshots.length&&student.schedule)snapshots.push(student.schedule);for(const snapshot of snapshots.filter(x=>x.slots.some(a=>a.id===slot.id))){
   for(const other of snapshot.slots.filter(x=>x.id!==slot.id))if(overlaps(slot,other))errors.push(issue('start',`This creates a timetable clash for ${student.studentId}. Their processed schedule is protected.`));
  }}
 }
 return errors;
}
export function offeringConflicts(s,o){
 const conflicts=[];
 for(const other of s.offerings.filter(x=>x.term===o.term&&x.id!==o.id))for(const slot of o.slots)for(const target of other.slots){
  if(!overlaps(slot,target))continue;
  const shared=o.instructors.some(a=>other.instructors.some(b=>a.email&&a.email===b.email));
  for(const type of [slot.room.toLowerCase()===target.room.toLowerCase()?'room':null,shared?'instructor':null].filter(Boolean))conflicts.push({type,offering:o.id,slot:slot.id,other:other.id,course:courseBy(s,o.course)?.code,otherCourse:courseBy(s,other.course)?.code,message:`${type==='room'?slot.room:'Shared instructor'} · ${slot.day} ${time(slot.start)}–${time(slot.end)} overlaps ${courseBy(s,other.course)?.code}.`});
 }
 return conflicts;
}
export function offeringBlockers(s,o){
 const blockers=[];
 const assigned=Math.max(0,...o.slots.map(x=>x.assigned));
 if(assigned)blockers.push(`${assigned} assigned students use this offering (maximum component occupancy).`);
 const templates=s.templates.filter(t=>t.entries.some(e=>e.offering===o.id));
 if(templates.length)blockers.push(`${templates.length} schedule template${templates.length===1?'':'s'} reference this offering.`);
 if(o.externalReferences?.slotChanges)blockers.push(`${o.externalReferences.slotChanges} pending or approved slot-change requests reference it.`);
 if(o.externalReferences?.plans)blockers.push(`${o.externalReferences.plans} submitted or accepted graduation plans reference it.`);
 if(o.externalReferences?.schedules)blockers.push(`${o.externalReferences.schedules} active or processed schedules reference it.`);
 return blockers;
}
export function publicationIssues(s,o){
 const out=[];
 if(!o.instructors.length)out.push(issue('instructors','Add at least one assigned instructor.'));
 if(!o.eligible.length)out.push(issue('eligible','Add an eligible major and semester.'));
 if(!o.slots.length)out.push(issue('slots','Add at least one teaching group.'));
 const course=courseBy(s,o.course);
 if(!course?.active)out.push(issue('course','The catalogue course is inactive.'));
 if(course?.sourceConflict)out.push(issue('course','Resolve the flagged curriculum discrepancy before publication.'));
 out.push(...offeringConflicts(s,o).map(c=>issue(c.type,c.message)));
 return out;
}
function copiedStructure(source,id,term,slotId){
 return {id,course:source.course,term,instructors:clone(source.instructors),eligible:clone(source.eligible),published:false,slots:source.slots.map(x=>({id:slotId(x),type:x.type,group:x.group,day:x.day,start:x.start,end:x.end,room:x.room,capacity:x.capacity,assigned:0})),externalReferences:{schedules:0,plans:0,slotChanges:0}};
}
export function copyPreview(s,sourceId,targetId,selectedIds){
 const source=termBy(s,sourceId),target=termBy(s,targetId);const errors=[];
 if(!source||!target)errors.push(issue('term','Select existing source and target terms.'));
 else{if(!['winter','spring','summer'].includes(source.season))errors.push(issue('source','Only previous Winter, Spring or Summer terms can be copied.'));if(source.termStart>=target.termStart)errors.push(issue('source','Choose a source term before the target term.'));}
 if(!selectedIds?.length)errors.push(issue('selection','Select at least one source offering.'));
 const selected=s.offerings.filter(x=>selectedIds?.includes(x.id));
 if(selected.length!==new Set(selectedIds||[]).size||selected.some(x=>x.term!==source?.id))errors.push(issue('selection','An offering does not belong to the selected source term.'));
 const skip=selected.filter(x=>s.offerings.some(y=>y.term===target?.id&&y.course===x.course));
 const create=selected.filter(x=>!skip.includes(x));
 const proposed=create.map(o=>copiedStructure(o,`preview-${o.id}`,target?.id,x=>`preview-${x.id}`));
 const next={...s,offerings:[...s.offerings,...proposed]};
 const conflicts=proposed.flatMap(o=>offeringConflicts(next,o));
 return {source,target,errors,create,skip,conflicts};
}
export function validateTemplate(s,t){
 const errors=[];
 if(!termBy(s,t.term))errors.push(issue('term','Choose an existing term.'));
 if(!['CS','DMET'].includes(t.major))errors.push(issue('major','Choose CS or DMET.'));
 if(!Number.isInteger(+t.semester)||+t.semester<1||+t.semester>10)errors.push(issue('semester','Choose a semester from 1 to 10.'));
 if(!String(t.group||'').trim())errors.push(issue('group','Enter the study group.'));
 if(s.templates.some(x=>x.id!==t.id&&x.term===t.term&&x.major===t.major&&+x.semester===+t.semester&&x.group===t.group))errors.push(issue('group','A template for this term, major, semester and group already exists.'));
 if(!t.entries.length)errors.push(issue('entries','Add at least one published offering.'));
 if(new Set(t.entries.map(e=>e.offering)).size!==t.entries.length)errors.push(issue('entries','A course may appear only once.'));
 for(const e of t.entries){
  const o=offeringBy(s,e.offering);if(!o){errors.push(issue('entries','A selected offering no longer exists.'));continue;}
  const c=courseBy(s,o.course);
  if(!o.slots.length)errors.push(issue('entries',`${c.code}: the published offering has no teaching meetings.`));
  if(!o.published||o.term!==t.term)errors.push(issue('entries',`${c.code}: use a published offering from the selected term.`));
  if(!c.majors.includes(t.major)&&!c.majors.includes('All'))errors.push(issue('major',`${c.code} does not serve ${t.major}.`));
  if(!o.eligible.some(g=>(g.major===t.major||g.major==='All')&&(!g.semester||+g.semester===+t.semester)&&(!g.group||g.group===t.group)))errors.push(issue('entries',`${c.code} is not eligible for this major, semester and study group.`));
  const picked=e.slots.map(id=>o.slots.find(x=>x.id===id));
  if(picked.some(x=>!x))errors.push(issue('entries',`${c.code}: a selected group no longer exists.`));
  for(const type of unique(o.slots.map(x=>x.type))){const candidates=picked.filter(x=>x?.type===type);if(candidates.length!==1)errors.push(issue('entries',`${c.code}: choose exactly one ${type} group. All linked meetings are included.`));}
 }
 const meetings=expandTemplate(s,t);
 for(let i=0;i<meetings.length;i++)for(let j=i+1;j<meetings.length;j++)if(overlaps(meetings[i],meetings[j]))errors.push(issue('entries',`${courseBy(s,meetings[i].course).code} and ${courseBy(s,meetings[j].course).code} overlap on ${meetings[i].day} at ${time(Math.max(meetings[i].start,meetings[j].start))}.`));
 return errors;
}
export function assignmentIssues(s,student,t){
 const errors=[];
 if(!student) return [issue('student','Student not found.')];
 if(student.type!=='normal')errors.push(issue('student','Only normal students use standard group assignment. Advising students need an advising draft.'));
 if(!student.active)errors.push(issue('student','The student is inactive. Resolve account/enrollment status first.'));
 if(!t)return [...errors,issue('template','Choose a published group.')];
 if(!t.published)errors.push(issue('template','The destination template is not published.'));
 if(student.major!==t.major||+student.semester!==+t.semester)errors.push(issue('template','The destination must match the student’s major and semester.'));
 errors.push(...validateTemplate(s,t));
 const current=studentForTerm(student,t.term);const old=new Set(current.schedule?.slots.map(x=>x.id)||[]);
 for(const slot of expandTemplate(s,t))if(!old.has(slot.id)&&remaining(slot)<1)errors.push(issue('capacity',`${courseBy(s,slot.course).code} ${slot.type} ${slot.group} is full on ${slot.day}.`));
 return errors;
}
export function deleteBlockers(s,type,id){
 if(type==='course'){
  const c=courseBy(s,id);if(!c)return ['This course no longer exists.'];const out=[];
  const refs=s.courses.filter(x=>x.prerequisites.includes(id));if(refs.length)out.push(`Used as a prerequisite by ${refs.map(x=>x.code).join(', ')}.`);
  const offers=s.offerings.filter(x=>x.course===id);if(offers.length)out.push(`${offers.length} term offerings still reference this course.`);return out;
 }
 if(type==='offering'){const o=offeringBy(s,id);return o?offeringBlockers(s,o):['Offering not found.'];}
 if(type==='template')return s.students.some(x=>x.assignment===id||Object.values(x.termAssignments||{}).some(a=>a.assignment===id))?['One or more student schedules use this template. Reassign or unassign them first.']:[];
 if(type==='slot'){
  const o=s.offerings.find(x=>x.slots.some(sl=>sl.id===id));if(!o)return ['Meeting not found.'];const sl=o.slots.find(x=>x.id===id);const out=[];
  if(sl.assigned)out.push(`${sl.assigned} students are assigned to this meeting.`);
  if(s.templates.some(t=>expandTemplate(s,t).some(a=>a.id===id)))out.push('A schedule template uses this group, including its linked meetings.');return out;
 }
 return [];
}
/** Interpret a datetime-local value in Africa/Cairo, including seasonal offset changes. */
export function cairoInstant(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value||''))return NaN;
 const target=Date.parse(value+'Z');let guess=target;
 const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const p=Object.fromEntries(format.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));const local=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);guess+=target-local;}
 return guess;
}
export function deadlineOpen(term,kind,now=DEMO_NOW){
 const value=kind==='swap'?term.swapDeadline:term.advisingDeadline;
 return Date.parse(now)<=cairoInstant(value);
}
/** Clone, validate and apply a whole action; failures cannot partially mutate the caller. */
export function dispatch(state,role,action,payload={}){
 const s=clone(state);let result={};
 const coordinator=['saveTemplate','deleteTemplate','assignStudent','unassignStudent'].includes(action);
 requireRole(role,coordinator?'coordinator':'administrator');
 if(action==='saveTerm'){
  const old=termBy(s,payload.id);const t={...(old||{}),...payload,id:old?.id||uid('term')};check(validateTerm(s,t));
  if(old)s.terms[s.terms.indexOf(old)]=t;else s.terms.push(t);result={id:t.id,message:`${t.code} ${old?'updated':'created'}. Deadline-dependent actions use the new dates.`};
 }else if(action==='saveCourse'){
  const old=courseBy(s,payload.id);const c={...(old||{}),...payload,id:old?.id||uid('course'),code:String(payload.code||'').trim().toUpperCase(),name:String(payload.name||'').trim(),credits:payload.credits===''?'':Number(payload.credits),semester:Number(payload.semester)};check(validateCourse(s,c));
  if(old)s.courses[s.courses.indexOf(old)]=c;else s.courses.push(c);result={id:c.id,message:`${c.code} ${old?'updated':'created'} in the catalogue.`};
 }else if(action==='importCourses'){
  const batch=validateCsv(s,payload.text,payload.seasons);check(batch.errors);
  for(const c of batch.courses){const old=s.courses.find(x=>x.code===c.code);const {row,prerequisiteCodes,...fields}=c;const next={active:true,hours:[0,0,0],sourceRows:[],sourceNote:'Imported locally in this design preview.',...old,...fields};if(old)s.courses[s.courses.indexOf(old)]=next;else s.courses.push(next);}
  result={created:batch.created,updated:batch.updated,skipped:batch.skipped,message:`${batch.created} created · ${batch.updated} updated. The entire valid batch was committed.`};
 }else if(action==='saveOffering'){
  const old=offeringBy(s,payload.id);const o={instructors:[],eligible:[],slots:[],published:false,externalReferences:{schedules:0,plans:0,slotChanges:0},...old,...payload,id:old?.id||uid('offering')};const errors=[];
  if(!courseBy(s,o.course))errors.push(issue('course','Choose a catalogue course.'));
  if(!termBy(s,o.term))errors.push(issue('term','Choose an existing academic term.'));
  if(s.offerings.some(x=>x.id!==o.id&&x.course===o.course&&x.term===o.term))errors.push(issue('course','This course already has an offering in the target term.'));
  for(const instructor of o.instructors)if(!instructor.name.trim()||!/^\S+@\S+\.\S+$/.test(instructor.email))errors.push(issue('instructors','Each instructor needs a name and a valid email.'));
  for(const g of o.eligible)if(!['CS','DMET','All'].includes(g.major)||!Number.isInteger(+g.semester)||+g.semester<1||+g.semester>10)errors.push(issue('eligible','Choose a major and a semester from 1 to 10.'));
  if(old?.published)errors.push(...publicationIssues({...s,offerings:s.offerings.filter(x=>x.id!==old.id)},o));
  check(errors);if(old)s.offerings[s.offerings.indexOf(old)]=o;else s.offerings.push(o);result={id:o.id,message:`Offering ${old?'updated':'created as a draft'}. Academic year is inherited from ${termBy(s,o.term).code}.`};
 }else if(action==='saveSlot'){
  const o=offeringBy(s,payload.offering);if(!o)fail('Offering not found.');const old=o.slots.find(x=>x.id===payload.id);
  const slot={...payload,id:old?.id||uid('slot'),assigned:old?.assigned||0,capacity:Number(payload.capacity)};delete slot.offering;
  check(validateSlot(s,o,slot));if(old)o.slots[o.slots.indexOf(old)]=slot;else o.slots.push(slot);
  // Existing assignments keep their slot identity; safe metadata edits are reflected in the demo snapshot.
  for(const student of s.students)if(student.schedule)student.schedule.slots=student.schedule.slots.map(x=>x.id===slot.id?{...slot,offering:o.id,course:o.course}:x);
  for(const student of s.students)for(const record of Object.values(student.termAssignments||{}))if(record.schedule)record.schedule.slots=record.schedule.slots.map(x=>x.id===slot.id?{...slot,offering:o.id,course:o.course}:x);
  result={id:o.id,slot:slot.id,message:`${slot.type} ${slot.group} saved. ${remaining(slot)} seats remain; ${slot.assigned} assignments were preserved.`};
 }else if(action==='publication'){
  const ids=unique(payload.ids||[]);if(!ids.length)fail('Select at least one offering.');
  const offers=ids.map(id=>offeringBy(s,id));if(offers.some(x=>!x))fail('An offering no longer exists. Reload before continuing.');
  const errors=offers.flatMap(o=>payload.published?publicationIssues(s,o):offeringBlockers(s,o).map(message=>issue('references',`${courseBy(s,o.course).code}: ${message}`)));check(errors);
  for(const o of offers)o.published=Boolean(payload.published);result={message:`${offers.length} offering${offers.length===1?'':'s'} ${payload.published?'published and available to scheduling':'returned to draft'}.`};
 }else if(action==='copyOfferings'){
  const plan=copyPreview(s,payload.source,payload.target,payload.ids);check(plan.errors);const created=[];
  for(const source of plan.create){const o=copiedStructure(source,uid('offering'),plan.target.id,()=>uid('slot'));s.offerings.push(o);created.push(o.id);}
  result={created,skipped:plan.skip.map(o=>courseBy(s,o.course).code),conflicts:created.flatMap(id=>offeringConflicts(s,offeringBy(s,id))),target:plan.target.id,message:`${created.length} unpublished drafts created · ${plan.skip.length} existing offerings skipped. No students, requests or history were copied.`};
 }else if(action==='saveTemplate'){
  const old=templateBy(s,payload.id);const t={...old,...payload,id:old?.id||uid('template'),semester:Number(payload.semester),group:String(payload.group).trim(),version:(old?.version||0)+1};check(validateTemplate(s,t));
  if(old)s.templates[s.templates.indexOf(old)]=t;else s.templates.push(t);result={id:t.id,message:`Group ${t.group} ${t.published?'published':'saved as a draft'}. Existing processed schedules stay unchanged until reassigned.`};
 }else if(action==='assignStudent'){
  const student=s.students.find(x=>x.id===payload.student),t=templateBy(s,payload.template);check(assignmentIssues(s,student,t));
  const current=studentForTerm(student,t.term);const oldSlots=current.schedule?.slots||[],nextSlots=expandTemplate(s,t),oldIds=new Set(oldSlots.map(x=>x.id)),newIds=new Set(nextSlots.map(x=>x.id));
  for(const o of s.offerings)for(const slot of o.slots){if(oldIds.has(slot.id)&&!newIds.has(slot.id))slot.assigned=Math.max(0,slot.assigned-1);if(newIds.has(slot.id)&&!oldIds.has(slot.id))slot.assigned++;}
  const from=current.assignment;student.assignment=t.id;student.schedule={status:'processed',term:t.term,template:t.id,version:t.version,slots:expandTemplate(s,t),courseIds:t.entries.map(e=>offeringBy(s,e.offering).course)};
  student.termAssignments||={};student.termAssignments[t.term]={assignment:t.id,schedule:clone(student.schedule)};
  student.history.push({from,to:t.id,term:t.term,at:DEMO_NOW,actor:role});result={id:student.id,message:`${student.name} is now in Group ${t.group}. A processed schedule with ${t.entries.length} courses and ${nextSlots.length} meetings is ready.`};
 }else if(action==='unassignStudent'){
  const student=s.students.find(x=>x.id===payload.id);if(!student)fail('Student not found.');
  const term=payload.term||student.schedule?.term,current=studentForTerm(student,term);if(!current.assignment)fail('This student has no group assignment for this term.');
  const ids=new Set(current.schedule?.slots.map(x=>x.id)||[]);for(const o of s.offerings)for(const slot of o.slots)if(ids.has(slot.id))slot.assigned=Math.max(0,slot.assigned-1);
  student.history.push({from:current.assignment,to:null,term,at:DEMO_NOW,actor:role});student.termAssignments||={};student.termAssignments[term]={assignment:null,schedule:null};if(student.schedule?.term===term){student.assignment=null;student.schedule=null;}
  result={id:student.id,message:`${student.name} is unassigned for this term. Their component seats were released; assignment history was retained.`};
 }else if(['deleteCourse','deleteOffering','deleteSlot','deleteTemplate'].includes(action)){
  const type=action.slice(6).toLowerCase(),blockers=deleteBlockers(s,type,payload.id);if(blockers.length)fail('This record is protected. Resolve the references first.',blockers.map(message=>issue('references',message)));
  if(type==='course')s.courses=s.courses.filter(x=>x.id!==payload.id);
  if(type==='offering')s.offerings=s.offerings.filter(x=>x.id!==payload.id);
  if(type==='template')s.templates=s.templates.filter(x=>x.id!==payload.id);
  if(type==='slot')for(const o of s.offerings)o.slots=o.slots.filter(x=>x.id!==payload.id);
  result={message:`Unused ${type} deleted. No student history was removed.`};
 }else if(action==='recordStanding'){
  const student=s.students.find(x=>x.studentId===payload.studentId.trim());if(!student)fail('Student ID was not found. Nothing was recorded.',[issue('studentId','Try a student ID shown in the demo roster, such as 70-71577.')]);
  if(!termBy(s,payload.term))fail('Choose an existing term.');if(!['goodAcademicStanding','probation'].includes(payload.standing))fail('Choose a valid standing.');
  const record={student:student.id,term:payload.term,standing:payload.standing,recordedAt:DEMO_NOW};s.standings=s.standings.filter(x=>!(x.student===student.id&&x.term===payload.term));s.standings.push(record);
  result={message:`Standing recorded for ${student.name}. No email was sent: delivery belongs to the unchanged API and is not simulated as success.`};
 }else fail('Unknown action.');
 s.revision++;s.activity.unshift({id:uid('activity'),action,role,message:result.message,at:DEMO_NOW});s.activity=s.activity.slice(0,80);s.lastResult={...result,action};
 return {state:s,result};
}
