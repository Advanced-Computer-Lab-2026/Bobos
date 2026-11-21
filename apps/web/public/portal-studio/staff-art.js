// Marginal drawings for the original working pages. Each moving part is drawn
// separately so the object can do its own job while the lettering stays still.
(() => {
  const stock = '#f3e7ce', cream = '#fff3db', sage = '#aac5ad', blue = '#a4bfd1';
  const clay = '#d9977f', brass = '#e1ba7d', walnut = '#9e7861', graphite = '#585a51';
  const shape = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const ink = (d, color = '#61594d') => shape(d, 'none', `stroke="${color}" stroke-width="1.05"`);
  const part = (motion, drawing) => `<g class="desk-part desk-${motion}">${drawing}</g>`;
  const place = (transform, drawing) => `<g transform="${transform}">${drawing}</g>`;
  // The same timetable and field marks recur on sheets, laminated guides and carbons.
  const rules = ink('M32 27l25-1m-25 5 19-.7m-19 5 24-1');
  const grid = ink('M28 29l34-1m-33 6 33-1m-33 6 33-1m-24-13 1 17m9-17 .8 16m8-17 1 16');
  const paper = shape('M24 19q17-1 36-2l7 6 1 21q-21 2-43 2Z', stock)
    + shape('m60 17 1 7 6-1Z', '#d8cbb2');
  const pencil = shape('m0 0 4-10L27-34q3-2 6 1t1 5L10-4Z', brass)
    + shape('m0 0 4-10 6 6Z', stock) + shape('m0 0 2-4 2 2Z', graphite)
    + shape('m25-32 3-3q4-1 7 4l-3 4Z', clay) + ink('m6-9 21-22m-3 0 7 6');
  const ring = shape('M0 0q-2-10 2-11 4-1 4 7', 'none', 'stroke-width="2.6" stroke="#685d4e"')
    + ink('M.2-1q-1-7 1-8', cream);

  function inbox() {
    return shape('M11 34 28 18l48-2 4 26-14 14-53 1Z', '#8d9c9a')
      + shape('M12 34 29 22l43-2-12 18Z', '#5f706d')
      + part('file', place('rotate(-7 45 40)', paper + rules))
      + shape('M11 35q11 0 18-.5l5 6 13-.8 5-5.5 13-.3 14-14 .8 19.5-15 15-52.5 2Z', blue)
      + ink('m16 51 45-1m5-1 9-9m-27 5 4-.3') + shape('m27 44 20-.5.1 5-19 .7Z', stock);
  }
  function timeRecorder() {
    return shape('M15 49 18 28q1-5 8-6l34-3q7 0 10 6l6 24-5 5-51 3Z', sage)
      + shape('m19 47 52-3 5 5-56 4Z', '#809b88')
      + shape('M27 24q-1-7 6-12 8-5 16-2 9 3 10 12l-2 6-29 2Z', brass)
      + shape('M32 23q-2-11 10-12 11-.5 12 10l-2 5-19 1Z', cream)
      + part('hand', ink('m42 21 6-5m-6 5-4-3', graphite))
      + ink('m42 13 0 2m8 3-2 1m-14 3h2') + shape('m28 33 31-2 1 5-32 3Z', graphite)
      + part('feed', shape('m32 35 23-1 4 12-3-1-2 2-4-1-3 2-3-1-3 1-2-1-3 1Z', stock)
        + ink('m36 38 14-.8m-13 4 9-.6'));
  }
  function clipboard() {
    return place('rotate(-8 45 32)', shape('M19 12q0-3 4-4l44-.4q4 0 4 4l-1 39q0 3-3 4l-47 1Z', walnut)
      + shape('M23 13 67 12l-.8 39-42.6 1Z', cream)
      + shape('M34 9h5q0-5 5-5 5-.1 5 4l7-.2.5 9-23 1Z', blue)
      + ink('M42 9q2-3 4-.3m-17 15 4 .1m6-.5 19-.4m-28 7 4 .1m5-.5 16-.5m-26 7 5 .1m5-.5 21-1')
      + part('slide', shape('m27 41 37-.8.4 5.8-37 1Z', brass) + ink('m31 42 .1 2m5-2 .1 2.5m5-2.5 .1 2m6-2.4 .2 2.5m5-2.5v2')));
  }
  function eraser() {
    return place('rotate(-6 45 35)', paper + rules + ink('m32 41 16-.5'))
      + part('rub', shape('M47 29 59 16l15 5-11 15Z', clay)
        + shape('m47 29 16 7 11-15-.5 7-10 13-16-6Z', '#bd826c')
        + shape('m52 22 6-7 16 6-6 6Z', '#9bb5b5') + ink('m55 22 9 3', cream))
      + ink('m52 41 2 .4m5 1 2 1m-13-.4 1.5-.3');
  }
  function catalogue() {
    return shape('M11 28 27 16l47 1 3 27-17 11-47-.3Z', walnut)
      + shape('m16 29 13-9 38 .6-11 10Z', '#62584e')
      + part('index', shape('M23 33 23 15l12-1 2-4 11-.7 2 4 15-.4 1 16Z', sage)
        + shape('M19 34 20 20l10-.5 2-4 12-.3 2 4 15-.5v11Z', stock)
        + ink('M26 24.5 48 24m-22 4 17-.3'))
      + shape('M11.5 29q21 1 47-.5l1 26-46.5.5Z', '#c89e77')
      + shape('M25 35q10-1 21-.6l1 11q-10 .8-22 .7Z', brass)
      + shape('m28 37 15-.5.3 5.8-15 .5Z', cream)
      + ink('m31 39 9-.3m-22 10 7-.5m24 .2 6-.3m10-.9 7-5m-7-6 6-4');
  }
  function calendar() {
    return shape('m24 14 35-2 13 38-44 3Z', '#7b9b8e')
      + shape('m23 14 40-2-4 37-5 4-38 1Z', '#d6bea1')
      + shape('m22 12 41-2-5 38q-22 1-41 2Z', cream)
      + shape('m22 12 41-2-.9 9-42 2Z', clay)
      + ink('m26 28 25-1m-26 7 25-1m-26 7 25-1m-16-18-2 21m10-21-2 21')
      + part('curl', shape('M42 48q10-3 16-13l-.8 12Z', brass))
      + place('translate(30 15)',ring) + place('translate(53 14)',ring);
  }
  const ticket = shape('M23 21 58 18l3 17-35 4Z', cream)
    + shape('m23 21 7-.5 3 18-7 .5Z', blue) + ink('M34 25l17-1.9m-17 6 12-1.4')
    + ink('m54 22 .2 2 .7 3 .3 2 .6 3');
  function offerings() {
    return shape('M13 13q24-3 56-2l5 37-56 5Z', walnut)
      + shape('m17 16 49-2 4 31-49 4Z', '#d3b390')
      + place('translate(-3 7) rotate(8 46 30)', ticket)
      + part('pin', place('translate(4 -4) rotate(-6 43 23)', ticket)
        + shape('M40 17q-1-4 3-4 4 0 4 3-1 4-5 3Z', clay));
  }
  function copies() {
    return place('translate(3 7) rotate(6 44 36)',paper + grid)
      + shape('m19 18 39-4 10 27-39 5Z','#718b99')
      + part('peel', place('translate(-3 -4) rotate(-7 47 30)', paper + grid + ink('m31 22 19-.6')))
      + ink('m18 48 5 .9m36 3 13-.9');
  }
  const stencil = shape('M18 18 67 16l2 30-49 2Z M25 25l9-.3.1 6-9 .4Z M39 24l20-.6.1 6-20 .5Z M26 37l16-.7.1 5-16 .6Z M48 36l11-.2.1 5-11 .4Z',brass,'fill-rule="evenodd"')
    + ink('m22 20 10-.4m26 23 7-.3');
  function templates() {
    return place('translate(0 4) rotate(4 45 33)',paper+grid)
      + part('slide',place('rotate(-9 45 31)',stencil));
  }
  function drafting(template) {
    return place('translate(-3 4) rotate(-6 40 35)',paper+grid)
      + (template ? shape('m13 46 10-22 21 20Z m8-5 4-9 9 9Z',blue,'fill-rule="evenodd"')
        + ink('m18 44 1.1-2.4m4.2 2.3.5-2m5 1.7.3-1.6') : shape('m16 22 14-2-2 6-13 2Z',sage))
      + part('write',place('translate(46 37) scale(.87)',pencil));
  }
  function groups() {
    return shape('m13 31 15-11 45 1-14 12Z','#657a71')
      + shape('M19 36 18 20l9-.2 3-5 12-1 2 5 16-1 .6 14Z',brass)
      + part('file',shape('M36 33 34 17l9-1 2-6 12-1 3 5 12-.9 1 15Z',blue)
        + ink('m42 21 20-1.5m-20 5 14-.8'))
      + shape('m13 30 21 .5 8-5 32-2 1 17-15 13-45 .7Z',sage)
      + ink('m36 31 1.5 17m23-17 .8 20m4-8 7-6m-54 .8 12-.4m13-2.8 12-.6');
  }
  function bell() {
    return shape('M16 47q3-5 15-6 19-3 33 1 8 2 7 6l-3 4q-24 4-50-.1Z',graphite)
      + shape('M18 45q3-4 16-5 22-2 33 2l2 4q-19 6-49 2Z',walnut)
      + part('ring',shape('M21 42q1-11 7-18 5-6 14-7 14-1 21 21l3 2q-21 7-45 2Z',brass)
        + shape('m40 17-.5-4-4-.5q-2-2 1-3l10-.7q4 1 2 3l-5 .8.6 4Z',sage)
        + ink('M28 36q2-9 8-13m-10 17q11 2 21-.3',cream))
      + part('sound',ink('m16 21-3-3m5 6-6-.4m54-7 3-4m-2 9 6-2',brass));
  }
  function pass() {
    return shape('M34 5 42 3l12 17-5 5Z',blue) + shape('m56 3 7 2-14 21-6-4Z',sage)
      + part('swing',place('rotate(-6 45 22)',shape('M17 22q0-3 4-3l48 .3q3 0 3 4l-.5 26q0 4-4 4l-48-.5q-3 0-3-4Z',stock)
        + shape('m20 24 49 .1v4l-49 .4Z',clay)
        + shape('m39 20 11 .2v3l-11-.1Z',graphite)
        + shape('M23 33h15v14H23Z',sage)
        + shape('M25 46q.5-5 4-6-2-1-2-4 0-4 4-4t3 4q0 2-2 4 4 1 5 6Z',graphite)
        + ink('m43 33 18 .2m-18 5 13 .1m-13 6 20 .3')));
  }
  function subject(code) {
    const special = {
      'ELCT 701': ink('M21 35q5-10 9-2t8-4 7-2 7-3 7 3m-32 13 32-.7') + part('sound',ink('m60 22 3-3m-.3 7 6-1',clay)),
      'MATH 701': ink('m27 23 .6 16 32-1m-28-4 7-4 7 2 11-10') + part('point',shape('M52 24a2 2 0 1 0 4 .1 2 2 0 1 0-4-.1',clay))
    };
    if (special[code]) return place('rotate(-6 43 34)',paper + special[code]);
    const symbol = {'CSEN 703':'algorithms','CSEN 704':'advanced-lab','DMET 701':'graphics'}[code];
    const emblem = symbol
      ? `<image x="29" y="18" width="32" height="24" href="images/symbols/${symbol}.svg"/>`
      : place('translate(29 17)',shape('m7 5 14-.7.6 12-14 1Z',sage)
        + ink('m11 8 6-.3.2 5-6 .3Z M10 2v3m5-3v3m4-3v3M10 18v3m4-3v3m4-3v3M4 8h3m-3 5h3m15-5h3m-3 5h3'));
    return place('rotate(-6 43 34)',paper + ink('m31 41 27-.8'))
      + part('point', emblem);
  }
  const scenes = {
    'pending-work': inbox, 'schedule-activity': timeRecorder, 'student-schedules': clipboard,
    'mandatory-removals': eraser, 'draft-schedule': () => drafting(false),
    courses: catalogue, 'course-detail': () => subject(selectedCourse[0]), terms: calendar,
    offerings, 'copy-offerings': copies, templates, 'template-detail': () => drafting(true),
    'group-assignments': groups, notifications: bell, profile: pass
  };
  function drawing(body, size = '') {
    return `<svg class="staff-desk-art ${size}" viewBox="4 0 78 60" aria-hidden="true" focusable="false" fill="none" stroke="#433d35" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }
  window.addStaffArt = function (page,root) {
    const head = root?.querySelector('.page-head');
    if (!head || !Object.hasOwn(scenes,page) || head.querySelector('.staff-heading')) return;
    const title = head.firstElementChild;
    const wrapper = document.createElement('div');
    wrapper.className = 'staff-heading';
    title.before(wrapper);
    wrapper.innerHTML = drawing(scenes[page]());
    wrapper.append(title);

    // Keep useful dashboard objects attached to the same actions in the interior.
    if (page === 'pending-work') {
      const firstAction = root.querySelector('.staff-queue-art');
      if (firstAction) firstAction.innerHTML = drawing(clipboard(), 'desk-small');
    }
    if (page === 'templates') root.querySelectorAll('.template-name > .icon').forEach(icon => {
      icon.outerHTML = drawing(stencil, 'desk-small');
    });
    if (page === 'terms') root.querySelectorAll('.semester-identity').forEach(term => {
      const month = term.querySelector('h2').textContent.startsWith('Winter') ? 11 : 2;
      term.insertAdjacentHTML('afterbegin',`<span class="desk-season" aria-hidden="true">${seasonDrawing(month)}</span>`);
    });
    if (page === 'notifications') root.querySelectorAll('.notice-symbol').forEach(symbol => {
      const art = {schedule: clipboard, removal: eraser, term: calendar}[symbol.dataset.kind] || bell;
      symbol.innerHTML = drawing(art(), 'desk-small');
    });
    if (page === 'courses') root.querySelectorAll('.academic-emblem').forEach(emblem => {
      if (['ELCT 701','MATH 701'].includes(emblem.dataset.course)) {
        emblem.innerHTML = drawing(subject(emblem.dataset.course), 'desk-small');
      }
    });
  };
})();
