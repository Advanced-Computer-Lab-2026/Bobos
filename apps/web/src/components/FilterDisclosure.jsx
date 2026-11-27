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
    const bounds = fields.map(field => field.getBoundingClientRect());
    const animations = fields.map((field, index) => {
      const rect = bounds[index];
      const x = trigger.left + trigger.width / 2 - rect.left - rect.width / 2;
      const y = trigger.top + trigger.height / 2 - rect.top - rect.height / 2;
      const tilt = Math.sign(x || 1);
      const pose = (offset, progress, lift, angle, scale, opacity = 1) => ({
        offset, opacity, easing: "steps(1, end)",
        transform: `translate3d(${Math.round(x * progress)}px, ${Math.round(y * progress + lift)}px, 0) rotate(${angle * tilt}deg) scale(${scale})`,
      });
      // Held poses echo the teaching week's paper cards finding their places.
      return field.animate([
        pose(0, 1, 0, -11, .18, 0),
        pose(.07, .93, -5, -9, .25, .45),
        pose(.17, .78, -10, -7, .39),
        pose(.28, .60, -15, -2, .56),
        pose(.39, .42, -17, 4, .70),
        pose(.50, .24, -14, 5, .83),
        pose(.61, .11, -7, 2, .93),
        pose(.72, .025, -3, -1.5, .98),
        pose(.82, 0, 2, .7, 1),
        pose(.91, 0, -1, -.25, 1),
        pose(.97, 0, 0, 0, 1),
        { offset: 1, opacity: 1, transform: "none" },
      ], { duration: 685, delay: Math.min(index, 7) * 75, fill: "backwards" });
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [open]);
  useEffect(() => {
    if (!floating || !open) return;
    const outside = (event) => {
      if (!event.composedPath().includes(root.current)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
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
