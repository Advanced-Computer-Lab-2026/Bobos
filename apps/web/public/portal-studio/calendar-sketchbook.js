function turnSketchPage(stack,oldPage,forward,oldColors){
  const paper=stack.querySelector('.folio-paper');
  const layer=document.createElement('div');
  layer.className='turn-cels sketch-turn';layer.inert=true;layer.setAttribute('aria-hidden','true');
  const colors=forward?oldColors:['--sheet','--verso'].map(k=>getComputedStyle(stack).getPropertyValue(k));
  layer.innerHTML=`${forward?'':`<div class="folio-paper turn-ground" style="background:${oldColors[0]}">${oldPage}</div>`}<div class="drawn-face" style="background:${colors[0]}"><div class="folio-paper">${forward?oldPage:paper.innerHTML}</div></div><svg viewBox="0 0 300 200" preserveAspectRatio="none" fill="none"><path fill="${colors[1]}" stroke="currentColor" vector-effect="non-scaling-stroke"/><path stroke="currentColor" opacity=".48" vector-effect="non-scaling-stroke"/></svg>`;
  stack.append(layer);
  // The illustration on the incoming sheet starts when it is uncovered.
  const drawingsIn=paper.querySelectorAll('.season-drawing *, .sketch-scene *');
  const arriving=Array.from(drawingsIn).flatMap(el=>el.getAnimations());
  arriving.forEach(animation=>animation.pause());
  const face=layer.querySelector('.drawn-face'),[verso,pencil]=layer.querySelectorAll(':scope>svg>path');
  // The right tip lifts alone. While it travels, the left foot stays planted.
  // After the crest clears the hinge, the incoming sheet occludes the returning tip.
  const drawings=[
    calendarCels[0],
    [45,'M3 4H296L298 187Q295 192 290 194Q156 197 2 194Z','M298 187q1 6-8 7l6-7Z',''],
    calendarCels[1],
    [42,'M3 4H296L297 161Q284 179 257 192Q134 197 2 194Z','M297 161q7 20-19 28l-21 3q24-12 40-31Z','M278 186l12-8'],
    calendarCels[2],
    [38,'M3 4H296V132Q265 166 227 181Q114 198 2 193Z','M296 132q13 28-24 46-30 14-71 13l-31-1q83-4 126-58Z','M250 181q24-7 35-18'],
    calendarCels[3],
    [31,'M3 4H296V98Q269 136 206 155Q122 178 2 177Z','M296 98Q310 121 285 143Q243 174 169 179Q66 189 2 177Q121 179 206 155Q269 136 296 98Z','M25 180q31 5 53 3m169-23q20-8 35-23'],
    calendarCels[4],
    [32,'M3 4H295V70Q252 105 191 119Q100 143 3 136Z','M295 70Q312 91 279 115Q231 152 142 157Q54 163 3 136Q99 143 191 119Q252 105 295 70Z','M24 144q26 11 52 11m175-24q20-10 28-20'],
    calendarCels[5],
    [30,'M3 4H294V44Q238 67 180 76Q86 91 3 83Z','M294 44Q308 65 276 84Q226 119 139 122Q43 125 3 83Q86 91 180 76Q238 67 294 44Z','M18 92q22 15 49 20m185-22 18-10'],
    calendarCels[6],
    [32,'M3 4H291V23Q230 37 160 40Q69 44 4 35Z','M291 23Q306 40 276 58Q223 87 128 85Q41 83 4 35Q69 44 160 40Q230 37 291 23Z','M21 48q18 16 44 22'],
    calendarCels[7],
    [30,'M3 4H291L291 8Q155 18 4 9Z','M4 9Q155 18 291 8Q303 19 278 32Q216 59 128 51Q39 47 4 9Z','M26 21q30 18 66 21'],
    calendarCels[8],
    [44,'','M5 4Q12-15 61-27Q156-53 250-39Q286-35 291-15Q297 1 287 9Q124 28 5 4Z','M28-7q18-11 41-16m179-10q21 2 32 12'],
    ...calendarCels.slice(9,11),
    [47,'','M5 7Q36-28 101-43Q198-62 246-44Q285-32 292 8Z','M41-20q25-15 62-18'],
    [44,'','M7 14Q42-23 116-34Q218-46 261-26Q286-12 292 17Z','M59-17q28-10 56-12'],
    [39,'','M8 23Q43-13 136-23Q240-30 273-7L292 25Z','M87-13q32-8 63-8'],
    [36,'','M8 28Q60-4 144-11Q250-18 284 11L293 31Z','M128-7l39-4'],
    [43,'','M9 37Q86 0 164-3Q264-9 287 19L294 39Z',''],
    [57,'','M9 40Q93 8 173 4Q260 0 288 26L294 42Z','']
  ];
  function draw(n){
    if(!layer.isConnected)return;
    if(n===drawings.length||motionPreference.matches){
      layer.remove(); arriving.forEach(animation=>animation.play());return;
    }
    const k=forward?n:drawings.length-1-n;
    const [hold,front,back,crease]=drawings[k];
    face.style.visibility=front?'visible':'hidden';
    face.style.clipPath=`url(#${clipId})`;
    clip.setAttribute('d',front);
    verso.setAttribute('d',back);pencil.setAttribute('d',crease);
    // The binding progressively eclipses the returning leaf, from its
    // leading corner to the lagging corner. Reverse uses the same exposures.
    const crest=drawings.length-8;
    const eclipse=['polygon(-5% -55%,105% -55%,105% 7%,0 11%)',
      'polygon(-5% -55%,105% -55%,105% -2%,0 6%)',
      'polygon(-5% -55%,105% -55%,105% -7%,0 0%)',
      'polygon(-5% -55%,105% -55%,105% -10%,0 -5%)'];
    verso.parentElement.style.clipPath=k<crest?'none':eclipse[Math.min(k-crest,3)];
    setTimeout(()=>draw(n+1),hold);
  }
  const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs'),mask=document.createElementNS(ns,'clipPath'),clip=document.createElementNS(ns,'path');
  const clipId='sketch-fold-'+(++turnSketchPage.serial);
  mask.id=clipId;mask.setAttribute('clipPathUnits','objectBoundingBox');clip.setAttribute('transform','scale(.00333333333 .005)');mask.append(clip);defs.append(mask);layer.lastElementChild.append(defs);
  draw(0);
}
turnSketchPage.serial=0;

