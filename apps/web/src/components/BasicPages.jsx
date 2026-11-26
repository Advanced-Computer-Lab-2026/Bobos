import { parseDays, parseTimes, PREFERENCE_DAYS, PREFERENCE_TIME_SLOTS } from "../preference-inputs.js";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import { termLabel } from "../term-label.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { greetingName } from "../greeting.js";
import { findPreferenceConflict, preferenceConflictMessage, preferenceGroupOptions, preferenceMeetingLabel } from "../preference-groups.js";

const roleTitle = (role = "") => ({ normalStudent: "Normal student", advisingStudent: "Advising student", advisor: "Advisor", coordinator: "Coordinator", administrator: "Administrator" }[role] || role);
const humanize = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const formatDateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
const initials = (value = "") => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "B";

export function OverviewPage({ token, profile, onOpen }) {
  const student = ["normalStudent", "advisingStudent"].includes(profile.role);
  const coordinator = profile.role === "coordinator";
  const managesTerms = coordinator || profile.role === "administrator";
  const [work, setWork] = useState(null);
  const [terms, setTerms] = useState(null);
  const [unavailable, setUnavailable] = useState({});

  useEffect(() => {
    const controller = new AbortController();
    const load = (key, path, apply) => api(path, { token, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) apply(data); })
      .catch(() => {
        if (!controller.signal.aborted) setUnavailable((current) => ({ ...current, [key]: true }));
      });
    if (coordinator) load("work", "/api/admin/pending-work", setWork);
    if (managesTerms) {
      load("terms", "/api/academic-terms/academicTerm", setTerms);
    }
    return () => controller.abort();
  }, [token, coordinator, managesTerms]);

  const term = Array.isArray(terms) ? terms.find((item) => item.isActive) : null;
  const ready = (work?.students || []).filter((item) => item.workflowStatus === "readyToProcess");
  const removals = work?.students?.reduce((total, item) => total + (item.requests || []).filter(
    (request) => request.type === "mandatoryCourseRemoval" && request.status === "pending",
  ).length, 0);
  const queue = student
    ? [
      ["Registered courses", "Review the courses on your schedule.", "my-courses"],
      profile.role === "advisingStudent"
        ? ["Schedule preferences", "Choose preferred days off and course groups.", "preferences"]
        : ["Eligible swap groups", "See other available schedule groups.", "schedule-swap"],
    ]
    : [
      [removals > 0 ? `Review ${removals} course removal ${removals === 1 ? "request" : "requests"}` : "Course removal requests", "Mandatory courses", "mandatory-removals"],
      managesTerms
        ? ["Schedule group assignments", "Assign students to schedule groups.", "group-assignments"]
        : ["Advising students", "Review preferences and advising progress.", "advising"],
    ];

  return <div className="page-stack folio-overview">
    <header className="folio-greeting">
      <h1>Good day, {greetingName(profile.fullName)}.</h1>
      <p>{new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(new Date())}</p>
    </header>
    <div className={managesTerms ? "folio-desk folio-desk-staff" : "folio-desk"}>
      <section className="folio-feature">
        <div>
          <p className="folio-caption">{student ? "This semester" : "Advising review"}</p>
          <h2>{student ? "Your weekly schedule" : ready.length ? `${ready.length} ${ready.length === 1 ? "schedule" : "schedules"} ready to process` : "Student schedules"}</h2>
          <p>{student ? "See your classes, times, and rooms." : "Open a student’s schedule to review its status and next steps."}</p>
          <button className="primary-button" type="button" onClick={() => onOpen(student ? "my-schedule" : "student-schedules")}>{student ? "View schedule" : "Review schedules"}</button>
        </div>
        {coordinator && <div className="folio-review-list">
          {ready.slice(0, 3).map((item) => <div className="folio-review-person" key={item.id}>
            <span className="avatar" aria-hidden="true">{initials(item.fullName)}</span>
            <div><strong>{item.fullName || item.studentId}</strong><small>{item.studentId}</small></div>
            <button className="outline-button" type="button" aria-label={`Review schedule for ${item.fullName || item.studentId}`} onClick={() => onOpen("student-schedules", {
              draftStudent: { ...item, _id: item.id },
              termId: work.term?.code,
            })}>Review</button>
          </div>)}
          {!ready.length && <p>{unavailable.work ? "Schedule counts unavailable." : work ? "No schedules ready to process." : "Checking schedule status…"}</p>}
        </div>}
      </section>

      <section className="folio-registration">
        <h2>{managesTerms ? "Registration" : student ? "Academic details" : "My profile"}</h2>
        {managesTerms ? <>
          <p>{(term ? termLabel(term) : "") || (unavailable.terms ? "Registration dates unavailable." : terms ? "No active academic term." : "Loading the academic term…")}</p>
          {term && <dl>
            <div><dt>Opens</dt><dd>{formatDate(term.registrationStart)}</dd></div>
            <div><dt>Closes</dt><dd>{formatDate(term.registrationEnd)}</dd></div>
            <div><dt>Schedule swaps close</dt><dd>{formatDate(term.wholeScheduleSwapDeadline)}</dd></div>
          </dl>}
          <button type="button" className="outline-button folio-term-button" onClick={() => onOpen("terms")}>{coordinator ? "View academic term" : "Manage academic term"}</button>
        </> : <>
          <dl>
            <div><dt>{student ? "Student ID" : "Role"}</dt><dd>{student ? profile.studentId || "—" : roleTitle(profile.role)}</dd></div>
            {student && <div><dt>Semester</dt><dd>{profile.currentSemester || "—"}</dd></div>}
            {profile.major && <div><dt>Major</dt><dd>{profile.major}</dd></div>}
          </dl>
          <button type="button" className="outline-button" onClick={() => onOpen("profile")}>View profile</button>
        </>}
      </section>

      <section className="folio-queue">
        <h2>{student ? "Student services" : "Work queue"}</h2>
        {queue.map(([title, description, screen]) => <div className="folio-queue-row" key={screen}>
          <div><strong>{title}</strong><p>{description}</p></div>
          <button className="outline-button" type="button" aria-label={`Open ${title}`} onClick={() => onOpen(screen)}>Open</button>
        </div>)}
        {coordinator && <button type="button" className="outline-button" onClick={() => onOpen("pending-work")}>All pending work</button>}
      </section>

      {!managesTerms && <section className="folio-activity">
        <h2>Notifications</h2>
        <button className="outline-button" type="button" onClick={() => onOpen("notifications")}>Open notifications</button>
      </section>}
    </div>
  </div>;
}

