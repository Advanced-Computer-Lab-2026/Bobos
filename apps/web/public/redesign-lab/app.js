'use strict';
// Review-only prototypes. All records and state stay in this page; no API calls.
const version = Number(document.body.dataset.version);
const variants = ['Quiet', 'Editorial', 'Studio', 'Clay', 'Contrast'];
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
let readAll = false;
let connected = true;
let toastTimer;
let returnFocus;
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const student = () => ['normalStudent','advisingStudent'].includes(role);
const person = () => student() ? 'Omar Hassan' : role === 'advisor' ? 'Dr. Salma Adel' : role === 'administrator' ? 'Youssef Ali' : 'Nadia Ahmed';
const href = target => `?page=${target}&role=${role}`;
const link = (target, text, cls='') => `<a class="${cls}" href="${href(target)}" data-page="${target}">${text}</a>`;
const button = (text, action, cls='btn', extra='') => `<button class="${cls}" type="button" data-action="${action}" ${extra}>${text}</button>`;
const badge = (text, tone='') => `<span class="badge ${tone}">${text}</span>`;
const names = ['Omar Hassan','Mariam Mostafa','Ahmed Khaled','Farah Mahmoud','Youssef Tarek','Laila Amr'];
const courseData = [
  ['CSEN 701','Embedded Systems','Computer Engineering','5','Winter'],
  ['CSEN 703','Analysis & Design of Algorithms','Computer Engineering','5','Winter'],
  ['CSEN 704','Advanced Computer Lab','Computer Engineering','4','Winter'],
  ['DMET 701','Computer Graphics','Digital Media Engineering','5','Winter'],
  ['ELCT 701','Communication Systems','Electronics Engineering','5','Winter'],
  ['MATH 701','Numerical Analysis','Mathematics','4','Winter']
];
function reviewbar(){
  return `<div class="reviewbar" aria-label="Design preview controls"><div class="review-label"><a href="compare.html"><strong>Design studies</strong></a><span>Sample data</span></div><nav class="versions" aria-label="Design versions">${variants.map((name,i)=>`<a href="${String(i+1).padStart(2,'0')}-${name.toLowerCase()}.html${href(page)}" ${version===i+1?'aria-current="page"':''}>${String(i+1).padStart(2,'0')} ${name}</a>`).join('')}</nav><div class="review-selects"><select aria-label="Preview role" id="role-select">${Object.entries(roleNames).map(([key,name])=>`<option value="${key}" ${role===key?'selected':''}>${name}</option>`).join('')}</select><select aria-label="Preview any page" id="page-select">${Object.entries(pages).map(([key,title])=>`<option value="${key}" ${page===key?'selected':''}>${title}</option>`).join('')}</select></div></div>`;
}
function groups(){
  const common = [['Workspace',['overview','notifications']]];
  if(student()) return [...common,['My studies', [...(role==='advisingStudent'?['records','preferences']:[]),'my-schedule','my-courses',...(role==='normalStudent'?['schedule-swap']:[]),'my-advisor','calendar-sync']]];
  return [...common,['People',[
    ...(['coordinator','administrator'].includes(role)?['directory','financial-records']:[]),
    ...(['coordinator','advisor'].includes(role)?['advising','preferences']:[]),
    ...(role==='coordinator'?['pending-work']:[]),
    ...(['coordinator','administrator'].includes(role)?['schedule-activity']:[]),
    'mandatory-removals','student-schedules']],
    ...(['coordinator','administrator'].includes(role)?[['Academic setup',['courses','terms',...(role==='administrator'?['offerings']:['templates']),'group-assignments']]]:[])];
}
function sidebar(){
  const parent = {'student-detail':'directory','draft-schedule':'student-schedules','course-detail':'courses','copy-offerings':'offerings','template-detail':'templates'};
  return `<aside class="sidebar">${link('overview','bobos','wordmark')}<nav aria-label="Main navigation">${groups().map(([name,items])=>`<div class="navgroup"><p class="navlabel">${name}</p>${items.map(id=>link(id,pages[id],`navlink ${page===id||parent[page]===id?'active':''}`)).join('')}</div>`).join('')}</nav><div class="side-account">${link('profile',person())}<p>${roleNames[role]}</p></div></aside>`;
}
function head(title, subtitle='', action='', kicker='Winter 2026'){
  return `<div class="page-head"><div>${kicker?`<div class="kicker">${kicker}</div>`:''}<h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action?`<div class="actions">${action}</div>`:''}</div>`;
}
function stats(items){return `<div class="stats">${items.map(([label,value,foot])=>`<div class="stat"><span>${label}</span><strong>${value}</strong><small>${foot}</small></div>`).join('')}</div>`;}
function table(headers,rows,search=true){return `<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr ${search?'data-search-row':''}>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="tablefoot"><span id="result-count">${rows.length} records</span><span>Sample data</span></div>`;}
function filterbar(placeholder,options=[],action=''){
  return `<div class="toolbar"><div class="filters"><input aria-label="${placeholder}" placeholder="${placeholder}" id="search" type="search">${options.map(([label,values])=>`<select aria-label="${label}" data-filter><option value="">${label}</option>${values.map(value=>`<option>${value}</option>`).join('')}</select>`).join('')}</div>${action?`<div class="actions">${action}</div>`:''}</div>`;
}
function tabs(items,defaultTab){
  if(!items.some(([id])=>id===tab)) tab=defaultTab||items[0][0];
  return `<div class="tabs" role="tablist">${items.map(([id,title])=>`<button type="button" role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-tab="${id}">${title}</button>`).join('')}</div>`;
}
function overview(){
  const isStudent=student();
  const tasks = isStudent ? [
    ['Course selection','Review your draft schedule','18 credit hours · prepared by Dr. Salma Adel','my-schedule','Review schedule'],
    ['Before 18 November','Set your scheduling preferences','Choose the days and course groups that suit you.','preferences','Set preferences'],
    ['Advising','Meet your academic advisor','Dr. Salma Adel · Computer Engineering','my-advisor','View advisor']
  ] : [
    ['Awaiting your review','Student schedules','6 drafts are ready for coordinator review.','student-schedules','Review drafts'],
    ['Decision needed','Course removal requests','3 requests are waiting for a decision.','mandatory-removals','View requests'],
    ['Academic setup','Winter course offerings','Review sections before the next registration window.','courses','View courses']
  ];
  return head(`Good day, ${person().split(' ')[0]}.`,isStudent?'Your semester, at a glance.':'Here’s what needs your attention.',link(isStudent?'my-schedule':'pending-work',isStudent?'My schedule':'View pending work','btn'))+
    `<div class="context-strip"><span>Winter 2026</span><span>${isStudent?'Computer Engineering · Semester 7':'Registration opens 22 November'}</span></div>`+
    stats(isStudent?[['Registered credits','18','4 courses this semester'],['Current semester','07','Computer Engineering'],['Cumulative GPA','1.70','Very good standing']]:[['Schedules to review','06','Ready for your decision'],['Open requests','03','Mandatory-course removals'],['Unassigned students','12','Need a schedule group']])+
    `<div class="overview-grid"><section><div class="section-head"><h2>${isStudent?'This semester':'Your next steps'}</h2><span class="count">${tasks.length} items</span></div>${tasks.map(([meta,title,desc,target,cta])=>`<article class="task"><div><span class="task-meta">${meta}</span><h3>${title}</h3><p>${desc}</p></div>${link(target,cta)}</article>`).join('')}</section><aside><section class="note"><div class="kicker">${isStudent?'Your schedule':'Registration opens'}</div><h2>${isStudent?'Thursday off.':'22 November.'}</h2><p>${isStudent?'Your draft has 4 courses across 4 days.':'Registration closes 6 December.<br>Schedule swaps close 13 December.'}</p>${link(isStudent?'my-schedule':'terms',isStudent?'Review your week':'Manage academic term','btn')}</section><section class="recent"><div class="section-head"><h2>Recent activity</h2></div><div class="event">${isStudent?'Your advisor updated your draft schedule.':'Mariam Mostafa submitted her preferences.'}<time>Today, 10:42</time></div><div class="event">${isStudent?'Winter 2026 registration dates published.':'Group 4 was published for Computer Engineering.'}<time>Today, 09:15</time></div></section></aside></div>`;
}
function directory(advising=false){
  return head(advising?'Advising students':'Student directory',advising?'Review assignments, preferences, and schedules.':'Find a student and open their academic details.',advising?button('Assign advisor','assign-advisor','btn primary'):'')+
    filterbar('Search by name or student ID', [['All majors',['Computer Engineering','Digital Media Engineering']],['All statuses',['Ready for review','Draft','Not started']]])+
    table(['Student','Major','Semester',advising?'Advisor':'Type','Schedule',''],names.map((name,i)=>[
      `<strong>${name}</strong><small>70-${71577+i}</small>`,i===3?'Digital Media Engineering':'Computer Engineering','7',advising?(i%2?'Dr. Salma Adel':'Unassigned'):(i%3?'Advising':'Normal'),badge(['Ready for review','Draft','Not started'][i%3],['','pending','neutral'][i%3]),link('student-detail','View student','rowlink')
    ]));
}
function profile(detail=false){
  const name=detail?'Omar Hassan':person();
  return head(detail?'Student details':'My profile', '',detail?link('directory','Back to directory','btn'):'',detail?'70-71577':'Account')+
    `<div class="person-title"><div class="monogram" aria-hidden="true">${name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><h2>${name}</h2><p>${detail?'Advising student · Computer Engineering':roleNames[role]}</p></div></div>`+
    (detail?tabs([['details','Academic details'],['history','Advisor history'],['workflow','Schedule workflow']]):'')+
    (detail&&tab==='history'?table(['Advisor','Assigned','Status'],[['Dr. Salma Adel','5 October 2026',badge('Current')],['Dr. Hany Youssef','10 February 2026',badge('Ended','neutral')]]):detail&&tab==='workflow'?`<section class="panel"><h2>Schedule workflow</h2>${workflow()}${link('draft-schedule','Open advising draft','btn primary')}</section>`:
    `<section class="panel"><h2>${detail?'Academic information':'Account details'}</h2><dl class="details">${[
      ['Full name',name],['University email',detail?'omar.hassan@student.guc.edu.eg':student()?'omar.hassan@student.guc.edu.eg':'nadia.ahmed@guc.edu.eg'],
      ['Role',detail?'Advising student':roleNames[role]],...(detail||student()?[['Student ID','70-71577'],['Major','Computer Engineering'],['Semester','7'],['Academic standing','Very good'],['Assigned advisor','Dr. Salma Adel'],['Schedule status','Ready for review'],['Enrollment','Active']]:[['Department','Faculty of Media Engineering & Technology']])
    ].map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl></section>`)+
    (detail?`<div class="actions">${link('preferences','View preferences','btn')}${link('draft-schedule','Open schedule','btn primary')}${button('Assign advisor','assign-advisor')}</div>`:'');
}
function notifications(){
  const strip=tabs([['all','All notifications'],['unread','Unread']],'all');
  const entries=[...Array.from({length:testCount},()=>['Test notification','This is a test notification for your account.','Just now']),['Schedule ready for review','Omar Hassan’s advising schedule is ready for your review.','Today, 10:42'],['Course removal requested','Mariam Mostafa requested removal of CSEN 701.','Today, 09:30'],['Winter 2026 dates updated','The registration window opens on 22 November.','Yesterday']];
  return head('Notifications','',button('Create test notification','test-notification','btn primary')+button('Refresh','refresh'), 'Inbox')+strip+
    `<div class="toolbar"><span class="count">${readAll?'No unread notifications':`${entries.length} notifications`}</span>${button('Mark all as read','read-all','btn text')}</div>`+
    (tab==='unread'&&readAll?`<div class="empty"><h2>You’re all caught up.</h2><p>No unread notifications.</p></div>`:entries.map(([title,text,time])=>`<article class="inbox-item ${readAll?'':'unread'}"><div class="inbox-text"><h3>${title}</h3><p>${text}</p></div><time>${time}</time>${button(readAll?'Read':'Mark as read','read-one','btn text')}</article>`).join(''));
}
function courses(){return head('Course catalogue','',button('Add course','add-course','btn primary')+button('Import CSV','import-csv'))+
  filterbar('Search courses',[['All departments',['Computer Engineering','Digital Media Engineering','Electronics Engineering']],['All seasons',['Winter','Spring']]])+
  table(['Code','Course','Department','Credits','Season',''],courseData.map(c=>[c[0],`<strong>${c[1]}</strong>`,...c.slice(2),link('course-detail','View course','rowlink')]));}
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
  table(['Template','Major','Semester','Courses','Status',''],['Group 1','Group 2','Group 3','Group 4'].map((g,i)=>[`${g} · Winter 2026`,'Computer Engineering','7','4',badge(i===3?'Draft':'Published',i===3?'pending':''),link('template-detail','Edit template','rowlink')]));}
