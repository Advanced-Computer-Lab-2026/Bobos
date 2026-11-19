// Each drawing is the fold from left to right, then the free edge coming back.
// The print scale is a separate exposure: the lettering foreshortens as the
// page lifts, while the last few millimetres at the spine stay registered.
const concertinaTurns = [
  // hold, print height, start of fold, fold contour, returning edge, pencil marks
  [38,1,'300 200','','',''],
  [35,1,'286 200','Q297 197 300 186','Q301 199 286 200Z',''],
  [42,1,'270 200','Q287 195 300 172','Q304 192 286 198Q278 201 270 200Z','M291 193l5-6'],
  [38,.998,'244 200','Q280 191 300 151','Q307 179 282 193Q262 201 244 200Z','M281 190q11-6 16-17'],
  [35,.99,'205 198','Q263 187 300 132','Q310 165 282 185Q251 201 205 198Z','M276 183q15-9 20-23'],
  [32,.96,'152 192','Q245 182 300 112','Q314 146 284 172Q242 200 152 192Z','M254 181q25-9 38-25'],
  [34,.90,'82 180','Q213 178 300 96','Q314 134 283 159Q217 205 82 180Z','M162 187q21 3 44-1m60-19q18-10 26-23'],
  [32,.81,'0 162','Q177 173 300 79','Q315 117 279 147Q173 215 0 162Z','M54 173q33 9 71 10m133-25q22-11 34-30'],
  [32,.70,'0 140','Q164 156 300 62','Q315 102 278 133Q171 208 0 153Q-1 146 0 140Z','M25 157q35 15 78 18m151-29q22-11 34-28'],
  [33,.57,'0 114','Q162 137 300 48','Q315 90 274 122Q161 201 0 140Q-2 126 0 114Z','M17 141q32 15 71 21m153-22q25-12 39-27'],
  [31,.43,'0 86','Q148 117 300 34','Q316 76 271 112Q151 191 0 124Q-3 106 0 86Z','M14 123q30 16 62 23m154-15q23-11 38-23'],
  [32,.30,'0 60','Q135 92 300 23','Q316 65 267 101Q142 179 0 107Q-3 84 0 60Z','M12 104q27 18 60 25m141-6q23-9 40-21'],
  [36,.19,'0 38','Q124 64 300 13','Q315 54 262 89Q132 164 0 88Q-3 64 0 38Z','M11 84q23 18 57 27m129-2q25-8 43-19'],
  [34,.095,'0 19','Q121 39 300 6','Q312 44 258 76Q123 144 0 68Q-3 45 0 19Z','M9 63q23 19 55 26m112 4q27-6 44-15'],
  [33,.035,'0 7','Q128 17 300 1','Q308 32 251 61Q113 121 0 48Q-3 27 0 7Z','M8 43q19 17 47 26m109 6q22-3 41-11'],
  [35,0,'0 0','Q108 4 300 -2','Q305 23 243 46Q102 96 0 30Q-2 15 0 0Z','M7 26q15 14 39 23m98 8 31-5'],
  [36,0,'0 0','Q125 -7 300 -3','Q301 13 234 32Q91 73 0 16Q-2 7 0 0Z','M8 16q13 10 30 16'],
  [37,0,'0 0','Q117 -13 300 -4','Q292 9 221 20Q82 50 0 7Z','M8 8q13 8 28 12'],
  [39,0,'0 0','Q128 -18 300 -5','Q280 4 209 12Q78 29 0 2Z','M9 4q14 5 32 8'],
  [40,0,'0 0','Q122 -19 300 -5','Q255 0 197 5Q77 14 0 0Z',''],
  [44,0,'0 0','Q127 -15 300 -4','Q239 -2 189 1Q74 5 0 0Z',''],
  [45,0,'0 0','Q146 -10 300 -2','Q169 -1 0 0Z',''],
  [40,0,'0 0','Q155 -5 300 -1','Q171 -1 0 0Z','']
];

const concertinaEditions = {bellows:'Concertina', linen:'Concertina · Blue linen', kraft:'Concertina · Field notes'};
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

function turnConcertina(stack, oldPaper, forward, oldStock, oldBinding) {
  const paper=stack.querySelector(':scope > .folio-paper');
  const binding=stack.previousElementSibling;
  const newBinding=getComputedStyle(binding).backgroundColor;
  const layer=document.createElement('div');
  layer.className='turn-cels concertina-turn';
  layer.inert=true;
  layer.setAttribute('aria-hidden','true');
  const id='concertina-fold-'+(++turnConcertina.serial);
  layer.innerHTML='<div class="leaf-ground"></div><div class="leaf-face"></div>'+
    `<svg viewBox="0 0 300 200" preserveAspectRatio="none" fill="none" aria-hidden="true"><defs><clipPath id="${id}" clipPathUnits="objectBoundingBox"><path transform="scale(.003333333333 .005)"/></clipPath></defs><path class="leaf-back"/><path class="leaf-crease"/></svg>`;
  const face=layer.querySelector('.leaf-face');
  const ground=layer.querySelector('.leaf-ground');
  const leaf=forward ? oldPaper : paper.cloneNode(true);
  const stock=forward ? oldStock : getComputedStyle(stack).backgroundColor;
  layer.style.setProperty('--leaf-stock',stock);
  oldPaper.removeAttribute('aria-live');
  if(!forward){ground.style.backgroundColor=oldStock;ground.append(oldPaper);}
  face.style.clipPath=`url(#${id})`;
  face.append(leaf);
  stack.append(layer);
  const clip=layer.querySelector('clipPath path');
  const back=layer.querySelector('.leaf-back');
  const crease=layer.querySelector('.leaf-crease');
  function draw(n){
    if(!layer.isConnected)return;
    if(n===concertinaTurns.length || motionPreference.matches){
      binding.style.removeProperty('background-color');
      layer.remove();return;
    }
    const k=forward?n:concertinaTurns.length-1-n;
    const [hold,scale,start,fold,edge,marks]=concertinaTurns[k];
    const [left,y]=start.split(' ').map(Number);
    // A local corner peel first; once the left edge lifts, the full sheet bends.
    const fixedLeft=left>0?`L0 ${200*scale}L${start}`:`L0 ${y}`;
    clip.setAttribute('d',`M0 0${fixedLeft}${fold}L300 0Z`);
    face.hidden=scale===0;
    leaf.style.transform=`scaleY(${scale})`;
    back.setAttribute('d',edge?`M${start}${fold}${edge}`:'');
    crease.setAttribute('d',marks);
    binding.style.backgroundColor=(forward?k<14:k>=14)?oldBinding:newBinding;
    setTimeout(()=>draw(n+1),hold);
  }
  draw(0);
}
turnConcertina.serial=0;
