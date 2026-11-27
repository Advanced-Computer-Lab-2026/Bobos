import { termLabel } from "../term-label.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { StudentIdentity, RegisterEmpty, RecordPages } from "./CoordinatorRecords.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";
import { Modal } from "./AcademicWorkspace.jsx";

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

function ledgerLabel(value) {
  const key = String(value || "—").toLowerCase();
  const readable = (key === "succeeded" ? "completed" : key).replaceAll("_", " ");
  return readable[0].toUpperCase() + readable.slice(1);
}

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

const formatAmount = (amount) => (Number(amount) || 0).toLocaleString();

function formatCurrency(amount, currency = "EGP") {
  return `${currency} ${formatAmount(amount)}`;
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
  return <div><dt>{label}</dt><dd>{value === "" || value == null ? "—" : value}</dd></div>;
}

function RecordAmount({ amount, currency }) {
  return <strong>{formatAmount(amount)} <span>{currency ?? "EGP"}</span></strong>;
}

function recordRequestLabel(request) {
  if (request && typeof request === "object") {
    return [request._id, request.decisionStatus && ledgerLabel(request.decisionStatus)].filter(Boolean).join(" · ") || "—";
  }
  return request;
}

export default function FinancialRecordsPage({ token, notify }) {
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal states
  const [viewRecord, setViewRecord] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const viewRequest = useRef(null);

  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState("");
  const requestingReversal = Boolean(refundTarget?.requestableReversal);
  const cancellingCharge = (refundTarget?.requestableReversal || refundTarget?.availableReversal) === "cancelDeferredCharge";

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
      if (page > (data.totalPages || 1)) setPage(data.totalPages || 1);
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

  useEffect(() => () => viewRequest.current?.abort(), []);

  const closeDetails = () => {
    viewRequest.current?.abort();
    setViewRecord(null);
  };

  // Open details modal and fetch complete record metadata
  const openDetails = async (record) => {
    viewRequest.current?.abort();
    const controller = new AbortController();
    viewRequest.current = controller;
    setViewRecord(record);
    setViewLoading(true);
    setViewError("");
    try {
      const fullRecord = await api(`/api/finance/records/${record._id}`, { token, signal: controller.signal });
      if (!controller.signal.aborted) setViewRecord(fullRecord);
    } catch (err) {
      if (!controller.signal.aborted) setViewError(explainApiError(err, "Record details"));
    } finally {
      if (!controller.signal.aborted) setViewLoading(false);
    }
  };

  // Open refund confirmation modal
  const openRefundModal = (record) => {
    setRefundTarget(record);
    setRefundReason(record.reversalReason || "");
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
      const action = requestingReversal ? "reversal-request" : "refund";
      const result = await api(`/api/finance/records/${refundTarget._id}/${action}`, {
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
      setRefundError(explainApiError(err, requestingReversal ? "Reversal request" : cancellingCharge ? "Charge cancellation" : "Refund processing"));
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

  const recordTerm = viewRecord && terms.find(item => [viewRecord.term, viewRecord.term?._id, viewRecord.term?.code, viewRecord.extraHoursRequest?.term?.code].some(key => item._id === key || item.code === key));
  const cancelledCharge = viewRecord?.kind === "deferredChargeCancellation" || (viewRecord?.kind === "deferredCharge" && viewRecord?.status?.toLowerCase() === "cancelled");
  const searchField = <label className="field filter-search">
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
          </label>;
  const filterFields = <>
          <label className="field">
            <span>Transaction type</span>
            <select value={type} onChange={handleTypeChange}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value ? ledgerLabel(opt.value) : opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Payment status</span>
            <select value={status} onChange={handleStatusChange}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value ? ledgerLabel(opt.value) : opt.label}
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
                  {termLabel(option)}
                </option>
              ))}
            </select>
          </label>
  </>;
  const dateFields = <>
    <label className="field">
      <span>From date</span>
      <input type="date" data-calendar-range="financial-records" data-calendar-edge="start" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} />
    </label>
    <label className="field">
      <span>To date</span>
      <input type="date" data-calendar-range="financial-records" data-calendar-edge="end" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} />
    </label>
  </>;
  return (
    <div className="page-stack workspace-page finance-page">
      {/* Title & Top Export Action */}
      <div className="workspace-header">
        <div>
          <h1>Financial records</h1>

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
        <FilterDisclosure floating actions={<>
          <button className="text-button" type="button" disabled={!hasFilters} onClick={handleClearFilters}>Clear</button>
        </>} chips={[
          [type, setType], [status, setStatus], [term, setTerm], [settlementOption, setSettlementOption],
          [startDate && "From " + startDate, setStartDate], [endDate && "Through " + endDate, setEndDate],
        ].filter(([label]) => label).map(([label, reset], index) => ({ key: index, label: label === term ? termLabel(terms.find(item => item.code === term)) : ledgerLabel(label), onRemove: () => { reset(""); setPage(1); } }))}
          search={searchField}>
          <div className="filter-grid ledger-filter-grid">{filterFields}<div className="ledger-date-range">{dateFields}</div></div>

        </FilterDisclosure>
      </section>

      {/* Error Feedback */}
      {error && (
        <div className="feedback error" role="alert">
          {error}
        </div>
      )}

      {/* Table & Results Panel */}
      <section className="panel results-panel ledger-results" aria-busy={loading} aria-labelledby="transactions-heading">
        <div className="results-heading">
          <h2 id="transactions-heading">Transactions</h2>
          <span className="result-count" role="status">
            {loading ? "Loading…" : `${total} ${total === 1 ? "transaction" : "transactions"}`}
          </span>
        </div>

        {loading ? (
          <div className="loading-state">
            <span className="loader" />
            Loading financial records…
          </div>
        ) : records.length === 0 ? (
          <RegisterEmpty art="payment-ledger.svg" title={hasFilters ? "No matching transactions" : "No transactions yet"}
            description={hasFilters ? "Try another search or clear the filters." : "Payments, deferred charges and refunds will appear here when they are recorded."}
            action={hasFilters ? <button className="outline-button" type="button" onClick={handleClearFilters}>Clear filters</button> : undefined} />
        ) : (
          <>
            <div className="finance-register table-scroll graduation-register student-register register-with-actions">
              <table>
                <thead>
                  <tr>
                    <th>Student</th><th>Transaction</th><th className="ledger-balance"><span className="ledger-amount-heading">Amount</span></th>
                    <th>Payment status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r._id} aria-label={[r.student?.name, ledgerLabel(r.type || r.kind), formatCurrency(r.amount, r.currency), r.deferredChargeReference || r.referenceNumber].filter(Boolean).join(" · ")}>
                        <td className="ledger-student"><StudentIdentity name={r.student?.name || r.student?.user?.fullName} id={r.student?.studentId} /></td>
                        <td className="ledger-transaction"><strong>{ledgerLabel(r.type || r.kind)}</strong>
                          <small>{[SETTLEMENT_LABELS[r.settlementOption], (r.occurredAt || r.createdAt) && new Date(r.occurredAt || r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · ")}</small></td>
                        <td className="ledger-balance"><span className="ledger-value">
                          <strong className="record-amount">{formatAmount(r.amount)}</strong>{" "}
                          <span className="ledger-currency">{r.currency ?? "EGP"}</span>
                        </span></td>
                        <td><span className={`status-pill ${formatStatusClass(r.status)}`}>{ledgerLabel(r.status)}</span></td>
                      <td>
                        <div className="ledger-actions">
                          <button
                            type="button"
                            className="outline-button"
                            onClick={() => openDetails(r)}
                            title="View complete record breakdown"
                          >
                            View
                          </button>
                          {(r.availableReversal || r.requestableReversal) && (
                            <button
                              type="button"
                              className="outline-button danger-button ledger-reversal"
                              data-request={r.availableReversal ? undefined : true}
                              onClick={() => openRefundModal(r)}
                            >
                              {r.availableReversal ? (r.availableReversal === "cancelDeferredCharge" ? "Cancel charge" : "Refund") : r.requestableReversal === "cancelDeferredCharge" ? "Request cancellation" : "Request refund"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <RecordPages page={page} size={limit} total={total} busy={loading} onChange={setPage} label="Financial records" />
          </>
        )}
      </section>

      {/* Details Modal (Req 100) */}
      {viewRecord && <Modal title="Transaction details" className="finance-detail-dialog" wide onClose={closeDetails}>
        {viewLoading ? <div className="loading-state" role="status"><span className="loader" />Loading record breakdown…</div>
          : viewError ? <div className="feedback error" role="alert">{viewError}</div>
          : <div className="finance-dialog-content">
            <div className="finance-record-intro">
              <div className="finance-record-person">
                <StudentIdentity name={viewRecord.student?.name || viewRecord.student?.user?.fullName} id={viewRecord.student?.studentId}
                  email={viewRecord.student?.email || viewRecord.student?.user?.email} />
                {(viewRecord.student?.faculty || viewRecord.student?.major) && <p>{[viewRecord.student.faculty, viewRecord.student.major].filter(Boolean).join(" / ")}</p>}
              </div>
              <div className="finance-record-value">
                <span>{ledgerLabel(viewRecord.type || viewRecord.kind)}</span>
                <RecordAmount amount={viewRecord.amount} currency={viewRecord.currency} />
                <span className={`status-pill ${formatStatusClass(viewRecord.status)}`}>{ledgerLabel(viewRecord.status)}</span>
              </div>
            </div>

            <section aria-labelledby="finance-line-items">
              <h3 id="finance-line-items">Line items</h3>
              {Array.isArray(viewRecord.lineItems) && viewRecord.lineItems.length > 0 ? <div className="table-scroll modal-table finance-line-items">
                <table role="table" aria-labelledby="finance-line-items">
                  <thead><tr><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Rate</th><th scope="col">Subtotal</th></tr></thead>
                  <tbody>{viewRecord.lineItems.map((item, index) => <tr key={index}>
                    <td>{item.description || "Charge item"}</td>
                    <td data-label="Quantity">{item.quantity ?? 1}</td>
                    <td data-label="Rate">{item.rate != null ? formatCurrency(item.rate, viewRecord.currency) : "—"}</td>
                    <td data-label="Subtotal"><strong>{formatCurrency(item.amount ?? item.subtotal ?? 0, viewRecord.currency)}</strong></td>
                  </tr>)}</tbody>
                </table>
              </div> : <p className="secondary-text">No itemized charges recorded for this transaction.</p>}
            </section>

            <div className="finance-record-context">
              <section aria-labelledby="finance-payment-information">
                <h3 id="finance-payment-information">Payment information</h3>
                <dl className="finance-record-facts">
                  <DetailItem label="Settlement" value={SETTLEMENT_LABELS[viewRecord.settlementOption] || viewRecord.settlementOption || "—"} />
                  <DetailItem label="Academic term" value={recordTerm ? termLabel(recordTerm) : viewRecord.term?.code ||
                    viewRecord.extraHoursRequest?.term?.code || (typeof viewRecord.term === "string" ? viewRecord.term : "—")} />
                  <DetailItem label="Occurred" value={formatDate(viewRecord.occurredAt)} />
                  <DetailItem label="Created" value={formatDate(viewRecord.createdAt || viewRecord.occurredAt)} />
                </dl>
              </section>
              <section aria-labelledby="finance-references">
                <h3 id="finance-references">References</h3>
                <dl className="finance-record-facts">
                  <DetailItem label="Receipt ID" value={viewRecord.receiptId} />
                  <DetailItem label="Reference number" value={viewRecord.referenceNumber || viewRecord.transactionReference} />
                  <DetailItem label="Transaction ID" value={viewRecord._id} />
                  <DetailItem label="Linked request" value={recordRequestLabel(viewRecord.linkedRequest || viewRecord.extraHoursRequest)} />
                  {viewRecord.deferredChargeReference && <DetailItem label="Deferred charge" value={viewRecord.deferredChargeReference} />}
                  {viewRecord.installmentId && <DetailItem label="Installment" value={`INST-${viewRecord.installmentId}`} />}
                </dl>
              </section>
            </div>

            {(String(viewRecord.status).toUpperCase() === "REFUNDED" || viewRecord.refundedAt) && <section aria-labelledby="finance-refund-audit">
              <h3 id="finance-refund-audit">{cancelledCharge ? "Cancellation details" : "Refund details"}</h3>
              <dl className="finance-record-facts">
                <DetailItem label={cancelledCharge ? "Cancelled at" : "Refunded at"} value={formatDate(viewRecord.refundedAt)} />
                <DetailItem label={cancelledCharge ? "Cancelled by" : "Refunded by"} value={viewRecord.refundedBy?.fullName || viewRecord.refundedBy?.email} />
                <DetailItem label={cancelledCharge ? "Cancellation reason" : "Refund reason"} value={viewRecord.refundReason} />
              </dl>
            </section>}
            <div className="form-actions finance-dialog-actions">
              <button type="button" className="outline-button" onClick={closeDetails}>Close</button>
              {(viewRecord.availableReversal || viewRecord.requestableReversal) && <button type="button" className="primary-button"
                onClick={() => { closeDetails(); openRefundModal(viewRecord); }}>
                {viewRecord.availableReversal ? (viewRecord.availableReversal === "cancelDeferredCharge" ? "Cancel charge" : "Process refund") :
                  viewRecord.requestableReversal === "cancelDeferredCharge" ? "Request cancellation" : "Request refund"}
              </button>}
            </div>
          </div>}
      </Modal>}

      {refundTarget && <Modal title={requestingReversal ? (cancellingCharge ? "Request charge cancellation" : "Request refund") :
        cancellingCharge ? "Cancel deferred charge" : "Confirm refund"} className="finance-reversal-dialog"
        onClose={() => { if (!refundSubmitting) setRefundTarget(null); }}>
        <div className="finance-dialog-content">
          <div className="finance-record-intro">
            <div className="finance-record-person">
              <StudentIdentity name={refundTarget.student?.name || refundTarget.student?.user?.fullName} id={refundTarget.student?.studentId} />
              {refundTarget.receiptId ? <p>Receipt {refundTarget.receiptId}</p> :
                refundTarget.referenceNumber && <p>Reference {refundTarget.referenceNumber}</p>}
            </div>
            <div className="finance-record-value">
              <span>{cancellingCharge ? "Amount to cancel" : "Refund amount"}</span>
              <RecordAmount amount={refundTarget.amount} currency={refundTarget.currency} />
            </div>
          </div>
          <form className="finance-reversal-form" onSubmit={handleRefundSubmit}>
            <p className="finance-reversal-copy">{requestingReversal ? "The coordinator will receive this reversal request for review."
            : cancellingCharge ? "This removes the charge from the student’s next installment and revokes the related extra hours."
            : "This returns the payment to the student’s wallet."}</p>
            {refundError && <div className="feedback error" role="alert">{refundError}</div>}
            <label className="field"><span>Reason (required)</span>
              <textarea required rows={3} value={refundReason} onChange={(event) => setRefundReason(event.target.value)} maxLength={500} disabled={refundSubmitting} />
            </label>
            <div className="form-actions finance-dialog-actions">
              <button type="button" className="outline-button" onClick={() => setRefundTarget(null)} disabled={refundSubmitting}>Cancel</button>
              <button type="submit" className="primary-button destructive-action" disabled={refundSubmitting || !refundReason.trim()}>
                {refundSubmitting ? "Saving…" : requestingReversal ? "Submit request" : cancellingCharge ? "Confirm cancellation" : "Confirm refund"}
              </button>
            </div>
          </form>
        </div>
      </Modal>}
    </div>
  );
}
