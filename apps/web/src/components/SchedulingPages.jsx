import { useCallback, useEffect, useMemo, useState } from "react";
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
        setTermId(rows.find((item) => item.isActive)?._id || rows[0]?._id || "");
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
      <label className="field term-picker"><span>Academic term</span><select value={termId} onChange={(event) => setTermId(event.target.value)} disabled={loading || !terms.length}>{terms.map((term) => <option key={term._id} value={term._id}>{term.season} {term.academicYear}{term.isActive ? " · Active" : ""}</option>)}</select></label>
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
  return <div className="page-stack scheduling-page">
    <div className="page-title-row"><div><p className="eyebrow">{eyebrow} · {schedule?.term ? `${schedule.term.season} ${schedule.term.academicYear}` : courses?.term ? `${courses.term.season} ${courses.term.academicYear}` : ""}</p><h1>{title}</h1></div>
      {section === "my-schedule" && <div className="form-actions"><button type="button" className="outline-button" onClick={() => window.print()} disabled={schedule?.schedule?.status !== "processed"}>Print</button><button type="button" className="primary-button" onClick={downloadPdf} disabled={downloadBusy || schedule?.schedule?.status !== "processed"}>{downloadBusy ? "Preparing…" : "Download PDF"}</button></div>}
    </div>
    {error && <Feedback tone="error">{error}</Feedback>}
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

export function StaffSchedulesPage({ token, notify }) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [termId, setTermId] = useState("");
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    let alive = true;
    api("/api/group-assignments/terms", { token }).then(({ terms: rows = [] }) => {
      if (!alive) return;
      setTerms(rows); setTermId(rows.find((term) => term.isActive)?._id || rows[0]?._id || "");
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

  async function openStudent(student) {
    setSelected(student); setSchedule(null); setError("");
    const query = termId ? `?termId=${encodeURIComponent(termId)}` : "";
    try { setSchedule(await api(`/api/schedules/student/${encodeURIComponent(student._id)}${query}`, { token })); }
    catch (err) { setError(err.message); }
  }

  return <div className="page-stack scheduling-page">
    <div className="page-title-row"><div><p className="eyebrow">Requirement 31 · Staff</p><h1>Student schedules</h1><p className="page-description">Review a student’s schedule according to your role and advising assignments.</p></div>
      {terms.length > 0 && <label className="field term-picker"><span>Academic term</span><select value={termId} onChange={(event) => { setTermId(event.target.value); setSelected(null); setSchedule(null); }}>{terms.map((term) => <option key={term._id} value={term._id}>{term.season} {term.academicYear}</option>)}</select></label>}
    </div>
    {error && <Feedback tone="error">{error}</Feedback>}
    <section className="panel"><div className="results-heading"><div><p className="eyebrow">Roster</p><h2>Students</h2></div><span className="result-count">{students.length} students</span></div>
      <label className="field roster-search"><span>Search students</span><input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Student ID, name, or email" /></label>
      {loading ? <Loading /> : students.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Type</th><th>Major / semester</th><th>Schedule status</th><th /></tr></thead><tbody>{students.map((student) => <tr key={student._id}><td><strong>{student.fullName}</strong><span className="secondary-text">{student.studentId}</span></td><td>{student.studentType}</td><td>{student.major} · {student.currentSemester}</td><td>{prettyStatus(student.scheduleStatus)}</td><td><button className="small-button outline-button" type="button" onClick={() => openStudent(student)}>View schedule</button></td></tr>)}</tbody></table></div> : <Empty title="No students found" text="Try another search term." />}
    </section>
    {selected && schedule?.schedule && <section className="panel staff-schedule-result"><div className="results-heading"><div><p className="eyebrow">{schedule.student?.studentId} · {schedule.term?.season} {schedule.term?.academicYear}</p><h2>{schedule.student?.fullName}’s schedule</h2></div><span className="status-pill">{prettyStatus(schedule.schedule.status)}</span></div><WeeklySchedule week={schedule.schedule.week} daysOff={schedule.schedule.daysOff} /></section>}
  </div>;
}

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
function prettyStatus(status) { return ({ processed: "Processed", readyForStudentReview: "Ready for review", draft: "Draft" })[status] || "No schedule"; }
