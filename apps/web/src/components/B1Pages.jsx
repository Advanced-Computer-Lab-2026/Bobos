import PortalAvatar from "./PortalAvatar.jsx";
import { RecordPages, RegisterEmpty, StudentIdentity } from "./CoordinatorRecords.jsx";
import { useEffect, useState } from "react";
import FilterDisclosure from "./FilterDisclosure.jsx";
import { api } from "../api.js";
import { WorkspaceHeader, WorkspaceEmpty, displayLabel } from "./WorkspaceUI.jsx";

const dateValue = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const actionLabel = (value) => value === "processed" ? "Processed" : "Reopened";
const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
const requestDestinations = { extraHours: "extra-hours", slotChange: "slot-changes", mandatoryCourseRemoval: "mandatory-removals", graduationPlan: "graduation-plans", exitExam: "graduation-plans", financialReversal: "financial-records" };
const requestStatusLabel = (request) => {
  if (request.type !== "extraHours") return displayLabel(request.status);
  if (request.status === "pending") return "Awaiting coordinator decision";
  const settlement = request.status.split(":")[1];
  return request.status === "approved" || settlement === "none" || settlement === "awaitingChoice"
    ? "Payment choice needed" : displayLabel(settlement || request.status);
};

const queueArt = {
  extraHours: "extra-hours-inbox.svg", slotChange: "student-schedules-calendar.png",
  mandatoryCourseRemoval: "course-removal-slip.svg", graduationPlan: "graduation-cap.svg",
  exitExam: "submitted-plan.svg", financialReversal: "payment-ledger.svg", wholeScheduleSwap: "schedule-exchange.svg",
};

function InboxRequest({ item, name }) {
  const destination = requestDestinations[item.type];
  const title = item.type === "extraHours" && item.requestedHours
    ? `${item.requestedHours} extra credit ${item.requestedHours === 1 ? "hour" : "hours"}`
    : item.type === "slotChange" && item.componentType ? `Change ${item.componentType} group` : displayLabel(item.type);
  const course = item.courses?.map(({ code, name }) => [code, name].filter(Boolean).join(" · ")).join(", ");
  return <li>
    <div className="inbox-request-title">{destination ? <a href={`?page=${destination}&role=coordinator${item.type === "exitExam" ? "&queue=exams" : ""}`}
      aria-label={`${title} for ${name}. Open ${displayLabel(item.type)} queue`}>{title}<span aria-hidden="true"> ↗</span></a> : title}</div>
    {course && <small>{course}</small>}
    {!["pending", "submitted"].includes(item.status) && <small>{requestStatusLabel(item)}</small>}
  </li>;
}

