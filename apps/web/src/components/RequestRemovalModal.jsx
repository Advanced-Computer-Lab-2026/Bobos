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
  const [failedCourses, setFailedCourses] = useState([]);

  const [studentProfileId, setStudentProfileId] = useState(initialStudent?._id || "");
  const [termId, setTermId] = useState(initialTermId || "");
  const [courseId, setCourseId] = useState("");
  const [reason, setReason] = useState("incorrectMandatoryDesignation");
  const [explanation, setExplanation] = useState("");

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadInitialData() {
      setLoadingInitial(true);
      setError("");
      try {
        const [studentRes, termRes] = await Promise.all([
          api("/api/advisor/students?limit=100", { token }).catch(() => ({ data: [] })),
          api("/api/academic-terms", { token }).catch(() => []),
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
      } catch (err) {
        if (alive) setError(explainApiError(err, "Initial data"));
      } finally {
        if (alive) setLoadingInitial(false);
      }
    }
    loadInitialData();
    return () => {
      alive = false;
    };
  }, [token, termId]);

  const loadFailedCourses = useCallback(async (sid, tid) => {
    if (!sid) {
      setFailedCourses([]);
      setCourseId("");
      return;
    }
    setLoadingCourses(true);
    setError("");
    try {
      const termQuery = tid ? `?term=${encodeURIComponent(tid)}` : "";
      const res = await api(`/api/identity/students/${encodeURIComponent(sid)}/failed-courses${termQuery}`, {
        token,
      });
      const list = Array.isArray(res) ? res : res.failedCourses || [];
      setFailedCourses(list);
      setCourseId((prev) => {
        const exists = list.some((item) => {
          const cId = String(item.course?._id || item.course || item._id);
          return cId === String(prev);
        });
        if (exists) return prev;
        if (list.length === 1) {
          const first = list[0].course && typeof list[0].course === "object" ? list[0].course : list[0];
          return String(first._id || list[0]._id);
        }
        return "";
      });
    } catch (err) {
      setFailedCourses([]);
      setCourseId("");
      setError(explainApiError(err, "Failed courses"));
    } finally {
      setLoadingCourses(false);
    }
  }, [token]);

  useEffect(() => {
    if (studentProfileId) {
      loadFailedCourses(studentProfileId, termId);
    } else {
      setFailedCourses([]);
      setCourseId("");
    }
  }, [studentProfileId, termId, loadFailedCourses]);

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
      setError("Please select a mandatory course to remove.");
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

  const hasNoMandatoryCourses = Boolean(studentProfileId && !loadingCourses && failedCourses.length === 0);

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

        {hasNoMandatoryCourses && (
          <div className="feedback warning" role="alert" style={{ marginBottom: "14px" }}>
            This student has no mandatory (failed or unattended) courses to remove.
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
              <span>
                Mandatory course to remove *{" "}
                {loadingCourses && <small>(loading failed/unattended courses…)</small>}
              </span>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                disabled={submitting || loadingCourses || hasNoMandatoryCourses || !studentProfileId}
              >
                <option value="">
                  {loadingCourses
                    ? "— Loading mandatory courses… —"
                    : !studentProfileId
                    ? "— Select a student first —"
                    : hasNoMandatoryCourses
                    ? "— No mandatory courses available —"
                    : "— Select failed or unattended course —"}
                </option>
                {failedCourses.map((item) => {
                  const c = item.course && typeof item.course === "object" ? item.course : item;
                  const cId = String(c._id || item._id);
                  const code = c.code || "Course";
                  const name = c.name || "";
                  const cr = c.creditHours != null ? `${c.creditHours} cr` : "";
                  const tag = item.attendance === "unattended" ? "Unattended" : "Failed";
                  const grade = item.grade ? ` · Grade: ${item.grade}` : "";
                  return (
                    <option key={cId} value={cId}>
                      {code} — {name} ({cr}) [{tag}{grade}]
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="field">
              <span>Removal reason *</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                disabled={submitting || hasNoMandatoryCourses}
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
                disabled={submitting || hasNoMandatoryCourses}
              />
              <small className="secondary-text" style={{ textAlign: "right" }}>
                {explanation.length} / 2000 characters
              </small>
            </label>

            <div
              className="form-actions"
              style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}
            >
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
                disabled={
                  submitting ||
                  loadingCourses ||
                  hasNoMandatoryCourses ||
                  !studentProfileId ||
                  !termId ||
                  !courseId ||
                  !explanation.trim()
                }
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
