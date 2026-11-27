import { Modal } from "./AcademicWorkspace.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import PortalAvatar from "./PortalAvatar.jsx";
import { ChromeIcon } from "./PortalChrome.jsx";
import { RecordPages, RegisterEmpty, RegisterRow, StudentIdentity, StudentRegister } from "./CoordinatorRecords.jsx";
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

const groupLabels = { studentType: "Student type", requestType: "Request type", advisor: "Advisor" };
const allGroupLabels = { studentType: "All student types", requestType: "All request types", advisor: "All advisors" };
const workflowColumns = ["Student", "Schedule status", "Blocking step", "Requests"];
const requestCount = count => count === 1 ? "1 request" : `${count} requests`;

function requestTitle(item) {
  if (item.type === "extraHours" && item.requestedHours) return `${item.requestedHours} extra credit ${item.requestedHours === 1 ? "hour" : "hours"}`;
  if (item.type === "slotChange" && item.componentType) return `Change ${item.componentType} group`;
  return displayLabel(item.type);
}

function scheduleDestination(student, term) {
  if (!term || !student.blockingStep || !["notStarted", "draft", "reopened"].includes(student.workflowStatus)) return null;
  return student.studentType === "normal" ? "?page=group-assignments&role=coordinator"
    : `?page=student-schedules&role=coordinator&student=${encodeURIComponent(student.id)}&term=${encodeURIComponent(term.code)}`;
}

function StudentWorkDetail({ student, term, requestType, requestsOnly, onClose }) {
  const [page, setPage] = useState(1);
  const requests = student.requests.filter(item => !requestType || item.type === requestType);
  const scheduleUrl = scheduleDestination(student, term);
  const pageSize = 4;
  return <Modal title={requestsOnly ? `${student.fullName || student.studentId} · Requests` : student.fullName || student.studentId} onClose={onClose}>
    <div className="pending-file">
      <p className="pending-file-identity">{student.studentId} · {displayLabel(student.studentType)}</p>
      {!requestsOnly && <dl className="pending-facts">
        <div><dt>Schedule status</dt><dd>{displayLabel(student.workflowStatus)}</dd></div>
        <div><dt>Blocking step</dt><dd>{scheduleUrl ? <a className="outline-button workflow-action" href={scheduleUrl} aria-label={`${student.blockingStep} for ${student.fullName || student.studentId}`}>{student.blockingStep}</a> : student.blockingStep || "None"}</dd></div>
        <div><dt>Advisor</dt><dd>{student.assignedAdvisor?.fullName || (student.studentType === "normal" ? "No advisor required" : "Unassigned")}</dd></div>
        {student.lastUpdatedAt && <div><dt>Last workflow update</dt><dd><time dateTime={student.lastUpdatedAt}>{dateValue(student.lastUpdatedAt)}</time></dd></div>}
      </dl>}
      {(!requestsOnly || requests.length > 1) && <h3>{requestCount(requests.length)}</h3>}
      {requests.length > 0 && <ol className="pending-file-requests" start={(page - 1) * pageSize + 1}>{requests.slice((page - 1) * pageSize, page * pageSize).map(item => {
        const destination = requestDestinations[item.type];
        return <li key={item.id}>
          <div className="pending-file-request-head"><strong>{requestTitle(item)}</strong>
            {destination && <a className="outline-button workflow-action" href={`?page=${destination}&role=coordinator${item.type === "exitExam" ? "&queue=exams" : ""}`}>Review queue</a>}</div>
          {item.courses?.map(({code, name}) => <div className="pending-course" key={code || name}><OfferingCourseIcon code={code} /><span>{[code, name].filter(Boolean).join(" · ")}</span></div>)}
          <p>{requestStatusLabel(item)}{item.updatedAt && <> · <time dateTime={item.updatedAt}>Updated {dateValue(item.updatedAt)}</time></>}</p>
        </li>;
      })}</ol>}
      <RecordPages label="Student requests" page={page} size={pageSize} total={requests.length} onChange={setPage} />
    </div>
  </Modal>;
}

