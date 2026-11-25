'use strict';
// Portal Studio with authenticated calendar and student service integrations.
const params = new URLSearchParams(location.search);
const comparePageDesigns = params.get('designs') === 'compare';
const pages = {
  'academic-services':'Academic services', 'graduation-plans':'Graduation plans', overview:'Overview', notifications:'Notifications', profile:'My profile',
  directory:'Student directory', 'extra-hours':'Extra-hours requests', 'student-detail':'Student details', advising:'Advising students',
  'pending-work':'Pending work', 'schedule-activity':'Schedule activity',
  'financial-records':'Financial records', 'mandatory-removals':'Course removals',
  'student-schedules':'Student schedules', 'draft-schedule':'Advising draft',
  courses:'Course catalogue', 'course-detail':'Course details', terms:'Academic terms',
  offerings:'Course offerings', 'copy-offerings':'Copy offerings', templates:'Schedule templates',
  'template-detail':'Template editor', 'group-assignments':'Group assignments',
  'my-schedule':'My schedule', 'my-courses':'Registered courses',
  'schedule-swap':'Eligible swap groups', preferences:'Schedule preferences',
  records:'Academic records', 'my-advisor':'My advisor', 'calendar-sync':'Calendar sync',
  login:'Sign in', forgot:'Forgot password', reset:'Reset password'
};
const roleNames = {coordinator:'Coordinator', administrator:'Administrator', advisor:'Advisor', advisingStudent:'Advising student', normalStudent:'Normal student'};
const authPages = new Set(['login','forgot','reset']);
const previewSessionKey = 'portal-studio-preview-session';
const workspaceSessionKey = 'bobos.token';
const previewEmail = 'demo@portal.test';
const signedIn = () => localStorage.getItem(previewSessionKey) === '1';
const pageKey = key => Object.hasOwn(pages,key) ? key : 'overview';
const returnPage = key => authPages.has(key) ? 'overview' : pageKey(key);
let returnAfterSignIn = returnPage(params.get('next'));

let role = Object.hasOwn(roleNames,params.get('role')) ? params.get('role') : 'coordinator';
let page = pageKey(params.get('page'));
let tab = '';
let testCount = 0;
const readNotifications = new Set();
const notificationKey = id => `${role}:${id}`;
const isNotificationUnread = id => !readNotifications.has(notificationKey(id));
let connected = true;
let inboxArtObserver;
let bellAudio;
let returnFocus;
const studentPreferences = new Map([[0,{days:['Thursday'],groups:Array(4).fill('Group 4'),notes:'I would prefer to keep Thursday free.'}]]);
const preferenceDrafts = new Map();
const preferenceUndo = new Map();
const savedPreferenceSignatures = new Map([...studentPreferences].map(([index, value]) => [index, JSON.stringify(value)]));
function readPreferenceForm() {
  return {days:[...document.querySelectorAll('.dayoff:checked')].map(input=>input.value), groups:[...document.querySelectorAll('[data-course-group]')].map(select=>select.value), notes:document.querySelector('#preference-notes').value};
}
function syncPreferenceSaveButton(animate = false) {
  const save = document.querySelector('[data-action="save-preferences"]');
  if (!save) return;
  const index = student() ? 0 : selectedStudent;
  const current = readPreferenceForm();
  preferenceDrafts.set(index, current);
  const saved = savedPreferenceSignatures.get(index) === JSON.stringify(current);
  save.dataset.saved = String(saved);
  save.setAttribute('aria-pressed', String(saved));
  save.setAttribute('aria-label', saved ? 'Preferences saved. Press again to undo this save.' : 'Save preferences');
  save.querySelector('.preference-save-label').textContent = saved ? 'Saved' : 'Save preferences';
  if (animate) {
    save.classList.remove('bookmark-changed');
    void save.offsetWidth;
    save.classList.add('bookmark-changed');
  }
}
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const student = () => ['normalStudent','advisingStudent'].includes(role);
const person = () => student() ? 'Omar Hassan' : role === 'advisor' ? 'Dr. Salma Adel' : role === 'administrator' ? 'Youssef Ali' : 'Nadia Ahmed';
const href = (target,index=selectedStudent,course=selectedCourse) => {
  const destination = authPages.has(target) ? returnAfterSignIn : target;
  const preserveStudent = ['draft-schedule','student-detail'].includes(destination) || (destination === 'preferences' && !student());
  const look = productionPreview ? '&preview=live' : `&layout=${lab.layout+1}&palette=${lab.palette+1}&mode=${lab.dark?'dark':'light'}`;
  const serviceScreen = destination === 'academic-services' && new URLSearchParams(location.search).get('screen');
  return `?page=${target}&role=${role}${look}${comparePageDesigns?'&designs=compare':''}${target==='login' && comparePageDesigns && params.has('image')?`&image=${signinImage.id}`:''}${authPages.has(target)&&destination!=='overview'?`&next=${destination}`:''}${preserveStudent?`&student=${index}`:''}${destination==='course-detail'?`&course=${encodeURIComponent(course[0])}`:''}${serviceScreen?`&screen=${encodeURIComponent(serviceScreen)}`:''}`;
};