export function PendingWorkPage({ token }) {
  const [data, setData] = useState(null);
  const [queue, setQueue] = useState("");
  const [workflow, setWorkflow] = useState(false);
  const [groupBy, setGroupBy] = useState("studentType");
  const [group, setGroup] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    setError("");
    api("/api/admin/pending-work", { token, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setRefreshing(false); });
    return () => controller.abort();
  }, [token, reloadKey]);
  if (!data && !error) return <div className="app-loading"><span className="loader" />Loading pending work…</div>;
  const allStudents = data?.students || [];
  const byType = Object.entries(data?.groups.requestType || {}).sort(([, a], [, b]) => b - a);
  const totalRequests = byType.reduce((sum, [, count]) => sum + count, 0);
  const groupCounts = data?.groups[groupBy] || {};
  const groups = groupBy === "studentType" ? ["advising", "normal"] : Object.keys(groupCounts);
  const groupName = (student) => groupBy === "studentType" ? student.studentType : student.assignedAdvisor?.fullName || "unassigned";
  const groupLabel = (value) => groupBy === "advisor" ? (value === "unassigned" ? "Unassigned" : value) : value === "advising" ? "Advising students" : "Normal students";
  const students = allStudents.filter(student => workflow ? !group || groupName(student) === group : student.requests.some(item => !queue || item.type === queue))
    .sort((a, b) => (workflow ? groupName(a).localeCompare(groupName(b)) : 0) || (a.fullName || "").localeCompare(b.fullName || ""));
  const size = 8;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(students.length / size)));
  const visible = students.slice((currentPage - 1) * size, currentPage * size);
  const selectQueue = (key) => { setQueue(key); setPage(1); };
  const selectGroup = (key) => { setGroup(key); setPage(1); };
  const showWorkflow = (enabled) => { setWorkflow(enabled); setPage(1); };
  const activeCount = workflow ? students.length : queue ? data?.groups.requestType[queue] : totalRequests;
  const queueButton = (key, title, count, art) => <button key={key} type="button" className="inbox-nav-row"
    aria-pressed={queue === key} onClick={() => selectQueue(key)}>
    <img alt="" src={`/portal-studio/images/${art}`} width="36" height="32" />
    <span>{title}</span><span className={`queue-count${count ? " has-requests" : ""}`}>{count}</span>
  </button>;
  return <div className="workspace-page pending-workspace">
    <WorkspaceHeader title="Pending work" action={<button className="outline-button" type="button" onClick={() => setReloadKey((key) => key + 1)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>} />
    {error && <div className="feedback error" role="alert">{error}</div>}
    {data && <>
      <div className="work-views" role="group" aria-label="Pending work views">
        <button type="button" aria-pressed={!workflow} onClick={() => showWorkflow(false)}>Request inbox <span>{totalRequests}</span></button>
        <button type="button" aria-pressed={workflow} onClick={() => showWorkflow(true)}>Student workflow <span>{allStudents.length}</span></button>
      </div>
      <div className={workflow ? "workflow-layout" : "inbox-layout"}>
        {!workflow && <nav className="inbox-navigation" aria-label="Work queues">
          <h2>Work queues</h2>
          {queueButton("", "All requests", totalRequests, "extra-hours-folder.svg")}
          {byType.map(([key, count]) => queueButton(key, displayLabel(key), count, queueArt[key]))}
        </nav>}
        <section className="request-inbox" aria-labelledby="inbox-title">
          <div className="inbox-heading"><h2 id="inbox-title">{workflow ? "Student workflow" : queue ? displayLabel(queue) : "Requests awaiting action"}</h2>
            <span>{activeCount} {workflow ? (activeCount === 1 ? "student" : "students") : (activeCount === 1 ? "request" : "requests")}</span></div>
          {workflow && <div className="workflow-options">
            <div className="workflow-grouping">
              <span id="grouping-label">Group by</span>
              <div className="group-switch" role="group" aria-labelledby="grouping-label">
                {[["studentType", "Student type"], ["advisor", "Advisor"]].map(([key, title]) => <button type="button" key={key} aria-pressed={groupBy === key}
                  onClick={() => { setGroupBy(key); selectGroup(""); }}>{title}</button>)}
              </div>
            </div>
            <div className="workflow-choices" role="group" aria-label={groupBy === "advisor" ? "Select advisor" : "Select student type"}>
              {["", ...groups].map(key => <button key={key} type="button" aria-pressed={group === key} onClick={() => selectGroup(key)}>
                {key === "" ? "All" : groupBy === "advisor" ? groupLabel(key) : key === "advising" ? "Advising" : "Normal"}
                <span>{key === "" ? allStudents.length : groupCounts[key] || 0}</span>
              </button>)}
            </div>
          </div>}
          {visible.length ? visible.map((student, index) => {
            const requests = student.requests.filter(item => workflow || !queue || item.type === queue);
            const approvalRequestShowsBlocker = student.blockingStep === "Resolve pending coordinator approval" &&
              requests.some(item => ["extraHours", "mandatoryCourseRemoval"].includes(item.type) && item.status === "pending");
            const scheduleBlocker = ["notStarted", "draft", "reopened"].includes(student.workflowStatus) && student.blockingStep && data.term;
            const scheduleUrl = scheduleBlocker && (student.studentType === "advising"
              ? `?page=student-schedules&role=coordinator&student=${encodeURIComponent(student.id)}&term=${encodeURIComponent(data.term.code)}`
              : "?page=group-assignments&role=coordinator");
            const startGroup = workflow && !group && (index === 0 || groupName(visible[index - 1]) !== groupName(student));
            return <div key={student.id} className="inbox-item">
              {startGroup && <h3 className="workflow-group-heading">{groupLabel(groupName(student))} <span>{data.groups[groupBy][groupName(student)]}</span></h3>}
              <article className="inbox-student">
                <div className="inbox-person"><StudentIdentity name={student.fullName} id={student.studentId} />
                  {workflow && <small className="workflow-assignment">{groupBy === "advisor" ? displayLabel(student.studentType) : student.assignedAdvisor?.fullName || (student.studentType === "normal" ? "No advisor required" : "Advisor unassigned")}</small>}
                  {!workflow && student.lastUpdatedAt && <time dateTime={student.lastUpdatedAt}>Updated {dateValue(student.lastUpdatedAt)}</time>}
                </div>
                <div className="inbox-tasks">
                  {workflow && <div className="workflow-state"><strong>{displayLabel(student.workflowStatus)}</strong>{!approvalRequestShowsBlocker && <p>{scheduleUrl
                    ? <a href={scheduleUrl} aria-label={`${student.blockingStep} for ${student.fullName || student.studentId}`}>{student.blockingStep} <span aria-hidden="true">↗</span></a>
                    : student.blockingStep || "No blocking step"}</p>}</div>}
                  {requests.length > 0 && <ul className="student-requests">{requests.map(item => <InboxRequest key={item.id} item={item} name={student.fullName || student.studentId} />)}</ul>}
                </div>
                {workflow && student.lastUpdatedAt && <time className="workflow-updated" dateTime={student.lastUpdatedAt}>Updated {dateValue(student.lastUpdatedAt)}</time>}
              </article></div>;
          }) : <RegisterEmpty art={workflow ? "extra-hours-folder.svg" : queue ? queueArt[queue] : "extra-hours-inbox.svg"}
            title={workflow ? (group ? "No students in this group" : "No student records yet") : queue ? "No requests in this queue" : "Your request inbox is clear"}
            description={workflow ? (group ? `No students belong to the ${groupLabel(group)} group.` : "Student workflows appear here when profiles are added.") : queue ? `There are no ${displayLabel(queue).toLowerCase()} requests to review.` : "New requests will appear here for review."}
            action={workflow && group ? <button type="button" className="outline-button" onClick={() => selectGroup("")}>View all students</button> : !workflow && (queue || allStudents.length > 0) ? <button type="button" className="outline-button" onClick={() => queue ? selectQueue("") : showWorkflow(true)}>{queue ? "View all requests" : "View student workflow"}</button> : undefined} />}
          <RecordPages page={currentPage} size={size} total={students.length} onChange={setPage} label={workflow ? "Student workflow" : "Request inbox"} />
        </section>
      </div>
    </>}
  </div>;
}

