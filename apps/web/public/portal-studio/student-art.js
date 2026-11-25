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
      <g transform="rotate(-4 52 48)">
        <path fill="#a5c6ea" d="M13 74q0-20 14-23 17-5 25 11l3 14q-21 5-42-2Z"/>
        <path fill="#d6a185" d="M22 38q0-13 11-13 13 0 14 12l-2 7 2 3-5 1q-3 7-10 6-11-1-10-16Z"/>
        <path fill="#4d4645" d="M21 41q-4-9 .7-14 1-8 8-8 6-5 13 0 7 .8 7 10l-4 6-3-7q-8 6-15 3l-2 10Z"/>
        <path d="m39 37 1 .1m-7 14 5 1m-14 5 7 7 6-9"/>
        <path fill="#bbd1c6" d="M60 76q1-18 12-23 16-7 25 9l3 14q-18 5-40 0Z"/>
        <path fill="#b88265" d="M70 38q4-10 14-8 11 2 10 14-1 12-10 13-8 0-12-9l-4-2 3-4Z"/>
        <path fill="#383a38" d="M70 39q-4-13 6-15 4-7 11-4 9-2 11 8 5 8-3 17l-4-.8-1-9q-9 4-16-2Z"/>
        <path d="m75 40 1 .1m3 11 5 1m-6 7 7 5 5-6"/>
        <path fill="#f2eee4" d="M47 14q1-8 15-8 16-1 18 8 2 10-12 11l-10-.2-8 6 2-8q-7-2-5-9Z"/>
        <path d="m54 14 16-.4m-15 5 8-.3"/>
      </g>`,
    office: `
      <path class="sa-sage" d="M15 73q13-10 25-4l5 4-27 6z"/><path class="sa-paper" d="m26 69 6-27 6 1-7 27z"/>
      <path class="sa-sage" d="m33 42-10-21 5-2 12 22z"/>
      <g class="sa-pendulum"><path class="sa-gold" d="m25 19 11-8q9-2 16 8l8 10q-15 7-29 3l3-11z"/>
      <path class="sa-paper" d="M31 32q14-6 29-3-7 9-29 3Z"/><path d="m44 34 1 3m8-4 2 3"/></g>
      <path class="sa-paper" d="m49 67 28-9 21 8-31 10z"/><path class="sa-blue" d="m43 65 29-9 22 6-28 10z"/>
      <path class="sa-paper" d="m46 62 27-9 21 6-28 10z"/><path d="m53 62 16-5m2 7 13-4"/>
      <path class="sa-ground" d="m9 80 18 4 72-14m-63 15 8-1"/> `,
    week: `
      <g transform="rotate(-8 55 46)">
        <rect class="sa-sage" x="18" y="25" width="78" height="52" rx="5"/>
        <rect class="sa-paper" x="14" y="20" width="78" height="52" rx="5"/>
        <path class="sa-blue" d="M14 33v-8a5 5 0 0 1 5-5h68a5 5 0 0 1 5 5v8Z"/>
        <path d="M32 16v9m21-9v9m21-9v9" stroke-width="3"/>
        <path d="M30 33v39m15-39v39m16-39v39m15-39v39M14 53h78" opacity=".35"/>
        <rect class="sa-coral" x="18" y="39" width="8" height="9" rx="2"/>
        <rect class="sa-blue" x="49" y="39" width="8" height="9" rx="2"/>
        <rect class="sa-gold" x="65" y="58" width="8" height="9" rx="2"/>
        <rect class="sa-sage" x="34" y="58" width="8" height="9" rx="2"/>
      </g>`,
    exchange: `
      <g class="sa-exchange-back"><path class="sa-sage" d="m14 40 37-21 17 31-36 22z"/><path class="sa-paper" d="m22 43 12-7 7 11-13 7z"/><path d="m39 34 10-6m-7 11 11-7m-19 25 20-11"/></g>
      <g class="sa-exchange-front"><path class="sa-blue" d="m57 32 38 13-12 36-38-15z"/><path class="sa-paper" d="m62 42 14 5-4 13-14-6z"/><path d="m79 49 8 3m-10 4 8 3m-31 2 21 8"/></g>
      <path class="sa-ground" d="M55 10q23-3 38 18m0-8 1 9-9-2M48 80q-20 2-32-15m-1 8-1-9 9 3"/> `,
    preference: `
      <g transform="rotate(-6 54 45)">
        <path fill="#b5c6ed" d="m19 25 65-3 3 52-67 2Z"/>
        <path fill="#f2eee4" d="M14 19q0-3 3-3l61-2q3 0 3 4l1 49q0 3-3 3l-61 2q-3 0-3-3Z"/>
        <path d="m24 26 27-.8"/>
        <path fill="#c1d4c6" d="m24 35 10-.6.4 10-10 .4Z"/><path d="m26 39 3 2 7-9m6 7 19-.8"/>
        <path d="m25 51 10-.4.2 10-10 .4Zm18 4 26-1"/>
        <g class="sa-pen"><path fill="#6da7ec" d="m57 54 4-10 26-28q3-3 7 1 4 3 1 6L68 50Z"/>
        <path fill="#ece4cf" d="m57 54 4-10 7 6Z"/><path fill="#414645" d="m57 54 1.7-4 2.4 2Z"/>
        <path d="m65 44 23-24"/></g>
      </g>`,
    transcript: `
      <g transform="rotate(-9 50 46)">
        <rect class="sa-blue" x="25" y="17" width="51" height="65" rx="3"/>
        <path class="sa-paper" d="M22 10h33l15 15v47a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z"/>
        <path fill="#dac6a3" d="M55 10v12a3 3 0 0 0 3 3h12Z"/>
        <path d="M29 26h15" stroke-width="2.6"/>
        <path d="M29 38h31m-31 9h31m-31 9h18" opacity=".72"/>
      </g>
      <g class="sa-pendulum">
        <path class="sa-coral" d="m65 54 7 2 3 16-5-4-4 4zm6 0 7-3 8 15-6-1-2 6z"/>
        <path class="sa-gold" d="m60 48 2-4 1-4 5-1 3-2 4 2 5 1 1 4 3 4-2 5-1 4-5 1-4 2-4-2-4-1-1-5z"/>
        <circle cx="72" cy="48" r="6"/>
      </g>`,
    receipt: `
      <g transform="rotate(-8 50 50)">
        <path class="sa-paper" d="m14 16 42-1 1 54-5-3-5 3-5-3-5 3-5-3-6 3-6-3-5 3Z"/>
        <path d="m21 24 24-.7m-24 8 14-.3m5 0 8-.4m-27 8 12-.3m6 0 8-.4m-26 8 27-.7"/>
        <path class="sa-sage" d="m30 49 53-3 10 24-54 5Z"/>
        <path class="sa-sage" d="m29 45 54-3 9 23-54 5Z"/>
        <path d="m36 49 42-2 6 15-42 4Z"/><ellipse class="sa-paper" cx="60" cy="56" rx="7" ry="8"/>
        <path class="sa-gold" d="M17 64q9-5 18-1l1 9q-7 7-19 1Z"/>
        <ellipse class="sa-gold" cx="26" cy="64" rx="10" ry="4"/><path d="m18 69q8 4 16-1"/>
      </g>`,
    timeTicket: `
      <g transform="translate(8 7) scale(1.2)">
        <path fill="#eec59c" d="m9 17 51-4 1 10a5 5 0 0 0 1 10l1 11-51 5-1-11a5 5 0 0 0-1-10z"/>
        <path stroke-dasharray="1 4" d="m25 17 2 30"/>
        <path d="m15 23 5-.4m-4 19 5-.4"/>
        <circle fill="#f6ecda" cx="44" cy="30" r="12"/>
        <path d="M44 23v7l5 3"/>
        <circle fill="#b9d0bd" cx="61" cy="43" r="9"/>
        <path d="M61 39v8m-4-4h8"/>
      </g>`,
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
    'extra-hours': ['timeTicket'],
    'student-detail': ['badge', '.person-title'],
    'my-schedule': ['week'],
    'my-courses': ['books'],
    'schedule-swap': ['exchange', '.panel'],
    preferences: ['preference'],
    records: ['transcript', '.academic-standing'],
    'my-advisor': ['office', '.advisor-callout'],
    'calendar-sync': ['sync', '.calendar-file'],
    'financial-records': ['receipt']
  };

  window.addStudentArt = (page, root, role) => {
    const entry = placements[page];
    if (!entry || !root || root.querySelector('.student-desk-art,.campus-id')) return;
    if (page === 'overview' && (root.querySelector('.student-dashboard') || !['advisingStudent', 'normalStudent'].includes(role))) return;
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