const link = (target, text, cls='', index) => `<a class="${cls}" href="${href(target,index)}" data-page="${target}"${index===undefined?'':` data-student="${index}"`}>${text}</a>`;
const navigationLabel = id => pages[id];
const navigationLink = link;
const button = (text, action, cls='btn', extra='') => `<button class="${cls}" type="button" data-action="${action}" ${extra}>${text}</button>`;
// The outline names the state even when the timetable colors are unavailable.
const statusMarks = {
  ready: '<path d="m2 12 4-7 14-.5 2 8-2 6-17 1Z"/><path class="mark-ink" d="m3 12 6-.3 1.4 2.4 4-.2 1.2-2.6 5.8-.3"/>',
  draft: '<path d="m3 20 2-7L16.5 2a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 18Z"/><path class="mark-ink" d="m5.4 13.4 3.5 4m5.2-13 4.4 4.4M3.8 18l1.1 1"/>',
  blank: '<path d="M5 2.5 16 2l4 4.5-.6 15-15 .3Z"/><path class="mark-ink" d="m15.7 2.7-.2 4.8 4.2-.5M8 14l7-.4"/>',
  pending: '<path d="m5 2.7 14-.4-.1 3.2c0 3-2.4 5-5.5 6.5 3.6 1.9 5.4 4 5.3 6.7l.1 2.4-14 .4.2-2.8c0-3.2 2.1-5 5.1-6.7-3.4-1.9-5.3-4-5.1-6.5Z"/><path class="mark-ink" d="m8.4 7.3 6.6-.2m-6.4 11.3 3.3-3.3 3.6 3.1Z"/>',
  complete: '<path d="M21.6 11.6c.3 6.3-4.5 10.1-10 10.1C5.9 21.8 2 17.3 2.3 12 2.1 6.4 6.3 2.4 12 2.2c5.5-.2 9.6 4.1 9.6 9.4Z"/><path class="mark-ink" d="m6.8 12 3.4 3.6L17.9 8"/>',
  warning: '<path d="m10.2 3.9-8 14.8q-.8 1.8 1.3 2l17.2-.4q1.7 0 .8-1.7l-8-14.9q-1.6-2.5-3.3.2Z"/><path class="mark-ink" d="m12 8.7-.1 5.1m.1 2.9v.3"/>',
  archived: '<path d="m4 7 15.8-.4-.4 14-15 .4Z"/><path d="m2.3 3.7 19-.5.2 4.5-19.1.6Z"/><path class="mark-ink" d="m9 12.4 5-.2"/>',
  upcoming: '<path d="m3 5 17.5-.5.5 16-18 .5Z"/><path class="mark-ink" d="m3 9 17.6-.5M7 2.8l.1 4.1m9.1-4.3.1 4.1m-7.9 8 7-.2m-2.7-2.7 2.8 2.7-2.7 2.8"/>'
};
function badge(text, tone='') {
  if (page==='overview') return `<span class="badge ${tone}">${icon(tone==='draft'?'edit':tone==='neutral'?'circle':tone==='pending'||tone==='payment-pending'?'clock':tone==='ready'||tone==='review'?'inbox':'check')}${text}</span>`;
  const kind = ({
    'Ready for review':'ready', Draft:'draft', 'Not started':'blank', Complete:'complete', Published:'complete',
    Upcoming:'upcoming', Archived:'archived', Ended:'archived', Unassigned:'warning', Rejected:'warning'
  })[text] || ({pending:'pending','payment-pending':'pending',review:'ready',ice:'upcoming',neutral:'blank'})[tone] || 'complete';
  return `<span class="badge ${tone}" data-state="${kind}"><svg class="icon status-mark" viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">${statusMarks[kind]}</svg>${text}</span>`;
}
const names = ['Omar Hassan','Mariam Mostafa','Ahmed Khaled','Farah Mahmoud','Youssef Tarek','Laila Amr','Nour Ibrahim','Salma Tamer','Kareem Mostafa','Yasmin Adel','Ali Nabil','Hana Sherif'];
function studentIndex(query) {
  const index = Number(query.get('student'));
  return Number.isInteger(index) && index >= 0 && index < names.length ? index : 0;
}
let selectedStudent = studentIndex(params);
const scheduleStates = ['Ready for review','Draft','Ready for review','Ready for review','Draft','Not started','Ready for review','Ready for review','Not started','Ready for review','Draft','Draft'];
const readyStudents = names.map((name, index) => ({name, index})).filter(({index}) => scheduleStates[index] === 'Ready for review');
const statusTone = state => state === 'Ready for review' ? 'ready' : state === 'Draft' ? 'draft' : 'neutral';
function icon(name) {
  const paths = {
    home:'M3 10 12 3l9 7v10H6V10m3 10v-7h6v7',
    people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-10a4 4 0 0 0 0-8m6 18v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
    book:'M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3z',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', check:'m5 12 4 4L19 6',
    clock:'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    moon:'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',
    menu:'M4 6h16M4 12h16M4 18h16', circle:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    edit:'m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z',
    inbox:'M4 4h16l2 11v5H2v-5zM2 15h6l2 3h4l2-3h6'
  };
  return `<svg class="icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.book}"/></svg>`;
}
function queueIcon(name) {
  const drawings = {
    'course-removal': `<path d="M4 5.5h13.5a2 2 0 0 1 2 2v4M4 5.5A2 2 0 0 0 2 7.5V19a2 2 0 0 0 2 2h8M2 10h17.5M6.25 3.5v4m9-4v4"/>
      <path d="M6 13.5h2m-2 3.5h3" opacity=".52"/>
      <circle class="queue-icon-accent queue-icon-stamp" cx="17.75" cy="17.75" r="4.5"/>
      <path class="queue-icon-accent" d="M15.75 17.75h4"/>`,
    'advisor-assignment': `<path d="M8 6h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-3.5l-4 3v-3H8a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z"/>
      <path d="M5 7.5A3 3 0 0 0 2 10.5v5a3 3 0 0 0 3 3h1.5l1.5 1.5v-1.5" opacity=".58"/>
      <path class="queue-icon-accent" d="M9 10.5h8m-8 2.75h4.5"/>`,
    'group-assignment': `<rect x="9" y="3" width="6" height="5" rx="1.4"/>
      <rect x="2.5" y="16" width="6" height="5" rx="1.3"/>
      <rect x="15.5" y="16" width="6" height="5" rx="1.3"/>
      <path class="queue-icon-accent" d="M12 8v4m-6.5 4v-2.5A1.5 1.5 0 0 1 7 12h10a1.5 1.5 0 0 1 1.5 1.5V16"/>`
  };
  return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24"
    fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    ${drawings[name]}
  </svg>`;
}
// Each row is a drawn exposure: flap tip, left and right paper corners, and wrist tilt.
function removalLetter() {
  const poses = [
    [39,30,30,-6], [38,30,30,-6], [34,30,30,-7], [28,30,30,-7],
    [21,29,30,-6], [15,26,28,-5], [12,21,23,-5], [11,16,18,-4],
    [12,12,13,-4], [12,11,11.5,-4]
  ];
  const frames = poses.map(([tip,left,right,tilt],i)=>{
    const flap = `M11 24Q20 ${(24+tip)/2} 32 ${tip}Q42 ${(24+tip)/2} 55 23Q33 22 11 24Z`;
    const mid = (left+right)/2;
    return `<g class="${i===poses.length-1 ? 'letter-open' : ''}" transform="translate(${64*i} 0) rotate(${tilt} 32 30)">
      <path d="M11 24Q33 22 55 23L54 47Q33 49 12 47Z" fill="#966f5a"/>
      ${tip<24 ? `<path d="${flap}" fill="#d1a485"/>` : ''}
      <g class="letter-sheet">
        <path d="M16 ${left}Q26 ${left-1} 33 ${mid}T50 ${right}L49 43 17 44Z" fill="#fff3da"/>
        <g transform="translate(0 ${mid})">
          <path d="m20 5 13-.4m-10 4 7-.2" stroke="#796b56" stroke-width="1.15"/>
          <path class="request-handwriting" d="m22 15 3-.6 2 .5 3-.6 2 .2 3-.5 5 .2" fill="none" stroke="#796b56" stroke-width="1.15"/>
          <circle cx="40" cy="5" r="3.7" fill="#deab90"/><path d="m38 5 4-.2"/>
        </g>
      </g>
      <path class="letter-pocket" d="M11 24Q20 29 32 36Q44 29 55 23L54 47Q33 49 12 47Z" fill="#eab698"/>
      <path d="m14 44 13-11m25 11-13-11" stroke="#a77760" stroke-width="1.1"/>
      ${tip>=24 ? `<path d="${flap}" fill="#f0c9aa"/>` : ''}
    </g>`;
  }).join('');
  return `<g class="letter-strip">${frames}</g>`;
}
function portalWordmark() {
  return '<img class="portal-brand-mark" src="portal-card-index.svg" width="34" height="34" alt="">Portal';
}
function queueSketch(name) {
  const subjects = {
    'course-removal':name==='course-removal' ? removalLetter() : '',
    'advisor-assignment': `<path class="reply-outline" fill="#bcd1ca" d="M24 24Q29 17 44 19Q58 19 56 32Q56 38 49 40L51 46L41 41Q21 43 24 24Z"/>
      <path class="reply-ink" pathLength="1" stroke="#55665d" d="m40 30 10 1m-12 4 7 .5"/>
      <path class="question-outline" fill="#f3eee1" d="M7 17Q9 8 26 9Q44 7 43 22Q43 32 23 33L11 40L14 31Q4 29 7 17Z"/>
      <path class="question-ink" pathLength="1" d="m14 18 5-.4 4 .5 7-.8 5 .2m-20 6 5-.4 6 .3"/>`,
    'group-assignment': `<g stroke-width="1.35">
      <path class="portrait-left" fill="#b8c9bc" d="M3 37q1-12 10-13 9 0 12 12-10 5-22 1z"/>
      <path fill="#e4c1a1" d="M8 17q0-7 7-7 7 1 6 8-1 8-7 8-6-1-6-9z"/>
      <path fill="#403a33" d="M8 19q-4-10 4-11 9-4 10 7-6 1-9-3-1 5-5 7z"/>
      <g class="arriving-student"><path class="portrait-right" fill="#96b8db" d="M38 37q2-12 11-13 10 1 12 13-12 5-23 0z"/>
      <path fill="#ab8068" d="M43 17q0-8 7-8 7 1 6 9-1 8-7 8-6-1-6-9z"/>
      <path class="portrait-curls" fill="#423830" d="M43 18q-3-4-1-7-1-4 3-4 2-4 6-1 5-2 6 2 4 3 0 8-2-4-4-4-5 3-9 1z"/></g>
      <path class="portrait-collar" fill="#e8d3ae" d="M16 44q2-11 12-14 12 0 15 14-14 4-27 0z"/>
      <path fill="#d1a385" d="M23 22q0-8 8-8 8 1 7 9-1 9-8 9-7-1-7-10z"/>
      <path fill="#544437" d="M22 24q-4-12 4-13 9-4 13 6l-1 6-3-7q-4 4-10 4l-1 5z"/>
      <path d="m26 33 4 4 4-4" stroke="#8c765a"/></g>`

  };
  return `<svg class="queue-sketch" viewBox="0 0 64 52" fill="none" stroke="#352f29" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${subjects[name]}</svg>`;
}
// The term ledger and calendar read the same dated milestones.
const academicTerms = [
  {name:'Winter 2026',year:'2026 / 2027',opens:'2026-11-22',closes:'2026-12-06',swaps:'2026-12-13',status:'Active'},
  {name:'Spring 2027',year:'2026 / 2027',opens:'2027-02-14',closes:'2027-02-28',swaps:'2027-03-07',status:'Upcoming'},
  {name:'Spring 2026',year:'2025 / 2026',opens:'2026-02-15',closes:'2026-03-01',swaps:'2026-03-08',status:'Archived'}
];
const termMilestones = [
  ['opens','Registration opens','sky','Opens'],
  ['closes','Registration closes','gold','Closes'],
  ['swaps','Schedule swaps close','iris','Swaps close']
];
const calendarDate = iso => new Date(iso+'T12:00:00');
const formatCalendarDay = (iso, options) => calendarDate(iso).toLocaleDateString('en-GB',options);
let calendarMonth = 0;
const previewMonth=new URLSearchParams(location.search).get('month');
if (!productionPreview && /^20\d{2}-(0[1-9]|1[0-2])$/.test(previewMonth)){
  const {today}=calendarDates();
  const [year,month]=previewMonth.split('-').map(Number);
  calendarMonth=(year-today.getFullYear())*12+month-1-today.getMonth();
}
function calendarDates() {
  const today = calendarDate(new Date().toLocaleDateString('sv-SE',{timeZone:'Africa/Cairo'}));
  const month = new Date(today.getFullYear(),today.getMonth()+calendarMonth,1,12);
  const prefix = month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0')+'-';
  const deadlines = academicTerms.flatMap(term => termMilestones.filter(([key]) => term[key].startsWith(prefix))
    .map(([key,label,,short]) => ({day:calendarDate(term[key]).getDate(),iso:term[key],label,short,term:term.name})))
    .sort((a,b)=>a.day-b.day);
  return {today,month,deadlines};
}
function calendarAgenda() {
  const {deadlines} = calendarDates();
  return deadlines.length ? `<ul>${deadlines.map(({iso,label})=>`<li><time datetime="${iso}">${formatCalendarDay(iso,{day:'numeric',month:'short'})}</time>${label}</li>`).join('')}</ul>` : '<p>No academic deadlines this month.</p>';
}
const deadlineRing = '<svg class="deadline-ring" viewBox="0 0 36 26" aria-hidden="true"><path class="ring-pencil" d="M29 4C20 0 6 3 4 11c-4 9 7 14 18 12 10-2 13-9 9-15-2-3-6-4-8-4"/><path d="M6 19q5 5 13 4"/></svg>';
// Pen strokes share a baseline but keep the open counters and uneven shoulders of ink.
const numeralStrokes=[
  'M7 2C3 1 1 8 2 12c1 5 6 3 7-2C11 5 10 2 7 2Z',
  'M2 6 7 2l-.8 13m-3.4.2 7-.3',
  'M2 5q3-5 6-2c4 4-4 8-6 12l8-.6',
  'M2 3q5-3 7 0t-5 5q6-1 5 4-1 5-8 2',
  'M7 2 1 10l10-.7M8 5l-.7 11',
  'M10 2 3 2.7l-1 5q6-3 7 2t-4 6q-3 0-4-2',
  'M9 2Q3 3 2 10q-1 7 5 5 4-2 2-6-2-3-7 1',
  'M1 3q4-1 9-1L4 15m0-6 5-.5',
  'M7 2C1 1 1 6 6 8c8 4 2 10-3 7-4-3 0-6 4-8 4-3 3-5 0-5Z',
  'M9 7Q8 0 4 2C0 4 1 10 5 10q3 0 4-4l-3 10'
];
function inkNumber(value){
  const digits=String(value);
  return `<svg class="ink-number" role="img" aria-label="${digits}" viewBox="0 0 ${digits.length*12} 18">${Array.from(digits,(n,i)=>`<path transform="translate(${i*12} 0)" d="${numeralStrokes[n]}"/>`).join('')}</svg>`;
}
function calendarPage(ink=false) {
  const {today,month,deadlines} = calendarDates();
  const lastDay = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const monthName=month.toLocaleString('en-GB',{month:'long'});
  const illustrated=ink && Object.hasOwn(sketchEditions,calendarStyle);
  const cells = Array.from({length:42},(_,index)=>{
    const day = 1-month.getDay()+index;
    if(day<1 || day>lastDay) return '<span></span>';
    const date = new Date(month.getFullYear(),month.getMonth(),day,12);
    const dayEvents = deadlines.filter(event=>event.day===day);
    const current = date.toDateString()===today.toDateString() ? ' aria-current="date"' : '';
    if (!dayEvents.length) return `<span class="folio-date"${current}><b>${ink?inkNumber(day):day}</b></span>`;
    const when=formatCalendarDay(dayEvents[0].iso,{weekday:'long',day:'numeric',month:'long'});
    const entries=dayEvents.map(event=>`<span class="deadline-entry"><strong>${event.label}</strong><small>${event.term}</small></span>`).join('');
    return `<button type="button" class="folio-date marked" ${current} data-deadline aria-label="${when}, ${dayEvents.map(event=>event.label+', '+event.term).join(', ')}" aria-pressed="false"><b>${ink?inkNumber(day):day}</b>${deadlineRing}<span popover="manual" class="deadline-note" aria-hidden="true"><span class="deadline-slip" data-milestone="${dayEvents[0].short}"><span class="deadline-tape"></span><time datetime="${dayEvents[0].iso}"><em>${day}<svg aria-hidden="true" viewBox="0 0 51 43"><path d="M35 5C21 1 6 8 5 22c-2 10 8 16 23 15 12-1 19-8 18-18C45 10 39 7 29 6"/></svg></em><span>${formatCalendarDay(dayEvents[0].iso,{weekday:'short'})}<br>${monthName}</span></time>${entries}</span></span></button>`;

  }).join('');
  return `<div class="folio-inner"><div class="folio-month"><strong>${illustrated || (ink && isConcertina(calendarStyle))?`<span class="sr-only">${monthName}</span>${inkMonth(monthName)}`:monthName}</strong><small>${month.getFullYear()}</small>${illustrated?inkScene(calendarStyle,month.getMonth()):ink && isConcertina(calendarStyle)?seasonDrawing(month.getMonth()):''}</div><div class="folio-days">${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<small>${d}</small>`).join('')}${cells}</div></div>`;
}
// Each cel describes the printed face, its turning underside, and the pencil
// accents visible on that drawing. The three contours change independently.
const calendarCels = [
  [70,'M3 4L296 3 298 192Q156 197 2 194Z','',''],
  [47,'M3 4L296 3 297 172Q288 185 270 193Q127 197 2 194Z','M297 172Q297 187 282 191L270 193Q288 185 297 172Z','M282 188l7-4'],
  [43,'M3 4L296 3 297 146Q278 171 243 189Q146 197 2 194Z','M297 146Q302 164 287 179Q267 189 243 189Q278 170 297 146Z','M273 181q13-5 19-15'],
  [54,'M3 4L296 3 296 112Q270 148 215 169Q150 191 2 190Z','M296 112Q307 133 286 154Q254 182 197 186Q89 197 2 190Q150 191 215 169Q270 148 296 112Z','M264 159q22-13 29-30M162 186q28-2 44-7'],
  [40,'M3 4L296 3 296 83Q254 119 195 138Q102 165 2 159Z','M296 83Q309 102 283 129Q233 168 146 172Q62 179 2 159Q102 165 195 138Q254 119 296 83Z','M269 132q15-9 23-24M29 165q22 6 47 6'],
  [57,'M3 4L296 3 295 57Q245 83 186 96Q91 117 3 111Z','M295 57Q307 78 275 99Q225 133 139 139Q51 145 3 111Q92 117 186 96Q245 83 295 57Z','M20 116q25 15 48 17M248 114q22-9 32-19'],
  [44,'M3 4L296 3 293 34Q238 50 171 55Q80 62 4 55Z','M293 34Q305 49 275 70Q224 102 137 103Q41 104 4 55Q81 62 171 55Q238 50 293 34Z','M16 64q19 23 51 29M253 78l12-7'],
  [56,'M3 4L296 3 289 15Q157 27 4 15Z','M289 15Q307 29 278 43Q220 70 124 64Q42 61 4 15Q155 26 289 15Z','M17 23q17 17 41 26M231 55q22-4 41-13'],
  [43,'','M4 5Q63-5 152-9Q253-14 291-4Q308 3 285 16Q238 41 134 38Q37 35 4 5Z','M40 12q31 15 75 17M251 23l20-8'],
  [58,'','M5 5Q22-20 90-37Q170-56 245-49Q279-46 290-28Q298-10 288 3Q177 16 5 5Z','M34-12q27-16 54-20M255-43q18 3 26 13'],
  [48,'','M5 5Q28-29 99-48Q168-67 225-61Q263-58 276-41Q286-24 290 3Q147 13 5 5Z','M31-18q28-18 55-23M239-55q17 3 25 12'],
  [56,'','M5 5Q28-26 112-38Q193-52 247-39Q277-30 290 3Q190 10 5 5Z','M48-22q33-11 63-14'],
  [44,'','M5 5Q45-14 114-23Q211-35 263-18Q280-12 290 3Q140 9 5 5Z','M155-24q42-4 72-2'],
  [55,'','M5 5Q80-10 159-13Q248-18 290 3Q165 9 5 5Z','M189-10l24 1'],
  [52,'','M5 5Q99-1 192-3Q266-4 290 3Q167 8 5 5Z','']
];
const calendarInkHolds = {
  3:'M296 112Q306 132 287 154Q253 183 197 186Q89 196 2 190Q150 192 215 169Q271 148 296 112Z',
  5:'M295 57Q308 77 276 99Q225 134 139 139Q51 144 3 111Q92 118 186 96Q245 82 295 57Z',
  7:'M289 15Q306 28 278 43Q220 71 124 64Q42 60 4 15Q155 27 289 15Z',
  8:'M4 5Q63-6 152-8Q253-15 291-4Q307 4 285 16Q238 42 134 38Q37 34 4 5Z',
  9:'M5 5Q22-21 90-37Q170-55 245-50Q280-46 290-28Q297-10 288 3Q177 15 5 5Z',
  10:'M5 5Q28-28 99-49Q168-66 225-61Q264-59 276-41Q287-24 290 3Q148 14 5 5Z',
  11:'M5 5Q27-27 112-38Q193-51 247-40Q277-29 290 3Q190 11 5 5Z',
  13:'M5 5Q80-11 159-13Q248-17 290 3Q165 8 5 5Z'
};
// Sparse strokes on the reverse side follow the edges through the turn.
const calendarVerso = [
  '', '', 'M282 176l5-4m-2 4 5-5',
  'M227 175q11-2 17-6m-13 6 16-6m16-11 7-5',
  'M72 167q17 3 32 2m83-13 12-5m-8 5 10-4m37-18 9-6',
  'M63 131q27 6 54 3m11-5 10-1m32-2 14-4m-9 5 12-4m40-8 17-8',
  'M59 88q19 7 48 8m23-2 10-.2m39-4 12-3m-8 5 11-3m38-12 15-7',
  'M62 46q19 7 42 8m27 2 12-.3m47-3 11-3m-9 5 12-3m41-13 11-5',
  'M63 18q21 8 45 8m22 4 15 1m39-2 14-2m-9 4 14-2m33-7 18-6',
  'M61-18q21-11 42-16m28-5 14-3m36-2 11 1m-9 2 14 1m28 3 17 5',
  'M66-31q21-10 39-14m28-5 13-3m32-2 15 1m-10 2 13 1m26 4 16 4',
  'M63-17q22-8 45-12m28-5 15-2m27-1 16 1m-10 2 13 .5',
  'M76-11q17-4 34-7m46-3 17-.5m-14 3 11-.4',
  'M85-5q16-3 31-4m52-2 17 .4', ''
];
const calendarStyles={...concertinaEditions,...sketchEditions,flutter:'Sketchpad',snap:'Matchbook',tide:'Tide table',stiff:'Letterpress',clean:'Clean original'};
const styleKey='portal-teaching-calendar';
const requestedCalendar=new URLSearchParams(location.search).get('calendar');
let calendarStyle=Object.hasOwn(calendarStyles,requestedCalendar)?requestedCalendar:localStorage.getItem(styleKey);
if(productionPreview || !Object.hasOwn(calendarStyles,calendarStyle)) calendarStyle='bellows';

function calendarStylePicker(){
  const options=Object.entries(calendarStyles).map(([key,label])=>
    `<option value="${key}" ${key===calendarStyle?'selected':''}>${label}</option>`).join('');
  return `<label class="edition-picker">Calendar style <select data-calendar-picker>${options}</select></label>`;
}
function calendarFeature(){
  if(isConcertina(calendarStyle)){
    const seam='<svg class="cloth-needle" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true"><path d="M6 10q32-.7 56 .2t50-.4 74 .3 57-.3 51-.4" fill="none" stroke="#ced9d8" stroke-width="1.3" stroke-dasharray="4 3 3.1 2.5 4.4 3"/><path d="m10 9 2 2m2-3 2 2m261-2 4 1.5m2-2 3 2" fill="none" stroke="#3d5362" stroke-width="1.1"/></svg>';
    return (calendarStyle==='linen'?seam:bindingDrawing(calendarStyle))+binderRow('feet');
  }
  const sketches={
    flutter:'<path d="m7 27 20-19 6 6-21 19-8 2 3-8Zm0 0 5 6m13-23 6 6M15 33q10-6 17-4t16-3"/>',
    snap:'<path d="m10 32 14-18m-11 20 14-18M24 14c-4-7 6-15 7-10 3 5 1 11-5 12ZM32 13l6-3m-8-8 2-2m2 16 7 1"/>',
    tide:'<path d="M2 24q6 3 11-4c4-6 8-11 16-9-7 4-7 11 1 12q6 2 14-5M3 29q9 3 14-3m9 3q9 2 18-4M8 13l4-2"/>',
    bellows:'<path d="m2 23 10-13 8 10 9-12 12 11-9 13-11-9-9 10ZM12 10l0 23m8-13 1 3m8-15 3 24"/>',
    stiff:'<path d="m7 17 3-9 25-2 3 10-31 3Zm5 4 23-2 2 4-27 3Zm-7 9 36-3m-31 7 27-2"/>',
    night:'<path d="M17 4C6 8 7 25 21 25q7 0 10-5C19 24 12 13 17 4Z"/><path class="little-stars" d="m31 4 1 4 4 1-4 2-1 4-1-4-4-1 4-2Zm10 11 .8 2 2 .8-2 1-.8 2-1-2-2-1 2-.8Z"/>'
  };
  return sketches[calendarStyle]?`<svg class="binding-sketch" aria-hidden="true" viewBox="0 0 48 38" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${sketches[calendarStyle]}</svg>`:'';
}
function flipSpeedControl(){
  const options=flipRates.map(rate=>`<option value="${rate}"${rate===flipRate?' selected':''}>${rate===0?'Paused':rate+'×'}</option>`).join('');
  return `<div class="flip-playback"><label>Flip speed <select data-flip-speed>${options}</select></label><span data-flip-frame></span>
    <div class="flip-frames" role="group" aria-label="Frame controls">
      <button type="button" data-flip-step="-1" disabled>Previous frame</button>
      <input type="range" min="1" max="1" value="1" step="1" data-flip-scrub aria-label="Animation frame" disabled>
      <button type="button" data-flip-step="1" disabled>Next frame</button>
    </div></div>`;
}
function deskCalendar(teaching=false) {
  return `<section class="desk-calendar${teaching?' teaching-pad':''}" aria-label="Academic calendar" ${teaching?`data-calendar-style="${calendarStyle}" data-concertina="${isConcertina(calendarStyle)}" data-sketch="${Object.hasOwn(sketchEditions,calendarStyle)}" data-season-month="${calendarDates().month.getMonth()}" style="--season-sheet:${seasonalPaper[calendarDates().month.getMonth()][0]};--season-back:${seasonalPaper[calendarDates().month.getMonth()][1]}"`:''}>${teaching?`<header class="calendar-heading"><h2 id="academic-calendar">Academic calendar</h2>${productionPreview?'':calendarStylePicker()}</header>`:''}${teaching?`<div class="binder-body"><div class="calendar-feature">${calendarFeature()}</div>`:''}<div class="folio-stack">${teaching ? binderRow('wires') : ''}
    ${teaching ? '' : `<svg class="folio-stand" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true" stroke="#302f2c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path fill="#8fabbd" d="M6 0Q108-4 276-3q8 0 12 9l20 159q0 5-3 8l-15 26Q163 205-4 200l1-10Z"/>
      <path fill="#607d8d" d="M281 1q6 0 7 6l20 158-16 25Z"/>
      <path fill="#e4dcca" d="M291 126l8 37-6 12Z"/>
      <path fill="#e3dbca" d="M0 181l291-1-1 15q-134 8-293 1Z"/>
      <path fill="none" d="M6 192q113 3 197-1m13 0 64-3"/>
      <path fill="#faf5e8" d="M5 2Q117-1 280 1l10 186q-132 8-292 3Z"/>
      <path fill="#9bbdce" d="M5 2q121-4 275-1l2 38q-136 4-278 1Z"/>
      <path fill="none" stroke="#547b8c" d="M9 37q45 1 67 0m152-1 43-1"/>
    </svg>`}
    <div class="folio-paper" aria-live="polite">${calendarPage(teaching && calendarStyle!=='clean')}</div>
    ${teaching ? '' : `<svg class="folio-wires" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke-linecap="round">
      ${[48,63,220,235].map((x,i)=>`<g transform="translate(${x} ${i%2})"><ellipse cx="1" cy="6" rx="3.6" ry="2.3" fill="#3f5360"/><path d="M1 6C-5 3-6-12-1-14c5-2 9 5 8 12" stroke="#353938" stroke-width="3.7"/><path d="M0 4C-3 0-4-8-1-11" stroke="#cbd4c9" stroke-width="1.2"/></g>`).join('')}
    </svg>`}</div>${teaching?'</div>':''}<div class="folio-nav"><button type="button" class="folio-today" data-calendar-nav="today" aria-label="Go to current month">Today · ${calendarDates().today.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</button><button type="button" data-calendar-nav="-1" aria-label="Previous month">${teaching?'Previous':'‹'}</button><button type="button" data-calendar-nav="1" aria-label="Next month">${teaching?'Next':'›'}</button></div>
    ${teaching&&!productionPreview?flipSpeedControl():''}<div class="folio-agenda" aria-label="Academic deadlines this month">${calendarAgenda()}</div></section>`;
}
function workQueue(tasks, separateCalendar=false) {
  const entries = tasks.map(([symbol,tone,count,subject,phrase,desc,target,cta],index)=>`
    <li class="queue-entry" data-tone="${tone}" data-icon="${symbol}" data-current="${index===0}">
      <span class="queue-icon">${queueIcon(symbol)}${queueSketch(symbol)}</span>
      <div class="queue-copy"><strong>${count} ${phrase}</strong><p>${desc}</p></div>
      ${link(target,cta+icon('chevron'),'queue-link')}
    </li>`).join('');
  const list = `<div class="queue-designer" data-direction="illustrated"><div class="queue-stage"><ul class="queue-entries" role="list">${entries}</ul></div></div>`;
  return separateCalendar ? list : `<div class="queue-calendar-layout">${list}${deskCalendar()}</div>`;
}

function avatar(name) {
  const tones = ['sky','slate','iris','mint','rose','gold'];
  const normalized = name.replace(/^Dr\. /,'');
  const hue = [...normalized].reduce((seed,char)=>(seed*37+char.charCodeAt(0)) | 0,0);
  const initials = normalized.split(' ').slice(0,2).map(part=>part[0]).join('');
  return `<span class="avatar" data-portrait="${Math.abs(hue)%11}" data-tone="${tones[Math.abs(hue)%tones.length]}" aria-hidden="true">${initials}</span>`;
}


const courseData = [
  ['CSEN 701','Embedded Systems','Computer Engineering','5','Winter'],
  ['CSEN 703','Analysis & Design of Algorithms','Computer Engineering','5','Winter'],
  ['CSEN 704','Advanced Computer Lab','Computer Engineering','4','Winter'],
  ['DMET 701','Computer Graphics','Digital Media Engineering','5','Winter'],
  ['ELCT 701','Communication Systems','Electronics Engineering','5','Winter'],
  ['MATH 701','Numerical Analysis','Mathematics','4','Winter']
];
const resolveCourse = code => courseData.find(c=>c[0]===code) || courseData[0];
let selectedCourse = resolveCourse(params.get('course'));

function courseLink(code,label,cls) {
  const course = resolveCourse(code);
  return `<a class="${cls}" href="${href('course-detail',selectedStudent,course)}" data-page="course-detail" data-course-code="${course[0]}">${label}</a>`;
}
function groups(){
  const managesAcademics = role === 'coordinator' || role === 'administrator';
  const advises = role === 'coordinator' || role === 'advisor';
  if (student()) return [
    ['Home', ['overview','academic-services']],
    ['Classes', ['my-schedule','my-courses', ...(role === 'normalStudent' ? ['schedule-swap'] : ['preferences'])]],
    ['Support', ['my-advisor','calendar-sync', ...(role === 'advisingStudent' ? ['records','extra-hours','graduation-plans'] : [])]]
  ];
  return [
    ['Home', ['overview','academic-services', ...(role === 'coordinator' ? ['pending-work'] : [])]],
    ['Student services', [
      ...(managesAcademics ? ['directory','financial-records'] : []),
      ...(advises ? ['advising','extra-hours','graduation-plans'] : [])
    ]],
    ['Scheduling', [
      'student-schedules', ...(advises ? ['preferences'] : []),
      'mandatory-removals', ...(managesAcademics ? ['schedule-activity'] : [])
    ]],
    ['Academic setup', managesAcademics
      ? ['courses','terms',role === 'administrator' ? 'offerings' : 'templates','group-assignments'] : []]
  ].filter(([, items]) => items.length);
}
function sidebar(){
  const parent = {'student-detail':'directory','draft-schedule':'student-schedules','course-detail':'courses','copy-offerings':'offerings','template-detail':'templates'};
  const study = workspaces[lab.layout].name==='Claude Study';
  const sectionIcons = ['home','people','calendar','book'];
  return `<aside class="sidebar">
    <div class="brand">${link('overview',portalWordmark(),'wordmark')}<span>Academic workspace</span></div>
    <nav aria-label="Main navigation">${groups().map(([name,items],groupIndex)=>{
      const contents = `<ul>${items.map(id => {
        if (id === 'extra-hours') return `<li>${navigationLink(id,`<span>${navigationLabel(id)}</span>`,'navlink')}</li>`;
        const current = page === id || parent[page] === id;
        const count = id === 'student-schedules' ? readyStudents.length : id === 'mandatory-removals' ? 3 : '';
        return `<li><a class="navlink${current ? ' active' : ''}" href="${href(id)}" data-page="${id}" ${current ? 'aria-current="page"' : ''}>${study && groupIndex===0 ? icon(id==='overview'?'home':'inbox') : ''}<span>${pages[id]}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</a></li>`;
      }).join('')}</ul>`;
      if (study) {
        const key = `portal-study-nav:${role}:${name}`;
        return `<details class="study-nav-group" data-nav-key="${key}" ${localStorage.getItem(key)==='closed'?'':'open'}><summary>${name}${icon('down')}</summary>${contents}</details>`;
      }
      const isOpen = groupIndex === 0 || items.includes(page) || items.includes(parent[page]);
      return `<details class="navgroup" ${isOpen?'open':''}><summary>${icon(sectionIcons[groupIndex])}<span>${name}</span>${icon('down')}</summary>${contents}</details>`;
    }).join('')}</nav>
    <div class="sidebar-foot"><span class="term-dot"></span><span>Winter 2026/2027<span class="side-sub">German University in Cairo</span></span></div>
  </aside>`;
}

document.addEventListener('click',event=>{
  const summary=event.target.closest('.study-nav-group > summary');
  if (!summary) return;
  event.preventDefault();
  const group=summary.parentElement;
  group.open=!group.open;
  localStorage.setItem(group.dataset.navKey,group.open?'open':'closed');
});

function head(title, subtitle='', action='', kicker=''){
  return `<div class="page-head"><div>${kicker?`<div class="kicker">${kicker}</div>`:''}<h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action?`<div class="actions">${action}</div>`:''}</div>`;
}

function stats(items){return `<div class="stats">${items.map(([label,value,foot])=>`<div class="stat"><span>${label}</span><strong>${value}</strong><small>${foot}</small></div>`).join('')}</div>`;}
function table(headers,rows,search=true){
  const numeric = ['Amount','Credits','Semester','Groups','Courses','Balance','Grade'];
  return `<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th scope="col" class="${numeric.includes(h)?'num':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr ${search?'data-search-row':''}>${row.map((cell,i)=>`<td class="${numeric.includes(headers[i])?'num':''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="search-empty" hidden>No matching records. Try a different search.</p></div><div class="tablefoot"><span id="result-count">${rows.length} records</span><span>Sample data</span></div>`;
}

function filterbar(placeholder,options=[],action=''){
  const chips=options.length?'<ul class="filter-chips" id="filter-chips" aria-label="Active filters" hidden></ul>':'';
  return `<div class="toolbar"><div class="filters"><input aria-label="${placeholder}" placeholder="${placeholder}" id="search" type="search">${options.map(([label,values,field,defaultLabel])=>`<span class="filter-tab"><svg class="filter-mark" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m2.8 7.5 6-.3m3.7.1 6.3-.3m-16 8 10.2-.3m3.6-.1 2.7-.1"/><path d="M12.4 7a2 2 0 1 1-4 .2 2 2 0 1 1 4-.2Zm4 7.5a2 2 0 1 1-4 .2 2 2 0 1 1 4-.2Z"/></svg><select aria-label="${label}" data-filter="${field||''}"><option value="">${defaultLabel||label}</option>${values.map(value=>`<option>${value}</option>`).join('')}</select></span>`).join('')}${chips}</div>${action?`<div class="actions">${action}</div>`:''}</div>`;
}
function tabs(items,defaultTab,style='file'){
  if(!items.some(([id])=>id===tab)) tab=defaultTab||items[0][0];
  const edge = '<svg class="file-tab-edge" viewBox="0 0 140 40" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M2 37.5 2.3 11.5Q2.3 8 6 8l7.5-.1q3 0 5-2.8l1.3-1.5Q21.4 2 24 2l107.5.4q6 0 6.2 6l.3 29.3Q69 37 2 37.5Z"/></svg>';
  return `<div class="tabs${style==='file'?' file-tabs':''}" role="tablist" aria-label="${pages[page]} views">${items.map(([id,title])=>
    `<button type="button" role="tab" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}" class="${tab===id?'active':''}" data-tab="${id}">${style==='file'?edge:''}<span>${title}</span></button>`
  ).join('')}</div>`;
}
const activeTerm = 'Winter 2026/2027';
function termContext(context) {
  return `<span class="workspace-term">${icon('calendar')}<strong>${activeTerm}</strong></span><span class="workspace-term-context">${context}</span>`;
}

function workspaceGrid(view, modules) {
  const lanes = Object.fromEntries(Object.entries(view.lanes || {}).map(([key, children]) =>
    [key, children.filter(child=>Object.hasOwn(modules,child))]));
  const rows = view.rows.map(row=>row.split(' ').map(key=>
    Object.hasOwn(modules,key) || lanes[key]?.length ? key : '.'))
    .filter(row=>row.some(key=>key!=='.'));
  const section = key => `<section class="work-module module-${key}" style="--area:${key}">${modules[key]}</section>`;
  const layout = key => lanes[key]
    ? `<div class="work-lane work-lane-${key}" style="--area:${key}">${lanes[key].map(section).join('')}</div>`
    : section(key);
  const order = [...new Set(rows.flat().filter(key=>key!=='.'))];
  const columns = view.columns.split(' ').map(size=>`minmax(0,${size})`).join(' ');
  const areas = rows.map(row=>`'${row.join(' ')}'`).join(' ');
  return `<div class="work-grid" style="--columns:${columns};--areas:${areas}">
    ${order.map(layout).join('')}
  </div>`;
}
function studyGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${greeting}, <span class="greeting-name">${person().replace(/^Dr\. /,'').split(' ')[0]}</span>`;
}
function workspaceSection(title, target, label, content, actionStyle='quiet-link') {
  return `<div class="section-head"><h2>${title}</h2>${link(target,label,actionStyle)}</div>${content}`;
}

