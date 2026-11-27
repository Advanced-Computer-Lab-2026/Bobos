import { OpsFrame, OpsTable, OpsSections, OpsFolder, OpsDesignControl, OpsGate, OpsModalFocus } from "./OperationsDesign.jsx";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { ChromeIcon } from "../components/PortalChrome.jsx";
import { WorkspaceHeader, WorkspaceEmpty, displayLabel } from "../components/WorkspaceUI.jsx";

const dateValue = (value) => value ? new Date(value).toLocaleString() : "—";
const actionLabel = (value) => value === "processed" ? "Processed" : "Reopened";

function PendingWorkContent({ token, role, onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [search,setSearch]=useState("");
  const [group,setGroup]=useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("/api/admin/pending-work", { token, signal: controller.signal }).then(setData).catch((err) => !controller.signal.aborted && setError(err.message));
    return () => controller.abort();
  }, [token]);
  if (error) return <section className="panel"><p role="alert">{error}</p></section>;
  if (!data) return <div className="app-loading"><span className="loader" />Loading pending work…</div>;
  const students = data.students.filter(s=>JSON.stringify(s).toLowerCase().includes(search.toLowerCase()) && (!group || s.studentType===group));
  return <div className="workspace-page">
    <WorkspaceHeader title="Pending work" description="See where students are in the advising process and which requests need attention." meta={<span className="workspace-meta">{data.term?.code || "No active term"}</span>} />
    <details className="ops05-native-summary"><summary>Student and request totals</summary><div className="pending-summary" aria-label="Student and request totals">
      {Object.entries(data.groups.studentType || {}).map(([name, count]) => <div className="pending-summary-card is-student" key={name}><strong>{count}</strong><span>{name === "advising" ? "Advising students" : "Normal students"}</span></div>)}
      {Object.entries(data.groups.requestType || {}).map(([name, count]) => <div className="pending-summary-card" key={name}><strong>{count}</strong><span>{displayLabel(name)}</span></div>)}
    </div>
    </details>
    <section className="panel"><div className="filter-grid"><label className="field"><span>Student, advisor or request</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} /></label><label className="field"><span>Student type</span><select value={group} onChange={e=>setGroup(e.target.value)}><option value="">All students</option><option value="advising">Advising</option><option value="normal">Normal</option></select></label><button type="button" className="text-button" onClick={()=>{setSearch("");setGroup("");}}>Clear filters</button></div><p className="ops05-requirement-note">This feed does not yet include graduation, exit-exam or financial-reversal queues. Those workflows remain in their own sections.</p></section>
    <section className="panel pending-students">
    <div className="results-heading"><h2>Student progress</h2><span className="result-count">{students.length} students</span></div>
    <div className="pending-advisors"><span>Advisor assignments</span>{Object.entries(data.groups.advisor || {}).map(([name, count]) => <p key={name}><strong>{name === "unassigned" ? "Unassigned" : name}</strong> <span>({count})</span></p>)}</div>
    {students.length ? <div className="table-wrap" role="region" aria-label="Student progress" tabIndex={0}><OpsTable className="workspace-table"><thead><tr><th>Student</th><th>Type</th><th>Advisor</th><th>Status</th><th>Next step</th><th>Pending requests</th><th>Last updated</th><th>Action</th></tr></thead>
      <tbody>{students.map((student) => <tr key={student.id}><td><strong>{student.fullName || student.studentId}</strong>{student.fullName && <small>{student.studentId}</small>}</td><td>{student.studentType === "advising" ? "Advising" : "Normal"}</td><td>{student.assignedAdvisor?.fullName || "Unassigned"}</td><td><span className={`status-pill ${student.workflowStatus === "processed" ? "good" : student.workflowStatus === "readyForStudentReview" ? "ready" : "muted"}`}>{displayLabel(student.workflowStatus)}</span></td><td>{student.blockingStep || "—"}</td><td>{student.requests.map((item) => `${displayLabel(item.type)}: ${displayLabel(item.status)}`).join(", ") || "None"}</td><td>{dateValue(student.lastUpdatedAt)}</td><td>{onOpen&&<button className="outline-button" type="button" onClick={()=>{const request=student.requests.find(r=>["pending","open","awaitingChoice"].includes(r.status));const target=({extraHours:"extra-hours",slotChange:"slot-changes",mandatoryCourseRemoval:"mandatory-removals",scheduleSwap:"student-schedules"})[request?.type]||(!student.assignedAdvisor&&student.studentType==="advising"?"advising":"student-schedules");onOpen(target,{draftStudent:{_id:student.id,studentId:student.studentId,user:{fullName:student.fullName}}});}}>Open workflow</button>}</td></tr>)}</tbody>
    </OpsTable></div>
    : <WorkspaceEmpty title={search||group?"No matching students":"No students to review"} description={search||group?"Clear or change the filters to see other students.":"Students will appear here once their profiles are available."} />}
    </section>
  </div>;
}

