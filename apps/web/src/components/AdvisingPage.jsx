import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";
import { StudentRecordsPage } from "./BasicPages.jsx";

const reasons = ["probation", "failedCourses", "unattendedCourses", "undeclaredMajor", "transfer"];
const statuses = ["notStarted", "drafting", "readyForStudentReview", "processed"];
const pretty = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

export default function AdvisingPage({ token, role, onOpenPreferences }) {
  const [rows, setRows] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [search, setSearch] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [recordsStudent, setRecordsStudent] = useState(null);
  const [assigning, setAssigning] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (advisorFilter) params.set("advisorId", advisorFilter);
    if (reason) params.set("advisingReason", reason);
    if (status) params.set("scheduleStatus", status);
    try {
      const [result, advisorList] = await Promise.all([
        api(`/api/advisor/students?${params.toString()}`, { token }),
        api("/api/advisor/advisors", { token }),
      ]);
      setRows(result.data || result.students || []); setAdvisors(advisorList.advisors || advisorList || []);
    } catch (requestError) { setError(explainApiError(requestError, "Advising directory")); }
    finally { setLoading(false); }
  }, [token, search, advisorFilter, reason, status]);
  useEffect(() => { load(); }, [load]);

  return <div className="page-stack"><div className="page-title-row"><div><p className="eyebrow">GROUP B · ADVISING</p><h1>Advising students</h1><p className="page-description">Review assigned advising students and their current workflow status.</p></div><button className="outline-button" type="button" onClick={load}>↻ Refresh</button></div>
    <section className="panel directory-filters"><div className="filter-grid advisor-filters"><label className="field span-two"><span>Search by student, ID, or email</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Type to search" /></label><label className="field"><span>Advisor</span><select value={advisorFilter} onChange={(event) => setAdvisorFilter(event.target.value)}><option value="">All advisors</option>{advisors.map((advisor) => <option key={advisor._id} value={advisor._id}>{advisor.fullName}</option>)}</select></label><label className="field"><span>Advising reason</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">All reasons</option>{reasons.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label><label className="field"><span>Schedule status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select></label></div></section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel results-panel" aria-busy={loading}><div className="results-heading"><div><p className="eyebrow">ADVISOR WORKSPACE</p><h2>Assigned students</h2></div><span className="result-count">{loading ? "Loading" : `${rows.length} students`}</span></div>{loading ? <div className="loading-state"><span className="loader" />Loading advising students…</div> : rows.length === 0 ? <div className="empty-state"><span>♧</span><h3>No advising students found</h3><p>{error || "Change your filters to see more students."}</p></div> : <div className="table-scroll"><table><thead><tr><th>Student ID</th><th>Name and email</th><th>Major</th><th>Advisor</th><th>Workflow status</th><th>Blocking step</th><th>Last update</th><th>Actions</th></tr></thead><tbody>{rows.map((student) => <tr key={student._id}><td><strong>{student.studentId}</strong></td><td><strong>{student.user?.fullName || "—"}</strong><span className="secondary-text">{student.user?.email}</span></td><td>{student.major || "—"}</td><td>{student.assignedAdvisor?.fullName || "Unassigned"}</td><td>{pretty(student.workflowStatus)}</td><td>{pretty(student.blockingStep)}</td><td>{student.lastActivityAt ? new Date(student.lastActivityAt).toLocaleDateString() : "—"}</td><td><div className="table-actions"><button className="text-button" type="button" onClick={() => setRecordsStudent(student)}>Profile</button><button className="text-button" type="button" onClick={async () => { try { setSelected(await api(`/api/advisor/students/${student._id}`, { token })); } catch (requestError) { setError(explainApiError(requestError, "Student details")); } }}>Details</button><button className="text-button" type="button" onClick={() => setAssigning(student)}>{student.assignedAdvisor?._id ? "Reassign" : "Assign"}</button><button className="text-button" type="button" onClick={() => onOpenPreferences?.(student)}>Preferences</button></div></td></tr>)}</tbody></table></div>}</section>
    {selected && <StudentModal student={selected} onClose={() => setSelected(null)} />}
    {recordsStudent && <div className="modal-backdrop" onClick={() => setRecordsStudent(null)}><section className="modal-card wide-modal" role="dialog" aria-modal="true" aria-label="Academic records" onClick={(event) => event.stopPropagation()}><StudentRecordsPage token={token} profile={{ role }} profileId={recordsStudent._id} viewerRole={role} subjectName={recordsStudent.user?.fullName || recordsStudent.studentId} onClose={() => setRecordsStudent(null)} notify={(type, text) => setError(type === "error" ? text : "")} /></section></div>}
    {assigning && <AssignModal token={token} student={assigning} advisors={advisors} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); load(); }} />}
  </div>;
}