const currentAcademicTerm = academicTerms.find(term=>term.status==='Active');
const registrationDates = termMilestones.map(([key,label,tone,short])=>{
  const date = currentAcademicTerm[key];
  return [date.slice(-2),formatCalendarDay(date,{month:'short'}),label,tone,short];
});
function workspaceTimetable(view,title,target,label) {
  if (!view.inlineDates) return workspaceSection(title,target,label,weekly());
  if (view.name==='Claude Study') {
    return `<div class="timetable-heading"><h2>${title}</h2>${link(target,label,'quiet-link')}</div>
      ${weekly()}`;
  }
  const dates = registrationDates.map(([day,month,name,tone,short])=>`<li data-tone="${tone}" title="${name}"><span>${short}</span> <strong>${Number(day)} ${month}</strong></li>`).join('');
  return `<div class="timetable-heading"><h2>${title}</h2>${link(target,label,'quiet-link')}</div>
    <ul class="term-dates-inline" aria-label="Registration dates"><li class="term-dates-label">Registration</li>${dates}</ul>${weekly()}`;
}

function draftProgress() {
  const statusCounts = ['Ready for review','Draft','Not started'].map(label=>[label,scheduleStates.filter(status=>status===label).length]);
  return `<div class="draft-meter" role="img" aria-label="${statusCounts.map(([label,count])=>`${count} ${label}`).join(', ')}">${statusCounts.map(([,count])=>`<span style="flex-grow:${count}"></span>`).join('')}</div>
    <ul class="meter-key">${statusCounts.map(([label,count])=>`<li><i aria-hidden="true"></i><strong>${count}</strong> ${label}</li>`).join('')}</ul>`;
}

const recentScheduleEvents = [
  {action:'Preferences submitted',subject:'Mariam Mostafa',author:'Mariam Mostafa',date:'2026-11-20',time:'10:42',tone:'ready',stamp:'letter',caption:'Mariam Mostafa',target:'student-detail',index:1},
  {action:'Advising draft saved',subject:'Omar Hassan',author:'Dr. Salma Adel',date:'2026-11-20',time:'09:15',tone:'draft',stamp:'pen',caption:'Dr. Salma Adel · Omar Hassan',target:'draft-schedule',index:0},
  {action:'Template published',subject:'Group 4',author:'Nadia Ahmed',date:'2026-11-19',time:'16:20',tone:'payment-complete',stamp:'press',caption:'Nadia Ahmed · Group 4',target:'template-detail'}
];

const dashboardViews = {
  daybook:{label:'Daybook',columns:'1.45fr 1fr',rows:['intro intro','queue dates','review review']},
  teaching:{label:'Work overview',columns:'1.5fr 1fr',rows:['intro intro','queue queue','review calendar']},
  advising:{label:'Advising desk',columns:'1.25fr 1fr',rows:['intro intro','review tasks'],lanes:{tasks:['queue','dates']}},
  almanac:{label:'Term almanac',columns:'1fr 1.5fr',rows:['intro intro','dates tasks'],lanes:{tasks:['queue','review']}},
  handover:{label:'Staff handover',columns:'1fr 1.1fr',rows:['intro intro','tasks review'],lanes:{tasks:['queue','dates']}}
};
const dashboardViewKey='portal-studio-dashboard-view';
const requestedView=new URLSearchParams(location.search).get('view');
let dashboardView=Object.hasOwn(dashboardViews,requestedView) ? requestedView : localStorage.getItem(dashboardViewKey);
if (productionPreview || !Object.hasOwn(dashboardViews,dashboardView)) dashboardView='teaching';

function dashboardEdition(modules,greeting){
  const view=dashboardViews[dashboardView];
  const options=Object.entries(dashboardViews).map(([id,{label}])=>
    `<option value="${id}" ${id===dashboardView?'selected':''}>${label}</option>`).join('');
  return `<div class="dashboard-edition" data-edition="${dashboardView}">
    ${productionPreview?'':`<div class="edition-filters"><label class="edition-picker">Dashboard view <select data-dashboard-view>${options}</select></label></div>`}
    ${workspaceGrid(view,{...modules,intro:greeting,...(dashboardView==='teaching'?{calendar:deskCalendar(true)}:{})})}</div>`;
}

function overview(){
  if(student()) return studentOverview();
  const view = workspaces[lab.layout];
  const canManage = ['administrator','coordinator'].includes(role);
  const queueDestination = role==='coordinator' ? 'pending-work' : role==='advisor' ? 'advising' : 'courses';
  const queueLabel = role==='coordinator' ? 'All work' : role==='advisor' ? 'Advising students' : 'Course catalogue';
  const formatDate = (day,month,label,tone) => `<li data-tone="${tone}"><time><strong>${day}</strong><span>${month}</span></time><span>${label}</span></li>`;
  const reviewCircle = '<svg class="review-circle" aria-hidden="true" viewBox="0 0 68 30" preserveAspectRatio="none"><path pathLength="1" d="M50 5C36 1 10 3 5 12S12 26 32 26C51 27 66 22 64 14S54 4 40 4"/></svg>';
  const advisingDesk = view.name==='Claude Study' && dashboardView==='advising';
  const reviewRows = readyStudents.slice(0,advisingDesk ? readyStudents.length : 4).map(({name,index})=>`<div class="review-person">${avatar(name)}<div><strong>${name}</strong><span>${index === 0 ? '19 credits · Thursday off' : 'Semester 7 · Group 4'}</span></div>${link('draft-schedule','Review'+reviewCircle,'btn row-control',index)}</div>`).join('');
  const teachingDesk = view.name==='Claude Study' && dashboardView==='teaching';
  const reviewFiles = teachingDesk ? `<div class="draft-index">${readyStudents.map(({name,index})=>link('draft-schedule',
    `<svg class="desktop-folder" viewBox="0 0 96 72" aria-hidden="true"><path fill="#bdbaaf" d="M5 15q0-6 6-6h22l8 7h43q6 0 6 6v39H5z"/><g class="folder-sheet"><path class="folder-leaf-edge" fill="#fffdf6" stroke="#b8b4a7" stroke-width=".85" d="M12 21Q45 19 82 20L84 59Q50 60 11 60Z"/><path class="folder-writing" stroke="#989383" fill="none" stroke-linecap="round" stroke-width="1.65" d="M19 27q13-.6 35 0m-35 5q16-.8 48 0"/><path class="folder-third" stroke="#aaa396" fill="none" stroke-linecap="round" stroke-width="1.4" d="M19 36.7q11-.4 24 .1"/></g><path class="folder-cover" fill="var(--console-ivory,#f0eee6)" stroke="#c7c3b7" d="M5 31q0-5 5-5h75q5 0 5 5l-2 28q0 5-5 5H12q-5 0-5-5z"/></svg><strong>${name}</strong><small>${index===0?'19 credits · Thursday off':'Semester 7 · Group 4'}</small>`,'draft-file',index)).join('')}</div>` : '';
  const removalsTask = ['course-removal','rose',3,'Course removals','course removal requests','Credit load and scheduling decisions','mandatory-removals','Review'];
  const tasks = role==='coordinator' ? [
    removalsTask,
    ['advisor-assignment','mint',2,'Advisors','students need an advisor','Advising assignments','advising','Assign'],
    ['group-assignment','iris',6,'Group assignment','students need a group','Computer Engineering · Semester 7','group-assignments','Assign'],
  ] : role==='advisor' ? [
    removalsTask,
    ['advisor-assignment','mint',readyStudents.length,'Advising','drafts ready to review','Student schedules and preferences','advising','Open advising'],
  ] : [
    ['group-assignment','iris',courseData.length,'Course offerings','courses in the winter catalogue','Review offerings and class groups','offerings','View offerings'],
    ['advisor-assignment','mint',registrationDates.length,'Academic terms','registration milestones','Review dates for the active term','terms','Manage terms'],
  ];
  const actions = [
    ['calendar','student-schedules','Review schedules'],
    ['people', canManage ? 'directory' : 'advising','Find a student'],
    ['clock',queueDestination,queueLabel]
  ];
  const distribution = draftProgress();
  const activeStudent = readyStudents.find(({index})=>index===selectedStudent) || readyStudents[0];
  const dispatch = `<div class="dispatch"><div class="dispatch-list"><h2>Ready for review <span>${readyStudents.length}</span></h2>${readyStudents.map(({name,index})=>`<button type="button" class="dispatch-person" aria-pressed="${index===activeStudent.index}" data-action="pick-review" data-student="${index}">${avatar(name)}<span><strong>${name}</strong><small>Semester 7</small></span>${icon('chevron')}</button>`).join('')}</div>
    <div class="dispatch-detail"><p>Advising draft</p><h2>${activeStudent.name}</h2><p>Group 4 · 19 credits</p><dl>${courseData.slice(0,4).map(([code,name])=>`<div><dt>${name}</dt><dd>${code}</dd></div>`).join('')}</dl>${link('draft-schedule','Open advising draft','btn primary',activeStudent.index)}</div></div>`;

  const modules = {
    brief:`<div class="brief-message"><h2><span class="review-total">${readyStudents.length}</span> drafts to review</h2><p>Registration opens on 22 November.</p>${link('student-schedules','Review schedules','btn primary')}</div><div class="brief-status"><h3>Draft progress</h3>${distribution}</div>`,
    cover:`<div><h2>Winter registration</h2><p>Registration opens on Sunday, 22 November.</p>${link('terms','Term settings','btn primary')}</div><img src="images/window-desk.webp" alt="Open books on a desk by a window">`,
    command:`<div class="command-box"><button type="button" class="workspace-search" data-action="quick-find">${icon('search')}<span>Find a page or action</span><kbd>/</kbd>${icon('chevron')}</button>
      <div class="task-shortcuts">${actions.map(([symbol,target,label])=>link(target,icon(symbol)+label,'btn')).join('')}</div></div>`,
    capacity:workspaceSection('Draft progress','student-schedules','View schedules',distribution),
    review:workspaceSection('Schedule review','student-schedules','All schedules',advisingDesk ? `<p class="review-summary">${readyStudents.length} student drafts ready</p>${reviewRows}` : teachingDesk ? reviewFiles : reviewRows),
    queue:workspaceSection('Work queue',queueDestination,queueLabel,workQueue(tasks,view.name==='Claude Study')),
    dates:workspaceSection('Registration dates',canManage?'terms':'student-schedules',icon('calendar')+(canManage?'Term settings':'Schedules'),`<ol class="milestones">${registrationDates.map(date=>formatDate(...date)).join('')}</ol>`,'btn date-action'),
    dispatch,
    register:workspaceSection('Student drafts','student-schedules','All schedules',table(['Student','Schedule',''],names.slice(0,8).map((name,index)=>[`<strong>${name}</strong><small>70-${71577+index}</small>`,badge(scheduleStates[index],statusTone(scheduleStates[index])),link('draft-schedule','Open','quiet-link',index)]),false)),
    people:workspaceSection('Student directory',canManage?'directory':'advising','All students',names.slice(0,6).map((name,index)=>`<div class="review-person">${avatar(name)}<div><strong>${name}</strong><span>70-${71577+index} · Semester 7</span></div>${link('student-detail','Open','btn row-control',index)}</div>`).join('')),
    courses:workspaceSection('Winter courses',canManage?'courses':'student-schedules',canManage?'View catalogue':'View schedules',`<div class="course-map">${courseData.map(([code,title,department,credits])=>`<article><span>${code}</span><h3>${title}</h3><p>${department} · ${credits} credits</p></article>`).join('')}</div>`),
  };
  const term = termContext(`${roleNames[role]} workspace`);
  if(view.name==='Claude Study') return dashboardEdition(modules,head(studyGreeting(),term));
  return head(view.name==='Claude Study' ? studyGreeting() : view.title,term,view.name==='Claude Study' ? '' : button(icon('search')+'Find a page','quick-find','btn mast-search')) + workspaceGrid(view,modules);
}
function studentOverview(){
  const view = workspaces[lab.layout];
  const coursesThisTerm = courseData.slice(0,4);
  const credits = coursesThisTerm.reduce((sum,course)=>sum+Number(course[3]),0);
  const normal = role==='normalStudent';
  const nextAction = normal?'schedule-swap':'preferences';
  const nextLabel = normal?'Explore swap groups':'Set schedule preferences';
  const advisorCard = `<div class="event">${avatar('Salma Adel')}<div><p><strong>Dr. Salma Adel</strong></p><time>Tuesday, 12:00–14:00 · C3.204</time></div></div>`;
  const courseRows = coursesThisTerm.map(([code,name])=>`<div class="review-person"><div><strong>${name}</strong><span>${code}</span></div></div>`).join('');
  const modules = {
    brief:`<div class="brief-message"><p>Winter 2026 / 2027</p><h2>Your semester is ready</h2><p>Review your Group 4 timetable and the courses you’re taking.</p>${link('my-schedule','Open timetable','btn primary')}</div><div class="brief-status"><h3>Course load</h3><p>${coursesThisTerm.length} courses · ${credits} credit hours</p><p>Thursday free</p></div>`,
    cover:`<div><h2>Winter semester</h2><p>${coursesThisTerm.length} registered courses · ${credits} credit hours</p>${link('my-schedule','My timetable','btn primary')}</div><img src="images/window-desk.webp" alt="Open books on a desk by a window">`,
    command:`<div class="command-box"><button type="button" class="workspace-search" data-action="quick-find">${icon('search')}<span>Find a page or action</span><kbd>/</kbd>${icon('chevron')}</button><div class="task-shortcuts">${[['calendar','my-schedule','My timetable'],['book','my-courses','My courses'],['people','my-advisor','My advisor']].map(([symbol,target,label])=>link(target,icon(symbol)+label,'btn')).join('')}</div></div>`,
    capacity:workspaceSection('Course load','my-courses','My courses',`<p>${coursesThisTerm.length} courses · ${credits} credit hours · Semester 7</p>`),
    review:workspaceSection('Coming up','my-schedule','Full timetable',`<div class="review-person"><div><strong>Embedded Systems</strong><span>Sunday · 08:30 · Lecture · C2.301</span></div></div><div class="review-person"><div><strong>Analysis & Design of Algorithms</strong><span>Sunday · 12:00 · Tutorial · C3.104</span></div></div>`)
      + (view.name==='Claude Study' ? studentNotificationPanel() : ''),
    queue:workspaceSection('Schedule changes',nextAction,nextLabel,`<p>${normal?'Review swap groups before schedule swaps close on 13 December.':'Review your preferred days and groups with your advisor.'}</p>`),
    dates:workspaceSection('Registration dates','my-schedule','My timetable',`<ol class="milestones"><li><time><strong>22</strong><span>Nov</span></time><span>Registration opens</span></li><li><time><strong>06</strong><span>Dec</span></time><span>Registration closes</span></li><li><time><strong>13</strong><span>Dec</span></time><span>Schedule swaps close</span></li></ol>`),
    activity:`${deskCalendar(true)}<div class="student-calendar-action">${link('calendar-sync','Calendar sync','quiet-link')}</div>`,
    dispatch:workspaceSection('Group 4 timetable','my-schedule','Full timetable',weekly()),
    register:workspaceSection('Registered courses','my-courses','Course details',courseRows),
    week:workspaceTimetable(view,'Teaching week','my-schedule','Full timetable'),
    people:workspaceSection('Academic advisor','my-advisor','Advising details',advisorCard),
    courses:workspaceSection('Winter courses','my-courses','My courses',`<div class="course-map">${coursesThisTerm.map(([code,name,,credit])=>`<article><span>${code}</span><h3>${name}</h3><p>${credit} credits</p></article>`).join('')}</div>`),
  };
  const title = ['Your semester','My courses','My timetable','Teaching week','My courses','Schedule changes','Student services','My timetable','Winter courses','Teaching week','What do you need today?','My timetable','Schedule overview','My courses','Calendar','My teaching week','Winter courses','Find a page','Schedule changes','Semester overview',studyGreeting()][lab.layout];
  return head(title,termContext('Computer Engineering'),link('my-schedule','Open schedule'+(view.name==='Claude Study' ? icon('chevron') : ''),view.name==='Claude Study' ? 'quiet-link study-schedule-link' : 'btn primary')) + workspaceGrid(view,modules);
}

function staffIdentity(name, id) {
  const label = `<strong>${name}</strong><small>${id}</small>`;
  if (workspaces[lab.layout].name!=='Claude Study') return label;
  return `<div class="staff-identity">${avatar(name)}<div>${label}</div></div>`;
}

function directory(){
  return head('Student directory','Find a student and open their academic details.')+
    filterbar('Search name or ID', [['All majors',['Computer Engineering','Digital Media Engineering']],['All statuses',['Ready for review','Draft','Not started']]])+
    `<div class="student-register">${[...names.keys()].sort((a,b)=>names[a].localeCompare(names[b])).map((i,position,order)=>{
      const name = names[i];
      const letter = name[0];
      const first = !position || names[order[position-1]][0]!==letter;
      const major = i===3?'Digital Media Engineering':'Computer Engineering';
      const detail = i%3?'Advising':'Normal';
      return `<article data-search-row class="register-entry"><span class="index-letter" aria-hidden="true" data-letter="${letter}">${first?letter:''}</span>
        ${staffIdentity(name,`70-${71577+i}`)}<div class="register-detail">${major}<small>Semester 7 · ${detail}</small></div>
        ${badge(scheduleStates[i],statusTone(scheduleStates[i]))}${link('student-detail','Open profile','btn desk-action',i)}</article>`;
    }).join('')}</div>${listFoot(names.length)}`;
}

function rosterSection(title, indices, row) {
  return `<section class="roster-section"><h2>${title}</h2><ul>${indices.map(i=>`<li data-search-row>${row(i)}</li>`).join('')}</ul></section>`;
}

function advising() {
  const unassigned = [2,8];
  const row = i => `${staffIdentity(names[i],`70-${71577+i}`)}
    <p>${i===3?'Digital Media Engineering':'Computer Engineering'}<small>Semester 7</small></p>
    ${badge(scheduleStates[i],statusTone(scheduleStates[i]))}${link('student-detail','View student','btn desk-action',i)}`;
  return head('Advising students','Review assignments, preferences, and schedules.',button('Assign advisor','assign-advisor','btn primary'))+
    filterbar('Search name or ID',[['All majors',['Computer Engineering','Digital Media Engineering']],['All statuses',['Ready for review','Draft','Not started']]])+
    rosterSection('Needs an advisor',unassigned,row)+rosterSection('Dr. Salma Adel',names.map((_,i)=>i).filter(i=>!unassigned.includes(i)),row)+listFoot(names.length);
}
function listFoot(count) {
  return `<p class="search-empty" hidden>No matching records. Try a different search.</p><div class="tablefoot"><span id="result-count">${count} records</span></div>`;
}
function profile(detail=false){
  const name=detail?names[selectedStudent]:person();
  const isStudent=detail || student();
  const index=detail ? selectedStudent : 0;
  const roleTitle=detail ? (index%3?'Advising student':'Normal student') : roleNames[role];
  const major=index===3?'Digital Media Engineering':'Computer Engineering';
  const advisorName=[2,8].includes(index)?'Unassigned':'Dr. Salma Adel';
  const state=scheduleStates[index];
  const accountName=name.replace(/^Dr\. /,'').toLowerCase().replaceAll(' ','.');
  const email=accountName+(isStudent?'@student.guc.edu.eg':'@guc.edu.eg');
  const facts = pairs=>`<dl class="profile-facts">${pairs.map(([key,value])=>
    `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  const academic = facts([
    ['Major',major],['Semester','7'],['Academic standing','Very good'],['Enrollment','Active'],
    ['Assigned advisor',advisorName],['Schedule status',badge(state,statusTone(state))]
  ]);
  const identity=`<aside class="profile-identity"><div class="campus-id">
    <div class="campus-wordmark"><img src="portal-card-index.svg" alt="">German University in Cairo</div>
    <div class="campus-owner">${avatar(name)}<div><h2>${name}</h2><p>${roleTitle}</p></div></div>
    <div class="campus-card-foot">${isStudent?'Student ID <strong>70-'+(71577+index)+'</strong>':'Faculty of Media Engineering &amp; Technology'}</div>
    </div>${detail?`<div class="profile-contact"><h3>University email</h3><a href="mailto:${email}">${email}</a></div>`:''}</aside>`;
  const heading=head(detail?'Student details':'My profile','',detail?link('directory','Back to directory','btn'):'');
  if (!detail) {
    const shortcuts = student() ? ['my-schedule',role==='advisingStudent'?'preferences':'my-courses'] :
      role==='advisor' ? ['advising','student-schedules'] : role==='administrator' ? ['directory','financial-records'] : ['pending-work','student-schedules'];
    return heading+`<div class="profile-desk personal-profile">${identity}<div class="profile-pane">
      <h2>Contact</h2>${facts([['University email',`<a href="mailto:${email}">${email}</a>`]])}
      ${isStudent?`<h2>Academic information</h2>${academic}`:''}
      <h2>My workspace</h2><div class="profile-shortcuts">${shortcuts.map(target=>link(target,
        icon({'pending-work':'inbox','student-schedules':'calendar','my-schedule':'calendar',preferences:'edit',
          'my-courses':'book',advising:'people',directory:'people','financial-records':'book'}[target])+
        `<span>${pages[target]}</span>`+icon('chevron'),'profile-shortcut')).join('')}</div>
      </div></div>`;
  }
  const history = `<ul class="advisor-records">${[
    ['Dr. Salma Adel','5 October 2026',advisorName==='Unassigned'?'Ended':'Current'],
    ['Dr. Hany Youssef','10 February 2026','Ended']
  ].map(([advisor,date,status])=>`<li>${staffIdentity(advisor,'Assigned '+date)}${badge(status,status==='Ended'?'neutral':'')}</li>`).join('')}</ul>`;
  const disclosure=(title,content,open=false)=>`<details class="profile-section" ${open?'open':''}><summary>${title}${icon('down')}</summary>${content}</details>`;
  const actions=link('preferences','View preferences','btn',index)+link('draft-schedule','Open schedule','btn primary',index)+button('Assign advisor','assign-advisor','btn',`data-student-index="${index}"`);
  return heading+`<div class="profile-desk">${identity}<div class="profile-pane">
    ${disclosure('Academic details',academic,true)}${disclosure('Advisor history',history)}
    ${disclosure('Schedule workflow',workflow())}<div class="profile-actions">${actions}</div></div></div>`;
}
function notificationEntries(){
  const testEntries = Array.from({length:testCount}, (_, i) => [`test-${i}`, 'Test notification', 'This is a test notification for your account.', 'Just now']);
  if (role==='normalStudent') return testEntries;
  const registration = ['term', 'Winter 2026 dates updated', 'The registration window opens on 22 November.', 'Yesterday'];
  if (student()) return [
    ...testEntries,
    ['schedule', 'Your timetable is ready', 'Check the teaching week for your class times and rooms.', 'Today, 10:42'],
    registration,
  ];
  return [
    ...testEntries,
    ['schedule', 'Schedule ready for review', 'Omar Hassan’s advising schedule is ready for your review.', 'Today, 10:42', names[0]],
    ['removal', 'Course removal requested', 'Mariam Mostafa requested removal of CSEN 701.', 'Today, 09:30', names[1]],
    registration,
  ];
}

