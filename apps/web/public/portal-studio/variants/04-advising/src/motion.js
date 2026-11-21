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
