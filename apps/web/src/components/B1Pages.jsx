import { useEffect, useState } from "react";
import { api } from "../api.js";

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
  if (error) return <section className="panel"><p role="alert">{error}</p></section>;
  if (!data) return <div className="app-loading"><span className="loader" />Loading pending work…</div>;
  return <section className="panel">
    <div className="panel-heading"><div><h2>Pending work</h2><p>Workflow status is calculated from each student’s current schedule and requests.</p></div><span>{data.term?.code || "No active term"}</span></div>
    <div className="stats-grid" style={{ margin: "1rem 0" }}>
      {Object.entries(data.groups.studentType || {}).map(([name, count]) => <div className="stat-card" key={name}><strong>{count}</strong><span>{name} students</span></div>)}
      {Object.entries(data.groups.requestType || {}).map(([name, count]) => <div className="stat-card" key={name}><strong>{count}</strong><span>{name} requests</span></div>)}
    </div>
    <p className="page-description">Grouped by advisor: {Object.entries(data.groups.advisor || {}).map(([name, count]) => `${name} (${count})`).join(" · ") || "No advisor assignments"}</p>
    <div className="table-wrap"><table><thead><tr><th>Student</th><th>Type</th><th>Advisor</th><th>Workflow status</th><th>Blocking step</th><th>Requests awaiting action</th><th>Last updated</th></tr></thead>
      <tbody>{data.students.map((student) => <tr key={student.id}><td><strong>{student.fullName}</strong><small>{student.studentId}</small></td><td>{student.studentType}</td><td>{student.assignedAdvisor?.fullName || "—"}</td><td>{student.workflowStatus || "—"}</td><td>{student.blockingStep || "—"}</td><td>{student.requests.map((item) => `${item.type}: ${item.status}`).join(", ") || "—"}</td><td>{dateValue(student.lastUpdatedAt)}</td></tr>)}</tbody>
    </table></div>
  </section>;
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
  return <section className="panel">
    <div className="panel-heading"><div><h2>Schedule activity history</h2><p>Processing and reopening actions for advising schedules.</p></div><button className="primary-button" type="button" onClick={exportCsv} disabled={busy}>Export CSV</button></div>
    <div className="filters-row" style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", margin: "1rem 0" }}>
      <label>Action<select value={filters.action} onChange={(event) => update("action", event.target.value)}><option value="">All actions</option><option value="processed">Processed</option><option value="reopened">Reopened</option></select></label>
      <label>From<input type="date" value={filters.from} onChange={(event) => update("from", event.target.value)} /></label>
      <label>To<input type="date" value={filters.to} onChange={(event) => update("to", event.target.value)} /></label>
      <label>Search student/staff<input value={filters.search} maxLength={100} onChange={(event) => update("search", event.target.value)} placeholder="Student ID, staff name or email" /></label>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr><th>Student ID</th><th>Action</th><th>Schedule version</th><th>Staff</th><th>Role</th><th>Date and time</th><th>Reason</th></tr></thead><tbody>
      {(data?.activities || []).map((row) => <tr key={row.id}><td>{row.studentId}</td><td>{actionLabel(row.action)}</td><td>{row.scheduleVersion}</td><td>{row.staffName}<small>{row.staffEmail}</small></td><td>{row.staffRole}</td><td>{dateValue(row.occurredAt)}</td><td>{row.reason || "—"}</td></tr>)}
      {data && !data.activities.length && <tr><td colSpan="7">No schedule activity matches these filters.</td></tr>}
    </tbody></table></div>
    {data && data.total > data.limit && <div className="form-actions"><span>{(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}</span><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button type="button" disabled={page * data.limit >= data.total} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
  </section>;
}

export function CalendarSyncPage({ token }) {
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { try { setConnection(await api("/api/calendar/connection", { token })); } catch (err) { setError(err.message); } };
  useEffect(() => { load(); }, [token]);
  const connect = async () => {
    setBusy(true); setError("");
    try { const { authorizationUrl } = await api("/api/calendar/connect", { token }); window.location.assign(authorizationUrl); }
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
  return <section className="panel"><div className="panel-heading"><div><h2>Calendar sync</h2><p>Connect a Google Calendar account to add your processed schedule as weekly events during the teaching period.</p></div></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!connection ? <p>Loading calendar connection…</p> : connection.connected ? <><p>Connected account: <strong>{connection.providerAccountId}</strong></p><p>Last synced: {dateValue(connection.lastSyncedAt)}</p><div className="button-row"><button className="primary-button" type="button" disabled={busy} onClick={sync}>{busy ? "Working…" : "Sync now"}</button><button type="button" disabled={busy} onClick={disconnect}>Disconnect</button></div></> : <button className="primary-button" type="button" disabled={busy} onClick={connect}>{busy ? "Connecting…" : "Connect Google Calendar"}</button>}
  </section>;
}
