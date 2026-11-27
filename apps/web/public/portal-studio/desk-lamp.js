// The foot, shoulder, shade hinge and switch eyelet are in the drawing's coordinates.
let lampArtwork;
const lampFoot = {x:216, y:621.75};
const lampReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Keep the long sides the same distance apart. Register the corners a
// fraction differently in each drawing, like lifting and replacing a pen.
const inkOutlines = [
  'M9 2Q40 1.7 70 2L147 2.15Q182 1.85 218 2L292 1.9L350 2Q357.8 2 358 9Q358.25 18 358 29L358 39Q357.8 46 350 46L292 45.9L218 46Q182 45.85 147 46.15L70 46Q40 45.7 9 46Q2 46 2 39L2.15 24L2 9Q2.05 2.1 9 2Z',
  'M9 2.15L61 2Q94 1.6 123 2.1L197 2Q232 2.35 266 2.05L318 1.8L350 2.1Q357.5 2.4 358 9.2L357.65 24Q358.4 32 358 39Q357.4 46 350 46.1L318 45.8L266 46.05Q232 46.35 197 46L123 46.1Q94 45.6 61 46L9 46.15Q2.35 45.7 2 39L1.8 29L2.35 15L2.1 9Q2.35 2 9 2.15Z',
  'M9 1.95L45 2.15Q73 2.4 103 1.85L172 2.05L235 2Q268 1.7 303 2.12L350 2Q358.2 2.1 357.8 9L358.3 18L357.9 31L358.1 39Q358 46.25 350 46L303 46.12Q268 45.7 235 46L172 46.05L103 45.85Q73 46.4 45 46.15L9 45.95Q1.8 46.1 2.15 39L2.35 32L1.85 19L2 9Q1.85 2.35 9 1.95Z'
];
const inkContour = '<svg class="ink-contour" viewBox="0 0 360 48" preserveAspectRatio="none" aria-hidden="true">' +
  inkOutlines.map(d => '<path vector-effect="non-scaling-stroke" d="'+d+'"/>').join('')+'</svg>';

// Keep the button corners round at every width.
const buttonInkContour = '<svg class="ink-contour" aria-hidden="true">' +
  [8, 7.5, 8.5].map(radius => `<rect x="1.5" y="1.5" width="100%" height="100%" rx="${radius}"/>`).join('') +
  '</svg>';

function drawInputEdges(form) {
  for (const input of form.querySelectorAll('textarea, input:not([type]), input:is([type=text],[type=email],[type=password],[type=search],[type=number],[type=tel],[type=url],[type=date],[type=time],[type=datetime-local])')) {
    if (input.closest('.ink-field')) continue;
    const wrap = document.createElement('span');
    wrap.className = 'ink-field';
    input.before(wrap);
    wrap.innerHTML = inkContour;
    wrap.append(input);
  }
  for (const control of form.querySelectorAll('main:not([data-screen=overview]) .btn, dialog .btn, .filter-tab')) {
    if (!control.querySelector(':scope > .ink-contour')) control.insertAdjacentHTML('beforeend',control.matches('.btn') ? buttonInkContour : inkContour);
  }
}