function templateDetail(){return head('Group 4','Computer Engineering · Semester 7',button('Publish template','publish','btn primary')+button('Save draft','save-draft'), 'Template editor')+
  `<section class="panel"><div class="formgrid"><label>Group name<input value="Group 4" required></label><label>Major<select><option>Computer Engineering</option><option>Digital Media Engineering</option></select></label><label>Semester<input type="number" min="1" max="10" value="7"></label><label>Term<select><option>Winter 2026</option></select></label></div></section>`+
  `<div class="section-head"><h2>Course groups</h2>${button('Add course','add-offering','btn text')}</div>`+table(['Course','Lecture','Tutorial','Lab'],courseData.slice(0,4).map(c=>[`${c[0]}<small>${c[1]}</small>`,'L1 · Sun 08:30','T4 · Tue 10:00','P4 · Wed 12:00']))+`<div style="margin-top:30px">${weekly()}</div>`;}
function weekly(){
  const slots=[
    ['08:30',['CSEN 701','Lecture · C2.301',''],null,['CSEN 703','Lecture · C3.202','cherry'],null,null],
    ['10:00',null,['CSEN 704','Lab · C7.102','clay'],['CSEN 701','Tutorial · C2.204',''],null,null],
    ['12:00',['CSEN 703','Tutorial · C3.104','cherry'],null,null,['DMET 701','Lecture · C1.201','clay'],null],
    ['14:00',null,null,['CSEN 704','Lecture · C7.301','clay'],null,null]
  ];
  return `<div class="schedule-scroll"><div class="calendar" role="table" aria-label="Weekly course schedule"><div class="day" role="columnheader">Time</div>${['Sunday','Monday','Tuesday','Wednesday','Thursday'].map(d=>`<div class="day" role="columnheader">${d}</div>`).join('')}${slots.map(([time,...days])=>`<div class="time" role="rowheader">${time}</div>${days.map(s=>`<div role="cell">${s?`<div class="lesson ${s[2]}"><strong>${s[0]}</strong><small>${s[1]}</small></div>`:''}</div>`).join('')}`).join('')}</div></div>`;
}
function schedule(staff=false){
  if(staff)return head('Student schedules','',link('draft-schedule','Create advising draft','btn primary'))+filterbar('Search students',[['All statuses',['Ready for review','Draft','Not started']]])+
    table(['Student','Major','Schedule','Last updated',''],names.map((n,i)=>[`${n}<small>70-${71577+i}</small>`,'Computer Engineering',badge(i%2?'Draft':'Ready for review',i%2?'pending':''),'Today, 10:42',link('draft-schedule',i%2?'Edit draft':'Review schedule','rowlink')]));
  return head('My schedule','Group 4 · Computer Engineering · 18 credit hours',button('Export calendar','export-calendar'))+
    tabs([['week','Weekly schedule'],['list','Course list']],'week')+(tab==='list'?registeredTable():weekly())+
    `<p class="sample-note">All times are shown in Cairo time.</p>`;
}
function workflow(){return `<div class="task"><div><h3>Preferences submitted</h3><p>Student · 12 November</p></div>${badge('Complete')}</div><div class="task"><div><h3>Advisor prepared draft</h3><p>Dr. Salma Adel · 13 November</p></div>${badge('Complete')}</div><div class="task"><div><h3>Coordinator review</h3><p>Check the draft before it goes to the student.</p></div>${badge('Awaiting decision','pending')}</div>`;}
function draft(){return head('Omar’s advising draft','70-71577 · Computer Engineering · Semester 7',button('Save draft','save-draft')+button('Process schedule','process','btn primary'),'Winter 2026')+
  `<div class="split"><section class="panel"><h2>Selected courses</h2><div class="smallstats"><div><strong>18</strong><span>Credit hours</span></div><div><strong>4</strong><span>Courses selected</span></div><div><strong>0</strong><span>Time conflicts</span></div></div>${courseData.slice(0,4).map(c=>`<div class="task"><div><h3>${c[0]}</h3><p>${c[1]}</p></div><label><span class="sr-only">${c[0]} group</span><select aria-label="${c[0]} group"><option>Group 4</option><option>Group 2</option></select></label></div>`).join('')}</section><aside><section class="note"><div class="kicker">Student preferences</div><h2>Thursday off.</h2><p>Preferred group: 4<br>Earliest class: 08:30<br>Preferences updated 12 November.</p>${link('preferences','View preferences','btn text')}</section><section class="panel" style="margin-top:24px"><h2>Validation</h2><p>No time conflicts. Credit load is within the allowed range.</p></section></aside></div>`+weekly()+`<section class="panel" style="margin-top:24px"><h2>Workflow</h2>${workflow()}${button('Reopen schedule','reopen','btn text')}</section>`;}
