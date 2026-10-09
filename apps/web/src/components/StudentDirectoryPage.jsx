import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";

const emptyFilters = { search: "", studentType: "", advisor: "", major: "", currentSemester: "", academicStanding: "", workflowStatus: "", blockingStep: "", accountStatus: "" };
const pretty = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

export default function StudentDirectoryPage({ token, role, notify }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [directory, setDirectory] = useState({ students: [], filters: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [advisor, setAdvisor] = useState(null);
  const [advisorError, setAdvisorError] = useState("");
  const [advisorBusy, setAdvisorBusy] = useState(false);

  const loadStudents = useCallback(async (signal) => {
    setLoading(true); setError("");
    const params = new URLSearchParams(Object.entries(applied).filter(([, value]) => value));
    try { setDirectory(await api(`/api/admin/students?${params.toString()}`, { token, signal })); }
    catch (requestError) { if (requestError.name !== "AbortError") setError(explainApiError(requestError, "Student directory")); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [applied, token]);

  useEffect(() => {
    const controller = new AbortController();
    loadStudents(controller.signal);
    return () => controller.abort();
  }, [loadStudents]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, ...(key === "studentType" && value === "normal" ? { advisor: "" } : {}) }));
  const openDetails = async (studentId) => {
    setDetails({ loading: true });
    try { setDetails(await api(`/api/admin/students/${encodeURIComponent(studentId)}`, { token })); }
    catch (requestError) { setDetails({ error: explainApiError(requestError, "Student details") }); }
  };
  const setAccountStatus = async () => {
    const user = details?.user;
    if (!user?._id) return;
    try {
      const result = await api(`/api/admin/users/${encodeURIComponent(user._id)}/status`, { token, method: "PATCH", body: { isActive: !user.isActive } });
      setDetails((current) => ({ ...current, user: { ...current.user, isActive: result.isActive } }));
      setDirectory((current) => ({ ...current, students: current.students.map((student) => student.id === String(details._id) ? { ...student, accountStatus: result.isActive ? "active" : "inactive" } : student) }));
      notify("success", `Account ${result.isActive ? "activated" : "deactivated"}.`);
    } catch (requestError) { setDetails((current) => ({ ...current, error: explainApiError(requestError, "Account status update") })); }
  };
  const lookupAdvisor = async (event) => {
    event.preventDefault(); setAdvisor(null); setAdvisorError(""); setAdvisorBusy(true);
    try { setAdvisor(await api(`/api/admin/advisors/lookup?email=${encodeURIComponent(advisorEmail)}`, { token })); }
    catch (requestError) { setAdvisorError(explainApiError(requestError, "Advisor directory")); }
    finally { setAdvisorBusy(false); }
  };
  const changeAdvisor = async () => {
    if (!advisor) return;
    const add = !advisor.isAdvisorInSystem;
    setAdvisorBusy(true); setAdvisorError("");
    try {
      const result = await api(add ? "/api/admin/advisors" : `/api/admin/advisors/${encodeURIComponent(advisor.email)}`, { token, method: add ? "POST" : "DELETE", ...(add ? { body: { email: advisor.email } } : {}) });
      setAdvisor((current) => ({ ...current, isAdvisorInSystem: add }));
      notify("success", `${add ? "Advisor added" : "Advisor removed"}. Email status: ${result.emailStatus || "not configured"}.`);
      setApplied((current) => ({ ...current }));
    } catch (requestError) { setAdvisorError(explainApiError(requestError, "Advisor management")); }
    finally { setAdvisorBusy(false); }
  };

  const students = directory.students || [];
  const options = directory.filters || {};
  return <div className="page-stack">
    <div className="page-title-row"><div><p className="eyebrow">GROUP B · STUDENT DIRECTORY</p><h1>Student directory</h1><p className="page-description">Search student records and review advising status and account details.</p></div><span className="term-label">{directory.term ? `${pretty(directory.term.season)} ${directory.term.academicYear}` : "Directory"}</span></div>
    <section className="panel directory-filters">
      <div className="panel-heading"><div><p className="eyebrow">FIND A STUDENT</p><h2>Search and filters</h2></div><span className="panel-count">01</span></div>
      <form onSubmit={(event) => { event.preventDefault(); setApplied({ ...filters }); }}>
        <div className="filter-grid">
          <label className="field span-two"><span>Search students</span><input type="search" maxLength={100} value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Student ID, name, or email" /></label>
          <Select label="Student type" value={filters.studentType} onChange={(value) => updateFilter("studentType", value)} options={options.studentTypes || []} />
          <Select label="Advisor" value={filters.advisor} onChange={(value) => updateFilter("advisor", value)} options={(options.advisors || []).map((item) => ({ value: item.id, label: item.fullName }))} disabled={filters.studentType === "normal"} />
          <Select label="Major" value={filters.major} onChange={(value) => updateFilter("major", value)} options={options.majors || []} />
          <Select label="Semester" value={filters.currentSemester} onChange={(value) => updateFilter("currentSemester", value)} options={Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} />
          <Select label="Academic standing" value={filters.academicStanding} onChange={(value) => updateFilter("academicStanding", value)} options={options.academicStandings || []} />
          <Select label="Workflow status" value={filters.workflowStatus} onChange={(value) => updateFilter("workflowStatus", value)} options={options.workflowStatuses || []} />
          <Select label="Blocking step" value={filters.blockingStep} onChange={(value) => updateFilter("blockingStep", value)} options={options.blockingSteps || []} />
          <Select label="Account status" value={filters.accountStatus} onChange={(value) => updateFilter("accountStatus", value)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
        </div>
        <div className="form-actions"><button className="primary-button" type="submit">Apply filters <span>→</span></button><button className="text-button" type="button" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); }}>Clear filters</button><button className="text-button push-right" type="button" onClick={() => loadStudents()}>↻ Refresh</button></div>
      </form>
    </section>

    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel results-panel" aria-busy={loading}>
      <div className="results-heading"><div><p className="eyebrow">DIRECTORY RESULTS</p><h2>Students</h2></div><span className="result-count">{loading ? "Loading" : `${students.length} ${students.length === 1 ? "student" : "students"}`}</span></div>
      {loading ? <div className="loading-state"><span className="loader" />Loading students…</div> : students.length === 0 ? <div className="empty-state"><span>♙</span><h3>No students to show</h3><p>{error ? "The directory service could not be reached." : "Try changing your filters or search terms."}</p></div> : <div className="table-scroll"><table><thead><tr><th>Student</th><th>Type</th><th>Major</th><th>Semester</th><th>Standing</th><th>Advisor</th><th>Account</th><th>Workflow</th><th>Blocking step</th><th>Updated</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><button type="button" className="student-cell-button" onClick={() => openDetails(student.id)}><strong>{student.studentId || "Student"}</strong><span>{student.fullName || "—"}</span><small>{student.email}</small></button></td><td>{pretty(student.studentType)}</td><td>{student.major || "—"}</td><td>{student.currentSemester || "—"}</td><td>{pretty(student.academicStanding)}</td><td>{student.assignedAdvisor?.fullName || <span className="secondary-text">Unassigned</span>}</td><td><span className={`status-pill ${student.accountStatus === "active" ? "good" : "muted"}`}>{pretty(student.accountStatus)}</span></td><td>{pretty(student.workflowStatus)}</td><td>{pretty(student.blockingStep)}</td><td>{student.lastUpdatedAt ? new Date(student.lastUpdatedAt).toLocaleString() : "—"}</td></tr>)}</tbody></table></div>}
    </section>

    {role === "coordinator" && <section className="panel advisor-management"><div className="panel-heading"><div><p className="eyebrow">GROUP B · ADVISOR SYSTEM</p><h2>Advisor access</h2></div><span className="panel-count">02</span></div><p className="page-description">Look up an existing university advisor and add or remove advising-system access.</p><form className="inline-controls" onSubmit={lookupAdvisor}><label className="field"><span>Advisor GUC email</span><input type="email" required value={advisorEmail} onChange={(event) => setAdvisorEmail(event.target.value)} placeholder="name@guc.edu.eg" /></label><button className="primary-button" disabled={advisorBusy}>{advisorBusy ? "Looking up…" : "Look up advisor"}</button></form>{advisorError && <div className="feedback error" role="alert">{advisorError}</div>}{advisor && <div className="advisor-result"><span className="avatar">{advisor.fullName?.slice(0, 1)}</span><div><strong>{advisor.fullName}</strong><small>{advisor.email}</small></div><span className={`status-pill ${advisor.isAdvisorInSystem ? "good" : "muted"}`}>{advisor.isAdvisorInSystem ? "In advising system" : "Not in advising system"}</span><button className={advisor.isAdvisorInSystem ? "outline-button danger-button" : "primary-button"} type="button" onClick={changeAdvisor} disabled={advisorBusy}>{advisor.isAdvisorInSystem ? "Remove" : "Add advisor"}</button></div>}<p className="helper-text">Email notices need SMTP settings configured by the system administrator.</p></section>}

    {details && <div className="modal-backdrop" role="presentation" onClick={() => setDetails(null)}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="student-details-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">STUDENT RECORD</p><h2 id="student-details-title">Student details</h2></div><button className="icon-button" type="button" onClick={() => setDetails(null)} aria-label="Close">×</button></div>{details.loading ? <div className="loading-state"><span className="loader" />Loading student…</div> : details.error ? <div className="feedback error">{details.error}</div> : <><div className="detail-grid modal-details"><Detail label="Student ID" value={details.studentId} /><Detail label="Name" value={details.user?.fullName} /><Detail label="Email" value={details.user?.email} /><Detail label="Student type" value={pretty(details.studentType)} /><Detail label="Major" value={details.major} /><Detail label="Semester" value={details.currentSemester} /><Detail label="Academic standing" value={pretty(details.academicStanding)} /><Detail label="GPA" value={details.gpa} /><Detail label="Enrollment" value={pretty(details.enrollmentStatus)} /><Detail label="Advisor" value={details.assignedAdvisor?.fullName || "Unassigned"} /><Detail label="Account" value={details.user?.isActive ? "Active" : "Inactive"} /></div>{role === "administrator" && details.user && <button className={details.user.isActive ? "outline-button danger-button" : "primary-button"} type="button" onClick={setAccountStatus}>{details.user.isActive ? "Deactivate account" : "Activate account"}</button>}</>}</section></div>}
  </div>;
}

function Select({ label, value, onChange, options, disabled }) {
  return <label className="field"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map((option) => { const item = typeof option === "string" ? { value: option, label: pretty(option) } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></label>;
}
function Detail({ label, value }) { return <div className="detail-item"><span>{label}</span><strong>{value ?? "—"}</strong></div>; }