function inboxBellRinger(){
  return button(`<svg class="student-inbox-bell" viewBox="0 0 180 126" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path class="inbox-bell-frame" d="M87 23h79M102 23V12m48 11V12M11 115h154"/>
    <path class="inbox-ringer-boot" d="M32 98h11l-1 13 5 4H29Zm18 0h10l1 13 5 4H49Z"/>
    <path class="inbox-ringer-skin" d="M22 83l8 2-1 8-4 2-4-3Z"/>
    <path class="inbox-ringer-back-sleeve" d="M32 52q-7 1-9 10l-5 16q-1 5 3 8l9 2 4-10 5-18Z"/>
    <path class="inbox-ringer-coat" d="M31 54q7-6 17-5 11 0 14 12l-3 20 7 21q-20 9-40 0l6-20-4-17q-2-6 3-11Z"/>
    <path class="inbox-ringer-collar" d="M32 53l6-4 10 2 5 5-9 5-5-4-4 2Z"/>
    <path class="inbox-ringer-detail" d="m44 61-2 42m-5-28h1m-2 9h1m-2 9h1"/>
    <path class="inbox-ringer-skin" d="M34 30q14-9 22 0v6l5 5-5 2v4q-7 7-17 1l-2 7-8-5 4-8Z"/>
    <path class="inbox-ringer-hat" d="M25 32q3-6 7-7l2-14q9-4 19 0l5 13 7 4q-16 8-40 4Z"/>
    <path class="inbox-ringer-detail" d="M33 24q13 1 24-2m-7 13h1m-5 12q4 1 6-1"/>
    <g class="inbox-bell-swing">
      <path class="inbox-bell-body" d="M99 72c8-9 10-18 10-29 0-11 8-17 18-17 11 0 18 6 18 17 0 11 2 21 10 29l3 5H96Z"/>
      <path d="M125 26v-3m-24 48h52m-38-22c0-7 3-12 8-14m0 42v4m8-4v4"/>
      <path class="inbox-bell-body" d="M123 81q4-4 8 0l2 4q-6 5-12 0Z"/>
    </g>
    <g class="inbox-ringer-arm">
      <path class="inbox-mallet" d="m80 74 13-9m-3-7 8-4 7 12-8 5Z"/>
      <path class="inbox-ringer-coat" d="M52 51q5-1 9 4l7 12 9-1 3 10-13 3q-4 1-7-3L48 62q-4-6 4-11Z"/>
      <path class="inbox-ringer-sleeve-fold" d="m56 61 6 9q2 3 5 3l4-1"/>
      <path class="inbox-ringer-collar" d="m73 66 6-1 3 11-7 1Z"/>
      <path class="inbox-ringer-skin" d="M79 67q3-4 7-3l3 4-3 5-5 1Z"/>
    </g>
    <path class="inbox-bell-rays" d="m158 36 8-6m-4 15 11-2m-11 11 8 3"/>
  </svg><span>Ring bell</span>`,'ring-student-bell','student-bell-control');
}

function studentNotificationPanel(){
  const unread = notificationEntries().filter(([id]) => isNotificationUnread(id));
  const content = unread.length
    ? `<div class="student-inbox-unread">
        ${inboxBellRinger()}
        <ul class="student-inbox-list" role="list">${unread.slice(0,3).map(([,title,description,time])=>`
          <li><strong>${title}</strong><p>${description}</p><small>${time}</small></li>`).join('')}</ul>
      </div>`
    : `<div class="student-inbox-empty">
        <div class="student-tumbleweed-scene" aria-hidden="true">
          <svg class="student-desert-line" viewBox="0 0 260 32" preserveAspectRatio="none" fill="none" stroke="currentColor" stroke-linecap="round">
            <path d="M0 26q64-6 125 0t135-3M0 19q19-3 38-14 16-9 43 7m99 9q14-10 27-12 13-3 31 9M22 30h19m45-2h9m114 2h15"/>
          </svg>
          <svg class="student-wind student-wind-near" viewBox="0 0 180 38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M2 18h68c15 0 22-8 15-13-5-4-12-2-13 3M28 27h118c20 0 27-11 18-16-5-3-11-1-12 3M108 35h41"/>
          </svg>
          <svg class="student-wind student-wind-far" viewBox="0 0 180 38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 13h111c15 0 20-9 13-11-4-2-10 0-10 4M21 25h139c15 0 23-8 15-14M81 35h55"/>
          </svg>
          <div class="student-tumbleweed-track">
            <div class="student-tumbleweed-bounce">
          <svg class="student-tumbleweed" viewBox="0 0 88 88" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path class="tumbleweed-shape" d="M10 42c-2-10 4-21 14-23 5-10 18-15 27-9 10-3 23 4 25 14 8 7 10 19 4 27 2 11-6 22-18 24-6 8-20 11-29 5-11 0-22-7-23-17-6-5-6-14 0-21Z"/>
            <path d="M13 52 28 48l14 7 15-7 19 6M24 20l4 14 14 21 5 22M51 11l-3 20 9 17 3 24M76 25 63 28l-15 3-20 3-16 9M75 43l-12-15-3-13M18 64l16 2 8-11M34 66l-2 12M60 72l8-10 8-8M30 22l12-5 6 14"/>
            <path d="m22 45-8-9m16 5 12-5m-8 30-9-10m22 15 7-9m3-14 10-7 7 1m-21-7 5-12m9 38 7 4m-56-1 3 5m20-51 1-6"/>
          </svg>
            </div>
          </div>
        </div>
        <p class="student-inbox-message">The inbox is quiet.<br>Go touch grass.</p>
        <div class="student-inbox-empty-footer">
          <p>No unread notifications.</p>
          ${button('Replay wind','replay-tumbleweed','btn text')}
        </div>
      </div>`;
  return `<section class="student-inbox" aria-labelledby="student-inbox-heading">
    <div class="section-head">
      <h2 id="student-inbox-heading">Notifications${unread.length ? ` <span class="student-inbox-count">${unread.length} unread</span>` : ''}</h2>
      ${link('notifications','Open inbox','quiet-link')}
    </div>
    ${content}
  </section>`;
}

function notificationViews(unreadCount) {
  if (tab !== 'unread') tab = 'all';
  const openMail = '<path d="M3.5 13.8 13 5.7q1-.8 2 .1l9 7.1-1 10.9-18.4.7Z" fill="#bba184"/><path d="m6.8 15-.6-11 14-.8 1 11.8" fill="#f5eee0"/><path d="m9.6 8.3 7.4-.6m-7.1 4.2 5.1-.4" fill="none"/><path d="m3.5 13.8 10.4 5.5L24 12.9l-1 10.9-18.4.7Z" fill="#d8b79a"/><path d="m6.5 22 5.2-4m9.2 3.7-4.5-3.8" fill="none"/>';
  const sealedMail = '<path d="m3.3 8 20.6-1 .5 15.2-20.2 1Z" fill="#c2d2cd"/><path d="m3.7 8.7 10.4 8 9.4-9.2m-17 13.2 6-5.3m9.8 4.6-6.2-4.9" fill="none"/>';
  const unreadDot = '<path d="M17.8 6.7q-.3-4.1 3.9-4.5 4.2-.2 4.5 3.8.2 4.3-3.9 4.7-4 .3-4.5-4Z" fill="#e9a38b"/>';
  const loop = '<svg class="selection-loop" aria-hidden="true" viewBox="0 0 170 46" preserveAspectRatio="none"><path pathLength="1" vector-effect="non-scaling-stroke" d="M139 6.4C116 1.7 66 1.4 36 5.1 12 8 2.8 15.9 3.8 25.3 5.1 37.7 35 43.9 77 43.1c41.8.1 80.5-4.2 87.9-15.2 7.4-12.1-12.8-21.2-45.8-23.2"/></svg>';
  const views = [['all','All notifications',openMail],['unread','Unread',sealedMail+(unreadCount?unreadDot:'')]];
  return `<div class="mail-views" role="tablist" aria-label="Notification views">${views.map(([id,label,drawing])=>
    `<button type="button" id="notice-view-${id}" role="tab" aria-controls="notice-results" aria-selected="${id===tab}" tabindex="${id===tab?0:-1}" data-tab="${id}">
      ${loop}<svg class="mail-drawing" viewBox="0 0 28 28" aria-hidden="true">${drawing}</svg><span>${label}</span>${id==='unread'?`<span class="mail-count">${unreadCount}</span>`:''}
    </button>`).join('')}</div>`;
}

function notifications(){
  const entries = notificationEntries();
  const unread = entries.filter(([id]) => isNotificationUnread(id));
  const strip = notificationViews(unread.length);
  const visible = tab === 'unread' ? unread : entries;
  return head('Notifications', '', (productionPreview?'':button('Create test notification','test-notification'))+
    (unread.length ? button('Mark all as read','read-all','btn primary') : ''), '')+strip+
    `<section id="notice-results" role="tabpanel" aria-labelledby="notice-view-${tab}">`+
    (visible.length ? `<div class="notification-list">${visible.map(([id,title,description,time,subject]) => {
      const isUnread = isNotificationUnread(id);
      return `<article class="inbox-item ${isUnread ? 'unread' : ''}">
        ${workspaces[lab.layout].name==='Claude Study' ? `<span class="notice-symbol" data-kind="${id}">${icon(({schedule:'book',removal:'inbox',term:'calendar'})[id]||'bell')}</span>` : ''}
        <div class="inbox-text"><h3>${title}</h3><p>${description}</p><time>${time}</time></div>
        <div class="notification-meta">${subject ? `<span class="notice-person">${avatar(subject)}<span>${subject}</span></span>` : ''}
          ${isUnread ? button('Mark as read','read-one','btn desk-action', `data-notification="${id}"`) : '<small>Read</small>'}
        </div>
      </article>`;
    }).join('')}</div>` : '<div class="empty"><h2>You’re all caught up.</h2><p>No unread notifications.</p></div>')+'</section>';
}
function academicStudy() {
  return workspaces[lab.layout].name === 'Claude Study';
}
function academicCourse(course, fallback) {
  if (!academicStudy()) return fallback;
  const [code, title] = course;
  const drawing = courseDrawing(code) || icon('book');
  return `<span class="academic-course"><span class="academic-emblem" data-course="${code}" aria-hidden="true">${drawing}</span><span><strong>${title}</strong><small>${code}</small></span></span>`;
}
function academicStudent(name,index) {
  const id = `70-${71577+index}`;
  if (!academicStudy()) return `${name}<small>${id}</small>`;
  return `<span class="academic-person">${avatar(name)}<span><strong>${name}</strong><small>${id}</small></span></span>`;
}
function courses(){return head('Course catalogue',academicStudy() ? `${courseData.length} courses · ${new Set(courseData.map(c=>c[2])).size} departments` : '',button('Add course','add-course','btn primary')+button('Import CSV','import-csv'))+
  filterbar('Search courses',[['All departments',['Computer Engineering','Digital Media Engineering','Electronics Engineering']],['All seasons',['Winter','Spring']]])+
  table(academicStudy() ? ['Course','Department','Credits','Season',''] : ['Code','Course','Department','Credits','Season',''],courseData.map(c=>[
    ...(academicStudy() ? [academicCourse(c)] : [c[0],`<strong>${c[1]}</strong>`]),...c.slice(2),courseLink(c[0],'View course','btn row-control')]));}
function courseDetail(){
  const [code,title,department,credits,season] = selectedCourse;
  const first = code==='CSEN 701';
  const facts = [['Course code',code],['Credit hours',credits],['Department',department],['Semester','7'],['Type','Mandatory'],['Offering seasons',first?'Winter, Spring':season]];
  const actions = student() ? link('my-courses','My courses','btn') : button('Edit course','edit-course','btn primary')+link('courses','Back to catalogue','btn');
  return head(title,`${code} · ${department}`,actions,'Course details')+
    `<div class="split"><section class="panel academic-facts"><h2>Course information</h2><dl class="details">${facts.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>
    <section class="panel academic-related"><h2>Prerequisites</h2>${first ? '<div class="task"><div><h3>CSEN 501</h3><p>Introduction to Computer Architecture</p></div></div>' : '<p>No prerequisites listed.</p>'}
    <h2 style="margin-top:28px">Current offering</h2><p>${season} 2026${courseData.slice(0,4).includes(selectedCourse)?' · 4 groups':''}</p>${student()?link('my-schedule','View schedule','btn text'):link('offerings','View offering','btn text')}</section></div>`;
}
function terms(){
  const semesters = academicTerms.map(term=>{
    const startParts = {day:'numeric'};
    if (term.opens.slice(0,7)!==term.closes.slice(0,7)) startParts.month='short';
    const range = formatCalendarDay(term.opens,startParts)+' – '+formatCalendarDay(term.closes,{day:'numeric',month:'short',year:'numeric'});
    const end = formatCalendarDay(term.swaps,{day:'numeric',month:'short',year:'numeric'});
    const tone = term.status==='Active' ? '' : term.status==='Upcoming' ? 'pending' : 'neutral';
    return [term.name,term.year,range,end,term.status,tone,term.status==='Archived'?'View':'Manage'];
  });
  if (academicStudy()) {
    return head('Academic terms','Registration windows and schedule swap deadlines.',button('Create term','create-term','btn primary'))+
      `<div class="semester-ledger">${semesters.map(([name,year,registration,deadline,state,tone,action])=>`
        <article class="semester-line"><div class="semester-identity"><h2>${name}</h2><small>${year}</small></div>
          ${badge(state,tone)}<dl><div><dt>Registration</dt><dd>${registration}</dd></div><div><dt>Swap deadline</dt><dd>${deadline}</dd></div></dl>
          ${button(action+' term','manage-term','btn desk-action',`data-term="${name}"`)}</article>`).join('')}</div>`;
  }
  return head('Academic terms','',button('Create term','create-term','btn primary'))+
  table(['Term','Academic year','Registration','Swap deadline','Status',''],semesters.map(([name,year,range,end,state,tone,action])=>
    [name,year,range,end,badge(state,tone),button(action,'manage-term','btn text')]));
}
function offerings(){return head('Course offerings',academicStudy() ? termContext('Teaching groups and sections') : '',button('Add offering','add-offering','btn primary')+link('copy-offerings','Copy from another term','btn'))+
  filterbar('Search offerings',[['Winter 2026',['Winter 2026','Spring 2027']]])+
  table(['Course','Groups','Lecture sections','Tutorial sections','Status',''],courseData.slice(0,4).map((c,i)=>[academicCourse(c,`${c[0]}<small>${c[1]}</small>`),'4','2','4',badge(i===3?'Draft':'Published',i===3?'pending':''),button('Manage sections','manage-sections','btn text')]));}
function copyOfferings(){return head('Copy course offerings','Choose a source term, then select the courses to copy.',link('offerings','Back to offerings','btn'))+
  `<section class="panel academic-transfer"><div class="formgrid"><label>Source term<select><option>Winter 2025</option><option>Spring 2026</option></select></label>${academicStudy() ? `<span class="transfer-arrow" aria-hidden="true">${icon('chevron')}</span>` : ''}<label>Destination term<select><option>Winter 2026</option><option>Spring 2027</option></select></label></div></section>`+
  table(['Select','Course','Groups','Sections'],courseData.map(c=>[`<input type="checkbox" aria-label="Copy ${c[0]}" checked>`,academicCourse(c,`${c[0]}<small>${c[1]}</small>`),'4','6']))+
  `<div class="form-footer">${button('Copy selected offerings','copy-confirm','btn primary')}</div>`;}
function templates(){
  const groups = ['Group 1','Group 2','Group 3','Group 4'];
  return head('Schedule templates',academicStudy() ? termContext('Computer Engineering') : '',link('template-detail','Create template','btn primary'))+
    filterbar('Search templates',[['All majors',['Computer Engineering','Digital Media Engineering']],['All statuses',['Published','Draft']]])+
    `<div class="template-library"><div class="template-course-set"><h2>Semester 7 courses</h2><ul>${courseData.slice(0,4).map(([code,title])=>`<li>${courseEmblem(code)}<span>${title}<small>${code}</small></span></li>`).join('')}</ul></div>
    <ul class="template-register">${groups.map((group,i)=>`<li data-search-row>
      <div class="template-identity"><h2>${group}</h2><small>Computer Engineering · Semester 7</small></div>
      ${badge(i===3?'Draft':'Published',i===3?'draft':'')}
      <a class="btn desk-action" data-page="template-detail" href="${href('template-detail')}&group=${i+1}">Edit template</a></li>`).join('')}</ul></div>${listFoot(groups.length)}`;
}
function templateGroup(){
  const group = new URLSearchParams(location.search).get('group');
  return 'Group '+(['1','2','3','4'].includes(group)?group:'4');
}
function templateDetail(){return head(templateGroup(),'Computer Engineering · Semester 7',button('Publish template','publish','btn primary')+button('Save draft','save-draft'), 'Template editor')+
  `<section class="panel template-fields"><div class="formgrid"><label>Group name<input value="${templateGroup()}" required></label><label>Major<select><option>Computer Engineering</option><option>Digital Media Engineering</option></select></label><label>Semester<input type="number" min="1" max="10" value="7"></label><label>Term<select><option>Winter 2026</option></select></label></div></section>`+
  `<div class="section-head"><h2>Course groups</h2>${button('Add course','add-offering','btn text')}</div>`+table(['Course','Lecture','Tutorial','Lab'],courseData.slice(0,4).map(c=>[academicCourse(c,`${c[0]}<small>${c[1]}</small>`),'L1 · Sun 08:30','T4 · Tue 10:00','P4 · Wed 12:00']))+`<div style="margin-top:30px">${academicStudy() ? '<h2 class="academic-week-title">Weekly timetable</h2>' : ''}${weekly()}</div>`;}