function registeredTable(){return table(['Course','Type','Credits','Group',''],courseData.slice(0,4).map(c=>[`${c[0]}<small>${c[1]}</small>`,'Mandatory',c[3],'4',link('course-detail','View sections','rowlink')]));}
function registered(){return head('Registered courses','4 courses · 18 credit hours',button('Request course removal','request-removal'))+registeredTable();}
function assignments(){return head('Group assignments','Assign students to a published schedule group.')+filterbar('Search students',[['All groups',['Group 1','Group 4','Unassigned']]])+
  table(['Student','Major','Semester','Group',''],names.map((n,i)=>[`${n}<small>70-${71577+i}</small>`,'Computer Engineering','7',i%2?badge('Unassigned','pending'):'Group 4',button(i%2?'Assign group':'Reassign','assign-group','btn text')]));}
function preferences(){return head('Schedule preferences',student()?'Choose the days and groups that work for you.':'Omar Hassan · 70-71577',button('Save preferences','save-preferences','btn primary'))+
  `<div class="preferences-grid"><section class="panel"><h2>Days off</h2><p>Choose up to two preferred days.</p>${['Sunday','Monday','Tuesday','Wednesday','Thursday'].map(day=>`<label class="checkrow"><input class="dayoff" type="checkbox" ${day==='Thursday'?'checked':''}>${day}</label>`).join('')}</section><section class="panel"><h2>Course groups</h2><div class="formgrid" style="grid-template-columns:1fr">${courseData.slice(0,4).map(c=>`<label>${c[0]} · ${c[1]}<select><option>Group 4</option><option>Group 2</option><option>No preference</option></select></label>`).join('')}</div></section></div><section class="panel"><label>Additional notes<textarea rows="3" placeholder="Any scheduling constraints your advisor should know about.">I would prefer to keep Thursday free.</textarea></label></section>`;}
