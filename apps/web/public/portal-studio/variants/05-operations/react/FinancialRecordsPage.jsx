import { OpsFrame, OpsTable, OpsSections, OpsDesignControl, OpsGate, OpsModalFocus } from "./OperationsDesign.jsx";
import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";
import { WorkspaceEmpty } from "../components/WorkspaceUI.jsx";

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

function FinancialRecordsContent({ token, role, notify }) {
  // Query & filter states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [term, setTerm] = useState("");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [settlementOption,setSettlementOption]=useState("");
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
    setTerm("");setStartDate("");setEndDate("");setSettlementOption("");
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
    if(startDate)params.set("startDate",startDate);
    if(endDate)params.set("endDate",endDate);
    if(settlementOption)params.set("settlementOption",settlementOption);

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
  }, [debouncedSearch, type, status, term, startDate, endDate, settlementOption, page, token]);

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

  // The supplied audit proves the legacy reversal endpoint unsafe (R102).
  // This adapter deliberately does not send a financial mutation until that API
  // is repaired. Original source is retained in components/, untouched.
  const handleRefundSubmit = (event) => {
    event.preventDefault();
    setRefundError("Reversal is unavailable: server-side cancellation eligibility, exactly-once reversal and credit revocation must be repaired first. No money has moved.");
  };

  // Export filtered dataset to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    if (term) params.set("term", term);
    if(startDate)params.set("startDate",startDate);
    if(endDate)params.set("endDate",endDate);
    if(settlementOption)params.set("settlementOption",settlementOption);

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
    return ((s === "COMPLETED" || s === "SUCCEEDED") && !r.refundedAt) || (r.kind === "deferredCharge" && s === "PENDING");
  };

  return (
    <OpsFrame pageKey={refundTarget?"financial-reversal":viewRecord?"financial-record-detail":"financial-records"} role={role} controlInDialog={Boolean(viewRecord||refundTarget)}><div className="page-stack workspace-page finance-page">
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
          disabled={exporting || loading}
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
              placeholder="Student ID, name, receipt or reference…"
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
            <span>Academic term</span>
            <select value={term} onChange={handleTermChange}>
              {TERM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field"><span>Settlement option</span><select value={settlementOption} onChange={e=>{setSettlementOption(e.target.value);setPage(1);}}><option value="">All options</option><option value="wallet">Wallet</option><option value="gateway">Gateway</option><option value="deferred">Next installment</option></select></label>
          <label className="field"><span>From date</span><input type="date" value={startDate} max={endDate||undefined} onChange={e=>{setStartDate(e.target.value);setPage(1);}}/></label>
          <label className="field"><span>Through date</span><input type="date" value={endDate} min={startDate||undefined} onChange={e=>{setEndDate(e.target.value);setPage(1);}}/></label>
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
          <WorkspaceEmpty title={search || type || status || term ? "No matching transactions" : "No transactions yet"}
            description={error ? "Refresh the page to try loading financial records again." : search || type || status || term ? "Try another student ID or clear your filters to see all transactions." : "Payments, deferred charges and refunds will appear here when they are recorded."}
            action={search || type || status || term ? <button className="outline-button" type="button" onClick={handleClearFilters}>Clear filters</button> : undefined} />
        ) : (
          <>
            <div className="table-scroll">
              <OpsTable>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Request / reference</th><th>Settlement option</th><th>Actions</th>
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
                      <td>{typeof (r.linkedRequest||r.extraHoursRequest)==="object"?(r.linkedRequest||r.extraHoursRequest)?._id:(r.linkedRequest||r.extraHoursRequest||"—")}<small>{r.transactionReference||r.deferredChargeReference||r.referenceNumber||"—"}</small></td><td>{r.settlementOption||"—"}</td>
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
                              title="Review reversal eligibility"
                            >
                              Review reversal
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </OpsTable>
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

      {viewRecord && <div className="modal-backdrop" role="presentation" onClick={()=>setViewRecord(null)}><section className="modal-card wide-modal" role="dialog" aria-modal="true" aria-labelledby="financial-details-title" onClick={e=>e.stopPropagation()}><OpsModalFocus onClose={()=>setViewRecord(null)} label="Financial details"><OpsDesignControl/><div className="modal-heading"><h2 id="financial-details-title">Record details</h2><button type="button" className="icon-button" aria-label="Close record details" onClick={()=>setViewRecord(null)}>×</button></div>
        {viewLoading?<p role="status">Loading record…</p>:viewError?<p className="feedback error" role="alert">{viewError}</p>:<OpsSections sections={[
          {id:"identity",title:"Student and source",content:<div className="detail-grid"><DetailItem label="Student" value={`${viewRecord.student?.name||viewRecord.student?.user?.fullName||"Student"} · ${viewRecord.student?.studentId||"—"}`}/><DetailItem label="Request" value={typeof(viewRecord.linkedRequest||viewRecord.extraHoursRequest)==="object"?(viewRecord.linkedRequest||viewRecord.extraHoursRequest)?._id:(viewRecord.linkedRequest||viewRecord.extraHoursRequest)}/><DetailItem label="Term" value={viewRecord.term?.code|| (typeof viewRecord.term==="string"?viewRecord.term:"—")}/><DetailItem label="Recorded" value={formatDate(viewRecord.occurredAt||viewRecord.createdAt)}/></div>},
          {id:"settlement",title:"Settlement record",content:<div className="detail-grid"><DetailItem label="Amount" value={formatCurrency(viewRecord.amount,viewRecord.currency)}/><DetailItem label="Status" value={viewRecord.status}/><DetailItem label="Method" value={viewRecord.settlementOption||viewRecord.paymentMethod}/><DetailItem label="Transaction reference" value={viewRecord.transactionReference||viewRecord.referenceNumber}/><DetailItem label="Deferred reference" value={viewRecord.deferredChargeReference}/><DetailItem label="Installment" value={viewRecord.installment}/><DetailItem label="Receipt" value={viewRecord.receiptId}/><DetailItem label="Type" value={viewRecord.type||viewRecord.kind}/></div>},
          {id:"items",title:"Line items and audit",content:<>{viewRecord.lineItems?.length?<OpsTable><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>{viewRecord.lineItems.map((item,index)=><tr key={index}><td>{item.description||item.name||"Line item"}</td><td>{formatCurrency(item.amount||item.subtotal,viewRecord.currency)}</td></tr>)}</tbody></OpsTable>:<p>No line items were returned for this record.</p>}{viewRecord.refundedAt&&<p>Reversed {formatDate(viewRecord.refundedAt)} · {viewRecord.refundReason||"No reason returned"} · {viewRecord.refundedBy?.fullName||viewRecord.refundedBy?.email||"Staff identity not returned"}</p>}{viewRecord.meta&&<details><summary>Stored metadata</summary><pre className="ops05-metadata">{JSON.stringify(viewRecord.meta,null,2)}</pre></details>}</>}
        ]}/>}
        <div className="form-actions"><button className="outline-button" type="button" onClick={()=>setViewRecord(null)}>Back to records</button>{isEligibleForRefund(viewRecord)&&<button className="outline-button" type="button" onClick={()=>{setViewRecord(null);openRefundModal(viewRecord);}}>Review reversal</button>}</div>
      </OpsModalFocus></section></div>}
      {refundTarget && <div className="modal-backdrop" role="presentation" onClick={()=>setRefundTarget(null)}><section className="modal-card wide-modal" role="dialog" aria-modal="true" aria-labelledby="refund-modal-title" onClick={e=>e.stopPropagation()}><OpsModalFocus onClose={()=>setRefundTarget(null)} label="Reversal review"><OpsDesignControl/><div className="modal-heading"><h2 id="refund-modal-title">Review reversal</h2><button type="button" className="icon-button" aria-label="Close reversal" onClick={()=>setRefundTarget(null)}>×</button></div><OpsSections sections={[
        {id:"record",title:"Original record",content:<div className="detail-grid"><DetailItem label="Student" value={`${refundTarget.student?.name||"Student"} · ${refundTarget.student?.studentId||"—"}`}/><DetailItem label="Amount" value={formatCurrency(refundTarget.amount,refundTarget.currency)}/><DetailItem label="Reference" value={refundTarget.transactionReference||refundTarget.deferredChargeReference||refundTarget.referenceNumber}/><DetailItem label="Status" value={refundTarget.status}/></div>},
        {id:"rules",title:"Required safeguards",content:<><p>{refundTarget.kind==="deferredCharge"?"An unpaid deferred charge must be cancelled without crediting the wallet.":"A paid extra-hours charge may be refunded once to the wallet only after the linked request is cancelled and eligible."}</p><p>Both paths must revoke activated hours, remove unapplied additions and record staff, time and reason atomically.</p><p className="ops05-readonly-note" role="status">Unavailable in the supplied backend. Its audit identifies missing cancellation checks, duplicate-refund protection and credit revocation. This adapter does not call that unsafe endpoint.</p></>},
        {id:"reason",title:"Review note",content:<form onSubmit={handleRefundSubmit}><label className="field"><span>Reason for review (not saved)</span><textarea value={refundReason} onChange={e=>setRefundReason(e.target.value)} maxLength={500} rows={3}/></label>{refundError&&<p role="alert">{refundError}</p>}<div className="form-actions"><button type="button" className="outline-button" onClick={()=>setRefundTarget(null)}>Cancel review</button><button type="button" className="primary-button" disabled title="Requires a verified backend reversal repair">Reversal unavailable</button></div></form>}
      ]}/></OpsModalFocus></section></div>}
    </div></OpsFrame>
  );
}
export default function FinancialRecordsPage(props){return <OpsGate pageKey="financial-records" role={props.role}><FinancialRecordsContent {...props}/></OpsGate>;}
