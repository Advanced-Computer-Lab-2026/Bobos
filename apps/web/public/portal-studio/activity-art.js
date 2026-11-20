const activityEditions={
  postage:'Postage', copies:'Carbon copies', ledger:'Daybook',
  film:'Contact strip', tabs:'Linen tabs', specimens:'Specimen labels'
};

// Corners, fold and checkmarks share registration points across drawings.
const slipInk=[
  ['M20.5 34.5 20 11q9.5-.5 18.2-.8l5.2 5.7.4 18Z','m23.8 18.8 1.2 1.3 2.2-2.7m-3.2 7.4 1.3 1.1 2.1-2.6','M30.2 19.7q3.3 0 6.2-.2m-6.2 6.1 8.7-.3'],
  ['M20.5 34.5q.1-6.5-.3-11.3T20 11q5.3 0 9.6-.6l8.6-.2 5.2 5.7q-.3 5.2.1 9.8l.3 8.2Z','m23.8 18.8 1.3 1.5 2.1-2.9m-3.2 7.4 1.5 1 1.9-2.5','M30.2 19.7q2.5-.7 6.2-.2m-6.2 6.1q4.2-.7 8.7-.3'],
  ['M20.5 34.5q-.8-11-.5-23.5l7.1-.1q5.1-.8 11.1-.7l5.2 5.7q.6 7.2.4 18Z','m23.8 18.8 1.1 1.5 2.3-2.9m-3.2 7.4 1.2.9 2.2-2.4','M30.2 19.7q3 .4 6.2-.2m-6.2 6.1 3.9.2 4.8-.5'],
  ['M20.5 34.5q.4-7.3-.4-13.2L20 11q7.7-.9 18.2-.8l5.2 5.7q.1 4.8-.1 8.4l.5 9.6Z','m23.8 18.8 1.5 1.2 1.9-2.6m-3.2 7.4 1.3 1.3 2.1-2.8','M30.2 19.7l2.9-.4 3.3.2m-6.2 6.1q3.7.3 8.7-.3']
];
const pocketInk=[
  'M12 27.4q7.2 2.4 16.5 7.7 1.9 1 3.6-.1L49 26.2l.8 17.3q-16.5 1.2-37.2 1Z',
  'M12 27.4q7.4 2.1 16.5 7.7 1.9 1 3.6-.1Q40 30.2 49 26.2l.1 7.8.7 9.5q-8.1 1-15.6.7-9.8.7-21.6.3l-.1-8.8Z',
  'M12 27.4q6.5 2.8 16.5 7.7 1.9 1 3.6-.1Q40.7 30 49 26.2q.9 9.1.8 17.3-9.5.3-18.1.9l-19.1.1.1-8Z',
  'M12 27.4q7.7 2.9 16.5 7.7 1.9 1 3.6-.1Q41.3 30.8 49 26.2l.6 6.9.2 10.4q-7 .8-12.8.5l-12.8.6-11.6-.1q-.7-9.7-.6-17.1Z'
];

// Only the stroke changes between ink passes. The action plays on a parent
// so a stamp can stay raised while the ink keeps moving.
function inkPasses(drawings,paint){
  const passes=drawings.map((drawing,i)=>
    `<g class="activity-ink-pass" style="--ink-delay:${(i-drawings.length)*135}ms">${paint(drawing)}</g>`).join('');
  return `<g>${passes}</g>`;
}

function preferencesLetter(){
  const slip=inkPasses(slipInk,([edge,checks,writing])=>
    `<path d="${edge}" fill="#faf2de"/><path d="${checks}" stroke="#536d56" stroke-width="1.45"/><path d="${writing}" stroke-width="1.3"/>`);
  return `<path d="M12 27.5 28 17q2-1.5 4-.5l17 9.7-1 16.3-34.7 1Z" fill="#91a995"/>
    <g class="preferences-insert"><g transform="translate(-1 3) rotate(-5 31 31)">
      ${slip}<path d="m38.2 10.2-.3 6 5.5-.3" fill="#dddbc5" stroke-width="1.05"/>
    </g></g>
    ${inkPasses(pocketInk,edge=>`<path d="${edge}" fill="#b6c9ac"/>`)}
    <path d="M13.2 43q6.2-5.1 12.4-8m10.3-.6q7.4 4 12.9 7.6" stroke="#617864" stroke-width="1.2"/>`;
}
const penPoses=[
  [0,0,-4,'M10 40q4-4 8-2'],[1,-1,-2,'M10 40q4-4 8-2'],
  [3,0,0,'M10 40q4-4 8-2l3 1'],[5,-2,3,'M10 40q4-4 8-2t7-.5'],
  [7,-1,1,'M10 40q4-4 8-2t7-.5l2 .5'],[10,-3,4,'M10 40q4-4 8-2t7-.5 7-1.5'],
  [12,-4,6,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],[12,-6,4,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],
  [7,-6,1,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],[1,-3,-3,'M10 40q4-4 8-2t7-.5 7-1.5l3-2']
];
const stampCuts=[
  ['M-4-8c-1.4-2-5.6-3.3-6.1-6.6-.6-3.5 2.7-6 7-6.8 4.5-1 9.4-.7 10.7 2.8 1 3.4-1.5 5.3-2.7 7.8-.8 1.4-.8 3.2-.3 4.4L-4-6Z','M-12 .3q6-.9 14-.6l11-.6-.6 3.2q-6.3.9-12 .4l-12.2 1Z'],
  ['M-4.2-7.7c-.8-2-5.2-3.5-5.6-6.6-.7-3.9 2.2-6.4 6.9-7 4.6-1.1 9.1-.6 10.3 2.5 1.3 3.6-1.2 5.8-2.7 8.2-.7 1.4-.7 3.1-.1 4.2L-4-6Z','M-12 .1q7-.7 14-.4l10.8-.7-.4 3.3-11.5.6-12.7.9Z'],
  ['M-3.8-7.9c-1.4-2.7-5.7-3.5-6.1-7.1-.5-3.3 2.8-5.7 6.8-6.5 4.9-1.1 9.7-.6 10.6 3.1.7 3-1.7 5.5-2.8 7.8-.7 1.4-.7 2.8 0 4.2L-4-6Z','M-12 .2q7-.6 13.5-.6l11.6-.5-.4 3.1q-5.2.7-12.2.6l-12.1.9Z'],
  ['M-4-7.8c-1.1-2.4-5.8-3.4-6-6.8-.4-3.7 2.7-6.2 7.1-6.8 4.4-1.1 9.1-.7 10.4 2.8 1.1 3.8-1.4 5.5-2.7 8-.8 1.5-.8 2.8-.3 4.3L-4-6Z','M-12 .3q6.8-1.1 14.1-.7l10.9-.5-.3 3.1q-5.6.9-12.3.6l-12.1.9Z']
];
function advisingPen(i){
  const [x,y,r,ink]=penPoses[i];
  return `<path d="${ink}M14 44q8-.6 15-.2" fill="none"/>
      <g transform="translate(${x-6} ${y}) rotate(${r} 25 35)"><path d="M24 37l3-11 16-17q3-2 6 1t1 5L34 32Z" fill="var(--stamp-stock)"/><path d="m27 26 7 6m-5-9 7 6m4-17 7 6m-2-9 4 4m-3 5-9 9m-5 2-7 7"/><circle cx="30.5" cy="30.5" r="1.2"/></g>`;
}

