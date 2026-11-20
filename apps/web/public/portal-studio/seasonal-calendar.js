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
    <g transform="translate(53 24)"><g class="gust-crystal"><g class="crystal-roll" stroke="#485e6b" stroke-width="1.65">${arms.map(d=>`<path d="${d}"/>`).join('')}<path d="m-3-2 3-2 3 2 .2 4-3 1.6L-3 2Z" fill="#ecf2ee" stroke-width="1.1"/></g></g></g></svg>`;
}

const aprilMeadow = `<g fill="none" stroke="#697b55" stroke-width="1.1" class="april-grass">
  <path d="M4 46q3-3 5-9m-1 8-2-5m3 5q2-5 5-7m33 6q5-5 5-9m-3 8 6-5m0 4 4-6"/>
  <path d="M7 38q-4 1-3-2 2-2 4 0-1-4 2-4 3 0 1 4 3-2 4 .2 0 2-4 3Z" fill="#db9c93" stroke="#8a7469"/>
  <path d="M53 35q-3-1-2-3 1-1 3 1 1-3 3-2 1 2-1 4Z" fill="#ebc679" stroke="#9e8e68"/>
  </g>`;

// A full exposure includes the time the drawing stays on the page. A long
// hold at the top of a swing and a short contact can share the same sheet.
function marginLoop(name, drawings, ground='', beat=125){
  const holds=drawings.map(drawing=>typeof drawing==='string'?beat:drawing.hold);
  const cycle=holds.reduce((sum,hold)=>sum+hold,0);
  let elapsed=0;
  const frames=drawings.map((drawing,i)=>{
    const delay=elapsed-cycle;
    elapsed+=holds[i];
    return `<g class="margin-cel${i===0?' still':''}" style="--delay:${delay}ms;--hold:${100*holds[i]/cycle}%">${drawing.art ?? drawing}</g>`;
  }).join('');
  return `<svg class="season-drawing seasonal-margin ${name}" aria-hidden="true" viewBox="0 0 84 52" fill="none" stroke="#504b42" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" style="--cycle:${cycle}ms">${ground}${frames}</svg>`;
}

function septemberKite(){
  // The bridle is the pivot. The tether stays under tension. The tail's
  // last knot lags behind the first and hangs below it throughout the gust.
  const poses=[
    // Hold, bridle x/y, pitch, tether sag, tail drawing.
    [300,49,15,-8,36.8,0],[135,49,15,-8,36.5,0],[110,49.2,15,-7.8,36.2,1],
    [100,49.5,14.8,-7.4,35.8,1],[95,50,14.6,-6.7,35.4,2],
    [100,50.7,14.3,-5.8,35,2],[100,51.4,14,-4.8,34.8,3],
    [125,51.8,13.9,-4.2,34.7,4],[240,52,13.9,-4,34.8,5],
    [125,51.9,14,-4.3,35,5],[115,51.6,14.1,-4.9,35.3,4],
    [115,51.1,14.3,-5.6,35.7,4],[115,50.6,14.5,-6.4,36.1,3],
    [125,50.1,14.7,-7.2,36.5,2],[145,49.6,14.9,-7.9,36.8,1],
    [150,49.1,15,-8.3,37,1],[170,48.9,15.1,-8.2,37,0],
    [220,49,15,-8,36.9,0]
  ];
  const tails=[
    [1.8,19.5,3.5,25.4,-5,5],[2,19.5,3.6,25.4,-4,5],
    [2.4,19.4,3.9,25.3,-2,4],[2.8,19.2,4.4,25.2,0,3],
    [3.1,19.1,5.1,24.9,2,2],[3.1,19.1,5.5,24.8,2,0]
  ];
  const bow=(x,y,angle)=>`<path transform="translate(${x} ${y}) rotate(${angle})" d="M-3.3-2.3.1-.3l3-1.6-.7 4L0 .5l-3.5 1Z" fill="#b77c69" stroke-width=".9"/>`;
  return marginLoop('september-kite',poses.map(([hold,x,y,tilt,sag,tail])=>{
    const [bx,by,cx,cy,twist,tip]=tails[tail];
    return {hold,art:`<path d="M5 45Q28 ${sag} ${x} ${y}" stroke="#746859" stroke-width="1.4"/>
      <g transform="translate(${x} ${y}) rotate(${tilt})">
        <path d="M-2 12.4Q-1 16.7 ${bx} ${by}Q${bx+1.6} ${by+3.2} ${cx} ${cy}" stroke="#776453" stroke-width="1.15"/>
        ${bow(bx,by,twist)}${bow(cx,cy,tip)}
        <path d="M1-9Q-4-5-12 0L-2 12.4 10 .4Z" fill="#dca987"/>
        <path d="M1-9-2 12.4 10 .4Z" fill="#91afae" stroke="none"/>
        <path d="M1-9-2 12.4M-11.7 0Q-2-1.6 9.7.4" stroke="#635b4e" stroke-width="1.05"/>
        <path d="m-3-2 3 2-3 4" stroke="#756549" stroke-width=".85"/>
      </g>`};
  }));
}

