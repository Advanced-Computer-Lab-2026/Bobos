const flipRates=[1,.5,.25,.1,.05,.02,0];
const flipRateKey='portal-calendar-flip-rate';
const initialRate=new URLSearchParams(location.search).get('flipSpeed') ?? localStorage.getItem(flipRateKey);
let flipRate=initialRate!==null && flipRates.map(String).includes(initialRate)?Number(initialRate):1;
let pendingExposure;

function showFlipExposure(layer,frame,total,hold,advance){
  const pad=layer.closest('.teaching-pad');
  const counter=pad.querySelector('[data-flip-frame]');
  const caption=`Frame ${frame+1} of ${total}`;
  let remaining=hold, started, rate, timer;

  function schedule(){
    clearTimeout(timer);
    const now=performance.now();
    if(started!==undefined) remaining=Math.max(0,remaining-(now-started)*rate);
    started=now;
    rate=flipRate;
    counter.textContent=rate===1?'':caption;
    if(rate>0) timer=setTimeout(()=>{
      pendingExposure=null;
      if(layer.isConnected) advance();
    },remaining/rate);
  }
  pendingExposure={schedule,cancel:()=>clearTimeout(timer),finish:()=>{
    clearTimeout(timer);
    pendingExposure=null;
    if(layer.isConnected) advance();
  }};
  schedule();
}

function clearFlipExposure(pad){
  pendingExposure?.cancel();
  pendingExposure=null;
  const counter=pad?.querySelector('[data-flip-frame]');
  if(counter) counter.textContent='';
}

// Each exposure sets the angle at the sewn edge and the extra bend at the foot.
// Negative bends let a loose tip trail the sheet, positive bends roll it over.
const paperTurns = {
  flutter: [[0,0],[1,6],[2,13],[3,10],[6,23],[12,35],[23,49],[39,53],[62,38],[88,17],[116,-6],[143,-24],[163,-27],[178,-16],[191,-5],[180,5],[172,8],[178,2],[180,0]],
  snap: [[0,0],[0,2],[0,8],[0,15],[1,23],[1,27],[2,24],[3,32],[6,45],[13,68],[33,81],[70,67],[116,33],[166,-10],[194,-32],[181,-13],[170,9],[177,7],[182,-2],[180,0]],
  tide: [[0,0],[0,8],[2,23],[3,39],[6,51],[10,67],[18,79],[30,86],[44,85],[59,78],[76,67],[94,52],[111,36],[128,21],[144,8],[159,-4],[172,-11],[182,-12],[186,-8],[182,-3],[180,0]],
  bellows: [[0,0],[0,4],[0,10],[1,14],[1,12],[2,20],[3,29],[4,41],[6,48],[9,57],[13,66],[19,69],[26,70],[35,68],[45,64],[57,57],[70,46],[85,35],[101,21],[117,4],[131,-12],[143,-23],[155,-32],[165,-35],[174,-32],[181,-25],[186,-14],[184,-4],[180,6],[177,10],[178,6],[180,2],[180,0]],
  stiff: [[0,0],[1,0],[2,-1],[4,-3],[8,-4],[14,-5],[22,-6],[33,-8],[48,-9],[65,-10],[86,-8],[107,-6],[129,-5],[148,-4],[165,-3],[179,0],[189,4],[183,3],[175,-3],[178,-1],[180,0]],
  night: [[0,0],[0,3],[1,8],[2,6],[3,13],[5,19],[9,29],[16,38],[26,43],[40,45],[56,41],[74,36],[94,23],[115,8],[136,-9],[154,-20],[168,-24],[179,-19],[187,-9],[184,0],[177,7],[175,5],[178,2],[180,0]]
};

