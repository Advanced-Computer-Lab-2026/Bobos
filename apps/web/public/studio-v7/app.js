'use strict';
// Review-only prototypes. All records and state stay in this page; no API calls.
const previewUrl = new URL(location.href);
const requestedTheme = previewUrl.searchParams.get('theme');
if (requestedTheme === 'dark' || requestedTheme === 'light') {
  localStorage.setItem('bobos-v7-theme', requestedTheme);
  previewUrl.searchParams.delete('theme');
  if (location.protocol !== 'file:') history.replaceState(null, '', previewUrl);
}
document.documentElement.dataset.theme = localStorage.getItem('bobos-v7-theme') || 'light';
const appearanceOptions = {
  canvas: {default: 'Designed', cream: 'Cream', paper: 'Paper', stone: 'Stone'},
  sidebar: {default: 'Designed', cream: 'Cream', linen: 'Linen', paper: 'Paper'}
};
for (const [key, options] of Object.entries(appearanceOptions)) {
  const saved = localStorage.getItem(`bobos-v7-${key}`);
  document.documentElement.dataset[key] = Object.hasOwn(options, saved) ? saved : 'default';
}
const version = Number(document.body.dataset.version);
const variants = ['Folio', 'Atelier', 'Index', 'Commons', 'Studio'];
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
let role = roleNames[params.get('role')] ? params.get('role') : 'coordinator';
let page = pages[params.get('page')] ? params.get('page') : 'overview';
let tab = '';
let testCount = 0;
const readNotifications = new Set();
let connected = true;
let toastTimer;
let returnFocus;
let selectedStudent = 0;
let preferencesState = {days: ['Thursday'], groups: Array(4).fill('Group 4'), notes: 'I would prefer to keep Thursday free.'};
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const student = () => ['normalStudent','advisingStudent'].includes(role);
const person = () => student() ? 'Omar Hassan' : role === 'advisor' ? 'Dr. Salma Adel' : role === 'administrator' ? 'Youssef Ali' : 'Nadia Ahmed';
const href = target => `?page=${target}&role=${role}`;
const link = (target, text, cls='') => `<a class="${cls}" href="${href(target)}" data-page="${target}">${text}</a>`;
const button = (text, action, cls='btn', extra='') => `<button class="${cls}" type="button" data-action="${action}" ${extra}>${text}</button>`;
const badge = (text, tone='') => `<span class="badge ${tone}">${icon(tone==='draft'?'edit':tone==='neutral'?'circle':tone==='pending'||tone==='payment-pending'?'clock':tone==='ready'||tone==='review'?'inbox':'check')}${text}</span>`;
const names = ['Omar Hassan','Mariam Mostafa','Ahmed Khaled','Farah Mahmoud','Youssef Tarek','Laila Amr','Nour Ibrahim','Salma Tamer','Kareem Mostafa','Yasmin Adel','Ali Nabil','Hana Sherif'];
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
function avatar(name, index=0) { return `<span class="avatar avatar-${index%4}" aria-hidden="true">${name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span>`; }

