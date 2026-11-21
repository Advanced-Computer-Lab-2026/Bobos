import { OpsFrame, OpsTable, OpsSections, OpsFolder, OpsDesignControl, OpsGate, OpsModalFocus } from "./OperationsDesign.jsx";
import { useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";
import { WorkspaceHeader, WorkspaceEmpty } from "../components/WorkspaceUI.jsx";

const root = "/api/graduation";
const emptyFilters = { search: "", status: "", advisor: "", from: "", to: "" };
const labels = { pending: "Pending", approved: "Approved", rejected: "Rejected", submitted: "Awaiting review", accepted: "Accepted" };
const dateLabel = (value) => value ? new Date(value).toLocaleString() : "—";

function Status({ status }) {
  const tone = ["approved", "accepted"].includes(status) ? "good" : status === "rejected" ? "danger" : "warning";
  return <span className={`status-pill ${tone}`}>{labels[status]}</span>;
}

function PlanCourses({ plan }) {
  return <>
    {plan.termPlans.length > 0 && <div className="table-scroll"><OpsTable>
      <thead><tr><th>Term</th><th>Courses</th><th>Credit hours</th></tr></thead>
      <tbody>{[...plan.termPlans].sort((a, b) => (a.term?.termStart ?? "").localeCompare(b.term?.termStart ?? ""))
        .map(({ term, courses }, index) => <tr key={term?._id ?? index}>
          <td>{term ? `${term.code} · ${term.academicYear}` : "Archived term"}</td>
          <td>{courses.map((course) => `${course.code} · ${course.name}`).join(", ") || "—"}</td>
          <td>{courses.reduce((sum, course) => sum + course.creditHours, 0)}</td>
        </tr>)}</tbody>
    </OpsTable></div>}
    {plan.exitExamRequest && <p>Approved exit exam · {plan.exitExamRequest.course?.code ?? "Archived course"}</p>}
    {plan.responseNote && <p><strong>Coordinator response</strong> {plan.responseNote}</p>}
  </>;
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

function GraduationReviewContent({ token, role }) {
  const coordinator = role === "coordinator";
  const [kind, setKind] = useState("plans");
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

  const plans = kind === "plans";
  const rows = (plans ? result?.plans : result?.requests) ?? [];
  return <OpsFrame pageKey={plans?(selected?"graduation-plan-review":"graduation-review"):(selected?"exit-exam-detail":"exit-exam-review")} role={role}><div className="page-stack workspace-page graduation-review-page">
    <WorkspaceHeader title={coordinator ? "Graduation review" : "My submitted plans"} description={coordinator ? "Review graduation plans and exit-exam requests submitted by advisors." : "Track the graduation plans you have submitted for coordinator review."}
      action={<button className="outline-button" disabled={loading || busy} onClick={() => {
        setSelected(null);
        setIssues([]);
        setRefresh((value) => value + 1);
      }}>Refresh</button>} />
    {coordinator && <div className="workspace-tabs" role="group" aria-label="Review queue">
      <button aria-pressed={plans}
        disabled={busy} onClick={() => changeView("plans")}>Graduation plans</button>
      <button aria-pressed={!plans}
        disabled={busy} onClick={() => changeView("exit-exams")}>Exit-exam requests</button>
    </div>}
    {coordinator && plans && !selected && <form className="panel form-stack" onSubmit={(event) => { event.preventDefault(); applyFilters(inputs); }}>
      <div className="filter-grid review-filters">
        <label className="field review-search"><span>Student or advisor</span>
          <input type="search" name="graduation-search" autoComplete="off" placeholder="Student ID, advisor name or email…" maxLength={200} value={inputs.search}
            onChange={(event) => setInputs({ ...inputs, search: event.target.value })} />
        </label>
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
      <div className="filter-actions">
        <button type="button" className="outline-button" disabled={busy} onClick={() => { setInputs(emptyFilters); applyFilters(emptyFilters); }}>
          Clear filters
        </button>
        <button className="primary-button" disabled={busy}>Apply filters</button>
      </div>
    </form>}
    {notice && <div className="feedback success" role="status">{notice}</div>}
    {error && <div className="feedback error" role="alert">{error}{issues.length > 0 &&
      <ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}</div>}
    <section className="panel" hidden={Boolean(selected)}>
      <div className="results-heading"><h2>{plans ? "Submitted plans" : "Exit-exam requests"}</h2><span className="result-count" aria-live="polite">{loading ? "Loading…" : `${plans ? result?.total ?? rows.length : rows.length} ${plans ? "plans" : "requests"}`}</span></div>
      {loading ? <p role="status">Loading…</p> : !rows.length ? <WorkspaceEmpty icon="document" title={plans ? "No submitted plans" : "No exit-exam requests"} description={plans ? "Submitted graduation plans will appear here for review. Clear your filters if you expected to see a plan." : "Requests submitted by advisors will appear here with the course and student details."} /> :
        <div className="table-scroll"><OpsTable>
          <thead><tr><th>Student</th>{coordinator && <th>Advisor</th>}{!plans && <th>Course</th>}
            <th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row._id}>
            <td>{row.student?.user?.fullName ?? "Student"}<span className="secondary-text">{row.student?.studentId}</span></td>
            {coordinator && <td>{row.advisor?.fullName ?? "Former advisor"}</td>}
            {!plans && <td>{row.course?.code ?? "Archived course"}</td>}
            <td><Status status={row.status} /></td>
            <td>{dateLabel(plans ? row.submittedAt : row.createdAt)}</td>
            <td><button className="text-button" disabled={busy} onClick={() => { setSelected(row); setIssues([]); setError(""); }}>
              {plans ? "Open plan" : "Open request"}
            </button></td>
          </tr>)}</tbody>
        </OpsTable></div>}
      {plans && result?.total > result?.limit && <div className="form-actions">
        <button className="outline-button" disabled={loading || busy || page === 1}
          onClick={() => { setSelected(null); setPage(page - 1); }}>Previous</button>
        <span>Page {page} of {Math.ceil(result.total / result.limit)}</span>
        <button className="outline-button" disabled={loading || busy || page * result.limit >= result.total}
          onClick={() => { setSelected(null); setPage(page + 1); }}>Next</button>
      </div>}
    </section>
    {selected && <section className="panel">
      <div className="results-heading">
        <h2>{plans ? "Graduation plan" : "Exit-exam request"} · {selected.student?.studentId}</h2>
        <button className="outline-button" disabled={busy} onClick={() => setSelected(null)}>Close</button>
      </div>
      <OpsSections sections={[
        {id:"record",title:plans?"Submitted plan":"Requested exit exam",content:<><Status status={selected.status}/>{plans?<PlanCourses plan={selected}/>:<><p><strong>Course</strong> {selected.course?.code} {selected.course?.name}</p><p><strong>Advisor’s reason</strong> {selected.reason}</p>{selected.responseNote&&<p><strong>Coordinator response</strong> {selected.responseNote}</p>}</>}</>},
        {id:"decision",title:"Coordinator decision",content:coordinator && selected.status===(plans?"submitted":"pending")?<DecisionForm key={selected._id} kind={kind} disabled={busy} decide={decide}/>:<p>This {plans?"plan":"request"} is read-only. {role==="advisor"?"Only the coordinator can make a decision.":"The recorded decision is shown above."}</p>}
      ]}/>
    </section>}
  </div></OpsFrame>;
}

