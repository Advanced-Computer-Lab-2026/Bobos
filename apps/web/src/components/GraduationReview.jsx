import { termLabel } from "../term-label.js";
import { useEffect, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { StudentIdentity } from "./CoordinatorRecords.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import { GraduationEmpty, WorkspaceHeader } from "./WorkspaceUI.jsx";

const root = "/api/graduation";
const emptyFilters = { search: "", status: "", advisor: "", from: "", to: "" };
const labels = { pending: "Pending", approved: "Approved", rejected: "Rejected", submitted: "Awaiting review", accepted: "Accepted" };
const dateLabel = (value) => value ? new Date(value).toLocaleString() : "—";
const studentDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" });
const orderedTerms = (plan) => [...plan.termPlans].sort((a, b) => (a.term?.termStart ?? "").localeCompare(b.term?.termStart ?? ""));
const courseCount = (count) => `${count} ${count === 1 ? "course" : "courses"}`;
const creditLabel = (hours) => `${hours} ${hours === 1 ? "credit" : "credits"}`;

function Status({ status }) {
  const tone = ["approved", "accepted"].includes(status) ? "good" : status === "rejected" ? "danger" : "warning";
  return <span className={`status-pill ${tone}`}>{labels[status]}</span>;
}

function PlanCourses({ plan }) {
  return <>
    <StudentPlanTerms plan={plan} />
    {plan.exitExamRequest && <div className="graduation-exam-course">
      {plan.exitExamRequest.course && <OfferingCourseIcon code={plan.exitExamRequest.course.code} />}
      <p>Approved exit exam · {plan.exitExamRequest.course?.code ?? "Archived course"}</p>
    </div>}
    <GraduationResponse note={plan.responseNote} />
  </>;
}

function AdvisorSubmissions({ rows }) {
  const [activeId, setActiveId] = useState("");
  const plan = rows.find(row => row._id === activeId) || rows[0];
  const courses = plan.termPlans.flatMap(term => term.courses);
  const accepted = plan.status === "accepted";

  return <div className="advisor-submissions">
    {rows.length > 1 && <div className="submission-index" role="group" aria-label="Select submitted plan">
      {rows.map(row => <button key={row._id} type="button" aria-pressed={row._id === plan._id} onClick={() => setActiveId(row._id)}>
        <StudentIdentity name={row.student?.user?.fullName} id={row.student?.studentId} />
        <Status status={row.status} />
      </button>)}
    </div>}
    <article className="submission-record" aria-labelledby="submission-student-name">
      <header className="submission-cover">
        <StudentIdentity name={plan.student?.user?.fullName} id={plan.student?.studentId}
          nameAction={<h2 id="submission-student-name">{plan.student?.user?.fullName || "Advising student"}</h2>} />
        <div className="submission-meta">
          {plan.submittedAt && <p>Submitted <time dateTime={plan.submittedAt}>{studentDate.format(new Date(plan.submittedAt))}</time></p>}
          <Status status={plan.status} />
        </div>
      </header>
      <div className="submission-body">
        <section className="submission-courses" aria-labelledby="submission-courses-title">
          <header className="submission-courses-heading">
            <h3 id="submission-courses-title">Submitted plan</h3>
            <p>{plan.termPlans.length} {plan.termPlans.length === 1 ? "term" : "terms"} · {courseCount(courses.length)} · {creditLabel(courses.reduce((sum, course) => sum + course.creditHours, 0))}</p>
          </header>
          <div className="submission-term-list">
            {plan.termPlans.length ? <StudentPlanTerms plan={plan} /> : !plan.exitExamRequest && <p className="graduation-meta">No courses listed.</p>}
          </div>
          {plan.exitExamRequest && <div className="graduation-exam-course">
            <OfferingCourseIcon code={plan.exitExamRequest.course?.code} />
            <div><h4>Approved exit exam</h4>
              <p className="graduation-meta">{[plan.exitExamRequest.course?.name, plan.exitExamRequest.course?.code].filter(Boolean).join(" · ") || "Archived course"}</p>
            </div>
          </div>}
        </section>
        <aside className="submission-review" aria-label="Coordinator review">
          <img src="/portal-studio/images/submitted-plan.svg" width="78" height="58" alt="" />
          <h3>{accepted ? "Shared with the student" : "With the coordinator"}</h3>
          <p>{accepted ? "The student can now see this plan under My graduation." : "This plan is waiting for a decision. If it comes back to you, you can edit it and submit it again."}</p>
          {accepted && plan.decidedAt && <p className="submission-decision-date">
            Accepted <time dateTime={plan.decidedAt}>{studentDate.format(new Date(plan.decidedAt))}</time>
          </p>}
          <GraduationResponse note={plan.responseNote} />
        </aside>
      </div>
    </article>
  </div>;
}

function DecisionForm({ kind, disabled, decide }) {
  const [decision, setDecision] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const plan = kind === "plans";
  return <form className="form-stack" onSubmit={(event) => {
    event.preventDefault();
    decide({ decision, responseNote });
  }}>
    <label className="field"><span>Decision</span>
      <select required value={decision} disabled={disabled} onChange={(event) => setDecision(event.target.value)}>
        <option value="">Select a decision</option>
        <option value={plan ? "accept" : "approve"}>{plan ? "Accept plan" : "Approve request"}</option>
        <option value="reject">{plan ? "Return to advisor" : "Reject request"}</option>
      </select>
    </label>
    <label className="field"><span>Response note</span>
      <textarea required maxLength={plan ? 2000 : 1000} value={responseNote} disabled={disabled}
        onChange={(event) => setResponseNote(event.target.value)} />
    </label>
    <div className="form-actions"><button className="primary-button" disabled={disabled || !decision || !responseNote.trim()}>
      Save decision
    </button></div>
  </form>;
}

export default function GraduationReview({ token, role }) {
  const detail = useRef(null);
  const openedPlan = useRef(null);
  const coordinator = role === "coordinator";
  const [kind, setKind] = useState(() => coordinator && new URLSearchParams(window.location.search).get("queue") === "exams" ? "exit-exams" : "plans");
  const [inputs, setInputs] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState([]);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page) });
      for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
      try {
        const data = await api(`${root}/${kind}${kind === "plans" ? `?${params}` : ""}`, { token, signal: controller.signal });
        if (controller.signal.aborted) return;
        setResult(data);
        const lastPage = Math.max(1, Math.ceil(data.total / data.limit));
        if (kind === "plans" && page > lastPage) setPage(lastPage);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setResult(null);
          setError(explainApiError(requestError, "Graduation review"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [token, kind, filters, page, refresh]);

  useEffect(() => {
    if (selected) detail.current?.focus();
  }, [selected]);

  function changeView(nextKind) {
    setSelected(null);
    setNotice("");
    setIssues([]);
    setKind(nextKind);
  }

  function applyFilters(next) {
    setSelected(null);
    setPage(1);
    setFilters({ ...next });
  }

  async function decide(body) {
    setBusy(true);
    setError("");
    setIssues([]);
    setNotice("");
    try {
      const current = kind === "plans" ? { submittedAt: selected.submittedAt ?? null } : {};
      const saved = await api(`${root}/${kind}/${selected._id}/decision`, {
        token, method: "POST", body: { ...body, ...current },
      });
      setNotice(saved.status === "draft" ? "Plan returned to the advisor as a private draft." : `Decision saved. ${labels[saved.status]}.`);
      setSelected(null);
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(explainApiError(requestError, "Graduation review"));
      setIssues(requestError.data?.issues ?? []);
    } finally {
      setBusy(false);
    }
  }

  function reload() {
    setSelected(null);
    setIssues([]);
    setRefresh((value) => value + 1);
  }
  function open(row) {
    openedPlan.current = row._id;
    setSelected(row);
    setIssues([]);
    setError("");
  }
  function close(event) {
    const surface = event.currentTarget.getRootNode();
    setSelected(null);
    requestAnimationFrame(() => surface.querySelector(`[data-open-plan="${openedPlan.current}"]`)?.focus());
  }
  const plans = kind === "plans";
  const rows = (plans ? result?.plans : result?.requests) ?? [];
  return <div className={`page-stack workspace-page graduation-review-page${coordinator ? "" : " advisor-graduation-review"}`}>
    {coordinator ? <WorkspaceHeader title="Graduation review" /> : <header className="submission-masthead">
      <div>
        <h1>My submitted plans</h1>
        <img src="/portal-studio/images/graduation-cap.svg" width="66" height="56" alt="" />
      </div>
      <p>See the graduation plans you sent to the coordinator and which ones have been accepted.</p>
    </header>}
    {coordinator && <div className="tabs" role="group" aria-label="Review queue">
      <button aria-pressed={plans}
        disabled={busy} onClick={() => changeView("plans")}>Graduation plans</button>
      <button aria-pressed={!plans}
        disabled={busy} onClick={() => changeView("exit-exams")}>Exit-exam requests</button>
    </div>}
    {coordinator && plans && <form className="panel form-stack" onSubmit={(event) => { event.preventDefault(); applyFilters(inputs); }}>
      <FilterDisclosure floating search={<label className="field filter-search"><span>Student or advisor</span>
          <input type="search" name="graduation-search" autoComplete="off" placeholder="Student ID, advisor name or email…" maxLength={200} value={inputs.search}
            onChange={(event) => { const search = event.target.value; setInputs({ ...inputs, search }); applyFilters({ ...filters, search }); }} />
        </label>} actions={<><button type="button" className="text-button" disabled={busy || !Object.values(inputs).some(Boolean) && !Object.values(filters).some(Boolean)} onClick={() => { setInputs(emptyFilters); applyFilters(emptyFilters); }}>Clear</button></>}
        chips={Object.entries(filters).filter(([key,value]) => key !== "search" && value).map(([key,value]) => ({
          key, label: key === "advisor" ? result?.advisors?.find(advisor => advisor._id === value)?.fullName || "Advisor" : key === "status" ? labels[value] : (key === "from" ? "From " : "Through ") + value,
          onRemove: () => { setInputs({ ...inputs, [key]: "" }); applyFilters({ ...filters, [key]: "" }); },
        }))}>{({ close }) => <><div className="filter-grid">
        <label className="field"><span>Status</span>
          <select value={inputs.status} onChange={(event) => setInputs({ ...inputs, status: event.target.value })}>
            <option value="">All submitted statuses</option>
            <option value="submitted">Awaiting review</option><option value="accepted">Accepted</option>
          </select>
        </label>
        <label className="field"><span>Advisor</span>
          <select value={inputs.advisor} onChange={(event) => setInputs({ ...inputs, advisor: event.target.value })}>
            <option value="">All advisors</option>
            {(result?.advisors ?? []).map((advisor) => <option key={advisor._id} value={advisor._id}>{advisor.fullName} · {advisor.email}</option>)}
          </select>
        </label>
        <label className="field"><span>Submitted from (UTC)</span>
          <input type="date" data-calendar-range="graduation-review" data-calendar-edge="start" value={inputs.from} max={inputs.to || undefined}
            onChange={(event) => setInputs({ ...inputs, from: event.target.value })} />
        </label>
        <label className="field"><span>Submitted through (UTC)</span>
          <input type="date" data-calendar-range="graduation-review" data-calendar-edge="end" value={inputs.to} min={inputs.from || undefined}
            onChange={(event) => setInputs({ ...inputs, to: event.target.value })} />
        </label>
      </div>
      <div className="filter-panel-actions"><button className="primary-button" disabled={busy} onClick={() => setTimeout(close, 0)}>Apply filters</button></div>
      </>}</FilterDisclosure>
    </form>}
    {notice && <div className="feedback success" role="status">{notice}</div>}
    {error && <div className="feedback error" role="alert">{error}{issues.length > 0 &&
      <ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
      {!result && <button type="button" className="outline-button" onClick={reload}>Try again</button>}
    </div>}
    <section aria-busy={loading}>
      {loading ? <p role="status">Loading {plans ? "submitted plans" : "exit-exam requests"}…</p> : !rows.length ? !error && <GraduationEmpty heading="h2" submitted={plans}
        title={plans && Object.values(filters).some(Boolean) ? "No matching plans" : plans ? "No submitted plans" : "No exit-exam requests"}
        description={plans && Object.values(filters).some(Boolean) ? "Try another student, advisor or submission date." : plans
          ? coordinator ? "Plans will appear here when advisors submit them." : "Plans you send for coordinator review will appear here."
          : "Requests will appear here when advisors submit them."} /> :
        !coordinator ? <AdvisorSubmissions rows={rows} /> :
        <div className={`table-scroll graduation-register${coordinator ? " register-with-actions" : ""}`}><table>
          <thead><tr><th>Student</th>{coordinator && <th>Advisor</th>}{!plans && <th>Course</th>}
            <th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row._id}>
            <td><StudentIdentity name={row.student?.user?.fullName} id={row.student?.studentId} /></td>
            {coordinator && <td>{row.advisor?.fullName ?? "Former advisor"}</td>}
            {!plans && <td>{row.course?.code ?? "Archived course"}</td>}
            <td><Status status={row.status} /></td>
            <td>{dateLabel(plans ? row.submittedAt : row.createdAt)}</td>
            <td><button className="text-button" disabled={busy} data-open-plan={row._id} onClick={() => open(row)}>
              {plans ? "Open plan" : "Open request"}
            </button></td>
          </tr>)}</tbody>
        </table></div>}
      {plans && result?.total > result?.limit && <div className="form-actions">
        <button className="outline-button" disabled={loading || busy || page === 1}
          onClick={() => { setSelected(null); setPage(page - 1); }}>Previous</button>
        <span>Page {page} of {Math.ceil(result.total / result.limit)}</span>
        <button className="outline-button" disabled={loading || busy || page * result.limit >= result.total}
          onClick={() => { setSelected(null); setPage(page + 1); }}>Next</button>
      </div>}
    </section>
    {selected && <section ref={detail} className="panel review-decision" id="review-decision" tabIndex={-1}>
      <div className="results-heading">
        <div><h2>{plans ? "Graduation plan" : "Exit-exam request"}</h2><StudentIdentity name={selected.student?.user?.fullName} id={selected.student?.studentId} /></div>
        <button className="outline-button" disabled={busy} onClick={close}>Close</button>
      </div>
      <div className="plan-review-status"><Status status={selected.status} />
      </div>
      {plans ? <PlanCourses plan={selected} /> : <>
        <p><strong>Course</strong> {selected.course?.code} {selected.course?.name}</p>
        <p><strong>Advisor’s reason</strong> {selected.reason}</p>
        {selected.responseNote && <p><strong>Coordinator response</strong> {selected.responseNote}</p>}
      </>}
      {coordinator && selected.status === (plans ? "submitted" : "pending") &&
        <DecisionForm key={selected._id} kind={kind} disabled={busy} decide={decide} />}
    </section>}
  </div>;
}