const courseData = [
  ['CSEN 701','Embedded Systems','Computer Engineering','5','Winter'],
  ['CSEN 703','Analysis & Design of Algorithms','Computer Engineering','5','Winter'],
  ['CSEN 704','Advanced Computer Lab','Computer Engineering','4','Winter'],
  ['DMET 701','Computer Graphics','Digital Media Engineering','5','Winter'],
  ['ELCT 701','Communication Systems','Electronics Engineering','5','Winter'],
  ['MATH 701','Numerical Analysis','Mathematics','4','Winter']
];
function reviewbar(){
  return `<header class="preview-tools" aria-label="Design preview controls">
    <a class="preview-compare" href="compare.html">V7</a>
    <nav class="preview-variants" aria-label="Design versions">
      ${variants.map((name, i) => `<a href="${String(i+1).padStart(2,'0')}-${name.toLowerCase()}.html${href(page)}" ${version===i+1?'aria-current="page"':''}>${name}</a>`).join('')}
    </nav>
    <div class="preview-filters">
      <label>Role<select aria-label="Preview role" id="role-select">
        ${Object.entries(roleNames).map(([key,name]) => `<option value="${key}" ${role===key?'selected':''}>${name}</option>`).join('')}
      </select></label>
      <label>Screen<select aria-label="Preview any page" id="page-select">
        ${Object.entries(pages).map(([key,title]) => `<option value="${key}" ${page===key?'selected':''}>${title}</option>`).join('')}
      </select></label>
      ${Object.entries(appearanceOptions).map(([key, options]) => {
        const label = key === 'canvas' ? 'Page background' : 'Sidebar';
        return `<label>${key === 'canvas' ? 'Canvas' : label}<select aria-label="${label}" data-appearance="${key}">
          ${Object.entries(options).map(([value, name]) => `<option value="${value}" ${document.documentElement.dataset[key]===value?'selected':''}>${name}</option>`).join('')}
        </select></label>`;
      }).join('')}
    </div>
  </header>`;
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
  const sectionIcons = ['home','people','calendar','book'];
  return `<aside class="sidebar">
    <div class="brand">${link('overview','Portal','wordmark')}<span>Academic workspace</span></div>
    <button class="nav-search" type="button" data-action="quick-find">${icon('search')}<span>Find a page</span><kbd>/</kbd></button>
    <nav aria-label="Main navigation">${groups().map(([name,items],groupIndex)=>{
      const contents = `<ul>${items.map(id => {
        const current = page === id || parent[page] === id;
        const count = id === 'student-schedules' ? readyStudents.length : id === 'mandatory-removals' ? 3 : '';
        return `<li><a class="navlink${current ? ' active' : ''}" href="${href(id)}" data-page="${id}" ${current ? 'aria-current="page"' : ''}><span>${pages[id]}</span>${count ? `<span class="nav-count">${count}</span>` : ''}</a></li>`;
      }).join('')}</ul>`;
      const isOpen = ![2,4].includes(version) || groupIndex === 0 || items.includes(page) || items.includes(parent[page]);
      return `<details class="navgroup" ${isOpen?'open':''}><summary>${icon(sectionIcons[groupIndex])}<span>${name}</span>${icon('down')}</summary>${contents}</details>`;
    }).join('')}</nav>
    <div class="sidebar-foot"><span class="term-dot"></span><span>Winter 2026<span class="side-sub">German University in Cairo</span></span></div>
  </aside>`;
}

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
function overview(){
  if(student()) return studentOverview();
  const reviewRows = readyStudents.slice(0,3).map(({name,index})=>`<div class="review-person">${avatar(name,index)}<div><strong>${name}</strong><span>${index === 0 ? '19 credits · Thursday off' : 'Semester 7 · Group 4'}</span></div>${link('draft-schedule','Review','btn row-control').replace('data-page=', `data-student="${index}" data-page=`)}</div>`).join('');
  const focus = `<section class="review-focus"><div class="focus-copy"><span class="section-caption">Advising review</span><h2>${readyStudents.length} schedules <br>ready for your review.</h2><p>Prepared by your advisors. <br>One final review before they reach students.</p>${link('student-schedules','Review schedules','btn primary')}</div><div class="focus-people">${reviewRows}<span class="focus-more">${readyStudents.length-3} more students ready</span></div></section>`;
  const queue = `<section class="home-queue"><div class="section-head"><h2>Work queue</h2>${link('pending-work','All work','quiet-link')}</div><div class="queue-rows">${[
    ['3 course removal requests','Credit load and scheduling decisions','mandatory-removals','Review requests'],
    ['2 students need an advisor','Assign an advisor to continue scheduling','advising','Assign advisors'],
    ['6 students need a group','Computer Engineering · Semester 7','group-assignments','Assign groups']
  ].map(([title,desc,target,cta])=>`<div class="queue-row"><div><strong>${title}</strong><p>${desc}</p></div>${link(target,cta,'btn')}</div>`).join('')}</div></section>`;
  const registration = `<section class="registration"><div class="section-head"><h2>Registration</h2><span class="quiet-label">Winter 2026</span></div><div class="date-lead"><div class="date-stamp"><span>Nov</span><strong>22</strong></div><div><strong>Registration opens</strong><p>Sunday, 22 November</p></div></div><dl class="registration-dates"><div><dt>Registration closes</dt><dd>6 Dec</dd></div><div><dt>Schedule swaps close</dt><dd>13 Dec</dd></div></dl>${link('terms','Manage academic term','btn term-action')}</section>`;
  const recent = `<section class="home-activity"><div class="section-head"><h2>Recent activity</h2>${link('schedule-activity','Activity log','quiet-link')}</div><div class="event">${avatar('Mariam Mostafa',1)}<div><p><strong>Mariam Mostafa</strong> submitted her preferences</p><time>Today, 10:42</time></div></div><div class="event">${avatar('Dr. Salma Adel',2)}<div><p><strong>Dr. Salma Adel</strong> saved Omar’s draft</p><time>Today, 09:15</time></div></div></section>`;
  const title = version === 3 ? 'Your review desk' : version === 4 ? 'Today at Portal' : `Good afternoon, ${person().split(' ')[0]}.`;
  const header=head(title,'Saturday, 14 November', '', '');
  const desk = `<section class="review-desk"><div class="section-head"><h2>Ready for review <span class="inline-count">${readyStudents.length}</span></h2>${link('student-schedules','All schedules','btn')}</div><div class="review-desk-body"><div class="review-picks">${readyStudents.map(({name,index})=>`<button type="button" class="review-pick ${selectedStudent===index?'selected':''}" data-action="pick-review" data-student="${index}">${avatar(name,index)}<span><strong>${name}</strong><small>19 credits · Group 4</small></span>${icon('chevron')}</button>`).join('')}</div><div class="review-peek"><div class="section-caption">Advising draft</div><h2>${names[selectedStudent]}</h2><p>Computer Engineering · Semester 7</p><div class="peek-courses">${courseData.slice(0,4).map(c=>`<div><span>${c[1]}</span><small>${c[3]} cr.</small></div>`).join('')}</div><div class="peek-meta">${badge('No time conflicts','payment-complete')}<span>Thursday off</span></div>${link('draft-schedule','Open advising draft','btn primary')}</div></div></section>`;
  const agenda = `<section class="daily-agenda"><div class="agenda-intro"><span class="section-caption">Advising · Winter 2026</span><h2>${readyStudents.length} schedules<br>await your review.</h2><p>Review their schedules before registration opens on 22 November.</p>${link('student-schedules','Review schedules','btn primary')}</div><div class="agenda-list">${readyStudents.slice(0,4).map(({name,index})=>`<div>${avatar(name,index)}<span><strong>${name}</strong><small>Draft prepared · 19 credits</small></span>${link('draft-schedule','Review','btn row-control').replace('data-page=',`data-student="${index}" data-page=`)}</div>`).join('')}</div></section>`;
  const layouts = {
    1: `<div class="overview-folio">${focus}<div class="overview-main">${queue}${recent}</div>${registration}</div>`,
    2: `<div class="overview-atelier">${focus}${queue}<div class="overview-aside">${registration}${recent}</div></div>`,
    3: `<div class="overview-index">${desk}<div class="index-bottom">${queue}${registration}${recent}</div></div>`,
    4: `<div class="overview-commons">${agenda}<div class="commons-bottom">${queue}<div class="overview-aside">${registration}${recent}</div></div></div>`,
    5: `<div class="overview-studio"><div class="overview-main">${focus}${queue}</div><div class="overview-aside">${recent}${registration}</div></div>`
  };
  return header+layouts[version];
}
function studentOverview(){
  return head('Your semester','Winter 2026 · Computer Engineering',link('my-schedule','Open schedule','btn primary'),'')+`
    <div class="student-home"><section class="student-today"><div class="section-head"><h2>Sunday’s classes</h2><span class="quiet-label">15 November</span></div>
    <div class="student-class ice"><time>08:30 <span>10:00</span></time><div><small>CSEN 701 · Lecture</small><h2>Embedded Systems</h2><p>C2.301 · Group 4</p></div></div>
    <div class="student-class cherry"><time>12:00 <span>13:30</span></time><div><small>CSEN 703 · Tutorial</small><h2>Analysis & Design of Algorithms</h2><p>C3.104 · Group 4</p></div></div>
    <div class="section-head course-summary"><h2>This semester</h2>${link('my-courses','View courses','btn')}</div><p>4 courses · 19 credit hours · Thursday free</p></section>
    <aside class="student-advising"><span class="section-caption">Academic advising</span><h2>Your draft is ready.</h2><p>Dr. Salma Adel has prepared your schedule. Review your courses and preferred days before your meeting.</p>${link('my-schedule','Review your draft','btn primary')}<div class="advisor-mini">${avatar('Salma Adel',2)}<div><strong>Dr. Salma Adel</strong><p>Tuesday, 12:00–14:00 · C3.204</p></div></div>${link('my-advisor','Advising details','btn')}</aside></div>`;
}

