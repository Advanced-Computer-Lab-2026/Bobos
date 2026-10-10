import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";

const WEEK = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const semesters = Array.from({ length: 10 }, (_, index) => index + 1);

export function GroupAssignmentsPage({ token, canAssign = false, notify }) {
  const [terms, setTerms] = useState([]);
  const [termId, setTermId] = useState("");
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [major, setMajor] = useState("");
  const [semester, setSemester] = useState("");
  const [assigned, setAssigned] = useState("");
  const [target, setTarget] = useState(null);
  const [pickedGroup, setPickedGroup] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api("/api/group-assignments/terms", { token })
      .then(({ terms: rows = [] }) => {
        if (!alive) return;
        setTerms(rows);
        setTermId(rows.find((item) => item.isActive)?.code || rows[0]?.code || "");
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token]);

  const load = useCallback(async () => {
    if (!termId) { setStudents([]); setGroups([]); return; }
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ termId });
    if (search.trim()) params.set("search", search.trim());
    if (major) params.set("major", major);
    if (semester) params.set("semester", semester);
    if (assigned) params.set("assigned", assigned);
    try {
      const [roster, scheduleGroups] = await Promise.all([
        api(`/api/group-assignments/students?${params}`, { token }),
        api(`/api/group-assignments/groups?termId=${encodeURIComponent(termId)}`, { token }),
      ]);
      setStudents(roster.students || []);
      setGroups(scheduleGroups.groups || []);
    } catch (err) {
      setError(err.message);
      setStudents([]);
      setGroups([]);
    } finally { setLoading(false); }
  }, [token, termId, search, major, semester, assigned]);

  useEffect(() => { load(); }, [load]);

  const targetGroups = useMemo(() => target ? groups.filter((group) =>
    group.major === target.major && Number(group.semester) === Number(target.currentSemester)
  ) : [], [groups, target]);

  async function submitAssignment(event) {
    event.preventDefault();
    if (!target || !pickedGroup) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/group-assignments", {
        token, method: "POST", body: { studentId: target._id, termId, studyGroup: pickedGroup },
      });
      notify("success", result.message);
      setTarget(null);
      setPickedGroup("");
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function unassign(student) {
    if (!window.confirm(`Remove ${student.fullName} from group ${student.assignment.studyGroup}?`)) return;
    setBusy(true);
    try {
      const result = await api(`/api/group-assignments/${encodeURIComponent(student._id)}?termId=${encodeURIComponent(termId)}`, { token, method: "DELETE" });
      notify("success", result.message);
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="page-stack scheduling-page">
    <div className="page-title-row"><div><p className="eyebrow">Requirement 30 · Coordinator</p><h1>Schedule group assignments</h1><p className="page-description">Assign or move active normal students to a published group for their major and semester.</p></div>
      <label className="field term-picker"><span>Academic term</span><select value={termId} onChange={(event) => setTermId(event.target.value)} disabled={loading || !terms.length}>{terms.map((term) => <option key={term._id} value={term.code}>Term {term.code} · {term.season}{term.isActive ? " · Active" : ""}</option>)}</select></label>
    </div>
    {error && <Feedback tone="error">{error}</Feedback>}
    {!loading && !terms.length && <Feedback tone="warning">Create an academic term before assigning schedules.</Feedback>}
    <section className="panel">
      <div className="results-heading"><div><p className="eyebrow">Normal students</p><h2>Student roster</h2></div><span className="result-count">{students.length} students</span></div>
      <div className="scheduling-filters">
        <label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, or student ID" maxLength={100} /></label>
        <label className="field"><span>Major</span><select value={major} onChange={(event) => setMajor(event.target.value)}><option value="">All majors</option><option>CS</option><option>DMET</option></select></label>
        <label className="field"><span>Semester</span><select value={semester} onChange={(event) => setSemester(event.target.value)}><option value="">All semesters</option>{semesters.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Assignment</span><select value={assigned} onChange={(event) => setAssigned(event.target.value)}><option value="">All</option><option value="false">Unassigned</option><option value="true">Assigned</option></select></label>
      </div>
      {loading ? <Loading /> : students.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Major</th><th>Semester</th><th>Standing</th><th>Group</th><th /></tr></thead><tbody>{students.map((student) => <tr key={student._id}>
        <td><strong>{student.fullName}</strong><span className="secondary-text">{student.studentId} · {student.email}</span></td>
        <td>{student.major}</td><td>{student.currentSemester}</td><td>{student.academicStanding === "probation" ? "Probation" : "Good standing"}</td>
        <td>{student.assignment ? `Group ${student.assignment.studyGroup} · ${student.assignment.courseCount} courses` : "Unassigned"}</td>
        <td>{canAssign ? <div className="table-actions"><button className="small-button primary-button" type="button" disabled={busy || !student.isActive} onClick={() => { setTarget(student); setPickedGroup(student.assignment?.studyGroup || ""); }}>{student.assignment ? "Reassign" : "Assign"}</button>{student.assignment && <button className="small-button outline-button danger-button" type="button" disabled={busy} onClick={() => unassign(student)}>Unassign</button>}</div> : <span className="helper-text">Read only</span>}</td>
      </tr>)}</tbody></table></div> : <Empty title="No students match" text="Adjust the search or filters and try again." />}
    </section>
    {target && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setTarget(null)}><section className="modal-card" role="dialog" aria-modal="true" aria-label="Assign schedule group">
      <div className="modal-heading"><div><p className="eyebrow">{target.studentId} · {target.major} semester {target.currentSemester}</p><h2>{target.assignment ? "Reassign schedule group" : "Assign schedule group"}</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => setTarget(null)}>×</button></div>
      <form className="form-stack" onSubmit={submitAssignment}><label className="field"><span>Published group</span><select required value={pickedGroup} onChange={(event) => setPickedGroup(event.target.value)}><option value="">Select a group</option>{targetGroups.map((group) => <option key={group._id} value={group.studyGroup} disabled={Boolean(group.issue)}>{group.studyGroup} · {group.courseCount} courses{group.issue ? " · Needs template fix" : ""}</option>)}</select></label>
        {pickedGroup && targetGroups.find((group) => group.studyGroup === pickedGroup)?.issue && <Feedback tone="warning">{targetGroups.find((group) => group.studyGroup === pickedGroup).issue}</Feedback>}
        {error && <Feedback tone="error">{error}</Feedback>}
        <div className="form-footer"><button className="outline-button" type="button" onClick={() => setTarget(null)} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy || !pickedGroup || Boolean(targetGroups.find((group) => group.studyGroup === pickedGroup)?.issue)}>{busy ? "Saving…" : target.assignment ? "Save reassignment" : "Assign student"}</button></div>
      </form>
    </section></div>}
  </div>;
}

