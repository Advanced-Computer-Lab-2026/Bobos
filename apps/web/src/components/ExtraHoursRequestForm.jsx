import { termLabel } from "../term-label.js";
import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function ExtraHoursRequestForm({ token, advisorId, onClose, onSubmitted }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const options = { token, signal: controller.signal };
    const loadStudents = async () => {
      const path = `/api/advisor/students?advisorId=${encodeURIComponent(advisorId)}&limit=100`;
      const first = await api(path, options);
      const students = [...first.data];
      for (let page = 2; page <= first.pagination.pages; page += 1) {
        students.push(...(await api(`${path}&page=${page}`, options)).data);
      }
      return students;
    };
    Promise.all([loadStudents(), api("/api/catalogue/courses", options), api("/api/academic-terms", options)])
      .then(([students, catalogue, terms]) => {
        if (!controller.signal.aborted) setData({ students, courses: catalogue.filter((course) => course.isActive), terms });
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [token, advisorId]);

  async function submit(event) {
    event.preventDefault();
    if (saving || !selected.length) return;
    const { studentId, termId, graduating } = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError("");
    try {
      await api("/api/extra-hours", {
        token, method: "POST", body: {
          studentId, termId, courseIds: selected,
          ...(graduating && { graduatingWithinOneYear: graduating === "yes" }),
        },
      });
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const matches = data?.courses.filter((course) =>
    `${course.code} ${course.name}`.toLowerCase().includes(query.trim().toLowerCase())) || [];
  const chosen = data?.courses.filter((course) => selected.includes(course._id)) || [];
  const hours = chosen.reduce((total, course) => total + course.creditHours, 0);

  return <section className="panel" id="extra-hours-new">
    <div className="results-heading">
      <h2>New extra-hours request</h2>
      <button type="button" className="text-button" onClick={onClose} disabled={saving}>Close form</button>
    </div>
    {error && <p className="feedback error" role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading assigned students, terms and courses…</p>}
    {data && <form className="form-stack" onSubmit={submit}>
      <div className="filter-grid">
        <label className="field"><span>Assigned student</span>
          <select name="studentId" required defaultValue="" disabled={saving}>
            <option value="">{data.students.length ? "Select a student" : "No assigned advising students"}</option>
            {data.students.map((student) => <option key={student._id} value={student._id}>{student.user?.fullName} · {student.studentId}</option>)}
          </select>
        </label>
        <label className="field"><span>Academic term</span>
          <select name="termId" required defaultValue={data.terms.find((term) => term.isActive)?._id || ""} disabled={saving}>
            <option value="">Select a term</option>
            {data.terms.map((term) => <option key={term._id} value={term._id}>{termLabel(term)}{term.isActive ? " (active)" : ""}</option>)}
          </select>
        </label>
        <label className="field"><span>Graduating within one year</span>
          <select name="graduating" defaultValue="" disabled={saving}>
            <option value="">Use current semester</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </label>
      </div>
      <label className="field"><span>Find courses</span>
        <input type="search" placeholder="Search by code or name" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <fieldset className="extra-hours-course-picker" disabled={saving}>
        <legend>Courses to request</legend>
        {matches.map((course) => <label key={course._id}>
          <input type="checkbox" checked={selected.includes(course._id)} onChange={(event) => {
            setSelected((ids) => event.target.checked ? [...ids, course._id] : ids.filter((id) => id !== course._id));
          }} />
          <span><strong>{course.code}</strong> · {course.name}</span>
          <small>{course.creditHours} hrs</small>
        </label>)}
        {!matches.length && <p className="helper-text">No active courses match your search.</p>}
      </fieldset>
      <p className="helper-text" aria-live="polite">{chosen.length} selected · {hours} credit hours{chosen.length ? ` · ${chosen.map((course) => course.code).join(", ")}` : ""}</p>
      <div className="form-actions"><button className="primary-button" disabled={saving || !selected.length}>{saving ? "Submitting…" : "Submit for review"}</button></div>
    </form>}
  </section>;
}