function directory(advising=false){
  return head(advising?'Advising students':'Student directory',advising?'Review assignments, preferences, and schedules.':'Find a student and open their academic details.',advising?button('Assign advisor','assign-advisor','btn primary'):'')+
    filterbar('Search name or ID', [['All majors',['Computer Engineering','Digital Media Engineering']],['All statuses',['Ready for review','Draft','Not started']]])+
    table(['Student','Major','Semester',advising?'Advisor':'Type','Schedule',''],names.map((name,i)=>[
      `<strong>${name}</strong><small>70-${71577+i}</small>`,i===3?'Digital Media Engineering':'Computer Engineering','7',advising?([2,8].includes(i)?'Unassigned':'Dr. Salma Adel'):(i%3?'Advising':'Normal'),badge(scheduleStates[i],statusTone(scheduleStates[i])),link('student-detail','View student','btn row-control').replace('data-page=',`data-student="${i}" data-page=`)
    ]));
}
function profile(detail=false){
  const name=detail?names[selectedStudent]:person();
  return head(detail?'Student details':'My profile', '',detail?link('directory','Back to directory','btn'):'',detail?`70-${71577+selectedStudent}`:'Account')+
    `<div class="person-title"><div class="monogram" aria-hidden="true">${name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><h2>${name}</h2><p>${detail?'Advising student · Computer Engineering':roleNames[role]}</p></div></div>`+
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
        <div class="inbox-text"><h3>${title}</h3><p>${description}</p></div>
        <div class="notification-meta"><time>${time}</time>
          ${isUnread ? button('Mark as read','read-one','btn text', `data-notification="${id}"`) : '<small>Read</small>'}
        </div>
      </article>`;
    }).join('')}</div>` : '<div class="empty"><h2>You’re all caught up.</h2><p>No unread notifications.</p></div>');
}
function courses(){return head('Course catalogue','',button('Add course','add-course','btn primary')+button('Import CSV','import-csv'))+
  filterbar('Search courses',[['All departments',['Computer Engineering','Digital Media Engineering','Electronics Engineering']],['All seasons',['Winter','Spring']]])+
  table(['Code','Course','Department','Credits','Season',''],courseData.map(c=>[c[0],`<strong>${c[1]}</strong>`,...c.slice(2),link('course-detail','View course','btn row-control')]));}
