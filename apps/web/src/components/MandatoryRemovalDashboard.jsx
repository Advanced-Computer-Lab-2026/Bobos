import { RegisterRow, StudentIdentity, StudentRegister } from "./CoordinatorRecords.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";
import PortalAvatar from "./PortalAvatar.jsx";
import { ChromeIcon } from "./PortalChrome.jsx";
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

const REMOVAL_DECISIONS = [
  { value: "approved", choice: "Approve", label: "Approve removal" },
  { value: "rejected", choice: "Reject", label: "Reject request" },
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

export default function MandatoryRemovalDashboard({ token, role, advisorId, notify }) {
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
  const detailTrigger = useRef(null);
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
  const [decision, setDecision] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const decisionDialogRef = useRef(null);
  const decisionTrigger = useRef(null);

  useEffect(() => {
    const dialog = decisionDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [reviewingRequest]);

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

  const handleOpenDetail = async (reqId, trigger) => {
    detailTrigger.current = trigger;
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

  const handleStartReview = (request, trigger) => {
    decisionTrigger.current = trigger;
    setReviewingRequest(request);
    setDecision("");
    setResponseNote("");
    setDecisionError("");
  };

  const closeReview = () => {
    if (submittingDecision) return;
    setReviewingRequest(null);
    requestAnimationFrame(() => decisionTrigger.current?.focus({ preventScroll: true }));
  };

  const handleDecide = async (event) => {
    event.preventDefault();
    if (!decision || submittingDecision) return;
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
  const decisionLabel = REMOVAL_DECISIONS.find((option) => option.value === decision)?.label;

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
      </div>

      <section className="panel directory-filters">
        <FilterDisclosure actions={canRequest && <button className="primary-button removal-create-action" type="button" onClick={() => setRequestModalOpen(true)}>Request removal</button>} search={<label className="field filter-search">
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
              data-calendar-range="mandatory-removals" data-calendar-edge="start"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Submitted to</span>
            <input
              type="date"
              data-calendar-range="mandatory-removals" data-calendar-edge="end"
              value={dateTo}
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
          <StudentRegister label="Course removal requests" className="removal-register" columns={["Student", "Course", "Reason / advisor", "Status", "Actions"]} listClassName={!canDecide && "portal-request-list removal-request-list"}>
            {requests.map((item) => {
              const courseName = item.course?.name || item.course?.code || "Unknown course";
              const studentName = item.student?.user?.fullName || item.student?.studentId || "Unknown student";
              const studentId = item.student?.studentId || "—";
              const studentLink = item.student?._id && <button className="removal-record-link" type="button"
                aria-label={`Open profile for ${studentName}`} aria-disabled={loadingRecord || loadingDetail}
                onClick={event => openRelatedRecord("student", item.student._id, event.currentTarget)}>{studentName}</button>;
              return <RegisterRow listItem={!canDecide} key={item._id}>
                {canDecide ? <StudentIdentity name={studentName} id={studentId} nameAction={studentLink} /> :
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
                  {!canDecide && <small><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></small>}
                  <small>{termLabel(item.term)}</small>
                </div>
                <div className="request-row-actions">
                  <button className="outline-button removal-view-action" type="button" disabled={loadingDetail || loadingRecord} onClick={(event) => handleOpenDetail(item._id, event.currentTarget)}>View Details</button>
                  {canDecide && (item.status || "pending") === "pending" &&
                    <button className="outline-button removal-decision-action" type="button" aria-haspopup="dialog" disabled={loadingDetail || loadingRecord} onClick={(event) => handleStartReview(item, event.currentTarget)}>Make decision</button>}
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
                <RemovalStudent request={selectedDetail} showEmail />
                <RemovalStatus status={selectedDetail.status} />
              </div>
              <div className="removal-rationale">
                <RemovalReason request={selectedDetail} />
                <RemovalExplanation request={selectedDetail} />
              </div>
              <dl className="removal-submission">
                <div><dt>Academic term</dt><dd>{termLabel(selectedDetail.term)}</dd></div>
                <div><dt>Submitted</dt><dd><time dateTime={selectedDetail.createdAt}>{formatDate(selectedDetail.createdAt)}</time></dd></div>
              </dl>

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
                  handleStartReview(selectedDetail, detailTrigger.current);
                  setSelectedDetail(null);
                }}>Make decision</button>}
              </div>
            </div>
          </section>
        </dialog>
      )}

      {reviewingRequest && (
        <dialog ref={decisionDialogRef} className="academic-dialog modal-backdrop removal-decision-dialog" aria-labelledby="removal-decision-title"
          onCancel={(event) => { event.preventDefault(); closeReview(); }}
          onClick={(event) => { if (event.target === decisionDialogRef.current) closeReview(); }}>
          <section className="modal-card">
            <div className="modal-heading">
              <div className="removal-decision-title-row">
                <h2 id="removal-decision-title">Decide course removal</h2>
                <span className="removal-decision-term"><ChromeIcon name="calendar" />{termLabel(reviewingRequest.term)}</span>
              </div>
              <button className="icon-button" type="button" aria-label="Close" disabled={submittingDecision} onClick={closeReview}>×</button>
            </div>

            <form className="form-stack" aria-busy={submittingDecision} onSubmit={handleDecide}>
              <dl className="removal-decision-identities">
                <div>
                  <dt>Course</dt>
                  <dd className="removal-detail-course">
                    <OfferingCourseIcon code={reviewingRequest.course?.code} />
                    <div>
                      <strong>{reviewingRequest.course?.name || reviewingRequest.course?.code || "Unknown course"}</strong>
                      {reviewingRequest.course?.name && <small>{reviewingRequest.course?.code}</small>}
                    </div>
                  </dd>
                </div>
                <div>
                  <dt>Student</dt>
                  <dd><RemovalStudent request={reviewingRequest} /></dd>
                </div>
              </dl>

              <div className="removal-rationale">
                <RemovalReason request={reviewingRequest} />
                <RemovalExplanation request={reviewingRequest} quoted />
              </div>

              <div className="removal-decision-entry">
                <fieldset className="removal-decision-options" aria-label="Decision" disabled={submittingDecision}>
                  {REMOVAL_DECISIONS.map(({ value, choice }) => <label key={value}>
                    <input type="radio" name="removal-decision" value={value} checked={decision === value} onChange={() => setDecision(value)} required />
                    <svg aria-hidden="true" viewBox="0 0 56 56" width="48" height="48" fill="currentColor">
                      <path d={value === "approved"
                        ? "M8 29c2-1 5 .3 7 2.7l9 9C31 29 39 18 48 12c2-1 3 .7 1.5 2.5-8 9.5-15 20-23 32-1 1.7-3.2 1.9-4.8.5C17 42 12 36.5 8 32.5c-1.2-1.2-1.4-2.7 0-3.5Z"
                        : "M13 11c1.4-.7 3.1.3 4.1 1.5C26 22 35.4 31.7 45 42.9c1.6 1.8-.2 4.2-2.5 3C30.6 36 21 26.4 12.6 15.2c-1.1-1.5-1.1-3.4.4-4.2Z M43.7 11.4c2.1-1 3.8 1 2.4 3C36 28 25.9 38.1 14.6 46.4c-2 1.5-4.1-.6-2.4-2.5 8.6-10.6 18.4-20.8 29.5-31.3.6-.6 1.4-1 2-1.2Z"} />
                    </svg>
                    <span>{choice}</span>
                  </label>)}
                </fieldset>

                <div className="field">
                  <label htmlFor="removal-decision-note">Decision note (required)</label>
                  <textarea
                    id="removal-decision-note"
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    required
                    disabled={submittingDecision}
                    aria-describedby="removal-note-count"
                  />
                  <small id="removal-note-count" className="secondary-text removal-note-count">
                    {responseNote.length} / 1000 characters
                  </small>
                </div>
              </div>

              {decisionError && <div className="feedback error" role="alert">{decisionError}</div>}

              <div className="form-footer">
                <button type="button" className="outline-button" disabled={submittingDecision} onClick={closeReview}>Cancel</button>
                <button type="submit" className={`primary-button${decision === "rejected" ? " destructive-action" : ""}`} disabled={submittingDecision || !decision || !responseNote.trim()}>
                  {submittingDecision ? "Saving…" : decisionLabel || "Save decision"}
                </button>
              </div>
            </form>
          </section>
        </dialog>
      )}

      {requestModalOpen && (
        <RequestRemovalModal
          token={token}
          advisorId={advisorId}
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


function RemovalStudent({ request, showEmail = false }) {
  const user = request.student?.user;
  const name = user?.fullName || request.student?.studentId || "Unknown student";
  return <div className="portal-person-cell">
    <PortalAvatar name={name} />
    <div><strong>{name}</strong>
      {user?.fullName && <small>{request.student?.studentId}</small>}
      {showEmail && user?.email && <small>{user.email}</small>}</div>
  </div>;
}

function RemovalReason({ request }) {
  return <section className="removal-reason">
    <h3>Removal reason</h3>
    <p>{formatReason(request.reason, request.makeupAttempt)}</p>
  </section>;
}

function RemovalExplanation({ request, quoted = false }) {
  const advisor = request.advisor;
  const author = advisor && <div className="removal-explanation-author">
    <PortalAvatar name={advisor.fullName} />
    <div>
      <strong>{advisor.fullName || "Requesting advisor"}</strong>
      {advisor.email && <small>{advisor.email}</small>}
    </div>
  </div>;

  return <section className="removal-explanation">
    <h3>Advisor explanation</h3>
    {quoted && author}
    {quoted && request.explanation
      ? <blockquote><p><q>{request.explanation}</q></p></blockquote>
      : <p>{request.explanation || "No explanation provided."}</p>}
    {!quoted && author}
  </section>;
}
