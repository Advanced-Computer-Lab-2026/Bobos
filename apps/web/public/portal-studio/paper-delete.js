(() => {
class PortalPaperDelete extends HTMLElement {
 connectedCallback() {
  if(this.shadowRoot)return;
  const shadow=this.attachShadow({mode:"open"});
  const style=document.createElement("style");style.textContent=".throw-btn{\n --btn-base:var(--paper);--btn-fg:var(--paper-ink);\n width:155px;height:42px;min-width:155px;min-height:42px;flex:none;z-index:2;\n padding:8px 19px;border:1px solid var(--btn-base);border-radius:7px;\n background:var(--btn-base);color:var(--btn-fg);\n position:relative;overflow:visible;\n display:inline-flex;align-items:center;justify-content:flex-start;gap:9px;\n font-size:12px;font-weight:650;letter-spacing:-.12px;line-height:1.25;\n box-shadow:0 3px 0 rgba(0,0,0,.05);\n touch-action:manipulation;\n transition:transform 100ms steps(2,end)\n}\n.throw-btn:not(:disabled):active{transform:translateY(1px)}\n.throw-btn:not(:disabled):hover{background:color-mix(in srgb,var(--btn-base) 96%,var(--canvas))}\n.throw-btn[data-phase=deleted],.throw-btn[data-phase=undoing]{--btn-base:var(--coral);--btn-fg:var(--coral-ink)}\n.throw-btn[data-phase=throwing],.throw-btn[data-phase=undoing]{cursor:progress}\n.throw-btn .btn-label{z-index:2;white-space:nowrap;position:relative}\n.icon-slot{position:relative;display:block;width:17px;height:18px;flex:none;z-index:3}\n.bin,.undo-icon{position:absolute;inset:0;width:17px;height:18px;overflow:visible}\n.bin{opacity:1}\n.bin-lid{transform-origin:8.5px 5.4px;transition:none}\n.undo-icon{opacity:0;transform:none;transition:none}\n.throw-wrap{display:inline-block;width:155px;height:42px;position:relative;isolation:isolate;flex:none;overflow:visible}\n.throw-wrap .throw-btn{width:155px;height:42px;z-index:2}\n/* The paper is physically UNDER the opaque button face and thus appears\n   only once it clears the top edge; no opacity fade or masking trick. */\n.paper-flight{position:absolute;left:0;top:0;width:18px;height:20px;pointer-events:none;opacity:0;transform-origin:50% 50%;z-index:1;transition:none!important;will-change:transform}\n.paper-flight .page-body{fill:var(--paper);stroke:var(--paper-ink)}\n.paper-flight .page-line{stroke:var(--paper-ink)}\n.paper-flight .fold{fill:#d5d0c5;stroke:var(--paper-ink)}\n.catch-window{position:absolute;left:20px;top:7px;width:17px;height:27px;overflow:hidden;z-index:3;pointer-events:none}\n.catch-window .paper-flight{left:-20px;top:-7px;z-index:auto}\n.bin-front{position:absolute;left:20px;top:12px;width:17px;height:18px;z-index:4;pointer-events:none;color:var(--paper-ink);opacity:0}\n.throw-wrap[data-phase=undoing] .bin-front{color:var(--coral-ink)}\n.throw-wrap:is([data-phase=throwing],[data-phase=undoing]) .bin-front{opacity:1}\n.throw-wrap:is([data-phase=throwing],[data-phase=undoing]) .throw-btn .bin{opacity:0}\n.throw-btn[data-phase=deleted] .bin{opacity:0}\n.throw-btn[data-phase=deleted] .undo-icon{opacity:1}\n.throw-btn[data-phase=deleted]:hover .undo-icon{transform:translate(-.5px,-.5px) rotate(-8deg)}\n/* During the reverse flight the tiny physical bin reappears over the arrow. */\n.throw-btn[data-phase=undoing] .undo-icon{opacity:0}\n:host{display:inline-block;vertical-align:middle;--paper:#efede6;--paper-ink:#35332e;--coral:#e2afa0;--coral-ink:#482920;font:12px/1.25 Styrene,Arial,sans-serif}*{box-sizing:border-box}\n.throw-wrap,.throw-wrap .throw-btn{width:var(--delete-width,130px);min-width:0}\n.throw-btn{font:inherit;font-weight:600}.throw-btn:focus-visible{outline:2px solid #8eb9f3;outline-offset:4px}\n.throw-btn:disabled{opacity:.75}.throw-btn[data-phase=throwing]{opacity:1}\n@media(prefers-reduced-motion:reduce){.throw-btn{transition:none}}\n";
  shadow.append(style);const content=document.createElement("span");content.innerHTML="<span class=\"throw-wrap\" data-phase=\"idle\">\n       <svg class=\"paper-flight paper-behind\" viewBox=\"0 0 20 22\" fill=\"none\" aria-hidden=\"true\"><path class=\"page-body\" d=\"M3 1.5h8.9l4.9 5V20H3z\" stroke-width=\"1.25\" stroke-linejoin=\"round\"/><path class=\"fold\" d=\"M11.9 1.5v5h4.9\" stroke-width=\"1.1\"/><path class=\"page-line\" d=\"M5.8 10h8M5.8 13h8M5.8 16h5.6\" stroke-width=\"1\" stroke-linecap=\"round\"/></svg>\n       <button class=\"throw-btn\" type=\"button\" data-phase=\"idle\" aria-label=\"Delete draft\">\n       <span class=\"icon-slot\" aria-hidden=\"true\">\n        <svg class=\"bin\" viewBox=\"0 0 18 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><g class=\"bin-lid\"><path d=\"M3 5.4h12M6.6 3.2h4.8\"/></g><path d=\"M4.6 7 5.3 17.4h7.4L13.4 7M7.3 9v5.5M10.8 9v5.5\"/></svg>\n        <svg class=\"undo-icon\" viewBox=\"0 0 18 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.3 7.2H2.7V3.6M2.9 7.2A6.9 6.9 0 1 1 3.8 14.7\"/></svg>\n       </span>\n       <span class=\"btn-label\">Delete draft</span>\n       </button>\n       <span class=\"catch-window\" aria-hidden=\"true\"><svg class=\"paper-flight paper-inside\" viewBox=\"0 0 20 22\" fill=\"none\"><path class=\"page-body\" d=\"M3 1.5h8.9l4.9 5V20H3z\" stroke-width=\"1.25\" stroke-linejoin=\"round\"/><path class=\"fold\" d=\"M11.9 1.5v5h4.9\" stroke-width=\"1.1\"/><path class=\"page-line\" d=\"M5.8 10h8M5.8 13h8M5.8 16h5.6\" stroke-width=\"1\" stroke-linecap=\"round\"/></svg></span>\n       <svg class=\"bin-front\" viewBox=\"0 0 18 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><g class=\"bin-lid\"><path d=\"M3 5.4h12M6.6 3.2h4.8\"/></g><path d=\"M4.6 7 5.3 17.4h7.4L13.4 7M7.3 9v5.5M10.8 9v5.5\"/></svg>\n      </span>";shadow.append(content);
  const button=shadow.querySelector("button"),wrap=shadow.querySelector(".throw-wrap"),label=shadow.querySelector(".btn-label");
  const text=this.getAttribute("label") || "Delete draft";label.textContent=text;button.setAttribute("aria-label",text);
  const measure=document.createElement("canvas").getContext("2d");measure.font=getComputedStyle(button).font;
  if (!this.hasAttribute("demo")) shadow.querySelector(".undo-icon").innerHTML='<path d="m4 10 3.5 4 7-8"/>';
  this.style.setProperty("--delete-width",(text==="Delete draft"?130:Math.ceil(measure.measureText(text).width+62))+"px");
  const pages=[...shadow.querySelectorAll(".paper-flight")],lids=[...shadow.querySelectorAll(".bin-front .bin-lid")];
  const reduced=matchMedia("(prefers-reduced-motion: reduce)");
  let pending=null,runId=0,phase="idle";
 function clearPaper(){lastExposure=-1;for(const page of pages){page.style.opacity="0";page.style.transform="translate(107px,13px) rotate(-22deg) scale(.8)";}for(const lid of lids)lid.style.transform="";}
 const landmarks=[
  {t:0,   x:107,y:13,r:-20,s:.76}, // hidden behind opaque face
  {t:.10, x:104,y:-12,r:-17,s:.85}, // rises out through top edge
  {t:.25, x:88, y:-35,r:-9, s:.96},
  {t:.44, x:65, y:-49,r:5,  s:1.01},
  {t:.53, x:55, y:-48,r:12, s:1},   // crosses the apex without a freeze
  {t:.70, x:36, y:-31,r:26, s:.94},
  {t:.82, x:24, y:-13,r:20, s:.79}, // catches bin mouth
  {t:.91, x:23, y:-3, r:7,  s:.64},
  {t:1,   x:23, y:17, r:0,  s:.10}  // disappears below bin rim
 ];
 const exposureTimes=[0,.13,.29,.48,.65,.81,.94];
 const exposureInk=[0,1,2,0,3,1,2];
 // Non-uniform cubic Hermite interpolation, using neighbors to keep velocity
 // continuous when crossing a landmark. No stopped-on-purpose positions.
 function interpolate(time,key){
   const t=Math.max(0,Math.min(1,time));
   let i=0;
   while(i<landmarks.length-2 && landmarks[i+1].t<t)i++;
   const a=landmarks[i],b=landmarks[i+1];
   const dt=b.t-a.t,u=(t-a.t)/dt;
   const before=landmarks[Math.max(0,i-1)];
   const after=landmarks[Math.min(landmarks.length-1,i+2)];
   const m0=i===0?(b[key]-a[key])/dt:(b[key]-before[key])/(b.t-before.t);
   const m1=i+2===landmarks.length?(b[key]-a[key])/dt:(after[key]-a[key])/(after.t-a.t);
   return (2*u*u*u-3*u*u+1)*a[key]+(u*u*u-2*u*u+u)*dt*m0+(-2*u*u*u+3*u*u)*b[key]+(u*u*u-u*u)*dt*m1;
 }
 function lidAngle(t){
   if(t<.72)return 0;
   if(t<.85)return -22*(t-.72)/.13;
   if(t<.93)return -22;
   return -22*(1-t)/.07;
 }
 const handInk=[
  {body:'M3 1.5L11.9 1.5L16.8 6.5L16.8 20L3 20Z',fold:'M11.9 1.5L11.9 6.5L16.8 6.5',line:'M5.8 10L13.8 10M5.8 13L13.8 13M5.8 16L11.4 16'},
  {body:'M3.1 1.6L12 1.2L16.7 6.3L17 19.8L2.8 20.2Z',fold:'M12 1.2L12.1 6.4L16.7 6.3',line:'M5.8 10.2L14 9.9M6 12.9L13.6 13.1M5.7 16.2L11.5 16'},
  {body:'M2.9 1.5L12.1 1.6L17 6.7L16.7 20.1L3.2 19.9Z',fold:'M12.1 1.6L11.9 6.8L17 6.7',line:'M5.9 9.8L13.6 10.2M5.7 13.1L14 12.8M5.9 15.9L11.3 16.2'},
  {body:'M3.2 1.3L11.8 1.7L16.9 6.4L16.8 20.2L3 19.9Z',fold:'M11.8 1.7L12 6.3L16.9 6.4',line:'M5.7 10L14 9.8M5.9 13.2L13.9 13M5.8 15.8L11.2 16'}
 ];
 let frameHandle=null,lastExposure=-1;
 function renderAt(progress){
   const rawX=interpolate(progress,'x');
   const x=23+(rawX-23)*(button.offsetWidth-43)/112,y=interpolate(progress,'y');
   const rotation=interpolate(progress,'r'),scale=interpolate(progress,'s');
   const transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
   // Update position each animation frame; outline changes only a few times.
   for(const p of pages){p.style.opacity='1';p.style.transform=transform;}
   let exposure=0;
   for(let i=1;i<exposureTimes.length;i++)if(progress>=exposureTimes[i])exposure=i;
   if(exposure!==lastExposure){
     const shape=handInk[exposureInk[exposure]];
     for(const p of pages){
       p.querySelector('.page-body').setAttribute('d',shape.body);
       p.querySelector('.fold').setAttribute('d',shape.fold);
       p.querySelector('.page-line').setAttribute('d',shape.line);
     }
     lastExposure=exposure;
   }
   const lid=lidAngle(progress);
   for(const l of lids)l.style.transform=`translateY(${lid<0?-2:0}px) rotate(${lid.toFixed(1)}deg)`;
 }
 function animate(reverse,onFinish){
   if(reduced.matches){pending=setTimeout(()=>{clearPaper();onFinish();pending=null;},25);return;}
   const thisRun=++runId;
   const duration=600; // ~0.6s at Normal, faster than the exposed-cel version
   const started=performance.now();
   lastExposure=-1;
   function tick(now){
     if(thisRun!==runId)return;
     const t=Math.min(1,(now-started)/duration);
     renderAt(reverse?1-t:t);
     if(t>=1){clearPaper();frameHandle=null;onFinish();return;}
     frameHandle=requestAnimationFrame(tick);
   }
   renderAt(reverse?1:0);
   frameHandle=requestAnimationFrame(tick);
 }

  const sync=next=>{phase=next;wrap.dataset.phase=next;button.dataset.phase=next;button.disabled=["throwing","undoing"].includes(next)||this.hasAttribute("disabled");button.setAttribute("aria-busy",String(["throwing","undoing"].includes(next)));label.textContent=next==="deleted"?"Deleted":text;button.setAttribute("aria-label",next==="deleted"&&this.restore?"Restore "+text.replace(/^Delete /i,""):text);};
  this.updateDisabled=()=>{if(phase==="idle")button.disabled=this.hasAttribute("disabled");};
  this.stopMotion=()=>{runId++;clearTimeout(pending);if(frameHandle!==null)cancelAnimationFrame(frameHandle);};
  button.addEventListener("click",()=>{
   if(!["idle","deleted"].includes(phase))return;
   const reverse=phase==="deleted";
   if(reverse&&!this.restore)return;
   if(!reverse&&!this.perform&&!this.hasAttribute("demo"))return;
   sync(reverse?"undoing":"throwing");
   animate(reverse,async()=>{
    if(!this.isConnected)return;
    try {
     const operation=reverse?this.restore:this.perform;
     const success=operation?await operation():true;
     if(!this.isConnected)return;
     sync(success===false?(reverse?"deleted":"idle"):(reverse?"idle":"deleted"));
     if(!reverse&&success!==false&&!this.restore&&!this.hasAttribute("demo"))button.disabled=true;
     this.dispatchEvent(new CustomEvent("delete-result",{detail:{success:success!==false,restored:reverse},bubbles:true}));
    } catch(error){sync(reverse?"deleted":"idle");this.dispatchEvent(new CustomEvent("delete-error",{detail:{message:error.message},bubbles:true}));}
   });
  });
  if(this.hasAttribute("demo"))this.restore=async()=>true;
  clearPaper();sync(this.hasAttribute("deleted")?"deleted":"idle");
 }
 static get observedAttributes(){return ["disabled"]}
 attributeChangedCallback(){this.updateDisabled?.()}
 disconnectedCallback(){this.stopMotion?.()}
}
if(!customElements.get("portal-paper-delete"))customElements.define("portal-paper-delete",PortalPaperDelete);
})();
