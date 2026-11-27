import StaffPreferences from "./StaffPreferences.jsx";
import { parseDays, parseTimes, PREFERENCE_DAYS, PREFERENCE_TIME_SLOTS } from "../preference-inputs.js";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import { termLabel } from "../term-label.js";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { findPreferenceConflict, minutesToTime, preferenceConflictMessage, preferenceGroupOptions, preferenceMeetingLabel } from "../preference-groups.js";

const humanize = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const formatDateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

const recordTabs = { history: "History", transcript: "Transcript", failed: "Failed courses", wallet: "Wallet" };

export function StudentRecordsPage({ token, profile, profileId: targetProfileId, notify }) {
  const [tab, setTab] = useState("history");
  const [year, setYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [yearsLoading, setYearsLoading] = useState(true);
  const [yearsError, setYearsError] = useState("");
  const request = useRef(null);
  const tabsId = useId();
  const profileId = targetProfileId || profile.studentProfileId;
  const isStaffViewer = ["advisor", "coordinator"].includes(profile.role);
  const tabs = isStaffViewer ? ["history", "transcript", "failed"] : ["history", "transcript", "failed", "wallet"];

  const load = useCallback(async (selectedTab, selectedYear = "") => {
    request.current?.abort();
    if (!profileId) {
      setLoading(false);
      setError("The student profile needed to load these records is unavailable.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(""); setData(null);
    try {
      const base = `/api/identity/students/${encodeURIComponent(profileId)}`;
      const path = { history: "history", transcript: `transcript?year=${encodeURIComponent(selectedYear)}`, failed: "failed-courses", wallet: "wallet" };
      const result = await api(`${base}/${path[selectedTab]}`, { token, signal: controller.signal });
      if (!controller.signal.aborted) setData(result);
    } catch (requestError) {
      if (!controller.signal.aborted) setError(explainApiError(requestError, "Academic records"));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [profileId, token]);

  useEffect(() => {
    if (!profileId) { setYearsLoading(false); return; }
    const controller = new AbortController();
    setYearsLoading(true);
    setYearsError("");
    api(`/api/identity/students/${encodeURIComponent(profileId)}/transcript/years`, { token, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const years = result.academicYears || [];
        setAcademicYears(years);
        setYear((selected) => years.includes(selected) ? selected : years[0] || "");
      })
      .catch((requestError) => { if (!controller.signal.aborted) setYearsError(explainApiError(requestError, "Academic years")); })
      .finally(() => { if (!controller.signal.aborted) setYearsLoading(false); });
    return () => controller.abort();
  }, [profileId, token]);

  const transcriptYear = tab === "transcript" ? year : "";
  useEffect(() => {
    if (tab !== "transcript" || transcriptYear) load(tab, transcriptYear);
    return () => request.current?.abort();
  }, [tab, load, transcriptYear]);

  function selectTab(item) {
    if (item === tab) return;
    request.current?.abort();
    setData(null); setError(""); setLoading(item !== "transcript" || Boolean(year)); setTab(item);
  }

  function handleTabKey(event, index) {
    const target = { ArrowLeft: (index - 1 + tabs.length) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    event.currentTarget.parentElement.children[target].focus();
    selectTab(tabs[target]);
  }

  const download = async () => {
    if (!profileId || !year.trim()) { setError("Enter an academic year before downloading a transcript."); return; }
    setError("");
    try {
      const { data: blob, response } = await api(`/api/identity/students/${encodeURIComponent(profileId)}/transcript/download?year=${encodeURIComponent(year.trim())}`, { token, responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] || `transcript-${year.replaceAll("/", "-")}.pdf`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      notify("success", "Transcript downloaded.");
    } catch (requestError) { setError(explainApiError(requestError, "Transcript download")); }
  };

  return <div className="academic-records">
    {!isStaffViewer && <div className="page-title-row"><h1>Academic records</h1></div>}
    <div className="tabs" role="tablist" aria-label="Academic records">{tabs.map((item, index) =>
      <button type="button" role="tab" id={`${tabsId}-${item}`} aria-controls={`${tabsId}-panel`} aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} key={item} onClick={() => selectTab(item)} onKeyDown={(event) => handleTabKey(event, index)}>{recordTabs[item]}</button>)}</div>
    <section className="records-panel" role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} aria-busy={loading || (tab === "transcript" && yearsLoading)} tabIndex={0}>
      {tab === "transcript" && academicYears.length > 0 && <div className="inline-controls records-transcript-controls">
        <label className="field compact-field"><span>Academic year</span><select disabled={yearsLoading} value={year} onChange={(event) => { request.current?.abort(); setYear(event.target.value); setData(null); setError(""); setLoading(true); }}>{academicYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button className="outline-button" type="button" disabled={!year || yearsLoading} onClick={download}>Download PDF</button>
      </div>}
      {(error || (tab === "transcript" && yearsError)) && <div className="feedback error" role="alert">{error || yearsError}</div>}
      {loading || (tab === "transcript" && yearsLoading) ? <Loading /> : data ? <RecordData data={data} tab={tab} /> : tab === "transcript" && !error && !yearsError &&
        <RecordsEmpty title="No transcript yet" description="Once a course attempt is recorded, its academic year will appear here." art="academic-records/blank-transcript.svg" spacious />}
    </section>
  </div>;
}

export function PreferencesPage(props) {
  return props.profile.role === "advisingStudent" ? <StudentPreferencesPage {...props} /> : <StaffPreferences {...props} />;
}

function StudentPreferencesPage({ token, profile, profileId: passedProfileId, notify }) {
  const [termId, setTermId] = useState("");
  const [terms, setTerms] = useState([]);
  const [termsLoading, setTermsLoading] = useState(true);
  const [preferredDays, setPreferredDays] = useState("");
  const [avoidedDays, setAvoidedDays] = useState("");
  const [daysOff, setDaysOff] = useState("");
  const [preferredTimes, setPreferredTimes] = useState("");
  const [avoidedTimes, setAvoidedTimes] = useState("");
  const [note, setNote] = useState("");
  const [groups, setGroups] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [currentCourseIds, setCurrentCourseIds] = useState([]);
  const [refreshingGroups, setRefreshingGroups] = useState(false);
  const [groupLoadMessage, setGroupLoadMessage] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [hasSubmittedPreferences, setHasSubmittedPreferences] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const conflictNoticeRef = useRef(null);
  const noteId = useId();
  const groupConflict = findPreferenceConflict(groups, offerings);
  const conflictMessage = selectionError || preferenceConflictMessage(groupConflict);
  const effectiveId = passedProfileId || profile.studentProfileId || profile.studentProfile?._id || "";

  const preferenceVersion = useRef(0);
  const resetLoadedPreferences = () => {
    preferenceVersion.current++; setLoading(false);
    setPreferredDays(""); setAvoidedDays(""); setDaysOff(""); setPreferredTimes(""); setAvoidedTimes(""); setNote("");
    setGroupLoadMessage(""); setSaveNotice(""); setGroups([]); setOfferings([]); setCurrentCourseIds([]); setPreferencesLoaded(false); setHasSubmittedPreferences(false); setLastUpdatedAt(null); setSelectionError(""); setError("");
  };

  const termQuery = termId ? `?term=${encodeURIComponent(termId)}` : "";
  const load = useCallback(async (selectedTermId, studentId, signal) => {
    if (!studentId) { setError("Your student profile is not available."); return; }
    const version = ++preferenceVersion.current;
    setLoading(true); setError(""); setSelectionError("");
    try {
      const selectedTermQuery = selectedTermId ? `?term=${encodeURIComponent(selectedTermId)}` : "";
      const result = await api(`/api/identity/students/${encodeURIComponent(studentId)}/preferences${selectedTermQuery}`, { token, signal });
      if (version !== preferenceVersion.current) return;
      const current = result.preferences || {};
      const eligibleIds = new Set(result.eligibleCourseIds || []);
      setCurrentCourseIds([...eligibleIds]);
      setPreferencesLoaded(true);
      setHasSubmittedPreferences(Boolean(result.submitted));
      setLastUpdatedAt(result.lastUpdatedAt || null);
      setPreferredDays((current.preferredDays || []).map((entry) => entry.day).join(", "));
      setAvoidedDays((current.avoidedDays || []).map((entry) => entry.day).join(", "));
      setDaysOff((current.desiredDaysOff || []).map((entry) => entry.day).join(", "));
      setPreferredTimes((current.preferredTimes || []).map((entry) => `${minutesToTime(entry.startMinute)}-${minutesToTime(entry.endMinute)}`).join(", "));
      setAvoidedTimes((current.avoidedTimes || []).map((entry) => `${minutesToTime(entry.startMinute)}-${minutesToTime(entry.endMinute)}`).join(", "));
      setNote(current.note || "");
      const savedGroups = (current.preferredGroups || []).map((entry) => ({ course: String(entry.course?._id || entry.course), componentType: entry.componentType, groupNumber: entry.groupNumber }));
      const visibleGroups = savedGroups.filter((entry) => eligibleIds.has(entry.course));
      setGroups(visibleGroups);
      let groupCount = 0;
      if (selectedTermId) {
        const available = await api(`/api/catalogue/offerings?termId=${encodeURIComponent(selectedTermId)}&publishedOnly=true`, { token, signal });
        if (version !== preferenceVersion.current) return;
        const visible = (available.offerings || []).filter((offering) => eligibleIds.has(String(offering.course?._id || offering.course)));
        groupCount = visible.reduce((total, offering) => total + preferenceGroupOptions(offering).length, 0);
        setOfferings(visible);
      } else setOfferings([]);
      setSelectionError(savedGroups.length > visibleGroups.length ? "Some saved group choices no longer belong to your current courses. Save to update your preferences." : "");
      return { groupCount };
    } catch (requestError) { if (!signal?.aborted && version === preferenceVersion.current) setError(explainApiError(requestError, "Scheduling preferences")); }
    finally { if (version === preferenceVersion.current) setLoading(false); }
  }, [token]);
  const refreshGroupChoices = async () => {
    if (refreshingGroups || loading) return;
    setRefreshingGroups(true); setGroupLoadMessage("");
    try {
      const [result] = await Promise.all([load(termId, effectiveId), new Promise(resolve => setTimeout(resolve, 1000))]);
      if (result) setGroupLoadMessage(result.groupCount ? `${result.groupCount} class groups found.` : "No class groups found for this term.");
    } finally { setRefreshingGroups(false); }
  };
  useEffect(() => {
    if (conflictMessage) conflictNoticeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [conflictMessage]);
  useEffect(() => {
    let cancelled = false;
    api("/api/academic-terms/academicTerm", { token })
      .then((availableTerms) => {
        if (cancelled) return;
        const rows = Array.isArray(availableTerms) ? availableTerms : [];
        setTerms(rows);
        const activeTerms = rows.filter((term) => term.isActive);
        if (activeTerms.length === 1) setTermId((current) => current || activeTerms[0]._id);
      })
      .catch((requestError) => { if (!cancelled) setError(explainApiError(requestError, "Academic terms")); })
      .finally(() => { if (!cancelled) setTermsLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const save = async (event) => {
    event.preventDefault();
    if (!effectiveId) { setError("Your student profile is not available."); return; }
    if (groupConflict) { setError(preferenceConflictMessage(groupConflict)); return; }
    setSaving(true); setError(""); setSaveNotice("");
    try {
      const body = {
        preferredDays: parseDays(preferredDays), avoidedDays: parseDays(avoidedDays), desiredDaysOff: parseDays(daysOff),
        preferredTimes: parseTimes(preferredTimes), avoidedTimes: parseTimes(avoidedTimes),
        preferredGroups: groups.map((group, index) => ({ ...group, priority: index + 1 })), note,
      };
      const result = await api(`/api/identity/students/${encodeURIComponent(effectiveId)}/preferences${termQuery}`, { token, method: "PUT", body });
      setPreferencesLoaded(true);
      setHasSubmittedPreferences(true);
      setLastUpdatedAt(result.lastUpdatedAt || new Date().toISOString());
      setSelectionError("");
      setSaveNotice("Preferences saved. You can reopen this term to view them.");
      notify("success", `Preferences saved${result.lastUpdatedAt ? ` · ${new Date(result.lastUpdatedAt).toLocaleString()}` : ""}. These are scheduling hints only.`);
    } catch (requestError) { setError(explainApiError(requestError, "Scheduling preferences")); }
    finally { setSaving(false); }
  };

  const toggleGroup = (offering, option) => {
    const entry = { course: String(offering.course?._id || offering.course), componentType: option.componentType, groupNumber: option.groupNumber };
    const sameGroup = (group) => String(group.course?._id || group.course) === entry.course && group.componentType === entry.componentType && group.groupNumber === entry.groupNumber;
    const alreadySelected = groups.some(sameGroup);
    if (alreadySelected) {
      setGroups((current) => current.filter((group) => !sameGroup(group)));
      setSelectionError("");
      setError("");
      return;
    }
    const conflict = findPreferenceConflict([...groups, entry], offerings);
    if (conflict) {
      setSelectionError(preferenceConflictMessage(conflict));
      return;
    }
    setSelectionError("");
    setError("");
    setGroups((current) => [...current, entry]);
  };

  const groupPriorityLabels = groups.map((group) => {
    const offering = offerings.find((item) => String(item.course?._id || item.course) === String(group.course));
    return `${offering?.course?.code || "Course"} · ${group.componentType} ${group.groupNumber}`;
  });

  return <div className="page-stack schedule-preferences-page"><PageTitle eyebrow="SCHEDULING PREFERENCES" title="Schedule preferences" description="Tell your advising team what works for you. Your choices are optional and depend on course availability and scheduling rules." />
    <div className="preference-toolbar">
      <label className="field"><span>Academic term</span><select data-no-control-ink value={termId} onChange={(event) => { setTermId(event.target.value); resetLoadedPreferences(); }} disabled={termsLoading || terms.length === 0}><option value="">{termsLoading ? "Loading terms…" : "Select a term"}</option>{terms.map((term) => <option key={term._id} value={term._id}>{humanize(term.season)} {term.academicYear}{term.isActive ? " (Active)" : ""}</option>)}</select></label>
      <button type="button" className="outline-button" onClick={() => load(termId, effectiveId)} disabled={loading || termsLoading}>{loading ? "Loading…" : termsLoading ? "Loading terms…" : "Load saved preferences"}</button>
    </div>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {preferencesLoaded && <div className={`feedback ${hasSubmittedPreferences ? "info" : "warning"}`} role="status">{hasSubmittedPreferences ? `Latest submission${formatDateTime(lastUpdatedAt) ? ` · last updated ${formatDateTime(lastUpdatedAt)}` : ""}.` : "You haven’t submitted preferences for this term yet."}</div>}
    <form onSubmit={(event) => event.preventDefault()} onChangeCapture={() => setSaveNotice("")} onClickCapture={(event) => { if (event.target.closest("button")) setSaveNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault(); }} className="preference-grid">
      <p className="preference-priority-intro">Use the arrows to reorder your choices. #1 is your highest priority.</p>
      <section className="panel preference-days">
        <PreferenceSectionHeading art="preference-week.svg" title="Days that work for you" description="Days to prefer, avoid or keep free." />
        <RankedTextPreference label="Preferred days" value={preferredDays} onChange={setPreferredDays} />
        <RankedTextPreference label="Days to avoid" value={avoidedDays} onChange={setAvoidedDays} />
        <RankedTextPreference label="Desired days off" value={daysOff} onChange={setDaysOff} />
      </section>
      <section className="panel preference-times">
        <PreferenceSectionHeading art="preference-teaching-times.svg" title="Teaching times" description="Choose from the five teaching slots." />
        <RankedTextPreference label="Preferred times" choices={PREFERENCE_TIME_SLOTS} value={preferredTimes} onChange={setPreferredTimes} />
        <RankedTextPreference label="Times to avoid" choices={PREFERENCE_TIME_SLOTS} value={avoidedTimes} onChange={setAvoidedTimes} />
      </section>
      <section className="preference-groups">
        <div className="preference-groups-header">
          <PreferenceSectionHeading art="extra-hours-folder.svg" title="Preferred class groups" description="Groups from different courses cannot overlap." />
          {offerings.length === 0 && <button className="outline-button preference-refresh-groups" type="button" onClick={refreshGroupChoices} disabled={loading || refreshingGroups || !termId || !effectiveId} aria-busy={refreshingGroups}>
            {refreshingGroups && <span className="preference-button-spinner" aria-hidden="true" />}{refreshingGroups ? "Checking…" : "Refresh groups"}
          </button>}
        </div>
        {groups.length > 0 && <div className="selected-group-priorities"><h3>Selected group priorities</h3><PriorityList items={groupPriorityLabels} onMove={(index, direction) => setGroups((current) => moveRankedItem(current, index, direction))} /></div>}
        {conflictMessage && <div ref={conflictNoticeRef} className="feedback error preference-conflict-feedback" role="alert" aria-live="assertive">{conflictMessage}</div>}
        {groupLoadMessage && <p className="preference-group-feedback" role="status">{groupLoadMessage}</p>}
        {offerings.length === 0 ? <p className="preference-groups-empty">{preferencesLoaded ? (currentCourseIds.length ? "No published groups for your courses." : "Groups appear once courses are assigned.") : termId ? "Check for available class groups." : "Select a term to check for class groups."}</p> : offerings.map((offering) => <div className="preference-offering" key={offering._id}>
          <div className="preference-course-identity"><OfferingCourseIcon code={offering.course?.code} /><div><small>{offering.course?.code}</small><strong>{offering.course?.name}</strong></div></div>
          <div className="group-chip-list">{preferenceGroupOptions(offering).map((option) => {
            const courseId = String(offering.course?._id || offering.course);
            const groupIndex = groups.findIndex((group) => String(group.course?._id || group.course) === courseId && group.componentType === option.componentType && group.groupNumber === option.groupNumber);
            const checked = groupIndex !== -1;
            return <button type="button" aria-pressed={checked} className={`group-chip ${checked ? "selected" : ""}`} key={`${option.componentType}-${option.groupNumber}`} onClick={() => toggleGroup(offering, option)}>
              <strong>{option.componentType} {option.groupNumber}{checked && ` · #${groupIndex + 1}`}</strong><small>{option.sessions.map(preferenceMeetingLabel).join(" / ")}</small>
            </button>;
          })}</div>
        </div>)}
      </section>
      <section className="preference-note">
        <PreferenceSectionHeading art="exit-exam-form.svg" title={<label htmlFor={noteId}>Note for advising staff</label>} description={<span id={`${noteId}-limit`}>Optional · up to 1,000 characters</span>} />
        <div className="field"><textarea id={noteId} aria-describedby={`${noteId}-limit`} data-no-control-ink value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Add a note…" /></div>
      </section>
      <div className="form-footer"><span className={`helper-text ${saveNotice ? "preference-save-confirmation" : ""}`} role="status">{saveNotice || "Changes are saved only when you press Save preferences."}</span><button className="primary-button" type="button" onClick={save} disabled={saving || Boolean(groupConflict)}>{saving ? "Saving…" : "Save preferences"}<span>→</span></button></div>
    </form>
  </div>;
}

function PreferenceSectionHeading({ art, title, description }) {
  return <header className="preference-section-heading"><img src={`/portal-studio/images/${art}`} width="88" height="62" alt="" /><div><h2>{title}</h2><p>{description}</p></div></header>;
}

function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function Loading() { return <div className="loading-state"><span className="loader" />Loading…</div>; }

const walletTransactionLabels = {
  walletTopUp: "Wallet top-up",
  extraHoursWalletPayment: "Extra-hours payment",
  refund: "Refund",
};
const walletMoney = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function WalletRecords({ data }) {
  const transactions = data.transactions ?? [];
  const currency = data.currency || "EGP";
  const transactionReferences = new Map(transactions.map(transaction => [String(transaction._id), transaction.transactionReference || transaction.referenceNumber || transaction.receiptId]));
  return <div className="records-wallet">
    <section className="records-wallet-balance" aria-labelledby="wallet-balance-title">
      <h2 id="wallet-balance-title">Available wallet balance</h2>
      <p>{walletMoney.format(data.balance ?? 0)} <small>{currency}</small></p>
    </section>
    <section className="records-wallet-history" aria-labelledby="wallet-history-title">
      <h2 id="wallet-history-title">Transactions</h2>
      {transactions.length ? <ul className="records-wallet-list" role="list">
        {transactions.map(transaction => {
          const debit = transaction.direction ? transaction.direction === "debit" : transaction.kind === "extraHoursWalletPayment";
          const date = transaction.occurredAt || transaction.createdAt;
          const relatedPayment = transaction.relatedTransaction;
          const relatedId = relatedPayment?._id || relatedPayment;
          const references = [
            ["Transaction", transactionReferences.get(String(transaction._id))],
            ["Request", transaction.extraHoursRequest?._id || transaction.extraHoursRequest],
            ["Related payment", relatedPayment?.transactionReference || transactionReferences.get(String(relatedId)) || relatedId, relatedId],
          ].filter(([, value]) => value);
          return <li className="records-wallet-entry" key={transaction._id}>
            <h3>{walletTransactionLabels[transaction.kind] || humanize(transaction.kind)}</h3>
            <div className="records-wallet-amount">
              <strong className={debit ? "is-debit" : "is-credit"}>{debit ? "−" : "+"}{walletMoney.format(transaction.amount ?? 0)} <small>{currency}</small></strong>
              <span>Balance after <strong>{walletMoney.format(transaction.resultingBalance ?? 0)}</strong> {currency}</span>
            </div>
            <time className="records-wallet-date" dateTime={date}>{formatDate(date)}</time>
            <span className={`status-pill records-wallet-status ${transaction.status === "succeeded" ? "good" : "muted"}`}>{humanize(transaction.status)}</span>
            {references.length > 0 && <dl className="records-wallet-references">{references.map(([label, value, id]) =>
              <div key={label}><dt>{label}</dt><dd title={id && id !== value ? id : undefined}>{value}</dd></div>
            )}</dl>}
          </li>;
        })}
      </ul> : <RecordsEmpty title="No wallet transactions yet" description="Top-ups, wallet payments and refunds will appear here." art="payment-ledger.svg" spacious />}
    </section>
  </div>;
}

function RecordData({ data, tab }) {
  if (tab === "wallet") return <WalletRecords data={data} />;
  if (tab === "failed") {
    const records = Array.isArray(data) ? data : [];
    return records.length ? <CourseRecordGroup title="Failed or unattended courses" previewLength={records.length} items={records.map(item => ({
      id: item._id, course: item.course,
      details: { Term: termLabel(item.term), Attempt: item.attemptNumber, Attendance: humanize(item.attendance), Result: humanize(item.result), Grade: item.grade },
    }))} /> : <RecordsEmpty title="No failed or unattended courses" description="Courses appear here when a failed or unattended attempt is recorded." art="academic-records/clear-attempts.svg" spacious />;
  }
  if (tab === "transcript") {
    const terms = Object.entries(data.terms || {}).filter(([, rows]) => rows?.length);
    return terms.length ? <div className="records-transcript">
      <h2>Transcript for {data.year}</h2>
      {terms.map(([name, rows]) => <CourseRecordGroup key={name} title={humanize(name)} previewLength={rows.length} items={rows.map((row, index) => ({
        id: row._id || index, course: row.course,
        details: { Grade: row.grade, Result: humanize(row.result), Attendance: humanize(row.attendance) },
      }))} />)}
    </div> : <RecordsEmpty title="No course attempts for this year" description="Select another academic year to view its transcript." art="academic-records/blank-transcript.svg" spacious />;
  }
  return <AcademicHistory data={data} />;
}

function AcademicHistory({ data }) {
  const summary = data.studentProfile || {};
  const groups = [
    {
      title: "Current courses", empty: "Courses in progress will appear here.",
      emptyArt: "academic-records/current-courses.svg",
      items: (data.currentCourses || []).map((item) => ({
        id: item._id, course: item.course, details: { Term: termLabel(item.term) },
      })),
    },
    {
      title: "Completed courses", empty: "Passed courses will appear here.",
      emptyArt: "academic-records/completed-courses.svg",
      items: (data.completedCourses || []).map((item) => ({
        id: item._id, course: item.course, details: { Term: termLabel(item.term), Grade: item.grade },
      })),
    },
    {
      title: "Remaining courses", empty: "The catalogue lists no remaining courses for this major.",
      items: (data.remainingCourses || []).map((course) => ({
        id: course._id, course, details: {
          "Offering season": course.offeringSeasons?.map(humanize).join(", ") || "Not specified",
          Prerequisites: course.prerequisites?.map((item) => [item.code, item.name].filter(Boolean).join(" · ")).join(", ") || "None",
        },
      })),
    },
  ];
  return <div className="records-history">
    <div className="records-summary">
      <img src="/portal-studio/images/academic-transcript.svg" alt="" width="64" height="64" />
      <div className="records-summary-copy"><h2>Academic history</h2>{summary.studentId && <p className="records-caption">Student ID {summary.studentId}</p>}</div>
      <dl className="records-standing">
        {Object.entries({ GPA: summary.gpa, "Completed credits": summary.completedHours ?? 0, "Current semester": summary.currentSemester }).map(([label, value]) =>
          <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}
      </dl>
      <dl className="records-program">
        <div><dt>Major</dt><dd>{summary.major || "—"}</dd></div>
        <div><dt>Advisor</dt><dd>{summary.advisor || "Unassigned"}</dd></div>
      </dl>
    </div>
    {groups.map((group) => <CourseRecordGroup key={group.title} {...group} />)}
  </div>;
}

function RecordsEmpty({ title, description, art = "academic-transcript.svg", spacious = false }) {
  return <div className={spacious ? "records-blank records-blank-tab" : "records-blank"}>
    <img className="records-empty-art" src={`/portal-studio/images/${art}`} alt="" loading="eager" width={spacious ? 148 : 52} height={spacious ? 124 : 46} />
    <div><strong>{title}</strong>{description && <p>{description}</p>}</div>
  </div>;
}

function CourseRecordGroup({ title, items, empty, emptyArt, previewLength = 4 }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, previewLength);
  return <section className="records-course-group" aria-labelledby={id}>
    <header className="records-course-heading">
      <div><h3 id={id}>{title}</h3><span>{items.length}</span></div>
      {items.length > previewLength && <button type="button" className="outline-button" aria-controls={`${id}-list`} aria-expanded={expanded} aria-label={`${expanded ? "Show fewer" : `Show all ${items.length}`} ${title.toLowerCase()}`} onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${items.length}`}</button>}
    </header>
    {items.length === 0 ? <RecordsEmpty title={`No ${title.toLowerCase()}`} description={empty} art={emptyArt} /> :
      <ul className="records-courses" id={`${id}-list`} aria-labelledby={id} role="list">{visibleItems.map(({ id: key, course, details }) =>
        <li key={key}>
          <div className="records-course-identity">
            <OfferingCourseIcon code={course?.code} />
            <div><strong>{course?.name || "Course unavailable"}</strong><small>{[course?.code, course?.creditHours != null && `${course.creditHours} ${course.creditHours === 1 ? "credit" : "credits"}`].filter(Boolean).join(" · ") || "—"}</small></div>
          </div>
          <dl className="records-course-details">{Object.entries(details).map(([label, value]) =>
            <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl>
        </li>)}</ul>}
  </section>;
}

function moveRankedItem(items, index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const reordered = [...items];
  [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
  return reordered;
}

function PriorityList({ items, onMove, onRemove }) {
  if (!items.length) return null;
  return <ol className="priority-list" aria-label="Priority order, highest first">
    {items.map((item, index) => <li key={`${item}-${index}`}>
      <span className="priority-number">#{index + 1}</span><span className="priority-item-label">{item}</span>
      {onMove && <span className="priority-actions"><button type="button" className="outline-button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${item} to higher priority`}>↑</button><button type="button" className="outline-button" disabled={index === items.length - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${item} to lower priority`}>↓</button></span>}
      {onRemove && <button type="button" className="preference-remove-choice" onClick={() => onRemove(index)} aria-label={`Remove ${item}`}>×</button>}
    </li>)}
  </ol>;
}

function RankedTextPreference({ label, value, onChange, choices = PREFERENCE_DAYS }) {
  const items = value.split(",").map(item => item.trim()).filter(Boolean);
  const available = choices.filter(choice => !items.includes(choice));
  const move = (index, direction) => onChange(moveRankedItem(items, index, direction).join(", "));
  const remove = index => onChange(items.filter((_, position) => position !== index).join(", "));
  return <div className="ranked-preference-field">
    <label className="field"><span>{label}</span><select data-no-control-ink aria-label={`Add ${label.toLowerCase()}`} value="" disabled={!available.length} onChange={event => { if (event.target.value) onChange([...items, event.target.value].join(", ")); }}>
      <option value="">{available.length ? choices === PREFERENCE_TIME_SLOTS ? "Choose a time slot…" : "Choose a day…" : "All options selected"}</option>
      {available.map(choice => <option key={choice} value={choice}>{choice.replace("-", "–")}</option>)}
    </select></label>
    <PriorityList items={items} onMove={move} onRemove={remove} />
  </div>;
}
