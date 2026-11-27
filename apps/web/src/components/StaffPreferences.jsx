import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { minutesToTime, preferenceGroupOptions, preferenceMeetingLabel } from "../preference-groups.js";
import { termLabel } from "../term-label.js";
import { StudentIdentity } from "./CoordinatorRecords.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";

const updatedAtFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
const studentProfileId = (student) => student?._id || student?.id || student?.profileId || student?.studentProfileId || "";
const studentName = (student) => student.user?.fullName || student.fullName || "Student";
const studentEmail = (student) => student.user?.email || student.email;
const formatWindow = ({ startMinute, endMinute }) => `${minutesToTime(startMinute)}–${minutesToTime(endMinute)}`;
const teachingDays = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

export default function StaffPreferences({ token, profile, profileId, studentTarget, onOpenDraftSchedule }) {
  const [selectedStudent, setSelectedStudent] = useState(studentTarget || (profileId ? { _id: profileId } : null));
  const [search, setSearch] = useState(studentTarget?.studentId || "");
  const [matches, setMatches] = useState([]);
  const [resultVersion, setResultVersion] = useState(0);
  const [linkedStudentPending, setLinkedStudentPending] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !studentTarget && !profileId && Boolean(params.get("student")?.trim() && params.get("term"));
  });
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [animateSearch, setAnimateSearch] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [terms, setTerms] = useState([]);
  const [termId, setTermId] = useState("");
  const [termsLoading, setTermsLoading] = useState(true);
  const [termError, setTermError] = useState("");
  const [termAttempt, setTermAttempt] = useState(0);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState("");
  const bookmark = useRef(new URLSearchParams(window.location.search));
  const studentSearch = useRef(null);
  const termSelect = useRef(null);
  const lookupRequest = useRef(null);
  const preferenceRequest = useRef(null);
  const selectedTerm = terms.find((term) => term._id === termId);
  const selectedId = studentProfileId(selectedStudent);
  const advisor = profile.role === "advisor";
  const canLoad = Boolean(selectedId && selectedTerm);
  const canOpenDraft = canLoad && ["advisor", "coordinator"].includes(profile.role) &&
    (selectedStudent.studentType === "advising" || Boolean(studentTarget?._id));

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setTermsLoading(true);
    setTermError("");
    api("/api/academic-terms/academicTerm", { token, signal }).then((result) => {
      if (signal.aborted) return;
      const rows = Array.isArray(result) ? result : [];
      setTerms(rows);
      setTermId((current) => current || rows.find((term) => term.isActive)?._id || "");
    }).catch((error) => {
      if (!signal.aborted) setTermError(explainApiError(error, "Academic terms"));
    }).finally(() => {
      if (!signal.aborted) setTermsLoading(false);
    });
    return () => controller.abort();
  }, [termAttempt, token]);

  useEffect(() => () => {
    lookupRequest.current?.abort();
    preferenceRequest.current?.abort();
  }, []);

  function clearRecord() {
    preferenceRequest.current?.abort();
    setLoading(false);
    setRecord(null);
    setReadError("");
  }

  const load = useCallback(async (id, term) => {
    preferenceRequest.current?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    preferenceRequest.current = controller;
    setLoading(true);
    setReadError("");
    try {
      const result = await api(`/api/identity/students/${encodeURIComponent(id)}/preferences?term=${encodeURIComponent(term)}`, { token, signal });
      let offerings = [];
      if (result.preferences?.preferredGroups?.length) {
        try {
          const available = await api(`/api/catalogue/offerings?termId=${encodeURIComponent(term)}&publishedOnly=true`, { token, signal });
          offerings = available.offerings || [];
        } catch {
          offerings = null;
        }
      }
      if (!signal.aborted) setRecord({ ...result, offerings });
    } catch (error) {
      if (!signal.aborted) setReadError(explainApiError(error, "Scheduling preferences"));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token]);

  const findStudent = useCallback(async (query, { linked = false, term = "" } = {}) => {
    lookupRequest.current?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    lookupRequest.current = controller;
    setSearching(true);
    setLookupError("");
    setMatches([]);
    try {
      let data;
      if (!query && advisor) {
        const params = term ? `?termId=${encodeURIComponent(term)}` : "";
        const { students = [] } = await api(`/api/schedules/students${params}`, { token, signal });
        data = students.filter(student => student.isActive).sort((a, b) => studentName(a).localeCompare(studentName(b)));
      } else {
        const params = new URLSearchParams({ limit: "100" });
        if (query) params.set("search", query);
        ({ data = [] } = await api(`/api/advisor/students?${params}`, { token, signal }));
      }
      if (signal.aborted) return;
      const exact = query && data.find((student) => String(student.studentId).toLowerCase() === query.toLowerCase());
      if (exact) {
        setSelectedStudent(exact);
        setSearch(exact.studentId);
        if (!linked) requestAnimationFrame(() => termSelect.current?.focus());
      } else if (linked) {
        setLookupError("The linked advising student is unavailable.");
      } else if (data.length) {
        setMatches(data);
        setResultVersion(version => version + 1);
        setSearched(true);
      } else if (!query) {
        setLookupError(advisor ? "No active advising students are assigned to you." : "No advising students are available.");
      } else {
        setLookupError(`No advising student matched “${query}”.`);
      }
    } catch (error) {
      if (!signal.aborted) setLookupError(explainApiError(error, "Student lookup"));
    } finally {
      if (!signal.aborted) setSearching(false);
    }
  }, [advisor, token]);

  useEffect(() => {
    if (studentTarget || profileId || termsLoading || termError || !bookmark.current) return;
    const bookmarkParams = bookmark.current;
    bookmark.current = null;
    const student = bookmarkParams.get("student")?.trim();
    const termKey = bookmarkParams.get("term");
    if (!student || !termKey) return;
    const term = terms.find(({ _id, code }) => _id === termKey || code === termKey);
    if (!term) {
      setReadError("The linked academic term is unavailable.");
      setLinkedStudentPending(false);
      return;
    }
    setTermId(term._id);
    setSearch(student);
    findStudent(student, { linked: true }).finally(() => setLinkedStudentPending(false));
  }, [findStudent, profileId, studentTarget, termError, terms, termsLoading]);

  useEffect(() => {
    if (selectedId && termId) load(selectedId, termId);
    return () => preferenceRequest.current?.abort();
  }, [load, selectedId, termId]);

  function changeTerm(event) {
    const nextTermId = event.target.value;
    if (nextTermId === termId) return;
    clearRecord();
    setTermId(nextTermId);
  }

  function changeStudent() {
    lookupRequest.current?.abort();
    setSearching(false);
    setMatches([]);
    setSelectedStudent(null);
    setSearch("");
    setSearched(false);
    setAnimateSearch(false);
    setLookupError("");
    clearRecord();
    requestAnimationFrame(() => studentSearch.current?.focus());
  }

  function submitLookup(event) {
    event.preventDefault();
    if (searching) return;
    setAnimateSearch(true);
    findStudent(search.trim(), { term: termId });
  }

  function editLookup(event) {
    lookupRequest.current?.abort();
    setSearching(false);
    setSearch(event.target.value);
    setMatches([]);
    setLookupError("");
  }

  function selectMatch(student) {
    clearRecord();
    setSelectedStudent(student);
    setSearch(student.studentId);
    setMatches([]);
    requestAnimationFrame(() => termSelect.current?.focus());
  }

  const searchStage = !selectedStudent && !linkedStudentPending;
  const resultsHeading = search.trim() ? "Matching students" : advisor ? "Assigned students" : "Advising students";
  const resultCount = `${matches.length} ${matches.length === 1 ? "student" : "students"}`;
  const waitingForRecord = !readError && (loading || (canLoad && !record));
  const waitingForSelection = !termError && (linkedStudentPending || (selectedId && termsLoading));
  const noSubmission = record && (!record.submitted || !record.preferences);
  const draftAction = canOpenDraft && <button className="outline-button" type="button"
    onClick={() => onOpenDraftSchedule?.({ ...selectedStudent, fullName: studentName(selectedStudent) }, selectedTerm.code || termId)}>
    Create or update draft schedule <span aria-hidden="true">→</span>
  </button>;
  return <div className="page-stack schedule-preferences-page staff-preferences"
    data-student-lookup={searchStage ? (searched ? "active" : "entry") : undefined}
    data-search-motion={animateSearch || undefined} data-searching={searching || undefined}>
    <div className={searchStage ? "preference-search-masthead" : "page-title-row"}><div>
      {searchStage && <div className="preference-search-art"><SearchMagnifier /></div>}
      <h1>Student preferences</h1>
      {searchStage && <p>Find an advising student to read their saved preferences for the term.</p>}
    </div></div>
    <section className="preference-context" data-selected={Boolean(selectedStudent) || undefined} aria-label="Student and term">
      <div className="preference-identify">
        {selectedStudent ? <div className="preference-student-selected">
          <StudentIdentity name={studentName(selectedStudent)} id={selectedStudent.studentId} email={studentEmail(selectedStudent)} />
          <button className="outline-button preference-change" type="button" onClick={changeStudent}>Change student</button>
        </div> : linkedStudentPending ? <p className="preference-read-progress" role="status">Opening linked student…</p> : <>
          <form className="preference-student-lookup" onSubmit={submitLookup}>
            <label className="field"><span>Find advising student</span><input ref={studentSearch} type="search" autoComplete="off" value={search} onChange={editLookup} placeholder="Student ID, name, or email" /></label>
            <button className="primary-button" type="submit" aria-disabled={searching || undefined}>{searching ? "Searching…" : "Find student"}</button>
          </form>
          {lookupError && <p className="feedback error" role="alert">{lookupError}</p>}
        </>}
      </div>
      <div className="preference-term">
        <label className="field"><span>Academic term</span><select ref={termSelect} value={termId} onChange={changeTerm} disabled={termsLoading || terms.length === 0}>
            <option value="">{termsLoading ? "Loading terms…" : terms.length ? "Select a term" : "No terms available"}</option>
            {terms.map((term) => <option key={term._id} value={term._id}>{termLabel(term)}{term.isActive ? " (Active)" : ""}</option>)}
          </select></label>
        {termError && <div className="preference-read-error"><p className="feedback error" role="alert">{termError}</p><button className="outline-button" type="button" onClick={() => setTermAttempt((attempt) => attempt + 1)}>Retry terms</button></div>}
      </div>
    </section>
    {searchStage && <span className="preference-sr" role="status">{searching ? "Searching for advising students…" : matches.length ? `${resultsHeading}. ${resultCount}.` : ""}</span>}
    {matches.length > 0 && <section key={resultVersion} className="preference-lookup-results">
      <header className="preference-reading-heading"><h2>{resultsHeading}</h2><p>{resultCount}</p></header>
      <ul className="preference-student-results" role="list" aria-label={resultsHeading}>
        {matches.map((student, index) => <li key={studentProfileId(student)} style={{ "--arrival-delay": `${Math.min(index, 7) * 23}ms` }}>
          <button type="button" className="preference-student-result" onClick={() => selectMatch(student)} aria-label={`View preferences for ${studentName(student)}`}>
            <StudentIdentity name={studentName(student)} id={student.studentId} email={studentEmail(student)} />
            <span className="preference-result-action" aria-hidden="true">View preferences</span>
          </button>
        </li>)}
      </ul>
    </section>}
    <section className="preference-reading" aria-label="Submitted preferences">
      {(readError || waitingForRecord || (waitingForSelection && selectedId)) && <div className="preference-read-error">
        {!readError ? <p className="preference-read-progress" role="status">{record ? "Refreshing saved preferences…" : "Loading saved preferences…"}</p> : <>
          <p className="feedback error" role="alert">{readError}</p>
          {canLoad && <button className="outline-button" type="button" onClick={() => load(selectedId, termId)}>Retry</button>}
        </>}
      </div>}
      {record ? noSubmission ? <PreferenceEmpty title="No preferences submitted">
        <p>{draftAction ? `You can still plan ${studentName(selectedStudent)}’s schedule for ${termLabel(selectedTerm)}.` :
          `${studentName(selectedStudent)} hasn’t shared preferences for ${termLabel(selectedTerm)}.`}</p>
        {draftAction && <div className="preference-empty-action">{draftAction}</div>}
      </PreferenceEmpty> : <PreferenceSubmission preferences={record.preferences} offerings={record.offerings} updatedAt={record.lastUpdatedAt} weekMap /> :
        selectedStudent && !waitingForRecord && !waitingForSelection && !termsLoading && !canLoad && !readError && !termError &&
        <PreferenceEmpty title="Choose an academic term">
          <p>Select a term to check whether this student submitted preferences.</p>
        </PreferenceEmpty>}
      {draftAction && !noSubmission && <footer className="preference-draft-handoff">{draftAction}</footer>}
    </section>
  </div>;
}

