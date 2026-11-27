/* Page geometry, depth rasterizer, and held poses adapted from binder-motion-studio.html. */
const binderMotion = (() => {
const poses = {
  "center-lift": [
    {"t":0,"a":[0,0,0,0,0,0],"f":160,"r":160,"twist":0,"cup":0},
    {"t":0,"a":[0,0,0,0,0,0],"f":70,"r":55,"twist":0,"cup":12},
    {"t":0,"a":[0,0,0,0,0,0],"f":75,"r":55,"twist":0,"cup":32},
    {"t":0,"a":[0,0,0,0,0,0],"f":100,"r":65,"twist":0,"cup":58},
    {"t":0.003,"a":[0,0,0,0,2,5],"f":85,"r":65,"twist":0,"cup":72},
    {"t":0.012,"a":[1,4,10,22,34,45],"f":60,"r":65,"twist":0,"cup":65},
    {"t":0.04,"a":[9,20,35,50,66,84],"f":55,"r":65,"twist":0,"cup":55},
    {"t":0.09,"a":[28,46,65,86,109,132],"f":55,"r":65,"twist":0,"cup":43},
    {"t":0.16,"a":[59,78,98,121,145,168],"f":60,"r":75,"twist":0,"cup":34},
    {"t":0.25,"a":[94,110,130,153,179,205],"f":85,"r":85,"twist":0,"cup":25},
    {"t":0.35,"a":[130,147,170,197,225,253],"f":120,"r":105,"twist":0,"cup":18},
    {"t":0.46,"a":[165,186,214,245,277,309],"f":70,"r":75,"twist":0,"cup":10},
    {"t":0.56,"a":[195,223,255,286,316,343],"f":55,"r":70,"twist":0,"cup":3},
    {"t":0.66,"a":[227,259,288,315,340,359],"f":55,"r":70,"twist":0,"cup":-14},
    {"t":0.75,"a":[259,289,316,339,356,367],"f":60,"r":75,"twist":0,"cup":-22},
    {"t":0.83,"a":[289,316,339,355,366,372],"f":65,"r":75,"twist":0,"cup":-15},
    {"t":0.9,"a":[319,341,355,365,369,366],"f":70,"r":75,"twist":0,"cup":-8},
    {"t":0.96,"a":[344,355,363,366,364,360],"f":75,"r":70,"twist":0,"cup":0},
    {"t":0.99,"a":[357,361,362,361,360,359],"f":90,"r":70,"twist":0,"cup":3},
    {"t":1,"a":[360,360,360,360,360,360],"f":185,"r":180,"twist":0,"cup":0}
  ],
  "caught-air": [
    {"t":0,"a":[0,0,0,0,0,0],"f":150,"r":160,"twist":0,"cup":0},
    {"t":0,"a":[0,0,0,0,8,40],"f":60,"r":55,"twist":0,"cup":0},
    {"t":0.002,"a":[0,0,0,5,35,85],"f":50,"r":50,"twist":0,"cup":0},
    {"t":0.008,"a":[0,0,8,28,80,132],"f":50,"r":55,"twist":0,"cup":0},
    {"t":0.02,"a":[2,8,25,65,125,165],"f":55,"r":55,"twist":0,"cup":0},
    {"t":0.045,"a":[8,28,60,103,155,185],"f":50,"r":55,"twist":0,"cup":0},
    {"t":0.085,"a":[25,60,100,145,185,213],"f":50,"r":65,"twist":0,"cup":0},
    {"t":0.14,"a":[55,93,128,170,210,236],"f":55,"r":60,"twist":0,"cup":0},
    {"t":0.21,"a":[84,115,149,191,230,252],"f":75,"r":75,"twist":0,"cup":0},
    {"t":0.29,"a":[105,125,145,178,214,254],"f":120,"r":100,"twist":0,"cup":0},
    {"t":0.34,"a":[121,131,149,174,207,246],"f":85,"r":80,"twist":0,"cup":0},
    {"t":0.38,"a":[137,145,157,183,218,262],"f":65,"r":65,"twist":0,"cup":0},
    {"t":0.43,"a":[155,164,183,215,250,286],"f":55,"r":55,"twist":0,"cup":0},
    {"t":0.49,"a":[177,191,216,249,282,314],"f":50,"r":60,"twist":0,"cup":0},
    {"t":0.56,"a":[198,222,252,286,319,347],"f":45,"r":65,"twist":0,"cup":0},
    {"t":0.64,"a":[226,258,290,321,347,369],"f":50,"r":70,"twist":0,"cup":0},
    {"t":0.72,"a":[253,286,318,345,369,385],"f":50,"r":65,"twist":0,"cup":0},
    {"t":0.8,"a":[281,313,341,364,380,389],"f":55,"r":70,"twist":0,"cup":0},
    {"t":0.875,"a":[311,339,360,376,387,380],"f":60,"r":65,"twist":0,"cup":0},
    {"t":0.93,"a":[335,350,362,370,365,354],"f":60,"r":60,"twist":0,"cup":0},
    {"t":0.97,"a":[351,357,363,366,357,350],"f":60,"r":55,"twist":0,"cup":0},
    {"t":0.992,"a":[357,359,361,361,355,356],"f":70,"r":55,"twist":0,"cup":0},
    {"t":1,"a":[360,360,360,360,360,360],"f":60,"r":55,"twist":0,"cup":0},
    {"t":1,"a":[360,360,360,360,361,364],"f":85,"r":60,"twist":0,"cup":0},
    {"t":1,"a":[360,360,360,360,360,360],"f":170,"r":165,"twist":0,"cup":0}
  ]
};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)), rad=d=>d*Math.PI/180;
const W=520,H=350,R=26,HOLE=18,L=H-HOLE,NX=30;
const KNOTS=[0,.1,.26,.46,.67,.84,1];
const S=[-18,-12,-6,0];for(let s=4;s<L;s+=4)S.push(s);S.push(L);
const NS=S.length;
const FRONT_Z=-19+R/Math.SQRT2;