function ScheduleActivityContent({ token, studentId, role }) {
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
  return <div className="workspace-page">
    <WorkspaceHeader title="Schedule activity" description="A record of schedule processing and reopening, including who made each change." action={<button className="outline-button" type="button" onClick={exportCsv} disabled={busy}>{busy ? "Exporting…" : "Export CSV"}</button>} />
    <section className="panel"><div className="filter-grid">
      <label className="field"><span>Student or staff</span><input type="search" name="activity-search" autoComplete="off" value={filters.search} maxLength={100} onChange={(event) => update("search", event.target.value)} placeholder="Student ID, name or email…" /></label>
      <label className="field"><span>Action</span><select value={filters.action} onChange={(event) => update("action", event.target.value)}><option value="">All actions</option><option value="processed">Processed</option><option value="reopened">Reopened</option></select></label>
      <label className="field"><span>From date</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update("from", event.target.value)} /></label>
      <label className="field"><span>Through date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update("to", event.target.value)} /></label>
    </div><div className="filter-actions"><p className="filter-hint">Results update as you filter.</p><button type="button" className="text-button" disabled={!hasFilters} onClick={() => { setPage(1); setFilters({ action: "", from: "", to: "", search: "" }); }}>Clear filters</button></div></section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel"><div className="results-heading"><h2>Activity log</h2><span className="result-count" aria-live="polite">{data ? `${data.total} records` : "Loading…"}</span></div>
    {!data ? <p role="status">Loading schedule activity…</p> : !data.activities.length ? <WorkspaceEmpty icon="history" title={hasFilters ? "No matching activity" : "No schedule activity yet"} description={hasFilters ? "Try a different date range or clear your filters to see all activity." : "Processed and reopened schedules will appear here with the staff member, time and reason."} /> : <div className="table-wrap" role="region" aria-label="Schedule activity" tabIndex={0}><OpsTable><thead><tr><th>Student ID</th><th>Action</th><th>Version</th><th>Staff</th><th>Role</th><th>Date and time</th><th>Reason</th></tr></thead><tbody>
      {data.activities.map((row) => <tr key={row.id}><td>{row.studentId}</td><td><span className={`status-pill ${row.action === "processed" ? "good" : "warning"}`}>{actionLabel(row.action)}</span></td><td>{row.scheduleVersion}</td><td>{row.staffName}<small>{row.staffEmail}</small></td><td>{displayLabel(row.staffRole)}</td><td>{dateValue(row.occurredAt)}</td><td>{row.reason || "—"}</td></tr>)}
    </tbody></OpsTable></div>
    }
    {data && data.total > data.limit && <div className="form-actions panel-details"><span>{(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}</span><button className="outline-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="outline-button" type="button" disabled={page * data.limit >= data.total} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    </section>
  </div>;
}


export function PendingWorkPage(props){return <OpsGate pageKey="pending-work" role={props.role}><OpsFrame pageKey="pending-work" role={props.role}><PendingWorkContent {...props}/></OpsFrame></OpsGate>;}
export function ScheduleActivityPage(props){return <OpsGate pageKey="schedule-activity" role={props.role}><OpsFrame pageKey="schedule-activity" role={props.role}><ScheduleActivityContent {...props}/></OpsFrame></OpsGate>;}
