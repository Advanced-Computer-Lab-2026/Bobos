import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { filterSlotChanges } from "../slot-change-filters.js";

const path = "/api/slot-changes";
const statuses = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };
const date = (value) => value ? new Date(value).toLocaleString() : "—";
const slotText = (slot) => `${slot.type} · Group ${slot.groupNumber} · ${slot.day} ${slot.startTime}–${slot.endTime} · ${slot.room}`;
const options = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const emptyFilters = { search: "", status: "", advisor: "", course: "", from: "", to: "" };

function Status({ status }) {
  return <span className={`status-pill ${({ approved: "good", pending: "warning", rejected: "muted", withdrawn: "muted" })[status]}`}>{statuses[status]}</span>;
}

function NoteField({ label, value, onChange }) {
  return <label className="field"><span>{label} (optional)</span><textarea rows={3} maxLength={1000} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export default function SlotChangesPage({ token, role, onOpenSchedule }) {
  const mine = role === "advisingStudent";
  const [data, setData] = useState(null);
  const [slotId, setSlotId] = useState("");
  const [note, setNote] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [detail, setDetail] = useState(null);
  const [replacementSlotId, setReplacement] = useState("");
  const [responseNote, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const heading = useRef(null);
  const load = useCallback((signal) => api(mine ? `${path}/me` : path, { token, signal }), [mine, token]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(setData).catch((err) => { if (err.name !== "AbortError") setError(err.message); });
    return () => controller.abort();
  }, [load]);

  async function open(id) {
    setError(""); setMessage(""); setBusy(true);
    try {
      setDetail(await api(`${path}/${id}`, { token }));
      setReplacement(""); setResponse("");
      requestAnimationFrame(() => heading.current?.focus());
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function action(endpoint, body) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const result = await api(endpoint, { token, method: "POST", body });
      setMessage(result.message || (endpoint === path ? "Request submitted." : "Request withdrawn."));
      if (endpoint === path) { setSlotId(""); setNote(""); }
      setData(await load());
      if (detail) {
        setDetail(await api(`${path}/${detail.request._id}`, { token }));
        setReplacement(""); setResponse("");
      }
    } catch (err) {
      setError(err.message);
      if (err.status === 409 && detail) {
        try { setDetail(await api(`${path}/${detail.request._id}`, { token })); setReplacement(""); }
        catch { /* Keep the original decision error visible. */ }
      }
    } finally { setBusy(false); }
  }

  const requests = data?.requests || [];
  const shown = filterSlotChanges(requests, filters);
  const advisors = [...new Map(requests.map(({ student }) => {
    const advisor = student?.assignedAdvisor;
    return [advisor?._id || "unassigned", advisor?.fullName || "Unassigned"];
  })).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const setFilter = (key) => (event) => setFilters((old) => ({ ...old, [key]: event.target.value }));
  const currentRequest = detail?.request;
  const eligibleSlots = (data?.slots || []).filter((slot) => !requests.some((request) =>
    request.status === "pending" && request.currentSlotGroupId === slot.slotId));

  return <div className="page-stack scheduling-page slot-changes-page">
    <div className="page-title-row"><div><h1>Slot change requests</h1>
      <p>{mine ? "Ask your advising team to change an assigned lecture, tutorial, or lab." : "Review advising students’ requests and compare replacement slots."}</p></div>
      {mine && <button type="button" className="outline-button" onClick={onOpenSchedule}>My schedule</button>}
    </div>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {message && <div className="feedback info" role="status">{message}</div>}
    {!data && !error && <p role="status">Loading requests…</p>}
    {mine && data && <section className="panel form-stack">
      <h2>Request a slot change</h2>
      {data.issue ? <p>{data.issue}</p> : <>
        <p className="helper-text">Term {data.term.code} · Advising deadline: {date(data.term.advisingDeadline)}</p>
        {eligibleSlots.length ? <form className="form-stack" onSubmit={(event) => {
          event.preventDefault();
          const slot = eligibleSlots.find((item) => item.slotId === slotId);
          if (slot) action(path, { courseId: slot.courseId, slotId, preferenceNote: note });
        }}>
          <label className="field"><span>Assigned slot</span><select value={slotId} required onChange={(event) => setSlotId(event.target.value)}>
            <option value="">Choose a course and slot</option>
            {eligibleSlots.map((slot) => <option key={slot.slotId} value={slot.slotId}>{slot.courseCode} · {slotText(slot)}</option>)}
          </select></label>
          <NoteField label="Preferred group or day" value={note} onChange={setNote} />
          <div className="form-actions"><button className="primary-button" disabled={busy}>Submit request</button></div>
        </form> : <p>There are no other assigned slots you can request a change for.</p>}
      </>}
    </section>}
    {data && !detail && <section className="panel form-stack">
      <div className="results-heading"><h2>{mine ? "My requests" : "Requests"}</h2><span className="helper-text" aria-live="polite">{shown.length} {shown.length === 1 ? "request" : "requests"}</span></div>
      {!mine && <div className="slot-request-filters">
        <label className="field"><span>Search</span><input type="search" placeholder="Student ID, name, or course code" value={filters.search} onChange={setFilter("search")} /></label>
        <label className="field"><span>Status</span><select value={filters.status} onChange={setFilter("status")}><option value="">All statuses</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="field"><span>Advisor</span><select value={filters.advisor} onChange={setFilter("advisor")}><option value="">All advisors</option>{advisors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="field"><span>Course</span><select value={filters.course} onChange={setFilter("course")}><option value="">All courses</option>{options(requests.map((item) => item.course?.code)).map((code) => <option key={code}>{code}</option>)}</select></label>
        <label className="field"><span>Submitted from</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter("from")} /></label>
        <label className="field"><span>Submitted through</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter("to")} /></label>
        {Object.values(filters).some(Boolean) && <div className="form-actions"><button type="button" className="text-button" onClick={() => setFilters(emptyFilters)}>Clear filters</button></div>}
      </div>}
      {shown.length ? <div className="table-scroll"><table>
        <thead><tr>{!mine && <th>Student</th>}<th>Course and slot</th><th>Submitted</th><th>Status</th>{mine && <th>Response</th>}<th>Action</th></tr></thead>
        <tbody>{shown.map((item) => <tr key={item._id}>
          {!mine && <td><strong>{item.student?.user?.fullName}</strong><span className="secondary-text">{item.student?.studentId} · {item.student?.assignedAdvisor?.fullName || "Unassigned"}</span></td>}
          <td><strong>{item.course?.code} · {item.componentType}</strong><span className="secondary-text">{item.currentSlotLabel || item.course?.name}</span></td>
          <td>{date(item.createdAt)}<span className="secondary-text">{item.term?.code}</span></td>
          <td><Status status={item.status} /></td>
          {mine && <td className="slot-response">{item.replacementSlotLabel && <strong>{item.replacementSlotLabel}</strong>}
            {item.decidedBy && <span className="secondary-text">{item.decidedBy.fullName} · {date(item.decidedAt)}</span>}
            {item.responseNote && <span className="secondary-text">{item.responseNote}</span>}
            {!item.replacementSlotLabel && !item.decidedBy && !item.responseNote && "—"}
          </td>}
          <td>{mine ? item.status === "pending" && <button type="button" className="text-button" disabled={busy} onClick={() => action(`${path}/${item._id}/withdraw`)}>Withdraw</button>
            : <button type="button" className="text-button" disabled={busy} id={`slot-request-${item._id}`} aria-label={`View request for ${item.student?.studentId}, ${item.course?.code}`} onClick={() => open(item._id)}>View request</button>}</td>
        </tr>)}</tbody>
      </table></div> : <p>{requests.length ? "No requests match these filters." : "There are no slot change requests yet."}</p>}
    </section>}
    {currentRequest && <section className="panel form-stack">
      <div className="form-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => {
        setDetail(null); setError(""); setMessage("");
        requestAnimationFrame(() => document.getElementById(`slot-request-${currentRequest._id}`)?.focus());
      }}>Back to requests</button></div>
      <div className="results-heading"><div>
        <h2 ref={heading} tabIndex={-1}>{currentRequest.course?.code} · {currentRequest.componentType}</h2>
        <p>{currentRequest.student?.user?.fullName} · {currentRequest.student?.studentId}</p>
        <p className="helper-text">Term {currentRequest.term?.code} · Submitted {date(currentRequest.createdAt)} · Advisor: {currentRequest.student?.assignedAdvisor?.fullName || "Unassigned"}</p>
      </div><Status status={currentRequest.status} /></div>
      <div className="slot-request-summary">
        <div><strong>Current slot on the request</strong><p>{currentRequest.currentSlotLabel || (detail.current ? slotText(detail.current) : "Slot no longer listed")}</p></div>
        <div><strong>Student’s preference</strong><p>{currentRequest.preferenceNote || "No preference provided."}</p></div>
      </div>
      {currentRequest.status === "pending" ? <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        action(`${path}/${currentRequest._id}/decision`, { decision: "approved", replacementSlotId, responseNote });
      }}>
        <fieldset className="slot-alternatives">
          <legend>Replacement slots</legend>
          {detail.issue && <p className="helper-text">{detail.issue}</p>}
          {!detail.issue && !detail.alternatives.length && <p className="helper-text">No alternative slots are published for this component.</p>}
          {detail.alternatives.map((slot) => <label className="slot-alternative" key={slot.slotId}>
            <input type="radio" name="replacement" value={slot.slotId} checked={replacementSlotId === slot.slotId} onChange={() => setReplacement(slot.slotId)} disabled={busy || !slot.remainingSeats || !!slot.clashes.length} />
            <span><strong>{slotText(slot)}</strong><span className="secondary-text">{slot.remainingSeats} {slot.remainingSeats === 1 ? "seat" : "seats"} left · {slot.clashes.length ? `Clashes with ${slot.clashes.join("; ")}` : "No timetable clash"}</span></span>
          </label>)}
        </fieldset>
        <NoteField label="Response to student" value={responseNote} onChange={setResponse} />
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={busy || !replacementSlotId}>Approve change</button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => action(`${path}/${currentRequest._id}/decision`, { decision: "rejected", responseNote })}>Reject request</button>
        </div>
      </form> : <div className="slot-request-summary">
        {currentRequest.replacementSlotLabel && <div><strong>Approved replacement</strong><p>{currentRequest.replacementSlotLabel}</p></div>}
        <div><strong>Response</strong><p>{currentRequest.responseNote || "No response note."}</p>
          {currentRequest.decidedBy && <p className="helper-text">{currentRequest.decidedBy.fullName} · {date(currentRequest.decidedAt)}</p>}
        </div>
      </div>}
    </section>}
  </div>;
}
