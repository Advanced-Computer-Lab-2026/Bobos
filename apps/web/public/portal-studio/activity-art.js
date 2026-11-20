// Each event has ten held exposures. The moving tool and the trace it leaves
// have separate drawings so contact, release, and the hold can read at icon size.
const activityEditions={
  postage:'Postage', copies:'Carbon copies', ledger:'Daybook',
  film:'Contact strip', tabs:'Linen tabs', specimens:'Specimen labels'
};

const envelopePoses=[
  ['M15 27l17-12 19 10',0,'M27 19l11 .6m-11 3.6 7-.3'],
  ['M15 27q7-5 17-12l19 10',1,'M27 19.3l11 .2m-11 3.5 7 .1'],
  ['M15 27q6-8 17-14l19 12',-1,'M27 19l11 .6m-11 3.6 7-.3'],
  ['M15 27q5-9 17-15l19 13',-4,'M27 19.2l11 .1m-11 4 7-.4'],
  ['M15 27q7-10 17-15.7L51 25',-6,'M27 19l11 .4m-11 3.2 7 .2'],
  ['M15 27q7-10 17-15l19 13',-6,'M27 19.3l11 .2m-11 3.6 7-.3'],
  ['M15 27q7-9 17-15l19 13',-5,'M27 19l11 .5m-11 3.6 7-.1'],
  ['M15 27q6-9 17-14l19 12',-3,'M27 19.4l11 .1m-11 3.5 7 .1'],
  ['M15 27q8-7 17-13l19 11',-1,'M27 19.2l11 .3m-11 3.7 7-.3'],
  ['M15 27l17-12 19 10',0,'M27 19l11 .6m-11 3.6 7-.3']
];
const penPoses=[
  [0,0,-4,'M10 40q4-4 8-2'],[1,-1,-2,'M10 40q4-4 8-2'],
  [3,0,0,'M10 40q4-4 8-2l3 1'],[5,-2,3,'M10 40q4-4 8-2t7-.5'],
  [7,-1,1,'M10 40q4-4 8-2t7-.5l2 .5'],[10,-3,4,'M10 40q4-4 8-2t7-.5 7-1.5'],
  [12,-4,6,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],[12,-6,4,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],
  [7,-6,1,'M10 40q4-4 8-2t7-.5 7-1.5l3-2'],[1,-3,-3,'M10 40q4-4 8-2t7-.5 7-1.5l3-2']
];
const pressPoses=[
  [0,0,''],[-1,-2,''],[-3,-4,''],[-2,-2,''],[1,2,''],[4,1,'M10 38l-4-1m40-4 5-2'],
  [4,0,'M8 37l-3-2m44-3 5-2'],[1,-1,'M9 35l-2-2m44-3 3-1'],
  [-1,-1,''],[0,0,'']
];
function activityDrawing(kind,i){
  if(kind==='letter'){
    const [flap,y,ink]=envelopePoses[i];
    return `<path d="${flap}l-17 15Z" fill="var(--stamp-shade)"/>
      <g transform="translate(0 ${y})"><path d="m21 31 1.6-18.5 20.8 1.3.6 17.2-11 5Z" fill="var(--stamp-paper)"/><path d="${ink}" stroke-width="1.35"/></g>
      <path d="M15 27l17 9.5 19-11.2.8 17.5-36 1.6Z" fill="var(--stamp-stock)"/><path d="m17 41 11-9m21 8-11-9M10 24l3-1m-6-3 7-1"/> `;
  }
  if(kind==='pen'){
    const [x,y,r,ink]=penPoses[i];
    return `<path d="${ink}M14 44q8-.6 15-.2" fill="none"/>
      <g transform="translate(${x-6} ${y}) rotate(${r} 25 35)"><path d="M24 37l3-11 16-17q3-2 6 1t1 5L34 32Z" fill="var(--stamp-stock)"/><path d="m27 26 7 6m-5-9 7 6m4-17 7 6m-2-9 4 4m-3 5-9 9m-5 2-7 7"/><circle cx="30.5" cy="30.5" r="1.2"/></g>`;
  }
  const [y,r,impact]=pressPoses[i];
  return `<path d="m12 37 30-2 9 6-31 3Z" fill="var(--stamp-paper)"/><path d="m18 39 24-1m-23 4 20-1"/>
    <g transform="translate(0 ${y}) rotate(${r} 32 31)"><path d="M24 24q3-1 4-5c1-3-5-5-4-10s15-6 16-1-5 8-4 11q1 3 5 5Z" fill="var(--stamp-stock)"/><path d="M18 24q13-3 27-1l2 6-31 2Z" fill="var(--stamp-stock)"/><path d="m16 31 31-2-.1 3-31 2Zm10-19q-1-3 3-5m3 9-2 5m-9 6 19-1"/></g><path d="${impact}"/>`;
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
