// The solver works in upright drawing units. The socket follows the hand-drawn
// lamp; the links and the heavier brass pull keep their own positions and velocities.
function mountLampCord(scene, chain, togglePower) {
  const strokes = chain.querySelectorAll('.cord-shadow, .cord-beads');
  const grip = chain.querySelector('.cord-grip');
  const restLength = 55;
  const links = 9;
  const step = 1 / 120;
  const nodes = Array.from({length: links + 1}, (_, i) => ({
    x: 0, y: restLength * i / links, oldX: 0, oldY: restLength * i / links,
    inverseMass: i === 0 ? 0 : i === links ? .28 : 1
  }));
  const bead = nodes[links];
  let extension = 0;
  let socket;
  let drag;
  let frame = 0;
  let previousTime = 0;
  let remainder = 0;

  function drawCord(path, x, y, angle) {
    for (const stroke of strokes) stroke.setAttribute('d', path);
    grip.setAttribute('transform', `translate(${x} ${y}) rotate(${angle}) translate(0 -55)`);
  }

  function paint() {
    let path = 'M0 0';
    for (let i = 1; i < links; i++) {
      const a = nodes[i], b = nodes[i+1];
      path += ` Q${a.x.toFixed(2)} ${a.y.toFixed(2)} ${((a.x+b.x)/2).toFixed(2)} ${((a.y+b.y)/2).toFixed(2)}`;
    }
    path += ` L${bead.x.toFixed(2)} ${bead.y.toFixed(2)}`;
    const last = nodes[links-1];
    const angle = Math.atan2(last.x-bead.x, bead.y-last.y) * 180 / Math.PI;
    drawCord(path, bead.x, bead.y, angle);
  }

  function rest() {
    for (const [i, p] of nodes.entries()) {
      p.x = p.oldX = 0;
      p.y = p.oldY = restLength * i / links;
    }
    extension = 0;
    paint();
  }

  function solve() {
    if (drag) targetGrip(drag.point);
    const length = drag ? Math.hypot(drag.x, drag.y) : restLength;
    // A short length can feed through the eyelet on a deliberate pull.
    // Its return is slower than the user's hand, leaving slack at release.
    extension += (Math.max(0, length-restLength)-extension) * (drag ? .65 : .06);
    const span = (restLength + extension) / links;
    for (let i = 1; i <= links; i++) {
      const p = nodes[i];
      const dx = (p.x-p.oldX)*.982, dy = (p.y-p.oldY)*.982;
      p.oldX = p.x;
      p.oldY = p.y;
      p.x += dx;
      p.y += dy + 1560*step*step;
    }
    if (drag) { bead.x = drag.x; bead.y = drag.y; }
    for (let pass = 0; pass < 16; pass++) {
      for (let i = 1; i <= links; i++) {
        const a = nodes[i-1], b = nodes[i];
        const dx = b.x-a.x, dy = b.y-a.y;
        const distance = Math.hypot(dx,dy);
        if (distance < .001) continue;
        const wb = drag && i === links ? 0 : b.inverseMass;
        const correction = (distance-span) / (distance*(a.inverseMass+wb));
        a.x += dx*correction*a.inverseMass;
        a.y += dy*correction*a.inverseMass;
        b.x -= dx*correction*wb;
        b.y -= dy*correction*wb;
        // The ferrule guides the first link and the shade blocks upward travel.
        b.y = Math.max(i===1 ? span*.65 : 1, b.y);
        if (i===1) b.x = Math.max(-span*.62, Math.min(span*.62,b.x));
      }
    }
  }

  function tick(now) {
    frame = 0;
    if (!scene.isConnected) return;
    if (lampReducedMotion.matches && !drag) { rest(); return; }
    remainder += Math.min(.05, Math.max(0,(now-previousTime)/1000));
    previousTime = now;
    while (remainder >= step) { solve(); remainder -= step; }
    paint();
    const moving = nodes.some(p => Math.abs(p.x) > .16 ||
      Math.abs(p.x-p.oldX)+Math.abs(p.y-p.oldY) > .025);
    if (drag || moving || extension > .1 || Math.abs(bead.y-restLength) > .7) {
      frame = requestAnimationFrame(tick);
    } else rest();
  }

  function wake() {
    if (frame) return;
    previousTime = performance.now();
    remainder = 0;
    frame = requestAnimationFrame(tick);
  }

  // Exposure sheet for the two hops. Each line gives the sideways position of
  // the upper bend, waist, lower bend, and bead, then the hanging length.
  // On the way down the waist bows slightly; the brass end keeps pointing down.
  const hopCels = [
    [0,     0,   0,    0,    0,   55],
    [450,   0,   .3,   .8,   1,   55],
    [530,   .2,  .7,   1.7,  2,   55],
    [595,  -.4,  .1,   1.2,  1.7, 55],
    [650,  -1,  -2.2, -2.9, -3.4, 55],
    [710,  -1.3,-3.2, -5.4, -6.8, 54.6],
    [770,  -1.6,-3.6, -6.2, -8,   54.3],
    [835,  -1,  -2.6, -4.9, -7.2, 54.4],
    [900,   .6, -.3,  -2.3, -4.5, 54.8],
    [965,   1.7, 2,    1.4,   .5, 54.9],
    [1025,  1.8, 3.1,  3.9,  3.6, 54.8],
    [1105,  1,   2.8,  4.8,  5.3, 54.7],
    [1150,  0,   1.8,  4.2,  5.6, 54.6],
    [1200, -.6,   .2,  2.3,  3.7, 54.8],
    [1260, -.6,  -.9,  -.8,  -.3, 55],
    [1320, -.4, -1.1, -1.8, -2.4, 54.9],
    [1390,  0,  -.3,  -1.2, -1.6, 55],
    [1470,  0,   0,    0,    0,   55],
    [1645,   .2,  .7,  1.2,  1.6, 55],
    [1700,  -.4,  0,     .6, 1,   55],
    [1750, -1.8,-3.2, -4.2, -5,   54.8],
    [1810, -2,  -4.4, -7.1, -8.6, 54.2],
    [1870, -2.2,-5.1, -8.7,-10.5, 54],
    [1930, -1.8,-4.3, -8.3,-10.2, 54],
    [1990, -1.1,-3.1, -6.8, -8.7, 54.3],
    [2050,  -.2,-1.6, -4.4, -6.4, 54.7],
    [2110,   .7,  .2, -1.5, -3.3, 55],
    [2170,  1.3, 1.9,  1.7,  1.1, 55],
    [2230,  1.6, 3.4,  4.6,  4.9, 54.7],
    [2290,  1.6, 3.9,  6,    7.1, 54.5],
    [2320,   .8, 3.3,  6.4,  8.1, 54.3],
    [2370,   .2, 2.4,  5.5,  7.4, 54.4],
    [2430,  -.6,  .5,  2.8,  4.6, 54.8],
    [2500,  -.6, -.8,  -.6,  -.2, 55],
    [2570,  -.4,-1.1, -1.9, -2.6, 54.9],
    [2660,   0,  -.3, -1.1, -1.5, 55],
    [2760,   0,   0,   -.2,  -.4, 55],
    [2870,   0,   0,    0,    0,   55]
  ];
  function orientSocket() {
    const matrix = chain.parentNode.getCTM();
    chain.setAttribute('transform', `rotate(${-Math.atan2(matrix.b,matrix.a)*180/Math.PI})`);
    return matrix;
  }
  function drawHop(time) {
    let cel = hopCels[0];
    for (const next of hopCels) {
      if (next[0] > time) break;
      cel = next;
    }
    const [,upper,waist,lower,x,y] = cel;
    socket = orientSocket();
    const path = `M0 0 C0 7 ${upper} 18 ${waist} 28 S${lower} ${y-8} ${x} ${y}`;
    drawCord(path, x, y, Math.atan2(lower-x,8)*180/Math.PI);
  }

  function followSocket() {
    if (!scene.isConnected) return;
    const matrix = orientSocket();
    if (socket && !lampReducedMotion.matches) {
      const scale = Math.hypot(matrix.a,matrix.b);
      const dx = (matrix.e-socket.e)/scale, dy = (matrix.f-socket.f)/scale;
      // Limit the impulse from tapping the shade between two held poses.
      const gain = Math.min(1, 19 / (Math.hypot(dx,dy) || 1));
      for (let i=1; i<=links; i++) {
        const p=nodes[i], lag=gain*i/links;
        p.x -= dx*lag; p.oldX -= dx*lag;
        p.y = Math.max(1, p.y-dy*lag); p.oldY = Math.max(1, p.oldY-dy*lag);
      }
    }
    socket = matrix;
    paint();
    wake();
  }

  function pointerPoint(e) {
    return new DOMPoint(e.clientX,e.clientY).matrixTransform(chain.getScreenCTM().inverse());
  }

  // Keep the point the user caught under their finger as the brass bead tilts.
  function targetGrip(point) {
    const last = nodes[links-1];
    const angle = Math.atan2(last.x-bead.x, bead.y-last.y);
    const c=Math.cos(angle), s=Math.sin(angle);
    const x=point.x-(c*drag.grabX-s*drag.grabY);
    const y=Math.max(8,point.y-(s*drag.grabX+c*drag.grabY));
    const reach=Math.min(1,(restLength+22)/Math.hypot(x,y));
    drag.x=x*reach;
    drag.y=y*reach;
  }

  function move(e) {
    if (drag?.id !== e.pointerId) return;
    const beforeX=drag.x, beforeY=drag.y;
    drag.lastClientX=e.clientX; drag.lastClientY=e.clientY;
    drag.point=pointerPoint(e);
    targetGrip(drag.point);
    const dt=Math.max(8,e.timeStamp-drag.time)/1000;
    if (drag.x!==beforeX || drag.y!==beforeY) {
      drag.vx=(drag.x-beforeX)/dt;
      drag.vy=(drag.y-beforeY)/dt;
      drag.time=e.timeStamp;
    }
    drag.travel=Math.max(drag.travel,Math.hypot(e.clientX-drag.clientX,e.clientY-drag.clientY));
    drag.pulled ||= drag.y-drag.startY>=12 && Math.hypot(drag.x,drag.y)>restLength+8;
    wake();
  }

  chain.addEventListener('pointerdown', e=>{
    if (drag || e.button!==0 || scene.dataset.lampArriving) return;
    const p=pointerPoint(e);
    const caught = new DOMPoint(e.clientX,e.clientY).matrixTransform(grip.getScreenCTM().inverse());
    drag={id:e.pointerId,clientX:e.clientX,clientY:e.clientY,
      point:p,grabX:caught.x,grabY:caught.y-55,lastClientX:e.clientX,lastClientY:e.clientY,x:bead.x,y:bead.y,startY:bead.y,
      travel:0,pulled:false,vx:0,vy:0,time:e.timeStamp};
    chain.setPointerCapture(e.pointerId);
    e.preventDefault();
    wake();
  });
  chain.addEventListener('pointermove', move);
  function release(e) {
    if (drag?.id!==e.pointerId) return;
    if (e.type==='pointerup' && (e.clientX!==drag.lastClientX || e.clientY!==drag.lastClientY)) move(e);
    const tap=drag.travel<6;
    if (e.type==='pointerup' && (tap || drag.pulled)) togglePower();
    // A held pull starts from rest; a flick carries the last hand velocity.
    const carry=e.type==='pointerup' ? Math.max(0,1-(e.timeStamp-drag.time)/90) : 0;
    bead.x=drag.x;
    bead.y=drag.y+(tap && e.type==='pointerup' ? 4 : 0);
    const speed=Math.max(1,Math.hypot(drag.vx,drag.vy)/325);
    bead.oldX=bead.x-drag.vx/speed*carry*step;
    bead.oldY=bead.y-drag.vy/speed*carry*step;
    drag=null;
    wake();
  }
  for (const name of ['pointerup','pointercancel','lostpointercapture']) chain.addEventListener(name,release);
  chain.addEventListener('click',e=>{
    if (e.detail===0 && !scene.dataset.lampArriving) togglePower();
  });
  chain.addEventListener('keydown',e=>{
    if (e.key!=='Enter' && e.key!==' ') return;
    e.preventDefault();
    if (!e.repeat && !scene.dataset.lampArriving) togglePower();
  });
  return {followSocket, drawHop};
}