// Small marginal drawings identify the four courses wherever the weekly schedule appears.
function courseDrawing(code) {
  const symbol = {'CSEN 703':'algorithms','CSEN 704':'advanced-lab','DMET 701':'graphics'}[code];
  if (symbol) return `<img class="course-drawing course-symbol" src="images/symbols/${symbol}.svg" alt="">`;
  const paths = {
    'CSEN 701':'m9 6 11-.5.6 10.5-11 1z M12 9l5-.4.4 4.4-5 .4z M11 3v3m4-3v3m4-3v2m-8 12v3m4-3v3m4-4v3M6 9h3m-3 4h3m12-5h3m-3 5h3',
    'ELCT 701':'M10 20l5-10 5 10m-8-3 5-1M14 9q-2-2 0-4m3 0q2 1 1 4M10 3Q5 8 10 12m11-9q5 4 0 9',
    'MATH 701':'M5 3l.3 16.8L26 20M8 16q3.8-.2 6.5-5.2T23 5m-14 11 6-2 7-7',


  };
  return paths[code] ? `<svg class="course-drawing" aria-hidden="true" viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[code]}"/></svg>` : '';
}
// Timetable art exposes the moving pieces while the catalogue uses the same still drawings.
function timetableDrawing(code) {
  const part = (symbol, id, className = '') => `<use class="${className}" href="images/symbols/${symbol}.svg#${id}"/>`;
  const svg = (box, art) => `<svg class="course-drawing course-symbol" aria-hidden="true" viewBox="${box}" fill="none" stroke-linejoin="round" stroke-linecap="round">${art}</svg>`;
  switch (code) {
    case 'CSEN 701':
    case 'CSEN 703':
      return courseDrawing(code);
    case 'CSEN 704':
      return svg('0 0 120 96', `<g class="beetle-walk"><g transform="rotate(-14 60 49)" stroke="#39443c" stroke-width="4.5">
        ${part('advanced-lab','tripod-left','beetle-legs-a')}${part('advanced-lab','tripod-right','beetle-legs-b')}${part('advanced-lab','shell')}</g></g>`);
    case 'DMET 701':
      return svg('0 0 120 96', part('graphics','frame') + part('graphics','mesh','graphics-mesh'));
    default:
      return courseDrawing(code);
  }
}
function weekly(){
  const days = [
    ['Sunday', [['08:30','CSEN 701','Lecture · C2.301','ice'], ['12:00','CSEN 703','Tutorial · C3.104','cherry']]],
    ['Monday', [['10:00','CSEN 704','Lab · C7.102','teal']]],
    ['Tuesday', [['08:30','CSEN 703','Lecture · C3.202','cherry'], ['10:00','CSEN 701','Tutorial · C2.204','ice'], ['14:00','CSEN 704','Lecture · C7.301','teal']]],
    ['Wednesday', [['12:00','DMET 701','Lecture · C1.201','clay']]],
    ['Thursday', []]
  ];
  const illustrated = workspaces[lab.layout].name === 'Claude Study';
  function classCard([time, code, detail, color]) {
    return `<div class="week-class ${color}">${illustrated ? timetableDrawing(code) : ''}<time datetime="${time}">${time}</time>
      <strong>${courseData.find(course => course[0] === code)[1]}</strong>
      <small>${illustrated ? `${code}<span class="study-place">${detail}</span>` : `${code} · ${detail}`}</small></div>`;
  }
  function dayContents(meetings) {
    if (meetings.length) return meetings.map(classCard).join('');
    if (!illustrated) return '<p class="week-free">No classes</p>';
    return `<div class="week-day-off"><svg viewBox="0 0 90 68" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g class="coffee-saucer" stroke="#504339" stroke-width="1.6">
        <path fill="#d6bd9f" d="M13 52c5-5 23-7 43-5 11 1 18 3 19 6-1 4-18 7-35 6-14 0-26-2-27-7Z"/>
        <path fill="#faf0d8" d="M18 51c12-4 34-4 49 1-4 4-34 7-49-1Z"/>
        </g><g class="coffee-cup" stroke="#504339" stroke-width="1.6"><path fill="#a7c3bc" fill-rule="evenodd" d="M55 33c13-8 20-2 16 6-2 5-8 8-17 7l1-13Zm3 3-1 6c5 0 9-2 10-5 1-3-3-4-9-1Z"/>
        <path fill="#adc8c0" d="M22 30q18-5 37 0c-1 12-3 22-16 24-14 2-20-8-21-24Z"/>
        <ellipse cx="40.5" cy="30" rx="18.5" ry="5.4" fill="#f6ecd6" stroke-width="1.35"/>
        <ellipse class="coffee-surface" cx="40.5" cy="30.4" rx="15.8" ry="3.3" fill="#705044" stroke="none"/>
        <path d="M27 37q1 8 5 11" stroke="#dfede2"/>
      </g><g class="cup-steam" fill="none" stroke="currentColor" stroke-width="1.55">
      <path d="M35 23c-7-7 7-9 2-16M46 21c-3-5 5-6 4-12"/>
      <path d="M35 22c-4-7 8-10 1-17M46 21c-5-5 6-7 3-13"/>
      <path d="M36 22c-7-7 5-11-1-17M46 22c-4-6 4-9 2-13"/>
      </g></svg><span>No classes scheduled</span></div>`;
  }
  return `<div class="week-columns${illustrated ? ' compact-week' : ''}" aria-label="Weekly course schedule">${days.map(([day, meetings]) =>
    `<section class="week-day" aria-label="${day}"><h2>${day}</h2>${dayContents(meetings)}</section>`).join('')}</div>`;
}
function schedule(staff=false){
  if (staff) {
    const stages = [['Ready for review','Review schedule'],['Draft','Edit draft'],['Not started','Start draft']];
    const groups = stages.map(([state,actionLabel])=>{
      const students = names.map((name,index)=>({name,index})).filter(({index})=>scheduleStates[index]===state);
      return `<section class="schedule-queue"><h2>${badge(state,statusTone(state))}</h2><ul>
        ${students.map(({name,index})=>`<li data-search-row data-schedule-state="${state}">
          <div>${staffIdentity(name,`70-${71577+index}`)}</div>
          <span class="schedule-major">${index===3?'Digital Media Engineering':'Computer Engineering'}</span>
          ${link('draft-schedule',actionLabel,'btn desk-action',index)}</li>`).join('')}
      </ul></section>`;
    }).join('');
    return head('Student schedules',termContext('Semester 7'),link('draft-schedule','Create advising draft','btn primary'))+
      filterbar('Search name or student ID',[['All statuses',stages.map(([state])=>state),'scheduleState'],['All majors',['Computer Engineering','Digital Media Engineering']]])+
      `<div class="schedule-roster">${groups}</div>${listFoot(names.length)}`;
  }
  const timetableContext = workspaces[lab.layout].name==='Claude Study' ? termContext('Group 4 · Computer Engineering') : '';
  return head('Weekly schedule',timetableContext,button('Export calendar','export-calendar'),'')+
    tabs([['week','Week'],['list','Course list']],'week')+(tab==='list'?registeredTable():weekly())+
    '';
}
function workflow() {
  const state=scheduleStates[selectedStudent];
  const ready=state==='Ready for review';
  const stages=[
    ['Preferences submitted',names[selectedStudent],state==='Not started'?'Not started':'Complete'],
    ['Advisor prepared draft',[2,8].includes(selectedStudent)?'Needs an advisor':'Dr. Salma Adel',ready?'Complete':state],
    ['Coordinator review','Review the proposed course load and timetable.',ready?'Awaiting decision':'Not started']
  ];
  return stages.map(([label,description,status])=>`<div class="task"><div><h3>${label}</h3><p>${description}</p></div>
    ${badge(status,status==='Awaiting decision'?'pending':statusTone(status))}</div>`).join('');
}
const removedPreviewDrafts = new Set();
function draft(){
  const removed = removedPreviewDrafts.has(selectedStudent);
  const deleteControl = `<portal-paper-delete label="Delete draft" demo data-delete-preview-draft ${removed?'deleted':''}></portal-paper-delete>`;
  if (removed) return head(`${names[selectedStudent].split(' ')[0]}’s advising draft`, 'The draft has been deleted in this preview.', deleteControl) + '<section class="panel"><h2>No draft</h2><p>Use the restore button to bring back this preview draft.</p></section>';
  return head(`${names[selectedStudent].split(' ')[0]}’s advising draft`, `70-${71577+selectedStudent} · ${selectedStudent===3?'Digital Media Engineering':'Computer Engineering'} · Semester 7`,button('Save draft','save-draft')+button('Process schedule','process','btn primary')+deleteControl,'Winter 2026')+
  `<div class="split academic-plan"><section class="panel"><h2>Selected courses</h2><div class="smallstats"><div><strong>19</strong><span>Credit hours</span></div><div><strong>4</strong><span>Courses selected</span></div><div><strong>0</strong><span>Time conflicts</span></div></div>${courseData.slice(0,4).map(c=>`<div class="task">${academicCourse(c,`<div><h3>${c[0]}</h3><p>${c[1]}</p></div>`)}<label><span class="sr-only">${c[0]} group</span><select aria-label="${c[0]} group"><option>Group 4</option><option>Group 2</option></select></label></div>`).join('')}</section><aside><section class="note"><div class="kicker">Student preferences</div><h2>Thursday off.</h2><p>Preferred group: 4<br>Earliest class: 08:30<br>Preferences updated 12 November.</p>${link('preferences','View preferences','btn text')}</section><section class="panel" style="margin-top:24px"><h2>Validation</h2><p>No time conflicts. Credit load is within the allowed range.</p></section></aside></div>`+(academicStudy() ? '<h2 class="academic-week-title">Proposed timetable</h2>' : '')+weekly()+`<section class="panel draft-workflow" style="margin-top:24px"><h2>Workflow</h2>${workflow()}<div class="draft-workflow-actions">${button('Reopen schedule','reopen','btn desk-action')}</div></section>`;}
function registeredTable(){return table(['Course','Type','Credits','Group',''],courseData.slice(0,4).map(c=>[`<strong>${c[1]}</strong><small>${c[0]}</small>`,'Mandatory',c[3],'4',courseLink(c[0],'View sections','btn row-control')]));}
function courseEmblem(code) {
  const courseTone = {'CSEN 701':'blue','CSEN 703':'coral','CSEN 704':'sage','DMET 701':'ivory','ELCT 701':'sage','MATH 701':'ivory'};
  return `<span class="student-course-emblem" data-course-tone="${courseTone[code]}">${courseDrawing(code)}</span>`;
}
function registered(){
  const due = [['Assignment due 12 Nov','review'], ['Reading due 10 Nov','ice'], ['Project due 19 Nov',''], ['Quiz on 18 Nov','pending']];
  const study = workspaces[lab.layout].name==='Claude Study';
  return head('My courses',study ? termContext('4 courses · 19 credit hours') : '4 courses · 19 credit hours',button('Request course removal','request-removal'),'')+
    `<div class="course-list">${courseData.slice(0,4).map(([code,title,,credits], i) =>
      `<article>${study?courseEmblem(code):''}<div><small>${code} · ${credits} credit hours</small><h2>${title}</h2></div>
      <div class="course-due">${badge(...due[i])}${courseLink(code,'View sections','btn row-control')}</div></article>`).join('')}</div>`;
}
function assignments(){
  const indices = names.map((_,i)=>i);
  const row = i=>`${staffIdentity(names[i],`70-${71577+i}`)}<p>Computer Engineering<small>Semester 7</small></p>
    <span class="group-label">${i%2?badge('Unassigned'):'Group 4'}</span>
    ${button(i%2?'Assign group':'Reassign','assign-group','btn desk-action',`data-student-index="${i}"`)}`;
  return head('Group assignments','Assign students to a published schedule group.')+filterbar('Search students',[['All groups',['Group 1','Group 4','Unassigned']]])+
    rosterSection('Needs a group',indices.filter(i=>i%2),row)+rosterSection('Group 4',indices.filter(i=>i%2===0),row)+listFoot(names.length);
}
function preferences(){
  const index=student()?0:selectedStudent;
  const preferencesState=preferenceDrafts.get(index) || studentPreferences.get(index) || {days:[],groups:Array(4).fill('No preference'),notes:''};
  const identity=`${names[index]} · 70-${71577+index}`;
  const summary = student()?'Winter 2026 / 2027':identity+' · Winter 2026 / 2027';
  const study = workspaces[lab.layout].name==='Claude Study';
  return head('Schedule preferences',study ? termContext(student()?'Group 4':identity) : summary,button('<span class="preference-save-label">Save preferences</span><span class="bookmark-tab" aria-hidden="true"></span>','save-preferences','btn bookmark-save'))+
    `<div class="preference-workspace">
      <div class="preference-stack">
        <section class="preference-block" aria-labelledby="preferred-days">
          <div class="section-head"><h2 id="preferred-days">${icon('calendar')} Preferred days off</h2><output id="preferred-day-count" aria-live="polite">${preferencesState.days.length} of 2 selected</output></div>
          <p>Choose up to two days you’d like to keep free.</p>
          <div class="preference-day-grid">${['Sunday','Monday','Tuesday','Wednesday','Thursday'].map(day=>`<label>
            <input class="dayoff" type="checkbox" value="${day}" ${preferencesState.days.includes(day)?'checked':''}>
            <svg class="day-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4Q10 3 20 4L21 20Q12 21 3 20Z"/><path class="day-tick" pathLength="1" d="m6 12 4 4q4-7 12-13"/></svg><span>${day}</span>
          </label>`).join('')}</div>
        </section>
        <section class="preference-block">
          <label class="preference-notes">Notes for your advisor<textarea id="preference-notes" rows="4" placeholder="Share any timing or accessibility needs.">${escapeHtml(preferencesState.notes)}</textarea></label>
        </section>
      </div>
      <section class="preference-block" aria-labelledby="preferred-groups">
        <div class="section-head"><h2 id="preferred-groups">${icon('book')} Preferred course groups</h2></div>
        <p>Choose a group for each course or leave it open.</p>
        <div class="preference-course-list">${courseData.slice(0,4).map(([code,title],index)=>`<label class="preference-course">
          ${study ? courseEmblem(code) : `<span class="task-icon" data-tone="${['sky','rose','mint','gold'][index]}">${icon('book')}</span>`}
          <span class="preference-course-name"><strong>${title}</strong><small>${code}</small></span>
          <select data-course-group="${index}" aria-label="${code} preferred group">${['Group 4','Group 2','No preference'].map(group=>`<option ${group===preferencesState.groups[index]?'selected':''}>${group}</option>`).join('')}</select>
        </label>`).join('')}</div>
      </section>
    </div>`;
}

function financial(){
  return head('Financial records','',button('Export CSV','export-csv'))+`<dl class="account-totals">${[['Received','22,500'],['Pending','15,000'],['Refunded','2,500']].map(([label,amount])=>`<div><dt>${label}</dt><dd>${amount} <small>EGP</small></dd></div>`).join('')}</dl>`+
    filterbar('Search by Student ID, Student Name, Receipt ID, or Reference...',[['Type',['TUITION','EXTRA_HOURS','FEE','REFUND'],'','All types'],['Status',['COMPLETED','PENDING','REFUNDED','FAILED'],'','All statuses'],['Term',['W25','S26'],'','All terms']])+
    `<ul class="transactions">${names.slice(0,6).map((name,i)=>`<li data-search-row>${staffIdentity(name,`70-${71577+i}`)}
      <p>${i===4?'Refund':'Payment'} · TXN-${1042+i}<small>14 Nov 2026</small></p><strong class="amount">${i===4?'2,500':'7,500'} <small>EGP</small></strong>
      ${badge([1,5].includes(i)?'Pending':'Completed',[1,5].includes(i)?'payment-pending':'payment-complete')}
      ${button('View record','financial-detail','btn desk-action',`data-record="${i}"`)}
    </li>`).join('')}</ul>${listFoot(6)}`;
}
function removals(){return head('Course removals','Review mandatory-course removal requests.',student()?button('Request removal','request-removal','btn primary'):'')+
  tabs([['pending','Pending · 3'],['approved','Approved'],['rejected','Rejected']],'pending','plain')+
  filterbar('Search student or course')+
  `<ul class="request-queue">${names.slice(0,3).map((name,i)=>`<li data-search-row>
    ${academicCourse(courseData[i],courseData[i][1])}<div class="request-person"><strong>${name}</strong><small>70-${71577+i}</small></div>
    <p>${removalReasons[i]}<small>Submitted 13 Nov 2026</small></p>
    ${button('Review request','removal-decision','btn desk-action',`data-request="${i}"`)}
  </li>`).join('')}</ul>${listFoot(3)}`;}
const removalReasons = ['Credit overload','Academic difficulty','Schedule conflict'];

function pending(){
  const study = workspaces[lab.layout].name==='Claude Study';
  const queues = [
    ['student-schedules','Review 6 student schedules','calendar',[
      [0,'Advising schedule','13 Nov',link('draft-schedule','Review schedule','btn desk-action',0)],
      [3,'Advising schedule','12 Nov',link('draft-schedule','Review schedule','btn desk-action',3)]
    ]],
    ['mandatory-removals','Decide 3 course removals','course-removal',[
      [1,'Course removal · '+courseData[1][0],'13 Nov',button('Review request','removal-decision','btn desk-action','data-request="1"')]
    ]],
    ['advising','Assign 2 advisors','advisor-assignment',[
      [2,'Advisor assignment','12 Nov',button('Assign advisor','assign-advisor','btn desk-action','data-student-index="2"')]
    ]]
  ];
  return head('Pending work','',button('Refresh','refresh'))+
    `<div class="pending-desk"><div class="queue-columns"><h2>Work queues</h2><h2>Work items</h2></div>
    ${queues.map(([target,label,symbol,items])=>{
      const drawing = symbol==='calendar' ? icon('calendar') : queueSketch(symbol);
      const heading = study ? `<span class="staff-queue-art">${drawing}</span><span>${label}</span>${icon('chevron')}` : label;
      return `<section class="queue-group"><h3>${link(target,heading,'staff-queue-link')}</h3>
        <ul aria-label="${label} work items">${items.map(([i,task,date,action])=>
          `<li>${staffIdentity(names[i],task+' · Since '+date)}${action}</li>`).join('')}</ul></section>`;
    }).join('')}</div>`;
}
function activity(){
  const events = [
    ...recentScheduleEvents,
    {action:'Draft saved',subject:'Omar Hassan',author:'Dr. Salma Adel',date:'2026-11-14',time:'10:42',tone:'draft'},
    {action:'Schedule processed',subject:'Mariam Mostafa',author:'Nadia Ahmed',date:'2026-11-14',time:'09:15',tone:'payment-complete'},
    {action:'Schedule reopened',subject:'Ahmed Khaled',author:'Nadia Ahmed',date:'2026-11-13',time:'14:30',tone:'review'},
    {action:'Draft saved',subject:'Farah Mahmoud',author:'Dr. Salma Adel',date:'2026-11-13',time:'11:00',tone:'draft'}
  ];
  const days = [...new Set(events.map(event=>event.date))];
  const actions = [...new Set(events.map(event=>event.action))];
  return head('Schedule activity','','','')+filterbar('Search activity',[['All actions',actions,'eventAction']])+
    `<div class="schedule-history">${days.map(date=>`<section class="history-day">
      <h2><time datetime="${date}">${formatCalendarDay(date,{weekday:'long',day:'numeric',month:'long'})}</time></h2>
      <ol>${events.filter(event=>event.date===date).map(event=>{
        const target = event.target || 'draft-schedule';
        const index = event.index ?? Math.max(0,names.indexOf(event.subject));
        const byline = event.author===event.subject ? event.author : event.subject+' · By '+event.author;
        return `<li data-search-row data-event-action="${event.action}">${link(target,
          `<time datetime="${date}T${event.time}">${event.time}</time>${avatar(event.author)}
          <div><strong>${event.action}</strong><small>${byline}</small></div>${icon('chevron')}`,'history-entry',index)}</li>`;
      }).join('')}</ol></section>`).join('')}</div>${listFoot(events.length)}`;

}

function records(){
  const strip=tabs([['history','Course history'],['transcript','Transcript'],['wallet','Wallet']],'history');
  const study = workspaces[lab.layout].name==='Claude Study';
  const performance = [['Cumulative GPA','1.70','Very good standing'],['Completed credits','116','Through semester 6'],['Current semester','07','Winter 2026']];
  const marks = study ? `<dl class="academic-standing">${performance.map(([label,value,detail])=>`<div><dt>${label}</dt><dd>${value}</dd><dd>${detail}</dd></div>`).join('')}</dl>` : stats(performance);
  return head('Academic records','Omar Hassan · 70-71577',tab==='transcript'?button('Download transcript','transcript'): '', 'Computer Engineering')+
    marks+strip+
    (tab==='wallet'?table(['Date','Transaction','Amount','Balance'],[['14 Nov 2026','Course registration payment','− EGP 7,500','EGP 2,500'],['10 Nov 2026','Wallet deposit','+ EGP 10,000','EGP 10,000']]):table(['Course','Semester','Credits','Grade','Status'],courseData.slice(0,4).map(c=>[`${c[0]}<small>${c[1]}</small>`,'Winter 2025',c[3],'1.7',badge('Passed')])));
}
function advisor(){
  const study = workspaces[lab.layout].name==='Claude Study';
  return head('Academic advising',study ? termContext('Semester 7') : '')+`
    <div class="advising-layout">
      <section class="advisor-details">${study ? `<header class="advisor-identity">${avatar('Dr. Salma Adel')}<div><h2>Dr. Salma Adel</h2><p>Computer Engineering</p></div></header>` : '<h2>Dr. Salma Adel</h2><p>Computer Engineering</p>'}
        <dl class="details"><div><dt>Email</dt><dd><a href="mailto:salma.adel@guc.edu.eg">salma.adel@guc.edu.eg</a></dd></div>
        <div><dt>Office</dt><dd>C3.204</dd></div><div><dt>Office hours</dt><dd>Tuesday, 12:00–14:00</dd></div>
        <div><dt>Assigned since</dt><dd>5 October 2026</dd></div></dl>
        <section class="advisor-checklist"><h2>Before you meet</h2>
        ${['Review remaining credits','Choose preferred course groups','Write down questions'].map(item => `<label class="checkrow"><input type="checkbox">${item}</label>`).join('')}
        </section>
      </section>
      <aside><section class="advisor-callout"><h2>Your draft is ready</h2><p>Review your course selections before meeting with Dr. Salma.</p>
        ${link('my-schedule','Review schedule','btn primary')}</section>
        <p class="advisor-deadline"><strong>Preferences due 18 November</strong><br>${link('preferences','Set course preferences','btn row-control')}</p>
      </aside>
    </div>`;
}
function mountLiveCalendar(panel) {
  const status = panel.querySelector('[role=status]');
  let token = localStorage.getItem(workspaceSessionKey);
  const controls = document.createElement('div');
  controls.className = 'calendar-last-sync';
  panel.append(controls);
  function control(label, run) {
    const el = document.createElement('button');
    el.className = 'btn row-control';
    el.textContent = label;
    controls.append(el);
    el.onclick = async () => {
      controls.querySelectorAll('button').forEach(button => button.disabled = true);
      try { await run(); }
      catch (error) { status.textContent = error.message; }
      finally { controls.querySelectorAll('button').forEach(button => button.disabled = false); }
    };
  }
  function signIn() {
    returnAfterSignIn = 'calendar-sync';
    navigate('login');
  }
  async function request(path, method = 'GET') {
    const response = await fetch('../api/calendar/' + path, { method, headers: { Authorization: 'Bearer ' + token } });
    const data = await response.json();
    if (!response.ok) {
      if ([401, 403].includes(response.status)) {
        controls.replaceChildren();
        control('Sign in as a student', signIn);
      }
      throw new Error(data.message || 'Calendar request failed.');
    }
    return data;
  }
  async function refresh() {
    const data = await request('connection');
    controls.replaceChildren();
    if (data.connected) {
      status.textContent = 'Connected as ' + data.providerAccountId + '. ' +
        (data.lastSyncError || (data.lastSyncedAt ? 'Last synced ' + new Date(data.lastSyncedAt).toLocaleString() : 'Waiting for the first sync.'));
      control('Sync now', async () => { await request('sync', 'POST'); await refresh(); });
      control('Change Google account', async () => location.assign((await request('connect')).authorizationUrl));
      control('Disconnect', async () => { await request('connection', 'DELETE'); await refresh(); });
    } else {
      status.textContent = data.configured ? 'Choose the Google account for your classes.' : 'Google Calendar setup is incomplete.';
      if (data.configured) control('Connect Google Calendar', async () => location.assign((await request('connect')).authorizationUrl));
    }
  }
  if (!token) {
    status.textContent = 'Sign in with your Bobos student account to access your calendar.';
    if (['localhost','127.0.0.1'].includes(location.hostname) && ['normalStudent','advisingStudent'].includes(role)) {
      status.textContent = 'Connect Google Calendar using the ' + roleNames[role].toLowerCase() + ' demo account.';
      control('Connect Google Calendar', async () => {
        if (!await signInDemoWorkspace(role)) { signIn(); return; }
        token = localStorage.getItem(workspaceSessionKey);
        const data = await request('connection');
        if (data.connected) await refresh();
        else location.assign((await request('connect')).authorizationUrl);
      });
    } else control('Sign in as a student', signIn);
    return;
  }
  refresh().catch(error => { status.textContent = error.message; });
  const timer = setInterval(() => {
    if (!panel.isConnected) { clearInterval(timer); return; }
    if (!document.hidden && !controls.querySelector(':disabled')) refresh().catch(error => { status.textContent = error.message; });
  }, 15000);
}
function calendarSync(){
  if (!student()) return head('Calendar sync') + '<p>Sign in with a student account to access Calendar sync.</p>';
  if (!comparePageDesigns) {
    return head('Calendar sync', 'Keep your processed timetable in Google Calendar.') +
      '<section class="student-calendar" data-live-calendar aria-label="Google Calendar"><h2>Google Calendar</h2><p role="status">Loading connection…</p></section>';
  }
  if(workspaces[lab.layout].name==='Claude Study') {
    return head('Calendar sync',termContext('Group 4 · Africa/Cairo'))+
      `<div class="student-calendar"><section aria-label="Google Calendar"><div class="calendar-provider">${icon('calendar')}<div><h2>Google Calendar</h2><p>${connected?'Connected as omar.hassan@student.guc.edu.eg':'Connect an account to sync course meetings.'}</p></div>${button(connected?'Disconnect':'Connect account','toggle-calendar','btn row-control')}</div>
      ${connected?`<div class="calendar-last-sync"><span>Last synced today at 09:15</span>${button('Sync now','sync-now','btn text')}</div>`:''}</section>
      <section class="calendar-file"><h2>Calendar file</h2><p>Import your teaching week into Apple Calendar, Outlook, or another calendar app.</p>${button('Download .ics','export-calendar','btn row-control')}</section></div>`;
  }
  return head('Calendar sync','Keep your course schedule in your calendar.')+`<section class="panel calendar-connect"><div class="connection"><div><h2>Google Calendar</h2><p>${connected?'Connected as omar.hassan@student.guc.edu.eg':'Connect your Google account to sync course meetings.'}</p></div>${button(connected?'Disconnect':'Connect account', 'toggle-calendar', connected?'btn':'btn primary')}</div><div class="connection"><div><h3>Course schedule</h3><p>Last synced today at 09:15. Times use Africa/Cairo.</p></div>${button('Sync now','sync-now','btn')}</div></section><section class="panel"><h2>Use another calendar</h2><p>Download an .ics file for Apple Calendar, Outlook, or another calendar app.</p><div style="margin-top:20px">${button('Download calendar','export-calendar')}</div></section>`;}
