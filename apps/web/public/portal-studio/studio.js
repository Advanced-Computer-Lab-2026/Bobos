'use strict';

const workspaces = [
  {name:'Workbench', title:'Academic workbench', columns:'11fr 10fr', rows:['queue review','week week','activity activity'], inlineDates:true},
  {name:'Reading Room', title:'Winter term', columns:'4fr 3fr', rows:['cover cover','main rail'], lanes:{main:['review','queue'],rail:['dates','activity']}},
  {name:'Advising Desk', title:'Advising desk', columns:'1fr 1fr', rows:['dispatch dispatch','activity dates','queue queue']},
  {name:'Termbook', title:'Term calendar', columns:'5fr 4fr', rows:['week week','review queue','activity activity'], inlineDates:true},
  {name:'Paper Trail', title:'Schedule register', columns:'3fr 2fr', rows:['register capacity','register dates','activity queue']},
  {name:'Open Cases', title:'Open cases', columns:'1fr 1fr 1fr', rows:['queue queue capacity','review review dates','activity activity dates']},
  {name:'Common Room', title:'Student services', columns:'3fr 2fr', rows:['people activity','people queue','review review']},
  {name:'Field Notes', title:'Schedule activity', columns:'2fr 3fr', rows:['activity dispatch','dates dispatch','queue review']},
  {name:'Course Atlas', title:'Academic catalogue', columns:'2fr 1fr', rows:['courses dates','courses queue','capacity activity']},
  {name:'Seminar', title:'Teaching week', columns:'1fr 1fr', rows:['week week','courses review','activity activity']},
  {name:'Command', title:'Workspace', columns:'1fr 1fr', rows:['review queue','week week','activity activity'], inlineDates:true},
  {name:'Inbox', title:'Review inbox', columns:'3fr 2fr', rows:['capacity capacity','dispatch dispatch','queue activity']},
  {name:'Operations', title:'Scheduling operations', columns:'1fr 1fr 1fr', rows:['capacity capacity capacity','queue dates activity','register register register']},
  {name:'Review Grid', title:'Student drafts', columns:'2fr 1fr', rows:['register review','register queue','dates activity']},
  {name:'Live Rail', title:'Workspace activity', columns:'1fr 2fr', rows:['activity command','activity queue','dates review']},
  {name:'Weekly', title:'Schedule this week', columns:'3fr 2fr', rows:['week week','dates review','activity queue']},
  {name:'Course Hub', title:'Course planning', columns:'1fr 1fr', rows:['courses courses','capacity command','dates queue']},
  {name:'People Search', title:'Find a student', columns:'3fr 2fr', rows:['command command','people dispatch','activity dispatch']},
  {name:'Quick Queue', title:'Pending decisions', columns:'1fr 1fr', rows:['queue queue','review capacity','activity dates']},
  {name:'Overview Plus', title:'Academic overview', columns:'2fr 3fr', rows:['brief brief','dates register','activity register']},
  {name:'Claude Study', family:0, title:'Semester desk', columns:'1fr 1fr', rows:['queue queue','week week','review activity'], inlineDates:true},
];
const layoutNames = workspaces.map(view => view.name);
const palettes = [
  ['Graphite','#e9e8e4','#f1f0ec','#202123','#5e6268','#274e88','#a8c5ff'],
  ['Parchment','#ebe6dc','#f2ede3','#292723','#5e5549','#8c4c36','#e6a98f'],
  ['Glacier Glass','#e4ecec','#edf2f1','#16272c','#48616a','#00677e','#98d9e9'],
  ['Periwinkle Rain','#e8e8f1','#eeedf4','#232744','#565b79','#444cad','#b3b9ff'],
  ['Ice Pop','#e5ebf1','#edf1f5','#17263c','#465a77','#175ca5','#92c8ff'],
  ['Hydrangea','#e6e9f1','#edecf4','#242842','#5e6281','#4b57ad','#b7c0ff'],
  ['Portal Blue','#e5ebf1','#edf0f4','#202939','#516175','#285bb2','#8db7ff'],
  ['Claude-inspired','#f2eee6','#f9f6ef','#302b25','#655d52','#914a33','#eab293'],
  ['Vivid Studio','#f2eee7','#f9f7f3','#292c35','#575e6d','#2858b4','#95baff'],
  ['Console tones','#f0eee6','#f8f6ef','#302d28','#615c52','#285ca1','#8dbbfa',['#151515','#151515','#efeee9','#bdbbb0']]
];

