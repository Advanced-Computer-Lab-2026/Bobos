import { useEffect, useState } from "react";
import FilterDisclosure from "./FilterDisclosure.jsx";
import { api } from "../api.js";
import { ChromeIcon } from "./PortalChrome.jsx";
import { WorkspaceHeader, WorkspaceEmpty, displayLabel } from "./WorkspaceUI.jsx";

const dateValue = (value) => value ? new Date(value).toLocaleString() : "—";
const actionLabel = (value) => value === "processed" ? "Processed" : "Reopened";

export function PendingWorkPage({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("/api/admin/pending-work", { token, signal: controller.signal }).then(setData).catch((err) => !controller.signal.aborted && setError(err.message));
    return () => controller.abort();
  }, [token]);
  if (error) return <section className="panel"><p className="feedback error" role="alert">{error}</p></section>;
  if (!data) return <div className="app-loading"><span className="loader" />Loading pending work…</div>;
  return <div className="workspace-page">
    <WorkspaceHeader title="Pending work" description="See where students are in the advising process and which requests need attention." meta={<span className="workspace-meta">{data.term?.code || "No active term"}</span>} />
    <div className="pending-summary" aria-label="Student and request totals">
      {Object.entries(data.groups.studentType || {}).map(([name, count]) => <div className="pending-summary-card is-student" key={name}><strong>{count}</strong><span>{name === "advising" ? "Advising students" : "Normal students"}</span></div>)}
      {Object.entries(data.groups.requestType || {}).map(([name, count]) => <div className="pending-summary-card" key={name}><strong>{count}</strong><span>{displayLabel(name)}</span></div>)}
    </div>
    <section className="panel pending-students">
    <div className="results-heading"><h2>Student progress</h2><span className="result-count">{data.students.length} students</span></div>
    <div className="pending-advisors"><span>Advisor assignments</span>{Object.entries(data.groups.advisor || {}).map(([name, count]) => <p key={name}><strong>{name === "unassigned" ? "Unassigned" : name}</strong> <span>({count})</span></p>)}</div>
    {data.students.length ? <div className="table-wrap" role="region" aria-label="Student progress" tabIndex={0}><table className="workspace-table"><thead><tr><th>Student</th><th>Type</th><th>Advisor</th><th>Status</th><th>Next step</th><th>Pending requests</th><th>Last updated</th></tr></thead>
      <tbody>{data.students.map((student) => <tr key={student.id}><td><strong>{student.fullName || student.studentId}</strong>{student.fullName && <small>{student.studentId}</small>}</td><td>{student.studentType === "advising" ? "Advising" : "Normal"}</td><td>{student.assignedAdvisor?.fullName || "Unassigned"}</td><td><span className={`status-pill ${student.workflowStatus === "processed" ? "good" : student.workflowStatus === "readyForStudentReview" ? "ready" : "muted"}`}>{displayLabel(student.workflowStatus)}</span></td><td>{student.blockingStep || "—"}</td><td>{student.requests.map((item) => `${displayLabel(item.type)}: ${displayLabel(item.status)}`).join(", ") || "None"}</td><td>{dateValue(student.lastUpdatedAt)}</td></tr>)}</tbody>
    </table></div>
    : <WorkspaceEmpty title="No students to review" description="Students will appear here once their profiles are available." />}
    </section>
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
    filters.action && { key: "action", label: `Action: ${filters.action}`, onRemove: () => update("action", "") },
    filters.from && { key: "from", label: `From: ${filters.from}`, onRemove: () => update("from", "") },
    filters.to && { key: "to", label: `Through: ${filters.to}`, onRemove: () => update("to", "") },
  ].filter(Boolean);
  return <div className="workspace-page">
    <WorkspaceHeader title="Schedule activity" description="A record of schedule processing and reopening, including who made each change." action={<button className="outline-button" type="button" onClick={exportCsv} disabled={busy}>{busy ? "Exporting…" : "Export CSV"}</button>} />
    <section className="panel"><FilterDisclosure
      search={<label className="field filter-search"><span>Student or staff</span><input type="search" name="activity-search" autoComplete="off" value={filters.search} maxLength={100} onChange={(event) => update("search", event.target.value)} placeholder="Student ID, name or email…" /></label>}
      chips={filterChips}
      onClear={hasFilters ? () => { setPage(1); setFilters({ action: "", from: "", to: "", search: "" }); } : undefined}
    ><div className="filter-grid">
      <label className="field"><span>Action</span><select value={filters.action} onChange={(event) => update("action", event.target.value)}><option value="">All actions</option><option value="processed">Processed</option><option value="reopened">Reopened</option></select></label>
      <label className="field"><span>From date</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update("from", event.target.value)} /></label>
      <label className="field"><span>Through date</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update("to", event.target.value)} /></label>
    </div><p className="filter-hint">Results update as you filter.</p></FilterDisclosure></section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel"><div className="results-heading"><h2>Activity log</h2><span className="result-count" aria-live="polite">{data ? `${data.total} records` : "Loading…"}</span></div>
    {!data ? <p role="status">Loading schedule activity…</p> : !data.activities.length ? <WorkspaceEmpty icon="history" title={hasFilters ? "No matching activity" : "No schedule activity yet"} description={hasFilters ? "Try a different date range or clear your filters to see all activity." : "Processed and reopened schedules will appear here with the staff member, time and reason."} /> : <div className="table-wrap" role="region" aria-label="Schedule activity" tabIndex={0}><table><thead><tr><th>Student ID</th><th>Action</th><th>Version</th><th>Staff</th><th>Role</th><th>Date and time</th><th>Reason</th></tr></thead><tbody>
      {data.activities.map((row) => <tr key={row.id}><td>{row.studentId}</td><td><span className={`status-pill ${row.action === "processed" ? "good" : "warning"}`}>{actionLabel(row.action)}</span></td><td>{row.scheduleVersion}</td><td>{row.staffName}<small>{row.staffEmail}</small></td><td>{displayLabel(row.staffRole)}</td><td>{dateValue(row.occurredAt)}</td><td>{row.reason || "—"}</td></tr>)}
    </tbody></table></div>
    }
    {data && data.total > data.limit && <div className="form-actions panel-details"><span>{(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}</span><button className="outline-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="outline-button" type="button" disabled={page * data.limit >= data.total} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    </section>
  </div>;
}

export function CalendarSyncPage({ token }) {
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setConnection(await api("/api/calendar/connection", { token })); } catch (err) { setError(err.message); } };
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const data = await api("/api/calendar/connection", { token, signal: controller.signal });
        if (!controller.signal.aborted) { setConnection(data); setError(""); }
      } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [token]);
  const connect = async () => {
    setBusy(true); setError("");
    try { const { authorizationUrl } = await api("/api/calendar/connect", { token }); window.top.location.assign(authorizationUrl); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  const sync = async () => {
    setBusy(true); setError(""); setMessage("");
    try { const result = await api("/api/calendar/sync", { token, method: "POST", body: {} }); setMessage(`${result.synced} recurring class events synchronized.`); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true); setError("");
    try { await api("/api/calendar/connection", { token, method: "DELETE" }); await load(); setMessage("Google Calendar disconnected."); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="workspace-page">
    <WorkspaceHeader title="Calendar sync" description="Keep your university timetable alongside your other plans in Google Calendar." />
    {error && <div className="feedback error" role="alert">{error}</div>}{message && <div className="feedback success" role="status">{message}</div>}
    <div className="calendar-layout"><section className="panel">
      <span className="calendar-intro-icon"><ChromeIcon name="calendar" /></span>
      <div className="results-heading"><h2>Google Calendar</h2>{connection && <span className={`status-pill ${connection.connected ? "good" : "muted"}`}>{connection.connected ? "Connected" : "Not connected"}</span>}</div>
      <p className="calendar-copy">Add your processed schedule as recurring weekly events, including class times, course details and rooms.</p>
      {connection?.configured === false && <p className="feedback warning" role="status">Google Calendar setup is incomplete on this server. Configure a Google OAuth client and token encryption before connecting your account.</p>}
      {connection?.lastSyncError && <p className="feedback warning" role="status">{connection.lastSyncError}</p>}
      {!connection ? <p role="status">Loading calendar connection…</p> : connection.connected ? <><div className="detail-grid"><div className="detail-item"><span>Connected account</span><strong>{connection.providerAccountId}</strong></div><div className="detail-item"><span>Last synced</span><strong>{dateValue(connection.lastSyncedAt)}</strong></div></div><div className="form-actions panel-details"><button className="primary-button" type="button" disabled={busy} onClick={sync}>{busy ? "Syncing…" : "Sync schedule"}</button><button className="outline-button" type="button" disabled={busy} onClick={disconnect}>Disconnect</button></div></> : <button className="primary-button" type="button" disabled={busy} onClick={connect}>{busy ? "Connecting…" : "Connect Google Calendar"}</button>}
    </section><aside className="panel"><h2>How it works</h2><ol className="calendar-steps"><li><div><strong>Connect your account</strong>Choose the Google account where you want your classes to appear.</div></li><li><div><strong>Sync your processed schedule</strong>Classes repeat weekly during the term’s teaching dates.</div></li><li><div><strong>Keep it up to date</strong>Approved timetable changes sync automatically, even when this page is closed. You can disconnect at any time.</div></li></ol></aside></div>
    <p className="helper-text">Your schedule must be processed before it can be synced.</p>
  </div>;
}