// React services mount inside a shadow root, so their controls need to be
// resolved there. Keep the ink outside the control so its hit area stays put.
window.mountPortalControlInk = function (shadow) {
  const events = new AbortController();
  const capture = { capture: true, passive: true, signal: events.signal };
  const selector = 'button, input:not([type=hidden]), select, textarea, a[href]';
  const createRing = (kind) => {
    const ring = document.createElement('span');
    ring.className = 'portal-focus-ring';
    ring.dataset.serviceInk = kind;
    ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML = inkContour;
    return ring;
  };
  const hoverRing = createRing('hover');
  const focusRing = createRing('focus');
  let hovered;
  let focused;
  let frame;

  function place(ring, control, padding) {
    if (!control?.isConnected || !control.getClientRects().length) {
      ring.remove();
      return;
    }
    const rect = control.getBoundingClientRect();
    Object.assign(ring.style, {
      left: `${rect.left - padding}px`,
      top: `${rect.top - padding}px`,
      width: `${rect.width + padding * 2}px`,
      height: `${rect.height + padding * 2}px`,
    });
    if (!ring.isConnected) document.body.append(ring);
  }

  function update() {
    const active = shadow.activeElement;
    const next = active?.matches(`:focus-visible:is(${selector})`) ? active : null;
    if (focused !== next) {
      focused?.removeAttribute('data-service-ink-focus');
      focused = next;
      focused?.setAttribute('data-service-ink-focus', '');
    }
    place(focusRing, focused, 3);
    place(hoverRing, hovered !== focused && hovered?.matches(':hover') ? hovered : null, 1);
  }

  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }

  shadow.addEventListener('pointerover', (event) => {
    hovered = event.pointerType === 'mouse'
      ? event.target.closest(selector)
      : null;
    if (hovered?.matches(':disabled,[aria-disabled=true]')) hovered = null;
    schedule();
  }, capture);
  shadow.addEventListener('pointerout', (event) => {
    if (hovered && !hovered.contains(event.relatedTarget)) {
      hovered = null;
      schedule();
    }
  }, capture);
  for (const event of ['focusin', 'focusout', 'keydown', 'pointerdown', 'scroll', 'change']) {
    shadow.addEventListener(event, schedule, capture);
  }
  window.addEventListener('resize', schedule, capture);
  window.addEventListener('scroll', schedule, capture);

  return () => {
    events.abort();
    cancelAnimationFrame(frame);
    hoverRing.remove();
    focusRing.remove();
    focused?.removeAttribute('data-service-ink-focus');
  };
};

// One outline follows keyboard focus on controls without a built-in ink edge.
{
  const layer = document.createElement('span');
  layer.className = 'portal-focus-ring';
  layer.innerHTML = inkContour;
  layer.setAttribute('aria-hidden', 'true');
  let target;
  let frame;
  const resize = new ResizeObserver(scheduleFocusRing);

  function updateFocusRing() {
    const focused = document.activeElement;
    const next = focused?.matches(':focus-visible:not(#content, #workspace-content, .menu-close, .workspace-menu a)') &&
      !focused.closest('.ink-field,.filter-tab:has(> .ink-contour)') &&
      !focused.matches('.portal-studio[data-workspace] :is(main,dialog) .btn:has(> .ink-contour)')
      ? focused : null;
    if (target !== next) {
      target?.removeAttribute('data-portal-focus');
      resize.disconnect();
      target = next;
      if (target) resize.observe(target);
    }
    if (!target) {
      layer.remove();
      return;
    }
    const dialog = target.closest('dialog[open]');
    const host = dialog || document.body;
    if (layer.parentElement !== host) host.append(layer);
    const anchor = target.matches('.dayoff') ? target.nextElementSibling : target;
    const rect = anchor.getBoundingClientRect();
    const bounds = dialog?.getBoundingClientRect();
    const left = bounds ? bounds.left + dialog.clientLeft - dialog.scrollLeft : 0;
    const top = bounds ? bounds.top + dialog.clientTop - dialog.scrollTop : 0;
    layer.style.left = `${rect.left - left - 3}px`;
    layer.style.top = `${rect.top - top - 3}px`;
    layer.style.width = `${rect.width + 6}px`;
    layer.style.height = `${rect.height + 6}px`;
    target.setAttribute('data-portal-focus', '');
  }

  function scheduleFocusRing() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateFocusRing);
  }

  for (const event of ['focusin','focusout','keydown','pointerdown','scroll','resize']) {
    window.addEventListener(event, scheduleFocusRing, {capture:true, passive:true});
  }
}