function octoberAcorns(){
  // The short stalk catches up first. Its nut taps its neighbour, then
  // the little recoil dies out while the leaf still turns on its petiole.
  // Rounded oak lobes taper to a short petiole. Keep the midrib rooted
  // as the blade rolls slightly towards its underside.
  const leaf=[
    'M-3 0q-2 2-4.8 2.1-2 .3-1.3 1.8.3 2-3.2 2.4-2 .2-2.2-1.8-.2-1.4-1.5-.7-3 2-5.1.8-1.1-.9-.3-2.1-3.7 1-5.5-1.9-.6-1.5 1.5-2.9 1.7-1 3.9-1-1.5-2.6 1.2-3.2 2.5-.5 5.3 1.2-1-2.2 1.2-3 3.1-.9 5 2.4.4 1 1.5 1.2Q-5-4-3 0Z',
    'M-3 0q-2.3 2-5 2-2.1.3-1.6 1.7.4 1.6-2.8 1.9-2.1.2-2.6-1.5-.4-1.2-1.6-.5-3.1 1.6-4.8.5-1.1-.7-.5-1.7-4 .5-5.1-2-.8-1.6 1.6-2.8 1.8-.9 3.6-.9-1.2-2.4 1.2-2.9 2.4-.6 5 1-1-2 1.3-2.7 3-.8 4.8 2 .8 1.1 1.8 1.4Q-5-4-3 0Z',
    'M-3 0q-2.6 2-5.6 1.9-1.6.3-1.4 1.2.4 1.5-2.6 1.7-2 .1-2.5-1.2-.5-1.1-1.7-.5-3.2 1.1-4.6.3-.8-.6-.6-1.4-3.2.4-5-1.8-.7-1.5 1.5-2.5 1.8-.8 3.6-.7-1.1-2 1.4-2.6 2.7-.3 5 1-1-2 1.3-2.5 3.1-.6 5 1.8l1.6 1Q-5-3.2-3 0Z',
    'M-3 0q-3.4 1.8-6.5 1.4 1.1 1.7-2.8 2.2-2.4.2-3.2-1.1-3.9 1.7-6.5.3l-.3-.9q-3.4 0-4.7-1.8 1.1-2 5-2.4-.5-2 2.1-2.1 2.4-.1 4.6.9-.5-1.7 1.8-1.8 2.6 0 4.7 2.1Q-5-2.8-3 0Z',
    'M-3 0q-2.5 1.9-5.6 1.6-1.7.1-1.3 1.3.4 1.5-3 1.7-1.9 0-2.5-1.5-4 1.8-6.1.4-.7-.6-.4-1.3-3.8.2-5-1.8 1.1-2.4 5.1-2.9-1.2-1.9 1.4-2.4 2.7-.4 5.2 1-.8-1.9 1.6-2.3 3-.4 5.1 2.2Q-5.3-2.9-3 0Z'
  ];
  const nuts=[
    ['M-7.1 1.2C-8 7.8-5.1 13.8-1.1 15.2l1.5 1.9 1.2-1.8C7 13.2 8.1 6.1 7.6 1Z','M-8.8 1.4q.2-6.3 7.3-7.6C4.7-7.3 8.4-4 9 .2l-.2 1.6C4 4.7-3.6 5-8.8 3Z'],
    ['M-7.3 1.3C-7.9 8.6-5 13.6-.8 15.4L.6 17l1.3-1.8C6.6 13.4 8.4 6.2 7.4 1Z','M-8.9 1.5q.6-6.7 7.2-7.8C5-7 8.3-3.9 9.1.4l-.3 1.4C3.9 5-3.6 4.8-8.8 3Z'],
    ['M-7 1.2C-8.3 7.7-5 14-1 15.1l1.3 1.8 1.5-1.8C7.1 12.9 8 6.3 7.7 1Z','M-8.7 1.4q.1-6.6 7.1-7.4C4.6-7.4 8.6-4 9 .1v1.5C4.3 4.5-3.4 5.2-8.8 3Z']
  ];
  // Exposure, angle of each stalk, leaf silhouette and roll, front ink cel.
  const poses=[
    [270,-3,5,0,0,0],[120,-3,4,1,3,1],[85,-2,3,2,6,0],
    [70,0,3,3,9,2],[70,4,6,3,12,1],[75,9,11,4,14,2],
    [85,15,17,2,17,0],[95,20,23,1,19,1],[140,23,26,0,20,2],
    [80,23,22,1,17,1],[70,19,14,3,12,2],[70,12,6,4,6,0],
    [65,3,1,2,1,1],[60,-6,2,0,-4,2],[55,-14,6,1,-6,1],
    [85,-18,9,0,-7,0],[65,-13,1,2,-5,2],[80,-8,-8,3,-3,1],
    [100,-6,-12,4,1,0],[90,-5,-10,2,4,1],[80,-7,-5,1,5,2],
    [85,-9,2,0,4,1],[100,-10,7,1,2,0],[95,-7,4,2,-1,2],
    [110,-4,0,4,-2,1],[100,-2,0,2,-1,0],[145,-2,3,1,0,1],
    [190,-3,5,0,0,2]
  ];
  function hangingNut(x,y,angle,length,scale,ink){
    const [shell,cap]=nuts[ink];
    return `<g transform="translate(${x} ${y}) rotate(${angle})">
      <path d="M0 0Q2.2 ${length*.33} .4 ${length}" stroke="#655b46" stroke-width="1.45"/>
      <g transform="translate(0 ${length}) scale(${scale})">
        <path d="${shell}" fill="#c18a59"/><path d="M-4.9 6.3q0 4.7 3 6.6" stroke="#ebc793" stroke-width="1.3"/>
        <path d="${cap}" fill="#8e795b"/><path d="m-6-.8 1.9 1.6 1.4-2.1M-2.3-3.3l1.9 1.5 1.5-2M2 .5l2 1.3L5.4-.6" stroke-width="1"/>
      </g></g>`;
  }
  const twig='<path d="M13 20q12-2.6 23-6.3Q50 8 68 5m-17 3.4q5-3.3 8-6.1" stroke="#76684f" stroke-width="2.1"/>';
  return marginLoop('october-acorns',poses.map(([hold,front,rear,fold,roll,ink],i)=>({
    hold,art:`<g transform="translate(32 15) rotate(${13+roll*.2})"><path d="${leaf[fold]}" fill="${fold===3?'#baa36c':'#aba574'}"/><path d="M0 0Q-4-.5-8-.8L-22-1.4m8 .3-2.5-2.3m4.7 2.4-2.2 2" stroke="#766b4d" stroke-width=".9"/></g>
      ${hangingNut(52,8.5,rear,13,.83,(ink+1)%3)}
      ${hangingNut(32,15,front,14,1,ink)}
      ${i===15?'<path d="m44 36 1.3 2.6m1.6-5 2.2 1" stroke-width="1.05"/>':''}`
  })),twig);
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
