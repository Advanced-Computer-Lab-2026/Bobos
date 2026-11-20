// The drawing board is the resting sheet, 300 × 200, with the binding at y=0.
// Each exposure has its own silhouette, folded-back flap, graphite and rolled lip.
// Three registration lines describe where the printed middle and foot fall at
// the left, centre and right of the sheet. Every exposure is held as drawn.
const concertinaCels = {
  flat: {
    face:'M0 0H300V200H0Z'
  },
  nick: {
    face:'M0 0H300V187Q298 197 286 200H0Z',
    back:'M286 200Q297 197 300 186Q301 199 286 200Z'
  },
  dogear: {
    face:'M0 0H300V173Q292 194 270 200H0Z',
    back:'M270 200Q287 195 300 172Q304 192 286 198Q278 201 270 200Z',
    ink:'M291 193l5-6'
  },
  tug: {
    face:'M0 0H300V151C291 178 264 196 244 200H0Z',
    back:'M244 200Q280 191 300 151Q307 179 282 193Q262 201 244 200Z',
    ink:'M281 190q11-6 16-17'
  },
  peel: {
    cast:'M211 199C245 197 286 178 299 151Q295 175 257 192Q239 199 211 201Z',
    face:'M0 0H300L300 145C298 165 267 186 231 194Q216 199 194 200H0Z',
    back:'M194 200C228 198 268 173 279 150Q285 140 285 127C297 134 302 139 300 148C296 171 252 198 217 199Z',
    lip:'M285 127Q298 132 300 144Q299 154 292 162Q302 144 285 130Z',
    ink:'M272 162q7-9 9-18m10 11-4 6',
    register:[100,100,97,200,200,190]
  },
  hook: {
    cast:'M147 200C207 194 282 159 301 123Q299 144 276 163Q223 201 147 202Z',
    face:'M0 0H300L301 122C291 154 222 194 163 199Q96 201 0 200Z',
    back:'M124 200C171 197 217 178 245 147C257 133 268 108 266 99C282 102 297 110 301 122C300 148 238 185 182 196Q152 201 124 200Z',
    lip:'M266 99Q292 102 301 122Q298 134 286 145Q300 124 290 116Q282 108 266 103Z',
    ink:'M249 142q10-14 12-28m22 34-8 7M160 197l16-3',
    register:[100,99,91,200,197,177]
  },
  gather: {
    cast:'M68 199C167 194 264 149 301 94Q302 114 271 141C211 187 123 203 68 201Z',
    face:'M0 0H300L301 93C287 125 229 167 140 189Q79 202 0 197Z',
    back:'M33 198C105 199 179 172 213 125C231 101 241 80 239 66Q272 68 293 83Q300 88 301 93C296 123 229 168 140 189Q83 201 33 198Z',
    lip:'M239 66Q271 68 293 83L301 93Q297 106 289 113Q292 96 281 88Q264 75 239 70Z',
    ink:'M213 123q14-22 19-39m28-9q9 2 15 6M110 191q30-6 47-14',
    register:[99,97,84,198,187,153]
  },
  belly: {
    cast:'M0 180C103 190 253 135 301 67Q299 89 263 118C200 168 88 193 0 184Z',
    face:'M0 0H300L301 66C278 99 215 148 128 169Q61 188 -1 180Z',
    back:'M-1 180C65 178 143 151 179 106C204 76 211 47 210 34C248 35 285 47 301 66C281 100 211 149 128 169Q58 188 -1 180Z',
    lip:'M210 34Q268 34 301 66Q298 74 289 81C287 64 254 45 211 39Z',
    ink:'M179 105q17-21 23-43m22-23 16 2M21 179q24-1 49-8m178-54 17-12',
    register:[97,89,72,186,163,123]
  },
  sweep: {
    cast:'M0 148C101 160 245 106 301 43Q295 67 250 98C169 145 75 161 0 153Z',
    face:'M.4 0H300L301 43C263 83 201 117 115 138Q49 155 -2 148Q1.5 83 .4 0Z',
    back:'M-2 148C53 132 98 112 139 75C167 49 174 16 176 5C229 5 274 19 301 43C264 83 201 118 115 138Q47 154 -2 148Z',
    lip:'M176 5Q257 4 301 43Q296 50 284 58C285 44 245 17 178 10Z',
    ink:'M144 67q17-18 24-42m17-16 22 1M16 145q25-3 43-9m169-50 25-13',
    register:[87,75,54,159,130,90]
  },
  swing: {
    cast:'M0 108C99 120 239 68 301 23Q293 41 253 67C176 106 69 123 0 113Z',
    face:'M1.4 0H300L301 23C264 52 201 85 111 102Q43 115 .3 108Q3 54 1.4 0Z',
    back:'M.3 108C37 87 87 57 109 30Q131 2 136 -16C203 -20 265 -1 301 23C260 55 197 85 111 102Q46 115 .3 108Z',
    lip:'M136 -16C199 -21 262 -4 301 23L286 33C273 12 205 -11 135 -11Z',
    ink:'M92 47q22-21 32-42m30-19 18 0M17 106q27-4 52-12m169-41 23-12',
    register:[67,51,35,115,94,57]
  },
  crest: {
    cast:'M0 68Q135 85 300 9Q296 20 265 35C174 73 62 84 0 72Z',
    face:'M3.6 0Q20 1 43 0H300V9C252 31 192 54 108 66Q39 76 1.8 68Q5.6 36 3.6 0Z',
    back:'M1.8 68Q36 43 68 7Q86 -11 97 -32C172 -43 256 -21 300 9C250 35 184 57 108 66Q38 76 1.8 68Z',
    lip:'M97 -32C169 -42 247 -24 300 9L285 16C259 -8 169 -34 96 -27Z',
    ink:'M58 20q13-15 21-27m39-24q19-3 35-2M18 67q30 0 59-6m151-25 20-9',
    register:[42,28,16,76,54,28]
  },
  crown: {
    cast:'M0 32C86 50 216 29 300 0Q262 22 194 36Q62 54 0 35Z',
    face:'M6 2Q24 3 55 0H292C226 20 150 34 86 37Q36 41 4.5 32Q7.5 16 6 2Z',
    back:'M4.5 32Q27 13 54 -24Q60 -33 65 -40C144 -56 242 -38 299 -1C224 26 145 38 78 38Q30 40 4.5 32Z',
    lip:'M65 -40C145 -55 240 -38 299 -1L283 5C247 -21 145 -48 64 -35Z',
    ink:'M29 7q13-13 22-28m28-17q20-5 42-6M24 33q28 2 54-1m145-17 13-4',
    register:[22,11,3,39,20,4]
  },
  cross: {
    cast:'M0 6Q116 24 263 0Q204 17 132 19Q41 20 0 8Z',
    face:'M8 3Q31 4 65 0H201Q112 15 49 12Q21 11 7.5 8Z',
    back:'M7.5 8Q19 0 27 -18Q34 -33 41 -43C129 -61 225 -46 297 -9C230 7 124 16 47 12Q23 12 7.5 8Z',
    lip:'M41 -43C137 -60 229 -45 297 -9L278 -5C219 -36 119 -53 40 -38Z',
    ink:'M17 -8q10-12 15-24m33-10q28-5 53-5M47 9q20 2 38 0',
    register:[7,2,0,15,5,0]
  },
  hinge: {
    back:'M9.5 .6C11.5 -10 19 -30 26 -40C108 -59 219 -48 296 -13Q225 -4 151 -1Q64 4 12.5 2.1Z',
    lip:'M26 -40C128 -62 232 -43 296 -13L281 -11C212 -40 119 -51 25 -35Z',
    ink:'M15 -13l6-14m27-14q28-5 51-5M226 -28q16 4 27 9'
  },
  // The last drawings use binding coordinates: 0 is the TOP seam and
  // 28 is the bottom. The right corner crosses last, then falls away behind.
  loosen: {
    rim:'M10.5 27.8Q12.5 18 23.5-4C100-20 222-13.5 296.5 16Q225 23.7 154 26.6Q58 31 10.5 27.8Z',
    ridge:'M24-3.5Q100-18 171-11M15 26.8q31 2.1 55 .3'
  },
  over: {
    rim:'M12 24Q16 12 24 1C81-11 196-10 260 3Q281 7 297 13Q199 13 98 22Q44 27 12 24Z',
    ridge:'M24 1C93-12 205-7 264 5M15 23q32 1 58-3'
  },
  crestOver: {
    rim:'M14 15Q17 5 23-1.1C83-12 201-11 266-.2Q288 4 298 8Q212 6 133 10Q46 18 14 15Z',
    ridge:'M18-1Q104-12 192-7m46 2 29 4'
  },
  clearLeft: {
    rim:'M17 4Q20-2 26-4C88-13 211-11 265-4Q290-.6 299 4Q243 2 181 3Q80 7 17 4Z',
    ridge:'M23-4q59-8 108-6m106 4q25 1 43 5'
  },
  tipOver: {
    rim:'M20-.4Q25-6 34-7C125-15 220-10 267-5Q288-3 298 .8Q261-.6 213-.5Q96 2 20-.4Z',
    ridge:'M30-6Q84-13 154-10'
  },
  drop: {
    rear:'M23 4Q29-3 40-6C108-12 211-10 264-4Q288-2 296 3L296 8H23Z',
    ridge:'M40-6q52-5 91-4'
  },
  tuck: {
    rear:'M18 6Q49 1 78-3C129-9 208-9 255-4Q278-2 294 3V9H18Z',
    ridge:'M108-5q50-6 100-2'
  },
  glint: {
    rear:'M62 6Q98 3 139-.8Q192-7 237-3.8Q267-2 290 2V8H62Z',
    ridge:'M164-2q33-4 62-1'
  },
  slip: {
    rear:'M145 5Q172 2 201-.8Q231-4 262-.6L285 3V7H145Z'
  },
  restEdge: {
    rear:'M194 4q23-4 51-4.7 18 .4 32 2.7v4Z'
  },
  // On the return the bowed lower edge lands first at the left. The lifted
  // right corner hesitates for a beat before the familiar little closing cels.
  land: {
    cast:'M181 199Q273 184 301 138Q295 166 267 180Q228 199 181 200Z',
    face:'M0 0H300L301 138C291 170 231 194 173 199Q69 202 0 200Z',
    back:'M158 200C208 194 252 161 269 125Q275 112 275 109Q295 117 301 138C296 164 242 191 186 198Z',
    lip:'M275 109Q295 116 301 138L297 148Q296 129 275 113Z',
    ink:'M251 155q12-14 17-27m-67 64 10-3',
    register:[100,100,92,200,198,182]
  },
  bounce: {
    cast:'M237 200Q288 186 300 158Q296 183 273 192Q253 200 237 201Z',
    face:'M0 0H300V158C289 181 259 197 226 200H0Z',
    back:'M226 200Q264 192 286 151Q288 145 288 143Q298 146 300 158Q295 186 250 197Z',
    lip:'M288 143Q303 150 300 160L297 166Q299 155 288 147Z',
    ink:'M278 169l6-10',
    register:[100,100,99,200,200,196]
  }
};

