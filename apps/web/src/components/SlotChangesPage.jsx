import { RegisterRow, StudentIdentity, StudentRegister } from "./CoordinatorRecords.jsx";
import PortalAvatar from "./PortalAvatar.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import { termLabel } from "../term-label.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { filterSlotChanges, slotSubmissionDay, slotSubmissionTimeZone } from "../slot-change-filters.js";
import FilterDisclosure from "./FilterDisclosure.jsx";
import { WorkspaceEmpty } from "./WorkspaceUI.jsx";

const path = "/api/slot-changes";
const statuses = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };
const date = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const submittedAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: slotSubmissionTimeZone });
const submittedHeading = new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeZone: slotSubmissionTimeZone });
const component = (type = "") => type.replace(/^./, (letter) => letter.toUpperCase());
const meetingText = (slot) => `${slot.day} ${slot.startTime}–${slot.endTime} · ${slot.room}`;
const slotText = (slot) => `${slot.type} · Group ${slot.groupNumber} · ${(slot.meetings || [slot]).map(meetingText).join("; ")}`;
const options = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const emptyFilters = { search: "", status: "", advisor: "", course: "", from: "", to: "" };

function Status({ status }) {
  return <span className={`status-pill ${({ approved: "good", pending: "warning", rejected: "danger", withdrawn: "muted" })[status]}`}>{statuses[status]}</span>;
}