function courseDetail(){return head('Embedded Systems','CSEN 701 · Computer Engineering',button('Edit course','edit-course','btn primary')+link('courses','Back to catalogue','btn'),'Course details')+
  `<div class="split"><section class="panel"><h2>Course information</h2><dl class="details">${[['Course code','CSEN 701'],['Credit hours','5'],['Department','Computer Engineering'],['Semester','7'],['Type','Mandatory'],['Offering seasons','Winter, Spring']].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></section><section class="panel"><h2>Prerequisites</h2><div class="task"><div><h3>CSEN 501</h3><p>Introduction to Computer Architecture</p></div></div><h2 style="margin-top:28px">Current offering</h2><p>Winter 2026 · 4 groups</p>${link('offerings','View offering','btn text')}</section></div>`;}
function terms(){return head('Academic terms','',button('Create term','create-term','btn primary'))+
  table(['Term','Academic year','Registration','Swap deadline','Status',''],[
    ['Winter 2026','2026 / 2027','22 Nov – 6 Dec 2026','13 Dec 2026',badge('Active'),button('Manage','manage-term','btn text')],
    ['Spring 2027','2026 / 2027','14 – 28 Feb 2027','7 Mar 2027',badge('Upcoming','pending'),button('Manage','manage-term','btn text')],
    ['Spring 2026','2025 / 2026','15 Feb – 1 Mar 2026','8 Mar 2026',badge('Archived','neutral'),button('View','manage-term','btn text')]
  ]);}
function offerings(){return head('Course offerings','',button('Add offering','add-offering','btn primary')+link('copy-offerings','Copy from another term','btn'))+
  filterbar('Search offerings',[['Winter 2026',['Winter 2026','Spring 2027']]])+
  table(['Course','Groups','Lecture sections','Tutorial sections','Status',''],courseData.slice(0,4).map((c,i)=>[`${c[0]}<small>${c[1]}</small>`,'4','2','4',badge(i===3?'Draft':'Published',i===3?'pending':''),button('Manage sections','manage-sections','btn text')]));}
function copyOfferings(){return head('Copy course offerings','Choose a source term, then select the courses to copy.',link('offerings','Back to offerings','btn'))+
  `<section class="panel"><div class="formgrid"><label>Source term<select><option>Winter 2025</option><option>Spring 2026</option></select></label><label>Destination term<select><option>Winter 2026</option><option>Spring 2027</option></select></label></div></section>`+
  table(['Select','Course','Groups','Sections'],courseData.map(c=>[`<input type="checkbox" aria-label="Copy ${c[0]}" checked>`,`${c[0]}<small>${c[1]}</small>`,'4','6']))+
  `<div class="form-footer">${button('Copy selected offerings','copy-confirm','btn primary')}</div>`;}
function templates(){return head('Schedule templates','',link('template-detail','Create template','btn primary'))+
  filterbar('Search templates',[['All majors',['Computer Engineering','Digital Media Engineering']]])+
  table(['Template','Major','Semester','Courses','Status',''],['Group 1','Group 2','Group 3','Group 4'].map((g,i)=>[`${g} · Winter 2026`,'Computer Engineering','7','4',badge(i===3?'Draft':'Published',i===3?'draft':''),link('template-detail','Edit template','btn row-control')]));}
