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
const pressPoses=[
  [0,0,-2,false],[-.8,-2,-5,false],[-1,-4,-6,false],[-1,-3,-4,false],
  [0,1,-2,false],[1,5,0,false],[1,5,0,false],[.8,2,1,true],
  [.2,-1,-1,true],[0,-.4,-2,true]
];
function activityDrawing(kind,i){
  if(kind==='letter'){
    const [x,y,tilt,lip]=slipPoses[i];
    return `<path d="M12 27.5 28 17q2-1.5 4-.5l17 9.7-1 16.3-34.7 1Z" fill="#91a995"/>
      <g transform="translate(${x} ${y}) rotate(${tilt} 31 31)">
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
  const [x,y,r,printed]=pressPoses[i];
  return `<path d="m13 34.8 29.9-1.3 6.6 9.2-31.8 1.9Z" fill="#f9ecd1" stroke-width="1.35"/>
    ${printed?'<path d="m25 37.8 12-.7 1.6 2.7-12.2.8Z" fill="none" stroke="#987759" stroke-width="1.05"/>':''}
    <g transform="translate(${x} ${y}) rotate(${r} 31 30)">
      <path d="M26.8 23.4c1.5-3.6 2-6.1-.8-9.1-3.3-3.4-3.4-6.3-.3-8.2 3.7-2.3 9.7-2.3 13.2.6 2.9 2.4 1.7 5.8-1.2 8.3-2.9 2.5-3.1 4.7-.9 8.2Z" fill="#c88d67"/>
      <path d="M26.6 9q1.9-2.3 5.3-2.1" stroke="#f2d7ad" stroke-width="1.35"/>
      <path d="M18.4 24.1q13.3-2.1 26.1-1.3l2 6.9-29.9 1.5Z" fill="#e8b988"/>
      <path d="m16.6 31.2 29.9-1.5-.3 3.4-29.3 1.4Z" fill="#795a52" stroke-width="1.2"/>
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