const YTOP=-4+R/Math.SQRT2-HOLE;
const YAW=-.30,PITCH=.26;
const RIGHT=[Math.cos(YAW),0,Math.sin(YAW)];
const DOWN=[Math.sin(YAW)*Math.sin(PITCH),Math.cos(PITCH),-Math.cos(YAW)*Math.sin(PITCH)];
const VIEW=[-Math.sin(YAW)*Math.cos(PITCH),Math.sin(PITCH),Math.cos(YAW)*Math.cos(PITCH)];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const rgb=hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
const surfaceIndices=[];
for(let i=0;i<NX;i++)for(let j=0;j<NS-1;j++){let a=i*NS+j,b=(i+1)*NS+j,c=a+1,d=b+1;surfaceIndices.push(a,b,c,b,d,c);}
function ringPoint(t,x=0){const a=-Math.PI/4+t*Math.PI*1.5;return[x,-4-R*Math.sin(a),-19+R*Math.cos(a)];}
function boundAngle(t){return 45+270*t+45*(2*t-1)**3;}
function angleAt(p,q,u){
 let k=0;while(k<5&&q>KNOTS[k+1])k++;
 const a=k===0?boundAngle(p.t):p.a[k-1],b=p.a[k];
 let f=clamp((q-KNOTS[k])/(KNOTS[k+1]-KNOTS[k]),0,1);f=f*f*(3-2*f);
 let w=clamp((q-.3)/.7,0,1);w=w*w*(3-2*w);
 return rad(a+(b-a)*f+(p.twist*u*u+p.cup*Math.sin(Math.PI*u)**2)*w);
}
function makeSheet(p){
 const v=[],anchor=ringPoint(p.t),g=rad(boundAngle(p.t));
 for(let i=0;i<=NX;i++){
  const u=i/NX,x=(u-.5)*W;let y=anchor[1],z=anchor[2],old=0;
  for(let j=0;j<NS;j++){
   const s=S[j];let yy,zz;
   if(s<=0){yy=anchor[1]+s*Math.cos(g);zz=anchor[2]+s*Math.sin(g);}
   else{const a=angleAt(p,((s+old)/2)/L,u),ds=s-old;y+=ds*Math.cos(a);z+=ds*Math.sin(a);yy=y;zz=z;old=s;}
   v.push([x,yy,zz,u,(s+HOLE)/H]);
  }
 }
 const perimeter=[];
 for(let i=0;i<=NX;i++)perimeter.push(v[i*NS]);
 for(let j=1;j<NS;j++)perimeter.push(v[NX*NS+j]);
 for(let i=NX-1;i>=0;i--)perimeter.push(v[i*NS+NS-1]);
 for(let j=NS-2;j>=0;j--)perimeter.push(v[j]);
 return{v,indices:surfaceIndices,perimeter};
}
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function texture(c){return{w:c.width,h:c.height,data:c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data};}
function flatMesh(x0,x1,y0,y1,z){return{v:[[x0,y0,z,0,0],[x1,y0,z,1,0],[x1,y1,z,1,1],[x0,y1,z,0,1]],indices:[0,1,2,0,2,3]};}
function roundPerimeter(x0,x1,y0,y1,r,z){const v=[];for(const [cx,cy,start] of [[x1-r,y0+r,-Math.PI/2],[x1-r,y1-r,0],[x0+r,y1-r,Math.PI/2],[x0+r,y0+r,Math.PI]])for(let i=0;i<=5;i++){let a=start+i/5*Math.PI/2;v.push([cx+r*Math.cos(a),cy+r*Math.sin(a),z,0,0]);}return v;}
function fanMesh(v){const indices=[];for(let i=1;i<v.length-1;i++)indices.push(0,i,i+1);return{v,indices};}
const STATIC=[];
const boardFront=roundPerimeter(-275,275,0,365,7,-10),boardBack=roundPerimeter(-275,275,0,365,7,-30);
STATIC.push({mesh:fanMesh(boardBack),mat:{solid:rgb('#65765f')}});
for(let i=0;i<boardFront.length;i++){const j=(i+1)%boardFront.length;STATIC.push({mesh:{v:[boardBack[i],boardBack[j],boardFront[j],boardFront[i]],indices:[0,1,2,0,2,3]},mat:{solid:rgb(i<6?'#5d705f':'#778165')}});}
STATIC.push({mesh:fanMesh(boardFront),mat:{solid:rgb('#86957e')}});
for(const [z,dy,tint] of [[-9,3,'#d0c9b0'],[-7,2,'#e2d8bd'],[-5.5,1,'#eae0c7']])STATIC.push({mesh:flatMesh(-261,261,YTOP+dy,YTOP+H+dy,z),mat:{solid:rgb(tint)}});
function makeWire(x){
 const v=[],indices=[],n=72,m=9,r=2.15;
 for(let i=0;i<=n;i++){let a=i/n*Math.PI*2,cy=-4-R*Math.sin(a),cz=-19+R*Math.cos(a);for(let j=0;j<=m;j++){let b=j/m*Math.PI*2;v.push([x+r*Math.cos(b),cy-r*Math.sin(b)*Math.sin(a),cz+r*Math.sin(b)*Math.cos(a),0,0]);}}
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){let a=i*(m+1)+j,b=a+m+1;indices.push(a,a+1,b,b,a+1,b+1);}
 return{v,indices};
}
const WIRES=[.15,.5,.85].map(u=>makeWire((u-.5)*W));
class Raster {
 constructor(canvas, width, height, boardColor){
  this.canvas=canvas;
  this.ctx=canvas.getContext('2d',{alpha:true});
  const dpr=Math.min(Math.max(1.5,devicePixelRatio),2);
  this.paperWidth=Math.round(width*dpr);
  this.w=canvas.width=Math.round(width*1.48*dpr);
  this.h=canvas.height=Math.round(height*2.4*dpr);
  this.bottomMargin=this.h/24;
  this.paperHeight=Math.round(height*dpr);
  this.scaleX=this.paperWidth/W;
  this.scaleY=this.paperHeight/H/Math.cos(PITCH);
  this.image=this.ctx.createImageData(this.w,this.h);
  this.data=this.image.data;
  this.depth=new Float32Array(this.w*this.h);
  this.renderStatic(boardColor);
  this.staticDepth=this.depth.slice();
  this.staticColor=this.data.slice();
 }
 project(v){
  // Register the front plane to the calendar rectangle while preserving depth
  // shifts from the study's oblique camera as the sheet leaves that plane.
  const x=(dot(v,RIGHT)-FRONT_Z*Math.sin(YAW))/Math.cos(YAW);
  const y=dot(v,DOWN)-x*Math.sin(YAW)*Math.sin(PITCH)-YTOP*Math.cos(PITCH)+FRONT_Z*Math.cos(YAW)*Math.sin(PITCH);
  const screenX=x*this.scaleX+this.w/2;
  const screenY=y*this.scaleY+this.h-this.bottomMargin-this.paperHeight;
  return [screenX,screenY,dot(v,VIEW),v[3]||0,v[4]||0,v[2]];
 }
 mesh(mesh,mat){
  const a=mesh.v.map(v=>this.project(v)),ix=mesh.indices;
  for(let t=0;t<ix.length;t+=3){
   const ia=ix[t],ib=ix[t+1],ic=ix[t+2];let shade=1;
   if(mat.paper||mat.wire){
    const va=mesh.v[ia],vb=mesh.v[ib],vc=mesh.v[ic];
    const ax=vb[0]-va[0],ay=vb[1]-va[1],az=vb[2]-va[2],bx=vc[0]-va[0],by=vc[1]-va[1],bz=vc[2]-va[2];
    const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,ln=Math.hypot(nx,ny,nz)||1;
    const light=(nx*.15-ny*.32+nz*.935)/ln;
    shade=mat.wire?.46+.54*Math.max(0,light):.92+.08*Math.abs(light);
   }
   this.triangle(a[ia],a[ib],a[ic],mat,shade);
  }
 }
 triangle(a,b,c,mat,shade){
  const ax=a[0],ay=a[1],bx=b[0],by=b[1],cx=c[0],cy=c[1],det=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  if(Math.abs(det)<.006)return;
  const front=det>0,tex=mat.front?(front?mat.front:(mat.back||mat.front)):null;
  const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(this.w-1,Math.ceil(Math.max(ax,bx,cx))),minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(this.h-1,Math.ceil(Math.max(ay,by,cy)));
  if(maxX<minX||maxY<minY)return;
  const bdx=(cy-ay)/det,bdy=-(cx-ax)/det,cdx=-(by-ay)/det,cdy=(bx-ax)/det;
  const zb=b[2]-a[2],zc=c[2]-a[2],ub=b[3]-a[3],uc=c[3]-a[3],vb=b[4]-a[4],vc=c[4]-a[4];
  const pix=this.data,dep=this.depth,w=this.w,solid=mat.solid,td=tex&&tex.data,tw=tex&&tex.w,th=tex&&tex.h;
  let LB=(minX+.5-ax)*bdx+(minY+.5-ay)*bdy,LC=(minX+.5-ax)*cdx+(minY+.5-ay)*cdy;
  for(let y=minY;y<=maxY;y++,LB+=bdy,LC+=cdy){
   let lb=LB,lc=LC,k=y*w+minX;
   for(let x=minX;x<=maxX;x++,k++,lb+=bdx,lc+=cdx){
    if(lb<-.0001||lc<-.0001||lb+lc>1.0001)continue;
    const z=a[2]+zb*lb+zc*lc;if(z<dep[k]-.00001)continue;
    const p=k*4;
    if(tex){
     let tx=clamp(((a[3]+ub*lb+uc*lc)*(tw-1)+.5)|0,0,tw-1),ty=clamp(((a[4]+vb*lb+vc*lc)*(th-1)+.5)|0,0,th-1),q=(ty*tw+tx)*4;
     if(td[q+3]<128)continue;
     pix[p]=td[q]*shade;pix[p+1]=td[q+1]*shade;pix[p+2]=td[q+2]*shade;
    }else{pix[p]=solid[0]*shade;pix[p+1]=solid[1]*shade;pix[p+2]=solid[2]*shade;}
    pix[p+3]=255;dep[k]=z;
   }
  }
 }
 line(points,color,width=.65,bias=.65,closed=false){
  const p=points.map(v=>this.project(v)),r=Math.max(.6,width*this.scaleX/2),r2=r*r;
  for(let j=0;j<p.length-(closed?0:1);j++){
   const a=p[j],b=p[(j+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))*1.3));
   for(let i=0;i<=steps;i++){
    const f=i/steps,x=a[0]+dx*f,y=a[1]+dy*f,z=a[2]+(b[2]-a[2])*f+bias;
    for(let py=Math.max(0,Math.floor(y-r));py<=Math.min(this.h-1,Math.ceil(y+r));py++)for(let px=Math.max(0,Math.floor(x-r));px<=Math.min(this.w-1,Math.ceil(x+r));px++){
     if((px+.5-x)**2+(py+.5-y)**2>r2)continue;const k=py*this.w+px;if(z<this.depth[k])continue;
     const k4=k*4;this.data[k4]=color[0];this.data[k4+1]=color[1];this.data[k4+2]=color[2];this.data[k4+3]=255;this.depth[k]=z;
    }
   }
  }
 }
 renderStatic(boardColor){
  this.depth.fill(-1e9);
  for(const part of STATIC){
    const face=part.mesh.v===boardFront;
    const board=part.mesh.v.some(vertex=>vertex[2]===-30);
    const tint=face?boardColor:board?boardColor.map(channel=>channel*.68):part.mat.solid;
    this.mesh(part.mesh,{solid:tint});
  }
  this.line(boardFront,rgb('#69675f'),.8,.7,true);
  this.line(boardBack,rgb('#514e48'),.8,.7,true);
  for(const wire of WIRES)this.mesh(wire,{solid:rgb('#c4c1aa'),wire:true});
 }
 begin(){
  this.data.set(this.staticColor);
  this.depth.set(this.staticDepth);
 }
 leaf(sheet,ink,phase){
  this.mesh(sheet,{front:ink.front,back:ink.back,paper:true});
  const edge=sheet.perimeter.map(v=>{
    const q=v[4];
    if(q<.65)return v;
    const offset=(phase===1?.6:phase===2?-.5:0)*Math.sin((q-.65)/.35*Math.PI);
    return [v[0],v[1]+offset,v[2],v[3],v[4]];
  });
  this.line(edge,rgb('#716c60'),.65,.7,true);

 }
}
function drawSvg(svg, context, bounds, opacity, fixedRect){
  return new Promise(resolve=>{
    const rect=fixedRect||svg.getBoundingClientRect();
    if(!rect.width||!rect.height){resolve();return;}
    const copy=svg.cloneNode(true);
    const descendants=copy.querySelectorAll('*');
    const properties=['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','visibility','display','transform','transform-origin','transform-box','color','d'];
    [svg,...svg.querySelectorAll('*')].forEach((node,i)=>{
      const computed=getComputedStyle(node);
      const destination=i===0?copy:descendants[i-1];
      for(const property of properties){
        // The root's screen transform is already represented by its bounding box.
        if(i===0 && property==='transform')continue;
        destination.style.setProperty(property,computed.getPropertyValue(property));
      }
    });
    function loaded(){
      context.save();
      context.globalAlpha=opacity;
      context.drawImage(image,rect.left-bounds.left,rect.top-bounds.top,rect.width,rect.height);
      context.restore();
      resolve();
    }
    function failed(){resolve();}
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
    copy.setAttribute('width',rect.width);
    copy.setAttribute('height',rect.height);
    const image=new Image();
    image.onload=loaded;
    image.onerror=failed;
    image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(copy.outerHTML);
  });
}