export function ProfilePage({ profile }) {
  const student = ["normalStudent", "advisingStudent"].includes(profile.role);
  return <div className="page-stack">
    <PageTitle eyebrow="ACCOUNT DETAILS" title="My profile" description="Your identity and academic information from the university account." />
    <section className="panel profile-hero"><span className="avatar avatar-xl">{initials(profile.fullName)}</span><div><h2>{profile.fullName}</h2><p>{profile.email}</p><span className="role-pill">{roleTitle(profile.role)}</span></div></section>
    <section className="panel"><div className="panel-heading"><div><p className="eyebrow">PERSONAL INFORMATION</p><h2>Account details</h2></div></div><div className="detail-grid"><Detail label="Full name" value={profile.fullName} /><Detail label="GUC email" value={profile.email} /><Detail label="Role" value={roleTitle(profile.role)} />{student && <><Detail label="Student number" value={profile.studentId} /><Detail label="Student profile ID" value={profile.studentProfileId} /><Detail label="Student type" value={humanize(profile.studentType)} /><Detail label="Major" value={profile.major} /><Detail label="Current semester" value={profile.currentSemester} /><Detail label="Academic standing" value={humanize(profile.academicStanding)} /><Detail label="Schedule status" value={humanize(profile.scheduleStatus)} /></>}{profile.assignedAdvisor && <Detail label="Assigned advisor" value={`${profile.assignedAdvisor.fullName} · ${profile.assignedAdvisor.email}`} />}</div></section>
    {student && !profile.studentProfileId && <div className="feedback warning">The current backend profile response does not include the student profile ID needed by the academic-record routes.</div>}
  </div>;
}

const warningEmailLabels = { sent: "Email sent", failed: "Email delivery failed", pending: "Email pending" };

