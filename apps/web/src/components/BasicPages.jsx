import { useEffect, useMemo, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { greetingName } from "../greeting.js";
import { findPreferenceConflict, preferenceConflictMessage, preferenceGroupOptions, preferenceMeetingLabel } from "../preference-groups.js";

const roleTitle = (role = "") => ({ normalStudent: "Normal student", advisingStudent: "Advising student", advisor: "Advisor", coordinator: "Coordinator", administrator: "Administrator" }[role] || role);
const humanize = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const formatDate = (value) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
const formatDateTime = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
const initials = (value = "") => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "B";

export function OverviewPage({ profile, onOpen }) {
  const isStudent = ["normalStudent", "advisingStudent"].includes(profile.role);
  const stats = isStudent
    ? [
      { label: "Student ID", value: profile.studentId || "Not assigned", icon: "#" },
      { label: "Current semester", value: profile.currentSemester || "—", icon: "◷" },
      { label: "Academic standing", value: humanize(profile.academicStanding), icon: "↗" },
      { label: "Schedule status", value: humanize(profile.scheduleStatus), icon: "▤" },
    ]
    : [
      { label: "Your role", value: roleTitle(profile.role), icon: "◉" },
      { label: "Account", value: "Active session", icon: "✓" },
      { label: "Academic term", value: "Use Academic setup", icon: "◷" },
      { label: "Notifications", value: "Check your inbox", icon: "◌" },
    ];

  return <div className="page-stack">
    <section className="welcome-banner">
      <div><p className="eyebrow">YOUR ACADEMIC WORKSPACE</p><h1>Good day, {greetingName(profile.fullName)}.</h1><p>Here’s a snapshot of your university workspace.</p></div>
      <span className="welcome-orbit orbit-a" /><span className="welcome-orbit orbit-b" /><span className="welcome-seal">B</span>
    </section>
    <section className="stat-grid" aria-label="Account summary">
      {stats.map((stat) => <article className="stat-card" key={stat.label}><span className="stat-icon">{stat.icon}</span><div><p>{stat.label}</p><strong>{stat.value}</strong></div></article>)}
    </section>
    <div className="content-grid overview-grid">
      <section className="panel quick-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK ACCESS</p><h2>Continue where you left off</h2></div><span className="panel-count">01</span></div>
        <div className="quick-links">
          <button type="button" onClick={() => onOpen("profile")}><span className="quick-icon teal">◉</span><span><strong>Review your profile</strong><small>Check your account and academic details</small></span><b>→</b></button>
          <button type="button" onClick={() => onOpen("notifications")}><span className="quick-icon violet">◌</span><span><strong>Open notifications</strong><small>See the latest updates for your account</small></span><b>→</b></button>
          {isStudent && <button type="button" onClick={() => onOpen("records")}><span className="quick-icon amber">▤</span><span><strong>View academic records</strong><small>History, transcripts, and wallet activity</small></span><b>→</b></button>}
          {!isStudent && ["coordinator", "administrator"].includes(profile.role) && <button type="button" onClick={() => onOpen("courses")}><span className="quick-icon amber">▦</span><span><strong>Manage academic setup</strong><small>Courses, terms, offerings, and templates</small></span><b>→</b></button>}
        </div>
      </section>
      <section className="panel profile-summary"><p className="eyebrow">ACCOUNT</p><div className="summary-person"><span className="avatar avatar-large">{initials(profile.fullName)}</span><div><h2>{profile.fullName}</h2><p>{roleTitle(profile.role)}</p></div></div><dl className="summary-list"><div><dt>Email</dt><dd>{profile.email}</dd></div>{profile.major && <div><dt>Major</dt><dd>{profile.major}</dd></div>}{profile.assignedAdvisor && <div><dt>Advisor</dt><dd>{profile.assignedAdvisor.fullName}</dd></div>}</dl><button className="outline-button" type="button" onClick={() => onOpen("profile")}>View profile <span>→</span></button></section>
    </div>
    <p className="page-footnote">Bobos University Scheduling System <span>·</span> Development workspace</p>
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
    } catch (requestError) { notify("error", requestError.message); }
  };

  return <div className="page-stack"><PageTitle eyebrow="YOUR INBOX" title="Notifications" description="Updates and reminders sent to your university account." action={<div className="inline-controls"><button className="outline-button" type="button" onClick={load} disabled={loading}>↻ Refresh</button>{import.meta.env.DEV && <button className="primary-button" type="button" onClick={createTest} disabled={creatingTest || loading}>{creatingTest ? "Creating…" : "Create test notification"}</button>}</div>} />
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel notification-panel" aria-busy={loading}>{loading ? <Loading /> : items.length === 0 ? <EmptyState title="You’re all caught up" text="New updates for your account will appear here." icon="◌" /> : items.map((item) => <article className={`notification-row ${item.isRead ? "read" : "unread"}`} key={item._id}><span className={`notification-symbol ${item.isRead ? "muted" : ""}`}>{item.isRead ? "✓" : "•"}</span><div className="notification-copy"><div className="notification-title"><h3>{item.title}</h3>{!item.isRead && <span className="new-pill">New</span>}</div><p>{item.message}</p><small>{formatDate(item.createdAt)} · {item.title === "Test notification" ? "Test" : humanize(item.type)}</small></div>{!item.isRead && <button className="text-button" type="button" onClick={() => markRead(item)}>Mark read</button>}</article>)}</section>
  </div>;
}