function financial(){return head('Financial records','',button('Export CSV','export-csv'))+'<div class="currency">'+stats([['Total received','EGP 42,500','Across 6 transactions'],['Pending payments','EGP 7,500','2 outstanding transactions'],['Refunds','EGP 2,500','1 processed refund']])+'</div>'+
  filterbar('Search student or transaction',[['All types',['Payment','Refund']],['All statuses',['Completed','Pending']]])+
  table(['Transaction','Student','Type','Amount','Status',''],names.map((n,i)=>[`TXN-${1042+i}<small>14 Nov 2026</small>`,`${n}<small>70-${71577+i}</small>`,i===4?'Refund':'Payment',`EGP ${i===4?'2,500':'7,500'}`,badge(i%3===1?'Pending':'Completed',i%3===1?'pending':''),button('View record','financial-detail','btn text')]));}
function removals(){return head('Course removals','Review mandatory-course removal requests.',student()?button('Request removal','request-removal','btn primary'):'')+
  tabs([['pending','Pending · 3'],['approved','Approved'],['rejected','Rejected']],'pending')+
  filterbar('Search student or course')+
  table(['Student','Course','Reason','Submitted','Status',''],names.slice(0,3).map((n,i)=>[`${n}<small>70-${71577+i}</small>`,`${courseData[i][0]}<small>${courseData[i][1]}</small>`,['Credit overload','Academic difficulty','Schedule conflict'][i],'13 Nov 2026',badge(tab==='pending'?'Pending':tab==='approved'?'Approved':'Rejected',tab==='pending'?'pending':tab==='rejected'?'review':''),button('Review request','removal-decision','btn text')]));}