function flipAcademicSheet(stack, oldPage, forward, style, previousColors) {
  const paper=stack.querySelector('.folio-paper');
  const frames=paperTurns[style];
  const width=stack.clientWidth, height=stack.clientHeight;
  if (!frames || !width || !height) return;
  const overlay=document.createElement('div');
  overlay.className='turn-cels';
  overlay.inert=true;
  overlay.setAttribute('aria-hidden','true');
  if (!forward) {
    const previous=paper.cloneNode(false);
    previous.className='folio-paper turn-ground';
    previous.innerHTML=oldPage;
    previous.style.background=previousColors[0];
    overlay.append(previous);
  }
  // One copy of the printed face. Reuse it as an SVG texture across curved strips.
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  const source='turn-print-'+(++flipAcademicSheet.serial);
  const count=40;
  const band=height/count;
  const paperColor=forward?previousColors[0]:getComputedStyle(stack).getPropertyValue('--sheet').trim();
  if(forward) overlay.style.setProperty('--verso',previousColors[1]);
  const lines=Array.from({length:count},(_,n)=>
    `<g><svg width="${width}" height="${band+.35}" viewBox="0 ${n*band} ${width} ${band+.35}" preserveAspectRatio="none"><use href="#${source}"/></svg><path fill="var(--verso)"/><path fill="#30293a"/><path fill="none" stroke="var(--pencil)" stroke-width=".75"/></g>`).join('');
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.innerHTML=`<defs><g id="${source}"><rect width="${width}" height="${height}" fill="${paperColor}"/></g></defs><path class="turn-shadow"/>${lines}<path class="turn-edge"/>`;
  // Copy the actual lettering, deadline marks and positions at this viewport size.
  const preview=paper.cloneNode(false);
  preview.className='folio-paper turn-measure';
  preview.innerHTML=forward?oldPage:paper.innerHTML;
  stack.append(preview);
  const box=stack.getBoundingClientRect();
  const print=svg.querySelector('defs g');
  for(const el of preview.querySelectorAll('.folio-month strong,.folio-month small,.folio-days>small,.folio-date b,.deadline-ring,.season-drawing')){
    const rect=el.getBoundingClientRect(), css=getComputedStyle(el);
    const x=rect.left-box.left,y=rect.top-box.top,w=rect.width,h=rect.height;
    const ink=el.matches('svg')?el:el.querySelector('svg');
    if(el.parentElement.matches('[aria-current=date]')){
      const dot=document.createElementNS(ns,'ellipse');
      for(const [key,v] of Object.entries({cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2,fill:css.backgroundColor}))dot.setAttribute(key,v);
      print.append(dot);
    }
    if(ink){
      const r=ink.getBoundingClientRect(), copy=ink.cloneNode(true);
      copy.removeAttribute('class');
      for(const [key,v] of Object.entries({x:r.left-box.left,y:r.top-box.top,width:r.width,height:r.height,fill:'none',stroke:ink===el?getComputedStyle(ink).stroke:css.color,'stroke-width':1.45,'stroke-linecap':'round'}))copy.setAttribute(key,v);
      if(el.classList.contains('season-drawing')){
        copy.setAttribute('stroke',css.color);
        for(const path of copy.children){
          const held=path.classList.contains('cel-4');
          path.removeAttribute('class');path.setAttribute('opacity',held?'1':'0');
        }
      }
      print.append(copy);
    }else{
      const t=document.createElementNS(ns,'text');
      t.setAttribute('x',x+w/2);t.setAttribute('y',y+h/2);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','central');
      t.style.font=css.font;t.setAttribute('fill',css.color);t.textContent=el.textContent;print.append(t);
    }
  }
  preview.remove(); overlay.append(svg);stack.append(overlay);
  const strips=[...svg.children].filter(el=>el.tagName.toLowerCase()==='g');
  const shadow=svg.querySelector('.turn-shadow'), edge=svg.querySelector('.turn-edge');
  function pose(frame){
    if (!overlay.isConnected) return;
    if(frame>=frames.length || motionPreference.matches){clearFlipExposure(stack.closest('.teaching-pad'));overlay.remove();return;}
    const [hinge,curl]=frames[forward?frame:frames.length-frame-1];
    let y=0,z=0,lastX=0,lastY=0;
    const amplitude=Math.sin(hinge*Math.PI/180);
    strips.forEach((group,i)=>{
      const u=(i+.5)/count;
      const pleat=style==='bellows'?Math.sin((u*2.4-hinge/140)*Math.PI)*amplitude*12:0;
      const theta=(hinge+curl*u+pleat)*Math.PI/180;
      y+=Math.cos(theta)*band;z+=Math.sin(theta)*band;
      const depth=1/(1-z/(height*3.9));
      // Behind the top binding the sheet falls down the back of the easel.
      const cameraY=(y-z*.21)*depth;
      const projected=cameraY<0?cameraY*.49*Math.max(0,amplitude):cameraY;
      const spread=(depth-1)*width/2;
      const dy=projected-lastY;
      const [front,back,shade,hatch]=group.children;
      front.style.display=dy>=0?'':'none';
      front.setAttribute('transform',`translate(${-lastX} ${lastY}) scale(${1+2*lastX/width} ${Math.max(.001,dy/band)})`);
      const quad=`M${-lastX} ${lastY} L${width+lastX} ${lastY} L${width+spread} ${projected} L${-spread} ${projected}Z`;
      back.setAttribute('d',dy<0?quad:'');
      shade.setAttribute('d',quad);
      shade.setAttribute('opacity',String(.15*Math.abs(Math.sin(theta))+.045*(1-Math.cos(theta))));
      hatch.setAttribute('d',dy<-.5 && i%5===2?`M${width*.16+i} ${projected}q14 -1 29 -.4m${width*.37} 0 9 .6`:'');
      lastX=spread;lastY=projected;
    });
    edge.setAttribute('d',`M${-lastX} ${lastY}Q${width*.47} ${lastY+amplitude*(frame%2?2:1)} ${width+lastX} ${lastY}`);
    shadow.setAttribute('d',`M0 0H${width}V${Math.max(0,lastY+amplitude*9)}Q${width/2} ${lastY+amplitude*16} 0 ${Math.max(0,lastY)}Z`);
    const hold=style==='snap'&&frame>9&&frame<16?28:frame<3?55:42;
    showFlipExposure(overlay,frame,frames.length,hold,()=>pose(frame+1));
  }
  if (style==='bellows' && forward) {
    // Let the sprout start coming up when the bottom of the old page clears it.
    for(const cel of paper.querySelectorAll('.season-cel')){
      for(const animation of cel.getAnimations()) animation.startTime=document.timeline.currentTime+740;
    }
  }
  pose(0);
}
flipAcademicSheet.serial=0;