function GraduationResponse({ note }) {
  return note && <div className="graduation-response">
    <p className="graduation-meta">Coordinator response</p>
    <p>{note}</p>
  </div>;
}

function StudentPlanTerms({ plan }) {
  return orderedTerms(plan).map(({ term, courses }, index) => (
    <div className="graduation-term" key={term?._id ?? index}>
      <div className="graduation-term-heading">
        <h4>{term ? termLabel(term) : "Archived term"}</h4>
        <span>{creditLabel(courses.reduce((sum, course) => sum + course.creditHours, 0))} total</span>
      </div>
      {courses.length ? <ul className="graduation-course-list" role="list">
        {courses.map((course) => <li key={course._id ?? course.code}>
          <OfferingCourseIcon code={course.code} />
          <div><strong>{course.name}</strong><span className="graduation-meta">{course.code}</span></div>
          <span className="graduation-course-credits">{creditLabel(course.creditHours)}</span>
        </li>)}
      </ul> : <p className="graduation-meta">No courses listed for this term.</p>}
    </div>
  ));
}

export function StudentGraduation({ token, embedded = false }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api(`${root}/me`, { token, signal: controller.signal }).then(setResult).catch((requestError) => {
      if (!controller.signal.aborted) setError(explainApiError(requestError, "My graduation"));
    });
    return () => controller.abort();
  }, [token, refresh]);
  return <div className="page-stack student-graduation">
    {!embedded && <WorkspaceHeader title="My graduation" description="See your accepted graduation plans and exit-exam decisions." />}
    {error && <div className="feedback error" role="alert">{error} <button type="button" className="outline-button" onClick={() => {
      setError("");
      setRefresh(value => value + 1);
    }}>Try again</button></div>}
    <section className="panel" aria-labelledby="accepted-plans-heading">
      <div className="graduation-section-heading">
        <h2 id="accepted-plans-heading">Accepted graduation plans</h2>
      </div>
      {!result && !error && <p role="status">Loading graduation records…</p>}
      {result && (result.plans.length ? result.plans.map((plan) => (
        <article className="graduation-record" key={plan._id}>
          <header className="graduation-record-heading">
            <div>
              <h3>Graduation plan</h3>
              {plan.decidedAt && <p className="graduation-meta">Accepted on <time dateTime={plan.decidedAt}>{studentDate.format(new Date(plan.decidedAt))}</time></p>}
            </div>
            <Status status="accepted" />
          </header>
          <StudentPlanTerms plan={plan} />
          {plan.exitExamRequest && <div className="graduation-exam-course">
            {plan.exitExamRequest.course && <OfferingCourseIcon code={plan.exitExamRequest.course.code} />}
            <p className="graduation-meta">Approved exit exam · {plan.exitExamRequest.course?.code ?? "Archived course"}</p>
          </div>}
          <GraduationResponse note={plan.responseNote} />
        </article>
      )) : <div className="graduation-empty">
        <img src="/portal-studio/images/graduation-plan-sheet.svg" width="244" height="160" alt="" />
        <p>No graduation plan has been accepted yet.</p>
      </div>)}
    </section>
    {result && <section className="panel" aria-labelledby="exit-exams-heading">
      <div className="graduation-section-heading"><h2 id="exit-exams-heading">Exit-exam requests</h2></div>
      {result.exams.length ? result.exams.map((exam) => (
        <article className="graduation-record" key={exam._id}>
          <header className="graduation-record-heading">
            <div className="graduation-exam-course">
              {exam.course && <OfferingCourseIcon code={exam.course.code} />}
              <div>
                <h3>{exam.course?.name ?? "Archived course"}</h3>
                {(exam.course?.code || exam.createdAt) && <p className="graduation-meta">
                  {exam.course?.code}{exam.course?.code && exam.createdAt && " · "}
                  {exam.createdAt && <>Requested on <time dateTime={exam.createdAt}>{studentDate.format(new Date(exam.createdAt))}</time></>}
                </p>}
              </div>
            </div>
            <Status status={exam.status} />
          </header>
          <GraduationResponse note={exam.responseNote} />
        </article>
      )) : <div className="graduation-empty">
        <img src="/portal-studio/images/exit-exam-form.svg" width="158" height="116" alt="" />
        <p>No exit exam has been requested for you.</p>
      </div>}
    </section>}
  </div>;
}