function WorkflowRow({ student, requestType, term, onOpen }) {
  const requests = student.requests.filter(item => !requestType || item.type === requestType);
  const scheduleUrl = scheduleDestination(student, term);
  const hours = requests.length === 1 && requests[0].type === "extraHours" && requests[0].requestedHours;
  const subject = hours ? `${hours} extra ${hours === 1 ? "hour" : "hours"}`
    : requests.length === 1 ? requestTitle(requests[0]) : requestCount(requests.length);
  return <tr className="workflow-record" role="row">
    <td role="cell"><button type="button" className="workflow-student" onClick={() => onOpen({ student })} aria-label={`View workflow for ${student.fullName || student.studentId}`}>
      <StudentIdentity name={student.fullName} id={student.studentId} />
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button></td>
    <td role="cell">{displayLabel(student.workflowStatus)}</td>
    <td role="cell">{scheduleUrl ? <a className="outline-button workflow-action" href={scheduleUrl} aria-label={`${student.blockingStep} for ${student.fullName || student.studentId}`}>{student.blockingStep}</a> : student.blockingStep || "None"}</td>
    <td role="cell">{requests.length ? <button type="button" className="workflow-request-link" aria-haspopup="dialog"
      onClick={() => onOpen({ student, requestType, requestsOnly:true })}
      aria-label={`View ${subject.toLowerCase()} for ${student.fullName || student.studentId}`}>
      <ChromeIcon name="document" />
      <span>{subject}</span>
    </button> : <span className="workflow-none">No requests</span>}</td>
  </tr>;
}

function groupWorkflows(students, groupBy, requestTypes) {
  const groups = new Map();
  const add = (key, label) => {
    if (!groups.has(key)) groups.set(key, { key, label, students: [] });
    return groups.get(key).students;
  };
  if (groupBy === "studentType") {
    add("advising", "Advising students");
    add("normal", "Normal students");
  }
  if (groupBy === "requestType") {
    for (const key of requestTypes) add(key, displayLabel(key));
    add("noRequests", "No requests");
  }
  for (const student of students) {
    if (groupBy === "studentType") add(student.studentType, displayLabel(student.studentType)).push(student);
    if (groupBy === "advisor") add(student.assignedAdvisor?.id || "unassigned", student.assignedAdvisor?.fullName || "No advisor assigned").push(student);
    if (groupBy === "requestType") {
      const keys = student.requests.length ? new Set(student.requests.map(item => item.type)) : ["noRequests"];
      for (const key of keys) add(key, displayLabel(key)).push(student);
    }
  }
  return [...groups.values()].sort((a, b) => Number(["unassigned", "noRequests"].includes(a.key)) - Number(["unassigned", "noRequests"].includes(b.key)) || a.label.localeCompare(b.label));
}

function AdvisorWorkflowGroup({ group, term, onOpen, size }) {
  const [page, setPage] = useState(1);
  const count = group.students.length;
  const currentPage = Math.min(page, Math.ceil(count / size));
  const preview = group.students.slice(0, 4);
  return <details className="workflow-advisor">
    <summary>
      <span className="workflow-advisor-name">{group.label}</span>
      <span className="workflow-advisor-avatars" aria-hidden="true">
        {preview.map(student => <PortalAvatar key={student.id} name={student.fullName} />)}
        {count > preview.length && <span className="workflow-advisor-overflow">+{count - preview.length}</span>}
      </span>
      <span className="workflow-advisor-count">{count} {count === 1 ? "student" : "students"}</span>
      <svg className="workflow-advisor-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </summary>
    <StudentRegister className="workflow-register" columns={workflowColumns} label={`Student scheduling workflow · ${group.label}`}>
      {group.students.slice((currentPage - 1) * size, currentPage * size).map(student => <WorkflowRow key={student.id} student={student} term={term} onOpen={onOpen} />)}
    </StudentRegister>
    <RecordPages page={currentPage} size={size} total={count} onChange={setPage} label={`${group.label} workflows`} />
  </details>;
}

