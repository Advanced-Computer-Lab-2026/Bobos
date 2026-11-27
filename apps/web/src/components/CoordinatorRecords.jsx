import { Children, useId } from "react";
import PortalAvatar from "./PortalAvatar.jsx";

export function scheduleTone(status) {
  return ({ readyForStudentReview: "ready", readyToProcess: "ready", draft: "draft", processed: "completed" })[status] || "muted";
}

export function StudentIdentity({ name, id, email, nameAction }) {
  return <span className="register-person"><PortalAvatar name={name} /><span>{nameAction || <strong>{name || "Student"}</strong>}
    {id && <small className="student-number">{id}</small>}{email && <small>{email}</small>}</span></span>;
}

// The coordinator registers use the same table and student identity as Graduation review.
export function StudentRegister({ columns, label, children, className = "", listClassName }) {
  if (listClassName) return <ul className={listClassName} role="list" aria-label={label}>{children}</ul>;
  const labels = Object.fromEntries(columns.map((column, index) => [`--column-${index + 1}`, JSON.stringify(column)]));
  const actionClass = ["Action", "Actions"].includes(columns.at(-1)) ? "register-with-actions" : "";
  return <div className={`table-scroll graduation-register student-register ${actionClass} ${className}`} style={labels}>
    <table role="table" aria-label={label}><thead role="rowgroup"><tr role="row">{columns.map(column =>
      <th key={column} scope="col" role="columnheader">{column}</th>)}</tr></thead><tbody role="rowgroup">{children}</tbody></table>
  </div>;
}

export function RegisterRow({ children, className, listItem = false }) {
  if (listItem) return <li className="portal-request-row">{children}</li>;
  return <tr role="row" className={className}>{Children.map(children, child => <td role="cell">{child}</td>)}</tr>;
}

export function RecordPages({ page, size, total, onChange, label = "Records", busy = false }) {
  if (total <= size) return null;
  return <nav className="record-pages" aria-label={label + " pages"}><span>{(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}</span>
    <button type="button" className="outline-button" disabled={page <= 1 || busy} onClick={() => onChange(page - 1)}>Previous</button>
    <button type="button" className="outline-button" disabled={page * size >= total || busy} onClick={() => onChange(page + 1)}>Next</button>
  </nav>;
}

export function RecordActions({ name, children, burst = false }) {
  const id = useId();
  return <div className={`record-actions${burst ? " record-burst" : ""}`}>
    <button type="button" className="outline-button record-more" popoverTarget={id} aria-label={`More actions for ${name}`}
      onClick={burst ? event => { event.currentTarget.parentElement.toggleAttribute("data-pointer-motion", event.detail > 0); } : undefined}><span aria-hidden="true">
        <svg className="record-dots" viewBox="0 0 20 12" width="20" height="12" focusable="false" fill="currentColor">
          <circle cx="3" cy="6" r="1.7" /><circle cx="10" cy="6" r="1.7" /><circle cx="17" cy="6" r="1.7" />
        </svg>
      </span></button>
    <div id={id} className="record-menu" popover="auto" onClick={(event) => {
      if (event.target.closest("button")) event.currentTarget.hidePopover();
    }}>{children}</div></div>;
}

export function RegisterEmpty({ title, description, art = "extra-hours-folder.svg", action }) {
  return <div className="register-empty"><img src={'/portal-studio/images/' + art} alt="" width="148" height="110" />
    <h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}