export function MyAdvisorPage({ token }) {
  const [advisor, setAdvisor] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { api("/api/advisor/my-advisor", { token }).then(setAdvisor).catch((requestError) => setError(explainApiError(requestError, "Assigned advisor"))).finally(() => setLoading(false)); }, [token]);
  return <div className="page-stack"><div className="page-title-row"><div><p className="eyebrow">GROUP B · STUDENT SERVICES</p><h1>My advisor</h1><p className="page-description">Contact details for your currently assigned advisor.</p></div></div>{error && <div className="feedback error" role="alert">{error}</div>}{loading ? <div className="panel loading-state"><span className="loader" />Loading advisor…</div> : advisor && <section className="panel advisor-card"><span className="avatar avatar-xl">{advisor.fullName?.slice(0, 1) || "A"}</span><div><p className="eyebrow">YOUR ADVISOR</p><h2>{advisor.fullName}</h2><a href={`mailto:${advisor.email}`}>{advisor.email}</a></div><a className="primary-button" href={`mailto:${advisor.email}`}>Send email <span>↗</span></a></section>}{!loading && !error && !advisor && <div className="panel empty-state"><span>♧</span><h3>No advisor assigned</h3><p>Your assigned advisor will appear here once the assignment is recorded.</p></div>}</div>;
}

function AssignModal({ token, student, advisors, onClose, onSaved }) {
  const [advisorId, setAdvisorId] = useState(student.assignedAdvisor?._id || "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const save = async (event) => { event.preventDefault(); setBusy(true); setError(""); try { await api(`/api/advisor/students/${student._id}/advisor`, { token, method: "PATCH", body: { advisorId } }); onSaved(); } catch (requestError) { setError(explainApiError(requestError, "Advisor assignment")); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onClick={onClose}><section className="modal-card narrow-modal" role="dialog" aria-modal="true" aria-labelledby="assign-heading" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">GROUP B · ADVISOR ASSIGNMENT</p><h2 id="assign-heading">{student.assignedAdvisor ? "Reassign advisor" : "Assign advisor"}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><p className="page-description">Student: <strong>{student.user?.fullName || student.studentId}</strong> · {student.studentId}</p>{error && <div className="feedback error">{error}</div>}<form className="form-stack" onSubmit={save}><label className="field"><span>Advisor</span><select required value={advisorId} onChange={(event) => setAdvisorId(event.target.value)}><option value="">Choose an advisor</option>{advisors.map((advisor) => <option key={advisor._id} value={advisor._id}>{advisor.fullName} ({advisor.email})</option>)}</select></label><div className="form-actions"><button type="button" className="outline-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy || !advisorId}>{busy ? "Saving…" : "Save assignment"}</button></div></form></section></div>;
}

function StudentModal({ student, onClose }) {
  const profile = student.profile || student;
  const history = student.assignmentHistory || [];
  return <div className="modal-backdrop" onClick={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="advising-details-title" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">GROUP B · STUDENT RECORD</p><h2 id="advising-details-title">Advising details</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div><div className="detail-grid modal-details"><Detail label="Student ID" value={profile.studentId} /><Detail label="Name" value={profile.user?.fullName} /><Detail label="Email" value={profile.user?.email} /><Detail label="Major" value={profile.major} /><Detail label="Current semester" value={profile.currentSemester} /><Detail label="Academic standing" value={pretty(profile.academicStanding)} /><Detail label="Advising reason" value={pretty(profile.advisingReason)} /><Detail label="Enrollment" value={pretty(profile.enrollmentStatus)} /><Detail label="Advisor" value={profile.assignedAdvisor?.fullName} /><Detail label="Workflow status" value={student.workflowState?.status || student.workflowStatus} /><Detail label="Blocking step" value={student.workflowState?.blockingStep || student.blockingStep} /></div><h3 className="section-heading">Advisor history</h3>{history.length === 0 ? <p className="helper-text">No advisor assignment history.</p> : <div className="table-scroll"><table><thead><tr><th>Advisor</th><th>Assigned</th><th>Status</th></tr></thead><tbody>{history.map((entry) => <tr key={entry._id}><td>{entry.advisor?.fullName || "—"}</td><td>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—"}</td><td>{entry.endedAt ? new Date(entry.endedAt).toLocaleDateString() : "Active"}</td></tr>)}</tbody></table></div>}</section></div>;
}
function Detail({ label, value }) { return <div className="detail-item"><span>{label}</span><strong>{value ?? "—"}</strong></div>; }
