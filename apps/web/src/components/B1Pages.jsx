import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import { RecordPages, RegisterEmpty, StudentIdentity } from "./CoordinatorRecords.jsx";
import { useEffect, useState } from "react";
import FilterDisclosure from "./FilterDisclosure.jsx";
import { api } from "../api.js";
import { WorkspaceHeader, WorkspaceEmpty, displayLabel } from "./WorkspaceUI.jsx";

const dateValue = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
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

function RequestSummary({ item }) {
  const title = item.type === "extraHours" && item.requestedHours
    ? `${item.requestedHours} extra credit ${item.requestedHours === 1 ? "hour" : "hours"}`
    : item.type === "slotChange" && item.componentType ? `Change ${item.componentType} group` : displayLabel(item.type);
  return <div className="pending-request-summary">
    <strong>{title}</strong>
    {item.courses?.map(({ code, name }, index) => <span className="pending-course" key={index}><OfferingCourseIcon code={code} />{[name, code].filter(Boolean).join(" · ")}</span>)}
    {!["pending", "submitted"].includes(item.status) && <small>{requestStatusLabel(item)}</small>}
  </div>;
}

function ReviewLink({ item, student }) {
  const destination = requestDestinations[item.type];
  return destination && <a className="outline-button inbox-action"
    href={`?page=${destination}&role=coordinator${item.type === "exitExam" ? "&queue=exams" : ""}`}
    aria-label={`Review ${displayLabel(item.type).toLowerCase()} queue for ${student.fullName || student.studentId}`}>Review queue</a>;
}