const studioQuery = new URLSearchParams(location.search);
const productionPreview = studioQuery.get('preview') === 'live' || (!studioQuery.has('layout') && studioQuery.get('preview') !== 'studio');
const lab = {layout:0,palette:6,dark:true};
const layoutFamily = index => workspaces[index].family ?? (index < 10 ? 0 : 1);
const family = () => layoutFamily(lab.layout);
const lastLayouts = [0,10];
function restoreLook(params) {
  if (productionPreview) {
    Object.assign(lab, {layout:workspaces.findIndex(view=>view.name==='Claude Study'),palette:9,dark:localStorage.getItem('portal.theme') !== 'light'});
    applyLook();
    return;
  }
  const layout = Number(params.get('layout')) - 1;
  const palette = Number(params.get('palette')) - 1;
  lab.layout = workspaces[layout] ? layout : 0;
  lab.palette = palettes[palette] ? palette : 6;
  const requested = params.get('mode');
  lab.dark = requested === 'dark' || (requested !== 'light' && [6,9].includes(lab.palette));
  lastLayouts[family()] = lab.layout;
  applyLook();
}
function applyLook() {
  const [, lightGround, lightSurface, lightInk, lightMuted, lightAccent, darkAccent, darkTones] = palettes[lab.palette];
  const chat = family() === 1;
  const warm = palettes[lab.palette][0] === 'Claude-inspired';
  const [ground,surface,ink,muted] = lab.dark ? (darkTones || [
    warm ? '#121212' : '#141414',
    warm ? '#1b1b1b' : chat ? '#1c1c1d' : '#1b1a19',
    warm ? '#f5f4f2' : '#f0efed',
    warm ? '#c1c0be' : '#bbb8b4'
  ]) : [lightGround,lightSurface,lightInk,lightMuted];
  const accent = lab.dark ? darkAccent : lightAccent;
  document.documentElement.dataset.theme = lab.dark ? 'dark' : 'light';
  document.body.classList.add('portal-studio');
  document.body.classList.toggle('live-preview',productionPreview);
  document.body.classList.toggle('chat-family',chat);
  document.body.classList.toggle('claude-family',!chat);
  document.body.dataset.palette = palettes[lab.palette][0].toLowerCase().replaceAll(' ','-');
  document.body.dataset.workspace = workspaces[lab.layout].name.toLowerCase().replaceAll(' ','-');
  document.querySelector('link[rel=icon]').href = 'portal-card-index.svg';
  for (const [key,value] of Object.entries({ground,surface,ink,muted,accent})) {
    document.body.style.setProperty('--studio-' + key,value);
  }
}
function saveLook() {
  const params = {layout:lab.layout+1,palette:lab.palette+1,mode:lab.dark?'dark':'light'};
  const url = new URL(location.href);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  history.replaceState(null,'',url);
  for (const anchor of document.querySelectorAll('a[data-page]')) {
    const target = new URL(anchor.href);
    for (const [key,value] of Object.entries(params)) target.searchParams.set(key,value);
    anchor.href = target;
  }
}
function mountControls(roles,screens,changeLayout) {
  const options = data => Object.entries(data).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
  const controls = document.querySelector('#design-controls');
  if (productionPreview) {
    controls.hidden = true;
    return;
  }
  controls.innerHTML = `<div class="studio-title"><span>Design studio</span></div>
    <div class="style-controls"><nav aria-label="Style family">
      <button type="button" data-family="0">Claude style</button>
      <button type="button" data-family="1">ChatGPT style</button>
    </nav><label class="style-picker"><span class="sr-only">Workspace layout</span><select id="layout-select"></select><span id="layout-count"></span></label></div>
    <div class="preview-actions"><button type="button" id="theme-switch" aria-label="Dark mode" aria-pressed="true"></button>
      <button type="button" id="preview-settings" popovertarget="studio-settings" aria-label="Preview settings">Appearance <span aria-hidden="true">⌄</span></button></div>
    <div id="studio-settings" popover>
      <label>Palette<select id="palette-select">${options(palettes.map(p=>p[0]))}</select></label>
      <label>Role<select id="role-select">${options(roles)}</select></label>
      <label>Screen<select id="page-select">${options(screens)}</select></label>
    </div>`;

  function selectLayout(index) {
    lab.layout=index;
    lastLayouts[family()]=index;
    applyLook();
    saveLook();
    changeLayout();
  }
  controls.addEventListener('click',event=>{
    const button=event.target.closest('[data-family], #theme-switch');
    if (!button) return;
    if (button.dataset.family!==undefined) {
      const index=Number(button.dataset.family);
      if (index!==family()) selectLayout(lastLayouts[index]);
    } else {
      lab.dark=!lab.dark;
      applyLook();
      saveLook();
      syncTheme();
    }
  });
  controls.querySelector('#layout-select').addEventListener('change',event=>selectLayout(Number(event.target.value)));
  controls.querySelector('#palette-select').addEventListener('change',event=>{
    lab.palette=Number(event.target.value);
    applyLook();
    saveLook();
  });
}
function syncTheme() {
  const toggle=document.querySelector('#theme-switch');
  toggle.innerHTML=lab.dark?icon('moon')+' Dark':icon('sun')+' Light';
  toggle.setAttribute('aria-pressed',String(lab.dark));
}
function syncControls(role,page) {
  if (productionPreview) return;
  document.querySelector('#role-select').value=role;
  document.querySelector('#page-select').value=page;
  document.querySelector('#palette-select').value=lab.palette;
  const select=document.querySelector('#layout-select');
  if (select.dataset.listedFamily!==String(family())) {
    select.innerHTML=workspaces.map((view,index)=>layoutFamily(index)===family() ? `<option value="${index}">${view.name}</option>` : '').join('');
    select.dataset.listedFamily=family();
  }
  select.value=lab.layout;
  document.querySelector('#layout-count').textContent=`${select.selectedIndex+1} / ${select.options.length}`;
  document.querySelectorAll('[data-family]').forEach(item=>item.setAttribute('aria-pressed',String(Number(item.dataset.family)===family())));
  for (const id of ['role-select','page-select']) {
    document.querySelector('#'+id).closest('label').hidden=['login','forgot','reset'].includes(page);
  }
  syncTheme();
}
restoreLook(new URLSearchParams(location.search));
