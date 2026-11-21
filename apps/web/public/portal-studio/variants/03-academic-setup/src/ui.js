/* Pure, escaped view helpers. No shell, authentication, network, or global listeners. */
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (root,selector) => root.querySelector(selector);
const $$ = (root,selector) => [...root.querySelectorAll(selector)];
const el = (tag,cls='',html='') => {const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n;};
const titleCase = s => String(s||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
const displayCode = s => String(s||'').replace(/^([A-Z]+)(\d)/,'$1 $2');
const shortDate = s => s ? new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'Not set';
const majorLabel = m => ({CS:'Computer Engineering',DMET:'Digital Media Engineering',All:'All majors'}[m] || m);
const termLabel = t => t?.label || (t ? `${titleCase(t.season)} ${t.year.split('/')[t.season==='winter'?0:1]||t.year}` : 'Choose term');
const termOption = (s,id) => s.terms.map(t=>`<option value="${escape(t.id)}" ${t.id===id?'selected':''}>${escape(termLabel(t))} · ${escape(t.year)}</option>`).join('');
const opt = (items,value) => items.map(x=>{const [v,label]=Array.isArray(x)?x:[x,titleCase(x)];return `<option value="${escape(v)}" ${String(v)===String(value)?'selected':''}>${escape(label)}</option>`;}).join('');
const buttonHTML = (text,action,extra='',primary=false) => `<button type="button" class="btn${primary?' primary':''}" data-as-action="${escape(action)}" ${extra}>${escape(text)}</button>`;
const field = (label,name,value='',type='text',attrs='') => `<label>${escape(label)}<input name="${escape(name)}" type="${type}" value="${escape(value)}" ${attrs}></label>`;
const selectField = (label,name,options,attrs='') => `<label>${escape(label)}<select name="${escape(name)}" ${attrs}>${options}</select></label>`;
const checkField = (label,name,checked=false) => `<label class="as-check"><input type="checkbox" name="${name}" ${checked?'checked':''}>${escape(label)}</label>`;
const smallTag = (text,tone='') => `<span class="as-tag ${tone}">${escape(text)}</span>`;
const issueHTML = issues => issues.length ? `<div class="as-errors" role="alert"><strong>Review before continuing</strong><ul>${issues.map(i=>`<li>${i.row?`Row ${i.row} · `:''}${i.field?`${escape(titleCase(i.field))}: `:''}${escape(i.message||i)}</li>`).join('')}</ul></div>` : '';
const factsHTML = fields => `<dl class="as-facts">${fields.map(([name,value])=>`<div><dt>${escape(name)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`;
const emptyHTML = (title,text,action='clear') => `<div class="as-empty" role="status"><h2>${escape(title)}</h2><p>${escape(text)}</p>${action?buttonHTML(action==='clear'?'Clear filters':'Try again',action):''}</div>`;
const kinds=['ledger','index','desk','cards','folders','queue','compare','plan','focus','matrix'];
const choiceNames={
 terms:['Season ledger','Academic-year index','Term desk','Date cards','Window timeline','Deadline queue','Compare terms','Registration calendar','One term at a time','Deadline matrix'],
 courses:['Catalogue ledger','Department index','Course desk','Course shelves','Curriculum folders','Prerequisite queue','Compare courses','Semester map','One course at a time','Attribute matrix'],
 'course-detail':['Course record','Section index','Attributes & context','Attribute cards','Folded record','Dependency trail','Catalogue & term','Curriculum position','One section at a time','Course specification'],
 offerings:['Offering ledger','Publication index','Offering desk','Teaching-group cards','Component folders','Publication queue','Compare offerings','Room & time map','One offering at a time','Capacity matrix'],
 'copy-offerings':['Transfer ledger','Destination index','Transfer desk','Offering cards','Outcome folders','Conflict-first review','Source & destination','Meeting map','Guided transfer','Structure matrix'],
 templates:['Template ledger','Cohort index','Template desk','Group cards','Major folders','Readiness queue','Compare groups','Week at a glance','One group at a time','Component matrix'],
 'template-detail':['Template record','Component index','Week & editor','Course cards','Course folders','Clash-first editor','Saved & working copy','Teaching-week editor','Build one course at a time','Slot-selection matrix'],
 'group-assignments':['Assignment ledger','Group index','Student desk','Student cards','Assignment folders','Unassigned first','Compare student schedules','Destination timetable','One student at a time','Roster matrix']
};
const requirements={terms:[16,17],courses:[18,19,128],'course-detail':[19,20,21],offerings:[22,23,25,26,27],'copy-offerings':[24],templates:[28,29],'template-detail':[28,29],'group-assignments':[30]};
const pageReadRoles={terms:['administrator','coordinator','advisor','normalStudent','advisingStudent'],courses:['administrator','coordinator','advisor','normalStudent','advisingStudent'],'course-detail':['administrator','coordinator','advisor','normalStudent','advisingStudent'],offerings:['administrator','coordinator'],'copy-offerings':['administrator'],templates:['coordinator'],'template-detail':['coordinator'],'group-assignments':['coordinator','administrator']};
const writeRole = page => ['templates','template-detail','group-assignments'].includes(page)?'coordinator':'administrator';
const currentTerm = 'w26';
const storeKey='portal-academic-setup:preview:v2';
const viewKey=page=>'portal-academic-setup:view:'+page;
const memory={};
let fallbackState=null;
function readState(){try {const raw=JSON.parse(localStorage.getItem(storeKey)||'null');if(raw?.schema===2 && Array.isArray(raw.courses)&&Array.isArray(raw.terms)&&Array.isArray(raw.offerings)&&Array.isArray(raw.templates)&&Array.isArray(raw.students))return raw;}catch {}return fallbackState||makeSeed();}
function readView(page){if(memory[page])return memory[page];try {memory[page]=JSON.parse(localStorage.getItem(viewKey(page))||'null')||{};}catch {memory[page]={};}return memory[page];}
function remember(page,view){memory[page]=view;try {localStorage.setItem(viewKey(page),JSON.stringify(view));}catch { /* Selection still works for this tab when browser storage is unavailable. */ }}
function previewSave(before,role,action,payload){
 const live=readState();if(live.revision!==before.revision)throw new DomainError('These preview records changed in another tab. Close this dialog and reload the page before retrying.');
 const result=dispatch(before,role,action,payload);
 try {localStorage.setItem(storeKey,JSON.stringify(result.state));fallbackState=null;}catch {throw new DomainError('Browser storage is unavailable or full. Nothing was saved. Free storage and retry.');}
 return result;
}
function seedHost(state){
 // Only already-existing term milestones are synchronized. Never reset calendarMonth or calendarStyle.
 if(typeof academicTerms!=='undefined')for(const original of academicTerms){const t=state.terms.find(x=>termLabel(x)===original.name);if(t){original.opens=t.registrationStart;original.closes=t.registrationEnd;original.swaps=t.swapDeadline.slice(0,10);}}
}
function courseMark(c){
 const code=displayCode(c?.code),tone=(c?.code||'').startsWith('CSEN701')?'sky':(c?.code||'').startsWith('CSEN703')?'clay':(c?.code||'').startsWith('CSEN704')?'mint':(c?.code||'').startsWith('DMET')?'paper':'sand';
 const paths={sky:'M13 10h18v17H13z M17 14h10v9H17z M16 6v4m6-4v4m6-4v4M16 27v4m6-4v4m6-4v4M9 14h4m-4 8h4m18-8h4m-4 8h4',clay:'M10 18l13-9 13 10-13 10z M23 9v20 M10 18l26 1',mint:'M17 14q6-9 12 0l1 11q-8 7-14-1z M20 12l-2-5m9 5 2-5 M15 17l-6-2m6 8-6 3m20-9 6-2m-5 8 6 3 M23 13v16',paper:'M11 9h23v23H11z M14 26l6-12 10 5-9 11z M20 14l1 16m-7-4 16-7',sand:'M9 10q9-3 13 2 5-5 13-2v20q-8-3-13 1-6-4-13-1z M22 12v19'};
 return `<span class="as-course-mark" data-tone="${tone}" aria-hidden="true"><svg viewBox="0 0 44 40" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[tone]}"/></svg></span>`;
}
function taskArt(kind='file',label=''){
 // Eight explicitly drawn poses. Motion is only triggered by hover/focus or a completed action.
 const poses=Array.from({length:8},(_,i)=>{
  const n=[0,0,2,5,9,12,12,12][i],r=[0,-2,-4,-2,1,0,0,0][i];
  let drawing='';
  if(kind==='calendar')drawing=`<path fill="#e8e4d9" d="M11 12l38-2 2 33-39 2z"/><path fill="#b8cec4" d="M11 12l38-2 1 8-39 2z"/><path d="M19 7v10m20-11 1 10M19 25h5m7-1h5m-16 8h5m7-1h5"/><path stroke="#ad745b" d="M${17+n/6} 33q8-5 12 1-1 6-10 5-6-1-2-6Z"/>`;
  else if(kind==='transfer')drawing=`<path fill="#e8e4d9" d="M5 13l19-2 2 29-20 2z"/><path d="M10 20h9m-8 5h9m-8 5h7"/><g transform="translate(${n} ${-n/5}) rotate(${r} 36 27)"><path fill="#b5cddc" d="M27 14l20 1 1 28-21-1z"/><path d="M32 22h10m-10 5h9m-9 5h10"/></g><path stroke="#927256" d="M24 7q8-6 18 0m-3-5 3 5-6 1"/>`;
  else if(kind==='group')drawing=`<path fill="#d2d0c0" d="M4 9h22v33H4z"/><path fill="#b9d0c5" d="M36 9h22v33H36z"/><path d="M8 15h14m-14 6h14m18-6h14m-14 6h14M8 35h14m18 0h14"/><g transform="translate(${n*1.9} ${-Math.sin(i/7*Math.PI)*5})"><path fill="#a9c6df" d="M9 25h16v6H9z"/></g>`;
  else if(kind==='week')drawing=`<path fill="#e8e4d9" d="M4 11l54-1-1 34H5z"/><path d="M16 13v28m13-28v28m13-28v28M7 23h48m-48 9h48"/><path fill="#b5d0c3" d="M18 ${13+n/3}h9v7h-9z"/><path fill="#b3cde2" d="M31 26h9v7h-9z"/><path stroke="#ac775b" d="m45 36 3 3 7-7"/>`;
  else drawing=`<path fill="#d7c4a6" d="M5 24l13-2 5 4 33-1-5 19H9z"/><g transform="translate(0 ${-n/1.5}) rotate(${r} 30 27)"><path fill="#e8e4d9" d="M17 9l24-1 3 28-26 2z"/><path d="M23 16h12m-12 6h12m-11 6h8"/></g><path fill="#bad0c6" d="M7 29l46-2-3 17-41 1z"/>`;
  return `<g transform="translate(${i*64} 0)">${drawing}</g>`;
 }).join('');
 return `<svg class="as-task-art" viewBox="0 0 64 52" ${label?`role="img" aria-label="${escape(label)}"`:'aria-hidden="true"'} fill="none" stroke="#454139" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><g class="as-strip">${poses}</g></svg>`;
}
function weeklyHTML(state,meetings,label='Weekly timetable'){
 return `<section class="as-week" tabindex="0" aria-label="${escape(label)}">${['Sunday','Monday','Tuesday','Wednesday','Thursday','Saturday','Friday'].filter(day=>['Sunday','Monday','Tuesday','Wednesday','Thursday'].includes(day)||meetings.some(m=>m.day===day)).map(day=>`<div class="as-week-day"><h3>${day}</h3>${meetings.filter(m=>m.day===day).sort((a,b)=>a.start-b.start).map(m=>{const c=courseBy(state,m.course)||{code:'',name:'Meeting'};return `<article class="as-meeting"><span>${time(m.start)}–${time(m.end)}</span><strong>${escape(displayCode(c.code))}</strong><small>${escape(c.name)}</small><small>${titleCase(m.type)} ${escape(m.group)} · ${escape(m.room)}</small></article>`;}).join('')||'<p class="as-free">No classes</p>'}</div>`).join('')}</section>`;
}