export function StudentSchedulingPage({ token, section }) {
  const [schedule, setSchedule] = useState(null);
  const [courses, setCourses] = useState(null);
  const [courseDetails, setCourseDetails] = useState(null);
  const [swapData, setSwapData] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloadBusy, setDownloadBusy] = useState(false);

  const loadSchedule = useCallback(() => api("/api/schedules/me", { token }), [token]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    const tasks = section === "schedule-swap"
      ? api("/api/swaps/eligible-groups", { token }).then((data) => alive && setSwapData(data))
      : section === "my-courses"
        ? api("/api/schedules/me/courses", { token }).then((data) => { if (alive) setCourses(data); })
        : loadSchedule().then((data) => { if (alive) setSchedule(data); });
    tasks.catch((err) => alive && setError(err.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, section, loadSchedule]);

  useEffect(() => {
    if (section !== "my-courses" || !selectedCourse) { setCourseDetails(null); return; }
    let alive = true;
    api(`/api/schedules/me/courses/${encodeURIComponent(selectedCourse)}${courses?.term?._id ? `?termId=${courses.term._id}` : ""}`, { token })
      .then((data) => alive && setCourseDetails(data))
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [token, section, selectedCourse, courses?.term?._id]);

  async function downloadPdf() {
    setDownloadBusy(true);
    try {
      const { data, response } = await api(`/api/schedules/me/download${schedule?.term?._id ? `?termId=${schedule.term._id}` : ""}`, { token, responseType: "blob" });
      const disposition = response.headers.get("content-disposition") || "";
      const name = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "my-schedule.pdf";
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
    finally { setDownloadBusy(false); }
  }

  if (loading) return <Loading />;
  const titles = { "my-schedule": ["Requirement 31", "My weekly schedule"], "my-courses": ["Requirements 32–33", "Registered courses"], "schedule-swap": ["Requirement 34", "Eligible schedule groups"] };
  const [eyebrow, title] = titles[section] || titles["my-schedule"];
  const scheduleNotReleased = section === "my-schedule" && error === "No schedule is available to view yet.";
  return <div className="page-stack scheduling-page">
    <div className="page-title-row"><div><p className="eyebrow">{eyebrow} · {schedule?.term ? `${schedule.term.season} ${schedule.term.academicYear}` : courses?.term ? `${courses.term.season} ${courses.term.academicYear}` : ""}</p><h1>{title}</h1></div>
      {section === "my-schedule" && <div className="form-actions"><button type="button" className="outline-button" onClick={() => window.print()} disabled={schedule?.schedule?.status !== "processed"}>Print</button><button type="button" className="primary-button" onClick={downloadPdf} disabled={downloadBusy || schedule?.schedule?.status !== "processed"}>{downloadBusy ? "Preparing…" : "Download PDF"}</button></div>}
    </div>
    {error && <Feedback tone={scheduleNotReleased ? "info" : "error"}>{scheduleNotReleased ? "No schedule has been released for this term yet. Advising drafts appear after staff send them for student review; final schedules appear after processing." : error}</Feedback>}
    {section === "my-schedule" && schedule && <>
      <div className="stat-grid schedule-stats"><Stat label="Study group" value={schedule.schedule?.studyGroup ? `Group ${schedule.schedule.studyGroup}` : "Not assigned"} /><Stat label="Registered courses" value={schedule.schedule?.courses?.length ?? 0} /><Stat label="Credit hours" value={schedule.schedule?.totalCreditHours ?? 0} /><Stat label="Status" value={prettyStatus(schedule.schedule?.status)} /></div>
      {schedule.schedule ? <WeeklySchedule week={schedule.schedule.week} daysOff={schedule.schedule.daysOff} /> : <Empty title="No schedule yet" text="Your schedule will appear here once it has been assigned or prepared by your advisor." />}
    </>}
    {section === "my-courses" && courses && <>
      <div className="stat-grid schedule-stats"><Stat label="Courses" value={courses.courseCount} /><Stat label="Credit hours" value={courses.totalCreditHours} /><Stat label="Study group" value={courses.studyGroup ? `Group ${courses.studyGroup}` : "—"} /><Stat label="Status" value={prettyStatus(courses.status)} /></div>
      <section className="panel"><div className="results-heading"><div><p className="eyebrow">Requirement 32</p><h2>Registered courses and credit hours</h2></div></div>
        {courses.courses?.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Type</th><th>Credit hours</th><th /></tr></thead><tbody>{courses.courses.map((course) => <tr key={course.courseId}><td><strong>{course.courseCode}</strong><span className="secondary-text">{course.courseName}</span></td><td>{course.courseType || "—"}</td><td>{course.creditHours}</td><td><button className="text-button" type="button" onClick={() => setSelectedCourse(course.courseId)}>{selectedCourse === course.courseId ? "Selected" : "View lecture / tutorial / lab"}</button></td></tr>)}</tbody><tfoot><tr><th colSpan="2">Total credit hours</th><th>{courses.totalCreditHours}</th><th /></tr></tfoot></table></div> : <Empty title="No registered courses" text="Your course list appears after a schedule is available." />}
      </section>
      {courseDetails && <CourseDetailPanel details={courseDetails} />}
    </>}
    {section === "schedule-swap" && swapData && <>
      <section className="panel current-group-panel"><div><p className="eyebrow">Your current group</p><h2>Group {swapData.currentGroup?.studyGroup || "—"}</h2><p className="page-description">{swapData.currentGroup?.major} · semester {swapData.currentGroup?.semester} · {swapData.currentGroup?.totalCreditHours} credit hours</p></div><div className="swap-deadline"><small>Swap deadline</small><strong>{swapData.term?.swapDeadline ? new Date(swapData.term.swapDeadline).toLocaleDateString() : "Not set"}</strong></div></section>
      {swapData.eligibleGroups?.length ? <div className="swap-group-grid">{swapData.eligibleGroups.map((group) => <section className="panel" key={group.templateId}><div className="results-heading"><div><p className="eyebrow">Matching course set</p><h2>Group {group.studyGroup}</h2></div><span className="status-pill good">Eligible</span></div><p className="helper-text">{group.courseCodes.length} courses · {group.totalCreditHours} credit hours</p>{group.minRemainingCapacity != null && <p className="helper-text">Minimum remaining seats: {group.minRemainingCapacity}</p>}<WeeklySchedule week={group.week} daysOff={group.daysOff} compact /></section>)}</div> : <Empty title="No eligible groups" text="No other published group has exactly the same course set as your current schedule." />}
    </>}
  </div>;
}

export function StaffSchedulesPage({ token, role, notify }) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [termId, setTermId] = useState("");
  const [terms, setTerms] = useState([]);
  const [draftStudent, setDraftStudent] = useState(null);
  const scheduleResultRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api("/api/group-assignments/terms", { token }).then(({ terms: rows = [] }) => {
      if (!alive) return;
      setTerms(rows); setTermId(rows.find((term) => term.isActive)?.code || rows[0]?.code || "");
    }).catch(() => { /* Advisors can use the active term without directory access. */ });
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(); if (termId) params.set("termId", termId); if (search.trim()) params.set("search", search.trim());
    setLoading(true);
    api(`/api/schedules/students?${params}`, { token }).then((data) => alive && setStudents(data.students || []))
      .catch((err) => alive && setError(err.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, termId, search]);

  useEffect(() => {
    if (!selected || !schedule?.schedule) return;
    scheduleResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected, schedule]);

  async function openStudent(student) {
    setSelected(student); setSchedule(null); setError("");
    const query = termId ? `?termId=${encodeURIComponent(termId)}` : "";
    try { setSchedule(await api(`/api/schedules/student/${encodeURIComponent(student._id)}${query}`, { token })); }
    catch (err) { setError(err.message); }
  }

  if (draftStudent) return <AdvisingDraftEditor token={token} student={draftStudent} termId={termId} notify={notify} onBack={() => setDraftStudent(null)} onSaved={(status = "draft") => setStudents((current) => current.map((row) => row._id === draftStudent._id ? { ...row, scheduleStatus: status } : row))} />;

  return <div className="page-stack scheduling-page">
    <div className="page-title-row"><div><p className="eyebrow">Requirement 31 · Staff</p><h1>Student schedules</h1><p className="page-description">Review a student’s schedule according to your role and advising assignments.</p></div>
      {terms.length > 0 && <label className="field term-picker"><span>Academic term</span><select value={termId} onChange={(event) => { setTermId(event.target.value); setSelected(null); setSchedule(null); }}>{terms.map((term) => <option key={term._id} value={term.code}>Term {term.code} · {term.season}</option>)}</select></label>}
    </div>
    {error && <Feedback tone="error">{error}</Feedback>}
    <section className="panel"><div className="results-heading"><div><p className="eyebrow">Roster</p><h2>Students</h2></div><span className="result-count">{students.length} students</span></div>
      <label className="field roster-search"><span>Search students</span><input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Student ID, name, or email" /></label>
      {loading ? <Loading /> : students.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Type</th><th>Major / semester</th><th>Schedule status</th><th /></tr></thead><tbody>{students.map((student) => <tr key={student._id}><td><strong>{student.fullName}</strong><span className="secondary-text">{student.studentId}</span></td><td>{student.studentType}</td><td>{student.major} · {student.currentSemester}</td><td>{prettyStatus(student.scheduleStatus)}</td><td><div className="table-actions">{["advisor", "coordinator"].includes(role) && student.studentType === "advising" && (!student.scheduleStatus || student.scheduleStatus === "draft") && <button className="small-button primary-button" type="button" onClick={() => { setSelected(null); setSchedule(null); setDraftStudent(student); }}>{student.scheduleStatus === "draft" ? "Edit draft" : "Create draft"}</button>}{student.scheduleStatus && <button className="small-button outline-button" type="button" onClick={() => openStudent(student)}>View schedule</button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No students found" text="Try another search term." />}
    </section>
    {selected && schedule?.schedule && <section className="panel staff-schedule-result" ref={scheduleResultRef} tabIndex={-1} aria-label={`${schedule.student?.fullName ?? "Student"} schedule`}><div className="results-heading"><div><p className="eyebrow">{schedule.student?.studentId} · {schedule.term?.season} {schedule.term?.academicYear}</p><h2>{schedule.student?.fullName}’s schedule</h2></div><span className="status-pill">{prettyStatus(schedule.schedule.status)}</span></div>{schedule.schedule.courses?.length ? <WeeklySchedule week={schedule.schedule.week} daysOff={schedule.schedule.daysOff} /> : <Feedback tone="info">This draft is empty. Choose “Edit draft” in the student list to add course groups.</Feedback>}</section>}
  </div>;
}

function AdvisingDraftEditor({ token, student, termId, notify, onBack, onSaved }) {
  const [data, setData] = useState(null);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingForReview, setSendingForReview] = useState(false);
  const [refreshingPreferences, setRefreshingPreferences] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const editable = !data?.schedule || data.editable;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const query = termId ? `?termId=${encodeURIComponent(termId)}` : "";
    try {
      const result = await api(`/api/schedules/advising/${encodeURIComponent(student._id)}/draft${query}`, { token });
      setData(result);
      const current = {};
      for (const selected of result.schedule?.courses || []) current[selected.courseOffering] = { courseOffering: selected.courseOffering, groups: selected.groups || [] };
      setSelections(current);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, [student._id, termId, token]);

  useEffect(() => { load(); }, [load]);

  async function refreshPreferences() {
    setRefreshingPreferences(true); setError("");
    const query = termId ? `?termId=${encodeURIComponent(termId)}` : "";
    try {
      const latest = await api(`/api/schedules/advising/${encodeURIComponent(student._id)}/draft${query}`, { token });
      setData((current) => current ? { ...current, preference: latest.preference, preferenceLastUpdatedAt: latest.preferenceLastUpdatedAt, creditPolicy: latest.creditPolicy, offerings: latest.offerings, mandatoryCourses: latest.mandatoryCourses } : latest);
      setMessage("Latest preferences refreshed. Your unsaved group choices are still selected.");
    } catch (requestError) { setError(requestError.message); }
    finally { setRefreshingPreferences(false); }
  }

  const addCourse = (offering) => setSelections((current) => ({
    ...current,
    [offering._id]: { courseOffering: offering._id, groups: [] },
  }));
  const removeCourse = (offeringId) => setSelections((current) => {
    const next = { ...current }; delete next[offeringId]; return next;
  });
  const setGroup = (offeringId, componentType, groupNumber) => setSelections((current) => {
    const selected = current[offeringId] || { courseOffering: offeringId, groups: [] };
    const groups = selected.groups.filter((group) => group.componentType !== componentType);
    if (groupNumber) groups.push({ componentType, groupNumber });
    return { ...current, [offeringId]: { ...selected, groups } };
  });

  async function save(event, submitForReview = false) {
    event?.preventDefault(); setSaving(true); setSendingForReview(submitForReview); setError(""); setMessage("");
    try {
      const result = await api(`/api/schedules/advising/${encodeURIComponent(student._id)}/draft${termId ? `?termId=${encodeURIComponent(termId)}` : ""}`, {
        token,
        method: "PUT",
        body: { version: data?.schedule?.version || 0, courses: Object.values(selections), ...(submitForReview ? { submitForReview: true } : {}) },
      });
      const savedCourseCount = result.schedule?.courses?.length ?? Object.values(selections).length;
      const savedCourseMessage = submitForReview
        ? ` ${savedCourseCount} course${savedCourseCount === 1 ? "" : "s"} are ready for ${student.fullName} to review.`
        : savedCourseCount
        ? ` ${savedCourseCount} course${savedCourseCount === 1 ? "" : "s"} saved.`
        : " The draft is empty because no courses were selected.";
      const offeringsMessage = data?.offerings.length
        ? ""
        : " No published offerings are available for this student and term, so courses cannot be added yet.";
      setMessage(`${result.message || "Draft saved."}${savedCourseMessage}${offeringsMessage}`);
      await load();
      onSaved?.(result.schedule?.status || "draft");
      notify?.("success", result.message || "Draft saved.");
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); setSendingForReview(false); }
  }

  const selectedOfferings = Object.values(selections);
  const credits = selectedOfferings.reduce((total, selected) => total + Number(data?.offerings.find((offering) => offering._id === selected.courseOffering)?.course.creditHours || 0), 0);
  const creditPolicy = data?.creditPolicy;
  const approvedExtraCourses = new Map((creditPolicy?.approvedExtraCourses || []).map((item) => [item.courseId, Number(item.hours)]));
  const selectedApprovedExtraHours = selectedOfferings.reduce((total, selected) => {
    const offering = data?.offerings.find((item) => item._id === selected.courseOffering);
    const approvedHours = approvedExtraCourses.get(String(offering?.course?._id || ""));
    return total + (approvedHours == null ? 0 : Math.min(approvedHours, Number(offering?.course?.creditHours || 0)));
  }, 0);
  const standardCreditAllowance = creditPolicy?.baseAllowance ?? 34;
  const extraHoursNeeded = Math.max(0, credits - standardCreditAllowance);
  const overCreditLimit = Boolean(creditPolicy && credits > creditPolicy.maximumCreditHours + 1e-9);
  const extraHoursNotCovered = Boolean(creditPolicy && (extraHoursNeeded > creditPolicy.approvedExtraHours + 1e-9 || extraHoursNeeded > selectedApprovedExtraHours + 1e-9));
  const selectedConflict = findDraftSelectionConflict(selectedOfferings, data?.offerings || []);
  const incompleteSelection = selectedOfferings.find((selected) => {
    const offering = data?.offerings.find((item) => item._id === selected.courseOffering);
    return offering && selected.groups.length !== offering.components.length;
  });
  const missingMandatory = selectedOfferings.length ? (data?.mandatoryCourses || []).filter((course) => !course.availableForTerm || !selectedOfferings.some((selected) => data?.offerings.find((item) => item._id === selected.courseOffering)?.course._id === course._id)) : [];
  const draftWeek = buildDraftWeek(selectedOfferings, data?.offerings || []);
  const preferences = data?.preference;

  return <div className="page-stack scheduling-page">
    <div className="page-title-row"><div><p className="eyebrow">GROUP A · REQUIREMENT 58</p><h1>Advising draft schedule</h1><p className="page-description">Create or update an open draft for {student.fullName} ({student.studentId}). Preferences are ranking hints; course and timetable rules still apply.</p></div><button className="outline-button" type="button" onClick={onBack}>← Back to students</button></div>
    {error && !data && <Feedback tone="error">{error}</Feedback>}
    {loading ? <Loading /> : data && <>
      <section className="panel draft-summary"><div><p className="eyebrow">{data.term?.code} · {data.term?.season} {data.term?.academicYear}</p><h2>{data.student?.fullName} · {data.student?.major}, semester {data.student?.currentSemester}</h2><p className="helper-text">{data.schedule ? `Draft version ${data.schedule.version} · last edited ${formatDraftDate(data.schedule.updatedAt)}` : "No draft exists for this term yet. Saving creates an open draft."}</p></div><span className={`status-pill ${editable ? "good" : "muted"}`}>{data.schedule ? prettyStatus(data.schedule.status) : "No draft"}</span></section>
      {data.schedule?.staleCourseCount > 0 && <Feedback tone="warning">{data.schedule.staleCourseCount} course selection{data.schedule.staleCourseCount === 1 ? " is" : "s are"} no longer available for this student and term. Review the draft before saving; unavailable selections will be removed from the saved draft.</Feedback>}
      <section className="panel draft-preferences"><div className="results-heading"><div><p className="eyebrow">REQUIREMENT 58 · STUDENT INPUT</p><h2>Latest scheduling preferences</h2></div><div className="table-actions"><span className="result-count">{data.preferenceLastUpdatedAt ? `Updated ${formatDraftDate(data.preferenceLastUpdatedAt)}` : "No submission"}</span><button className="text-button" type="button" disabled={refreshingPreferences} onClick={refreshPreferences}>{refreshingPreferences ? "Refreshing…" : "↻ Refresh"}</button></div></div>
        {!preferences ? <Feedback tone="info">This student has not submitted preferences for this term. You can still create the draft.</Feedback> : <>
          <p className="helper-text">Priority order is shown as ranked. Hints are satisfied where feasible and never override academic rules or a timetable clash.</p>
          <div className="draft-preference-grid">
            <PreferenceSummary title="Preferred days" entries={preferences.preferredDays.map((item) => `${item.day} · #${item.priority}`)} />
            <PreferenceSummary title="Days to avoid" entries={preferences.avoidedDays.map((item) => `${item.day} · #${item.priority}`)} />
            <PreferenceSummary title="Desired days off" entries={preferences.desiredDaysOff.map((item) => `${item.day} · #${item.priority}`)} />
            <PreferenceSummary title="Preferred times" entries={preferences.preferredTimes.map((item) => `${formatDraftTime(item.startMinute)}–${formatDraftTime(item.endMinute)} · #${item.priority}`)} />
            <PreferenceSummary title="Times to avoid" entries={preferences.avoidedTimes.map((item) => `${formatDraftTime(item.startMinute)}–${formatDraftTime(item.endMinute)} · #${item.priority}`)} />
            <PreferenceSummary title="Preferred groups" entries={preferences.preferredGroups.map((item) => `${item.course?.code || "Course"} ${item.componentType} ${item.groupNumber} · #${item.priority}`)} />
          </div>
          {preferences.note && <p className="draft-student-note"><strong>Student note:</strong> {preferences.note}</p>}
        </>}
      </section>
      {data.mandatoryCourses.length > 0 && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">ACADEMIC RECORD</p><h2>Failed or unattended courses</h2></div></div><p className="helper-text">These courses are marked mandatory unless a removal was approved for this term. Include the available offerings in the draft when required.</p><div className="draft-mandatory-list">{data.mandatoryCourses.map((course) => <span className={`status-pill ${course.availableForTerm ? "warning" : "muted"}`} key={course._id}>{course.code}{course.availableForTerm ? " · mandatory" : " · no eligible published offering"}</span>)}</div></section>}
      {!editable && data.schedule?.status === "readyForStudentReview" && <Feedback tone="success">This schedule is now visible to the advising student for review.</Feedback>}
      <section className="panel draft-timetable"><div className="panel-heading"><div><p className="eyebrow">LIVE PREVIEW</p><h2>Selected timetable</h2></div><span className="result-count">{selectedOfferings.length} subjects</span></div>{selectedOfferings.length ? <WeeklySchedule week={draftWeek} compact /> : <p className="helper-text">Add course groups below to preview their days and times here.</p>}</section>
      <form className="panel draft-course-editor" onSubmit={save}>
        <div className="results-heading"><div><p className="eyebrow">DRAFT CONTENT</p><h2>Published course offerings</h2></div><span className="result-count">{selectedOfferings.length} selected · {credits} / {creditPolicy?.maximumCreditHours ?? "—"} credit hours</span></div>
        <p className="helper-text">Choose a course, then one group for each component. Meeting times and available seats appear beside each option. Drafts do not reserve seats.</p>
        {creditPolicy && <p className="helper-text">{creditPolicy.policyConfigured ? `${creditPolicy.probation ? "Probation" : "Standard"} allowance: ${creditPolicy.baseAllowance} hours · activated extra hours: ${creditPolicy.approvedExtraHours} · maximum: ${creditPolicy.maximumCreditHours}.` : `The requirements do not define a semester ${creditPolicy.semester} standard allowance; the explicit 34-hour overall ceiling is applied until that baseline is clarified.`}</p>}
        {!editable && <Feedback tone="warning">This schedule has moved beyond draft status and is read-only.</Feedback>}
        {selectedConflict && <Feedback tone="error">{selectedConflict}</Feedback>}
        {!selectedConflict && incompleteSelection && <Feedback tone="warning">Choose one group for every component in each selected course before saving.</Feedback>}
        {missingMandatory.length > 0 && <Feedback tone="warning">Before saving a non-empty draft, include required courses: {missingMandatory.map((course) => course.code).join(", ")}.</Feedback>}
        {overCreditLimit && <Feedback tone="error">This draft exceeds the student's maximum of {creditPolicy.maximumCreditHours} credit hours.</Feedback>}
        {!overCreditLimit && extraHoursNotCovered && <Feedback tone="warning">The draft goes beyond the standard allowance. Add an extra-hours course that has an approved request and is already paid or deferred; approval alone does not activate it.</Feedback>}
        {!data.offerings.length ? <Empty title="No published offerings" text="There are no active published course offerings for this student's major and semester." /> : <div className="draft-course-list">{data.offerings.map((offering) => {
          const selected = selections[offering._id];
          return <article className={`draft-course ${selected ? "selected" : ""}`} key={offering._id}>
            <div className="draft-course-heading"><div><strong>{offering.course.code} · {offering.course.name}</strong><span className="secondary-text">{offering.course.creditHours} credits · {offering.course.courseType}{approvedExtraCourses.has(String(offering.course._id)) ? " · approved extra-hours course (paid/deferred)" : ""}</span></div>{selected ? <button className="text-button" type="button" disabled={!editable} onClick={() => removeCourse(offering._id)}>Remove</button> : <button className="outline-button small-button" type="button" disabled={!editable} onClick={() => addCourse(offering)}>Add course</button>}</div>
            {selected && <div className="draft-component-grid">{offering.components.map((componentType) => {
              const picked = selected.groups.find((group) => group.componentType === componentType)?.groupNumber || "";
              const options = offering.groups.filter((group) => group.componentType === componentType);
              return <label className="field" key={componentType}><span>{componentType[0].toUpperCase() + componentType.slice(1)} group</span><select value={picked} disabled={!editable} onChange={(event) => setGroup(offering._id, componentType, event.target.value)}><option value="">Choose a group</option>{options.map((group) => { const preferred = group.preferredPriorities[0]; const issue = !group.valid ? " · invalid timetable" : ""; const optionText = `${group.groupNumber}${preferred ? ` · Preferred #${preferred}` : ""} · ${group.availableSeats} seats left${issue} · ${group.slots.map((slot) => `${slot.day} ${slot.startTime}–${slot.endTime}, ${slot.room}`).join(" / ")}`; return <option key={group.groupNumber} value={group.groupNumber} disabled={!group.valid || (!group.availableSeats && group.groupNumber !== picked)}>{optionText}</option>; })}</select></label>;
            })}</div>}
          </article>;
        })}</div>}
        {error && <Feedback tone="error">{error}</Feedback>}
        {message && <Feedback tone="success">{message}</Feedback>}
        <div className="form-footer"><span className="helper-text">Saving keeps the schedule in draft. The server rechecks academic rules, capacity, and clashes.</span><button className="primary-button" type="submit" disabled={saving || !editable || Boolean(selectedConflict) || Boolean(incompleteSelection) || missingMandatory.length > 0 || overCreditLimit || extraHoursNotCovered}>{saving && !sendingForReview ? "Saving draft…" : data.schedule ? "Update draft" : "Create draft"}<span>→</span></button></div>
        {editable && selectedOfferings.length > 0 && <div className="form-footer"><span className="helper-text">When the schedule is ready, save it and make it visible to the student for review.</span><button className="outline-button" type="button" onClick={(event) => save(event, true)} disabled={saving || Boolean(selectedConflict) || Boolean(incompleteSelection) || missingMandatory.length > 0 || overCreditLimit || extraHoursNotCovered}>{sendingForReview ? "Sending for review…" : "Save and send for student review"}<span>→</span></button></div>}
      </form>
    </>}
  </div>;
}

function PreferenceSummary({ title, entries }) {
  return <div className="draft-preference-item"><strong>{title}</strong><span>{entries.length ? entries.join(", ") : "No preference"}</span></div>;
}

function formatDraftTime(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
function formatDraftDate(value) { return value ? new Date(value).toLocaleString() : "—"; }

function buildDraftWeek(selections, offerings) {
  const week = Object.fromEntries(WEEK.map((day) => [day, []]));
  for (const selected of selections) {
    const offering = offerings.find((item) => item._id === selected.courseOffering);
    if (!offering) continue;
    for (const choice of selected.groups) {
      const group = offering.groups.find((item) => item.componentType === choice.componentType && item.groupNumber === choice.groupNumber);
      for (const slot of group?.slots || []) week[slot.day]?.push({ courseCode: offering.course.code, type: choice.componentType, groupNumber: choice.groupNumber, startTime: slot.startTime, endTime: slot.endTime, room: slot.room });
    }
  }
  for (const day of WEEK) week[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return week;
}

function findDraftSelectionConflict(selections, offerings) {
  const slots = [];
  for (const selected of selections) {
    const offering = offerings.find((item) => item._id === selected.courseOffering);
    if (!offering) continue;
    for (const choice of selected.groups) {
      const group = offering.groups.find((item) => item.componentType === choice.componentType && item.groupNumber === choice.groupNumber);
      for (const slot of group?.slots || []) slots.push({ ...slot, courseCode: offering.course.code, componentType: choice.componentType, groupNumber: choice.groupNumber });
    }
  }
  for (let firstIndex = 0; firstIndex < slots.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < slots.length; secondIndex += 1) {
      const first = slots[firstIndex]; const second = slots[secondIndex];
      if (first.day !== second.day) continue;
      const firstStart = draftMinutes(first.startTime); const firstEnd = draftMinutes(first.endTime);
      const secondStart = draftMinutes(second.startTime); const secondEnd = draftMinutes(second.endTime);
      if (firstStart < secondEnd && secondStart < firstEnd) return `Timetable clash: ${first.courseCode} ${first.componentType} ${first.groupNumber} (${first.day} ${first.startTime}–${first.endTime}) overlaps ${second.courseCode} ${second.componentType} ${second.groupNumber} (${second.startTime}–${second.endTime}). Choose a different group.`;
    }
  }
  return "";
}

function draftMinutes(value) { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }

function CourseDetailPanel({ details }) {
  const labels = [["lecture", "Lecture"], ["tutorial", "Tutorial"], ["lab", "Lab"]];
  return <section className="panel"><div className="results-heading"><div><p className="eyebrow">Requirement 33</p><h2>{details.course.courseCode} · {details.course.courseName}</h2></div><span className="status-pill">{details.course.courseType || "Course"}</span></div>
    <p className="helper-text">Instructor{details.instructors?.length === 1 ? "" : "s"}: {details.instructors?.map((person) => person.fullName).filter(Boolean).join(", ") || "Not listed"}</p>
    <div className="component-grid">{labels.map(([key, label]) => { const slot = details.components?.[key]; return <div className="component-card" key={key}><small>{label}</small><strong>{slot ? `Group ${slot.groupNumber}` : "Not scheduled"}</strong><span>{slot ? `${slot.day}, ${slot.startTime}–${slot.endTime} · ${slot.room}` : "This course has no assigned component."}</span></div>; })}</div>
    {details.sessions?.length > 3 && <p className="helper-text">This course has {details.sessions.length} scheduled sessions across its components.</p>}
  </section>;
}

function WeeklySchedule({ week = {}, daysOff = [], compact = false }) {
  return <div className={`weekly-schedule ${compact ? "compact" : ""}`}>
    {WEEK.map((day) => <section className={`schedule-day ${daysOff.includes(day) ? "day-off" : ""}`} key={day}><h3>{day}{daysOff.includes(day) && <small>Off</small>}</h3>
      {(week[day] || []).length ? week[day].map((slot, index) => <article className={`schedule-slot ${slot.type || ""}`} key={`${slot.courseCode}-${slot.startTime}-${index}`}><strong>{slot.courseCode}</strong><span>{slot.type} · {slot.startTime}–{slot.endTime}</span><small>{slot.room} · Group {slot.groupNumber}</small></article>) : <p className="empty-day">No classes</p>}
    </section>)}
  </div>;
}

function Stat({ label, value }) { return <div className="stat-card"><span className="stat-icon">◷</span><div><p>{label}</p><strong>{value}</strong></div></div>; }
function Feedback({ tone = "info", children }) { return <div className={`feedback ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>; }
function Empty({ title, text }) { return <div className="empty-state"><span>▤</span><h3>{title}</h3><p>{text}</p></div>; }
function Loading() { return <div className="loading-state"><span className="loader" />Loading…</div>; }
function prettyStatus(status) { return ({ processed: "Processed", readyForStudentReview: "Ready for student review", draft: "Draft" })[status] || "No schedule"; }