export function NotificationsPage({ token, notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingTest, setCreatingTest] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const result = await api("/api/notifications", { token });
      setItems(result.notifications || []);
      return true;
    } catch (requestError) { setError(explainApiError(requestError, "Notifications")); return false; }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [token]);
  const createTest = async () => {
    setCreatingTest(true); setError("");
    try {
      await api("/api/notifications/test", { token, method: "POST", body: {} });
      if (await load()) notify("success", "Test notification created. Check the newest item in your inbox.");
    } catch (requestError) { setError(explainApiError(requestError, "Test notification")); }
    finally { setCreatingTest(false); }
  };
  const markRead = async (item) => {
    try {
      await api(`/api/notifications/${item._id}/read`, { token, method: "PATCH", body: {} });
      setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, isRead: true, readAt: new Date().toISOString() } : entry));
      notify("success", "Notification marked as read.");
    } catch (requestError) { notify("error", requestError.message); }
  };

  return <div className="page-stack"><PageTitle eyebrow="YOUR INBOX" title="Notifications" description="Updates and reminders sent to your university account." action={<div className="inline-controls"><button className="outline-button" type="button" onClick={load} disabled={loading}>↻ Refresh</button>{import.meta.env.DEV && <button className="primary-button" type="button" onClick={createTest} disabled={creatingTest || loading}>{creatingTest ? "Creating…" : "Create test notification"}</button>}</div>} />
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel notification-panel" aria-busy={loading}>
      {loading ? <Loading /> : items.length === 0 ? <EmptyState title="You’re all caught up" text="New updates for your account will appear here." icon="◌" /> : items.map((item) => {
        const isProbationWarning = item.type === "probationWarning";
        const typeLabel = item.title === "Test notification" ? "Test" : humanize(item.type);
        const detail = isProbationWarning ? warningEmailLabels[item.deliveryStatus] ?? typeLabel : typeLabel;
        return <article className={`notification-row ${item.isRead ? "read" : "unread"}`} key={item._id}>
          <span className={`notification-symbol ${item.isRead ? "muted" : ""}`}>{item.isRead ? "✓" : "•"}</span>
          <div className="notification-copy">
            <div className="notification-title"><h3>{item.title}</h3>{!item.isRead && <span className="new-pill">New</span>}</div>
            <p className={isProbationWarning ? "notification-email-message" : undefined}>{item.message}</p>
            <small>{formatDate(item.createdAt)} · {detail}</small>
          </div>
          {!item.isRead && <button className="text-button" type="button" onClick={() => markRead(item)}>Mark read</button>}
        </article>;
      })}
    </section>
  </div>;
}

export function StudentRecordsPage({ token, profile, profileId: targetProfileId, viewerRole, subjectName, onClose, notify }) {
  const [tab, setTab] = useState("history");
  const [year, setYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const profileId = targetProfileId || profile.studentProfileId;
  const role = viewerRole || profile.role;
  const isStaffViewer = ["advisor", "coordinator"].includes(role);
  const tabs = isStaffViewer ? ["history", "transcript", "failed"] : ["history", "transcript", "failed", "wallet"];

  const load = async (selectedTab = tab, selectedYear = year) => {
    if (!profileId) { setError("The API profile response is missing the student profile ID required by this records endpoint."); return; }
    setLoading(true); setError(""); setData(null);
    try {
      const base = `/api/identity/students/${encodeURIComponent(profileId)}`;
      let result;
      if (selectedTab === "history") result = await api(`${base}/history`, { token });
      if (selectedTab === "transcript") {
        if (!selectedYear.trim()) throw new Error("Select an attended academic year.");
        result = await api(`${base}/transcript?year=${encodeURIComponent(selectedYear.trim())}`, { token });
      }
      if (selectedTab === "failed") result = await api(`${base}/failed-courses`, { token });
      if (selectedTab === "wallet") result = await api(`${base}/wallet`, { token });
      setData(result);
    } catch (requestError) { setError(explainApiError(requestError, "Academic records")); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    api(`/api/identity/students/${encodeURIComponent(profileId)}/transcript/years`, { token })
      .then((result) => {
        if (!active) return;
        const years = result.academicYears || [];
        setAcademicYears(years);
        setYear((selected) => years.includes(selected) ? selected : years[0] || "");
      })
      .catch((requestError) => { if (active) setError(explainApiError(requestError, "Academic years")); });
    return () => { active = false; };
  }, [profileId, token]);

  useEffect(() => { if (profileId && tab !== "transcript") load(tab, year); }, [tab, profileId]);

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

  return <div className="page-stack"><PageTitle eyebrow={isStaffViewer ? "ADVISING STUDENT RECORD" : "STUDENT SERVICES"} title="Academic records" description={subjectName ? `Academic history, yearly transcripts, and failed courses for ${subjectName}.` : "Review your academic history, yearly transcripts, failed courses, and wallet."} action={onClose ? <button className="outline-button" type="button" onClick={onClose}>← Back to advising</button> : undefined} />
    <div className="tabs" role="tablist" aria-label="Academic records">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{({ history: "History", transcript: "Transcript", failed: "Failed courses", wallet: "Wallet" })[item]}</button>)}</div>
    {tab === "transcript" && <div className="inline-controls"><label className="field compact-field"><span>Attended academic year</span><select value={year} onChange={(event) => { setYear(event.target.value); setData(null); setError(""); }}><option value="">{academicYears.length ? "Select a year" : "No attended years"}</option>{academicYears.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><button className="primary-button" type="button" disabled={!year} onClick={() => load("transcript", year)}>View transcript</button><button className="outline-button" type="button" disabled={!year} onClick={download}>Download PDF ↓</button></div>}
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel" aria-busy={loading}>{loading ? <Loading /> : data ? <RecordData data={data} tab={tab} /> : !error && <EmptyState title={tab === "transcript" ? "Select an academic year" : "Select a record"} text={tab === "transcript" ? "Choose an attended year, then view its transcript." : "Choose a record type to load your information."} icon="▤" />}</section>
  </div>;
}

