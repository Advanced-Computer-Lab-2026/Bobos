// The spring flower grows through three poses before settling into two alternating ink drawings.
const springFlower = [
    'M15 46q10-3 22-1m7-1 7 .5 M34 44q-1-3 1-6m-1 4q-4-4-7-3 2 4 7 3',
    'M15 46q12-3 23-1m6-1 7 1 M34 44q-2-9 2-15m-2 9q-8-1-10-7 8 0 10 7m1-4q3-5 9-5-2 5-9 5',
    'M16 46q10-3 23-1m5-1 8 .5 M34 44q-4-12 4-23m-4 16q-8 0-12-8 9 1 12 8m1-6q4-8 13-8-3 7-13 8 M38 22q-6-3-4-8 3 0 5 3 0-6 5-8 3 7-6 13Z',
    'M15 46q12-3 24-1m6-1 7 1 M34 44q-4-14 5-25m-5 18q-10-1-13-9 10 2 13 9m1-6q6-8 14-8-4 8-14 8 M39 17c-9 1-13-4-10-7 3-2 7 0 10 4-3-7-1-12 2-12 4 0 4 6 2 11 5-7 10-8 12-5 2 4-5 8-10 9 7 1 9 5 6 7-4 2-9-2-10-5-4 6-9 6-10 3-1-2 3-5 8-5Z M40 17l2-1',
    'M15 46q11-3 24-1m6-1 7 .6 M34 44q-4-13 5-25m-5 18q-10-2-13-8 10 1 13 8m1-6q6-9 14-8-4 7-14 8 M39 17c-9 1-14-4-10-7 3-2 7 1 10 4-4-7-1-12 2-12 4 0 4 6 2 11 5-7 11-8 12-4 1 4-5 7-10 8 7 1 9 5 6 7-3 2-9-2-10-5-4 6-9 6-10 3-1-3 3-5 8-5Z M39.5 17l2.5-1'
  ];
const seasonalPaper = [
  ['#b7cad7','#91abbc'],['#cdc3dd','#a99bbd'],['#c3d3b0','#9aaf82'],
  ['#e7c0c7','#c49fa9'],['#c6cfac','#9daf8a'],['#a9cfc8','#86aaa5'],
  ['#eacb95','#c0a175'],['#dfb59c','#bb937f'],['#c7c09f','#a79b7a'],
  ['#dcb09c','#b68a75'],['#d1bfdc','#ab98b9'],['#bfc6dd','#9ba6c2']
];
function seasonDrawing(month){
  if(month<=1) return winterGust(month===1);
  if(month===11) return inkScene('grove',month);
  if(month>=5 && month<=7) return summerSkiff();
  if(month===8) return septemberSwallows();
  if(month===9) return octoberAcorns();
  if(month===10) return novemberRobin();
  const lawn=month===3 ? aprilMeadow : '';
  return `<svg class="season-drawing season-flower" aria-hidden="true" viewBox="0 0 62 50" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">${lawn}${springFlower.map((d,i)=>`<path class="season-cel cel-${i}" d="${d}"/>`).join('')}</svg>`;
}
function tintCalendar(pad,month){
  pad.dataset.seasonMonth=String(month);
  const [paper,back]=seasonalPaper[month];
  pad.style.setProperty('--season-sheet',paper);
  pad.style.setProperty('--season-back',back);
}

function summerSkiff(){
  // The mast stays put on deck. The leech of the sail lags through each gust.
  const sails=[
    'M30 6Q35 14 42 25L30 27Z','M30 6Q38 12 43 24L30 27Z',
    'M30 6Q42 13 45 24Q38 26 30 27Z','M30 6Q44 12 46 23Q39 27 30 27Z',
    'M30 6Q42 15 44 24Q37 26 30 27Z','M30 6Q37 16 42 25L30 27Z'
  ];
  return `<svg class="season-drawing skiff" aria-hidden="true" viewBox="0 0 68 50" fill="none" stroke="#535047" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g class="skiff-hull">
    <path d="m29 3 1 28m-2-19-10 15 10-1z" fill="#eadcc8"/>
    ${sails.map((d,i)=>`<path class="sail-pose sail-${i}" d="${d}" fill="#e9b98f"/>`).join('')}
    <path d="M13 31q14 1 35-4-3 6-9 9l-19 1Z" fill="#99b6b4"/><path d="M19 33q10 0 21-2M29 4l-6 2 6 1"/>
    </g><path class="skiff-wake" d="M5 38q5-2 11 0t13 0m6-1q7-3 15-2m-32 7 12-.5m11-1 9-1"/></svg>`;
}

