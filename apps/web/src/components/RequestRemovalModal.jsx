import { Modal } from "./AcademicWorkspace.jsx";
import { termLabel } from "../term-label.js";
import { useEffect, useId, useState } from "react";
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
  advisorId,
  onClose,
  onSuccess,
  initialStudent = null,
  initialTermId = "",
}) {
  const [students, setStudents] = useState([]);
  const [terms, setTerms] = useState([]);
  const [failedCourses, setFailedCourses] = useState(null);

  const [studentProfileId, setStudentProfileId] = useState(initialStudent?._id || "");
  const [termId, setTermId] = useState(initialTermId || "");
  const [courseId, setCourseId] = useState("");
  const [reason, setReason] = useState("incorrectMandatoryDesignation");
  const [makeupAttempt, setMakeupAttempt] = useState("");
  const [explanation, setExplanation] = useState("");

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const courseHelpId = useId();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function loadInitialData() {
      setLoadingInitial(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (advisorId) params.set("advisorId", advisorId);
        const [studentRes, termRes] = await Promise.all([
          api(`/api/advisor/students?${params}`, { token, signal }),
          api("/api/academic-terms", { token, signal }),
        ]);
        const studentList = [...(studentRes.data || [])];
        for (let page = 2; page <= studentRes.pagination?.pages && !signal.aborted; page += 1) {
          params.set("page", String(page));
          const next = await api(`/api/advisor/students?${params}`, { token, signal });
          studentList.push(...next.data);
        }
        if (signal.aborted) return;
        setStudents(studentList);
        setStudentProfileId(current => studentList.some(student => student._id === current) ? current : "");

        const termList = Array.isArray(termRes) ? termRes : termRes.terms || [];
        setTerms(termList);

        const activeTerm = termList.find((t) => t.isActive);
        setTermId(current => termList.some(term => term._id === current) ? current : activeTerm?._id || termList[0]?._id || "");
      } catch (err) {
        if (!signal.aborted) setError(explainApiError(err, "Request options"));
      } finally {
        if (!signal.aborted) setLoadingInitial(false);
      }
    }
    loadInitialData();
    return () => controller.abort();
  }, [token, advisorId]);

  useEffect(() => {
    setFailedCourses(null);
    setCourseId("");
    setLoadingCourses(Boolean(studentProfileId && termId));
    if (!studentProfileId || !termId || loadingInitial) return;
    const controller = new AbortController();
    const { signal } = controller;
    setError("");
    const termQuery = termId ? `?term=${encodeURIComponent(termId)}` : "";
    api(`/api/identity/students/${encodeURIComponent(studentProfileId)}/failed-courses${termQuery}`, { token, signal })
      .then(res => {
        if (signal.aborted) return;
        const list = Array.isArray(res) ? res : res.failedCourses || [];
        setFailedCourses(list);
        if (list.length === 1) setCourseId(String(list[0].course?._id || list[0].course || list[0]._id));
      })
      .catch(err => { if (!signal.aborted) setError(explainApiError(err, "Failed courses")); })
      .finally(() => { if (!signal.aborted) setLoadingCourses(false); });
    return () => controller.abort();
  }, [studentProfileId, termId, token, loadingInitial]);

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
          ...(reason === "makeupEligibility" && { makeupAttempt: Number(makeupAttempt) }),
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

  const hasNoMandatoryCourses = Boolean(studentProfileId && !loadingCourses && failedCourses?.length === 0);
  const unavailableStudent = initialStudent && !students.some(student => student._id === initialStudent._id);
  const courseHelp = !studentProfileId ? "Choose a student to see their mandatory courses." :
    !termId ? "Choose the term for this request." :
    loadingCourses ? "Checking this student’s mandatory courses…" :
    hasNoMandatoryCourses ? "This student has no failed or unattended courses eligible for removal in this term. Choose another student or term." :
    !failedCourses ? "The mandatory course list is unavailable. Try selecting the student or term again." : "";
  const detailsDisabled = submitting || !failedCourses?.length;

  return (
    <Modal title="Request course removal" description="Remove a mandatory course from a student’s advising schedule." className="removal-create-dialog" onClose={() => { if (!submitting) onClose(); }}>
      {error && (
        <div className="feedback error" role="alert">
          {error}
        </div>
      )}

      {loadingInitial ? (
        <div className="loading-state">
          <span className="loader" />
          Loading request options…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="removal-create-form">
          <div className="removal-create-fields">
            <label className="field">
              <span>Advising student</span>
              <select
                value={studentProfileId}
                onChange={(e) => {
                  setStudentProfileId(e.target.value);
                  setCourseId("");
                  setFailedCourses(null);
                  setLoadingCourses(Boolean(e.target.value && termId));
                  setReason("incorrectMandatoryDesignation");
                  setMakeupAttempt("");
                  setExplanation("");
                }}
                required
                disabled={submitting || !students.length}
              >
                <option value="">Choose a student</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.studentId} — {student.user?.fullName || student.fullName || student.email}
                  </option>
                ))}
              </select>
              {!students.length ? <small>{advisorId ? "No assigned advising students are available." : "No advising students are available."}</small> :
                unavailableStudent && !studentProfileId && <small>{advisorId ? "You can only request removals for your assigned students." : "The student from the roster is no longer available."}</small>}
            </label>

            <label className="field">
              <span>Academic term</span>
              <select
                value={termId}
                onChange={(e) => {
                  setTermId(e.target.value);
                  setCourseId("");
                  setFailedCourses(null);
                  setLoadingCourses(Boolean(studentProfileId && e.target.value));
                }}
                required
                disabled={submitting || !terms.length}
              >
                <option value="">Choose a term</option>
                {terms.map((t) => (
                  <option key={t._id} value={t._id}>
                    {termLabel(t)} {t.isActive ? "(Active)" : ""}
                  </option>
                ))}
              </select>
              {!terms.length && <small>No academic terms are available.</small>}
            </label>

            <label className="field removal-wide-field removal-course-field">
              <span>Mandatory course to remove</span>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                disabled={submitting || loadingCourses || !failedCourses?.length || !studentProfileId || !termId}
                aria-describedby={courseHelp ? courseHelpId : undefined}
              >
                <option value="">
                  {loadingCourses ? "Loading mandatory courses…"
                    : !studentProfileId ? "Choose a student first"
                    : !failedCourses ? "Course list unavailable"
                    : hasNoMandatoryCourses ? "No mandatory courses available"
                    : "Choose a failed or unattended course"}
                </option>
                {failedCourses?.map((item) => {
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
              {courseHelp && <small id={courseHelpId} role="status">{courseHelp}</small>}
            </label>

            <label className={reason === "makeupEligibility" ? "field" : "field removal-wide-field"}>
              <span>Removal reason</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                disabled={detailsDisabled}
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {reason === "makeupEligibility" && <label className="field">
              <span>Makeup attempt</span>
              <select required value={makeupAttempt} onChange={(event) => setMakeupAttempt(event.target.value)} disabled={detailsDisabled}>
                <option value="">Choose a makeup</option>
                <option value="1">First makeup</option>
                <option value="2">Second makeup</option>
              </select>
            </label>}

            <label className="field removal-wide-field">
              <span>Detailed explanation</span>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Why should this course be removed for this term?"
                required
                disabled={detailsDisabled}
              />
              <small className="removal-character-count">
                {explanation.length} / 2000 characters
              </small>
            </label>
          </div>
          <div className="form-footer">
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
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