const concertinaLift = [
  ['nick',34],['dogear',38],['tug',35],['peel',41],['hook',43],['gather',39],
  ['belly',37],['sweep',33],['swing',33],['crest',33],['crown',37],['cross',38],
  ['hinge',31],['loosen',28],['over',32],['crestOver',36],['clearLeft',36],['tipOver',42],['drop',47],['tuck',46],['glint',44],['slip',47],['restEdge',40]
];
const concertinaLower = [
  ['restEdge',31],['slip',34],['glint',34],['tuck',36],['drop',38],['tipOver',38],['clearLeft',34],['crestOver',32],['over',31],['loosen',28],['hinge',34],['cross',39],
  ['crown',36],['crest',34],['swing',32],['sweep',32],['belly',34],['gather',37],
  ['land',43],['bounce',43],['tug',36],['dogear',43],['nick',48],['flat',38]
];

const concertinaEditions = {bellows:'Concertina', linen:'Concertina · Blue linen', kraft:'Concertina · Field notes',
  ...Object.fromEntries(Object.entries(calendarBindings).map(([key,{label}])=>[key,label]))};
const isConcertina = style => Object.hasOwn(concertinaEditions,style);

function holdMarginDrawing(paper){
  // A spent growth cel is no longer in getAnimations(). Capture the ink
  // actually on screen before moving the sheet into the turning layer.
  const nodes=paper.querySelectorAll('.season-drawing,.season-drawing *,.sketch-scene,.sketch-scene *');
  const poses=Array.from(nodes,el=>{
    const css=getComputedStyle(el);
    return [el,css.opacity,css.visibility,css.transform];
  });
  for(const [el,opacity,visibility,transform] of poses){
    Object.assign(el.style,{animation:'none',opacity,visibility,transform});
  }
}

