import { RegisterRow, StudentIdentity, StudentRegister } from "./CoordinatorRecords.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";
import PortalAvatar from "./PortalAvatar.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import { termLabel } from "../term-label.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import RequestRemovalModal from "./RequestRemovalModal.jsx";
import { WorkspaceEmpty } from "./WorkspaceUI.jsx";
import { CourseDetailsModal, Modal } from "./AcademicWorkspace.jsx";
import { StudentProfileDetails } from "./StudentDirectoryPage.jsx";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const REASON_LABELS = {
  incorrectMandatoryDesignation: "Incorrect Mandatory Designation",
  makeupEligibility: "Makeup Eligibility",
  completedHours: "Completed Hours",
  restrictedCoursePair: "Restricted Course Pair",
  other: "Other",
};

function formatReason(val, makeupAttempt) {
  if (val === "makeupEligibility" && makeupAttempt) return makeupAttempt === 1 ? "First makeup eligibility" : "Second makeup eligibility";
  return REASON_LABELS[val] || val || "—";
}

function formatDate(val) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(val);
  }
}

function RemovalStatus({ status = "pending" }) {
  const tone = { approved: "good", rejected: "error", pending: "warning" }[status];
  const label = STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
  return <span className={`status-pill ${tone || ""}`}>{label}</span>;
}

