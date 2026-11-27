import { termLabel } from "../term-label.js";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { WorkspaceHeader } from "./WorkspaceUI.jsx";
import { RegisterRow, StudentIdentity, StudentRegister, RecordPages } from "./CoordinatorRecords.jsx";
import FilterDisclosure from "./FilterDisclosure.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import ExtraHoursRequestForm from "./ExtraHoursRequestForm.jsx";
import { Modal } from "./AcademicWorkspace.jsx";

const emptyFilters = { studentId: "", advisorId: "", decisionStatus: "", settlementOption: "", settlementStatus: "" };
const pretty = (value = "—") =>
  String(value || "—")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
const moneyAmount = (amount) => Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (amount) => `${moneyAmount(amount)} EGP`;
const date = (value) => (value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }) : "—");
const paymentStates = {
  awaitingChoice: { label: "Awaiting payment choice", tone: "warning" },
  paid: { label: "Payment received", tone: "good" },
  deferred: { label: "Added to next installment", tone: "warning" },
  failed: { label: "Payment failed", tone: "danger" },
  cancelled: { label: "Payment cancelled", tone: "muted" },
  refunded: { label: "Refunded", tone: "muted" },
};

export default function ExtraHoursPage({
  token,
  role,
  advisorId,
  notify,
  embedded = false,
}) {
  const coordinator = role === "coordinator";
  const advisor = role === "advisor";
  const staff = coordinator || advisor;
  const student = role === "advisingStudent";
  const [composing, setComposing] = useState(false);
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [opened, setOpened] = useState(null);
  const reviewTrigger = useRef(null);
  const reviewStatus = useRef(null);
  const filterSearch = useRef(null);
  const [page, setPage] = useState(1);
  const [advisors, setAdvisors] = useState([]);
  const [history, setHistory] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notes, setNotes] = useState({});
  const pendingCheckouts = new Set(history.filter((item) =>
    item.kind === "gatewayPayment" && item.status === "pending" && item.metadata?.stripeCheckout
  ).map((item) => String(item.extraHoursRequest?._id)));
  const query = coordinator ? new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString() : "";
  const load = useCallback(async ({ signal, background = false } = {}) => {
    if (!background) setLoading(true);
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
      } else if (advisor) {
        setRows(await api("/api/extra-hours/advisor/mine", { token, signal }));
      } else {
        const [requests, advisorRows] = await Promise.all([
          api(`/api/extra-hours?${query}`, { token, signal }),
          api("/api/extra-hours/requesting-advisors", { token, signal }),
        ]);
        setRows(requests);
        setAdvisors(advisorRows);
      }
    } catch (e) {
      if (!signal?.aborted) setError(e.message || "Unable to load extra-hours requests.");
    } finally {
      if (!background && !signal?.aborted) setLoading(false);
    }
  }, [token, student, advisor, query]);
  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
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
      if (status === "refunded") notify("warning", "Your card payment was credited to your wallet.");
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

  async function refreshReview(row, updated) {
    const reviewed = { ...updated, student: row.student };
    setOpened(reviewed);
    setRows(current => current.map(request => request._id === row._id ? reviewed : request));
    requestAnimationFrame(() => reviewStatus.current?.focus());
    await load({ background: true });
  }

  const decision = async (row, value) => {
    setBusyId(row._id);
    setReviewError("");
    try {
      const updated = await api(`/api/extra-hours/${row._id}/decision`, {
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
      await refreshReview(row, updated);
    } catch (e) {
      setReviewError(e.message);
    } finally {
      setBusyId("");
    }
  };
  const withdraw = async (row) => {
    setBusyId(row._id);
    setReviewError("");
    try {
      const updated = await api(`/api/extra-hours/${row._id}/withdraw`, {
        token,
        method: "POST",
        body: {},
      });
      notify("success", "Extra hours request withdrawn.");
      await refreshReview(row, updated);
    } catch (e) {
      setReviewError(e.message);
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
        else if (result.status === "refunded") {
          notify("warning", "Your card payment was credited to your wallet.");
          await load();
        } else if (result.status === "succeeded") await load();
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
  function openReview(row, trigger) {
    reviewTrigger.current = trigger;
    setReviewError("");
    setOpened(row);
  }

  function closeReview() {
    if (busyId === opened._id) return;
    const trigger = reviewTrigger.current;
    setOpened(null);
    requestAnimationFrame(() => {
      (trigger?.isConnected ? trigger : filterSearch.current)?.focus();
    });
  }

  function updateFilters(next) {
    setFilters(next);
    setPage(1);
  }

  const walletSummary = student && (
    <dl className="extra-wallet-summary">
      <dt>Available wallet balance</dt>
      <dd>{money(walletBalance)}</dd>
    </dl>
  );

  const Queue = staff ? StudentRegister : Fragment;
  const filtered = Object.values(filters).some(Boolean);
  const matchingRows = advisor ? rows.filter(row =>
    String(row.student?.studentId || "").includes(filters.studentId.trim()) &&
    ["decisionStatus", "settlementOption", "settlementStatus"].every(key => !filters[key] || row[key] === filters[key])
  ) : rows;
  const visibleRows = [...matchingRows].sort((a, b) => Number(b.decisionStatus === "pending") - Number(a.decisionStatus === "pending"));
  const size = 8;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleRows.length / size)));
  return (
    <div className="page-stack workspace-page extra-hours-page">
      {!embedded && (
        <WorkspaceHeader
          title="Extra-hours requests"
          description={
            student
              ? "Review approved costs, choose a payment option and track your request history."
              : role === "advisor"
                ? "Track the extra-hours requests you have submitted for your students."
                : "Review eligibility and costs before deciding an extra-hours request."
          }
        />
      )}
      {walletSummary}
      {staff && (
        <section className="extra-filters" aria-label="Filter requests">
          <FilterDisclosure floating search={<label className="field filter-search">
              <span>Student ID</span>
              <input
                ref={filterSearch}
                name="extra-hours-student"
                autoComplete="off"
                value={filters.studentId}
                onChange={(e) =>
                  updateFilters({ ...filters, studentId: e.target.value })
                }
                placeholder="e.g. 64-12345…"
              />
            </label>} actions={<>
            <button type="button" className="outline-button extra-clear-button" disabled={!filtered} onClick={() => updateFilters(emptyFilters)}>Clear</button>
            {advisor && <button type="button" className="primary-button" aria-haspopup="dialog"
              onClick={() => setComposing(true)}>New request</button>}</>}
            chips={Object.entries(filters).filter(([key,value]) => key !== "studentId" && value).map(([key,value]) => ({
              key, label: pretty(key === "advisorId" ? advisors.find(a => a._id === value)?.fullName || "Advisor" : value),
              onRemove: () => updateFilters({ ...filters, [key]: "" }),
            }))}>
          <div className="filter-grid">
            {coordinator && <label className="field">
              <span>Requesting advisor</span>
              <select
                value={filters.advisorId}
                onChange={(e) =>
                  updateFilters({ ...filters, advisorId: e.target.value })
                }
              >
                <option value="">All advisors</option>
                {advisors.map((a) => (
                  <option value={a._id} key={a._id}>
                    {a.fullName}
                  </option>
                ))}
              </select>
            </label>}
            <label className="field">
              <span>Decision</span>
              <select
                value={filters.decisionStatus}
                onChange={(e) =>
                  updateFilters({ ...filters, decisionStatus: e.target.value })
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
                  updateFilters({ ...filters, settlementOption: e.target.value })
                }
              >
                <option value="">All options</option>
                {["wallet", "gateway", "deferred"].map((x) => (
                  <option key={x} value={x}>
                    {x === "deferred" ? "Next installment" : pretty(x)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Settlement status</span>
              <select
                value={filters.settlementStatus}
                onChange={(e) =>
                  updateFilters({ ...filters, settlementStatus: e.target.value })
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
                    {paymentStates[x]?.label || pretty(x)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </FilterDisclosure>
        </section>
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
      ) : visibleRows.length === 0 ? (
        <section className="extra-hours-empty" aria-labelledby="extra-empty-title">
          <img className="extra-empty-art" src="/portal-studio/images/extra-hours-inbox.svg" width="100" height="74" alt="" />
          <h3 id="extra-empty-title">{filtered ? "No matching requests" : "No extra-hours requests"}</h3>
          <p>{filtered ? "Try another student ID or clear your filters." : student ? "Requests from your advisor will appear here." : advisor ? "Use New request to request extra hours for an assigned student." : "Requests will appear here when they’re ready for your review."}</p>
        </section>
      ) : (
        <Queue {...(staff ? { label: "Extra-hours requests", className: "extra-register", columns: ["Student", "Request", "Amount / status", "Action"] } : {})}>
          {(staff ? visibleRows.slice((currentPage - 1) * size, currentPage * size) : rows).map(row => {
            const summary = <RequestSummary row={row} student={student} />;
            if (staff) return <RegisterRow key={row._id} className="extra-student-row">
              <StudentIdentity name={row.student?.user?.fullName} id={row.student?.studentId} />
              <div className="extra-request-subject">
                <strong>{row.requestedHours} extra credit {row.requestedHours === 1 ? "hour" : "hours"}</strong>
                {row.courses?.map(item => <span className="extra-course-preview" key={item.course?._id || item._id}>
                  <OfferingCourseIcon code={item.course?.code} /><small>{item.course?.name || item.course?.code || "Course"}</small>
                </span>)}
              </div>
              {summary}
              <button type="button" className="outline-button" aria-haspopup="dialog" onClick={event => openReview(row, event.currentTarget)}>
                {coordinator && row.decisionStatus === "pending" ? "Review request" : "View request"}
              </button>
            </RegisterRow>;
            return <article className="extra-request" key={row._id}>
              <header className="extra-request-row"><div><h2>{row.student?.user?.fullName || "Your request"} {row.student?.studentId ? `· ${row.student.studentId}` : ""}</h2>
                <p className="helper-text">{termLabel(row.term)} · Request {row._id.slice(-8)}</p>
                <dl className="extra-request-meta"><div><dt>Advisor</dt><dd>{row.advisor?.fullName || "—"}</dd></div>
                  <div><dt>Submitted</dt><dd>{date(row.createdAt)}</dd></div></dl>
              </div>
                {summary}
              </header>
              <RequestDetails row={row}>
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
              </RequestDetails>
            </article>;
          })}
        </Queue>
      )}
      {staff && <RecordPages page={currentPage} size={size} total={visibleRows.length} onChange={setPage} label="Requests" />}
      {opened && <Modal title="Extra-hours request" className="extra-request-dialog" onClose={closeReview} wide>
        <div className="extra-review-body">
          <RequestDetails row={opened} staff summary={<header className="extra-review-overview">
            <StudentIdentity name={opened.student?.user?.fullName} id={opened.student?.studentId} />
            <div className="extra-review-state">
              <RequestDecision row={opened} statusRef={reviewStatus} />
              {paymentStates[opened.settlementStatus] && <span className="extra-payment-state" data-tone={paymentStates[opened.settlementStatus].tone}>{paymentStates[opened.settlementStatus].label}</span>}
            </div>
          </header>}>
            {coordinator && opened.decisionStatus === "pending" && <div className="extra-review-actions">
              {reviewError && <div className="feedback error" role="alert">{reviewError}</div>}
              <label className="field">
                <span>Response note (required)</span>
                <textarea rows={2} maxLength={1000} value={notes[opened._id] || ""}
                  onChange={event => setNotes({ ...notes, [opened._id]: event.target.value })} />
              </label>
              <div className="form-actions">
                <button type="button" className="outline-button"
                  disabled={busyId === opened._id || !notes[opened._id]?.trim()}
                  onClick={() => decision(opened, "rejected")}>Reject</button>
                <button type="button" className="primary-button"
                  disabled={busyId === opened._id || !notes[opened._id]?.trim()}
                  onClick={() => decision(opened, "approved")}>Approve request</button>
              </div>
            </div>}
          </RequestDetails>
        </div>
        {advisor && opened.decisionStatus === "pending" && <footer className="extra-withdraw-footer">
          {reviewError && <div className="feedback error" role="alert">{reviewError}</div>}
          <button type="button" className="outline-button" disabled={busyId === opened._id}
            onClick={() => withdraw(opened)}>{busyId === opened._id ? "Withdrawing…" : "Withdraw request"}</button>
        </footer>}
      </Modal>}
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

function RequestDecision({ row, student = false, statusRef }) {
  const tone = { approved: "good", rejected: "danger", pending: "warning" }[row.decisionStatus] || "muted";
  return <span className={`status-pill ${tone}`} ref={statusRef} tabIndex={statusRef ? -1 : undefined}>
    {pretty(row.decisionStatus)}
    {student && row.settlementStatus && row.settlementStatus !== "none" ? ` · ${pretty(row.settlementStatus)}` : ""}
  </span>;
}

function RequestSummary({ row, student = false }) {
  const payment = !student && paymentStates[row.settlementStatus];
  return <div className="extra-request-summary">
    <RequestDecision row={row} student={student} />
    <dl className="extra-request-price">
      <dt>Request total</dt>
      <dd>{money(row.totalCost)}</dd>
    </dl>
    {payment && <span className="extra-payment-state" data-tone={payment.tone}>{payment.label}</span>}
  </div>;
}

const historyTones = { submitted: "ready", approved: "good", rejected: "danger", withdrawn: "muted" };

function RequestDetails({ row, staff = false, summary, children }) {
  const events = row.history?.length ? row.history : [
    row.createdAt && { action: "submitted", occurredAt: row.createdAt },
    row.decidedAt && { action: row.decisionStatus, occurredAt: row.decidedAt },
  ].filter(Boolean);
  const eligibility = row.eligibilitySnapshot;
  const courses = <section className="extra-sheet-courses">
    <div className={staff ? "extra-review-courses-heading" : undefined}>
      <h3>Requested courses</h3>
      {staff && row.requestedHours != null && <p>{row.requestedHours} credit {row.requestedHours === 1 ? "hour" : "hours"} requested</p>}
    </div>
    <ul role="list">{row.courses?.map(item => <li key={item.course?._id || item._id || item.course}>
      <OfferingCourseIcon code={item.course?.code} />
      <div>
        <strong>{item.course?.name || item.course?.code || "Course"}</strong>
        {staff ? <>
          {(item.course?.code || item.isRepeated) && <small>{[item.course?.code, item.isRepeated && "Repeated course"].filter(Boolean).join(" · ")}</small>}
          <small>{item.hours} {item.hours === 1 ? "hour" : "hours"} × {money(item.pricePerHour)}</small>
        </> : <small>{[item.course?.code, `${item.hours} ${item.hours === 1 ? "hour" : "hours"} × ${money(item.pricePerHour)}`, item.isRepeated && "Repeated course"].filter(Boolean).join(" · ")}</small>}
      </div>
      {staff ? <span className="extra-line-price">{moneyAmount(item.subtotal)} <small>EGP</small></span> : <span>{money(item.subtotal)}</span>}
    </li>)}</ul>
    <div className="extra-sheet-total">
      <span>Request total</span>
      {staff ? <strong>{moneyAmount(row.totalCost)} <small>EGP</small></strong> : <strong>{money(row.totalCost)}</strong>}
    </div>
  </section>;
  const studyLoad = <section className="extra-sheet-load">
    <h3>Study load</h3>
    {staff && <dl className="extra-load-comparison">
      <div><dt>Current</dt><dd>{eligibility?.hoursBeforeRequest ?? "—"}{eligibility?.hoursBeforeRequest != null && <small> h</small>}</dd></div>
      <div><dt>Requested</dt><dd>{row.requestedHours == null ? "—" : <>+{row.requestedHours}<small> h</small></>}</dd></div>
      <div className="extra-load-after"><dt>After request</dt><dd>{eligibility?.hoursAfterRequest ?? "—"}{eligibility?.hoursAfterRequest != null && <small> h</small>}</dd></div>
    </dl>}
    <dl className={staff ? "extra-review-facts" : undefined}>
      {!staff && <>
        <div><dt>Current hours</dt><dd>{eligibility?.hoursBeforeRequest ?? "—"}</dd></div>
        <div><dt>Requested hours</dt><dd>{row.requestedHours ?? "—"}</dd></div>
        <div className="extra-load-total"><dt>Hours after request</dt><dd>{eligibility?.hoursAfterRequest ?? "—"}</dd></div>
      </>}
      <div><dt>Standard allowance</dt><dd>{eligibility?.standardAllowance == null ? "—" : `${eligibility.standardAllowance} hours`}</dd></div>
      <div><dt>One-year credit exception</dt><dd>{eligibility?.graduatingWithinOneYear == null ? "—" : eligibility.graduatingWithinOneYear ? "Applied" : "Not needed"}</dd></div>
    </dl>
    {eligibility?.isProbation && <p className="feedback error">Ineligible due to academic probation</p>}
  </section>;
  const requestHistory = <section className="extra-sheet-history">
    <h3>Request history</h3>
    {events.length ? <ol>{events.map((entry, index) => {
      const eventDetails = <div>
        <strong className={staff ? `status-pill ${historyTones[entry.action] || "muted"}` : undefined}>{staff && entry.action === "submitted" ? "Request submitted" : pretty(entry.action)}</strong>
        {paymentStates[entry.settlementStatus] && <small>{paymentStates[entry.settlementStatus].label}</small>}
        {entry.note && entry.note !== row.decisionNote && <p>{entry.note}</p>}
      </div>;
      const time = <time dateTime={entry.occurredAt}>{date(entry.occurredAt)}</time>;
      return <li key={entry._id || index}>{staff ? <>{eventDetails}{time}</> : <>{time}{eventDetails}</>}</li>;
    })}</ol> : <p>No history recorded yet.</p>}
  </section>;
  return <div className="extra-review-sheet">
    {staff ? <>
      {summary}
      <div className="extra-review-grid">
        {courses}
        <div className="extra-review-context">
          {studyLoad}
          <section aria-label="Request details">
            <h3>Request details</h3>
            <dl className="extra-review-meta">
              <div><dt>Academic term</dt><dd>{termLabel(row.term)}</dd></div>
              <div><dt>Requested by</dt><dd>{row.advisor?.fullName || "—"}</dd></div>
              <div><dt>Submitted</dt><dd><time dateTime={row.createdAt}>{date(row.createdAt)}</time></dd></div>
              <div className="extra-reference"><dt>Reference</dt><dd>{row._id}</dd></div>
            </dl>
          </section>
        </div>
        {requestHistory}
      </div>
    </> : <>
      <div className="extra-sheet-columns">{courses}{studyLoad}</div>
      {requestHistory}
    </>}
    {row.decisionNote && <section className="extra-sheet-response"><h3>Coordinator response</h3><p>{row.decisionNote}</p></section>}
    {children}
  </div>;
}
