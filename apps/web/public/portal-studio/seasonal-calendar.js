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
  if(month===11) return decemberPine();
  if(month>=5 && month<=7) return summerSkiff();
  if(month===8) return septemberKite();
  if(month===9) return octoberAcorns();
  if(month===10) return novemberRain();
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
    `<g class="margin-cel${i===0?' still':''}" style="--delay:${(i-drawings.length)*beat}ms">${art}</g>`).join('');
  return `<svg class="season-drawing seasonal-margin ${name}" aria-hidden="true" viewBox="0 0 84 52" fill="none" stroke="#504b42" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" style="--cycle:${drawings.length*beat}ms">${ground}${frames}</svg>`;
}

function septemberKite(){
  // The line pulls tight before the nose turns. The two cloth bows follow last.
  const poses=[
    [49,13,-8,'M8 46Q32 43 47 23','q5 6 9 6t9 6',9,29,18,34],
    [50,13,-5,'M8 46Q32 42 48 23','q5 5 9 6t9 5',9,29,18,33],
    [52,12,1,'M8 46Q33 40 50 22','q4 5 8 7t10 4',8,29,18,33],
    [54,10,8,'M8 46Q32 38 52 20','q3 5 6 8t9 5',6,28,15,33],
    [55,9,13,'M8 46Q31 35 53 19','q1 6 4 9t8 7',4,28,12,35],
    [55,8,15,'M8 46Q30 34 53 18','q0 6 2 10t6 8',2,28,8,36],
    [54,8,11,'M8 46Q29 35 52 18','q0 7 1 11t5 8',1,29,6,37],
    [53,9,6,'M8 46Q29 37 51 19','q1 7 2 11t4 9',2,30,6,39],
    [52,10,0,'M8 46Q30 40 50 20','q2 7 4 10t5 9',4,30,9,39],
    [50,12,-6,'M8 46Q30 43 48 22','q3 7 6 9t6 8',6,31,12,39],
    [49,13,-10,'M8 46Q31 44 47 23','q4 7 7 8t8 7',7,31,15,38],
    [49,13,-9,'M8 46Q32 44 47 23','q5 6 8 7t9 6',8,30,17,36]
  ];
  const bow=(x,y)=>`<path d="M${x-3} ${y-2.4}l3 2.3 3.1-2.1-.6 4.6-2.6-2.2-3.2 1.3Z" fill="#ae7467" stroke-width=".85"/>`;
  return marginLoop('september-kite',poses.map(([x,y,angle,line,tail,bx,by,cx,cy])=>`
    <path d="${line}" stroke="#786b5b" stroke-width="1.15"/>
    <g transform="translate(${x} ${y}) rotate(${angle})">
      <path d="M-2 11${tail}" stroke="#776453"/>
      ${bow(bx-2,by-12)}${bow(cx-2,cy-12)}
      <path d="M1-7-11 .2-2 13 9 1Z" fill="#dca987"/>
      <path d="m1-7-3 20L9 1Z" fill="#91afae" stroke="none"/>
      <path d="M1-7-2 13M-10.5.2q8-2 19.2.8" stroke="#645c4e" stroke-width="1"/>
    </g>`),'',160);
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
  const acorn=`<path d="M-8 2.6C-9 10-6.9 15-2 17.3q1.5.9 2.3 2 1-1.4 2.9-2.5C8.1 13.9 9.4 7.8 8.7 2Z" fill="#bd8452"/>
    <path d="M-6 6q-.6 6.3 3.6 9.1" stroke="#ebc58d" stroke-width="1.7"/>
    <path d="M-10 2.7C-9.7-.5-7.8-4.8-2.7-5.4 3.4-7 9.3-4.2 10.4.6l.4 2.1C5.5 6.2-3 7.2-9.7 4.1Z" fill="#89735a"/>
    <path d="m-8 .4 2.1 1.5 1.4-2m1.1-2.5 2.2 1.8 1.6-1.9m1.5 3.1 2.3 1.4L6-.2m.1-2.8 1.8 1.3m-10 5L.2 5l1.9-2" stroke="#594b3f" stroke-width=".92"/>`;
  return marginLoop('october-acorns',arc.map(([a,b,stem],i)=>{
    const [x,y,u,v]=caps[i];
    return `<path d="${stem}"/><g transform="translate(${u} ${v}) rotate(${b}) scale(.8)">${acorn}</g><g transform="translate(${x} ${y}) rotate(${a})">${acorn}</g>`;
  }),'<path d="M13 18q16 1 32-9l19-6m-22 8q5-7 11-9" stroke="#72664d" stroke-width="2"/><path d="M24 17q-4-2-4-5-1-3-4-2l-1-3q-1-2-4-1-3-2-6-1 0 3 3 4-2 2 1 4l3 1q-1 3 4 3l3 .2 4 1Z" fill="#aaa477"/><path d="m12 12 9 5" stroke-width=".8"/>',150);
}

