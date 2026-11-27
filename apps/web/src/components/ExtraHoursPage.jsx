import { termLabel } from "../term-label.js";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { WorkspaceHeader } from "./WorkspaceUI.jsx";
import { StudentIdentity, RecordPages } from "./CoordinatorRecords.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";
import ExtraHoursRequestForm from "./ExtraHoursRequestForm.jsx";

const emptyFilters = { studentId: "", advisorId: "", decisionStatus: "", settlementOption: "", settlementStatus: "" };
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
  const coordinator = role === "coordinator";
  const student = role === "advisingStudent";
  const [composing, setComposing] = useState(false);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [opened, setOpened] = useState(null);
  const [page, setPage] = useState(1);
  const [advisors, setAdvisors] = useState([]);
  const [history, setHistory] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const pendingCheckouts = new Set(history.filter((item) =>
    item.kind === "gatewayPayment" && item.status === "pending" && item.metadata?.stripeCheckout
  ).map((item) => String(item.extraHoursRequest?._id)));
  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      if (student) {
        const [requests, records, wallet] = await Promise.all([
          api("/api/extra-hours/mine", { token, signal }),
          api("/api/extra-hours/mine/financial-history", { token, signal }),
          api("/api/extra-hours/mine/wallet", { token, signal }),
        ]);
        setRows(requests);
        setHistory(records);
        setWalletBalance(Number(wallet.balance || 0));
      } else if (role === "advisor") {
        setRows(await api("/api/extra-hours/advisor/mine", { token, signal }));
      } else {
        const params = new URLSearchParams(
          Object.entries(filters).filter(([, value]) => value),
        );
        const [requests, advisorRows] = await Promise.all([
          api(`/api/extra-hours?${params}`, { token, signal }),
          api("/api/extra-hours/requesting-advisors", { token, signal }),
        ]);
        setRows(requests);
        setAdvisors(advisorRows);
      }
    } catch (e) {
      if (!signal?.aborted) setError(e.message || "Unable to load extra-hours requests.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [token, student, role, filters]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    setPage(1);
    return () => controller.abort();
  }, [load]);

  const checkCheckout = useCallback(async (id, cancel, attemptId) => {
    setBusyId(id);
    try {
      const { status } = await api(`/api/extra-hours/${id}/checkout/check`, {
        token, method: "POST", body: { cancel, attemptId },
      });
      if (status === "succeeded") notify("success", "Payment complete. Your receipt is in Payments and deferred charges.");
      if (status === "failed") notify("error", "The card payment failed. You can try again.");
      if (status === "cancelled") notify("warning", "Checkout cancelled. You can choose a payment option again.");
      if (status === "pending") notify("info", "Stripe checkout is still open.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }, [load, notify, token]);

  useEffect(() => {
    if (!student) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("stripeRequest");
    const attemptId = url.searchParams.get("stripeAttempt");
    const result = url.searchParams.get("stripeReturn");
    if (!/^[a-f\d]{24}$/i.test(id || "") || !["success", "cancel"].includes(result)) return;
    url.searchParams.delete("stripeRequest");
    url.searchParams.delete("stripeAttempt");
    url.searchParams.delete("stripeReturn");
    window.history.replaceState(window.history.state, "", url);
    void checkCheckout(id, result === "cancel", attemptId);
  }, [checkCheckout, student]);

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
      if (method === "gateway") {
        const result = await api(`/api/extra-hours/${row._id}/checkout`, { token, method: "POST", body: {} });
        if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
        else if (result.status === "succeeded") await load();
        return;
      }
      const result = await api(`/api/extra-hours/${row._id}/settlement`, {
        token,
        method: "POST",
        body: { option, method },
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
      {role !== "coordinator" && <button
        className="outline-button"
        type="button"
        disabled={loading}
        onClick={() => load()}
      >
        {loading ? "Refreshing…" : "Refresh"}
      </button>}
    </>
  );

  const walletSummary = student && (
    <dl className="extra-wallet-summary">
      <dt>Available wallet balance</dt>
      <dd>{money(walletBalance)}</dd>
    </dl>
  );

  const filtered = Object.values(filters).some(Boolean);
  const visibleRows = [...rows].sort((a, b) => Number(b.decisionStatus === "pending") - Number(a.decisionStatus === "pending"));
  const size = 8;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / size)));
  return (
    <div className="page-stack workspace-page extra-hours-page">
      {embedded ? (
        <div className="extra-hours-toolbar" hidden={role === "coordinator"}>
          <div className="extra-hours-account">
            {walletSummary}
          </div>
          <div className="extra-hours-toolbar-actions">{toolbar}</div>
        </div>
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
      {!embedded && walletSummary}
      {role === "coordinator" && (
        <section className="extra-filters" aria-label="Filter requests">
          <FilterDisclosure floating search={<label className="field filter-search">
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
            </label>} actions={<>
            <button type="button" className="text-button" disabled={!filtered} onClick={() => setFilters(emptyFilters)}>Clear</button>
            <button type="button" className="text-button" disabled={loading} onClick={() => load()}>Refresh</button></>}
            chips={Object.entries(filters).filter(([key,value]) => key !== "studentId" && value).map(([key,value]) => ({
              key, label: pretty(key === "advisorId" ? advisors.find(a => a._id === value)?.fullName || "Advisor" : value),
              onRemove: () => setFilters({ ...filters, [key]: "" }),
            }))}>
          <div className="filter-grid">
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
          </FilterDisclosure>
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
        <section className="extra-hours-empty" aria-labelledby="extra-empty-title">
          <img className="extra-empty-art" src="/portal-studio/images/extra-hours-inbox.svg" width="100" height="74" alt="" />
          <h3 id="extra-empty-title">{filtered ? "No matching requests" : "No extra-hours requests"}</h3>
          <p>{filtered ? "Try another student ID or clear your filters." : student ? "Requests from your advisor will appear here." : "Requests will appear here when they’re ready for your review."}</p>
        </section>
      ) : (
        (coordinator ? visibleRows.slice((currentPage - 1) * size, currentPage * size) : rows).map((row) => (
          <article className="extra-request" key={row._id}>
            <header className="extra-request-row">
              {coordinator ? <>
                <StudentIdentity name={row.student?.user?.fullName} id={row.student?.studentId} />
                <div className="extra-request-subject"><strong>{row.requestedHours} extra credit {row.requestedHours === 1 ? "hour" : "hours"}</strong>
                  <small>{row.courses?.map(item => item.course?.name || item.course?.code).filter(Boolean).join(", ")}</small></div>
              </> : <div><h2>{row.student?.user?.fullName || "Your request"} {row.student?.studentId ? `· ${row.student.studentId}` : ""}</h2>
                <p className="helper-text">{termLabel(row.term)} · Request {row._id.slice(-8)}</p>
                <dl className="extra-request-meta"><div><dt>Advisor</dt><dd>{row.advisor?.fullName || "—"}</dd></div>
                  <div><dt>Submitted</dt><dd>{date(row.createdAt)}</dd></div></dl>
              </div>}
              <div className="extra-request-summary">
                <span
                  className={`status-pill ${row.decisionStatus === "approved" ? "good" : row.decisionStatus === "rejected" ? "danger" : row.decisionStatus === "pending" ? "warning" : "muted"}`}
                >
                  {pretty(row.decisionStatus)}
                  {row.settlementStatus && row.settlementStatus !== "none"
                    ? ` · ${pretty(row.settlementStatus)}`
                    : ""}
                </span>
                <dl className="extra-request-price">
                  <dt>Request total</dt>
                  <dd>{money(row.totalCost)}</dd>
                </dl>
              </div>
              {coordinator && <button type="button" className="outline-button" aria-expanded={opened === row._id} aria-controls={"extra-detail-" + row._id}
                onClick={() => setOpened(opened === row._id ? null : row._id)}>{opened === row._id ? "Close details" : row.decisionStatus === "pending" && role === "coordinator" ? "Review request" : "View request"}</button>}
            </header>
            {(!coordinator || opened === row._id) && <div className="extra-record-desk" id={"extra-detail-" + row._id}>
              <div className="extra-record-content">
                {coordinator && <dl className="request-provenance">
                  <div><dt>Request</dt><dd>{row._id}</dd></div>
                  <div><dt>Term</dt><dd>{termLabel(row.term)}</dd></div>
                  <div><dt>Advisor</dt><dd>{row.advisor?.fullName || "—"}</dd></div>
                  <div><dt>Submitted</dt><dd>{date(row.createdAt)}</dd></div>
                </dl>}
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
                    <section className="form-stack extra-payment" aria-label="Payment options">
                      <div>
                        <h3>Payment options</h3>
                        <p className="helper-text">Pay now or add the charge to your next installment to activate these courses.</p>
                      </div>
                      <div className="inline-controls">
                        <button
                          className="primary-button"
                          disabled={
                            busyId === row._id ||
                            pendingCheckouts.has(row._id) ||
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
                          disabled={busyId === row._id || pendingCheckouts.has(row._id)}
                          onClick={() => settle(row, "deferred")}
                        >
                          Add to next installment
                        </button>
                      </div>
                      <div className="inline-controls extra-gateway">
                        <button
                          className="outline-button"
                          disabled={busyId === row._id}
                          onClick={() => settle(row, "now", "gateway")}
                        >
                          {pendingCheckouts.has(row._id) ? "Resume card payment" : row.history?.some(
                            (item) => item.action === "paymentAttempt",
                          )
                            ? "Retry card payment"
                            : "Pay by card"}
                        </button>
                        {pendingCheckouts.has(row._id) && (
                          <button className="outline-button" disabled={busyId === row._id}
                            onClick={() => checkCheckout(row._id, true)}>
                            Cancel checkout
                          </button>
                        )}
                      </div>
                    </section>
                  )}
                {student && row.settlementStatus === "paid" && (
                  <div className="feedback success">
                    Paid receipt · {pretty(row.settlementOption)} ·{" "}
                    {money(row.totalCost)}. Download the receipt from financial history below.
                  </div>
                )}
                {student && row.settlementStatus === "deferred" && (
                  <div className="feedback info">
                    Deferred-payment confirmation · {money(row.totalCost)} due with
                    your next university installment. Download its confirmation below.
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
                  <h3>Requested courses</h3>
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
                  <dl className="extra-course-facts">
                    <div>
                      <dt>Hours after request</dt>
                      <dd>{row.eligibilitySnapshot?.hoursAfterRequest ?? "—"} hours <small>({row.eligibilitySnapshot?.hoursBeforeRequest ?? "—"} current + {row.requestedHours} extra)</small></dd>
                    </div>
                    <div>
                      <dt>Standard allowance</dt>
                      <dd>{row.eligibilitySnapshot?.standardAllowance ?? "—"} hours</dd>
                    </div>
                    <div>
                      <dt>Graduating within one year</dt>
                      <dd>{row.eligibilitySnapshot?.graduatingWithinOneYear ? "Yes" : "No"}</dd>
                    </div>
                  </dl>
                  {row.eligibilitySnapshot?.isProbation && (
                    <p className="feedback error">Ineligible due to academic probation</p>
                  )}
                </section>
              </div>
              <details className="extra-request-history" open>
                <summary>Request history</summary>
                <div className="extra-record-ticket" key={row.history?.at(-1)?._id}>
                  <div className="extra-record-number">Request {row._id.slice(-8)}</div>
                  {row.history?.length ? (
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
                  ) : (
                    <p>No history recorded yet.</p>
                  )}
                  <svg className="extra-record-punch" viewBox="0 0 116 65" aria-hidden="true"
                    stroke="#302e28" strokeWidth="2.3" strokeLinejoin="round">
                    <path fill="#707d71" d="m9 50 83-5 11 8-2 7-88 2-6-6z" />
                    <path fill="#bbc4ad" d="m12 49 79-5 10 8-88 4z" />
                    <path fill="#657970" d="m73 47 3-16q5-7 12 0l4 14z" />
                    <g className="extra-punch-lever">
                      <path fill="#b97859" d="m10 12 74 17 7 8-7 5-75-19q-6-6 1-11z" />
                      <path stroke="#e3ab83" d="m14 16 63 15" />
                      <path fill="#c7bc9f" d="m29 28 8 2-1 10-6-1z" />
                    </g>
                    <circle cx="82" cy="36" r="3.5" fill="#dccdaa" />
                  </svg>
                </div>
              </details>
            </div>}
          </article>
        ))
      )}
      {coordinator && <RecordPages page={currentPage} size={size} total={rows.length} onChange={setPage} label="Requests" />}
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
                        {item.installmentId && <div className="secondary-text">Installment INST-{item.installmentId}</div>}
                      </td>
                      <td>{date(item.occurredAt)}</td>
                      <td>
                        {((item.kind === "deferredCharge" &&
                          ["pending", "PENDING"].includes(item.status)) ||
                        (["extraHoursWalletPayment", "gatewayPayment"].includes(
                          item.kind,
                        ) &&
                          item.status === "succeeded")) ? (
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
