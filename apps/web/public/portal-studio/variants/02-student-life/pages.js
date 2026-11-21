/* Portal / Student life — round two.
 * Drop-in, dependency-free enhancement of the seven existing renderers.
 * The host owns authentication, navigation, the shell and the design selector.
 * Synthetic workflow data is ONLY used inside the supplied design preview.
 * Production adapters in integration/ reuse the existing authenticated components.
 */
(() => {
  'use strict';
  const ownScript = document.currentScript;
  const baseURL = new URL('.', ownScript.src);
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('pages.css', baseURL).href;
  css.dataset.portalStudentLife = '2'; document.head.append(css);
  const NS = 'portal-student-life:round2:';
  let lastHostConnection = null;
  let lastHostPreferences = null;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const CLOCK = '2026-11-14T10:00:00+02:00'; // Explicit, reproducible preview snapshot.
  const DEADLINE = '2026-11-18T23:59:00+02:00';
  const SWAP_DEADLINE = '2026-12-13T23:59:00+02:00';
  const STUDENTS = ['normalStudent', 'advisingStudent'];
  const PERMISSIONS = {
    'my-schedule': [...STUDENTS, 'advisor', 'coordinator', 'administrator'],
    'my-courses': STUDENTS, 'schedule-swap': ['normalStudent'],
    preferences: ['advisingStudent', 'advisor', 'coordinator'],
    records: ['advisingStudent', 'advisor', 'coordinator'],
    'my-advisor': ['advisingStudent'], 'calendar-sync': STUDENTS
  };
  const DESIGNS = {
    'my-schedule': ['Week & requests', 'One day at a time', 'Weekly agenda', 'Course lanes', 'Time grid', 'Schedule inspector', 'Course index & week', 'Foldout days', 'Room-to-room route', 'Review & release'],
    'my-courses': ['Course register', 'Course & sections', 'Section matrix', 'Course index', 'Teaching-day index', 'Credit ledger', 'Course folders', 'Component focus', 'Two-course comparison', 'Find a course'],
    'schedule-swap': ['Side-by-side groups', 'Current & destination', 'Group inspector', 'Days-off explorer', 'Complete week comparison', 'Choose & review', 'Meeting change map', 'Exchange inbox', 'Request ledger', 'Destination shortlist'],
    preferences: ['Two-column brief', 'Priority ladder', 'Week preferences', 'Groups first', 'Form & live review', 'Guided submission', 'Compact outline', 'Advisor note first', 'Course group cards', 'Week & constraints'],
    records: ['Transcript desk', 'Academic timeline', 'Course dossier', 'Year folders', 'Academic ledger', 'Year comparison', 'Term-by-term results', 'Remaining courses first', 'Find a result', 'Print-ready transcript'],
    'my-advisor': ['Contact & preparation', 'Contact first', 'Contact strip', 'Office-hours agenda', 'Meeting brief', 'Email draft', 'Advisor file', 'Next action first', 'Compact contact', 'Preparation checklist'],
    'calendar-sync': ['Connection & source', 'Connection steps', 'Event ledger', 'Calendar file first', 'Event inspector', 'Connection drawer', 'Permissions first', 'Review sync changes', 'Sync activity', 'Compact settings']
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const node = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const html = (tag, cls, content = '') => node(`<${tag} class="${cls}">${content}</${tag}>`);
  const btn = (text, command, attrs = '', kind = '') => `<button type="button" class="btn ${kind}" data-sl2-action="${command}" ${attrs}>${text}</button>`;
  const chip = (text, tone = '') => `<span class="sl2-status ${tone}">${esc(text)}</span>`;
  const labelled = (title, content, cls = '') => html('section', `sl2-section ${cls}`, `<header class="sl2-section-head"><h2>${title}</h2></header>${content}`);
  const safeRead = (key, fallback) => { try { const raw = sessionStorage.getItem(NS + key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const safeWrite = (key, value) => { try { sessionStorage.setItem(NS + key, JSON.stringify(value)); return true; } catch { return false; } };
  const defaultState = role => ({
    group: 4, status: role === 'normalStudent' ? 'processed' : 'readyForStudentReview', version: 1,
    requests: [], swaps: [], connected: true, lastSync: '14 Nov 2026, 09:15', syncedVersion: 0,
    syncHistory: [], checks: [false, false, false], advisorNote: '',
    prefs: { days: ['Thursday'], avoided: [], preferred: [], groups: Array(4).fill('Group 4'), components: Array(4).fill('Tutorial'), priorities: [1, 2, 3, 4], times: [], notes: 'I would prefer to keep Thursday free.', order: ['days', 'groups', 'times', 'notes'], saved: '12 Nov 2026, 10:42' }
  });
  const getState = role => Object.assign(defaultState(role), safeRead('state:' + role, {}));
  const putState = ctx => safeWrite('state:' + ctx.role, ctx.state);
  const scenario = (page, role) => safeRead(`scenario:${role}:${page}`, 'default');
  const now = ctx => ['deadline', 'locked'].includes(ctx.scenario) ? Date.parse('2026-12-20T10:00:00+02:00') : Date.parse(CLOCK);
  const openDeadline = ctx => now(ctx) < Date.parse(ctx.page === 'schedule-swap' ? SWAP_DEADLINE : DEADLINE);
  const rerender = () => { if (typeof render === 'function') render(); };
  const notify = text => { if (typeof toast === 'function') toast(text); };
  const route = (key, text, cls = 'btn row-control') => typeof link === 'function' ? link(key, text, cls) : `<a href="?preview=live&page=${key}" class="${cls}">${text}</a>`;
  const art = code => typeof timetableDrawing === 'function' ? timetableDrawing(code).replace(/images\/symbols\//g,new URL('assets/',baseURL).href) : '';
  const conversation = () => `<span class="sl2-conversation" aria-hidden="true">${typeof queueSketch === 'function' ? queueSketch('advisor-assignment') : ''}</span>`;
  const pageTitle = ctx => $('.page-head h1', ctx.wrap)?.textContent || ctx.page;

  // Base course names/credits and the original seven meetings come from the renderer.
  // The five additional component meetings are declared preview fixtures (see docs/DATA.md).
  function courses() {
    const native = typeof courseData !== 'undefined' ? courseData.slice(0, 4) : [];
    return native.map(([code, title, department, credits], i) => ({ code, title, department, credits: Number(credits), index: i, tone: ['ice', 'cherry', 'teal', 'clay'][i] }));
  }
  function meetings(group = 4) {
    const rows = [
      [0, 'Lecture', 0, 510, 'C2.301'], [1, 'Tutorial', 0, 720, 'C3.104'],
      [3, 'Tutorial', 0, 840, 'C1.204'], [2, 'Lab', 1, 600, 'C7.102'],
      [1, 'Lab', 1, 720, 'C3.107'], [3, 'Lab', 1, 840, 'C1.102'],
      [1, 'Lecture', 2, 510, 'C3.202'], [0, 'Tutorial', 2, 600, 'C2.204'],
      [2, 'Lecture', 2, 840, 'C7.301'], [0, 'Lab', 3, 510, 'C2.102'],
      [2, 'Tutorial', 3, 600, 'C7.204'], [3, 'Lecture', 3, 720, 'C1.201']
    ];
    return rows.map(([index, type, day, start, room]) => {
      const mapping = group === 1 ? [1, 0, 3, 4] : group === 2 ? [2, 3, 1, 4] : [0, 1, 2, 3];
      const offset = group === 1 ? 90 : 0;
      return { ...courses()[index], id: `${index}-${type}`, type, day: mapping[day], start: start + offset, end: start + offset + 90, room, group, instructor: ['Dr. Salma Adel', 'Dr. Hany Youssef', 'Dr. Mona Sami', 'Dr. Karim Ali'][index] };
    }).sort((a, b) => a.day - b.day || a.start - b.start);
  }
  const time = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  const meetingLine = m => `${DAYS[m.day]} · ${time(m.start)}–${time(m.end)} · ${m.room}`;
  function meetingCard(m, actionable = true) {
    return node(`<${actionable ? 'button type="button"' : 'article'} class="week-class ${m.tone} sl2-meeting" ${actionable ? `data-sl2-action="meeting" data-meeting="${m.id}"` : ''} data-course="${m.index}" data-day="${m.day}" data-component="${m.type}" style="--sl2-start:${m.start};--sl2-duration:${m.end - m.start}">
      ${art(m.code)}<time>${time(m.start)}–${time(m.end)}</time><strong>${esc(m.title)}</strong><small>${m.code}<span class="study-place">${m.type} · ${m.room}</span></small>
    </${actionable ? 'button' : 'article'}>`);
  }
  function meetingTable(rows, title = 'Assigned meetings') {
    return `<div class="sl2-table-scroll" tabindex="0" role="region" aria-label="${esc(title)}"><table class="sl2-table"><caption>${esc(title)}</caption><thead><tr><th>Course / component</th><th>Day</th><th>Time</th><th>Location</th></tr></thead><tbody>${rows.map(m => `<tr><th scope="row"><strong>${m.code}</strong><small>${esc(m.title)} · ${m.type}</small></th><td>${DAYS[m.day]}</td><td>${time(m.start)}–${time(m.end)}</td><td>${m.room}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function miniWeek(group) {
    return `<div class="sl2-mini-week">${DAYS.map((d, i) => `<section><h3>${d.slice(0, 3)}</h3>${meetings(group).filter(m => m.day === i).map(m => `<p data-tone="${m.tone}"><time>${time(m.start)}</time><strong>${m.code}</strong><span>${m.type} · ${m.room}</span></p>`).join('') || '<p class="sl2-off">Day off</p>'}</section>`).join('')}</div>`;
  }
  function message(ctx, text, error = false) {
    let target = $('.sl2-feedback', ctx.wrap);
    if (!target) { target = html('p', 'sl2-feedback'); ctx.head.after(target); }
    target.setAttribute('role', error ? 'alert' : 'status'); target.classList.toggle('is-error', error);
    target.textContent = text; target.hidden = !text;
  }
  function dialogFor(ctx, title, content, onSubmit, submitText = 'Confirm', drawer = false) {
    const returnTarget = document.activeElement;
    const existing = $('dialog[open]',ctx.wrap);if(existing){existing.close();existing.remove();}
    const d = node(`<dialog class="sl2-dialog ${drawer ? 'sl2-drawer' : ''}" aria-labelledby="sl2-dialog-title"><form method="dialog"><header class="sl2-dialog-head"><h2 id="sl2-dialog-title">${esc(title)}</h2><button type="button" class="btn row-control" data-close aria-label="Close dialog">Close</button></header><div class="sl2-dialog-body">${content}</div><p class="sl2-dialog-error" role="alert" hidden></p><footer class="form-footer"><button type="button" class="btn" data-close>${onSubmit ? 'Cancel' : 'Close'}</button>${onSubmit ? `<button class="btn primary" type="submit">${submitText}</button>` : ''}</footer></form></dialog>`);
    ctx.wrap.append(d);
    d.addEventListener('click', e => { if (e.target.closest('[data-close]')) d.close(); });
    $('form', d).addEventListener('submit', e => {
      e.preventDefault();
      if (!onSubmit) { d.close(); return; }
      try { const result = onSubmit(new FormData(e.target), d); if (result !== false) d.close(); }
      catch (err) { const el = $('.sl2-dialog-error', d); el.hidden = false; el.textContent = err.message; el.tabIndex = -1; el.focus(); }
    });
    d.addEventListener('close', () => { d.remove(); if (returnTarget?.isConnected) returnTarget.focus(); else $('.sl2-page .page-head h1', ctx.root)?.focus(); });
    d.showModal();
    return d;
  }
  function saveFile(filename, contents, type) {
    const a = document.createElement('a'); const url = URL.createObjectURL(new Blob([contents], { type }));
    a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Downloaded ${filename}`);
  }
  function pdfBytes(title, lines) {
    // Small, standards-compliant preview PDF. Production uses the existing PDF endpoint.
    const clean = s => String(s).replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, ' ').replace(/([\\()])/g, '\\$1');
    const wrapped = lines.flatMap(line => {
      const text = clean(line), out = [];
      for (let i = 0; i < Math.max(text.length, 1); i += 92) out.push(text.slice(i, i + 92));
      return out;
    });
    const chunks = []; for (let i = 0; i < wrapped.length; i += 43) chunks.push(wrapped.slice(i, i + 43));
    if (!chunks.length) chunks.push([]);
    const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    const kids = [];
    chunks.forEach((chunk, i) => {
      const pageId = objects.length + 1, streamId = pageId + 1; kids.push(`${pageId} 0 R`);
      let stream = `BT /F1 18 Tf 48 790 Td (${clean(title)}) Tj /F1 10 Tf 0 -26 Td (PORTAL - DESIGN PREVIEW - NOT AN OFFICIAL RECORD) Tj 0 -25 Td `;
      for (const line of chunk) stream += `(${line}) Tj 0 -15 Td `;
      stream += `ET BT /F1 9 Tf 48 30 Td (Page ${i + 1} of ${chunks.length}) Tj ET`;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });
    objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'; objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
    let output = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((obj, i) => { offsets.push(output.length); output += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
    const xref = output.length; output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { output += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    return output + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  }
  function calendarFile(ctx) {
    const escapeICS = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const dateFor = (day, minute) => `202611${String(22 + day).padStart(2, '0')}T${time(minute).replace(':', '')}00`;
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portal//Student Life Preview//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Portal teaching week (preview)', 'X-WR-TIMEZONE:Africa/Cairo',
      'BEGIN:VTIMEZONE', 'TZID:Africa/Cairo', 'BEGIN:STANDARD', 'DTSTART:20261030T000000', 'TZOFFSETFROM:+0300', 'TZOFFSETTO:+0200', 'TZNAME:EET', 'END:STANDARD', 'END:VTIMEZONE'];
    meetings(ctx.state.group).forEach(m => lines.push('BEGIN:VEVENT', `UID:sl2-${m.id}@portal-preview.local`, 'DTSTAMP:20261114T080000Z', `SEQUENCE:${ctx.state.version}`, `DTSTART;TZID=Africa/Cairo:${dateFor(m.day, m.start)}`, `DTEND;TZID=Africa/Cairo:${dateFor(m.day, m.end)}`, 'RRULE:FREQ=WEEKLY;UNTIL=20270218T215959Z', `SUMMARY:${escapeICS(m.code + ' - ' + m.title + ' (' + m.type + ')')}`, `LOCATION:${escapeICS(m.room)}`, `DESCRIPTION:${escapeICS('Instructor: ' + m.instructor + '\nGroup ' + ctx.state.group + '\nDesign preview; not an official schedule.')}`, 'END:VEVENT'));
    lines.push('END:VCALENDAR');
    // RFC 5545 folding; the fixture is ASCII, so 73 characters are <75 octets.
    return lines.map(line => line.match(/.{1,73}/g)?.join('\r\n ') || '').join('\r\n') + '\r\n';
  }
  function downloadSchedule(ctx) {
    if (ctx.state.status !== 'processed' || !STUDENTS.includes(ctx.role)) { message(ctx, 'Only your processed schedule can be exported.', true); return; }
    const rows = meetings(ctx.state.group);
    const lines = ['Omar Hassan / 70-71577', `Winter 2026/2027 | Group ${ctx.state.group} | ${courses().reduce((n, c) => n + c.credits, 0)} credit hours`, 'Processed schedule | Africa/Cairo', 'Teaching period: 22 November 2026 - 18 February 2027 (preview)', '', ...rows.flatMap(m => [`${DAYS[m.day]} ${time(m.start)}-${time(m.end)} | ${m.code} | ${m.type}`, `${m.title} | ${m.room} | ${m.instructor}`, '']), `Days off: ${DAYS.filter((_, i) => !rows.some(m => m.day === i)).join(', ')}`];
    saveFile('portal-preview-processed-schedule.pdf', pdfBytes('Processed weekly schedule', lines), 'application/pdf');
  }

  function clearHeadActions(ctx) {
    $$('.actions,button,a.btn', ctx.head).forEach(el => el.remove());
  }
  function deny(ctx) {
    clearHeadActions(ctx);
    ctx.wrap.replaceChildren(ctx.head, labelled('This page is not available for your role', `<p>Use the pages assigned to your role. No student data or actions are shown here.</p>${route('overview', 'Back to Overview')}`, 'sl2-empty'));
  }
  function unavailable(ctx, title, text) {
    clearHeadActions(ctx);
    ctx.wrap.replaceChildren(ctx.head, labelled(title, `<p>${text}</p>${route('overview', 'Back to Overview')}`, 'sl2-empty'));
  }
  function apply(page, index, args) {
    const { root, role } = args;
    if (!root || !root.querySelector('.page-head')) return;
    const wrapper = html('div', `sl2-page sl2-${page}`);
    wrapper.dataset.sl2Page = page; wrapper.dataset.sl2Design = String(index + 1);
    wrapper.dataset.sl2Role = role;
    const source = [...root.children]; source.forEach(child => wrapper.append(child)); root.append(wrapper);
    const ctx = { root, wrap: wrapper, page, role, index, state: getState(role), scenario: scenario(page, role), head: $('.page-head', wrapper) };
    ctx.head.querySelector('h1').tabIndex = -1;
    const termContext=$('.workspace-term-context',ctx.head);if(termContext)termContext.textContent=termContext.textContent.replace(/Group \d+/, 'Group '+ctx.state.group);
    if (!PERMISSIONS[page]?.includes(role)) { deny(ctx); return; }
    if (ctx.scenario === 'processed') ctx.state.status = 'processed';
    if (ctx.scenario === 'ready') ctx.state.status = 'readyForStudentReview';
    if (ctx.scenario === 'draft') ctx.state.status = 'draft';
    if (ctx.scenario === 'pending' && !ctx.state.requests.length) ctx.state.requests = [{ id: 'preview-pending', meeting: '0-Tutorial', status: 'Pending', note: 'Prefer a later tutorial.', created: '14 Nov 2026, 10:00' }];
    if (ctx.scenario === 'resolved' && !ctx.state.requests.length) ctx.state.requests = [{ id: 'preview-approved', meeting: '0-Tutorial', status: 'Approved', note: 'Prefer a later tutorial.', response: 'Approved by Dr. Salma Adel. Replacement: Wednesday 14:00–15:30, C2.205, Tutorial group 2. Illustrative decision record; this scenario does not mutate the original fixture timetable.', created: '13 Nov 2026, 10:00' }, {id:'preview-rejected',meeting:'1-Lab',status:'Rejected',note:'Prefer Monday morning.',response:'No eligible alternative has capacity. Current assignment retained.',created:'12 Nov 2026, 09:00'}, {id:'preview-withdrawn',meeting:'2-Lecture',status:'Withdrawn',note:'No longer needed.',created:'11 Nov 2026, 12:00'}];
    if (ctx.scenario === 'error') {
      clearHeadActions(ctx);
      wrapper.replaceChildren(ctx.head, labelled('This information could not be loaded', `<p>Your previous changes are kept. Retry this page without signing in again.</p>${btn('Retry', 'retry', '', 'primary')}`, 'sl2-empty'));
    } else builders[page](ctx);
    // Keep reused approved symbol assets inside this contributor's folder.
    $$('img[src^="images/symbols/"]',wrapper).forEach(img=>{img.src=new URL('assets/'+img.getAttribute('src').split('/').pop(),baseURL).href;});
    wrapper.addEventListener('click', event => handleClick(ctx, event), true);
    wrapper.addEventListener('change', event => handleChange(ctx, event));
    wrapper.addEventListener('input', event => handleInput(ctx, event));
    wrapper.addEventListener('keydown', event => {
      if (event.target.closest('dialog[open]') && event.key === '/') event.stopPropagation();
      // Keep the host's tab handler away from the independent, scoped controls.
      if (event.target.matches('[data-sl2-roving]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        const items = $$('[data-sl2-roving]', event.target.parentElement); const current = items.indexOf(event.target);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
        items[next].focus(); items[next].click();
      }
    }, true);
    const foot = html('p', 'sl2-preview-note', 'Local design preview · 14 November 2026 snapshot · no live university or calendar changes');
    wrapper.append(foot);
  }

  function buildSchedule(ctx) {
    if (ctx.role === 'advisingStudent' && !['readyForStudentReview','processed'].includes(ctx.state.status)) { unavailable(ctx,'Your draft is still being prepared','Incomplete or unreleased advising drafts stay private. Your schedule appears after staff mark it Ready for Student Review.'); return; }
    if (ctx.role === 'normalStudent' && ctx.state.status !== 'processed') { unavailable(ctx, 'Your schedule has not been processed', 'Normal students can view only their own processed schedule. Your draft is not shown here.'); return; }
    if (['empty', 'unavailable'].includes(ctx.scenario)) { unavailable(ctx, 'Your schedule has not been released', 'Incomplete advising drafts stay private. Your weekly schedule appears after it is marked Ready for Student Review, or processed.'); return; }
    const oldWeek = $('.week-columns', ctx.wrap);
    const oldCards = $$('.week-class', oldWeek || document.createElement('div'));
    const tabs = $('.tabs', ctx.wrap);
    const existingExport = $('[data-action="export-calendar"]', ctx.head);
    if (existingExport) existingExport.textContent = 'Download .ics';
    const actions = $('.actions', ctx.head) || html('div', 'actions');
    if (!actions.parentElement) ctx.head.append(actions);
    actions.insertAdjacentHTML('beforeend', btn('Download PDF', 'schedule-pdf', '', 'primary') + btn('Print', 'schedule-print'));
    const exportable = STUDENTS.includes(ctx.role) && ctx.state.status === 'processed';
    $$('[data-action="export-calendar"],[data-sl2-action="schedule-pdf"],[data-sl2-action="schedule-print"]', actions).forEach(el => { el.disabled = !exportable; el.title = exportable ? 'Export your processed schedule' : 'Available after your schedule is processed'; });
    const status = html('div', 'sl2-context-row', `${chip(ctx.state.status === 'processed' ? 'Processed' : ctx.state.status === 'draft' ? 'Draft · staff-only view' : 'Ready for student review', ctx.state.status === 'draft' ? '' : 'good')}<span>Group ${ctx.state.group} · ${courses().reduce((n, c) => n + c.credits, 0)} credit hours · Africa/Cairo</span>${!exportable ? '<span class="sl2-muted">Export unlocks after processing.</span>' : ''}`);
    const body = html('div', 'sl2-schedule-body');
    const calendar = html('div', 'sl2-week');
    const ms = meetings(ctx.state.group).filter(m=>ctx.state.status!=='draft'||!['0-Lab','2-Tutorial'].includes(m.id));
    // Reuse the native timetable cards where possible, keeping approved course artwork.
    ms.forEach(m => {
      const nativeCard = oldCards.find(c => c.textContent.includes(m.code) && c.textContent.includes(m.type));
      const card = meetingCard(m);
      if (nativeCard) { const drawing = $('.course-drawing', nativeCard); if (drawing) $('.course-drawing', card)?.replaceWith(drawing); }
      m.card = card;
    });
    DAYS.forEach((day, i) => {
      const section = html('section', 'sl2-day', `<h2>${day}</h2>`); section.dataset.day = String(i); section.setAttribute('aria-label', day);
      const list = ms.filter(m => m.day === i);
      list.forEach(m => section.append(m.card));
      if (!list.length) section.insertAdjacentHTML('beforeend', `<div class="sl2-day-off"><span class="sl2-rest-mark" aria-hidden="true">—</span><span>No classes scheduled</span></div>`);
      calendar.append(section);
    });
    if (ctx.index === 3) {
      calendar.replaceChildren();
      courses().forEach(c => {
        const lane = html('section', 'sl2-course-lane', `<header>${art(c.code)}<h2>${esc(c.title)}<small>${c.code} · ${c.credits} credits</small></h2></header>`);
        ms.filter(m => m.code === c.code).forEach(m => { m.card.insertAdjacentHTML('afterbegin', `<span class="sl2-card-day">${DAYS[m.day]}</span>`); lane.append(m.card); }); calendar.append(lane);
      });
    }
    if (ctx.index === 7) {
      $$('.sl2-day', calendar).forEach((day, i) => { const fold = node(`<details class="sl2-day-fold" ${i < 2 ? 'open' : ''}><summary>${DAYS[i]} <span>${ms.filter(m => m.day === i).length || 'No'} meetings</span></summary></details>`); day.querySelector('h2').remove(); while (day.firstChild) fold.append(day.firstChild); day.replaceWith(fold); });
    }
    if (ctx.index === 8) {
      $$('.sl2-meeting', calendar).forEach(card => { const m = ms.find(row => row.id === card.dataset.meeting); card.insertAdjacentHTML('beforeend', `<span class="sl2-route-room">${m.room}<span aria-hidden="true"> →</span></span>`); });
    }
    const inspector = labelled('Meeting details', '<p>Select any class to inspect its lecture, tutorial or lab assignment.</p>', 'sl2-inspector');
    inspector.id = 'sl2-inspector';
    const requests = buildSlotRequests(ctx);
    if (ctx.index === 1) {
      const nav = html('nav', 'sl2-day-nav', DAYS.map((d, i) => btn(d, 'day', `data-day="${i}" data-sl2-roving aria-pressed="${i === 0}"`)).join(''));
      nav.setAttribute('aria-label', 'Choose a teaching day'); body.append(nav);
      $$('.sl2-day', calendar).forEach((day, i) => day.hidden = i !== 0);
    }
    if (ctx.index === 6) {
      const list = labelled('Course index', courses().map(c => btn(`${c.code}<small>${esc(c.title)}</small>`, 'filter-course', `data-course="${c.index}" aria-pressed="false"`)).join('') + btn('Show all courses', 'filter-course', 'data-course="all"'), 'sl2-course-index');
      body.append(list);
    }
    if (ctx.index === 9) body.append(labelled('Before processing', `<ol class="sl2-steps"><li class="is-done">Courses and components assigned</li><li class="is-current">${ctx.state.status === 'processed' ? 'Schedule processed' : 'Review your meeting times'}</li><li>${ctx.state.status === 'processed' ? 'Export or sync your final schedule' : 'Request one slot change if needed'}</li></ol>`, 'sl2-review-step'));
    body.append(calendar);
    if ([5, 6].includes(ctx.index)) body.append(inspector);
    if (ctx.role === 'advisingStudent') body.append(requests);
    else body.append(labelled('Schedule information', `<p>${STUDENTS.includes(ctx.role) ? 'Your final schedule' : 'Read-only student schedule'} · Group ${ctx.state.group}.</p><p>Thursday is free in the original Group 4 fixture. Select a class for full component details.</p>${STUDENTS.includes(ctx.role) ? route('calendar-sync', 'Calendar sync') : ''}`, 'sl2-schedule-note'));
    ctx.wrap.replaceChildren(ctx.head, status);
    if (tabs) ctx.wrap.append(tabs);
    if (typeof tab !== 'undefined' && tab === 'list') ctx.wrap.append(labelled('All assigned components', meetingTable(ms), 'sl2-course-schedule-list'));
    ctx.wrap.append(body);
    if(ctx.state.status==='draft')message(ctx,'Staff-only incomplete draft: two component assignments are missing. This read-only view does not release the schedule to the student.');
    if (['pending', 'resolved', 'processed', 'ready'].includes(ctx.scenario)) putState(ctx);
  }
  function buildSlotRequests(ctx) {
    const eligible = ctx.state.status === 'readyForStudentReview' && openDeadline(ctx);
    const content = `<p>${eligible ? 'Choose a meeting on your schedule, then request one slot change. Your advisor makes the final assignment.' : ctx.state.status === 'processed' ? 'This schedule is processed. Slot-change requests are closed.' : 'The advising deadline has passed. Your submitted requests remain visible.'}</p><p class="sl2-deadline">Advising deadline · 18 Nov 2026, 23:59 Cairo</p>${btn('Request a slot change', 'request-slot', eligible ? '' : 'disabled', 'row-control')}<div class="sl2-request-list">${ctx.state.requests.length ? ctx.state.requests.map(r => `<article><header><strong>${esc(meetings(ctx.state.group).find(m => m.id === r.meeting)?.code || '')} · ${esc(r.meeting.split('-')[1])}</strong>${chip(r.status, r.status === 'Pending' ? 'pending' : '')}</header><p>${esc(r.note || 'No preference note.')}</p><small>${esc(r.created)}</small>${r.response ? `<p class="sl2-response">${esc(r.response)}</p>` : ''}${r.status === 'Pending' ? btn('Withdraw', 'withdraw-slot', `data-id="${r.id}"`, 'text') : ''}</article>`).join('') : '<p class="sl2-muted">No slot-change requests yet.</p>'}</div>`;
    return labelled('Slot-change requests', content, 'sl2-request-rail');
  }
  function requestSlot(ctx, selected = '') {
    if (ctx.role !== 'advisingStudent' || ctx.state.status !== 'readyForStudentReview' || !openDeadline(ctx)) { message(ctx, 'Slot changes are available only before the advising deadline while your completed schedule is Ready for Student Review.', true); return; }
    const rows = meetings(ctx.state.group);
    dialogFor(ctx, 'Request one slot change', `<p>This asks your advisor to review a meeting. It does not change your timetable.</p><label class="sl2-field">Assigned course and component<select name="meeting" required>${rows.map(m => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${m.code} · ${m.type} · ${DAYS[m.day]} ${time(m.start)} · ${m.room}</option>`).join('')}</select></label><label class="sl2-field">Preference note <span class="sl2-muted">optional</span><textarea name="note" rows="4" maxlength="1000" placeholder="A preferred day or group, or a timing constraint."></textarea></label><p class="sl2-helper">Your current assignment is recorded with the request. Only a pending request can be withdrawn.</p>`, data => {
      if (!openDeadline(ctx) || ctx.state.status !== 'readyForStudentReview') throw new Error('The review window has closed. Reload your schedule.');
      if (ctx.state.requests.some(r => r.meeting === data.get('meeting') && r.status === 'Pending')) throw new Error('A pending request already exists for this component. Withdraw it before submitting another.');
      ctx.state.requests.push({ id: 'slot-' + Date.now(), meeting: data.get('meeting'), note: data.get('note').trim(), status: 'Pending', created: '14 Nov 2026, 10:00' });
      putState(ctx); rerender(); notify('Slot-change request submitted in this preview.');
    }, 'Submit request');
  }

  function sectionDetails(ctx, courseIndex) {
    const c = courses()[Number(courseIndex)];
    const rows = meetings(ctx.state.group).filter(m => m.index === c.index);
    return `<header class="sl2-course-detail-head">${art(c.code)}<div><h2>${esc(c.title)}</h2><p>${c.code} · ${c.credits} credit hours · Group ${ctx.state.group}</p></div></header><div class="sl2-assigned-sections">${rows.map(m => `<section data-component="${m.type}"><h3>${m.type}</h3><p><strong>${DAYS[m.day]} · ${time(m.start)}–${time(m.end)}</strong></p><p>${m.room} · ${m.instructor}</p>${btn('Inspect meeting', 'meeting', `data-meeting="${m.id}"`, 'text')}</section>`).join('')}</div>`;
  }
  function buildCourses(ctx) {
    if ((ctx.role==='normalStudent' && ctx.state.status!=='processed') || (ctx.role==='advisingStudent' && !['readyForStudentReview','processed'].includes(ctx.state.status))) { unavailable(ctx,'Your registered course assignments are not released','Course and section details follow the same visibility rules as your own schedule.'); return; }
    if (['empty', 'unavailable'].includes(ctx.scenario)) { unavailable(ctx, 'No registered courses yet', 'Your registered subjects and assigned sections appear after a schedule is released.'); return; }
    const list = $('.course-list', ctx.wrap); const nativeArticles = $$('article', list);
    list.classList.add('sl2-course-register');
    const total = courses().reduce((n, c) => n + c.credits, 0);
    const note = html('div', 'sl2-context-row', `${chip(`${courses().length} registered courses`)}<span>Total registered credit hours <strong>${total}</strong> · Group ${ctx.state.group}</span>`);
    const body = html('div', 'sl2-courses-body');
    const detail = labelled('Assigned sections', sectionDetails(ctx, 0), 'sl2-course-inspector'); detail.id = 'sl2-course-inspector';
    nativeArticles.forEach((article, i) => {
      article.dataset.courseIndex = String(i); article.dataset.search = `${courses()[i].code} ${courses()[i].title}`.toLowerCase();
      const existingLink = $('a[data-page="course-detail"]', article);
      if (existingLink) existingLink.textContent = 'Catalogue';
      $('.course-due .badge', article)?.remove();
      $('.course-due', article)?.insertAdjacentHTML('afterbegin', btn('Assigned sections', 'sections', `data-course="${i}" aria-expanded="${[0, 5, 6].includes(ctx.index)}"`, 'row-control'));
      article.insertAdjacentHTML('beforeend', `<span class="sl2-credit">${courses()[i].credits}<small>credits</small></span>`);
      if ([0, 5, 6].includes(ctx.index)) article.insertAdjacentHTML('beforeend', `<div class="sl2-inline-sections">${sectionDetails(ctx, i)}</div>`);
      if (ctx.index === 8) article.insertAdjacentHTML('afterbegin', `<label class="sl2-compare-check"><input type="checkbox" data-sl2-compare="${i}" ${i < 2 ? 'checked' : ''}><span class="sr-only">Compare ${courses()[i].code}</span></label>`);
    });
    if (ctx.index === 2) {
      body.append(labelled('Assigned components by course', `<div class="sl2-table-scroll" tabindex="0" role="region" aria-label="Course component comparison"><table class="sl2-table sl2-component-matrix"><thead><tr><th>Component</th>${courses().map(c => `<th>${c.code}<small>${esc(c.title)} · ${c.credits} credits</small></th>`).join('')}</tr></thead><tbody>${['Lecture', 'Tutorial', 'Lab'].map(type => `<tr><th scope="row">${type}</th>${courses().map(c => { const m = meetings(ctx.state.group).find(x => x.index === c.index && x.type === type); return `<td>${btn(`${DAYS[m.day]}<br>${time(m.start)}–${time(m.end)}<small>${m.room}</small>`, 'meeting', `data-meeting="${m.id}"`, 'text')}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`));
      const fold = node('<details class="sl2-native-fold"><summary>Course catalogue links</summary></details>'); fold.append(list); body.append(fold);
    } else if (ctx.index === 4) {
      body.append(labelled('Teaching-day index', DAYS.map((day, i) => `<details class="sl2-day-folder" ${i === 0 ? 'open' : ''}><summary>${day}<span>${meetings(ctx.state.group).filter(m => m.day === i).length} meetings</span></summary>${meetings(ctx.state.group).filter(m => m.day === i).map(m => `<div class="sl2-line"><span>${time(m.start)} · ${m.code} · ${m.type}</span>${btn('Course sections', 'sections', `data-course="${m.index}"`, 'text')}</div>`).join('') || '<p>No classes scheduled.</p>'}</details>`).join('')));
      body.append(list);
    } else if (ctx.index === 8) {
      body.append(list); const comparison = html('div', 'sl2-course-compare'); comparison.id = 'sl2-course-compare';
      comparison.innerHTML = [0, 1].map(i => `<section>${sectionDetails(ctx, i)}</section>`).join(''); body.append(comparison);
    } else {
      if (ctx.index === 9) body.append(html('label', 'sl2-field sl2-course-search', 'Find a registered course<input type="search" data-sl2-search="courses" placeholder="Course code or name"><span class="sl2-search-count" role="status">4 courses</span>'));
      if (ctx.index === 7) body.append(html('nav', 'sl2-component-nav', ['All', 'Lecture', 'Tutorial', 'Lab'].map((type, i) => btn(type, 'component', `data-type="${type}" aria-pressed="${i === 0}" data-sl2-roving`)).join('')));
      body.append(list);
      if ([1, 3, 7, 9].includes(ctx.index)) body.append(detail);
    }
    ctx.wrap.replaceChildren(ctx.head, note, body);
    body.append(html('p', 'sl2-total', `Total registered credit hours <strong>${total}</strong>`));
    if (ctx.index === 6) $$('.sl2-inline-sections', list).forEach((section, i) => { const folder = node(`<details class="sl2-course-folder" ${i === 0 ? 'open' : ''}><summary>Lecture, tutorial & lab</summary></details>`); section.replaceWith(folder); folder.append(section); });
  }

  function buildSwap(ctx) {
    if (ctx.scenario === 'unavailable' || ctx.state.status !== 'processed') { unavailable(ctx, 'A processed schedule is required', 'Whole-schedule swaps require an eligible, processed schedule for the current term.'); return; }
    const activeTab = typeof tab !== 'undefined' ? tab : 'groups';
    const nativeTabs = $('.tabs', ctx.wrap);
    const nativeCards = $$('.course-option', ctx.wrap);
    const note = html('div', 'sl2-context-row', `${chip('Current group ' + ctx.state.group)}<span>${courses().length} identical registered subjects · 19 credits</span><span class="sl2-deadline">Swap deadline · 13 Dec 2026, 23:59 Cairo</span>`);
    ctx.wrap.replaceChildren(ctx.head, note);
    if (nativeTabs) ctx.wrap.append(nativeTabs);
    if (ctx.scenario === 'pending' && !ctx.state.swaps.length) ctx.state.swaps = [{id:'swap-pending',from:ctx.state.group,desired:[1,2],status:'Open',created:'14 Nov 2026, 10:00'}];
    if (ctx.scenario === 'resolved' && !ctx.state.swaps.length) ctx.state.swaps = [{id:'swap-completed',from:4,desired:[1],completed:1,status:'Completed',created:'12 Nov 2026, 10:00'},{id:'swap-withdrawn',from:4,desired:[2],status:'Withdrawn',created:'11 Nov 2026, 10:00'},{id:'swap-expired',from:4,desired:[1,2],status:'Expired',created:'10 Nov 2026, 10:00'}];
    if (!openDeadline(ctx)) { ctx.state.swaps.forEach(r => { if (r.status === 'Open') r.status = 'Expired'; }); putState(ctx); }
    if (['pending','resolved'].includes(ctx.scenario)) putState(ctx);
    const active = ctx.state.swaps.find(r => r.status === 'Open');
    const body = html('div', 'sl2-swap-body');
    const groups = [1, 2, 4].filter(g => g !== ctx.state.group);
    if (ctx.scenario === 'empty') {
      body.append(labelled('No eligible destination groups', '<p>A destination must have the same term and exactly the same registered course-code set. Your current schedule is unchanged.</p>', 'sl2-empty'));
    } else if (activeTab === 'mine') {
      body.append(labelled('Your whole-schedule requests', `<div class="sl2-request-list">${ctx.state.swaps.length ? ctx.state.swaps.map(r => `<article><header><strong>Group ${r.from} → ${r.desired.map(g => 'Group ' + g).join(', ')}</strong>${chip(r.status, r.status === 'Open' ? 'pending' : '')}</header><p>Submitted ${esc(r.created)} · Same four registered subjects</p>${r.completed ? `<p>Completed into Group ${r.completed}. Every assigned component moved together.</p>` : ''}${r.status === 'Open' ? btn('Withdraw request', 'withdraw-swap', `data-id="${r.id}"`, 'text') : ''}</article>`).join('') : '<p>You have not submitted or completed a request in this preview.</p>'}</div>${btn('View eligible groups', 'swap-tab', 'data-tab-target="groups"', 'row-control')}`, 'sl2-swap-history'));
    } else if (activeTab === 'open') {
      const offers = ctx.state.completedOffer ? [] : [groups[0]];
      body.append(labelled('Eligible open exchanges', `<p>Requester identity stays private. Only matching processed schedules are listed.</p>${offers.length ? offers.map(g => `<article class="sl2-offer"><header><h3>Move into Group ${g}</h3>${chip('Open', 'pending')}</header><p>Requester has Group ${g}; wants Group ${ctx.state.group}. Same term and exact subject set.</p>${meetingTable(meetings(g), `Complete Group ${g} schedule`)}${btn('Exchange full schedules', 'complete-swap', `data-group="${g}" ${openDeadline(ctx) ? '' : 'disabled'}`, 'primary')}</article>`).join('') : '<p>No eligible open requests remain.</p>'}`, 'sl2-open-exchanges'));
    } else {
      const picker = html('div', 'sl2-group-picker');
      groups.forEach((group, i) => {
        const item = nativeCards[i] || html('section', 'course-option');
        item.classList.add('sl2-group'); item.dataset.group = String(group);
        // Keep the native group card and buttons; replace its fixture-specific labels.
        item.innerHTML = `<label class="sl2-group-choice"><input type="checkbox" data-sl2-destination="${group}" ${active || !openDeadline(ctx) ? 'disabled' : ''}><span><strong>Group ${group}</strong><small>Same 4 subjects · 19 credits</small></span></label><dl class="sl2-group-facts"><div><dt>Days off</dt><dd>${DAYS.filter((_, day) => !meetings(group).some(m => m.day === day)).join(', ')}</dd></div><div><dt>First meeting</dt><dd>${time(Math.min(...meetings(group).map(m => m.start)))}</dd></div></dl><div class="sl2-group-week">${miniWeek(group)}</div><div class="form-footer">${btn('Complete schedule', 'group-schedule', `data-group="${group}"`, 'row-control')}${btn('Select group', 'select-group', `data-group="${group}" ${active || !openDeadline(ctx) ? 'disabled' : ''}`, 'text')}</div>`;
        picker.append(item);
      });
      const selection = labelled('Your selection', `<p>Current group <strong>${ctx.state.group}</strong> is taken from your processed schedule and cannot be edited.</p><output id="sl2-swap-selection" aria-live="polite">No destination groups selected.</output>${btn('Review swap request', 'submit-swap', active || !openDeadline(ctx) ? 'disabled' : '', 'primary')}<p class="sl2-helper">One active request at a time. Your full schedule moves; your subjects do not change.</p>${active ? `<p class="sl2-response">An open request already exists.</p>${btn('View my request', 'swap-tab', 'data-tab-target="mine"', 'row-control')}` : ''}${!openDeadline(ctx) ? '<p class="sl2-response">The swap deadline has passed.</p>' : ''}`, 'sl2-selection');
      if ([1, 6].includes(ctx.index)) body.append(labelled(`Your current Group ${ctx.state.group}`, ctx.index === 6 ? meetingTable(meetings(ctx.state.group), 'Current component assignments') : miniWeek(ctx.state.group), 'sl2-current-group'));
      if (ctx.index === 3) body.append(html('label', 'sl2-field sl2-day-filter', `Preferred day off<select data-sl2-dayoff-filter><option value="">Any day</option>${DAYS.map(d => `<option>${d}</option>`).join('')}</select><span class="sl2-search-count" role="status">${groups.length} eligible groups</span>`));
      body.append(picker, selection);
      if (ctx.index === 4) picker.querySelectorAll('.sl2-group-week').forEach((el, i) => { el.innerHTML = meetingTable(meetings(groups[i]), `Complete Group ${groups[i]} schedule`); });
      if (ctx.index === 6) picker.querySelectorAll('.sl2-group-week').forEach((el, i) => {
        const current = meetings(ctx.state.group), next = meetings(groups[i]);
        el.innerHTML = `<div class="sl2-change-map">${current.map(m => { const n = next.find(x => x.id === m.id); return `<p><strong>${m.code} · ${m.type}</strong><span>${DAYS[m.day]} ${time(m.start)} → ${DAYS[n.day]} ${time(n.start)}</span></p>`; }).join('')}</div>`;
      });
      if (ctx.index === 7) body.prepend(labelled('An exchange is available', `<p>Compare the anonymous requester’s complete schedule before exchanging.</p>${btn('Open exchange inbox', 'swap-tab', 'data-tab-target="open"', 'row-control')}`, 'sl2-exchange-entry'));
      if (ctx.index === 8) body.prepend(labelled('Request history', `<p>${ctx.state.swaps.length ? `${ctx.state.swaps.length} requests in your local history.` : 'No requests submitted yet.'}</p>${btn('Open my requests', 'swap-tab', 'data-tab-target="mine"', 'row-control')}`, 'sl2-history-entry'));
    }
    ctx.wrap.append(body);
  }

  function preferenceSections(ctx) {
    const source = $('.preference-workspace', ctx.wrap);
    const days = $('#preferred-days', source)?.closest('.preference-block');
    const groups = $('#preferred-groups', source)?.closest('.preference-block');
    const notes = $('#preference-notes', source)?.closest('.preference-block');
    const p = ctx.state.prefs;
    if (!days || !groups || !notes) return [];
    days.dataset.sl2Block = 'days'; groups.dataset.sl2Block = 'groups'; notes.dataset.sl2Block = 'notes';
    $$('.dayoff', days).forEach(el => el.checked = p.days.includes(el.value));
    $('#preferred-day-count', days).textContent = `${p.days.length} of 2 selected`;
    days.insertAdjacentHTML('beforeend', `<details class="sl2-preference-extra"><summary>Preferred & avoided teaching days</summary><fieldset><legend>Prefer teaching on</legend>${DAYS.map(d => `<label><input type="checkbox" data-sl2-preferred value="${d}" ${p.preferred.includes(d) ? 'checked' : ''}>${d}</label>`).join('')}</fieldset><fieldset><legend>Avoid teaching on</legend>${DAYS.map(d => `<label><input type="checkbox" data-sl2-avoided value="${d}" ${p.avoided.includes(d) ? 'checked' : ''}>${d}</label>`).join('')}</fieldset></details>`);
    $$('.preference-course', groups).forEach((row, i) => {
      const groupSelect = $('[data-course-group]', row);
      if (![...groupSelect.options].some(o=>o.value==='No preference')) groupSelect.add(new Option('No preference','No preference'),0);
      groupSelect.value = p.groups[i];
      row.insertAdjacentHTML('beforeend', `<select data-sl2-pref-component="${i}" aria-label="${courses()[i].code} component">${['Lecture', 'Tutorial', 'Lab'].map(type => `<option ${p.components[i] === type ? 'selected' : ''}>${type}</option>`).join('')}</select><label class="sl2-priority-label">Priority<input type="number" min="1" max="20" value="${p.priorities[i]}" data-sl2-pref-priority="${i}" aria-label="${courses()[i].code} priority"></label>`);
    });
    $('#preference-notes', notes).value = p.notes; $('#preference-notes', notes).maxLength = 1000;
    notes.insertAdjacentHTML('beforeend', `<p class="sl2-character-count">${p.notes.length} / 1000 characters</p>`);
    const times = labelled('Preferred & avoided time ranges', `<div class="sl2-time-rows">${p.times.map((row, i) => timePreferenceRow(row, i)).join('')}</div>${btn('Add time range', 'add-time', '', 'row-control')}<p class="sl2-helper">Use Cairo time. An end time must be later than its start time.</p>`, 'preference-block sl2-time-preferences');
    times.dataset.sl2Block = 'times';
    return [days, groups, times, notes];
  }
  function timePreferenceRow(row = {}, i = 0) {
    return `<div class="sl2-time-row" data-sl2-time-row><label>Kind<select data-field="kind"><option ${row.kind === 'Prefer' ? 'selected' : ''}>Prefer</option><option ${row.kind !== 'Prefer' ? 'selected' : ''}>Avoid</option></select></label><label>Day<select data-field="day">${DAYS.map(d => `<option ${row.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></label><label>From<input type="time" data-field="start" value="${row.start || '08:30'}" required></label><label>To<input type="time" data-field="end" value="${row.end || '10:00'}" required></label><label>Priority<input type="number" min="1" max="20" data-field="priority" value="${row.priority || i + 1}" required></label>${btn('Remove', 'remove-time', '', 'text')}</div>`;
  }
  function readPreferences(ctx) {
    return {
      days: $$('.dayoff:checked', ctx.wrap).map(el => el.value),
      preferred: $$('[data-sl2-preferred]:checked', ctx.wrap).map(el => el.value),
      avoided: $$('[data-sl2-avoided]:checked', ctx.wrap).map(el => el.value),
      groups: $$('[data-course-group]', ctx.wrap).map(el => el.value),
      components: $$('[data-sl2-pref-component]', ctx.wrap).map(el => el.value),
      priorities: $$('[data-sl2-pref-priority]', ctx.wrap).map(el => Number(el.value)),
      notes: $('#preference-notes', ctx.wrap)?.value || '',
      times: $$('[data-sl2-time-row]', ctx.wrap).map(row => Object.fromEntries($$('[data-field]', row).map(el => [el.dataset.field, el.dataset.field === 'priority' ? Number(el.value) : el.value]))),
      order: $$('[data-sl2-block]', ctx.wrap).map(el => el.dataset.sl2Block), saved: ctx.state.prefs.saved
    };
  }
  function validatePreferences(p) {
    if (p.days.length > 2) return 'Choose no more than two desired days off.';
    if (p.preferred.some(day => p.avoided.includes(day) || p.days.includes(day))) return 'A preferred teaching day cannot also be avoided or requested as a day off.';
    if (p.notes.trim().length > 1000) return 'Keep the note to 1000 characters or fewer.';
    if (p.priorities.some(x => !Number.isInteger(x) || x < 1 || x > 20)) return 'Course-group priorities must be whole numbers from 1 to 20.';
    const seen = new Set();
    for (const row of p.times) {
      if (!row.start || !row.end || row.start >= row.end) return 'Each time range must end after it starts.';
      if (!Number.isInteger(row.priority) || row.priority < 1 || row.priority > 20) return 'Time-range priorities must be whole numbers from 1 to 20.';
      const key = [row.day, row.start, row.end].join(':');
      if (seen.has(key)) return 'Remove duplicate or contradictory time ranges.';
      seen.add(key);
    }
    return '';
  }
  function preferenceSummary(p) {
    return `<dl class="sl2-summary"><div><dt>Desired days off</dt><dd>${p.days.join(', ') || 'No preference'}</dd></div><div><dt>Preferred days</dt><dd>${p.preferred.join(', ') || 'No preference'}</dd></div><div><dt>Avoided days</dt><dd>${p.avoided.join(', ') || 'None'}</dd></div><div><dt>Time ranges</dt><dd>${p.times.length ? p.times.map(r => `${r.kind} ${r.day} ${r.start}–${r.end} · priority ${r.priority}`).join('<br>') : 'No time ranges'}</dd></div><div><dt>Course groups</dt><dd>${courses().map((c, i) => `${c.code}: ${esc(p.groups[i])} · ${esc(p.components[i])} · priority ${p.priorities[i]}`).join('<br>')}</dd></div><div><dt>Note</dt><dd>${esc(p.notes || 'No note')}</dd></div></dl>`;
  }
  function buildPreferences(ctx) {
    // Original keeps these three fields in its own in-memory model. Honor edits
    // made there without discarding the additional variant-only preferences.
    if(typeof preferencesState !== 'undefined'){
      const native=JSON.stringify(preferencesState);
      const originalDefault=JSON.stringify({days:['Thursday'],groups:Array(4).fill('Group 4'),notes:'I would prefer to keep Thursday free.'});
      if((lastHostPreferences===null && native!==originalDefault)||(lastHostPreferences!==null && native!==lastHostPreferences)){
        ctx.state.prefs={...ctx.state.prefs,...JSON.parse(native)};putState(ctx);
      }
      lastHostPreferences=native;
    }
    if (ctx.scenario === 'empty') ctx.state.prefs = {...defaultState(ctx.role).prefs,days:[],preferred:[],avoided:[],groups:Array(4).fill('No preference'),times:[],notes:'',saved:null};
    const sections = preferenceSections(ctx); const by = Object.fromEntries(sections.map(el => [el.dataset.sl2Block, el]));
    const editable = ctx.role === 'advisingStudent' && openDeadline(ctx) && ctx.scenario !== 'unavailable';
    const save = $('[data-action="save-preferences"]', ctx.head); if (save) { save.disabled = !editable; save.title = editable ? 'Save your scheduling preferences' : 'Read-only preferences'; }
    const notice = html('div', 'sl2-context-row', `${chip(editable ? 'Open for updates' : ctx.role !== 'advisingStudent' ? 'Read-only student submission' : ctx.scenario === 'unavailable' ? 'Updates unavailable' : 'Deadline passed', editable ? 'good' : '')}<span>Advising deadline · 18 Nov 2026, 23:59 Cairo</span><span class="sl2-saved">${ctx.state.prefs.saved ? 'Last saved '+ctx.state.prefs.saved : 'Not submitted yet'}</span>`);
    const body = html('div', 'sl2-preferences-body');
    const ordered = (ctx.index === 1 ? ctx.state.prefs.order : ctx.index === 3 || ctx.index === 8 ? ['groups', 'days', 'times', 'notes'] : ctx.index === 7 ? ['notes', 'days', 'groups', 'times'] : ['days', 'groups', 'times', 'notes']).map(key => by[key]);
    ordered.forEach((section, i) => {
      if (!section) return;
      section.classList.add('sl2-pref-section');
      if (ctx.index === 1) section.insertAdjacentHTML('afterbegin', `<div class="sl2-rank"><span>Priority ${i + 1}</span>${btn('Move up', 'move-preference', 'data-direction="-1"', 'text')}${btn('Move down', 'move-preference', 'data-direction="1"', 'text')}</div>`);
      if (ctx.index === 6) { const fold = node(`<details class="sl2-pref-fold" ${i === 0 ? 'open' : ''}><summary>${{days:'Days and days off',groups:'Course groups',times:'Time ranges',notes:'Note for your advisor'}[section.dataset.sl2Block]}</summary></details>`); fold.append(section); body.append(fold); }
      else body.append(section);
    });
    if (ctx.index === 2) body.prepend(labelled('Weekly preference map', `<div class="sl2-preference-map">${DAYS.map(d => `<div><strong>${d}</strong><span data-sl2-map-day="${d}">${ctx.state.prefs.days.includes(d) ? 'Day off requested' : 'Open to classes'}</span></div>`).join('')}</div>`, 'sl2-map-block'));
    if (ctx.index === 4) body.append(labelled('Review before saving', `<div id="sl2-preference-summary">${preferenceSummary(ctx.state.prefs)}</div>`, 'sl2-review-summary'));
    if (ctx.index === 7) by.notes.prepend(html('div', 'sl2-advisor-note-header', conversation() + '<div><h2>A note for Dr. Salma</h2><p>Explain the constraint behind your choices.</p></div>'));
    if (ctx.index === 9) body.prepend(labelled('Your released teaching week', miniWeek(ctx.state.group) + '<p class="sl2-helper">This is context, not an editable timetable. Saving preferences never changes assigned slots.</p>', 'sl2-preference-week'));
    if (ctx.index === 5) {
      body.prepend(html('nav', 'sl2-step-nav', ['Days', 'Groups', 'Times', 'Note & review'].map((s, i) => btn(`${i + 1}. ${s}`, 'preference-step', `data-step="${i}" aria-pressed="${i === 0}" data-sl2-roving`)).join('')));
      sections.forEach((section, i) => section.hidden = i !== 0);
      body.append(html('div', 'sl2-step-footer', btn('Previous', 'preference-step-relative', 'data-direction="-1" disabled') + btn('Next', 'preference-step-relative', 'data-direction="1"', 'primary'))); ctx.step = 0;
    }
    const rules = html('p', 'sl2-preference-rule', 'Preferences guide your advisor; they are not guaranteed. Mandatory courses, prerequisites, published offerings, capacity, clashes, credit limits and approved extra-hour rules always take precedence.');
    ctx.wrap.replaceChildren(ctx.head, notice, body, rules);
    if (!editable) $$('input,select,textarea,[data-sl2-action]', body).forEach(el => { if (!el.matches('[data-sl2-action="preference-step"],[data-sl2-action="preference-step-relative"]')) el.disabled = true; });
    if (ctx.role !== 'advisingStudent') ctx.wrap.append(html('p', 'sl2-staff-handoff', route('draft-schedule', 'Return to advising draft')));
    if (ctx.scenario === 'empty') { message(ctx, 'No preferences have been submitted. A schedule can still be prepared.'); }
  }

  const HISTORY = [
    { code:'CSEN 401', title:'Computer Programming', credits:5, grade:'1.7', year:'2024/2025', term:'Winter', status:'Completed' },
    { code:'MATH 401', title:'Discrete Mathematics', credits:5, grade:'2.0', year:'2024/2025', term:'Spring', status:'Completed' },
    { code:'CSEN 501', title:'Database Systems', credits:5, grade:'1.3', year:'2025/2026', term:'Winter', status:'Completed' },
    { code:'CSEN 502', title:'Operating Systems', credits:5, grade:'1.7', year:'2025/2026', term:'Spring', status:'Completed' },
    { code:'HUMA 601', title:'Research & Communication', credits:3, grade:'2.3', year:'2025/2026', term:'Summer', status:'Completed' },
    { code:'MATH 601', title:'Probability & Statistics', credits:4, grade:'3.0', year:'2025/2026', term:'First makeup', status:'Completed' },
    { code:'ELCT 601', title:'Digital Logic', credits:4, grade:'2.7', year:'2025/2026', term:'Second makeup', status:'Completed' }
  ];
  const REMAINING = [
    {code:'CSEN 801', title:'Distributed Systems', credits:5, prerequisites:'CSEN 502', season:'Spring', status:'Remaining'},
    {code:'CSEN 802', title:'Software Architecture', credits:5, prerequisites:'CSEN 501', season:'Spring', status:'Remaining'},
    {code:'BACH 001', title:'Bachelor Project', credits:12, prerequisites:'Eligibility reviewed by advisor', season:'Winter or Spring', status:'Remaining'}
  ];
  function recordsRows(ctx) {
    return [...HISTORY, ...courses().map(c => ({...c, grade:'—', year:'2026/2027', term:'Winter', status:'Current'})), ...REMAINING];
  }
  function recordTable(rows, caption = 'Academic history') {
    return `<div class="sl2-table-scroll" tabindex="0" role="region" aria-label="${esc(caption)}"><table class="sl2-table"><caption>${esc(caption)}</caption><thead><tr><th>Course</th><th>Credits</th><th>Result / requirement</th><th>Term / season</th></tr></thead><tbody>${rows.map(row => `<tr data-sl2-record data-search="${esc([row.code,row.title,row.term,row.status].join(' ').toLowerCase())}"><th scope="row">${row.code}<small>${esc(row.title)}</small></th><td>${row.credits}</td><td>${row.status === 'Remaining' ? `<span class="sl2-muted">Prerequisites</span><br>${esc(row.prerequisites)}` : row.status === 'Current' ? chip('In progress') : esc(row.grade)}</td><td>${esc(row.season || row.term)}${row.year ? `<small>${row.year}</small>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function transcript(ctx, year) {
    const rows = HISTORY.filter(r => r.year === year);
    return `<div class="sl2-transcript-document"><header><span class="sl2-document-label">Academic transcript · preview</span><h2>${year}</h2><p>Omar Hassan · 70-71577 · Computer Engineering</p></header>${rows.length ? recordTable(rows, `Transcript for ${year}`) : '<p>No transcript results in this year.</p>'}<footer>Displayed year only · sample results, not an official transcript</footer></div>`;
  }
  function buildRecords(ctx) {
    const tabs = $('.tabs', ctx.wrap); const nativeTable = $('.tablewrap', ctx.wrap);
    const nativeWallet = ctx.role === 'advisingStudent' && typeof tab !== 'undefined' && tab === 'wallet';
    if (ctx.role !== 'advisingStudent') $$('[data-tab="wallet"]', tabs || ctx.wrap).forEach(el=>el.remove());
    if (ctx.scenario === 'unavailable') { unavailable(ctx, 'This academic record is unavailable', 'Select an advising student you are authorized to view, or return to Overview.'); return; }
    const displayed = safeRead('record-year:' + ctx.role, '2025/2026'); ctx.year = displayed;
    const activeTab = typeof tab !== 'undefined' ? tab : 'history';
    if (ctx.scenario === 'empty') { unavailable(ctx, 'No academic records are available', 'There are no attended years or course attempts for this preview student.'); return; }
    const standing = html('p', 'sl2-record-subject', '<strong>Omar Hassan</strong> · 70-71577 · Computer Engineering<br><span>Advisor: Dr. Salma Adel · GPA 1.70 · 116 completed hours · Semester 7</span>');
    const controls = html('div', 'sl2-record-controls', `<label>Attended academic year<select data-sl2-year>${['2025/2026','2024/2025'].map(y => `<option ${y === displayed ? 'selected' : ''}>${y}</option>`).join('')}</select></label>${btn('View transcript', 'show-transcript', '', 'row-control')}`);
    const nativeDownload = $('[data-action="transcript"]', ctx.head);
    if (nativeDownload) nativeDownload.textContent = 'Download displayed PDF';
    else ctx.head.append(html('div','actions',btn('Download displayed PDF', 'transcript-pdf', '', 'primary')));
    const body = html('div', 'sl2-records-body');
    if (nativeWallet) {
      if (nativeTable) body.append(nativeTable);
      body.append(html('p','sl2-helper','This is the original preview wallet ledger. Real wallet and settlement workflows remain in the existing React application.'));
    } else if (activeTab === 'transcript' || [0,3,5,6,9].includes(ctx.index)) {
      if ([0,3].includes(ctx.index)) body.append(labelled('Attended years', ['2025/2026','2024/2025'].map(y => btn(`<span class="sl2-file-tab" aria-hidden="true"></span><strong>${y}</strong><small>${HISTORY.filter(r=>r.year===y).length} result records</small>`, 'record-year', `data-year="${y}" aria-pressed="${y===displayed}"`)).join(''), 'sl2-year-index'));
      const document = html('section','sl2-transcript-sheet',transcript(ctx,displayed)); document.id='sl2-transcript'; body.append(document);
      if(ctx.index===5) body.append(labelled('Compare with another attended year', `<label class="sl2-field">Comparison year<select data-sl2-compare-year><option ${displayed==='2025/2026'?'selected':''}>2024/2025</option><option ${displayed==='2024/2025'?'selected':''}>2025/2026</option></select></label><div id="sl2-comparison-transcript">${transcript(ctx,displayed==='2025/2026'?'2024/2025':'2025/2026')}</div>`, 'sl2-year-comparison'));
      if(ctx.index===6) {
        document.innerHTML=`<header><h2>${displayed} transcript</h2><p>All applicable examination periods.</p></header>${['Winter','Spring','Summer','First makeup','Second makeup'].map(term=>{const rows=HISTORY.filter(r=>r.year===displayed&&r.term===term);return `<details class="sl2-term-folder" ${rows.length?'open':''}><summary>${term}<span>${rows.length} results</span></summary>${rows.length?recordTable(rows,term+' results'):'<p>No results in this period.</p>'}</details>`;}).join('')}`;
      }
      if(activeTab!=='transcript') body.append(buildHistory(ctx));
    } else body.append(buildHistory(ctx));
    ctx.wrap.replaceChildren(ctx.head,standing); if(tabs)ctx.wrap.append(tabs); if(!nativeWallet)ctx.wrap.append(controls);ctx.wrap.append(body);
  }
  function buildHistory(ctx) {
    const history=html('div','sl2-history');
    const blocks=[['Completed courses',HISTORY],['Current courses',courses().map(c=>({...c,status:'Current',term:'Winter',year:'2026/2027'}))],['Remaining courses',REMAINING]];
    if(ctx.index===7)blocks.unshift(blocks.pop());
    if(ctx.index===8)history.append(html('label','sl2-field sl2-result-search','Find a result or requirement<input type="search" data-sl2-search="records" placeholder="Course code, name, term or status"><span class="sl2-search-count" role="status">All records</span>'));
    blocks.forEach(([label,rows])=>{
      const section=labelled(label,recordTable(rows,label),'sl2-history-block');
      if(ctx.index===2) {
        section.innerHTML=`<header class="sl2-section-head"><h2>${label}</h2></header>${rows.map(row=>`<details class="sl2-record-dossier"><summary><strong>${row.code}</strong><span>${esc(row.title)}</span><small>${row.credits} credits</small></summary>${recordTable([row],row.code+' course record')}</details>`).join('')}`;
      }
      history.append(section);
    });
    history.append(html('p','sl2-helper','Illustrative course attempts are a partial preview fixture. The 116-hour total is inherited from the supplied profile; these sample rows are not a complete official history.'));
    return history;
  }
  function downloadTranscript(ctx) {
    const rows=HISTORY.filter(r=>r.year===ctx.year);
    const lines=['Omar Hassan / 70-71577 / Computer Engineering',`Displayed academic year: ${ctx.year}`,'Advisor: Dr. Salma Adel','GPA: 1.70 | Completed hours: 116 | Current semester: 7','Illustrative attempts only; not the full official academic record.',''];
    ['Winter','Spring','Summer','First makeup','Second makeup'].forEach(term=>{const results=rows.filter(r=>r.term===term);lines.push(term);if(results.length)results.forEach(r=>lines.push(`${r.code} | ${r.title} | ${r.credits} credits | Grade ${r.grade}`));else lines.push('No results in this period.');lines.push('');});
    saveFile(`portal-preview-transcript-${ctx.year.replace('/','-')}.pdf`,pdfBytes('Academic transcript',lines),'application/pdf');
  }

  function buildAdvisor(ctx) {
    if(['empty','unassigned','unavailable'].includes(ctx.scenario)){unavailable(ctx,'No advisor is assigned yet','Your coordinator will assign an advisor. Contact details will appear here when the assignment is available.');return;}
    const layout=$('.advising-layout',ctx.wrap),identity=$('.advisor-identity',layout),details=$('.advisor-details > .details',layout),checklist=$('.advisor-checklist',layout),callout=$('.advisor-callout',layout),deadline=$('.advisor-deadline',layout);
    const contact=html('section','sl2-advisor-contact');if(identity)contact.append(identity);if(details)contact.append(details);
    const address=$('a[href^="mailto:"]',contact)?.getAttribute('href')?.slice(7)||'salma.adel@guc.edu.eg';ctx.advisorEmail=address;
    contact.append(html('div','sl2-contact-actions',`<a class="btn primary" href="mailto:${address}">Email advisor</a>${btn('Copy email','copy-email','','row-control')}`));
    if(checklist){$$('input',checklist).forEach((el,i)=>{el.dataset.sl2Check=String(i);el.checked=ctx.state.checks[i]||false;});checklist.insertAdjacentHTML('beforeend',`<p class="sl2-check-progress" role="status">${ctx.state.checks.filter(Boolean).length} of 3 prepared</p>`);}
    const prep=html('section','sl2-meeting-preparation');if(checklist)prep.append(checklist);
    prep.insertAdjacentHTML('beforeend',`<label class="sl2-field sl2-advisor-note">Questions to bring<textarea data-sl2-advisor-note rows="4" maxlength="1000" placeholder="Keep a private note for your meeting.">${esc(ctx.state.advisorNote)}</textarea></label><p class="sl2-helper">Saved only in this browser session; not sent to your advisor.</p>`);
    const next=html('aside','sl2-advisor-next');if(callout)next.append(callout);if(deadline)next.append(deadline);
    const body=html('div','sl2-advisor-body');
    if(ctx.index===3)body.append(labelled('Office hours',`<div class="sl2-office-slot"><span>Tuesday</span><strong>12:00–14:00</strong><span>C3.204 · Africa/Cairo</span></div><p>These are the listed office hours, not an appointment booking. Email your advisor to agree on a time.</p>`,'sl2-office-agenda'));
    if(ctx.index===5){prep.prepend(html('div','sl2-advisor-note-header',conversation()+'<div><h2>Prepare your email</h2><p>Your mail app sends the message.</p></div>'));prep.insertAdjacentHTML('beforeend',btn('Open email draft','draft-email','','primary'));}
    if(ctx.index===6){const folder=node('<details class="sl2-advisor-folder" open><summary>Assigned advisor · contact record</summary></details>');folder.append(contact);body.append(folder);}else body.append(contact);
    if(ctx.index===8){const fold=node('<details class="sl2-prep-fold"><summary>Prepare for your meeting</summary></details>');fold.append(prep);body.append(fold);}else body.append(prep);
    body.append(next);ctx.wrap.replaceChildren(ctx.head,body);
  }

  function buildCalendar(ctx) {
    const original=$('.student-calendar',ctx.wrap);
    const provider=$('.calendar-provider',original);const lastSync=$('.calendar-last-sync',original);const file=$('.calendar-file',original);
    if(typeof connected!=='undefined'){
      if((lastHostConnection===null && connected!==true)||(lastHostConnection!==null && connected!==lastHostConnection)){
        ctx.state.connected=connected;putState(ctx);
      }
      lastHostConnection=ctx.state.connected;
    }
    if(ctx.scenario==='empty'||ctx.scenario==='unavailable')ctx.state.status='draft';
    const ready=ctx.state.status==='processed';
    if(typeof connected!=='undefined')connected=ctx.state.connected;
    const connection=html('section','sl2-calendar-connection');
    if(provider){connection.append(provider);$('h2',provider).textContent='Google Calendar';$('p',provider).textContent=ctx.state.connected?'Connected as omar.hassan@student.guc.edu.eg':'Not connected. Choose an account through the provider.';const toggle=$('[data-action="toggle-calendar"]',provider);toggle.textContent=ctx.state.connected?'Disconnect':'Connect account';}
    else connection.innerHTML=`<header><h2>Google Calendar</h2>${btn(ctx.state.connected?'Disconnect':'Connect account','toggle-calendar')}</header>`;
    connection.append(html('p','sl2-connection-status',chip(ctx.state.connected?'Connected':'Not connected',ctx.state.connected?'good':'')));
    const sync=lastSync||html('div','calendar-last-sync');
    sync.innerHTML=`<span>${ctx.state.lastSync?'Last synced '+ctx.state.lastSync:'Not synced yet'}</span>${btn('Sync now','sync-now',ctx.state.connected&&ready?'':'disabled','row-control')}`;
    connection.append(sync);
    const permissions=labelled('Permission & privacy','<p>Calendar access is granted by Google. Portal never asks for or stores your calendar password.</p><details><summary>What is synchronized?</summary><p>Recurring course meetings for the teaching period, with code, name, component, time, room and instructor. Only the Portal-managed schedule events are updated.</p></details><p class="sl2-helper">This preview simulates consent and sync; no Google account is contacted.</p>','sl2-calendar-permissions');
    const source=labelled('Schedule to synchronize',`${chip(ready?'Processed · version '+ctx.state.version:'Not processed',ready?'good':'pending')}<p>Winter 2026/2027 · Group ${ctx.state.group} · Africa/Cairo</p><p>22 Nov 2026–18 Feb 2027 · 12 weekly component events</p>${!ready?'<p class="sl2-response">Only processed schedules can be synchronized or exported. Your review-ready draft stays in Portal.</p>':''}${route('my-schedule','View source schedule')}`,'sl2-calendar-source');
    if(file){$('[data-action="export-calendar"]',file).disabled=!ready;$('.calendar-file p',file)?.remove();file.insertAdjacentHTML('beforeend','<p class="sl2-helper">An .ics import is a snapshot, not a live connection. Re-importing may duplicate events in some calendar apps.</p>');}
    const body=html('div','sl2-calendar-body');body.append(connection,source,permissions);if(file)body.append(file);
    if(ctx.index===1)body.prepend(labelled('Connect, inspect, synchronize',`<ol class="sl2-steps"><li class="${ctx.state.connected?'is-done':'is-current'}">Connect through Google consent</li><li class="${ready?'is-done':'is-current'}">Use a processed schedule</li><li>Synchronize the teaching period</li></ol>`,'sl2-calendar-steps'));
    if([2,4,7].includes(ctx.index)) {
      const events=labelled(ctx.index===7?'Changes for the next sync':'Recurring event preview',ctx.index===7?`<p>${ctx.state.syncedVersion===ctx.state.version?'No schedule changes since your last sync. Existing event identifiers are reused.':'12 recurring meetings will be created or updated. Existing Portal event identifiers are reused.'}</p>`:'','sl2-calendar-events');
      events.insertAdjacentHTML('beforeend',`<div class="sl2-event-list">${meetings(ctx.state.group).map(m=>btn(`<span>${m.code} · ${m.type}</span><small>${DAYS[m.day]} ${time(m.start)} · ${m.room}</small>`,'event-preview',`data-meeting="${m.id}"`,'text')).join('')}</div>`);
      body.append(events);
      if(ctx.index===4)body.append(labelled('Event details','<p>Select a recurring event to inspect its full payload.</p>','sl2-event-inspector'));
    }
    if(ctx.index===8)body.append(labelled('Sync activity',`<ol class="sl2-sync-log">${ctx.state.syncHistory.length?ctx.state.syncHistory.map(entry=>`<li><strong>${esc(entry.title)}</strong><span>${esc(entry.time)}</span><p>${esc(entry.detail)}</p></li>`).join(''):'<li>No synchronization performed in this local session.</li>'}</ol>`,'sl2-sync-history'));
    if(ctx.index===5){const fold=node('<details class="sl2-connection-fold" open><summary>Connected account & controls</summary></details>');connection.replaceWith(fold);fold.append(connection);}
    if(ctx.index===9){[source,permissions,file].filter(Boolean).forEach(section=>{const fold=node(`<details class="sl2-setting-fold"><summary>${$('h2',section)?.textContent||'Calendar file'}</summary></details>`);section.replaceWith(fold);fold.append(section);});}
    ctx.wrap.replaceChildren(ctx.head,body);
  }

  const builders={'my-schedule':buildSchedule,'my-courses':buildCourses,'schedule-swap':buildSwap,preferences:buildPreferences,records:buildRecords,'my-advisor':buildAdvisor,'calendar-sync':buildCalendar};
  function inspectMeeting(ctx,id) {
    const m=meetings(ctx.state.group).find(m=>m.id===id);if(!m)return;
    const content=`<div class="sl2-inspect-course">${art(m.code)}<div><h3>${esc(m.title)}</h3><p>${m.code} · ${m.type}</p></div></div><dl class="sl2-summary"><div><dt>Day and time</dt><dd>${DAYS[m.day]} · ${time(m.start)}–${time(m.end)}</dd></div><div><dt>Location</dt><dd>${m.room}</dd></div><div><dt>Instructor</dt><dd>${m.instructor}</dd></div><div><dt>Group</dt><dd>${ctx.state.group}</dd></div></dl>${ctx.role==='advisingStudent'&&ctx.state.status==='readyForStudentReview'&&openDeadline(ctx)?btn('Request a change to this slot','request-slot',`data-meeting="${m.id}"`,'primary'):''}`;
    const inspector=$('#sl2-inspector',ctx.wrap);
    if(inspector){inspector.innerHTML=`<header class="sl2-section-head"><h2>Meeting details</h2></header>${content}`;inspector.tabIndex=-1;inspector.focus({preventScroll:true});}
    else dialogFor(ctx,`${m.code} · ${m.type}`,content,null,'',ctx.page==='my-courses');
  }
  function handleClick(ctx,event) {
    const target=event.target.closest('[data-sl2-action],[data-action]');if(!target||!ctx.wrap.contains(target)||target.disabled)return;
    const native=target.dataset.action;const command=target.dataset.sl2Action||native;
    const intercepted=['save-preferences','export-calendar','transcript','toggle-calendar','sync-now','request-removal','group-schedule','request-swap','exchange','withdraw'];
    if(native&&!intercepted.includes(native))return;
    event.preventDefault();event.stopPropagation();
    switch(command){
      case 'retry':safeWrite(`scenario:${ctx.role}:${ctx.page}`,'default');rerender();notify('Preview data reloaded.');break;
      case 'meeting':inspectMeeting(ctx,target.dataset.meeting);break;
      case 'request-slot':{const existing=$('dialog[open]',ctx.wrap);if(existing)existing.close();requestSlot(ctx,target.dataset.meeting);break;}
      case 'withdraw-slot':{
        const req=ctx.state.requests.find(r=>r.id===target.dataset.id);if(!req||req.status!=='Pending'){message(ctx,'This request is no longer pending.',true);break;}
        dialogFor(ctx,'Withdraw slot-change request?',`<p>The assigned slot will stay unchanged. Your request will be kept in history as Withdrawn.</p>`,()=>{if(req.status!=='Pending')throw new Error('This request has already been resolved.');req.status='Withdrawn';putState(ctx);rerender();notify('Request withdrawn in this preview.');},'Withdraw request');break;
      }
      case 'schedule-pdf':downloadSchedule(ctx);break;
      case 'schedule-print':if(ctx.state.status==='processed'&&STUDENTS.includes(ctx.role)){
        $('.sl2-print-content',ctx.wrap)?.remove();
        const rows=meetings(ctx.state.group);
        ctx.wrap.append(html('section','sl2-print-content',`<header><span>Portal · design preview</span><h1>Processed weekly schedule</h1><p>Omar Hassan · 70-71577 · Winter 2026/2027<br>Group ${ctx.state.group} · 19 credit hours · Africa/Cairo<br>Teaching period: 22 Nov 2026–18 Feb 2027</p></header>${meetingTable(rows,'Complete lecture, tutorial and lab assignments')}<p>Days off: ${DAYS.filter((_,i)=>!rows.some(m=>m.day===i)).join(', ')}</p><footer>Preview fixture — not an official university record.</footer>`));
        ctx.wrap.classList.add('sl2-print-schedule');window.print();
      }break;
      case 'export-calendar':if(ctx.state.status!=='processed'||!STUDENTS.includes(ctx.role)){message(ctx,'A processed schedule is required before calendar export.',true);break;}saveFile('portal-preview-schedule.ics',calendarFile(ctx),'text/calendar;charset=utf-8');break;
      case 'day':$$('.sl2-day',ctx.wrap).forEach(day=>day.hidden=day.dataset.day!==target.dataset.day);$$('[data-sl2-action="day"]',ctx.wrap).forEach(b=>b.setAttribute('aria-pressed',String(b===target)));break;
      case 'filter-course':$$('.sl2-meeting',ctx.wrap).forEach(el=>el.hidden=target.dataset.course!=='all'&&el.dataset.course!==target.dataset.course);$$('[data-sl2-action="filter-course"]',ctx.wrap).forEach(b=>b.setAttribute('aria-pressed',String(b===target)));break;
      case 'sections':{
        const panel=$('#sl2-course-inspector',ctx.wrap);const article=target.closest('[data-course-index]');const inline=article&&$('.sl2-inline-sections',article);
        if(inline){inline.hidden=!inline.hidden;target.setAttribute('aria-expanded',String(!inline.hidden));}
        else if(panel){panel.innerHTML=sectionDetails(ctx,target.dataset.course);panel.tabIndex=-1;panel.focus({preventScroll:true});$$('[data-course-index]',ctx.wrap).forEach(el=>el.classList.toggle('is-selected',el.dataset.courseIndex===target.dataset.course));}
        else dialogFor(ctx,'Assigned course sections',sectionDetails(ctx,target.dataset.course),null,'',true);break;
      }
      case 'component':$$('.sl2-assigned-sections > section',ctx.wrap).forEach(el=>el.hidden=target.dataset.type!=='All'&&el.dataset.component!==target.dataset.type);$$('[data-sl2-action="component"]',ctx.wrap).forEach(b=>b.setAttribute('aria-pressed',String(b===target)));break;
      case 'request-removal':dialogFor(ctx,'Discuss a course with your advisor','<p>Mandatory-course removal is requested by your assigned advisor and decided by a coordinator. Student accounts cannot remove a registered course here.</p>'+(ctx.role==='advisingStudent'?route('my-advisor','Contact my advisor'):'<p>Contact your academic coordinator for guidance.</p>'),null);break;
      case 'swap-tab':if(typeof tab!=='undefined'){tab=target.dataset.tabTarget;rerender();}break;
      case 'group-schedule':dialogFor(ctx,`Group ${target.dataset.group} · complete schedule`,meetingTable(meetings(Number(target.dataset.group)),`Group ${target.dataset.group} complete schedule`),null,'',[2,9].includes(ctx.index));break;
      case 'select-group':{const check=$(`[data-sl2-destination="${target.dataset.group}"]`,ctx.wrap);if(check&&!check.disabled){check.checked=!check.checked;check.dispatchEvent(new Event('change',{bubbles:true}));}break;}
      case 'submit-swap':{
        if(ctx.role!=='normalStudent'||ctx.state.status!=='processed'){message(ctx,'A processed normal-student schedule is required.',true);break;}
        const selected=$$('[data-sl2-destination]:checked',ctx.wrap).map(el=>Number(el.dataset.sl2Destination));
        if(!selected.length){message(ctx,'Select at least one eligible destination group.',true);break;}
        if(ctx.state.swaps.some(r=>r.status==='Open')||!openDeadline(ctx)){message(ctx,'A request is already open or the deadline has passed.',true);break;}
        dialogFor(ctx,'Review whole-schedule swap',`<dl class="sl2-summary"><div><dt>Current group</dt><dd>Group ${ctx.state.group} · from your processed record</dd></div><div><dt>Desired groups</dt><dd>${selected.map(g=>'Group '+g).join(', ')}</dd></div><div><dt>Subjects</dt><dd>${courses().map(c=>c.code).join(', ')} · unchanged</dd></div></dl><p>All lecture, tutorial and lab assignments move together when an eligible student completes the exchange.</p>`,()=>{
          if(!openDeadline(ctx)||ctx.state.swaps.some(r=>r.status==='Open'))throw new Error('This request is no longer eligible. Refresh the page.');
          ctx.state.swaps.push({id:'swap-'+Date.now(),from:ctx.state.group,desired:selected,status:'Open',created:'14 Nov 2026, 10:00'});putState(ctx);tab='mine';rerender();notify('Whole-schedule swap request submitted in this preview.');
        },'Submit request');break;
      }
      case 'withdraw-swap':{
        const r=ctx.state.swaps.find(r=>r.id===target.dataset.id);if(!r||r.status!=='Open'){message(ctx,'Only your open request can be withdrawn.',true);break;}
        dialogFor(ctx,'Withdraw your swap request?','<p>Your current group and every meeting stay unchanged.</p>',()=>{if(r.status!=='Open')throw new Error('The request is no longer open.');r.status='Withdrawn';putState(ctx);rerender();notify('Swap request withdrawn.');},'Withdraw request');break;
      }
      case 'complete-swap':{
        const group=Number(target.dataset.group);dialogFor(ctx,'Exchange complete schedules?',`<p>You will move from Group ${ctx.state.group} to Group ${group}. Every lecture, tutorial and lab assignment moves together. Your registered subjects and credits stay the same.</p><p>The requester remains anonymous.</p>`,()=>{
          if(!openDeadline(ctx)||ctx.state.completedOffer||ctx.state.status!=='processed'||ctx.scenario==='conflict')throw new Error('This offer is no longer eligible. It may have been completed by another student. Reload the exchange inbox.');
          const old=ctx.state.group;ctx.state.group=group;ctx.state.version++;ctx.state.completedOffer=true;ctx.state.swaps.forEach(r=>{if(r.status==='Open')r.status='Withdrawn';});ctx.state.swaps.push({id:'complete-'+Date.now(),from:old,desired:[group],completed:group,status:'Completed',created:'14 Nov 2026, 10:00'});putState(ctx);tab='mine';rerender();notify('All component assignments exchanged in this preview.');
        },'Exchange schedules');break;
      }
      case 'add-time':$('.sl2-time-rows',ctx.wrap).insertAdjacentHTML('beforeend',timePreferenceRow({},$$('[data-sl2-time-row]',ctx.wrap).length));refreshPreferenceSummary(ctx);break;
      case 'remove-time':target.closest('[data-sl2-time-row]').remove();refreshPreferenceSummary(ctx);break;
      case 'save-preferences':{
        if(ctx.role!=='advisingStudent'||!openDeadline(ctx)){message(ctx,'These preferences are read-only.',true);break;}
        const p=readPreferences(ctx),error=validatePreferences(p);if(error){message(ctx,error,true);break;}
        p.saved='14 Nov 2026, 10:00';ctx.state.prefs=p;
        if(ctx.scenario==='empty'){ctx.scenario='default';safeWrite(`scenario:${ctx.role}:${ctx.page}`,'default');}
        if(typeof preferencesState!=='undefined')preferencesState={days:p.days,groups:p.groups,notes:p.notes};
        const persisted=putState(ctx);$('.sl2-saved',ctx.wrap).textContent='Last saved '+p.saved;message(ctx,persisted?'Preferences saved in this preview. Your assigned schedule has not changed.':'Preferences are updated for this view, but browser storage is unavailable.',!persisted);break;
      }
      case 'move-preference':{const block=target.closest('[data-sl2-block]'),parent=block.parentElement,items=$$('[data-sl2-block]',parent),i=items.indexOf(block),j=i+Number(target.dataset.direction);if(j>=0&&j<items.length){if(j<i)items[j].before(block);else items[j].after(block);$$('.sl2-rank > span',parent).forEach((el,n)=>el.textContent='Priority '+(n+1));target.focus();}break;}
      case 'preference-step':showPreferenceStep(ctx,Number(target.dataset.step));break;
      case 'preference-step-relative':showPreferenceStep(ctx,Math.max(0,Math.min(3,(ctx.step||0)+Number(target.dataset.direction))));break;
      case 'record-year':safeWrite('record-year:'+ctx.role,target.dataset.year);rerender();break;
      case 'show-transcript':tab='transcript';rerender();break;
      case 'transcript':case 'transcript-pdf':downloadTranscript(ctx);break;
      case 'copy-email':{
        const email=ctx.advisorEmail;
        if(navigator.clipboard?.writeText)navigator.clipboard.writeText(email).then(()=>message(ctx,'Advisor email copied.')).catch(()=>dialogFor(ctx,'Copy advisor email',`<label class="sl2-field">Email<input readonly value="${esc(email)}" onfocus="this.select()"></label>`,null));
        else dialogFor(ctx,'Copy advisor email',`<label class="sl2-field">Email<input readonly value="${esc(email)}"></label>`,null);break;
      }
      case 'draft-email':{
        const href=`mailto:${ctx.advisorEmail}?subject=${encodeURIComponent('Advising questions · Omar Hassan · 70-71577')}&body=${encodeURIComponent(ctx.state.advisorNote)}`;
        dialogFor(ctx,'Open your mail app',`<p>Review the draft below. Portal does not send a message or store a conversation.</p><p class="sl2-email-draft">${esc(ctx.state.advisorNote||'No questions added yet.')}</p><a class="btn primary" href="${href}">Continue in mail app</a>`,null);break;
      }
      case 'toggle-calendar':{
        if(ctx.state.connected)dialogFor(ctx,'Disconnect Google Calendar?','<p>Future syncs stop. Existing events are not deleted by this preview. You can reconnect later.</p>',()=>{ctx.state.connected=false;if(typeof connected!=='undefined')connected=false;putState(ctx);rerender();notify('Calendar disconnected in this preview.');},'Disconnect');
        else dialogFor(ctx,'Calendar connection · preview','<p>In the real application, this action redirects to Google’s OAuth consent screen. Portal never collects your calendar password.</p><p>This local preview does not contact Google.</p>',()=>{ctx.state.connected=true;if(typeof connected!=='undefined')connected=true;putState(ctx);rerender();notify('Sample calendar connection restored.');},'Simulate connection');break;
      }
      case 'sync-now':{
        if(!ctx.state.connected||ctx.state.status!=='processed'){message(ctx,'Connect a calendar and use a processed schedule before syncing.',true);break;}
        target.disabled=true;target.textContent='Synchronizing…';message(ctx,'Synchronizing preview events…');
        setTimeout(()=>{
          if(!ctx.wrap.isConnected)return;
          if(ctx.scenario==='conflict'){target.disabled=false;target.textContent='Retry sync';message(ctx,'The sample calendar provider did not respond. Nothing changed. Retry sync to recover.',true);ctx.scenario='default';safeWrite(`scenario:${ctx.role}:${ctx.page}`,'default');return;}
          const unchanged=ctx.state.syncedVersion===ctx.state.version;ctx.state.syncedVersion=ctx.state.version;ctx.state.lastSync='14 Nov 2026, 10:00';ctx.state.syncHistory.unshift({title:'Schedule synchronized',time:ctx.state.lastSync,detail:unchanged?'No schedule changes; 12 recurring events checked.':'12 recurring events created or updated. No duplicate identifiers.'});putState(ctx);rerender();notify(unchanged?'Preview sync checked 12 recurring events; no changes.':'12 recurring component events synchronized in this preview.');
        },350);break;
      }
      case 'event-preview':{
        const m=meetings(ctx.state.group).find(m=>m.id===target.dataset.meeting);if(!m)break;
        const content=`<h3>${m.code} · ${esc(m.title)}</h3><dl class="sl2-summary"><div><dt>Component</dt><dd>${m.type}</dd></div><div><dt>Repeats</dt><dd>Every ${DAYS[m.day]} · ${time(m.start)}–${time(m.end)}<br>Africa/Cairo</dd></div><div><dt>Teaching dates</dt><dd>22 Nov 2026–18 Feb 2027</dd></div><div><dt>Location</dt><dd>${m.room}</dd></div><div><dt>Instructor</dt><dd>${m.instructor}</dd></div><div><dt>Stable event ID</dt><dd>sl2-${m.id}</dd></div></dl>`;
        const inspector=$('.sl2-event-inspector',ctx.wrap);if(inspector){inspector.innerHTML=content;inspector.tabIndex=-1;inspector.focus({preventScroll:true});}else dialogFor(ctx,'Recurring event preview',content,null);break;
      }
    }
  }
  function refreshPreferenceSummary(ctx) {
    const p=readPreferences(ctx),summary=$('#sl2-preference-summary',ctx.wrap);if(summary)summary.innerHTML=preferenceSummary(p);
    $$('.sl2-preference-map [data-sl2-map-day]',ctx.wrap).forEach(el=>{const d=el.dataset.sl2MapDay;el.textContent=p.days.includes(d)?'Day off requested':p.avoided.includes(d)?'Avoid classes':p.preferred.includes(d)?'Preferred teaching day':'Open to classes';el.parentElement.classList.toggle('is-off',p.days.includes(d));});
    const count=$('.sl2-character-count',ctx.wrap);if(count)count.textContent=`${p.notes.length} / 1000 characters`;
  }
  function showPreferenceStep(ctx,step) {
    ctx.step=step;const order=['days','groups','times','notes'];$$('[data-sl2-block]',ctx.wrap).forEach(el=>el.hidden=el.dataset.sl2Block!==order[step]);$$('[data-sl2-action="preference-step"]',ctx.wrap).forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.step)===step)));
    const next=$('[data-sl2-action="preference-step-relative"][data-direction="1"]',ctx.wrap),prev=$('[data-sl2-action="preference-step-relative"][data-direction="-1"]',ctx.wrap);if(next)next.disabled=step===3;if(prev)prev.disabled=step===0;
  }
  function handleChange(ctx,event) {
    const el=event.target;
    if(ctx.page==='preferences'){
      if(el.matches('.dayoff') && $$('.dayoff:checked',ctx.wrap).length>2){el.checked=false;message(ctx,'Choose no more than two desired days off.',true);}
      const dayCount=$('#preferred-day-count',ctx.wrap);if(dayCount)dayCount.textContent=`${$$('.dayoff:checked',ctx.wrap).length} of 2 selected`;
      refreshPreferenceSummary(ctx);
    }
    if(el.matches('[data-sl2-destination]')){
      const chosen=$$('[data-sl2-destination]:checked',ctx.wrap).map(x=>'Group '+x.dataset.sl2Destination);$('#sl2-swap-selection',ctx.wrap).textContent=chosen.length?chosen.join(', '):'No destination groups selected.';
      $$('[data-sl2-destination]',ctx.wrap).forEach(x=>x.closest('.sl2-group').classList.toggle('is-selected',x.checked));
    }
    if(el.matches('[data-sl2-dayoff-filter]')){
      let count=0;$$('.sl2-group',ctx.wrap).forEach(group=>{const day=DAYS.indexOf(el.value),show=!el.value||!meetings(Number(group.dataset.group)).some(m=>m.day===day);group.hidden=!show;if(show)count++;});$('.sl2-search-count',ctx.wrap).textContent=`${count} eligible groups${count?'':' — try another day'}`;
    }
    if(el.matches('[data-sl2-year]')){safeWrite('record-year:'+ctx.role,el.value);rerender();}
    if(el.matches('[data-sl2-compare-year]'))$('#sl2-comparison-transcript',ctx.wrap).innerHTML=transcript(ctx,el.value);
    if(el.matches('[data-sl2-compare]')){
      const selected=$$('[data-sl2-compare]:checked',ctx.wrap);if(selected.length>2){el.checked=false;message(ctx,'Choose up to two courses to compare.',true);return;}
      $('#sl2-course-compare',ctx.wrap).innerHTML=selected.length?selected.map(x=>`<section>${sectionDetails(ctx,Number(x.dataset.sl2Compare))}</section>`).join(''):'<p>Select up to two courses to compare assigned components.</p>';
    }
    if(el.matches('[data-sl2-check]')){ctx.state.checks[Number(el.dataset.sl2Check)]=el.checked;putState(ctx);$('.sl2-check-progress',ctx.wrap).textContent=`${ctx.state.checks.filter(Boolean).length} of 3 prepared`;}
  }
  function handleInput(ctx,event) {
    const el=event.target;
    if(ctx.page==='preferences')refreshPreferenceSummary(ctx);
    if(el.matches('[data-sl2-advisor-note]')){ctx.state.advisorNote=el.value;putState(ctx);}
    if(el.matches('[data-sl2-search]')){
      const kind=el.dataset.sl2Search,items=$$(kind==='courses'?'[data-course-index]':'[data-sl2-record]',ctx.wrap),query=el.value.trim().toLowerCase();let count=0;
      items.forEach(item=>{const show=(item.dataset.search||'').includes(query);item.hidden=!show;if(show)count++;});$('.sl2-search-count',ctx.wrap).textContent=count?`${count} matching ${kind==='courses'?'courses':'records'}`:'No matches. Try a different course code or name.';
    }
  }

  // Only register our keys. The other four contributors keep their namespaces.
  if(!window.portalVariants)window.portalVariants=Object.create(null);
  for(const [page,names] of Object.entries(DESIGNS))window.portalVariants[page]=names.map((name,index)=>({name,apply:args=>apply(page,index,args)}));
  window.PortalStudentLife=Object.freeze({
    version:'2.0.0', designs:DESIGNS, permissions:PERMISSIONS,
    setScenario(page,scenarioName='default',roleName){
      const roleValue=roleName||(typeof role!=='undefined'?role:'advisingStudent');
      if(!Object.hasOwn(DESIGNS,page))throw new Error('Unknown owned page.');
      if(!['default','empty','unavailable','error','deadline','locked','ready','draft','processed','pending','resolved','unassigned','conflict'].includes(scenarioName))throw new Error('Unknown test scenario.');
      safeWrite(`scenario:${roleValue}:${page}`,scenarioName);rerender();
    },
    resetPreview(roleName){const r=roleName||(typeof role!=='undefined'?role:'advisingStudent');lastHostConnection=null;lastHostPreferences=null;if(typeof connected!=='undefined')connected=true;if(typeof preferencesState!=='undefined')preferencesState={days:['Thursday'],groups:Array(4).fill('Group 4'),notes:'I would prefer to keep Thursday free.'};sessionStorage.removeItem(NS+'state:'+r);Object.keys(DESIGNS).forEach(p=>sessionStorage.removeItem(NS+`scenario:${r}:${p}`));rerender();},
    readPreview(roleName){return getState(roleName||(typeof role!=='undefined'?role:'advisingStudent'));},
    validatePreferences, pdfBytes,
    fixtureMeetings:meetings
  });
})();