function pending(){return head('Pending work','',button('Refresh','refresh'))+stats([['Schedules','06','Ready for review'],['Course removals','03','Waiting for a decision'],['Advisor assignments','02','Students without an advisor']])+
  table(['Work item','Student','Waiting since','Priority',''],[
    ['Review advising schedule','Omar Hassan','13 Nov 2026',badge('Review','pending'),link('draft-schedule','Open draft','rowlink')],
    ['Decide course removal','Mariam Mostafa','13 Nov 2026',badge('Decision','review'),link('mandatory-removals','Review request','rowlink')],
    ['Assign advisor','Ahmed Khaled','12 Nov 2026',badge('Assignment','neutral'),button('Assign advisor','assign-advisor','btn text')],
    ['Review advising schedule','Farah Mahmoud','12 Nov 2026',badge('Review','pending'),link('draft-schedule','Open draft','rowlink')]
  ]);}
function activity(){return head('Schedule activity','A history of schedule changes and decisions.')+filterbar('Search activity',[['All actions',['Draft saved','Schedule processed','Schedule reopened']]])+
  table(['Action','Student','Changed by','When'],[['Draft saved','Omar Hassan','Dr. Salma Adel','14 Nov 2026, 10:42'],['Schedule processed','Mariam Mostafa','Nadia Ahmed','14 Nov 2026, 09:15'],['Schedule reopened','Ahmed Khaled','Nadia Ahmed','13 Nov 2026, 14:30'],['Draft saved','Farah Mahmoud','Dr. Salma Adel','13 Nov 2026, 11:00']]);}