async function mountDeskLamp(scene) {
  const form = scene.closest('.auth').querySelector('form');

  const image = scene.querySelector('img');
  try {
    lampArtwork ??= fetch(image.src).then(response => {
      if (!response.ok) throw new Error('Lamp drawing unavailable');
      return response.text();
    });
    const source = await lampArtwork;
    if (!scene.isConnected) return;
    const svg = new DOMParser().parseFromString(source,'image/svg+xml').documentElement;
    if (svg.localName !== 'svg') return;
    svg.removeAttribute('role');
    svg.setAttribute('aria-label','Reading lamp and paper');
    image.replaceWith(svg);
    const actor = svg.querySelector('.lamp-actor');
    const arm = actor.querySelector('.arm');
    const shade = arm.querySelector('.shade');
    const chain = shade.querySelector('.lamp-chain');
    const shadeSwitch = shade.querySelector('.shade-switch');
    shadeSwitch.setAttribute('role','button');
    shadeSwitch.setAttribute('tabindex','0');
    shadeSwitch.setAttribute('aria-label','Toggle light from lampshade');
    let lit = false;
    chain.setAttribute('role','button');
    chain.setAttribute('tabindex','0');
    chain.setAttribute('aria-label','Desk lamp power');
    function power(value) {
      lit=value;
      scene.dataset.lit=String(value);
      chain.setAttribute('aria-pressed',String(value));
      shadeSwitch.setAttribute('aria-pressed',String(value));
    }
    const cord = mountLampCord(scene, chain, () => power(!lit));
    let nodFrame = 0;
    function nodShade() {
      if (scene.dataset.lampArriving) return;
      power(!lit);
      cancelAnimationFrame(nodFrame);
      // The socket moves with the hinged shade. The hanging switch follows a beat later.
      const poses = [[0,3],[40,6],[85,7],[145,4],[200,1],[255,-1.3],[315,-.5],[380,0]];
      const start = performance.now();
      function draw(now) {
        if (!scene.isConnected) return;
        const elapsed = lampReducedMotion.matches ? 380 : now-start;
        let pose = poses[0];
        for (const next of poses) if (next[0] <= elapsed) pose=next;
        shade.setAttribute('transform',`rotate(${pose[1]} 389 282)`);
        cord.followSocket();
        if (elapsed < 380) nodFrame=requestAnimationFrame(draw);
      }
      draw(start);
    }
    shadeSwitch.addEventListener('click',nodShade);
    shadeSwitch.addEventListener('keydown',event=>{
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!event.repeat) nodShade();
    });
    if(lampReducedMotion.matches || !form.querySelector('input[type=email]')) {power(true);cord.followSocket();return;}
    power(false);
    hopToDesk(scene,actor,arm,shade,cord,form,()=>power(true));
  } catch {
    lampArtwork=undefined;
    image.style.visibility='visible';
  }
}

