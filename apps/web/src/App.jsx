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

function SelectFilter({ label, value, onChange, options, placeholder = "All" }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={onChange}>
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
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
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
                    <td className="student-id">{student.studentId}</td>
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
    </main>
  );
}
