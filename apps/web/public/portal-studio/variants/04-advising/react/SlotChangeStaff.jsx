import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { filterSlotChanges } from "../../slot-change-filters.js";
import { RouteFrame, Status, Facts, Conversation, Feedback, Confirm, useFilters, date, pretty, groupBy } from "./shared.jsx";

const base = "/api/slot-changes";
const defaults = { search: "", status: "", advisor: "", course: "", from: "", to: "" };
const meeting = (slot) => `${slot.day} ${slot.startTime}–${slot.endTime} · ${slot.room}`;
const slotLabel = (slot) => `${slot.type} · Group ${slot.groupNumber} · ${(slot.meetings || [slot]).map(meeting).join("; ")}`;
const available = (slot) => slot && Number(slot.remainingSeats) > 0 && !(slot.clashes || []).length;

export default function SlotChangeStaffRoute({ Original, token, role }) {
  return <RouteFrame routeKey="slot-changes-staff" allowed={["advisor", "coordinator"].includes(role)} Original={Original}>
    {(design) => <StaffReview token={token} role={role} design={design} />}
  </RouteFrame>;
}

export function StaffReview({ token, role, design }) {
  const [filters, setFilters] = useFilters(`portal-ad4-api-filters:slots:${role}`, defaults);
  const [requests, setRequests] = useState(null), [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true), [opening, setOpening] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [replacement, setReplacement] = useState(""), [note, setNote] = useState(""), [confirm, setConfirm] = useState(null), [confirmError, setConfirmError] = useState("");
  const [step, setStep] = useState(0);
  const heading = useRef(null), generation = useRef(0), active = useRef(true), lastOpen = useRef(null);
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []);
  const refresh = useCallback(async (signal) => {
    setLoading(true); setError("");
    try { const result = await api(base, { token, signal }); if (active.current && !signal?.aborted) setRequests(result.requests || []); }
    catch (err) { if (active.current && err.name !== "AbortError") setError(err.message); }
    finally { if (active.current && !signal?.aborted) setLoading(false); }
  }, [token]);
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  async function open(id, focus = true) {
    const seq = ++generation.current; lastOpen.current = id; setOpening(true); setDetail(null); setReplacement(""); setError(""); setMessage("");
    try {
      const result = await api(`${base}/${encodeURIComponent(id)}`, { token });
      if (seq !== generation.current || !active.current) return;
      setDetail(result); setReplacement(""); setNote(""); setStep(0);
      if (focus) requestAnimationFrame(() => heading.current?.focus({ preventScroll: design === 3 || design === 6 }));
    } catch (err) { if (seq === generation.current && active.current) setError(err.message); }
    finally { if (seq === generation.current && active.current) setOpening(false); }
  }
  function back() {
    const id = detail?.request?._id; lastOpen.current = null; generation.current++; setDetail(null); setReplacement(""); setConfirm(null); setError(""); setMessage(""); setOpening(false);
    requestAnimationFrame(() => document.getElementById(`ad4r-request-${id}`)?.focus());
  }
  async function decide() {
    const selected = detail?.alternatives?.find((slot) => slot.slotId === replacement);
    if (!detail || detail.request.status !== "pending" || detail.issue) { setConfirmError("This request is no longer available for a decision. Refresh it before continuing."); return; }
    if (confirm === "approved" && !available(selected)) { setConfirmError("Choose a replacement with capacity and no clash."); return; }
    setBusy(true); setConfirmError(""); setError(""); let committed = false;
    try {
      const result = await api(`${base}/${encodeURIComponent(detail.request._id)}/decision`, { token, method: "POST", body: { decision: confirm, ...(confirm === "approved" ? { replacementSlotId: replacement } : {}), responseNote: note.trim() } });
      if (!active.current) return;
      committed = true; setConfirm(null); setMessage(result.message || `Request ${confirm}.`); setReplacement("");
      // No optimistic schedule mutation: the server rechecks assignment, deadline, capacity and clashes.
      const [queue, updated] = await Promise.all([api(base, { token }), api(`${base}/${encodeURIComponent(detail.request._id)}`, { token })]);
      if (active.current) { setRequests(queue.requests || []); setDetail(updated); }
    } catch (err) {
      if (!active.current) return;
      if (committed) { setConfirm(null); setError(`The decision was saved, but refreshing failed: ${err.message}`); } else if (err.status === 409) {
        setReplacement(""); setConfirm(null); setError(`${err.message} The request has been refreshed; review it before deciding again.`);
        try { const updated = await api(`${base}/${encodeURIComponent(detail.request._id)}`, { token }); if (active.current) { setDetail(updated); setReplacement(""); } } catch (loadError) { if (active.current) setError(`${err.message} Refresh failed: ${loadError.message}`); }
      } else setConfirmError(err.message);
    } finally { if (active.current) setBusy(false); }
  }
  const all = requests || [], invalidDates = filters.from && filters.to && filters.from > filters.to;
  const shown = invalidDates ? [] : filterSlotChanges(all, filters);
  const ordered = design === 6 ? [...shown].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || new Date(a.createdAt) - new Date(b.createdAt)) : shown;
  const advisors = [...new Map(all.map((r) => [r.student?.assignedAdvisor?._id || "unassigned", r.student?.assignedAdvisor?.fullName || "Unassigned"]))];
  const courses = [...new Set(all.map((r) => r.course?.code).filter(Boolean))].sort();
  const update = (key) => (event) => setFilters((old) => ({ ...old, [key]: event.target.value }));
  const current = detail?.request, selected = detail?.alternatives?.find((slot) => slot.slotId === replacement);
  const split = [3, 6].includes(design), showList = !current || split;
  function rows(items) {
    return <div className="ad4r-table-scroll"><table className="ad4r-requests"><thead><tr><th>Student</th><th>Course / current slot</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map((r) => <tr key={r._id} className={current?._id === r._id ? "ad4r-selected" : ""}>
      <td data-label="Student"><strong>{r.student?.user?.fullName || "Student"}</strong><small>{r.student?.studentId} · {r.student?.assignedAdvisor?.fullName || "Unassigned"}</small></td>
      <td data-label="Course / current slot"><strong>{r.course?.code} · {r.componentType}</strong><small>{r.currentSlotLabel || r.course?.name}</small></td>
      <td data-label="Submitted">{date(r.createdAt)}<small>{r.term?.code}</small></td><td data-label="Status"><Status value={r.status} /></td>
      <td data-label="Action"><button type="button" className="text-button" id={`ad4r-request-${r._id}`} disabled={busy || opening} onClick={() => open(r._id)} aria-label={`Review ${r.student?.studentId}, ${r.course?.code}`}>Review request</button></td>
    </tr>)}</tbody></table></div>;
  }
  const filterUI = <form className="ad4r-filters" onSubmit={(e) => e.preventDefault()}>
    <label className="field ad4r-search"><span>Student or course</span><input type="search" maxLength={100} value={filters.search} onChange={update("search")} placeholder="Student ID, name or course" /></label>
    <label className="field"><span>Status</span><select value={filters.status} onChange={update("status")}><option value="">All statuses</option>{["pending", "approved", "rejected", "withdrawn"].map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select></label>
    <label className="field"><span>Advisor</span><select value={filters.advisor} onChange={update("advisor")}><option value="">All advisors</option>{advisors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    <label className="field"><span>Course</span><select value={filters.course} onChange={update("course")}><option value="">All courses</option>{courses.map((c) => <option key={c}>{c}</option>)}</select></label>
    <label className="field"><span>From</span><input type="date" value={filters.from} onChange={update("from")} max={filters.to || undefined} /></label>
    <label className="field"><span>To</span><input type="date" value={filters.to} onChange={update("to")} min={filters.from || undefined} /></label>
    <button className="text-button" type="button" onClick={() => setFilters(defaults)}>Clear filters</button>
    {invalidDates && <p className="feedback error" role="alert">The end date must be on or after the start date.</p>}
  </form>;
  const overview = current && <section className="ad4r-request-overview">
    <div className="ad4r-record-title"><Conversation replay={current._id} /><div><h2 ref={heading} tabIndex={-1}>{current.course?.code} · {current.componentType}</h2><p>{current.student?.user?.fullName} · {current.student?.studentId}</p></div><Status value={current.status} /></div>
    <Facts items={[["Current assigned slot", current.currentSlotLabel || (detail.current && slotLabel(detail.current))], ["Student’s preference", current.preferenceNote || "No preference provided."], ["Advisor", current.student?.assignedAdvisor?.fullName || "Unassigned"], ["Submitted", date(current.createdAt)], ["Term", current.term?.code]]} />
    {detail.issue && <p className="feedback info" role="status">{detail.issue}</p>}
  </section>;
  const alternatives = current && <fieldset className="ad4r-alternatives" disabled={busy || opening}>
    <legend>Exact replacement slot</legend><p className="helper-text">Capacity and clashes are checked again by the server when a decision is saved.</p>
    {!detail.alternatives?.length && <p>No valid alternative slots are available. You may reject the request with an optional explanation.</p>}
    {(detail.alternatives || []).map((slot) => <label className={`ad4r-slot ${replacement === slot.slotId ? "ad4r-slot-selected" : ""}`} key={slot.slotId}>
      <input type="radio" name="replacementSlotId" value={slot.slotId} checked={replacement === slot.slotId} disabled={!available(slot)} onChange={() => setReplacement(slot.slotId)} />
      <span><strong>{slot.type} · Group {slot.groupNumber}</strong>{(slot.meetings || [slot]).map((m, i) => <small key={m.slotId || i}>{meeting(m)}</small>)}<small>{slot.remainingSeats} places remaining · {(slot.clashes || []).length ? `Clashes with ${slot.clashes.join("; ")}` : "No timetable clash"}</small></span>
    </label>)}
    {replacement && <button className="text-button" type="button" onClick={() => setReplacement("")}>Clear selected slot</button>}
  </fieldset>;
  const decision = current && <section className="ad4r-decision">
    <h3>Decision</h3>{selected && <p className="ad4r-chosen">Selected replacement: {slotLabel(selected)}</p>}
    <label className="field"><span>Response to student (optional)</span><textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} /></label>
    <div className="form-actions"><button type="button" className="primary-button" disabled={busy || opening || !available(selected)} onClick={() => { setConfirmError(""); setConfirm("approved"); }}>Approve change</button><button type="button" className="outline-button" disabled={busy || opening} onClick={() => { setConfirmError(""); setConfirm("rejected"); }}>Reject request</button></div>
    <p className="helper-text">Approval updates the draft, not a processed final schedule. Rejection keeps the assigned slot unchanged.</p>
  </section>;
  return <div className="ad4r-page ad4r-slots">
    <header className="workspace-header"><div><h1>Slot change requests</h1><p>{role === "advisor" ? "Review requests for students assigned to you." : "Review requests across all advising students."}</p></div><button type="button" className="outline-button" disabled={busy || loading} onClick={() => refresh()}>Refresh queue</button></header>
    <Feedback error={error} message={message} busy={busy || opening} retry={() => lastOpen.current ? open(lastOpen.current) : refresh()} />
    {(loading || opening) && <p role="status">{opening ? "Loading the request and current alternatives…" : "Loading requests…"}</p>}
    <div className="ad4r-slot-layout">
      {showList && <section className="ad4r-queue" aria-busy={loading}>
        <div className="results-heading"><h2>Request queue</h2><span className="result-count" aria-live="polite">{shown.length} requests</span></div>{filterUI}
        {!loading && !ordered.length ? <div className="ad4r-empty"><h3>{all.length ? "No matching requests" : "No requests to review"}</h3><p>{all.length ? "Change the filters or clear your search." : "Requests appear here when eligible students submit them."}</p></div> : [4, 7, 10].includes(design) ? <div className={design === 4 ? "ad4r-lanes" : "ad4r-groups"}>{groupBy(ordered, (r) => design === 4 ? pretty(r.status) : design === 7 ? r.course?.code || "Course" : new Date(r.createdAt).toLocaleDateString()).map(([label, group]) => <section key={label}><h3>{label}</h3>{rows(group)}</section>)}</div> : rows(ordered)}
      </section>}
      {current && <section className="ad4r-reader" aria-busy={opening}>
        <button type="button" className="text-button ad4r-back" disabled={busy || opening} onClick={back}>← Back to request queue</button>
        {design === 9 && current.status === "pending" && !detail.issue && <nav className="ad4r-steps" aria-label="Request review steps">{["Request", "Alternatives", "Decision"].map((label, i) => <button type="button" key={label} aria-pressed={step === i} onClick={() => setStep(i)}>{i + 1}. {label}</button>)}</nav>}
        <div className="ad4r-detail-content">
          <div hidden={design === 9 && step !== 0 && current.status === "pending" && !detail.issue}>{overview}</div>
          {current.status === "pending" && !detail.issue ? <><div hidden={design === 9 && step !== 1}>{alternatives}</div><div hidden={design === 9 && step !== 2}>{decision}</div></> : current.status !== "pending" && <section className="ad4r-decision-record"><h3>Decision record</h3><Facts items={[["Replacement", current.replacementSlotLabel || "Assigned slot unchanged"], ["Response", current.responseNote || "No response note."], ["Decided by", current.decidedBy?.fullName], ["Decided at", date(current.decidedAt)]]} /></section>}
        </div>
      </section>}
      {split && !current && <aside className="ad4r-reader ad4r-empty"><Conversation /><h2>Choose a request</h2><p>Read the student’s preferences alongside available slots, then make a decision.</p></aside>}
    </div>
    {confirm && <Confirm title={confirm === "approved" ? "Approve this exact slot change?" : "Reject this request?"} action={confirm === "approved" ? "Approve change" : "Reject request"} busy={busy} error={confirmError} onClose={() => setConfirm(null)} onConfirm={decide}>
      <p>{current?.student?.user?.fullName} · {current?.student?.studentId} · {current?.course?.code}</p><p>{confirm === "approved" ? selected && slotLabel(selected) : "The student's currently assigned slot will remain unchanged."}</p>{note && <p>Response: {note}</p>}
    </Confirm>}
  </div>;
}
