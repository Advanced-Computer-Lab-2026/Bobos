function courseDetailSections(ctx){
 const s=ctx.state;let code=typeof selectedCourse!=='undefined'?selectedCourse[0].replace(/\s/g,''):'';const c=s.courses.find(x=>x.code===code)||courseBy(s,ctx.view.courseId)||s.courses[0];ctx.course=c;
 const prerequisites=c.prerequisites.map(id=>courseBy(s,id)).filter(Boolean),dependents=s.courses.filter(x=>x.prerequisites.includes(c.id)),offerings=s.offerings.filter(o=>o.course===c.id);
 const sections=[
  {id:'information',title:'Course information',content:factsHTML([['Course code',displayCode(c.code)],['Course name',c.name],['Credit hours',c.credits],['Department',c.department||c.majors.map(majorLabel).join(', ')],['Recommended semester',c.semester],['Course type',titleCase(c.type)],['Catalogue status',c.active?'Active':'Inactive']])},
  {id:'availability',title:'Teaching & availability',content:factsHTML([['Offering seasons',c.seasons.map(titleCase).join(', ')],['Faculty / major',c.majors.map(majorLabel).join(', ')],['Lecture contact hours',c.hours?.[0]||0],['Tutorial contact hours',c.hours?.[1]||0],['Lab contact hours',c.hours?.[2]||0]])},
  {id:'prerequisites',title:'Prerequisites',content:prerequisites.map(pre=>`<div class="as-related-course"><div class="as-identity">${courseMark(pre)}<div><strong>${escape(displayCode(pre.code))}</strong><small>${escape(pre.name)}</small></div></div>${buttonHTML('View course','course-view',`data-id="${pre.id}"`)}</div>`).join('')||'<p>No prerequisites listed.</p>'},
  {id:'offerings',title:'Term offerings',content:offerings.map(o=>`<div class="as-related-course"><div><strong>${escape(termLabel(termBy(s,o.term)))}</strong><small>${o.slots.length} teaching meetings · ${o.published?'Published':'Draft'}</small></div>${['administrator','coordinator'].includes(ctx.role)?buttonHTML('View groups','offering-view',`data-id="${o.id}"`):''}</div>`).join('')||'<p>No term offerings yet.</p>'}
 ];
 ctx.dependents=dependents;ctx.prerequisites=prerequisites;return sections;
}
function drawCourseDetail(ctx){
 const sections=courseDetailSections(ctx),kind=ctx.kind,c=ctx.course;$(ctx.head,'h1').textContent=c.name;const sub=$(ctx.head,'p');if(sub)sub.textContent=`${displayCode(c.code)} · ${c.department||c.majors.map(majorLabel).join(', ')}`;
 const article=(section)=>`<section class="as-detail-section" id="as-section-${section.id}" tabindex="-1"><h2>${section.title}</h2>${section.content}</section>`;
 ctx.body.className=`as-detail-layout as-detail-${kind}`;
 if(kind==='index'){ctx.body.innerHTML=`<nav class="as-section-nav" aria-label="Course sections">${sections.map(x=>`<a href="#as-section-${x.id}">${x.title}</a>`).join('')}</nav><div>${sections.map(article).join('')}</div>`;}
 else if(kind==='folders'){ctx.body.innerHTML=sections.map((x,i)=>`<details class="as-folder" ${i<2?'open':''}><summary>${taskArt('file')}<span>${x.title}</span></summary><div class="as-folder-body">${x.content}</div></details>`).join('');}
 else if(kind==='focus'){
  const i=Math.max(0,Math.min(3,ctx.view.section||0));ctx.body.innerHTML=`<nav class="as-focus-nav" aria-label="Course information sections">${buttonHTML('Previous','section-step',`data-step="-1" ${i===0?'disabled':''}`)}<span>${i+1} of 4 · ${sections[i].title}</span>${buttonHTML('Next','section-step',`data-step="1" ${i===3?'disabled':''}`)}</nav>${article(sections[i])}`;
 }
 else if(kind==='matrix'){
  const fields=[['Code',displayCode(c.code)],['Name',c.name],['Department',c.department||c.majors.map(majorLabel).join(', ')],['Type',titleCase(c.type)],['Credit hours',c.credits],['Recommended semester',c.semester],['Offering seasons',c.seasons.map(titleCase).join(', ')],['Prerequisites',ctx.prerequisites.map(x=>displayCode(x.code)).join(', ')||'None']];ctx.body.innerHTML=`<div class="as-table-scroll"><table class="as-spec"><caption>Catalogue specification</caption><thead><tr><th scope="col">Attribute</th><th scope="col">Recorded value</th></tr></thead><tbody>${fields.map(([l,v])=>`<tr><th scope="row">${l}</th><td>${escape(v)}</td></tr>`).join('')}</tbody></table></div>${article(sections[3])}`;
 }
 else if(kind==='plan'||kind==='queue'){
  ctx.body.innerHTML=`<div class="as-dependency-map"><section><small>Before this course</small><h2>Prerequisites</h2>${sections[2].content}</section><div class="as-dependency-current">${courseMark(c)}<small>Semester ${c.semester}</small><h2>${escape(displayCode(c.code))}</h2><p>${escape(c.name)}</p></div><section><small>After this course</small><h2>Dependent courses</h2>${ctx.dependents.map(x=>`<div class="as-related-course"><strong>${escape(displayCode(x.code))}</strong>${buttonHTML('View course','course-view',`data-id="${x.id}"`)}</div>`).join('')||'<p>No dependent courses listed.</p>'}</section></div><div class="as-detail-support">${[sections[0],sections[1],sections[3]].map(article).join('')}</div>`;
  if(kind==='queue')ctx.body.classList.add('as-trail');
 }
 else if(kind==='compare'){ctx.body.innerHTML=`<div class="as-catalogue-column"><h2 class="as-column-label">Catalogue · permanent record</h2>${sections.slice(0,3).map(article).join('')}</div><div class="as-term-column"><h2 class="as-column-label">Term · teaching delivery</h2>${article(sections[3])}<p class="as-note">Instructors, rooms, capacity and publication belong to each offering—not the course catalogue.</p></div>`;}
 else ctx.body.innerHTML=sections.map(article).join('');
 if(ctx.canWrite&&!$(ctx.head,'[data-as-action="delete-course"]'))$(ctx.head,'.actions')?.insertAdjacentHTML('beforeend',buttonHTML('Delete course','delete-course',`data-id="${c.id}"`));else{const b=$(ctx.head,'[data-as-action="delete-course"]');if(b)b.dataset.id=c.id;}
}
function ensureDraft(ctx){
 if(ctx.view.draft)return ctx.view.draft;
 const id=ctx.view.templateId||'template-4';const t=templateBy(ctx.state,id)||ctx.state.templates.find(t=>t.group==='4');
 ctx.view.draft=id==='new'?{id:'',term:ctx.view.term||currentTerm,major:'CS',semester:7,group:'',entries:[],published:false,version:0}:clone(t);ctx.view.templateId=ctx.view.draft.id||'new';return ctx.view.draft;
}
function templateMetadata(ctx,t){
 return `<div class="as-template-meta as-formgrid">${field('Study group','group',t.group,'text','data-as-template="group" required')}${selectField('Major','major',opt([['CS','Computer Engineering'],['DMET','Digital Media Engineering']],t.major),'data-as-template="major"')}${field('Semester','semester',t.semester,'number','min="1" max="10" data-as-template="semester" required')}${selectField('Term','term',termOption(ctx.state,t.term),'data-as-template="term"')}</div>`;
}
function templateEntryHTML(ctx,e,index){
 const o=offeringBy(ctx.state,e.offering),c=courseBy(ctx.state,o?.course);if(!o||!c)return `<article class="as-template-entry"><p>Selected offering is no longer available.</p>${buttonHTML('Remove course','template-remove',`data-index="${index}"`)}</article>`;
 const types=[...new Set(o.slots.map(x=>x.type))];
 return `<article class="as-template-entry" data-entry="${index}"><header><div class="as-identity">${recordTitle({course:c,title:displayCode(c.code),sub:c.name})}</div>${buttonHTML('Remove','template-remove',`data-index="${index}"`)}</header><div class="as-component-fields">${types.map(type=>{const slots=o.slots.filter(s=>s.type===type).filter((s,i,all)=>all.findIndex(x=>x.group===s.group)===i),chosen=e.slots.find(id=>o.slots.find(x=>x.id===id)?.type===type);return `<label>${titleCase(type)} group<select data-as-template-slot="${index}" data-type="${type}" aria-label="${escape(c.code+' '+type+' group')}"><option value="">Choose group</option>${slots.map(slot=>`<option value="${slot.id}" ${chosen===slot.id?'selected':''}>${escape(slot.group)} · ${slot.day.slice(0,3)} ${time(slot.start)} · ${escape(slot.room)} · ${remaining(slot)} free</option>`).join('')}</select></label>`;}).join('')}</div></article>`;
}
function drawTemplateDetail(ctx){
 const t=ensureDraft(ctx),errors=validateTemplate(ctx.state,t),kind=ctx.kind;ctx.template=t;$(ctx.head,'h1').textContent=t.group?'Group '+t.group:'New schedule template';const sub=$(ctx.head,'p');if(sub)sub.textContent=`${majorLabel(t.major)} · Semester ${t.semester} · ${termLabel(termBy(ctx.state,t.term))}`;
 const meta=`<section class="as-template-section" id="as-template-cohort"><h2>Template details</h2>${templateMetadata(ctx,t)}</section>`;
 const entries=t.entries.map((e,i)=>templateEntryHTML(ctx,e,i));
 const courseHeader=`<header class="as-section-head"><h2>Course groups</h2>${buttonHTML('Add course','template-add','',false)}</header>`;
 let courses=`<section class="as-template-section as-template-courses" id="as-template-courses">${courseHeader}<div class="as-template-entries">${entries.join('')||'<p class="as-note">Add published offerings from this term. Choose one group per available component.</p>'}</div></section>`;
 const week=`<section class="as-template-section as-template-week" id="as-template-week"><h2>Weekly timetable</h2>${weeklyHTML(ctx.state,expandTemplate(ctx.state,t))}</section>`;
 const validation=`<section class="as-template-section as-template-review" id="as-template-review"><h2>Readiness review</h2>${errors.length?issueHTML(errors):'<p class="as-ready">No component or timetable conflicts found.</p>'}<p class="as-note">${t.id?'Editing this template does not silently replace existing processed schedules. Reassignment applies the new version.':'New templates become available to group assignment only after publication.'}</p></section>`;
 ctx.body.className=`as-template-layout as-template-${kind}`;
 if(kind==='folders'){courses=`<section class="as-template-section as-template-courses">${courseHeader}${t.entries.map((e,i)=>`<details class="as-folder" open><summary><span>${escape(displayCode(courseBy(ctx.state,offeringBy(ctx.state,e.offering)?.course)?.code))}</span><small>Component groups</small></summary>${entries[i]}</details>`).join('')||'<p>No courses added yet.</p>'}</section>`;}
 if(kind==='focus'){
  const step=Math.max(0,Math.min(2,ctx.view.buildStep||0));ctx.body.innerHTML=`<nav class="as-build-steps" aria-label="Template editor steps">${['Cohort','Course groups','Review & timetable'].map((l,i)=>buttonHTML(`${i+1}. ${l}`,'build-step',`data-step="${i}" aria-current="${i===step?'step':'false'}"`)).join('')}</nav>${step===0?meta:step===1?courses:validation+week}<div class="as-form-footer">${step>0?buttonHTML('Back','build-step',`data-step="${step-1}"`):''}${step<2?buttonHTML('Continue','build-step',`data-step="${step+1}"`):''}</div>`;return;
 }
 if(kind==='index'){ctx.body.innerHTML=`<nav class="as-section-nav" aria-label="Template sections"><a href="#as-template-cohort">Template details</a><a href="#as-template-courses">Course groups</a><a href="#as-template-week">Timetable</a><a href="#as-template-review">Readiness</a></nav><div>${meta+courses+week+validation}</div>`;return;}
 if(kind==='queue')ctx.body.innerHTML=validation+courses+meta+week;
 else if(kind==='plan')ctx.body.innerHTML=week+meta+courses+validation;
 else if(kind==='desk')ctx.body.innerHTML=`<div>${meta+courses}</div><div>${week+validation}</div>`;
 else if(kind==='compare'){
  const original=templateBy(ctx.state,t.id);ctx.body.innerHTML=`<div class="as-template-current"><h2>Saved version ${original?.version||'—'}</h2>${original?weeklyHTML(ctx.state,expandTemplate(ctx.state,original)):'<p>No saved version yet.</p>'}${original?factsHTML([['Study group',original.group],['Courses',original.entries.length],['State',original.published?'Published':'Draft']]):''}</div><div class="as-template-working"><h2>Working copy</h2>${meta+courses+week+validation}</div>`;
 }else if(kind==='matrix'){
  const cols=t.entries.map(e=>{const o=offeringBy(ctx.state,e.offering);return {e,o,c:courseBy(ctx.state,o?.course)};});
  const matrix=`<section class="as-template-section as-template-courses">${courseHeader}<div class="as-table-scroll"><table class="as-matrix"><thead><tr><th scope="col">Component</th>${cols.map(({c},i)=>`<th scope="col">${escape(displayCode(c?.code))}${buttonHTML('Remove','template-remove',`data-index="${i}"`)}</th>`).join('')}</tr></thead><tbody>${['lecture','tutorial','lab'].map(type=>`<tr><th scope="row">${titleCase(type)}</th>${cols.map(({e,o,c},i)=>{const slots=o?.slots.filter(x=>x.type===type).filter((x,j,all)=>all.findIndex(y=>y.group===x.group)===j)||[];return `<td>${slots.length?`<select data-as-template-slot="${i}" data-type="${type}" aria-label="${escape(c?.code+' '+type+' group')}"><option value="">Choose group</option>${slots.map(x=>`<option value="${x.id}" ${e.slots.includes(x.id)?'selected':''}>${escape(x.group)} · ${x.day.slice(0,3)} ${time(x.start)} · ${remaining(x)} free</option>`).join('')}</select>`:'Not required'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></section>`;ctx.body.innerHTML=meta+matrix+week+validation;
 }else ctx.body.innerHTML=meta+courses+week+validation;
}
function openTemplateAdd(ctx){
 const t=ensureDraft(ctx),available=ctx.state.offerings.filter(o=>o.term===t.term&&o.published&&!t.entries.some(e=>e.offering===o.id)&&o.eligible.some(g=>(g.major===t.major||g.major==='All')&&+g.semester===+t.semester));
 showModal(ctx,{title:'Add a published course',body:`<p>Only published offerings for this term and cohort are available.</p>${available.length?selectField('Course offering','offering',available.map(o=>{const c=courseBy(ctx.state,o.course);return `<option value="${o.id}">${escape(displayCode(c.code))} · ${escape(c.name)}</option>`;}).join('')):'<p class="as-note">No additional eligible, published offerings are available. An Administrator must publish an eligible offering first.</p>'}`,submit:'Add to working copy',onSubmit:fd=>{const o=offeringBy(ctx.state,fd.get('offering'));if(!o)throw new DomainError('Choose an eligible published offering.');const slots=[...new Set(o.slots.map(s=>s.type))].map(type=>o.slots.find(s=>s.type===type&&s.group===t.group)||o.slots.find(s=>s.type===type));t.entries.push({offering:o.id,slots:slots.map(s=>s.id)});ctx.view.dirty=true;remember(ctx.page,ctx.view);closeModal(ctx);ctx.draw();announce(ctx,'Course added to the working copy. Review component groups before saving.');}});
}
function saveTemplate(ctx,published){
 const draft=clone(ensureDraft(ctx));draft.published=published;
 try{const result=commit(ctx,'saveTemplate',draft);ctx.view.templateId=result.id;ctx.view.draft=clone(templateBy(ctx.state,result.id));ctx.view.dirty=false;remember(ctx.page,ctx.view);ctx.draw();announce(ctx,result.message);}catch(error){announce(ctx,error.message,true);const review=$(ctx.body,'.as-template-review');if(review){review.innerHTML='<h2>Readiness review</h2>'+issueHTML(error.issues||[{message:error.message}]);review.tabIndex=-1;review.focus();}else showModal(ctx,{title:'Review template before saving',body:issueHTML(error.issues||[{message:error.message}]),readonly:true});}
}