function WorkflowRow({ student, term, groupBy, requestType }) {
  const requests = student.requests.filter(item => !requestType || item.type === requestType);
  const scheduleBlocker = ["notStarted", "draft", "reopened"].includes(student.workflowStatus) && student.blockingStep && term;
  const advising = student.studentType === "advising";
  const assignment = groupBy === "advisor" ? displayLabel(student.studentType) : student.assignedAdvisor?.fullName || (advising ? "Advisor unassigned" : "No advisor required");
  return <div className="workflow-record">
    <div className="workflow-student-line">
      <StudentIdentity name={student.fullName} id={[student.studentId, assignment].filter(Boolean).join(" · ")} />
      <div className="workflow-state"><strong>{displayLabel(student.workflowStatus)}</strong><small>{student.blockingStep || "No blocking step"}</small></div>
      <div className="workflow-followup">
        {scheduleBlocker && <a className="outline-button inbox-action" href={advising
          ? `?page=student-schedules&role=coordinator&student=${encodeURIComponent(student.id)}&term=${encodeURIComponent(term.code)}`
          : "?page=group-assignments&role=coordinator"}>{advising ? "Open schedule" : "Open assignments"}</a>}
        {student.lastUpdatedAt && <time dateTime={student.lastUpdatedAt} title={dateValue(student.lastUpdatedAt)}>Updated {new Date(student.lastUpdatedAt).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</time>}
      </div>
    </div>
    {requests.length > 0 && <details className="workflow-requests"><summary>{requests.length} {requests.length === 1 ? "request" : "requests"}</summary>
      <ul>{requests.map(item => <li key={item.id}><RequestSummary item={item} /><ReviewLink item={item} student={student} /></li>)}</ul>
    </details>}
  </div>;
}

export function PendingWorkPage({ token }) {
  const [data, setData] = useState(null);
  const [queue, setQueue] = useState("");
  const [workflow, setWorkflow] = useState(false);
  const [groupBy, setGroupBy] = useState("studentType");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
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
  const students = data?.students || [];
  const byType = Object.entries(data?.groups.requestType || {}).sort(([, a], [, b]) => b - a);
  const totalRequests = byType.reduce((sum, [, count]) => sum + count, 0);
  const query = search.trim().toLowerCase();
  const matches = students.filter(s => !query || [s.fullName, s.studentId, s.assignedAdvisor?.fullName, s.assignedAdvisor?.email]
    .some(value => value?.toLowerCase().includes(query)));
  const filtered = matches.filter(s => !type || type === s.studentType);
  const groups = new Map();
  const rows = [];
  if (workflow) {
    for (const student of filtered) {
      let keys = [student.studentType];
      if (groupBy === "advisor") keys = [student.assignedAdvisor?.id || "unassigned"];
      if (groupBy === "requestType") keys = student.requests.length ? [...new Set(student.requests.map(item => item.type))] : ["noRequests"];
      for (const key of keys) {
        const label = groupBy === "advisor" ? student.assignedAdvisor?.fullName || "No advisor assigned" :
          groupBy === "studentType" ? (key === "advising" ? "Advising students" : "Normal students") :
          key === "noRequests" ? "No requests" : displayLabel(key);
        if (!groups.has(key)) groups.set(key, { key, label, students: [] });
        groups.get(key).students.push(student);
      }
    }
    for (const group of [...groups.values()].sort((a,b) => Number(["unassigned","noRequests"].includes(a.key)) - Number(["unassigned","noRequests"].includes(b.key)) || a.label.localeCompare(b.label))) {
      group.students.sort((a,b) => (a.fullName || "").localeCompare(b.fullName || ""));
      for (const student of group.students) rows.push({ student, group:group.key, heading:group.label });
    }
  } else {
    for (const student of students) {
      for (const item of student.requests) {
        if (queue && item.type !== queue) continue;
        const day = item.updatedAt && new Date(item.updatedAt).toLocaleDateString(undefined, { month:"long", day:"numeric", year:"numeric" });
        rows.push({ student, item, group:day, heading:day || "Update date unavailable" });
      }
    }
    rows.sort((a,b) => new Date(b.item.updatedAt || 0) - new Date(a.item.updatedAt || 0) || a.item.id.localeCompare(b.item.id));
  }
  const size = 8;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
  const visible = rows.slice((currentPage - 1) * size, currentPage * size);
  const selectQueue = (key) => { setQueue(key); setPage(1); };
  const showWorkflow = (enabled) => { setWorkflow(enabled); setPage(1); };
  const count = workflow ? filtered.length : rows.length;
  const queueButton = (key, title, count, art) => <button key={key} type="button" className="inbox-nav-row"
    aria-pressed={queue === key} onClick={() => selectQueue(key)}>
    <img alt="" src={`/portal-studio/images/${art}`} width="68" height="54" />
    <span>{title}</span><span className={`queue-count${count ? " has-requests" : ""}`}>{count}</span>
  </button>;
  return <div className="workspace-page pending-workspace">
    <WorkspaceHeader title="Pending work" action={<button className="outline-button" type="button" onClick={() => setReloadKey(key => key + 1)} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>} />
    {error && <div className="feedback error" role="alert">{error}</div>}
    {data && <>
      <div className="tabs work-views" role="group" aria-label="Pending work views">
        <button type="button" aria-pressed={!workflow} onClick={() => showWorkflow(false)}>Request inbox</button>
        <button type="button" aria-pressed={workflow} onClick={() => showWorkflow(true)}>Student workflow</button>
      </div>
      <div className={workflow ? "workflow-layout" : "inbox-layout"}>
        {!workflow && <nav className="inbox-navigation" aria-label="Work queues">
          <h2>Work queues</h2>
          <div className="inbox-queue-options">{queueButton("", "All requests", totalRequests, "extra-hours-folder.svg")}
          {byType.map(([key, count]) => queueButton(key, displayLabel(key), count, queueArt[key]))}</div>
        </nav>}
        <section className="request-inbox" aria-labelledby="inbox-title">
          <div className="inbox-heading"><h2 id="inbox-title">{workflow ? "Students" : queue ? displayLabel(queue) : "Latest requests"}</h2>
            <span role="status">{count} {workflow ? (count === 1 ? "student" : "students") : (count === 1 ? "request" : "requests")}</span></div>
          {workflow && <div className="workflow-options">
            <label className="field workflow-search"><span>Search students or advisors</span>
              <input type="search" placeholder="Name, student ID or advisor email" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
            <label className="field"><span>Group by</span><select value={groupBy} onChange={event => { setGroupBy(event.target.value); setPage(1); }}>
              <option value="studentType">Student type</option><option value="advisor">Advisor</option><option value="requestType">Request type</option>
            </select></label>
            <div className="workflow-types" role="group" aria-label="Student type">{[["","All"],["advising","Advising"],["normal","Normal"]].map(([key,label]) =>
              <button type="button" key={key} aria-pressed={type === key} onClick={() => { setType(key); setPage(1); }}>{label} <small>{key ? matches.filter(s => s.studentType === key).length : matches.length}</small></button>)}</div>
          </div>}
          <div className="inbox-register">{visible.length ? visible.map(({student,item,group,heading}, index) => <div key={workflow ? group + student.id : item.id}>
            {(index === 0 || group !== visible[index-1].group) && <h3 className="pending-group-heading">{heading}
              {workflow && <small>{groups.get(group).students.length} {groups.get(group).students.length === 1 ? "student" : "students"}</small>}</h3>}
            {workflow ? <WorkflowRow student={student} term={data.term} groupBy={groupBy} requestType={groupBy === "requestType" ? group : ""} />
              : <article className="pending-request-row" title={item.updatedAt ? `Updated ${dateValue(item.updatedAt)}` : undefined}><RequestSummary item={item} />
                <StudentIdentity name={student.fullName} id={student.studentId} /><ReviewLink item={item} student={student} /></article>}
          </div>) : <RegisterEmpty art={workflow ? "extra-hours-folder.svg" : queue ? queueArt[queue] : "extra-hours-inbox.svg"}
            title={workflow ? (query || type ? "No matching students" : "No student records yet") : queue ? "No requests in this queue" : "Your request inbox is clear"}
            description={workflow ? (query || type ? "Try another student or advisor, or clear the filters." : "Student workflows appear here when profiles are added.") : queue ? `There are no ${displayLabel(queue).toLowerCase()} requests to review.` : "New requests will appear here for review."}
            action={workflow && (query || type) ? <button type="button" className="outline-button" onClick={() => { setSearch(""); setType(""); setPage(1); }}>Clear filters</button> : !workflow && (queue || students.length > 0) ? <button type="button" className="outline-button" onClick={() => queue ? selectQueue("") : showWorkflow(true)}>{queue ? "View all requests" : "View student workflow"}</button> : undefined} />}</div>
          <RecordPages page={currentPage} size={size} total={rows.length} onChange={setPage} label={workflow ? "Student workflow" : "Request inbox"} />
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
    filters.action && { key: "action", label: displayLabel(filters.action), onRemove: () => update("action", "") },
    filters.from && { key: "from", label: `From: ${filters.from}`, onRemove: () => update("from", "") },
    filters.to && { key: "to", label: `Through: ${filters.to}`, onRemove: () => update("to", "") },
  ].filter(Boolean);
  const Title = studentId ? "h3" : "h1";
  const DayHeading = studentId ? "h4" : "h2";
  const EventHeading = studentId ? "h5" : "h3";
  return <div className={studentId ? "workspace-page activity-page student-activity" : "workspace-page activity-page"}>
    <header className={studentId ? "activity-profile-heading" : "workspace-header"}>
      <div><Title>{studentId ? "Student schedule history" : "Schedule activity"}</Title></div>
      <button className="outline-button" type="button" onClick={exportCsv} disabled={busy}>{busy ? "Exporting…" : "Export CSV"}</button>
    </header>
    <div className="activity-controls"><FilterDisclosure
      search={<label className="field filter-search"><span>{studentId ? "Search staff" : "Search schedule activity"}</span><input type="search" name="activity-search" autoComplete="off" value={filters.search} maxLength={100} onChange={(event) => update("search", event.target.value)} placeholder={studentId ? "Name or GUC email" : "ID, staff or email"} /></label>}
      chips={filterChips}
      onClear={hasFilters ? () => { setPage(1); setFilters({ action: "", from: "", to: "", search: "" }); } : undefined}
      actions={<p className="activity-count" role="status">{data ? `${data.total} ${data.total === 1 ? "event" : "events"}` : error ? "" : "Loading…"}</p>}
    ><div className="filter-grid">
      <label className="field"><span>Action</span><select value={filters.action} onChange={(event) => update("action", event.target.value)}><option value="">All actions</option><option value="processed">Processed</option><option value="reopened">Reopened</option></select></label>
      <label className="field"><span>From date</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update("from", event.target.value)} /></label>
      <label className="field"><span>Through date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update("to", event.target.value)} /></label>
    </div></FilterDisclosure></div>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="activity-log" aria-label="Schedule activity history">
    {data && (!data.activities.length ? <WorkspaceEmpty icon="history" title={hasFilters ? "No matching activity" : "No schedule activity yet"} description={hasFilters ? "Try a different date range or clear your filters to see all activity." : "Processed and reopened schedules will appear here with the staff member, time and reason."} /> : <div className="activity-timeline">
      {activityDays.map((day) => <section className="activity-day" key={day.key}><DayHeading className="activity-date">{day.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</DayHeading><ol role="list">
        {day.activities.map((row) => <li className="activity-entry" key={row.id}>
          <div className="activity-entry-heading">
            <div><EventHeading>Schedule {displayLabel(row.action).toLowerCase()}</EventHeading><span>Version {row.scheduleVersion}</span></div>
            <time dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>
          </div>
          <div className="activity-people">
            {!studentId && <StudentIdentity name={row.studentName || "Advising student"} id={row.studentId} />}
            <p className="activity-byline">By <strong>{row.staffName}</strong><small>{[displayLabel(row.staffRole), row.staffEmail].filter(Boolean).join(" · ")}</small></p>
          </div>
          {row.reason && <p className="activity-reason"><strong>Reason</strong> {row.reason}</p>}
        </li>)}
      </ol></section>)}
    </div>)}
    {data && <RecordPages page={data.page} size={data.limit} total={data.total} onChange={setPage} label="Schedule activity" />}
    </section>
  </div>;
}