// Keep the typesetting fixed and sample the live seasonal drawing on each ink exposure.
function capture(paper,stock,pencil){
  const body=paper.closest('.binder-body');
  body?.classList.add('binder-measuring');
  try {
    return captureFlat(paper,stock,pencil);
  } finally {
    body?.classList.remove('binder-measuring');
  }
}

function captureFlat(paper,stock,pencil){
  const bounds=paper.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return Promise.resolve(null);
  const canvas=makeCanvas(W*2,H*2),context=canvas.getContext('2d');
  context.fillStyle=stock;
  context.fillRect(0,0,canvas.width,canvas.height);
  context.scale(canvas.width/bounds.width,canvas.height/bounds.height);
  context.textBaseline='middle';
  const drawings=[];
  const art=paper.querySelector('.season-drawing');
  const artRect=art?.getBoundingClientRect();
  for(const item of paper.querySelectorAll('.folio-month > small,.folio-days > small,.folio-date > b')){
    const rect=item.getBoundingClientRect(),css=getComputedStyle(item);
    const x=rect.left-bounds.left,y=rect.top-bounds.top;
    if(css.backgroundColor!=='rgba(0, 0, 0, 0)'){
      context.fillStyle=css.backgroundColor;
      context.beginPath();
      context.ellipse(x+rect.width/2,y+rect.height/2,rect.width/2,rect.height/2,0,0,Math.PI*2);
      context.fill();
    }
    if(!item.querySelector('svg')){
      context.fillStyle=css.color;
      context.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      context.textAlign=item.matches('.folio-month > small')?'left':'center';
      context.fillText(item.textContent.trim(),x+(context.textAlign==='left'?0:rect.width/2),y+rect.height/2);
    }
  }
  for(const svg of paper.querySelectorAll('.folio-month svg,.ink-number,.deadline-ring')){
    drawings.push(drawSvg(svg,context,bounds,1));
  }
  return Promise.all(drawings).then(()=>{
    const front=texture(canvas);
    const verso=makeCanvas(canvas.width,canvas.height),back=verso.getContext('2d');
    back.fillStyle=stock;
    back.fillRect(0,0,verso.width,verso.height);
    back.fillStyle=pencil;
    back.globalAlpha=.09;
    back.fillRect(0,0,verso.width,verso.height);
    back.globalAlpha=.06;
    back.translate(verso.width,0);
    back.scale(-1,1);
    back.drawImage(canvas,0,0);
    const backTexture=texture(verso);
    async function refresh(){
      if(!art||!artRect.width)return;
      const sx=canvas.width/bounds.width,sy=canvas.height/bounds.height;
      const x=Math.floor((artRect.left-bounds.left)*sx),y=Math.floor((artRect.top-bounds.top)*sy);
      const w=Math.min(canvas.width-x,Math.ceil(artRect.width*sx)+1),h=Math.min(canvas.height-y,Math.ceil(artRect.height*sy)+1);
      if(w<=0||h<=0||x<0||y<0)return;
      context.fillStyle=stock;
      context.fillRect(x/sx,y/sy,w/sx,h/sy);
      await drawSvg(art,context,bounds,1,artRect);
      const pixels=context.getImageData(x,y,w,h).data;
      for(let i=0;i<h;i++)front.data.set(pixels.subarray(i*w*4,(i+1)*w*4),((y+i)*front.w+x)*4);
      const bx=canvas.width-x-w;
      back.save();
      back.setTransform(1,0,0,1,0,0);
      back.globalAlpha=1;
      back.fillStyle=stock;
      back.fillRect(bx,y,w,h);
      back.globalAlpha=.09;
      back.fillStyle=pencil;
      back.fillRect(bx,y,w,h);
      back.translate(canvas.width,0);
      back.scale(-1,1);
      back.globalAlpha=.06;
      back.drawImage(canvas,x,y,w,h,x,y,w,h);
      back.restore();
      const ghost=back.getImageData(bx,y,w,h).data;
      for(let i=0;i<h;i++)backTexture.data.set(ghost.subarray(i*w*4,(i+1)*w*4),((y+i)*front.w+bx)*4);
    }
    return {front,back:backTexture,refresh};
  });
}

