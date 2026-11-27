import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";
import { Modal } from "./AcademicWorkspace.jsx";
import { ScheduleActivityPage } from "./B1Pages.jsx";
import { StudentRegister, RegisterRow, StudentIdentity, RegisterEmpty, RecordPages, scheduleTone } from "./CoordinatorRecords.jsx";
import { ChromeIcon } from "./PortalChrome.jsx";
import PortalAvatar from "./PortalAvatar.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";
import { displayLabel } from "./WorkspaceUI.jsx";

const emptyFilters = { search: "", studentType: "", advisor: "", major: "", currentSemester: "", academicStanding: "", workflowStatus: "", blockingStep: "", accountStatus: "" };
const workflowMarks = {
  noActiveTerm: "calendar",
  reopened: "history",
  readyToProcess: "readyToProcess",
  changeRequestPending: "scheduleChange",
  awaitingPaymentChoice: "paymentChoice",
  deferredToNextInstallment: "nextInstallment",
  scheduleAssigned: "scheduleAssigned",
  swapRequestOpen: "swapOpen",
  swapCompleted: "swapComplete",
  swapWithdrawn: "swapWithdrawn",
  swapExpired: "swapExpired",
};

function DirectoryScheduleStatus({ status, activeTerm }) {
  const state = status || (activeTerm ? "notStarted" : "noActiveTerm");
  const icon = workflowMarks[state];
  return <span className={`status-pill ${state === "pendingApproval" ? "pending" : scheduleTone(state)}`} data-workflow-mark={icon}>
    {icon && <ChromeIcon name={icon} />}
    {state === "noActiveTerm" ? "No active term" : displayLabel(state)}
  </span>;
}
const pretty = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

