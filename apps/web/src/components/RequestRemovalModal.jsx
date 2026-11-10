import { useEffect, useState, useCallback } from "react";
import { api, explainApiError } from "../api.js";

const REASON_OPTIONS = [
  { value: "incorrectMandatoryDesignation", label: "Incorrect Mandatory Designation" },
  { value: "makeupEligibility", label: "Makeup Eligibility" },
  { value: "completedHours", label: "Completed Hours" },
  { value: "restrictedCoursePair", label: "Restricted Course Pair" },
  { value: "other", label: "Other" },
];

export default function RequestRemovalModal({
  token,
  onClose,
  onSuccess,
  initialStudent = null,
  initialTermId = "",
}) {
  const [students, setStudents] = useState([]);
  const [terms, setTerms] = useState([]);
  const [catalogueCourses, setCatalogueCourses] = useState([]);
  const [mandatoryCourses, setMandatoryCourses] = useState([]);

  const [studentProfileId, setStudentProfileId] = useState(initialStudent?._id || "");
  const [termId, setTermId] = useState(initialTermId || "");
  const [courseId, setCourseId] = useState("");
  const [reason, setReason] = useState("incorrectMandatoryDesignation");
  const [explanation, setExplanation] = useState("");

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadData() {
      setLoadingInitial(true);
      setError("");
      try {
        const [studentRes, termRes, courseRes] = await Promise.all([
          api("/api/advisor/students?limit=100", { token }).catch(() => ({ data: [] })),
          api("/api/academic-terms", { token }).catch(() => []),
          api("/api/catalogue/courses", { token }).catch(() => ({ courses: [] })),
        ]);

        if (!alive) return;

        const studentList = studentRes.data || studentRes.students || (Array.isArray(studentRes) ? studentRes : []);
        setStudents(studentList);

        const termList = Array.isArray(termRes) ? termRes : termRes.terms || [];
        setTerms(termList);

        const activeTerm = termList.find((t) => t.isActive);
        if (!termId && activeTerm) {
          setTermId(activeTerm._id);
        } else if (!termId && termList.length > 0) {
          setTermId(termList[0]._id);
        }

        const courses = courseRes.courses || (Array.isArray(courseRes) ? courseRes : []);
        setCatalogueCourses(courses);
      } catch (err) {
        if (alive) setError(explainApiError(err, "Initial data"));
      } finally {
        if (alive) setLoadingInitial(false);
      }
    }
    loadData();
    return () => {
      alive = false;
    };
  }, [token, termId]);

  const loadStudentDraftMandatory = useCallback(async (sid, tid) => {
    if (!sid || !tid) {
      setMandatoryCourses([]);
      return;
    }
    setLoadingDraft(true);
    try {
      const draft = await api(`/api/schedules/advising/${encodeURIComponent(sid)}/draft?termId=${encodeURIComponent(tid)}`, {
        token,
      });
      setMandatoryCourses(draft.mandatoryCourses || []);
    } catch {
      setMandatoryCourses([]);
    } finally {
      setLoadingDraft(false);
    }
  }, [token]);

  useEffect(() => {
    if (studentProfileId && termId) {
      loadStudentDraftMandatory(studentProfileId, termId);
    }
  }, [studentProfileId, termId, loadStudentDraftMandatory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentProfileId) {
      setError("Please select an advising student.");
      return;
    }
    if (!termId) {
      setError("Please select an academic term.");
      return;
    }
    if (!courseId) {
      setError("Please select a course to remove.");
      return;
    }
    if (!reason) {
      setError("Please select a valid removal reason.");
      return;
    }
    if (!explanation.trim()) {
      setError("Please enter a detailed explanation.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await api("/api/advising/mandatory-removal-requests", {
        token,
        method: "POST",
        body: {
          studentProfileId,
          courseId,
          termId,
          reason,
          explanation: explanation.trim(),
        },
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(explainApiError(err, "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Request Mandatory-Course Removal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">MANDATORY COURSE REMOVAL</p>
            <h2>Request Course Removal</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {error && (
          <div className="feedback error" role="alert" style={{ marginBottom: "14px" }}>
            {error}
          </div>
        )}

        {loadingInitial ? (
          <div className="loading-state">
            <span className="loader" />
            Loading request options…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="page-stack">
            <label className="field">
              <span>Advising student *</span>
              <select
                value={studentProfileId}
                onChange={(e) => {
                  setStudentProfileId(e.target.value);
                  setCourseId("");
                }}
                required
                disabled={Boolean(initialStudent?._id) || submitting}
              >
                <option value="">— Select an advising student —</option>
                {initialStudent && !students.some((s) => s._id === initialStudent._id) && (
                  <option value={initialStudent._id}>
                    {initialStudent.studentId} — {initialStudent.user?.fullName || initialStudent.fullName}
                  </option>
                )}
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.studentId} — {student.user?.fullName || student.fullName || student.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Academic term *</span>
              <select
                value={termId}
                onChange={(e) => {
                  setTermId(e.target.value);
                  setCourseId("");
                }}
                required
                disabled={submitting}
              >
                <option value="">— Select an academic term —</option>
                {terms.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.code} · {t.season} {t.academicYear} {t.isActive ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Course to remove * {loadingDraft && <small>(loading student requirements…)</small>}</span>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">— Select course to remove —</option>
                {mandatoryCourses.length > 0 && (
                  <optgroup label="Failed / Mandatory Courses for Student">
                    {mandatoryCourses.map((mc) => (
                      <option key={mc._id} value={mc._id}>
                        ★ {mc.code} — {mc.name} ({mc.creditHours} cr)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All Catalogue Courses">
                  {catalogueCourses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.code} — {c.name} ({c.creditHours} cr)
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label className="field">
              <span>Removal reason *</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                disabled={submitting}
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Detailed explanation *</span>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Explain the academic justification for removing this course from the student's mandatory schedule for this term..."
                required
                disabled={submitting}
              />
              <small className="secondary-text" style={{ textAlign: "right" }}>
                {explanation.length} / 2000 characters
              </small>
            </label>

            <div className="form-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="outline-button"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={submitting || !studentProfileId || !termId || !courseId || !explanation.trim()}
              >
                {submitting ? "Submitting…" : "Submit Removal Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
