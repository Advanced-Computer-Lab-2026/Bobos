'use strict';
// Portal Studio with authenticated calendar and student service integrations.
const workspaceSessionKey = 'bobos.token';
function normalizePortalLocation() {
  const url = new URL(location.href);
  const accountRole = localStorage.getItem(workspaceSessionKey) && localStorage.getItem('portal-account-role');
  if (accountRole) url.searchParams.set('role', accountRole);
  BobosPortalRoutes.normalize(url.searchParams);
  if (url.href !== location.href) history.replaceState(history.state, '', url);
  return url.searchParams;
}
const params = normalizePortalLocation();
const pages = {
  'academic-services':'Academic services', 'graduation-plans':'Graduation plans', 'my-submitted-plans':'My submitted plans', overview:'Home', notifications:'Notifications', profile:'My profile',
  directory:'Student directory', 'extra-hours':'Extra-hours requests', advising:'Advising students',
  'pending-work':'Pending work', 'schedule-activity':'Schedule activity', 'slot-changes':'Slot change requests',
  'financial-records':'Financial records', 'mandatory-removals':'Course removals',
  'student-schedules':'Student schedules', 'draft-schedule':'Advising draft',
  courses:'Course catalogue', 'course-detail':'Course details', terms:'Academic terms',
  offerings:'Course offerings', 'copy-offerings':'Copy offerings', templates:'Schedule templates',
  'group-assignments':'Group assignments',
  'my-schedule':'My schedule', 'my-courses':'Registered courses',
  'schedule-swap':'Eligible swap groups', preferences:'Schedule preferences',
  records:'Academic records', 'my-advisor':'My advisor', 'calendar-sync':'Calendar sync',
  login:'Sign in', forgot:'Forgot password', reset:'Reset password'
};
const roleNames = {coordinator:'Coordinator', administrator:'Administrator', advisor:'Advisor', advisingStudent:'Advising student', normalStudent:'Normal student'};
const authPages = new Set(['login','forgot','reset']);
const previewSessionKey = 'portal-studio-preview-session';
const workspaceAccountNameKey = 'portal-account-name';
let liveStudent = { token: null, loading: false, error: '', data: null };
let liveProfile;
let liveInbox;
let coordinatorSchedules;
let liveAdvisor;
const previewEmail = 'demo@portal.test';
const signedIn = () => Boolean(localStorage.getItem(workspaceSessionKey));
const pageKey = key => Object.hasOwn(pages,key) ? key : 'overview';
const returnPage = key => {
  const query = new URLSearchParams({page:key || 'overview'});
  BobosPortalRoutes.normalize(query);
  const target = query.get('page');
  return authPages.has(target) ? 'overview' : pageKey(target);
};
let returnAfterSignIn = returnPage(params.get('next'));

let role = Object.hasOwn(roleNames,params.get('role')) ? params.get('role') : 'coordinator';
let page = pageKey(params.get('page'));
let tab = '';
async function accountRequest(path, token, method = 'GET') {
  const response = await fetch('../api/' + path, {method, headers:{Authorization:'Bearer ' + token}});
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || 'Could not load your account data.'), {status: response.status});
  return data;
}

function loadAccountData(refresh) {
  const token = localStorage.getItem(workspaceSessionKey);
  if (!token || authPages.has(page)) { liveProfile = liveInbox = liveAdvisor = termDirectory = coordinatorSchedules = undefined; return; }
  if ((page === 'overview' || usesStaffPresentation()) && termDirectory?.token !== token) {
    const state = termDirectory = {token};
    accountRequest('academic-terms', token).then(data => {
      if (termDirectory !== state) return;
      state.data = data;
      if (page === 'overview') render();
      else updateSidebarTerm();
    }).catch(() => { if (termDirectory === state) { state.error = true; updateSidebarTerm(); } });
  }
  if (['coordinator','advisor'].includes(role) && page === 'overview' && (refresh || coordinatorSchedules?.token !== token)) {
    const state = coordinatorSchedules = {token};
    accountRequest('schedules/students', token).then(data => { state.data = data; })
      .catch(error => {
        if (error.status === 404 && error.message.startsWith('No active academic term')) state.noTerm = true;
        else state.error = error.message;
      }).finally(() => {
        if (coordinatorSchedules !== state || page !== 'overview') return;
        const region = document.querySelector('[data-schedule-folders]');
        if (region) {
          region.innerHTML = scheduleReviewFiles();
          region.dispatchEvent(new Event('schedule-folders-loaded', {bubbles:true}));
        }
      });
  }
  if (page === 'profile' && (refresh || liveProfile?.token !== token)) {
    const state = liveProfile = {token};
    accountRequest('profile', token).then(data => { state.data = data.profile; })
      .catch(error => { state.error = error.message; }).finally(() => {
        if (liveProfile === state && page === 'profile') render();
      });
  }
  if (page === 'my-advisor' && role === 'advisingStudent' && (refresh || liveAdvisor?.token !== token)) {
    const state = liveAdvisor = {token};
    accountRequest('advisor/my-advisor', token).then(data => { state.data = data; })
      .catch(error => {
        if (error.status === 404 && error.message === 'No advisor currently assigned') state.data = null;
        else state.error = true;
      }).finally(() => {
        if (liveAdvisor === state && page === 'my-advisor' && localStorage.getItem(workspaceSessionKey) === token) render();
      });
  }
  if (liveInbox?.token !== token || refresh) {
    const state = liveInbox = {token, data: liveInbox?.token === token ? liveInbox.data : undefined};
    accountRequest('notifications', token).then(data => { state.data = data.notifications; })
      .catch(error => { state.error = error.message; }).finally(() => {
        if (liveInbox !== state) return;
        if (['notifications','overview'].includes(page)) render();
        else updateNotificationBadge();
      });
  }
}
let returnFocus;
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const usesStaffPresentation = () => ['coordinator','advisor','administrator'].includes(role);
const student = () => ['normalStudent','advisingStudent'].includes(role);
const person = () => sessionStorage.getItem(workspaceAccountNameKey) || liveStudent.data?.student?.fullName || roleNames[role];
const href = (target, courseCode) => {
  const query = new URLSearchParams({page:target, role, preview:'live'});
  if (authPages.has(target) && returnAfterSignIn !== 'overview') query.set('next', returnAfterSignIn);
  if (returnAfterSignIn === 'preferences' && (authPages.has(target) || target === 'preferences')) {
    const current = new URLSearchParams(location.search);
    for (const key of ['student', 'term']) {
      if (current.has(key)) query.set(key, current.get(key));
    }
  }
  if (target === 'preferences' && role === 'coordinator'
    && ['localhost', '127.0.0.1'].includes(location.hostname)
    && localStorage.getItem(previewSessionKey) === '1'
    && !query.has('student')) {
    query.set('student', '79-32001');
    query.set('term', 'S2026');
  }
  if (target === 'course-detail' && courseCode) query.set('course', courseCode);
  return '?' + query;
};

