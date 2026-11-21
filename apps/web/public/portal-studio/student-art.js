/* Desk objects for the original student and advising screens. */
(() => {
  'use strict';
  const scenes = {
    bag: `
      <path class="sa-sage" d="M23 48q-5-18 10-22 18-5 27-4l10 13-8 22z"/>
      <path class="sa-paper" d="m36 45-7-29q17-9 35-9l6 34z"/>
      <path d="m35 20 24-7m-22 13 26-7m-24 13 15-4"/>
      <g class="sa-pendulum"><path class="sa-coral" d="m81 44 5-32 4-8 3 9-6 33z"/><path d="m86 13 7 1m-5 2-4 25"/></g>
      <path class="sa-blue" d="m22 39 65-10q6-1 8 5l6 33q1 7-7 8l-57 9q-9 1-11-6l-9-33z"/>
      <path class="sa-blue" d="m19 38 67-10q6-1 7 6l-2 16-61 11q-7 2-8-4z"/>
      <path d="m27 54 62-10m-54 18 2 12m49-19 2 13" stroke-dasharray="2 3"/>
      <path class="sa-gold" d="m34 48 8-1 3 19-8 2zm41-6 8-2 3 20-8 2z"/>
      <path d="m37 58 6-1m36-6 6-1m-24-2 8-1"/>
      <path class="sa-ground" d="m37 88 60-9m-74 10 8-1"/> `,
    books: `
      <path class="sa-sage" d="m13 61 50-17 32 14q3 4 0 8L43 85 13 72q-4-3 0-11Z"/>
      <path class="sa-paper" d="m45 75 49-16q-2 4-1 7L44 82q-3-4 1-7Z"/>
      <path class="sa-coral" d="m17 51 50-17 28 12-1 11-52 18-28-14q-2-6 3-10Z"/>
      <path class="sa-paper" d="m42 64 50-16q-2 4-1 8L41 72q-1-4 1-8Z"/>
      <g class="sa-lift"><path class="sa-blue" d="m12 40 53-19 31 14-1 9-53 18-31-13q-3-5 1-9Z"/>
      <path class="sa-paper" d="m43 53 50-17q-2 4-1 7L42 60q-1-4 1-7Z"/>
      <path d="m18 40 28 12m-14-15 30-10m-28 13 27-9m-21 9 10-3"/>
      <path class="sa-gold" d="m70 44 8-3-1 12-4-1-4 4z"/></g>
      <path d="m16 67 8 4m-3-15 7 3"/><path class="sa-ground" d="m20 79 23 9 49-16"/>`,
    index: `
      <path class="sa-sage" d="m14 46 58-11 27 13-62 16z"/>
      <g class="sa-lift"><path class="sa-blue" d="m19 46-2-24 15-3 3-6 18-3 4 4 23-3 4 28z"/>
      <path class="sa-paper" d="m24 49-3-20 18-3 2-6 19-3 4 4 17-2 4 24z"/>
      <path d="m31 34 39-7m-38 13 25-5"/></g>
      <path class="sa-gold" d="m24 54-1-17 23-5 3-4 17-3 5 4 13-2 3 17z"/>
      <path class="sa-sage" d="m14 44 24 12 62-14-5 26-55 16-23-14z"/>
      <path class="sa-paper" d="m52 60 27-7-1 9-25 7z"/><path d="m58 62 13-4m-31 25-2-27m-18-5 2 14"/>
      <path class="sa-ground" d="m30 85 9 3 56-14"/> `,
    badge: `
      <g class="sa-pendulum">
      <path class="sa-sage" d="M47 8q1-6 6-4l9 12-3 6-7-9-1 11-6 1z"/>
      <path class="sa-paper" d="m21 29 61-12q5-1 6 5l9 41q1 4-4 5L30 81q-5 1-6-4l-8-41q-1-5 5-7z"/>
      <path class="sa-blue" d="m25 40 23-5 5 27-23 5z"/>
      <path class="sa-paper" d="M33 48q-1-5 4-6 5-1 6 4 1 5-4 6-5 1-6-4Zm-1 14q0-10 7-11 8-1 10 8z"/>
      <path d="m58 45 24-5m-22 12 15-3m-43 24 17-3m20-4-1-7m5 7-2-8m6 7-1-8m5 7-1-8m5 7-2-8"/>
      <text class="sa-initials" x="56" y="38" transform="rotate(-11 56 38)"></text><path class="sa-gold" d="m48 24 15-3 1 5-15 3z"/></g>
      <path class="sa-ground" d="m39 84 44-8m4-1 5-1"/> `,
    advising: `
      <path class="sa-paper" d="M10 32q0-11 15-15 11-4 21 0 11 5 9 14-1 9-15 13l-9 10-1-8q-18 1-20-14Z"/>
      <path d="m18 29 25-7m-23 13 17-4"/>
      <g class="sa-pendulum"><path class="sa-sage" d="M58 22q4-11 18-11 18-1 24 11 6 14-9 20l2 8-13-7q-16 0-21-9-3-6-1-12Z"/>
      <path d="m67 23 19-1m-17 7 15-1"/></g>
      <path class="sa-blue" d="m18 63 34-10 27 11-35 12z"/><path class="sa-paper" d="m20 60 32-10 27 11-34 12z"/>
      <path d="m27 60 23-7m1 11 17-4"/>
      <path class="sa-coral" d="m61 74 31-14 7-1-5 6-30 13-7 1z"/><path d="m90 62 2 3"/>
      <path class="sa-ground" d="m26 79 11 4m38-4 21-9"/> `,
    office: `
      <path class="sa-sage" d="M15 73q13-10 25-4l5 4-27 6z"/><path class="sa-paper" d="m26 69 6-27 6 1-7 27z"/>
      <path class="sa-sage" d="m33 42-10-21 5-2 12 22z"/>
      <g class="sa-pendulum"><path class="sa-gold" d="m25 19 11-8q9-2 16 8l8 10q-15 7-29 3l3-11z"/>
      <path class="sa-paper" d="M31 32q14-6 29-3-7 9-29 3Z"/><path d="m44 34 1 3m8-4 2 3"/></g>
      <path class="sa-paper" d="m49 67 28-9 21 8-31 10z"/><path class="sa-blue" d="m43 65 29-9 22 6-28 10z"/>
      <path class="sa-paper" d="m46 62 27-9 21 6-28 10z"/><path d="m53 62 16-5m2 7 13-4"/>
      <path class="sa-ground" d="m9 80 18 4 72-14m-63 15 8-1"/> `,
    week: `
      <path class="sa-sage" d="m12 41 72-20 15 45-71 19z"/>
      <path class="sa-paper" d="m10 35 70-19 16 46-70 19z"/>
      <path class="sa-blue" d="m10 35 70-19 3 10-70 19z"/>
      <path d="M19 35q-5-13 0-14 4-1 6 11m7-1q-6-14-1-14 5-1 8 12m8-3q-6-13-1-14 5-2 8 12m8-3q-5-13-1-14 5-1 8 12"/>
      <path d="m20 51 66-18m-62 29 65-18m-58 29 61-17m-61-13 9 28m5-32 9 29m6-33 9 28m5-31 9 28" opacity=".50"/>
      <g class="sa-lift"><path class="sa-coral" d="m34 48 10-3 2 7-10 3z"/><path class="sa-gold" d="m52 54 10-3 2 6-10 3z"/></g>
      <path class="sa-ground" d="m36 85 51-14"/> `,
    exchange: `
      <g class="sa-exchange-back"><path class="sa-sage" d="m14 40 37-21 17 31-36 22z"/><path class="sa-paper" d="m22 43 12-7 7 11-13 7z"/><path d="m39 34 10-6m-7 11 11-7m-19 25 20-11"/></g>
      <g class="sa-exchange-front"><path class="sa-blue" d="m57 32 38 13-12 36-38-15z"/><path class="sa-paper" d="m62 42 14 5-4 13-14-6z"/><path d="m79 49 8 3m-10 4 8 3m-31 2 21 8"/></g>
      <path class="sa-ground" d="M55 10q23-3 38 18m0-8 1 9-9-2M48 80q-20 2-32-15m-1 8-1-9 9 3"/> `,
    preference: `
      <path class="sa-blue" d="M12 34q23 0 44-8l41 6-5 40-39-5q-21 6-43 5z"/>
      <path class="sa-paper" d="M13 28q25 1 44-7 19 2 37 8l-5 38q-16-6-37-5-24 6-42 4z"/>
      <path d="m56 24-4 38m10-24 18 2m-19 6 11 1"/>
      <g transform="translate(19 38) skewY(-10)">
        <path class="sa-week-rule" d="M0 0h4v4H0zm10 0h4v4h-4zm10 0h4v4h-4zM0 11h4v4H0zm10 0h4v4h-4z"/>
        <g class="sa-day-check"><path d="m0 1 2 2 4-7"/><path d="m10 1 2 2 4-7"/><path d="m20 1 2 2 4-7"/><path d="m0 12 2 2 4-7"/><path d="m10 12 2 2 4-7"/></g>
      </g>
      <g class="sa-pen"><path class="sa-coral" d="m50 53 36-36 5-1 3 5-36 37-11 5z"/><path class="sa-gold" d="m50 53 8 5-11 5z"/><path d="m55 53 34-34m-8 3 7 6"/></g>
      <path class="sa-ground" d="m20 77 24-3m17-2 24 5"/> `,
    transcript: `
      <path class="sa-blue" d="m19 28 42-10 27 4 5 46-48 11-21-8z"/>
      <path class="sa-paper" d="m16 22 41-10 27 6 5 45-45 11-23-8z"/>
      <path d="m56 13 5 47-18 8m-20-40 25-6m-24 14 25-6m-24 13 24-6m-22 17 20-6m16-18 13 2m-12 4 13 2"/>
      <g class="sa-pendulum"><path class="sa-coral" d="m65 54 7 2 3 16-5-4-4 4zm6 0 7-3 8 15-6-1-2 6z"/>
      <path class="sa-gold" d="m60 48 2-4 1-4 5-1 3-2 4 2 5 1 1 4 3 4-2 5-1 4-5 1-4 2-4-2-4-1-1-5z"/>
      <circle cx="72" cy="48" r="6"/></g>
      <path class="sa-ground" d="m34 81 12 3 42-10"/> `,
    receipt: `
      <path class="sa-sage" d="m21 42 44-15 26 13 5 22-44 18-35-17z"/>
      <path class="sa-blue" d="m17 42 43-15 31 12-44 18z"/><path d="m29 41 32-11m-8 29 25-9m-25 15 15-5"/>
      <g class="sa-receipt"><path class="sa-paper" d="M30 40q4-8 1-18-4-9-9-11l24-5q8-2 12 9 6 12 0 17z"/>
      <path d="m32 16 16-5m-13 11 17-5m-17 12 18-6m-12 10 12-4"/></g>
      <path class="sa-paper" d="m26 58 19 7 4 13-4-1-2 2-4-3-2 2-4-4-3 1z"/><path d="m31 64 9 4"/>
      <path class="sa-gold" d="m63 43 8-3 5 2-8 4zm13-4 6-2 4 2-6 3z"/><path class="sa-ground" d="m22 77 28 9 41-16"/> `,
    sync: `
      <path class="sa-blue" d="m10 28 45-10 7 40-46 11z"/>
      <path class="sa-paper" d="m13 32 40-9 6 32-41 9z"/><path d="m19 40 29-7m-24 7 4 15m5-17 3 14m4-15 4 14m-22-4 28-7"/>
      <path class="sa-sage" d="m65 33 23 3q4 0 3 5l-4 34q0 4-4 3l-23-3q-3 0-2-4l4-34q0-4 3-4z"/>
      <path class="sa-paper" d="m65 40 22 2-4 27-21-3z"/><path d="m66 48 15 2m-15 4 9 1m-5 15 5 1"/>
      <g class="sa-signal"><path class="sa-ground" d="M52 10q15-5 26 9m-1-7 2 8-9-2M58 79q-15 5-25-6m2 7-3-8 8 1"/></g>
      <path class="sa-ground" d="m65 83 15 2"/> `
  };

  function artwork(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'student-desk-art');
    svg.setAttribute('data-object', name);
    svg.setAttribute('viewBox', '0 0 110 92');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = scenes[name];
    return svg;
  }

  // A page's object sits with the material it describes. Heading placement is
  // also the fallback for studio layouts with a different set of child panels.
  const placements = {
    overview: ['bag', '.module-queue'],
    directory: ['index'],
    advising: ['advising'],
    'student-detail': ['badge', '.person-title'],
    'my-schedule': ['week'],
    'my-courses': ['books'],
    'schedule-swap': ['exchange', '.panel'],
    preferences: ['preference', '.preference-block:has(#preferred-days)'],
    records: ['transcript', '.academic-standing'],
    'my-advisor': ['office', '.advisor-callout'],
    'calendar-sync': ['sync', '.calendar-file'],
    'financial-records': ['receipt', '.ledger-summary']
  };

  window.addStudentArt = (page, root, role) => {
    const entry = placements[page];
    if (!entry || !root || root.querySelector('.student-desk-art')) return;
    if (page === 'overview' && !['advisingStudent', 'normalStudent'].includes(role)) return;
    const [name, selector] = entry;
    const target = (selector && root.querySelector(selector)) || root.querySelector('.page-head > div');
    if (!target) return;
    target.classList.add('student-object-host');
    const svg = artwork(name);
    if (name === 'badge') {
      svg.querySelector('.sa-initials').textContent = target.querySelector('.avatar, .monogram')?.textContent || '';
    }
    if (name === 'sync') {
      svg.classList.toggle('sa-disconnected', !root.querySelector('.calendar-last-sync') && !root.querySelector('.calendar-connect .connection [data-action="toggle-calendar"]:not(.primary)'));
      root.querySelector('[data-action="sync-now"]')?.addEventListener('click', () => {
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        svg.querySelector('.sa-signal').animate([{transform:'translateX(-3px)', opacity:.35}, {transform:'none', opacity:1}], {duration:490});
      });
    }
    if (target.matches('.ledger-summary, .academic-standing')) {
      // Keep the list's direct children as valid term/description groups.
      const mount = document.createElement('div');
      mount.className = 'student-object-summary';
      target.before(mount);
      mount.append(svg, target);
    } else {
      target.prepend(svg);
    }
  };
})();
