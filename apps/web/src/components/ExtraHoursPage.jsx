import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

const pretty = (value = "—") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (s) => s.toUpperCase());
const money = (amount) => `${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
const date = (value) => value ? new Date(value).toLocaleString() : "—";

export default function ExtraHoursPage({ token, role, notify }) {
  const student = role === "advisingStudent";
  const [rows, setRows] = useState([]); const [filters, setFilters] = useState({ studentId: "", advisorId: "", decisionStatus: "", settlementOption: "", settlementStatus: "" });
  const [advisors, setAdvisors] = useState([]); const [history, setHistory] = useState([]); const [walletBalance, setWalletBalance] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [busyId, setBusyId] = useState(""); const [notes, setNotes] = useState({}); const [gateway, setGateway] = useState({});
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (student) {
        const [requests, records, wallet] = await Promise.all([api("/api/extra-hours/mine", { token }), api("/api/extra-hours/mine/financial-history", { token }), api("/api/extra-hours/mine/wallet", { token })]);
        setRows(requests); setHistory(records); setWalletBalance(Number(wallet.balance || 0));
      } else {
        const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
        const [requests, advisorRows] = await Promise.all([api(`/api/extra-hours?${params}`, { token }), api("/api/advisor/advisors", { token })]);
        setRows(requests); setAdvisors(advisorRows.advisors || advisorRows || []);
      }
    } catch (e) { setError(e.message || "Unable to load extra-hours requests."); }
    finally { setLoading(false); }
  }, [token, student, filters]);
  useEffect(() => { load(); }, [load]);

  const decision = async (row, value) => {
    setBusyId(row._id); setError("");
    try { await api(`/api/extra-hours/${row._id}/decision`, { token, method: "POST", body: { decision: value, responseNote: notes[row._id] || "" } }); await load(); }
    catch (e) { setError(e.message); } finally { setBusyId(""); }
  };
  const withdraw = async (row) => {
    setBusyId(row._id); setError("");
    try { await api(`/api/extra-hours/${row._id}/withdraw`, { token, method: "POST", body: {} }); await load(); }
    catch (e) { setError(e.message); } finally { setBusyId(""); }
  };
  const settle = async (row, option, method) => {
    setBusyId(row._id); setError("");
    try {
      const result = await api(`/api/extra-hours/${row._id}/settlement`, { token, method: "POST", body: option === "now" ? { option, method, ...(method === "gateway" ? { gatewayResult: gateway[row._id] || "succeeded" } : {}) } : { option } });
      if (result.confirmation?.type === "paidReceipt") notify("success", `Payment complete. Receipt reference ${result.confirmation.transactionReference}.`);
      if (result.confirmation?.type === "deferredPaymentConfirmation") notify("success", `Deferred charge confirmed for ${result.confirmation.installment}.`);
      await load();
    } catch (e) { setError(e.message); } finally { setBusyId(""); }
  };
  const downloadConfirmation = async (record) => {
    try {
      const { data: blob, response } = await api(`/api/extra-hours/mine/financial-history/${record._id}/download`, { token, responseType: "blob" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || `extra-hours-confirmation-${record._id}.pdf`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message || "Unable to download confirmation."); }
  };
  return <div className="page-stack"><div className="page-title-row"><div><p className="eyebrow">STUDENT SERVICES</p><h1>Extra-hours requests</h1><p className="page-description">{student ? "Review approved costs, choose how to settle them, and view request and payment history." : "Search, filter, review eligibility and costs, then decide submitted requests."}</p></div><button className="outline-button" type="button" onClick={load}>↻ Refresh</button></div>
    {student && <section className="panel wallet-balance"><div><p>Available wallet balance</p><strong>{money(walletBalance)}</strong></div></section>}
    {!student && <section className="panel"><div className="filter-grid"><label className="field"><span>Student ID</span><input value={filters.studentId} onChange={(e) => setFilters({ ...filters, studentId: e.target.value })} placeholder="64-12345" /></label><label className="field"><span>Requesting advisor</span><select value={filters.advisorId} onChange={(e) => setFilters({ ...filters, advisorId: e.target.value })}><option value="">All advisors</option>{advisors.map((a) => <option value={a._id} key={a._id}>{a.fullName}</option>)}</select></label><label className="field"><span>Decision</span><select value={filters.decisionStatus} onChange={(e) => setFilters({ ...filters, decisionStatus: e.target.value })}><option value="">All decisions</option>{["pending", "approved", "rejected", "withdrawn"].map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></label><label className="field"><span>Settlement option</span><select value={filters.settlementOption} onChange={(e) => setFilters({ ...filters, settlementOption: e.target.value })}><option value="">All options</option>{["wallet", "gateway", "deferred"].map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></label><label className="field"><span>Settlement status</span><select value={filters.settlementStatus} onChange={(e) => setFilters({ ...filters, settlementStatus: e.target.value })}><option value="">All statuses</option>{["none", "awaitingChoice", "paid", "deferred", "failed", "cancelled", "refunded"].map((x) => <option key={x} value={x}>{pretty(x)}</option>)}</select></label></div></section>}
    {error && <div className="feedback error" role="alert">{error}</div>}
    {loading ? <section className="panel loading-state"><span className="loader" />Loading requests…</section> : rows.length === 0 ? <section className="panel empty-state"><span>◌</span><h3>No extra-hours requests</h3><p>Requests will appear here when they are submitted.</p></section> : rows.map((row) => <section className="panel" key={row._id}><div className="results-heading"><div><p className="eyebrow">REQUEST · {row._id.slice(-8)}</p><h2>{row.student?.user?.fullName || "Your request"} {row.student?.studentId ? `· ${row.student.studentId}` : ""}</h2><p className="helper-text">{row.term?.code} · Submitted {date(row.createdAt)} · Advisor {row.advisor?.fullName || "—"}</p></div><span className={`status-pill ${row.decisionStatus === "approved" ? "good" : "muted"}`}>{pretty(row.decisionStatus)} · {pretty(row.settlementStatus)}</span></div>
      <div className="detail-grid"><div className="detail-item"><span>Eligibility</span><strong>{row.eligibilitySnapshot?.isProbation ? "Probation: ineligible" : `${row.eligibilitySnapshot?.hoursBeforeRequest} + ${row.requestedHours} = ${row.eligibilitySnapshot?.hoursAfterRequest} hours`}</strong></div><div className="detail-item"><span>Standard allowance</span><strong>{row.eligibilitySnapshot?.standardAllowance} hours</strong></div><div className="detail-item"><span>Graduating within one year</span><strong>{row.eligibilitySnapshot?.graduatingWithinOneYear ? "Yes" : "No"}</strong></div><div className="detail-item"><span>Total cost</span><strong>{money(row.totalCost)}</strong></div></div>
      <div className="table-scroll"><table><thead><tr><th>Course</th><th>Hours</th><th>Rate</th><th>Repeated</th><th>Subtotal</th></tr></thead><tbody>{row.courses?.map((item) => <tr key={item.course?._id || item.course}><td><strong>{item.course?.code || "Course"}</strong><span className="secondary-text">{item.course?.name}</span></td><td>{item.hours}</td><td>{money(item.pricePerHour)} / hr</td><td>{item.isRepeated ? "Yes" : "No"}</td><td>{money(item.subtotal)}</td></tr>)}</tbody></table></div>
      {row.decisionNote && <p className="feedback info">Coordinator response: {row.decisionNote}</p>}
      {!student && row.decisionStatus === "pending" && <div className="form-stack"><label className="field"><span>Response note</span><textarea rows={2} maxLength={1000} value={notes[row._id] || ""} onChange={(e) => setNotes({ ...notes, [row._id]: e.target.value })} /></label><div className="form-actions"><button className="outline-button" disabled={busyId === row._id} onClick={() => decision(row, "rejected")}>Reject</button><button className="primary-button" disabled={busyId === row._id} onClick={() => decision(row, "approved")}>Approve · makes available to settle</button></div></div>}
      {student && row.decisionStatus === "approved" && !["paid", "deferred"].includes(row.settlementStatus) && <div className="form-stack"><p className="helper-text">Approval does not add these courses to your usable schedule until payment succeeds or you confirm deferral.</p><div className="inline-controls"><button className="primary-button" disabled={busyId === row._id || walletBalance < Number(row.totalCost)} onClick={() => settle(row, "now", "wallet")}>Pay with wallet · {money(row.totalCost)}{walletBalance < Number(row.totalCost) ? " · insufficient balance" : ""}</button><button className="outline-button" disabled={busyId === row._id} onClick={() => settle(row, "deferred")}>Add to next installment</button></div><div className="inline-controls"><label className="field"><span>Sandbox gateway result</span><select value={gateway[row._id] || "succeeded"} onChange={(e) => setGateway({ ...gateway, [row._id]: e.target.value })}><option value="succeeded">Successful</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select></label><button className="outline-button" disabled={busyId === row._id} onClick={() => settle(row, "now", "gateway")}>{row.history?.some((item) => item.action === "paymentAttempt") ? "Retry gateway payment" : "Pay through sandbox gateway"}</button></div><p className="helper-text">Sandbox only. No card details are collected or stored.</p></div>}
      {student && row.settlementStatus === "paid" && <div className="feedback success">Paid receipt · {pretty(row.settlementOption)} · {money(row.totalCost)}. Download the receipt from financial history below.</div>}
      {student && row.settlementStatus === "deferred" && <div className="feedback info">Deferred-payment confirmation · {money(row.totalCost)} due with your next university installment. Download its confirmation below.</div>}
      <details><summary>Request history</summary><ol>{(row.history || []).map((entry) => <li key={entry._id}>{date(entry.occurredAt)} · {pretty(entry.action)}{entry.note ? ` · ${entry.note}` : ""}{entry.settlementStatus ? ` · ${pretty(entry.settlementStatus)}` : ""}</li>)}</ol></details>
      {!student && role === "advisor" && row.decisionStatus === "pending" && <div className="form-actions"><button className="text-button danger-text" disabled={busyId === row._id} onClick={() => withdraw(row)}>Withdraw request</button></div>}
    </section>)}
    {student && <section className="panel"><div className="results-heading"><div><p className="eyebrow">FINANCIAL HISTORY</p><h2>Payments and deferred charges</h2></div></div>{history.length ? <div className="table-scroll"><table><thead><tr><th>Request</th><th>Record</th><th>Option</th><th>Amount</th><th>Status</th><th>Reference / installment</th><th>Date</th><th>Confirmation</th></tr></thead><tbody>{history.map((item) => <tr key={item._id}><td>{String(item.extraHoursRequest?._id || "").slice(-8)}</td><td>{pretty(item.kind)}</td><td>{pretty(item.settlementOption)}</td><td>{money(item.amount)}</td><td>{pretty(item.status)}</td><td>{item.transactionReference || item.deferredChargeReference || item.installment || "—"}</td><td>{date(item.occurredAt)}</td><td>{item.kind === "deferredCharge" || item.status === "succeeded" ? <button className="text-button" type="button" onClick={() => downloadConfirmation(item)}>Download PDF</button> : "—"}</td></tr>)}</tbody></table></div> : <p className="helper-text">No payment or deferred-charge history yet.</p>}</section>}
  </div>;
}
