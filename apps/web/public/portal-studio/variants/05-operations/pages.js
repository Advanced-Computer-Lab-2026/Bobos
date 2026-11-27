/* Portal operations · additive host plugin. No shell, auth, navigation or global handlers. */
(() => {
  'use strict';
  const base = new URL('.', document.currentScript.src);
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet'; sheet.href = new URL('operations.css', base).href;
  sheet.dataset.operations05 = 'styles'; document.head.append(sheet);
  const names = {
    'pending-work': ['Blocker register', 'Advisor desk', 'Work lanes', 'Student files', 'Oldest first', 'Compare blockers', 'Dispatch inbox', 'Request batches', 'One student at a time', 'Action register'],
    'schedule-activity': ['Processing journal', 'Search desk', 'Action lanes', 'Student dossiers', 'Time trail', 'Compare events', 'Event inbox', 'Day book', 'One event at a time', 'Audit register'],
    'financial-records': ['Payment ledger', 'Reconciliation desk', 'Settlement lanes', 'Student accounts', 'Transaction trail', 'Compare charges', 'Record inbox', 'Dated ledger', 'One charge at a time', 'Reference register']
  };
  const filtersByPage = new Map();
  const text = value => String(value ?? '');
  const el = (tag, cls = '', value) => { const node = document.createElement(tag); if (cls) node.className = cls; if (value !== undefined) node.textContent = value; return node; };
  const button = (label, fn, cls = 'btn text') => { const node = el('button', cls, label); node.type = 'button'; node.addEventListener('click', fn); return node; };
  const label = (name, control) => { const item = el('label', 'ops05-field'); item.append(el('span', '', name), control); return item; };
  const select = (name, values) => { const input = el('select'); input.setAttribute('aria-label', name); input.add(new Option('All '+name.toLowerCase(), '')); [...new Set(values)].filter(Boolean).forEach(value => input.add(new Option(value, value))); return input; };
  const esc = value => text(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function downloadCSV(page, records, headers) {
    const csv = row => row.map(value => '"'+text(value).replace(/^[=+@-]/, "'$&").replaceAll('"','""')+'"').join(',');
    const content = '\uFEFF'+[csv(headers), ...records.map(record => csv(record.values))].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], {type:'text/csv;charset=utf-8'}));
    const anchor = el('a'); anchor.href = url; anchor.download = page+'-filtered-preview.csv'; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function apply({root, page, role}, design) {
    if (!root || root.querySelector('.ops05-studio')) return;
    const permitted = page === 'pending-work' ? ['coordinator'] : ['coordinator','administrator'];
    const surface = el('section', 'ops05 ops05-studio'); surface.dataset.design = String(design); surface.dataset.operationPage = page;
    surface.setAttribute('aria-label', names[page][design-1]);
    if (!permitted.includes(role)) {
      root.replaceChildren(surface); surface.append(el('h1','', 'This page is not available to your role'), el('p','', 'Use the existing navigation to return to your workspace.')); return;
    }
    const original = [...root.children]; original.forEach(child => surface.append(child)); root.append(surface);
    const heading = surface.querySelector('.page-head'); heading?.classList.add('ops05-heading');
    const nativeToolbar = surface.querySelector('.toolbar');
    const queue = surface.querySelector('.work-links');
    if (queue) { queue.classList.add('ops05-shortcuts'); queue.setAttribute('aria-label','Related work queues'); }
    const summary = surface.querySelector('.ledger-summary');
    if (summary) { const details = el('details','ops05-totals'); details.append(el('summary','','Preview balances'),summary); surface.append(details); }
    let headers, records;
    const table = surface.querySelector('table');
    if (table) {
      headers = [...table.tHead.rows[0].cells].map(c => c.textContent.trim() || 'Action');
      records = [...table.tBodies[0].rows].map((row, i) => {
        const cells=[...row.cells]; const values=cells.map(c=>c.innerText.replace(/\n+/g,' · ').trim());
        const financial=page==='financial-records';
        const shownDate=values.join(' ').match(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/);
        const isoDate=shownDate ? `${shownDate[3]}-${String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(shownDate[2])+1).padStart(2,'0')}-${shownDate[1].padStart(2,'0')}` : '';
        const title=values[1].replace(/^[A-Z]{2} · /,'');
        return {id:String(i),row,cells,values,title,subtitle:values[0],group:values[financial?4:3],date:isoDate,action:cells[cells.length-1],index:i};
      });
    } else {
      headers=['Date and time','Student / subject','Action and actor','Status'];
      records=[...surface.querySelectorAll('.activity-log li[data-search-row]')].map((row,i)=>{
        const time=row.querySelector('time'); const heading=row.querySelector('h3'); const description=row.querySelector('p'); const badge=row.querySelector('.badge');
        return {id:String(i),row,values:[time?.dateTime || '',heading?.textContent || '',description?.textContent || '',badge?.textContent.trim() || ''],title:heading?.textContent || 'Activity',subtitle:description?.textContent || '',group:badge?.textContent.trim() || '',date:(time?.dateTime || '').slice(0,10),index:i};
      });
    }
    // The nodes below are the baseline's actual controls and rows, not a replacement application.
    const originalRows = surface.querySelector('.tablewrap') || surface.querySelector('.activity-log');
    const nativeFoot = surface.querySelector('.tablefoot') || surface.querySelector('#result-count');
    originalRows?.remove(); nativeFoot?.remove(); nativeToolbar?.remove();
    const controls = el('form','ops05-filters'); controls.setAttribute('aria-label','Filter '+page.replaceAll('-',' '));
    controls.addEventListener('submit',event=>event.preventDefault());
    const search = nativeToolbar?.querySelector('input[type=search]') || el('input'); search.type='search';search.id='ops05-search';search.placeholder=page==='pending-work'?'Student or blocking step…':page==='schedule-activity'?'Student, staff or action…':'Student or transaction…';search.removeAttribute('data-filter');
    const kind = select(page==='pending-work'?'Priorities':page==='schedule-activity'?'Actions':'Statuses',records.map(r=>r.group));
    const from=el('input'), to=el('input'); from.type=to.type='date';
    controls.append(label('Search',search), label(page==='pending-work'?'Blocking step':page==='schedule-activity'?'Action':'Status',kind),label('From date',from),label('Through date',to));
    // Preserve the original financial type control, and its exact labels.
    const type = page==='financial-records' ? nativeToolbar?.querySelector('select') : null;
    if(type){type.removeAttribute('data-filter');controls.append(label('Type',type));}
    const clear = button('Clear filters',()=>{search.value=kind.value=from.value=to.value='';if(type)type.value='';update();search.focus();});controls.append(clear);
    const feedback=el('p','ops05-feedback feedback');feedback.setAttribute('role','status');
    function showFeedback(text, tone = 'info') {
      feedback.classList.remove('info', 'warning', 'error');
      feedback.classList.add(tone);
      feedback.textContent = text;
    }
    const count=el('p','ops05-count');count.setAttribute('role','status');
    const main=el('div','ops05-body'); const results=el('section','ops05-results');results.setAttribute('aria-label','Matching records');
    main.append(controls,results);surface.append(main,count,feedback);
    const saved=filtersByPage.get(page);if(saved){search.value=saved.query;kind.value=saved.kind;from.value=saved.from;to.value=saved.to;if(type)type.value=saved.type || '';}
    let visible=records, active=0, compared=new Set(records.slice(0,2).map(r=>r.id)), selected=records[0]?.id;
    const exportButton = surface.querySelector('[data-action=export-csv]');
    if(exportButton) { exportButton.removeAttribute('data-action'); exportButton.addEventListener('click',()=>downloadCSV(page,visible,headers)); }
    if(page==='schedule-activity') heading?.append(button('Export CSV',()=>downloadCSV(page,visible,headers),'btn'));
    const refresh=surface.querySelector('[data-action=refresh]');if(refresh){refresh.removeAttribute('data-action');refresh.addEventListener('click',()=>{update();showFeedback('Preview refreshed. No live records were changed.');});}
    function openRecord(record, trigger) {
      // Reuse the host's modal and focus restoration. This is explicitly preview-only.
      if(typeof modal==='function') {
        const fieldsHTML = '<div class="ops05 ops05-detail"><dl>'+headers.map((h,i)=>h==='Action'?'':`<div><dt>${esc(h)}</dt><dd>${esc(record.values[i])}</dd></div>`).join('')+'</dl><p>Sample record from the supplied Portal preview. Financial actions belong to the authenticated application.</p></div>';
        modal(page==='financial-records'?'Financial record':'Schedule activity', fieldsHTML, 'Close', 'close');
      }
    }
    if(page==='financial-records') records.forEach(record=>{
      record.action.querySelectorAll('[data-action=financial-detail]').forEach(b=>{b.removeAttribute('data-action');b.addEventListener('click',()=>openRecord(record,b));});
    });
    function facts(record) {
      const dl=el('dl','ops05-facts');
      headers.forEach((name,i)=>{if(name==='Action')return;const item=el('div');item.append(el('dt','',name),el('dd','',record.values[i]));dl.append(item);});return dl;
    }
    function actions(record) {
      const bar=el('div','ops05-record-actions');
      if(record.action) while(record.action.firstChild)bar.append(record.action.firstChild);
      else bar.append(button('Read event',event=>openRecord(record,event.currentTarget),'btn row-control'));
      return bar;
    }
    // Each action node has one owner. Preserve it while changing the view or filtering.
    records.forEach(record=>record.actionBar=actions(record));
    function card(record, compact=false) {
      const item=el('article','ops05-record');item.dataset.record=record.id;
      item.append(el('small','ops05-record-ref',record.subtitle),el('h2','',record.title));
      if(!compact)item.append(facts(record));
      item.append(record.actionBar);return item;
    }
    function nativeTable(items, actionFirst=false) {
      if(!table){const list=el('div','ops05-journal');items.forEach(r=>list.append(card(r)));return list;}
      const wrap=el('div','ops05-table');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Scrollable records');
      const fresh=el('table'); const thead=el('thead'),tr=el('tr'),body=el('tbody');
      const order=actionFirst?[headers.length-1,...headers.slice(0,-1).map((_,i)=>i)]:headers.map((_,i)=>i);
      order.forEach(i=>{const th=el('th','',headers[i]);th.scope='col';tr.append(th);});thead.append(tr);fresh.append(thead,body);
      items.forEach(record=>{const row=el('tr');row.dataset.record=record.id;order.forEach(i=>{const td=el('td');td.dataset.label=headers[i]; if(i===headers.length-1)td.append(record.actionBar);else [...record.cells[i].childNodes].forEach(node=>td.append(node.cloneNode(true))); if(!td.childNodes.length)td.textContent=record.values[i];row.append(td);});body.append(row);});wrap.append(fresh);return wrap;
    }
    function grouped(items, byDate=false) {
      const lanes=el('div',byDate?'ops05-datebook':'ops05-lanes');
      const keys=[...new Set(items.map(r=>byDate?r.date:r.group))];
      keys.forEach(key=>{const lane=el('section','ops05-lane');lane.append(el('h2','ops05-group-title',byDate?new Date(key+'T12:00').toLocaleDateString(undefined,{day:'numeric',month:'long'}):key));items.filter(r=>(byDate?r.date:r.group)===key).forEach(r=>lane.append(card(r)));lanes.append(lane);});return lanes;
    }
    function renderRecords() {
      results.replaceChildren();
      if(!visible.length){results.append(el('h2','','No matching records'),el('p','','Change the search or clear the filters.'));return;}
      if([1,2,10].includes(design)){results.append(nativeTable(visible,design===10));return;}
      if(design===3 || design===8){results.append(grouped(visible,design===8));return;}
      if(design===4){visible.forEach((r,i)=>{const file=el('details','ops05-file');file.open=i===0;file.append(el('summary','',`${r.title} — ${r.group}`),facts(r),r.actionBar);results.append(file);});return;}
      if(design===5){const trail=el('ol','ops05-trail');[...visible].sort((a,b)=>a.date.localeCompare(b.date)).forEach(r=>{const item=el('li');item.append(el('time','',r.date),card(r));trail.append(item);});results.append(trail);return;}
      if(design===6){
        const picker=el('fieldset','ops05-compare-pick');picker.append(el('legend','','Choose up to three records to compare'));
        visible.forEach(r=>{const input=el('input');input.type='checkbox';input.checked=compared.has(r.id);input.addEventListener('change',()=>{if(input.checked&&compared.size===3){input.checked=false;showFeedback('Compare up to three records at a time.', 'warning');return;}input.checked?compared.add(r.id):compared.delete(r.id);renderRecords();});picker.append(label(r.title+' · '+r.group,input));});
        const columns=el('div','ops05-comparison');const chosen=visible.filter(r=>compared.has(r.id));chosen.forEach(r=>columns.append(card(r)));if(!chosen.length)columns.append(el('p','','Choose records above to compare.'));results.append(picker,columns);return;
      }
      if(design===7){
        const split=el('div','ops05-inbox'),index=el('nav','ops05-index'),detail=el('section','ops05-inspector');index.setAttribute('aria-label','Record index');
        if(!visible.some(r=>r.id===selected))selected=visible[0].id;
        visible.forEach(r=>{const pick=button(r.title,()=>{selected=r.id;renderRecords();results.querySelector(`[data-select="${r.id}"]`)?.focus();},'ops05-pick');pick.dataset.select=r.id;pick.setAttribute('aria-pressed',String(r.id===selected));pick.append(el('small','',r.group));index.append(pick);});
        detail.append(card(visible.find(r=>r.id===selected)));split.append(index,detail);results.append(split);return;
      }
      active=Math.min(active,visible.length-1);const nav=el('nav','ops05-focus-nav');nav.setAttribute('aria-label','Review records');
      const prev=button('Previous',()=>{active--;renderRecords();},'btn'),next=button('Next',()=>{active++;renderRecords();},'btn');prev.disabled=active===0;next.disabled=active===visible.length-1;
      nav.append(prev,el('span','',`${active+1} of ${visible.length}`),next);results.append(nav,card(visible[active]));
    }
    function update() {
      filtersByPage.set(page,{query:search.value,kind:kind.value,from:from.value,to:to.value,type:type?.value});
      const invalid=from.value&&to.value&&from.value>to.value;to.setCustomValidity(invalid?'End date must not precede start date.':'');
      showFeedback(invalid ? 'End date must not precede start date.' : '', invalid ? 'error' : 'info');
      const q=search.value.trim().toLowerCase();visible=invalid?[]:records.filter(r=>(!q||r.values.join(' ').toLowerCase().includes(q))&&(!kind.value||r.group===kind.value)&&(!type?.value||r.values[2]===type.value)&&(!from.value||r.date>=from.value)&&(!to.value||r.date<=to.value));active=0;
      count.textContent=`${visible.length} of ${records.length} sample records · Supplied Portal preview`;
      renderRecords();
    }
    controls.addEventListener('input',event=>{event.stopPropagation();update();});controls.addEventListener('change',event=>{event.stopPropagation();update();});
    update();
  }
  // Do not reassign the registry: the other four folders must coexist.
  window.portalVariants ||= Object.create(null);
  Object.entries(names).forEach(([page,names])=>{window.portalVariants[page]=names.map((name,index)=>({name,apply:context=>apply(context,index+1)}));});
})();
