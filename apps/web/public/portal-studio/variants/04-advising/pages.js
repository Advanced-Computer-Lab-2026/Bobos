// Generated from src/ by node build.mjs. No external runtime dependencies.
/* Small, deterministic preview rules. The connected React adapters defer to the API. */
(function (global) {
  'use strict';
  const staff = ['advisor', 'coordinator'];
  const can = (role, task) => ({
    directory: ['coordinator', 'administrator'],
    'student-detail': ['advisor', 'coordinator', 'administrator'],
    advising: staff,
    'student-schedules': [...staff, 'administrator'],
    'draft-schedule': [...staff, 'administrator'],
    'mandatory-removals': [...staff, 'administrator'],
    edit: staff, assign: ['coordinator'], account: ['administrator'],
    removalRequest: ['advisor'], removalDecision: ['coordinator'],
    slotReview: staff,
  }[task] || []).includes(role);
  function allowance(student) {
    const standard = student.semester <= 4 ? 34 : student.semester <= 6 ? 30 : student.semester === 7 ? 28 : 24;
    const probation = Number(student.gpa) >= 3.7 || student.standing === 'Probation' || student.reason === 'Probation';
    return { standard, probation, allowed: probation ? Math.ceil(standard * .75) : standard };
  }
  const minutes = value => { const [h, m] = String(value).split(':').map(Number); return h * 60 + m; };
  const overlap = (a, b) => a.day === b.day && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
  function totals(draft, student, courses) {
    const selected = draft.courses.reduce((sum, code) => sum + (courses.find(c => c.code === code)?.credits || 0), 0);
    const base = allowance(student);
    const extra = base.probation ? 0 : (draft.extra?.approved && ['paid', 'deferred'].includes(draft.extra.settlement) ? draft.extra.hours : 0);
    return { selected, allowed: base.allowed, extra, remaining: base.allowed + extra - selected };
  }
  function validate(draft, student, courses, slots) {
    const issues = [], selectedSlots = [];
    for (const code of draft.mandatory) {
      if (!draft.removed.includes(code) && !draft.courses.includes(code)) issues.push(`Select mandatory course ${code}.`);
    }
    for (const code of draft.courses) {
      const course = courses.find(c => c.code === code);
      if (!course) { issues.push(`${code} is no longer in the catalogue.`); continue; }
      if (!course.published) issues.push(`${code} has no published offering.`);
      if (!course.eligible) issues.push(`${code} does not meet prerequisite or progression rules.`);
      for (const component of course.components) {
        const id = draft.slots[code]?.[component], slot = slots.find(s => s.id === id);
        if (!slot) { issues.push(`${code}: assign a ${component}.`); continue; }
        if (slot.course !== code || slot.component !== component) { issues.push(`${code}: invalid ${component} selection.`); continue; }
        if (slot.remaining <= 0 && !draft.reserved.includes(slot.id)) issues.push(`${code}: ${component} group ${slot.group} is full.`);
        selectedSlots.push(slot);
      }
    }
    for (let i = 0; i < selectedSlots.length; i++) for (let j = i + 1; j < selectedSlots.length; j++) {
      if (overlap(selectedSlots[i], selectedSlots[j])) issues.push(`${selectedSlots[i].course} and ${selectedSlots[j].course} clash on ${selectedSlots[i].day}.`);
    }
    if (!draft.courses.length) issues.push('Select at least one course.');
    if (totals(draft, student, courses).remaining < 0) issues.push('Selected credits exceed the allowed and activated extra hours.');
    if (draft.bachelor && !student.bachelorEligible) issues.push('Bachelor project eligibility is not satisfied.');
    if (draft.bachelor && !['Winter', 'Spring'].includes(draft.bachelor)) issues.push('Choose Winter or Spring for the bachelor project.');
    if (draft.bachelor) {
      const core = draft.courses.filter(code => courses.find(c => c.code === code)?.type === 'core').length;
      const huma = draft.courses.filter(code => courses.find(c => c.code === code)?.type === 'huma').length;
      if (core > 2 || huma > 2 || draft.courses.length > 4) issues.push('With the bachelor project, select at most two core and two humanities courses.');
      if (draft.courses.length && !(draft.extra?.approved && ['paid', 'deferred'].includes(draft.extra.settlement))) issues.push('Courses accompanying the bachelor project require extra-hours approval and a payment choice.');
    }
    return [...new Set(issues)];
  }
  function blockers(draft) {
    return [
      draft.pendingSlot ? 'Resolve the pending slot-change request.' : '',
      draft.pendingRemoval ? 'Resolve the mandatory-course removal request.' : '',
      draft.extra && !draft.extra.approved ? 'Extra-hours approval is still pending.' : '',
      draft.extra?.approved && !['paid', 'deferred'].includes(draft.extra.settlement) ? 'The student must choose payment or the next installment.' : '',
    ].filter(Boolean);
  }
  function status(draft) {
    if (draft.status === 'Processed') return 'Processed';
    if (draft.pendingSlot) return 'Change request pending';
    if (draft.pendingRemoval || (draft.extra && !draft.extra.approved)) return 'Pending approval';
    if (draft.extra?.approved && !['paid', 'deferred'].includes(draft.extra.settlement)) return 'Awaiting payment choice';
    return draft.status || 'Not started';
  }
  function removalEligible(student, reason) {
    if (reason === 'First makeup') return true;
    if (reason === 'Second makeup') return student.failedCount >= 1 && student.failedCount <= 2;
    if (reason === 'Completed hours') return student.completedHours > 157;
    if (reason === 'Restricted pair') return !!student.restrictedPair;
    return false;
  }
  function filter(records, values) {
    const search = (values.search || '').trim().toLowerCase();
    return records.filter(record => {
      if (search && ![record.name, record.id, record.studentId, record.email, record.course, record.advisor, record.advisorEmail].join(' ').toLowerCase().includes(search)) return false;
      return Object.entries(values).every(([key, value]) => {
        if (!value || ['search','focus','compare','letter'].includes(key)) return true;
        if (key === 'from') return record.date >= value;
        if (key === 'to') return record.date <= value;
        return String(record[key] ?? '') === String(value);
      });
    });
  }
  const api = { can, allowance, minutes, overlap, totals, validate, blockers, status, removalEligible, filter };
  global.PortalAdvisingRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  'use strict';
  const reduced = () => global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // These are exposed drawings, not a tween of the entire illustration.
  const folderPoses = [
    ['M10 26Q27 24 53 26L55 52 11 54Z','M15 23 27 22 29 25 52 24 52 48 15 49Z'],
    ['M10 26Q28 23 53 25L55 52 11 54Z','M15 21 27 20 29 23 52 22 52 48 15 49Z'],
    ['M9 29Q30 23 55 28L55 52 11 54Z','M16 15 28 15 30 18 51 17 52 48 15 49Z'],
    ['M8 34Q30 28 57 33L55 52 11 54Z','M16 11 28 12 30 14 51 13 52 48 15 49Z'],
    ['M8 36Q30 31 57 35L55 52 11 54Z','M16 10 28 11 30 13 51 12 52 48 15 49Z'],
    ['M8 35Q30 30 57 34L55 52 11 54Z','M16 11 28 11 30 13 51 12 52 48 15 49Z'],
  ];
  function folder() {
    return `<svg class="ad4-art" data-ad4-art="folder" viewBox="0 0 64 64" fill="none" stroke="#443e34" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 24 27 22 31 25 52 24 55 51 12 54Z" fill="#9bb7c0"/><path data-part="paper" d="${folderPoses[0][1]}" fill="#f2eee1"/><path data-part="writing" d="M22 28 43 27m-21 6 17-1m-17 6 11-.5" stroke="#827765"/><path data-part="cover" d="${folderPoses[0][0]}" fill="#b5c9c1"/><path d="m19 42 14-1" stroke="#617d72"/></svg>`;
  }
  function play(el) {
    if (!el || reduced()) return;
    const svg = el.matches?.('[data-ad4-art]') ? el : el.querySelector('[data-ad4-art]');
    if (!svg) return;
    const token = String(Date.now()); svg.dataset.play = token;
    const kind = svg.dataset.ad4Art;
    const exposures = kind === 'letter' ? [0, 1, 3, 5, 7, 9, 9, 9] : kind === 'conversation' ? [0, 1, 2, 1, 2, 0] : [0, 1, 2, 3, 4, 4, 5];
    const holds = [0, 100, 190, 290, 420, 600, 850, 1100];
    exposures.forEach((pose, i) => global.setTimeout(() => {
      if (!svg.isConnected || svg.dataset.play !== token || reduced()) return;
      if (kind === 'folder') {
        svg.querySelector('[data-part=cover]')?.setAttribute('d', folderPoses[pose][0]);
        svg.querySelector('[data-part=paper]')?.setAttribute('d', folderPoses[pose][1]);
        svg.querySelector('[data-part=writing]')?.setAttribute('transform', `translate(0 ${pose > 2 ? -8 : pose > 1 ? -4 : 0})`);
      } else if (kind === 'letter') {
        const strip = svg.querySelector('.letter-strip'); if (strip) { strip.style.animation = 'none'; strip.style.transform = `translateX(${-64 * pose}px)`; }
      } else {
        const q = svg.querySelector('.question-outline');
        const paths = ['M7 17Q9 8 26 9Q44 7 43 22Q43 32 23 33L11 40L14 31Q4 29 7 17Z', 'M7 17Q8 8 26 9Q44 8 43 22Q44 31 23 33L11 40L14 31Q5 29 7 17Z', 'M7 17Q10 8 26 9Q43 7 43 22Q43 33 23 33L11 40L14 31Q4 28 7 17Z'];
        q?.setAttribute('d', paths[pose]);
      }
      svg.dataset.pose = String(pose);
    }, holds[i]));
  }
  global.PortalAdvisingMotion = { folder, play, reduced };
})(window);

