import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api.js";
import { RouteFrame, Status, Facts, Conversation, Feedback, Confirm, useFilters, pretty, date, groupBy } from "./shared.jsx";

const defaults = { search: "", accountStatus: "", studentType: "", advisor: "" };
export default function AccountAdvisorRoute({ Original, token, role }) {
  return <RouteFrame routeKey="account-administration" allowed={["coordinator", "administrator"].includes(role)} Original={Original}>
    {(design) => <AccountAdvisorAdmin token={token} role={role} design={design} />}
  </RouteFrame>;
}

export function AccountAdvisorAdmin({ token, role, design }) {
  const admin = role === "administrator", coordinator = role === "coordinator";
  const [filters, setFilters] = useFilters(`portal-ad4-api-filters:accounts:${role}`, defaults);
  const [applied, setApplied] = useState(filters), [directory, setDirectory] = useState(null), [roster, setRoster] = useState([]);
  const [selectedId, setSelectedId] = useState(null), [record, setRecord] = useState(null), [advisorId, setAdvisorId] = useState("");
  const [loading, setLoading] = useState(true), [opening, setOpening] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState(""), [confirmError, setConfirmError] = useState("");
  const [email, setEmail] = useState(""), [advisor, setAdvisor] = useState(null), [lookupBusy, setLookupBusy] = useState(false), [lookupError, setLookupError] = useState("");
  const [confirm, setConfirm] = useState(null), [compared, setCompared] = useState([]), [stage, setStage] = useState(0);
  const active = useRef(true), sequence = useRef(0), heading = useRef(null), lookupSequence = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; sequence.current++; lookupSequence.current++; }; }, []);
  const load = useCallback(async (signal) => {
    setLoading(true); setError("");
    const params = new URLSearchParams(Object.entries(applied).filter(([, v]) => v));
    try {
      const [data, advisors] = await Promise.all([api(`/api/admin/students?${params}`, { token, signal }), coordinator ? api("/api/advisor/advisors", { token, signal }) : Promise.resolve([])]);
      if (active.current && !signal?.aborted) { setDirectory(data); setRoster(advisors.advisors || advisors || []); }
    } catch (err) { if (active.current && err.name !== "AbortError") setError(err.message); }
    finally { if (active.current && !signal?.aborted) setLoading(false); }
  }, [applied, token, coordinator]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  async function open(student) {
    const seq = ++sequence.current; setSelectedId(student.id); setRecord(null); setOpening(true); setError(""); setMessage(""); setStage(1);
    try {
      const result = await api(`/api/admin/students/${encodeURIComponent(student.id)}`, { token });
      if (active.current && seq === sequence.current) { setRecord(result); setAdvisorId(result.assignedAdvisor?._id || ""); requestAnimationFrame(() => heading.current?.focus({ preventScroll: false })); }
    } catch (err) { if (active.current && seq === sequence.current) setError(err.message); }
    finally { if (active.current && seq === sequence.current) setOpening(false); }
  }
  function closeRecord() {
    const id = selectedId; sequence.current++; setRecord(null); setSelectedId(null); setOpening(false); setStage(0);
    requestAnimationFrame(() => document.getElementById(`ad4r-account-${id}`)?.focus());
  }
  async function lookup(event) {
    event?.preventDefault(); if (!coordinator) return;
    const seq = ++lookupSequence.current; setLookupBusy(true); setLookupError(""); setAdvisor(null);
    try { const result = await api(`/api/admin/advisors/lookup?email=${encodeURIComponent(email.trim().toLowerCase())}`, { token }); if (active.current && seq === lookupSequence.current) setAdvisor(result); }
    catch (err) { if (active.current && seq === lookupSequence.current) setLookupError(err.message); }
    finally { if (active.current && seq === lookupSequence.current) setLookupBusy(false); }
  }
  const ask = (kind) => { setConfirmError(""); setConfirm(kind); };
  async function commit() {
    setBusy(true); setConfirmError(""); let committed = false;
    try {
      if (confirm === "account") {
        if (!admin || !record?.user?._id) throw new Error("Only an Administrator can change account access.");
        const result = await api(`/api/admin/users/${encodeURIComponent(record.user._id)}/status`, { token, method: "PATCH", body: { isActive: !record.user.isActive } }); committed = true;
        if (!active.current) return;
        setRecord((old) => ({ ...old, user: { ...old.user, isActive: result.isActive } }));
        setMessage(`Account ${result.isActive ? "activated" : "deactivated"}. Academic records and schedule history were not deleted.`);
      } else if (confirm === "membership") {
        if (!coordinator || !advisor?.email) throw new Error("Only a Coordinator can manage advisor membership.");
        const add = !advisor.isAdvisorInSystem;
        const result = await api(add ? "/api/admin/advisors" : `/api/admin/advisors/${encodeURIComponent(advisor.email)}`, { token, method: add ? "POST" : "DELETE", ...(add ? { body: { email: advisor.email } } : {}) }); committed = true;
        if (!active.current) return;
        setAdvisor((old) => ({ ...old, isAdvisorInSystem: add }));
        setMessage(`${add ? "Advisor added" : "Advisor removed"}. Email status: ${result.emailStatus || "not reported"}.`);
        // Membership removal clears current assignments server-side, not historical actions.
        if (!add && record?.assignedAdvisor?.email === advisor.email) setRecord((old) => ({ ...old, assignedAdvisor: null }));
      } else if (confirm === "assignment") {
        if (!coordinator || record?.studentType !== "advising" || !roster.some((a) => a._id === advisorId)) throw new Error("Choose an active advisor from the current roster.");
        await api(`/api/advisor/students/${encodeURIComponent(record._id)}/advisor`, { token, method: "PATCH", body: { advisorId } }); committed = true;
        if (!active.current) return;
        setRecord((old) => ({ ...old, assignedAdvisor: roster.find((a) => a._id === advisorId) })); setMessage("Advisor assignment saved. Previous assignment history is retained.");
      }
      setConfirm(null);
      await load();
    } catch (err) { if (active.current) { if (committed) { setConfirm(null); setError(`The change was saved, but refreshing failed: ${err.message}`); } else setConfirmError(err.message); } }
    finally { if (active.current) setBusy(false); }
  }
  const students = directory?.students || [], options = directory?.filters || {};
  const update = (key) => (e) => setFilters((old) => ({ ...old, [key]: e.target.value }));
  const filtersUI = <form className="ad4r-filters" onSubmit={(e) => { e.preventDefault(); setApplied({ ...filters }); }}>
    <label className="field ad4r-search"><span>Find a student</span><input type="search" maxLength={100} value={filters.search} onChange={update("search")} placeholder="Student ID, name or GUC email" /></label>
    <label className="field"><span>Account status</span><select value={filters.accountStatus} onChange={update("accountStatus")}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    <label className="field"><span>Student type</span><select value={filters.studentType} onChange={update("studentType")}><option value="">All students</option><option value="advising">Advising</option><option value="normal">Normal</option></select></label>
    {coordinator && <label className="field"><span>Advisor</span><select value={filters.advisor} onChange={update("advisor")}><option value="">All advisors</option>{(options.advisors || []).map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}</select></label>}
    <button type="submit" className="outline-button" disabled={loading}>Apply filters</button><button className="text-button" type="button" onClick={() => { setFilters(defaults); setApplied(defaults); }}>Clear filters</button>
  </form>;
  const lookupUI = coordinator && <section className="ad4r-membership"><div className="ad4r-record-title"><Conversation replay={advisor?.email || "lookup"} /><div><h2>Advisor access</h2><p>Membership and student assignment are separate.</p></div></div>
    <form className="ad4r-lookup" onSubmit={lookup}><label className="field"><span>Advisor GUC email</span><input type="email" value={email} required maxLength={254} onChange={(e) => { setEmail(e.target.value); setAdvisor(null); lookupSequence.current++; setLookupBusy(false); }} /></label><button type="submit" className="outline-button" disabled={lookupBusy || busy}>{lookupBusy ? "Looking up…" : "Look up advisor"}</button></form>
    {lookupError && <p className="feedback error" role="alert">{lookupError} Correct the email or submit the lookup again.</p>}
    {advisor && <div className="ad4r-advisor-result"><strong>{advisor.fullName}</strong><small>{advisor.email}</small><Status value={advisor.isAdvisorInSystem ? "active" : "inactive"}>{advisor.isAdvisorInSystem ? "In advising system" : "Not in advising system"}</Status><button className="outline-button" type="button" disabled={busy} onClick={() => ask("membership")}>{advisor.isAdvisorInSystem ? "Remove advisor" : "Add advisor"}</button></div>}
    <p className="helper-text">The server sends the membership notice when email delivery is configured. The result shows its actual email status.</p>
  </section>;
  const reader = <section className="ad4r-account-reader" aria-busy={opening}>
    {selectedId && <button className="text-button" type="button" disabled={busy} onClick={closeRecord}>← Back to students</button>}
    {opening ? <p role="status">Loading the current student account…</p> : record ? <>
      <div className="ad4r-record-title"><div><h2 tabIndex={-1} ref={heading}>{record.user?.fullName || record.studentId}</h2><p>{record.studentId} · {record.user?.email}</p></div><Status value={record.user?.isActive ? "active" : "inactive"} /></div>
      <Facts items={[["Student type", pretty(record.studentType)], ["Major / semester", `${record.major || "—"} / ${record.currentSemester || "—"}`], ["Assigned advisor", record.assignedAdvisor?.fullName || "Unassigned"], ["Academic standing", pretty(record.academicStanding)]]} />
      {admin && <div className="ad4r-access-action"><h3>Account access</h3><p>Changing login access does not remove the student’s academic records, registration or schedule history.</p><button className="outline-button" type="button" onClick={() => ask("account")} disabled={busy || !record.user?._id}>{record.user?.isActive ? "Deactivate account" : "Activate account"}</button></div>}
      {coordinator && record.studentType === "advising" && <form className="ad4r-assignment" onSubmit={(e) => { e.preventDefault(); ask("assignment"); }}><h3>Advisor assignment</h3><label className="field"><span>Active advisor</span><select aria-label="Active advisor" value={advisorId} required disabled={busy} onChange={(e) => setAdvisorId(e.target.value)}><option value="">Choose an advisor</option>{roster.map((a) => <option key={a._id} value={a._id}>{a.fullName} · {a.email}</option>)}</select></label>{!roster.length && <p>No active advising-system advisors are available. Add advisor access before assigning a student.</p>}<button className="primary-button" disabled={busy || !advisorId || advisorId === record.assignedAdvisor?._id}>{record.assignedAdvisor ? "Save reassignment" : "Assign advisor"}</button><p className="helper-text">Changing the assignment keeps previous advisor history.</p></form>}
      {coordinator && record.studentType !== "advising" && <p className="helper-text">Normal students do not have an advising assignment. Account access changes require an Administrator.</p>}
    </> : <div className="ad4r-empty"><h2>Choose a student</h2><p>{admin ? "Review the identity and current access before making an account change." : "Choose an advising student to assign an active advisor."}</p></div>}
  </section>;
  function rows(items) {
    return <div className="ad4r-table-scroll"><table className="ad4r-accounts"><thead><tr><th>Student</th><th>Type / major</th><th>Advisor</th><th>Account</th><th>Updated</th><th>Action</th></tr></thead><tbody>{items.map((s) => <tr key={s.id} className={selectedId === s.id ? "ad4r-selected" : ""}>
      <td data-label="Student">{design === 9 && <label className="ad4r-compare-checkbox"><input type="checkbox" aria-label={`Compare ${s.fullName}`} checked={compared.includes(s.id)} disabled={!compared.includes(s.id) && compared.length >= 2} onChange={(e) => setCompared((old) => e.target.checked ? [...old, s.id].slice(0, 2) : old.filter((id) => id !== s.id))} />Compare</label>}<strong>{s.fullName}</strong><small>{s.studentId}</small><small>{s.email}</small></td>
      <td data-label="Type / major">{pretty(s.studentType)}<small>{s.major} · Semester {s.currentSemester}</small></td><td data-label="Advisor">{s.assignedAdvisor?.fullName || "Unassigned"}</td><td data-label="Account"><Status value={s.accountStatus} /></td><td data-label="Updated">{date(s.lastUpdatedAt)}</td><td data-label="Action"><button id={`ad4r-account-${s.id}`} type="button" className="text-button" disabled={opening || busy} onClick={() => open(s)}>Open record</button></td>
    </tr>)}</tbody></table></div>;
  }
  const register = <section className="ad4r-register"><div className="results-heading"><h2>Students</h2><span className="result-count" aria-live="polite">{loading ? "Loading…" : `${students.length} students`}</span></div>
    {!loading && !students.length ? <div className="ad4r-empty"><h3>{error ? "Student records unavailable" : "No matching students"}</h3><p>{error ? "Retry when the directory service is available." : "Change your search or clear the filters."}</p></div> : [4, 7].includes(design) ? <div className="ad4r-groups">{groupBy(students, (s) => design === 4 ? pretty(s.accountStatus) : s.assignedAdvisor?.fullName || "Unassigned").map(([label, list]) => <details open key={label}><summary>{label} · {list.length}</summary>{rows(list)}</details>)}</div> : rows(students)}
  </section>;
  return <div className="ad4r-page ad4r-admin">
    <header className="workspace-header"><div><h1>{admin ? "Account administration" : "Advisor administration"}</h1><p>{admin ? "Review and change student login access without deleting academic history." : "Manage advising-system membership and student assignments."}</p></div><button className="outline-button" type="button" onClick={() => load()} disabled={busy || loading}>Refresh</button></header>
    <Feedback error={error} message={message} busy={busy || opening} retry={() => selectedId && !record ? open({ id: selectedId }) : load()} />
    {design === 10 && <nav className="ad4r-steps" aria-label="Administration steps">{["Find a record", "Review and act", "Advisor access"].filter((_, i) => coordinator || i < 2).map((label, i) => <button type="button" key={label} aria-pressed={stage === i} onClick={() => setStage(i)}>{i + 1}. {label}</button>)}</nav>}
    <div className="ad4r-admin-layout">
      <div className="ad4r-filter-region" hidden={design === 10 && stage !== 0}>{filtersUI}</div>
      <div className="ad4r-register-region" hidden={design === 10 && stage !== 0}>{register}</div>
      <div className="ad4r-reader-region" hidden={design === 10 && stage !== 1}>{reader}</div>
      {coordinator && <div className="ad4r-membership-region" hidden={design === 10 && stage !== 2}>{lookupUI}</div>}
      {design === 9 && <section className="ad4r-comparison"><h2>Compare records</h2><p className="helper-text">Select up to two students. Changes are made only after opening and confirming an individual record.</p><div>{compared.map((id) => { const s = students.find((r) => r.id === id); return s && <article key={id}><h3>{s.fullName}</h3><Facts items={[["Student ID", s.studentId], ["Account", pretty(s.accountStatus)], ["Advisor", s.assignedAdvisor?.fullName || "Unassigned"], ["Workflow", pretty(s.workflowStatus)], ["Blocking step", pretty(s.blockingStep)]]} /><button type="button" className="outline-button" disabled={busy || opening} onClick={() => open(s)}>Open record</button></article>; })}</div></section>}
    </div>
    {confirm && <Confirm title={confirm === "account" ? `${record.user.isActive ? "Deactivate" : "Activate"} this account?` : confirm === "membership" ? `${advisor.isAdvisorInSystem ? "Remove" : "Add"} advisor access?` : "Save advisor assignment?"} action={confirm === "account" ? "Confirm account change" : confirm === "membership" ? "Confirm advisor access" : "Save assignment"} busy={busy} error={confirmError} onClose={() => setConfirm(null)} onConfirm={commit}>
      {confirm === "account" ? <><p>{record.user.fullName} · {record.studentId}</p><p>{record.user.isActive ? "The student will no longer be able to sign in." : "The student will be able to sign in again."} Academic and schedule records are retained.</p></> : confirm === "membership" ? <><p>{advisor.fullName} · {advisor.email}</p><p>{advisor.isAdvisorInSystem ? "Current advising assignments will be cleared. Previous advisor actions and assignment history remain." : "The advisor will become available for new advising assignments."} The server will attempt the membership email notice.</p></> : <><p>{record.user?.fullName} · {record.studentId}</p><p>{record.assignedAdvisor?.fullName || "Unassigned"} → {roster.find((a) => a._id === advisorId)?.fullName}</p><p>Previous advisor history is retained.</p></>}
    </Confirm>}
  </div>;
}
