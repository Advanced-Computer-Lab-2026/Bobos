import { useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";

function assignmentsFor(plan) {
  return Object.fromEntries((plan?.termPlans ?? []).flatMap(({ term, courses }) =>
    courses.map((course) => [course, term])));
}

export default function GraduationPlans({ student, token, onBack }) {
  const path = `/api/advisor/students/${student._id}/graduation-plans`;
  const [workspace, setWorkspace] = useState(null);
  const [plan, setPlan] = useState(null);
  const [editing, setEditing] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [examId, setExamId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api(path, { token, signal: controller.signal }).then(setWorkspace).catch((requestError) => {
      if (requestError.name !== "AbortError") setError(explainApiError(requestError, "Graduation plans"));
    });
    return () => controller.abort();
  }, [path, token]);

  function openPlan(selected) {
    setPlan(selected);
    setAssignments(assignmentsFor(selected));
    setExamId(selected?.exitExamRequest ?? "");
    setEditing(true);
    setConfirmDelete(false);
    setIssues([]);
    setError("");
    setNotice("");
  }

  async function perform(action, message) {
    setBusy(true);
    setError("");
    setIssues([]);
    setNotice("");
    try {
      await action();
      setNotice(message);
    } catch (requestError) {
      setError(explainApiError(requestError, "Graduation plans"));
      setIssues(requestError.data?.issues ?? []);
    } finally {
      setBusy(false);
    }
  }

  function planPayload() {
    const byTerm = new Map();
    for (const [course, term] of Object.entries(assignments)) {
      if (!term) continue;
      if (!byTerm.has(term)) byTerm.set(term, []);
      byTerm.get(term).push(course);
    }
    return {
      termPlans: [...byTerm].map(([term, courses]) => ({ term, courses })),
      exitExamRequest: examId || null,
      version: plan?.version,
    };
  }

  function storePlan(updated) {
    setPlan(updated);
    setWorkspace((previous) => ({
      ...previous,
      plans: [updated, ...previous.plans.filter((item) => item._id !== updated._id)],
    }));
  }

  async function savePlan() {
    const saved = await api(plan ? `${path}/${plan._id}` : path, {
      token,
      method: plan ? "PUT" : "POST",
      body: planPayload(),
    });
    storePlan(saved);
    return saved;
  }

  function submitPlan() {
    return perform(async () => {
      const saved = await savePlan();
      storePlan(await api(`${path}/${saved._id}/submit`, { token, method: "POST", body: { version: saved.version } }));
    }, "Plan submitted for Coordinator review.");
  }

  function deletePlan() {
    return perform(async () => {
      await api(`${path}/${plan._id}`, { token, method: "DELETE", body: { version: plan.version } });
      setWorkspace((previous) => ({ ...previous, plans: previous.plans.filter((item) => item._id !== plan._id) }));
      setConfirmDelete(false);
      setEditing(false);
      setPlan(null);
    }, "Draft deleted.");
  }

  function requestExam(event) {
    event.preventDefault();
    return perform(async () => {
      const request = await api(`${path}/exit-exam-requests`, {
        token,
        method: "POST",
        body: { courseId: workspace.examEligibility.courseId, reason },
      });
      setWorkspace((previous) => ({ ...previous, exams: [request, ...previous.exams] }));
      setReason("");
    }, "Exit exam requested.");
  }

  const courses = workspace?.courses ?? [];
  const terms = workspace?.terms ?? [];
  const currentExamCourse = courses.find((course) => course._id === workspace?.examEligibility.courseId);
  const courseNames = new Map([...Object.entries(workspace?.savedCourseCodes ?? {}), ...courses.map((course) => [course._id, course.code])]);
  const termNames = new Map([...Object.entries(workspace?.savedTermCodes ?? {}), ...terms.map((term) => [term._id, term.code])]);
  const remainingIds = new Set(courses.map((course) => course._id));
  const obsoleteAssignments = Object.keys(assignments).filter((id) => assignments[id] && !remainingIds.has(id));
  const examCourseId = workspace?.exams.find((exam) => exam._id === examId)?.course;
  const examAlreadyRequested = workspace?.exams.some((exam) =>
    exam.course === currentExamCourse?._id && ["pending", "approved"].includes(exam.status));
  const readOnly = Boolean(plan && plan.status !== "draft");

  return <div className="page-stack">
    <div className="page-title-row">
      <div>
        <h1>Graduation plans</h1>
        <p className="page-description">{student.user?.fullName || student.studentId} · {student.studentId}</p>
      </div>
      <button className="outline-button" type="button" onClick={onBack}>Back to advising students</button>
    </div>
    {notice && <div className="feedback" role="status">{notice}</div>}
    {error && <div className="feedback error" role="alert">{error}
      {issues.length > 0 && <ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
    </div>}
    {!workspace && !error && <div className="loading-state" role="status">Loading graduation plans…</div>}
    {workspace && <>
      <section className="panel">
        <div className="results-heading">
          <h2>Your plans</h2>
          <button className="primary-button" type="button" onClick={() => openPlan(null)} disabled={busy}>New plan</button>
        </div>
        {workspace.plans.length === 0 && <p>No saved plans for this student.</p>}
        {workspace.plans.length > 0 && <div className="table-scroll"><table>
          <thead><tr><th>Status</th><th>Last updated</th><th>Action</th></tr></thead>
          <tbody>{workspace.plans.map((item) => <tr key={item._id}>
            <td><span className="status-pill">{item.status === "draft" ? "Private draft" : item.status}</span></td>
            <td>{new Date(item.updatedAt).toLocaleString()}</td>
            <td><button className="text-button" type="button" disabled={busy} onClick={() => openPlan(item)}>Open plan</button></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
      {editing && <section className="panel" aria-busy={busy}>
        <div className="results-heading">
          <h2>{readOnly ? "Saved plan" : plan ? "Edit private draft" : "New plan"}</h2>
          <button className="outline-button" type="button" disabled={busy} onClick={() => setEditing(false)}>Close plan</button>
        </div>
        {plan?.responseNote && <p>Coordinator response: {plan.responseNote}</p>}
        {readOnly ? (
          <>
            <p>Status: {plan.status}</p>
            {plan.termPlans.map(({ term, courses: selected }) => (
              <p key={term}>{termNames.get(term) ?? term}: {selected.map((id) => courseNames.get(id) ?? id).join(", ")}</p>
            ))}
            {plan.exitExamRequest && <p>This plan uses an approved exit exam.</p>}
          </>
        ) : <>
          <p>Choose at least {workspace.electiveRequirement.count} remaining electives totalling {workspace.electiveRequirement.hours} credit hours.</p>
          {workspace.missingSeasons.length > 0 && <p className="feedback">
            Upcoming terms still to be configured: {workspace.missingSeasons.join(", ")}.
          </p>}
          <div className="table-scroll"><table>
            <thead><tr><th>Term</th><th>Assigned hours</th><th>Credit limit</th></tr></thead>
            <tbody>{terms.map((term) => {
              const selected = courses.filter((course) => assignments[course._id] === term._id);
              const total = selected.reduce((sum, course) => sum + course.creditHours, 0);
              const extra = term.approvedExtraCourses.filter(({ courseId }) => assignments[courseId] === term._id)
                .reduce((sum, item) => sum + item.hours, 0);
              return <tr key={term._id}>
                <td>{term.code} · {term.season} · {term.academicYear}</td>
                <td>{total}</td><td>{Math.min(term.maximumCreditHours, term.baseAllowance + extra)}</td>
              </tr>;
            })}</tbody>
          </table></div>
          <div className="table-scroll"><table>
            <thead><tr><th>Remaining course</th><th>Hours</th><th>Prerequisites</th><th>Assign to</th></tr></thead>
            <tbody>{courses.map((course) => <tr key={course._id}>
              <td>{course.code} · {course.name}
                {course.elective && <span className="secondary-text">{course.required ? "Required elective retake" : "Elective choice"}</span>}
                {course.failed && <span className="secondary-text">Failed</span>}</td>
              <td>{course.creditHours}</td>
              <td>{course.prerequisites.map((id) => workspace.prerequisiteCodes[id] || "Unavailable course").join(", ") || "—"}</td>
              <td><select aria-label={`Term for ${course.code}`} value={assignments[course._id] ?? ""}
                disabled={busy || course._id === examCourseId}
                onChange={(event) => setAssignments({ ...assignments, [course._id]: event.target.value })}>
                <option value="">{course._id === examCourseId ? "Exit exam" : "Unassigned"}</option>
                {assignments[course._id] && !course.termIds.includes(assignments[course._id]) &&
                  <option value={assignments[course._id]}>Previously assigned term (unavailable)</option>}
                {terms.filter((term) => course.termIds.includes(term._id)).map((term) =>
                  <option key={term._id} value={term._id}>{term.code} · {term.season}</option>)}
              </select></td>
            </tr>)}</tbody>
          </table></div>
          {courses.length === 0 && <p>No remaining courses in the academic record.</p>}
          {obsoleteAssignments.length > 0 && <div className="feedback">
            <p>Remove assignments for courses that are no longer in the remaining course list.</p>
            <ul>{obsoleteAssignments.map((id) => <li key={id}>
              {courseNames.get(id) ?? "Unavailable course"}{" "}
              <button className="text-button" type="button" disabled={busy}
                onClick={() => setAssignments({ ...assignments, [id]: "" })}>Remove assignment</button>
            </li>)}</ul>
          </div>}
          {(examId || workspace.exams.some((exam) => exam.status === "approved")) && <label className="field">
            <span>Approved exit exam</span>
            <select value={examId} disabled={busy} onChange={(event) => {
              const value = event.target.value;
              const exam = workspace.exams.find((item) => item._id === value);
              if (exam) setAssignments({ ...assignments, [exam.course]: "" });
              setExamId(value);
            }}>
              <option value="">No exit exam</option>
              {examId && !workspace.exams.some((exam) => exam._id === examId && exam.status === "approved") &&
                <option value={examId}>Previously selected exam (unavailable)</option>}
              {workspace.exams.filter((exam) => exam.status === "approved").map((exam) => (
                <option key={exam._id} value={exam._id}>{courseNames.get(exam.course) || "Approved exam"}</option>
              ))}
            </select>
          </label>}
          <div className="form-actions">
            {plan && <button className="outline-button" type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete draft</button>}
            <button className="outline-button" type="button" disabled={busy} onClick={() => perform(savePlan, "Private draft saved.")}>Save draft</button>
            <button className="primary-button" type="button" disabled={busy} onClick={submitPlan}>Submit plan</button>
          </div>
          {confirmDelete && <div className="feedback" role="group" aria-label="Confirm draft deletion">
            <p>Delete this private draft?</p>
            <button className="outline-button" type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</button>{" "}
            <button className="primary-button" type="button" disabled={busy} onClick={deletePlan}>Confirm delete</button>
          </div>}
        </>}
      </section>}
      <section className="panel">
        <h2>Exit-exam requests</h2>
        {workspace.exams.map((exam) => <div key={exam._id}>
          <p>{courseNames.get(exam.course) || "Exit exam"} · {exam.status}</p>
          {exam.responseNote && <p><strong>Coordinator response</strong> {exam.responseNote}</p>}
        </div>)}
        {workspace.examEligibility.message && <p>{workspace.examEligibility.message}</p>}
        {currentExamCourse && !workspace.examEligibility.message && !examAlreadyRequested &&
          <form className="form-stack" onSubmit={requestExam}>
            <p>{currentExamCourse.code} · {currentExamCourse.name}</p>
            <label className="field"><span>Why can’t this course be repeated before graduation?</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required disabled={busy} />
            </label>
            <div className="form-actions"><button className="primary-button" disabled={busy || !reason.trim()}>Request exit exam</button></div>
          </form>}
      </section>
    </>}
  </div>;
}