function SearchMagnifier() {
  return <svg viewBox="0 0 132 104" width="132" height="104" fill="none" stroke="#554b3d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 89q43 8 107 0" stroke="#9a907f" strokeWidth="1.2" />
    <path d="m20 38 45-11 17 14 5 36-57 9Z" fill="#a8bbb0" />
    <path d="m17 31 44-10 18 14 6 37-57 10Z" fill="#efe3c7" />
    <path d="m61 21 3 17 15-3Z" fill="#d1bfa0" />
    <path d="m27 49 31-7m-29 16 24-5m-21 15 27-6" stroke="#87775f" />
    <g className="preference-search-lens">
      <path d="m90 58 10 11 6-5-11-12Z" fill="#c5a77e" />
      <path d="M101 64q3-3 7 0l14 16q4 5-1 8-4 3-8-2l-15-15q-2-3 3-7Z" fill="#ba8466" />
      <path d="m105 71 12 13" stroke="#f0c4a1" />
      <path d="M100 38c1 14-10 24-23 24S53 52 53 38s10-24 23-24c14-1 24 10 24 24Z" fill="#d4b078" />
      <path d="M94 38c0 10-7 18-17 18s-18-8-18-18 8-18 18-18 17 8 17 18Z" fill="#a9c4cd" />
      <path d="M64 36q2-8 10-11m-11 15v2" stroke="#f5ebd3" strokeWidth="2.6" />
    </g>
  </svg>;
}