const link = (target, text, cls='') => `<a class="${cls}" href="${href(target)}" data-page="${target}">${text}</a>`;
const navigationLabel = id => id === 'graduation-plans'
  ? ({coordinator:'Graduation review', advisingStudent:'My graduation'}[role] || pages[id])
  : pages[id];
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
const statusTone = state => state === 'Ready for review' ? 'ready' : state === 'Draft' ? 'draft' : 'neutral';
function icon(name) {
  const paths = {
    close:'M6 6l12 12M18 6 6 18',
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
let termDirectory;
const currentAcademicTerm = () => termDirectory?.data?.find(term => term.isActive);
const displayTerm = term => term ? `${term.season[0].toUpperCase()}${term.season.slice(1)} ${term.academicYear}` : '';
const termMilestones = [
  ['registrationStart','Registration opens','sky','Opens'],
  ['registrationEnd','Registration closes','gold','Closes'],
  ['wholeScheduleSwapDeadline','Schedule swaps close','iris','Swaps close']
];
const calendarDate = iso => new Date(iso+'T12:00:00');
const formatCalendarDay = (iso, options) => calendarDate(iso).toLocaleDateString('en-GB',options);
const campusDay = (date = new Date()) => date.toLocaleDateString('sv-SE',{timeZone:'Africa/Cairo'});
const studentDashboard = () => page==='overview' && student() && workspaces[lab.layout].name==='Claude Study';
const milestonesFor = term => termMilestones.flatMap(([key,label,,short]) => {
  if (!term?.[key]) return [];
  const iso = campusDay(new Date(term[key]));
  return [{day:calendarDate(iso).getDate(), iso, label, short, term:displayTerm(term)}];
});
let calendarMonth = 0;
function calendarDates() {
  const todayISO = campusDay();
  const today = calendarDate(todayISO);
  const month = new Date(today.getFullYear(),today.getMonth()+calendarMonth,1,12);
  const prefix = month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0')+'-';
  const deadlines = (termDirectory?.data || []).flatMap(milestonesFor)
    .filter(({iso}) => iso.startsWith(prefix) && (!studentDashboard() || iso >= todayISO))
    .sort((a,b)=>a.iso.localeCompare(b.iso));
  return {today,month,deadlines};
}
function calendarAgenda() {
  const {deadlines} = calendarDates();
  if (studentDashboard()) {
    const upcoming = calendarMonth===0
      ? milestonesFor(currentAcademicTerm()).filter(({iso}) => iso >= campusDay()).slice(0,2)
      : deadlines;
    return `<h3>${calendarMonth===0?'Upcoming deadlines':'Deadlines this month'}</h3>${upcoming.length
      ? `<ul>${upcoming.map(({iso,label})=>`<li><strong>${label}</strong><time datetime="${iso}">${formatCalendarDay(iso,{day:'numeric',month:'short'})}</time></li>`).join('')}</ul>`
      : '<p>No upcoming deadlines.</p>'}`;
  }
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
let calendarRenderSerial = 0;
function calendarPage() {
  const renderSerial = ++calendarRenderSerial;
  const {today,month,deadlines} = calendarDates();
  const lastDay = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const monthName=month.toLocaleString('en-GB',{month:'long'});
  const cells = Array.from({length:42},(_,index)=>{
    const day = 1-month.getDay()+index;
    if(day<1 || day>lastDay) return '<span></span>';
    const date = new Date(month.getFullYear(),month.getMonth(),day,12);
    const dayEvents = deadlines.filter(event=>event.day===day);
    const current = date.toDateString()===today.toDateString() ? ' aria-current="date"' : '';
    if (!dayEvents.length) return `<span class="folio-date"${current}><b>${inkNumber(day)}</b></span>`;
    const when=formatCalendarDay(dayEvents[0].iso,{weekday:'long',day:'numeric',month:'long'});
    const noteId = `deadline-${renderSerial}-${day}`;
    const entries=dayEvents.map(event=>`<span class="deadline-entry"><strong>${event.label}</strong><small>${escapeHtml(event.term)}</small></span>`).join('');
    return `<button type="button" class="folio-date marked" ${current} data-deadline aria-controls="${noteId}" aria-expanded="false" aria-label="${when}, ${escapeHtml(dayEvents.map(event=>event.label+', '+event.term).join(', '))}" aria-pressed="false"><b>${inkNumber(day)}</b>${deadlineRing}<span id="${noteId}" popover="manual" class="deadline-note" role="note" aria-label="Deadline details" aria-hidden="true"><span class="deadline-slip" data-milestone="${dayEvents[0].short}"><span class="deadline-tape"></span><time datetime="${dayEvents[0].iso}"><em>${day}<svg aria-hidden="true" viewBox="0 0 51 43"><path d="M35 5C21 1 6 8 5 22c-2 10 8 16 23 15 12-1 19-8 18-18C45 10 39 7 29 6"/></svg></em><span>${formatCalendarDay(dayEvents[0].iso,{weekday:'short'})}<br>${monthName}</span></time>${entries}</span></span></button>`;

  }).join('');
  return `<div class="folio-inner"><div class="folio-month"><strong><span class="sr-only">${monthName}</span>${inkMonth(monthName)}</strong><small>${month.getFullYear()}</small>${seasonDrawing(month.getMonth())}</div><div class="folio-days">${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<small>${d}</small>`).join('')}${cells}</div></div>`;
}
function deskCalendar() {
  const month = calendarDates().month.getMonth();
  return `<section class="desk-calendar teaching-pad${studentDashboard()?' student-overview-calendar':''}" aria-label="Academic calendar"
    data-calendar-style="bellows" data-concertina="true" data-face-on data-sketch="false" data-season-month="${month}"
    style="--season-sheet:${seasonalPaper[month][0]};--season-back:${seasonalPaper[month][1]}">
    <header class="calendar-heading"><h2 id="academic-calendar">Academic calendar</h2>${studentDashboard()?link('calendar-sync',icon('calendar')+'Calendar sync','btn calendar-sync-link'):''}</header>
    <div class="binder-body"><div class="calendar-feature">${binderRow('feet')}</div>
      <div class="folio-stack">${binderRow('wires')}<div class="folio-paper">${calendarPage()}</div></div>
    </div>
    <div class="folio-nav">${studentDashboard()?'':`<button type="button" class="folio-today" data-calendar-nav="today" aria-label="Go to current month">Today · ${calendarDates().today.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</button>`}
      <button type="button" data-calendar-nav="-1" aria-label="Previous month">Previous</button><button type="button" data-calendar-nav="1" aria-label="Next month">Next</button>
    </div><div class="folio-agenda">${calendarAgenda()}</div>
    <p class="sr-only calendar-month-status" role="status" aria-live="polite" aria-atomic="true">${calendarDates().month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</p>
  </section>`;
}
function workQueue(tasks) {
  const entries = tasks.map(([symbol,tone,count,subject,phrase,desc,target,cta],index)=>`
    <li class="queue-entry" data-tone="${tone}" data-icon="${symbol}" data-current="${index===0}">
      <span class="queue-icon">${queueIcon(symbol)}${queueSketch(symbol)}</span>
      <div class="queue-copy"><strong>${count == null ? '' : count + ' '}${phrase}</strong><p>${desc}</p></div>
      ${role === 'coordinator' ? `<a class="queue-link" href="${href(target)}" data-page="${target}" aria-label="${cta}: ${phrase}">${cta}${icon('chevron')}</a>` : link(target,cta+icon('chevron'),'queue-link')}
    </li>`).join('');
  const list = `<div class="queue-designer" data-direction="illustrated"><div class="queue-stage"><ul class="queue-entries" role="list">${entries}</ul></div></div>`;
  return list;
}

function avatar(name) {
  const tones = ['sky','slate','iris','mint','rose','gold'];
  const normalized = name.replace(/^Dr\. /,'');
  const hue = [...normalized].reduce((seed,char)=>(seed*37+char.charCodeAt(0)) | 0,0);
  const initials = normalized.split(' ').slice(0,2).map(part=>part[0]).join('');
  return `<span class="avatar" data-portrait="${Math.abs(hue)%11}" data-tone="${tones[Math.abs(hue)%tones.length]}" aria-hidden="true">${escapeHtml(initials)}</span>`;
}


const displayStudentCode = code => String(code).replace(/^([A-Z]+)\s*(\d+)$/, '$1 $2');
function studentCourses() {
  return (liveStudent.data?.schedule?.courses || []).map(c => [escapeHtml(displayStudentCode(c.courseCode)), escapeHtml(c.courseName), escapeHtml(liveStudent.data.student.major), c.creditHours, liveStudent.data.term.season]);
}
function studentWeek() {
  const colors = ['ice','cherry','teal','clay'];
  const courses = studentCourses();
  return Object.entries(liveStudent.data?.schedule?.week || {}).map(([day,meetings]) => [day, meetings.map(m => [m.startTime, displayStudentCode(m.courseCode), escapeHtml(`${m.type[0].toUpperCase()+m.type.slice(1)} · ${m.room}`), colors[Math.max(0,courses.findIndex(c => c[0]===displayStudentCode(m.courseCode))) % colors.length], m.endTime])]);
}
function loadStudentSchedule() {
  if (!student() || authPages.has(page)) return;
  const token = localStorage.getItem(workspaceSessionKey);
  if (!token) { liveStudent = {token:null, loading:false, error:'Sign in to view your schedule.', data:null}; return; }
  if (token === liveStudent.token) return;
  liveStudent = {token, loading:true, error:'', data:null};
  fetch('../api/schedules/me', {headers:{Authorization:'Bearer '+token}}).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Sign in again to view your schedule.' : data.message || 'Could not load your schedule.');
    if (liveStudent.token !== token) return;
    liveStudent.data = data;
    selectedCourse = resolveCourse(new URLSearchParams(location.search).get('course'));
  }).catch(error => { if(liveStudent.token===token) liveStudent.error=error.message; }).finally(() => {
    if(liveStudent.token===token) {liveStudent.loading=false; if(student()) render();}
  });
}
const resolveCourse = code => studentCourses().find(c=>c[0]===code);
let selectedCourse = resolveCourse(params.get('course'));

function courseLink(code,label,cls) {
  const course = resolveCourse(code);
  return `<a class="${cls}" href="${href('course-detail',course[0])}" data-page="course-detail">${label}</a>`;
}
function groups(){
  const managesAcademics = role === 'coordinator' || role === 'administrator';
  const advises = role === 'coordinator' || role === 'advisor';
  if (student()) return [
    ['', ['overview']],
    ['Classes', ['my-schedule','my-courses', ...(role === 'normalStudent' ? ['schedule-swap'] : ['preferences'])]],
    ['Support', [...(role === 'advisingStudent' ? ['my-advisor','slot-changes'] : []),'calendar-sync', ...(role === 'advisingStudent' ? ['records','extra-hours','graduation-plans'] : [])]]
  ];
  return [
    ['', ['overview']],
    ['Student services', [
      ...(role === 'coordinator' ? ['pending-work'] : []),
      ...(managesAcademics ? ['directory','financial-records'] : []),
      ...(advises ? ['advising','extra-hours','graduation-plans'] : []),
      ...(role === 'advisor' ? ['my-submitted-plans'] : [])
    ]],
    ['Scheduling', [
      'student-schedules', ...(advises ? ['preferences'] : []),
      'mandatory-removals', ...(advises ? ['slot-changes'] : []), ...(managesAcademics ? ['schedule-activity'] : [])
    ]],
    ['Academic setup', managesAcademics
      ? ['courses','terms',role === 'administrator' ? 'offerings' : 'templates','group-assignments'] : []]
  ].filter(([, items]) => items.length);
}
function sidebar(){
  const parent = {'draft-schedule':'student-schedules','course-detail':student()?'my-courses':'courses','copy-offerings':'offerings'};
  const study = workspaces[lab.layout].name==='Claude Study';
  const sectionIcons = ['home','people','calendar','book'];
  return `<aside class="sidebar">
    <div class="brand">${link('overview',portalWordmark(),'wordmark')}<span>Academic workspace</span></div>
    <nav aria-label="Main navigation">${groups().map(([name,items],groupIndex)=>{
      const contents = `<ul>${items.map(id => {
        const current = page === id || parent[page] === id;
        return `<li><a class="navlink${current ? ' active' : ''}" href="${href(id)}" data-page="${id}" ${current ? 'aria-current="page"' : ''}>${id==='overview' ? icon('home') : ''}<span>${navigationLabel(id)}</span></a></li>`;
      }).join('')}</ul>`;
      if (!name) return `<div class="nav-home">${contents}</div>`;
      if (study) {
        const key = `portal-study-nav:${role}:${name}`;
        return `<details class="study-nav-group" data-nav-key="${key}" ${localStorage.getItem(key)==='closed'?'':'open'}><summary>${name}${icon('down')}</summary>${contents}</details>`;
      }
      const isOpen = groupIndex === 0 || items.includes(page) || items.includes(parent[page]);
      return `<details class="navgroup" ${isOpen?'open':''}><summary>${icon(sectionIcons[groupIndex])}<span>${name}</span>${icon('down')}</summary>${contents}</details>`;
    }).join('')}</nav>
    <div class="sidebar-foot"><span class="term-dot"></span><span>${usesStaffPresentation() ? `<span data-sidebar-term>${escapeHtml(sidebarTerm())}</span>` : escapeHtml(displayTerm(currentAcademicTerm()))}<span class="side-sub">German University in Cairo</span></span></div>
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

function table(headers,rows,search=true){
  const numeric = ['Amount','Credits','Semester','Groups','Courses','Balance','Grade'];
  return `<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th scope="col" class="${numeric.includes(h)?'num':''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr ${search?'data-search-row':''}>${row.map((cell,i)=>`<td class="${numeric.includes(headers[i])?'num':''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="search-empty" hidden>No matching records. Try a different search.</p></div><div class="tablefoot"><span id="result-count">${rows.length} records</span></div>`;
}

function filterbar(placeholder,options=[],action=''){
  const chips=options.length?'<ul class="filter-chips" id="filter-chips" aria-label="Active filters" hidden></ul>':'';
  return `<div class="toolbar"><div class="filters"><input aria-label="${placeholder}" placeholder="${placeholder}" id="search" type="search">${options.map(([label,values,field,defaultLabel])=>`<span class="filter-tab"><svg class="filter-mark" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="m2.8 7.5 6-.3m3.7.1 6.3-.3m-16 8 10.2-.3m3.6-.1 2.7-.1"/><path d="M12.4 7a2 2 0 1 1-4 .2 2 2 0 1 1 4-.2Zm4 7.5a2 2 0 1 1-4 .2 2 2 0 1 1 4-.2Z"/></svg><select aria-label="${label}" data-filter="${field||''}"><option value="">${defaultLabel||label}</option>${values.map(value=>`<option>${value}</option>`).join('')}</select></span>`).join('')}${chips}</div>${action?`<div class="actions">${action}</div>`:''}</div>`;
}
function tabs(items,defaultTab){
  if(!items.some(([id])=>id===tab)) tab=defaultTab||items[0][0];
  return `<div class="tabs" role="tablist" aria-label="${pages[page]} views">${items.map(([id,title])=>
    `<button type="button" role="tab" aria-selected="${tab===id}" tabindex="${tab===id?0:-1}" class="${tab===id?'active':''}" data-tab="${id}">${title}</button>`
  ).join('')}</div>`;
}
function termContext(context) {
  const term = displayTerm(currentAcademicTerm());
  return `${term ? `<span class="workspace-term">${icon('calendar')}<strong>${escapeHtml(term)}</strong></span>` : ''}<span class="workspace-term-context">${context}</span>`;
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
  return `${greeting}, <span class="greeting-name">${escapeHtml(person().replace(/^Dr\. /,'').split(' ')[0])}</span>`;
}
function workspaceSection(title, target, label, content, actionStyle='quiet-link') {
  return `<div class="section-head"><h2>${title}</h2>${link(target,label,actionStyle)}</div>${content}`;
}

const desktopFolder = '<svg class="desktop-folder" viewBox="0 0 96 72" aria-hidden="true"><path fill="#bdbaaf" d="M5 15q0-6 6-6h22l8 7h43q6 0 6 6v39H5z"/><g class="folder-sheet"><path class="folder-leaf-edge" fill="#fffdf6" stroke="#b8b4a7" stroke-width=".85" d="M12 21Q45 19 82 20L84 59Q50 60 11 60Z"/><path class="folder-writing" stroke="#989383" fill="none" stroke-linecap="round" stroke-width="1.65" d="M19 27q13-.6 35 0m-35 5q16-.8 48 0"/><path class="folder-third" stroke="#aaa396" fill="none" stroke-linecap="round" stroke-width="1.4" d="M19 36.7q11-.4 24 .1"/></g><path class="folder-cover" fill="var(--console-ivory,#f0eee6)" stroke="#c7c3b7" d="M5 31q0-5 5-5h75q5 0 5 5l-2 28q0 5-5 5H12q-5 0-5-5z"/></svg>';
function scheduleReviewFiles() {
  const state = coordinatorSchedules;
  if (state?.error) return `<div class="review-placeholder" role="alert"><p>${escapeHtml(state.error)}</p>${button('Try again','retry-schedule-review','btn')}</div>`;
  if (state?.noTerm) return `<div class="review-placeholder">${desktopFolder}<p>There is no active semester for schedule review.</p></div>`;
  if (!state?.data) return '<p class="review-placeholder" role="status">Loading student folders…</p>';
  const statuses = { readyForStudentReview: 'Ready for student review', draft: 'Draft' };
  const priority = ['readyForStudentReview','draft',null];
  const students = state.data.students.filter(s => s.isActive && s.studentType === 'advising' && s.scheduleStatus !== 'processed')
    .sort((a,b) => priority.indexOf(a.scheduleStatus) - priority.indexOf(b.scheduleStatus)).slice(0,6);
  if (!students.length) return `<div class="review-placeholder">${desktopFolder}<p>No advising schedules need work this term.</p></div>`;
  return `<div class="draft-index">${students.map(s => {
    const url = new URL(href('student-schedules'), location.href);
    url.searchParams.set('student', s._id);
    url.searchParams.set('term', state.data.term.code);
    const label = statuses[s.scheduleStatus] || 'Not started';
    if (role === 'advisor') {
      return `<a class="draft-file" href="${escapeHtml(url.search)}" data-page="student-schedules">
        ${desktopFolder}<span class="folder-identity"><strong>${escapeHtml(s.fullName || s.studentId)}</strong><small class="folder-student-id">${escapeHtml(s.studentId)}</small></span>
        <span class="folder-state" data-state="${s.scheduleStatus === 'readyForStudentReview' ? 'ready' : s.scheduleStatus === 'draft' ? 'draft' : 'new'}">${label}</span>${icon('chevron')}</a>`;
    }
    return `<a class="draft-file" href="${escapeHtml(url.search)}" data-page="student-schedules">${desktopFolder}<strong>${escapeHtml(s.fullName || s.studentId)}</strong><small>${label} · <span class="folder-student-id">${escapeHtml(s.studentId)}</span></small></a>`;
  }).join('')}</div>`;
}

function sidebarTerm() {
  if (!termDirectory?.data) return termDirectory?.error ? 'Semester unavailable' : 'Loading semester…';
  return displayTerm(currentAcademicTerm()) || 'No active semester';
}
function updateSidebarTerm() {
  document.querySelectorAll('[data-sidebar-term]').forEach(label => { label.textContent = sidebarTerm(); });
}

function overview(){
  if(student()) return studentOverview();
  if (role === 'advisor') return advisorOverview();
  const queueDestination = role==='coordinator' ? 'pending-work' : 'courses';
  const queueLabel = role==='coordinator' ? 'All work' : 'Course catalogue';
  const reviewFiles = role !== 'administrator' ? `<div data-schedule-folders aria-live="polite">${scheduleReviewFiles()}</div>` :
    `<div class="draft-index">${link('student-schedules', desktopFolder + `<strong>Student schedules</strong><small>${role === 'administrator' ? 'View schedules and advising overviews' : 'Open schedules and drafts'}</small>`, 'draft-file')}</div>`;
  const removalsTask = ['course-removal','rose',null,'Course removals','Course removal requests','Credit load and scheduling decisions','mandatory-removals','Review'];
  const tasks = role==='coordinator' ? [
    removalsTask,
    ['advisor-assignment','mint',null,'Advisors','Advising assignments','Manage student advisor assignments','advising','Assign'],
    ['group-assignment','iris',null,'Group assignment','Schedule groups','Assign students to published groups','group-assignments','Assign'],
  ] : [
    ['group-assignment','iris',null,'Course offerings','Course offerings','Review offerings and class groups','offerings','View offerings'],
    ['advisor-assignment','mint',null,'Academic terms','Academic terms','Review registration dates and deadlines','terms','Manage terms'],
  ];
  return `<div class="dashboard-edition" data-edition="teaching">${workspaceGrid({
    columns: '1.5fr 1fr',
    rows: ['intro intro', 'queue queue', 'review calendar'],
  }, {
    intro: head(studyGreeting(), termContext(`${roleNames[role]} workspace`)),
    queue: workspaceSection('Work queue', queueDestination, queueLabel, workQueue(tasks)),
    review: workspaceSection('Schedule review', 'student-schedules', 'All schedules', reviewFiles),
    calendar: deskCalendar(),
  })}</div>`;
}

function advisorOverview() {
  const tasks = [
    ['advisor-assignment','mint',null,'','Slot change requests','Review students’ requests to move to another class group.','slot-changes','Review requests'],
    ['course-removal','rose',null,'','Course removals','Submit a removal for a student or check the coordinator’s decision.','mandatory-removals','View removals'],
  ];
  return `<div class="dashboard-edition advisor-home" data-edition="teaching">${workspaceGrid({
    columns: '1.65fr 1fr',
    rows: ['intro intro', 'advising calendar'],
    lanes: {advising: ['review','queue']},
  }, {
    intro: head(studyGreeting(), termContext('Advisor workspace')),
    review: workspaceSection('Schedule review', 'student-schedules', 'All schedules',
      `<div data-schedule-folders aria-live="polite">${scheduleReviewFiles()}</div>`),
    queue: workspaceSection('Advising requests', 'advising', 'Advising students', workQueue(tasks)),
    calendar: deskCalendar(),
  })}</div>`;
}

function studentOverview() {
  const timetable = `<div class="timetable-heading"><h2>Teaching week</h2></div>${weekly()}`;
  const view = { columns: '1fr 1fr', rows: ['week week', 'review activity'] };
  return `<div class="student-dashboard">${head(studyGreeting(), termContext(escapeHtml(liveStudent.data?.student.major || 'Student workspace')))}
    ${workspaceGrid(view, { week: timetable, review: studentFeed(), activity: deskCalendar() })}</div>`;
}

function profile(){
  const token = localStorage.getItem(workspaceSessionKey);
  const state = liveProfile?.token === token ? liveProfile : null;
  const real = state?.data;
  const heading = head('My profile');
  if (!real) return heading + (state?.error
    ? `<p role="alert">${escapeHtml(state.error)}</p>`
    : '<p role="status">Loading your profile…</p>');
  const display = value => escapeHtml(value == null ? '—' : String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, letter => letter.toUpperCase()));
  const email = escapeHtml(real.email);
  const facts = pairs => `<dl class="profile-facts">${pairs.map(([key,value]) =>
    `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  const academic = facts([
    ['Major', escapeHtml(real.major || '—')], ['Semester', display(real.currentSemester)],
    ['Academic standing', display(real.academicStanding)],
    ...(role === 'advisingStudent' ? [['Assigned advisor', escapeHtml(real.assignedAdvisor?.fullName || 'Unassigned')]] : []),
    ['Schedule status', badge(display(real.scheduleStatus), statusTone(display(real.scheduleStatus)))],
  ]);
  const shortcuts = student() ? ['my-schedule',role==='advisingStudent'?'preferences':'my-courses'] :
    role==='advisor' ? ['advising','student-schedules'] : role==='administrator' ? ['directory','financial-records'] : ['pending-work','student-schedules'];
  return heading + `<div class="profile-desk personal-profile">
    <aside class="profile-identity"><div class="campus-id">
      <div class="campus-wordmark"><img src="portal-card-index.svg" alt="">German University in Cairo</div>
      <div class="campus-owner">${avatar(real.fullName)}<div><h2>${escapeHtml(real.fullName)}</h2><p>${roleNames[role]}</p></div></div>
      <div class="campus-card-foot">${student() ? `Student ID <strong>${escapeHtml(real.studentId || '—')}</strong>` : ''}</div>
    </div></aside>
    <div class="profile-pane"><h2>Contact</h2>${facts([['University email',`<a href="mailto:${email}">${email}</a>`]])}
      ${student() ? `<h2>Academic information</h2>${academic}` : ''}
      <h2>My workspace</h2><div class="profile-shortcuts">${shortcuts.map(target => link(target,
        icon({'pending-work':'inbox','student-schedules':'calendar','my-schedule':'calendar',preferences:'edit',
          'my-courses':'book',advising:'people',directory:'people','financial-records':'book'}[target]) +
        `<span>${pages[target]}</span>` + icon('chevron'), 'profile-shortcut')).join('')}</div>
    </div>
  </div>`;
}
function notificationEntries(){
  const token = localStorage.getItem(workspaceSessionKey);
  return token && liveInbox?.token === token ? liveInbox.data || [] : [];
}

function notificationTime(item) {
  const time = new Date(item.createdAt).toLocaleString('en-GB', {dateStyle:'medium', timeStyle:'short', timeZone:'Africa/Cairo'});
  return `<time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(time)}</time>`;
}

function studentNotificationPanel(){
  const unread = notificationEntries().filter(item => !item.isRead);
  const expanded = app.querySelector('.student-inbox-list details[open]')?.dataset.notification;
  const inboxStatus = liveInbox?.error ? 'Couldn’t load notifications.'
    : liveInbox?.data ? 'No unread notifications.' : 'Loading notifications…';
  return `<section class="student-inbox" aria-labelledby="student-inbox-heading">
    <div class="section-head">
      <div class="student-inbox-title">${icon('inbox')}
        <h2 id="student-inbox-heading">Notifications${unread.length ? ` <span class="student-inbox-count">${unread.length} unread</span>` : ''}</h2>
      </div>
      ${link('notifications','Open inbox','quiet-link')}
    </div>
    ${unread.length
      ? `<ul class="student-inbox-list" role="list">${unread.slice(0,3).map(item => `
        <li><details name="home-notifications" data-notification="${escapeHtml(item._id)}"${item._id===expanded ? ' open' : ''}>
          <summary><span>${escapeHtml(item.title)}</span>${icon('chevron')}</summary>
          <div class="student-notice-detail"><p>${escapeHtml(item.message)}</p><small>${notificationTime(item)}</small></div>
        </details></li>`).join('')}</ul>`
      : `<p class="student-inbox-empty" role="status">${inboxStatus}</p>`}
  </section>`;
}

function upcomingClasses(now = new Date()){
  const today = calendarDate(campusDay(now));
  const clock = now.toLocaleTimeString('en-GB',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit'});
  const meetings = [];
  for (let offset = 0; offset <= 7 && meetings.length < 2; offset++) {
    const date = new Date(today.getFullYear(),today.getMonth(),today.getDate()+offset,12);
    const day = studentWeek().find(([name]) => name === date.toLocaleDateString("en-US", {weekday:"long", timeZone:"Africa/Cairo"}));
    if (!day) continue;
    for (const [time,code,detail] of day[1]) {
      if (offset===0 && time<=clock) continue;
      meetings.push({time,code,detail,date,day:offset===0?'Today':offset===1?'Tomorrow':day[0]});
    }
  }
  return meetings.slice(0,2);
}

function studentFeed(){
  const meetings = upcomingClasses();
  return `<div class="student-feed" id="student-feed" data-feed-layout="1">
    <section class="student-upcoming" aria-labelledby="student-upcoming-heading">
      <div class="section-head"><h2 id="student-upcoming-heading">Coming up</h2></div>
      <ul class="student-upcoming-list" role="list">${meetings.map(({time,code,detail,date,day})=>`
        <li>${courseEmblem(code)}
          <div class="student-class-copy"><h3>${resolveCourse(code)?.[1] || escapeHtml(code)}</h3><p>${detail}</p></div>
          <time datetime="${date.toLocaleDateString('sv-SE')}T${time}"><span>${day}</span><strong>${time}</strong></time>
        </li>`).join('')}</ul>
    </section>
    ${studentNotificationPanel()}
  </div>`;
}

function notificationViews(unreadCount) {
  if (tab !== 'unread') tab = 'all';
  const openMail = '<path d="M3.5 13.8 13 5.7q1-.8 2 .1l9 7.1-1 10.9-18.4.7Z" fill="#bba184"/><path d="m6.8 15-.6-11 14-.8 1 11.8" fill="#f5eee0"/><path d="m9.6 8.3 7.4-.6m-7.1 4.2 5.1-.4" fill="none"/><path d="m3.5 13.8 10.4 5.5L24 12.9l-1 10.9-18.4.7Z" fill="#d8b79a"/><path d="m6.5 22 5.2-4m9.2 3.7-4.5-3.8" fill="none"/>';
  const sealedMail = '<path d="m3.3 8 20.6-1 .5 15.2-20.2 1Z" fill="#c2d2cd"/><path d="m3.7 8.7 10.4 8 9.4-9.2m-17 13.2 6-5.3m9.8 4.6-6.2-4.9" fill="none"/>';
  const unreadDot = '<path d="M17.8 6.7q-.3-4.1 3.9-4.5 4.2-.2 4.5 3.8.2 4.3-3.9 4.7-4 .3-4.5-4Z" fill="#e9a38b"/>';
  const views = [['all','All notifications',openMail],['unread','Unread',sealedMail+(unreadCount?unreadDot:'')]];
  return `<div class="tabs mail-views" role="tablist" aria-label="Notification views">${views.map(([id,label,drawing])=>
    `<button type="button" id="notice-view-${id}" role="tab" aria-controls="notice-results" aria-selected="${id===tab}" tabindex="${id===tab?0:-1}" data-tab="${id}">
      <svg class="mail-drawing" viewBox="0 0 28 28" aria-hidden="true">${drawing}</svg><span>${label}</span>${id==='unread'?`<span class="mail-count">${unreadCount}</span>`:''}
    </button>`).join('')}</div>`;
}

function notifications(){
  const entries = notificationEntries();
  const unread = entries.filter(item => !item.isRead);
  const strip = notificationViews(unread.length);
  const visible = tab === 'unread' ? unread : entries;
  const token = localStorage.getItem(workspaceSessionKey);
  const state = token && liveInbox?.token === token ? liveInbox : null;
  const inboxStatus = token && !state?.data
    ? state?.error ? `<p role="alert">${escapeHtml(state.error)}</p>` : '<p role="status">Loading notifications…</p>'
    : '';
  return head('Notifications', '',
    (unread.length ? button('Mark all as read','read-all','btn primary') : ''), '')+strip+
    `<section id="notice-results" role="tabpanel" aria-labelledby="notice-view-${tab}">`+
    (inboxStatus || (visible.length ? `<div class="notification-list">${visible.map(item => {
      const subject = item.subjectStudent;
      // Older coordinator notices use this stock sentence in place of request details.
      const queueAction = { graduationPlanSubmitted:'review', exitExamRequested:'review',
        mandatoryCourseRemovalRequested:'review', financialReversalRequested:'process' }[item.type];
      const stockMessage = subject && queueAction && item.message === `Student ${subject.studentId} has a request for you to ${queueAction}.`;
      const emailStatus = item.channels?.includes('email') && item.deliveryStatus;
      return `<article class="inbox-item ${item.isRead ? '' : 'unread'}">
        ${subject ? avatar(subject.fullName) : `<span class="notice-symbol" data-kind="${escapeHtml(item.type)}" aria-hidden="true"></span>`}
        <div class="inbox-text">${subject ? `<span class="notice-person">${escapeHtml(subject.fullName)}${subject.studentId ? ` <small>${escapeHtml(subject.studentId)}</small>` : ''}</span>` : ''}
          <h3>${escapeHtml(item.title)}</h3>${stockMessage ? '' : `<p>${escapeHtml(item.message)}</p>`}${notificationTime(item)}</div>
        <div class="notification-meta">
          ${emailStatus ? `<small>Email: ${escapeHtml(emailStatus)}</small>` : ''}
          ${item.isRead ? '<small>Read</small>' : button('Mark as read','read-one','btn desk-action', `data-notification="${escapeHtml(item._id)}"`)}
      </article>`;
    }).join('')}</div>` : `<div class="empty">${notificationScenes('coffee',false)}<h2>You’re all caught up.</h2><p>${tab === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}</p></div>`))+'</section>';
}

async function markPortalNotifications(ids, control) {
  const token = localStorage.getItem(workspaceSessionKey);
  const state = liveInbox;
  if (token) {
    control.disabled = true;
    const results = await Promise.allSettled(ids.map(id => accountRequest(`notifications/${encodeURIComponent(id)}/read`, token, 'PATCH')));
    if (liveInbox !== state || localStorage.getItem(workspaceSessionKey) !== token) return;
    const updated = new Map(results.filter(result => result.status === 'fulfilled')
      .map(({value}) => [value.notification._id, value.notification]));
    state.data = state.data.map(entry => updated.has(entry._id) ? { ...entry, ...updated.get(entry._id) } : entry);
    if (page !== 'notifications') {
      updateNotificationBadge();
      return;
    }
    if (results.some(result => result.status === 'rejected')) {
      render();
      toast('Some notifications could not be marked as read.', 'error');
      return;
    }
  }
  render();
  document.querySelector('[aria-selected=true][aria-controls="notice-results"]')?.focus();
  toast(ids.length === 1 ? 'Notification marked as read.' : 'All notifications marked as read.');
}

function courseDetailArt(symbol, tone) {
  return `<span class="course-detail-art" data-art-tone="${tone}">
    <svg aria-hidden="true" width="30" height="30" viewBox="0 0 36 36">
      <use href="images/symbols/course-detail.svg#${symbol}"/>
    </svg>
  </span>`;
}
function courseDetail(){
  if (!student()) return portalService('courses', 'academic-services');
  if (!selectedCourse) return head('Course details') + `<p role="status">${escapeHtml(
    liveStudent.loading ? 'Loading your course…' : liveStudent.error || 'This course is not on your timetable.'
  )}</p>` + link('my-courses','Registered courses','btn');
  const [code,title,department,credits] = selectedCourse;
  const facts = [['Course code',code],['Credit hours',credits],['Department',department]];
    const factIcons = {
      'Credit hours': ['pocket-watch', 'blue'],
      Semester: ['semester-index', 'lilac'],
      Type: ['course-type', 'coral'],
      'Offering seasons': ['seasons', 'gold'],
    };
    const sectionArt = {Lecture: ['lecture', 'blue'], Tutorial: ['tutorial', 'lilac'], Lab: ['lab', 'sage']};
    const meetings = liveStudent.data?.schedule?.courses
      .find(course => escapeHtml(displayStudentCode(course.courseCode)) === code)?.slots || [];
    return `<div class="student-course-detail">
      ${link('my-courses','← Registered courses','course-back')}
      <header class="course-detail-identity">
        ${courseEmblem(code)}
        <div><h1>${title}</h1><p>${code} · ${department}</p></div>
      </header>
      <div class="course-detail-columns">
      <section aria-labelledby="course-offering-heading">
        <h2 id="course-offering-heading">Your sections</h2>
        ${meetings.length?`<ul class="course-meetings">${meetings.map(({day,startTime,endTime,type,room,groupNumber})=>{
          const label = type[0].toUpperCase() + type.slice(1);
          return `<li>${courseDetailArt(...(sectionArt[label] ?? sectionArt.Tutorial))}
            <div><strong>${escapeHtml(label)}${groupNumber ? ` · Group ${escapeHtml(groupNumber)}` : ''}</strong><small>${escapeHtml(day)} · ${escapeHtml(room)}</small></div><time datetime="${escapeHtml(startTime)}">${escapeHtml(startTime)}–${escapeHtml(endTime)}</time></li>`;
        }).join('')}</ul>`:'<p>No sections on your timetable.</p>'}
        ${link('my-schedule','View schedule','btn schedule-sections-link course-schedule-link')}
      </section>
      <div class="course-detail-reference">
      <section aria-labelledby="course-facts-heading"><h2 id="course-facts-heading">Course information</h2>
        <dl class="course-facts">${facts.filter(([label])=>label in factIcons).map(([label, value])=>{
          const [symbol, tone] = factIcons[label];
          return `<div>
          <dt>${courseDetailArt(symbol, tone)}${label}</dt>
          <dd>${value}</dd>
        </div>`;
        }).join('')}</dl>
      </section>
      </div>
      </div>
    </div>`;
}
// Small marginal drawings identify the four courses wherever the weekly schedule appears.
function courseDrawing(code) {
  const identity = globalThis.BobosCourseIcons?.[String(code).replace(/\s/g, '').toUpperCase()];
  if (identity) return `<img class="course-drawing course-symbol" src="images/symbols/${identity.symbol}.svg" alt="">`;
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
  if (student() && !liveStudent.data) {
    const message = liveStudent.error || (localStorage.getItem(workspaceSessionKey) ? 'Loading your schedule…' : 'Sign in to view your schedule.');
    return `<div class="student-schedule-empty"><p role="status">${escapeHtml(message)}</p>${!localStorage.getItem(workspaceSessionKey) || liveStudent.error.includes("expired") ? link('login','Sign in to Portal','btn') : ''}</div>`;
  }
  const illustrated = workspaces[lab.layout].name === 'Claude Study';
  function classCard([time, code, detail, color, endTime]) {
    return `<div class="week-class ${color}">${illustrated ? (timetableDrawing(code) || courseDrawing('CSEN 701')) : ''}<time datetime="${time}">${time}–${endTime}</time>
      <strong>${resolveCourse(code)?.[1] || escapeHtml(code)}</strong>
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
  return `<div class="week-columns${illustrated ? ' compact-week' : ''}${student() ? ' live-student-week' : ''}" style="--teaching-days:${studentWeek().length}" aria-label="Weekly course schedule">${studentWeek().map(([day, meetings]) =>
    `<section class="week-day" aria-label="${day}"><h2>${day}</h2>${dayContents(meetings)}</section>`).join('')}</div>`;
}
function schedule(){
  const timetableContext = liveStudent.data ? `${escapeHtml(liveStudent.data.term.season)} ${escapeHtml(liveStudent.data.term.academicYear)} · ${escapeHtml(({readyForStudentReview:"Ready for student review", processed:"Processed", draft:"Draft"})[liveStudent.data.schedule.status] || liveStudent.data.schedule.status)}` : '';
  if (!liveStudent.data) return head('My schedule') + `<p role="status">${escapeHtml(liveStudent.error || 'Loading your schedule…')}</p>`;
  const actions = liveStudent.data.schedule.status === 'processed'
    ? button('Download schedule','download-my-schedule') + button('Print','print-schedule')
    : role === 'advisingStudent' && Date.now() < Date.parse(liveStudent.data.term.advisingDeadline)
      ? link('slot-changes','Request a slot change','btn') : '';
  return head('Weekly schedule',timetableContext,actions)+
    tabs([['week','Week'],['list','Course list']],'week')+(tab==='list'?registeredTable():weekly())+
    '';
}
function registeredTable(){
  const illustrated = workspaces[lab.layout].name === 'Claude Study';
  return '<div class="schedule-course-list">'+table(['Course','Type','Credits',''],studentCourses().map(([code,title,,credits])=>[
    `<div class="schedule-course-cell">${illustrated?courseEmblem(code):''}<div><strong>${title}</strong><small>${code}</small></div></div>`,
    'Mandatory',credits,courseLink(code,'View sections','btn schedule-sections-link')
  ]))+'</div>';
}
function courseEmblem(code) {
  const courseTone = {'CSEN 701':'blue','CSEN 703':'coral','CSEN 704':'sage','DMET 701':'ivory','ELCT 701':'sage','MATH 701':'ivory'};
  return `<span class="student-course-emblem" data-course-tone="${globalThis.BobosCourseIcons?.[String(code).replace(/\s/g, '').toUpperCase()]?.tone || courseTone[code]}">${courseDrawing(code)}</span>`;
}
function registered(){
  if (!liveStudent.data) return head('Registered courses') + `<p role="status">${escapeHtml(liveStudent.error || 'Loading your courses…')}</p>`;
  const study = workspaces[lab.layout].name==='Claude Study';
  return head('Registered courses',study ? termContext(`${studentCourses().length} courses · ${studentCourses().reduce((n,c)=>n+Number(c[3]),0)} credit hours`) : `${studentCourses().length} courses · ${studentCourses().reduce((n,c)=>n+Number(c[3]),0)} credit hours`)+
    `<div class="course-list">${studentCourses().map(([code,title,,credits]) =>
      `<article>${study?courseEmblem(code):''}<div class="registered-course-title"><h2>${title}</h2><small>${code} · ${credits} credits</small></div>
      ${courseLink(code,'View sections','btn schedule-sections-link')}</article>`).join('')}</div>
    <div class="registered-course-actions">${button('Request course removal','request-removal','btn text')}</div>`;
}
function pending(){
  return portalService('pending-work', 'academic-services');
}
function activity(){
  return portalService('schedule-activity', 'academic-services');

}

function advisor(){
  const heading = head('Academic advising');
  if (role !== 'advisingStudent') return heading + '<p>This page is available to advising students.</p>';

  const token = localStorage.getItem(workspaceSessionKey);
  const state = token && liveAdvisor?.token === token ? liveAdvisor : null;
  const person = state?.data;
  const status = !token ? '<p>Sign in to see your assigned advisor.</p>'
    : state?.error ? '<p role="alert">Could not load your advisor. Refresh the page to try again.</p>'
    : person === null ? '<p role="status">You don’t have an assigned advisor yet.</p>'
    : '<p role="status">Loading your advisor…</p>';
  const deadline = liveStudent.token === token && liveStudent.data?.term.advisingDeadline;
  const deadlineLabel = deadline ? formatCalendarDay(campusDay(new Date(deadline)), {day:'numeric', month:'long', year:'numeric'}) : '';
  return heading + `
    <div class="advising-layout">
      <section class="advisor-details" aria-label="Advisor assignment">
        ${person ? `<header class="advisor-identity">${avatar(person.fullName)}<div><h2>${escapeHtml(person.fullName)}</h2><p>Your assigned advisor</p></div></header>
          <dl class="details"><div><dt>University email</dt><dd><a href="mailto:${escapeHtml(person.email)}">${escapeHtml(person.email)}</a></dd></div></dl>
          <section class="advisor-checklist"><h2>Before you meet</h2>
          ${['Review remaining credits','Choose preferred course groups','Write down questions'].map(item => `<label class="checkrow"><input type="checkbox">${item}</label>`).join('')}
          </section>` : status}
      </section>
      <aside><section class="advisor-callout"><h2>Your advising schedule</h2><p>Review your proposed timetable and course selections.</p>
        ${link('my-schedule','View schedule','btn primary')}</section>
        <p class="advisor-deadline">${deadlineLabel ? `<strong>Preferences due ${deadlineLabel}</strong><br>` : ''}${link('preferences','Set course preferences','btn row-control')}</p>
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
  const localStudentDemo = ['localhost','127.0.0.1'].includes(location.hostname) && ['normalStudent','advisingStudent'].includes(role);
  async function request(path, method = 'GET', retry = true) {
    const response = await fetch('../api/calendar/' + path, { method, headers: { Authorization: 'Bearer ' + token } });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 && retry && localStudentDemo) {
        localStorage.removeItem(workspaceSessionKey);
        if (await signInDemoWorkspace(role)) {
          token = localStorage.getItem(workspaceSessionKey);
          return request(path, method, false);
        }
      }
      if ([401, 403].includes(response.status)) {
        if (response.status === 401) localStorage.removeItem(workspaceSessionKey);
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
      if (data.lastSyncedAt) {
        const openCalendar = document.createElement('a');
        openCalendar.className = 'btn row-control';
        openCalendar.textContent = 'Open Google Calendar ↗';
        openCalendar.href = 'https://calendar.google.com/calendar/r' + (data.providerAccountId ? '?authuser=' + encodeURIComponent(data.providerAccountId) : '');
        openCalendar.target = '_blank';
        openCalendar.rel = 'noopener noreferrer';
        openCalendar.setAttribute('aria-label', 'Open Google Calendar in a new tab');
        controls.append(openCalendar);
      }
      control('Change Google account', async () => location.assign((await request('connect')).authorizationUrl));
      control('Disconnect', async () => { await request('connection', 'DELETE'); await refresh(); });
    } else {
      status.textContent = data.configured ? 'Choose the Google account for your classes.' : 'Google Calendar setup is incomplete.';
      if (data.configured) control('Sign in with Google', async () => location.assign((await request('connect')).authorizationUrl));
    }
  }
  if (!token) {
    status.textContent = 'Sign in with your Bobos student account to access your calendar.';
    if (['localhost','127.0.0.1'].includes(location.hostname) && ['normalStudent','advisingStudent'].includes(role)) {
      status.textContent = 'Choose your Google account to sync this student’s timetable.';
      control('Sign in with Google', async () => {
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
function calendarSync() {
  if (!student()) return head('Calendar sync') + '<p>Sign in with a student account to access Calendar sync.</p>';
  return head('Calendar sync', 'Keep your processed timetable in Google Calendar.') +
    '<section class="student-calendar" data-live-calendar aria-label="Google Calendar"><h2>Google Calendar</h2><p role="status">Loading connection…</p></section>';
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
            <label>University email<input name="email" type="email" autocomplete="username" placeholder="name@guc.edu.eg" required></label>
            ${page==='reset'?'<label>Reset code<input name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label>':''}
            <button type="submit" class="btn primary">${page==='forgot'?'Send reset code':'Update password'}</button>
            <p class="auth-feedback" role="status" aria-live="polite" hidden></p>
            ${page==='reset'?link('forgot','Request another code','auth-recovery'):''}
            ${link('login','Back to sign in','auth-recovery')}`}
        </form>
        ${page==='login' ? `<fieldset class="preview-role-picker">
          <legend>Quick demo sign-in</legend>
          <div class="preview-role-options">${Object.entries(roleNames).map(([id,label])=>
            button(label,'preview-sign-in','preview-role-button',`data-preview-role="${id}"`)).join('')}</div>
        </fieldset>` : ''}
      </section>
    </div>
    <figure class="signin-print"><div class="desk-lamp-scene"><img src="images/borrowed-light.svg" alt="Desk lamp lighting a sheet of paper" fetchpriority="high"></div></figure>
  </main>`;
}
function extraHours(){
  if (!['advisor', 'coordinator', 'advisingStudent'].includes(role)) {
    return head('Extra-hours requests') + '<p>This page is unavailable for your role.</p>';
  }

  return head('Extra-hours requests') + portalService('extra-hours');
}

function portalService(screen, section = '') {
  const query = new URLSearchParams({screen, section, role});
  if (page === 'my-submitted-plans') query.set('view', 'submitted');
  return `<div data-portal-service="${escapeHtml(query)}"><p role="status">Loading…</p></div>`;
}

function academicServices() {
  return head('Academic services') + '<p role="status">This page is unavailable.</p>';
}

function graduationPlans() {
  const allowedRoles = page === 'my-submitted-plans' ? ['advisor'] : ['advisor', 'coordinator', 'advisingStudent'];
  if (!allowedRoles.includes(role)) {
    return head(navigationLabel(page)) + '<p>This page is unavailable for your role.</p>';
  }
  return (role === 'advisingStudent' ? head('My graduation', 'See your accepted graduation plans and exit-exam decisions.') : '') + portalService('graduation-plans');
}

const renderers = {
  overview, notifications, profile, 'my-advisor':advisor, 'my-schedule':schedule, 'my-courses':registered,
  'course-detail':courseDetail, 'calendar-sync':calendarSync, 'extra-hours':extraHours,
  'graduation-plans':graduationPlans, 'my-submitted-plans':graduationPlans,
  'copy-offerings':() => portalService('offerings', 'academic-services'),
  'draft-schedule':() => portalService('student-schedules', 'academic-services'),
  'academic-services':academicServices,
};
for (const screen of ['advising','directory','financial-records','mandatory-removals','group-assignments',
  'preferences','slot-changes','records','pending-work','schedule-activity','student-schedules',
  'schedule-swap','courses','terms','offerings','templates']) {
  renderers[screen] = () => portalService(screen, 'academic-services');
}

function themeControl(){
  return button('<span class="' + (!lab.dark ? 'theme-light' : '') + '">' + icon('sun') + '</span><span class="' + (lab.dark ? 'theme-light' : '') + '">' + icon('moon') + '</span>',
    'toggle-theme', 'theme-toggle', 'aria-label="Switch to ' + (lab.dark ? 'light' : 'dark') + ' mode"');
}
function notificationBadge() {
  const token = localStorage.getItem(workspaceSessionKey);
  const count = token && liveInbox?.token === token ? (liveInbox.data || []).filter(item => !item.isRead).length : 0;
  const label = count ? `Notifications, ${count} unread` : 'Notifications';
  const markup = count ? `<span class="notification-count" aria-hidden="true">${count}</span>` : '';
  return {label, markup};
}
function updateNotificationBadge() {
  const bell = app.querySelector('[data-notification-bell]');
  if (!bell) return;
  const {label, markup} = notificationBadge();
  bell.setAttribute('aria-label', label);
  bell.title = label;
  bell.querySelector('.notification-count')?.remove();
  if (markup) bell.insertAdjacentHTML('beforeend', markup);
}
function accountControls(){
  const name = localStorage.getItem(workspaceSessionKey)
    ? sessionStorage.getItem(workspaceAccountNameKey) || roleNames[role]
    : person();
  const bell = `<svg class="icon notice-bell" aria-hidden="true" viewBox="0 0 28 28" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path class="bell-body" d="M8 12c0-4 2.1-6.6 6-6.6s6 2.8 6 6.6c0 3.6 1.2 5.4 2.4 7.1-4.7.8-12.3.8-16.8 0C7 17.4 8 15.4 8 12Z"/>
    <path class="bell-clapper" d="M12 22q2 2 4-.2"/>
    <path class="bell-echo" pathLength="1" d="M4.4 7.8Q2.5 10 2.7 12.4M23.6 7.3q2.1 2.3 2 4.4"/>
  </svg>`;
  const {label, markup} = notificationBadge();
  return `<a class="icon-button" href="${href('notifications')}" data-page="notifications" data-notification-bell aria-label="${label}" title="${label}">${bell}${markup}</a>
    <button type="button" class="account-button" popovertarget="account-menu" aria-label="Account menu for ${escapeHtml(name)}">${avatar(name)}<span>${escapeHtml(name)}</span>${icon('down')}</button>
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
    const key=kind==='folder' ? el.href : role+'-'+kind+'-'+index;
    if(revealedOverviewItems.has(key) || el.matches(':focus-within')) return;
    if(kind==='folder'){
      el.style.setProperty('--folder-duration',`${590+index*24}ms`);
      el.dataset.paperReveal='folder';
      const label=el.querySelector('strong');
      label.addEventListener('animationend',()=>{
        revealedOverviewItems.add(key);
        finishArrival(el);
      },{once:true});
      return;
    }
    revealedOverviewItems.add(key);
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
  function stageUnit(el,{kind,index}){
    const key=kind==='folder' ? el.href : role+'-'+kind+'-'+index;
    if(revealedOverviewItems.has(key)) return;
    const rect=el.getBoundingClientRect();
    if(kind==='chrome'||(rect.top<innerHeight && rect.bottom>0)) reveal(el,order++,false);
    else {el.setAttribute('data-arriving','');arrivalObserver.observe(el);}
  }
  units.forEach((unit,el)=>stageUnit(el,unit));
  main.addEventListener('schedule-folders-loaded',event=>{
    if(motionPreference.matches) return;
    event.target.querySelectorAll('.draft-file').forEach((el,index)=>{
      const unit={kind:'folder',index};
      units.set(el,unit);
      stageUnit(el,unit);
    });
  });
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

let disposePortalService;
function mountPortalService(host) {
  import('/portal-services.js').then(({mount}) => {
    if (host.isConnected) disposePortalService = mount(host);
  }).catch(() => {
    if (host.isConnected) host.innerHTML = '<p role="alert">This page couldn’t load. Try refreshing.</p>';
  });
}

function render(focus=false){
  loadStudentSchedule();
  loadAccountData(focus);
  closeDeadline();
  if (page === 'graduation-plans' && role === 'advisor' && new URLSearchParams(location.search).get('view') === 'submitted') {
    page = 'my-submitted-plans';
    history.replaceState(history.state, '', href(page));
  }
  if (!authPages.has(page) && !signedIn()) {
    returnAfterSignIn = page;
    page = 'login';
    history.replaceState(history.state,'',href(page));
  }
  const pageLabel = navigationLabel(page);
  document.body.dataset.portalRole = authPages.has(page) ? '' : role;
  document.title = `Portal · ${pageLabel}`;
  document.body.classList.toggle('auth-screen',authPages.has(page));
  const body=authPages.has(page)?auth():`<div class="shell">${sidebar()}<div class="workspace"><header class="topbar">${link('overview',portalWordmark(),'mobile-nav wordmark')}<span class="term">${workspaces[lab.layout].name==='Claude Study'?'<small class="study-crumb">Academic workspace &nbsp; / &nbsp;</small>':''}${pageLabel}<span>${escapeHtml(displayTerm(currentAcademicTerm()))}</span></span><div class="topactions">${button(icon('menu')+'<span class="sr-only">Menu</span>','mobile-menu','mobile-menu')}${themeControl()}${accountControls()}</div></header><main class="content" data-screen="${page}" id="content" tabindex="-1">${renderers[page]()}</main></div></div>`;
  arrivalObserver?.disconnect();
  disposePortalService?.();
  disposePortalService = undefined;
  app.innerHTML=body;
  if (authPages.has(page)) {
    const themeTools = document.createElement('div');
    themeTools.className = 'portal-auth-theme';
    themeTools.innerHTML = themeControl();
    app.append(themeTools);
  }
  const liveCalendar = app.querySelector('[data-live-calendar]');
  if (liveCalendar) mountLiveCalendar(liveCalendar);
  const service = app.querySelector('[data-portal-service]');
  if (service) mountPortalService(service);
  observeNotificationPlate(app.querySelector('.notification-plate'));
  if (document.body.dataset.portalRole !== 'coordinator') drawInputEdges(app);
  const main = app.querySelector('main');
  if (main && !authPages.has(page)) {
    window.addStudentArt?.(page,main,role);
    window.addStaffArt?.(page,main,role);
  }
  if(page==='overview' && workspaces[lab.layout].name==='Claude Study' && main.querySelector('.page-head')) stageOverview(main);
  const lamp = app.querySelector('.desk-lamp-scene');
  if (lamp) mountDeskLamp(lamp);
  binderMotion.mount(app.querySelector('[data-concertina=true] .folio-stack'));
  if(focus)document.querySelector('#content')?.focus({preventScroll:true});
}
function navigate(target, url, state = {}) {
  if (dialog.open) dialog.close();
  page = pageKey(target);
  tab = '';
  const destination = new URL(url || href(page), location.href);
  BobosPortalRoutes.normalize(destination.searchParams);
  page = pageKey(destination.searchParams.get('page'));
  selectedCourse = resolveCourse(destination.searchParams.get('course'));
  history.pushState(state, '', destination);
  render(true);
  window.scrollTo(0, 0);
}
document.addEventListener('portal:open-service', ({detail: {screen, context}}) => {
  const target = BobosPortalRoutes.screenPage(screen, role);
  const url = new URL(href(target), location.href);
  if (target === 'academic-services') url.searchParams.set('screen', screen);
  let portalContext = null;
  if (screen === 'preferences' && context?._id) {
    const { _id, studentId, fullName, email, user } = context;
    portalContext = { _id, studentId, fullName, user: { fullName: user?.fullName, email: user?.email || email } };
  } else if (screen === 'student-schedules' && context?.draftStudent) {
    const { _id, studentId, fullName } = context.draftStudent;
    portalContext = { termId: context.termId, draftStudent: { _id, studentId, fullName } };
  }
  navigate(target, url, { portalScreen: screen, portalContext });
});
function startPreview(destination){
  localStorage.setItem(previewSessionKey,'1');
  const url = href(destination);
  returnAfterSignIn = 'overview';
  navigate(destination, url, history.state || {});
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
  localStorage.setItem('portal-account-role', data.user.role);
  sessionStorage.setItem(workspaceAccountNameKey, data.user.fullName || roleNames[data.user.role]);
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
    if (!(await signInDemoWorkspace(selected))) throw new Error('Sign in with your university account.');
    role = selected;
    startPreview(returnAfterSignIn);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    picker.disabled = false;
  }
}
function toast(text, tone = 'success', options) {
  document.querySelector('portal-action-feedback').show(tone, text, options);
}
function modal(title,content,submit='Save changes',action='save-modal'){
  returnFocus=document.activeElement;
  const form=submit===null?'':`<form id="modal-form" data-submit-action="${action}"><div id="modal-fields"></div><div class="form-footer">${button('Cancel','close-dialog')}<button class="btn primary" type="submit">${submit}</button></div></form>`;
  dialog.innerHTML=`<div class="modal-head"><h2 id="portal-dialog-title">${title}</h2>${action==='navigation'?button(icon('close'),'close-dialog','menu-close','aria-label="Close menu"'):form?button('Close','close-dialog','modal-close'):''}</div>${content}${form}`;
  dialog.setAttribute('aria-labelledby','portal-dialog-title');
  // Keep all form controls inside the form so native validation works.
  const fields=dialog.querySelectorAll(':scope > .modal-fields');
  fields.forEach(el=>dialog.querySelector('#modal-fields').replaceWith(el));
  if (document.body.dataset.portalRole !== 'coordinator') drawInputEdges(dialog);
  dialog.showModal();
}
function fields(content){return `<div class="modal-fields">${content}</div>`;}
function closeDialog(){dialog.close();if(returnFocus?.isConnected)returnFocus.focus();}
function action(name,el){
  if (name === 'toggle-theme') {
    window.revealPortalTheme(el, () => {
      lab.dark = !lab.dark;
      localStorage.setItem('portal.theme', lab.dark ? 'dark' : 'light');
      applyLook();
      el.outerHTML = themeControl();
    });
    return;
  }
  switch(name){
    case 'preview-sign-in':
      void choosePreviewRole(el);
      break;
    case 'sign-out':
      document.querySelector('portal-action-feedback').clear();
      {
        const token = localStorage.getItem(workspaceSessionKey);
        localStorage.removeItem(workspaceSessionKey);
        localStorage.removeItem('portal-account-role');
        sessionStorage.removeItem(workspaceAccountNameKey);
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
    case 'quick-find':modal('Find a page',fields('<label>Search pages<input id="page-finder" type="search" placeholder="Schedule, students, courses…" autofocus></label>')+`<nav class="page-results">${groups().flatMap(([,ids])=>ids).map(id=>navigationLink(id,navigationLabel(id),'navlink')).join('')}</nav>`,'Close','close');break;
    case 'retry-schedule-review': coordinatorSchedules = undefined; render(); break;
    case 'mobile-menu': {
      const sections = [...groups(), ['Account', ['profile']]];
      const menu = sections.map(([name,items])=>`<section>${name ? `<h3>${name}</h3>` : ''}<ul>${items.map(id=>
        `<li><a href="${href(id)}" data-page="${id}"${id===page?' aria-current="page"':''}>${navigationLabel(id)}</a></li>`
      ).join('')}</ul></section>`).join('');
      const semester = usesStaffPresentation() ? `<p class="menu-semester">Current semester · <span data-sidebar-term>${escapeHtml(sidebarTerm())}</span></p>` : '';
      modal('Menu',`<nav class="workspace-menu" aria-label="Main navigation">${semester}${menu}</nav>`,null,'navigation');
      break;
    }
    case 'read-all':void markPortalNotifications(notificationEntries().filter(item => !item.isRead).map(item => item._id), el);break;
    case 'read-one':void markPortalNotifications([el.dataset.notification], el);break;
    case 'close-dialog':closeDialog();break;
    case 'print-schedule':window.print();break;
    case 'download-my-schedule':
      fetch('../api/schedules/me/download', {headers:{Authorization:'Bearer '+localStorage.getItem(workspaceSessionKey)}}).then(async response => {
        if(!response.ok) throw new Error((await response.json()).message || 'Could not download schedule.');
        const url=URL.createObjectURL(await response.blob()); const a=document.createElement('a'); a.href=url; a.download='my-schedule.pdf'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      }).catch(error=>toast(error.message,'error')); break;
  }
}
let activeDeadline=null, noteTimer;
function closeDeadline(){
  clearTimeout(noteTimer);
  if(!activeDeadline)return;
  activeDeadline.closest('.folio-stack')?.querySelector('.deadline-shadow')?.remove();
  const note = activeDeadline.querySelector('.deadline-note');
  if (note?.matches(':popover-open')) note.hidePopover();
  note?.setAttribute('aria-hidden','true');
  activeDeadline.setAttribute('aria-pressed','false');
  activeDeadline.setAttribute('aria-expanded','false');
  activeDeadline.removeAttribute('aria-describedby');
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
  const note = mark.querySelector('.deadline-note');
  note.setAttribute('aria-hidden','false');
  note.showPopover();
  mark.setAttribute('aria-expanded','true');
  mark.setAttribute('aria-describedby',note.id);
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
  calendarMonth = control.dataset.calendarNav === 'today' ? 0 : previous + Number(control.dataset.calendarNav);
  if (calendarMonth === previous) return;
  const calendar = control.closest('.desk-calendar');
  const paper = calendar.querySelector('.folio-paper:not(.binder-waiting-sheet)');
  const scene = binderMotion.scene(paper.parentElement);
  const { month } = calendarDates();
  tintCalendar(calendar, month.getMonth());
  calendar.querySelector('.folio-agenda').innerHTML = calendarAgenda();
  calendar.querySelector('.calendar-month-status').textContent = month.toLocaleDateString('en-GB', {month:'long',year:'numeric'});
  if (!scene) {
    paper.innerHTML = calendarPage();
    return;
  }
  // Keep the navigation and the outgoing drawing's animation clock in place.
  const next = paper.cloneNode(false);
  next.removeAttribute('inert');
  next.removeAttribute('aria-hidden');
  next.innerHTML = calendarPage();
  paper.before(next);
  scene.turn(next, previous, calendarMonth);
});

function selectView(id) {
  if (tab === id) return;
  tab = id;
  render();
  const selected = document.querySelector(`[role="tab"][data-tab="${tab}"]`);
  selected?.focus({preventScroll:true});
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-page],[data-action],[data-tab]');if(!target)return;
  if(target.dataset.page){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();
    navigate(target.dataset.page,target.getAttribute('href'));}
  else if(target.dataset.tab)selectView(target.dataset.tab);
  else action(target.dataset.action,target);
});
document.addEventListener('input',event=>{if(event.target.id==='page-finder')document.querySelectorAll('.page-results a').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(event.target.value.toLowerCase()));});
document.addEventListener('submit',async event=>{
  event.preventDefault();
  if(event.target.id==='auth-form'){
    if(page==='login'){
      const {email,password} = Object.fromEntries(new FormData(event.target));
      const submit = event.submitter;
      if (submit) submit.disabled = true;
      try {
        if (email === previewEmail && password === 'portal-demo') {
          if (!(await signInDemoWorkspace(role))) throw new Error('Sign in with your university account.');
        }
        else role = await signInWorkspace({email,password});
        startPreview(returnAfterSignIn);
      } catch (error) {
        toast(error.message);
      } finally {
        if (submit) submit.disabled = false;
      }
    }
    else if(page==='forgot' || page==='reset'){
      const form = event.target;
      const submit = form.querySelector('button[type="submit"]');
      const feedback = form.querySelector('.auth-feedback');
      const values = Object.fromEntries(new FormData(form));
      const showFeedback = (message, error = false) => {
        feedback.textContent = message;
        feedback.hidden = false;
        feedback.classList.toggle('error', error);
      };
      if (page === 'reset' && values.password !== values.confirmPassword) {
        showFeedback('The passwords do not match.', true);
        return;
      }
      submit.disabled = true;
      feedback.hidden = true;
      try {
        const response = await fetch(`../api/identity/${page === 'forgot' ? 'forgot-password' : 'reset-password'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(page === 'forgot'
            ? { email: values.email }
            : { email: values.email, otp: values.otp, newPassword: values.password }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.message || 'Could not complete the password reset.');
        if (page === 'forgot') {
          navigate('reset');
          toast(data.message || 'If an active account exists for this email, a reset code will be sent.', 'info');
        } else {
          navigate('login');
          toast(data.message || 'Password reset successfully. Please sign in with your new password.', 'success');
        }
      } catch (error) {
        showFeedback(error.message || 'Could not complete the password reset. Please try again.', true);
      } finally {
        if (submit.isConnected) submit.disabled = false;
      }
    }

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
window.addEventListener('popstate',()=>{const p=normalizePortalLocation();page=pageKey(p.get('page'));returnAfterSignIn=returnPage(p.get('next'));role=Object.hasOwn(roleNames,p.get('role'))?p.get('role'):'coordinator';tab='';selectedCourse=resolveCourse(p.get('course'));restoreLook();render(true);});
window.addEventListener('storage',event=>{
  if (event.key === workspaceSessionKey) sessionStorage.removeItem(workspaceAccountNameKey);
  if (event.key===previewSessionKey && !signedIn() && !authPages.has(page)) {
    returnAfterSignIn = 'overview';
    navigate('login');
  }
});

render();
if (page === 'calendar-sync' && ['connected', 'error'].includes(params.get('calendar'))) {
  const success = params.get('calendar') === 'connected';
  toast(success ? 'Google Calendar connected.' : 'Google Calendar connection could not be completed.', success ? 'success' : 'error');
  const cleanUrl = new URL(location.href);
  cleanUrl.searchParams.delete('calendar');
  history.replaceState(history.state, '', cleanUrl);
}
function refreshStudentSchedule() {
  if (student() && ['overview','my-schedule','my-courses','course-detail'].includes(page) && !document.hidden && !liveStudent.loading) {
    liveStudent.token = null;
    loadStudentSchedule();
  }
}
window.addEventListener('focus', refreshStudentSchedule);
setInterval(refreshStudentSchedule, 30000);
