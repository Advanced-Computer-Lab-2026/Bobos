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
// Neck, shoe corners and heel stay registered. Bow the long edges in
// different places so the grain boils even when the tool is held still.
const stampCuts=[
  {
    handle:'M-4 -6Q-4 -9.5 -7.7 -11.3C-14 -15.7 -10 -20.8 -3 -21.8Q4.5 -24 7.4 -19.4C9.8 -14.9 3 -12.8 4.7 -7Z',
    shoe:'M-11 -5.3Q-3 -7.3 7.9 -7.5L13 -3.1L12.8 -.5Q2 -.8 -12.1 1L-12.7 -2.3Z',
    grain:'M-7.5 -15Q-7 -18 -3.1 -18.9M1.3 -11.4l1 -2.1M-10 -2.8Q-4 -3.8 1.4 -3.5m3 -.5 4.3 .2',
    rubber:'M-12 .2Q-5 -1 1 -.6L13 -1L12.5 2Q3.5 3 -1 2.7L-11.6 3.7Z'
  },{
    handle:'M-4 -6Q-4.7 -10 -8.2 -11.5C-12.8 -14 -11.7 -20.8 -3 -21.8C2.1 -23.2 6.3 -21.9 7.8 -19.2Q9 -15.8 5.5 -12.4Q3.6 -10.3 4.7 -7Z',
    shoe:'M-11 -5.3Q-.8 -6.1 7.9 -7.5Q10.4 -6 13 -3.1L12.8 -.5Q6.6 -.9 1.4 .1T-12.1 1L-12.7 -2.3Z',
    grain:'M-8.1 -15.5q1.2 -2.8 4.2 -3m4.9 6.7 1.4 -1.9M-10 -2.8q3.8 -1.3 7.5 -.8l4.2 -.5m3.2 -.3 3.8 .5',
    rubber:'M-12 .2Q-8 .6 -3.2 -.4T13 -1L12.5 2Q8.4 3.2 4 2.7T-11.6 3.7Z'
  },{
    handle:'M-4 -6Q-3.5 -9.5 -7.5 -11.9C-14.4 -17 -9.1 -21.2 -3 -21.8C3.3 -24 7.8 -21.5 7.5 -18.4C7.6 -14.1 3.2 -12 4.7 -7Z',
    shoe:'M-11 -5.3Q-6.1 -6.9 -.2 -6.9L7.9 -7.5L13 -3.1L12.8 -.5Q8 -.2 2.6 -.5T-12.1 1L-12.7 -2.3Z',
    grain:'M-7.1 -15.2q.3 -2.1 3.8 -3.7m4.6 7.3 .9 -2.1M-10.1 -2.7l5 -.5q2.1 -.7 5.6 -.5m3.5 -.3 3.8 -.2',
    rubber:'M-12 .2Q-7 -1.1 -2.6 -.5Q4.4 -.1 13 -1L12.5 2Q7.6 2.2 2.1 3Q-5.7 3 -11.6 3.7Z'
  },{
    handle:'M-4 -6Q-4.4 -10.4 -8.5 -12.1Q-12.2 -14.7 -10.4 -17.8Q-9.5 -20.7 -3 -21.8C4.9 -23.2 6.9 -21 7.8 -18.8C9.3 -15 3.7 -13.4 4.7 -7Z',
    shoe:'M-11 -5.3Q-4.5 -6.3 1.6 -6.5L7.9 -7.5L13 -3.1L12.8 -.5Q5 -.9 .1 .3L-12.1 1L-12.7 -2.3Z',
    grain:'M-8 -15.1q1.2 -3 4.8 -3.6m4.1 7.3 1.2 -1.7M-10 -2.9l6.5 -.8 5.3 .1m2.8 -.7 4 .2',
    rubber:'M-12 .2Q-9 -.6 -3.2 -.5T13 -1L12.5 2Q7.6 3.3 1.3 2.6Q-3.4 2.7 -11.6 3.7Z'
  }
];
function advisingPen(i){
  const [x,y,r,ink]=penPoses[i];
  return `<path d="${ink}M14 44q8-.6 15-.2" fill="none"/>
      <g transform="translate(${x-6} ${y}) rotate(${r} 25 35)"><path d="M24 37l3-11 16-17q3-2 6 1t1 5L34 32Z" fill="var(--stamp-stock)"/><path d="m27 26 7 6m-5-9 7 6m4-17 7 6m-2-9 4 4m-3 5-9 9m-5 2-7 7"/><circle cx="30.5" cy="30.5" r="1.2"/></g>`;
}