function templateDetail(){return head('Group 4','Computer Engineering · Semester 7',button('Publish template','publish','btn primary')+button('Save draft','save-draft'), 'Template editor')+
  `<section class="panel"><div class="formgrid"><label>Group name<input value="Group 4" required></label><label>Major<select><option>Computer Engineering</option><option>Digital Media Engineering</option></select></label><label>Semester<input type="number" min="1" max="10" value="7"></label><label>Term<select><option>Winter 2026</option></select></label></div></section>`+
  `<div class="section-head"><h2>Course groups</h2>${button('Add course','add-offering','btn text')}</div>`+table(['Course','Lecture','Tutorial','Lab'],courseData.slice(0,4).map(c=>[`${c[0]}<small>${c[1]}</small>`,'L1 · Sun 08:30','T4 · Tue 10:00','P4 · Wed 12:00']))+`<div style="margin-top:30px">${weekly()}</div>`;}
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
        `<div class="week-class ${color}"><time datetime="${time}">${time}</time>
          <strong>${courseData.find(course => course[0] === code)[1]}</strong>
          <small>${code} · ${detail}</small></div>`).join('') : '<p class="week-free">No classes</p>'}</section>`).join('')}</div>`;
}
function schedule(staff=false){
  if(staff)return head('Student schedules','',link('draft-schedule','Create advising draft','btn primary'))+filterbar('Search students',[['All statuses',['Ready for review','Draft','Not started']]])+
    table(['Student','Major','Schedule','Last updated',''],names.map((n,i)=>[`${n}<small>70-${71577+i}</small>`,'Computer Engineering',badge(scheduleStates[i],statusTone(scheduleStates[i])),'Today, 10:42',link('draft-schedule',scheduleStates[i]==='Draft'?'Edit draft':'Review schedule','btn row-control').replace('data-page=',`data-student="${i}" data-page=`)]));
  return head('Weekly schedule','',button('Export calendar','export-calendar'),'')+
    tabs([['week','Week'],['list','Course list']],'week')+(tab==='list'?registeredTable():weekly())+
    '';
}
function workflow(){return `<div class="task"><div><h3>Preferences submitted</h3><p>Student · 12 November</p></div>${badge('Complete')}</div><div class="task"><div><h3>Advisor prepared draft</h3><p>Dr. Salma Adel · 13 November</p></div>${badge('Complete')}</div><div class="task"><div><h3>Coordinator review</h3><p>Check the draft before it goes to the student.</p></div>${badge('Awaiting decision','pending')}</div>`;}
function draft(){return head(`${names[selectedStudent].split(' ')[0]}’s advising draft`, `70-${71577+selectedStudent} · Computer Engineering · Semester 7`,button('Save draft','save-draft')+button('Process schedule','process','btn primary'),'Winter 2026')+
  `<div class="split"><section class="panel"><h2>Selected courses</h2><div class="smallstats"><div><strong>19</strong><span>Credit hours</span></div><div><strong>4</strong><span>Courses selected</span></div><div><strong>0</strong><span>Time conflicts</span></div></div>${courseData.slice(0,4).map(c=>`<div class="task"><div><h3>${c[0]}</h3><p>${c[1]}</p></div><label><span class="sr-only">${c[0]} group</span><select aria-label="${c[0]} group"><option>Group 4</option><option>Group 2</option></select></label></div>`).join('')}</section><aside><section class="note"><div class="kicker">Student preferences</div><h2>Thursday off.</h2><p>Preferred group: 4<br>Earliest class: 08:30<br>Preferences updated 12 November.</p>${link('preferences','View preferences','btn text')}</section><section class="panel" style="margin-top:24px"><h2>Validation</h2><p>No time conflicts. Credit load is within the allowed range.</p></section></aside></div>`+weekly()+`<section class="panel" style="margin-top:24px"><h2>Workflow</h2>${workflow()}${button('Reopen schedule','reopen','btn text')}</section>`;}
function registeredTable(){return table(['Course','Type','Credits','Group',''],courseData.slice(0,4).map(c=>[`<strong>${c[1]}</strong><small>${c[0]}</small>`,'Mandatory',c[3],'4',link('course-detail','View sections','btn row-control')]));}
function registered(){
  const due = [['Assignment due 12 Nov','review'], ['Reading due 10 Nov','ice'], ['Project due 19 Nov',''], ['Quiz on 18 Nov','pending']];
  return head('My courses','4 courses · 19 credit hours',button('Request course removal','request-removal'),'')+
    `<div class="course-list">${courseData.slice(0,4).map(([code,title,,credits], i) =>
      `<article><div><small>${code} · ${credits} credit hours</small><h2>${title}</h2></div>
      <div class="course-due">${badge(...due[i])}${link('course-detail','View sections','btn row-control')}</div></article>`).join('')}</div>`;
}
function assignments(){return head('Group assignments','Assign students to a published schedule group.')+filterbar('Search students',[['All groups',['Group 1','Group 4','Unassigned']]])+
  table(['Student','Major','Semester','Group',''],names.map((n,i)=>[`${n}<small>70-${71577+i}</small>`,'Computer Engineering','7',i%2?badge('Unassigned','pending'):'Group 4',button(i%2?'Assign group':'Reassign','assign-group','btn row-control')]));}
function preferences(){return head('Schedule preferences',student()?'':'Omar Hassan · 70-71577',button('Save preferences','save-preferences','btn primary'),'')+
  `<div class="preferences-grid"><section class="preference-days"><h2>Days off</h2><p>Choose up to two days.</p><div class="day-options">${['Sunday','Monday','Tuesday','Wednesday','Thursday'].map(day=>`<label class="checkrow"><input class="dayoff" type="checkbox" value="${day}" ${preferencesState.days.includes(day)?'checked':''}><span>${day}</span></label>`).join('')}</div><label class="notes-label">Additional notes<textarea id="preference-notes" rows="4" placeholder="Any scheduling constraints for your advisor.">${escapeHtml(preferencesState.notes)}</textarea></label></section><section class="preference-groups"><h2>Course groups</h2><p>Choose a group for each course.</p><div class="formgrid">${courseData.slice(0,4).map((c,i)=>`<label><span><small>${c[0]}</small>${c[1]}</span><select data-course-group="${i}">${['Group 4','Group 2','No preference'].map(g=>`<option ${g===preferencesState.groups[i]?'selected':''}>${g}</option>`).join('')}</select></label>`).join('')}</div></section></div>`;
}

