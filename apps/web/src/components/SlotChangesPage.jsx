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
const submittedAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: slotSubmissionTimeZone });
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

function SlotMeetingSummary({ slot, showSeats = false }) {
  return <span className="slot-meeting-schedule">
    <span className="slot-meeting-group">Group {slot.groupNumber}</span>
    {slot.meetings.map((meeting) => <span className="slot-meeting-time" key={meeting.slotId}>
      <span className="slot-meeting-when"><strong>{meeting.day}</strong><span>{meeting.startTime}–{meeting.endTime}</span></span>
      <small>{meeting.room}{showSeats && ` · ${meeting.remainingSeats} ${meeting.remainingSeats === 1 ? "seat" : "seats"} left`}</small>
    </span>)}
  </span>;
}

function SlotComparison({ request, current, children }) {
  const pending = request.status === "pending";
  const replacementTitle = pending ? "Replacement groups" : request.replacementSlotLabel ? "Approved replacement" : "Replacement";
  const showLiveCurrent = current && (pending || !request.currentSlotLabel);
  return <section className="slot-comparison-sheet" aria-label="Compare meetings">
    <section className="slot-comparison-original" aria-labelledby="slot-current-meeting-title">
      <h2 id="slot-current-meeting-title">{pending ? "Current assignment" : "Original assignment"}</h2>
      <div className="slot-slot-card">{showLiveCurrent ? <SlotMeetingSummary slot={current} /> : <p className="slot-recorded-meeting">{request.currentSlotLabel || "Original slot no longer listed."}</p>}</div>
    </section>
    <section className="slot-comparison-replacement" aria-labelledby="slot-proposed-meeting-title">
      <h2 id="slot-proposed-meeting-title">{replacementTitle}</h2>
      {pending ? <div className="slot-replacement-picker">{children}</div> : <div className="slot-slot-card"><p className="slot-recorded-meeting">{request.replacementSlotLabel || "No replacement assigned."}</p></div>}
    </section>
  </section>;
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
  const decisionHeading = useRef(null);
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
        requestAnimationFrame(() => decisionHeading.current?.focus());
      }
    } catch (err) {
      setError(err.message);
      if (err.status === 409 && detail) {
        try {
          setDetail(await api(`${path}/${detail.request._id}`, { token })); setReplacement("");
          requestAnimationFrame(() => decisionHeading.current?.focus());
        }
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
  const replacement = detail?.alternatives.find((slot) => slot.slotId === replacementSlotId);
  const canChooseReplacement = detail?.alternatives.some((slot) => slot.remainingSeats > 0 && !slot.clashes.length);
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
        <strong>Student preference</strong>
        <small className="slot-preference-excerpt">{item.preferenceNote || "No preference provided."}</small>
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
    {!currentRequest && <div className="workspace-header"><div><h1>Slot change requests</h1>
      {!mine && <p>Review advising students’ requests and compare replacement slots.</p>}</div>
      {mine && <button type="button" className="outline-button" onClick={onOpenSchedule}>My schedule</button>}
    </div>}
    {!currentRequest && error && <div className="feedback error" role="alert">{error}</div>}
    {!currentRequest && message && <div className="feedback success" role="status">{message}</div>}
    {!data && !error && <p role="status">Loading requests…</p>}
    {mine && data && <section className="slot-student-request" aria-labelledby="student-slot-form-title">
      <header className="slot-student-form-heading">
        <div>
          <h2 id="student-slot-form-title">Request a slot change</h2>
          {data.term?.code && <p>Term {data.term.code}</p>}
        </div>
        {data.term?.advisingDeadline && <div className="slot-student-deadline">
          <span>Advising deadline</span>
          <time dateTime={data.term.advisingDeadline}>{submittedAt.format(new Date(data.term.advisingDeadline))} · Cairo</time>
        </div>}
      </header>
      {data.issue ? <p className="slot-student-form-state">{data.issue}</p> : eligibleSlots.length ? <form className="form-stack" onSubmit={(event) => {
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
        </form> : <p className="slot-student-form-state">There are no other assigned slots you can request a change for.</p>}
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
        <label className="field"><span>{coordinator ? "Submitted from" : "Start date"}</span><input type="date" data-calendar-range="slot-changes" data-calendar-edge="start" value={filters.from} max={filters.to || undefined} onChange={setFilter("from")} /></label>
        <label className="field"><span>{coordinator ? "Submitted through" : "End date"}</span><input type="date" data-calendar-range="slot-changes" data-calendar-edge="end" value={filters.to} min={filters.from || undefined} onChange={setFilter("to")} /></label>
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
      }}><span aria-hidden="true">←</span> Back to requests</button>
      <header className="slot-case-heading">
        <OfferingCourseIcon code={currentRequest.course?.code} />
        <div>
          <h1 id="slot-review-title" ref={heading} tabIndex={-1}>{currentRequest.course?.name || currentRequest.course?.code || "Slot change request"}</h1>
          <small>{[currentRequest.course?.code, currentRequest.componentType && `${component(currentRequest.componentType)} change`, termLabel(currentRequest.term)].filter(Boolean).join(" · ")}</small>
        </div>
        <Status status={currentRequest.status} />
      </header>
      <div className="slot-case-workspace">
        <section className="slot-case-preference" aria-labelledby="slot-preference-title">
          <div className="slot-request-student">
            <StudentIdentity name={currentRequest.student?.user?.fullName} id={currentRequest.student?.studentId} />
            <dl className="slot-request-facts">
              <div><dt>Advisor</dt><dd>{currentRequest.student?.assignedAdvisor?.fullName || "Unassigned"}</dd></div>
              <div><dt>Submitted</dt><dd><time dateTime={currentRequest.createdAt}>{currentRequest.createdAt ? submittedAt.format(new Date(currentRequest.createdAt)) : "—"}</time></dd></div>
            </dl>
          </div>
          <div className="slot-preference-note">
            <h2 id="slot-preference-title">Student’s preference</h2>
            {currentRequest.preferenceNote ? <blockquote><q>{currentRequest.preferenceNote}</q></blockquote> : <p>No preference provided.</p>}
          </div>
        </section>
        {currentRequest.status === "pending" ? <form className="slot-review-form" onSubmit={(event) => {
          event.preventDefault();
          if (replacement && !busy) action(`${path}/${currentRequest._id}/decision`, { decision: "approved", replacementSlotId, responseNote });
        }}>
          <SlotComparison request={currentRequest} current={detail.current}>
            <fieldset className="slot-alternatives" aria-labelledby="slot-proposed-meeting-title">
              {detail.issue && <p className="slot-recorded-meeting">{detail.issue}</p>}
              {!detail.issue && !detail.alternatives.length && <p className="slot-recorded-meeting">No alternative slots are published for this component.</p>}
              {detail.alternatives.map((slot) => {
                const noSeats = !slot.remainingSeats;
                const hasClash = Boolean(slot.clashes.length);
                return <label className="slot-slot-card slot-alternative" key={slot.slotId}>
                  <input type="radio" name="replacement" value={slot.slotId} checked={replacementSlotId === slot.slotId} onChange={() => setReplacement(slot.slotId)} disabled={busy || noSeats || hasClash} />
                  <SlotMeetingSummary slot={slot} showSeats />
                  <span className={`slot-alternative-state ${hasClash || noSeats ? "is-unavailable" : ""}`}>
                    {hasClash ? `Clashes with ${slot.clashes.join("; ")}` : noSeats ? "Group full" : "No timetable clash"}
                  </span>
                </label>;
              })}
            </fieldset>
            {detail.alternatives.length > 0 && <div className="slot-selection-summary">
              {!canChooseReplacement && <p>No eligible replacement available.</p>}
              {replacement && <button type="button" className="text-button slot-clear-selection" disabled={busy} onClick={() => {
                pageRef.current?.querySelector(".slot-alternatives input:checked")?.focus();
                setReplacement("");
              }}>Clear selected slot</button>}
            </div>}
          </SlotComparison>
          <section className="slot-case-decision" aria-label="Decision">
            <div className="slot-decision-content">
              <NoteField label="Response to student" value={responseNote} onChange={setResponse} className="slot-response-field" />
              {error && <div className="feedback error" role="alert">{error}</div>}
              {message && <div className="feedback success" role="status">{message}</div>}
              <div className="slot-decision-footer">
                <p aria-live="polite">{replacement ? <strong>{detail.current ? `Group ${detail.current.groupNumber} → Group ${replacement.groupNumber}` : `Move to Group ${replacement.groupNumber}`}</strong> : "Choose a replacement group to approve."}</p>
                <div className="form-actions slot-review-actions">
                  <button type="button" className="outline-button" disabled={busy} onClick={() => action(`${path}/${currentRequest._id}/decision`, { decision: "rejected", responseNote })}>Reject request</button>
                  <button type="submit" className="primary-button" disabled={busy || !replacement}>Approve change</button>
                </div>
              </div>
            </div>
          </section>
        </form> : <div className="slot-review-form">
          <SlotComparison request={currentRequest} current={detail.current} />
          <section className="slot-case-decision" aria-labelledby="slot-decision-title">
            <h2 id="slot-decision-title" ref={decisionHeading} tabIndex={-1}>Response to student</h2>
            <div className="slot-decision-content slot-decision-record">
              {message && <div className="feedback success" role="status">{message}</div>}
              {error && <div className="feedback error" role="alert">{error}</div>}
              <p>{currentRequest.responseNote || "No response note."}</p>
              {currentRequest.decidedBy && <div className="portal-note-attribution"><strong>{currentRequest.decidedBy.fullName}</strong><small><time dateTime={currentRequest.decidedAt}>{date(currentRequest.decidedAt)}</time></small></div>}
            </div>
          </section>
        </div>}
      </div>
    </section>}
  </div>;
}