function publishingStamp(){
  const tool=inkPasses(stampCuts,({handle,shoe,grain,rubber})=>`
    <path d="${handle}" fill="#c38c68"/>
    <path d="${shoe}" fill="#dec19a"/>
    <path d="${grain}" stroke-width="1.2"/>
    <path class="stamp-rubber" d="${rubber}" fill="#865e4f" stroke-width="1.2"/>`);
  const receipt=inkPasses([
    ['M11.7 33.1Q25 30 42 30.9L49.1 40.8L45.1 44.3L19.7 46.4Z','M44.6 44.3l-1.3 -3.1 5.6 -.4M16.4 35.8l7.2 -1.1m-5.4 4 5.3 -.6'],
    ['M11.7 33.1Q17 31.1 23.5 31.4T42 30.9Q44.6 34.2 49.1 40.8L45.1 44.3Q33 44.7 19.7 46.4Z','M44.6 44.3l-1.7 -3.3 6 -.2M16.4 36q3.6 -1.1 7.2 -1.3m-5.4 4.1 5.3 -.8'],
    ['M11.7 33.1Q26.7 30.9 42 30.9L49.1 40.8L45.1 44.3Q30.3 46.5 19.7 46.4Q15 39.9 11.7 33.1Z','M44.6 44.3l-1.2 -3.6 5.5 .1M16.4 35.6q4.8 -.2 7.2 -1m-5.4 4.2q2.7 -1.1 5.3 -.5'],
    ['M11.7 33.1Q18.5 31.8 26.5 31.2Q34.8 30.1 42 30.9Q45.4 36.8 49.1 40.8L45.1 44.3Q32.1 45.2 19.7 46.4Z','M44.6 44.3l-1.6 -3 5.9 -.5M16.4 35.8l3.1 -.7 4.1 -.3m-5.4 4 5.3 -.7']
  ],([edge,notes])=>`<path d="${edge}" fill="#f6e8cd" stroke-width="1.45"/><path d="${notes}" stroke-width="1.05"/>`);
  return `${receipt}
    <path class="published-imprint" d="M27 38.5q-1-2.5 3.2-3.6 4.3-1 6 .8m.4 1.6q-.9 2.4-5.6 3l-2.2-.2m.8-3.5 1.8 1 3.1-2.7" stroke="#9d5949" stroke-width="1.3"/>
    <g class="stamp-descent"><g class="stamp-grip"><g transform="translate(30 32.9) rotate(-9)">${tool}</g></g></g>`;
}
const activitySurrounds={
  postage:'<path d="m8 13 43-9 11 8 4 37-49 7-3-7-4 1Z" fill="var(--stamp-shade)"/><path d="M5 10q11-.9 23-3l24-4 2 5 4-1 4 30-2 4 3 3.5q-20 2.5-48 9l-2-3-5 1Z" fill="var(--stamp-paper)" stroke="var(--stamp-ink)" stroke-width=".8"/><path d="m16 45 16-3m3 0 7-2m8-32 2 10 7-2m-41 32 10-2" fill="none" stroke="var(--stamp-ink)" stroke-width="1" opacity=".67"/>',
  copies:'<path d="m11 9 48-2 2 44-49 3Z" fill="var(--stamp-shade)"/><path d="m7 6 48 1-1 43-49-1Z" fill="var(--stamp-paper)" stroke="var(--stamp-ink)"/><path d="M10 13h40" stroke="var(--stamp-stock)" stroke-width="1.7"/>',
  ledger:{
    letter:'<path d="M5 32q11-6 29-7l20 1-4 4 9 1-3 6-13 4 7 1Q28 52 9 48l6-4-9-2 5-5Z" fill="var(--stamp-stock)" opacity=".72"/><path d="m8 45 9 1m-3 5 18-2m15-6 9-4" class="stamp-frame"/>',
    pen:'<path d="m8 42 7-6 17-9 24-9 4 2-3 4 5 1-4 4-15 5 6 1Q29 45 9 48l3-3Z" fill="var(--stamp-stock)" opacity=".77"/><path d="M10 49q11-1 19-4m4-1 8-4m7-2 6-3" class="stamp-frame"/>',
    press:'<path d="M10 34q13 1 20-3l22-4 5 3-5 3 4 2-2 5-18 4 5 1-30 3 2-4-7-1 7-4Z" fill="var(--stamp-stock)" opacity=".77"/><path d="m11 49 11-.5m22-3 10-3m-4-19 4-2" class="stamp-frame"/>'
  },
  film:'<path d="m3 9 63-1 1 45-63 .7Z" fill="var(--stamp-stock)"/><path d="M7 13h6m-6 0v5m54 30h-6m6 0v-5" class="stamp-frame"/>',
  tabs:'<path d="M11 1l47 1-.8 57-21-9-26 10Z" fill="var(--stamp-stock)"/><path d="M15 4l-.7 50m39-50-.8 50" stroke="var(--stamp-ink)" opacity=".65" stroke-dasharray="3 2 2 2.5" fill="none"/>',
  specimens:'<path d="M4 17 14 7q18-2 36-.5l11-1 1 11 4 5-2 8 2 20q-30-2-61 4Z" fill="var(--stamp-paper)" stroke="var(--stamp-ink)"/><circle cx="11" cy="18" r="2.4" class="stamp-frame"/><path d="M10 17Q.5 14 2 7q2-4 7.5-.5M15 48q17-2 22-1m7-.5 13 .4" class="stamp-frame"/>'
};
function activityStamp(kind,style){
  let art;
  if(kind==='letter') art=preferencesLetter();
  else if(kind==='press') art=publishingStamp();
  else art=penPoses.map((_,i)=>
    `<g class="impression-cel" style="--delay:${(i-10)*115}ms">${advisingPen(i)}</g>`).join('');
  return `<svg class="activity-stamp stamp-${kind}" aria-hidden="true" viewBox="0 0 70 61"><g class="stamp-face">${style==='ledger'?activitySurrounds.ledger[kind]:activitySurrounds[style]}<g class="stamp-cut" transform="translate(${style==='specimens'?8:3} 3)">${art}</g></g></svg>`;
}
