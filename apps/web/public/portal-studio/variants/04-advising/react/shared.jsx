import React, { useEffect, useRef, useState } from "react";
import "./advising04.css";

export const designs = {
  "account-administration": ["Access register", "Filter rail", "Account review desk", "Access-status groups", "Student record files", "Action first", "Advisor groups", "Compact ledger", "Compare records", "Handover workflow"],
  "slot-changes-staff": ["Request register", "Filter rail", "Decision desk", "Status lanes", "Request letters", "Oldest pending first", "Course groups", "Slot comparison", "Three-step review", "Submission timeline"],
};
export function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function storePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* A blocked preference store must never prevent a server action. */ }
}
export function useFilters(key, defaults) {
  const [filters, setFilters] = useState(() => ({ ...defaults, ...readPreference(key, {}) }));
  useEffect(() => { storePreference(key, filters); }, [key, filters]);
  return [filters, setFilters];
}
export function RouteFrame({ routeKey, allowed, Original, children }) {
  const [design, setDesign] = useState(() => {
    const saved = Number(readPreference(`portal-page-design:${routeKey}`, 0));
    return Number.isInteger(saved) && saved >= 0 && saved <= 10 ? saved : 0;
  });
  if (!allowed) return <section className="panel"><h1>Page unavailable</h1><p>Your role does not have access to this workflow. Use the pages in your navigation.</p></section>;
  return <div className="ad4-connected" data-ad4-react-page={routeKey} data-ad4-react-design={design}>
    <label className="ad4r-design">Page design <select aria-label="Page design" value={design} onChange={(e) => { const value = Number(e.target.value); setDesign(value); storePreference(`portal-page-design:${routeKey}`, value); }}>
      <option value="0">Original</option>{designs[routeKey].map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
    </select></label>
    {design === 0 ? Original : children(design)}
  </div>;
}
export function Status({ children, value }) {
  const tone = ["approved", "active", "processed"].includes(value) ? "good" : value === "pending" ? "warning" : value === "rejected" ? "danger" : "muted";
  return <span className={`status-pill ${tone}`}>{children || pretty(value)}</span>;
}
export const pretty = (value) => value == null || value === "" ? "—" : String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
export const date = (value) => !value || Number.isNaN(+new Date(value)) ? "—" : new Date(value).toLocaleString();
export function Facts({ items }) { return <dl className="ad4r-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>; }
export function Conversation({ replay = "rest" }) {
  return <svg key={replay} className="ad4r-conversation" viewBox="0 0 64 52" fill="none" stroke="#352f29" strokeWidth="1.55" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path fill="#bcd1ca" d="M24 24Q29 17 44 19Q58 19 56 32Q56 38 49 40L51 46L41 41Q21 43 24 24Z"/><path className="ad4r-reply" stroke="#55665d" d="m40 30 10 1m-12 4 7 .5"/>
    <path className="ad4r-bubble" fill="#f3eee1" d="M7 17Q9 8 26 9Q44 7 43 22Q43 32 23 33L11 40L14 31Q4 29 7 17Z"/><path className="ad4r-ink" d="m14 18 5-.4 4 .5 7-.8 5 .2m-20 6 5-.4 6 .3"/>
  </svg>;
}
export function Feedback({ error, message, retry, busy }) {
  return <>{error && <div className="feedback error" role="alert"><p>{error}</p>{retry && <button className="outline-button" type="button" onClick={retry} disabled={busy}>Retry loading</button>}</div>}{message && <p className="feedback info" role="status">{message}</p>}</>;
}
export function Confirm({ title, children, action, onConfirm, onClose, busy, error }) {
  const ref = useRef(null), previous = useRef(null);
  useEffect(() => { previous.current = document.activeElement; ref.current?.showModal(); return () => { previous.current?.isConnected && previous.current.focus(); }; }, []);
  return <dialog className="ad4r-dialog" ref={ref} aria-labelledby="ad4r-confirm-title" onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={(e) => { e.preventDefault(); onConfirm(); }}>
      <div className="ad4r-dialog-head"><h2 id="ad4r-confirm-title">{title}</h2><button className="icon-button" type="button" aria-label="Close confirmation" onClick={onClose} disabled={busy}>×</button></div>
      {children}{error && <p className="feedback error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="outline-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : action}</button></div>
    </form>
  </dialog>;
}
export function groupBy(records, keyFor) {
  const groups = new Map();
  records.forEach((record) => { const key = keyFor(record); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); });
  return [...groups];
}