export function PreferencesPage({ token, profile, profileId: passedProfileId, studentTarget, notify, onOpenDraftSchedule }) {
  const [selectedStudent, setSelectedStudent] = useState(studentTarget || (passedProfileId ? { _id: passedProfileId } : null));
  const [studentSearch, setStudentSearch] = useState(studentTarget?.studentId || "");
  const [studentMatches, setStudentMatches] = useState([]);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
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
  const isStudent = profile.role === "advisingStudent";
  const selectedStudentProfileId = selectedStudent?._id || selectedStudent?.id || selectedStudent?.profileId || selectedStudent?.studentProfileId || "";
  const effectiveId = isStudent
    ? (passedProfileId || profile.studentProfileId || profile.studentProfile?._id || "")
    : (selectedStudentProfileId || (!studentTarget ? passedProfileId : "") || "");

  const resetLoadedPreferences = () => {
    setPreferredDays(""); setAvoidedDays(""); setDaysOff(""); setPreferredTimes(""); setAvoidedTimes(""); setNote("");
    setGroupLoadMessage(""); setSaveNotice(""); setGroups([]); setOfferings([]); setCurrentCourseIds([]); setPreferencesLoaded(false); setHasSubmittedPreferences(false); setLastUpdatedAt(null); setSelectionError(""); setError("");
  };

  const termQuery = termId ? `?term=${encodeURIComponent(termId)}` : "";
  const load = async (selectedTermId = termId) => {
    if (!effectiveId) { setError(isStudent ? "Your student profile is not available." : "Find and select a student before loading preferences."); return; }
    setLoading(true); setError(""); setSelectionError("");
    try {
      const selectedTermQuery = selectedTermId ? `?term=${encodeURIComponent(selectedTermId)}` : "";
      const result = await api(`/api/identity/students/${encodeURIComponent(effectiveId)}/preferences${selectedTermQuery}`, { token });
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
      const visibleGroups = isStudent ? savedGroups.filter((entry) => eligibleIds.has(entry.course)) : savedGroups;
      setGroups(visibleGroups);
      let groupCount = 0;
      if (selectedTermId) {
        const available = await api(`/api/catalogue/offerings?termId=${encodeURIComponent(selectedTermId)}&publishedOnly=true`, { token });
        const visible = isStudent ? (available.offerings || []).filter((offering) => eligibleIds.has(String(offering.course?._id || offering.course))) : available.offerings || [];
        groupCount = visible.reduce((total, offering) => total + preferenceGroupOptions(offering).length, 0);
        setOfferings(visible);
      } else setOfferings([]);
      setSelectionError(savedGroups.length > visibleGroups.length ? "Some saved group choices no longer belong to your current courses. Save to update your preferences." : "");
      return { groupCount };
    } catch (requestError) { setError(explainApiError(requestError, "Scheduling preferences")); }
    finally { setLoading(false); }
  };
  const refreshGroupChoices = async () => {
    if (refreshingGroups || loading) return;
    setRefreshingGroups(true); setGroupLoadMessage("");
    try {
      const [result] = await Promise.all([load(), new Promise(resolve => setTimeout(resolve, 1000))]);
      if (result) setGroupLoadMessage(result.groupCount ? `${result.groupCount} class groups found.` : "No class groups found for this term.");
    } finally { setRefreshingGroups(false); }
  };
  useEffect(() => {
    setSelectedStudent(studentTarget || (passedProfileId ? { _id: passedProfileId } : null));
    setStudentSearch(studentTarget?.studentId || "");
    setStudentMatches([]);
    resetLoadedPreferences();
  }, [passedProfileId, studentTarget]);
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
    if (!effectiveId) { setError(isStudent ? "Your student profile is not available." : "Find and select a student before saving preferences."); return; }
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

  const findStudent = async (event) => {
    event?.preventDefault();
    const query = studentSearch.trim();
    if (!query) { setError("Enter a student ID, name, or email to search."); return; }
    setStudentLookupLoading(true); setStudentMatches([]); setSelectedStudent(null); resetLoadedPreferences();
    try {
      const result = await api(`/api/advisor/students?search=${encodeURIComponent(query)}&limit=100`, { token });
      const matches = result.data || [];
      const exactIdMatch = matches.find((student) => String(student.studentId).toLowerCase() === query.toLowerCase());
      if (exactIdMatch) {
        setSelectedStudent(exactIdMatch);
        setStudentSearch(exactIdMatch.studentId);
      } else if (matches.length) {
        setStudentMatches(matches);
      } else {
        setError(`No advising student matched “${query}”. Search by the student number shown on their profile, name, or email.`);
      }
    } catch (requestError) { setError(explainApiError(requestError, "Student lookup")); }
    finally { setStudentLookupLoading(false); }
  };

  const groupPriorityLabels = groups.map((group) => {
    const offering = offerings.find((item) => String(item.course?._id || item.course) === String(group.course));
    return `${offering?.course?.code || "Course"} · ${group.componentType} ${group.groupNumber}`;
  });

  const canOpenDraftSchedule = ["advisor", "coordinator"].includes(profile.role) && selectedStudent?.studentType === "advising" && Boolean(termId);
  const selectedTermCode = terms.find((term) => String(term._id) === String(termId))?.code || termId;
  const draftStudent = selectedStudent ? { ...selectedStudent, fullName: selectedStudent.fullName || selectedStudent.user?.fullName || "Advising student" } : null;

  return <div className="page-stack schedule-preferences-page"><PageTitle eyebrow="SCHEDULING PREFERENCES" title={isStudent ? "Schedule preferences" : "Student preferences"} description={isStudent ? "Share your preferred days, times and class groups. All preferences are optional and remain subject to academic and scheduling rules." : selectedStudent ? `View ${selectedStudent.user?.fullName || selectedStudent.studentId}’s latest submitted scheduling preferences.` : "Search for an advising student to view their latest submitted scheduling preferences."} action={canOpenDraftSchedule ? <button className="primary-button" type="button" onClick={() => onOpenDraftSchedule?.(draftStudent, selectedTermCode)}>Create or update draft schedule <span>→</span></button> : undefined} />
    <section className="panel preference-toolbar">
      {!isStudent && <>
        <form className="preference-student-lookup" onSubmit={findStudent}>
          <label className="field"><span>Find advising student</span><input value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setSelectedStudent(null); setStudentMatches([]); resetLoadedPreferences(); }} placeholder="Student ID, name, or email" disabled={studentLookupLoading} /></label>
          <button className="outline-button" type="submit" disabled={studentLookupLoading}>{studentLookupLoading ? "Searching…" : "Find student"}</button>
        </form>
        {selectedStudent && <div className="preference-student-selected" role="status"><strong>{selectedStudent.user?.fullName || "Selected student"}</strong><span>{selectedStudent.studentId || "Student profile"}{selectedStudent.user?.email ? ` · ${selectedStudent.user.email}` : ""}</span><button className="text-button" type="button" onClick={() => { setSelectedStudent(null); setStudentSearch(""); setStudentMatches([]); resetLoadedPreferences(); }}>Change</button></div>}
        {studentMatches.length > 0 && <div className="preference-student-results" aria-label="Matching students">{studentMatches.map((student) => <button className="preference-student-result" key={student._id} type="button" onClick={() => { setSelectedStudent(student); setStudentSearch(student.studentId); setStudentMatches([]); resetLoadedPreferences(); }}><strong>{student.studentId} · {student.user?.fullName || "Student"}</strong><span>{student.user?.email || student.major || "Advising student"}</span></button>)}</div>}
      </>}
      <label className="field"><span>Academic term</span><select value={termId} onChange={(event) => { setTermId(event.target.value); resetLoadedPreferences(); }} disabled={termsLoading || terms.length === 0}><option value="">{termsLoading ? "Loading terms…" : "Select a term"}</option>{terms.map((term) => <option key={term._id} value={term._id}>{humanize(term.season)} {term.academicYear}{term.isActive ? " (Active)" : ""}</option>)}</select></label>
      <button type="button" className="outline-button" onClick={() => load()} disabled={loading || termsLoading}>{loading ? "Loading…" : termsLoading ? "Loading terms…" : "Load saved preferences"}</button>
    </section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {preferencesLoaded && <div className={`feedback ${hasSubmittedPreferences ? "info" : "warning"}`} role="status">{hasSubmittedPreferences ? `Latest submission${formatDateTime(lastUpdatedAt) ? ` · last updated ${formatDateTime(lastUpdatedAt)}` : ""}.` : "No preferences were submitted for this term. The student can still receive a schedule."}</div>}
    <form onSubmit={(event) => event.preventDefault()} onChangeCapture={() => setSaveNotice("")} onClickCapture={(event) => { if (event.target.closest("button")) setSaveNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter" && event.target.tagName === "INPUT") event.preventDefault(); }} className="preference-grid">
      <section className="panel preference-days"><PreferenceSectionHeading kind="days" title="Days that work for you" description="Preferred days, days to avoid and time off" /><p className="helper-text">{isStudent ? "Choose days from the dropdown, then use the arrows to rank them. #1 is highest." : "Comma-separated values are shown in priority order."}</p><RankedTextPreference label="Preferred days" value={preferredDays} onChange={setPreferredDays} placeholder="Monday, Wednesday" readOnly={!isStudent} /><RankedTextPreference label="Days to avoid" value={avoidedDays} onChange={setAvoidedDays} placeholder="Friday" readOnly={!isStudent} /><RankedTextPreference label="Desired days off" value={daysOff} onChange={setDaysOff} placeholder="Thursday" readOnly={!isStudent} /></section>
      <section className="panel preference-times"><PreferenceSectionHeading kind="times" title="Your preferred times" description="Time ranges to prefer or avoid" /><p className="helper-text">{isStudent ? "Choose from the five teaching slots, then rank your choices. #1 is highest." : "Ranges are shown in priority order (24-hour time)."}</p><RankedTextPreference label="Preferred times" choices={PREFERENCE_TIME_SLOTS} value={preferredTimes} onChange={setPreferredTimes} placeholder="09:00-12:00, 13:00-15:00" readOnly={!isStudent} /><RankedTextPreference label="Times to avoid" choices={PREFERENCE_TIME_SLOTS} value={avoidedTimes} onChange={setAvoidedTimes} placeholder="08:00-09:00" readOnly={!isStudent} /></section>
      <section className="panel preference-groups"><PreferenceSectionHeading kind="groups" title="Preferred class groups" description="Choose meeting groups, then rank your choices" /><p className="helper-text">{isStudent ? "Select groups and rank your choices. Groups from different courses cannot overlap." : "Selected groups are listed in priority order with their meeting time and room when currently published."}</p>{isStudent && groups.length > 0 && <div className="selected-group-priorities"><h3>Selected group priorities</h3><p className="helper-text">#1 is your highest preference. Use the arrows to change the order.</p><PriorityList items={groupPriorityLabels} onMove={(index, direction) => setGroups((current) => moveRankedItem(current, index, direction))} /></div>}{conflictMessage && <div ref={conflictNoticeRef} className="feedback error preference-conflict-feedback" role="alert" aria-live="assertive">{conflictMessage}</div>}{groupLoadMessage && <p className="preference-group-feedback" role="status">{groupLoadMessage}</p>}{isStudent ? (offerings.length === 0 ? <><p className="helper-text">{preferencesLoaded ? (currentCourseIds.length ? "No published groups for your courses." : "Groups appear once courses are assigned.") : "Check for available class groups."}</p><button className="outline-button preference-refresh-groups" type="button" onClick={refreshGroupChoices} disabled={loading || refreshingGroups || !termId || !effectiveId} aria-busy={refreshingGroups}>{refreshingGroups && <span className="preference-button-spinner" aria-hidden="true" />}{refreshingGroups ? "Checking…" : "Refresh groups"}</button></> : offerings.map((offering) => <div className="preference-offering" key={offering._id}><div className="preference-course-identity"><OfferingCourseIcon code={offering.course?.code} /><div><small>{offering.course?.code}</small><strong>{offering.course?.name}</strong></div></div><div className="group-chip-list">{preferenceGroupOptions(offering).map((option) => { const courseId = String(offering.course?._id || offering.course); const groupIndex = groups.findIndex((group) => String(group.course?._id || group.course) === courseId && group.componentType === option.componentType && group.groupNumber === option.groupNumber); const checked = groupIndex !== -1; return <button type="button" aria-pressed={checked} className={`group-chip ${checked ? "selected" : ""}`} key={`${option.componentType}-${option.groupNumber}`} onClick={() => toggleGroup(offering, option)}><strong>{option.componentType} {option.groupNumber}{checked && ` · #${groupIndex + 1}`}</strong><small>{option.sessions.map(preferenceMeetingLabel).join(" / ")}</small></button>; })}</div></div>)) : groups.length ? groups.map((group, index) => { const offering = offerings.find((item) => String(item.course?._id || item.course) === String(group.course)); const option = offering && preferenceGroupOptions(offering).find((item) => item.componentType === group.componentType && item.groupNumber === group.groupNumber); return <div className="preference-offering" key={`${group.course}-${group.componentType}-${group.groupNumber}`}><strong>Priority #{index + 1} · {offering?.course?.code || "Course"} {offering?.course?.name ? `· ${offering.course.name}` : ""}</strong><div className="group-chip-list"><span className="group-chip selected"><strong>{group.componentType} {group.groupNumber}</strong><small>{option?.sessions.map(preferenceMeetingLabel).join(" / ") || "This group is no longer published for the term."}</small></span></div></div>; }) : preferencesLoaded && <p className="helper-text">No preferred course groups were submitted.</p>}</section>
      <section className="panel preference-note"><PreferenceSectionHeading kind="note" title="Anything else?" description="Optional note for your advising staff" /><label className="field"><span>Note for advising staff</span><textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional note (up to 1000 characters)" readOnly={!isStudent} /></label></section>
      <div className="form-footer">{isStudent ? <><span className={`helper-text ${saveNotice ? "preference-save-confirmation" : ""}`} role="status">{saveNotice || "Changes are saved only when you press Save preferences."}</span><button className="primary-button" type="button" onClick={save} disabled={saving || Boolean(groupConflict)}>{saving ? "Saving…" : "Save preferences"}<span>→</span></button></> : <span className="helper-text">Advisor/coordinator view only. Students submit and update their own preferences.</span>}</div>
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

function Detail({ label, value }) { return <div className="detail-item"><span>{label}</span><strong>{value ?? "—"}</strong></div>; }
function Loading() { return <div className="loading-state"><span className="loader" />Loading…</div>; }
function EmptyState({ title, text, icon = "◌" }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>; }

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
    })}</tbody></table></div> : <EmptyState title="No transactions yet" text="Wallet activity will appear here." />}</>;
  }
  if (tab === "failed") {
    const records = Array.isArray(data) ? data : [];
    return records.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Term</th><th>Attempt</th><th>Attendance</th><th>Result</th><th>Grade</th></tr></thead><tbody>{records.map((item) => <tr key={item._id}><td><strong>{item.course?.code || "—"}</strong><span className="secondary-text">{item.course?.name}</span></td><td>{termLabel(item.term)}</td><td>{item.attemptNumber || "—"}</td><td>{humanize(item.attendance)}</td><td>{humanize(item.result)}</td><td>{item.grade || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No failed or unattended courses" text={data.message || "There are no records to display."} icon="✓" />;
  }
  if (tab === "transcript") {
    const terms = data.terms || {};
    const courses = Object.entries(terms).flatMap(([name, rows]) => (rows || []).map((entry) => ({ ...entry, termLabel: humanize(name) })));
    return <><div className="results-heading"><div><p className="eyebrow">ACADEMIC YEAR {data.year}</p><h2>Yearly transcript</h2></div><span>{courses.length} course attempts</span></div>{courses.length ? <div className="table-scroll"><table><thead><tr><th>Term</th><th>Course</th><th>Credits</th><th>Grade</th><th>Result</th><th>Attendance</th></tr></thead><tbody>{courses.map((row, index) => <tr key={row._id || `${row.termLabel}-${index}`}><td>{row.termLabel}</td><td><strong>{row.course?.code || "—"}</strong><span className="secondary-text">{row.course?.name}</span></td><td>{row.course?.creditHours ?? "—"}</td><td>{row.grade || "—"}</td><td>{humanize(row.result)}</td><td>{humanize(row.attendance)}</td></tr>)}</tbody></table></div> : <EmptyState title="No transcript courses for this year" text="Choose a different academic year to view another transcript." />}</>;
  }
  const completed = data.completedCourses || [];
  const current = data.currentCourses || [];
  const remaining = data.remainingCourses || [];
  const summary = data.studentProfile || {};
  const courseName = (course) => <><strong>{course?.code || "—"}</strong><span className="secondary-text">{course?.name || ""}</span></>;
  const termName = termLabel;
  return <div className="page-stack">
    <div className="results-heading"><div><p className="eyebrow">STUDENT ID {summary.studentId || ""}</p><h2>Academic history</h2></div></div>
    <div className="detail-grid">
      <Detail label="Advisor" value={summary.advisor} />
      <Detail label="Major" value={summary.major} />
      <Detail label="GPA" value={summary.gpa} />
      <Detail label="Completed hours" value={summary.completedHours ?? 0} />
      <Detail label="Current semester" value={summary.currentSemester} />
    </div>
    <div><div className="results-heading"><h3>Completed courses</h3><span>{completed.length}</span></div>
      {completed.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Term</th><th>Grade</th><th>Credit hours</th></tr></thead><tbody>{completed.map((item) => <tr key={item._id}><td>{courseName(item.course)}</td><td>{termName(item.term)}</td><td>{item.grade}</td><td>{item.course?.creditHours ?? "—"}</td></tr>)}</tbody></table></div> : <p className="helper-text">No completed courses recorded.</p>}</div>
    <div><div className="results-heading"><h3>Current courses</h3><span>{current.length}</span></div>
      {current.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Term</th><th>Credit hours</th></tr></thead><tbody>{current.map((item) => <tr key={item._id}><td>{courseName(item.course)}</td><td>{termName(item.term)}</td><td>{item.course?.creditHours ?? "—"}</td></tr>)}</tbody></table></div> : <p className="helper-text">No current courses recorded.</p>}</div>
    <div><div className="results-heading"><h3>Remaining courses</h3><span>{remaining.length}</span></div>
      {remaining.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Credit hours</th><th>Prerequisites</th><th>Offering season</th></tr></thead><tbody>{remaining.map((course) => <tr key={course._id}><td>{courseName(course)}</td><td>{course.creditHours ?? "—"}</td><td>{course.prerequisites?.length ? course.prerequisites.map((item) => item.name ? `${item.code} · ${item.name}` : item.code || "—").join(", ") : "None"}</td><td>{course.offeringSeasons?.length ? course.offeringSeasons.map(humanize).join(", ") : "Not specified"}</td></tr>)}</tbody></table></div> : <p className="helper-text">No remaining courses found in the catalogue for this major.</p>}</div>
  </div>;
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

function RankedTextPreference({ label, value, onChange, choices = PREFERENCE_DAYS, readOnly }) {
  const items = value.split(",").map(item => item.trim()).filter(Boolean);
  const available = choices.filter(choice => !items.includes(choice));
  const move = (index, direction) => onChange(moveRankedItem(items, index, direction).join(", "));
  const remove = index => onChange(items.filter((_, position) => position !== index).join(", "));
  return <div className="ranked-preference-field">
    <label className="field"><span>{label}</span>{!readOnly && <select aria-label={`Add ${label.toLowerCase()}`} value="" disabled={!available.length} onChange={event => { if (event.target.value) onChange([...items, event.target.value].join(", ")); }}>
      <option value="">{available.length ? choices === PREFERENCE_TIME_SLOTS ? "Choose a time slot…" : "Choose a day…" : "All options selected"}</option>
      {available.map(choice => <option key={choice} value={choice}>{choice.replace("-", "–")}</option>)}
    </select>}</label>
    <PriorityList items={items} onMove={readOnly ? undefined : move} onRemove={readOnly ? undefined : remove} />
    {!items.length && readOnly && <span className="helper-text">No preferences submitted.</span>}
  </div>;
}

function minutesToTime(value) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
