import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "TUITION", label: "Tuition" },
  { value: "EXTRA_HOURS", label: "Extra Hours" },
  { value: "FEE", label: "Fee" },
  { value: "REFUND", label: "Refund" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "FAILED", label: "Failed" },
];

const TERM_OPTIONS = [
  { value: "", label: "All Terms" },
  { value: "W25", label: "Winter 2025/26 (W25)" },
  { value: "S26", label: "Spring 2025/26 (S26)" },
];

function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateString);
  }
}

function formatCurrency(amount, currency = "EGP") {
  const num = Number(amount) || 0;
  return `${currency} ${num.toLocaleString()}`;
}

function formatStatusClass(status = "") {
  const s = String(status).toUpperCase();
  if (s === "COMPLETED" || s === "SUCCEEDED") return "good completed";
  if (s === "REFUNDED") return "refunded";
  if (s === "PENDING") return "pending";
  if (s === "FAILED" || s === "CANCELLED") return "danger failed";
  return "muted";
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span className="secondary-text">{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default function FinancialRecordsPage({ token, role, notify }) {
  // Query & filter states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  // Data states
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [viewRecord, setViewRecord] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");

  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState("");

  const [exporting, setExporting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  const handleTypeChange = (e) => {
    setType(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    setPage(1);
  };

  const handleTermChange = (e) => {
    setTerm(e.target.value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setType("");
    setStatus("");
    setTerm("");
    setPage(1);
  };

  // Fetch paginated financial records
  const loadRecords = useCallback(async (signal) => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (debouncedSearch) params.set("search", debouncedSearch);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (term) params.set("term", term);

    try {
      const data = await api(`/api/finance/records?${params.toString()}`, { token, signal });
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(explainApiError(err, "Financial records"));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [debouncedSearch, type, status, term, page, token]);

  useEffect(() => {
    const controller = new AbortController();
    loadRecords(controller.signal);
    return () => controller.abort();
  }, [loadRecords]);

  // Open details modal and fetch complete record metadata
  const openDetails = async (record) => {
    setViewRecord(record);
    setViewLoading(true);
    setViewError("");
    try {
      const fullRecord = await api(`/api/finance/records/${record._id}`, { token });
      setViewRecord(fullRecord);
    } catch (err) {
      setViewError(explainApiError(err, "Record details"));
    } finally {
      setViewLoading(false);
    }
  };

  // Open refund confirmation modal
  const openRefundModal = (record) => {
    setRefundTarget(record);
    setRefundReason("");
    setRefundError("");
  };

  // Submit refund
  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundTarget) return;

    if (!refundReason.trim()) {
      setRefundError("Please provide a reason for the refund.");
      return;
    }

    setRefundSubmitting(true);
    setRefundError("");

    try {
      await api(`/api/finance/records/${refundTarget._id}/refund`, {
        token,
        method: "POST",
        body: {
          reason: refundReason.trim(),
        },
      });

      notify?.("success", `Refund for ${formatCurrency(refundTarget.amount)} processed successfully.`);
      setRefundTarget(null);
      loadRecords();
    } catch (err) {
      setRefundError(explainApiError(err, "Refund processing"));
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Export filtered dataset to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (term) params.set("term", term);

    try {
      const { data: blob } = await api(`/api/finance/export?${params.toString()}`, {
        token,
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", "financial_records.csv");
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      notify?.("success", "Financial records exported to CSV successfully.");
    } catch (err) {
      notify?.("error", explainApiError(err, "Financial export"));
    } finally {
      setExporting(false);
    }
  };

  const isEligibleForRefund = (r) => {
    const s = String(r.status).toUpperCase();
    return (s === "COMPLETED" || s === "SUCCEEDED") && !r.refundedAt;
  };

  return (
    <div className="page-stack">
      {/* Title & Top Export Action */}
      <div className="page-title-row">
        <div>
          <p className="eyebrow">GROUP B · FINANCIAL LEDGER</p>
          <h1>Financial Records</h1>
          <p className="page-description">
            Monitor student transactions, perform multi-field searches, process authorized refunds, and export datasets.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={handleExportCSV}
          disabled={exporting || loading}
          title="Download filtered records as CSV"
        >
          {exporting ? "Exporting CSV…" : "⤓ Export CSV"}
        </button>
      </div>

      {/* Filters Toolbar */}
      <section className="panel directory-filters">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">FILTER & SEARCH</p>
            <h2>Transaction Lookup</h2>
          </div>
          <span className="panel-count">01</span>
        </div>

        <div className="filter-grid">
          <label className="field span-two">
            <span>Search records</span>
            <input
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Student ID, Name, Receipt ID, Reference..."
            />
          </label>

          <label className="field">
            <span>Transaction Type</span>
            <select value={type} onChange={handleTypeChange}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Payment Status</span>
            <select value={status} onChange={handleStatusChange}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Academic Term</span>
            <select value={term} onChange={handleTermChange}>
              {TERM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="text-button" type="button" onClick={handleClearFilters}>
            Clear filters
          </button>
          <button className="text-button push-right" type="button" onClick={() => loadRecords()}>
            ↻ Refresh
          </button>
        </div>
      </section>

      {/* Error Feedback */}
      {error && (
        <div className="feedback error" role="alert">
          {error}
        </div>
      )}

      {/* Table & Results Panel */}
      <section className="panel results-panel" aria-busy={loading}>
        <div className="results-heading">
          <div>
            <p className="eyebrow">LEDGER ENTRIES</p>
            <h2>Transactions</h2>
          </div>
          <span className="result-count">
            {loading ? "Loading…" : `${total} ${total === 1 ? "record" : "records"} found`}
          </span>
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="loader" />
            Loading financial records…
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <span>💳</span>
            <h3>No financial records found</h3>
            <p>
              {error
                ? "The finance service could not be reached."
                : "No transactions match your current search query or filter criteria."}
            </p>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id}>
                      <td>{formatDate(r.occurredAt || r.createdAt)}</td>
                      <td>
                        <strong>{r.student?.studentId || "—"}</strong>
                      </td>
                      <td>{r.student?.name || r.student?.user?.fullName || "—"}</td>
                      <td>
                        <span className="role-pill">{r.type || r.kind || "—"}</span>
                      </td>
                      <td>
                        <strong className="badge-currency">
                          {formatCurrency(r.amount, r.currency)}
                        </strong>
                      </td>
                      <td>
                        <span className={`status-pill ${formatStatusClass(r.status)}`}>
                          {String(r.status).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="outline-button"
                            onClick={() => openDetails(r)}
                            title="View complete record breakdown"
                          >
                            View
                          </button>
                          {isEligibleForRefund(r) && (
                            <button
                              type="button"
                              className="outline-button danger-button"
                              onClick={() => openRefundModal(r)}
                              title="Process refund for this transaction"
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-bar">
              <span>
                Showing {Math.min((page - 1) * limit + 1, total)} to{" "}
                {Math.min(page * limit, total)} of {total} records
              </span>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  ← Previous
                </button>
                <span>
                  Page {page} of {totalPages || 1}
                </span>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Details Modal (Req 100) */}
      {viewRecord && (
        <div className="modal-backdrop" role="presentation" onClick={() => setViewRecord(null)}>
          <section
            className="modal-card wide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="financial-details-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">TRANSACTION BREAKDOWN</p>
                <h2 id="financial-details-title">Record Details</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setViewRecord(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {viewLoading ? (
              <div className="loading-state">
                <span className="loader" />
                Loading record breakdown…
              </div>
            ) : viewError ? (
              <div className="feedback error">{viewError}</div>
            ) : (
              <>
                <div className="detail-grid modal-details">
                  <DetailItem label="Transaction ID" value={viewRecord._id} />
                  <DetailItem
                    label="Reference Number"
                    value={viewRecord.referenceNumber || viewRecord.transactionReference || "—"}
                  />
                  <DetailItem label="Receipt ID" value={viewRecord.receiptId || "—"} />
                  <DetailItem
                    label="Student Name"
                    value={viewRecord.student?.name || viewRecord.student?.user?.fullName || "—"}
                  />
                  <DetailItem label="Student ID" value={viewRecord.student?.studentId || "—"} />
                  <DetailItem label="Student Email" value={viewRecord.student?.email || viewRecord.student?.user?.email || "—"} />
                  <DetailItem label="Faculty / Major" value={`${viewRecord.student?.faculty || "—"} / ${viewRecord.student?.major || "—"}`} />
                  <DetailItem label="Transaction Type" value={viewRecord.type || viewRecord.kind || "—"} />
                  <DetailItem
                    label="Total Amount"
                    value={formatCurrency(viewRecord.amount, viewRecord.currency)}
                  />
                  <DetailItem
                    label="Status"
                    value={
                      <span className={`status-pill ${formatStatusClass(viewRecord.status)}`}>
                        {String(viewRecord.status).toUpperCase()}
                      </span>
                    }
                  />
                  <DetailItem
                    label="Settlement Option"
                    value={viewRecord.settlementOption || "—"}
                  />
                  <DetailItem
                    label="Academic Term"
                    value={viewRecord.term?.code || (typeof viewRecord.term === "string" ? viewRecord.term : "—")}
                  />
                  <DetailItem
                    label="Created Date"
                    value={formatDate(viewRecord.createdAt || viewRecord.occurredAt)}
                  />
                  <DetailItem
                    label="Occurred Date"
                    value={formatDate(viewRecord.occurredAt)}
                  />
                </div>

                {/* Line Items Breakdown */}
                <div style={{ marginTop: "20px" }}>
                  <p className="eyebrow">ITEMIZED CHARGES</p>
                  <h3>Line Items</h3>
                  {Array.isArray(viewRecord.lineItems) && viewRecord.lineItems.length > 0 ? (
                    <div className="table-scroll modal-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Quantity</th>
                            <th>Rate</th>
                            <th>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewRecord.lineItems.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.description || "Charge item"}</td>
                              <td>{item.quantity ?? 1}</td>
                              <td>{item.rate != null ? formatCurrency(item.rate, viewRecord.currency) : "—"}</td>
                              <td>
                                <strong>
                                  {formatCurrency(item.amount ?? item.subtotal ?? 0, viewRecord.currency)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="secondary-text" style={{ padding: "8px 0" }}>
                      No itemized line items recorded for this transaction. Total amount:{" "}
                      <strong>{formatCurrency(viewRecord.amount, viewRecord.currency)}</strong>
                    </p>
                  )}
                </div>

                {/* Refund Audit Information if applicable */}
                {(viewRecord.status === "REFUNDED" || viewRecord.refundedAt) && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "14px 16px",
                      background: "#f4f7f9",
                      borderRadius: "8px",
                      border: "1px solid #e3e9ed",
                    }}
                  >
                    <p className="eyebrow" style={{ color: "#395279" }}>
                      AUDIT TRAIL · REFUND LOG
                    </p>
                    <div className="detail-grid" style={{ marginTop: "8px" }}>
                      <DetailItem
                        label="Refunded At"
                        value={formatDate(viewRecord.refundedAt)}
                      />
                      <DetailItem
                        label="Refunded By"
                        value={viewRecord.refundedBy?.fullName || viewRecord.refundedBy?.email || "Administrator"}
                      />
                      <DetailItem
                        label="Refund Reason"
                        value={viewRecord.refundReason || "Administrative refund"}
                      />
                    </div>
                  </div>
                )}

                <div className="form-actions" style={{ marginTop: "20px" }}>
                  {isEligibleForRefund(viewRecord) && (
                    <button
                      type="button"
                      className="primary-button danger-button"
                      onClick={() => {
                        const target = viewRecord;
                        setViewRecord(null);
                        openRefundModal(target);
                      }}
                    >
                      Process Refund
                    </button>
                  )}
                  <button
                    type="button"
                    className="outline-button push-right"
                    onClick={() => setViewRecord(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Refund Confirmation Modal (Req 101 & 102) */}
      {refundTarget && (
        <div className="modal-backdrop" role="presentation" onClick={() => setRefundTarget(null)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow" style={{ color: "var(--red)" }}>
                  ADMINISTRATIVE REVERSAL
                </p>
                <h2 id="refund-modal-title">Confirm Transaction Refund</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setRefundTarget(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="page-description">
              You are about to issue a refund for this completed transaction. A balancing credit entry will be
              added to the student’s wallet, and the original record will be marked as <strong>REFUNDED</strong>.
            </p>

            <div
              style={{
                background: "#f9faf8",
                border: "1px solid #e7ece9",
                borderRadius: "8px",
                padding: "12px 14px",
                margin: "14px 0",
              }}
            >
              <div className="detail-grid">
                <DetailItem
                  label="Student"
                  value={`${refundTarget.student?.name || "Student"} (${refundTarget.student?.studentId || "—"})`}
                />
                <DetailItem
                  label="Refund Amount"
                  value={
                    <strong style={{ color: "var(--red)", fontSize: "12px" }}>
                      {formatCurrency(refundTarget.amount, refundTarget.currency)}
                    </strong>
                  }
                />
                <DetailItem
                  label="Receipt ID"
                  value={refundTarget.receiptId || refundTarget.referenceNumber || "—"}
                />
              </div>
            </div>

            {refundError && <div className="feedback error">{refundError}</div>}

            <form onSubmit={handleRefundSubmit}>
              <label className="field" style={{ marginTop: "12px" }}>
                <span>
                  Reason for Refund <strong style={{ color: "var(--red)" }}>*</strong>
                </span>
                <textarea
                  required
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Specify the reason for issuing this refund (e.g. Schedule cancellation, course drop in add/drop period)..."
                  maxLength={500}
                />
              </label>

              <div className="form-actions" style={{ marginTop: "18px" }}>
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setRefundTarget(null)}
                  disabled={refundSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button danger-button push-right"
                  disabled={refundSubmitting || !refundReason.trim()}
                >
                  {refundSubmitting ? "Processing Refund…" : "Confirm & Issue Refund"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