const sketchEditions={orchard:'Blossom diary',grove:'Frostwood',meadow:'Wind garden',observatory:'Sky journal'};
const sketchMonthColors=[
 ['#dde8eb','#aec2cc'],['#d6d9ed','#b4aec9'],['#e4cccc','#c7a4ae'],['#f1cbd2','#ca9faa'],
 ['#d1deb5','#a5ba95'],['#d0e3c9','#adc9a2'],['#efdcad','#cbb680'],['#f0c79e','#cda27b'],
 ['#d7cda9','#b9a57f'],['#e4b99c','#c59b87'],['#d2c3dc','#b29dbb'],['#cbd9e6','#a5bacb']
];
const winterTree='M23 49q3-12 1-22l1-16m0 21-11-8-4-8m11 14-1-9-6-9m11 14 8-9 2-10m-9 14 1-14m3 13 9-6m-17 7-8-2m10 16 11-7 6-7';
const blossomBranch='M3 48q17-18 30-22t29-17M16 35q6-11 5-18m9 12 1-12 6-7m7 11 6-12m-2 11 14-2';
const blossom='M0 0C-5 0-7-3-5-5l1 .5.5-1C-1-6 0-3 1-2c-1-4 0-7 3-6l.2 1 1-.2Q8-5 4-1q4-3 6 0l-.8 1 .7 .5Q9 4 4 3q2 4 0 6l-1-.6-1 .5Q0 8 0 4q-4 3-7 1l.4-1-.7-.4Q-7 1 0 0Z';
// First the calyx, then two cupped petals, then the loose open corolla.
const flowerPoses=[
 'M-1 3Q-3 0-1-2q4 0 3 3L0 3Z',
 'M-1 3Q-5 0-3-3q2-1 3 1 2-4 4-2 2 3-3 7Z',
 'M0 3q-6-1-6-5 2-2 5 1-2-5 1-5 2 0 2 4 4-4 6-1 0 3-5 4l-3 2Z',
 'M0 2q-6 0-5-4 2-2 5 0-2-5 1-5 3 0 2 5 4-4 6-1 0 3-5 4 4 1 2 4-3 1-5-3-4 4-6 1Z',
 blossom,
 'M0 .3C-5 0-7-2.8-5-5l1 .6.5-1C-1-6 0-3 1-2c-1-4 0-7 3-6l.2 1 1-.2Q8-5 4-1q4-3 6 0l-.8 1 .7 .6Q9 4 4 3q2 4 0 6l-1-.6-1 .5Q0 8 0 4q-4 3-7 1l.4-1-.7-.4Q-7 1 0 .3Z'
];
function inkScene(style,month){
 const winter=month<2||month===11,spring=month>=2&&month<5;
 const path=(d,attrs='')=>`<path d="${d}" ${attrs}/>`;
 const sprig=(x,y,scale)=>`<g transform="translate(${x} ${y}) scale(${scale})">${spring?flowerPoses.map((d,i)=>path(d,`class="petal-pose petal-${i}" style="--bud-delay:${x*6}ms" fill="#f4d2d5" stroke="#8c5669" stroke-width="1.05"`)).join(''):winter?path('M-3 0q4-2 6-1','stroke="#fffdf2" stroke-width="2.8"'):path('M-3 2q1-6 8-6-1 6-8 6Z','fill="currentColor" fill-opacity=".29"')}</g>`;
 const crystal=`<g transform="translate(53 16)" stroke="#586c7c"><g class="snow-star">${[0,60,120,180,240,300].map(angle=>path('M0 0 .1-10m0 3-3-2m3 4 3-3',`transform="rotate(${angle})"`)).join('')}</g></g>`;
 const snow=crystal+path('M64 31v5m-2-4 4 3m-4 0 4-3','class="weather-drift"');
 let art='';
 if(style==='orchard'){
   const cherries=path('M32 25q2 6 0 11m0-11q5 6 7 10')+path('M32 34c-6-2-8 7-2 8 6 1 8-8 2-8Zm8 0c-5-2-7 6-2 8 5 2 8-6 2-8Z','fill="#ac6466"');
   const fallen=path('M35 41q6-8 14-6-3 8-14 6Zm-3 3 12-7m8 7 7-2','class="autumn-leaf" fill="#bb855d"');
   art=path(blossomBranch)+[[21,16,.78],[33,18,.9],[38,10,.67],[51,9,.89],[59,11,.6],[63,18,.8]].map(p=>sprig(...p)).join('')+(month>=5&&month<8?cherries:month>=8&&month<11?fallen:'')+path('M49 26q4-4 5-1-1 4-5 1Zm9 6q2-2 4-1-1 3-4 1Z','class="weather-drift" fill="#e5b6b4"');
 }else if(style==='grove'){
   art=`<g transform="${winter?'translate(12 18) scale(.55)':'translate(31 8) scale(.72)'}">${path(winterTree)}</g>${path(winterTree)}`+path('M9 46q10-3 18-1m5-1 16-2')+(winter?snow+path('m14 23 8 6m8-9 6-4','stroke="#fffdf2" stroke-width="2.5"'):(month===10?crystal:'')+sprig(16,16,.85)+sprig(35,11,.8)+path('M52 8q9-5 15-2m-12 5 8-1','class="wind-lines"'));
 }else if(style==='meadow'){
   art=path('M4 45q17-3 35 0t28-2')+`<g class="wind-stems">${path('M25 44q6-15 6-23m-2 14q-7-2-9-9 8 2 9 9m1-7q5-6 10-6-4 7-10 6 M45 44q-1-9 4-16m-2 7 7-4')}${sprig(31,20,1.25)}${sprig(50,26,.75)}</g>`+path('M3 13q8-4 15-3m-10 8 8-2m35-8q7-3 14-1','class="wind-lines"');
 }else{
   art=path('M3 45q10-6 20-3t19-2q11-5 26-1')+(winter?path('M39 9c-10 4-10 19 1 22 6 2 11 0 14-4-13 3-20-7-15-18Z','fill="#fff2cc"'):path('M31 22c-1-12 16-15 19-4 3 12-17 15-19 4Zm8-18 1-4m12 11 4-3M26 18l-6-1m8 15-3 5m23-5 3 4','fill="#ebbd77"'))+path('m15 8 1 4 4 1-4 1-1 4-1-4-4-1 4-1Zm42 8 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z','class="twinkle"');
 }
 if(style==='orchard' && spring){
   art=`<g class="orchard-bough">${art}</g>`+path('M18 22q-5 3-6 0t6 0Z','class="single-petal" fill="#c97d91" stroke-width=".9"');
 }
 if(style==='meadow'){
   art+=`<g class="grass-tips">${path('M8 45q4-9 2-17m0 9-4-4m4 1 3-6M15 46q6-11 7-17m-4 10-2-4m4 1 4-3','stroke="#71694d"')}</g>`;
 }
 const ground={
   orchard:'M2 49q11-2 20-2m6 1 9-1m18-1 11-2',
   grove:'M2 48q9-2 17-1t16 0q14-3 30-3m-23 4 9-1',
   meadow:'M5 44l-2-5m4 5 2-8m45 7 4-7m-1 6 4-2',
   hound:'M2 46q13-1 22 0m6-1 13-.5m14 0 9-1',
   observatory:'M6 49q12-2 21-1m17-3 18-2'
 };
 return `<svg class="sketch-scene" viewBox="0 0 72 52" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${path(ground[style],'opacity=".6" stroke-width=".9"')}${art}</svg>`;
}