function PreferenceEmpty({ title, children }) {
  return <div className="preference-empty">
    <img src="/portal-studio/images/submitted-plan.svg" width="88" height="68" alt="" />
    <div className="preference-empty-copy"><h2>{title}</h2>{children}</div>
  </div>;
}

export function PreferenceSubmission({ preferences, offerings, updatedAt, title = "Scheduling priorities", draft = false, weekMap = false }) {
  const { preferredDays, avoidedDays, desiredDaysOff, preferredTimes, avoidedTimes, preferredGroups, note } = preferences;
  return <div className="preference-submission">
    <header className="preference-reading-heading"><h2>{title}</h2></header>
    {weekMap ? <PreferenceWeek preferences={preferences} /> : <table className="preference-priorities" aria-label="Scheduling priorities">
      <thead><tr><th scope="col">Preference</th><th scope="col">Weekdays</th><th scope="col">Teaching times</th></tr></thead>
      <tbody>
        <PriorityRow title="Preferred" kind="good" dayLabel="Preferred days" days={preferredDays} timeLabel="Preferred times" times={preferredTimes} />
        <PriorityRow title="To avoid" kind="danger" dayLabel="Days to avoid" days={avoidedDays} timeLabel="Times to avoid" times={avoidedTimes} />
        <PriorityRow title="Days off" dayLabel="Desired days off" days={desiredDaysOff} />
      </tbody>
    </table>}
    <section className="preference-note-detail" data-has-note={Boolean(note) || undefined}>
      <h3>{note && <img src="/portal-studio/images/submitted-plan.svg" alt="" width="40" height="31" />}Student note</h3>
      {note ? <blockquote className="preference-note-text">{note}</blockquote> : <p className="preference-missing">No note submitted.</p>}
    </section>
    <section className="preference-group-register">
      <h3>Preferred course groups</h3>
      {preferredGroups?.length ? <table className="preferred-group-reading" aria-label="Preferred course groups, highest priority first">
        <thead><tr><th scope="col">Course</th><th scope="col">Group</th><th scope="col">Priority</th></tr></thead>
        <tbody>
        {preferredGroups.map(({ course, componentType, groupNumber, priority }, index) => {
          const offering = offerings?.find((item) => String(item.course?._id || item.course) === String(course?._id || course));
          const groups = offering?.groups || (offering && preferenceGroupOptions(offering));
          const option = groups?.find((item) => item.componentType === componentType && item.groupNumber === groupNumber);
          const sessions = option?.sessions || option?.slots || [];
          const identity = course?.code ? course : offering?.course;
          return <tr key={`${course?._id || course}-${componentType}-${groupNumber}-${index}`}>
            <td><div className="preference-group-course">
              <OfferingCourseIcon code={identity?.code} />
              <div><strong>{identity?.name || identity?.code || "Course"}</strong>{identity?.code && <small>{identity.code}</small>}</div>
            </div></td>
            <td className="preference-group-detail">
              <strong className="preference-group-type">{componentType} {groupNumber}</strong>
              {option ? sessions.map((session, position) => <small key={session._id || position}>{session.startTime ? [session.day, `${session.startTime}–${session.endTime}`, session.room].filter(Boolean).join(" · ") : preferenceMeetingLabel(session)}</small>) : <small>{offerings && !draft ? "Group is no longer published" : "Meeting details are unavailable"}</small>}
            </td>
            <td>{priority ?? index + 1}</td>
          </tr>;
        })}
        </tbody>
      </table> : <p className="preference-missing">No preferred course groups.</p>}
    </section>
    {updatedAt && <p className="preference-submitted-at">Last updated <time dateTime={updatedAt}>{updatedAtFormat.format(new Date(updatedAt))} Cairo</time></p>}
  </div>;
}

