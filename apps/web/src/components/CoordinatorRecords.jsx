import { useId } from "react";
import PortalAvatar from "./PortalAvatar.jsx";

export function scheduleTone(status) {
  return ({ readyForStudentReview: "ready", readyToProcess: "ready", draft: "draft", processed: "completed" })[status] || "muted";
}

export function StudentIdentity({ name, id, email }) {
  return <span className="register-person"><PortalAvatar name={name} /><span><strong>{name || "Student"}</strong>
    {id && <small className="student-number">{id}</small>}{email && <small>{email}</small>}</span></span>;
}

export function RecordPages({ page, size, total, onChange, label = "Records", busy = false }) {
  if (total <= size) return null;
  return <nav className="record-pages" aria-label={label + " pages"}><span>{(page - 1) * size + 1}–{Math.min(page * size, total)} of {total}</span>
    <button type="button" className="outline-button" disabled={page <= 1 || busy} onClick={() => onChange(page - 1)}>Previous</button>
    <button type="button" className="outline-button" disabled={page * size >= total || busy} onClick={() => onChange(page + 1)}>Next</button>
  </nav>;
}

export function RecordActions({ name, children }) {
  const id = useId();
  return <div className="record-actions"><button type="button" className="outline-button record-more" popoverTarget={id} aria-label={'More actions for ' + name}>•••</button>
    <div id={id} className="record-menu" popover="auto" onClick={(event) => {
      if (event.target.closest("button")) event.currentTarget.hidePopover();
    }}>{children}</div></div>;
}

export function RegisterEmpty({ title, description, art = "extra-hours-folder.svg", action }) {
  return <div className="register-empty"><img src={'/portal-studio/images/' + art} alt="" width="148" height="110" />
    <h3>{title}</h3>{description && <p>{description}</p>}{action}</div>;
}