// Six uneven branches, drawn separately. The gust uncurls before it
// catches the crystal, then breaks into two short strokes as it passes.
function winterGust(flurry){
  const arms=[
    'M0 0Q-.7-7 .4-17m-.7 6-4-4m4 8 4.3-4.5',
    'M.5-.4 12-8m-5 3 .7-5m-.9 5 5 .4',
    'M0 .2Q8 4 14 9m-6-3 4.8-1m-5.5.4 1 5.8',
    'M0 0q1 7-.1 16m.3-6 3.6 3.2m-3.9-5-4 4',
    'M-.4 .4-14 9m5-3.3-4.8-.6m4.8.6-.5 4.8',
    'M0 0q-6-3-13-9m5 3.6-4 .4m4.7.2-.7-5.6'
  ];
  const gusts=[
    'M5 27q4-3 8-3m1 6 4-1',
    'M5 27q9-5 17-4m-10 8q6-3 12-2',
    'M7 26q9-5 20-2m-10 5q7 0 11-4',
    'M12 24q9-3 15-1t9-1m-13 7q7-1 10-5',
    'M19 23q6-1 10 1t10-2m-10 5 5-3',
    'M28 24q6 2 12-2m5-3 3-2',
    'M36 24l5-2m5-3 5-4',
    'M46 19l4-4'
  ];
  return `<svg class="season-drawing january-gust" viewBox="0 0 82 50" aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#758b96" stroke-width="1.25">${gusts.map((d,i)=>`<path class="gust-mark" style="--frame:${i}" d="${d}"/>`).join('')}</g>
    ${flurry?`<g stroke="#7c8a96" class="february-flurry"><g class="flurry-far"><path d="m18 6 .2 7m-3.4-5.1 6.3 3.4m-6.2.4 6-4" stroke-width="1.35"/></g><g class="flurry-near"><path d="m29 25 .2 10m-4.5-7.2 8.4 4.2m-.5-5-7.4 5.6" stroke-width="1.4"/></g></g>`:''}
    <g transform="translate(53 24)"><g class="gust-crystal" stroke="#485e6b" stroke-width="1.65">${arms.map(d=>`<path d="${d}"/>`).join('')}<path d="m-3-2 3-2 3 2 .2 4-3 1.6L-3 2Z" fill="#ecf2ee" stroke-width="1.1"/></g></g></svg>`;
}

const aprilMeadow = `<g fill="none" stroke="#697b55" stroke-width="1.1" class="april-grass">
  <path d="M4 46q3-3 5-9m-1 8-2-5m3 5q2-5 5-7m33 6q5-5 5-9m-3 8 6-5m0 4 4-6"/>
  <path d="M7 38q-4 1-3-2 2-2 4 0-1-4 2-4 3 0 1 4 3-2 4 .2 0 2-4 3Z" fill="#db9c93" stroke="#8a7469"/>
  <path d="M53 35q-3-1-2-3 1-1 3 1 1-3 3-2 1 2-1 4Z" fill="#ebc679" stroke="#9e8e68"/>
  </g>`;

// Twelve discrete drawings play on a shared exposure sheet. The first is
// also the still used by the reduced-motion view.
function marginLoop(name, drawings, ground='', beat=125){
  const frames=drawings.map((art,i)=>
    `<g class="margin-cel" style="--delay:${(i-drawings.length)*beat}ms">${art}</g>`).join('');
  return `<svg class="season-drawing seasonal-margin ${name}" aria-hidden="true" viewBox="0 0 84 52" fill="none" stroke="#504b42" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" style="--cycle:${drawings.length*beat}ms">${ground}${frames}</svg>`;
}