function StudentGraduationContent({ token, role }) {
  const [section,setSection]=useState("plans");
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
  return <OpsFrame pageKey={section==="plans"?"my-graduation":"my-exit-exams"} role={role}><div className="page-stack">
    <div className="page-title-row">
      <h1>My graduation</h1>
      <button className="outline-button" onClick={() => { setResult(null); setError(""); setRefresh((value) => value + 1); }}>Refresh</button>
    </div>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {!result && !error && <p role="status">Loading…</p>}
    <nav className="ops05-subnav" aria-label="My graduation"><button className="outline-button" type="button" aria-pressed={section==="plans"} onClick={()=>setSection("plans")}>Accepted plans</button><button className="outline-button" type="button" aria-pressed={section==="exams"} onClick={()=>setSection("exams")}>Exit-exam responses</button></nav>
    {result && <>
      <section className="panel" hidden={section!=="plans"}>
        <h2>Accepted graduation plans</h2>
        {!result.plans.length && <p>No graduation plan has been accepted yet.</p>}
        {result.plans.map((plan) => <article key={plan._id}>
          <h3>Accepted {dateLabel(plan.decidedAt)}</h3>
          <PlanCourses plan={plan} />
        </article>)}
      </section>
      <section className="panel" hidden={section!=="exams"}><h2>Exit-exam responses</h2>{!result.exams.length?<p>No exit exam has been requested for you.</p>:<div className="table-scroll"><OpsTable><thead><tr><th>Course</th><th>Status</th><th>Requested</th><th>Coordinator response</th></tr></thead><tbody>{result.exams.map(exam=><tr key={exam._id}><td>{exam.course?`${exam.course.code} · ${exam.course.name}`:"Archived course"}</td><td><Status status={exam.status}/></td><td>{dateLabel(exam.createdAt)}</td><td>{exam.responseNote||"Awaiting response"}</td></tr>)}</tbody></OpsTable></div>}</section>
    </>}
  </div></OpsFrame>;
}

export default function GraduationReview(props){return <OpsGate pageKey="graduation-review" role={props.role}><GraduationReviewContent {...props}/></OpsGate>;}
export function StudentGraduation(props){return <OpsGate pageKey="my-graduation" role={props.role}><StudentGraduationContent {...props}/></OpsGate>;}
