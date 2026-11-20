// Each exposure is drawn in sheet coordinates. The punched margin is the
// origin, not the top of the calendar. The first number places that margin
// along the fixed wire; the hem and the rolled corner are drawn relative to it.
// Positive holds face the reader, negative hems show the reverse of the leaf.
const binderCels=[
  {travel:0, gap:-4, print:1, hold:55, hem:'L300 190Q299 197 290 200H0', roll:'M289 200Q298 197 300 190Q301 198 289 200Z'},
  {travel:.008, gap:-4, print:1, hold:52, hem:'L300 177Q293 196 276 200H0', roll:'M275 200Q294 193 300 177Q302 194 286 199Z'},
  {travel:.02, gap:-4, print:.985, hold:52, hem:'L300 159C285 184 264 197 238 199Q105 201 0 199', roll:'M238 199Q280 182 292 153Q298 153 300 159Q295 180 266 194Z', ink:'M272 185Q283 176 288 165'},
  {travel:.049, gap:-3.8, print:.947, hold:49, hem:'L300 133C284 161 230 188 180 194Q73 201 0 195', roll:'M164 195C211 185 265 150 277 121Q291 124 300 133C282 164 219 191 164 195Z', ink:'M258 148Q270 133 273 127'},
  {travel:.087, gap:-3.6, print:.86, hold:49, hem:'L300 104C258 147 165 180 89 183Q31 187 0 181', roll:'M73 183C136 172 222 126 247 86Q283 93 300 104C254 150 155 182 73 183Z', ink:'M220 119Q233 105 241 93'},
  {travel:.139, gap:-3, print:.715, hold:46, hem:'L300 78C243 118 129 153 51 153Q19 154 0 149', roll:'M0 149Q135 133 204 61Q262 58 300 78C236 123 110 159 0 149Z', ink:'M173 92Q191 74 198 68M237 66l21 3'},
  {travel:.20, gap:-2.4, print:.535, hold:44, hem:'L300 54Q183 114 49 116Q18 117 0 110', roll:'M0 110Q82 90 149 38C207 28 263 36 300 54Q131 135 0 110Z', ink:'M120 62l19 -17M186 36q23 -2 37 0'},
  {travel:.259, gap:-1.8, print:.35, hold:41, hem:'L300 33Q168 83 43 75Q20 75 0 69', roll:'M0 69Q50 53 94 22C168 6 248 12 300 33Q130 98 0 69Z', ink:'M64 42l20 -15M151 15q23 -3 51 -1'},
  {travel:.323, gap:-1, print:.19, hold:39, hem:'L300 15Q169 48 45 38Q18 36 0 31', roll:'M0 31Q35 19 58 6Q197 -15 300 15Q150 54 0 31Z', ink:'M22 25l20 -10M99 2q23 -3 49 -4'},
  {travel:.384, gap:-.45, print:.052, hold:37, hem:'L300 4Q166 15 44 10Q20 8 0 6', roll:'M0 6Q39 -4 57 -8Q192 -28 300 4Q153 21 0 6Z', ink:'M77 -10q36 -7 68 -6'},
  // The free edge crosses the punched edge here. The margin rolls over and
  // the unprinted side faces forward. The whole width remains on the rings.
  {travel:.446, gap:.65, hold:40, hem:'L300 -5C235 -22 139 -31 51 -22Q24 -19 0 -13', ink:'M23 -14Q80 -29 137 -24'},
  {travel:.508, gap:1.25, hold:41, hem:'L300 -15Q182 -42 72 -33Q31 -31 0 -24', ink:'M17 -23Q65 -36 117 -33'},
  {travel:.568, gap:1.7, hold:43, hem:'L300 -24C211 -43 94 -49 0 -34', ink:'M12 -31Q57 -40 103 -40M226 -31l41 7'},
  {travel:.622, gap:2.1, hold:49, hem:'L300 -32Q156 -57 0 -40', ink:'M17 -37Q64 -44 102 -44M233 -37l41 6'},
  {travel:.677, gap:2.35, hold:55, hem:'L300 -38C209 -52 91 -56 0 -44', ink:'M16 -41Q58 -48 113 -47'},
  {travel:.723, gap:2.5, hold:65, hem:'L300 -41Q146 -60 0 -45', ink:'M20 -43Q68 -50 121 -49'},
  {travel:.765, gap:2.6, hold:57, hem:'L300 -39Q152 -56 0 -43', ink:'M24 -41Q74 -47 124 -47', rear:true},
  {travel:.813, gap:2.5, hold:49, hem:'L300 -33C195 -46 81 -51 0 -38', ink:'M25 -36Q69 -42 109 -42', rear:true},
  {travel:.87, gap:2.3, hold:47, hem:'L300 -24Q148 -40 0 -29', ink:'M29 -28Q78 -34 115 -33', rear:true},
  {travel:.922, gap:2.2, hold:46, hem:'L300 -16Q163 -28 0 -21', ink:'M33 -20Q73 -23 117 -22', rear:true},
  {travel:.961, gap:2.1, hold:45, hem:'L300 -8Q154 -18 0 -12', ink:'M39 -12Q76 -15 112 -14', rear:true},
  {travel:.988, gap:2, hold:46, hem:'L300 -5Q157 -12 0 -7', rear:true},
  {travel:1, gap:2, hold:46, hem:'L300 -2Q154 -5 0 -3', rear:true}
];

