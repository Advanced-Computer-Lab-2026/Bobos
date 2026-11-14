import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";
import RequestRemovalModal from "./RequestRemovalModal.jsx";

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

function formatReason(val) {
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

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">ACADEMIC ADVISING & POLICIES</p>
          <h1>Mandatory-Course Removal Requests</h1>
          <p className="page-description">
            Review and decide on advisor requests to exempt advising students from repeating failed or mandatory courses for this term.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {canRequest && (
            <button
              className="primary-button"
              type="button"
              onClick={() => setRequestModalOpen(true)}
            >
              + Request Course Removal
            </button>
          )}
          <button className="outline-button" type="button" onClick={fetchRequests}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <section className="panel directory-filters">
        <div className="filter-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          <label className="field" style={{ gridColumn: "span 2" }}>
            <span>Search student, ID, course, or advisor</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. 64-00001, CSEN101, or advisor name"
            />
          </label>

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
            <span>Date from</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Date to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>

        <div className="form-actions" style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
          <button className="outline-button" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      </section>

      {error && <div className="feedback error" role="alert">{error}</div>}

      <section className="panel results-panel" aria-busy={loading}>
        <div className="results-heading">
          <div>
            <p className="eyebrow">COORDINATOR QUEUE</p>
            <h2>Requests</h2>
          </div>
          <span className="result-count">
            {loading ? "Loading…" : `${requests.length} request${requests.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="loader" />
            Loading removal requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <span>▤</span>
            <h3>No course removal requests found</h3>
            <p>Try modifying your search or clearing your active filters.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Term</th>
                  <th>Advisor</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => {
                  const studentName = item.student?.user?.fullName || item.student?.studentId || "—";
                  const studentId = item.student?.studentId || "—";
                  const courseCode = item.course?.code || "—";
                  const courseName = item.course?.name || "";
                  const advisorName = item.advisor?.fullName || item.advisor?.email || "—";
                  const termCode = item.term?.code || "—";
                  const status = item.status || "pending";

                  const statusClass =
                    status === "approved"
                      ? "status-pill good"
                      : status === "rejected"
                      ? "status-pill error"
                      : "status-pill warning";

                  return (
                    <tr key={item._id}>
                      <td>
                        <strong>{studentName}</strong>
                        <span className="secondary-text">{studentId}</span>
                      </td>
                      <td>
                        <strong>{courseCode}</strong>
                        {courseName && <span className="secondary-text">{courseName}</span>}
                      </td>
                      <td>{termCode}</td>
                      <td>{advisorName}</td>
                      <td>{formatReason(item.reason)}</td>
                      <td>
                        <span className={statusClass}>
                          {status[0].toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <div className="table-actions" style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="text-button"
                            type="button"
                            disabled={loadingDetail}
                            onClick={() => handleOpenDetail(item._id)}
                          >
                            View Details
                          </button>

                          {canDecide && status === "pending" && (
                            <>
                              <button
                                className="small-button primary-button"
                                type="button"
                                onClick={() => handleStartReview(item, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                className="small-button outline-button danger-button"
                                type="button"
                                onClick={() => handleStartReview(item, "rejected")}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedDetail(null)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Removal Request Details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">REQUEST DETAILS</p>
                <h2>{selectedDetail.course?.code} Removal Request</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close"
                onClick={() => setSelectedDetail(null)}
              >
                ×
              </button>
            </div>

            <div className="page-stack" style={{ gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <small className="secondary-text">Student</small>
                  <p>
                    <strong>{selectedDetail.student?.user?.fullName || "—"}</strong> (
                    {selectedDetail.student?.studentId})
                  </p>
                </div>
                <div>
                  <small className="secondary-text">Student Email</small>
                  <p>{selectedDetail.student?.user?.email || "—"}</p>
                </div>
                <div>
                  <small className="secondary-text">Course</small>
                  <p>
                    <strong>{selectedDetail.course?.code}</strong> — {selectedDetail.course?.name} (
                    {selectedDetail.course?.creditHours} credits)
                  </p>
                </div>
                <div>
                  <small className="secondary-text">Term</small>
                  <p>
                    {selectedDetail.term?.code} ({selectedDetail.term?.season}{" "}
                    {selectedDetail.term?.academicYear})
                  </p>
                </div>
                <div>
                  <small className="secondary-text">Requesting Advisor</small>
                  <p>
                    {selectedDetail.advisor?.fullName} ({selectedDetail.advisor?.email})
                  </p>
                </div>
                <div>
                  <small className="secondary-text">Date Submitted</small>
                  <p>{formatDate(selectedDetail.createdAt)}</p>
                </div>
                <div>
                  <small className="secondary-text">Removal Reason</small>
                  <p>
                    <strong>{formatReason(selectedDetail.reason)}</strong>
                  </p>
                </div>
                <div>
                  <small className="secondary-text">Status</small>
                  <p>
                    <span
                      className={
                        selectedDetail.status === "approved"
                          ? "status-pill good"
                          : selectedDetail.status === "rejected"
                          ? "status-pill error"
                          : "status-pill warning"
                      }
                    >
                      {selectedDetail.status?.[0].toUpperCase() + selectedDetail.status?.slice(1)}
                    </span>
                  </p>
                </div>
              </div>

              <div>
                <small className="secondary-text">Advisor Explanation</small>
                <div
                  style={{
                    background: "var(--raised)",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    marginTop: "4px",
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                    {selectedDetail.explanation}
                  </p>
                </div>
              </div>

              {selectedDetail.status !== "pending" && (
                <div
                  style={{
                    background: selectedDetail.status === "approved" ? "var(--success-bg)" : "var(--danger-bg)",
                    padding: "12px 14px",
                    borderRadius: "6px",
                    border: `1px solid ${selectedDetail.status === "approved" ? "var(--line)" : "var(--line)"}`,
                  }}
                >
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "12px" }}>
                    Coordinator Decision: {selectedDetail.status[0].toUpperCase() + selectedDetail.status.slice(1)}
                  </h3>
                  <p style={{ margin: "0 0 4px 0" }}>
                    <strong>Note:</strong> {selectedDetail.responseNote || "—"}
                  </p>
                  <small className="secondary-text">
                    Decided by {selectedDetail.decidedBy?.fullName || "Coordinator"} on{" "}
                    {formatDate(selectedDetail.decidedAt)}
                  </small>
                </div>
              )}

              <div
                className="form-actions"
                style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}
              >
                {canDecide && selectedDetail.status === "pending" && (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      const reqItem = selectedDetail;
                      setSelectedDetail(null);
                      handleStartReview(reqItem);
                    }}
                  >
                    Make Decision
                  </button>
                )}
                <button
                  className="outline-button"
                  type="button"
                  onClick={() => setSelectedDetail(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
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
              <div style={{ background: "var(--raised)", padding: "10px 14px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                <p style={{ margin: "0 0 4px 0" }}>
                  <strong>Student:</strong> {reviewingRequest.student?.user?.fullName} ({reviewingRequest.student?.studentId})
                </p>
                <p style={{ margin: "0 0 4px 0" }}>
                  <strong>Course:</strong> {reviewingRequest.course?.code} — {reviewingRequest.course?.name}
                </p>
                <p style={{ margin: "0 0 4px 0" }}>
                  <strong>Term:</strong> {reviewingRequest.term?.code}
                </p>
                <p style={{ margin: "0 0 4px 0" }}>
                  <strong>Reason:</strong> {formatReason(reviewingRequest.reason)}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Advisor Explanation:</strong> {reviewingRequest.explanation}
                </p>
              </div>

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