function septemberSwallows(){
  // The primary feathers fold on the upstroke. The second swallow banks
  // half a beat behind, so the silhouettes never read as mirrored stamps.
  const wings=[
    'M31 22Q25 17 16 4q10 4 20 15', 'M31 22Q25 13 21 3q10 7 15 16',
    'M31 22Q30 11 28 3q7 11 8 16', 'M31 22q2-10 5-15 3 7 0 13',
    'M31 22q8-6 14-6-1 5-10 8', 'M31 22q10 1 15 5-6 1-13-1',
    'M31 22q9 6 12 15-9-4-13-11', 'M31 22q4 9 4 16-6-6-7-13',
    'M31 22q-2 6-5 10-2-6 3-11', 'M31 22q-5-1-9-4 5-1 11 1',
    'M31 22q-8-6-12-12 9 3 16 9', 'M31 22Q23 15 16 6q12 5 20 14'
  ];
  function swallow(i){
    return `<path d="M15 27l11-6q5-5 11-4l4-1.3 4.6 1.2-5.5 2.5q-4 6-12 6L17 32l4-6Z" fill="#8097a0"/>
    <path d="${wings[i]}Z" fill="#a9b9b9"/><path d="m28 24 7-1" stroke="#f2e6cd" stroke-width="1.5"/>`;
  }
  const height=[0,-.5,-1,-.8,0,1.2,2,2.3,2,1.3,.5,0];
  const drawings=wings.map((_,i)=>`<g transform="translate(-9 ${height[i]+6})">${swallow(i)}</g>
    <g transform="translate(40 ${height[(i+4)%12]+1}) scale(.72) rotate(-7 31 22)">${swallow((i+4)%12)}</g>`);
  return marginLoop('september-swallows',drawings,'<path d="M4 45q9-2 16-1m24-4q10-2 19-1" stroke="#acaa96" stroke-width=".9"/>',100);
}

function octoberAcorns(){
  const arc=[
    [2,-5,'M31 15q4 5 6 10m4-13q4 2 7 7'],[4,-7,'M31 15q5 4 7 10m3-13q5 2 8 7'],
    [9,-9,'M31 15q5 3 8 10m2-13q5 1 9 6'],[14,-7,'M31 15q6 3 10 9m0-12q6 1 10 6'],
    [19,0,'M31 15q7 2 11 8m-1-11q5 2 10 7'],[11,10,'M31 15q6 3 9 9m1-12q5 3 8 8'],
    [2,15,'M31 15q5 5 6 10m4-13q3 4 6 9'],[-6,12,'M31 15q3 4 4 10m6-13q3 4 5 9'],
    [-9,5,'M31 15q2 5 3 11m7-14q3 3 5 8'],[-7,-2,'M31 15q3 5 4 11m6-14q3 3 6 8'],
    [-3,-5,'M31 15q3 5 5 11m5-14q4 2 7 7'],[0,-5,'M31 15q4 5 6 10m4-13q4 2 7 7']
  ];
  const caps=[[37,25,48,19],[38,25,49,19],[39,25,50,18],[41,24,51,18],[42,23,51,19],[40,24,49,20],[37,25,47,21],[35,25,46,21],[34,26,46,20],[35,26,47,20],[36,26,48,19],[37,25,48,19]];
  const acorn='<path d="M-6.8 3q-.8 10 6.3 14.4.8 1.1 1.1 2 .8-1.8 2-3.1 6-6.3 4.2-13.7Z" fill="#c99a6d"/><path d="M-8 3Q-7-2-.8-2.6q6-.5 9 4.8-7.5 5-16.2.8Z" fill="#998772"/><path d="m-4 .3 1.3 1.1m2-2L1 1m2-.6 1 .7m-8 7q0 2 1 3" stroke-width=".85"/>';
  return marginLoop('october-acorns',arc.map(([a,b,stem],i)=>{
    const [x,y,u,v]=caps[i];
    return `<path d="${stem}"/><g transform="translate(${u} ${v}) rotate(${b}) scale(.8)">${acorn}</g><g transform="translate(${x} ${y}) rotate(${a})">${acorn}</g>`;
  }),'<path d="M13 18q16 1 32-9l19-6m-22 8q5-7 11-9" stroke="#72664d" stroke-width="2"/><path d="M23 18q-8-9-15-8 4 8 15 8Z" fill="#a0a27a"/><path d="m12 12 9 5" stroke-width=".8"/>',150);
}