const concertinaEditions = {bellows:'Concertina', linen:'Concertina · Blue linen', kraft:'Concertina · Field notes',
  ...Object.fromEntries(Object.entries(calendarBindings).map(([key,{label}])=>[key,label]))};
const isConcertina = style => Object.hasOwn(concertinaEditions,style);

// The rear feet live on the cover, the front wires sit above the leaf,
// and the traveling holes are printed on the turning sheet.
const binderStations=[16,50,84];
function binderRow(part){
  const track='M8.7 36C12.1 34.3 13.9 27.6 14.5 20.6C15.2 14.5 15.5 5.2 10.8 1.9Q9 .5 7.3 1.9C1.9 4.4 1 13 2.8 16';
  const wire='M4.6 4.9Q5.6 2.9 7.3 1.9Q9 .5 10.8 1.9C15.5 5.2 15.2 14.5 14.5 20.6C13.9 27.6 12.1 34.3 8.7 36';
  const art={
    feet:`<ellipse cx="2.8" cy="16.1" rx="3.55" ry="1.95" fill="#605d50"/>
      <path d="M2.8 16C1 13 1.9 4.4 7.4 1.9Q9 .9 10.8 1.9" fill="none" stroke="#4b4a42" stroke-width="3"/>
      <path d="M2.8 15.8Q1.4 5.3 7.3 2.2" fill="none" stroke="#9d9e8e" stroke-width="1.35"/>`,
    punches:`<ellipse cx="8.7" cy="36" rx="3.65" ry="2.2" fill="#4b463c" stroke="#e6dac1" stroke-width="1"/>`,
    wires:`<path class="ring-track" d="${track}" fill="none" stroke="none"/>
      <path d="${wire}" fill="none" stroke="#484741" stroke-width="3.3"/>
      <path d="${wire}" fill="none" stroke="#c3c2af" stroke-width="1.55"/>
      <path d="M8 1.8Q10.2 1 12 4.5M14.5 12.3Q15 19 13.4 24.2" fill="none" stroke="#f6f0db" stroke-width=".85"/>`,
    threads:`<g class="threaded-wire" fill="none"><path d="${track}" pathLength="1" stroke="#484741" stroke-width="3.3"/><path d="${track}" pathLength="1" stroke="#c3c2af" stroke-width="1.55"/></g>`,
    eyelets:'<ellipse class="traveling-punch" rx="3.3" fill="none" stroke="#817963" stroke-width="1"/>'
  };
  return `<div class="binder-row binder-${part}" aria-hidden="true">${binderStations.map(left=>
    `<svg style="left:${left}%" viewBox="0 0 20 42" stroke-linecap="round">${art[part]}</svg>`).join('')}</div>`;
}

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