function records(){
  const strip=tabs([['history','Course history'],['transcript','Transcript'],['wallet','Wallet']],'history');
  return head('Academic records','Omar Hassan · 70-71577',tab==='transcript'?button('Download transcript','transcript'): '', 'Computer Engineering')+
    stats([['Cumulative GPA','1.70','Very good standing'],['Completed credits','116','Through semester 6'],['Current semester','07','Winter 2026']])+strip+
    (tab==='wallet'?table(['Date','Transaction','Amount','Balance'],[['14 Nov 2026','Course registration payment','− EGP 7,500','EGP 2,500'],['10 Nov 2026','Wallet deposit','+ EGP 10,000','EGP 10,000']]):table(['Course','Semester','Credits','Grade','Status'],courseData.slice(0,4).map(c=>[`${c[0]}<small>${c[1]}</small>`,'Winter 2025',c[3],'1.7',badge('Passed')])));
}
function advisor(){return head('My advisor','', '', 'Advising')+`<div class="split"><section class="panel"><div class="person-title"><div class="monogram">SA</div><div><h2>Dr. Salma Adel</h2><p>Computer Engineering</p></div></div><dl class="details"><div><dt>Email</dt><dd><a href="mailto:salma.adel@guc.edu.eg">salma.adel@guc.edu.eg</a></dd></div><div><dt>Office</dt><dd>C3.204</dd></div><div><dt>Office hours</dt><dd>Tuesday, 12:00 – 14:00</dd></div><div><dt>Assigned since</dt><dd>5 October 2026</dd></div></dl></section><section class="note"><div class="kicker">Next step</div><h2>Your draft is ready.</h2><p>Review your course selections and schedule before confirming with your advisor.</p>${link('my-schedule','Review schedule','btn')}</section></div>`;}
function calendarSync(){return head('Calendar sync','Keep your course schedule in your calendar.')+`<section class="panel"><div class="connection"><div><h2 style="margin-bottom:6px">Google Calendar</h2><p>${connected?'Connected as omar.hassan@student.guc.edu.eg':'Connect your Google account to sync course meetings.'}</p></div>${button(connected?'Disconnect':'Connect account', 'toggle-calendar', connected?'btn':'btn primary')}</div><div class="connection"><div><h3>Course schedule</h3><p>Last synced today at 09:15. Times use Africa/Cairo.</p></div>${button('Sync now','sync-now','btn')}</div></section><section class="panel"><h2>Use another calendar</h2><p>Download an .ics file for Apple Calendar, Outlook, or another calendar app.</p><div style="margin-top:20px">${button('Download calendar','export-calendar')}</div></section>`;}
function swap(){return head('Eligible swap groups','Exchange your full schedule with a student taking the same courses.')+`<section class="panel"><div class="section-head"><h2>Your group: 4</h2><span class="count">Swap deadline · 13 December 2026</span></div><p>Computer Engineering · Semester 7 · 18 credit hours</p></section>`+
  tabs([['groups','Available groups'],['open','Open requests'],['mine','My requests']],'groups')+
  (tab==='mine'?table(['From','Requested groups','Submitted','Status',''],[['Group 4','Group 1, Group 2','13 Nov 2026',badge('Open','pending'),button('Withdraw','withdraw','btn text')]]):`<div class="course-options">${[1,2].map((n)=>`<section class="course-option"><div class="kicker">Computer Engineering</div><h2>Group ${n}</h2><p>Same 4 registered courses · 18 credits</p><dl class="details"><div><dt>Days off</dt><dd>${n===1?'Tuesday':'Sunday'}</dd></div><div><dt>Earliest class</dt><dd>${n===1?'10:00':'08:30'}</dd></div></dl><div class="form-footer">${button('View schedule','group-schedule')}${button(tab==='open'?'Exchange schedules':'Request swap',tab==='open'?'exchange':'request-swap','btn primary')}</div></section>`).join('')}</div>`);
}
function auth(){
  const title=page==='login'?'Welcome back.':page==='forgot'?'Reset your password.':'Check your inbox.';
  return `<div class="auth"><section class="auth-intro">${link('overview','bobos','wordmark')}<div class="auth-copy"><h1>A clearer<br>semester starts here.</h1><p>Your courses, schedule, and advising.<br>In one quiet place.</p></div><footer>German University in Cairo</footer></section><main class="auth-form" id="content" tabindex="-1"><section class="auth-card"><h1>${title}</h1><p>${page==='login'?'Sign in with your university account.':page==='forgot'?'We’ll send a reset code to your university email.':'Enter the six-digit code and choose a new password.'}</p><form id="auth-form"><label>University email<input type="email" autocomplete="username" placeholder="name@guc.edu.eg" required value="${page==='reset'?'omar.hassan@student.guc.edu.eg':''}"></label>${page==='reset'?'<label>Reset code<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required></label>':''}${page!=='forgot'?`<label>${page==='reset'?'New password':'Password'}<input type="password" autocomplete="${page==='reset'?'new-password':'current-password'}" minlength="8" required placeholder="${page==='reset'?'At least 8 characters':'Enter your password'}"></label>`:''}<button type="submit" class="btn primary">${page==='login'?'Sign in':page==='forgot'?'Send reset code':'Update password'}</button>${link(page==='login'?'forgot':'login',page==='login'?'Forgot password?':'Back to sign in','btn text')}</form><p class="form-note">Design preview · forms use sample data.</p></section></main></div>`;
}
const renderers = {overview,notifications,profile, directory, 'student-detail':()=>profile(true),advising:()=>directory(true),'pending-work':pending,'schedule-activity':activity,'financial-records':financial,'mandatory-removals':removals,'student-schedules':()=>schedule(true),'draft-schedule':draft,courses,'course-detail':courseDetail,terms,offerings,'copy-offerings':copyOfferings,templates,'template-detail':templateDetail,'group-assignments':assignments,'my-schedule':schedule,'my-courses':registered,'schedule-swap':swap,preferences,records,'my-advisor':advisor,'calendar-sync':calendarSync};
function render(focus=false){
  document.title=`bobos — ${variants[version-1]} · ${pages[page]}`;
  const body=['login','forgot','reset'].includes(page)?auth():`<div class="shell">${sidebar()}<div class="workspace"><header class="topbar">${link('overview','bobos','mobile-nav')}<span class="term">Winter 2026 / 2027</span><div class="topactions">${button('Menu','mobile-menu','mobile-menu')}${link('notifications','Notifications')}${link('profile',person(),'profile-link')}${link('login','Sign out')}</div></header><main class="content" id="content" tabindex="-1">${renderers[page]()}<p class="sample-note">Design study ${String(version).padStart(2,'0')} · Sample data</p></main></div></div>`;
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
  const result=document.querySelector('#result-count');if(result)result.textContent=`${count} records`;
}
function action(name,el){
  switch(name){
    case 'mobile-menu':modal('Navigation',`<nav aria-label="Mobile navigation">${groups().map(([name,items])=>`<div class="navgroup"><p class="navlabel">${name}</p>${items.map(id=>link(id,pages[id],`navlink ${id===page?'active':''}`)).join('')}</div>`).join('')}${link('profile','My profile','navlink')}</nav>`,'Close','close');break;
    case 'test-notification':testCount++;render();toast('Test notification created in this preview.');break;
    case 'refresh':toast('Preview refreshed.');break;
    case 'read-all':readAll=true;render();toast('All notifications marked as read.');break;
    case 'read-one':el.closest('.inbox-item').classList.remove('unread');el.textContent='Read';el.disabled=true;break;
    case 'close-dialog':closeDialog();break;
    case 'save-draft':toast('Draft saved in this preview.');break;
    case 'save-preferences':if(document.querySelectorAll('.dayoff:checked').length>2)toast('Choose up to two preferred days.');else toast('Preferences saved in this preview.');break;
    case 'toggle-calendar':connected=!connected;render();toast(connected?'Sample calendar connected.':'Sample calendar disconnected.');break;
    case 'sync-now':toast(connected?'Sample schedule synced.':'Connect your calendar first.');break;
    case 'export-csv':download('sample-financial-records.csv','Transaction,Student,Amount,Status\nTXN-1042,Omar Hassan,7500,Completed\nTXN-1043,Mariam Mostafa,7500,Pending','text/csv');break;
    case 'export-calendar':download('sample-schedule.ics','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//bobos//Design Preview//EN\r\nBEGIN:VEVENT\r\nUID:sample-csen701@bobos\r\nDTSTAMP:20261114T080000Z\r\nDTSTART:20261115T063000Z\r\nDTEND:20261115T080000Z\r\nSUMMARY:CSEN 701 - Embedded Systems (sample)\r\nLOCATION:C2.301\r\nEND:VEVENT\r\nEND:VCALENDAR','text/calendar');break;
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
    case 'process':modal('Process Omar’s schedule?','<p>The draft has 18 credit hours and no time conflicts. Processing sends it to the student for review.</p>','Process schedule');break;
    case 'reopen':modal('Reopen this schedule?',fields('<label>Reason<textarea required rows="3" placeholder="Explain why the schedule needs another review."></textarea></label>'),'Reopen schedule');break;
    case 'financial-detail':modal('Transaction TXN-1042',`<dl class="details"><div><dt>Student</dt><dd>Omar Hassan</dd></div><div><dt>Date</dt><dd>14 Nov 2026</dd></div><div><dt>Type</dt><dd>Course payment</dd></div><div><dt>Amount</dt><dd>EGP 7,500</dd></div></dl><div style="margin-top:24px">${button('Refund transaction','refund','btn danger')}</div>`,'Close','close');break;
    case 'refund':dialog.close();modal('Refund this transaction?',fields('<p>EGP 7,500 will be returned to the student’s wallet in this preview.</p><label>Refund reason<textarea required rows="3"></textarea></label>'),'Confirm refund');break;
    case 'removal-decision':modal('CSEN 701 removal request',`<p>Omar Hassan · 70-71577<br>Reason: credit overload.<br>Removing this course reduces the semester load from 18 to 13 credits.</p>`+fields('<label>Decision<select><option>Approve removal</option><option>Reject request</option></select></label><label>Decision note<textarea required rows="3" placeholder="Explain the decision to the student."></textarea></label>'),'Submit decision');break;
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
  if(target.dataset.page){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(target.dataset.page);}
  else if(target.dataset.tab){tab=target.dataset.tab;render();document.querySelector(`[data-tab="${tab}"]`)?.focus();}
  else action(target.dataset.action,target);
});
document.addEventListener('change',event=>{
  if(event.target.id==='role-select'){role=event.target.value;navigate('overview');}
  else if(event.target.id==='page-select')navigate(event.target.value);
  else if(event.target.matches('[data-filter]'))filterRows();
});
document.addEventListener('input',event=>{if(event.target.id==='search')filterRows();});
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
  if(event.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const buttons=Array.from(document.querySelectorAll('[role=tab]'));let i=buttons.indexOf(event.target);
  i=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  event.preventDefault();tab=buttons[i].dataset.tab;render();document.querySelector(`[data-tab="${tab}"]`).focus();
});
window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search);page=pages[p.get('page')]?p.get('page'):'overview';role=roleNames[p.get('role')]?p.get('role'):'coordinator';tab='';render(true);});
render();
