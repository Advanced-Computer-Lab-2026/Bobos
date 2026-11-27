import { useCallback, useEffect, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { WorkspaceEmpty } from "./WorkspaceUI.jsx";

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "TUITION", label: "TUITION" },
  { value: "EXTRA_HOURS", label: "EXTRA_HOURS" },
  { value: "FEE", label: "FEE" },
  { value: "REFUND", label: "REFUND" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "COMPLETED", label: "COMPLETED" },
  { value: "PENDING", label: "PENDING" },
  { value: "REFUNDED", label: "REFUNDED" },
  { value: "FAILED", label: "FAILED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

const SETTLEMENT_LABELS = { wallet: "Wallet", gateway: "Gateway", deferred: "Next installment" };

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
  const [terms, setTerms] = useState([]);
  const [settlementOption, setSettlementOption] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
  const cancellingCharge = refundTarget?.availableReversal === "cancelDeferredCharge";

  const [exporting, setExporting] = useState(false);

  const filterQuery = new URLSearchParams(Object.entries({
    type, status, term, settlementOption, startDate, endDate,
  }).filter(([, value]) => value)).toString();
  const hasFilters = Boolean(search || filterQuery);
  const invalidDateRange = Boolean(startDate && endDate && startDate > endDate);

  useEffect(() => {
    const controller = new AbortController();
    api("/api/academic-terms/academicTerm", { token, signal: controller.signal })
      .then(data => setTerms(Array.isArray(data) ? data : []))
      .catch((error) => {
        if (!controller.signal.aborted) notify?.("error", explainApiError(error, "Academic terms"));
      });
    return () => controller.abort();
  }, [token, notify]);

  // Debounce search input
  const lastSearchRef = useRef("");
  useEffect(() => {
    const trimmed = search.trim();
    const handler = setTimeout(() => {
      if (trimmed !== lastSearchRef.current) {
        lastSearchRef.current = trimmed;
        setDebouncedSearch(trimmed);
        setPage(1);
      }
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
    lastSearchRef.current = "";
    setSearch("");
    setDebouncedSearch("");
    setType("");
    setStatus("");
    setTerm("");
    setSettlementOption("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Fetch paginated financial records
  const loadRecords = useCallback(async (signal) => {
    if (invalidDateRange) {
      setError("The end date must be on or after the start date.");
      setRecords([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");

    const params = new URLSearchParams(filterQuery);
    params.set("page", String(page));
    params.set("limit", String(limit));

    if (debouncedSearch) params.set("search", debouncedSearch);

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
  }, [debouncedSearch, filterQuery, invalidDateRange, page, token]);

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
      setRefundError("Please provide a reason.");
      return;
    }

    setRefundSubmitting(true);
    setRefundError("");

    try {
      const result = await api(`/api/finance/records/${refundTarget._id}/refund`, {
        token,
        method: "POST",
        body: {
          reason: refundReason.trim(),
        },
      });

      notify?.("success", result.message);
      setRefundTarget(null);
      loadRecords();
    } catch (err) {
      setRefundError(explainApiError(err, cancellingCharge ? "Charge cancellation" : "Refund processing"));
    } finally {
      setRefundSubmitting(false);
    }
  };

  // Export filtered dataset to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    const params = new URLSearchParams(filterQuery);
    const activeSearch = search.trim();
    if (activeSearch) params.set("search", activeSearch);

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

  return (
    <div className="page-stack workspace-page finance-page">
      {/* Title & Top Export Action */}
      <div className="workspace-header">
        <div>
          <h1>Financial records</h1>
          <p className="page-description">
            Review student payments, deferred charges and refunds in one place.
          </p>
        </div>
        <button
          className="outline-button"
          type="button"
          onClick={handleExportCSV}
          disabled={exporting || loading || invalidDateRange}
          title="Download filtered records as CSV"
        >
          {exporting ? "Exporting CSV…" : "Export CSV"}
        </button>
      </div>

      {/* Filters Toolbar */}
      <section className="panel directory-filters">
        <div className="panel-heading">
          <div>
            <h2>Find a transaction</h2>
          </div>
        </div>

        <div className="filter-grid">
          <label className="field span-two">
            <span>Search records</span>
            <input
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              name="financial-search"
              autoComplete="off"
              placeholder="Student ID, request ID or reference"
            />
          </label>

          <label className="field">
            <span>Transaction type</span>
            <select value={type} onChange={handleTypeChange}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Payment status</span>
            <select value={status} onChange={handleStatusChange}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Settlement option</span>
            <select value={settlementOption} onChange={(e) => { setSettlementOption(e.target.value); setPage(1); }}>
              <option value="">All options</option>
              {Object.entries(SETTLEMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>

          <label className="field">
            <span>Academic term</span>
            <select value={term} onChange={handleTermChange}>
              <option value="">All terms</option>
              {terms.map((option) => (
                <option key={option._id} value={option.code}>
                  {option.code}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>From date</span>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          </label>

          <label className="field">
            <span>To date</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          </label>
        </div>

        <div className="filter-actions">
          <button className="text-button" type="button" onClick={handleClearFilters}>
            Clear filters
          </button>
          <button className="text-button push-right" type="button" onClick={() => loadRecords()}>
            Refresh
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
          <WorkspaceEmpty title={hasFilters ? "No matching transactions" : "No transactions yet"}
            description={hasFilters ? "Try another search or clear the filters." : "Payments, deferred charges and refunds will appear here when they are recorded."}
            action={hasFilters ? <button className="outline-button" type="button" onClick={handleClearFilters}>Clear filters</button> : undefined} />
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
                    <th>Request / Reference</th>
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
                        {r.settlementOption && <div className="secondary-text">{SETTLEMENT_LABELS[r.settlementOption]}</div>}
                      </td>
                      <td>
                        {r.deferredChargeReference || r.referenceNumber || "—"}
                        {r.extraHoursRequest?._id && <div className="secondary-text">Request {r.extraHoursRequest._id.slice(-8)}</div>}
                      </td>
                      <td>
                        <strong className="badge-currency">
                          {formatCurrency(r.amount, r.currency)}
                        </strong>
                      </td>
                      <td>
                        <span className={`status-pill ${formatStatusClass(r.status)}`}>
                          {String(r.status || "—").toUpperCase()}
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
                          {r.availableReversal && (
                            <button
                              type="button"
                              className="outline-button danger-button"
                              onClick={() => openRefundModal(r)}
                            >
                              {r.availableReversal === "cancelDeferredCharge" ? "Cancel charge" : "Refund"}
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
              <div className="feedback error" role="alert">{viewError}</div>
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
                        {String(viewRecord.status || "—").toUpperCase()}
                      </span>
                    }
                  />
                  <DetailItem
                    label="Settlement Option"
                    value={viewRecord.settlementOption || "—"}
                  />
                  <DetailItem
                    label="Academic Term"
                    value={
                      viewRecord.term?.code ||
                      viewRecord.extraHoursRequest?.term?.code ||
                      (typeof viewRecord.term === "string" ? viewRecord.term : "—")
                    }
                  />
                  <DetailItem
                    label="Linked Request"
                    value={
                      typeof (viewRecord.linkedRequest || viewRecord.extraHoursRequest) === "object" && (viewRecord.linkedRequest || viewRecord.extraHoursRequest)
                        ? `${(viewRecord.linkedRequest || viewRecord.extraHoursRequest)._id}${
                            (viewRecord.linkedRequest || viewRecord.extraHoursRequest).decisionStatus
                              ? ` (${(viewRecord.linkedRequest || viewRecord.extraHoursRequest).decisionStatus})`
                              : ""
                          }`
                        : viewRecord.linkedRequest || viewRecord.extraHoursRequest || "—"
                    }
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
                      background: "var(--ready-bg)",
                      borderRadius: "8px",
                      border: "1px solid #e3e9ed",
                    }}
                  >
                    <p className="eyebrow" style={{ color: "var(--ready-ink)" }}>
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
                  {viewRecord.availableReversal && (
                    <button
                      type="button"
                      className="primary-button danger-button"
                      onClick={() => {
                        const target = viewRecord;
                        setViewRecord(null);
                        openRefundModal(target);
                      }}
                    >
                      {viewRecord.availableReversal === "cancelDeferredCharge" ? "Cancel charge" : "Process refund"}
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
                <h2 id="refund-modal-title">{cancellingCharge ? "Cancel deferred charge" : "Confirm refund"}</h2>
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
              {cancellingCharge
                ? "This removes the charge from the student’s next installment and revokes the related extra hours."
                : "This returns the payment to the student’s wallet."}
            </p>

            <div
              style={{
                background: "var(--raised)",
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
                  label={cancellingCharge ? "Amount to cancel" : "Refund amount"}
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

            {refundError && <div className="feedback error" role="alert">{refundError}</div>}

            <form onSubmit={handleRefundSubmit}>
              <label className="field" style={{ marginTop: "12px" }}>
                <span>
                  Reason <strong style={{ color: "var(--red)" }}>*</strong>
                </span>
                <textarea
                  required
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
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
                  {refundSubmitting ? "Processing…" : cancellingCharge ? "Confirm cancellation" : "Confirm refund"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