function swapWeek(daysOff) {
  return `<ol class="swap-week" aria-label="Teaching days">${['Sunday','Monday','Tuesday','Wednesday','Thursday'].map(day=>
    `<li class="${day===daysOff?'off':''}"><abbr title="${day}">${day.slice(0,3)}</abbr><span class="sr-only"> ${day===daysOff?'off':'classes'}</span></li>`
  ).join('')}</ol>`;
}
function swap(){
  const study = workspaces[lab.layout].name==='Claude Study';
  const context = study ? termContext('Group 4 · Computer Engineering') : 'Exchange your full schedule with a student taking the same courses.';
  return head('Eligible swap groups',context)+`<section class="panel"><div class="section-head"><h2>Your group: 4</h2><span class="count">Swap deadline · 13 December 2026</span></div><p>Computer Engineering · Semester 7 · 19 credit hours</p></section>`+
  tabs([['groups','Available groups'],['open','Open requests'],['mine','My requests']],'groups')+
  (tab==='mine'?table(['From','Requested groups','Submitted','Status',''],[['Group 4','Group 1, Group 2','13 Nov 2026',badge('Open','pending'),button('Withdraw','withdraw','btn text')]]):`<div class="course-options">${[1,2].map((n)=>`<section class="course-option"><div class="kicker">Computer Engineering</div><h2>Group ${n}</h2><p>Same 4 registered courses · 19 credits</p>${study?swapWeek(n===1?'Tuesday':'Sunday'):''}<dl class="details"><div><dt>Days off</dt><dd>${n===1?'Tuesday':'Sunday'}</dd></div><div><dt>Earliest class</dt><dd>${n===1?'10:00':'08:30'}</dd></div></dl><div class="form-footer">${button('View schedule','group-schedule')}${button(tab==='open'?'Exchange schedules':'Request swap',tab==='open'?'exchange':'request-swap','btn primary')}</div></section>`).join('')}</div>`);
}
function auth(){
  const title=page==='login'?'Sign in':page==='forgot'?'Reset your password':'Choose a new password';
  return `<main class="auth" id="content" tabindex="-1">
    <div class="signin-copy">
      <header><span class="wordmark">${portalWordmark()}</span></header>
      <section class="auth-card">
        <h1>${title}</h1>
        ${page==='login'?'':`<p>${page==='forgot'?'We’ll send a reset code to your university email.':'Enter the six-digit code from your email.'}</p>`}
        <form id="auth-form">
          ${page==='login' ? `<label>University email<input name="email" type="email" autocomplete="username" required value="${previewEmail}"></label>
            <label>Password<input name="password" type="password" autocomplete="current-password" required value="portal-demo"></label>
            <div class="signin-actions"><button type="submit" class="signin-continue">Continue <span aria-hidden="true">→</span></button>${link('forgot','Forgot password?','auth-recovery')}</div>` : `
            <label>University email<input name="email" type="email" autocomplete="username" placeholder="${previewEmail}" required value="${page==='reset'?previewEmail:''}"></label>
            ${page==='reset'?'<label>Reset code<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required></label><label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>':''}
            <button type="submit" class="btn primary">${page==='forgot'?'Send reset code':'Update password'}</button>
            ${link('login','Back to sign in','auth-recovery')}`}
        </form>
        ${page==='login' ? `<fieldset class="preview-role-picker">
          <legend>Quick demo sign-in</legend>
          <div class="preview-role-options">${Object.entries(roleNames).map(([id,label])=>
            button(label,'preview-sign-in','preview-role-button',`data-preview-role="${id}"`)).join('')}</div>
        </fieldset>` : ''}
      </section>
      ${productionPreview?'':'<footer><span>Design preview</span></footer>'}
    </div>
    ${comparePageDesigns && params.has('image') ? signinGallery() : '<figure class="signin-print"><div class="desk-lamp-scene"><img src="images/borrowed-light.svg" alt="Desk lamp lighting a sheet of paper" fetchpriority="high"></div></figure>'}
  </main>`;
}
function extraHours(){
  if (!['advisor', 'coordinator', 'advisingStudent'].includes(role)) {
    return head('Extra-hours requests') + '<p>This page is unavailable for your role.</p>';
  }
  if (role !== 'advisingStudent' && !localStorage.getItem(workspaceSessionKey)) {
    const request = ['Winter 2026', '3', badge('Awaiting decision', 'pending')];
    const sampleTable = student()
      ? table(['Term', 'Credits', 'Status'], [request], false)
      : table(['Student', 'Term', 'Credits', 'Status'], [['Omar Hassan', ...request]], false);
    return head('Extra-hours requests', 'Demo preview · Sample requests') + sampleTable;
  }
  return head('Extra-hours requests') +
    `<iframe class="extra-hours-frame" style="border:0;background:transparent;color-scheme:${lab.dark ? 'dark' : 'light'}" title="Extra-hours request workspace" src="../workspace.html?screen=extra-hours&amp;embedded=1&amp;theme=${lab.dark ? 'dark' : 'light'}&amp;role=${role}"></iframe>`;
}

function academicServices() {
  const screen = new URLSearchParams(location.search).get('screen') || 'overview';
  const query = new URLSearchParams({ screen, embedded:'1', section:'academic-services', theme:lab.dark ? 'dark' : 'light', role });
  return head('Academic services') +
    `<iframe class="academic-services-frame" title="Academic services workspace" src="../academic-services.html?${query.toString().replaceAll('&', '&amp;')}"></iframe>`;
}

function graduationPlans() {
  if (!['advisor', 'coordinator', 'advisingStudent'].includes(role)) {
    return head('Graduation plans') + '<p>This page is unavailable for your role.</p>';
  }
  const query = new URLSearchParams({ screen:'graduation-plans', embedded:'1', theme:lab.dark ? 'dark' : 'light', role });
  if (role === 'advisor' && new URLSearchParams(location.search).get('view') === 'submitted') query.set('view', 'submitted');
  return head('Graduation plans') +
    `<iframe class="graduation-frame" title="Graduation plan workspace" src="../academic-services.html?${query.toString().replaceAll('&', '&amp;')}"></iframe>`;
}

const renderers = {'academic-services':academicServices,'extra-hours':extraHours,overview,notifications,profile, directory, 'student-detail':()=>profile(true),advising,'pending-work':pending,'schedule-activity':activity,'financial-records':financial,'mandatory-removals':removals,'student-schedules':()=>schedule(true),'draft-schedule':draft,courses,'course-detail':courseDetail,terms,offerings,'copy-offerings':copyOfferings,templates,'template-detail':templateDetail,'group-assignments':assignments,'my-schedule':schedule,'my-courses':registered,'schedule-swap':swap,preferences,records,'my-advisor':advisor,'calendar-sync':calendarSync,'graduation-plans':graduationPlans};
function themeControl(){
  return button('<span class="' + (!lab.dark ? 'theme-light' : '') + '">' + icon('sun') + '</span><span class="' + (lab.dark ? 'theme-light' : '') + '">' + icon('moon') + '</span>',
    'toggle-theme', 'theme-toggle', 'aria-label="Switch to ' + (lab.dark ? 'light' : 'dark') + ' mode"');
}
function accountControls(){
  const bell = `<svg class="icon notice-bell" aria-hidden="true" viewBox="0 0 28 28" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path class="bell-body" d="M8 12c0-4 2.1-6.6 6-6.6s6 2.8 6 6.6c0 3.6 1.2 5.4 2.4 7.1-4.7.8-12.3.8-16.8 0C7 17.4 8 15.4 8 12Z"/>
    <path class="bell-clapper" d="M12 22q2 2 4-.2"/>
    <path class="bell-echo" pathLength="1" d="M4.4 7.8Q2.5 10 2.7 12.4M23.6 7.3q2.1 2.3 2 4.4"/>
  </svg>`;
  return `<a class="icon-button" href="${href('notifications')}" data-page="notifications" aria-label="Notifications" title="Notifications">${bell}${notificationEntries().some(([id])=>isNotificationUnread(id)) ? '<span class="notification-dot"></span>' : ''}</a>
    <button type="button" class="account-button" popovertarget="account-menu" aria-label="Account menu for ${person()}">${avatar(person())}<span>${person()}</span>${icon('down')}</button>
    <div id="account-menu" popover><div class="account-caption">${roleNames[role]}</div>${link('profile','My profile')}${button('Sign out','sign-out','sign-out')}</div>`;
}

let arrivalObserver;
let overviewOpened = false;
const revealedOverviewItems = new Set();
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');

function finishArrival(item){
  arrivalObserver?.unobserve(item);
  item.removeAttribute('data-arriving');
  item.removeAttribute('data-paper-reveal');
  item.style.removeProperty('--folder-duration');
  item.getAnimations().filter(animation=>animation.id==='overview-arrival').forEach(animation=>animation.cancel());
}

const P = (t,x=0,y=0,r=0,a=1,sx=1,sy=sx) => ({t,x,y,r,a,sx,sy});
const finalPose = () => P(1);
function compileExposureSheet(anchors, duration, seed, grain = 65) {
 const frames = [];
 // Two doubles, a short exposure, then a long hold: never a mechanical ticker.
 const exposures = [1, 1.22, .73, 1.58, .91, .67, 1.31, 1.04];
 for(let i=0;i<anchors.length-1;i++){
  const a=anchors[i], b=anchors[i+1], span=(b.t-a.t)*duration;
  const same = ['x','y','r','a','sx','sy'].every(k=>Math.abs(a[k]-b[k])<.00001);
  const count=same?1:Math.max(1,Math.round(span/grain));
  const weights=Array.from({length:count},(_,j)=>exposures[(seed+i+j)%exposures.length]);
  const total=weights.reduce((s,n)=>s+n,0);let exposureTime=0;
  for(let j=0;j<count;j++){
   const q=j/count, f={t:a.t*duration+span*(exposureTime/total)};
   for(const k of ['x','y','r','a','sx','sy']) f[k]=a[k]+(b[k]-a[k])*q;
   f.x=Math.round(f.x);f.y=Math.round(f.y);f.r=Math.round(f.r*4)/4;
   frames.push(f);exposureTime+=weights[j];
  }
 }
 frames.push({...anchors[anchors.length-1],t:duration});
 return frames;
}

function playOverviewPose(el,kind,index,order){
  const rect=el.getBoundingClientRect();
  const queueIndex=index,dayIndex=index,courseIndex=index,ordinal=index;
  const sign=index%2===0?-1:1;
  let duration,delay,anchors,origin='50% 70%';
  if(kind==='course'){
    const distance=(innerWidth<760?210:340)+(index%3)*42;
    const x=sign*distance,y=100+(ordinal%3)*17;duration=1620; // exact original poses; shorter cut by default
    delay=595+courseIndex*75;
    origin=ordinal%2?'85% 95%':'15% 95%';
    anchors=[P(0,x,y,sign*9,0),P(.05,x,y,sign*9,1),P(.16,x*.78,y,sign*4),P(.23,x*.78,y,sign*4),P(.31,x*.78,y*.48,-sign*6),P(.38,x*.78,y*.48,-sign*6),P(.5,x*.28,y*.48,sign*8),P(.56,x*.28,y*.48,sign*8),P(.65,x*.28,-17,-sign*5),P(.72,x*.28,-17,-sign*5),P(.81,-sign*12,-17,sign*3),P(.87,-sign*12,4,-sign*2),P(.94,sign*4,4,sign),finalPose()];
  }else if(kind==='chrome'){
   // A book opens, then four groups of index tabs tug free of the binding.
   // The shell, layout and navigation hit targets never change position.
   if(el.classList.contains('brand')){
    duration=650;delay=15;origin='12% 52%';
    anchors=[P(0,-25,-5,-5,0,.97),P(.12,-25,-5,-5,.45,.97),P(.29,-13,1,2,.9),P(.45,-13,1,2,1),P(.60,4,-1,-1.5),P(.74,4,-1,-1.5),P(.85,-2,0,.5),finalPose()];
   }else if(el.classList.contains('study-nav-group')){
    const i=Math.max(0,index-1);
    duration=710+(i%2)*55;delay=105+i*115;origin='8% 35%';
    anchors=[P(0,-26+(i%2)*5,6,-2.8,0),P(.10,-26+(i%2)*5,6,-2.8,0),
     P(.19,-18,0,-1.7,.75),P(.31,-18,0,-1.7,1),P(.49,-5,-2,1.3),
     P(.61,-5,-2,1.3),P(.74,3,1,-.65),P(.85,3,1,-.65),P(.93,-1,0,.3),finalPose()];
   }else if(el.classList.contains('sidebar-foot')){
    duration=640;delay=605;origin='15% 60%';
    anchors=[P(0,-10,6,-1,0),P(.2,-10,6,-1,0),P(.44,2,-1,.6,.83),P(.62,2,-1,.6,1),P(.85,-1,0,-.25),finalPose()];
   }else{
    // The top bar is a fixed frame, not another piece of furniture flying in.
    duration=475;delay=140;
    anchors=[P(0,0,0,0,.25),P(.15,0,0,0,.45),P(.47,0,0,0,1),finalPose()];
   }
  }else if(kind==='queue'){
   // Pencil-settle at 35% texture: an almost imperceptible wrong registration,
   // a short held correction, then the illustration gets its own little gesture.
   duration=765;delay=250+queueIndex*135;origin='28% 72%';
   const signQ=queueIndex===1?1:-1;
   anchors=[P(0,signQ*10,13,signQ*1.4,0),P(.13,signQ*10,13,signQ*1.4,.22),
    P(.28,signQ*5,6,-signQ*.65,.71),P(.40,signQ*5,6,-signQ*.65,1),
    P(.53,-signQ*2,-1.7,signQ*.34),P(.66,-signQ*2,-1.7,signQ*.34),
    P(.81,signQ*1,.7,-signQ*.17),P(.9,signQ*1,.7,-signQ*.17),finalPose()];
  }else if(kind==='greeting'){
   // A handwritten title finding the line, with a deliberate half-beat hold.
   duration=675;delay=82;
   anchors=[P(0,-6,14,-.65,0),P(.16,-6,14,-.65,.16),P(.36,-1,5,.3,.85),
    P(.49,-1,5,.3,1),P(.70,1,-1,-.16),P(.84,1,-1,-.16),finalPose()];
  }else if(kind==='decoration'){
   duration=650;delay=265;origin='50% 60%';
   anchors=[P(0,4,8,-8,0),P(.22,4,8,-8,.12),P(.44,-1,1,3,.9),P(.62,-1,1,3,1),P(.82,1,-1,-1.5),finalPose()];
  }else if(kind==='heading'){
   duration=515;delay=rect.top<350?185:580;
   anchors=[P(0,-5,8,-.6,0),P(.18,-5,8,-.6,.28),P(.40,-2,3,.3,.84),
    P(.54,-2,3,.3,1),P(.73,1,-1,-.14),P(.85,1,-1,-.14),finalPose()];
  }else if(kind==='day'){
   // A little lifted tab, timed before the actual timetable card walks in.
   duration=530;delay=420+dayIndex*75;origin='10% 90%';
   anchors=[P(0,0,11,-1.8,0),P(.19,0,11,-1.8,.2),P(.39,0,3,1,.9),
    P(.52,0,3,1,1),P(.75,0,-1,-.3),P(.89,0,-1,-.3),finalPose()];
  }else if(kind==='upcoming'){
   // Dates slip into view like small ledger entries, not like paper cards.
   duration=555;delay=410;
   anchors=[P(0,-6,9,-.35,0),P(.2,-6,9,-.35,.3),P(.48,1,2,.2,.9),
    P(.64,1,2,.2,1),P(.84,-1,0,-.1),finalPose()];
  }else if(kind==='note'){
   // A quiet page landing. No scramble whatsoever.
   duration=700;delay=680;
   anchors=[P(0,0,12,.45,0),P(.20,0,12,.45,.2),P(.48,0,4,-.2,.78),
    P(.67,0,1,0,1),finalPose()];
  }else if(kind==='empty'||kind==='meta'){
   duration=500;delay=kind==='empty'?710:180+order*27;
   anchors=[P(0,0,5,0,0),P(.28,0,5,0,.2),P(.56,0,1,0,.85),finalPose()];
  }else{
   duration=480;delay=180;
   anchors=[P(0,0,7,0,0),P(.28,0,7,0,.25),P(.65,0,0,0,1),finalPose()];
  }
  const grain=kind==='course'?82*1620/2020:kind==='queue'?45:kind==='chrome'?57:38;
  const frames=compileExposureSheet(anchors,duration,index+4,grain).map(p=>({
    offset:p.t/duration,opacity:p.a,transformOrigin:origin,easing:'steps(1,end)',
    transform:`translate3d(${p.x}px,${p.y}px,0) rotate(${p.r}deg) scale(${p.sx},${p.sy})`
  }));
  const pace = kind==='chrome' ? .86 : ['greeting','decoration','meta','queue','heading'].includes(kind) ? .92 : 1;
  el.animate(frames,{id:'overview-arrival',duration:duration*pace,delay:delay*pace,fill:'backwards'});
}

