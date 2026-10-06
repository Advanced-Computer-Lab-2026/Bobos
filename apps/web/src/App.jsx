import { useEffect, useState } from "react";

const emptyFilters = {
  search: "",
  studentType: "",
  advisor: "",
  major: "",
  currentSemester: "",
  academicStanding: "",
  workflowStatus: "",
  blockingStep: "",
  accountStatus: "",
};

const humanize = (value = "") => (value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());

async function apiRequest(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || "Request failed");
  return body;
}

function SelectFilter({ label, value, onChange, options, placeholder = "All", disabled = false }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={onChange} disabled={disabled}>
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: humanize(option) } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </label>
  );
}

export default function App() {
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [directory, setDirectory] = useState({ students: [], filters: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [studentDetails, setStudentDetails] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [advisorEmail, setAdvisorEmail] = useState("");
  const [advisor, setAdvisor] = useState(null);
  const [advisorError, setAdvisorError] = useState("");
  const [advisorMessage, setAdvisorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(
      Object.entries(appliedFilters).filter(([, value]) => value),
    );

    setLoading(true);
    setError("");
    fetch(`/api/admin/students?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.message || "Could not load students");
        if (!body) throw new Error("Could not load students");
        setDirectory(body);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError instanceof TypeError ? "Student directory service is unavailable." : requestError.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [appliedFilters]);

  const updateFilter = (key) => (event) => {
    const value = event.target.value;
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "studentType" && value === "normal" ? { advisor: "" } : {}),
    }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const openStudent = async (id) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setStudentDetails(null);
    setDetailsError("");
    try {
      setStudentDetails(await apiRequest(`/api/admin/students/${id}`));
    } catch (requestError) {
      setDetailsError(requestError.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateAccount = async () => {
    const user = studentDetails.user;
    try {
      const updatedUser = await apiRequest(`/api/admin/users/${user._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      setStudentDetails((current) => ({ ...current, user: { ...current.user, isActive: updatedUser.isActive } }));
      setDirectory((current) => ({
        ...current,
        students: current.students.map((student) => student.id === String(studentDetails._id)
          ? { ...student, accountStatus: updatedUser.isActive ? "active" : "inactive" }
          : student),
      }));
    } catch (requestError) {
      setDetailsError(requestError.message);
    }
  };

  const lookupAdvisor = async (event) => {
    event.preventDefault();
    setAdvisor(null);
    setAdvisorError("");
    setAdvisorMessage("");
    try {
      setAdvisor(await apiRequest(`/api/admin/advisors/lookup?email=${encodeURIComponent(advisorEmail)}`));
    } catch (requestError) {
      setAdvisorError(requestError.message);
    }
  };

  const changeAdvisor = async (add) => {
    setAdvisorError("");
    setAdvisorMessage("");
    try {
      const result = await apiRequest(add ? "/api/admin/advisors" : `/api/admin/advisors/${encodeURIComponent(advisor.email)}`, {
        method: add ? "POST" : "DELETE",
        ...(add ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: advisor.email }) } : {}),
      });
      setAdvisor((current) => ({ ...current, isAdvisorInSystem: add }));
      setAdvisorMessage(add ? `Advisor added. Email status: ${result.emailStatus}.` : `Advisor removed. Email status: ${result.emailStatus}.`);
      setAppliedFilters((current) => ({ ...current }));
    } catch (requestError) {
      setAdvisorError(requestError.message);
    }
  };

  const students = directory.students || [];
  const options = directory.filters || {};

  return (
    <main className="directory-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Student directory</h1>
        </div>
        <p className="term-label">
          {directory.term ? `${humanize(directory.term.season)} ${directory.term.academicYear}` : "No active term"}
        </p>
      </header>

      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedFilters({ ...filters });
        }}
      >
        <label className="filter-field search-field">
          <span>Search students</span>
          <input
            type="search"
            value={filters.search}
            onChange={updateFilter("search")}
            placeholder="ID, name, or email"
            maxLength={100}
          />
        </label>
        <SelectFilter label="Student type" value={filters.studentType} onChange={updateFilter("studentType")} options={options.studentTypes || []} />
        <SelectFilter
          label="Advisor"
          value={filters.advisor}
          onChange={updateFilter("advisor")}
          options={(options.advisors || []).map((advisor) => ({ value: advisor.id, label: advisor.fullName }))}
          disabled={filters.studentType === "normal"}
        />
        <SelectFilter label="Major" value={filters.major} onChange={updateFilter("major")} options={options.majors || []} />
        <SelectFilter
          label="Current semester"
          value={filters.currentSemester}
          onChange={updateFilter("currentSemester")}
          options={Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))}
        />
        <SelectFilter label="Academic standing" value={filters.academicStanding} onChange={updateFilter("academicStanding")} options={options.academicStandings || []} />
        <SelectFilter label="Workflow status" value={filters.workflowStatus} onChange={updateFilter("workflowStatus")} options={options.workflowStatuses || []} />
        <SelectFilter label="Blocking step" value={filters.blockingStep} onChange={updateFilter("blockingStep")} options={options.blockingSteps || []} />
        <SelectFilter
          label="Account status"
          value={filters.accountStatus}
          onChange={updateFilter("accountStatus")}
          options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
        />
        <div className="filter-actions">
          <button className="primary-button" type="submit">Apply filters</button>
          <button className="text-button" type="button" onClick={clearFilters}>Clear</button>
        </div>
      </form>

      <section className="results" aria-label="Student results" aria-busy={loading}>
        <div className="results-heading">
          <h2>Students</h2>
          <span>{loading ? "Loading" : error ? "Unavailable" : `${students.length} students`}</span>
        </div>
        {error ? (
          <p className="feedback error" role="alert">{error}</p>
        ) : loading ? (
          <p className="feedback">Loading students…</p>
        ) : students.length === 0 ? (
          <p className="feedback">No students match these filters.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Student ID</th>
                  <th scope="col">Name and email</th>
                  <th scope="col">Type</th>
                  <th scope="col">Major</th>
                  <th scope="col">Semester</th>
                  <th scope="col">Standing</th>
                  <th scope="col">Advisor</th>
                  <th scope="col">Account</th>
                  <th scope="col">Workflow status</th>
                  <th scope="col">Blocking step</th>
                  <th scope="col">Last update</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td className="student-id"><button className="text-button" type="button" onClick={() => openStudent(student.id)}>{student.studentId}</button></td>
                    <td><strong>{student.fullName || "—"}</strong><span className="secondary-text">{student.email}</span></td>
                    <td>{humanize(student.studentType)}</td>
                    <td>{student.major || "—"}</td>
                    <td>{student.currentSemester}</td>
                    <td>{humanize(student.academicStanding) || "—"}</td>
                    <td>{student.assignedAdvisor?.fullName || "—"}</td>
                    <td>{humanize(student.accountStatus) || "—"}</td>
                    <td>{humanize(student.workflowStatus) || "—"}</td>
                    <td>{humanize(student.blockingStep) || "—"}</td>
                    <td>{student.lastUpdatedAt ? new Date(student.lastUpdatedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {directory.currentUserRole === "coordinator" && (
        <section className="advisor-management" aria-labelledby="advisor-heading">
          <h2 id="advisor-heading">Advisors</h2>
          <form className="advisor-lookup" onSubmit={lookupAdvisor}>
            <label className="filter-field">
              <span>Advisor GUC email</span>
              <input type="email" required value={advisorEmail} onChange={(event) => setAdvisorEmail(event.target.value)} />
            </label>
            <button className="primary-button" type="submit">Look up advisor</button>
          </form>
          {advisorError && <p className="feedback error" role="alert">{advisorError}</p>}
          {advisorMessage && <p className="feedback" role="status">{advisorMessage}</p>}
          {advisor && (
            <div className="advisor-result">
              <p><strong>{advisor.fullName}</strong><span className="secondary-text">{advisor.email}</span></p>
              <span>{advisor.isAdvisorInSystem ? "In advising system" : "Not in advising system"}</span>
              <button className="primary-button" type="button" onClick={() => changeAdvisor(!advisor.isAdvisorInSystem)}>
                {advisor.isAdvisorInSystem ? "Remove advisor" : "Add advisor"}
              </button>
            </div>
          )}
          <p className="secondary-text">Email delivery requires SMTP settings in `.env`.</p>
        </section>
      )}

      {detailsOpen && (
        <div className="details-backdrop">
          <section className="student-details" role="dialog" aria-modal="true" aria-labelledby="details-heading">
            <div className="details-heading">
              <h2 id="details-heading">Student details</h2>
              <button className="text-button" type="button" onClick={() => setDetailsOpen(false)}>Close</button>
            </div>
            {detailsError && <p className="feedback error" role="alert">{detailsError}</p>}
            {detailsLoading ? <p className="feedback">Loading student…</p> : studentDetails && (
              <dl className="details-list">
                <dt>Student ID</dt><dd>{studentDetails.studentId}</dd>
                <dt>Name</dt><dd>{studentDetails.user?.fullName}</dd>
                <dt>Email</dt><dd>{studentDetails.user?.email}</dd>
                <dt>Student type</dt><dd>{humanize(studentDetails.studentType)}</dd>
                <dt>Major</dt><dd>{studentDetails.major}</dd>
                <dt>Semester</dt><dd>{studentDetails.currentSemester}</dd>
                <dt>Academic standing</dt><dd>{humanize(studentDetails.academicStanding)}</dd>
                <dt>GPA</dt><dd>{studentDetails.gpa}</dd>
                <dt>Enrollment</dt><dd>{humanize(studentDetails.enrollmentStatus)}</dd>
                <dt>Advisor</dt><dd>{studentDetails.assignedAdvisor?.fullName || "—"}</dd>
                <dt>Account</dt><dd>{studentDetails.user?.isActive ? "Active" : "Inactive"}</dd>
              </dl>
            )}
            {!detailsLoading && studentDetails?.user && directory.currentUserRole === "administrator" && (
              <button className="primary-button" type="button" onClick={updateAccount}>
                {studentDetails.user?.isActive ? "Deactivate account" : "Activate account"}
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
