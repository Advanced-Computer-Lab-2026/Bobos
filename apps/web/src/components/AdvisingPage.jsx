import { StudentRegister, RegisterRow, StudentIdentity, RecordActions, RegisterEmpty, RecordPages, scheduleTone } from "./CoordinatorRecords.jsx";
import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";
import { StudentRecordsPage } from "./BasicPages.jsx";
import { Modal } from "./AcademicWorkspace.jsx";
import RequestRemovalModal from "./RequestRemovalModal.jsx";
import GraduationPlans from "./GraduationPlans.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";

const reasons = ["probation", "failedCourses", "unattendedCourses", "undeclaredMajor", "transfer"];
const pendingRequestTypes = [
  { value: "slotChange", label: "Slot change" },
  { value: "extraHours", label: "Extra hours" },
  { value: "mandatoryCourseRemoval", label: "Course removal" },
  { value: "scheduleSwap", label: "Schedule swap" },
];
const pretty = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

export default function AdvisingPage({ token, role, advisorId, notify, onOpenPreferences, graduationOnly = false }) {
  const coordinator = role === "coordinator";
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [majors, setMajors] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const reload = () => setRefresh((current) => current + 1);
  const changeFilter = (set, value) => { setPage(1); set(value); };
  const [hasActiveTerm, setHasActiveTerm] = useState(false);
  const [advisors, setAdvisors] = useState([]);
  const [search, setSearch] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [majorFilter, setMajorFilter] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [pendingType, setPendingType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [recordsStudent, setRecordsStudent] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [removalStudent, setRemovalStudent] = useState(null);
  const [graduationStudent, setGraduationStudent] = useState(null);

  const load = useCallback(async (signal) => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ page, limit: coordinator ? 8 : 20 });
    if (search) params.set("search", search);
    if (advisorFilter) params.set("advisorId", advisorFilter);
    if (majorFilter) params.set("major", majorFilter);
    if (reason) params.set("advisingReason", reason);
    if (status) params.set("scheduleStatus", status);
    if (pendingType) params.set("pendingRequestType", pendingType);
    try {
      const [result, advisorList] = await Promise.all([
        api(`/api/advisor/students?${params.toString()}`, { token, signal }),
        api("/api/advisor/advisors", { token, signal }),
      ]);
      if (signal.aborted) return;
      setRows(result.data);
      setPagination(result.pagination);
      setStatuses(result.scheduleStatuses);
      setMajors(result.majors);
      setHasActiveTerm(Boolean(result.activeTerm));
      setAdvisors(advisorList.advisors || advisorList || []);
      if (page > result.pagination.pages) setPage(result.pagination.pages);
    } catch (requestError) {
      if (!signal.aborted) setError(explainApiError(requestError, "Advising directory"));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token, coordinator, search, advisorFilter, majorFilter, reason, status, pendingType, page]);
  const clearDropdownFilters = () => {
    setSearch("");
    setPage(1);
    setAdvisorFilter("");
    setMajorFilter("");
    setReason("");
    setStatus("");
    setPendingType("");
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refresh]);

  const filterChips = [
    advisorFilter && { key: "advisor", label: `Advisor: ${advisors.find((advisor) => advisor._id === advisorFilter)?.fullName || advisorFilter}`, onRemove: () => changeFilter(setAdvisorFilter, "") },
    majorFilter && { key: "major", label: `Major: ${majorFilter}`, onRemove: () => changeFilter(setMajorFilter, "") },
    reason && { key: "reason", label: `Reason: ${pretty(reason)}`, onRemove: () => changeFilter(setReason, "") },
    status && { key: "status", label: `Status: ${pretty(status)}`, onRemove: () => changeFilter(setStatus, "") },
    pendingType && { key: "pending", label: `Request: ${pendingRequestTypes.find((item) => item.value === pendingType)?.label || pendingType}`, onRemove: () => { changeFilter(setPendingType, ""); if (pendingType === "scheduleSwap") { setStatus(""); setMajorFilter(""); } } },
  ].filter(Boolean);

  if (graduationStudent) {
    return <GraduationPlans student={graduationStudent} token={token} backLabel={graduationOnly ? "Back to student list" : "Back to advising students"} onBack={() => setGraduationStudent(null)} />;
  }
  const openDetails = async (student) => {
    try { setSelected(await api(`/api/advisor/students/${student._id}`, { token })); }
    catch (requestError) { setError(explainApiError(requestError, "Student details")); }
  };
  const swaps = pendingType === "scheduleSwap";
  const title = swaps ? "Schedule swap requests" : graduationOnly ? "Graduation plans" : "Advising students";
  return <div className="page-stack advising-roster">
    <div className="page-title-row"><div><h1>{title}</h1></div></div>
    <section className="panel directory-filters advising-filter-section"><FilterDisclosure floating
      search={<label className="field filter-search"><span>Search students</span><input type="search" value={search} onChange={(event) => changeFilter(setSearch, event.target.value)} placeholder="Student ID, name or email" /></label>}
      chips={filterChips} actions={<><button className="text-button" type="button" disabled={!search && !filterChips.length} onClick={clearDropdownFilters}>Clear</button>
        <button className="text-button" type="button" onClick={reload}>Refresh</button></>}
    ><div className="filter-grid advisor-filters"><label className="field"><span>Advisor</span><select value={advisorFilter} disabled={pendingType === "scheduleSwap"} onChange={(event) => changeFilter(setAdvisorFilter, event.target.value)}><option value="">All advisors</option>{advisors.map((advisor) => <option key={advisor._id} value={advisor._id}>{advisor.fullName}</option>)}</select></label><label className="field"><span>Major</span><select value={majorFilter} onChange={(event) => changeFilter(setMajorFilter, event.target.value)}><option value="">All majors</option>{majors.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="field"><span>Advising reason</span><select value={reason} disabled={pendingType === "scheduleSwap"} onChange={(event) => changeFilter(setReason, event.target.value)}><option value="">All reasons</option>{reasons.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label><label className="field"><span>Schedule status</span><select value={status} onChange={(event) => changeFilter(setStatus, event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label><label className="field"><span>Pending request type</span><select value={pendingType} onChange={(event) => { const next = event.target.value; changeFilter(setPendingType, next); if ((next === "scheduleSwap") !== (pendingType === "scheduleSwap")) { setStatus(""); setMajorFilter(""); } if (next === "scheduleSwap") { setAdvisorFilter(""); setReason(""); } }}><option value="">All request types</option>{pendingRequestTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div></FilterDisclosure></section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="register-panel" aria-busy={loading}>
      <div className="register-heading"><h2>{swaps ? "Open swaps" : "Student roster"}</h2><span role="status">{loading ? "Loading…" : `${pagination.total} ${pagination.total === 1 ? "student" : "students"}`}</span></div>
      {loading ? <div className="loading-state"><span className="loader" />Loading advising students…</div> : rows.length === 0 ? <RegisterEmpty title={pendingType === "scheduleSwap" ? "No open schedule swaps" : "No advising students found"} description={search || filterChips.length ? "Try another name, ID or filter." : undefined} /> :
        <StudentRegister className={`advising-register${graduationOnly ? " graduation-plan-register" : ""}`} label={title} columns={["Student", "Programme / advisor", "Schedule status", "Last updated", "Actions"]}>{rows.map((student) => <RegisterRow className="advising-student-row" key={student._id}>
          <StudentIdentity name={student.user?.fullName} id={student.studentId} />
          <p className="student-register-meta">{student.major || "Undeclared major"}<small>{student.studentType === "normal" ? "Normal student" : student.assignedAdvisor?.fullName || "Advisor unassigned"}</small></p>
          <div className="student-register-meta">
            <span className={`status-pill ${scheduleTone(student.workflowStatus)}`}>{student.workflowStatus ? pretty(student.workflowStatus) : hasActiveTerm ? "Not started" : "No active term"}</span>
            {student.blockingStep && <small>{pretty(student.blockingStep)}</small>}
          </div>
          {student.lastActivityAt ? <time dateTime={student.lastActivityAt}>{new Date(student.lastActivityAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</time> : "—"}
          {student.studentType === "normal" ? <span className="helper-text">Read only</span> : <div className="student-register-actions">
            {graduationOnly ? <button className="outline-button" type="button" onClick={() => setGraduationStudent(student)}>Graduation plan</button> : <>
              <button className="outline-button" type="button" onClick={() => setRecordsStudent(student)}>{coordinator ? "Profile" : "Academic records"}</button>
              <RecordActions name={student.user?.fullName || student.studentId} burst>
                <button type="button" onClick={() => openDetails(student)}>Advising details</button>
                {coordinator && <button type="button" onClick={() => setAssigning(student)}>{student.assignedAdvisor?._id ? "Reassign advisor" : "Assign advisor"}</button>}
                {onOpenPreferences && <button type="button" onClick={() => onOpenPreferences(student)}>Schedule preferences</button>}
                <button type="button" onClick={() => setRemovalStudent(student)}>Request course removal</button>
                {role === "advisor" && <button type="button" onClick={() => setGraduationStudent(student)}>Graduation plan</button>}
              </RecordActions></>}
          </div>}
        </RegisterRow>)}</StudentRegister>}
      <RecordPages page={page} size={pagination.limit || 8} total={pagination.total} onChange={setPage} busy={loading} label="Advising students" />
    </section>
    {selected && <StudentModal student={selected} onClose={() => setSelected(null)} onOpenGraduationPlans={role === "advisor" ? () => { setGraduationStudent(selected.profile); setSelected(null); } : undefined} />}
    {recordsStudent && <Modal title="Academic records" description={recordsStudent.user?.fullName || recordsStudent.studentId} closeLabel="Back to advising" onClose={() => setRecordsStudent(null)} wide>
      <StudentRecordsPage token={token} profile={{ role }} profileId={recordsStudent._id} notify={notify} />
    </Modal>}
    {assigning && <AssignModal token={token} student={assigning} advisors={advisors} onClose={() => setAssigning(null)} onSaved={() => {
      notify("success", assigning.assignedAdvisor?._id ? "Advisor reassignment saved." : "Advisor assignment saved.");
      setAssigning(null);
      reload();
    }} />}
    {removalStudent && <RequestRemovalModal token={token} advisorId={advisorId} initialStudent={removalStudent} onClose={() => setRemovalStudent(null)} onSuccess={() => {
      notify("success", "Mandatory course removal request submitted.");
      setRemovalStudent(null);
      reload();
    }} />}
  </div>;
}

function AssignModal({ token, student, advisors, onClose, onSaved }) {
  const isReassign = Boolean(student.assignedAdvisor?._id);
  const [advisorId, setAdvisorId] = useState(student.assignedAdvisor?._id || "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const save = async (event) => { event.preventDefault(); setBusy(true); setError(""); try { await api(`/api/advisor/students/${student._id}/advisor`, { token, method: "PATCH", body: { advisorId } }); onSaved(); } catch (requestError) { setError(explainApiError(requestError, "Advisor assignment")); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onClick={onClose}><section className="modal-card narrow-modal" role="dialog" aria-modal="true" aria-labelledby="assign-heading" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">ADVISOR ASSIGNMENT</p><h2 id="assign-heading">{isReassign ? "Reassign advisor" : "Assign advisor"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><p className="page-description">Student: <strong>{student.user?.fullName || student.studentId}</strong> · {student.studentId}</p>{error && <div className="feedback error" role="alert">{error}</div>}<form className="form-stack" onSubmit={save}><label className="field"><span>Advisor</span><select required value={advisorId} onChange={(event) => setAdvisorId(event.target.value)}><option value="">Choose an advisor</option>{advisors.map((advisor) => <option key={advisor._id} value={advisor._id}>{advisor.fullName} ({advisor.email})</option>)}</select></label><div className="form-actions"><button type="button" className="outline-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy || !advisorId}>{busy ? "Saving…" : (isReassign ? "Save reassignment" : "Save assignment")}</button></div></form></section></div>;
}

function StudentModal({ student, onClose, onOpenGraduationPlans }) {
  const profile = student.profile || student;
  const history = student.assignmentHistory || [];
  const workflow = student.workflowState?.status || student.workflowStatus || (student.activeTerm ? "notStarted" : "No active term");
  const blockingStep = student.workflowState?.blockingStep || student.blockingStep;
  return <Modal title="Advising details" className="advising-summary-dialog" onClose={onClose}>
    <div className="advising-detail-person"><StudentIdentity name={profile.user?.fullName} id={profile.studentId} email={profile.user?.email} /></div>
    <section className="advising-workflow-summary" aria-label="Schedule workflow">
      <div><span>Schedule status</span><strong className={`status-pill ${scheduleTone(workflow)}`}>{pretty(workflow)}</strong></div>
      {blockingStep && <div><span>Next step</span><strong>{pretty(blockingStep)}</strong></div>}
    </section>
    <h3 className="section-heading">Academic details</h3>
    <dl className="advising-detail-facts">
      <Detail label="Major" value={profile.major} />
      <Detail label="Current semester" value={profile.currentSemester} />
      <Detail label="Academic standing" value={pretty(profile.academicStanding)} />
      <Detail label="Advising reason" value={pretty(profile.advisingReason)} />
      <Detail label="Enrollment" value={pretty(profile.enrollmentStatus)} />
      <Detail label="Advisor" value={profile.assignedAdvisor?.fullName} />
    </dl>
    <h3 className="section-heading">Advisor history</h3>
    {history.length === 0 ? <p className="helper-text">No advisor assignment history.</p> :
      <div className="table-scroll"><table><thead><tr><th>Advisor</th><th>Assigned</th><th>Ended</th></tr></thead>
        <tbody>{history.map((entry) => <tr key={entry._id}><td>{entry.advisor?.fullName || "—"}</td><td>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—"}</td><td>{entry.endedAt ? new Date(entry.endedAt).toLocaleDateString() : "Active"}</td></tr>)}</tbody>
      </table></div>}
    {onOpenGraduationPlans && <div className="form-footer"><button className="outline-button" type="button" onClick={onOpenGraduationPlans}>Graduation plans</button></div>}
  </Modal>;
}

function Detail({ label, value }) { return <div><dt>{label}</dt><dd>{value ?? "—"}</dd></div>; }