function financial(){return head('Financial records','',button('Export CSV','export-csv'))+`<dl class="ledger-summary">
    <div><dt>Received</dt><dd>EGP 22,500</dd></div>
    <div><dt>Pending</dt><dd>EGP 15,000</dd></div>
    <div><dt>Refunded</dt><dd>EGP 2,500</dd></div>
  </dl>`+
  filterbar('Search name or transaction ID',[['All types',['Payment','Refund']],['All statuses',['Completed','Pending']]])+
  table(['Transaction','Student','Type','Amount','Status',''],names.slice(0,6).map((n,i)=>[`TXN-${1042+i}<small>14 Nov 2026</small>`,`${n}<small>70-${71577+i}</small>`,i===4?'Refund':'Payment',`EGP ${i===4?'2,500':'7,500'}`,badge([1,5].includes(i)?'Pending':'Completed',[1,5].includes(i)?'payment-pending':'payment-complete'),button('View record','financial-detail','btn row-control')]));}
function removals(){return head('Course removals','Review mandatory-course removal requests.',student()?button('Request removal','request-removal','btn primary'):'')+
  tabs([['pending','Pending · 3'],['approved','Approved'],['rejected','Rejected']],'pending')+
  filterbar('Search student or course')+
  table(['Student','Course','Reason','Submitted','Status',''],names.slice(0,3).map((n,i)=>[`${n}<small>70-${71577+i}</small>`,`${courseData[i][0]}<small>${courseData[i][1]}</small>`,['Credit overload','Academic difficulty','Schedule conflict'][i],'13 Nov 2026',badge(tab==='pending'?'Pending':tab==='approved'?'Approved':'Rejected',tab==='pending'?'pending':tab==='rejected'?'review':''),button('Review request','removal-decision','btn row-control','aria-label="Review request"')]));}
function pending(){return head('Pending work','',button('Refresh','refresh'))+
  `<div class="work-links">
    ${link('student-schedules','Review 6 student schedules','btn primary')}
    ${link('mandatory-removals','Decide 3 course removals')}
    ${link('advising','Assign 2 advisors')}
  </div>`+
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
    `<div class="activity-log">${['14 Nov','13 Nov'].map(date=>`<section class="activity-day"><h2>${date}<small>2026</small></h2><ol>${events.filter(e=>e[3]===date).map(([action,name,author,,time,tone],i)=>`<li data-search-row><time>${time}</time>${avatar(name,i)}<div><h3>${name}</h3><p>${action} by ${author}</p></div>${badge(action,tone)}</li>`).join('')}</ol></section>`).join('')}</div><p id="result-count">4 records</p>`;
}