function novemberRobin(){
  // One foot stays planted while the far wing opens. The droplets travel
  // beyond the wingtip after the bird has folded its feathers back in.
  const poses=[
    ['M16 24l14 5q6-7 15-8 11-1 12 9-3 13-15 13-8-1-12-8L16 28Z','M45 25q-10-3-15 6l-6 1q12 5 20-2Z','0 0',0,''],
    ['M16 23l15 6q6-6 15-7 10 0 11 9-3 12-15 12-8-1-12-8L16 27Z','M46 26q-10-4-16 5l-6 1q12 5 20-2Z','0 1',3,''],
    ['M15 19l16 10q8-6 16-4 10 1 10 9-5 10-16 9-8-1-12-9L15 23Z','M44 26q-11-6-16 1l-6 2q12 8 21 2Z','1 4',14,''],
    ['M15 14l17 14q9-5 17 0 9 3 7 10-7 8-16 4-6-3-11-10L15 18Z','M45 28q-8-9-16-7l-5 2q10 10 18 11Z','2 8',24,'M59 42q4-2 7 0'],
    ['M15 16l18 13q11-5 18 1 6 3 5 9-7 7-17 3-6-4-11-11L15 20Z','M45 29q-7-12-16-13l-5 2q8 13 18 16Z','2 9',29,'M58 43q5 2 10-.4m-8-4 2-1'],
    ['M17 20l16 8q5-9 17-5 11 4 7 13-5 10-17 6-6-2-11-10L17 24Z','M44 28q-6-14-14-18l-7-1q3 13 16 23Z','1 2',7,'M61 36l3-3m-2 10q6 2 10-1'],
    ['M17 25l16 3q7-11 18-7 10 5 6 15-7 10-17 6-7-3-11-10L17 29Z','M45 26Q42 9 30 5q-1 9 4 16l-5-3q4 10 13 13Z','-1 -1',-9,'M25 11l-3-4m40 17 4-4m1 12 3-2'],
    ['M13 27l18 1q8-10 20-6 10 5 5 15-7 9-17 5-8-4-10-10l-16-2Z','M44 26Q35 10 19 12q4 9 13 13l-7-2q8 7 17 7Z','0 -1',-6,'M18 7l-2-3m50 13 4-3m-1 15 4-1'],
    ['M14 26l18 2q7-9 18-6 10 4 7 14-7 10-18 6-6-3-10-10l-15-3Z','M45 25q-11-10-23-6 5 6 12 8l-7-1q8 6 16 4Z','0 0',-3,'M14 7l-1-2m56 11 3-1m1 15 3 1'],
    ['M15 25l16 4q7-8 18-7 11 3 8 13-5 10-17 7-7-2-11-9l-14-5Z','M45 26q-12-6-18 1l-5 2q11 5 21 2Z','0 0',0,'M12 9v2m62 8 1 2'],
    ['M16 24l15 5q6-7 16-8 12 1 10 12-4 12-16 10-7-2-11-9l-14-6Z','M46 25q-10-4-16 5l-6 2q12 5 20-2Z','0 0',-2,'M74 23v2'],
    ['M16 24l14 5q6-7 15-8 11-1 12 9-3 13-15 13-8-1-12-8L16 28Z','M45 25q-10-3-15 6l-6 1q12 5 20-2Z','0 0',0,'']
  ];
  const ground='<path d="M13 45q12-4 24-2t28 0q8 0 11 2-11 3-24 2m-15 0q-8 .5-16-1" fill="#c7d2cc" stroke="#909d93" stroke-width=".95"/><path d="m39 39-1 5-4 1m13-6-1 5 3 1" stroke-width="1.2"/>';
  return marginLoop('november-robin',poses.map(([body,wing,offset,tilt,spray])=>
    `<path d="${body}" fill="#b6ab93"/>
    <g transform="translate(${offset}) rotate(${tilt} 49 24)">
      <path d="M43 23q-1-8 6-10 7-2 10 5l1 4 5 1-6 2q-.2 7-5 10-5 3-9-1" fill="#b6ab93"/>
      <path d="M54 19q6-.6 5 4l-1 4q-1 6-7 8-5 1-7-3 5-2 5-8 0-4 5-5Z" fill="#ce835d" stroke="none"/>
      <path d="m59 21.5 5 1.3-5 1.2Z" fill="#564c41" stroke-width=".8"/><circle cx="55" cy="18.7" r="1.25" fill="#38352e" stroke="none"/>
    </g><path d="${wing}" fill="#948e79"/><path d="${spray}" stroke="#7396a0" stroke-width="1.4"/>`),ground,145);
}