// Letterforms for the twelve month headings, written on a 9 × 14 grid.
const monthAlphabet={
 A:'M0 13 3.9 1 5 1 9 13m-7-4 5-.3',B:'M1 13 1.5 1q8-2 6 3-1 2-6 3 8-2 7 3-1 4-7 3',
 C:'M8 2q-7-4-7 6 0 7 7 4',D:'M1 13 1.6 1q8-1 7 6t-7.6 6',E:'M8 1l-7 .4L.6 13l8-.7M1 7l5-.4',
 F:'m1 13 .6-12L9 .8M2 7l4-.4',G:'M8 2Q2-1 1 6t4 7l3-1 .2-5-4 .5',
 H:'M1 1 .6 13M8 1l.4 12M1 7l7-.6',I:'M2 1h5M5 1l-.5 12M2 13l5-.3',
 J:'M4 1l5-.3m-2 0-.5 9q-1 6-6 2',L:'M1.8 1 1 13l7-.3',M:'M.5 13 1.5 1l3.3 7L8.5 1l.5 12',
 N:'M1 13 1.5 1 8 12.5 8.6 .8',O:'M4.6 1Q0 1 1 9t6.7 2Q11-1 4.6 1Z',
 P:'M1 13 1.4 1q8-2 7 3T1 7',R:'M1 13 1.4 1q8-2 7 3T2 7l7 6',
 S:'M8 2Q2-1 1.3 3.5T5.5 7q5 2 2 5t-7-.3',T:'M0 1.5 9 1M4.7 1l-.3 12',
 U:'M1 .9.8 9q0 5 4 4t3.6-6L9 1',V:'M.5 1 4 13l1-.2L9 1',
 Y:'M0 1l4.5 6L9 1M4.5 7l-.3 6'
};
function inkMonth(name){
 return `<svg aria-hidden="true" class="ink-month" viewBox="-1 -1 ${name.length*12+1} 17" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round" stroke-linecap="round">${Array.from(name.toUpperCase(),(c,i)=>`<path transform="translate(${12*i} ${[.2,0,.5,-.15][i%4]}) rotate(${[-2,1,-1,2][i%4]} 4 7)" d="${monthAlphabet[c]}"/>`).join('')}</svg>`;
}