export default function StudentDirectoryPage({ token, role, notify }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [directory, setDirectory] = useState({ students: [], filters: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(null);
  const [page, setPage] = useState(1);
  const [showAdvisors, setShowAdvisors] = useState(false);
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

  const chipLabels = { studentType: "Type", advisor: "Advisor", major: "Major", currentSemester: "Semester", academicStanding: "Standing", workflowStatus: "Status", blockingStep: "Blocking step", accountStatus: "Account" };
  const chipValue = (key, value) => key === "advisor" ? ((directory.filters?.advisors || []).find((item) => item.id === value)?.fullName || value) : pretty(value);
  const filterChips = Object.keys(chipLabels).filter((key) => applied[key]).map((key) => ({
    key, label: `${chipLabels[key]}: ${chipValue(key, applied[key])}`,
    onRemove: () => { setFilters((current) => ({ ...current, [key]: "" })); setApplied((current) => ({ ...current, [key]: "" })); },
  }));
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
      await api(add ? "/api/admin/advisors" : `/api/admin/advisors/${encodeURIComponent(advisor.email)}`, { token, method: add ? "POST" : "DELETE", ...(add ? { body: { email: advisor.email } } : {}) });
      setAdvisor((current) => ({ ...current, isAdvisorInSystem: add }));
      notify("success", `${add ? "Advisor added" : "Advisor removed"}.`);
      setApplied((current) => ({ ...current }));
    } catch (requestError) { setAdvisorError(explainApiError(requestError, "Advisor management")); }
    finally { setAdvisorBusy(false); }
  };

  const students = [...(directory.students || [])].sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  const size = 8;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(students.length / size)));
  const clear = () => { setPage(1); setFilters(emptyFilters); setApplied(emptyFilters); };
  const options = directory.filters || {};
  return <div className="page-stack">
    <div className="page-title-row"><div><h1>Student directory</h1></div>{role === "coordinator" && <button type="button" className="outline-button" aria-expanded={showAdvisors} onClick={() => setShowAdvisors(!showAdvisors)}>Advisor access</button>}</div>
    {role === "coordinator" && showAdvisors && <section className="panel advisor-management"><div className="panel-heading"><div><p className="eyebrow">ADVISOR SYSTEM</p><h2>Advisor access</h2></div><span className="panel-count">02</span></div><p className="page-description">Look up an existing university advisor and add or remove advising-system access.</p><form className="inline-controls" onSubmit={lookupAdvisor}><label className="field"><span>Advisor GUC email</span><input type="email" required value={advisorEmail} onChange={(event) => setAdvisorEmail(event.target.value)} placeholder="name@guc.edu.eg" /></label><button className="primary-button" disabled={advisorBusy}>{advisorBusy ? "Looking up…" : "Look up advisor"}</button></form>{advisorError && <div className="feedback error" role="alert">{advisorError}</div>}{advisor && <div className="advisor-result"><PortalAvatar name={advisor.fullName} /><div><strong>{advisor.fullName}</strong><small>{advisor.email}</small></div><span className={`status-pill ${advisor.isAdvisorInSystem ? "good" : "muted"}`}>{advisor.isAdvisorInSystem ? "In advising system" : "Not in advising system"}</span><button className={advisor.isAdvisorInSystem ? "outline-button danger-button" : "primary-button"} type="button" onClick={changeAdvisor} disabled={advisorBusy}>{advisor.isAdvisorInSystem ? "Remove" : "Add advisor"}</button></div>}</section>}
    <section className="panel directory-filters">
      <form onSubmit={(event) => { event.preventDefault(); setPage(1); setApplied({ ...filters }); }}>
        <FilterDisclosure floating
          search={<label className="field filter-search"><span>Search students</span><input type="search" maxLength={100} value={filters.search} onChange={(event) => { const search = event.target.value; updateFilter("search", search); setApplied((current) => ({ ...current, search })); setPage(1); }} placeholder="Student ID, name or email" /></label>}
          chips={filterChips}
          actions={<button className="text-button" type="button" onClick={clear} disabled={!Object.values(filters).some(Boolean) && !Object.values(applied).some(Boolean)}>Clear</button>}
        >{({ close }) => <>
          <div className="filter-grid">
          <Select label="Student type" value={filters.studentType} onChange={(value) => updateFilter("studentType", value)} options={options.studentTypes || []} />
          <Select label="Advisor" value={filters.advisor} onChange={(value) => updateFilter("advisor", value)} options={(options.advisors || []).map((item) => ({ value: item.id, label: item.fullName }))} disabled={filters.studentType === "normal"} />
          <Select label="Major" value={filters.major} onChange={(value) => updateFilter("major", value)} options={options.majors || []} />
          <Select label="Semester" value={filters.currentSemester} onChange={(value) => updateFilter("currentSemester", value)} options={Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} />
          <Select label="Academic standing" value={filters.academicStanding} onChange={(value) => updateFilter("academicStanding", value)} options={options.academicStandings || []} />
          <Select label="Workflow status" value={filters.workflowStatus} onChange={(value) => updateFilter("workflowStatus", value)} options={options.workflowStatuses || []} />
          <Select label="Blocking step" value={filters.blockingStep} onChange={(value) => updateFilter("blockingStep", value)} options={options.blockingSteps || []} />
          <Select label="Account status" value={filters.accountStatus} onChange={(value) => updateFilter("accountStatus", value)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          </div>
          <div className="filter-panel-actions"><button className="primary-button" type="submit" onClick={() => setTimeout(close, 0)}>Apply filters</button></div>
        </>}</FilterDisclosure>
      </form>
    </section>

    {error && <div className="feedback error" role="alert">{error} <button className="outline-button" type="button" onClick={() => loadStudents()}>Try again</button></div>}
    <section className="panel results-panel directory-results" aria-busy={loading} aria-labelledby="directory-students-heading">
      <div className="results-heading"><div><h2 id="directory-students-heading">Students</h2></div><span className="result-count">{loading ? "Loading" : `${students.length} ${students.length === 1 ? "student" : "students"}`}</span></div>
      {loading ? <div className="loading-state"><span className="loader" />Loading students…</div> : students.length === 0 ? <RegisterEmpty title="No students to show" description={error ? undefined : "Try another name, ID or filter."} /> : <StudentRegister label="Student directory" className="directory-register" columns={["Student", "Programme", "Schedule status", "Action"]}>
        {students.slice((currentPage - 1) * size, currentPage * size).map((student) =>
          <RegisterRow key={student.id} className="directory-student-row">
            <StudentIdentity name={student.fullName} id={student.studentId} />
            <p className="student-register-meta">{student.major || "Undeclared major"}<small>Semester {student.currentSemester || "—"} · {pretty(student.studentType)}</small>{role === "administrator" && student.accountStatus === "inactive" && <small className="status-pill muted">Inactive account</small>}</p>
            <div className="student-register-meta">
              <DirectoryScheduleStatus status={student.workflowStatus} activeTerm={directory.term} />
              {student.workflowStatus !== "notStarted" && student.blockingStep && <small>{student.blockingStep}</small>}
            </div>
            <button className="outline-button" type="button" aria-label={`Open profile for ${student.studentId} · ${student.fullName || "Student"}`} onClick={() => openDetails(student.id)}>Open profile</button>
          </RegisterRow>)}</StudentRegister>}
      <RecordPages page={currentPage} size={size} total={students.length} onChange={setPage} label="Directory" />
    </section>



    {details && <Modal title="Student details" className="record-dossier-dialog" wide onClose={() => setDetails(null)}>
      {details.loading ? <div className="loading-state"><span className="loader" />Loading student…</div> : details.error ? <div className="feedback error" role="alert">{details.error}</div> : <>
        <StudentProfileDetails details={details} workflow={students.find((student) => student.id === details._id)} showWorkflow />
        {role === "administrator" && details.user && <div className="record-dossier-action"><button className={details.user.isActive ? "outline-button danger-button" : "primary-button"} type="button" onClick={setAccountStatus}>{details.user.isActive ? "Deactivate account" : "Activate account"}</button></div>}
        {details.studentType === "advising" && <section className="record-dossier-activity" aria-label="Student schedule history"><ScheduleActivityPage token={token} studentId={details._id} /></section>}
      </>}
    </Modal>}
  </div>;
}