function hopToDesk(scene,actor,arm,shade,cord,form,light) {
  const parent=actor.parentNode;
  const inverse=parent.getScreenCTM().inverse();
  const scale=1/Math.hypot(inverse.a,inverse.b);
  const email = form.querySelector('input[type=email]').closest('.ink-field');
  const button = form.querySelector('[type=submit]');
  const lower = actor.querySelector('.lamp-lower');
  const upper = actor.querySelector('.lamp-upper');
  function ledge(element, fraction, inkOffset) {
    const bounds = element.getBoundingClientRect();
    return {left:bounds.left, top:bounds.top, run:bounds.width*fraction, inkOffset};
  }
  const first = ledge(email, .82, email.offsetHeight * 2/48);
  const middle = ledge(button, .84, 0);
  // Both ledges pivot at their top-left corner. Sample the rotated contact
  // point so the sole rides the button through the dip AND the rebound.
  function contact(ledge, degrees) {
    const angle = degrees * Math.PI / 180;
    return new DOMPoint(
      ledge.left + ledge.run * Math.cos(angle) - ledge.inkOffset * Math.sin(angle),
      ledge.top + ledge.run * Math.sin(angle) + ledge.inkOffset * Math.cos(angle)
    ).matrixTransform(inverse);
  }
  const base = actor.querySelector('.lamp-base');
  const deskBase = base.getAttribute('d');
  // The ledge is seen edge-on. Keep its entire sole on that plane until
  // lift-off, then expose the rounded underside as the drawing gains depth.
  const soleDrawings = [
    [0, 'L281 620 L151 620'],
    [1.07, 'L281 619 Q251 620 216 620 Q181 620 151 619'],
    [1.16, 'L281 617 Q251 621 216 620 Q180 621 151 616'],
    [1.26, 'L281 614 Q251 622 216 620 Q180 622 151 613'],
  ];
  // time, route (0 = email, 1 = button, 2 = desk), clearance in CSS px,
  // size, foot pitch, shoulder, head, knee bend, email / button pitch.
  const drawings = [
    [0,0,0,.22,0,-7,5], [360,0,0,.22,0,-9,6],
    [450,0,0,.22,0,0,-3,8,.18], [530,0,0,.22,0,6,-7,17,.48],
    [595,0,0,.22,0,0,-7,10,.64],
    [650,.08,27,.24,5,-8,-4,1,-.28], [710,.19,51,.28,8,-14,1,-4,-.14],
    [770,.30,68,.33,9,-17,6,-7], [835,.43,73,.38,7,-15,7,-4],
    [900,.56,70,.43,4,-10,7,1], [965,.71,58,.48,1,-6,4,4],
    [1025,.86,36,.53,-2,-3,0,2], [1070,.95,16,.55,-2,0,-2],
    [1105,1,0,.56,0,3,-4,3,0,.15], [1150,1,0,.56,0,9,-7,13,0,1.25],
    [1200,1,0,.56,0,14,-9,21,0,2.05], [1260,1,0,.56,0,9,-6,13,0,1.45],
    [1320,1,0,.56,0,1,-2,4,0,.5], [1390,1,0,.56,0,-5,3,0,0,-.25],
    [1470,1,0,.56,0,-6,5,1], [1580,1,0,.56,0,5,-6,12,0,.65],
    [1645,1,0,.56,0,11,-10,20,0,1.6], [1700,1,0,.56,0,3,-7,8,0,1.1],
    [1750,1.07,34,.59,7,-10,0,-4,0,-.55], [1810,1.16,65,.63,10,-16,5,-8,0,-.22],
    [1870,1.26,90,.67,13,-20,8,-9], [1930,1.36,108,.72,12,-22,10,-7],
    [1990,1.46,118,.76,10,-21,10,-4], [2050,1.56,117,.8,7,-18,8,0],
    [2110,1.66,107,.84,4,-15,5,3], [2170,1.76,88,.89,1,-9,2,5],
    [2230,1.86,59,.94,-2,-6,0,3], [2290,1.96,21,.98,-2,-2,-2],
    [2320,2,0,1,0,4,-5,4], [2370,2,0,1,0,11,-8,12],
    [2430,2,0,1,0,7,-5,8], [2500,2,0,1,0,1,-1,2],
    [2570,2,0,1,0,-2,2], [2660,2,0,1,0,-1,1],
    [2760,2,0,1,0,0,0], [2870,2,0,1,0,0,0]
  ];
  scene.dataset.lampArriving='true';
  let frame=0,played=-1;
  const start=performance.now();
  function finish() {
    cancelAnimationFrame(frame);
    for(const part of [actor,lower,upper,arm,shade]) part.removeAttribute('transform');
    base.setAttribute('d',deskBase);
    email.style.removeProperty('rotate');
    button.style.removeProperty('rotate');
    delete scene.dataset.lampArriving;
    if (scene.isConnected) cord.drawHop(2870);
    light();
    window.removeEventListener('resize',finish);
    lampReducedMotion.removeEventListener('change',finish);
  }
  function tick(now) {
    if(!scene.isConnected){finish();return;}
    let i=played;
    while(i+1<drawings.length && drawings[i+1][0]<=now-start)i++;
    if(i!==played){
      played=i;
      const [time,phase,lift,size,tilt,shoulder,head,bend=0,mailPitch=0,buttonPitch=0]=drawings[i];
      email.style.rotate=mailPitch+'deg';
      button.style.rotate=buttonPitch+'deg';
      let sole = soleDrawings[0][1];
      for (const [at, edge] of soleDrawings) if (phase >= at) sole = edge;
      base.setAttribute('d', phase >= 1.36 ? deskBase : 'M164 589 Q217 569 269 588 '+sole+' Z');
      const startPoint=contact(first,mailPitch);
      const stop=contact(middle,buttonPitch);
      const [a,b,u]=phase<=1?[startPoint,stop,phase]:[stop,lampFoot,phase-1];
      const x=a.x+(b.x-a.x)*u, y=a.y+(b.y-a.y)*u-lift/scale;
      const pitch=tilt+(phase===0?mailPitch:phase===1?buttonPitch:0);
      actor.setAttribute('transform',`translate(${x} ${y}) rotate(${pitch}) scale(${size}) translate(${-lampFoot.x} ${-lampFoot.y})`);
      lower.setAttribute('transform',`rotate(${-bend} 219 585)`);
      upper.setAttribute('transform',`rotate(${bend*1.9} 220 417)`);
      arm.setAttribute('transform',`rotate(${shoulder} 273 287)`);
      shade.setAttribute('transform',`rotate(${head} 389 282)`);
      cord.drawHop(time);
      if(time>=2500)light();
    }
    if(i===drawings.length-1)finish();else frame=requestAnimationFrame(tick);
  }
  window.addEventListener('resize',finish,{once:true});
  lampReducedMotion.addEventListener('change',finish,{once:true});
  tick(start);
}
