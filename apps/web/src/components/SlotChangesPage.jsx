import { termLabel } from "../term-label.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { filterSlotChanges } from "../slot-change-filters.js";
import FilterDisclosure from "./FilterDisclosure.jsx";
import { WorkspaceEmpty } from "./WorkspaceUI.jsx";

const path = "/api/slot-changes";
const statuses = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };
const date = (value) => value ? new Date(value).toLocaleString() : "—";
const meetingText = (slot) => `${slot.day} ${slot.startTime}–${slot.endTime} · ${slot.room}`;
const slotText = (slot) => `${slot.type} · Group ${slot.groupNumber} · ${(slot.meetings || [slot]).map(meetingText).join("; ")}`;
const options = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const emptyFilters = { search: "", status: "", advisor: "", course: "", from: "", to: "" };

function Status({ status }) {
  return <span className={`status-pill ${({ approved: "good", pending: "warning", rejected: "danger", withdrawn: "muted" })[status]}`}>{statuses[status]}</span>;
}

function NoteField({ label, value, onChange, hint, placeholder }) {
  return <label className="field"><span>{label} (optional)</span>{hint && <small>{hint}</small>}<textarea rows={3} maxLength={1000} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

export default function SlotChangesPage({ token, role, onOpenSchedule }) {
  const mine = role === "advisingStudent";
  const [data, setData] = useState(null);
  const [slotId, setSlotId] = useState("");
  const [note, setNote] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [detail, setDetail] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [replacementSlotId, setReplacement] = useState("");
  const [responseNote, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const heading = useRef(null);
  const studentRequestHeading = useRef(null);
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
      setMessage(result.message || (body?.decision ? "Decision saved." : endpoint === path ? "Request submitted." : "Request withdrawn."));
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
  const selectedRequest = mine ? requests.find((request) => request._id === selectedRequestId) : null;
  const advisors = [...new Map(requests.map(({ student }) => {
    const advisor = student?.assignedAdvisor;
    return [advisor?._id || "unassigned", advisor?.fullName || "Unassigned"];
  })).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const filterChips = [
    filters.status && { key: "status", label: `Status: ${statuses[filters.status] || filters.status}`, onRemove: () => setFilters((old) => ({ ...old, status: "" })) },
    filters.advisor && { key: "advisor", label: `Advisor: ${advisors.find(([id]) => id === filters.advisor)?.[1] || filters.advisor}`, onRemove: () => setFilters((old) => ({ ...old, advisor: "" })) },
    filters.course && { key: "course", label: `Course: ${filters.course}`, onRemove: () => setFilters((old) => ({ ...old, course: "" })) },
    filters.from && { key: "from", label: `From: ${filters.from}`, onRemove: () => setFilters((old) => ({ ...old, from: "" })) },
    filters.to && { key: "to", label: `To: ${filters.to}`, onRemove: () => setFilters((old) => ({ ...old, to: "" })) },
  ].filter(Boolean);
  const setFilter = (key) => (event) => setFilters((old) => ({ ...old, [key]: event.target.value }));
  const currentRequest = detail?.request;
  const eligibleSlots = (data?.slots || []).filter((slot) => !requests.some((request) =>
    request.status === "pending" && request.course?._id === slot.courseId && request.componentType === slot.type));

  return <div className="page-stack scheduling-page slot-changes-page workspace-page">
    <div className="workspace-header"><div><h1>Slot change requests</h1>
      <p>{mine ? "Ask your advising team to change an assigned lecture, tutorial, or lab." : "Review advising students’ requests and compare replacement slots."}</p></div>
      {mine && <button type="button" className="outline-button" onClick={onOpenSchedule}>My schedule</button>}
    </div>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {message && <div className="feedback success" role="status">{message}</div>}
    {!data && !error && <p role="status">Loading requests…</p>}
    {mine && data && <section className="panel form-stack">
      <h2>Request a slot change</h2>
      {data.issue ? <p>{data.issue}</p> : <>
        <p className="helper-text">{termLabel(data.term)} · Advising deadline: {date(data.term.advisingDeadline)}</p>
        {eligibleSlots.length ? <form className="form-stack" onSubmit={(event) => {
          event.preventDefault();
          const slot = eligibleSlots.find((item) => item.slotId === slotId);
          if (slot) action(path, { courseId: slot.courseId, slotId, preferenceNote: note });
        }}>
          <label className="field"><span>Assigned slot</span><select value={slotId} required onChange={(event) => setSlotId(event.target.value)}>
            <option value="">Choose a course and slot</option>
            {eligibleSlots.map((slot) => <option key={slot.slotId} value={slot.slotId}>{slot.courseCode} · {slotText(slot)}</option>)}
          </select></label>
          <NoteField label="What would work better?" value={note} onChange={setNote}
            hint="Your note guides the decision. Your advisor or coordinator chooses the exact replacement slot from the available options."
            placeholder="For example: Thursday lab group works better for me because…" />
          <div className="form-actions"><button className="primary-button" disabled={busy}>Submit request</button></div>
        </form> : <p>There are no other assigned slots you can request a change for.</p>}
      </>}
    </section>}
    {data && !detail && <section className="panel form-stack">
      <div className="results-heading"><h2>{mine ? "My requests" : "Request queue"}</h2><span className="result-count" aria-live="polite">{shown.length} {shown.length === 1 ? "request" : "requests"}</span></div>
      {!mine && <FilterDisclosure
        search={<label className="field filter-search"><span>Student or course</span><input type="search" name="slot-search" autoComplete="off" placeholder="Student ID, name or course…" value={filters.search} onChange={setFilter("search")} /></label>}
        chips={filterChips}
        onClear={filterChips.length ? () => setFilters(emptyFilters) : undefined}
      ><div className="slot-request-filters">
        <label className="field"><span>Status</span><select value={filters.status} onChange={setFilter("status")}><option value="">All statuses</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="field"><span>Advisor</span><select value={filters.advisor} onChange={setFilter("advisor")}><option value="">All advisors</option>{advisors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="field"><span>Course</span><select value={filters.course} onChange={setFilter("course")}><option value="">All courses</option>{options(requests.map((item) => item.course?.code)).map((code) => <option key={code}>{code}</option>)}</select></label>
        <label className="field"><span>Start date</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter("from")} /></label>
        <label className="field"><span>End date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter("to")} /></label>
      </div></FilterDisclosure>}
      {shown.length ? <div className="table-scroll"><table>
        <thead><tr>{!mine && <th>Student</th>}<th>Course and slot</th><th>Submitted</th><th>Status</th>{!mine && <th>Action</th>}{mine && <th>Details</th>}</tr></thead>
        <tbody>{shown.map((item) => <tr key={item._id}>
          {!mine && <td><strong>{item.student?.user?.fullName}</strong><span className="secondary-text">{item.student?.studentId} · {item.student?.assignedAdvisor?.fullName || "Unassigned"}</span></td>}
          <td><strong>{item.course?.code} · {item.componentType}</strong><span className="secondary-text">{item.currentSlotLabel || item.course?.name}</span></td>
          <td>{date(item.createdAt)}<span className="secondary-text">{termLabel(item.term)}</span></td>
          <td><Status status={item.status} /></td>
          {!mine && <td><button type="button" className="text-button" disabled={busy} id={`slot-request-${item._id}`} aria-label={`View request for ${item.student?.studentId}, ${item.course?.code}`} onClick={() => open(item._id)}>View request</button></td>}
          {mine && <td><button type="button" className="outline-button slot-request-view-button" id={`student-slot-request-${item._id}`} aria-label={`View ${item.componentType} change request for ${item.course?.code}`} onClick={() => {
            setSelectedRequestId(item._id);
            requestAnimationFrame(() => studentRequestHeading.current?.focus());
          }}>View details</button></td>}
        </tr>)}</tbody>
      </table></div> : <WorkspaceEmpty icon="calendar" title={requests.length ? "No matching requests" : "No slot-change requests"} description={requests.length ? "Try another student or course, or clear your filters to see all requests." : mine ? "Requests you submit for a different lecture, tutorial or lab will appear here." : "Students’ slot-change requests will appear here with their current slot and preferences."} />}
    </section>}
    {selectedRequest && <div className="modal-backdrop slot-request-modal-backdrop" role="presentation" onClick={() => {
      const id = selectedRequestId;
      setSelectedRequestId(null);
      requestAnimationFrame(() => document.getElementById(`student-slot-request-${id}`)?.focus());
    }}>
      <section className="modal-card wide-modal slot-request-card" role="dialog" aria-modal="true" aria-labelledby="student-slot-request-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
        if (event.key === "Escape") {
          const id = selectedRequestId;
          setSelectedRequestId(null);
          requestAnimationFrame(() => document.getElementById(`student-slot-request-${id}`)?.focus());
        }
      }}>
        <div className="modal-heading">
          <div><p className="eyebrow">MY SLOT CHANGE REQUEST · {termLabel(selectedRequest.term)}</p><h2 id="student-slot-request-title" ref={studentRequestHeading} tabIndex={-1}>{selectedRequest.course?.code} · {selectedRequest.componentType}</h2></div>
          <div className="slot-request-dialog-status"><Status status={selectedRequest.status} /><button type="button" className="icon-button" aria-label="Close request details" onClick={() => {
            const id = selectedRequestId;
            setSelectedRequestId(null);
            requestAnimationFrame(() => document.getElementById(`student-slot-request-${id}`)?.focus());
          }}>×</button></div>
        </div>
        <p className="slot-request-submitted">Submitted {date(selectedRequest.createdAt)}</p>
        <div className="slot-request-detail-grid">
          <div className="slot-request-detail-block"><span className="eyebrow">Current assigned slot</span><p>{selectedRequest.currentSlotLabel || selectedRequest.course?.name}</p></div>
          {selectedRequest.replacementSlotLabel && <div className="slot-request-detail-block"><span className="eyebrow">Approved replacement</span><p>{selectedRequest.replacementSlotLabel}</p></div>}
          <div className="slot-request-detail-block"><span className="eyebrow">Your preferred group or day</span><p>{selectedRequest.preferenceNote || "No preference provided."}</p></div>
          <div className="slot-request-detail-block"><span className="eyebrow">Advisor response</span><p>{selectedRequest.responseNote || (selectedRequest.status === "pending" ? "Your advisor has not responded yet." : "No response note provided.")}</p>
            {selectedRequest.decidedBy && <span className="secondary-text">{selectedRequest.decidedBy.fullName} · {date(selectedRequest.decidedAt)}</span>}
          </div>
        </div>
        <div className="slot-request-dialog-footer">
          <p>{selectedRequest.status === "pending" ? "Your advising team is reviewing this request." : selectedRequest.status === "approved" ? "The requested slot change was approved." : selectedRequest.status === "rejected" ? "The requested change was rejected; your assigned slot remains unchanged." : "You withdrew this request; your assigned slot remains unchanged."}</p>
          {selectedRequest.status === "pending" && <button type="button" className="outline-button" disabled={busy} onClick={() => action(`${path}/${selectedRequest._id}/withdraw`)}>Withdraw request</button>}
        </div>
      </section>
    </div>}
    {currentRequest && <section className="panel form-stack">
      <div className="form-actions"><button type="button" className="outline-button" disabled={busy} onClick={() => {
        setDetail(null); setError(""); setMessage("");
        requestAnimationFrame(() => document.getElementById(`slot-request-${currentRequest._id}`)?.focus());
      }}>Back to requests</button></div>
      <div className="results-heading"><div>
        <h2 ref={heading} tabIndex={-1}>{currentRequest.course?.code} · {currentRequest.componentType}</h2>
        <p>{currentRequest.student?.user?.fullName} · {currentRequest.student?.studentId}</p>
        <p className="helper-text">{termLabel(currentRequest.term)} · Submitted {date(currentRequest.createdAt)} · Advisor: {currentRequest.student?.assignedAdvisor?.fullName || "Unassigned"}</p>
      </div><Status status={currentRequest.status} /></div>
      <div className="slot-request-summary">
        <div><strong>Current slot on the request</strong><p>{currentRequest.currentSlotLabel || (detail.current ? slotText(detail.current) : "Slot no longer listed")}</p></div>
        <div><strong>Student’s preferred group or day</strong><p>{currentRequest.preferenceNote || "No preference provided."}</p></div>
      </div>
      {currentRequest.status === "pending" ? <form className="form-stack" onSubmit={(event) => {
        event.preventDefault();
        action(`${path}/${currentRequest._id}/decision`, { decision: "approved", replacementSlotId, responseNote });
      }}>
        <fieldset className="slot-alternatives">
          <legend>Replacement slots</legend>
          {detail.issue && <p className="helper-text">{detail.issue}</p>}
          {!detail.issue && !detail.alternatives.length && <p className="helper-text">No alternative slots are published for this component.</p>}
          {detail.alternatives.map((slot) => <label className="slot-alternative" key={slot.slotId} onDoubleClick={(event) => {
            event.preventDefault();
            setReplacement((selected) => selected === slot.slotId ? "" : selected);
          }}>
            <input type="radio" name="replacement" value={slot.slotId} checked={replacementSlotId === slot.slotId} onChange={() => setReplacement(slot.slotId)} disabled={busy || !slot.remainingSeats || !!slot.clashes.length} />
            <span><strong>{slot.type} · Group {slot.groupNumber}</strong>
              {slot.meetings.map((meeting) => <span className="secondary-text" key={meeting.slotId}>{meetingText(meeting)} · {meeting.remainingSeats} {meeting.remainingSeats === 1 ? "seat" : "seats"} left</span>)}
              <span className="secondary-text">{slot.clashes.length ? `Clashes with ${slot.clashes.join("; ")}` : "No timetable clash"}</span>
            </span>
          </label>)}
        </fieldset>
        {replacementSlotId && <button type="button" className="text-button slot-clear-selection" disabled={busy} onClick={() => setReplacement("")}>Clear selected slot</button>}
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