function records(){
  const strip=tabs([['history','Course history'],['transcript','Transcript'],['wallet','Wallet']],'history');
  return head('Academic records','Omar Hassan · 70-71577',tab==='transcript'?button('Download transcript','transcript'): '', 'Computer Engineering')+
    stats([['Cumulative GPA','1.70','Very good standing'],['Completed credits','116','Through semester 6'],['Current semester','07','Winter 2026']])+strip+
    (tab==='wallet'?table(['Date','Transaction','Amount','Balance'],[['14 Nov 2026','Course registration payment','− EGP 7,500','EGP 2,500'],['10 Nov 2026','Wallet deposit','+ EGP 10,000','EGP 10,000']]):table(['Course','Semester','Credits','Grade','Status'],courseData.slice(0,4).map(c=>[`${c[0]}<small>${c[1]}</small>`,'Winter 2025',c[3],'1.7',badge('Passed')])));
}
function advisor(){
  return head('Academic advising','','','')+`
    <div class="advising-layout">
      <section class="advisor-details"><h2>Dr. Salma Adel</h2><p>Computer Engineering</p>
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
function calendarSync(){return head('Calendar sync','Keep your course schedule in your calendar.')+`<section class="panel calendar-connect"><div class="connection"><div><h2>Google Calendar</h2><p>${connected?'Connected as omar.hassan@student.guc.edu.eg':'Connect your Google account to sync course meetings.'}</p></div>${button(connected?'Disconnect':'Connect account', 'toggle-calendar', connected?'btn':'btn primary')}</div><div class="connection"><div><h3>Course schedule</h3><p>Last synced today at 09:15. Times use Africa/Cairo.</p></div>${button('Sync now','sync-now','btn')}</div></section><section class="panel"><h2>Use another calendar</h2><p>Download an .ics file for Apple Calendar, Outlook, or another calendar app.</p><div style="margin-top:20px">${button('Download calendar','export-calendar')}</div></section>`;}
function swap(){return head('Eligible swap groups','Exchange your full schedule with a student taking the same courses.')+`<section class="panel"><div class="section-head"><h2>Your group: 4</h2><span class="count">Swap deadline · 13 December 2026</span></div><p>Computer Engineering · Semester 7 · 19 credit hours</p></section>`+
  tabs([['groups','Available groups'],['open','Open requests'],['mine','My requests']],'groups')+
  (tab==='mine'?table(['From','Requested groups','Submitted','Status',''],[['Group 4','Group 1, Group 2','13 Nov 2026',badge('Open','pending'),button('Withdraw','withdraw','btn text')]]):`<div class="course-options">${[1,2].map((n)=>`<section class="course-option"><div class="kicker">Computer Engineering</div><h2>Group ${n}</h2><p>Same 4 registered courses · 19 credits</p><dl class="details"><div><dt>Days off</dt><dd>${n===1?'Tuesday':'Sunday'}</dd></div><div><dt>Earliest class</dt><dd>${n===1?'10:00':'08:30'}</dd></div></dl><div class="form-footer">${button('View schedule','group-schedule')}${button(tab==='open'?'Exchange schedules':'Request swap',tab==='open'?'exchange':'request-swap','btn primary')}</div></section>`).join('')}</div>`);
}
function auth(){
  const title=page==='login'?'Sign in':page==='forgot'?'Reset your password':'Choose a new password';
  return `<div class="auth"><header class="auth-header">${link('overview','Back to overview','auth-back')}${themeControl()}</header>
    <main class="auth-form" id="content" tabindex="-1"><section class="auth-card">
    ${link('overview','Portal','wordmark')}<h1>${title}</h1>
    ${page==='login'?'':`<p>${page==='forgot'?'We’ll send a reset code to your university email.':'Enter the six-digit code from your email.'}</p>`}
    <form id="auth-form"><label>University email<input type="email" autocomplete="username" placeholder="name@guc.edu.eg" required value="${page==='reset'?'omar.hassan@student.guc.edu.eg':''}"></label>${page==='reset'?'<label>Reset code<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required></label>':''}${page!=='forgot'?`<label>${page==='reset'?'New password':'Password'}<input type="password" autocomplete="${page==='reset'?'new-password':'current-password'}" minlength="8" required placeholder="${page==='reset'?'At least 8 characters':'Enter your password'}"></label>`:''}<button type="submit" class="btn primary">${page==='login'?'Sign in':page==='forgot'?'Send reset code':'Update password'}</button>${link(page==='login'?'forgot':'login',page==='login'?'Forgot password?':'Back to sign in','auth-recovery')}</form><p class="form-note">Design preview · forms use sample data.</p></section></main></div>`;
}
const renderers = {overview,notifications,profile, directory, 'student-detail':()=>profile(true),advising:()=>directory(true),'pending-work':pending,'schedule-activity':activity,'financial-records':financial,'mandatory-removals':removals,'student-schedules':()=>schedule(true),'draft-schedule':draft,courses,'course-detail':courseDetail,terms,offerings,'copy-offerings':copyOfferings,templates,'template-detail':templateDetail,'group-assignments':assignments,'my-schedule':schedule,'my-courses':registered,'schedule-swap':swap,preferences,records,'my-advisor':advisor,'calendar-sync':calendarSync};
function themeControl(){
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<button type="button" class="theme-toggle" data-action="theme" aria-label="${dark?'Switch to light mode':'Switch to dark mode'}" title="${dark?'Light mode':'Dark mode'}"><span class="theme-light">${icon('sun')}</span><span class="theme-dark">${icon('moon')}</span><span class="theme-label sr-only">${dark?'Dark':'Light'}</span></button>`;
}

function accountControls(){
  return `${themeControl()}<a class="icon-button" href="${href('notifications')}" data-page="notifications" aria-label="Notifications" title="Notifications">${icon('bell')}<span class="notification-dot"></span></a>
    <button type="button" class="account-button" popovertarget="account-menu" aria-label="Account menu for ${person()}">${avatar(person())}<span>${person()}</span>${icon('down')}</button>
    <div id="account-menu" popover><div class="account-caption">${roleNames[role]}</div>${link('profile','My profile')}${link('login','Sign out','sign-out')}</div>`;
}