export function StudentProfileDetails({ details, workflow, showWorkflow }) {
  const name = details.user?.fullName || details.fullName || "Student";
  const email = details.user?.email;
  return <div className="record-dossier">
    <div className="record-dossier-intro">
      <PortalAvatar name={name} />
      <div><h3>{name}</h3><p><span>{details.studentId}</span>{details.studentType && <> · {pretty(details.studentType)}</>}</p></div>
    </div>
    <div className="record-dossier-grid">
      <section><h4>Academic record</h4><dl className="record-dossier-facts">
        <Detail label="Major" value={details.major} />
        <Detail label="Semester" value={details.currentSemester} />
        <Detail label="GPA" value={details.gpa} />
        <Detail label="Academic standing" value={pretty(details.academicStanding)} />
      </dl></section>
      <section><h4>Contact and enrollment</h4><dl className="record-dossier-facts">
        <Detail label="Advisor" value={details.assignedAdvisor?.fullName || "Unassigned"} />
        <Detail label="Enrollment" value={pretty(details.enrollmentStatus)} />
        {details.user?.isActive != null && <Detail label="Account" value={details.user.isActive ? "Active" : "Inactive"} />}
        <Detail label="Email" value={email ? <a href={`mailto:${email}`}>{email}</a> : null} />
      </dl></section>
    </div>
    {showWorkflow && <section className="record-dossier-workflow"><h4>Advising workflow</h4><dl className="record-dossier-facts">
      <Detail label="Blocking step" value={workflow?.blockingStep || "None"} />
      <Detail label="Last updated" value={workflow?.lastUpdatedAt ? new Date(workflow.lastUpdatedAt).toLocaleString() : null} />
    </dl></section>}
  </div>;
}

function Select({ label, value, onChange, options, disabled }) {
  return <label className="field"><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{options.map((option) => { const item = typeof option === "string" ? { value: option, label: pretty(option) } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></label>;
}
function Detail({ label, value }) { return <div><dt>{label}</dt><dd>{value ?? "—"}</dd></div>; }