function PreferenceWeek({ preferences }) {
  const detailsId = useId();
  const [pickedDay, setPickedDay] = useState("");
  const dayPreferences = [
    { label: "Preferred", kind: "good", items: preferences.preferredDays || [] },
    { label: "To avoid", kind: "danger", items: preferences.avoidedDays || [] },
    { label: "Day off", kind: "off", items: preferences.desiredDaysOff || [] },
  ];
  const extraDays = new Set(dayPreferences.flatMap(({ items }) => items.map(({ day }) => day)).filter(day => !teachingDays.includes(day)));
  const days = [...teachingDays, ...extraDays];
  const requests = Object.fromEntries(days.map(day => [day, dayPreferences.flatMap(({ label, kind, items }) => items.flatMap((item, index) =>
    item.day === day ? [{ label, kind, priority: item.priority ?? index + 1 }] : []))]));
  const activeDay = days.includes(pickedDay) ? pickedDay : days.find(day => requests[day].length) || days[0];
  return <div className="preference-week-layout">
    <section className="preference-week-shape" aria-label="The shape of the week">
      <h3>The shape of the week</h3>
      <ul className="preference-week-days" data-seventh-day={days.length > 6 || undefined} role="list" aria-label="Teaching week">
        {days.map(day => <li key={day}>
          <button className="preference-week-day" type="button" aria-pressed={day === activeDay} aria-controls={detailsId} onClick={() => setPickedDay(day)}>
            <strong>{day}</strong>
            {requests[day].length ? requests[day].map(({ label, kind, priority }, index) => <span className="preference-week-intent" key={`${kind}-${index}`}>
              <PreferenceIntent kind={kind} label={label} />
              <span className="preference-week-rank">Priority #{priority}</span>
            </span>) : <span className="preference-week-intent is-neutral"><span className="preference-week-neutral" aria-hidden="true">–</span><span>No preference</span></span>}
          </button>
        </li>)}
      </ul>
      <div id={detailsId} className="preference-day-reading" aria-live="polite">
        <h4>{activeDay}</h4>
        {requests[activeDay].length ? requests[activeDay].map(({ label, kind, priority }, index) => <span className="preference-day-reading-request" key={`${kind}-${index}`}>
          <PreferenceIntent kind={kind} label={label} /><small>Priority #{priority}</small>
        </span>) : <p className="preference-missing">No day preference submitted.</p>}
      </div>
    </section>
    <section className="preference-week-times" aria-label="Teaching times">
      <h3>Teaching times</h3>
      <div className="preference-time-strips">
        {[
          { label: "Prefer", kind: "good", listLabel: "Preferred times", items: preferences.preferredTimes || [] },
          { label: "To avoid", kind: "danger", listLabel: "Times to avoid", items: preferences.avoidedTimes || [] },
        ].map(({ label, kind, listLabel, items }) => <div className="preference-time-strip" key={kind}>
          <h4><PreferenceIntent kind={kind} label={label} /></h4>
          <RankedChoices label={listLabel} items={items} format={formatWindow} />
        </div>)}
      </div>
    </section>
  </div>;
}

