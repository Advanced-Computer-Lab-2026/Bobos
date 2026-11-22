import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { WorkspaceHeader, WorkspaceEmpty } from "./WorkspaceUI.jsx";
import ExtraHoursRequestForm from "./ExtraHoursRequestForm.jsx";

const pretty = (value = "—") =>
  String(value || "—")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
const money = (amount) =>
  `${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
const date = (value) => (value ? new Date(value).toLocaleString() : "—");

export default function ExtraHoursPage({
  token,
  role,
  advisorId,
  notify,
  embedded = false,
}) {
  const student = role === "advisingStudent";
  const [composing, setComposing] = useState(false);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    studentId: "",
    advisorId: "",
    decisionStatus: "",
    settlementOption: "",
    settlementStatus: "",
  });
  const [advisors, setAdvisors] = useState([]);
  const [history, setHistory] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const [gateway, setGateway] = useState({});
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (student) {
        const [requests, records, wallet] = await Promise.all([
          api("/api/extra-hours/mine", { token }),
          api("/api/extra-hours/mine/financial-history", { token }),
          api("/api/extra-hours/mine/wallet", { token }),
        ]);
        setRows(requests);
        setHistory(records);
        setWalletBalance(Number(wallet.balance || 0));
      } else if (role === "advisor") {
        setRows(await api("/api/extra-hours/advisor/mine", { token }));
      } else {
        const params = new URLSearchParams(
          Object.entries(filters).filter(([, value]) => value),
        );
        const [requests, advisorRows] = await Promise.all([
          api(`/api/extra-hours?${params}`, { token }),
          api("/api/advisor/advisors", { token }),
        ]);
        setRows(requests);
        setAdvisors(advisorRows.advisors || advisorRows || []);
      }
    } catch (e) {
      setError(e.message || "Unable to load extra-hours requests.");
    } finally {
      setLoading(false);
    }
  }, [token, student, role, filters]);
  useEffect(() => {
    load();
  }, [load]);

  const decision = async (row, value) => {
    setBusyId(row._id);
    setError("");
    try {
      await api(`/api/extra-hours/${row._id}/decision`, {
        token,
        method: "POST",
        body: { decision: value, responseNote: notes[row._id] || "" },
      });
      notify(
        "success",
        value === "approved"
          ? "Extra hours approved."
          : "Decision saved. The extra hours request was rejected.",
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  };
  const withdraw = async (row) => {
    setBusyId(row._id);
    setError("");
    try {
      await api(`/api/extra-hours/${row._id}/withdraw`, {
        token,
        method: "POST",
        body: {},
      });
      notify("success", "Extra hours request withdrawn.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  };
  const settle = async (row, option, method) => {
    setBusyId(row._id);
    setError("");
    try {
      const result = await api(`/api/extra-hours/${row._id}/settlement`, {
        token,
        method: "POST",
        body:
          option === "now"
            ? {
                option,
                method,
                ...(method === "gateway"
                  ? { gatewayResult: gateway[row._id] || "succeeded" }
                  : {}),
              }
            : { option },
      });
      if (result.confirmation?.type === "paidReceipt")
        notify(
          "success",
          `Payment complete. Receipt reference ${result.confirmation.transactionReference}.`,
        );
      if (result.confirmation?.type === "deferredPaymentConfirmation")
        notify(
          "success",
          `Deferred charge confirmed for ${result.confirmation.installment}.`,
        );
      if (result.transaction?.status === "failed")
        notify("error", "The payment failed. You can retry from this request.");
      if (result.transaction?.status === "cancelled")
        notify(
          "warning",
          "Payment was cancelled. You can choose a payment option again.",
        );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  };
  const downloadConfirmation = async (record) => {
    try {
      const { data: blob, response } = await api(
        `/api/extra-hours/mine/financial-history/${record._id}/download`,
        { token, responseType: "blob" },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="?([^";]+)"?/)?.[1] ||
        `extra-hours-confirmation-${record._id}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message || "Unable to download confirmation.");
    }
  };
  const toolbar = (
    <>
      {role === "advisor" && (
        <button
          type="button"
          className="primary-button"
          aria-expanded={composing}
          onClick={() => setComposing(true)}
        >
          New request
        </button>
      )}
      <button
        className="outline-button"
        type="button"
        disabled={loading}
        onClick={load}
      >
        {loading ? "Refreshing…" : "Refresh"}
      </button>
    </>
  );

  return (
    <div className="page-stack workspace-page extra-hours-page">
      {embedded ? (
        <div className="extra-hours-toolbar">{toolbar}</div>
      ) : (
        <WorkspaceHeader
          title="Extra-hours requests"
          description={
            student
              ? "Review approved costs, choose a payment option and track your request history."
              : role === "advisor"
                ? "Track the extra-hours requests you have submitted for your students."
                : "Review eligibility and costs before deciding an extra-hours request."
          }
          action={toolbar}
        />
      )}
      {composing && (
        <ExtraHoursRequestForm
          token={token}
          advisorId={advisorId}
          onClose={() => setComposing(false)}
          onSubmitted={() => {
            setComposing(false);
            notify("success", "Request submitted for coordinator review.");
            load();
          }}
        />
      )}
      {student && (
        <dl className="extra-wallet-summary">
          <dt>Available wallet balance</dt>
          <dd>{money(walletBalance)}</dd>
        </dl>
      )}
      {role === "coordinator" && (
        <section className="extra-filters" aria-label="Filter requests">
          <div className="filter-grid">
            <label className="field">
              <span>Student ID</span>
              <input
                name="extra-hours-student"
                autoComplete="off"
                value={filters.studentId}
                onChange={(e) =>
                  setFilters({ ...filters, studentId: e.target.value })
                }
                placeholder="e.g. 64-12345…"
              />
            </label>
            <label className="field">
              <span>Requesting advisor</span>
              <select
                value={filters.advisorId}
                onChange={(e) =>
                  setFilters({ ...filters, advisorId: e.target.value })
                }
              >
                <option value="">All advisors</option>
                {advisors.map((a) => (
                  <option value={a._id} key={a._id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Decision</span>
              <select
                value={filters.decisionStatus}
                onChange={(e) =>
                  setFilters({ ...filters, decisionStatus: e.target.value })
                }
              >
                <option value="">All decisions</option>
                {["pending", "approved", "rejected", "withdrawn"].map((x) => (
                  <option key={x} value={x}>
                    {pretty(x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Settlement option</span>
              <select
                value={filters.settlementOption}
                onChange={(e) =>
                  setFilters({ ...filters, settlementOption: e.target.value })
                }
              >
                <option value="">All options</option>
                {["wallet", "gateway", "deferred"].map((x) => (
                  <option key={x} value={x}>
                    {pretty(x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Settlement status</span>
              <select
                value={filters.settlementStatus}
                onChange={(e) =>
                  setFilters({ ...filters, settlementStatus: e.target.value })
                }
              >
                <option value="">All statuses</option>
                {[
                  "none",
                  "awaitingChoice",
                  "paid",
                  "deferred",
                  "failed",
                  "cancelled",
                  "refunded",
                ].map((x) => (
                  <option key={x} value={x}>
                    {pretty(x)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filter-actions">
            <p className="filter-hint">Results update as you filter.</p>
            <button
              type="button"
              className="text-button"
              disabled={!Object.values(filters).some(Boolean)}
              onClick={() =>
                setFilters({
                  studentId: "",
                  advisorId: "",
                  decisionStatus: "",
                  settlementOption: "",
                  settlementStatus: "",
                })
              }
            >
              Clear filters
            </button>
          </div>
        </section>
      )}
      {error && (
        <div className="feedback error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <section className="panel loading-state" role="status">
          <span className="loader" />
          Loading requests…
        </section>
      ) : rows.length === 0 ? (
        <section className="panel">
          <WorkspaceEmpty
            title="No extra-hours requests"
            description={
              student
                ? "Your advisor’s requests will appear here. Once approved, you can choose how to settle the cost."
                : "Submitted requests will appear here with their eligibility details and cost breakdown. Clear any active filters to see all requests."
            }
          />
        </section>
      ) : (
        rows.map((row) => (
          <article className="extra-request" key={row._id}>
            <header className="extra-request-row">
              <div>
                <h2>
                  {row.student?.user?.fullName || "Your request"}{" "}
                  {row.student?.studentId ? `· ${row.student.studentId}` : ""}
                </h2>
                <p className="helper-text">
                  Request {row._id.slice(-8)} · {row.term?.code} · Submitted{" "}
                  {date(row.createdAt)} · Advisor {row.advisor?.fullName || "—"}
                </p>
              </div>
              <span
                className={`status-pill ${row.decisionStatus === "approved" ? "good" : row.decisionStatus === "rejected" ? "danger" : row.decisionStatus === "pending" ? "warning" : "muted"}`}
              >
                {pretty(row.decisionStatus)}
                {row.settlementStatus && row.settlementStatus !== "none"
                  ? ` · ${pretty(row.settlementStatus)}`
                  : ""}
              </span>
              <strong className="extra-request-total">
                {money(row.totalCost)}
              </strong>
            </header>
            {row.decisionNote && (
              <p className="feedback info">
                Coordinator response: {row.decisionNote}
              </p>
            )}
            {role === "coordinator" && row.decisionStatus === "pending" && (
              <div className="form-stack">
                <label className="field">
                  <span>Response note (required)</span>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={notes[row._id] || ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [row._id]: e.target.value })
                    }
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="outline-button"
                    disabled={busyId === row._id || !notes[row._id]?.trim()}
                    onClick={() => decision(row, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    className="primary-button"
                    disabled={busyId === row._id || !notes[row._id]?.trim()}
                    onClick={() => decision(row, "approved")}
                  >
                    Approve · makes available to settle
                  </button>
                </div>
              </div>
            )}
            {student &&
              row.decisionStatus === "approved" &&
              row.settlementStatus === "awaitingChoice" && (
                <div className="form-stack">
                  <p className="helper-text">
                    Approval does not add these courses to your usable schedule
                    until payment succeeds or you confirm deferral.
                  </p>
                  <div className="inline-controls">
                    <button
                      className="primary-button"
                      disabled={
                        busyId === row._id ||
                        walletBalance < Number(row.totalCost)
                      }
                      onClick={() => settle(row, "now", "wallet")}
                    >
                      Pay with wallet · {money(row.totalCost)}
                      {walletBalance < Number(row.totalCost)
                        ? " · insufficient balance"
                        : ""}
                    </button>
                    <button
                      className="outline-button"
                      disabled={busyId === row._id}
                      onClick={() => settle(row, "deferred")}
                    >
                      Add to next installment
                    </button>
                  </div>
                  <div className="inline-controls">
                    <label className="field">
                      <span>Sandbox gateway result</span>
                      <select
                        value={gateway[row._id] || "succeeded"}
                        onChange={(e) =>
                          setGateway({ ...gateway, [row._id]: e.target.value })
                        }
                      >
                        <option value="succeeded">Successful</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <button
                      className="outline-button"
                      disabled={busyId === row._id}
                      onClick={() => settle(row, "now", "gateway")}
                    >
                      {row.history?.some(
                        (item) => item.action === "paymentAttempt",
                      )
                        ? "Retry gateway payment"
                        : "Pay through sandbox gateway"}
                    </button>
                  </div>
                  <p className="helper-text">
                    Sandbox only. No card details are collected or stored.
                  </p>
                </div>
              )}
            {student && row.settlementStatus === "paid" && (
              <div className="feedback success">
                Paid receipt · {pretty(row.settlementOption)} ·{" "}
                {money(row.totalCost)}. Download the receipt from financial
                history below.
              </div>
            )}
            {student && row.settlementStatus === "deferred" && (
              <div className="feedback info">
                Deferred-payment confirmation · {money(row.totalCost)} due with
                your next university installment. Download its confirmation
                below.
              </div>
            )}
            {!student &&
              role === "advisor" &&
              row.decisionStatus === "pending" && (
                <div className="form-actions">
                  <button
                    className="text-button danger-text"
                    disabled={busyId === row._id}
                    onClick={() => withdraw(row)}
                  >
                    Withdraw request
                  </button>
                </div>
              )}
            <section className="extra-request-details">
              <h3>Courses and eligibility</h3>
              <p className="extra-eligibility-summary">
                {row.eligibilitySnapshot?.isProbation ? (
                  "Ineligible due to academic probation"
                ) : (
                  <>
                    <strong>
                      {row.eligibilitySnapshot?.hoursAfterRequest} hours
                    </strong>{" "}
                    after this request{" "}
                    <span>
                      ({row.eligibilitySnapshot?.hoursBeforeRequest} current +{" "}
                      {row.requestedHours} extra)
                    </span>
                  </>
                )}
              </p>
              <dl className="extra-course-facts">
                <div>
                  <dt>Standard allowance</dt>
                  <dd>{row.eligibilitySnapshot?.standardAllowance} hours</dd>
                </div>
                <div>
                  <dt>Graduating within one year</dt>
                  <dd>
                    {row.eligibilitySnapshot?.graduatingWithinOneYear
                      ? "Yes"
                      : "No"}
                  </dd>
                </div>
              </dl>
              <ul className="extra-course-list" aria-label="Requested courses">
                {row.courses?.map((item) => (
                  <li key={item.course?._id || item.course}>
                    <div>
                      <strong>
                        {item.course?.name || item.course?.code || "Course"}
                      </strong>
                      <p>
                        {item.course?.name && item.course?.code && (
                          <>{item.course.code} · </>
                        )}
                        {item.hours} {item.hours === 1 ? "hour" : "hours"} at{" "}
                        {money(item.pricePerHour)} per hour
                        {item.isRepeated && " · Repeated course"}
                      </p>
                    </div>
                    <strong>{money(item.subtotal)}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <details className="extra-request-history" open>
              <summary>Request history</summary>
              <ol>
                {(row.history || []).map((entry) => (
                  <li key={entry._id}>
                    <div className="extra-history-event">
                      <strong>{pretty(entry.action)}</strong>
                      {entry.settlementStatus &&
                        entry.settlementStatus !== "none" && (
                          <span>{pretty(entry.settlementStatus)}</span>
                        )}
                      <time dateTime={entry.occurredAt}>
                        {date(entry.occurredAt)}
                      </time>
                    </div>
                    {entry.note && <p>{entry.note}</p>}
                  </li>
                ))}
              </ol>
            </details>
          </article>
        ))
      )}
      {student && (
        <section className="extra-financial">
          <h2>Payments and deferred charges</h2>
          {history.length ? (
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label="Payments and deferred charges"
            >
              <table>
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Record</th>
                    <th>Option</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference / installment</th>
                    <th>Date</th>
                    <th>Confirmation</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item._id}>
                      <td>
                        {String(item.extraHoursRequest?._id || "").slice(-8)}
                      </td>
                      <td>{pretty(item.kind)}</td>
                      <td>{pretty(item.settlementOption)}</td>
                      <td>{money(item.amount)}</td>
                      <td>{pretty(item.status)}</td>
                      <td>
                        {item.transactionReference ||
                          item.deferredChargeReference ||
                          item.installment ||
                          "—"}
                      </td>
                      <td>{date(item.occurredAt)}</td>
                      <td>
                        {(item.kind === "deferredCharge" &&
                          item.status === "pending") ||
                        (["extraHoursWalletPayment", "gatewayPayment"].includes(
                          item.kind,
                        ) &&
                          item.status === "succeeded") ? (
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => downloadConfirmation(item)}
                          >
                            Download PDF
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="helper-text">
              No payment or deferred-charge history yet.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
