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
        <RecordsEmpty title="No transcript yet" description="Yearly transcripts appear after an academic year has course attempts." />}
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

  return <div className="page-stack schedule-preferences-page"><PageTitle eyebrow="SCHEDULING PREFERENCES" title="Schedule preferences" description="Share your preferred days, times and class groups. All preferences are optional and remain subject to academic and scheduling rules." />
    <section className="panel preference-toolbar">
      <label className="field"><span>Academic term</span><select value={termId} onChange={(event) => { setTermId(event.target.value); resetLoadedPreferences(); }} disabled={termsLoading || terms.length === 0}><option value="">{termsLoading ? "Loading terms…" : "Select a term"}</option>{terms.map((term) => <option key={term._id} value={term._id}>{humanize(term.season)} {term.academicYear}{term.isActive ? " (Active)" : ""}</option>)}</select></label>
      <button type="button" className="outline-button" onClick={() => load(termId, effectiveId)} disabled={loading || termsLoading}>{loading ? "Loading…" : termsLoading ? "Loading terms…" : "Load saved preferences"}</button>
    </section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {preferencesLoaded && <div className={`feedback ${hasSubmittedPreferences ? "info" : "warning"}`} role="status">{hasSubmittedPreferences ? `Latest submission${formatDateTime(lastUpdatedAt) ? ` · last updated ${formatDateTime(lastUpdatedAt)}` : ""}.` : "No preferences were submitted for this term. The student can still receive a schedule."}</div>}
    <form onSubmit={(event) => event.preventDefault()} onChangeCapture={() => setSaveNotice("")} onClickCapture={(event) => { if (event.target.closest("button")) setSaveNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault(); }} className="preference-grid">
      <section className="panel preference-days"><PreferenceSectionHeading kind="days" title="Days that work for you" description="Preferred days, days to avoid and time off" /><p className="helper-text">Choose days from the dropdown, then use the arrows to rank them. #1 is highest.</p><RankedTextPreference label="Preferred days" value={preferredDays} onChange={setPreferredDays} placeholder="Monday, Wednesday" /><RankedTextPreference label="Days to avoid" value={avoidedDays} onChange={setAvoidedDays} placeholder="Friday" /><RankedTextPreference label="Desired days off" value={daysOff} onChange={setDaysOff} placeholder="Thursday" /></section>
      <section className="panel preference-times"><PreferenceSectionHeading kind="times" title="Your preferred times" description="Time ranges to prefer or avoid" /><p className="helper-text">Choose from the five teaching slots, then rank your choices. #1 is highest.</p><RankedTextPreference label="Preferred times" choices={PREFERENCE_TIME_SLOTS} value={preferredTimes} onChange={setPreferredTimes} placeholder="09:00-12:00, 13:00-15:00" /><RankedTextPreference label="Times to avoid" choices={PREFERENCE_TIME_SLOTS} value={avoidedTimes} onChange={setAvoidedTimes} placeholder="08:00-09:00" /></section>
      <section className="panel preference-groups"><PreferenceSectionHeading kind="groups" title="Preferred class groups" description="Choose meeting groups, then rank your choices" /><p className="helper-text">Select groups and rank your choices. Groups from different courses cannot overlap.</p>{groups.length > 0 && <div className="selected-group-priorities"><h3>Selected group priorities</h3><p className="helper-text">#1 is your highest preference. Use the arrows to change the order.</p><PriorityList items={groupPriorityLabels} onMove={(index, direction) => setGroups((current) => moveRankedItem(current, index, direction))} /></div>}{conflictMessage && <div ref={conflictNoticeRef} className="feedback error preference-conflict-feedback" role="alert" aria-live="assertive">{conflictMessage}</div>}{groupLoadMessage && <p className="preference-group-feedback" role="status">{groupLoadMessage}</p>}{offerings.length === 0 ? <><p className="helper-text">{preferencesLoaded ? (currentCourseIds.length ? "No published groups for your courses." : "Groups appear once courses are assigned.") : "Check for available class groups."}</p><button className="outline-button preference-refresh-groups" type="button" onClick={refreshGroupChoices} disabled={loading || refreshingGroups || !termId || !effectiveId} aria-busy={refreshingGroups}>{refreshingGroups && <span className="preference-button-spinner" aria-hidden="true" />}{refreshingGroups ? "Checking…" : "Refresh groups"}</button></> : offerings.map((offering) => <div className="preference-offering" key={offering._id}><div className="preference-course-identity"><OfferingCourseIcon code={offering.course?.code} /><div><small>{offering.course?.code}</small><strong>{offering.course?.name}</strong></div></div><div className="group-chip-list">{preferenceGroupOptions(offering).map((option) => { const courseId = String(offering.course?._id || offering.course); const groupIndex = groups.findIndex((group) => String(group.course?._id || group.course) === courseId && group.componentType === option.componentType && group.groupNumber === option.groupNumber); const checked = groupIndex !== -1; return <button type="button" aria-pressed={checked} className={`group-chip ${checked ? "selected" : ""}`} key={`${option.componentType}-${option.groupNumber}`} onClick={() => toggleGroup(offering, option)}><strong>{option.componentType} {option.groupNumber}{checked && ` · #${groupIndex + 1}`}</strong><small>{option.sessions.map(preferenceMeetingLabel).join(" / ")}</small></button>; })}</div></div>)}</section>
      <section className="panel preference-note"><PreferenceSectionHeading kind="note" title="Anything else?" description="Optional note for your advising staff" /><label className="field"><span>Note for advising staff</span><textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional note (up to 1000 characters)" /></label></section>
      <div className="form-footer"><span className={`helper-text ${saveNotice ? "preference-save-confirmation" : ""}`} role="status">{saveNotice || "Changes are saved only when you press Save preferences."}</span><button className="primary-button" type="button" onClick={save} disabled={saving || Boolean(groupConflict)}>{saving ? "Saving…" : "Save preferences"}<span>→</span></button></div>
    </form>
  </div>;
}