// Bend the actual type, deadline rings and seasonal illustration with their
// places on the sheet. The three control points run across the paper, never
// through time. Changing the month or viewport keeps the ink registered.
function concertinaPrint(leaf, stack) {
  const box=stack.getBoundingClientRect();
  const elements=leaf.querySelectorAll('.folio-month > strong,.folio-month > small,.season-drawing,.sketch-scene,.folio-days > small,.folio-date');
  const stamps=Array.from(elements,el=>{
    const rect=el.getBoundingClientRect();
    return {el,u:(rect.left+rect.width/2-box.left)/box.width,
      v:(rect.top+rect.height/2-box.top)/box.height,
      original:el.style.transform};
  });
  function across(left,middle,right,u){
    return (1-u)*(1-u)*left+2*u*(1-u)*middle+u*u*right;
  }
  return function registerInk(register){
    if(!register){
      for(const {el,original} of stamps) el.style.transform=original;
      return;
    }
    const [ml,mc,mr,fl,fc,fr]=register;
    for(const {el,u,v,original} of stamps){
      const middle=across(ml,mc,mr,u),foot=across(fl,fc,fr,u);
      const start=4*middle-foot, bend=2*foot-4*middle;
      const y=(start+bend*v)*v;
      const height=Math.max(.035,(start+2*bend*v)/200);
      const midSlope=2*((1-u)*(mc-ml)+u*(mr-mc));
      const footSlope=2*((1-u)*(fc-fl)+u*(fr-fc));
      const slope=((4*midSlope-footSlope)*v+(2*footSlope-4*midSlope)*v*v)*box.height/(200*box.width);
      const rise=(y/200-v)*box.height;
      el.style.transform=`matrix(1,${slope},0,${height},0,${rise}) ${original==='none'?'':original}`;
    }
  };
}