export function ScheduleActivityPage({ token, studentId }) {
  const [filters, setFilters] = useState({ action: "", from: "", to: "", search: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const path = studentId ? `/api/admin/students/${encodeURIComponent(studentId)}/schedule-activity` : "/api/admin/schedule-activity";
  const exportPath = studentId ? `/api/admin/students/${encodeURIComponent(studentId)}/schedule-activity/export` : "/api/admin/schedule-activity/export";
  const query = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), page: String(page) });
  const load = async (signal) => {
    setError("");
    try { setData(await api(`${path}?${query.toString()}`, { token, signal })); }
    catch (err) { if (!signal?.aborted) setError(err.message); }
  };
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [token, studentId, filters.action, filters.from, filters.to, filters.search, page]);
  const update = (key, value) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const exportCsv = async () => {
    setBusy(true);
    try {
      const exportQuery = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)));
      const result = await api(`${exportPath}?${exportQuery.toString()}`, { token, responseType: "blob" });
      const url = URL.createObjectURL(result.data);
      const link = document.createElement("a"); link.href = url; link.download = "schedule-activity.csv"; link.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const activityDays = data ? Object.values(data.activities.reduce((days, row) => {
    const occurredAt = new Date(row.occurredAt);
    const key = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(occurredAt);
    if (!days[key]) days[key] = { key, date: occurredAt, activities: [] };
    days[key].activities.push(row);
    return days;
  }, {})) : [];
  const filterChips = [
    filters.action && { key: "action", label: `Action: ${filters.action}`, onRemove: () => update("action", "") },
    filters.from && { key: "from", label: `From: ${filters.from}`, onRemove: () => update("from", "") },
    filters.to && { key: "to", label: `Through: ${filters.to}`, onRemove: () => update("to", "") },
  ].filter(Boolean);
  return <div className="workspace-page">
    <WorkspaceHeader title={studentId ? "Student schedule history" : "Schedule activity"} description={studentId ? "Processing and reopening events for this advising student." : "A record of schedule processing and reopening, including who made each change."} action={<div className="form-actions"><button className="outline-button" type="button" onClick={exportCsv} disabled={busy}>{busy ? "Exporting…" : "Export CSV"}</button></div>} />
    <section className="panel"><FilterDisclosure
      search={<label className="field filter-search"><span>Student ID or staff member</span><input type="search" name="activity-search" autoComplete="off" value={filters.search} maxLength={100} onChange={(event) => update("search", event.target.value)} placeholder="Student ID, staff name or GUC email…" /></label>}
      chips={filterChips}
      onClear={hasFilters ? () => { setPage(1); setFilters({ action: "", from: "", to: "", search: "" }); } : undefined}
    ><div className="filter-grid">
      <label className="field"><span>Action</span><select value={filters.action} onChange={(event) => update("action", event.target.value)}><option value="">All actions</option><option value="processed">Processed</option><option value="reopened">Reopened</option></select></label>
      <label className="field"><span>From date</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update("from", event.target.value)} /></label>
      <label className="field"><span>Through date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update("to", event.target.value)} /></label>
    </div><p className="filter-hint">Results update as you filter.</p></FilterDisclosure></section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="activity-log" aria-label="Schedule activity history">
    <div className="results-heading"><h2>Activity log</h2><span className="result-count" aria-live="polite">{data ? `${data.total} ${data.total === 1 ? "record" : "records"}` : "Loading…"}</span></div>
    {!data ? <p role="status">Loading schedule activity…</p> : !data.activities.length ? <WorkspaceEmpty icon="history" title={hasFilters ? "No matching activity" : "No schedule activity yet"} description={hasFilters ? "Try a different date range or clear your filters to see all activity." : "Processed and reopened schedules will appear here with the staff member, time and reason."} /> : <div className="activity-timeline" aria-label="Schedule activity entries">
      {activityDays.map((day) => <section className="activity-day" key={day.key}><h3>{day.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</h3><ol>
        {day.activities.map((row) => <li className="activity-entry" key={row.id}>
          <time dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>
          <PortalAvatar name={row.staffName} />
          <div className="activity-entry-main">
            <div className="activity-event-heading"><strong>Schedule {actionLabel(row.action).toLowerCase()}</strong><span>{row.studentName || "Advising student"}</span><span className="activity-student-id">{row.studentId}</span></div>
            <div className="activity-staff-line"><strong>{row.staffName}</strong><span>{row.staffEmail}</span><span className="activity-role">{displayLabel(row.staffRole)}</span></div>
            {row.reason && <p className="activity-reason"><strong>Reason:</strong> {row.reason}</p>}
          </div>
          <span className="activity-version">Version {row.scheduleVersion}</span>
        </li>)}
      </ol></section>)}
    </div>
    }
    {data && data.total > data.limit && <div className="form-actions panel-details"><span>{(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}</span><button className="outline-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="outline-button" type="button" disabled={page * data.limit >= data.total} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    </section>
  </div>;
}