export function StudentRecordsPage({ token, profile, profileId: targetProfileId, viewerRole, subjectName, onClose, notify }) {
  const [tab, setTab] = useState("history");
  const [year, setYear] = useState("");
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
        if (!selectedYear.trim()) throw new Error("Enter an academic year, for example 2025/2026.");
        result = await api(`${base}/transcript?year=${encodeURIComponent(selectedYear.trim())}`, { token });
      }
      if (selectedTab === "failed") result = await api(`${base}/failed-courses`, { token });
      if (selectedTab === "wallet") result = await api(`${base}/wallet`, { token });
      setData(result);
    } catch (requestError) { setError(explainApiError(requestError, "Academic records")); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (profileId) load(tab, year); }, [tab, profileId]);

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
    <div className="tab-bar" role="tablist" aria-label="Academic records">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? "selected" : ""} key={item} onClick={() => setTab(item)}>{({ history: "History", transcript: "Transcript", failed: "Failed courses", wallet: "Wallet" })[item]}</button>)}</div>
    {tab === "transcript" && <div className="inline-controls"><label className="field compact-field"><span>Academic year</span><input value={year} onChange={(event) => setYear(event.target.value)} placeholder="2025/2026" /></label><button className="primary-button" type="button" onClick={() => load("transcript", year)}>View transcript</button><button className="outline-button" type="button" onClick={download}>Download PDF ↓</button></div>}
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel" aria-busy={loading}>{loading ? <Loading /> : data ? <RecordData data={data} tab={tab} /> : !error && <EmptyState title="Select a record" text="Choose a record type to load your information." icon="▤" />}</section>
  </div>;
}

