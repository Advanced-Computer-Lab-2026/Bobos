/* The host renders first. These adapters keep its heading, action buttons, search and table. */
function applyAcademic({root,page,role},variant){
 if(!root||root.querySelector('.as-root'))return;
 const ctx={root,page,role,index:variant,kind:kinds[variant],state:readState(),view:readView(page),canWrite:role===writeRole(page)};
 ctx.head=$(root,'.page-head');ctx.originalTable=$(root,'table');ctx.originalSearch=$(root,'input[type=search]');
 if(!ctx.head)return;
 const original=[...root.childNodes];ctx.shell=el('div','as-root');ctx.shell.dataset.asPage=page;ctx.shell.dataset.arrangement=ctx.kind;ctx.shell.dataset.role=role;
 ctx.shell.append(ctx.head);ctx.notice=el('div','as-notice-region');ctx.shell.append(ctx.notice);ctx.filters=el('div','as-filter-region');ctx.shell.append(ctx.filters);ctx.body=el('div','as-workspace');ctx.shell.append(ctx.body);ctx.footer=el('footer','as-page-footer');ctx.shell.append(ctx.footer);
 for(const node of original)if(node!==ctx.head)node.remove();root.append(ctx.shell);
 if(!pageReadRoles[page]?.includes(role)){
  ctx.head.querySelector('.actions')?.remove();ctx.body.innerHTML=emptyHTML('This page is not available for your role','Use the Portal navigation to return to an authorized workspace.','');ctx.footer.textContent='Role access follows the supplied API route boundaries.';return;
 }
 if(!ctx.canWrite){$$ (ctx.head,'[data-action],a.btn.primary').forEach(n=>n.remove());const a=$(ctx.head,'.actions');if(a&&!a.children.length)a.remove();}
 if(page==='courses'){$(ctx.head,'p')?.remove();}
 if(page==='template-detail'&&!$(ctx.head,'[data-page="templates"]')){$(ctx.head,'.actions')?.insertAdjacentHTML('afterbegin','<a class="btn" href="'+href('templates')+'" data-page="templates">Back to templates</a>');}
 ctx.draw=()=>{
  if(!ctx.shell.isConnected)return;
  ctx.state=readState();
  if(page==='course-detail')drawCourseDetail(ctx);
  else if(page==='template-detail')drawTemplateDetail(ctx);
  else{ctx.allRecords=recordsFor(ctx);ctx.records=filterRecords(ctx,ctx.allRecords);renderArrangement(ctx,ctx.records);}
  remember(page,ctx.view);updateFooter(ctx);
 };
 ctx.shell.addEventListener('click',e=>handleClick(ctx,e));
 ctx.shell.addEventListener('input',e=>handleInput(ctx,e));
 ctx.shell.addEventListener('change',e=>handleChange(ctx,e));
 makeFilters(ctx);ctx.draw();
 // No persistent global listeners: a detached host render is garbage-collectable.
 ctx.shell.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ctx.dialog&&ctx.view.query){ctx.view.query='';const input=$(ctx.filters,'input[type=search]');if(input)input.value='';ctx.draw();}});
}
function makeFilters(ctx){
 const p=ctx.page,v=ctx.view,s=ctx.state;if(['course-detail','template-detail'].includes(p))return;
 const filters=el('div','as-filters');ctx.filters.append(filters);
 if(p==='copy-offerings'){
  v.source||='w25';v.target||=currentTerm;if(!Array.isArray(v.checked))v.checked=s.offerings.filter(o=>o.term===v.source).map(o=>o.id);
  ctx.filters.insertAdjacentHTML('afterbegin',`<div class="as-transfer-terms">${selectField('Source term','source',termOption(s,v.source),'data-as-field="source"')}${taskArt('transfer')}${selectField('Destination term','target',termOption(s,v.target),'data-as-field="target"')}</div>`);
 }
 const search=ctx.originalSearch||el('input');search.type='search';search.removeAttribute('id');search.removeAttribute('data-filter');search.dataset.asField='query';search.placeholder={courses:'Search courses',terms:'Search terms',offerings:'Search offerings',templates:'Search templates','copy-offerings':'Search source offerings','group-assignments':'Search students'}[p];search.setAttribute('aria-label',search.placeholder);search.value=v.query||'';filters.append(search);
 if(['offerings','templates','group-assignments'].includes(p)){v.term||=currentTerm;filters.insertAdjacentHTML('beforeend',`<label class="as-inline-label">Term<select data-as-field="term">${termOption(s,v.term)}</select></label>`);}
 if(p==='courses')filters.insertAdjacentHTML('beforeend',`<select data-as-field="season" aria-label="Offering season"><option value="">All seasons</option>${opt(SEASONS,v.season)}</select>`);
 if(['courses','templates','group-assignments','offerings'].includes(p)){
  const groups=[...new Set(recordsFor(ctx).map(r=>r.group))];filters.insertAdjacentHTML('beforeend',`<select data-as-field="group" aria-label="${p==='courses'?'Department':p==='group-assignments'?'Study group':'Browse group'}"><option value="">${p==='courses'?'All departments':p==='group-assignments'?'All groups':'All records'}</option>${opt(groups.map(g=>[g,g]),v.group)}</select>`);
 }
 if(p==='copy-offerings')filters.insertAdjacentHTML('beforeend',buttonHTML('Select all','select-all')+buttonHTML('Clear selection','select-none'));
 if(!ctx.canWrite)filters.insertAdjacentHTML('beforeend','<span class="as-readonly">Read-only access</span>');
}
function updateFooter(ctx){
 const p=ctx.page,v=ctx.view;
 let left=['course-detail','template-detail'].includes(p)?(p==='template-detail'?(v.dirty?'Unsaved working copy':'Saved template'):'Catalogue record'):`${ctx.records?.length||0} of ${ctx.allRecords?.length||0} records`;
 if(p==='copy-offerings')left=`${v.checked?.length||0} selected · duplicates will be skipped`;
 ctx.footer.innerHTML=`<span>${escape(left)}</span><span class="as-preview-note">Preview records · stored in this browser</span>${p==='copy-offerings'?buttonHTML('Review transfer','copy-review','',true):''}`;
}
function handleInput(ctx,e){
 if(e.target.closest('dialog'))return;
 if(e.target.matches('[data-as-field="query"]')){e.stopPropagation();ctx.view.query=e.target.value;ctx.draw();}
 if(e.target.matches('[data-as-template]')){e.stopPropagation();const field=e.target.dataset.asTemplate,t=ensureDraft(ctx);t[field]=field==='semester'?Number(e.target.value):e.target.value;ctx.view.dirty=true;remember(ctx.page,ctx.view);updateFooter(ctx);if(field==='group')$(ctx.head,'h1').textContent=t.group?'Group '+t.group:'New schedule template';}
}
function handleChange(ctx,e){
 if(e.target.closest('dialog'))return;
 const input=e.target;
 if(input.matches('[data-as-field]')){e.stopPropagation();const f=input.dataset.asField;ctx.view[f]=input.value;
  if(f==='source')ctx.view.checked=ctx.state.offerings.filter(o=>o.term===input.value).map(o=>o.id);
  if(f==='term'){ctx.view.group='';const g=$(ctx.filters,'[data-as-field="group"]');if(g){const groups=[...new Set(recordsFor(ctx).map(r=>r.group))];g.innerHTML='<option value="">All records</option>'+opt(groups.map(x=>[x,x]),'');}}
  ctx.draw();return;
 }
 if(input.matches('[data-as-check]')){e.stopPropagation();ctx.view.checked=(ctx.view.checked||[]).filter(id=>id!==input.dataset.asCheck);if(input.checked)ctx.view.checked.push(input.dataset.asCheck);remember(ctx.page,ctx.view);updateFooter(ctx);return;}
 if(input.matches('[data-as-compare]')){e.stopPropagation();let ids=(ctx.view.compare||[]).filter(id=>id!==input.dataset.asCompare);if(input.checked){if(ids.length>=4){input.checked=false;announce(ctx,'Compare up to four records at a time.',true);return;}ids.push(input.dataset.asCompare);}ctx.view.compare=ids;ctx.draw();return;}
 if(input.matches('[data-as-template-slot]')){e.stopPropagation();const t=ensureDraft(ctx),entry=t.entries[Number(input.dataset.asTemplateSlot)],o=offeringBy(ctx.state,entry.offering),type=input.dataset.type;entry.slots=entry.slots.filter(id=>o.slots.find(x=>x.id===id)?.type!==type);if(input.value)entry.slots.push(input.value);ctx.view.dirty=true;ctx.draw();return;}
 if(input.matches('select[data-as-template]')){e.stopPropagation();const t=ensureDraft(ctx);t[input.dataset.asTemplate]=input.value;ctx.view.dirty=true;ctx.draw();}
}
function navigateCourse(ctx,id){
 const c=courseBy(ctx.state,id);if(!c)return;
 const view=readView('course-detail');view.courseId=id;remember('course-detail',view);
 if(typeof selectedCourse!=='undefined')selectedCourse=[displayCode(c.code),c.name,c.department||c.majors.map(majorLabel).join(', '),String(c.credits),titleCase(c.seasons[0])];
 navigate('course-detail');
}
function navigateTemplate(ctx,id){const view=readView('template-detail');view.templateId=id;view.draft=null;view.dirty=false;view.buildStep=0;remember('template-detail',view);navigate('template-detail');}
function handleClick(ctx,event){
 const button=event.target.closest('[data-as-action],[data-action],a[data-page]');if(!button||!ctx.shell.contains(button))return;
 if(button.hasAttribute('data-as-close'))return;
 const originalAction=button.dataset.action,action=button.dataset.asAction||({
  'add-course':'course-new','edit-course':'course-edit','import-csv':'course-import','create-term':'term-new','manage-term':'term-edit','add-offering':ctx.page==='template-detail'?'template-add':'offering-new','manage-sections':'offering-view','copy-confirm':'copy-review','publish':'template-publish','save-draft':'template-draft','assign-group':'assignment'
 }[originalAction]);
 if(button.matches('a[data-page="template-detail"]')){event.preventDefault();event.stopPropagation();navigateTemplate(ctx,'new');return;}
 if(!action)return;
 event.preventDefault();event.stopPropagation();const id=button.dataset.id;
 // Mutation controls are both hidden and checked; console calls still hit the domain guard.
 const writeActions=['course-new','course-edit','course-import','term-new','offering-new','offering-edit','slot-edit','publication','copy-review','template-add','template-remove','template-publish','template-draft','delete-course','delete-offering','delete-slot','delete-template','unassign'];
 if(writeActions.includes(action)&&!ctx.canWrite){announce(ctx,'This action is not available for your role.',true);return;}
 switch(action){
 case 'dismiss':ctx.notice.innerHTML='';break;
 case 'dialog-close':closeModal(ctx);break;
 case 'clear':ctx.view.query='';ctx.view.group='';ctx.view.status='';ctx.view.season='';$$ (ctx.filters,'[data-as-field="query"],[data-as-field="group"],[data-as-field="season"]').forEach(x=>x.value='');ctx.draw();break;
 case 'select':ctx.view.selected=id;ctx.draw();break;
 case 'group':ctx.view.group=button.dataset.group;const select=$(ctx.filters,'[data-as-field="group"]');if(select)select.value=ctx.view.group;ctx.draw();break;
 case 'step':{const i=ctx.records.findIndex(r=>r.id===ctx.view.selected);ctx.view.selected=ctx.records[Math.max(0,Math.min(ctx.records.length-1,i+Number(button.dataset.step)))].id;ctx.draw();break;}
 case 'section-step':ctx.view.section=(ctx.view.section||0)+Number(button.dataset.step);ctx.draw();break;
 case 'build-step':ctx.view.buildStep=Number(button.dataset.step);ctx.draw();break;
 case 'course-view':navigateCourse(ctx,id);break;
 case 'course-new':openCourseEditor(ctx);break;
 case 'course-edit':openCourseEditor(ctx,id||ctx.course?.id);break;
 case 'course-import':openImport(ctx);break;
 case 'term-new':openTermEditor(ctx);break;
 case 'term-edit':openTermEditor(ctx,id);break;
 case 'offering-new':openOfferingEditor(ctx);break;
 case 'offering-view':openOffering(ctx,id);break;
 case 'offering-edit':openOfferingEditor(ctx,id);break;
 case 'slot-edit':openSlotEditor(ctx,button.dataset.offering,id);break;
 case 'publication':openPublication(ctx,id);break;
 case 'copy-review':openCopyReview(ctx);break;
 case 'destination':{const view=readView('offerings');view.term=button.dataset.term;view.group='';view.query='';remember('offerings',view);navigate('offerings');break;}
 case 'select-all':ctx.view.checked=ctx.records.map(r=>r.id);ctx.draw();break;
 case 'select-none':ctx.view.checked=[];ctx.draw();break;
 case 'template-view':navigateTemplate(ctx,id);break;
 case 'template-add':openTemplateAdd(ctx);break;
 case 'template-remove':ensureDraft(ctx).entries.splice(Number(button.dataset.index),1);ctx.view.dirty=true;ctx.draw();break;
 case 'template-publish':saveTemplate(ctx,true);break;
 case 'template-draft':saveTemplate(ctx,false);break;
 case 'assignment':openAssignment(ctx,id);break;
 case 'unassign':openUnassign(ctx,id);break;
 case 'delete-course':openDelete(ctx,'course',id);break;
 case 'delete-offering':openDelete(ctx,'offering',id);break;
 case 'delete-slot':openDelete(ctx,'slot',id,button.dataset.offering);break;
 case 'delete-template':openDelete(ctx,'template',id);break;
 }
}
