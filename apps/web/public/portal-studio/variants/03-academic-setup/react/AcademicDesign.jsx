import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ACADEMIC_ROUTES, DESIGN_NAMES } from "./routes.js";
import "./academic-design.css";

/* Presentation only. No preview fixtures, tokens, API client, auth or business-rule replacement. */
const Registry = createContext(null);
const readChoice = (key) => { try { const n=Number(localStorage.getItem(`portal-page-design:react:${key}`)); return Number.isInteger(n)&&n>=0&&n<=10?n:0; } catch { return 0; } };

export function AcademicDesignProvider({ role, children }) {
  const [routes,setRoutes]=useState([]);
  const [focused,setFocused]=useState("");
  const [choices,setChoices]=useState({});
  const [storageError,setStorageError]=useState("");
  const register=useCallback((route)=>{
    setRoutes(current=>[...current.filter(item=>item.id!==route.id),route]);
    return ()=>setRoutes(current=>current.filter(item=>item.id!==route.id));
  },[]);
  const activate=useCallback(id=>setFocused(id),[]);
  const getChoice=useCallback(key=>choices[key]??readChoice(key),[choices]);
  const context=useMemo(()=>({register,activate,getChoice,role}),[register,activate,getChoice,role]);
  const modal=routes.filter(item=>item.modal).at(-1);
  const focusedRoute=routes.find(item=>item.id===focused);
  // An inline editor inside the foreground modal owns its own remembered choice.
  // A background page can never displace the modal's selector.
  const active=modal
    ? (focusedRoute&&modal.root?.contains(focusedRoute.root)?focusedRoute:modal)
    : focusedRoute||routes.find(item=>!item.inline)||routes[0];
  const choose=event=>{
    const value=Number(event.target.value);setChoices(current=>({...current,[active.key]:value}));
    try {localStorage.setItem(`portal-page-design:react:${active.key}`,String(value));setStorageError("");}
    catch {setStorageError("This choice works in the current tab, but browser storage is unavailable.");}
  };
  return <Registry.Provider value={context}>{children}{active?.slot&&createPortal(
    <div className="asr-picker"><label>Page design <select aria-label={`Page design · ${ACADEMIC_ROUTES[active.key]?.label||active.key}`} value={getChoice(active.key)} onChange={choose}><option value={0}>Original</option>{DESIGN_NAMES.map((name,index)=><option key={name} value={index+1}>{name}</option>)}</select></label>{storageError&&<span role="status">{storageError}</span>}</div>,active.slot,active.id
  )}</Registry.Provider>;
}