function stageOverview(main){
  const title=main.querySelector('.page-head h1');
  const greeting=document.createElement('div');
  greeting.className='illustrated-greeting';
  title.before(greeting);
  greeting.append(title);
  const hour=new Date().getHours();
  const night=hour>=18 || hour<6;
  const sky=night ? `<path class="moon-face" d="M40 8c-17 0-27 17-20 29 6 11 23 14 33 3-12 4-23-4-22-15 0-7 4-13 9-17Z"/><g class="sky-rays"><path d="m52 11 .8 3.5 3.4 1-3.4 1-.8 3.4-1-3.4-3.2-1 3.2-1Z"/><path d="m58 24 .7 2.3 2.3 .7-2.3 .7-.7 2.3-.7-2.3-2.3-.7 2.3-.7Z"/></g>`
    : `<path class="sun-face" d="M21 35c-6-13 5-25 16-21 8 2 10 11 7 18"/><g class="sky-rays"><path d="M32 6l1 4m-17 2 3 4M9 28h6m36-15-4 5m10 10-6 1"/></g>`;
  const nameOrRow=title.querySelector('.greeting-name') || greeting;
  nameOrRow.insertAdjacentHTML('beforeend',`<svg class="greeting-sun ${night?'night-sky':'day-sky'}" viewBox="4 3 59 52" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${sky}<path class="sky-horizon" d="M11 47q10-4 21-3t24 0"/><path d="m19 50 10 1m6 0 13-1" opacity=".5"/></svg>`);
  if(motionPreference.matches) return;
  const opening=!overviewOpened;
  overviewOpened=true;
  const shell=main.closest('.shell');
  const units=new Map();
  const groups={
    chrome:'.brand,.study-nav-group,.sidebar-foot,.topbar',
    greeting:'.page-head h1',meta:'.page-head p',decoration:'.greeting-sun',
    heading:'.section-head,.timetable-heading',queue:'.queue-entry',upcoming:'.desk-calendar',
    day:'.week-day>h2',course:'.week-class',empty:'.week-day-off',
    note:'.module-review .review-person,.module-activity :is(.event,.activity-impression)',
    folder:'.module-review .draft-file'
  };
  for(const [kind,selector] of Object.entries(groups)){
    shell.querySelectorAll(selector).forEach((el,index)=>units.set(el,{kind,index}));
  }
  function reveal(el,order,scroll){
    const {kind,index}=units.get(el);
    el.removeAttribute('data-arriving');
    const key=role+'-'+kind+'-'+index;
    if(revealedOverviewItems.has(key) || el.matches(':focus-within')) return;
    revealedOverviewItems.add(key);
    if(kind==='folder'){
      el.style.setProperty('--folder-duration',`${590+index*24}ms`);
      el.dataset.paperReveal='folder';
      const label=el.querySelector('strong');
      label.addEventListener('animationend',()=>finishArrival(el),{once:true});
      return;
    }
    if(kind==='empty'){
      if(opening || scroll){
        el.classList.add('coffee-wait');
        // Let the last visible class card give the saucer its entrance cue.
        const arrivals=Array.from(main.querySelectorAll('.week-class')).flatMap(card=>card.getAnimations())
          .filter(a=>a.id==='overview-arrival');
        const placeCoffee=()=>{
          el.classList.remove('coffee-wait');
          if(el.isConnected&&!motionPreference.matches) el.classList.add('placing-coffee');
        };
        if(scroll) setTimeout(placeCoffee,180);
        else Promise.allSettled(arrivals.map(a=>a.finished)).then(placeCoffee);

      }
      return;
    }
    if(!scroll){
      if(opening) playOverviewPose(el,kind,index,order);
      return;
    }
    // The pencil-settle drawing from the scroll study, at one fifth amplitude.
    const direction=index%2 ? -1 : 1;
    const poses=[[0,-13,11,-1.4,.45],[.13,-11,9,-1.1,.7],[.23,-5,4,-.4,.86],
      [.39,-3,3,.1,.96],[.51,1,-1,.22,1],[.70,1,-1,.22,1],[.81,-.7,.3,-.1,1],[1,0,0,0,1]];
    el.animate(poses.map(([offset,x,y,angle,opacity])=>({
      offset,opacity,easing:'steps(1,end)',transform:`translate(${x*.2*direction}px,${y*.2}px) rotate(${angle*.2*direction}deg)`
    })),{id:'overview-arrival',duration:290,delay:Math.min(order,4)*24,fill:'backwards'});
  }
  arrivalObserver=new IntersectionObserver(entries=>{
    entries.filter(entry=>entry.isIntersecting).forEach(({target},order)=>{
      arrivalObserver.unobserve(target);
      if(target.hasAttribute('data-arriving')) reveal(target,order,true);
    });
  });
  let order=0;
  for(const [el,{kind,index}] of units){
    const rect=el.getBoundingClientRect();
    if(revealedOverviewItems.has(role+'-'+kind+'-'+index)) continue;
    if(kind==='chrome'||(rect.top<innerHeight && rect.bottom>0)) reveal(el,order++,false);
    else {el.setAttribute('data-arriving','');arrivalObserver.observe(el);}
  }
  if(opening) shell.querySelectorAll('.study-nav-group').forEach((group,i)=>{
    group.querySelectorAll('a').forEach((link,j)=>{
      link.animate([
        {offset:0,opacity:0,clipPath:'inset(0 100% 0 0)'},
        {offset:.18,opacity:.5,clipPath:'inset(0 50% 0 0)'},
        {offset:.38,opacity:.85,clipPath:'inset(0 15% 0 0)'},
        {offset:.6,opacity:1,clipPath:'inset(0)'},{opacity:1,clipPath:'inset(0)'}
      ].map(frame=>({...frame,easing:'steps(1,end)'})),{id:'overview-arrival',duration:370,delay:155+i*101+j*49,fill:'backwards'});
    });
  });
  shell.addEventListener('focusin',event=>{
    for(let el=event.target;el && el!==shell;el=el.parentElement) finishArrival(el);
  });
}
motionPreference.addEventListener('change',()=>{
  if(!motionPreference.matches) return;
  if(pendingExposure) pendingExposure.finish();
  arrivalObserver?.disconnect();
  document.querySelectorAll('[data-arriving],[data-paper-reveal]').forEach(finishArrival);
  document.getAnimations().filter(animation=>animation.id==='overview-arrival').forEach(animation=>animation.cancel());
});

function applyServiceFrameTheme(frame, documentElement) {
  documentElement.dataset.theme = lab.dark ? 'dark' : 'light';
  frame.style.colorScheme = documentElement.dataset.theme;
  const theme = getComputedStyle(frame);
  for (const [target, source] of Object.entries({ canvas:'canvas', ink:'ink', muted:'muted', line:'rule', raised:'raised', paper:'paper' })) {
    const value = theme.getPropertyValue('--' + source).trim();
    if (value) documentElement.style.setProperty('--embedded-' + target, value);
  }
}

function render(focus=false){
  closeDeadline();
  clearFlipExposure();
  if (!authPages.has(page) && (!signedIn() || (page === 'extra-hours' && !localStorage.getItem(workspaceSessionKey)))) {
    returnAfterSignIn = page;
    page = 'login';
    history.replaceState({},'',href(page));
  }
  if (page === 'schedule-swap' && role === 'normalStudent' && !comparePageDesigns && localStorage.getItem(workspaceSessionKey)) {
    page = 'academic-services';
    const destination = new URL(location.href);
    destination.searchParams.set('page', page);
    destination.searchParams.set('screen', 'schedule-swap');
    history.replaceState(history.state, '', destination);
  }
  document.title=`Portal — ${layoutNames[lab.layout]} · ${pages[page]}`;
  document.body.classList.toggle('auth-screen',authPages.has(page));
  const body=authPages.has(page)?auth():`<div class="shell">${sidebar()}<div class="workspace"><header class="topbar">${link('overview',portalWordmark(),'mobile-nav wordmark')}<span class="term">${workspaces[lab.layout].name==='Claude Study'?'<small class="study-crumb">Academic workspace &nbsp; / &nbsp;</small>':''}${pages[page]}<span>Winter 2026 / 2027</span></span><div class="topactions">${button(icon('menu')+'<span class="sr-only">Menu</span>','mobile-menu','mobile-menu')}${themeControl()}${accountControls()}</div></header><main class="content" data-screen="${page}" id="content" tabindex="-1">${renderers[page]()}</main></div></div>`;
  arrivalObserver?.disconnect();
  inboxArtObserver?.disconnect();
  app.innerHTML=body;
  if (authPages.has(page)) {
    const themeTools = document.createElement('div');
    themeTools.className = 'portal-auth-theme';
    themeTools.innerHTML = themeControl();
    app.append(themeTools);
  }
  const deletePreview = app.querySelector('[data-delete-preview-draft]');
  if (deletePreview) {
    deletePreview.perform = async () => { removedPreviewDrafts.add(selectedStudent); render(); toast('Draft deleted in this preview.'); return true; };
    deletePreview.restore = async () => { removedPreviewDrafts.delete(selectedStudent); render(); toast('Draft restored in this preview.'); return true; };
  }
  const liveCalendar = app.querySelector('[data-live-calendar]');
  if (liveCalendar) mountLiveCalendar(liveCalendar);
  if (comparePageDesigns) attachPageDesign(page,role,render);
  const serviceFrame = app.querySelector('.extra-hours-frame, .graduation-frame, .academic-services-frame');
  serviceFrame?.addEventListener('load', () => {
    const root = serviceFrame.contentDocument?.getElementById('root');
    if (!root) return;
    applyServiceFrameTheme(serviceFrame, root.ownerDocument.documentElement);
    const observer = new ResizeObserver(() => {
      serviceFrame.style.height = Math.ceil(root.getBoundingClientRect().height) + 'px';
    });
    observer.observe(root);
    serviceFrame.contentWindow.addEventListener('pagehide', () => observer.disconnect(), { once:true });
  });
  drawInputEdges(app);
  if (page === "preferences") syncPreferenceSaveButton();
  const main = app.querySelector('main');
  if (main && !authPages.has(page) && (!comparePageDesigns || !Number(localStorage.getItem('portal-page-design:'+page)))) {
    window.addStudentArt?.(page,main,role);
    window.addStaffArt?.(page,main,role);
  }
  syncControls(role, page);
  if(page==='overview' && workspaces[lab.layout].name==='Claude Study') stageOverview(app.querySelector('main'));
  const inboxArt = app.querySelector('.student-tumbleweed-scene,.student-bell-control');
  if (inboxArt) {
    inboxArtObserver = new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      inboxArt.classList.add('is-playing');
      observer.disconnect();
    }, { threshold: 0.5 });
    inboxArtObserver.observe(inboxArt);
  }
  const lamp = app.querySelector('.desk-lamp-scene');
  if (lamp) mountDeskLamp(lamp);
  binderMotion.mount(app.querySelector('[data-concertina=true] .folio-stack'));
  if(focus)document.querySelector('#content')?.focus({preventScroll:true});
}
function navigate(target,url){if(dialog.open)dialog.close();page=pageKey(target);tab='';history.pushState({},'',url || href(page));render(true);window.scrollTo(0,0);}
function startPreview(destination){
  localStorage.setItem(previewSessionKey,'1');
  returnAfterSignIn = 'overview';
  navigate(destination);
}
async function signInWorkspace(credentials, expectedRole){
  const response = await fetch('../api/identity/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(credentials),
  });
  const data = await response.json();
  if (!response.ok || !data.token || !Object.hasOwn(roleNames,data.user?.role)) {
    throw new Error(data.message || 'Could not sign in to the workspace.');
  }
  if (expectedRole && data.user.role !== expectedRole) throw new Error('The demo account has a different role.');
  localStorage.setItem(workspaceSessionKey,data.token);
  return data.user.role;
}

async function signInDemoWorkspace(demoRole){
  const response = await fetch(`../__bobos_local_demo?role=${encodeURIComponent(demoRole)}`);
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    const accounts = { normalStudent:'karim.normal@student.guc.edu.eg', advisingStudent:'layla.advising@student.guc.edu.eg', coordinator:'nadia.coordinator@guc.edu.eg', advisor:'sherif.advisor@guc.edu.eg', administrator:'admin@guc.edu.eg' };
    if (!['localhost','127.0.0.1'].includes(location.hostname) || !accounts[demoRole]) return false;
    await signInWorkspace({email:accounts[demoRole], password:'Password123!'},demoRole);
    return true;
  }
  await signInWorkspace(await response.json(),demoRole);
  return true;
}

async function choosePreviewRole(el){
  if (page !== 'login' || !Object.hasOwn(roleNames,el.dataset.previewRole)) return;
  const selected = el.dataset.previewRole;
  const picker = el.closest('.preview-role-picker');
  picker.disabled = true;
  try {
    const authenticated = await signInDemoWorkspace(selected);
    if (!authenticated && returnAfterSignIn === 'calendar-sync') {
      const studentEmail = {normalStudent:'karim.normal@student.guc.edu.eg', advisingStudent:'layla.advising@student.guc.edu.eg'}[selected];
      if (!studentEmail || !['localhost','127.0.0.1'].includes(location.hostname)) throw new Error('Enter your Bobos student email and password to access Calendar sync.');
      await signInWorkspace({email:studentEmail, password:'Password123!'}, selected);
    }
    role = selected;
    startPreview(returnAfterSignIn);
  } catch (error) {
    toast(error.message);
  } finally {
    picker.disabled = false;
  }
}
function replayInboxArt(scene){
  if (!scene) return;
  inboxArtObserver?.disconnect();
  scene.classList.remove('is-playing', 'is-replaying');
  void scene.offsetWidth;
  scene.classList.add('is-replaying');
}