/* Portal / 04-advising. Loaded by the supplied host; it never owns the shell. */
(function () {
  'use strict';
  const R = window.PortalAdvisingRules, Motion = window.PortalAdvisingMotion;
  const base = new URL('.', document.currentScript.src);
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('styles.css', base); document.head.append(style);
  const keys = ['directory','student-detail','advising','student-schedules','draft-schedule','mandatory-removals'];
  const titles = {
    directory: ['Student register','Filter rail','Student review desk','Workflow lanes','Student files','Blocking-step queue','Advisor groups','Compact ledger','Compare students','Alphabetical index'],
    advising: ['Advising register','Assigned-student rail','Review desk','Workflow lanes','Advising files','Next review','By advisor','Reason ledger','Compare workloads','Student index'],
    'student-schedules': ['Schedule register','Status rail','Schedule review desk','Workflow lanes','Schedule files','Processing queue','By advisor','Readiness ledger','Compare schedules','Recent updates'],
    'mandatory-removals': ['Request register','Decision filters','Decision desk','Status lanes','Request letters','Oldest pending first','By advisor','Course ledger','Compare requests','Submission timeline'],
    'student-detail': ['Student dossier','Workflow first','Two-page record','Academic history first','Schedule first','Advisor handover','Compact record','Open sections','Review checklist','Record with context'],
    'draft-schedule': ['Course desk','Timetable first','Validation rail','Mandatory first','Course inspector','Three-step review','Preferences beside plan','Weekly ledger','Open binder','Processing desk'],
  };
  const storeKey = 'portal-ad4-preview:v2';
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = (q, root = document) => root.querySelector(q), $$ = (q, root = document) => [...root.querySelectorAll(q)];
  function el(tag, cls, html = '') { const node = document.createElement(tag); node.className = cls; node.innerHTML = html; return node; }
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  function say(text, tone) { if (typeof toast === 'function') toast(text, tone); }
  function btn(text, action, extra = '', cls = '') { return `<button type="button" class="btn ${cls}" data-ad4-action="${action}" ${extra}>${text}</button>`; }
  function pill(text) { return `<span class="badge ${/Processed|Approved|Active|Ready/.test(text) ? 'ready' : /pending|Pending|Draft|Reopened/.test(text) ? 'pending' : 'neutral'}">${E(text)}</span>`; }
  function art(kind = 'folder') {
    if (kind === 'folder') return Motion.folder();
    const markup = queueSketch(kind === 'letter' ? 'course-removal' : 'advisor-assignment');
    return markup.replace('<svg ', `<svg data-ad4-art="${kind}" `).replace('class="queue-sketch"', 'class="queue-sketch ad4-art"');
  }
  function courses() {
    return courseData.map(([code, name, , credits], i) => ({ code, name, credits: +credits, type: 'core', published: true, eligible: true,
      components: i === 2 ? ['lecture','lab'] : ['lecture','tutorial'], season: 'Winter', prerequisites: i === 3 ? 'DMET 501' : 'Completed prior-year core' }));
  }
  function slots() {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday'];
    const timings = [['Sunday','08:30','10:00','Tuesday','10:00','11:30'],['Tuesday','08:30','10:00','Sunday','12:00','13:30'],['Tuesday','14:00','15:30','Monday','10:00','11:30'],['Wednesday','12:00','13:30','Monday','12:00','13:30'],['Wednesday','10:00','11:30','Thursday','10:00','11:30'],['Sunday','10:00','11:30','Wednesday','14:00','15:30']];
    return courses().flatMap((c, i) => c.components.flatMap((component, j) => [4, 2, 9].map(group => ({
      id: `${c.code}:${component}:${group}`, course: c.code, component, group,
      day: group === 2 ? 'Thursday' : group === 9 ? 'Tuesday' : timings[i][j * 3],
      start: group === 2 ? (j ? '12:00' : '08:30') : group === 9 ? '08:30' : timings[i][j * 3 + 1],
      end: group === 2 ? (j ? '13:30' : '10:00') : group === 9 ? '10:00' : timings[i][j * 3 + 2],
      room: `C${i + 1}.${j ? '204' : '301'}`, remaining: group === 9 ? 0 : group === 2 ? 3 : 8 + i,
    }))));
  }
  function initial() {
    const cs = courses();
    const students = names.map((name, i) => ({ index: i, name, id: `70-${71577 + i}`, email: name.toLowerCase().replaceAll(' ','.') + '@student.guc.edu.eg',
      type: i && i % 3 === 0 ? 'Normal' : 'Advising', major: i === 3 ? 'Digital Media Engineering' : 'Computer Engineering', semester: 7,
      standing: i === 4 ? 'Probation' : 'Very good', gpa: i === 4 ? 3.8 : 1.8 + (i % 4) * .2,
      advisor: [2,8].includes(i) ? 'Unassigned' : i > 6 ? 'Dr. Hany Youssef' : 'Dr. Salma Adel',
      advisorEmail: i > 6 ? 'hany.youssef@guc.edu.eg' : 'salma.adel@guc.edu.eg',
      preferences: i===2?null:['Thursday off','Prefer group 4','No classes before 08:30'], preferenceUpdated:'12 Nov 2026',
      reason: i === 4 ? 'Probation' : i % 2 ? 'Unattended courses' : 'More than two failed courses',
      account: i === 11 ? 'Inactive' : 'Active', completedHours: i === 1 ? 160 : 134, failedCount: i === 1 ? 2 : 3,
      restrictedPair: i === 2, bachelorEligible: i === 1,
      history: [{ date: '5 Oct 2026', title: 'Advisor assigned', detail: 'Dr. Salma Adel' }],
    }));
    const drafts = students.map((s, i) => {
      const chosen = scheduleStates[i] === 'Not started' ? [] : cs.slice(0,4).map(c => c.code);
      const selected = Object.fromEntries(chosen.map(code => [code, Object.fromEntries(cs.find(c => c.code === code).components.map(t => [t, `${code}:${t}:4`]))]));
      if (i === 1) delete selected['CSEN 704'].lab;
      return { courses: chosen, mandatory: i===2?['CSEN 701','CSEN 703','CSEN 704']:['CSEN 701','CSEN 703'], removed: [], slots: selected, reserved: Object.values(selected).flatMap(Object.values),
        status: scheduleStates[i] === 'Ready for review' ? 'Ready for student review' : scheduleStates[i], version: 1, savedAt: '13 Nov 2026, 10:42',
        pendingRemoval: [0,1,2].includes(i), pendingSlot: i === 7, extra: i===11?{approved:true,hours:2,settlement:''}:null, bachelor: '', history: [] };
    });
    return { version: 2, students, drafts, advisors: [{name:'Dr. Salma Adel',email:'salma.adel@guc.edu.eg',active:true},{name:'Dr. Hany Youssef',email:'hany.youssef@guc.edu.eg',active:true},{name:'Dr. Dina Samir',email:'dina.samir@guc.edu.eg',active:false}],
      removals: students.slice(0,3).map((s,i)=>({ id:`MR-${1042+i}`, student:i, course:cs[i].code, reason:['First makeup','Completed hours','Restricted pair'][i], note:['Eligible for a first makeup. Please retain the makeup route instead of a repeat.','160 completed hours; requesting deferral under the completed-hours rule.','Requesting deferral to avoid a restricted course pair.'][i], status:'Pending', date:`2026-11-${13+i}`, advisor:s.advisor === 'Unassigned' ? 'Dr. Salma Adel' : s.advisor, advisorEmail:'salma.adel@guc.edu.eg', response:'', decidedAt:'' })) };
  }
  function state() { const value = read(storeKey, null); return value?.version === 2 ? value : initial(); }
  function save(value) { const ok = write(storeKey, value); if (!ok) say('Browser storage is unavailable. Keep this page open; changes cannot be retained.', 'warning'); return ok; }
  function record(student, data) {
    const draft = data.drafts[student.index], issues = R.validate(draft, student, courses(), slots()), blocks = R.blockers(draft);
    return { ...student, status: student.type === 'Normal' ? 'Schedule assigned' : R.status(draft), blocking: student.type === 'Normal' ? 'None' : blocks[0] || issues[0] || 'None',
      pending: draft.pendingSlot ? 'Slot change' : draft.pendingRemoval ? 'Course removal' : draft.extra ? 'Extra hours' : 'None', updated: draft.savedAt, draft };
  }
  function facts(items) { return `<dl class="ad4-facts">${items.map(([k,v])=>`<div><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`).join('')}</dl>`; }
  function jump(page, text, index, cls = 'btn') { return link(page, text, cls, index); }
  function section(title, cls, content) { return el('section', `ad4-section ${cls}`, `<h2>${title}</h2>${content}`); }
  function addNotice(root, text) { const node = el('p','ad4-notice',text); $('.page-head',root)?.after(node); return node; }
  function setup(root, page, role, index) {
    root.dataset.ad4 = ''; root.dataset.ad4Design = String(index + 1); root.dataset.ad4Page = page;
    root.classList.add('ad4');
    if (!R.can(role, page)) {
      const head = $('.page-head', root); root.replaceChildren(); if (head) root.append(head);
      root.append(section('This page is not available for your role', 'ad4-unavailable', `<p>Use the pages in your navigation. Student records and decisions remain restricted to authorized staff.</p>${jump('overview','Back to Overview',0)}`));
      return false;
    }
    return true;
  }
  function redraw() { render(); }
  function confirmDialog(root, { title, body, submit = 'Confirm', onSubmit, danger = false }) {
    const focus = document.activeElement;
    const dialog = el('dialog','ad4-dialog');
    dialog.setAttribute('aria-labelledby','ad4-dialog-title');
    dialog.innerHTML = `<form class="ad4-dialog-form"><header><h2 id="ad4-dialog-title">${title}</h2><button type="button" class="btn" data-close>Close</button></header>${body}<p class="ad4-error feedback error" role="alert" hidden></p><footer><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${submit}</button></footer></form>`;
    root.append(dialog);
    $$('[data-close]',dialog).forEach(b=>b.onclick=()=>dialog.close());
    dialog.addEventListener('close',()=>{ dialog.remove(); if (focus?.isConnected) focus.focus(); });
    dialog.addEventListener('submit',event=>{
      event.preventDefault(); event.stopPropagation();
      if (!event.target.reportValidity()) return;
      const error = onSubmit?.(new FormData(event.target), dialog);
      if (typeof error === 'string') { const note=$('.ad4-error',dialog); note.hidden=false; note.textContent=error; note.focus(); return; }
      dialog.close();
    });
    dialog.addEventListener('click', event=>{ if(event.target===dialog) dialog.close(); });
    dialog.showModal();
    Motion.play(dialog);
    return dialog;
  }
  function assignment(root, student, data, role) {
    if (!R.can(role,'assign')) return;
    confirmDialog(root, { title: 'Assign an advisor', submit: 'Save assignment', body: `<div class="ad4-dialog-identity">${art('conversation')}<div><strong>${E(student.name)}</strong><p>${E(student.id)} · Current: ${E(student.advisor)}</p></div></div><p>Reassignment keeps the schedule, requests, plans and previous advisor history.</p><label class="ad4-field">Advisor<select name="advisor" required><option value="">Choose an active advisor</option>${data.advisors.filter(a=>a.active).map(a=>`<option ${a.name===student.advisor?'selected':''}>${E(a.name)}</option>`).join('')}</select></label>`, onSubmit: values=>{
      const current=data.students[student.index], selected=data.advisors.find(a=>a.active&&a.name===values.get('advisor'));
      if (!selected) return 'Choose an active advisor in the advising system.';
      if (current.advisor!==selected.name) current.history.push({date:'20 Nov 2026', title:'Advisor reassigned',detail:`${current.advisor} → ${selected.name}`});
      current.advisor=selected.name; current.advisorEmail=selected.email;
      if (save(data)) say('Advisor assignment saved in this preview.'); setTimeout(redraw,0);
    }});
  }
  function account(root, student, data, role) {
    if (!R.can(role,'account')) return;
    confirmDialog(root,{title: `${student.account==='Active'?'Deactivate':'Activate'} this account?`,submit: student.account==='Active'?'Deactivate account':'Activate account',danger:student.account==='Active',body:`<p><strong>${E(student.name)}</strong> · ${E(student.email)}</p><p>Deactivation prevents login. Academic records, schedules and audit history are kept. This preview does not revoke a real session.</p>`,onSubmit:()=>{
      data.students[student.index].account=student.account==='Active'?'Inactive':'Active';if (save(data)) say('Account status updated in this preview.');setTimeout(redraw,0);
    }});
  }
  function management(root,data,role) {
    if (role!=='coordinator') return;
    const box=section('Advisor access','ad4-management',`<div class="ad4-inline-art">${art('conversation')}<p>Look up an existing advisor by GUC email. Membership and student assignment are separate actions.</p></div><form class="ad4-lookup"><label class="ad4-field">Advisor GUC email<input type="email" name="email" required placeholder="salma.adel@guc.edu.eg"></label><button class="btn" type="submit">Look up advisor</button></form><div class="ad4-lookup-result" aria-live="polite"></div>`);
    root.append(box);
    $('.ad4-lookup',box).addEventListener('submit',event=>{
      event.preventDefault();event.stopPropagation();
      const email=new FormData(event.target).get('email').trim().toLowerCase(), person=data.advisors.find(a=>a.email===email), result=$('.ad4-lookup-result',box);
      if(!person){ result.innerHTML='<p class="feedback error" role="alert">No preview advisor has that email. Try salma.adel@guc.edu.eg, hany.youssef@guc.edu.eg or dina.samir@guc.edu.eg.</p>';return; }
      result.innerHTML=`<div class="ad4-access-result"><div><strong>${E(person.name)}</strong><small>${E(person.email)}</small></div>${pill(person.active?'In advising system':'Not in advising system')}${btn(person.active?'Remove advisor':'Add advisor','membership')}</div>`;
      $('[data-ad4-action=membership]',result).onclick=()=>confirmDialog(root,{title:person.active?'Remove advising access?':'Add advising access?',submit:person.active?'Remove advisor':'Add advisor',body:`<p>${E(person.name)} · ${E(person.email)}</p><p>${person.active?'Current assignments will be cleared. Previous schedule actions and advisor history remain available.':'This advisor will become available for assignment.'}</p><p>Email is simulated in this preview; no email is sent.</p>`,onSubmit:()=>{
        person.active=!person.active;
        if(!person.active)data.students.forEach(s=>{if(s.advisor===person.name){s.history.push({date:'20 Nov 2026',title:'Advisor removed from system',detail:person.name});s.advisor='Unassigned';s.advisorEmail='';}});
        if (save(data)) say('Advisor membership updated in this preview; email not sent.');setTimeout(redraw,0);
      }});
      Motion.play(box);
    });
  }
  function makeFilters(root, page, role, records, index) {
    const key=`portal-ad4-filters:${role}:${page}`, values=read(key,{});
    const toolbar=$('.toolbar',root), fields=$('.filters',toolbar), search=$('#search',fields);
    const originalSelects=$$('select',fields); fields.replaceChildren();
    search.placeholder=page==='mandatory-removals'?'Student ID, course, advisor name or email':'Student ID, full name or GUC email'; search.setAttribute('aria-label','Search records');search.value=values.search||'';
    const label=el('label','ad4-field ad4-search','<span>Search</span>');label.append(search);fields.append(label);
    const definitions=page==='mandatory-removals'?[['status','Request status'],['advisor','Advisor'],['from','From'],['to','To']]:page==='advising'?[['advisor','Advisor'],['major','Major'],['reason','Advising reason'],['status','Schedule status'],['pending','Pending request']]:page==='student-schedules'?[['status','Schedule status'],['advisor','Advisor'],['pending','Pending request'],['type','Student type']]:[['type','Student type'],['advisor','Advisor'],['major','Major'],['semester','Semester'],['standing','Academic standing'],['status','Workflow status'],['blocking','Blocking step'],['account','Account status']];
    const more=el('details','ad4-more-filters','<summary>More filters</summary><div class="ad4-extra-filters"></div>');more.open=index===1;
    definitions.forEach(([field,text],i)=>{
      const wrap=el('label','ad4-field',`<span>${text}</span>`);let input;
      if(['from','to'].includes(field)){input=document.createElement('input');input.type='date';}
      else { input=originalSelects.shift()||document.createElement('select');input.innerHTML='<option value="">All</option>'+[...new Set(records.map(r=>r[field]).filter(v=>v!==undefined&&v!==''))].sort((a,b)=>String(a).localeCompare(String(b))).map(v=>`<option value="${E(v)}">${E(v)}</option>`).join(''); }
      input.dataset.ad4Filter=field;input.removeAttribute('data-filter');input.setAttribute('aria-label',text);input.value=values[field]||'';wrap.append(input);
      if(i<2||index===1)fields.append(wrap);else $('.ad4-extra-filters',more).append(wrap);
    });
    if($('.ad4-extra-filters',more).children.length)fields.append(more);
    fields.insertAdjacentHTML('beforeend',btn('Clear filters','clear-filters','','text'));
    const count=el('div','ad4-filter-result',`<span aria-live="polite" data-ad4-count></span>${page==='advising'?btn('My assigned students','my-students','','text'):''}`);toolbar.append(count);
    const error=el('p','ad4-error');error.setAttribute('role','alert');error.hidden=true;toolbar.append(error);
    const persist=()=>write(key,values);
    const update=()=>{
      const invalid=values.from&&values.to&&values.from>values.to;
      error.hidden=!invalid;error.textContent=invalid?'The end date must be on or after the start date.':'';
      const filtered=invalid?[]:R.filter(records,values).filter(r=>!values.letter||r.name.startsWith(values.letter));
      const ids=new Set(filtered.map(r=>String(r.rid)));
      $$('[data-ad4-record]',root).forEach(row=>row.hidden=!ids.has(row.dataset.ad4Record));
      $$('[data-ad4-group]',root).forEach(group=>group.hidden=!group.querySelector('[data-ad4-record]:not([hidden])'));
      const empty=$('.ad4-empty',root);if(empty)empty.hidden=filtered.length>0;
      $('[data-ad4-count]',root).textContent=`${filtered.length} of ${records.length} ${page==='mandatory-removals'?'requests':'students'}`;
      const foot=$('#result-count',root);if(foot)foot.textContent=`${filtered.length} ${page==='mandatory-removals'?'requests':'students'}`;
      root._ad4Shown=filtered;
      if(page==='mandatory-removals')$$('[data-tab]',root).forEach(b=>{const current=values.status?.toLowerCase()===b.dataset.tab;b.setAttribute('aria-selected',String(current));b.classList.toggle('active',current);});
      persist();root.dispatchEvent(new CustomEvent('ad4-filtered'));
    };
    root.addEventListener('input',event=>{if(event.target===search){event.stopPropagation();values.search=search.value;update();}},true);
    root.addEventListener('change',event=>{const f=event.target.dataset.ad4Filter;if(f){event.stopPropagation();values[f]=event.target.value;update();}},true);
    root.addEventListener('click',event=>{
      const action=event.target.closest('[data-ad4-action]')?.dataset.ad4Action;
      if(action==='clear-filters'){event.preventDefault();event.stopPropagation();Object.keys(values).forEach(k=>{if(!['focus','compare'].includes(k))delete values[k];});search.value='';$$('[data-ad4-filter]',root).forEach(n=>n.value='');$$('[data-letter]',root).forEach(b=>b.setAttribute('aria-pressed','false'));update();search.focus();}
      if(action==='my-students'){event.preventDefault();event.stopPropagation();values.advisor='Dr. Salma Adel';$('[data-ad4-filter=advisor]',root).value=values.advisor;update();}
      const tab=event.target.closest('[data-tab]');
      if(page==='mandatory-removals'&&tab){event.preventDefault();event.stopPropagation();values.status=tab.dataset.tab[0].toUpperCase()+tab.dataset.tab.slice(1);$('[data-ad4-filter=status]',root).value=values.status;update();}
    },true);
    return { toolbar,values,update,persist };
  }
  function makeContext(root,page,role,data,records,filters,index) {
    const context=el('aside','ad4-context');context.setAttribute('aria-label','Selected record');
    function show(r) {
      if(!r){context.innerHTML='<h2 tabindex="-1">No matching record</h2><p>Clear or change the filters to continue.</p>';return;}
      filters.values.focus=r.rid;filters.persist();
      $$('[data-ad4-record]',root).forEach(row=>row.classList.toggle('ad4-selected',row.dataset.ad4Record===String(r.rid)));
      const s=data.students[r.index??r.student], d=data.drafts[s.index];
      const title=page==='mandatory-removals'?`${r.course} · ${r.id}`:s.name;
      const details=page==='mandatory-removals'?facts([['Student',`${s.name} · ${s.id}`],['Advisor',r.advisor],['Submitted',r.date],['Grounds',r.reason]]):facts([['Student ID',s.id],['GUC email',s.email],['Advisor',s.advisor],['Major / semester',`${s.major} · ${s.semester}`],['Academic standing',s.standing],['Account',s.account]]);
      context.innerHTML=`<div class="ad4-context-head">${art(page==='mandatory-removals'?'letter':'folder')}<div><span class="ad4-caption">${page==='mandatory-removals'?'Selected request':'Selected student'}</span><h2 tabindex="-1">${E(title)}</h2></div></div>${pill(r.status)}${details}${page==='mandatory-removals'?`<div class="ad4-reason"><h3>Advisor’s reason</h3><p>${E(r.note)}</p></div>${r.response?`<h3>Decision note</h3><p>${E(r.response)}</p>`:''}`:`<div class="ad4-next"><h3>Next step</h3><p>${E(r.blocking==='None'?'No outstanding blocker. Open the record to review.':r.blocking)}</p></div>`}<div class="actions">${page==='mandatory-removals'?btn(r.status==='Pending'&&role==='coordinator'?'Review decision':'View request','context-removal',`data-request="${E(r.id)}"`,'primary'):jump(page==='student-schedules'?'draft-schedule':'student-detail',page==='student-schedules'?'Open schedule':'Open student',s.index,'btn primary')}${btn('Next record','next-record','','text')}</div>`;
      $('[data-ad4-action=next-record]',context).onclick=()=>{const rows=root._ad4Shown||records;const at=rows.findIndex(x=>x.rid===r.rid);show(rows[(at+1)%rows.length]);$('h2',context)?.focus({preventScroll:true});};
      $('[data-ad4-action=context-removal]',context)?.addEventListener('click',()=>removalDialog(root,r,data,role));
      Motion.play(context);
    }
    root.addEventListener('click',event=>{
      const control=event.target.closest('[data-ad4-inspect]');if(!control)return;
      event.preventDefault();event.stopPropagation();show(records.find(r=>String(r.rid)===control.dataset.ad4Inspect));
      if(index===2||index===5)$('h2',context)?.focus({preventScroll:true});
    },true);
    root.addEventListener('ad4-filtered',()=>{const shown=root._ad4Shown;show(shown.find(r=>String(r.rid)===String(filters.values.focus))||shown[0]);});
    return { node:context,show };
  }
  function groupedTables(wrap, table, records, rows, keyFor, lane=false) {
    const header=$('thead',table).cloneNode(true), groups=new Map();
    records.forEach((r,i)=>{const k=keyFor(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(rows[i]);});
    const grid=el('div',lane?'ad4-lanes':'ad4-groups');
    for(const [name,items] of groups){
      const group=lane?el('section','ad4-group'):el('details','ad4-group');group.dataset.ad4Group='';
      if(lane)group.append(el('h2','',E(name)));else{group.open=true;group.append(el('summary','',`${E(name)} <span class="ad4-caption">${items.length}</span>`));}
      const t=document.createElement('table');t.append(header.cloneNode(true));const body=document.createElement('tbody');items.forEach(row=>body.append(row));t.append(body);group.append(t);grid.append(group);
    }
    table.remove();wrap.prepend(grid);
  }
  function listPage(root,page,role,index) {
    const data=state(), table=$('table',root), wrap=table.closest('.tablewrap');
    const originals=$$('tbody tr',table), isRemoval=page==='mandatory-removals';
    let records=isRemoval?data.removals.map(r=>({...r,...{name:data.students[r.student].name,email:data.students[r.student].email,studentId:data.students[r.student].id,rid:r.id,index:r.student}})):data.students.map(s=>({...record(s,data),rid:s.index,date:`2026-11-${13+s.index%4}`}));
    if(page==='advising')records=records.filter(r=>r.type==='Advising');
    if(isRemoval&&role==='advisor')records=records.filter(r=>r.advisor==='Dr. Salma Adel');
    const tbody=$('tbody',table);tbody.replaceChildren();
    const headers=$$('th',table);
    if(!isRemoval&&page!=='student-schedules'){headers[3].textContent='Type / advisor';headers[4].textContent='Workflow / next step';}
    if(!isRemoval&&page==='student-schedules')headers[2].textContent='Status / validation';
    const rows=records.map((r,i)=>{
      const row=(isRemoval?(originals[i]||originals[0].cloneNode(true)):originals[r.index])||originals[0].cloneNode(true), cells=$$('td',row);
      row.dataset.ad4Record=String(r.rid);row.dataset.searchRow='';
      if(isRemoval){
        const s=data.students[r.student];cells[0].innerHTML=staffIdentity(s.name,s.id)+`<small>${E(r.advisor)}</small>`;cells[1].innerHTML=`<strong>${E(r.course)}</strong><small>${E(courses().find(c=>c.code===r.course)?.name)}</small>`;cells[2].innerHTML=`<strong>${E(r.reason)}</strong><small class="ad4-request-note">${E(r.note)}</small>`;cells[3].textContent=r.date;cells[4].innerHTML=pill(r.status);
        const control=$('button',cells[5]);control.textContent=r.status==='Pending'&&role==='coordinator'?'Review request':'View request';control.setAttribute('aria-label',`${control.textContent}: ${s.name}, ${r.course}`);control.dataset.ad4Request=r.id;
      }else{
        const s=data.students[r.index];cells[0].innerHTML=staffIdentity(s.name,s.id)+`<small class="ad4-email">${E(s.email)}</small>`;
        if(page==='student-schedules'){
          cells[1].innerHTML=`${E(s.major)}<small>Semester ${s.semester} · ${s.type}</small><small>${E(s.advisor)}</small>`;
          cells[2].innerHTML=pill(r.status)+`<small class="ad4-blocker">${E(r.blocking)}</small>`;cells[3].innerHTML=`${E(r.date)}<small>10:42 · Version ${r.draft.version}</small>`;
          const a=$('a',cells[4]);a.textContent=role==='administrator'?'View schedule':s.type==='Normal'?'View weekly schedule':r.draft.status==='Draft'?'Edit draft':'Review schedule';
        }else{
          cells[1].innerHTML=E(s.major);cells[2].textContent=s.semester;cells[3].innerHTML=`${s.type}<small>${E(s.advisor)}</small><small>${E(s.standing)} · ${s.account}</small>`;
          cells[4].innerHTML=pill(r.status)+`<small class="ad4-blocker">${E(r.blocking)}</small><small>Updated ${r.date}, 10:42</small>`;
        }
      }
      cells.forEach((cell,j)=>{cell.dataset.label=headers[j]?.textContent||'Actions';});
      if([2,5].includes(index))cells.at(-1).insertAdjacentHTML('afterbegin',`<button type="button" class="btn text ad4-inspect" data-ad4-inspect="${E(r.rid)}">${isRemoval?'Read letter':'Inspect'}</button>`);
      if(index===8)cells[0].insertAdjacentHTML('afterbegin',`<label class="ad4-compare-check"><input type="checkbox" data-ad4-compare="${E(r.rid)}" aria-label="Compare ${E(r.name)}${isRemoval?' '+E(r.course):''}"><span>Compare</span></label>`);
      tbody.append(row);return row;
    });
    const filters=makeFilters(root,page,role,records,index);
    const heading=$('.page-head',root);
    if(page==='advising'){
      $('p',heading).textContent='Browse all advising students, or narrow the list to your assignments.';
      if(role!=='coordinator')$('[data-action=assign-advisor]',heading)?.remove();
    }
    if(page==='student-schedules'&&role==='administrator')$('[data-page=draft-schedule]',heading)?.remove();
    const nativeEmpty=$('.search-empty',root);if(nativeEmpty)nativeEmpty.remove();
    const empty=el('div','ad4-empty',`<h2>No matching ${isRemoval?'requests':'students'}</h2><p>Change your search or clear the filters. Your selections are kept when you open a record.</p>${btn('Clear filters','clear-filters','','text')}`);wrap.append(empty);
    const body=el('div',`ad4-list-layout ad4-list-${index+1}`);heading.after(body);body.append(filters.toolbar,wrap);
    const nativeTabs=$('.tabs',root);if(nativeTabs)filters.toolbar.prepend(nativeTabs);
    const progress=$('.review-progress',root);if(progress)progress.remove(); // Replace a decorative distribution with actual blockers per student.
    const foot=$('.tablefoot',root);if(foot){body.append(foot);$('span:last-child',foot).textContent='Sample data · changes stay in this browser';}
    if([2,5].includes(index)){const context=makeContext(root,page,role,data,records,filters,index);body.append(context.node);}
    if(index===3){
      groupedTables(wrap,table,records,rows,r=>isRemoval?r.status:/Processed|assigned/.test(r.status)?'Finalized':/Ready/.test(r.status)?'Student review':/pending|Pending|Awaiting/.test(r.status)?'Awaiting action':'Open drafts',true);
    }
    if(index===6)groupedTables(wrap,table,records,rows,r=>r.advisor);
    if(index===7&&isRemoval)groupedTables(wrap,table,records,rows,r=>r.course);
    if(index===7&&page==='advising')groupedTables(wrap,table,records,rows,r=>r.reason);
    if(index===9){
      if(isRemoval||page==='student-schedules')groupedTables(wrap,table,records,rows,r=>r.date);
      else{
        const letters=[...new Set(records.map(r=>r.name[0]))].sort();const alphabet=el('nav','ad4-alphabet',`<span>Student index</span>${letters.map(letter=>`<button type="button" data-letter="${letter}" aria-pressed="${filters.values.letter===letter}">${letter}</button>`).join('')}<button type="button" data-letter="">All</button>`);alphabet.setAttribute('aria-label','Filter by first initial');wrap.before(alphabet);
        alphabet.onclick=event=>{const control=event.target.closest('[data-letter]');if(!control)return;filters.values.letter=control.dataset.letter;$$('[data-letter]',alphabet).forEach(b=>b.setAttribute('aria-pressed',String(b===control)));filters.update();};
        groupedTables(wrap,table,records,rows,r=>r.name[0]);
      }
    }
    if(index===5){
      const sorted=[...rows].sort((a,b)=>{
        const ar=records.find(r=>String(r.rid)===a.dataset.ad4Record),br=records.find(r=>String(r.rid)===b.dataset.ad4Record);
        return isRemoval?ar.date.localeCompare(br.date):Number(br.blocking!=='None')-Number(ar.blocking!=='None');
      });sorted.forEach((row,i)=>{row.dataset.ad4Order=String(i+1).padStart(2,'0');tbody.append(row);});
    }
    if(index===8){
      const compare=section('Compare records','ad4-comparison','<p>Select two records below. Comparison does not change either student’s schedule or request.</p>');wrap.before(compare);
      let picked=Array.isArray(filters.values.compare)?filters.values.compare.slice(0,2):[];
      const show=()=>{
        compare.innerHTML='<h2>Compare records</h2>'+(picked.length?`<div class="ad4-compare-grid">${picked.map(id=>{const r=records.find(r=>String(r.rid)===id);if(!r)return '';const s=data.students[r.index];return `<article><h3>${E(s.name)}</h3>${pill(r.status)}${facts(isRemoval?[['Course',r.course],['Reason',r.reason],['Advisor',r.advisor],['Submitted',r.date]]:[['ID',s.id],['Advisor',s.advisor],['Allowed hours',R.allowance(s).allowed],['Selected hours',R.totals(r.draft,s,courses()).selected],['Blocking step',r.blocking]])}${isRemoval?btn('Review request','compare-request',`data-request="${E(r.id)}"`):jump('student-detail','Open student',s.index)}</article>`;}).join('')}</div>`:'<p>Select up to two records. Academic information stays attached to each student.</p>');
        $$('[data-ad4-compare]',root).forEach(input=>{input.checked=picked.includes(input.dataset.ad4Compare);input.disabled=!input.checked&&picked.length>=2;});filters.values.compare=picked;filters.persist();
        $$('[data-ad4-action=compare-request]',compare).forEach(b=>b.onclick=()=>removalDialog(root,records.find(r=>r.id===b.dataset.request),data,role));
      };
      root.addEventListener('change',event=>{if(!event.target.matches('[data-ad4-compare]'))return;event.stopPropagation();const id=event.target.dataset.ad4Compare;picked=event.target.checked?[...picked,id].slice(0,2):picked.filter(x=>x!==id);show();},true);show();
    }
    root.addEventListener('click',event=>{
      const control=event.target.closest('[data-action]');if(!control)return;
      if(control.dataset.action==='removal-decision'){event.preventDefault();event.stopPropagation();removalDialog(root,records.find(r=>r.id===control.dataset.ad4Request),data,role);}
      if(control.dataset.action==='assign-advisor'){event.preventDefault();event.stopPropagation();assignment(root,data.students[selectedStudent],data,role);}
    },true);
    if(page==='directory')management(root,data,role);
    filters.update();
    if(role==='administrator'&&page==='student-schedules')addNotice(root,'Read-only access. Advisors and Coordinators prepare, process and reopen advising schedules.');
  }
  function removalDialog(root,request,data,role) {
    if(!request)return;
    const student=data.students[request.student], pending=request.status==='Pending', permitted=role==='coordinator';
    const body=`<div class="ad4-dialog-identity">${art('letter')}<div><strong>${E(request.course)} · ${E(request.id)}</strong><p>${E(student.name)} · ${E(student.id)}</p></div></div>${facts([['Advisor',request.advisor],['Submitted',request.date],['Status',request.status]])}<h3>Request reason</h3><p>${E(request.reason)} — ${E(request.note)}</p><div class="ad4-consequence"><h3>Effect of approval</h3><p>Remove this course from the mandatory list and any unprocessed draft. Rejection leaves it mandatory. Previously processed schedules are not changed.</p></div>${pending&&permitted?`<label class="ad4-field">Decision<select name="decision" required><option value="">Choose a decision</option><option>Approved</option><option>Rejected</option></select></label><label class="ad4-field">Response note<textarea name="note" required maxlength="1000" rows="3" placeholder="Explain the decision."></textarea></label>`:`<h3>Decision history</h3><p>${E(request.response||'Awaiting Coordinator review.')}</p><small>${E(request.decidedAt||'Only a Coordinator may decide this request.')}</small>`}`;
    confirmDialog(root,{title:'Course removal request',body,submit:pending&&permitted?'Submit decision':'Close',onSubmit:values=>{
      if(!pending||!permitted)return;
      const fresh=state(), live=fresh.removals.find(r=>r.id===request.id);if(!live||live.status!=='Pending')return 'This request changed. Close it and reopen the latest record.';
      if(!String(values.get('note')||'').trim())return 'A response note is required.';
      const decision=values.get('decision');if(!['Approved','Rejected'].includes(decision))return 'Choose a decision.';
      live.status=decision;live.response=String(values.get('note')).trim();live.decidedAt='20 Nov 2026 · Nadia Ahmed';
      const draft=fresh.drafts[live.student];
      if(decision==='Approved'){
        if(!draft.removed.includes(live.course))draft.removed.push(live.course);
        if(draft.status!=='Processed'){draft.courses=draft.courses.filter(code=>code!==live.course);const previous=Object.values(draft.slots[live.course]||{});draft.reserved=draft.reserved.filter(id=>!previous.includes(id));delete draft.slots[live.course];draft.status='Draft';draft.version++;}
      }
      draft.pendingRemoval=fresh.removals.some(r=>r.student===live.student&&r.status==='Pending');
      draft.history.push({date:'20 Nov 2026',title:`Removal ${decision.toLowerCase()}`,detail:live.course});
      if (save(fresh)) say(`Request ${decision.toLowerCase()} in this preview.`);setTimeout(redraw,0);
    }});
  }
  function renderWeek(draft) {
    const selected=Object.values(draft.slots).flatMap(Object.values), days=['Sunday','Monday','Tuesday','Wednesday','Thursday'];
    return `<div class="week-columns compact-week ad4-week" aria-label="Student weekly schedule">${days.map(day=>{
      const meetings=slots().filter(s=>selected.includes(s.id)&&s.day===day&&draft.courses.includes(s.course)).sort((a,b)=>R.minutes(a.start)-R.minutes(b.start));
      return `<section class="week-day" aria-label="${day}"><h3>${day}</h3>${meetings.length?meetings.map(s=>{const c=courses().find(c=>c.code===s.course),color={'CSEN 701':'ice','CSEN 703':'cherry','CSEN 704':'teal','DMET 701':'clay'}[s.course]||'clay';return `<div class="week-class ${color}">${timetableDrawing(s.course)}<time>${s.start}–${s.end}</time><strong>${E(c.name)}</strong><small>${s.course}<span class="study-place">${s.component} · Group ${s.group}<br>${s.room}</span></small></div>`;}).join(''):'<p class="week-free">No classes scheduled</p>'}</section>`;
    }).join('')}</div>`;
  }
  function historyMarkup(items) {return `<ol class="ad4-history">${items.map(h=>`<li><time>${E(h.date)}</time><div><strong>${E(h.title)}</strong><p>${E(h.detail)}</p></div></li>`).join('')}</ol>`;}
  function academicMarkup(s,draft) {
    return `<div class="ad4-record-columns"><section><h3>Completed</h3><p class="ad4-caption">${s.completedHours} credit hours · GPA ${s.gpa.toFixed(2)}</p><dl class="ad4-course-history"><div><dt>CSEN 501 · Introduction to Software Engineering</dt><dd>A− · 5 credits</dd></div><div><dt>MATH 501 · Mathematics V</dt><dd>B · 4 credits</dd></div><div><dt>ENGL 402 · Research Paper Writing</dt><dd>${s.bachelorEligible?'B+':'Incomplete'}</dd></div></dl></section><section><h3>Current</h3><p class="ad4-caption">Selected in this term’s draft</p><ul>${draft.courses.map(code=>`<li><strong>${code}</strong><small>${E(courses().find(c=>c.code===code)?.name)}</small></li>`).join('')||'<li>No current courses.</li>'}</ul></section><section><h3>Remaining</h3><p class="ad4-caption">Published Winter offerings</p><ul>${courses().filter(c=>!draft.courses.includes(c.code)).map(c=>`<li><strong>${c.code} · ${c.credits} credits</strong><small>${E(c.name)} · ${c.season}</small><small>Prerequisite: ${E(c.prerequisites)}</small></li>`).join('')||'<li>No remaining courses in this preview catalogue.</li>'}</ul></section></div>`;
  }
  function detailPage(root,page,role,index) {
    const data=state(),s=data.students[selectedStudent],d=data.drafts[selectedStudent],r=record(s,data),head=$('.page-head',root),identity=$('.person-title',root),nativeTabs=$('.tabs',root);
    const panels=$$(':scope > .panel, :scope > .tablewrap, :scope > .tablefoot',root),actions=$(':scope > .actions',root);
    $('.person-title h2',root).textContent=s.name;$('.person-title p',root).textContent=`${s.type} student · ${s.major}`;
    const dl=$('.details',root);if(dl)dl.innerHTML=facts([['Full name',s.name],['University email',s.email],['Student ID',s.id],['Student type',s.type],['Major',s.major],['Semester',s.semester],['Academic standing',s.standing],['Assigned advisor',s.advisor],['Workflow status',r.status],['Account status',s.account]]).replace(/^<dl[^>]*>|<\/dl>$/g,'');
    const assign=$('[data-action=assign-advisor]',actions);if(assign&&!(role==='coordinator'&&s.type==='Advising'))assign.remove();
    if(role==='administrator'||s.type==='Normal')$$('[data-page=preferences]',actions).forEach(n=>n.remove());
    if(role==='administrator')actions.insertAdjacentHTML('beforeend',btn(s.account==='Active'?'Deactivate account':'Activate account','account-status','','danger'));
    const back=$('[data-page=directory]',head);if(role==='advisor'&&back){back.dataset.page='advising';back.href=href('advising');back.textContent='Back to advising';}
    const native=el('div','ad4-native-record');if(nativeTabs)native.append(nativeTabs);panels.forEach(n=>native.append(n));
    if(tab==='history'){
      const table=$('tbody',native);if(table)table.innerHTML=s.history.map(h=>`<tr><td>${E(h.detail)}</td><td>${E(h.date)}</td><td>${E(h.title)}</td></tr>`).join('');
    }
    const workflow=section('Schedule workflow','ad4-workflow-card',`<div class="ad4-inline-art">${art('folder')}<div>${pill(r.status)}<p>${E(r.blocking==='None'?'No outstanding blockers.':r.blocking)}</p></div></div>${facts([['Allowed hours',R.allowance(s).allowed],['Selected hours',R.totals(d,s,courses()).selected],['Last updated',d.savedAt],['Bachelor project',s.bachelorEligible?'Eligible':'Not eligible']])}${jump('draft-schedule',role==='administrator'||s.type==='Normal'?'View schedule':'Review draft',s.index,'btn')}`);
    if(tab==='workflow'){
      const panel=$('.panel',native);if(panel){panel.innerHTML=`<h2>Schedule workflow</h2>${pill(r.status)}${historyMarkup(d.history.length?d.history:[{date:d.savedAt,title:'Draft prepared',detail:s.advisor}])}${jump('draft-schedule','Open schedule',s.index,'btn')}`;}
    }
    const week=section('Weekly schedule','ad4-student-week',renderWeek(d));
    const academic=section('Academic history','ad4-academic',academicMarkup(s,d));
    const handover=section('Advisor handover','ad4-handover',`${facts([['Assigned advisor',s.advisor],['Contact',s.advisor==='Unassigned'?'No advisor assigned':s.advisorEmail]])}${historyMarkup(s.history)}${s.type==='Advising'&&role==='coordinator'?btn('Assign advisor','assign-record-advisor') : ''}`);
    identity.classList.add('ad4-identity');actions.classList.add('ad4-detail-actions');
    const layout=el('div',`ad4-detail-layout ad4-detail-${index+1}`);
    const nodes={identity,native,workflow,week,academic,handover,actions};
    const orders=[['identity','native','workflow','academic','week','handover','actions'],['identity','workflow','native','week','academic','handover','actions'],['identity','native','academic','workflow','handover','week','actions'],['identity','academic','native','workflow','week','handover','actions'],['identity','week','workflow','native','academic','handover','actions'],['identity','handover','workflow','native','academic','week','actions'],['identity','native','workflow','handover','academic','week','actions'],['identity','workflow','native','academic','week','handover','actions'],['identity','workflow','handover','native','academic','week','actions'],['identity','native','workflow','academic','handover','week','actions']];
    head.after(layout);orders[index].forEach(k=>{if(k==='academic'&&(role==='administrator'||s.type!=='Advising'))return;const node=nodes[k];node.dataset.ad4Part=k;layout.append(node);});
    if(index===7){['native','academic','week','handover'].forEach(k=>{const node=nodes[k];if(!node.isConnected)return;const disclosure=el('details','ad4-fold',`<summary>${{native:'Student record',academic:'Academic history',week:'Weekly schedule',handover:'Advisor history'}[k]}</summary>`);disclosure.open=k==='native';node.before(disclosure);disclosure.append(node);});}
    if(index===8){
      workflow.insertAdjacentHTML('beforeend',`<ol class="ad4-checklist"><li>${s.advisor==='Unassigned'?'Assign an advisor':'Advisor assigned'}</li><li>${R.validate(d,s,courses(),slots()).length?'Resolve schedule validation':'Schedule validation complete'}</li><li>${R.blockers(d).length?'Resolve pending requests':'No pending requests'}</li></ol>`);
    }
    root.addEventListener('click',event=>{
      const action=event.target.closest('[data-action=assign-advisor],[data-ad4-action]');if(!action)return;
      const name=action.dataset.ad4Action||action.dataset.action;
      if(['assign-advisor','assign-record-advisor'].includes(name)){event.preventDefault();event.stopPropagation();assignment(root,s,data,role);}
      if(name==='account-status'){event.preventDefault();event.stopPropagation();account(root,s,data,role);}
    },true);
    if(role==='administrator')addNotice(root,'Administrator view: identity and schedule are read-only. Academic history is restricted to the student, Advisors and Coordinators.');
  }
  function requestRemoval(root,s,d,data,role,code) {
    if(!R.can(role,'removalRequest'))return;
    if(s.advisor!=='Dr. Salma Adel'){say('Only the assigned advisor may submit a removal request in this preview.', 'error');return;}
    confirmDialog(root,{title:'Request mandatory-course removal',submit:'Submit removal request',body:`<div class="ad4-dialog-identity">${art('letter')}<div><strong>${E(code)}</strong><p>${E(s.name)} · ${E(s.id)}</p></div></div><p>The course remains mandatory until a Coordinator approves the request.</p><label class="ad4-field">Reason category<select name="reason" required><option value="">Choose a valid reason</option>${['First makeup','Second makeup','Completed hours','Restricted pair'].map(v=>`<option ${R.removalEligible(s,v)?'':'disabled'}>${v}</option>`).join('')}</select></label><p class="ad4-caption">${s.failedCount} failed courses · ${s.completedHours} completed hours. Second makeup: one or two failed courses. Hours deferral: more than 157 completed hours.</p><label class="ad4-field">Explanation<textarea name="note" rows="3" required maxlength="1000"></textarea></label>`,onSubmit:values=>{
      if(!R.removalEligible(s,values.get('reason')))return 'The student is not eligible for this removal reason.';
      if(!String(values.get('note')||'').trim())return 'Explain why this course should be removed.';
      if(data.removals.some(r=>r.student===s.index&&r.course===code&&r.status==='Pending'))return 'A pending request already exists for this course.';
      data.removals.push({id:`MR-${1042+data.removals.length}`,student:s.index,course:code,reason:values.get('reason'),note:String(values.get('note')).trim(),status:'Pending',date:'2026-11-20',advisor:s.advisor,advisorEmail:s.advisorEmail,response:'',decidedAt:''});d.pendingRemoval=true;if (save(data)) say('Removal request submitted in this preview.');setTimeout(redraw,0);
    }});
  }
  function editSlots(root, s, d, data, code, role) {
    if(!R.can(role,'edit')||d.status==='Processed')return;
    const course=courses().find(c=>c.code===code), old=structuredClone(d.slots[code]||{});
    confirmDialog(root,{title:`${code} · assigned components`,submit:'Save components',body:`<p>${E(course.name)} · ${E(s.name)}</p><p>Choose each required component. Full or clashing slots cannot be assigned. Removing a component keeps the draft incomplete.</p>${course.components.map(component=>`<label class="ad4-field">${component[0].toUpperCase()+component.slice(1)}<select name="${component}"><option value="">Not assigned</option>${slots().filter(slot=>slot.course===code&&slot.component===component).map(slot=>`<option value="${slot.id}" ${old[component]===slot.id?'selected':''} ${slot.remaining<=0&&!d.reserved.includes(slot.id)?'disabled':''}>Group ${slot.group} · ${slot.day} ${slot.start}–${slot.end} · ${slot.room} · ${slot.remaining} seats${slot.remaining<=0?' · Full':''}</option>`).join('')}</select></label>`).join('')}`,onSubmit:values=>{
      const next=structuredClone(d);next.slots[code]=Object.fromEntries(course.components.map(component=>[component,String(values.get(component)||'')]).filter(([,id])=>id));
      const hard=R.validate(next,s,courses(),slots()).filter(x=>x.includes('clash')||x.includes('is full')||x.includes('invalid'));
      if(hard.length)return hard.join(' ');
      d.slots[code]=next.slots[code];d.status='Draft';d.reserved=Object.values(d.slots).flatMap(Object.values);if (save(data)) say('Component selections saved locally. Missing components still block review.');setTimeout(redraw,0);
    }});
  }
  function draftPage(root,page,role,index) {
    const data=state(),s=data.students[selectedStudent],d=data.drafts[selectedStudent],cs=courses(),total=R.totals(d,s,cs),issues=R.validate(d,s,cs,slots()),blocking=R.blockers(d),editable=R.can(role,'edit')&&d.status!=='Processed'&&s.type==='Advising';
    const head=$('.page-head',root),plan=$('.academic-plan',root),selected=$(':scope > .panel',plan),aside=$(':scope > aside',plan),prefs=$('.note',aside),validation=$('.panel',aside),nativeWeek=$(':scope > .week-columns',root),workflow=$('.draft-workflow',root);
    selected.classList.add('ad4-course-selection');prefs.classList.add('ad4-preferences');validation.classList.add('ad4-validation');workflow.classList.add('ad4-workflow');
    $('h1',head).textContent=s.type==='Normal'?`${s.name.split(' ')[0]}’s weekly schedule`:`${s.name.split(' ')[0]}’s advising draft`;
    $('p',head).textContent=`${s.id} · ${s.major} · Semester ${s.semester}`;
    head.insertAdjacentHTML('beforeend',`<div class="ad4-status-line">${pill(s.type==='Normal'?'Schedule assigned':R.status(d))}<span>Version ${d.version} · ${d.status==='Processed'?'Final schedule':'Unprocessed draft'}</span>${jump('student-schedules','Back to schedules',s.index,'quiet-link')}</div>`);
    const actions=$('.actions',head);actions.insertAdjacentHTML('afterbegin',btn('Ready for student review','mark-ready','',''));
    const nativeTasks=$$('.task',selected), stats=$('.smallstats',selected);
    stats.innerHTML=[['Selected',total.selected],['Allowed',total.allowed],['Extra',total.extra],['Remaining',total.remaining]].map(([label,value])=>`<div><strong>${value}</strong><span>${label} hours</span></div>`).join('');
    stats.setAttribute('aria-label','Credit-hour balance');
    nativeTasks.forEach(n=>n.remove());
    const courseRows=el('div','ad4-course-rows');selected.append(courseRows);
    d.courses.forEach((code,i)=>{
      const c=cs.find(x=>x.code===code), row=nativeTasks.find(t=>t.textContent.includes(code))||el('div','task',`${academicCourse(courseData.find(x=>x[0]===code),`<div><h3>${code}</h3><p>${E(c.name)}</p></div>`)}<label><span class="sr-only">${code} group</span><select aria-label="${code} group"><option>Group 4</option><option>Group 2</option></select></label>`);
      row.dataset.ad4Course=code;
      const select=$('select',row), groups=[...new Set(Object.values(d.slots[code]||{}).map(id=>slots().find(x=>x.id===id)?.group))];
      select.innerHTML='<option value="">Individual components</option><option value="4">Group 4</option><option value="2">Group 2</option>';select.value=groups.length===1?groups[0]:'';select.disabled=!editable;select.dataset.ad4GroupCourse=code;
      const mandatory=d.mandatory.includes(code)&&!d.removed.includes(code);
      row.insertAdjacentHTML('beforeend',`<div class="ad4-course-tools"><span>${c.credits} credits · ${mandatory?'Mandatory':'Optional'}</span>${btn('Components','slots',`data-code="${code}" ${editable?'':'disabled'}`,'text')}${mandatory&&role==='advisor'?btn('Request removal','request-removal',`data-code="${code}" ${editable?'':'disabled'}`,'text'):!mandatory?btn('Remove course','remove-course',`data-code="${code}" ${editable?'':'disabled'}`,'text'):''}</div>`);
      courseRows.append(row);
    });
    if(!d.courses.length)courseRows.innerHTML='<div class="ad4-empty"><h3>No courses selected</h3><p>Start with the mandatory candidates below. You may save an incomplete draft.</p></div>';
    const missingMandatory=d.mandatory.filter(code=>!d.removed.includes(code)&&!d.courses.includes(code));
    const candidates=section('Mandatory candidates','ad4-mandatory',`<p class="ad4-caption">Failed and unattended courses are mandatory unless removal is approved.</p>${d.mandatory.map(code=>`<div class="ad4-candidate"><div><strong>${code}</strong><small>${E(cs.find(c=>c.code===code)?.name)}</small></div>${d.removed.includes(code)?pill('Removal approved'):d.courses.includes(code)?pill('Selected'):btn('Add mandatory','add-course',`data-code="${code}" ${editable?'':'disabled'}`)}</div>`).join('')}`);
    const available=section('Other eligible courses','ad4-eligible',`<p class="ad4-caption">Published for Winter · prerequisites satisfied. Select mandatory courses first.</p>${cs.filter(c=>!d.courses.includes(c.code)&&!d.mandatory.includes(c.code)).map(c=>`<div class="ad4-candidate"><div><strong>${c.code}</strong><small>${E(c.name)} · ${c.credits} credits</small></div>${btn('Add course','add-course',`data-code="${c.code}" ${editable&&!missingMandatory.length&&c.credits<=total.remaining?'':'disabled'}`)}</div>`).join('')||'<p>No other eligible courses in this preview catalogue.</p>'}`);
    prefs.innerHTML=`<div class="ad4-inline-art">${art('conversation')}<div><h2>Student preferences</h2><p class="ad4-caption">${s.preferences?`Updated ${s.preferenceUpdated}`:'No submission yet'}</p></div></div>${s.preferences?`<ol class="ad4-priorities">${s.preferences.map(p=>`<li>${E(p)}</li>`).join('')}</ol>`:'<p>No scheduling preferences submitted. You may create the draft without them.</p>'}<p>Preferences guide the plan; they do not override academic rules, capacity or clashes.</p>${role==='administrator'?'':jump('preferences','View submitted preferences',s.index,'quiet-link')}`;
    validation.innerHTML=`<div class="ad4-section-title"><h2>Validation</h2><span>${issues.length+blocking.length} ${issues.length+blocking.length===1?'issue':'issues'}</span></div>${issues.length||blocking.length?`<ul class="ad4-issues">${[...issues,...blocking].map((v,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span>${E(v)}</li>`).join('')}</ul>`:'<p class="ad4-valid">All required courses and components are assigned. No blocking issue remains.</p>'}<p class="ad4-caption">${s.reason} · ${R.allowance(s).probation?'Probation allowance; no increases permitted.':'Allowance calculated from semester progression.'}</p>`;
    const extra=section('Credit allowance','ad4-extra-hours',`<div class="ad4-inline-art"><img src="${new URL('assets/extra-hours-folder.svg',base)}" width="54" height="54" alt=""><div><h3>${total.extra} activated extra hours</h3><p>Approval alone does not activate hours. Payment or the next-installment choice is required.</p></div></div>${s.bachelorEligible?`<label class="ad4-field">Bachelor project season<select data-ad4-bachelor ${editable?'':'disabled'}><option value="">Not included</option><option ${d.bachelor==='Winter'?'selected':''}>Winter</option><option ${d.bachelor==='Spring'?'selected':''}>Spring</option></select></label><p class="ad4-caption">Eligible: English including RPW completed; only two earlier failed courses. Accompanying courses require extra-hours approval and settlement.</p>`:`<p class="ad4-caption">Bachelor project: not eligible. Complete the required semesters 1–6 and English/RPW criteria first.</p>`}`);
    const week=section('Proposed timetable','ad4-draft-week',renderWeek(d));if(nativeWeek)nativeWeek.replaceWith(week);$('.academic-week-title',root)?.remove();
    workflow.innerHTML=`<h2>Review and processing</h2><ol class="ad4-workflow-steps"><li><strong>01 · Prepare draft</strong><p>Save unfinished work. Incomplete drafts are hidden from the student.</p></li><li><strong>02 · Ready for student review</strong><p>Complete every required course and component before sharing read-only access.</p></li><li><strong>03 · Process final schedule</strong><p>Resolve all pending requests, approvals and settlement choices first.</p></li></ol>${d.history.length?historyMarkup(d.history):''}${d.status==='Processed'&&R.can(role,'edit')?btn('Reopen schedule','reopen'):''}`;
    const layout=el('div',`ad4-draft-layout ad4-draft-${index+1}`);head.after(layout);plan.remove();
    const nodes={selected,prefs,validation,week,workflow,candidates,available,extra};
    const orders=[['selected','prefs','validation','candidates','available','extra','week','workflow'],['week','selected','validation','prefs','candidates','available','extra','workflow'],['selected','validation','candidates','available','prefs','extra','week','workflow'],['candidates','selected','validation','available','prefs','extra','week','workflow'],['selected','week','validation','candidates','available','prefs','extra','workflow'],['candidates','selected','available','extra','prefs','week','validation','workflow'],['prefs','selected','candidates','available','validation','extra','week','workflow'],['week','selected','candidates','available','validation','prefs','extra','workflow'],['selected','week','candidates','available','prefs','validation','extra','workflow'],['validation','workflow','selected','candidates','available','prefs','extra','week']];
    orders[index].forEach(k=>{nodes[k].dataset.ad4Part=k;layout.append(nodes[k]);});
    if(index===3||index===9){const optional=el('details','ad4-fold','<summary>Other eligible courses</summary>');available.before(optional);optional.append(available);optional.open=index===3;}
    if(index===4){
      const inspector=section('Course inspector','ad4-course-inspector','<p>Choose a course to inspect its current lecture, tutorial and lab assignments.</p>');selected.after(inspector);
      $$('[data-ad4-course]',root).forEach(row=>row.insertAdjacentHTML('beforeend',btn('Inspect course','inspect-course',`data-code="${row.dataset.ad4Course}"`,'text')));
      root.addEventListener('click',e=>{const b=e.target.closest('[data-ad4-action=inspect-course]');if(!b)return;const code=b.dataset.code;inspector.innerHTML=`<div class="ad4-inline-art">${art('folder')}<h2>${code}</h2></div>${facts(Object.entries(d.slots[code]||{}).map(([component,id])=>{const slot=slots().find(x=>x.id===id);return [component,slot?`Group ${slot.group} · ${slot.day} ${slot.start}–${slot.end} · ${slot.room}`:'Not assigned'];}))}${btn('Edit components','slots',`data-code="${code}" ${editable?'':'disabled'}`)}`;Motion.play(inspector);});
    }
    if(index===5){
      const steps=el('nav','ad4-step-nav',`<span>Draft workflow</span>${['Courses','Timetable','Review'].map((v,i)=>`<button type="button" data-ad4-step="${i}" aria-pressed="${i===0}">${i+1}. ${v}</button>`).join('')}`);steps.setAttribute('aria-label','Draft steps');layout.before(steps);
      const stepParts=[['candidates','selected','available','extra'],['prefs','week'],['validation','workflow']];
      const go=value=>{Object.entries(nodes).forEach(([k,node])=>node.hidden=!stepParts[value].includes(k));$$('[data-ad4-step]',steps).forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.ad4Step===value)));};
      steps.onclick=e=>{const b=e.target.closest('[data-ad4-step]');if(b)go(+b.dataset.ad4Step);};go(0);
    }
    if(index===7)week.classList.add('ad4-meeting-ledger');
    if(!editable){$$('[data-action=save-draft],[data-action=process],[data-ad4-action=mark-ready]',root).forEach(b=>b.disabled=true);}
    const ready=$('[data-ad4-action=mark-ready]',root),process=$('[data-action=process]',root);
    ready.disabled=!editable||issues.length>0||blocking.length>0||d.status==='Ready for student review';
    process.disabled=!editable||issues.length>0||blocking.length>0||d.status!=='Ready for student review';
    if(ready.disabled)ready.title='Complete required selections and resolve blockers before sharing for review.';
    if(process.disabled)process.title='A valid review-ready schedule with no pending request, approval or payment choice is required.';
    if(role==='administrator'||s.type==='Normal')addNotice(root,'Read-only schedule. Only Advisors and Coordinators may edit an advising draft.');
    if(d.status==='Processed')addNotice(root,'This schedule is final. Reopen it with a reason before making changes.');
    root.addEventListener('change',event=>{
      const control=event.target;
      if(control.dataset.ad4GroupCourse){
        event.stopPropagation();if(!editable)return;
        const code=control.dataset.ad4GroupCourse,group=+control.value;if(!group)return editSlots(root,s,d,data,code,role);
        const next=structuredClone(d);next.slots[code]=Object.fromEntries(cs.find(c=>c.code===code).components.map(t=>[t,`${code}:${t}:${group}`]));
        const hard=R.validate(next,s,cs,slots()).filter(x=>x.includes('clash')||x.includes('is full'));
        if(hard.length){say(hard.join(' '), 'warning');control.value=[...new Set(Object.values(d.slots[code]||{}).map(id=>slots().find(x=>x.id===id)?.group))].length===1?slots().find(x=>x.id===Object.values(d.slots[code]||{})[0])?.group:'';return;}
        d.slots[code]=next.slots[code];d.status='Draft';d.reserved=Object.values(d.slots).flatMap(Object.values);save(data);redraw();
      }
      if(control.matches('[data-ad4-bachelor]')){event.stopPropagation();if(!editable)return;d.bachelor=control.value;d.status='Draft';save(data);redraw();}
    },true);
    root.addEventListener('click',event=>{
      const control=event.target.closest('[data-action],[data-ad4-action]');if(!control)return;
      const name=control.dataset.ad4Action||control.dataset.action,code=control.dataset.code;
      if(!['save-draft','process','mark-ready','reopen','slots','request-removal','remove-course','add-course'].includes(name))return;
      event.preventDefault();event.stopPropagation();
      if(!R.can(role,'edit')||s.type!=='Advising')return;
      if(name==='reopen'){
        if(d.status!=='Processed')return;
        confirmDialog(root,{title:'Reopen the processed schedule?',submit:'Reopen schedule',body:'<p>The schedule returns to Draft and is hidden from the student until it is completed and shared for review again. Processing history is kept.</p><label class="ad4-field">Reason<textarea name="reason" required maxlength="1000" rows="3"></textarea></label>',onSubmit:values=>{const reason=String(values.get('reason')||'').trim();if(!reason)return 'A reopening reason is required.';d.status='Draft';d.version++;d.history.push({date:'20 Nov 2026',title:'Schedule reopened',detail:reason});if (save(data)) say('Schedule reopened in this preview.');setTimeout(redraw,0);}});return;
      }
      if(!editable)return;
      if(name==='slots')return editSlots(root,s,d,data,code,role);
      if(name==='request-removal')return requestRemoval(root,s,d,data,role,code);
      if(name==='remove-course'){
        if(d.mandatory.includes(code)&&!d.removed.includes(code)){say('Mandatory courses require approved removal.', 'warning');return;}
        d.courses=d.courses.filter(c=>c!==code);delete d.slots[code];d.reserved=Object.values(d.slots).flatMap(Object.values);d.status='Draft';save(data);redraw();return;
      }
      if(name==='add-course'){
        const course=cs.find(c=>c.code===code);if(!course||d.courses.includes(code))return;
        if(course.credits>R.totals(d,s,cs).remaining){say('This course exceeds the available credit hours.', 'warning');return;}
        if(!d.mandatory.includes(code)&&missingMandatory.length){say('Select the outstanding mandatory courses first.', 'warning');return;}
        d.courses.push(code);d.slots[code]={};d.status='Draft';save(data);redraw();return;
      }
      if(name==='save-draft'){d.savedAt='20 Nov 2026, 10:42';d.version++;d.history.push({date:'20 Nov 2026',title:'Draft saved',detail:`${d.courses.length} courses · ${R.totals(d,s,cs).selected} credits`});if (save(data)) say('Draft saved in this browser. Incomplete drafts remain hidden from the student.');redraw();return;}
      const liveIssues=[...R.validate(d,s,cs,slots()),...R.blockers(d)];
      if(liveIssues.length){say(liveIssues[0], 'warning');return;}
      if(name==='mark-ready'){
        confirmDialog(root,{title:'Share for student review?',submit:'Mark ready for review',body:`<p>${E(s.name)} will receive read-only access to this completed draft and may submit slot-change requests before the advising deadline. This is not final processing.</p>`,onSubmit:()=>{d.status='Ready for student review';d.version++;d.history.push({date:'20 Nov 2026',title:'Ready for student review',detail:'Completed draft shared read-only.'});if (save(data)) say('Ready for student review in this preview.');setTimeout(redraw,0);}});
      }else if(name==='process'){
        if(d.status!=='Ready for student review')return;
        confirmDialog(root,{title:'Process the final schedule?',submit:'Process schedule',body:`<p>${E(s.name)} · ${total.selected} credits · no outstanding blocker.</p><p>Processing finalizes the schedule and closes pre-processing slot changes. The final schedule becomes available to view and download.</p>`,onSubmit:()=>{d.status='Processed';d.version++;d.history.push({date:'20 Nov 2026',title:'Schedule processed',detail:`Version ${d.version} · ${role==='advisor'?'Dr. Salma Adel':'Nadia Ahmed'}`});if (save(data)) say('Schedule processed in this preview.');setTimeout(redraw,0);}});
      }
    },true);
  }
  const apply=(page,index)=>({root,role})=>{
    if(!setup(root,page,role,index))return;
    if(page==='draft-schedule')draftPage(root,page,role,index);
    else if(page==='student-detail')detailPage(root,page,role,index);
    else listPage(root,page,role,index);
  };
  keys.forEach(page=>{window.portalVariants[page]=titles[page].map((name,index)=>({name,apply:apply(page,index)}));});
  // Diagnostic metadata is read-only. No role, session, shell or calendar overrides.
  window.portalAdvising04=Object.freeze({version:'2.0.0',keys:[...keys],titles,previewStorageKey:storeKey});
})();