function PreferenceIntent({ kind, label }) {
  return kind === "off" ? <span className="preference-off-label"><DayOffCup />{label}</span>
    : <span className={`status-pill ${kind}`}>{label}</span>;
}

// The day-off cup follows the free day in Portal’s teaching week.
function DayOffCup() {
  return <svg className="preference-day-off-cup" viewBox="8 3 70 58" fill="none" stroke="#504339" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path fill="#d6bd9f" d="M13 52c5-5 23-7 43-5 11 1 18 3 19 6-1 4-18 7-35 6-14 0-26-2-27-7Z"/>
    <path fill="#faf0d8" d="M18 51c12-4 34-4 49 1-4 4-34 7-49-1Z"/>
    <path fill="#a7c3bc" fillRule="evenodd" d="M55 33c13-8 20-2 16 6-2 5-8 8-17 7l1-13Zm3 3-1 6c5 0 9-2 10-5 1-3-3-4-9-1Z"/>
    <path fill="#adc8c0" d="M22 30q18-5 37 0c-1 12-3 22-16 24-14 2-20-8-21-24Z"/>
    <ellipse cx="40.5" cy="30" rx="18.5" ry="5.4" fill="#f6ecd6"/><ellipse cx="40.5" cy="30.4" rx="15.8" ry="3.3" fill="#705044" stroke="none"/>
    <path stroke="currentColor" d="M35 23c-7-7 7-9 2-16m9 14c-3-5 5-6 4-12"/>
  </svg>;
}

function PriorityRow({ title, kind, dayLabel, days = [], timeLabel, times = [] }) {
  return <tr>
    <th scope="row">{kind ? <span className={`status-pill ${kind}`}>{title}</span>
      : <span className="preference-off-label"><DayOffCup />{title}</span>}</th>
    <td><RankedChoices label={dayLabel} items={days} format={item => item.day} /></td>
    <td>{timeLabel ? <RankedChoices label={timeLabel} items={times} format={formatWindow} /> : <span className="preference-inapplicable" aria-label="Not applicable">—</span>}</td>
  </tr>;
}

function RankedChoices({ label, items, format }) {
  if (!items.length) return <span className="preference-missing">None specified</span>;
  return <ol className="preference-choices" role="list" aria-label={label + ", highest priority first"}>
    {items.map((item, index) => <li key={format(item)}>
      <span>{format(item)}</span>
      <small title={`Priority ${item.priority ?? index + 1}`}><span className="preference-sr">Priority </span><span aria-hidden="true">#</span>{item.priority ?? index + 1}</small>
    </li>)}
  </ol>;
}
