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

function AdvisorSubmission({ plan, multiple, first }) {
  const courses = plan.termPlans.flatMap(term => term.courses);
  const summary = <>
    <StudentIdentity name={plan.student?.user?.fullName} id={plan.student?.studentId} />
    <span className="submission-load">{plan.termPlans.length} {plan.termPlans.length === 1 ? "term" : "terms"} · {courses.length} {courses.length === 1 ? "course" : "courses"} · {creditLabel(courses.reduce((sum, course) => sum + course.creditHours, 0))}</span>
    <Status status={plan.status} />
  </>;
  const content = <div className="submission-body">
    <section className="submission-courses">
      <h3>Courses by term</h3>
      {plan.termPlans.length ? <StudentPlanTerms plan={plan} /> : <p>No term courses in this plan.</p>}
      {plan.exitExamRequest && <div className="graduation-exam-course">
        <OfferingCourseIcon code={plan.exitExamRequest.course?.code} />
        <div><strong>Approved exit exam</strong><p>{plan.exitExamRequest.course?.name || "Archived course"} · {plan.exitExamRequest.course?.code || "—"}</p></div>
      </div>}
    </section>
    <section className="submission-history">
      <h3>Review history</h3>
      <ol>
        <li><strong>Submitted for review</strong>
          {plan.submittedAt && <time dateTime={plan.submittedAt}>{studentDate.format(new Date(plan.submittedAt))}</time>}
          {plan.advisor?.fullName && <span>{plan.advisor.fullName}</span>}
        </li>
        <li className={plan.status === "accepted" ? "accepted" : "waiting"}><strong>{plan.status === "accepted" ? "Accepted by coordinator" : "Awaiting coordinator decision"}</strong>
          {plan.status === "accepted" && plan.decidedAt && <time dateTime={plan.decidedAt}>{studentDate.format(new Date(plan.decidedAt))}</time>}
        </li>
      </ol>
      <GraduationResponse note={plan.responseNote} />
    </section>
  </div>;
  return multiple ? <details className="submission-sheet" open={first}>
    <summary className="submission-heading">{summary}<span className="submission-chevron" aria-hidden="true" /></summary>
    {content}
  </details> : <article className="submission-sheet">
    <header className="submission-heading">{summary}</header>
    {content}
  </article>;
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
  return <div className="page-stack workspace-page graduation-review-page">
    <WorkspaceHeader title={coordinator ? "Graduation review" : "My submitted plans"} action={!(coordinator && plans) && <button className="outline-button" disabled={loading || busy} onClick={reload}>Refresh</button>} />
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
        </label>} actions={<><button type="button" className="text-button" disabled={busy || !Object.values(inputs).some(Boolean) && !Object.values(filters).some(Boolean)} onClick={() => { setInputs(emptyFilters); applyFilters(emptyFilters); }}>Clear</button>
          <button type="button" className="text-button" disabled={loading || busy} onClick={reload}>Refresh</button></>}
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
          <input type="date" value={inputs.from} max={inputs.to || undefined}
            onChange={(event) => setInputs({ ...inputs, from: event.target.value })} />
        </label>
        <label className="field"><span>Submitted through (UTC)</span>
          <input type="date" value={inputs.to} min={inputs.from || undefined}
            onChange={(event) => setInputs({ ...inputs, to: event.target.value })} />
        </label>
      </div>
      <div className="filter-panel-actions"><button className="primary-button" disabled={busy} onClick={() => setTimeout(close, 0)}>Apply filters</button></div>
      </>}</FilterDisclosure>
    </form>}
    {notice && <div className="feedback success" role="status">{notice}</div>}
    {error && <div className="feedback error" role="alert">{error}{issues.length > 0 &&
      <ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div>}
    <section aria-busy={loading}>
      {loading ? <p role="status">Loading {plans ? "submitted plans" : "exit-exam requests"}…</p> : !rows.length ? !error && <GraduationEmpty heading="h2" submitted={plans}
        title={plans && Object.values(filters).some(Boolean) ? "No matching plans" : plans ? "No submitted plans" : "No exit-exam requests"}
        description={plans && Object.values(filters).some(Boolean) ? "Try another student, advisor or submission date." : plans
          ? coordinator ? "Plans will appear here when advisors submit them." : "Plans you send for coordinator review will appear here."
          : "Requests will appear here when advisors submit them."} /> :
        !coordinator ? <div className="advisor-submissions">
          {result.total > 1 && <h2>{result.total} submitted plans</h2>}
          {rows.map((plan, index) => <AdvisorSubmission key={plan._id} plan={plan} multiple={result.total > 1} first={index === 0} />)}
        </div> :
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
  const refreshButton = <button type="button" className="outline-button" disabled={!result && !error} onClick={() => {
    setResult(null);
    setError("");
    setRefresh((value) => value + 1);
  }}>Refresh</button>;
  return <div className="page-stack student-graduation">
    {!embedded && <WorkspaceHeader title="My graduation" description="See your accepted graduation plans and exit-exam decisions." />}
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel" aria-labelledby="accepted-plans-heading">
      <div className="graduation-section-heading">
        <h2 id="accepted-plans-heading">Accepted graduation plans</h2>
        {refreshButton}
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
      )) : <p className="graduation-record-empty">No graduation plan has been accepted yet.</p>)}
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
      )) : <p className="graduation-record-empty">No exit exam has been requested for you.</p>}
    </section>}
  </div>;
}
