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
  const [unassignTarget, setUnassignTarget] = useState(null);
  const [unassignError, setUnassignError] = useState("");
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

  async function unassign() {
    if (!unassignTarget) return;
    setBusy(true);
    setUnassignError("");
    try {
      const result = await api(`/api/group-assignments/${encodeURIComponent(unassignTarget._id)}?termId=${encodeURIComponent(termId)}`, { token, method: "DELETE" });
      notify("success", result.message);
      setUnassignTarget(null);
      await load();
    } catch (err) { setUnassignError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="page-stack scheduling-page">
    <div className="page-title-row"><div><p className="eyebrow">COORDINATOR</p><h1>Schedule group assignments</h1><p className="page-description">Assign or move active normal students to a published group for their major and semester.</p></div>
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
        <td>{canAssign ? <div className="table-actions"><button className="small-button primary-button" type="button" disabled={busy || !student.isActive} onClick={() => { setTarget(student); setPickedGroup(student.assignment?.studyGroup || ""); }}>{student.assignment ? "Reassign" : "Assign"}</button>{student.assignment && <button className="small-button outline-button danger-button" type="button" disabled={busy} onClick={() => { setUnassignError(""); setUnassignTarget(student); }}>Unassign</button>}</div> : <span className="helper-text">Read only</span>}</td>
      </tr>)}</tbody></table></div> : <Empty title="No students match" text="Adjust the search or filters and try again." />}
    </section>
    {unassignTarget && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setUnassignTarget(null)}><section className="modal-card narrow-modal" role="dialog" aria-modal="true" aria-labelledby="unassign-heading">
      <div className="modal-heading"><div><p className="eyebrow">REMOVE GROUP ASSIGNMENT</p><h2 id="unassign-heading">Unassign this student?</h2></div><button className="icon-button" type="button" aria-label="Close" disabled={busy} onClick={() => setUnassignTarget(null)}>×</button></div>
      <div className="confirmation-content"><span className="confirmation-icon" aria-hidden="true">!</span><div><p>Remove <strong>{unassignTarget.fullName}</strong> from <strong>Group {unassignTarget.assignment.studyGroup}</strong>?</p><p className="helper-text">{unassignTarget.studentId} · {unassignTarget.major} · Semester {unassignTarget.currentSemester}</p><p className="helper-text">The student will become unassigned for this academic term.</p></div></div>
      {unassignError && <Feedback tone="error">{unassignError}</Feedback>}
      <div className="form-footer"><button type="button" className="outline-button" disabled={busy} onClick={() => setUnassignTarget(null)}>Cancel</button><button type="button" className="primary-button destructive-action" disabled={busy} onClick={unassign}>{busy ? "Removing…" : "Unassign student"}</button></div>
    </section></div>}
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
  const titles = { "my-schedule": ["MY SCHEDULE", "My weekly schedule"], "my-courses": ["REGISTERED COURSES", "Registered courses"], "schedule-swap": ["SCHEDULE GROUPS", "Eligible schedule groups"] };
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
      <section className="panel"><div className="results-heading"><div><p className="eyebrow">COURSE LOAD</p><h2>Registered courses and credit hours</h2></div></div>
        {courses.courses?.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Type</th><th>Credit hours</th><th /></tr></thead><tbody>{courses.courses.map((course) => <tr key={course.courseId}><td><strong>{course.courseCode}</strong><span className="secondary-text">{course.courseName}</span></td><td>{course.courseType || "—"}</td><td>{course.creditHours}</td><td><button className="text-button" type="button" onClick={() => setSelectedCourse(course.courseId)}>{selectedCourse === course.courseId ? "Selected" : "View lecture / tutorial / lab"}</button></td></tr>)}</tbody><tfoot><tr><th colSpan="2">Total credit hours</th><th>{courses.totalCreditHours}</th><th /></tr></tfoot></table></div> : <Empty title="No registered courses" text="Your course list appears after a schedule is available." />}
      </section>
      {courseDetails && <CourseDetailPanel details={courseDetails} />}
    </>}
    {section === "schedule-swap" && swapData && <SwapManagement token={token} data={swapData} onChanged={async () => setSwapData(await api("/api/swaps/eligible-groups", { token }))} />}
  </div>;
}