export default function MandatoryRemovalDashboard({ token, role, notify }) {
  const [requests, setRequests] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const detailDialogRef = useRef(null);
  const [relatedRecord, setRelatedRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const relatedRecordTrigger = useRef(null);

  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [selectedDetail]);

  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [responseNote, setResponseNote] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState("");

  const [requestModalOpen, setRequestModalOpen] = useState(false);

  useEffect(() => {
    api("/api/advisor/advisors", { token })
      .then((res) => {
        const list = res.advisors || (Array.isArray(res) ? res : []);
        setAdvisors(list);
      })
      .catch(() => {});
  }, [token]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (advisorFilter) params.set("advisor", advisorFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    try {
      const data = await api(`/api/advising/mandatory-removal-requests?${params.toString()}`, {
        token,
      });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(explainApiError(err, "Mandatory removal requests"));
    } finally {
      setLoading(false);
    }
  }, [token, search, advisorFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const clearFilters = () => {
    setSearch("");
    setAdvisorFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const handleOpenDetail = async (reqId) => {
    setLoadingDetail(true);
    try {
      const detail = await api(`/api/advising/mandatory-removal-requests/${encodeURIComponent(reqId)}`, {
        token,
      });
      setSelectedDetail(detail);
    } catch (err) {
      notify?.("error", explainApiError(err, "Could not load details"));
    } finally {
      setLoadingDetail(false);
    }
  };

  async function openRelatedRecord(kind, id, trigger) {
    if (loadingRecord || loadingDetail) return;
    const endpoint = kind === "course" ? "/api/catalogue/courses" : role === "advisor" ? "/api/advisor/students" : "/api/admin/students";
    relatedRecordTrigger.current = trigger;
    setLoadingRecord(true);
    try {
      const result = await api(`${endpoint}/${encodeURIComponent(id)}`, { token });
      setRelatedRecord({ kind, data: result.profile || result });
    } catch (err) {
      notify?.("error", explainApiError(err, kind === "course" ? "Course catalogue" : "Student profile"));
    } finally {
      setLoadingRecord(false);
    }
  }

  function closeRelatedRecord() {
    setRelatedRecord(null);
    requestAnimationFrame(() => relatedRecordTrigger.current?.focus({ preventScroll: true }));
  }

  const handleStartReview = (reqItem, initialDecision = "") => {
    setReviewingRequest({ ...reqItem, pendingDecision: initialDecision });
    setResponseNote("");
    setDecisionError("");
  };

  const handleDecide = async (decision) => {
    if (!responseNote.trim()) {
      setDecisionError("A decision note is mandatory.");
      return;
    }
    setSubmittingDecision(true);
    setDecisionError("");
    try {
      await api(
        `/api/advising/mandatory-removal-requests/${encodeURIComponent(reviewingRequest._id)}/decision`,
        {
          token,
          method: "PATCH",
          body: {
            decision,
            responseNote: responseNote.trim(),
          },
        }
      );
      notify?.("success", `Request successfully ${decision}.`);
      setReviewingRequest(null);
      fetchRequests();
    } catch (err) {
      setDecisionError(explainApiError(err, `Failed to ${decision} request`));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const canDecide = ["coordinator", "administrator"].includes(role);
  const canRequest = ["advisor", "coordinator", "administrator"].includes(role);

  const filterChips = [
    advisorFilter && {key:"advisor", label:advisors.find(advisor => advisor._id === advisorFilter)?.fullName || "Advisor", onRemove:() => setAdvisorFilter("")},
    statusFilter && {key:"status", label:STATUS_OPTIONS.find(option => option.value === statusFilter)?.label, onRemove:() => setStatusFilter("")},
    dateFrom && {key:"from", label:`From ${dateFrom}`, onRemove:() => setDateFrom("")},
    dateTo && {key:"to", label:`Through ${dateTo}`, onRemove:() => setDateTo("")},
  ].filter(Boolean);
  const filtered = Boolean(search.trim() || filterChips.length);

  return (
    <div className="page-stack workspace-page removal-page">
      <div className="workspace-header">
        <div>
          <h1>Course removals</h1>
          <p className="page-description">
            Review requests to remove a mandatory course from a student’s advising schedule.
          </p>
        </div>
        <div className="workspace-header-actions">
          {canRequest && (
            <button
              className="primary-button"
              type="button"
              onClick={() => setRequestModalOpen(true)}
            >
              Request removal
            </button>
          )}
          <button className="outline-button" type="button" onClick={fetchRequests}>
            Refresh
          </button>
        </div>
      </div>

      <section className="panel directory-filters">
        <FilterDisclosure search={<label className="field filter-search">
            <span>Search student, ID, course, or advisor</span>
            <input
              type="search"
              name="removal-search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Student ID, course or advisor…"
            />
          </label>} chips={filterChips} onClear={clearFilters}>
        <div className="filter-grid">
          <label className="field">
            <span>Advisor</span>
            <select
              value={advisorFilter}
              onChange={(e) => setAdvisorFilter(e.target.value)}
            >
              <option value="">All advisors</option>
              {advisors.map((adv) => (
                <option key={adv._id} value={adv._id}>
                  {adv.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Submitted from</span>
            <input
              type="date"
              value={dateFrom}
              data-calendar-range="mandatory-removals" data-calendar-edge="start"
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Submitted to</span>
            <input
              type="date"
              value={dateTo}
              data-calendar-range="mandatory-removals" data-calendar-edge="end"
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>

        </FilterDisclosure>
      </section>

      {error && <div className="feedback error" role="alert">{error}</div>}

      <section className="panel results-panel removal-results" aria-label="Course removal requests" aria-busy={loading}>
        {loading ? (
          <div className="loading-state">
            <span className="loader" />
            Loading removal requests…
          </div>
        ) : requests.length === 0 ? (
          <WorkspaceEmpty icon="document" title={filtered ? "No matching removal requests" : "No removal requests"} description={filtered ? "Try another student, course or advisor." : "Mandatory course removal requests will appear here for review."} action={filtered && <button className="outline-button" type="button" onClick={clearFilters}>Clear filters</button>} />
        ) : (
          <StudentRegister label="Course removal requests" className="removal-register" columns={["Student", "Course", "Reason / advisor", "Status", "Actions"]} listClassName={role !== "coordinator" && "portal-request-list removal-request-list"}>
            {requests.map((item) => {
              const courseName = item.course?.name || item.course?.code || "Unknown course";
              const studentName = item.student?.user?.fullName || item.student?.studentId || "Unknown student";
              const studentId = item.student?.studentId || "—";
              const studentLink = item.student?._id && <button className="removal-record-link" type="button"
                aria-label={`Open profile for ${studentName}`} aria-disabled={loadingRecord || loadingDetail}
                onClick={event => openRelatedRecord("student", item.student._id, event.currentTarget)}>{studentName}</button>;
              return <RegisterRow listItem={role !== "coordinator"} key={item._id}>
                {role === "coordinator" ? <StudentIdentity name={studentName} id={studentId} nameAction={studentLink} /> :
                  <div className="request-row-student portal-person-cell"><PortalAvatar name={studentName} />
                    <div>{studentLink || <strong>{studentName}</strong>}<small>{studentId}</small></div>
                  </div>}
                <span className="request-row-course register-person">
                  <OfferingCourseIcon code={item.course?.code} />
                  <span>
                    {item.course?._id ? <button className="removal-record-link" type="button" aria-label={`View course ${courseName}`} aria-disabled={loadingRecord || loadingDetail} onClick={event => openRelatedRecord("course", item.course._id, event.currentTarget)}>{courseName}</button> : <strong>{courseName}</strong>}
                    {item.course?.name && item.course.code && <small>{item.course.code}</small>}
                  </span>
                </span>
                <div className="request-row-context">
                  <strong>{formatReason(item.reason, item.makeupAttempt)}</strong>
                  <small>Advisor {item.advisor?.fullName || item.advisor?.email || "unassigned"}</small>
                </div>
                <div className="request-row-status">
                  <RemovalStatus status={item.status} />
                  {role !== "coordinator" && <small><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></small>}
                  <small>{termLabel(item.term)}</small>
                </div>
                <div className="request-row-actions">
                  <button className="outline-button request-review-action" type="button" disabled={loadingDetail || loadingRecord} onClick={() => handleOpenDetail(item._id)}>View Details</button>
                  {canDecide && (item.status || "pending") === "pending" && <div>
                    <button className="text-button removal-approve" type="button" onClick={() => handleStartReview(item, "approved")}>Approve</button>
                    <button className="text-button removal-reject" type="button" onClick={() => handleStartReview(item, "rejected")}>Reject</button>
                  </div>}
                </div>
              </RegisterRow>;
            })}
          </StudentRegister>
        )}
      </section>

      {relatedRecord?.kind === "course" && <CourseDetailsModal course={relatedRecord.data} onClose={closeRelatedRecord} />}
      {relatedRecord?.kind === "student" && <Modal title={relatedRecord.data.user?.fullName || "Student profile"} onClose={closeRelatedRecord}>
        <StudentProfileDetails details={relatedRecord.data} prominentIdentity />
      </Modal>}

      {selectedDetail && (
        <dialog ref={detailDialogRef} className="academic-dialog modal-backdrop removal-detail-dialog" aria-labelledby="removal-detail-title"
          onCancel={(event) => { event.preventDefault(); setSelectedDetail(null); }}
          onClick={(event) => { if (event.target === detailDialogRef.current) setSelectedDetail(null); }}>
          <section className="modal-card removal-detail-card">
            <div className="modal-heading">
              <div className="removal-detail-course">
                <OfferingCourseIcon code={selectedDetail.course?.code} />
                <div>
                  <p className="removal-detail-kicker">Course removal request</p>
                  <h2 id="removal-detail-title">{selectedDetail.course?.name || selectedDetail.course?.code || "Course removal"}</h2>
                  <div className="removal-detail-course-meta">
                    <span>{selectedDetail.course?.code}</span>
                    {selectedDetail.course?.creditHours != null && <span>{selectedDetail.course.creditHours} credits</span>}
                  </div>
                </div>
              </div>
              <button className="icon-button" type="button" aria-label="Close" onClick={() => setSelectedDetail(null)}>×</button>
            </div>

            <div className="request-detail-body">
              <div className="request-detail-identity">
                <div className="portal-person-cell">
                  <PortalAvatar name={selectedDetail.student?.user?.fullName} />
                  <div>
                    <strong>{selectedDetail.student?.user?.fullName || "Unknown student"}</strong>
                    <small>{selectedDetail.student?.studentId}</small>
                    <small>{selectedDetail.student?.user?.email}</small>
                  </div>
                </div>
                <RemovalStatus status={selectedDetail.status} />
              </div>
              <dl className="request-detail-facts">
                <div><dt>Removal reason</dt><dd><strong>{formatReason(selectedDetail.reason, selectedDetail.makeupAttempt)}</strong></dd></div>
                <div><dt>Academic term</dt><dd>{termLabel(selectedDetail.term)}</dd></div>
                <div><dt>Submitted</dt><dd><time dateTime={selectedDetail.createdAt}>{formatDate(selectedDetail.createdAt)}</time></dd></div>
              </dl>
              <section className="portal-request-note">
                <h3>Advisor explanation</h3>
                <p>{selectedDetail.explanation || "No explanation provided."}</p>
                <div className="portal-note-attribution">
                  <strong>{selectedDetail.advisor?.fullName || "Requesting advisor"}</strong>
                  {selectedDetail.advisor?.email && <small>{selectedDetail.advisor.email}</small>}
                </div>
              </section>

              {selectedDetail.status !== "pending" && <section className="portal-request-note">
                <h3>Coordinator decision</h3>
                <p>{selectedDetail.responseNote || "No decision note provided."}</p>
                <div className="portal-note-attribution">
                  <strong>{selectedDetail.decidedBy?.fullName || "Coordinator"}</strong>
                  <small><time dateTime={selectedDetail.decidedAt}>{formatDate(selectedDetail.decidedAt)}</time></small>
                </div>
              </section>}

              <div className="form-actions request-detail-actions">
                <button className="outline-button" type="button" onClick={() => setSelectedDetail(null)}>Close</button>
                {canDecide && selectedDetail.status === "pending" && <button className="primary-button" type="button" onClick={() => {
                  handleStartReview(selectedDetail);
                  setSelectedDetail(null);
                }}>Make Decision</button>}
              </div>
            </div>
          </section>
        </dialog>
      )}

      {reviewingRequest && (
        <div className="modal-backdrop" onClick={() => !submittingDecision && setReviewingRequest(null)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Review Course Removal Request"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">COORDINATOR ACTION</p>
                <h2>Decide Course Removal</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                disabled={submittingDecision}
                onClick={() => setReviewingRequest(null)}
              >
                ×
              </button>
            </div>

            {decisionError && (
              <div className="feedback error" role="alert" style={{ marginBottom: "12px" }}>
                {decisionError}
              </div>
            )}

            <div className="page-stack" style={{ gap: "12px" }}>
              <dl className="request-detail-facts">
                <div><dt>Student</dt><dd><strong>{reviewingRequest.student?.user?.fullName}</strong><small>{reviewingRequest.student?.studentId}</small></dd></div>
                <div><dt>Course</dt><dd><strong>{reviewingRequest.course?.name || reviewingRequest.course?.code}</strong><small>{reviewingRequest.course?.code}</small></dd></div>
                <div><dt>Academic term</dt><dd>{termLabel(reviewingRequest.term)}</dd></div>
                <div><dt>Removal reason</dt><dd>{formatReason(reviewingRequest.reason, reviewingRequest.makeupAttempt)}</dd></div>
              </dl>
              <section className="portal-request-note">
                <h3>Advisor explanation</h3>
                <p>{reviewingRequest.explanation || "No explanation provided."}</p>
              </section>

              <label className="field">
                <span>Response / Decision Note *</span>
                <textarea
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Mandatory decision note explaining why this request is approved or rejected..."
                  required
                  disabled={submittingDecision}
                />
                <small className="secondary-text" style={{ textAlign: "right" }}>
                  {responseNote.length} / 1000 characters
                </small>
              </label>

              <div
                className="form-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "12px",
                }}
              >
                <button
                  type="button"
                  className="outline-button"
                  disabled={submittingDecision}
                  onClick={() => setReviewingRequest(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button destructive-action"
                  disabled={submittingDecision || !responseNote.trim()}
                  onClick={() => handleDecide("rejected")}
                >
                  {submittingDecision ? "Saving…" : "Reject Request"}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={submittingDecision || !responseNote.trim()}
                  onClick={() => handleDecide("approved")}
                >
                  {submittingDecision ? "Saving…" : "Approve Removal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {requestModalOpen && (
        <RequestRemovalModal
          token={token}
          onClose={() => setRequestModalOpen(false)}
          onSuccess={() => {
            notify?.("success", "Mandatory-course removal request submitted.");
            fetchRequests();
          }}
        />
      )}
    </div>
  );
}
