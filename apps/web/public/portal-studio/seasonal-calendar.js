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
  const flight=[
    'M45 26Q34 20 17 3q12 3 22 9 10 6 12 13', 'M45 26Q33 14 24 2q14 4 22 15l5 8',
    'M45 26Q40 13 35 2q13 8 16 23','M45 26q1-13 4-18 7 8 2 18',
    'M45 25q9-7 17-7-1 6-13 10','M44 25q12 0 18 5-6 3-16 0',
    'M44 24q12 7 17 18-9-2-19-12','M44 24q9 12 10 24-9-6-15-18',
    'M44 25q1 10-5 18-3-7-2-15','M45 25q-8 4-14 1 4-3 10-5',
    'M45 25q-13-3-22-13 12 1 24 9','M45 25Q30 18 20 7q15 4 28 15'
  ];
  const farWing=[
    'M47 23Q43 11 44 3q8 8 10 20Z','M47 23q-2-13 2-18 6 9 5 18Z',
    'M47 23q4-10 10-12 2 6-4 13Z','M47 24q9-5 15-4-2 6-11 8Z',
    'M46 25q11 1 16 7-7 0-13-3Z','M46 25q8 6 11 14-7-3-12-9Z',
    'M45 25q5 9 4 17-6-6-8-13Z','M46 25q-2 9-6 13-1-7 1-12Z',
    'M47 24q-6 3-10 1l7-4Z','M47 24q-8-4-11-10 9 3 13 8Z',
    'M47 23Q39 15 37 5q10 7 14 17Z','M47 23Q41 12 40 3q10 8 13 19Z'
  ];
  const dip=[0,-.6,-1,-.7,.2,1,2,2.3,1.8,.8,.2,0];
  return marginLoop('september-swallows',flight.map((wing,i)=>`<g transform="translate(0 ${dip[i]})">
    <path d="${farWing[i]}" fill="#8b9e9e"/>
    <path d="M6 38Q20 31 32 25q12-8 21-6 3-6 10-5 6 .4 7 5l7 1.4-8.2 2.2q-5 5-11 6-9 6-24 3l-18 12 8-13Z" fill="#526879"/>
    <path d="M24 34q12-9 23-9l11-1-3 5q-10 5-21 2Z" fill="#efe6d1" stroke="none"/>
    <path d="M58 20q5 1 11-.6-1 5-9 7l-5 .2Z" fill="#c08266" stroke="none"/>
    <path d="M68 19.3l7 1-7 1.8Z" fill="#443e39" stroke-width=".7"/>
    <circle cx="65" cy="17.8" r="1.05" fill="#f4e9d0" stroke="none"/>
    <path d="${wing}Q47 30 40 28" fill="#637985"/>
    <path d="M28 28l-13 8" stroke="#c1c3b5" stroke-width=".8"/></g>`),'',105);
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

function novemberRobin(){
  // A wren grips the twig between calls. Tail, throat and beak move separately.
  const poses=[
    [-2,0,0,0,''],[-3,0,-1,0,''],[-6,1,-3,.7,''],[-9,1,-6,2,'M61 15l3-2'],
    [-13,.5,-9,3,'m62 14 4-3m-3 7 5-.5'],[-14,0,-8,1.5,'m66 11 3-2m-2 8 4-.4'],
    [-10,-.5,-5,0,'m70 9 2-1'],[-6,-.7,-3,0,''],[-4,-.5,-5,1.9,'m61 15 3-2'],
    [-7,0,-7,2.5,'m64 14 4-2m-2 6 3 .2'],[-6,0,-3,.5,'m69 12 2-1'],[-3,0,0,0,'']
  ];
  const perch='<path d="M12 48q17-4 36-6t27-8m-12 6 6 1m-46 5-5-3" stroke="#776f54" stroke-width="1.9"/><path d="m37 36 2 7-4 2m4-2 3 1m4-8 3 5-3 2m3-2 3 1" stroke="#655745" stroke-width="1.35"/>';
  return marginLoop('november-wren',poses.map(([tail,lift,tilt,gape,call])=>`
    <g transform="translate(0 ${lift})">
      <g transform="rotate(${tail} 31 31)"><path d="M34 34q-10-2-15-11l-6-13q5 1 8 7l-2-10q6 2 9 12l4 10Z" fill="#987354"/>
      <path d="m19 16 5 9m.4-5.3 3 6" stroke="#dcc9a2" stroke-width="1"/></g>
      <path d="M25 28q3-10 14-12 10-4 16 4 7 6 3 13-4 7-15 8-12 1-18-7l-4-2Z" fill="#ae8c66"/>
      <g transform="rotate(${tilt} 49 24)"><path d="M37 21c2-7 7-11 13-10q9 0 11 9l-3 7q-2 5-7 7-8 1-13-5" stroke="none" fill="#ae8c66"/>
      <path d="M37 21q4-11 13-10 8 0 11 9" fill="none"/>
      <path d="M42 18q6-5 14-2" stroke="#e9d9b7" stroke-width="2.1"/><circle cx="55" cy="18.7" r="1.45" stroke="none" fill="#362e2a"/>
      <path d="m60 20 9-1.2-8.2 3.3Z" fill="#625343" stroke-width=".8"/>
      <path d="M59 22l8 ${-1+gape}q-4 1.7-8 1.6Z" fill="#af8c65" stroke-width=".8"/>
      <path d="M58 24q-.5 8-8 11-5 1-8-1 6-4 7-9" fill="#ddcbaa" stroke="none"/></g>
      <path d="M44 23q-10-3-16 5l-6 5q10 3 17-2 4-3 5-8Z" fill="#8c6b50"/>
      <path d="m27 31 9-4m-4 5 7-4m-4-3 2.6 1.4m-1.4-3 3 1.4" stroke="#dbc5a0" stroke-width="1.12"/>
    </g><path d="${call}" stroke="#8b7964"/>`),perch,160);
}

function decemberPine(){
  return `<svg class="season-drawing seasonal-margin december-pine" viewBox="0 0 84 52" fill="none" stroke="#495950" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 46q11-2 24-.5m10-1q10 1 17-1" stroke="#9da99c"/>
    <path d="m33 35-.8 10 4-.7-.4-11" fill="#928674"/>
    <path d="M35 3q-1 6-8 13l4.8-1.5q-5 8-13.5 13l9-1.4q-5 7-13 11.5 8.7 1 15.8-1.6l-2.5 3.6q11.8-1.2 15-4l7.4 1.6q-6.6-4.4-10.3-12l7.1 2.8q-7.5-8.2-10.1-15.1l4.3 2Q37.7 10 35 3Z" fill="#93aaa0"/>
    <path d="M34.5 6q-1.8 4.6-5.7 8.3l5.1-2m-3.5 7.1q-3 4.1-7.6 6.2l7.1-1.6m-2.1 7.3q-4 4.2-8.4 5.8m15.3-10.2 4.3 3.3" stroke="#f4f1df" stroke-width="2.1"/>
    <g class="pine-flurry" stroke="#84969f" stroke-width="1.3"><path d="m58 8 1.5 1m9 8 1.4-.6m-9.8 9.5 1.8.7"/></g></svg>`;
}