function SwapManagement({ token, data, onChanged }) {
  const [mine, setMine] = useState([]);
  const [open, setOpen] = useState([]);
  const [selected, setSelected] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const deadlinePassed = !data.term?.swapDeadline || new Date(data.term.swapDeadline).getTime() <= Date.now();
  const active = mine.find(request => request.status === "open");

  const refresh = useCallback(async () => {
    const [myData, openData] = await Promise.all([
      api("/api/swaps/requests/me", { token }),
      api("/api/swaps/requests/open", { token }),
    ]);
    setMine(myData.requests || []);
    setOpen(openData.requests || []);
  }, [token]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    refresh().catch(err => alive && setError(err.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [refresh]);

  async function perform(path, body) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api(path, { token, method: "POST", body });
      setNotice(result.message);
      setSelected([]);
      setConfirm(null);
      await Promise.all([refresh(), onChanged()]);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function toggle(group) {
    setSelected(previous => previous.includes(group) ? previous.filter(item => item !== group) : [...previous, group]);
  }

  return <>
    {error && <Feedback tone="error">{error}</Feedback>}
    {notice && <Feedback tone="success">{notice}</Feedback>}
    <section className="panel current-group-panel"><div><p className="eyebrow">Your current group</p><h2>Group {data.currentGroup?.studyGroup || "—"}</h2><p className="page-description">{data.currentGroup?.major} · semester {data.currentGroup?.semester} · {data.currentGroup?.totalCreditHours} credit hours</p></div><div className="swap-deadline"><small>Swap deadline</small><strong>{data.term?.swapDeadline ? new Date(data.term.swapDeadline).toLocaleDateString() : "Not set"}</strong></div></section>
    <section className="panel"><div className="results-heading"><div><p className="eyebrow">Destination groups</p><h2>Request a whole schedule swap</h2></div></div>
      <p className="page-description">Select one or more groups with exactly your registered courses. A student in a selected group can complete the exchange.</p>
      {active && <Feedback tone="info">Your request is open for Group {active.desiredGroups.join(", Group ")}. Withdraw it before making a different request.</Feedback>}
      {data.eligibleGroups?.length ? <div className="swap-group-grid">{data.eligibleGroups.map(group => <section className="swap-option" key={group.templateId}>
        <label className="swap-option-heading"><input type="checkbox" checked={selected.includes(group.studyGroup)} disabled={busy || Boolean(active) || deadlinePassed} onChange={() => toggle(group.studyGroup)} /><span><strong>Group {group.studyGroup}</strong><small>{group.courseCodes.length} courses · {group.totalCreditHours} credit hours · {group.minRemainingCapacity ?? 0} seats available</small></span></label>
        <WeeklySchedule week={group.week} daysOff={group.daysOff} compact />
      </section>)}</div> : <Empty title="No eligible groups" text="The other published groups must contain exactly the same registered courses as your current schedule." />}
      {deadlinePassed && <Feedback tone="warning">The swap deadline has passed.</Feedback>}
      <div className="form-footer"><button className="primary-button" type="button" disabled={busy || Boolean(active) || deadlinePassed || !selected.length} onClick={() => perform("/api/swaps/requests", { desiredGroups: selected })}>{busy ? "Submitting…" : "Submit swap request"}</button></div>
    </section>
    <section className="panel"><div className="results-heading"><div><p className="eyebrow">Student requests</p><h2>Open requests from other groups</h2></div></div>
      {loading ? <Loading /> : open.length ? <div className="swap-group-grid">{open.map(request => <section className="swap-option" key={request._id}><div className="results-heading"><div><p className="eyebrow">Anonymous student</p><h3>Group {request.currentGroup}</h3></div><span className="status-pill good">Open</span></div><p className="helper-text">Their complete weekly schedule</p><WeeklySchedule week={request.week} daysOff={request.daysOff} compact /><div className="form-footer"><button className="primary-button" type="button" disabled={busy || deadlinePassed} onClick={() => setConfirm(request)}>Exchange schedules</button></div></section>)}</div> : <Empty title="No open swap requests" text="Requests from students whose course set matches yours will appear here." />}
    </section>
    <section className="panel"><div className="results-heading"><div><p className="eyebrow">Your activity</p><h2>My swap requests</h2></div></div>
      {loading ? <Loading /> : mine.length ? <div className="table-scroll"><table><thead><tr><th>From</th><th>Requested groups</th><th>Submitted</th><th>Status</th><th /></tr></thead><tbody>{mine.map(request => <tr key={request._id}><td>Group {request.currentGroup}</td><td>{request.desiredGroups.map(group => `Group ${group}`).join(", ")}</td><td>{new Date(request.createdAt).toLocaleString()}</td><td>{request.status}</td><td>{request.status === "open" && <button className="outline-button small-button" type="button" disabled={busy} onClick={() => perform(`/api/swaps/requests/${request._id}/withdraw`)}>Withdraw</button>}</td></tr>)}</tbody></table></div> : <Empty title="No requests yet" text="Your swap requests and their status will appear here." />}
    </section>
    {confirm && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && setConfirm(null)}><section className="modal-card narrow-modal" role="dialog" aria-modal="true" aria-labelledby="swap-confirm-heading"><div className="modal-heading"><div><p className="eyebrow">WHOLE SCHEDULE SWAP</p><h2 id="swap-confirm-heading">Exchange schedules?</h2></div><button className="icon-button" type="button" aria-label="Close" disabled={busy} onClick={() => setConfirm(null)}>×</button></div><p className="page-description">Your Group {data.currentGroup?.studyGroup} schedule will be exchanged with the anonymous student in Group {confirm.currentGroup}. All course meeting times will change to that group’s schedule.</p><div className="form-footer"><button className="outline-button" type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button><button className="primary-button" type="button" disabled={busy} onClick={() => perform(`/api/swaps/requests/${confirm._id}/complete`)}>{busy ? "Exchanging…" : "Confirm exchange"}</button></div></section></div>}
  </>;
}

export function StaffSchedulesPage({ token, role, notify, initialStudent = null, initialTermId = "" }) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [termId, setTermId] = useState(initialTermId);
  const [terms, setTerms] = useState([]);
  const [draftStudent, setDraftStudent] = useState(initialStudent);
  const scheduleResultRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api("/api/group-assignments/terms", { token }).then(({ terms: rows = [] }) => {
      if (!alive) return;
      setTerms(rows); setTermId((current) => current || rows.find((term) => term.isActive)?.code || rows[0]?.code || "");
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
    <div className="page-title-row"><div><p className="eyebrow">STUDENT SCHEDULES</p><h1>Student schedules</h1><p className="page-description">Review a student’s schedule according to your role and advising assignments.</p></div>
      {terms.length > 0 && <label className="field term-picker"><span>Academic term</span><select value={termId} onChange={(event) => { setTermId(event.target.value); setSelected(null); setSchedule(null); }}>{terms.map((term) => <option key={term._id} value={term.code}>Term {term.code} · {term.season}</option>)}</select></label>}
    </div>
    {error && <Feedback tone="error">{error}</Feedback>}
    <section className="panel"><div className="results-heading"><div><p className="eyebrow">Roster</p><h2>Students</h2></div><span className="result-count">{students.length} students</span></div>
      <label className="field roster-search"><span>Search students</span><input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Student ID, name, or email" /></label>
      {loading ? <Loading /> : students.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Type</th><th>Major / semester</th><th>Schedule status</th><th /></tr></thead><tbody>{students.map((student) => <tr key={student._id}><td><strong>{student.fullName}</strong><span className="secondary-text">{student.studentId}</span></td><td>{student.studentType}</td><td>{student.major} · {student.currentSemester}</td><td><span className={`status-pill ${{
        readyForStudentReview: "ready", draft: "draft", processed: "completed",
      }[student.scheduleStatus] || "muted"}`}>{prettyStatus(student.scheduleStatus)}</span></td><td><div className="table-actions">{["advisor", "coordinator"].includes(role) && student.studentType === "advising" && <button className="small-button primary-button" type="button" onClick={() => { setSelected(null); setSchedule(null); setDraftStudent(student); }}>{student.scheduleStatus === "draft" ? "Edit draft" : !student.scheduleStatus ? "Create draft" : student.scheduleStatus === "readyForStudentReview" ? "Review & Process" : "Manage schedule"}</button>}{student.scheduleStatus && <button className="small-button outline-button" type="button" onClick={() => openStudent(student)}>View schedule</button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No students found" text="Try another search term." />}
    </section>
    {selected && schedule?.schedule && <section className="panel staff-schedule-result" ref={scheduleResultRef} tabIndex={-1} aria-label={`${schedule.student?.fullName ?? "Student"} schedule`}><div className="results-heading"><div><p className="eyebrow">{schedule.student?.studentId} · {schedule.term?.season} {schedule.term?.academicYear}</p><h2>{schedule.student?.fullName}’s schedule</h2></div><span className="status-pill">{prettyStatus(schedule.schedule.status)}</span></div>{schedule.schedule.courses?.length ? <WeeklySchedule week={schedule.schedule.week} daysOff={schedule.schedule.daysOff} /> : <Feedback tone="info">This draft is empty. Choose “Edit draft” in the student list to add course groups.</Feedback>}</section>}
  </div>;
}

function AdvisingDraftEditor({ token, student, termId, notify, onBack, onSaved }) {
  const [data, setData] = useState(null);
  const [selections, setSelections] = useState({});
  const [validationIssues, setValidationIssues] = useState(null);
  const [overview, setOverview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingMandatory, setSavingMandatory] = useState(false);
  const [validating, setValidating] = useState(false);
  const validationHeading = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingForReview, setSendingForReview] = useState(false);
  const [refreshingPreferences, setRefreshingPreferences] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState("");
  const editable = !data?.schedule || data.editable;
  const draftPath = `/api/schedules/advising/${encodeURIComponent(student._id)}/draft`;
  const termQuery = termId ? `?termId=${encodeURIComponent(termId)}` : "";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const query = termId ? `?termId=${encodeURIComponent(termId)}` : "";
    try {
      const result = await api(`/api/schedules/advising/${encodeURIComponent(student._id)}/draft${query}`, { token });
      setData(result);
      setValidationIssues(result.validationIssues);
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

  const editSelections = (update) => {
    setValidationIssues(null);
    setMessage("");
    setError("");
    setSelections(update);
  };
  const addCourse = (offering) => editSelections((current) => ({
    ...current,
    [offering._id]: { courseOffering: offering._id, groups: [] },
  }));
  const removeCourse = (offeringId) => editSelections((current) => {
    const next = { ...current }; delete next[offeringId]; return next;
  });
  const setGroup = (offeringId, componentType, groupNumber) => editSelections((current) => {
    const selected = current[offeringId] || { courseOffering: offeringId, groups: [] };
    const groups = selected.groups.filter((group) => group.componentType !== componentType);
    if (groupNumber) groups.push({ componentType, groupNumber });
    return { ...current, [offeringId]: { ...selected, groups } };
  });

  async function checkValidation() {
    setValidating(true);
    setError("");
    try {
      const result = await api(`${draftPath}/validate${termQuery}`, {
        token, method: "POST", body: { courses: Object.values(selections) },
      });
      setValidationIssues(result.validationIssues);
      validationHeading.current?.focus();
    } catch (failure) { setError(failure.message); }
    finally { setValidating(false); }
  }

  useEffect(() => {
    let alive = true;
    setOverview(null);
    api(`/api/schedules/advising/${encodeURIComponent(student._id)}/overview${termQuery}`, { token })
      .then((result) => alive && setOverview(result)).catch(() => alive && setOverview(null));
    return () => { alive = false; };
  }, [student._id, termQuery, token, data?.schedule?.updatedAt]);

  async function saveMandatory(courseIds) {
    setSavingMandatory(true); setError(""); setMessage("");
    try {
      const result = await api(`/api/schedules/advising/${encodeURIComponent(student._id)}/mandatory-courses${termQuery}`, { token, method: "PUT", body: { courses: courseIds } });
      notify?.("success", result.message);
      onSaved?.("draft");
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setSavingMandatory(false); }
  }

  async function createDraft() {
    setCreating(true); setError(""); setMessage("");
    try {
      const result = await api(`${draftPath}${termQuery}`, { token, method: "POST" });
      notify?.("success", result.message);
      onSaved?.("draft");
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { setCreating(false); }
  }

  async function save(event, submitForReview = false) {
    event?.preventDefault(); setSaving(true); setSendingForReview(submitForReview); setError(""); setMessage("");
    try {
      const result = await api(`${draftPath}${termQuery}`, {
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
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.data?.validationIssues) setValidationIssues(requestError.data.validationIssues);
    }
    finally { setSaving(false); setSendingForReview(false); }
  }

  async function processSchedule() {
    setProcessing(true);
    setError("");
    setMessage("");
    try {
      const activeTermId = termId || data?.term?._id || data?.term?.code;
      const result = await api(`/api/schedules/advising/${encodeURIComponent(student._id)}/process`, {
        token,
        method: "POST",
        body: { termId: activeTermId },
      });
      setMessage(result.message || "Advising schedule processed.");
      notify?.("success", result.message || "Advising schedule processed.");
      await load();
      onSaved?.("processed");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessing(false);
    }
  }

  async function reopenSchedule(event) {
    event?.preventDefault();
    if (!reopenReason.trim()) {
      setReopenError("A reason is required to reopen this schedule.");
      return;
    }
    setReopening(true);
    setReopenError("");
    setError("");
    setMessage("");
    try {
      const activeTermId = termId || data?.term?._id || data?.term?.code;
      const result = await api(`/api/schedules/advising/${encodeURIComponent(student._id)}/reopen`, {
        token,
        method: "POST",
        body: { termId: activeTermId, reason: reopenReason.trim() },
      });
      setMessage(result.message || "Advising schedule reopened.");
      notify?.("success", result.message || "Advising schedule reopened.");
      setReopenModalOpen(false);
      setReopenReason("");
      await load();
      onSaved?.("draft");
    } catch (requestError) {
      setReopenError(requestError.message);
    } finally {
      setReopening(false);
    }
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
  const selectedCourseIds = new Set(data?.offerings.filter((offering) => selections[offering._id]).map((offering) => offering.course._id));
  const missingMandatory = (data?.mandatoryCourses || []).filter((course) => !selectedCourseIds.has(course._id));
  const busy = saving || validating;
  const draftWeek = buildDraftWeek(selectedOfferings, data?.offerings || []);
  const preferences = data?.preference;

  return <div className="page-stack scheduling-page advising-draft-page">
    <div className="page-title-row"><div><p className="eyebrow">STUDENT SCHEDULES</p><h1>Advising draft schedule</h1><p className="page-description">{student.fullName} · {student.studentId}</p></div><button className="outline-button" type="button" onClick={onBack}>← Back to students</button></div>
    {error && !data && <Feedback tone="error">{error}</Feedback>}
    {loading ? <Loading /> : data && <>
      <section className="panel draft-summary"><div><p className="eyebrow">{data.term?.code} · {data.term?.season} {data.term?.academicYear}</p><h2>{data.student?.fullName} · {data.student?.major}, semester {data.student?.currentSemester}</h2><p className="helper-text">{data.schedule ? `Draft version ${data.schedule.version} · last edited ${formatDraftDate(data.schedule.updatedAt)}` : "No draft exists for this term yet. Saving creates an open draft."}</p></div><span className={`status-pill ${editable ? "good" : "muted"}`}>{data.schedule ? prettyStatus(data.schedule.status) : "No draft"}</span>{!data.schedule && <button className="primary-button" type="button" onClick={createDraft} disabled={creating}>{creating ? "Creating…" : "Create open draft"}</button>}</section>
      {overview && <AdvisingOverviewPanel overview={overview} token={token} student={student} termQuery={termQuery} canEdit={editable} notify={notify} onChanged={load} />}
      <nav className="draft-section-nav" aria-label="Draft sections">
        <a href="#draft-preferences">Preferences</a>
        <a href="#draft-timetable">Timetable</a>
        <a href="#draft-courses">Course selection</a>
        <a href="#draft-validation">Validation</a>
      </nav>
      {data.schedule?.staleCourseCount > 0 && <Feedback tone="warning">{data.schedule.staleCourseCount} course selection{data.schedule.staleCourseCount === 1 ? " is" : "s are"} no longer available for this student and term. Review the draft before saving; unavailable selections will be removed from the saved draft.</Feedback>}
      <section className="panel draft-preferences" id="draft-preferences"><div className="results-heading"><div><p className="eyebrow">STUDENT INPUT</p><h2>Latest scheduling preferences</h2></div><div className="table-actions"><span className="result-count">{data.preferenceLastUpdatedAt ? `Updated ${formatDraftDate(data.preferenceLastUpdatedAt)}` : "No submission"}</span><button className="text-button" type="button" disabled={refreshingPreferences} onClick={refreshPreferences}>{refreshingPreferences ? "Refreshing…" : "↻ Refresh"}</button></div></div>
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
      {data.mandatoryCourses.length > 0 && <MandatoryCoursesPanel data={data} editable={editable} busy={savingMandatory} onSave={saveMandatory} />}
      {!editable && data.schedule?.status === "readyForStudentReview" && (
        <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--success-bg)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "8px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "var(--green-dark)" }}>Ready for Student Review</h3>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
              This schedule is now visible to {student.fullName} for review. You can process and finalize the schedule when review is complete.
            </p>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={processing}
            onClick={processSchedule}
          >
            {processing ? "Processing schedule…" : "Process Schedule"}
          </button>
        </section>
      )}
      {!editable && data.schedule?.status === "processed" && (
        <section className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--draft-bg)", border: "1px solid var(--line)", padding: "16px 20px", borderRadius: "8px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "var(--draft-ink)" }}>Schedule Processed</h3>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
              This schedule is processed and finalized. Reopening reverts the schedule to draft status for adjustments.
            </p>
          </div>
          <button
            className="primary-button destructive-action"
            type="button"
            onClick={() => {
              setReopenReason("");
              setReopenError("");
              setReopenModalOpen(true);
            }}
          >
            Reopen Schedule
          </button>
        </section>
      )}
      <section className="panel draft-timetable" id="draft-timetable"><div className="panel-heading"><div><p className="eyebrow">LIVE PREVIEW</p><h2>Selected timetable</h2></div><span className="result-count">{selectedOfferings.length} subjects</span></div>{selectedOfferings.length ? <WeeklySchedule week={draftWeek} compact /> : <p className="helper-text">Add course groups below to preview their days and times here.</p>}</section>
      <EligibleCoursesPanel token={token} student={student} termQuery={termQuery} editable={editable} notify={notify} version={data.schedule?.version ?? 0} onChanged={async (status) => { onSaved?.(status); await load(); }} />
      <form className="panel draft-course-editor" id="draft-courses" onSubmit={save}>
        <div className="results-heading draft-course-toolbar">
          <div><p className="eyebrow">DRAFT CONTENT</p><h2>Published course offerings</h2></div>
          <button className="outline-button" type="button" onClick={checkValidation} disabled={busy}>{validating ? "Checking…" : "Check draft validation"}</button>
        </div>
        <p className="helper-text">Choose or clear a group for each component. Saving reserves the selected seats and releases seats you remove. You can save with some groups still unassigned.</p>
        {creditPolicy && <dl className="draft-credit-grid" id="draft-credit-summary" tabIndex={-1}>
          <div><dt>Selected credits</dt><dd>{credits}</dd></div>
          <div><dt>{creditPolicy.probation ? "Probation allowance" : "Standard allowance"}</dt><dd>{creditPolicy.baseAllowance ?? "—"}</dd></div>
          <div><dt>Activated extra hours</dt><dd>{creditPolicy.approvedExtraHours}</dd></div>
          <div><dt>Maximum credits</dt><dd>{creditPolicy.maximumCreditHours}</dd></div>
          <div><dt>Remaining credits</dt><dd>{Math.max(0, creditPolicy.maximumCreditHours - credits)}</dd></div>
          <div><dt>Extra credits used</dt><dd>{Math.max(0, credits - (creditPolicy.baseAllowance ?? creditPolicy.maximumCreditHours))}</dd></div>
        </dl>}
        {creditPolicy && !creditPolicy.policyConfigured && <p className="helper-text">Semester {creditPolicy.semester} uses the 34-hour overall ceiling until its standard allowance is defined.</p>}
        {!editable && <Feedback tone="warning">This schedule has moved beyond draft status and is read-only.</Feedback>}
        {selectedConflict && <Feedback tone="error">{selectedConflict}</Feedback>}
        {overCreditLimit && <Feedback tone="error">This draft exceeds the student's maximum of {creditPolicy.maximumCreditHours} credit hours.</Feedback>}
        {!overCreditLimit && extraHoursNotCovered && <Feedback tone="warning">The draft goes beyond the standard allowance. Add an extra-hours course that has an approved request and is already paid or deferred; approval alone does not activate it.</Feedback>}
        <fieldset className="draft-course-list" disabled={!editable || busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        {!data.offerings.length ? <Empty title="No published offerings" text="There are no active published course offerings for this student's major and semester." /> : data.offerings.map((offering) => {
          const selected = selections[offering._id];
          const savedGroups = data.schedule?.courses.find((course) => course.courseOffering === offering._id)?.groups || [];
          return <article className={`draft-course ${selected ? "selected" : ""}`} id={`draft-course-${offering._id}`} tabIndex={-1} key={offering._id}>
            <div className="draft-course-heading"><div><strong>{offering.course.code} · {offering.course.name}</strong><span className="secondary-text">{offering.course.creditHours} credits · {offering.course.courseType}{approvedExtraCourses.has(String(offering.course._id)) ? " · approved extra-hours course (paid/deferred)" : ""}</span></div>{selected ? <button className="text-button" type="button" disabled={!editable} onClick={() => removeCourse(offering._id)}>Remove</button> : <button className="outline-button small-button" type="button" disabled={!editable} onClick={() => addCourse(offering)}>Add course</button>}</div>
            {selected && <div className="draft-component-grid">{offering.components.map((componentType) => {
              const picked = selected.groups.find((group) => group.componentType === componentType)?.groupNumber || "";
              const saved = savedGroups.find((group) => group.componentType === componentType)?.groupNumber || "";
              const options = offering.groups.filter((group) => group.componentType === componentType);
              const group = options.find((item) => item.groupNumber === picked);
              const pending = picked !== saved;
              return <div className="draft-group-control" key={componentType}>
                <label className="field">
                  <span>{componentType[0].toUpperCase() + componentType.slice(1)} group</span>
                  <select value={picked} onChange={(event) => setGroup(offering._id, componentType, event.target.value)}>
                    <option value="">Unassigned</option>
                    {options.map((option) => {
                      const preferred = option.preferredPriorities[0];
                      const full = !option.availableSeats && !option.reservedForStudent;
                      return <option key={option.groupNumber} value={option.groupNumber} disabled={!option.valid}>
                        {option.groupNumber} · {full ? "Full · validation only" : seatAvailability(option)}{preferred ? ` · Preferred #${preferred}` : ""} · {option.slots.map(draftMeetingLabel).join(" / ")}
                      </option>;
                    })}
                  </select>
                </label>
                <div className="draft-group-summary" aria-live="polite">
                  {group && <>
                    <strong>{seatAvailability(group)}</strong>
                    {group.slots.map((slot) => <span key={slot.slotGroupId}>{draftMeetingLabel(slot)}</span>)}
                  </>}
                  {group?.valid && !group.availableSeats && !group.reservedForStudent ? <span className="draft-issue-tag is-blocking">Full · check validation or choose another group</span>
                    : pending ? <span>Unsaved change{saved ? ` · ${saved} stays assigned until you save` : " · save to reserve a seat"}</span>
                    : group?.reservedForStudent ? <span className="status-pill good">Saved · seat reserved</span>
                    : group && <span>Seat reservation pending save</span>}
                </div>
              </div>;
            })}</div>}
          </article>;
        })}
        </fieldset>
        <DraftValidation issues={validationIssues} offerings={data.offerings} headingRef={validationHeading} onCheck={checkValidation} validating={validating} busy={busy} />
        {error && <Feedback tone="error">{error}</Feedback>}
        {message && <Feedback tone="success">{message}</Feedback>}
        <div className="form-footer"><span className="helper-text">Saving keeps the schedule in draft. The server rechecks academic rules, capacity, and clashes.</span><button className="primary-button" type="submit" disabled={busy || !editable}>{saving && !sendingForReview ? "Saving draft…" : data.schedule ? "Update draft" : "Create draft"}<span>→</span></button></div>
        {editable && selectedOfferings.length > 0 && <div className="form-footer"><span className="helper-text">When the schedule is ready, save it and make it visible to the student for review.</span><button className="outline-button" type="button" onClick={(event) => save(event, true)} disabled={busy || Boolean(selectedConflict) || Boolean(incompleteSelection) || missingMandatory.length > 0 || overCreditLimit || extraHoursNotCovered}>{sendingForReview ? "Sending for review…" : "Save and send for student review"}<span>→</span></button></div>}
        {data.schedule?.status === "readyForStudentReview" && <div className="form-footer" style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}><span className="helper-text">Review complete? Finalize and process this schedule.</span><button className="primary-button" type="button" disabled={processing} onClick={processSchedule}>{processing ? "Processing schedule…" : "Process Schedule"}<span>→</span></button></div>}
        {data.schedule?.status === "processed" && <div className="form-footer" style={{ borderTop: "1px solid var(--line)", paddingTop: "14px" }}><span className="helper-text">Reopening reverts this schedule to draft status for further edits.</span><button className="primary-button destructive-action" type="button" onClick={() => { setReopenReason(""); setReopenError(""); setReopenModalOpen(true); }}>Reopen Schedule</button></div>}
      </form>
      {reopenModalOpen && (
        <div className="modal-backdrop" onClick={() => !reopening && setReopenModalOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Reopen Schedule" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">AUDITED ACTION</p>
                <h2>Reopen Advising Schedule</h2>
              </div>
              <button className="icon-button" type="button" aria-label="Close" disabled={reopening} onClick={() => setReopenModalOpen(false)}>×</button>
            </div>
            {reopenError && <div className="feedback error" role="alert" style={{ marginBottom: "12px" }}>{reopenError}</div>}
            <form onSubmit={reopenSchedule} className="page-stack">
              <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)" }}>
                Reopening reverts this schedule to <strong>draft</strong> status and increments the schedule version. You must provide a mandatory justification for audit logging.
              </p>
              <label className="field">
                <span>Reopening Reason *</span>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Explain why this processed schedule is being reopened for modification..."
                  required
                  disabled={reopening}
                />
                <small className="secondary-text" style={{ textAlign: "right" }}>{reopenReason.length} / 2000 characters</small>
              </label>
              <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" className="outline-button" disabled={reopening} onClick={() => setReopenModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary-button destructive-action" disabled={reopening || !reopenReason.trim()}>{reopening ? "Reopening schedule…" : "Reopen Schedule"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>}
  </div>;
}

const validationIssueTitles = {
  emptySchedule: "Courses",
  missingMandatoryCourse: "Mandatory courses",
  missingSlot: "Required groups",
  prerequisites: "Prerequisites",
  passedCourse: "Course eligibility",
  unavailableOffering: "Offering availability",
  unavailableSlot: "Group availability",
  timetableClash: "Timetable",
  invalidSlot: "Timetable",
  capacity: "Seat capacity",
  creditHours: "Credit hours",
};

function DraftValidation({ issues, offerings, headingRef, onCheck, validating, busy }) {
  const orderedIssues = [...(issues || [])].sort((first, second) => Number(Boolean(second.blocksSave)) - Number(Boolean(first.blocksSave)));
  const saveBlockers = issues?.filter((issue) => issue.blocksSave).length || 0;

  return <section className="draft-validation" id="draft-validation" aria-labelledby="draft-validation-title">
    <div className="draft-validation-heading">
      <div>
        <h2 id="draft-validation-title" ref={headingRef} tabIndex={-1}>Draft validation</h2>
        <p>See what needs attention and jump back to the relevant course.</p>
      </div>
      <button className="outline-button" type="button" onClick={onCheck} disabled={busy}>{validating ? "Checking…" : "Check draft validation"}</button>
    </div>
    <div aria-live="polite" aria-busy={validating}>
      {issues == null && <p className="draft-validation-state">Selections changed. Check validation to see the latest issues.</p>}
      {issues?.length === 0 && <p className="draft-validation-state is-clear">✓ No draft validation issues found.</p>}
      {issues?.length > 0 && <>
        <div className="draft-validation-totals">
          <strong>{issues.length} {issues.length === 1 ? "issue" : "issues"} before review</strong>
          <span>{saveBlockers ? `${saveBlockers} marked for correction · shown first` : "You can still save this draft"}</span>
        </div>
        <ul className="draft-validation-list">
          {orderedIssues.map((issue, index) => {
            const matchingCourses = offerings.filter(({ course }) => issue.message.includes(course.code));
            return <li key={index}>
              <div>
                <h3>{validationIssueTitles[issue.code] || "Other issue"}</h3>
                <p>{issue.message}</p>
              </div>
              <div className="draft-issue-actions">
                <span className={`draft-issue-tag ${issue.blocksSave ? "is-blocking" : ""}`}>{issue.blocksSave ? "Needs correction" : "Required for review"}</span>
                {issue.code === "creditHours" ? <a href="#draft-credit-summary">View credits</a>
                  : matchingCourses.length ? matchingCourses.map(({ _id, course }) => <a key={_id} href={`#draft-course-${_id}`}>Go to {course.code}</a>)
                  : <a href="#draft-courses">Review courses</a>}
              </div>
            </li>;
          })}
        </ul>
      </>}
    </div>
  </section>;
}

function PreferenceSummary({ title, entries }) {
  return <div className="draft-preference-item"><strong>{title}</strong><span>{entries.length ? entries.join(", ") : "No preference"}</span></div>;
}

function seatAvailability(group) {
  return `${group.availableSeats} ${group.availableSeats === 1 ? "seat" : "seats"} left`;
}

function draftMeetingLabel(slot) {
  return `${slot.day} ${slot.startTime}–${slot.endTime}, ${slot.room}`;
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
      for (const slot of group?.slots || []) week[slot.day]?.push({ courseCode: offering.course.code, courseName: offering.course.name, type: choice.componentType, groupNumber: choice.groupNumber, startTime: slot.startTime, endTime: slot.endTime, room: slot.room });
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
  return <section className="panel"><div className="results-heading"><div><p className="eyebrow">COURSE DETAILS</p><h2>{details.course.courseCode} · {details.course.courseName}</h2></div><span className="status-pill">{details.course.courseType || "Course"}</span></div>
    <p className="helper-text">Instructor{details.instructors?.length === 1 ? "" : "s"}: {details.instructors?.map((person) => person.fullName).filter(Boolean).join(", ") || "Not listed"}</p>
    <div className="component-grid">{labels.map(([key, label]) => { const slot = details.components?.[key]; return <div className="component-card" key={key}><small>{label}</small><strong>{slot ? `Group ${slot.groupNumber}` : "Not scheduled"}</strong><span>{slot ? `${slot.day}, ${slot.startTime}–${slot.endTime} · ${slot.room}` : "This course has no assigned component."}</span></div>; })}</div>
    {details.sessions?.length > 3 && <p className="helper-text">This course has {details.sessions.length} scheduled sessions across its components.</p>}
  </section>;
}

function WeeklySchedule({ week = {}, daysOff = [], compact = false }) {
  return <div className={`weekly-schedule ${compact ? "compact" : ""}`}>
    {WEEK.map((day) => <section className={`schedule-day ${daysOff.includes(day) ? "day-off" : ""}`} key={day}><h3>{day}{daysOff.includes(day) && <small>Off</small>}</h3>
      {(week[day] || []).length ? week[day].map((slot, index) => <article className={`schedule-slot ${slot.type || ""}`} key={`${slot.courseCode}-${slot.startTime}-${index}`}><strong>{slot.courseCode}</strong>{slot.courseName && <span className="schedule-course-name">{slot.courseName}</span>}<span>{slot.type} · {slot.startTime}–{slot.endTime}</span><small>{slot.room} · Group {slot.groupNumber}</small></article>) : <p className="empty-day">No classes</p>}
    </section>)}
  </div>;
}

function Stat({ label, value }) { return <div className="stat-card"><span className="stat-icon">◷</span><div><p>{label}</p><strong>{value}</strong></div></div>; }
const ADVISING_REASONS = { probation: "Probation", failedCourses: "More than two failed courses in a season", unattendedCourses: "Unattended courses", undeclaredMajor: "Undeclared CS or DMET major", transfer: "Transfer from another major/university" };
const WORKFLOW_LABELS = { notStarted: "Not started", draft: "Draft", readyForStudentReview: "Ready for student review", changeRequestPending: "Change request pending", pendingApproval: "Pending approval", awaitingPaymentChoice: "Awaiting payment choice", deferredToNextInstallment: "Deferred to next installment", readyToProcess: "Ready to process", processed: "Processed", reopened: "Reopened" };

function EligibleCoursesPanel({ token, student, termQuery, editable, notify, version, onChanged }) {
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const base = `/api/schedules/advising/${encodeURIComponent(student._id)}`;
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(termQuery.replace(/^\?/, "")); if (search.trim()) params.set("search", search.trim());
    api(`${base}/eligible-courses?${params}`, { token }).then((data) => alive && setResult(data)).catch((requestError) => alive && setError(requestError.message));
    return () => { alive = false; };
  }, [base, termQuery, token, search, version]);
  async function change(entry) {
    setBusyId(entry.courseOffering); setError("");
    try {
      const response = entry.inDraft
        ? await api(`${base}/courses/${entry.courseOffering}${termQuery}`, { token, method: "DELETE" })
        : await api(`${base}/courses${termQuery}`, { token, method: "POST", body: { courseOffering: entry.courseOffering } });
      notify?.("success", response.message);
      await onChanged?.("draft");
    } catch (requestError) { setError(requestError.message); }
    finally { setBusyId(""); }
  }
  return <section className="panel eligible-courses" id="draft-eligible"><div className="results-heading"><div><p className="eyebrow">OTHER COURSES</p><h2>Eligible courses this term</h2></div><span className="result-count">{result?.count ?? 0} courses</span></div>
    <p className="helper-text">Courses the student has not completed, whose prerequisites are met and that are published and offered this season. Add them after the mandatory courses.</p>
    <label className="field roster-search"><span>Search courses</span><input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Course code or name" /></label>
    {error && <Feedback tone="error">{error}</Feedback>}
    {!result ? <Loading /> : result.courses.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Credits</th><th>Type</th><th>Prerequisites</th><th /></tr></thead><tbody>{result.courses.map((entry) => <tr key={entry.courseOffering}>
      <td><strong>{entry.course.code}</strong><span className="secondary-text">{entry.course.name}</span></td><td>{entry.course.creditHours}</td><td>{entry.course.courseType}</td>
      <td>{entry.course.prerequisites.length ? entry.course.prerequisites.map((item) => item.code).join(", ") : "None"}</td>
      <td>{editable && <button className={entry.inDraft ? "outline-button" : "primary-button"} type="button" disabled={Boolean(busyId)} onClick={() => change(entry)}>{busyId === entry.courseOffering ? "Working…" : entry.inDraft ? "Remove" : "Add to draft"}</button>}</td>
    </tr>)}</tbody></table></div> : <Empty title="No eligible courses" text={search ? "No eligible course matches your search." : "There are no other eligible published courses for this student this term."} />}
    {result?.excluded?.length > 0 && <details className="excluded-courses"><summary>{result.excluded.length} courses not available to this student</summary><ul>{result.excluded.map((entry) => <li key={entry._id}>{entry.message}</li>)}</ul></details>}
  </section>;
}

function MandatoryCoursesPanel({ data, editable, busy, onSave }) {
  const available = data.mandatoryCourses.filter((course) => course.availableForTerm);
  const [picked, setPicked] = useState(() => new Set(available.filter((course) => course.inDraft).map((course) => course._id)));
  useEffect(() => { setPicked(new Set(available.filter((course) => course.inDraft).map((course) => course._id))); }, [data.schedule?.version]);
  const summary = data.mandatorySummary;
  const pickedHours = available.filter((course) => picked.has(course._id)).reduce((sum, course) => sum + Number(course.creditHours || 0), 0);
  const toggle = (id) => setPicked((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  return <section className="panel mandatory-panel" id="draft-mandatory"><div className="panel-heading"><div><p className="eyebrow">MANDATORY COURSES</p><h2>Failed or unattended courses</h2></div>
    <span className="status-pill good">{summary?.mandatoryHours ?? 0} / {summary?.allowedHours ?? data.creditPolicy.maximumCreditHours} h used</span></div>
    <p className="helper-text">Select the mandatory courses to include before adding any other course. They use up the student’s allowed credit hours.</p>
    <ul className="mandatory-list">{data.mandatoryCourses.map((course) => <li key={course._id}>
      {course.availableForTerm
        ? <label><input type="checkbox" checked={picked.has(course._id)} disabled={!editable || busy} onChange={() => toggle(course._id)} /> <strong>{course.code}</strong> {course.name} · {course.creditHours} h</label>
        : <span><strong>{course.code}</strong> {course.name} · <span className="status-pill muted">no eligible published offering</span></span>}
    </li>)}</ul>
    {summary && summary.mandatoryHours > 0 && (summary.otherCoursesNeedExtraHours
      ? <Feedback tone="warning">Mandatory courses use all {summary.allowedHours} allowed hours. No other course can be added without approved extra hours.</Feedback>
      : <p className="helper-text">{summary.remainingAllowedHours} allowed hours remain for other courses.</p>)}
    {editable && <div className="form-footer"><span className="helper-text">{pickedHours} credit hours selected.</span><button className="primary-button" type="button" disabled={busy} onClick={() => onSave([...picked])}>{busy ? "Saving…" : "Save mandatory courses"}</button></div>}
  </section>;
}

function AdvisingOverviewPanel({ overview, token, student, termQuery, canEdit, notify, onChanged }) {
  const hours = overview.creditHours, bachelor = overview.bachelorProject;
  const [season, setSeason] = useState(bachelor.selection?.season || "winter");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const projectPath = `/api/schedules/advising/${encodeURIComponent(student._id)}/bachelor-project${termQuery}`;
  async function changeProject(remove) {
    setBusy(true); setProblem("");
    try {
      const result = await api(projectPath, { token, method: remove ? "DELETE" : "PUT", body: remove ? undefined : { season } });
      notify?.("success", result.message);
      await onChanged?.();
    } catch (error) { setProblem(error.message); }
    finally { setBusy(false); }
  }
  return <section className="panel advising-overview" aria-label="Advising overview">
    <div className="panel-heading"><div><p className="eyebrow">ADVISING OVERVIEW</p><h2>{ADVISING_REASONS[overview.advisingReason] || overview.advisingReason}</h2></div><span className="status-pill good">{WORKFLOW_LABELS[overview.scheduleStatus] || overview.scheduleStatus}</span></div>
    <dl className="overview-grid">
      <div><dt>Academic standing</dt><dd>{overview.academicStanding === "probation" ? "Probation" : "Good academic standing"}</dd></div>
      <div><dt>Standard allowance</dt><dd>{hours.standardAllowance ?? "Not configured"}{hours.standardAllowance != null ? " h" : ""}</dd></div>
      <div><dt>Allowed hours</dt><dd>{hours.allowedHours ?? "—"}{hours.probation ? ` (−${hours.reductionForProbation} probation)` : ""}</dd></div>
      <div><dt>Approved extra hours</dt><dd>{hours.approvedExtraHours}{hours.probation ? " (not available)" : ""}</dd></div>
      <div><dt>Maximum this term</dt><dd>{hours.maximumCreditHours} h</dd></div>
      <div><dt>Bachelor project</dt><dd><span className={`status-pill ${bachelor.eligible ? "good" : "warning"}`}>{bachelor.eligible ? "Eligible" : "Not eligible"}</span></dd></div>
    </dl>
    {bachelor.selection && <p className="helper-text"><strong>Bachelor project selected for {bachelor.selection.season === "winter" ? "Winter" : "Spring"}.</strong> Up to four courses may be taken with it: two core and two humanities (humanities count as extra hours).</p>}
    {bachelor.eligible && canEdit && <div className="bachelor-project-actions">
      <label className="field"><span>Bachelor project season</span><select value={season} onChange={(event) => setSeason(event.target.value)} disabled={busy}><option value="winter">Winter</option><option value="spring">Spring</option></select></label>
      <button className="primary-button" type="button" disabled={busy} onClick={() => changeProject(false)}>{bachelor.selection ? "Change season" : "Add bachelor project"}</button>
      {bachelor.selection && <button className="outline-button" type="button" disabled={busy} onClick={() => changeProject(true)}>Remove project</button>}
    </div>}
    {problem && <Feedback tone="error">{problem}</Feedback>}
    {overview.blockingStep && <p className="helper-text">Next step: {overview.blockingStep}</p>}
    {bachelor.eligibleWithFailedCourses && <p className="helper-text">Eligible with {bachelor.outstandingCourses.map((course) => course.code).join(", ")} still outstanding (one or two failed courses are allowed).</p>}
    {!bachelor.eligible && <ul className="helper-text">{bachelor.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
  </section>;
}

function Feedback({ tone = "info", children }) { return <div className={`feedback ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>; }
function Empty({ title, text }) { return <div className="empty-state"><span>▤</span><h3>{title}</h3><p>{text}</p></div>; }
function Loading() { return <div className="loading-state"><span className="loader" />Loading…</div>; }
function prettyStatus(status) { return ({ processed: "Processed", readyForStudentReview: "Ready for student review", draft: "Draft" })[status] || "No schedule"; }
