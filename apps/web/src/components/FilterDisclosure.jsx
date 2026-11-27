import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// Search remains available while the individual filter fields are tucked away.
export default function FilterDisclosure({ search, chips = [], onClear, children, label = "Filters", floating = false, actions }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useRef(null);
  const close = () => { setOpen(false); toggle.current?.focus(); };
  const root = useRef(null);
  const panel = useRef(null);
  const pointerOpen = useRef(false);
  useLayoutEffect(() => {
    if (!open || !pointerOpen.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const trigger = toggle.current.getBoundingClientRect();
    const fields = [...panel.current.querySelectorAll(".field, .filter-panel-actions > button")];
    const triggerCenter = trigger.left + trigger.width / 2;
    const placements = fields.map(field => {
      const rect = field.getBoundingClientRect();
      return { field, distance: triggerCenter - rect.left - rect.width / 2, top: rect.top };
    });
    placements.sort((a, b) => a.top - b.top || Math.abs(a.distance) - Math.abs(b.distance));
    const animations = placements.map(({ field, distance }, index) => {
      // Each field fans out near its own position, starting with those closest to the trigger.
      const slide = Math.max(-18, Math.min(18, distance * .08));
      return field.animate([
        { opacity: 0, transform: `translate(${slide}px, -11px) rotate(${slide / 10}deg) scale(.97)`, easing: "cubic-bezier(.2,.72,.3,1)" },
        { offset: .75, opacity: 1, transform: "translateY(1px)", easing: "ease-out" },
        { opacity: 1, transform: "none" },
      ], { duration: 225, delay: Math.min(index, 5) * 24, fill: "backwards" });
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [open]);
  useEffect(() => {
    if (!floating || !open) return;
    const outside = (event) => {
      if (!event.composedPath().includes(root.current)) setOpen(false);
    };
    document.addEventListener("click", outside, true);
    return () => document.removeEventListener("click", outside, true);
  }, [floating, open]);
  return <div ref={root} className={"filter-disclosure" + (floating ? " floating-filters" : "")} onKeyDown={(event) => {
    if (open && event.key === "Escape" && !event.defaultPrevented) { event.stopPropagation(); close(); }
  }}>
    <div className="filter-bar">
      {search}
      <button ref={toggle} type="button" className="outline-button filter-toggle" aria-expanded={open} aria-controls={panelId} onClick={event => { pointerOpen.current = event.detail > 0; setOpen(current => !current); }}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2 3.5h12M4.5 8h7M7 12.5h2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        {label}
        {chips.length > 0 && <span className="filter-count" aria-label={`${chips.length} active`}>{chips.length}</span>}
      </button>
      {actions}
    </div>
    {chips.length > 0 && <ul className="filter-chips" aria-label="Active filters">
      {chips.map((chip) => <li key={chip.key} className="filter-chip">{chip.label}<button type="button" aria-label={`Remove filter ${chip.label}`} onClick={chip.onRemove}>×</button></li>)}
      {onClear && <li><button type="button" className="text-button" onClick={onClear}>Clear all</button></li>}
    </ul>}
    {open && <div ref={panel} className="filter-panel" id={panelId}>
      {typeof children === "function" ? children({ close }) : children}
    </div>}
  </div>;
}