async function chimeAtStrike(){
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    bellAudio ??= new Audio();
    if (bellAudio.state === 'suspended') await bellAudio.resume();
    const strike = bellAudio.currentTime + 0.48;
    for (const [frequency, volume, decay] of [[440, .065, 1.45], [708, .032, 1.15], [1184, .018, .7], [1756, .009, .38]]) {
      const tone = bellAudio.createOscillator();
      const envelope = bellAudio.createGain();
      tone.frequency.value = frequency;
      envelope.gain.setValueAtTime(.0001, strike);
      envelope.gain.exponentialRampToValueAtTime(volume, strike + .012);
      envelope.gain.exponentialRampToValueAtTime(.0001, strike + decay);
      tone.connect(envelope).connect(bellAudio.destination);
      tone.start(strike);
      tone.stop(strike + decay + .02);
    }
  } catch {
    // The illustration still plays when audio is unavailable.
  }
}
function toast(text, tone = 'success') {
  document.querySelector('portal-action-feedback').show(tone, text);
}
function modal(title,content,submit='Save changes',action='save-modal'){
  returnFocus=document.activeElement;
  const form=submit===null?'':`<form id="modal-form" data-submit-action="${action}"><div id="modal-fields"></div><div class="form-footer">${button('Cancel','close-dialog')}<button class="btn primary" type="submit">${submit}</button></div></form>`;
  dialog.innerHTML=`<div class="modal-head"><h2 id="portal-dialog-title">${title}</h2>${form?button('Close','close-dialog',''):''}</div>${content}${form}`;
  dialog.setAttribute('aria-labelledby','portal-dialog-title');
  // Keep all form controls inside the form so native validation works.
  const fields=dialog.querySelectorAll(':scope > .modal-fields');
  fields.forEach(el=>dialog.querySelector('#modal-fields').replaceWith(el));
  drawInputEdges(dialog);
  dialog.showModal();
}
function fields(content){return `<div class="modal-fields">${content}</div>`;}
function closeDialog(){dialog.close();if(returnFocus?.isConnected)returnFocus.focus();}
function download(filename,text,type='text/plain'){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast(`Downloaded ${filename}`);
}
function filterRows(){
  const query=(document.querySelector('#search')?.value||'').toLowerCase();
  const filters=Array.from(document.querySelectorAll('[data-filter]')).filter(el=>el.value);
  let count=0;
  for (const row of document.querySelectorAll('[data-search-row]')) {
    const text=(row.textContent+' '+(row.dataset.scheduleState||'')).toLowerCase();
    const matchesFilters=filters.every(el=>el.dataset.filter ? row.dataset[el.dataset.filter]===el.value : text.includes(el.value.toLowerCase()));
    row.hidden=!(text.includes(query) && matchesFilters);
    if (!row.hidden) count++;
  }
  let previousLetter;
  for (const mark of document.querySelectorAll('.register-entry:not([hidden]) .index-letter')) {
    const letter=mark.dataset.letter;
    mark.textContent=letter===previousLetter?'':letter;
    previousLetter=letter;
  }
  const result=document.querySelector('#result-count');if(result)result.textContent=`${count} ${count===1?'record':'records'}`;const empty=document.querySelector('.search-empty');if(empty)empty.hidden=count>0;
  syncFilterChips();
}
function syncFilterChips(){
  const chips=document.querySelector('#filter-chips');if(!chips)return;
  const selects=Array.from(document.querySelectorAll('[data-filter]'));
  const active=selects.map((el,index)=>({el,index})).filter(({el})=>el.value);
  chips.innerHTML=active.map(({el,index})=>`<li class="filter-chip">${el.value}<button type="button" data-action="remove-filter" data-filter-index="${index}" aria-label="Remove filter ${el.value}">\u00d7</button></li>`).join('')+(active.length?'<li><button class="btn text" type="button" data-action="clear-filters">Clear all</button></li>':'');
  chips.hidden=!active.length;
  const count=document.querySelector('.filter-toggle .filter-count');if(count){count.textContent=active.length;count.hidden=!active.length;}
}
function action(name,el){
  if (name === 'toggle-theme') {
    window.revealPortalTheme(el, () => {
      lab.dark = !lab.dark;
      localStorage.setItem('portal.theme', lab.dark ? 'dark' : 'light');
      applyLook();
      el.outerHTML = themeControl();
      const serviceFrame = app.querySelector('.graduation-frame, .academic-services-frame');
      if (serviceFrame?.contentDocument?.documentElement) {
        applyServiceFrameTheme(serviceFrame, serviceFrame.contentDocument.documentElement);
      }
      const frame = app.querySelector('.extra-hours-frame');
      if (frame) {
        const url = new URL(frame.src);
        url.searchParams.set('theme', lab.dark ? 'dark' : 'light');
        frame.classList.remove('is-ready');
        frame.style.colorScheme = lab.dark ? 'dark' : 'light';
        frame.src = url;
      }
    });
    return;
  }
  switch(name){
    case 'replay-tumbleweed': {
      replayInboxArt(el.closest('.student-inbox')?.querySelector('.student-tumbleweed-scene'));
      break;
    }
    case 'ring-student-bell':
      replayInboxArt(el);
      void chimeAtStrike();
      break;
    case 'toggle-filters':{
      const panel=document.querySelector('#filter-panel');if(!panel)break;
      panel.hidden=!panel.hidden;el.setAttribute('aria-expanded',String(!panel.hidden));
      if(!panel.hidden)panel.querySelector('select')?.focus();
      break;}
    case 'clear-filters':
      document.querySelectorAll('[data-filter]').forEach(select=>{select.value='';});filterRows();break;
    case 'remove-filter':{
      const select=document.querySelectorAll('[data-filter]')[Number(el.dataset.filterIndex)];
      if(select){select.value='';filterRows();}
      break;}
    case 'preview-sign-in':
      void choosePreviewRole(el);
      break;
    case 'sign-out':
      document.querySelector('portal-action-feedback').clear();
      {
        const token = localStorage.getItem(workspaceSessionKey);
        localStorage.removeItem(workspaceSessionKey);
        if (token) {
          void fetch('../api/identity/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      }
      localStorage.removeItem(previewSessionKey);
      returnAfterSignIn = 'overview';
      navigate('login');
      break;
    case 'pick-review':selectedStudent=Number(el.dataset.student);render();document.querySelector('.dispatch-person[aria-pressed=true]')?.focus();break;
    case 'quick-find':modal('Find a page',fields('<label>Search pages<input id="page-finder" type="search" placeholder="Schedule, students, courses…" autofocus></label>')+`<nav class="page-results">${groups().flatMap(([,ids])=>ids).map(id=>navigationLink(id,navigationLabel(id),'navlink')).join('')}</nav>`,'Close','close');break;
    case 'mobile-menu':modal('Navigation',`<nav aria-label="Mobile navigation">${groups().map(([name,items])=>`<div class="navgroup"><p class="navlabel">${name}</p>${items.map(id=>navigationLink(id,navigationLabel(id),`navlink ${id===page?'active':''}`)).join('')}</div>`).join('')}${link('profile','My profile','navlink')}</nav>`,'Close','close');break;
    case 'test-notification':testCount++;render();toast('Test notification created in this preview.');break;
    case 'refresh':toast('Preview refreshed.', 'info');break;
    case 'read-all':notificationEntries().forEach(([id]) => readNotifications.add(notificationKey(id)));render();document.querySelector('[aria-selected=true]')?.focus();toast('All notifications marked as read.');break;
    case 'read-one':readNotifications.add(notificationKey(el.dataset.notification));render();document.querySelector('[aria-selected=true]')?.focus();toast('Notification marked as read.');break;
    case 'close-dialog':closeDialog();break;
    case 'save-draft':toast('Draft saved in this preview.');break;
    case 'save-preferences': {
      const index = student() ? 0 : selectedStudent;
      const current = readPreferenceForm();
      if (el.getAttribute('aria-pressed') === 'true') {
        const previous = preferenceUndo.get(index);
        if (previous) studentPreferences.set(index, previous);
        else studentPreferences.delete(index);
        preferenceUndo.delete(index);
        savedPreferenceSignatures.delete(index);
        preferenceDrafts.set(index, current);
        syncPreferenceSaveButton(true);
        toast('Preference save undone in this preview. Your selections are kept for editing.', 'info');
      } else if (current.days.length > 2) {
        toast('Choose up to two preferred days.', 'warning');
      } else {
        preferenceUndo.set(index, studentPreferences.has(index) ? structuredClone(studentPreferences.get(index)) : undefined);
        studentPreferences.set(index, structuredClone(current));
        savedPreferenceSignatures.set(index, JSON.stringify(current));
        syncPreferenceSaveButton(true);
        toast('Preferences saved in this preview. Press Saved again to undo this save.');
      }
      break;
    }
    case 'toggle-calendar':connected=!connected;render();toast(connected?'Sample calendar connected.':'Sample calendar disconnected.');break;
    case 'sync-now':toast(connected?'Sample schedule synced.':'Connect your calendar first.', connected ? 'success' : 'warning');break;
    case 'export-csv':download('sample-financial-records.csv','Transaction,Student,Type,Amount,Status\n'+names.slice(0,6).map((name,i)=>`TXN-${1042+i},${name},${i===4?'Refund':'Payment'},${i===4?2500:7500},${[1,5].includes(i)?'Pending':'Completed'}`).join('\n'),'text/csv');break;
    case 'export-calendar':download('sample-schedule.ics','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Portal//Design Preview//EN\r\nBEGIN:VEVENT\r\nUID:sample-csen701@bobos\r\nDTSTAMP:20261114T080000Z\r\nDTSTART:20261115T063000Z\r\nDTEND:20261115T080000Z\r\nSUMMARY:CSEN 701 - Embedded Systems (sample)\r\nLOCATION:C2.301\r\nEND:VEVENT\r\nEND:VCALENDAR','text/calendar');break;
    case 'transcript':download('sample-transcript.txt','DESIGN PREVIEW - SAMPLE TRANSCRIPT\nOmar Hassan, 70-71577\nCumulative GPA: 1.70\nCompleted credits: 116\nNot an official academic record.');break;
    case 'assign-advisor': {
      const index=Number(el.dataset.studentIndex || 0);
      const options=names.map((name,i)=>`<option ${i===index?'selected':''}>${name} · 70-${71577+i}</option>`).join('');
      modal('Assign an advisor',fields(`<label>Student<select>${options}</select></label><label>Advisor<select><option>Dr. Salma Adel</option><option>Dr. Hany Youssef</option></select></label>`),'Assign advisor');
      break;
    }
    case 'assign-group':modal('Assign schedule group',fields('<label>Student<input value="'+names[Number(el.dataset.studentIndex||0)]+' · 70-'+(71577+Number(el.dataset.studentIndex||0))+'" readonly></label><label>Published group<select><option>Group 4 · Computer Engineering</option><option>Group 1 · Computer Engineering</option><option>Unassigned</option></select></label>'),'Save assignment');break;
    case 'add-course':case 'edit-course':{
      const editing=name==='edit-course';
      const [code,title,department,credits]=editing?selectedCourse:['','','Computer Engineering','5'];
      const departments=[...new Set(courseData.map(course=>course[2]))];
      modal(editing?'Edit course':'Add course',fields(`<div class="formgrid"><label>Course code<input required value="${code}" placeholder="CSEN 701"></label><label>Credit hours<input type="number" min="1" max="12" required value="${credits}"></label></div><label>Course name<input required value="${escapeHtml(title)}"></label><label>Department<select>${departments.map(d=>`<option ${d===department?'selected':''}>${d}</option>`).join('')}</select></label>`));
      break;
    }
    case 'import-csv':modal('Import courses',fields('<label>Course CSV<input type="file" accept=".csv" required></label><p>Columns: code, name, department, credits, season.</p>'),'Preview import');break;
    case 'create-term':case 'manage-term': {
      const term=academicTerms.find(t=>t.name===el.dataset.term) || academicTerms[0];
      if(name==='manage-term' && term.status==='Archived'){
        modal(term.name,`<p>Archived · ${term.year}</p><dl class="details">${termMilestones.map(([key,label])=>`<div><dt>${label}</dt><dd>${formatCalendarDay(term[key],{day:'numeric',month:'long',year:'numeric'})}</dd></div>`).join('')}</dl>`,'Close','close');
      } else {
        modal(name==='create-term'?'Create academic term':'Manage '+term.name,fields(`<label>Term name<input required value="${term.name}"></label><div class="formgrid">${termMilestones.map(([key,label])=>`<label>${label}<input type="date" value="${term[key]}" required></label>`).join('')}<label>Status<select>${['Active','Upcoming','Archived'].map(status=>`<option ${status===term.status?'selected':''}>${status}</option>`).join('')}</select></label></div>`));
      }
      break;
    }
    case 'add-offering':modal('Add course offering',fields('<label>Course<select><option>CSEN 701 · Embedded Systems</option><option>CSEN 703 · Algorithms</option></select></label><div class="formgrid"><label>Term<select><option>Winter 2026</option></select></label><label>Number of groups<input type="number" min="1" value="4" required></label></div>'),'Add offering');break;
    case 'manage-sections':modal('CSEN 701 sections',table(['Section','Time','Room'],[['Lecture 1','Sun 08:30','C2.301'],['Tutorial 4','Tue 10:00','C2.204'],['Lab 4','Wed 12:00','C7.102']],false),'Save sections');break;
    case 'copy-confirm':{const count=document.querySelectorAll('table input:checked').length;if(!count){toast('Select at least one offering.', 'warning');break;}modal('Copy selected offerings?',`<p>${count} offerings will be copied from Winter 2025 to Winter 2026 in this preview. Existing offerings will be kept.</p>`,'Copy offerings');break;}
    case 'publish':modal('Publish this template?',`<p>${templateGroup()} will become available for student assignments in this preview.</p>`,'Publish template');break;
    case 'process':modal(`Process ${names[selectedStudent].split(' ')[0]}’s schedule?`,'<p>The draft has 19 credit hours and no time conflicts. Processing sends it to the student for review.</p>','Process schedule');break;
    case 'reopen':modal('Reopen this schedule?',fields('<label>Reason<textarea required rows="3" placeholder="Explain why the schedule needs another review."></textarea></label>'),'Reopen schedule');break;
    case 'financial-detail': {
      const i=Number(el.dataset.record||0);
      const isRefund=i===4;
      const pending=[1,5].includes(i);
      modal(`Transaction TXN-${1042+i}`,`<div class="transaction-detail">
        <svg class="transaction-edge" viewBox="0 0 360 230" preserveAspectRatio="none" aria-hidden="true">
          <path vector-effect="non-scaling-stroke" d="M12 3Q94 1 170 2.8T346 2.5Q356 2 357 13Q359 62 357.5 111T357 215Q356 227 345 227Q275 226 197 228T15 226.5Q3 227 3 215Q1 165 2.5 112T3 16Q3 5 12 3Z"/>
        </svg>
        <div class="transaction-total">
          <div><p>${isRefund?'Refund':'Course payment'}</p><strong>${isRefund?'2,500':'7,500'} <small>EGP</small></strong></div>
          <div class="transaction-state">
            ${badge(pending?'Pending':'Completed',pending?'payment-pending':'payment-complete')}
            <time datetime="2026-11-14">14 Nov 2026</time>
          </div>
        </div>
        <dl class="transaction-facts">
          <div><dt>Student</dt><dd>${avatar(names[i])}<span>${names[i]}<small>70-${71577+i}</small></span></dd></div>
        </dl>
        <div class="transaction-footer">
          ${!isRefund&&!pending?button('Refund transaction','refund','btn danger'):''}
          ${button('Close','close-dialog','btn primary','autofocus')}
        </div>
      </div>`,null);
      break;
    }
    case 'refund':{const opener=returnFocus;dialog.close();modal('Refund this transaction?',fields('<p>EGP 7,500 will be returned to the student’s wallet in this preview.</p><label>Refund reason<textarea required rows="3"></textarea></label>'),'Confirm refund');returnFocus=opener;break;}
    case 'removal-decision': {
      const i=Number(el.dataset.request || 0);
      modal(`${courseData[i][0]} removal request`,`<p>${names[i]} · 70-${71577+i}<br>Reason: ${removalReasons[i]}.${i===0?'<br>Removing this course reduces the semester load from 19 to 14 credits.':''}</p>`+fields('<label>Decision<select><option>Approve removal</option><option>Reject request</option></select></label><label>Decision note<textarea required rows="3" placeholder="Explain the decision to the student."></textarea></label>'),'Submit decision');break;
    }
    case 'request-removal':modal('Request course removal',fields('<label>Course<select><option>CSEN 701 · Embedded Systems</option><option>CSEN 703 · Algorithms</option></select></label><label>Reason<textarea required rows="3" placeholder="Why do you need to remove this course?"></textarea></label>'),'Submit request');break;
    case 'group-schedule':modal('Group 1 schedule',weekly(),'Close','close');break;
    case 'request-swap':modal('Request a schedule swap?','<p>Your request will be visible to students in the selected group with the same registered courses.</p>','Submit swap request');break;
    case 'exchange':modal('Exchange full schedules?','<p>Your Group 4 schedule will be exchanged with Group 1. Meeting times for all registered courses will change.</p>','Confirm exchange');break;
    case 'withdraw':modal('Withdraw swap request?','<p>This request will no longer be available to other students.</p>','Withdraw request');break;
    default:toast('Updated in this preview.');
  }
}
let activeDeadline=null, noteTimer;
function closeDeadline(){
  clearTimeout(noteTimer);
  if(!activeDeadline)return;
  activeDeadline.closest('.folio-stack')?.querySelector('.deadline-shadow')?.remove();
  activeDeadline.querySelector('.deadline-note')?.hidePopover();
  activeDeadline.setAttribute('aria-pressed','false');
  activeDeadline=null;
}
function placeDeadline(){
  if(!activeDeadline)return;
  if(!activeDeadline.isConnected){closeDeadline();return;}
  const anchor=activeDeadline.getBoundingClientRect();
  const note=activeDeadline.querySelector('.deadline-note');
  const {width,height}=note.getBoundingClientRect();
  // The fixed popover rotates around its center. Position its projected bounds.
  const dx=(note.offsetWidth-width)/2,dy=(note.offsetHeight-height)/2;
  const stack=activeDeadline.closest('.folio-stack');
  const page=stack.getBoundingClientRect();
  const left=24,right=Math.min(innerWidth-16,page.right-5);
  const top=Math.max(21,page.top+8),bottom=Math.min(innerHeight-12,page.bottom-5);
  const x=Math.max(left,Math.min(right-width,anchor.left+(anchor.width-width)/2));
  const y=Math.max(top,Math.min(bottom-height,anchor.top+(anchor.height-height)/2));
  note.style.left=(x-dx)+'px';
  note.style.top=(y-dy)+'px';
  // Map the note's resting center onto the printed page before casting the shadow.
  const m=new DOMMatrix(getComputedStyle(note).transform==='none'?undefined:getComputedStyle(note).transform);
  const screenToPaper=new DOMMatrix([m.a,m.b,m.c,m.d,0,0]).inverse();
  const local=screenToPaper.transformPoint({x:x+width/2-page.left-page.width/2,y:y+height/2-page.top-page.height/2});
  const shadow=stack.querySelector('.deadline-shadow');
  shadow.style.setProperty('--shadow-x',stack.clientWidth/2+local.x+'px');
  shadow.style.setProperty('--shadow-y',stack.clientHeight/2+local.y+'px');
  shadow.style.setProperty('--shadow-width',note.offsetWidth+'px');
  shadow.style.setProperty('--shadow-height',note.offsetHeight+'px');
}
function openDeadline(mark){
  clearTimeout(noteTimer);
  if(mark===activeDeadline)return;
  closeDeadline();
  activeDeadline=mark;
  const shadow=document.createElement('span');
  shadow.className='deadline-shadow';
  shadow.setAttribute('aria-hidden','true');
  mark.closest('.folio-stack').append(shadow);
  mark.querySelector('.deadline-note').showPopover();
  placeDeadline();
}
window.addEventListener('scroll',placeDeadline,{capture:true,passive:true});
window.addEventListener('resize',placeDeadline);
function dismissDeadline(){
  if(activeDeadline)activeDeadline.dataset.dismissed='';
  closeDeadline();
}
document.addEventListener('keydown',event=>{if(event.key==='Escape')dismissDeadline();});
for(const type of ['pointerover','focusin']){
  document.addEventListener(type,event=>{
    const mark=event.target.closest('[data-deadline]');
    if(type==='focusin' && mark)delete mark.dataset.dismissed;
    if(mark && !mark.hasAttribute('data-dismissed') && event.pointerType!=='touch' && !mark.closest('[inert]'))openDeadline(mark);
  });
}
for(const type of ['pointerout','focusout']){
  document.addEventListener(type,event=>{
    const mark=event.target.closest('[data-deadline]');
    if(mark && !mark.contains(event.relatedTarget))delete mark.dataset.dismissed;
    if(!activeDeadline?.contains(event.target)||activeDeadline.contains(event.relatedTarget))return;
    if(activeDeadline.getAttribute('aria-pressed')==='true'&&type==='pointerout')return;
    if(type==='pointerout'&&activeDeadline.matches(':focus-visible'))return;
    clearTimeout(noteTimer);
    noteTimer=setTimeout(closeDeadline,160);
  });
}
document.addEventListener('click',event=>{
  const mark=event.target.closest('[data-deadline]');
  if(mark){
    if(mark===activeDeadline && mark.getAttribute('aria-pressed')==='true'){dismissDeadline();return;}
    openDeadline(mark);
    mark.setAttribute('aria-pressed','true');
    return;
  }
  closeDeadline();
  const control = event.target.closest('[data-calendar-nav]');
  if (!control) return;
  const previous = calendarMonth;
  calendarMonth = control.dataset.calendarNav==='today' ? 0 : previous+Number(control.dataset.calendarNav);
  if(previous===calendarMonth) return;
  const calendar = control.closest('.desk-calendar');
  pendingExposure?.finish();
  clearFlipExposure(calendar);
  const paper = calendar.querySelector('.folio-paper:not(.binder-waiting-sheet)');
  const stack = paper.parentElement;
  const feature=calendar.querySelector('.calendar-feature');
  const scene=binderMotion.scene(stack);
  if(scene){
    // Keep the outgoing drawing mounted so its ink animation retains its clock.
    const next=paper.cloneNode(false);
    paper.before(next);
    tintCalendar(calendar,calendarDates().month.getMonth());
    next.innerHTML=calendarPage(true);
    calendar.querySelector('.folio-agenda').innerHTML=calendarAgenda();
    scene.turn(next,previous,calendarMonth,productionPreview||flipRate===1?null:showFlipExposure,()=>clearFlipExposure(calendar));
    return;
  }
  stack.querySelectorAll('.calendar-animation,.turn-cels,.binder-waiting-sheet').forEach(layer=>layer.remove());
  const oldPage = paper.innerHTML;
  const previousColors=['--sheet','--verso'].map(key=>getComputedStyle(stack).getPropertyValue(key).trim());
  tintCalendar(calendar,calendarDates().month.getMonth());
  paper.innerHTML = calendarPage(calendar.classList.contains('teaching-pad') && calendarStyle!=='clean');
  if(feature && !isConcertina(calendarStyle)) feature.innerHTML=calendarFeature();
  calendar.querySelector('.folio-agenda').innerHTML = calendarAgenda();
  if (motionPreference.matches) return;
  if (calendar.classList.contains('teaching-pad')) {
    if(Object.hasOwn(sketchEditions,calendarStyle)) turnSketchPage(stack,oldPage,calendarMonth>previous,previousColors);
    else flipAcademicSheet(stack,oldPage,calendarMonth>previous,calendarStyle,previousColors);
    return;
  }
  const forward = calendarMonth>previous;
  const overlay = document.createElement('div');
  overlay.className = 'calendar-animation';
  overlay.inert = true;
  overlay.setAttribute('aria-hidden','true');
  overlay.innerHTML = `${forward?'':`<div class="folio-old-sheet">${oldPage}</div>`}
    <div class="folio-printed-leaf">${forward?oldPage:paper.innerHTML}</div>
    <svg viewBox="0 0 300 200" preserveAspectRatio="none" fill="none" stroke-linejoin="round" stroke-linecap="round">
      <defs><clipPath id="folio-fold" clipPathUnits="objectBoundingBox"><path transform="scale(.0033333333 .005)"/></clipPath></defs>
      <path class="folio-front-line" stroke="#635b47" stroke-width="1.2"/>
      <path class="folio-underside" fill="#e9dfc8" stroke="#635b47" stroke-width="1.5"/>
      <path class="folio-crease" stroke="#a0957d" stroke-width="1.25"/>
      <path class="folio-verso-ink" stroke="#ab9d7b" stroke-width=".85"/>
    </svg>`;
  stack.append(overlay);
  const paths = overlay.querySelector(':scope > svg').querySelectorAll('path');
  const leaf = overlay.querySelector('.folio-printed-leaf');
  const frames = forward ? calendarCels : [...calendarCels].reverse();
  function expose(index) {
    if (!overlay.isConnected) return;
    if (index===frames.length || motionPreference.matches) {overlay.remove();return;}
    const [hold,face,back,crease] = frames[index];
    leaf.hidden = !face;
    [face,face,back,crease].forEach((drawing,i)=>paths[i].setAttribute('d',drawing));
    const inkFrame = forward ? index : frames.length-1-index;
    paths[4].setAttribute('d',calendarVerso[inkFrame]);
    if (calendarInkHolds[inkFrame]) setTimeout(()=>{
      paths[2].setAttribute('d',calendarInkHolds[inkFrame]);
    },Math.round(hold*.52));
    setTimeout(()=>expose(index+1),hold);
  }
  expose(0);
});
function selectView(id) {
  if (tab === id) return;
  tab = id;
  render();
  const selected = document.querySelector(`[role="tab"][data-tab="${tab}"]`);
  selected?.focus({preventScroll:true});
  if (page === 'notifications') selected?.classList.add('draw-selection');
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-page],[data-action],[data-tab]');if(!target)return;
  if(target.dataset.page){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(target.dataset.student !== undefined)selectedStudent=Number(target.dataset.student);if(target.dataset.courseCode)selectedCourse=resolveCourse(target.dataset.courseCode);event.preventDefault();
    navigate(target.dataset.page,target.getAttribute('href'));}
  else if(target.dataset.tab)selectView(target.dataset.tab);
  else action(target.dataset.action,target);
});
function chooseCalendarStyle(value){
  calendarStyle=value;
  localStorage.setItem(styleKey,value);
  const pad=document.querySelector('.teaching-pad');
  clearFlipExposure(pad);
  pad.querySelectorAll('.turn-cels,.binder-waiting-sheet').forEach(layer=>layer.remove());
  binderMotion.scene(pad.querySelector('.folio-stack'))?.dispose();
  pad.dataset.calendarStyle=value;
  pad.dataset.concertina=String(isConcertina(value));
  pad.querySelector('.calendar-feature').style.removeProperty('background-color');
  pad.dataset.sketch=String(Object.hasOwn(sketchEditions,value));
  tintCalendar(pad,calendarDates().month.getMonth());
  pad.querySelector('.calendar-feature').innerHTML=calendarFeature();
  pad.querySelector('.folio-paper').innerHTML=calendarPage(value!=='clean');
  binderMotion.mount(pad.querySelector('.folio-stack'));
  document.querySelectorAll('[data-calendar-picker]').forEach(picker=>{picker.value=value;});
  const url=new URL(location.href);
  url.searchParams.set('calendar',value);
  history.replaceState(history.state,'',url);
}
function setFlipRate(value){
  flipRate=value;
  localStorage.setItem(flipRateKey,String(value));
  pendingExposure?.schedule();
  const url=new URL(location.href);
  url.searchParams.set('flipSpeed',String(value));
  history.replaceState(history.state,'',url);
}
function inspectFlipFrame(input,index){
  if(!pendingExposure) return;
  if(flipRate!==0){
    input.closest('.flip-playback').querySelector('[data-flip-speed]').value='0';
    setFlipRate(0);
  }
  pendingExposure.seek(index);
}
document.addEventListener('input',event=>{
  if(event.target.matches('[data-flip-scrub]')) inspectFlipFrame(event.target,event.target.valueAsNumber-1);
});
document.addEventListener('click',event=>{
  const step=event.target.closest('[data-flip-step]');
  if(step && pendingExposure) inspectFlipFrame(step,pendingExposure.frame+Number(step.dataset.flipStep));
});
document.addEventListener('change',event=>{
  if(event.target.matches('[data-flip-speed]')){
    setFlipRate(Number(event.target.value));
  } else if(event.target.matches('[data-calendar-picker]')){
    chooseCalendarStyle(event.target.value);
  } else if(event.target.matches('[data-dashboard-view]')){
    dashboardView=event.target.value;
    localStorage.setItem(dashboardViewKey,dashboardView);
    const url=new URL(location.href);
    url.searchParams.set('view',dashboardView);
    history.replaceState(history.state,'',url);
    render();
    document.querySelector('[data-dashboard-view]').focus({preventScroll:true});
  } else if(event.target.id==='role-select'){role=event.target.value;navigate('overview');}
  else if(event.target.id==='page-select')navigate(event.target.value);
  else if(event.target.matches('[data-filter]'))filterRows();
  else if(event.target.matches('.dayoff')) {
    const count = document.querySelectorAll('.dayoff:checked').length;
    if (count > 2) {
      event.target.checked = false;
      toast('Choose up to two preferred days.', 'warning');
    } else {
      document.querySelector('#preferred-day-count').textContent = `${count} of 2 selected`;
    }
  }
});
document.addEventListener('input',event=>{if(event.target.id==='search')filterRows();if(event.target.id==='page-finder')document.querySelectorAll('.page-results a').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(event.target.value.toLowerCase()));});
document.addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.target.id==='auth-form'){
    if(page==='login'){
      const {email,password} = Object.fromEntries(new FormData(event.target));
      const submit = event.submitter;
      if (submit) submit.disabled = true;
      try {
        if (email === previewEmail && password === 'portal-demo') await signInDemoWorkspace(role);
        else role = await signInWorkspace({email,password});
        startPreview(returnAfterSignIn);
      } catch (error) {
        toast(error.message);
      } finally {
        if (submit) submit.disabled = false;
      }
    }
    else if(page==='forgot'){navigate('reset');toast('Sample reset code: 123456.', 'info');}
    else{navigate('login');toast('Reset preview complete.');}
  }else if(event.target.id==='modal-form'){
    const label=event.submitter?.textContent||'Saved';const close=event.target.dataset.submitAction==='close';closeDialog();if(!close)toast(label === 'Submit decision' ? 'Decision saved in this preview.' : `${label} — completed in this preview.`);
  }
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDialog();}});
dialog.addEventListener('cancel',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
document.addEventListener('keydown',event=>{
  if (authPages.has(page)) return;
  if(event.key==='/'&&!event.target.closest('input,textarea,select')&&!dialog.open){event.preventDefault();action('quick-find');return;}
  if(event.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const buttons=Array.from(document.querySelectorAll('[role=tab]'));let i=buttons.indexOf(event.target);
  i=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  event.preventDefault();selectView(buttons[i].dataset.tab);
});
window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);page=pageKey(p.get('page'));returnAfterSignIn=returnPage(p.get('next'));role=Object.hasOwn(roleNames,p.get('role'))?p.get('role'):'coordinator';tab='';selectedStudent=studentIndex(p);selectedCourse=resolveCourse(p.get('course'));restoreLook(p);render(true);});
window.addEventListener('storage',event=>{
  if (event.key===previewSessionKey && !signedIn() && !authPages.has(page)) {
    returnAfterSignIn = 'overview';
    navigate('login');
  }
});
mountControls(roleNames, pages, () => {
  if (authPages.has(page)) {
    syncControls(role,page);
    const mark = document.querySelector('.signin-copy .wordmark');
    if (mark) mark.innerHTML=portalWordmark();
  }
  else render();
});
render();
if (page === 'calendar-sync' && ['connected', 'error'].includes(params.get('calendar'))) {
  const success = params.get('calendar') === 'connected';
  toast(success ? 'Google Calendar connected.' : 'Google Calendar connection could not be completed.', success ? 'success' : 'error');
  const cleanUrl = new URL(location.href);
  cleanUrl.searchParams.delete('calendar');
  history.replaceState(history.state, '', cleanUrl);
}
document.addEventListener('input', event => {
  if (page === 'preferences' && event.target.matches('#preference-notes,.dayoff,[data-course-group]')) syncPreferenceSaveButton();
});
document.addEventListener('change', event => {
  if (page === 'preferences' && event.target.matches('.dayoff,[data-course-group]')) syncPreferenceSaveButton();
});
