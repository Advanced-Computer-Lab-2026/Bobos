'use strict';
// Review-only prototypes. All records and state stay in this page; no API calls.
const params = new URLSearchParams(location.search);
const pages = {
  overview:'Overview', notifications:'Notifications', profile:'My profile',
  directory:'Student directory', 'student-detail':'Student details', advising:'Advising students',
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
let connected = true;
let toastTimer;
let returnFocus;
let preferencesState = {days: ['Thursday'], groups: Array(4).fill('Group 4'), notes: 'I would prefer to keep Thursday free.'};
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const student = () => ['normalStudent','advisingStudent'].includes(role);
const person = () => student() ? 'Omar Hassan' : role === 'advisor' ? 'Dr. Salma Adel' : role === 'administrator' ? 'Youssef Ali' : 'Nadia Ahmed';
const href = (target,index=selectedStudent,course=selectedCourse) => {
  const destination = authPages.has(target) ? returnAfterSignIn : target;
  const preserveStudent = ['draft-schedule','student-detail'].includes(destination);
  return `?page=${target}&role=${role}&layout=${lab.layout+1}&palette=${lab.palette+1}&mode=${lab.dark?'dark':'light'}${target==='login'?`&image=${signinImage.id}`:''}${authPages.has(target)&&destination!=='overview'?`&next=${destination}`:''}${preserveStudent?`&student=${index}`:''}${destination==='course-detail'?`&course=${encodeURIComponent(course[0])}`:''}`;
};

const link = (target, text, cls='', index) => `<a class="${cls}" href="${href(target,index)}" data-page="${target}"${index===undefined?'':` data-student="${index}"`}>${text}</a>`;
const button = (text, action, cls='btn', extra='') => `<button class="${cls}" type="button" data-action="${action}" ${extra}>${text}</button>`;
const badge = (text, tone='') => `<span class="badge ${tone}">${icon(tone==='draft'?'edit':tone==='neutral'?'circle':tone==='pending'||tone==='payment-pending'?'clock':tone==='ready'||tone==='review'?'inbox':'check')}${text}</span>`;
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
  if (workspaces[lab.layout].name!=='Claude Study') return 'Portal';
  // Both hinge points stay fixed. The lower outside corner follows the top
  // corner a few poses later so the leaf bends as it crosses the binding.
  const poses = [
    [7,8,9,31], [8,7,9,31], [11,5,10,30], [15,4,12,29],
    [20,3,16,28], [25,3,21,27], [30,3,27,27], [34,4,32,28],
    [37,5,36,29], [39,5,39,30], [40,5,41,31], [40,5,42,31]
  ];
  const frames = Array.from({length:20},(_,frame)=>{
    const sheets = [0,3,6].map((lag,index)=>{
      const pose = frame-lag;
      if (pose<=0 || pose>=poses.length) return '';
      const [x,y,bottomX,bottomY] = poses[pose];
      const curl = Math.sin(Math.PI*pose/(poses.length-1));
      return `<path fill="${['#e6e5d8','#dce3dd','#edf0e6'][index]}" d="M23 14 Q${(23+x)/2} ${(14+y)/2-2*curl} ${x} ${y} Q${(x+bottomX)/2-2*curl} ${(y+bottomY)/2} ${bottomX} ${bottomY} Q${(26+bottomX)/2} ${(38+bottomY)/2-2*curl} 26 38Z"/>`;
    }).join('');
    return sheets ? `<g transform="translate(${frame*48} 0)">${sheets}</g>` : '';
  }).join('');
  return `<svg class="study-book" viewBox="0 0 48 48" aria-hidden="true"><use href="study-mark.svg#binding"/><use href="study-mark.svg#leaf"/>
    <g class="book-riffle">${frames}</g></svg>Portal`;

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
const queueDirections = {
  illustrated:'Illustrated',
  rail:'Rail',
  'wide-rail':'Wide Rail',
  spotlight:'Spotlight',
  signal:'Signal',
  board:'Board'
};
const queueDirectionKey = 'portal-studio-queue-direction';
let queueDirection = localStorage.getItem(queueDirectionKey);
const previewDirection = params.get('queue');
if (Object.hasOwn(queueDirections,previewDirection)) queueDirection = previewDirection;
if (!Object.hasOwn(queueDirections,queueDirection)) queueDirection = 'illustrated';

function workQueue(tasks) {
  const directions = Object.entries(queueDirections).map(([id,label])=>
    `<option value="${id}" ${id===queueDirection ? 'selected' : ''}>${label}</option>`
  ).join('');
  const maxCount = Math.max(...tasks.map(([, ,count])=>count));
  const taskOptions = tasks.map(([symbol,tone,count,subject],index)=>
    `<button type="button" data-queue-focus="${symbol}" data-tone="${tone}" aria-pressed="${index===0}"><span>${subject}</span><strong>${count}</strong></button>`
  ).join('');
  const entries = tasks.map(([symbol,tone,count,subject,phrase,desc,target,cta],index)=>`
    <li class="queue-entry" data-tone="${tone}" data-icon="${symbol}" data-current="${index===0}">
      <span class="queue-icon">${queueIcon(symbol)}${queueSketch(symbol)}</span>
      <span class="queue-count">${count}</span>
      <div class="queue-copy"><strong><span class="queue-phrase">${count} ${phrase}</span><span class="queue-subject">${subject}</span></strong><p>${desc}</p><span class="queue-signal" aria-hidden="true"><i style="--queue-share:${100*count/maxCount}%"></i></span></div>
      ${link(target,cta+icon('chevron'),'queue-link')}
    </li>`).join('');
  return `<div class="queue-designer" data-direction="${queueDirection}">
    <div class="queue-stage">
      <div class="queue-focus-controls" role="group" aria-label="Spotlight task">${taskOptions}</div>
      <ul class="queue-entries" role="list">${entries}</ul>
    </div>
    <label class="queue-picker">Queue style <select data-queue-style>${directions}</select></label>
  </div>`;
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
    ['Home', ['overview']],
    ['Classes', ['my-schedule','my-courses', ...(role === 'normalStudent' ? ['schedule-swap'] : ['preferences'])]],
    ['Support', ['my-advisor','calendar-sync', ...(role === 'advisingStudent' ? ['records'] : [])]]
  ];
  return [
    ['Home', ['overview', ...(role === 'coordinator' ? ['pending-work'] : [])]],
    ['Student services', [
      ...(managesAcademics ? ['directory','financial-records'] : []),
      ...(advises ? ['advising'] : [])
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
  return `<div class="toolbar"><div class="filters"><input aria-label="${placeholder}" placeholder="${placeholder}" id="search" type="search">${options.map(([label,values])=>`<select aria-label="${label}" data-filter><option value="">${label}</option>${values.map(value=>`<option>${value}</option>`).join('')}</select>`).join('')}</div>${action?`<div class="actions">${action}</div>`:''}</div>`;
}
function tabs(items,defaultTab){
  if(!items.some(([id])=>id===tab)) tab=defaultTab||items[0][0];
  return `<div class="tabs" role="tablist">${items.map(([id,title])=>`<button type="button" role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-tab="${id}">${title}</button>`).join('')}</div>`;
}
const activeTerm = 'Winter 2026/2027';
function termContext(context) {
  return `<span class="workspace-term">${icon('calendar')}<strong>${activeTerm}</strong></span><span class="workspace-term-context">${context}</span>`;
}

function workspaceGrid(view, modules) {
  const section = key => `<section class="work-module module-${key}" style="--area:${key}">${modules[key]}</section>`;
  const layout = key => view.lanes?.[key]
    ? `<div class="work-lane work-lane-${key}" style="--area:${key}">${view.lanes[key].map(section).join('')}</div>`
    : section(key);
  const order = [...new Set(view.rows.flatMap(row=>row.split(' ')))];
  const columns = view.columns.split(' ').map(size=>`minmax(0,${size})`).join(' ');
  const areas = view.rows.map(row=>`'${row}'`).join(' ');
  return `<div class="work-grid" style="--columns:${columns};--areas:${areas}">
    ${order.map(layout).join('')}
  </div>`;
}
function studyGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${greeting}, ${person().replace(/^Dr\. /,'').split(' ')[0]}`;
}
function workspaceSection(title, target, label, content, actionStyle='quiet-link') {
  return `<div class="section-head"><h2>${title}</h2>${link(target,label,actionStyle)}</div>${content}`;
}

const registrationDates = [
  ['22','Nov','Registration opens','sky','Opens'],
  ['06','Dec','Registration closes','gold','Closes'],
  ['13','Dec','Schedule swaps close','iris','Swaps close']
];
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

function overview(){
  if(student()) return studentOverview();
  const view = workspaces[lab.layout];
  const canManage = ['administrator','coordinator'].includes(role);
  const canAdvise = ['advisor','coordinator'].includes(role);
  const formatDate = (day,month,label,tone) => `<li data-tone="${tone}"><time><strong>${day}</strong><span>${month}</span></time><span>${label}</span></li>`;
  const reviewCircle = '<svg class="review-circle" aria-hidden="true" viewBox="0 0 68 30" preserveAspectRatio="none"><path pathLength="1" d="M50 5C36 1 10 3 5 12S12 26 32 26C51 27 66 22 64 14S54 4 40 4"/></svg>';
  const reviewRows = readyStudents.slice(0,4).map(({name,index})=>`<div class="review-person">${avatar(name)}<div><strong>${name}</strong><span>${index === 0 ? '19 credits · Thursday off' : 'Semester 7 · Group 4'}</span></div>${link('draft-schedule','Review'+reviewCircle,'btn row-control',index)}</div>`).join('');
  const tasks = [
    ['course-removal','rose',3,'Course removals','course removal requests','Credit load and scheduling decisions','mandatory-removals','Review'],
    ...(canAdvise ? [['advisor-assignment','mint',2,'Advisors','students need an advisor','Advising assignments','advising','Assign']] : []),
    ...(canManage ? [['group-assignment','iris',6,'Group assignment','students need a group','Computer Engineering · Semester 7','group-assignments','Assign']] : [])
  ];
  const actions = [
    ['calendar','student-schedules','Review schedules'],
    ['people', canManage ? 'directory' : 'advising','Find a student'],
    ['clock','pending-work','Open work queue']
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
    review:workspaceSection('Schedule review','student-schedules','All schedules',reviewRows),
    queue:workspaceSection('Work queue','pending-work','All work',workQueue(tasks)),
    dates:workspaceSection('Registration dates',canManage?'terms':'student-schedules',icon('calendar')+(canManage?'Term settings':'Schedules'),`<ol class="milestones">${registrationDates.map(date=>formatDate(...date)).join('')}</ol>`,'btn date-action'),
    activity:workspaceSection('Recent activity',canManage?'schedule-activity':'notifications',canManage?'View log':'Notifications',[
      ['Mariam Mostafa','submitted her preferences','Today · 10:42'],
      ['Dr. Salma Adel','saved Omar’s advising draft','Today · 09:15'],
      ['Nadia Ahmed','published the Group 4 template','Yesterday · 16:20']
    ].map(([name,event,time])=>`<div class="event">${avatar(name)}<div><p><strong>${name}</strong> ${event}</p><time>${time}</time></div></div>`).join('')),
    dispatch,
    register:workspaceSection('Student drafts','student-schedules','All schedules',table(['Student','Schedule',''],names.slice(0,8).map((name,index)=>[`<strong>${name}</strong><small>70-${71577+index}</small>`,badge(scheduleStates[index],statusTone(scheduleStates[index])),link('draft-schedule','Open','quiet-link',index)]),false)),
    week:workspaceTimetable(view,'Group 4 timetable','student-schedules','Open schedules'),
    people:workspaceSection('Student directory',canManage?'directory':'advising','All students',names.slice(0,6).map((name,index)=>`<div class="review-person">${avatar(name)}<div><strong>${name}</strong><span>70-${71577+index} · Semester 7</span></div>${link('student-detail','Open','btn row-control',index)}</div>`).join('')),
    courses:workspaceSection('Winter courses',canManage?'courses':'student-schedules',canManage?'View catalogue':'View schedules',`<div class="course-map">${courseData.map(([code,title,department,credits])=>`<article><span>${code}</span><h3>${title}</h3><p>${department} · ${credits} credits</p></article>`).join('')}</div>`),
  };
  const term = termContext(`${roleNames[role]} workspace`);
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
    review:workspaceSection('Coming up','my-schedule','Full timetable',`<div class="review-person"><div><strong>Embedded Systems</strong><span>Sunday · 08:30 · Lecture · C2.301</span></div></div><div class="review-person"><div><strong>Analysis & Design of Algorithms</strong><span>Sunday · 12:00 · Tutorial · C3.104</span></div></div>`),
    queue:workspaceSection('Schedule changes',nextAction,nextLabel,`<p>${normal?'Review swap groups before schedule swaps close on 13 December.':'Review your preferred days and groups with your advisor.'}</p>`),
    dates:workspaceSection('Registration dates','my-schedule','My timetable',`<ol class="milestones"><li><time><strong>22</strong><span>Nov</span></time><span>Registration opens</span></li><li><time><strong>06</strong><span>Dec</span></time><span>Registration closes</span></li><li><time><strong>13</strong><span>Dec</span></time><span>Schedule swaps close</span></li></ol>`),
    activity:workspaceSection('Calendar','calendar-sync','Calendar sync','<p>Connect a calendar to see lectures, labs, and tutorials alongside your other events.</p>'),
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

function directory(advising=false){
  return head(advising?'Advising students':'Student directory',advising?'Review assignments, preferences, and schedules.':'Find a student and open their academic details.',advising?button('Assign advisor','assign-advisor','btn primary'):'')+
    filterbar('Search name or ID', [['All majors',['Computer Engineering','Digital Media Engineering']],['All statuses',['Ready for review','Draft','Not started']]])+
    table(['Student','Major','Semester',advising?'Advisor':'Type','Schedule',''],names.map((name,i)=>[
      staffIdentity(name,`70-${71577+i}`),i===3?'Digital Media Engineering':'Computer Engineering','7',advising?([2,8].includes(i)?'Unassigned':'Dr. Salma Adel'):(i%3?'Advising':'Normal'),badge(scheduleStates[i],statusTone(scheduleStates[i])),link('student-detail','View student','btn row-control',i)
    ]));
}
function profile(detail=false){
  const name=detail?names[selectedStudent]:person();
  const study = workspaces[lab.layout].name==='Claude Study';
  return head(detail?'Student details':'My profile', '',detail?link('directory','Back to directory','btn'):'',detail?`70-${71577+selectedStudent}`:'Account')+
    `<div class="person-title">${study ? avatar(name) : `<div class="monogram" aria-hidden="true">${name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>`}<div><h2>${name}</h2><p>${detail?'Advising student · Computer Engineering':roleNames[role]}</p></div></div>`+
    (detail?tabs([['details','Academic details'],['history','Advisor history'],['workflow','Schedule workflow']]):'')+
    (detail&&tab==='history'?table(['Advisor','Assigned','Status'],[['Dr. Salma Adel','5 October 2026',badge('Current')],['Dr. Hany Youssef','10 February 2026',badge('Ended','neutral')]]):detail&&tab==='workflow'?`<section class="panel"><h2>Schedule workflow</h2>${workflow()}${link('draft-schedule','Open advising draft','btn primary')}</section>`:
    `<section class="panel"><h2>${detail?'Academic information':'Account details'}</h2><dl class="details">${[
      ['Full name',name],['University email',detail?`${names[selectedStudent].toLowerCase().replace(' ','.')}@student.guc.edu.eg`:student()?'omar.hassan@student.guc.edu.eg':'nadia.ahmed@guc.edu.eg'],
      ['Role',detail?'Advising student':roleNames[role]],...(detail||student()?[['Student ID',detail?`70-${71577+selectedStudent}`:'70-71577'],['Major','Computer Engineering'],['Semester','7'],['Academic standing','Very good'],['Assigned advisor','Dr. Salma Adel'],['Schedule status','Ready for review'],['Enrollment','Active']]:[['Department','Faculty of Media Engineering & Technology']])
    ].map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl></section>`)+
    (detail?`<div class="actions">${link('preferences','View preferences','btn')}${link('draft-schedule','Open schedule','btn primary')}${button('Assign advisor','assign-advisor')}</div>`:'');
}
function notificationEntries(){
  return [
    ...Array.from({length:testCount}, (_, i) => [`test-${i}`, 'Test notification', 'This is a test notification for your account.', 'Just now']),
    ['schedule', 'Schedule ready for review', 'Omar Hassan’s advising schedule is ready for your review.', 'Today, 10:42'],
    ['removal', 'Course removal requested', 'Mariam Mostafa requested removal of CSEN 701.', 'Today, 09:30'],
    ['term', 'Winter 2026 dates updated', 'The registration window opens on 22 November.', 'Yesterday']
  ];
}

function notifications(){
  const entries = notificationEntries();
  const unread = entries.filter(([id]) => !readNotifications.has(id));
  const strip = tabs([['all', 'All notifications'], ['unread', `Unread · ${unread.length}`]], 'all');
  const visible = tab === 'unread' ? unread : entries;
  return head('Notifications', '', button('Create test notification','test-notification')+
    (unread.length ? button('Mark all as read','read-all','btn primary') : ''), '')+strip+
    (visible.length ? `<div class="notification-list">${visible.map(([id,title,description,time]) => {
      const isUnread = !readNotifications.has(id);
      return `<article class="inbox-item ${isUnread ? 'unread' : ''}">
        ${workspaces[lab.layout].name==='Claude Study' ? `<span class="notice-symbol" data-kind="${id}">${icon(({schedule:'book',removal:'inbox',term:'calendar'})[id]||'bell')}</span>` : ''}
        <div class="inbox-text"><h3>${title}</h3><p>${description}</p></div>
        <div class="notification-meta"><time>${time}</time>
          ${isUnread ? button('Mark as read','read-one','btn text', `data-notification="${id}"`) : '<small>Read</small>'}
        </div>
      </article>`;
    }).join('')}</div>` : '<div class="empty"><h2>You’re all caught up.</h2><p>No unread notifications.</p></div>');
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
  if (academicStudy()) {
    const semesters = [
      ['Winter 2026','2026 / 2027','22 Nov – 6 Dec 2026','13 Dec 2026','Active','', 'Manage'],
      ['Spring 2027','2026 / 2027','14 – 28 Feb 2027','7 Mar 2027','Upcoming','pending','Manage'],
      ['Spring 2026','2025 / 2026','15 Feb – 1 Mar 2026','8 Mar 2026','Archived','neutral','View']
    ];
    return head('Academic terms','Registration windows and schedule swap deadlines.',button('Create term','create-term','btn primary'))+
      `<div class="semester-ledger">${semesters.map(([name,year,registration,deadline,state,tone,action])=>`
        <article class="semester-line"><div class="semester-identity"><h2>${name}</h2><small>${year}</small></div>
          ${badge(state,tone)}<dl><div><dt>Registration</dt><dd>${registration}</dd></div><div><dt>Swap deadline</dt><dd>${deadline}</dd></div></dl>
          ${button(action,'manage-term','btn row-control')}</article>`).join('')}</div>`;
  }
  return head('Academic terms','',button('Create term','create-term','btn primary'))+
  table(['Term','Academic year','Registration','Swap deadline','Status',''],[
    ['Winter 2026','2026 / 2027','22 Nov – 6 Dec 2026','13 Dec 2026',badge('Active'),button('Manage','manage-term','btn text')],
    ['Spring 2027','2026 / 2027','14 – 28 Feb 2027','7 Mar 2027',badge('Upcoming','pending'),button('Manage','manage-term','btn text')],
    ['Spring 2026','2025 / 2026','15 Feb – 1 Mar 2026','8 Mar 2026',badge('Archived','neutral'),button('View','manage-term','btn text')]
  ]);}
function offerings(){return head('Course offerings',academicStudy() ? termContext('Teaching groups and sections') : '',button('Add offering','add-offering','btn primary')+link('copy-offerings','Copy from another term','btn'))+
  filterbar('Search offerings',[['Winter 2026',['Winter 2026','Spring 2027']]])+
  table(['Course','Groups','Lecture sections','Tutorial sections','Status',''],courseData.slice(0,4).map((c,i)=>[academicCourse(c,`${c[0]}<small>${c[1]}</small>`),'4','2','4',badge(i===3?'Draft':'Published',i===3?'pending':''),button('Manage sections','manage-sections','btn text')]));}
function copyOfferings(){return head('Copy course offerings','Choose a source term, then select the courses to copy.',link('offerings','Back to offerings','btn'))+
  `<section class="panel academic-transfer"><div class="formgrid"><label>Source term<select><option>Winter 2025</option><option>Spring 2026</option></select></label>${academicStudy() ? `<span class="transfer-arrow" aria-hidden="true">${icon('chevron')}</span>` : ''}<label>Destination term<select><option>Winter 2026</option><option>Spring 2027</option></select></label></div></section>`+
  table(['Select','Course','Groups','Sections'],courseData.map(c=>[`<input type="checkbox" aria-label="Copy ${c[0]}" checked>`,academicCourse(c,`${c[0]}<small>${c[1]}</small>`),'4','6']))+
  `<div class="form-footer">${button('Copy selected offerings','copy-confirm','btn primary')}</div>`;}
function templates(){return head('Schedule templates',academicStudy() ? termContext('Computer Engineering') : '',link('template-detail','Create template','btn primary'))+
  filterbar('Search templates',[['All majors',['Computer Engineering','Digital Media Engineering']]])+
  table(['Template','Major','Semester','Courses','Status',''],['Group 1','Group 2','Group 3','Group 4'].map((g,i)=>[academicStudy() ? `<span class="template-name">${icon('calendar')}<span><strong>${g}</strong><small>Winter 2026</small></span></span>` : `${g} · Winter 2026`,'Computer Engineering','7','4',badge(i===3?'Draft':'Published',i===3?'draft':''),link('template-detail','Edit template','btn row-control')]));}
function templateDetail(){return head('Group 4','Computer Engineering · Semester 7',button('Publish template','publish','btn primary')+button('Save draft','save-draft'), 'Template editor')+
  `<section class="panel template-fields"><div class="formgrid"><label>Group name<input value="Group 4" required></label><label>Major<select><option>Computer Engineering</option><option>Digital Media Engineering</option></select></label><label>Semester<input type="number" min="1" max="10" value="7"></label><label>Term<select><option>Winter 2026</option></select></label></div></section>`+
  `<div class="section-head"><h2>Course groups</h2>${button('Add course','add-offering','btn text')}</div>`+table(['Course','Lecture','Tutorial','Lab'],courseData.slice(0,4).map(c=>[academicCourse(c,`${c[0]}<small>${c[1]}</small>`),'L1 · Sun 08:30','T4 · Tue 10:00','P4 · Wed 12:00']))+`<div style="margin-top:30px">${academicStudy() ? '<h2 class="academic-week-title">Weekly timetable</h2>' : ''}${weekly()}</div>`;}
// Small marginal drawings identify the four courses wherever the weekly schedule appears.
function courseDrawing(code) {
  const symbol = {'CSEN 703':'algorithms','CSEN 704':'advanced-lab','DMET 701':'graphics'}[code];
  if (symbol) return `<img class="course-drawing course-symbol" src="images/symbols/${symbol}.svg" alt="">`;
  const paths = {
    'CSEN 701':'m9 6 11-.5.6 10.5-11 1z M12 9l5-.4.4 4.4-5 .4z M11 3v3m4-3v3m4-3v2m-8 12v3m4-3v3m4-4v3M6 9h3m-3 4h3m12-5h3m-3 5h3',

  };
  return paths[code] ? `<svg class="course-drawing" aria-hidden="true" viewBox="0 0 30 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[code]}"/></svg>` : '';
}
function weekly(){
  const days = [
    ['Sunday', [['08:30','CSEN 701','Lecture · C2.301','ice'], ['12:00','CSEN 703','Tutorial · C3.104','cherry']]],
    ['Monday', [['10:00','CSEN 704','Lab · C7.102','teal']]],
    ['Tuesday', [['08:30','CSEN 703','Lecture · C3.202','cherry'], ['10:00','CSEN 701','Tutorial · C2.204','ice'], ['14:00','CSEN 704','Lecture · C7.301','teal']]],
    ['Wednesday', [['12:00','DMET 701','Lecture · C1.201','clay']]],
    ['Thursday', []]
  ];
  return `<div class="week-columns" aria-label="Weekly course schedule">${days.map(([day, meetings]) =>
    `<section class="week-day" aria-label="${day}"><h2>${day}</h2>
      ${meetings.length ? meetings.map(([time, code, detail, color]) =>
        `<div class="week-class ${color}">${workspaces[lab.layout].name==='Claude Study' ? courseDrawing(code) : ''}<time datetime="${time}">${time}</time>
          <strong>${courseData.find(course => course[0] === code)[1]}</strong>
          <small>${workspaces[lab.layout].name==='Claude Study' ? `${code}<span class="study-place">${detail}</span>` : `${code} · ${detail}`}</small></div>`).join('') : '<p class="week-free">No classes</p>'}</section>`).join('')}</div>`;
}
function schedule(staff=false){
  if(staff)return head('Student schedules',academicStudy() ? termContext('Schedule review') : '',link('draft-schedule','Create advising draft','btn primary'))+
    `<section class="review-progress academic-progress" aria-labelledby="review-progress-title"><h2 id="review-progress-title">Draft progress</h2><div>${draftProgress()}</div></section>`+filterbar('Search students',[['All statuses',['Ready for review','Draft','Not started']]])+
    table(['Student','Major','Schedule','Last updated',''],names.map((n,i)=>[academicStudent(n,i),'Computer Engineering',badge(scheduleStates[i],statusTone(scheduleStates[i])),'Today, 10:42',link('draft-schedule',scheduleStates[i]==='Draft'?'Edit draft':'Review schedule','btn row-control',i)]));
  const timetableContext = workspaces[lab.layout].name==='Claude Study' ? termContext('Group 4 · Computer Engineering') : '';
  return head('Weekly schedule',timetableContext,button('Export calendar','export-calendar'),'')+
    tabs([['week','Week'],['list','Course list']],'week')+(tab==='list'?registeredTable():weekly())+
    '';
}
function workflow(){return `<div class="task"><div><h3>Preferences submitted</h3><p>Student · 12 November</p></div>${badge('Complete')}</div><div class="task"><div><h3>Advisor prepared draft</h3><p>Dr. Salma Adel · 13 November</p></div>${badge('Complete')}</div><div class="task"><div><h3>Coordinator review</h3><p>Check the draft before it goes to the student.</p></div>${badge('Awaiting decision','pending')}</div>`;}
function draft(){return head(`${names[selectedStudent].split(' ')[0]}’s advising draft`, `70-${71577+selectedStudent} · Computer Engineering · Semester 7`,button('Save draft','save-draft')+button('Process schedule','process','btn primary'),'Winter 2026')+
  `<div class="split academic-plan"><section class="panel"><h2>Selected courses</h2><div class="smallstats"><div><strong>19</strong><span>Credit hours</span></div><div><strong>4</strong><span>Courses selected</span></div><div><strong>0</strong><span>Time conflicts</span></div></div>${courseData.slice(0,4).map(c=>`<div class="task">${academicCourse(c,`<div><h3>${c[0]}</h3><p>${c[1]}</p></div>`)}<label><span class="sr-only">${c[0]} group</span><select aria-label="${c[0]} group"><option>Group 4</option><option>Group 2</option></select></label></div>`).join('')}</section><aside><section class="note"><div class="kicker">Student preferences</div><h2>Thursday off.</h2><p>Preferred group: 4<br>Earliest class: 08:30<br>Preferences updated 12 November.</p>${link('preferences','View preferences','btn text')}</section><section class="panel" style="margin-top:24px"><h2>Validation</h2><p>No time conflicts. Credit load is within the allowed range.</p></section></aside></div>`+(academicStudy() ? '<h2 class="academic-week-title">Proposed timetable</h2>' : '')+weekly()+`<section class="panel draft-workflow" style="margin-top:24px"><h2>Workflow</h2>${workflow()}${button('Reopen schedule','reopen','btn text')}</section>`;}
function registeredTable(){return table(['Course','Type','Credits','Group',''],courseData.slice(0,4).map(c=>[`<strong>${c[1]}</strong><small>${c[0]}</small>`,'Mandatory',c[3],'4',courseLink(c[0],'View sections','btn row-control')]));}
function courseEmblem(code) {
  const courseTone = {'CSEN 701':'blue','CSEN 703':'coral','CSEN 704':'sage','DMET 701':'ivory'};
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
function assignments(){return head('Group assignments','Assign students to a published schedule group.')+filterbar('Search students',[['All groups',['Group 1','Group 4','Unassigned']]])+
  table(['Student','Major','Semester','Group',''],names.map((n,i)=>[academicStudent(n,i),'Computer Engineering','7',i%2?badge('Unassigned','pending'):'Group 4',button(i%2?'Assign group':'Reassign','assign-group','btn row-control')]));}
function preferences(){
  const summary = student()?'Winter 2026 / 2027':'Omar Hassan · 70-71577 · Winter 2026 / 2027';
  const study = workspaces[lab.layout].name==='Claude Study';
  return head('Schedule preferences',study ? termContext(student()?'Group 4':'Omar Hassan · 70-71577') : summary,button('Save preferences','save-preferences','btn primary'))+
    `<div class="preference-workspace">
      <div class="preference-stack">
        <section class="preference-block" aria-labelledby="preferred-days">
          <div class="section-head"><h2 id="preferred-days">${icon('calendar')} Preferred days off</h2><output id="preferred-day-count" aria-live="polite">${preferencesState.days.length} of 2 selected</output></div>
          <p>Choose up to two days you’d like to keep free.</p>
          <div class="preference-day-grid">${['Sunday','Monday','Tuesday','Wednesday','Thursday'].map(day=>`<label>
            <input class="dayoff" type="checkbox" value="${day}" ${preferencesState.days.includes(day)?'checked':''}>
            <span>${day}</span>
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
  const study = workspaces[lab.layout].name==='Claude Study';
  return head('Financial records','',button('Export CSV','export-csv'))+`<dl class="ledger-summary">
    <div><dt>${study?icon('check'):''}Received</dt><dd>EGP 22,500</dd></div>
    <div><dt>${study?icon('clock'):''}Pending</dt><dd>EGP 15,000</dd></div>
    <div><dt>${study?icon('inbox'):''}Refunded</dt><dd>EGP 2,500</dd></div>
  </dl>`+
  filterbar('Search name or transaction ID',[['All types',['Payment','Refund']],['All statuses',['Completed','Pending']]])+
  table(['Transaction','Student','Type','Amount','Status',''],names.slice(0,6).map((n,i)=>[`TXN-${1042+i}<small>14 Nov 2026</small>`,staffIdentity(n,`70-${71577+i}`),i===4?'Refund':'Payment',`EGP ${i===4?'2,500':'7,500'}`,badge([1,5].includes(i)?'Pending':'Completed',[1,5].includes(i)?'payment-pending':'payment-complete'),button('View record','financial-detail','btn row-control')]));}
function removals(){return head('Course removals','Review mandatory-course removal requests.',student()?button('Request removal','request-removal','btn primary'):'')+
  tabs([['pending','Pending · 3'],['approved','Approved'],['rejected','Rejected']],'pending')+
  filterbar('Search student or course')+
  table(['Student','Course','Reason','Submitted','Status',''],names.slice(0,3).map((n,i)=>[staffIdentity(n,`70-${71577+i}`),`${courseData[i][0]}<small>${courseData[i][1]}</small>`,['Credit overload','Academic difficulty','Schedule conflict'][i],'13 Nov 2026',badge(tab==='pending'?'Pending':tab==='approved'?'Approved':'Rejected',tab==='pending'?'pending':tab==='rejected'?'review':''),button('Review request','removal-decision','btn row-control','aria-label="Review request"')]));}
function pending(){
  const study = workspaces[lab.layout].name==='Claude Study';
  const inboxLinks = [
    ['student-schedules','Review 6 student schedules','calendar'],
    ['mandatory-removals','Decide 3 course removals','course-removal'],
    ['advising','Assign 2 advisors','advisor-assignment']
  ].map(([target,label,symbol],index)=>{
    if (!study) return link(target,label,index===0?'btn primary':'');
    const drawing = symbol==='calendar' ? icon('calendar') : queueSketch(symbol);
    return link(target,`<span class="staff-queue-art">${drawing}</span><span>${label}</span>${icon('chevron')}`,'staff-queue-link');
  }).join('');
  return head('Pending work','',button('Refresh','refresh'))+
  `<div class="work-links">${inboxLinks}</div>`+
  table(['Work item','Student','Waiting since','Priority',''],[
    ['Review advising schedule','Omar Hassan','13 Nov 2026',badge('Review','ready'),link('draft-schedule','Open draft','btn row-control')],
    ['Decide course removal','Mariam Mostafa','13 Nov 2026',badge('Decision','review'),link('mandatory-removals','Review request','btn row-control')],
    ['Assign advisor','Ahmed Khaled','12 Nov 2026',badge('Assignment','neutral'),button('Assign advisor','assign-advisor','btn text')],
    ['Review advising schedule','Farah Mahmoud','12 Nov 2026',badge('Review','ready'),link('draft-schedule','Open draft','btn row-control')]
  ]);}
function activity(){
  const events = [
    ['Draft saved','Omar Hassan','Dr. Salma Adel','14 Nov','10:42','draft'],
    ['Schedule processed','Mariam Mostafa','Nadia Ahmed','14 Nov','09:15','payment-complete'],
    ['Schedule reopened','Ahmed Khaled','Nadia Ahmed','13 Nov','14:30','review'],
    ['Draft saved','Farah Mahmoud','Dr. Salma Adel','13 Nov','11:00','draft']
  ];
  return head('Schedule activity','','','')+filterbar('Search activity',[['All actions',['Draft saved','Schedule processed','Schedule reopened']]])+
    `<div class="activity-log">${['14 Nov','13 Nov'].map(date=>`<section class="activity-day"><h2>${date}<small>2026</small></h2><ol>${events.filter(e=>e[3]===date).map(([action,name,author,,time,tone],i)=>`<li data-search-row><time>${time}</time>${avatar(name)}<div><h3>${name}</h3><p>${action} by ${author}</p></div>${badge(action,tone)}</li>`).join('')}</ol></section>`).join('')}</div><p id="result-count">4 records</p>`;
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
function calendarSync(){
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
  const title=page==='login'?'Make the semester work.':page==='forgot'?'Reset your password':'Choose a new password';
  return `<main class="auth" id="content" tabindex="-1">
    <div class="signin-copy">
      <header><span class="wordmark">${portalWordmark()}</span><span class="signin-university">German University in Cairo</span></header>
      <section class="auth-card">
        <h1>${title}</h1>
        <p>${page==='login'?'Plan schedules and keep student advising on track.':page==='forgot'?'We’ll send a reset code to your university email.':'Enter the six-digit code from your email.'}</p>
        <form id="auth-form">
          ${page==='login' ? '<button type="submit" class="btn primary">Sign in</button>' : `
            <label>University email<input name="email" type="email" autocomplete="username" placeholder="${previewEmail}" required value="${page==='reset'?previewEmail:''}"></label>
            ${page==='reset'?'<label>Reset code<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required></label><label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>':''}
            <button type="submit" class="btn primary">${page==='forgot'?'Send reset code':'Update password'}</button>
            ${link('login','Back to sign in','auth-recovery')}`}
        </form>
      </section>
      <footer><span>Design preview</span></footer>
    </div>
    ${signinGallery()}
  </main>`;
}
const renderers = {overview,notifications,profile, directory, 'student-detail':()=>profile(true),advising:()=>directory(true),'pending-work':pending,'schedule-activity':activity,'financial-records':financial,'mandatory-removals':removals,'student-schedules':()=>schedule(true),'draft-schedule':draft,courses,'course-detail':courseDetail,terms,offerings,'copy-offerings':copyOfferings,templates,'template-detail':templateDetail,'group-assignments':assignments,'my-schedule':schedule,'my-courses':registered,'schedule-swap':swap,preferences,records,'my-advisor':advisor,'calendar-sync':calendarSync};
function accountControls(){
  const bell = `<svg class="icon notice-bell" aria-hidden="true" viewBox="0 0 28 28" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path class="bell-body" d="M8 12c0-4 2.1-6.6 6-6.6s6 2.8 6 6.6c0 3.6 1.2 5.4 2.4 7.1-4.7.8-12.3.8-16.8 0C7 17.4 8 15.4 8 12Z"/>
    <path class="bell-clapper" d="M12 22q2 2 4-.2"/>
    <path class="bell-echo" pathLength="1" d="M4.4 7.8Q2.5 10 2.7 12.4M23.6 7.3q2.1 2.3 2 4.4"/>
  </svg>`;
  return `<a class="icon-button" href="${href('notifications')}" data-page="notifications" aria-label="Notifications" title="Notifications">${bell}${notificationEntries().some(([id])=>!readNotifications.has(id)) ? '<span class="notification-dot"></span>' : ''}</a>
    <button type="button" class="account-button" popovertarget="account-menu" aria-label="Account menu for ${person()}">${avatar(person())}<span>${person()}</span>${icon('down')}</button>
    <div id="account-menu" popover><div class="account-caption">${roleNames[role]}</div>${link('profile','My profile')}${button('Sign out','sign-out','sign-out')}</div>`;
}

let arrivalObserver;
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');

function finishArrival(item){
  arrivalObserver?.unobserve(item);
  item.removeAttribute('data-arriving');
  item.getAnimations().filter(animation=>animation.id==='overview-arrival').forEach(animation=>animation.cancel());
}

function stageOverview(main){
  const items=main.querySelectorAll('.queue-entry,.week-class,.week-free,.module-review .review-person,.module-activity .event');
  const grid=main.querySelector('.work-grid');
  if(!items.length || motionPreference.matches) return;
  const order=new Map(Array.from(items,(item,index)=>[item,index]));
  let firstBatch=true;
  arrivalObserver=new IntersectionObserver((entries,observer)=>{
    const area=grid.getBoundingClientRect();
    const visible=entries.filter(entry=>entry.isIntersecting && entry.target.hasAttribute('data-arriving'));
    const week=firstBatch && main.querySelector('.week-columns');
    const releaseWeek=week && week.scrollWidth<=week.clientWidth;
    if(releaseWeek) week.classList.add('unstacking');
    const flights=visible.map(({target:item,boundingClientRect:box},rank)=>{
      observer.unobserve(item);
      item.removeAttribute('data-arriving');
      if(motionPreference.matches || item.matches(':focus-within')) return;
      const index=order.get(item);
      const side=index%2 ? 1 : -1;
      const row=item.matches('.review-person,.event');
      const gather=firstBatch && !row;
      const centerX=box.left+box.width/2,centerY=box.top+box.height/2;
      // Visible pieces share a pickup point. Later rows slip in from the gutter.
      const fromGutter=row && innerWidth>800;
      const direction=fromGutter ? (item.matches('.event') ? -1 : 1) : side;
      const dx=gather ? area.left+area.width/2-centerX : direction*Math.min(64,box.width*.22);
      const dy=gather ? Math.max(70,Math.min(innerHeight*.48,area.top+150))-centerY : 24;
      const bend=(gather?24:9)*side;
      const pose=(x,y,angle,scale)=>`translate(${x}px,${y}px) rotate(${angle}deg) scale(${scale})`;
      return item.animate([
        {transform:pose(dx,dy,side*(gather?7:3),gather ? .34 : .92),offset:0},
        {transform:pose(dx*.64+bend,dy*.7-10,-side*2,gather ? .76 : .98),offset:.34},
        {transform:pose(dx*.13-bend*.36,dy*.16+4,side*1.5,1),offset:.71},
        {transform:pose(-side*2,-1,-side*.35,1),offset:.88},
        {transform:'none'}
      ],{id:'overview-arrival',duration:gather?580:350,delay:Math.min(rank,7)*24,fill:'backwards',easing:'cubic-bezier(.25,.72,.36,1)'}).finished;
    });
    Promise.allSettled(flights).then(()=>{if(releaseWeek) week.classList.remove('unstacking');});
    if(visible.length) firstBatch=false;
  },{threshold:0});
  items.forEach(item=>{
    item.setAttribute('data-arriving','');
    arrivalObserver.observe(item);
  });
  main.addEventListener('focusin',event=>{
    const item=event.target.closest('.queue-entry,.review-person,.event');
    if(item) finishArrival(item);
  });
}

motionPreference.addEventListener('change',()=>{
  if(!motionPreference.matches) return;
  arrivalObserver?.disconnect();
  document.querySelectorAll('[data-arriving]').forEach(finishArrival);
  document.getAnimations().filter(animation=>animation.id==='overview-arrival').forEach(animation=>animation.cancel());
});

function render(focus=false){
  if (!authPages.has(page) && !signedIn()) {
    returnAfterSignIn = page;
    page = 'login';
    history.replaceState({},'',href(page));
  }
  document.title=`Portal — ${layoutNames[lab.layout]} · ${pages[page]}`;
  document.body.classList.toggle('auth-screen',authPages.has(page));
  const body=authPages.has(page)?auth():`<div class="shell">${sidebar()}<div class="workspace"><header class="topbar">${link('overview',portalWordmark(),'mobile-nav wordmark')}<span class="term">${workspaces[lab.layout].name==='Claude Study'?'<small class="study-crumb">Academic workspace &nbsp; / &nbsp;</small>':''}${pages[page]}<span>Winter 2026 / 2027</span></span><div class="topactions">${button(icon('menu')+'<span class="sr-only">Menu</span>','mobile-menu','mobile-menu')}${accountControls()}</div></header><main class="content" data-screen="${page}" id="content" tabindex="-1">${renderers[page]()}</main></div></div>`;
  arrivalObserver?.disconnect();
  app.innerHTML=body;
  syncControls(role, page);
  if(page==='overview' && workspaces[lab.layout].name==='Claude Study') stageOverview(app.querySelector('main'));
  if(focus)document.querySelector('#content')?.focus({preventScroll:true});
}
function navigate(target){if(dialog.open)dialog.close();page=pageKey(target);tab='';history.pushState({},'',href(page));render(true);window.scrollTo(0,0);}
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4000);}
function modal(title,content,submit='Save changes',action='save-modal'){
  returnFocus=document.activeElement;
  dialog.innerHTML=`<div class="modal-head"><h2>${title}</h2>${button('Close','close-dialog','')}</div>${content}<form id="modal-form" data-submit-action="${action}"><div id="modal-fields"></div><div class="form-footer">${button('Cancel','close-dialog')}<button class="btn primary" type="submit">${submit}</button></div></form>`;
  // Keep all form controls inside the form so native validation works.
  const fields=dialog.querySelectorAll(':scope > .modal-fields');
  fields.forEach(el=>dialog.querySelector('#modal-fields').replaceWith(el));
  dialog.showModal();
}
function fields(content){return `<div class="modal-fields">${content}</div>`;}
function closeDialog(){dialog.close();if(returnFocus?.isConnected)returnFocus.focus();}
function download(filename,text,type='text/plain'){
  const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast(`Downloaded ${filename}`);
}
function filterRows(){
  const query=(document.querySelector('#search')?.value||'').toLowerCase();
  const filters=Array.from(document.querySelectorAll('[data-filter]')).map(el=>el.value.toLowerCase()).filter(Boolean);
  let count=0;document.querySelectorAll('[data-search-row]').forEach(row=>{const text=row.textContent.toLowerCase();const match=text.includes(query)&&filters.every(f=>text.includes(f));row.hidden=!match;if(match)count++;});
  const result=document.querySelector('#result-count');if(result)result.textContent=`${count} records`;const empty=document.querySelector('.search-empty');if(empty)empty.hidden=count>0;
}
function action(name,el){
  switch(name){
    case 'sign-out':
      localStorage.removeItem(previewSessionKey);
      returnAfterSignIn = 'overview';
      navigate('login');
      break;
    case 'pick-review':selectedStudent=Number(el.dataset.student);render();document.querySelector('.dispatch-person[aria-pressed=true]')?.focus();break;
    case 'quick-find':modal('Find a page',fields('<label>Search pages<input id="page-finder" type="search" placeholder="Schedule, students, courses…" autofocus></label>')+`<nav class="page-results">${groups().flatMap(([,ids])=>ids).map(id=>link(id,pages[id],'navlink')).join('')}</nav>`,'Close','close');break;
    case 'mobile-menu':modal('Navigation',`<nav aria-label="Mobile navigation">${groups().map(([name,items])=>`<div class="navgroup"><p class="navlabel">${name}</p>${items.map(id=>link(id,pages[id],`navlink ${id===page?'active':''}`)).join('')}</div>`).join('')}${link('profile','My profile','navlink')}</nav>`,'Close','close');break;
    case 'test-notification':testCount++;render();toast('Test notification created in this preview.');break;
    case 'refresh':toast('Preview refreshed.');break;
    case 'read-all':notificationEntries().forEach(([id]) => readNotifications.add(id));render();document.querySelector('[aria-selected=true]')?.focus();toast('All notifications marked as read.');break;
    case 'read-one':readNotifications.add(el.dataset.notification);render();document.querySelector('[aria-selected=true]')?.focus();break;
    case 'close-dialog':closeDialog();break;
    case 'save-draft':toast('Draft saved in this preview.');break;
    case 'save-preferences':if(document.querySelectorAll('.dayoff:checked').length>2)toast('Choose up to two preferred days.');else {preferencesState={days:Array.from(document.querySelectorAll('.dayoff:checked')).map(el=>el.value),groups:Array.from(document.querySelectorAll('[data-course-group]')).map(el=>el.value),notes:document.querySelector('#preference-notes').value};toast('Preferences saved in this preview.');}break;
    case 'toggle-calendar':connected=!connected;render();toast(connected?'Sample calendar connected.':'Sample calendar disconnected.');break;
    case 'sync-now':toast(connected?'Sample schedule synced.':'Connect your calendar first.');break;
    case 'export-csv':download('sample-financial-records.csv','Transaction,Student,Type,Amount,Status\n'+names.slice(0,6).map((name,i)=>`TXN-${1042+i},${name},${i===4?'Refund':'Payment'},${i===4?2500:7500},${[1,5].includes(i)?'Pending':'Completed'}`).join('\n'),'text/csv');break;
    case 'export-calendar':download('sample-schedule.ics','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Portal//Design Preview//EN\r\nBEGIN:VEVENT\r\nUID:sample-csen701@bobos\r\nDTSTAMP:20261114T080000Z\r\nDTSTART:20261115T063000Z\r\nDTEND:20261115T080000Z\r\nSUMMARY:CSEN 701 - Embedded Systems (sample)\r\nLOCATION:C2.301\r\nEND:VEVENT\r\nEND:VCALENDAR','text/calendar');break;
    case 'transcript':download('sample-transcript.txt','DESIGN PREVIEW - SAMPLE TRANSCRIPT\nOmar Hassan, 70-71577\nCumulative GPA: 1.70\nCompleted credits: 116\nNot an official academic record.');break;
    case 'assign-advisor':modal('Assign an advisor',fields('<label>Student<select><option>Omar Hassan · 70-71577</option><option>Ahmed Khaled · 70-71579</option></select></label><label>Advisor<select><option>Dr. Salma Adel</option><option>Dr. Hany Youssef</option></select></label>'),'Assign advisor');break;
    case 'assign-group':modal('Assign schedule group',fields('<label>Student<input value="Omar Hassan · 70-71577" readonly></label><label>Published group<select><option>Group 4 · Computer Engineering</option><option>Group 1 · Computer Engineering</option><option>Unassigned</option></select></label>'),'Save assignment');break;
    case 'add-course':case 'edit-course':{
      const editing=name==='edit-course';
      const [code,title,department,credits]=editing?selectedCourse:['','','Computer Engineering','5'];
      const departments=[...new Set(courseData.map(course=>course[2]))];
      modal(editing?'Edit course':'Add course',fields(`<div class="formgrid"><label>Course code<input required value="${code}" placeholder="CSEN 701"></label><label>Credit hours<input type="number" min="1" max="12" required value="${credits}"></label></div><label>Course name<input required value="${escapeHtml(title)}"></label><label>Department<select>${departments.map(d=>`<option ${d===department?'selected':''}>${d}</option>`).join('')}</select></label>`));
      break;
    }
    case 'import-csv':modal('Import courses',fields('<label>Course CSV<input type="file" accept=".csv" required></label><p>Columns: code, name, department, credits, season.</p>'),'Preview import');break;
    case 'create-term':case 'manage-term':modal(name==='create-term'?'Create academic term':'Manage Winter 2026',fields('<label>Term name<input required value="Winter 2026"></label><div class="formgrid"><label>Registration opens<input type="date" value="2026-11-22" required></label><label>Registration closes<input type="date" value="2026-12-06" required></label><label>Swap deadline<input type="date" value="2026-12-13" required></label><label>Status<select><option>Active</option><option>Upcoming</option><option>Archived</option></select></label></div>'));break;
    case 'add-offering':modal('Add course offering',fields('<label>Course<select><option>CSEN 701 · Embedded Systems</option><option>CSEN 703 · Algorithms</option></select></label><div class="formgrid"><label>Term<select><option>Winter 2026</option></select></label><label>Number of groups<input type="number" min="1" value="4" required></label></div>'),'Add offering');break;
    case 'manage-sections':modal('CSEN 701 sections',table(['Section','Time','Room'],[['Lecture 1','Sun 08:30','C2.301'],['Tutorial 4','Tue 10:00','C2.204'],['Lab 4','Wed 12:00','C7.102']],false),'Save sections');break;
    case 'copy-confirm':{const count=document.querySelectorAll('table input:checked').length;if(!count){toast('Select at least one offering.');break;}modal('Copy selected offerings?',`<p>${count} offerings will be copied from Winter 2025 to Winter 2026 in this preview. Existing offerings will be kept.</p>`,'Copy offerings');break;}
    case 'publish':modal('Publish this template?','<p>Group 4 will become available for student assignments in this preview.</p>','Publish template');break;
    case 'process':modal(`Process ${names[selectedStudent].split(' ')[0]}’s schedule?`,'<p>The draft has 19 credit hours and no time conflicts. Processing sends it to the student for review.</p>','Process schedule');break;
    case 'reopen':modal('Reopen this schedule?',fields('<label>Reason<textarea required rows="3" placeholder="Explain why the schedule needs another review."></textarea></label>'),'Reopen schedule');break;
    case 'financial-detail':modal('Transaction TXN-1042',`<dl class="details"><div><dt>Student</dt><dd>Omar Hassan</dd></div><div><dt>Date</dt><dd>14 Nov 2026</dd></div><div><dt>Type</dt><dd>Course payment</dd></div><div><dt>Amount</dt><dd>EGP 7,500</dd></div></dl><div style="margin-top:24px">${button('Refund transaction','refund','btn danger')}</div>`,'Close','close');break;
    case 'refund':dialog.close();modal('Refund this transaction?',fields('<p>EGP 7,500 will be returned to the student’s wallet in this preview.</p><label>Refund reason<textarea required rows="3"></textarea></label>'),'Confirm refund');break;
    case 'removal-decision':modal('CSEN 701 removal request',`<p>Omar Hassan · 70-71577<br>Reason: credit overload.<br>Removing this course reduces the semester load from 19 to 14 credits.</p>`+fields('<label>Decision<select><option>Approve removal</option><option>Reject request</option></select></label><label>Decision note<textarea required rows="3" placeholder="Explain the decision to the student."></textarea></label>'),'Submit decision');break;
    case 'request-removal':modal('Request course removal',fields('<label>Course<select><option>CSEN 701 · Embedded Systems</option><option>CSEN 703 · Algorithms</option></select></label><label>Reason<textarea required rows="3" placeholder="Why do you need to remove this course?"></textarea></label>'),'Submit request');break;
    case 'group-schedule':modal('Group 1 schedule',weekly(),'Close','close');break;
    case 'request-swap':modal('Request a schedule swap?','<p>Your request will be visible to students in the selected group with the same registered courses.</p>','Submit swap request');break;
    case 'exchange':modal('Exchange full schedules?','<p>Your Group 4 schedule will be exchanged with Group 1. Meeting times for all registered courses will change.</p>','Confirm exchange');break;
    case 'withdraw':modal('Withdraw swap request?','<p>This request will no longer be available to other students.</p>','Withdraw request');break;
    default:toast('Updated in this preview.');
  }
}
document.addEventListener('click',event=>{
  const choice = event.target.closest('[data-queue-focus]');
  if (!choice) return;
  const queue = choice.closest('.queue-designer');
  queue.querySelectorAll('[data-queue-focus]').forEach(option=>option.setAttribute('aria-pressed',String(option===choice)));
  queue.querySelectorAll('.queue-entry').forEach(entry=>entry.dataset.current=String(entry.dataset.icon===choice.dataset.queueFocus));
});
let pendingPressNavigation;
const inkPresses=new WeakSet();
// Capture the press position before the action can replace its button.
document.addEventListener('click',event=>{
  clearTimeout(pendingPressNavigation);
  if(event.button!==0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const control=event.target.closest('a[href],button,summary');
  if(!control || control.matches(':disabled,[aria-disabled="true"]')) return;
  if(page!=='overview' && !control.closest('[data-screen=notifications]') &&
      !control.matches('.icon-button[data-page=notifications],main .btn')) return;

  inkPresses.add(event);
  const ink=document.querySelector('#press-ink');
  const bounds=control.getBoundingClientRect();
  Object.assign(ink.style,{left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px'});
  ink.querySelectorAll('path').forEach((ray,index)=>{
    ray.getAnimations().forEach(animation=>animation.cancel());
    ray.animate([
      {strokeDashoffset:1,opacity:1,transform:"scale(.56)"},
      {strokeDashoffset:0,opacity:1,transform:"scale(1.12)",offset:.43},
      {strokeDashoffset:0,opacity:1,transform:"scale(1)",offset:.65},
      {strokeDashoffset:-1,opacity:0,transform:"scale(1.07)"}
    ],{duration:280,delay:[0,23,12,0,34][index],easing:'ease-out'});
  });
},true);

document.addEventListener('click',event=>{
  const target=event.target.closest('[data-page],[data-action],[data-tab]');if(!target)return;
  if(target.dataset.page){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;if(target.dataset.student !== undefined)selectedStudent=Number(target.dataset.student);if(target.dataset.courseCode)selectedCourse=resolveCourse(target.dataset.courseCode);event.preventDefault();
    if(inkPresses.has(event)){
      pendingPressNavigation=setTimeout(()=>{if(target.isConnected) navigate(target.dataset.page);},150);
    }else navigate(target.dataset.page);}
  else if(target.dataset.tab){tab=target.dataset.tab;render();document.querySelector(`[data-tab="${tab}"]`)?.focus();}
  else action(target.dataset.action,target);
});
document.addEventListener('change',event=>{
  if(event.target.matches('[data-queue-style]')) {
    queueDirection = event.target.value;
    event.target.closest('.queue-designer').dataset.direction = queueDirection;
    localStorage.setItem(queueDirectionKey,queueDirection);
    const url = new URL(location.href);
    url.searchParams.delete('queue');
    history.replaceState(history.state,'',url);
  } else if(event.target.id==='role-select'){role=event.target.value;navigate('overview');}
  else if(event.target.id==='page-select')navigate(event.target.value);
  else if(event.target.matches('[data-filter]'))filterRows();
  else if(event.target.matches('.dayoff')) {
    const count = document.querySelectorAll('.dayoff:checked').length;
    if (count > 2) {
      event.target.checked = false;
      toast('Choose up to two preferred days.');
    } else {
      document.querySelector('#preferred-day-count').textContent = `${count} of 2 selected`;
    }
  }
});
document.addEventListener('input',event=>{if(event.target.id==='search')filterRows();if(event.target.id==='page-finder')document.querySelectorAll('.page-results a').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(event.target.value.toLowerCase()));});
document.addEventListener('submit',event=>{
  event.preventDefault();
  if(event.target.id==='auth-form'){
    if(page==='login'){
      localStorage.setItem(previewSessionKey,'1');
      const destination = returnAfterSignIn;
      returnAfterSignIn = 'overview';
      navigate(destination);
    }
    else if(page==='forgot'){navigate('reset');toast('Sample reset code: 123456.');}
    else{navigate('login');toast('Reset preview complete.');}
  }else if(event.target.id==='modal-form'){
    const label=event.submitter?.textContent||'Saved';const close=event.target.dataset.submitAction==='close';closeDialog();if(!close)toast(`${label} — completed in this preview.`);
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
  event.preventDefault();tab=buttons[i].dataset.tab;render();document.querySelector(`[data-tab="${tab}"]`).focus();
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