export function AcademicRoute({ pageKey, modal=false, inline=false, children }) {
  const registry=useContext(Registry),id=useId(),root=useRef(null),slot=useRef(null);
  const [items,setItems]=useState([]),[current,setCurrent]=useState(0);
  const choice=registry?.getChoice(pageKey)||0;
  useLayoutEffect(()=>{
    if(!registry||!pageKey)return;
    return registry.register({id,key:pageKey,root:root.current,slot:slot.current,modal,inline});
  },[registry?.register,id,pageKey,modal,inline]);
  useEffect(()=>{
    const node=root.current;if(!node||!choice)return;
    let frame=0,signature="";
    const collect=()=>{
      frame=0;
      const candidates=[...node.querySelectorAll(".form-grid > .field,.form-grid > .check-field,.form-stack > .field,.form-stack > fieldset,tbody > tr,.offering-card,.template-card,.recent-term,.confirmation-content")]
        .filter(item=>item.closest("[data-asr-route]")===node&&!item.closest(".asr-tools"));
      const top=candidates.filter(item=>!candidates.some(other=>other!==item&&other.contains(item)));
      const next=top.map((element,index)=>{
        element.dataset.asrItem=String(index); element.dataset.asrLayout=String(choice);
        const grid=element.closest(".form-grid"); if(grid&&grid.closest("[data-asr-route]")===node)grid.dataset.asrGrid=String(choice);
        const label=element.querySelector(":scope > span,:scope > legend,th,strong,.course-code-pill")?.textContent?.trim()||element.getAttribute("aria-label")||`Section ${index+1}`;
        const controls=[...element.querySelectorAll("input,select,textarea")];
        const values=controls.map(input=>input.type==="password"?"Protected":input.type==="file"?input.files?.[0]?.name||"No file selected":input.type==="checkbox"?(input.checked?"Yes":"No"):input.tagName==="SELECT"?[...input.selectedOptions].map(option=>option.textContent).join(", "):input.value).filter(Boolean);
        const invalid=controls.some(input=>input.willValidate&&!input.validity.valid);
        const value=values.join(" · ")||element.textContent.trim().replace(/\s+/g," ").slice(0,190);
        return {index,label:label.slice(0,90),value,invalid,element};
      });
      const nextSignature=JSON.stringify(next.map(({index,label,value,invalid})=>({index,label,value,invalid})));
      if(nextSignature!==signature){signature=nextSignature;setItems(next);setCurrent(old=>Math.min(old,Math.max(0,next.length-1)));}
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(collect);};
    collect();
    const observer=new MutationObserver(schedule);observer.observe(node,{childList:true,subtree:true});
    node.addEventListener("input",schedule);node.addEventListener("change",schedule);
    return ()=>{observer.disconnect();cancelAnimationFrame(frame);node.removeEventListener("input",schedule);node.removeEventListener("change",schedule);candidatesCleanup(node);};
  },[choice,pageKey]);
  useLayoutEffect(()=>{
    const node=root.current;if(!node)return;
    node.querySelectorAll("[data-asr-item]").forEach(element=>{
      if(element.closest("[data-asr-route]")!==node)return;
      const index=Number(element.dataset.asrItem);
      element.dataset.asrCurrent=String(choice===5?Math.floor(index/4)===Math.floor(current/4):index===current);
    });
  },[items,current,choice]);
  useEffect(()=>{
    if(!modal||!root.current)return;
    const dialog=root.current.closest('[role="dialog"]');if(!dialog)return;
    const previous=document.activeElement;
    const tabbable=()=>[...dialog.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(element=>!element.disabled&&element.getClientRects().length);
    const keydown=event=>{
      if(event.target.closest('[role="dialog"]')!==dialog)return;
      if(event.key==='Escape'){const close=dialog.querySelector('.modal-heading button[aria-label="Close"]');if(close&&!close.disabled){event.preventDefault();event.stopPropagation();close.click();}}
      if(event.key==='Tab'){const targets=tabbable(),first=targets[0],last=targets.at(-1);if(!first)return;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    };
    dialog.addEventListener('keydown',keydown);
    const frame=requestAnimationFrame(()=>tabbable()[0]?.focus());
    return ()=>{cancelAnimationFrame(frame);dialog.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus();};
  },[modal]);
  const focusItem=(index)=>{
    const item=items[index];if(!item)return;setCurrent(index);
    requestAnimationFrame(()=>{item.element.scrollIntoView({block:"nearest",behavior:"auto"});const control=item.element.querySelector("input,select,textarea,button,a");if(control)control.focus();else {item.element.tabIndex=-1;item.element.focus();}});
  };
  const invalid=event=>{
    if(![5,9].includes(choice))return;
    const item=event.target.closest("[data-asr-item]");if(!item||item.closest("[data-asr-route]")!==root.current)return;
    event.preventDefault();focusItem(Number(item.dataset.asrItem));
  };
  const activate=event=>{if(event.target.closest("[data-asr-route]")===root.current)registry?.activate(id);};
  if(!pageKey||!registry)return children;
  return <div className="asr-route" ref={root} data-asr-route={pageKey} data-asr-design={choice} data-asr-modal={modal||undefined} onFocusCapture={activate} onPointerDownCapture={activate} onInvalidCapture={invalid}>
    <div className="asr-selector-slot" ref={slot}/>
    {choice>0&&<RouteTools choice={choice} items={items} current={current} focusItem={focusItem}/>}
    <div className="asr-content">{children}</div>
  </div>;
}
function candidatesCleanup(node){node.querySelectorAll("[data-asr-grid]").forEach(grid=>{if(grid.closest("[data-asr-route]")===node)delete grid.dataset.asrGrid;});node.querySelectorAll("[data-asr-item]").forEach(element=>{if(element.closest("[data-asr-route]")===node){delete element.dataset.asrItem;delete element.dataset.asrCurrent;delete element.dataset.asrLayout;}});}
function RouteTools({choice,items,current,focusItem}) {
  if(!items.length||[1,4,10].includes(choice))return null;
  const summary=<dl>{items.map(item=><div key={item.index}><dt>{item.label}</dt><dd>{item.value||"Not entered"}</dd></div>)}</dl>;
  if(choice===2||choice===6){const shown=choice===6?items.filter(item=>item.invalid):items;return <nav className="asr-tools asr-field-index" aria-label={choice===6?"Fields needing attention":"Jump to a field or record"}><h3>{choice===6?"Needs attention":"On this page"}</h3>{shown.length?shown.map(item=><button type="button" key={item.index} onClick={()=>focusItem(item.index)}>{item.label}</button>):<p>No required input is missing.</p>}</nav>;}
  if(choice===5||choice===9){const size=choice===5?4:1,count=Math.ceil(items.length/size),step=Math.floor(current/size);return <nav className="asr-tools asr-flow" aria-label="Form steps"><button type="button" disabled={!step} onClick={()=>focusItem((step-1)*size)}>Previous</button><label>{choice===5?"Field group":"Field or record"}<select value={step} onChange={event=>focusItem(Number(event.target.value)*size)}>{Array.from({length:count},(_,index)=><option key={index} value={index}>{index+1}. {items[index*size]?.label}</option>)}</select></label><span>{step+1} of {count}</span><button type="button" disabled={step>=count-1} onClick={()=>focusItem((step+1)*size)}>Next</button></nav>;}
  return <aside className="asr-tools asr-input-review"><h3>{choice===7?"Review current inputs":choice===8?"At a glance":"Record notes"}</h3><p>Read-only summary of the existing form or records. Changes are saved only by the original action.</p>{summary}</aside>;
}