function turnConcertina(stack,oldPaper,forward,oldStock,oldBinding) {
  const paper=stack.querySelector(':scope > .folio-paper');
  const binding=stack.previousElementSibling;
  const newBinding=getComputedStyle(binding).backgroundColor;
  const layer=document.createElement('div');
  layer.className='turn-cels concertina-turn';
  layer.inert=true;
  layer.setAttribute('aria-hidden','true');
  const id='concertina-fold-'+(++turnConcertina.serial);
  const pencilLayer='<path class="leaf-cast"/><path class="leaf-back"/><path class="leaf-lip"/><path class="leaf-crease"/>';
  layer.innerHTML='<div class="leaf-ground"></div><div class="leaf-face"></div>'+
    `<svg viewBox="0 0 300 200" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs><clipPath id="${id}" clipPathUnits="objectBoundingBox"><path transform="scale(.003333333333 .005)"/></clipPath>

      <clipPath id="${id}-above"><rect x="-15" y="-100" width="330" height="100"/></clipPath>
      <clipPath id="${id}-below"><rect x="-15" y="0" width="330" height="215"/></clipPath>
      </defs>
      <g clip-path="url(#${id}-below)">${pencilLayer}</g>
      <g class="leaf-crown"><g clip-path="url(#${id}-above)">${pencilLayer}</g></g>
    </svg><svg class="binding-turn" viewBox="0 -16 300 44" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs><clipPath id="${id}-rear"><rect x="0" y="-16" width="300" height="16"/></clipPath></defs>
      <g class="rim-drawing"><path class="rim-stock"/><path class="rim-pencil"/></g>
    </svg>`;
  const face=layer.querySelector('.leaf-face');
  const ground=layer.querySelector('.leaf-ground');
  const leaf=forward?oldPaper:paper.cloneNode(true);
  const stock=forward?oldStock:getComputedStyle(stack).backgroundColor;
  layer.style.setProperty('--leaf-stock',stock);
  oldPaper.removeAttribute('aria-live');
  if(!forward){ground.style.backgroundColor=oldStock;ground.append(oldPaper);}
  face.append(leaf);
  stack.append(layer);
  const registerInk=concertinaPrint(leaf,stack);
  face.style.clipPath=`url(#${id})`;
  const clip=layer.querySelector('clipPath path');
  const rim=layer.querySelector('.binding-turn');
  rim.style.height=(44/28*binding.offsetHeight)+'px';
  const rimDrawing=rim.querySelector('g');
  const rimStock=rim.querySelector('.rim-stock');
  const rimPencil=rim.querySelector('.rim-pencil');
  const paths=Object.entries({cast:'.leaf-cast',back:'.leaf-back',lip:'.leaf-lip',ink:'.leaf-crease'})
    .map(([part,selector])=>[part,layer.querySelectorAll(selector)]);
  const box=stack.getBoundingClientRect();
  const title=stack.closest('.teaching-pad').querySelector('.calendar-heading').getBoundingClientRect();
  const headroom=box.top-title.bottom-3;
  // Keep the high point in binding units so the hinge and loosen drawings meet
  // at the same height on a wide pad and on a short, narrow one.
  const crownHeight=Math.min(headroom, binding.offsetHeight*1.46);
  const crownScale=Math.max(.05,crownHeight/(box.height*54/200));
  layer.querySelector('.leaf-crown').setAttribute('transform',`scale(1 ${crownScale})`);

  const exposures=forward?concertinaLift:concertinaLower;
  function draw(n){
    if(!layer.isConnected)return;
    if(n===exposures.length || motionPreference.matches){
      binding.style.removeProperty('background-color');
      layer.remove();return;
    }
    const [name,hold]=exposures[n];
    const cel=concertinaCels[name];
    face.hidden=!cel.face;
    if(cel.face){
      clip.setAttribute('d',cel.face);
      registerInk(cel.register);
    }
    for(const [part,strokes] of paths){
      for(const stroke of strokes) stroke.setAttribute('d',cel[part] || '');
    }
    rimStock.setAttribute('d',cel.rim || cel.rear || '');
    rimPencil.setAttribute('d',cel.ridge || '');
    if(cel.rear) rimDrawing.setAttribute('clip-path',`url(#${id}-rear)`);
    else rimDrawing.removeAttribute('clip-path');
    const mix=cel.rim || cel.rear ? 100 : ({swing:14,crest:32,crown:53,cross:73,hinge:89}[name] || 0);
    const landed=forward?mix:100-mix;
    binding.style.backgroundColor=`color-mix(in srgb,${oldBinding} ${100-landed}%,${newBinding})`;
    setTimeout(()=>draw(n+1),hold);
  }
  draw(0);
}
turnConcertina.serial=0;