function novemberRain(){
  // Two drips take turns. Their crowns collapse into broken ellipses.
  const poses=[
    ['M37 8l-1.2 4.4m23 1.8-.5 2','','M46 36q10 1 15-1m-43 0q4 2 11 2'],
    ['M36 13l-1.1 5.4m22.4-1.7-.6 2.8','','M48 37q7 .3 12-1.4'],
    ['M35 20l-1.4 6m22.8-7.3-.8 3.6','',''],
    ['M33.5 28l-.5 3.3m22.5-8.6-.9 4.6','M29 32q3 .8 5-.2',''],
    ['M54.5 27.5l-.8 4','M27 32l1.1-3.6 3.2 2.4 3.5-4 .8 5m-10-5-1.1-1.2m12-.6 1-1.4','M25 33q4 2.2 12 .5'],
    ['M54 32l-.4 2','M25 29l-.7-2m13 .3 1.2-1.4','M22 33q-1.5 2 6.7 2.6 8.5 1 14-1.8m-15-2.6q3-1 7.5-.7'],
    ['M37.3 3l-.4 1.3','M48 35l-.3-3.2 3.5 1.9 3.4-3.9 1.1 4.5','M18 33q-1 3.6 12 4 11 .7 16-2.1m-24-4.7q5-1.4 12-1.2'],
    ['M37.5 3.4l-.5 1.7','M46.5 31l-.6-2m12 1 1.2-1.3','M15 34q.8 4 14 4.4m9.7-.3 6-1.1m1-2q5.8 2.2 12.8-.1'],
    ['M37.6 4l-.7 2','','M14 35q4 4 15 4m12-4.7q-1 2.4 8 3.2 9.5.8 15.3-2m-16.5-3.6 6-.2'],
    ['M37.5 4.8l-.8 2.6','','M16 37q4.7 2.3 10 2.3m12.4-3.7q3.6 3 13 3 10 .3 15-2.8'],
    ['M37.4 5.4l-.8 3.1m22.6 7 .2-.4','','M39 37.4q4 2 12 2m9.2-.6 6-1.7'],
    ['M37.2 6.5l-1 3.8m22.8 4.2-.3 1.2','','M44 37q6 1.5 13 .7']
  ];
  const puddle='<path d="M9 33q2-3 15-3.5c8-.3 14 1 21-.1 10-1.5 21-.5 26 2.1 3.8 1.7-.3 3.6-4.5 4.5-5.2 1 0 3-9 4.8-8 1.7-15-.6-22-.2-13.8 1-23.7-.6-23.4-3.6.4-1.8-5.2-1.7-3.1-4Z" fill="#b0c6c7" stroke="#71868a" stroke-width="1.1"/><path d="m14 44 5.3.4m43-2.8 4.4-.9" stroke="#ac9f8e" stroke-width="1"/>';
  const umbrella=`<g transform="rotate(-13 24 23)">
    <path d="M24 8v28q-.2 5-3.7 4.8-2.9-.2-3.1-3" stroke="#6b5b50" stroke-width="1.8"/>
    <path d="M6.5 23.1q1.8-12.5 16-14.6l1.1-2.1 1.3 2.2c8.4.9 15.8 7.1 17.5 15.6q-5.1-3.6-9.5-.3-4.7-4.4-9.1-1-4.5-3.7-8.4-.3-4.7-3.1-8.9.5Z" fill="#d59981"/>
    <path d="M23.5 9q-6.1 4.9-8.1 12.8M24.5 9q6.8 5.7 8.3 14" stroke="#946956" stroke-width=".95"/>
    <path d="M11 18q2.1-4 5.3-5.7" stroke="#f0c8a5" stroke-width="1.25"/></g>`;
  return marginLoop('november-rain',poses.map(([drop,splash,ring])=>
    `<path d="${drop}" stroke="#637f8f" stroke-width="1.8"/><path d="${splash}" stroke="#526c78"/><path d="${ring}" stroke="#5f7c83" stroke-width="1.1"/>`
  ),puddle+umbrella,130);
}

function decemberPine(){
  return `<svg class="season-drawing seasonal-margin december-pine" viewBox="0 0 84 52" fill="none" stroke="#495950" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 46q11-2 24-.5m10-1q10 1 17-1" stroke="#9da99c"/>
    <path d="m33 35-.8 10 4-.7-.4-11" fill="#928674"/>
    <path d="M35 3q-1 6-8 13l4.8-1.5q-5 8-13.5 13l9-1.4q-5 7-13 11.5 8.7 1 15.8-1.6l-2.5 3.6q11.8-1.2 15-4l7.4 1.6q-6.6-4.4-10.3-12l7.1 2.8q-7.5-8.2-10.1-15.1l4.3 2Q37.7 10 35 3Z" fill="#93aaa0"/>
    <path d="M34.5 6q-1.8 4.6-5.7 8.3l5.1-2m-3.5 7.1q-3 4.1-7.6 6.2l7.1-1.6m-2.1 7.3q-4 4.2-8.4 5.8m15.3-10.2 4.3 3.3" stroke="#f4f1df" stroke-width="2.1"/>
    <g class="pine-flurry" stroke="#84969f" stroke-width="1.3"><path d="m58 8 1.5 1m9 8 1.4-.6m-9.8 9.5 1.8.7"/></g></svg>`;
}