function PreferenceSectionHeading({ kind, title, description }) {
  const paths = { days: <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v5m8-5v5M4 11h16M8 15h2m4 0h2m-8 3h2"/></>, times: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>, groups: <><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><path d="M14 18h7m-3-3v6"/></>, note: <><path d="M5 3h11l3 3v15H5zM9 9h6m-6 4h6m-6 4h4"/></> };
  return <div className="preference-section-heading"><span className={`preference-section-icon is-${kind}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg></span><div><h2>{title}</h2><p>{description}</p></div></div>;
}

function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function Loading() { return <div className="loading-state"><span className="loader" />Loading…</div>; }

function RecordData({ data, tab }) {
  if (tab === "wallet") {
    const txns = data.transactions || [];
    const referenceLabel = (value) => {
      const id = String(value?._id || value || "");
      return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
    };
    const amountLabel = (amount) => Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const transactionDirection = (txn) => txn.direction || (txn.kind === "extraHoursWalletPayment" ? "debit" : "credit");
    return <><div className="wallet-balance"><div><p>Available balance</p><strong>{Number(data.balance || 0).toLocaleString()} <small>{data.currency || "EGP"}</small></strong></div><span>EGP</span></div><h2 className="section-heading">Transactions</h2>{txns.length ? <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Amount</th><th>Status</th><th>Date</th><th>Related request or payment</th><th>Balance after</th></tr></thead><tbody>{txns.map((txn) => {
      const direction = transactionDirection(txn);
      const relatedId = txn.relatedTransaction ? referenceLabel(txn.relatedTransaction) : "";
      const paymentRef = relatedId || txn.transactionReference || "";
      return <tr key={txn._id}>
        <td><span className={`wallet-direction ${direction}`}>{direction === "debit" ? "Debit" : "Credit"}</span><span className="secondary-text">{humanize(txn.kind)}</span></td>
        <td className={`wallet-amount ${direction}`}>{direction === "debit" ? "−" : "+"}{amountLabel(txn.amount)} {data.currency || "EGP"}</td>
        <td><span className={`status-pill ${txn.status === "succeeded" ? "good" : "muted"}`}>{humanize(txn.status)}</span></td>
        <td>{formatDate(txn.occurredAt || txn.createdAt)}</td>
        <td className="wallet-related-records">
          {txn.extraHoursRequest && <span title={String(txn.extraHoursRequest?._id || txn.extraHoursRequest)}>Request · {referenceLabel(txn.extraHoursRequest)}</span>}
          {paymentRef && <span title={String(txn.relatedTransaction?._id || txn.relatedTransaction || txn.transactionReference)}>Payment · {paymentRef}</span>}
          {!txn.extraHoursRequest && !paymentRef && <span>—</span>}
        </td>
        <td>{amountLabel(txn.resultingBalance)} {data.currency || "EGP"}</td>
      </tr>;
    })}</tbody></table></div> : <p className="records-empty">Wallet transactions will appear here when you add or use funds.</p>}</>;
  }
  if (tab === "failed") {
    const records = Array.isArray(data) ? data : [];
    return records.length ? <CourseRecordGroup title="Failed or unattended courses" previewLength={records.length} items={records.map(item => ({
      id: item._id, course: item.course,
      details: { Term: termLabel(item.term), Attempt: item.attemptNumber, Attendance: humanize(item.attendance), Result: humanize(item.result), Grade: item.grade },
    }))} /> : <RecordsEmpty title="No failed or unattended courses" description="Courses appear here when a failed or unattended attempt is recorded." />;
  }
  if (tab === "transcript") {
    const terms = Object.entries(data.terms || {}).filter(([, rows]) => rows?.length);
    return terms.length ? <div className="records-transcript">
      <h2>Transcript for {data.year}</h2>
      {terms.map(([name, rows]) => <CourseRecordGroup key={name} title={humanize(name)} previewLength={rows.length} items={rows.map((row, index) => ({
        id: row._id || index, course: row.course,
        details: { Grade: row.grade, Result: humanize(row.result), Attendance: humanize(row.attendance) },
      }))} />)}
    </div> : <RecordsEmpty title="No course attempts for this year" description="Select another academic year to view its transcript." />;
  }
  return <AcademicHistory data={data} />;
}

function AcademicHistory({ data }) {
  const summary = data.studentProfile || {};
  const groups = [
    {
      title: "Current courses", empty: "Courses appear here once they’re recorded as in progress.",
      items: (data.currentCourses || []).map((item) => ({
        id: item._id, course: item.course, details: { Term: termLabel(item.term) },
      })),
    },
    {
      title: "Completed courses", empty: "No passing grades have been recorded yet.",
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

function RecordsEmpty({ title, description }) {
  return <div className="records-blank">
    <img src="/portal-studio/images/academic-transcript.svg" alt="" width="44" height="44" />
    <div><strong>{title}</strong>{description && <p>{description}</p>}</div>
  </div>;
}

function CourseRecordGroup({ title, items, empty, previewLength = 4 }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, previewLength);
  return <section className="records-course-group" aria-labelledby={id}>
    <header className="records-course-heading">
      <div><h3 id={id}>{title}</h3><span>{items.length}</span></div>
      {items.length > previewLength && <button type="button" className="outline-button" aria-controls={`${id}-list`} aria-expanded={expanded} aria-label={`${expanded ? "Show fewer" : `Show all ${items.length}`} ${title.toLowerCase()}`} onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer" : `Show all ${items.length}`}</button>}
    </header>
    {items.length === 0 ? <RecordsEmpty title={`No ${title.toLowerCase()}`} description={empty} /> :
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
    <label className="field"><span>{label}</span><select aria-label={`Add ${label.toLowerCase()}`} value="" disabled={!available.length} onChange={event => { if (event.target.value) onChange([...items, event.target.value].join(", ")); }}>
      <option value="">{available.length ? choices === PREFERENCE_TIME_SLOTS ? "Choose a time slot…" : "Choose a day…" : "All options selected"}</option>
      {available.map(choice => <option key={choice} value={choice}>{choice.replace("-", "–")}</option>)}
    </select></label>
    <PriorityList items={items} onMove={move} onRemove={remove} />
  </div>;
}
