// Each event has ten held exposures. The moving tool and the trace it leaves
// have separate drawings so contact, release, and the hold can read at icon size.
const activityEditions={
  postage:'Postage', copies:'Carbon copies', ledger:'Daybook',
  film:'Contact strip', tabs:'Linen tabs', specimens:'Specimen labels'
};

// The folded corner catches the pocket, then the slip settles into it.
const slipPoses=[
  [-1,-1,-5,30],[-1,-2,-6,30],[-2,-4,-8,29.5],[-2,-5,-7,29.3],
  [-1,-4,-4,29.7],[0,-1,-2,30.5],[0,3,0,31.5],[.6,4,1,31],
  [.4,1.6,-1,30.4],[0,0,-3,30]
];
const penPoses=[
  [0,0,-4,'M10 40q4-4 8-2'],[1,-1,-2,'M10 40q4-4 8-2'],
  [3,0,0,'M10 40q4-4 8-2l3 1'],[5,-2,3,'M10 40q4-4 8-2t7-.5'],
  [7,-1,1,'M10 40q4-4 8-2t7-.5l2 .5'],[10,-3,4,'M10 40q4-4 8-2t7-.5 7-1.5'],
  [12,-4,6,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],[12,-6,4,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],
  [7,-6,1,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],[1,-3,-3,'M10 40q4-4 8-2t7-.5 7-1.5l3-2']
];
// The stamp is tipped back at rest. Its heel touches first, the rubber
// compresses, then the toe sticks to the page for a beat on the release.
const pressPoses=[
  [-1,-1,-15,0],[-2,-2,-18,1],[-2,-3,-21,2],[-1,-2,-14,0],
  [0,1,-6,1],[1,3,2,3],[1,3.4,4,3],[.8,2.5,7,2],
  [-.5,-.3,-4,1],[-1,-1,-12,0]
];
const stampCuts=[
  ['M-4-8c-1.4-2-5.6-3.3-6.1-6.6-.6-3.5 2.7-6 7-6.8 4.5-1 9.4-.7 10.7 2.8 1 3.4-1.5 5.3-2.7 7.8-.8 1.4-.8 3.2-.3 4.4L-4-6Z','M-12 .3q6-.9 14-.6l11-.6-.6 3.2q-6.3.9-12 .4l-12.2 1Z'],
  ['M-4.2-7.7c-.8-2-5.2-3.5-5.6-6.6-.7-3.9 2.2-6.4 6.9-7 4.6-1.1 9.1-.6 10.3 2.5 1.3 3.6-1.2 5.8-2.7 8.2-.7 1.4-.7 3.1-.1 4.2L-4-6Z','M-12 .1q7-.7 14-.4l10.8-.7-.4 3.3-11.5.6-12.7.9Z'],
  ['M-3.8-7.9c-1.4-2.7-5.7-3.5-6.1-7.1-.5-3.3 2.8-5.7 6.8-6.5 4.9-1.1 9.7-.6 10.6 3.1.7 3-1.7 5.5-2.8 7.8-.7 1.4-.7 2.8 0 4.2L-4-6Z','M-12 .2q7-.6 13.5-.6l11.6-.5-.4 3.1q-5.2.7-12.2.6l-12.1.9Z'],
  ['M-4-7.8c-1.1-2.4-5.8-3.4-6-6.8-.4-3.7 2.7-6.2 7.1-6.8 4.4-1.1 9.1-.7 10.4 2.8 1.1 3.8-1.4 5.5-2.7 8-.8 1.5-.8 2.8-.3 4.3L-4-6Z','M-12.7.8q6-.9 14.1-.7l12.1-.4-.4 1.9q-5.5.9-12 .6l-13 1Z']
];
function activityDrawing(kind,i){
  if(kind==='letter'){
    const [x,y,tilt,lip]=slipPoses[i];
    return `<path d="M12 27.5 28 17q2-1.5 4-.5l17 9.7-1 16.3-34.7 1Z" fill="#91a995"/>
      <g transform="translate(${x} ${y+4}) rotate(${tilt} 31 31)">
        <path d="M20.5 34.5 20 11l18.2-.8 5.2 5.7.4 18Z" fill="#faf2de"/>
        <path d="m38.2 10.2-.3 6 5.5-.3" fill="#dddbc5" stroke-width="1.05"/>
        <path d="m23.8 18.8 1.2 1.3 2.2-2.7m-3.2 7.4 1.3 1.1 2.1-2.6" stroke="#536d56" stroke-width="1.4"/>
        <path d="m30.2 19.7 6.2-.2m-6.2 6.1 8.7-.3" stroke-width="1.25"/>
      </g>
      <path d="M12 27.4q7.2 2.4 16.5 7.7 1.9 1 3.6-.1L49 26.2l.8 17.3q-16.5 1.2-37.2 1Z" fill="#b6c9ac"/>
      <path d="M13.2 43q6.2-5.1 12.4-8m10.3-.6q7.4 4 12.9 7.6" stroke="#617864" stroke-width="1.2"/>
      <path d="M12.2 27.7q9.5 ${lip-27} 17.4 7.8" stroke="#f2e9cc" stroke-width=".8"/>`;
  }
  if(kind==='pen'){
    const [x,y,r,ink]=penPoses[i];
    return `<path d="${ink}M14 44q8-.6 15-.2" fill="none"/>
      <g transform="translate(${x-6} ${y}) rotate(${r} 25 35)"><path d="M24 37l3-11 16-17q3-2 6 1t1 5L34 32Z" fill="var(--stamp-stock)"/><path d="m27 26 7 6m-5-9 7 6m4-17 7 6m-2-9 4 4m-3 5-9 9m-5 2-7 7"/><circle cx="30.5" cy="30.5" r="1.2"/></g>`;
  }
  const [x,y,tilt,cut]=pressPoses[i];
  const [handle,rubber]=stampCuts[cut];
  return `<path d="M11.7 33.1q10.6-2.1 23.4-2.5l6.9.3 7.1 9.9-4 3.5-25.4 2.1Z" fill="#f6e8cd" stroke-width="1.45"/>
    <path d="m44.6 44.3-1.3-3.1 5.6-.4m-32.5-5.4 7.2-1.1m-5.4 4 5.3-.6" stroke-width=".95"/>
    <path d="M28 39.3q-.9-3.3 4.3-4.4 4.3-1 6.1 1.2m.1 1.6q-.8 3.1-6 3.5l-2.7-.1m1-3.5 2 1 3.5-3.2" stroke="#9d5949" stroke-width="1.25"/>
    <g transform="translate(${29+x} ${32+y}) rotate(${tilt})">
      <path d="${handle}" fill="#c38c68"/>
      <path d="M-7.4-15.3q.4-2.3 4.3-3.4m-.3 8.1q1.6 1.4 1.5 3" stroke-width="1.1"/>
      <path d="m-11-5.3 18.9-2.2 5.3 4.4-.3 2.7q-11.4-.2-25.1 1.3l-.6-3.5Z" fill="#dec19a"/>
      <path d="m-11.6-2.6 16.5-1.2m3.1-.1 4.5.8m-17-.9 2.3-.4" stroke-width="1"/>
      <path d="${rubber}" fill="#865e4f" stroke-width="1.2"/>
    </g>`;
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
  const cels=Array.from({length:10},(_,i)=>
    `<g class="impression-cel" style="--delay:${(i-10)*115}ms">${activityDrawing(kind,i)}</g>`).join('');
  return `<svg class="activity-stamp stamp-${kind}" aria-hidden="true" viewBox="0 0 70 61"><g class="stamp-face">${activitySurrounds[style]}<g class="stamp-cut" transform="translate(${style==='specimens'?8:3} 3)">${cels}</g></g></svg>`;
}
