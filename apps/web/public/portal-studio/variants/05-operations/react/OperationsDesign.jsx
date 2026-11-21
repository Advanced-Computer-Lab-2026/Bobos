import React, { Children, Fragment, createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import './operations-react.css';

const families = ['Reading register', 'Side desk', 'Working lanes', 'Open files', 'Time trail', 'Comparison', 'Inbox', 'Day book', 'Focused review', 'Action register'];
export const DESIGN_NAMES = {
  'pending-work':['Blocker register','Advisor desk','Work lanes','Student files','Oldest first','Compare blockers','Dispatch inbox','Request batches','One student at a time','Action register'],
  'schedule-activity':['Processing journal','Search desk','Action lanes','Student dossiers','Time trail','Compare events','Event inbox','Day book','One event at a time','Audit register'],
  'financial-records':['Payment ledger','Reconciliation desk','Settlement lanes','Student accounts','Transaction trail','Compare charges','Record inbox','Dated ledger','One charge at a time','Reference register'],
  'financial-record-detail':['Record sheet','Reference desk','Itemized account','Open transaction','Payment trail','Source and charge','Record inspector','Dated receipt','Focused record','Ledger margin'],
  'financial-reversal':['Reversal sheet','Eligibility desk','Check and reverse','Reversal file','Reversal sequence','Paid versus deferred','Decision drawer','Reversal docket','One check at a time','Authorization margin'],
  'extra-hours':['Request register','Advisor desk','Decision lanes','Student request files','Submission trail','Compare requests','Decision inbox','Dated requests','One request at a time','Approval register'],
  'my-extra-hours':['My requests','Request desk','Settlement lanes','My request files','Decision trail','Compare costs','Request inbox','Request journal','One request at a time','My credit register'],
  'extra-hours-detail':['Decision sheet','Eligibility desk','Request and decision','Open request file','Decision sequence','Eligibility and cost','Request inspector','Decision docket','Focused decision','Approval margin'],
  'extra-hours-request':['Request sheet','Course desk','Course selection lanes','New request file','Request sequence','Load and cost','Selection inspector','Term request book','Guided request','Request margin'],
  'wallet':['Wallet ledger','Balance desk','Debit and credit lanes','Transaction files','Balance trail','Compare transactions','Wallet inbox','Dated wallet','One entry at a time','Balance register'],
  'settlement':['Settlement sheet','Cost desk','Payment choices','Settlement file','Approval to activation','Compare options','Payment inspector','Installment docket','Guided settlement','Amount-due margin'],
  'payment-gateway':['Gateway sheet','Attempt desk','Outcome choices','Gateway file','Attempt sequence','Request and attempt','Attempt inspector','Payment docket','Guided attempt','Gateway margin'],
  'payment-history':['Payment register','History desk','Settlement lanes','Payment files','Settlement trail','Compare confirmations','History inbox','Dated payments','One payment at a time','Reference ledger'],
  'payment-confirmation':['Confirmation sheet','Reference desk','Record and download','Confirmation file','Settlement sequence','Amount and reference','Receipt inspector','Confirmation docket','Focused confirmation','Receipt margin'],
  'graduation-plans':['Private plan register','Student desk','Plan lanes','Private files','Draft trail','Compare plans','Plan inbox','Term book','One plan at a time','Draft register'],
  'graduation-plan':['Course placement','Planning desk','Term lanes','Course files','Prerequisite trail','Compare term loads','Course inspector','Three-term book','One course at a time','Assignment register'],
  'graduation-review':['Submitted register','Advisor desk','Review lanes','Submitted files','Submission trail','Compare submissions','Review inbox','Dated submissions','One plan at a time','Decision register'],
  'graduation-plan-review':['Plan sheet','Review desk','Term lanes','Submitted file','Winter to summer','Compare terms','Plan inspector','Academic year book','Focused plan','Review margin'],
  'exit-exam-request':['Exception sheet','Eligibility desk','Course and reason','Exception file','Placement sequence','Repeat versus exam','Exception inspector','Graduation docket','Guided exception','Reason margin'],
  'exit-exam-review':['Exam register','Advisor desk','Decision lanes','Exam files','Request trail','Compare exceptions','Exam inbox','Dated exceptions','One exam at a time','Exception register'],
  'exit-exam-detail':['Exam decision','Eligibility desk','Course and decision','Open exam file','Decision sequence','Reason and response','Exam inspector','Exam docket','Focused exam','Decision margin'],
  'my-graduation':['Accepted plan','Year desk','Term lanes','Accepted files','Winter to summer','Compare terms','Course inspector','Academic year book','One term at a time','Graduation register'],
  'my-exit-exams':['Exam status','Response desk','Status lanes','My exam files','Response trail','Compare requests','Exam inbox','Exam journal','One exam at a time','Response register']
};
export const PAGE_ROLES = {
  'pending-work':['coordinator'], 'schedule-activity':['coordinator','administrator'],
  'financial-records':['coordinator','administrator'], 'financial-record-detail':['coordinator','administrator'], 'financial-reversal':['coordinator','administrator'],
  'extra-hours':['advisor','coordinator'], 'my-extra-hours':['advisingStudent'], 'extra-hours-request':['advisor'],
  'extra-hours-detail':['advisor','coordinator','advisingStudent'], 'wallet':['advisingStudent'], 'settlement':['advisingStudent'], 'payment-gateway':['advisingStudent'], 'payment-history':['advisingStudent'], 'payment-confirmation':['advisingStudent'],
  'graduation-plans':['advisor'], 'graduation-plan':['advisor'], 'graduation-review':['advisor','coordinator'], 'graduation-plan-review':['advisor','coordinator'], 'exit-exam-request':['advisor'], 'exit-exam-review':['coordinator'], 'exit-exam-detail':['coordinator'], 'my-graduation':['advisingStudent'], 'my-exit-exams':['advisingStudent']
};
const memory = new Map();
const read = key => {try {const value=localStorage.getItem('portal-page-design:'+key);return Math.max(0,Math.min(10,Number(value)||0));}catch{return memory.get(key)||0;}};
const Context = createContext({design:0,pageKey:'',setDesign:()=>{}});
export const useOperationsDesign = () => useContext(Context);

export function OpsDesignControl() {
  const {design,pageKey,setDesign,sessionOnly} = useOperationsDesign();
  const id=useId();
  return <div className="ops05-design-control"><label htmlFor={id}>Page design</label><select id={id} aria-label="Page design" value={design} onChange={event=>setDesign(Number(event.target.value))}><option value={0}>Original</option>{(DESIGN_NAMES[pageKey]||families).map((name,index)=><option key={name} value={index+1}>{name}</option>)}</select>{sessionOnly&&<small role="status">Session only</small>}</div>;
}
export function OpsFrame({pageKey, role, children, controlInDialog=false}) {
  const [,setRevision]=useState(0);const [sessionOnly,setSessionOnly]=useState(false);
  const design=read(pageKey);
  const setDesign=value=>{memory.set(pageKey,value);try{localStorage.setItem('portal-page-design:'+pageKey,String(value));}catch{setSessionOnly(true);}setRevision(value=>value+1);};
  useEffect(()=>{const changed=event=>{if(event.key==='portal-page-design:'+pageKey)setRevision(value=>value+1);};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[pageKey]);
  if(role && PAGE_ROLES[pageKey] && !PAGE_ROLES[pageKey].includes(role)) return <section className="panel" role="alert"><h1>This page is unavailable to your role</h1><p>Return to Overview using Portal’s navigation.</p></section>;
  return <Context.Provider value={{design,pageKey,setDesign,sessionOnly}}><section className="ops05 ops05-react" data-design={design} data-operation-page={pageKey}>{!controlInDialog&&<OpsDesignControl/>}{children}</section></Context.Provider>;
}
const flatten = children => Children.toArray(children).flatMap(child=>React.isValidElement(child)&&child.type===Fragment?flatten(child.props.children):[child]);
export function nodeText(node) {
  if(node==null || typeof node==='boolean')return '';
  if(typeof node==='string'||typeof node==='number')return String(node);
  if(Array.isArray(node))return node.map(nodeText).join(' ');
  if(React.isValidElement(node)){if(node.props.status)return String(node.props.status);if(node.props.value!==undefined && !node.props.children)return String(node.props.value);return nodeText(node.props.children);}
  return '';
}

/** Declarative rearrangement: never moves React DOM nodes and never replaces callbacks. */
export function OpsTable({children, titleColumn, groupColumn, ...props}) {
  const {design,pageKey}=useOperationsDesign(); const [active,setActive]=useState(0),[compare,setCompare]=useState([0,1]),[group,setGroup]=useState('');
  const parts=flatten(children),head=parts.find(x=>x?.type==='thead'),body=parts.find(x=>x?.type==='tbody');
  const headings=flatten(flatten(head?.props.children)[0]?.props.children).map(x=>nodeText(x));
  const rows=flatten(body?.props.children).filter(x=>x?.type==='tr');
  const cells=rows.map(row=>flatten(row.props.children));
  const titleIndex=titleColumn ?? Math.max(0,headings.findIndex(label=>/student|course|term|request|reference/i.test(label)));
  const defaultGroup=groupColumn ?? Math.max(0,headings.findIndex(label=>/status|decision|action|type|term/i.test(label)));
  const groupIndex=group===''?defaultGroup:Number(group);
  const title = index => nodeText(cells[index]?.[titleIndex])||`Record ${index+1}`;
  const groupLabel = index => nodeText(cells[index]?.[groupIndex]) || 'Other';
  const safeActive=Math.min(active,Math.max(0,rows.length-1));
  const rowKey = i => rows[i]?.key ?? i;
  function record(index) {
    return <article className="ops05-record" key={rowKey(index)}><h3>{title(index)}</h3><dl className="ops05-facts">{cells[index]?.map((cell,i)=><div key={i} className={/action|confirmation/i.test(headings[i])?'ops05-fact-action':''}><dt>{headings[i]||'Action'}</dt><dd>{cell.props.children}</dd></div>)}</dl></article>;
  }
  // Keep native semantics in the original and the two register arrangements.
  if(design===0 || design===1 || design===2 || !rows.length || cells.some(row=>row.some(cell=>cell?.props.colSpan)))return <table {...props}>{children}</table>;
  if(design===10){const order=[headings.length-1,...headings.slice(0,-1).map((_,i)=>i)];return <table {...props}><thead><tr>{order.map(i=><th key={i} scope="col">{headings[i]}</th>)}</tr></thead><tbody>{rows.map((row,r)=><tr key={rowKey(r)}>{order.map(i=>React.cloneElement(cells[r][i],{key:i}))}</tr>)}</tbody></table>;}
  const content = design===3 ? <><label className="ops05-group-control">Group by <select value={groupIndex} onChange={event=>setGroup(event.target.value)}>{headings.map((label,i)=>! /action|confirmation/i.test(label)&&<option key={i} value={i}>{label}</option>)}</select></label><div className="ops05-lanes">{[...new Set(rows.map((_,i)=>groupLabel(i)))].map(name=><section className="ops05-lane" key={name}><h3 className="ops05-group-title">{name}</h3>{rows.map((_,i)=>groupLabel(i)===name?record(i):null)}</section>)}</div></>
    :design===4?<div className="ops05-files">{rows.map((row,i)=><details className="ops05-file" key={rowKey(i)} open={i===0?true:undefined}><summary>{title(i)}</summary>{record(i)}</details>)}</div>
    :design===5?<ol className="ops05-trail">{rows.map((row,i)=><li key={rowKey(i)}><span className="ops05-trail-index">{String(i+1).padStart(2,'0')}</span>{record(i)}</li>)}</ol>
    :design===6?<><fieldset className="ops05-compare-pick"><legend>Compare up to three records on this page</legend>{rows.map((row,i)=><label key={rowKey(i)}><input type="checkbox" checked={compare.includes(i)} disabled={!compare.includes(i)&&compare.length===3} onChange={event=>setCompare(event.target.checked?[...compare,i]:compare.filter(x=>x!==i))}/>{title(i)}</label>)}</fieldset><div className="ops05-comparison">{compare.filter(i=>i<rows.length).map(record)}</div></>
    :design===7?<div className="ops05-inbox"><nav className="ops05-index" aria-label="Choose a record">{rows.map((row,i)=><button type="button" className="ops05-pick" key={rowKey(i)} aria-pressed={i===safeActive} onClick={()=>setActive(i)}>{title(i)}<small>{groupLabel(i)}</small></button>)}</nav><div className="ops05-inspector">{record(safeActive)}</div></div>
    :design===8?<div className="ops05-datebook">{rows.map((row,i)=><section className="ops05-datebook-row" key={rowKey(i)}><h3>{headings.findIndex(h=>/date|term|submitted/i.test(h))>=0?nodeText(cells[i][headings.findIndex(h=>/date|term|submitted/i.test(h))]):groupLabel(i)}</h3>{record(i)}</section>)}</div>
    :<><nav className="ops05-focus-nav" aria-label="Review records"><button className="outline-button" type="button" disabled={!safeActive} onClick={()=>setActive(safeActive-1)}>Previous</button><label>Record <select aria-label="Choose record" value={safeActive} onChange={event=>setActive(Number(event.target.value))}>{rows.map((row,i)=><option key={rowKey(i)} value={i}>{i+1} · {title(i)}</option>)}</select></label><button className="outline-button" type="button" disabled={safeActive===rows.length-1} onClick={()=>setActive(safeActive+1)}>Next</button></nav>{record(safeActive)}</>;
  return <div className="ops05-table-layout" data-table-page={pageKey}>{content}</div>;
}

/** Sections stay mounted while moving between stages: typed fields are not discarded. */
export function OpsSections({sections}) {
  const {design}=useOperationsDesign();const [active,setActive]=useState(0);const [closed,setClosed]=useState({});const prefix=useId();const refs=useRef([]);
  const bounded=Math.min(active,sections.length-1);const stepped=[7,8,9].includes(design);
  function next(){const controls=refs.current[bounded]?.querySelectorAll('input,select,textarea')||[];for(const control of controls){if(!control.checkValidity()){control.reportValidity();return;}}setActive(i=>Math.min(i+1,sections.length-1));}
  return <div className={'ops05-sections '+(stepped?'is-stepped':'')}>
    {design===9&&<p className="ops05-step-heading" aria-live="polite">Step {bounded+1} of {sections.length} · {sections[bounded]?.title}</p>}
    {[2,7,8,10].includes(design)&&<nav className="ops05-section-index" aria-label="Sections">{sections.map((section,i)=>stepped?<button className="ops05-pick" type="button" key={section.id} aria-pressed={i===bounded} onClick={()=>setActive(i)}>{i+1}. {section.title}</button>:<a key={section.id} href={'#'+prefix+'-'+section.id}>{section.title}</a>)}</nav>}
    <div className="ops05-sections-body">{sections.map((section,i)=><section key={section.id} ref={node=>refs.current[i]=node} id={prefix+'-'+section.id} className="ops05-section" hidden={stepped&&i!==bounded}><h2>{design===4?<button type="button" className="ops05-file-toggle" aria-expanded={!closed[section.id]} onClick={()=>setClosed(previous=>({...previous,[section.id]:!previous[section.id]}))}>{section.title}<span aria-hidden="true">{closed[section.id]?'+':'−'}</span></button>:section.title}</h2><div hidden={design===4&&closed[section.id]}>{section.content}</div></section>)}
    {stepped&&<nav className="ops05-focus-nav" aria-label="Section navigation"><button className="outline-button" type="button" disabled={bounded===0} onClick={()=>setActive(bounded-1)}>Previous section</button><span>{bounded+1} of {sections.length}</span><button className="outline-button" type="button" disabled={bounded===sections.length-1} onClick={next}>Next section</button></nav>}</div>
  </div>;
}

export function OpsFolder() {
  const [play,setPlay]=useState(0);
  return <button type="button" className="ops05-folder" onClick={()=>setPlay(value=>value+1)} aria-label="Replay opening the request folder" title="Reopen request file"><svg key={play} viewBox="0 0 360 280" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M30 243 Q100 240 176 243 T333 242" opacity=".4"/><path d="M59 221 L59 87 L126 83 L145 102 L282 102 L286 223 Z" fill="#d8bd7a"/><g className="ops05-folder-sheet"><path d="M85 198 L84 59 L256 65 L253 208 Z" fill="#fbf8f0"/><path d="M107 86 L221 91 M107 106 L235 110 M107 126 L195 129" opacity=".5"/><circle cx="222" cy="157" r="17" fill="#a8b4a0"/><path d="M213 157 l7 7 l12 -14"/></g><path d="M58 137 L291 139 L276 229 L74 228 Z" fill="#c78f74"/><path d="M82 159 L135 160 L134 178 L80 177 Z" fill="#fbf8f0"/><path d="M90 166 L121 168" opacity=".4"/></svg></button>;
}

export function OpsModalFocus({children,onClose,label}) {
 const ref=useRef(null);const close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement;const root=ref.current;const first=root?.querySelector('button,input,select,textarea');first?.focus();function key(event){if(event.key==='Escape'){event.preventDefault();close.current();}if(event.key==='Tab'){const all=[...root.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);if(!all.length)return;const end=event.shiftKey?all[0]:all.at(-1);if(document.activeElement===end){event.preventDefault();(event.shiftKey?all.at(-1):all[0]).focus();}}}root?.addEventListener('keydown',key);return()=>{root?.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};},[]);
 return <div ref={ref} role="group" aria-label={label}>{children}</div>;
}

/** Child components (and their effects) are never mounted for an unauthorized role. */
export function OpsGate({pageKey,role,children}) {
  return PAGE_ROLES[pageKey]?.includes(role) ? children : <section className="panel"><h1>Page unavailable</h1><p>Your current role does not have access to this workflow. Use Portal navigation to return to an available page.</p></section>;
}
