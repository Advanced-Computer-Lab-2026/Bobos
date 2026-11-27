import { termLabel } from "../term-label.js";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Modal } from "./AcademicWorkspace.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";

export default function ExtraHoursRequestForm({ token, advisorId, onClose, onSubmitted }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const courseSearch = useRef(null);

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

  return <Modal title="New extra-hours request" className="extra-compose-dialog" wide onClose={() => { if (!saving) onClose(); }}>
    <div className="extra-compose-body">
      {error && <p className="feedback error" role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading assigned students, terms and courses…</p>}
      {data && <form className="extra-compose-form" onSubmit={submit}>
        <div className="extra-compose-fields">
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
        <div className="extra-compose-selection">
          <section aria-labelledby="extra-compose-catalogue">
            <h3 id="extra-compose-catalogue">Courses to request</h3>
            <label className="field"><span>Find courses</span>
              <input type="search" ref={courseSearch} placeholder="Search by code or name" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <fieldset className="extra-hours-course-picker" aria-labelledby="extra-compose-catalogue" disabled={saving}>
              {matches.map((course) => <label key={course._id}>
                <input type="checkbox" checked={selected.includes(course._id)} onChange={(event) => {
                  setSelected((ids) => event.target.checked ? [...ids, course._id] : ids.filter((id) => id !== course._id));
                }} />
                <OfferingCourseIcon code={course.code} />
                <span><strong>{course.name}</strong><small>{course.code}</small></span>
                <small>{course.creditHours} h</small>
              </label>)}
              {!matches.length && <p className="helper-text">No active courses match your search.</p>}
            </fieldset>
          </section>
          <section className="extra-compose-summary" aria-labelledby="extra-compose-summary-title">
            <h3 id="extra-compose-summary-title">Request summary</h3>
            <p aria-live="polite"><strong>{hours}</strong> credit {hours === 1 ? "hour" : "hours"} across {chosen.length} {chosen.length === 1 ? "course" : "courses"}</p>
            {chosen.length > 0 && <ul role="list">
              {chosen.map((course) => <li key={course._id}>
                <span>{course.name}<small>{course.code} · {course.creditHours} h</small></span>
                <button type="button" className="icon-button" aria-label={`Remove ${course.name}`} disabled={saving}
                  onClick={() => {
                    setSelected(ids => ids.filter(id => id !== course._id));
                    courseSearch.current?.focus();
                  }}>×</button>
              </li>)}
            </ul>}
          </section>
        </div>
        <div className="form-actions">
          <button type="button" className="outline-button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" disabled={saving || !selected.length}>{saving ? "Submitting…" : "Submit for review"}</button>
        </div>
      </form>}
    </div>
  </Modal>;
}