export function PreferencesPage({ token, profile, profileId: passedProfileId, studentTarget, notify }) {
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
    setGroups([]); setOfferings([]); setPreferencesLoaded(false); setHasSubmittedPreferences(false); setLastUpdatedAt(null); setSelectionError(""); setError("");
  };

  const termQuery = termId ? `?term=${encodeURIComponent(termId)}` : "";
  const load = async (selectedTermId = termId) => {
    if (!effectiveId) { setError(isStudent ? "Your student profile is not available." : "Find and select a student before loading preferences."); return; }
    setLoading(true); setError(""); setSelectionError("");
    try {
      const selectedTermQuery = selectedTermId ? `?term=${encodeURIComponent(selectedTermId)}` : "";
      const result = await api(`/api/identity/students/${encodeURIComponent(effectiveId)}/preferences${selectedTermQuery}`, { token });
      const current = result.preferences || {};
      setPreferencesLoaded(true);
      setHasSubmittedPreferences(Boolean(result.submitted));
      setLastUpdatedAt(result.lastUpdatedAt || null);
      setPreferredDays((current.preferredDays || []).map((entry) => entry.day).join(", "));
      setAvoidedDays((current.avoidedDays || []).map((entry) => entry.day).join(", "));
      setDaysOff((current.desiredDaysOff || []).map((entry) => entry.day).join(", "));
      setPreferredTimes((current.preferredTimes || []).map((entry) => `${minutesToTime(entry.startMinute)}-${minutesToTime(entry.endMinute)}`).join(", "));
      setAvoidedTimes((current.avoidedTimes || []).map((entry) => `${minutesToTime(entry.startMinute)}-${minutesToTime(entry.endMinute)}`).join(", "));
      setNote(current.note || "");
      setGroups((current.preferredGroups || []).map((entry) => ({ course: entry.course?._id || entry.course, componentType: entry.componentType, groupNumber: entry.groupNumber })));
      if (selectedTermId) {
        const available = await api(`/api/catalogue/offerings?termId=${encodeURIComponent(selectedTermId)}&publishedOnly=true`, { token });
        setOfferings(available.offerings || []);
      } else setOfferings([]);
      setSelectionError("");
    } catch (requestError) { setError(explainApiError(requestError, "Scheduling preferences")); }
    finally { setLoading(false); }
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
    setSaving(true); setError("");
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

  return <div className="page-stack"><PageTitle eyebrow="GROUP A · REQUIREMENTS 57–58" title={isStudent ? "Schedule preferences" : "Student preferences"} description={isStudent ? "Share ranked scheduling preferences as optional hints. Academic rules, prerequisites, seats, and payments still govern the final schedule." : selectedStudent ? `View ${selectedStudent.user?.fullName || selectedStudent.studentId}’s latest submitted scheduling preferences.` : "Search for an advising student to view their latest scheduling preferences."} />
    <section className="panel preference-toolbar">
      {!isStudent && <>
        <form className="preference-student-lookup" onSubmit={findStudent}>
          <label className="field"><span>Find advising student</span><input value={studentSearch} onChange={(event) => { setStudentSearch(event.target.value); setSelectedStudent(null); setStudentMatches([]); resetLoadedPreferences(); }} placeholder="Student ID, name, or email" disabled={studentLookupLoading} /></label>
          <button className="outline-button" type="submit" disabled={studentLookupLoading}>{studentLookupLoading ? "Searching…" : "Find student"}</button>
        </form>
        {selectedStudent && <div className="preference-student-selected" role="status"><strong>{selectedStudent.user?.fullName || "Selected student"}</strong><span>{selectedStudent.studentId || "Student profile"}{selectedStudent.user?.email ? ` · ${selectedStudent.user.email}` : ""}</span><button className="text-button" type="button" onClick={() => { setSelectedStudent(null); setStudentSearch(""); setStudentMatches([]); resetLoadedPreferences(); }}>Change</button></div>}
        {studentMatches.length > 0 && <div className="preference-student-results" aria-label="Matching students">{studentMatches.map((student) => <button className="preference-student-result" key={student._id} type="button" onClick={() => { setSelectedStudent(student); setStudentSearch(student.studentId); setStudentMatches([]); resetLoadedPreferences(); }}><strong>{student.studentId} · {student.user?.fullName || "Student"}</strong><span>{student.user?.email || student.major || "Advising student"}</span></button>)}</div>}
      </>}
      <label className="field"><span>Academic term</span><select value={termId} onChange={(event) => { setTermId(event.target.value); resetLoadedPreferences(); }} disabled={termsLoading || terms.length === 0}><option value="">{termsLoading ? "Loading terms…" : "Select a term"}</option>{terms.map((term) => <option key={term._id} value={term._id}>{term.code} · {term.academicYear} · {humanize(term.season)}{term.isActive ? " (Active)" : ""}</option>)}</select></label>
      <button type="button" className="outline-button" onClick={() => load()} disabled={loading || termsLoading}>{loading ? "Loading…" : termsLoading ? "Loading terms…" : "Load saved preferences"}</button>
    </section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {preferencesLoaded && <div className={`feedback ${hasSubmittedPreferences ? "info" : "warning"}`} role="status">{hasSubmittedPreferences ? `Latest submission${formatDateTime(lastUpdatedAt) ? ` · last updated ${formatDateTime(lastUpdatedAt)}` : ""}.` : "No preferences were submitted for this term. The student can still receive a schedule."}</div>}
    <form onSubmit={isStudent ? save : (event) => event.preventDefault()} className="preference-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">DAY PREFERENCES</p><h2>Ranked day hints</h2></div><span className="panel-count">01</span></div><p className="helper-text">{isStudent ? "Enter full weekday names separated by commas. The order sets priority." : "Comma-separated values are shown in priority order."}</p><label className="field"><span>Preferred days{isStudent ? "" : " · priority order"}</span><input value={preferredDays} onChange={(event) => setPreferredDays(event.target.value)} placeholder="Monday, Wednesday" readOnly={!isStudent} /></label><label className="field"><span>Days to avoid{isStudent ? "" : " · priority order"}</span><input value={avoidedDays} onChange={(event) => setAvoidedDays(event.target.value)} placeholder="Friday" readOnly={!isStudent} /></label><label className="field"><span>Desired days off{isStudent ? "" : " · priority order"}</span><input value={daysOff} onChange={(event) => setDaysOff(event.target.value)} placeholder="Thursday" readOnly={!isStudent} /></label></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">TIME PREFERENCES</p><h2>Preferred time ranges</h2></div><span className="panel-count">02</span></div><p className="helper-text">{isStudent ? "Use 24-hour times, such as 09:00-12:00. Separate ranges with commas." : "Ranges are shown in priority order (24-hour time)."}</p><label className="field"><span>Preferred times{isStudent ? "" : " · priority order"}</span><input value={preferredTimes} onChange={(event) => setPreferredTimes(event.target.value)} placeholder="09:00-12:00, 13:00-15:00" readOnly={!isStudent} /></label><label className="field"><span>Times to avoid{isStudent ? "" : " · priority order"}</span><input value={avoidedTimes} onChange={(event) => setAvoidedTimes(event.target.value)} placeholder="08:00-09:00" readOnly={!isStudent} /></label><label className="field"><span>Note for advising staff</span><textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Optional note (up to 1000 characters)" readOnly={!isStudent} /></label></section>
      <section className="panel preference-groups"><div className="panel-heading"><div><p className="eyebrow">COURSE GROUPS</p><h2>Preferred groups</h2></div><span className="panel-count">03</span></div><p className="helper-text">{isStudent ? `${offerings.length ? `${offerings.length} subjects loaded. ` : ""}Choose a term above, then load its published groups. Each option shows its meeting day, time, and room. Click groups to rank them; selections across different subjects cannot overlap.` : "Selected groups are listed in priority order with their meeting time and room when currently published."}</p>{conflictMessage && <div ref={conflictNoticeRef} className="feedback error preference-conflict-feedback" role="alert" aria-live="assertive">{conflictMessage}</div>}{isStudent ? (offerings.length === 0 ? <button className="outline-button" type="button" onClick={() => load()} disabled={loading || !termId || !effectiveId}>{loading ? "Loading…" : "Load published groups"}</button> : offerings.map((offering) => <div className="preference-offering" key={offering._id}><strong>{offering.course?.code} · {offering.course?.name}</strong><div className="group-chip-list">{preferenceGroupOptions(offering).map((option) => { const courseId = String(offering.course?._id || offering.course); const groupIndex = groups.findIndex((group) => String(group.course?._id || group.course) === courseId && group.componentType === option.componentType && group.groupNumber === option.groupNumber); const checked = groupIndex !== -1; return <button type="button" aria-pressed={checked} className={`group-chip ${checked ? "selected" : ""}`} key={`${option.componentType}-${option.groupNumber}`} onClick={() => toggleGroup(offering, option)}><strong>{option.componentType} {option.groupNumber}{checked && ` · #${groupIndex + 1}`}</strong><small>{option.sessions.map(preferenceMeetingLabel).join(" / ")}</small></button>; })}</div></div>)) : groups.length ? groups.map((group, index) => { const offering = offerings.find((item) => String(item.course?._id || item.course) === String(group.course)); const option = offering && preferenceGroupOptions(offering).find((item) => item.componentType === group.componentType && item.groupNumber === group.groupNumber); return <div className="preference-offering" key={`${group.course}-${group.componentType}-${group.groupNumber}`}><strong>Priority #{index + 1} · {offering?.course?.code || "Course"} {offering?.course?.name ? `· ${offering.course.name}` : ""}</strong><div className="group-chip-list"><span className="group-chip selected"><strong>{group.componentType} {group.groupNumber}</strong><small>{option?.sessions.map(preferenceMeetingLabel).join(" / ") || "This group is no longer published for the term."}</small></span></div></div>; }) : preferencesLoaded && <p className="helper-text">No preferred course groups were submitted.</p>}</section>
      <div className="form-footer">{isStudent ? <><span className="helper-text">Submitting replaces this term’s saved preferences.</span><button className="primary-button" disabled={saving || Boolean(groupConflict)}>{saving ? "Saving…" : "Save preferences"}<span>→</span></button></> : <span className="helper-text">Advisor/coordinator view only. Students submit and update their own preferences.</span>}</div>
    </form>
  </div>;
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
    return <><div className="wallet-balance"><div><p>Available balance</p><strong>{Number(data.balance || 0).toLocaleString()} <small>{data.currency || "EGP"}</small></strong></div><span>EGP</span></div><h2 className="section-heading">Transactions</h2>{txns.length ? <div className="table-scroll"><table><thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Reference</th></tr></thead><tbody>{txns.map((txn) => <tr key={txn._id}><td>{humanize(txn.kind)}</td><td>{Number(txn.amount || 0).toLocaleString()} {data.currency || "EGP"}</td><td><span className={`status-pill ${txn.status === "succeeded" ? "good" : "muted"}`}>{humanize(txn.status)}</span></td><td>{formatDate(txn.occurredAt || txn.createdAt)}</td><td>{txn.reference || txn._id}</td></tr>)}</tbody></table></div> : <EmptyState title="No transactions yet" text="Wallet activity will appear here." />}</>;
  }
  if (tab === "failed") {
    const records = Array.isArray(data) ? data : [];
    return records.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Term</th><th>Attempt</th><th>Attendance</th><th>Result</th><th>Grade</th></tr></thead><tbody>{records.map((item) => <tr key={item._id}><td><strong>{item.course?.code || "—"}</strong><span className="secondary-text">{item.course?.name}</span></td><td>{item.term?.code || "—"}</td><td>{item.attemptNumber || "—"}</td><td>{humanize(item.attendance)}</td><td>{humanize(item.result)}</td><td>{item.grade || "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No failed or unattended courses" text={data.message || "There are no records to display."} icon="✓" />;
  }
  if (tab === "transcript") {
    const terms = data.terms || {};
    const courses = Object.entries(terms).flatMap(([name, rows]) => (rows || []).map((entry) => ({ ...entry, termLabel: humanize(name) })));
    return <><div className="results-heading"><div><p className="eyebrow">ACADEMIC YEAR {data.year}</p><h2>Yearly transcript</h2></div><span>{courses.length} course attempts</span></div>{courses.length ? <div className="table-scroll"><table><thead><tr><th>Term</th><th>Course</th><th>Credits</th><th>Grade</th><th>Result</th><th>Attendance</th></tr></thead><tbody>{courses.map((row, index) => <tr key={row._id || `${row.termLabel}-${index}`}><td>{row.termLabel}</td><td><strong>{row.course?.code || "—"}</strong><span className="secondary-text">{row.course?.name}</span></td><td>{row.course?.creditHours ?? "—"}</td><td>{row.grade || "—"}</td><td>{humanize(row.result)}</td><td>{humanize(row.attendance)}</td></tr>)}</tbody></table></div> : <EmptyState title="No transcript courses for this year" text="Choose a different academic year to view another transcript." />}</>;
  }
  const completed = data.completedCourses || [];
  const current = data.currentCourses || [];
  const remaining = data.remainingCourses || [];
  const all = [...completed.map((item) => ({ ...item, state: "Completed" })), ...current.map((item) => ({ ...item, state: "In progress" })), ...remaining.map((item) => ({ ...item, state: "Remaining" }))];
  return <><div className="results-heading"><div><p className="eyebrow">STUDENT ID {data.studentId || ""}</p><h2>Academic history</h2></div>{data.currentSemester && <span>Semester {data.currentSemester}</span>}</div>{all.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Status</th><th>Term</th><th>Grade</th><th>Credits</th></tr></thead><tbody>{all.map((item, index) => <tr key={item._id || `${item.course?.code}-${index}`}><td><strong>{item.course?.code || item.code || "—"}</strong><span className="secondary-text">{item.course?.name || item.name || ""}</span></td><td>{item.state}</td><td>{item.term?.code || item.term?.season || "—"}</td><td>{item.grade || "—"}</td><td>{item.course?.creditHours ?? item.creditHours ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No academic history found" text="Your course history will appear here when records are available." />}</>;
}

function parseDays(value) {
  const days = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (new Set(days).size !== days.length) throw new Error("Remove duplicate weekday entries.");
  return days.map((day, index) => ({ day, priority: index + 1 }));
}
function parseTimes(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).map((range, index) => {
    const parts = range.split("-").map((part) => part.trim());
    if (parts.length !== 2) throw new Error("Use time ranges like 09:00-12:00.");
    return { startMinute: timeToMinutes(parts[0]), endMinute: timeToMinutes(parts[1]), priority: index + 1 };
  });
}
function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}. Use HH:MM.`);
  const hours = Number(match[1]); const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) throw new Error(`Invalid time: ${value}.`);
  return hours * 60 + minutes;
}
function minutesToTime(value) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