function turnConcertina(stack,oldPaper,forward,oldStock,oldBinding) {
  const paper=stack.querySelector(':scope > .folio-paper');
  const binding=stack.previousElementSibling;
  const newBinding=getComputedStyle(binding).backgroundColor;
  const pad=stack.closest('.teaching-pad');
  const layer=document.createElement('div');
  layer.className='turn-cels concertina-turn';
  layer.inert=true;
  layer.setAttribute('aria-hidden','true');
  const id='binder-leaf-'+(++turnConcertina.serial);
  layer.innerHTML=`<div class="leaf-ground"></div>
    <svg class="binder-sheet" preserveAspectRatio="none" aria-hidden="true">
      <defs><clipPath id="${id}"><path clip-rule="evenodd"/></clipPath></defs><path class="bound-stock" fill-rule="evenodd"/>
    </svg>
    <div class="leaf-face"></div>
    <svg class="binder-pencil" preserveAspectRatio="none" aria-hidden="true">
      <path class="binder-roll"/><path class="binder-grain"/>
    </svg>`+binderRow('eyelets')+binderRow('threads');
  const leaf=forward?oldPaper:paper.cloneNode(true);
  const ground=layer.querySelector('.leaf-ground');
  oldPaper.removeAttribute('aria-live');
  if(!forward){
    ground.style.backgroundColor=oldStock;
    ground.append(oldPaper);
    ground.insertAdjacentHTML('beforeend',binderRow('punches'));
  }
  layer.style.setProperty('--leaf-stock',forward?oldStock:getComputedStyle(stack).backgroundColor);
  const face=layer.querySelector('.leaf-face');
  face.style.clipPath=`url(#${id})`;
  face.append(leaf);
  stack.append(layer);

  const track=stack.querySelector('.binder-wires .ring-track');
  const wireLength=track.getTotalLength();
  const stock=layer.querySelector('.bound-stock');
  const clip=layer.querySelector('clipPath path');
  const roll=layer.querySelector('.binder-roll');
  const grain=layer.querySelector('.binder-grain');
  const rows=layer.querySelectorAll('.traveling-punch');
  const travelingHoles=layer.querySelector('.binder-eyelets');
  const frontWires=layer.querySelectorAll('.threaded-wire');
  const paperSvg=layer.querySelector('.binder-sheet');
  const inkSvg=layer.querySelector('.binder-pencil');
  const ringBox=stack.querySelector('.binder-wires');
  const pageBox=stack.getBoundingClientRect();
  const scaleX=pageBox.width/300;
  const sheetHeight=pageBox.height;
  const clipHeight=binding.offsetHeight;
  const headroom=pageBox.top-pad.querySelector('.calendar-heading').getBoundingClientRect().bottom-4;

  function draw(index){
    if(!layer.isConnected)return;
    if(index===binderCels.length || motionPreference.matches){
      clearFlipExposure(pad);
      binding.style.removeProperty('background-color');
      layer.remove();return;
    }
    const cel=binderCels[forward?index:binderCels.length-1-index];
    // Arc length chooses the contact on the drawn wire. It never generates
    // a pose. The silhouette, projection and exposure above are authored.
    const contact=track.getPointAtLength(cel.travel*wireLength);
    const axis=ringBox.offsetTop+contact.y;
    const edge=axis+cel.gap;
    const sy=cel.print ? (sheetHeight-axis)/200 : Math.min(1,(headroom+axis)/52);
    const place=`translate(0 ${axis}) scale(${scaleX} ${sy})`;
    // Cut the actual paper and printed face. Metal behind the leaf is visible
    // through these slots; only the wire up to the contact lies above the leaf.
    const ry=Math.max(.5,Math.min(1.95,Math.abs(cel.gap)*.52));
    const slots=binderStations.map(station=>{
      const x=station*3+(contact.x-10)/scaleX, rx=3.3/scaleX;
      return `M${x-rx} 0a${rx} ${ry/sy} 0 1 0 ${2*rx} 0a${rx} ${ry/sy} 0 1 0 ${-2*rx} 0Z`;
    }).join('');
    const outline=`M0 ${cel.gap/sy} H300 ${cel.hem} Z`+slots;
    for(const svg of [paperSvg,inkSvg]){
      svg.setAttribute('viewBox',`0 0 ${pageBox.width} ${sheetHeight}`);
      svg.style.clipPath=cel.rear ? `inset(-150px 0 calc(100% + ${clipHeight}px))` : '';
    }
    for(const path of [stock,clip]){
      path.setAttribute('d',outline);
      path.setAttribute('transform',place);
    }
    roll.setAttribute('transform',place);
    grain.setAttribute('transform',place);
    roll.setAttribute('d',cel.roll || '');
    grain.setAttribute('d',cel.ink || '');
    stock.classList.toggle('verso',!cel.print);
    face.hidden=!cel.print;
    if(cel.print)leaf.style.transform=`translateY(${edge}px) scaleY(${cel.print})`;
    for(const hole of rows){
      hole.setAttribute('cx',contact.x);
      hole.setAttribute('cy',contact.y);
      hole.setAttribute('ry',ry);
    }
    travelingHoles.hidden=Boolean(cel.rear);
    for(const wire of frontWires){
      wire.setAttribute('stroke-dasharray',`${Math.min(.77,cel.travel+.025)} 2`);
    }
    const landed=forward?cel.travel:1-cel.travel;
    binding.style.backgroundColor=`color-mix(in srgb,${oldBinding} ${(1-landed)*100}%,${newBinding})`;
    showFlipExposure(layer,index,binderCels.length,cel.hold,draw);
  }
  draw(0);
}
turnConcertina.serial=0;