function publishingStamp(){
  const tool=inkPasses(stampCuts,([handle,rubber])=>`
    <path d="${handle}" fill="#c38c68"/>
    <path d="M-7.4-15.3q.4-2.3 4.3-3.4m-.3 8.1q1.6 1.4 1.5 3" stroke-width="1.1"/>
    <path d="m-11-5.3 18.9-2.2 5.3 4.4-.3 2.7q-11.4-.2-25.1 1.3l-.6-3.5Z" fill="#dec19a"/>
    <path d="m-11.6-2.6 16.5-1.2m3.1-.1 4.5.8m-17-.9 2.3-.4" stroke-width="1"/>
    <path class="stamp-rubber" d="${rubber}" fill="#865e4f" stroke-width="1.2"/>`);
  return `<path d="M11.7 33.1q10.6-2.1 23.4-2.5l6.9.3 7.1 9.9-4 3.5-25.4 2.1Z" fill="#f6e8cd" stroke-width="1.45"/>
    <path d="m44.6 44.3-1.3-3.1 5.6-.4m-32.5-5.4 7.2-1.1m-5.4 4 5.3-.6" stroke-width=".95"/>
    <path class="published-imprint" d="M27 38.5q-1-2.5 3.2-3.6 4.3-1 6 .8m.4 1.6q-.9 2.4-5.6 3l-2.2-.2m.8-3.5 1.8 1 3.1-2.7" stroke="#9d5949" stroke-width="1.3"/>
    <g class="stamp-descent"><g transform="translate(30 31) rotate(-9)">${tool}</g></g>`;
}
const activitySurrounds={
  postage:'<path class="stamp-edge" d="M5 4H65V56H5Z"/><path class="stamp-perfs" d="M5 4H65V56H5Z"/><path class="stamp-frame" d="m10 9 50-.5.5 42-51 .5z"/>',
  copies:'<path d="m11 9 48-2 2 44-49 3Z" fill="var(--stamp-shade)"/><path d="m7 6 48 1-1 43-49-1Z" fill="var(--stamp-paper)" stroke="var(--stamp-ink)"/><path d="M10 13h40" stroke="var(--stamp-stock)" stroke-width="1.7"/>',
  ledger:'<path d="M8 30C8 15 19 6 33 6q20-.6 27 16 5 16-6 26-11 10-28 5C15 49 7 41 8 30Z" fill="var(--stamp-paper)"/>',
  film:'<path d="m3 9 63-1 1 45-63 .7Z" fill="var(--stamp-stock)"/><path d="M7 13h6m-6 0v5m54 30h-6m6 0v-5" class="stamp-frame"/>',
  tabs:'<path d="M11 1l47 1-.8 57-21-9-26 10Z" fill="var(--stamp-stock)"/><path d="M15 4l-.7 50m39-50-.8 50" stroke="var(--stamp-ink)" opacity=".65" stroke-dasharray="3 2 2 2.5" fill="none"/>',
  specimens:'<path d="M3 16 14 6l51-.5.3 45L4 52Z" fill="var(--stamp-paper)" stroke="var(--stamp-ink)"/><circle cx="11" cy="18" r="2.4" class="stamp-frame"/><path d="M10 17q-8-4-7-9.5 1.5-5 5-.4" class="stamp-frame"/>'
};
function activityStamp(kind,style){
  let art;
  if(kind==='letter') art=preferencesLetter();
  else if(kind==='press') art=publishingStamp();
  else art=penPoses.map((_,i)=>
    `<g class="impression-cel" style="--delay:${(i-10)*115}ms">${advisingPen(i)}</g>`).join('');
  return `<svg class="activity-stamp stamp-${kind}" aria-hidden="true" viewBox="0 0 70 61"><g class="stamp-face">${activitySurrounds[style]}<g class="stamp-cut" transform="translate(${style==='specimens'?8:3} 3)">${art}</g></g></svg>`;
}