function NoteField({ label, value, onChange, hint, placeholder, className = "" }) {
  return <label className={`field ${className}`}><span>{label} (optional)</span>{hint && <small>{hint}</small>}<textarea rows={3} maxLength={1000} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

export default function SlotChangesPage({ token, role, onOpenSchedule }) {
  const mine = role === "advisingStudent";
  const coordinator = role === "coordinator";
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
  const pageRef = useRef(null);
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
  const shown = filterSlotChanges(requests, filters, coordinator);
  const submissionDays = coordinator ? [...Map.groupBy(shown, item => slotSubmissionDay(item.createdAt, true))]
    .sort(([a], [b]) => b.localeCompare(a)) : [];
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

  const requestRegister = (items, label) => <StudentRegister label={label} className="slot-register" columns={["Student", "Course", "Student preference", "Status", "Actions"]} listClassName={!coordinator && "portal-request-list slot-request-list"}>
    {items.map((item) => <RegisterRow key={item._id} listItem={!coordinator}>
      {coordinator ? <StudentIdentity name={item.student?.user?.fullName} id={item.student?.studentId} /> : <div className="request-row-student portal-person-cell">
        <PortalAvatar name={item.student?.user?.fullName} />
        <div><strong>{item.student?.user?.fullName || "Unknown student"}</strong><small>{item.student?.studentId}</small><small>Advisor {item.student?.assignedAdvisor?.fullName || "unassigned"}</small></div>
      </div>}
      <div className="request-row-course portal-person-cell">
        <OfferingCourseIcon code={item.course?.code} />
        <div><strong>{item.course?.name || item.course?.code || "Unknown course"}</strong><small>{item.course?.name && item.course?.code ? `${item.course.code} · ` : ""}{component(item.componentType)}</small></div>
      </div>
      {coordinator ? <span className="slot-preference-excerpt">{item.preferenceNote || "No preference provided."}</span> : <div className="request-row-context">
        <strong>{item.currentSlotLabel ? "Current assigned slot" : "Student preference"}</strong>
        <small>{item.currentSlotLabel || item.preferenceNote || "No preference provided."}</small>
      </div>}
      <div className="request-row-status">
        <Status status={item.status} />
        {!coordinator && <small><time dateTime={item.createdAt}>{date(item.createdAt)}</time></small>}
        <small>{termLabel(item.term)}</small>
      </div>
      <div className="request-row-actions">
        <button type="button" className="outline-button request-review-action" disabled={busy} id={`slot-request-${item._id}`} aria-label={`View request for ${item.student?.studentId}, ${item.course?.code}`} onClick={() => open(item._id)}>View request</button>
      </div>
    </RegisterRow>)}
  </StudentRegister>;

  return <div className="page-stack scheduling-page slot-changes-page workspace-page" ref={pageRef}>
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
        <label className="field"><span>{coordinator ? "Submitted from" : "Start date"}</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter("from")} /></label>
        <label className="field"><span>{coordinator ? "Submitted through" : "End date"}</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter("to")} /></label>
      </div></FilterDisclosure>}
      {shown.length ? mine ? <div className="table-scroll"><table>
        <thead><tr><th>Course and slot</th><th>Submitted</th><th>Status</th><th>Details</th></tr></thead>
        <tbody>{shown.map((item) => <tr key={item._id}>
          <td><div className="portal-person-cell"><OfferingCourseIcon code={item.course?.code}/><div><strong>{item.course?.code} · {item.componentType}</strong><span className="secondary-text">{item.currentSlotLabel || item.course?.name}</span></div></div></td>
          <td>{date(item.createdAt)}<span className="secondary-text">{termLabel(item.term)}</span></td>
          <td><Status status={item.status} /></td>
          <td><button type="button" className="outline-button slot-request-view-button" id={`student-slot-request-${item._id}`} aria-label={`View ${item.componentType} change request for ${item.course?.code}`} onClick={() => {
            setSelectedRequestId(item._id);
            requestAnimationFrame(() => studentRequestHeading.current?.focus());
          }}>View details</button></td>
        </tr>)}</tbody>
      </table></div> : coordinator ? <div className="slot-register-days">
        {submissionDays.map(([day, items]) => {
          const label = day ? submittedHeading.format(new Date(items[0].createdAt)) : "Submission date unavailable";
          return <section key={day} className="slot-register-day"><h3>{day ? <time dateTime={day}>{label}</time> : label}</h3>
            {requestRegister(items, `Slot change requests · ${label}`)}
          </section>;
        })}
      </div> : requestRegister(shown, "Slot change requests") : <WorkspaceEmpty icon="calendar" action={requests.length > 0 && <button type="button" className="outline-button" onClick={() => setFilters(emptyFilters)}>Clear filters</button>} title={requests.length ? "No matching requests" : "No slot-change requests"} description={requests.length ? "Try another student or course, or clear your filters to see all requests." : mine ? "Requests you submit for a different lecture, tutorial or lab will appear here." : "Students’ slot-change requests will appear here with their current slot and preferences."} />}
    </section>}
    {selectedRequest && <div className="modal-backdrop slot-request-modal-backdrop" role="presentation" onClick={() => {
      const id = selectedRequestId;
      setSelectedRequestId(null);
      requestAnimationFrame(() => pageRef.current?.getRootNode().getElementById(`student-slot-request-${id}`)?.focus());
    }}>
      <section className="modal-card wide-modal slot-request-card" role="dialog" aria-modal="true" aria-labelledby="student-slot-request-title" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
        if (event.key === "Escape") {
          const id = selectedRequestId;
          setSelectedRequestId(null);
          requestAnimationFrame(() => pageRef.current?.getRootNode().getElementById(`student-slot-request-${id}`)?.focus());
        }
      }}>
        <div className="modal-heading">
          <div><p className="eyebrow">MY SLOT CHANGE REQUEST · {termLabel(selectedRequest.term)}</p><h2 id="student-slot-request-title" ref={studentRequestHeading} tabIndex={-1}>{selectedRequest.course?.code} · {selectedRequest.componentType}</h2></div>
          <div className="slot-request-dialog-status"><Status status={selectedRequest.status} /><button type="button" className="icon-button" aria-label="Close request details" onClick={() => {
            const id = selectedRequestId;
            setSelectedRequestId(null);
            requestAnimationFrame(() => pageRef.current?.getRootNode().getElementById(`student-slot-request-${id}`)?.focus());
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
    {currentRequest && <section className="slot-review" aria-labelledby="slot-review-title" aria-busy={busy}>
      <button type="button" className="outline-button slot-review-back" disabled={busy} onClick={() => {
        setDetail(null); setError(""); setMessage("");
        requestAnimationFrame(() => pageRef.current?.getRootNode().getElementById(`slot-request-${currentRequest._id}`)?.focus());
      }}><span aria-hidden="true">← </span>Back to requests</button>
      <div className="slot-review-heading request-detail-identity">
        <div className="portal-person-cell">
          <OfferingCourseIcon code={currentRequest.course?.code} />
          <div>
            <h2 id="slot-review-title" ref={heading} tabIndex={-1}>{currentRequest.course?.name || currentRequest.course?.code || "Slot change request"}</h2>
            <small>{currentRequest.course?.name && currentRequest.course?.code ? `${currentRequest.course.code} · ` : ""}{component(currentRequest.componentType)} change</small>
          </div>
        </div>
        <Status status={currentRequest.status} />
      </div>
      <div className="slot-review-record">
        <div className="portal-person-cell">
          <PortalAvatar name={currentRequest.student?.user?.fullName} />
          <div><strong>{currentRequest.student?.user?.fullName || "Unknown student"}</strong><small>{currentRequest.student?.studentId}</small></div>
        </div>
        <dl className="request-detail-facts">
          <div><dt>Advisor</dt><dd>{currentRequest.student?.assignedAdvisor?.fullName || "Unassigned"}</dd></div>
          <div><dt>Academic term</dt><dd>{termLabel(currentRequest.term)}</dd></div>
          <div><dt>Submitted</dt><dd><time dateTime={currentRequest.createdAt}>{coordinator && currentRequest.createdAt ? submittedAt.format(new Date(currentRequest.createdAt)) : date(currentRequest.createdAt)}</time></dd></div>
        </dl>
      </div>
      <div className="slot-review-notes">
        <section className="slot-current-meeting">
          <h3>Current assigned slot</h3>
          <p>{currentRequest.currentSlotLabel || (detail.current ? slotText(detail.current) : "Slot no longer listed")}</p>
        </section>
        <section className="portal-request-note">
          <h3>Student’s preferred group or day</h3>
          <p>{currentRequest.preferenceNote || "No preference provided."}</p>
        </section>
      </div>
      {currentRequest.status === "pending" ? <form className="form-stack slot-review-form" onSubmit={(event) => {
        event.preventDefault();
        action(`${path}/${currentRequest._id}/decision`, { decision: "approved", replacementSlotId, responseNote });
      }}>
        <fieldset className="slot-alternatives">
          <legend>Replacement slots</legend>
          {detail.issue && <p className="helper-text">{detail.issue}</p>}
          {!detail.issue && !detail.alternatives.length && <p className="helper-text">No alternative slots are published for this component.</p>}
          {detail.alternatives.map((slot) => {
            const noSeats = !slot.remainingSeats;
            const hasClash = Boolean(slot.clashes.length);
            return <label className="slot-alternative" key={slot.slotId} onDoubleClick={(event) => {
              event.preventDefault();
              if (busy || noSeats || hasClash) return;
              setReplacement((selected) => selected === slot.slotId ? "" : selected);
            }}>
              <input type="radio" name="replacement" value={slot.slotId} checked={replacementSlotId === slot.slotId} onChange={() => setReplacement(slot.slotId)} disabled={busy || noSeats || hasClash} />
              <span className="slot-alternative-meetings"><strong>{component(slot.type)} {slot.groupNumber}</strong>
                {slot.meetings.map((meeting) => <small key={meeting.slotId}>{meetingText(meeting)} · {meeting.remainingSeats} {meeting.remainingSeats === 1 ? "seat" : "seats"} left</small>)}
              </span>
              <span className={`slot-alternative-state ${hasClash || noSeats ? "is-unavailable" : ""}`}>
                {hasClash ? `Clashes with ${slot.clashes.join("; ")}` : noSeats ? "Group full" : "No timetable clash"}
              </span>
            </label>;
          })}
        </fieldset>
        {replacementSlotId && <button type="button" className="text-button slot-clear-selection" disabled={busy} onClick={() => setReplacement("")}>Clear selected slot</button>}
        <NoteField label="Response to student" value={responseNote} onChange={setResponse} className="slot-response-field" />
        <div className="form-actions slot-review-actions">
          <button type="button" className="outline-button" disabled={busy} onClick={() => action(`${path}/${currentRequest._id}/decision`, { decision: "rejected", responseNote })}>Reject request</button>
          <button type="submit" className="primary-button" disabled={busy || !replacementSlotId}>Approve change</button>
        </div>
      </form> : <div className="slot-review-notes">
        {currentRequest.replacementSlotLabel && <section className="slot-current-meeting"><h3>Approved replacement</h3><p>{currentRequest.replacementSlotLabel}</p></section>}
        <section className="portal-request-note">
          <h3>Response to student</h3>
          <p>{currentRequest.responseNote || "No response note."}</p>
          {currentRequest.decidedBy && <div className="portal-note-attribution"><strong>{currentRequest.decidedBy.fullName}</strong><small><time dateTime={currentRequest.decidedAt}>{date(currentRequest.decidedAt)}</time></small></div>}
        </section>
      </div>}
    </section>}
  </div>;
}