function render(focus=false){
  document.title=`Portal — ${variants[version-1]} · ${pages[page]}`;
  const body=['login','forgot','reset'].includes(page)?auth():`<div class="shell">${sidebar()}<div class="workspace"><header class="topbar">${link('overview','Portal','mobile-nav wordmark')}<span class="term">${pages[page]}<span>Winter 2026 / 2027</span></span><div class="topactions">${button(icon('menu')+'<span class="sr-only">Menu</span>','mobile-menu','mobile-menu')}${accountControls()}</div></header><main class="content" data-screen="${page}" id="content" tabindex="-1">${renderers[page]()}</main></div></div>`;
  app.innerHTML=reviewbar()+body;
  if(focus)document.querySelector('#content').focus({preventScroll:true});
}
function navigate(target){if(dialog.open)dialog.close();page=pages[target]?target:'overview';tab='';history.pushState({},'',href(page));render(true);window.scrollTo(0,0);}
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
    case 'theme': {
      revealTheme(el, () => {
        const dark = document.documentElement.dataset.theme !== 'dark';
        const theme = dark ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('bobos-v7-theme', theme);
        el.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        el.title = dark ? 'Light mode' : 'Dark mode';
        el.querySelector('.theme-label').textContent = dark ? 'Dark' : 'Light';
      });
      break;
    }
    case 'pick-review':selectedStudent=Number(el.dataset.student);render();document.querySelector('.review-pick.selected')?.focus();break;
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
    case 'add-course':case 'edit-course':modal(name==='add-course'?'Add course':'Edit course',fields(`<div class="formgrid"><label>Course code<input required value="${name==='edit-course'?'CSEN 701':''}" placeholder="CSEN 701"></label><label>Credit hours<input type="number" min="1" max="12" required value="5"></label></div><label>Course name<input required value="${name==='edit-course'?'Embedded Systems':''}"></label><label>Department<select><option>Computer Engineering</option><option>Digital Media Engineering</option></select></label>`));break;
    case 'import-csv':modal('Import courses',fields('<label>Course CSV<input type="file" accept=".csv" required></label><p>Columns: code, name, department, credits, season.</p>'),'Preview import');break;
    case 'create-term':case 'manage-term':modal(name==='create-term'?'Create academic term':'Manage Winter 2026',fields('<label>Term name<input required value="Winter 2026"></label><div class="formgrid"><label>Registration opens<input type="date" value="2026-11-22" required></label><label>Registration closes<input type="date" value="2026-12-06" required></label><label>Swap deadline<input type="date" value="2026-12-13" required></label><label>Status<select><option>Active</option><option>Upcoming</option><option>Archived</option></select></label></div>'));break;
    case 'add-offering':modal('Add course offering',fields('<label>Course<select><option>CSEN 701 · Embedded Systems</option><option>CSEN 703 · Algorithms</option></select></label><div class="formgrid"><label>Term<select><option>Winter 2026</option></select></label><label>Number of groups<input type="number" min="1" value="4" required></label></div>'),'Add offering');break;
    case 'manage-sections':modal('CSEN 701 sections',table(['Section','Time','Room'],[['Lecture 1','Sun 08:30','C2.301'],['Tutorial 4','Tue 10:00','C2.204'],['Lab 4','Wed 12:00','C7.102']],false),'Save sections');break;
    case 'copy-confirm':{const count=document.querySelectorAll('table input:checked').length;if(!count){toast('Select at least one offering.');break;}modal('Copy selected offerings?',`<p>${count} offerings will be copied from Winter 2025 to Winter 2026 in this preview. Existing offerings will be kept.</p>`,'Copy offerings');break;}
    case 'publish':modal('Publish this template?','<p>Group 4 will become available for student assignments in this preview.</p>','Publish template');break;
    case 'process':modal('Process Omar’s schedule?','<p>The draft has 19 credit hours and no time conflicts. Processing sends it to the student for review.</p>','Process schedule');break;
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
  const target=event.target.closest('[data-page],[data-action],[data-tab]');if(!target)return;
  if(target.dataset.page){if(target.dataset.student !== undefined)selectedStudent=Number(target.dataset.student);if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(target.dataset.page);}
  else if(target.dataset.tab){tab=target.dataset.tab;render();document.querySelector(`[data-tab="${tab}"]`)?.focus();}
  else action(target.dataset.action,target);
});
document.addEventListener('change',event=>{
  if(event.target.id==='role-select'){role=event.target.value;navigate('overview');}
  else if(event.target.id==='page-select')navigate(event.target.value);
  else if(event.target.matches('[data-appearance]')) {
    const key = event.target.dataset.appearance;
    document.documentElement.dataset[key] = event.target.value;
    localStorage.setItem(`bobos-v7-${key}`, event.target.value);
  } else if(event.target.matches('[data-filter]'))filterRows();
});
document.addEventListener('input',event=>{if(event.target.id==='search')filterRows();if(event.target.id==='page-finder')document.querySelectorAll('.page-results a').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(event.target.value.toLowerCase()));});
document.addEventListener('submit',event=>{
  event.preventDefault();
  if(event.target.id==='auth-form'){
    if(page==='login'){navigate('overview');toast('Signed in to the sample workspace.');}
    else if(page==='forgot'){navigate('reset');toast('Sample reset code: 123456.');}
    else{navigate('login');toast('Password reset preview complete.');}
  }else if(event.target.id==='modal-form'){
    const label=event.submitter?.textContent||'Saved';const close=event.target.dataset.submitAction==='close';closeDialog();if(!close)toast(`${label} — completed in this preview.`);
  }
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDialog();}});
dialog.addEventListener('cancel',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!event.target.closest('input,textarea,select')&&!dialog.open){event.preventDefault();action('quick-find');return;}
  if(event.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const buttons=Array.from(document.querySelectorAll('[role=tab]'));let i=buttons.indexOf(event.target);
  i=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  event.preventDefault();tab=buttons[i].dataset.tab;render();document.querySelector(`[data-tab="${tab}"]`).focus();
});
window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);page=pages[p.get('page')]?p.get('page'):'overview';role=roleNames[p.get('role')]?p.get('role'):'coordinator';tab='';render(true);});
render();
