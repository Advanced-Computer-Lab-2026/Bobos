import { useId, useRef, useState } from "react";

// One "Filters" button next to the search box. The filter fields open in a panel
// below it and the active filters stay visible as removable chips.
export default function FilterDisclosure({ search, chips = [], onClear, children, label = "Filters" }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useRef(null);
  const close = () => { setOpen(false); toggle.current?.focus(); };
  return <div className="filter-disclosure">
    <div className="filter-bar">
      {search}
      <button ref={toggle} type="button" className="outline-button filter-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => !current)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2 3.5h12M4.5 8h7M7 12.5h2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        {label}
        {chips.length > 0 && <span className="filter-count" aria-label={`${chips.length} active`}>{chips.length}</span>}
      </button>
    </div>
    {chips.length > 0 && <ul className="filter-chips" aria-label="Active filters">
      {chips.map((chip) => <li key={chip.key} className="filter-chip">{chip.label}<button type="button" aria-label={`Remove filter ${chip.label}`} onClick={chip.onRemove}>×</button></li>)}
      {onClear && <li><button type="button" className="text-button" onClick={onClear}>Clear all</button></li>}
    </ul>}
    {open && <div className="filter-panel" id={panelId} onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
      {typeof children === "function" ? children({ close }) : children}
    </div>}
  </div>;
}