const scenes=new WeakMap();
function planar(sheet){
  const v=[sheet.v[0],sheet.v[NX*NS],sheet.v.at(-1),sheet.v[NS-1]];
  return {v,indices:[0,1,2,0,2,3],perimeter:v};
}
const flat=planar(makeSheet(poses['center-lift'][0]));
const behind=planar(makeSheet(poses['center-lift'].at(-1)));
const meshes=new WeakMap();
function sheetFor(pose){
  if(!meshes.has(pose))meshes.set(pose,makeSheet(pose));
  return meshes.get(pose);
}

function mount(stack){
  if(!stack||scenes.has(stack))return;
  const pad=stack.closest('[data-concertina=true]');
  if(!pad)return;
  const canvas=document.createElement('canvas');
  canvas.className='binder-scene';
  canvas.setAttribute('aria-hidden','true');
  stack.append(canvas);
  const turns=[];
  let current,ground,raster,timer,visible=true,disposed=false;
  function print(paper){
    const style=getComputedStyle(stack);
    const page={paper,ink:null};
    page.ready=capture(paper,style.backgroundColor,style.getPropertyValue('--pencil')).then(ink=>page.ink=ink);
    return page;
  }
  function paint(){
    if(disposed||!ground?.ink||!raster)return;
    raster.begin();
    // The reverse edge still belongs to the object when a turn has finished.
    const first=turns.length===1&&turns[0].index===0;
    const resting=first&&turns[0].forward?turns[0].print:ground;
    if(!resting.ink)return;
    raster.leaf(behind,resting.ink,0);
    raster.leaf(flat,resting.ink,0);
    for(const turn of [...turns].sort((a,b)=>b.month-a.month)){
      if(!first&&turn.print.ink)raster.leaf(sheetFor(turn.frames[turn.index]),turn.print.ink,turn.index%3);
    }
    raster.ctx.putImageData(raster.image,0,0);
    stack.classList.add('binder-ready');
    canvas.dataset.leaves=turns.length;
  }
  function chooseGround(){
    if(!current.ink || turns.some(t=>!t.print.ink))return;
    const highest=turns.reduce((best,t)=>t.baseMonth>best.month?{month:t.baseMonth,page:t.base}:best,{month:current.month,page:current});
    if(highest.page.ink)ground=highest.page;
  }
  async function tick(){
    if(!stack.isConnected||pad.dataset.concertina!=='true'){dispose();return;}
    if(visible&&ground?.ink&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const prints=new Set([ground,...turns.map(t=>t.print)]);
      await Promise.all([...prints].map(p=>p.ink?.refresh()));
      paint();
    }
    if(!disposed)timer=setTimeout(tick,90);
  }
  function resize(){
    const width=stack.clientWidth,height=stack.clientHeight;
    if(!width||!height)return;
    const color=getComputedStyle(pad.querySelector('.calendar-feature')).backgroundColor.match(/[\d.]+/g);
    raster=new Raster(canvas,width,height,color?.slice(0,3).map(Number)||[150,154,140]);
    paint();
  }
  const observer=new ResizeObserver(resize);
  const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{rootMargin:'300px'});
  function dispose(){
    disposed=true;
    clearTimeout(timer);
    observer.disconnect();
    visibility.disconnect();
    for(const turn of turns)clearTimeout(turn.timer);
    stack.querySelectorAll('.binder-waiting-sheet').forEach(node=>node.remove());
    canvas.remove();
    stack.classList.remove('binder-ready');
    scenes.delete(stack);
  }
  function retirePrints(){
    for(const node of stack.querySelectorAll('.binder-waiting-sheet')){
      if(ground?.paper!==node && !turns.some(t=>t.print.paper===node||t.base.paper===node))node.remove();
    }
  }
  async function turn(nextPaper,from,to,inspect,clear){
    const outgoing=current;
    outgoing.month=from;
    outgoing.paper.classList.add('binder-waiting-sheet');
    outgoing.paper.inert=true;
    outgoing.paper.setAttribute('aria-hidden','true');
    const next=print(nextPaper);
    next.month=to;
    current=next;
    const forward=to>from;
    const month=Math.min(from,to);
    const existing=turns.find(leaf=>leaf.month===month);
    // Reverse from the drawing that is on screen. A repeated crossing of a
    // month boundary uses the same physical sheet and the same printed face.
    for(const leaf of turns){
      const step=leaf.forward===forward?1:-1;
      if(step===leaf.step)continue;
      leaf.step=step;
      clearTimeout(leaf.timer);
      if(leaf.advance)leaf.timer=setTimeout(leaf.advance,0);
    }
    if(existing){
      await next.ready;
      if(!disposed){
        chooseGround();
        retirePrints();
        paint();
      }
      return;
    }
    const style=forward?'center-lift':'caught-air';
    const frames=forward?poses[style]:poses[style].slice().reverse();
    const t={frames,forward,step:1,index:0,month,baseMonth:Math.max(from,to),
      print:forward?outgoing:next,base:forward?next:outgoing};
    turns.push(t);
    canvas.dataset.binderMotion=style;
    await Promise.all([next.ready,outgoing.ready]);
    if(disposed)return;
    function draw(index){
      if(disposed||!stack.isConnected)return;
      if(index<0||index>=frames.length||matchMedia('(prefers-reduced-motion: reduce)').matches){
        turns.splice(turns.indexOf(t),1);
        chooseGround();
        retirePrints();
        paint();
        if(inspect)clear();
        return;
      }
      const started=performance.now();
      t.index=index;
      chooseGround();
      paint();
      canvas.dataset.frame=String(index+1);
      const hold=(forward===(t.step===1))?frames[index].f:frames[index].r;
      t.advance=()=>draw(t.index+t.step);
      if(inspect)inspect(canvas,index,frames.length,hold,draw);
      else t.timer=setTimeout(t.advance,Math.max(0,hold-(performance.now()-started)));
    }
    draw(0);
  }
  current=print(stack.querySelector('.folio-paper'));
  current.month=calendarMonth;
  ground=current;
  current.ready.then(()=>{if(!disposed){resize();tick();}});
  observer.observe(stack);
  visibility.observe(stack);
  const scene={turn,dispose};
  scenes.set(stack,scene);
  return scene;
}
return {mount,scene:stack=>scenes.get(stack)};
})();