export function PendingWorkPage({ token }) {
  const [data, setData] = useState(null);
  const [groupBy, setGroupBy] = useState("studentType");
  const [groupFilter, setGroupFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api("/api/admin/pending-work", { token, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [token, reloadKey]);
  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") setReloadKey(key => key + 1);
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => document.removeEventListener("visibilitychange", refreshOnReturn);
  }, []);
  if (!data && !error) return <div className="app-loading" role="status"><span className="loader" />Loading pending work…</div>;

  const query = search.trim().toLowerCase();
  const students = [...(data?.students || [])].sort((a,b) => Number(b.requests.length > 0) - Number(a.requests.length > 0) || a.fullName.localeCompare(b.fullName));
  const groups = groupWorkflows(students, groupBy, Object.keys(data?.groups.requestType || {}));
  const matchingGroups = groups.filter(group => !groupFilter || group.key === groupFilter).map(group => ({
    ...group,
    students: group.students.filter(student => !query || [student.fullName, student.studentId, student.assignedAdvisor?.fullName, student.assignedAdvisor?.email]
      .some(value => value?.toLowerCase().includes(query))),
  }));
  const rows = matchingGroups.flatMap(group => group.students.map(student => ({ group, student })));
  const size = 8;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
  const visible = rows.slice((currentPage - 1) * size, currentPage * size);
  const visibleGroups = Map.groupBy(visible, row => row.group);
  const hasFilters = Boolean(query || groupFilter);
  const emptyQueue = groupBy === "requestType" && groupFilter && groupFilter !== "noRequests" && !query;
  const clear = () => { setGroupFilter(""); setSearch(""); setPage(1); };

  return <div className="workspace-page pending-workspace">
    <WorkspaceHeader title="Pending work" />
    {error && <div className="feedback error pending-load-error"><span role="alert">{error}</span>
      <button className="outline-button" type="button" onClick={() => setReloadKey(key => key + 1)}>Try again</button>
    </div>}
    {data && <>
      <div className="workflow-options">
        <div className="workflow-grouping" role="group" aria-label="Group by"><span aria-hidden="true">Group by</span>
          <div>{Object.entries(groupLabels).map(([key, label]) => <button key={key} type="button" aria-pressed={groupBy === key} onClick={() => {
            if (key !== groupBy) { setGroupBy(key); setGroupFilter(""); setPage(1); }
          }}>{label}</button>)}</div>
        </div>
        <label className="field workflow-search"><span>Search students or advisors</span>
          <input type="search" placeholder="Name, ID or email" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        <label className="field workflow-filter"><span id="pending-group-filter-label">{groupLabels[groupBy]}</span><select aria-labelledby="pending-group-filter-label" value={groupFilter} onChange={event => { setGroupFilter(event.target.value); setPage(1); }}>
          <option value="">{allGroupLabels[groupBy]}</option>{groups.map(group => <option key={group.key} value={group.key}>{group.label}{groupBy === "requestType" && group.key !== "noRequests" ? ` (${data.groups.requestType[group.key] || 0})` : ""}</option>)}
        </select></label>
      </div>
      {visible.length ? groupBy === "advisor" ? <div className="workflow-advisors">
        {matchingGroups.filter(group => group.students.length).map(group => <AdvisorWorkflowGroup key={group.key} group={group} term={data.term} onOpen={setDetail} size={size} />)}
      </div> : <div className="workflow-groups">
        {[...visibleGroups].map(([group, members]) => <section className="workflow-group" key={group.key}>
          <div className="workflow-group-heading"><h2>{group.label}</h2><span>{group.students.length} {group.students.length === 1 ? "student" : "students"}</span></div>
          <StudentRegister className="workflow-register" columns={workflowColumns} label={`Student scheduling workflow · ${group.label}`}>
            {members.map(({student}) => <WorkflowRow key={student.id} student={student} term={data.term} requestType={groupBy === "requestType" ? group.key : ""} onOpen={setDetail} />)}
          </StudentRegister>
        </section>)}
      </div> : <RegisterEmpty art="extra-hours-folder.svg" title={emptyQueue ? `No ${displayLabel(groupFilter).toLowerCase()} requests` : hasFilters ? "No matching students" : "No student workflows yet"}
        description={hasFilters && !emptyQueue ? "Try another name, student ID or advisor." : undefined}
        action={hasFilters ? <button type="button" className="outline-button" onClick={clear}>Clear filters</button> : undefined} />}
      {groupBy !== "advisor" && <RecordPages page={currentPage} size={size} total={rows.length} onChange={setPage} label="Student workflow" />}
      {detail && <StudentWorkDetail {...detail} term={data.term} onClose={() => setDetail(null)} />}
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
  const filterChips = [
    filters.action && { key: "action", label: displayLabel(filters.action), onRemove: () => update("action", "") },
    filters.from && { key: "from", label: `From: ${filters.from}`, onRemove: () => update("from", "") },
    filters.to && { key: "to", label: `Through: ${filters.to}`, onRemove: () => update("to", "") },
  ].filter(Boolean);
  return <div className={studentId ? "workspace-page activity-page student-activity" : "workspace-page activity-page"}>
    {studentId ? <h3 className="activity-profile-heading">Student schedule history</h3> : <WorkspaceHeader title="Schedule activity" />}
    <div className="activity-controls"><FilterDisclosure floating={!studentId}
      search={<label className="field filter-search"><span>{studentId ? "Search staff" : "Search schedule activity"}</span><input type="search" name="activity-search" autoComplete="off" value={filters.search} maxLength={100} onChange={(event) => update("search", event.target.value)} placeholder={studentId ? "Name or GUC email" : "ID, staff or email"} /></label>}
      chips={filterChips}
      actions={<>
        <button className="text-button" type="button" disabled={!hasFilters} onClick={() => { setPage(1); setFilters({ action: "", from: "", to: "", search: "" }); }}>Clear</button>
        <button className="text-button" type="button" onClick={exportCsv} disabled={busy}>{busy ? "Exporting…" : "Export CSV"}</button>
        <p className="activity-count" role="status">{data ? `${data.total} ${data.total === 1 ? "event" : "events"}` : error ? "" : "Loading…"}</p>
      </>}
    ><div className="filter-grid">
      <label className="field"><span>Action</span><select value={filters.action} onChange={(event) => update("action", event.target.value)}><option value="">All actions</option><option value="processed">Processed</option><option value="reopened">Reopened</option></select></label>
      <label className="field"><span>From date</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update("from", event.target.value)} /></label>
      <label className="field"><span>Through date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update("to", event.target.value)} /></label>
    </div></FilterDisclosure></div>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="activity-log" aria-label="Schedule activity history">
    {data && (!data.activities.length ? <WorkspaceEmpty icon="history" title={hasFilters ? "No matching activity" : "No schedule activity yet"} description={hasFilters ? "Try a different date range or clear your filters to see all activity." : "Processed and reopened schedules will appear here with the staff member, time and reason."} /> :
      <StudentRegister className="activity-register" columns={["Student", "Action", "Staff member", "Date and time", "Reopening reason"]} label={studentId ? "Student schedule history" : "Schedule activity"}>
        {data.activities.map((row) => <RegisterRow className="activity-entry" key={row.id}>
          <StudentIdentity name={row.studentName || "Advising student"} id={row.studentId} />
          <span className={`status-pill ${row.action === "processed" ? "completed" : "draft"}`}>
            <span>Schedule {displayLabel(row.action).toLowerCase()}<small>Version {row.scheduleVersion}</small></span>
          </span>
          <span className="activity-staff"><span>{row.staffName} <small>· {displayLabel(row.staffRole)}</small></span><small>{row.staffEmail}</small></span>
          <time dateTime={row.occurredAt}>{dateValue(row.occurredAt)}</time>
          <span className="activity-reason">{row.reason || "—"}</span>
        </RegisterRow>)}
      </StudentRegister>)}
    {data && <RecordPages page={data.page} size={data.limit} total={data.total} onChange={setPage} label="Schedule activity" />}
    </section>
  </div>;
}
