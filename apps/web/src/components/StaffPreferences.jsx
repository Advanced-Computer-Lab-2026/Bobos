import { useCallback, useEffect, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { minutesToTime, preferenceGroupOptions, preferenceMeetingLabel } from "../preference-groups.js";
import { PREFERENCE_DAYS } from "../preference-inputs.js";
import { termLabel } from "../term-label.js";
import { RegisterEmpty, StudentIdentity } from "./CoordinatorRecords.jsx";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";

const updatedAtFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });
const studentProfileId = (student) => student?._id || student?.id || student?.profileId || student?.studentProfileId || "";
const studentName = (student) => student.user?.fullName || student.fullName || "Student";
const studentEmail = (student) => student.user?.email || student.email;
const formatWindow = ({ startMinute, endMinute }) => `${minutesToTime(startMinute)}–${minutesToTime(endMinute)}`;

export default function StaffPreferences({ token, profile, profileId, studentTarget, onOpenDraftSchedule }) {
  const [selectedStudent, setSelectedStudent] = useState(studentTarget || (profileId ? { _id: profileId } : null));
  const [search, setSearch] = useState(studentTarget?.studentId || "");
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
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
      const active = rows.filter((term) => term.isActive);
      setTerms(rows);
      setTermId((current) => current || (active.length === 1 ? active[0]._id : ""));
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

  const findStudent = useCallback(async (query, linked = false) => {
    if (!query) { setLookupError("Enter a student ID, name, or email to search."); return; }
    lookupRequest.current?.abort();
    const controller = new AbortController();
    const { signal } = controller;
    lookupRequest.current = controller;
    setSearching(true);
    setLookupError("");
    setMatches([]);
    try {
      const { data = [] } = await api(`/api/advisor/students?search=${encodeURIComponent(query)}&limit=100`, { token, signal });
      if (signal.aborted) return;
      const exact = data.find((student) => String(student.studentId).toLowerCase() === query.toLowerCase());
      if (exact) {
        setSelectedStudent(exact);
        setSearch(exact.studentId);
        if (!linked) requestAnimationFrame(() => termSelect.current?.focus());
      } else if (linked) {
        setLookupError("The linked advising student is unavailable.");
      } else if (data.length) {
        setMatches(data);
      } else {
        setLookupError(`No advising student matched “${query}”.`);
      }
    } catch (error) {
      if (!signal.aborted) setLookupError(explainApiError(error, "Student lookup"));
    } finally {
      if (!signal.aborted) setSearching(false);
    }
  }, [token]);

  useEffect(() => {
    if (studentTarget || profileId || termsLoading || termError || !bookmark.current) return;
    const bookmarkParams = bookmark.current;
    bookmark.current = null;
    const student = bookmarkParams.get("student")?.trim();
    const termKey = bookmarkParams.get("term");
    if (!student || !termKey) return;
    const term = terms.find(({ _id, code }) => _id === termKey || code === termKey);
    if (!term) { setReadError("The linked academic term is unavailable."); return; }
    setTermId(term._id);
    setSearch(student);
    findStudent(student, true);
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
    setMatches([]);
    setSelectedStudent(null);
    setSearch("");
    setLookupError("");
    clearRecord();
    requestAnimationFrame(() => studentSearch.current?.focus());
  }

  function selectMatch(student) {
    setSelectedStudent(student);
    setSearch(student.studentId);
    setMatches([]);
    requestAnimationFrame(() => termSelect.current?.focus());
  }

  return <div className="page-stack schedule-preferences-page staff-preferences">
    <div className="page-title-row"><div><h1>Student preferences</h1></div></div>
    <section className="preference-context" aria-label="Student and term">
      <div className="preference-identify">
        {selectedStudent ? <div className="preference-student-selected">
          <StudentIdentity name={studentName(selectedStudent)} id={selectedStudent.studentId} email={studentEmail(selectedStudent)} />
          <button className="outline-button preference-change" type="button" onClick={changeStudent}>Change student</button>
        </div> : <>
          <form className="preference-student-lookup" onSubmit={(event) => { event.preventDefault(); findStudent(search.trim()); }}>
            <label className="field"><span>Find advising student</span><input ref={studentSearch} type="search" autoComplete="off" value={search} onChange={(event) => { setSearch(event.target.value); setMatches([]); setLookupError(""); }} placeholder="Student ID, name, or email" disabled={searching} /></label>
            <button className="outline-button" type="submit" disabled={searching}>{searching ? "Searching…" : "Find student"}</button>
          </form>
          {lookupError && <p className="feedback error" role="alert">{lookupError}</p>}
          {matches.length > 0 && <ul className="preference-student-results" aria-label="Matching students" role="list">
            {matches.map((student) => <li key={studentProfileId(student)}><button className="preference-student-result" type="button" onClick={() => selectMatch(student)}>
              <StudentIdentity name={studentName(student)} id={student.studentId} email={studentEmail(student)} />
            </button></li>)}
          </ul>}
        </>}
      </div>
      <div className="preference-term">
        <label className="field"><span>Academic term</span><select ref={termSelect} value={termId} onChange={changeTerm} disabled={termsLoading || searching || terms.length === 0}>
            <option value="">{termsLoading ? "Loading terms…" : terms.length ? "Select a term" : "No terms available"}</option>
            {terms.map((term) => <option key={term._id} value={term._id}>{termLabel(term)}{term.isActive ? " (Active)" : ""}</option>)}
          </select></label>
        {termError && <div className="preference-read-error"><p className="feedback error" role="alert">{termError}</p><button className="outline-button" type="button" onClick={() => setTermAttempt((attempt) => attempt + 1)}>Retry terms</button></div>}
      </div>
    </section>
    <section className="preference-reading" aria-label="Submitted preferences">
      {(readError || loading) && <div className="preference-read-error">
        {loading ? <p className="preference-read-progress" role="status">{record ? "Refreshing saved preferences…" : "Loading saved preferences…"}</p> : <>
          <p className="feedback error" role="alert">{readError}</p>
          {canLoad && <button className="outline-button" type="button" onClick={() => load(selectedId, termId)}>Retry</button>}
        </>}
      </div>}
      {record ? record.submitted && record.preferences ? <PreferenceSubmission preferences={record.preferences} offerings={record.offerings} updatedAt={record.lastUpdatedAt} /> : <div className="preference-empty" role="status">
        <h3>No preferences submitted</h3><p>The student can still receive a schedule for this term.</p>
      </div> : !loading && !readError && <RegisterEmpty art="submitted-plan.svg" title={selectedStudent ? "Choose an academic term" : "Find a student to review"} description={selectedStudent ? "Select the term to see this student’s saved preferences." : "Search the advising roster by name, student ID, or email."} />}
      {canOpenDraft && <footer className="preference-draft-handoff">
        <button className="outline-button" type="button" onClick={() => onOpenDraftSchedule?.({ ...selectedStudent, fullName: studentName(selectedStudent) }, selectedTerm.code || termId)}>Create or update draft schedule <span aria-hidden="true">→</span></button>
      </footer>}
    </section>
  </div>;
}

function PreferenceSubmission({ preferences, offerings, updatedAt }) {
  const { preferredDays, avoidedDays, desiredDaysOff, preferredTimes, avoidedTimes, preferredGroups, note } = preferences;
  return <div className="preference-submission">
    <header className="preference-reading-heading"><h2>Scheduling priorities</h2>
      {updatedAt && <p>Last updated <time dateTime={updatedAt}>{updatedAtFormat.format(new Date(updatedAt))} Cairo</time></p>}
    </header>
    <div className="preference-planners">
      <DayPlanner preferred={preferredDays} avoided={avoidedDays} daysOff={desiredDaysOff} />
      <TimePlanner preferred={preferredTimes} avoided={avoidedTimes} />
    </div>
    <div className="preference-details">
    <section className="preference-group-register">
      <h3>Preferred course groups</h3>
      {preferredGroups?.length ? <ol className="preferred-group-reading" aria-label="Preferred course groups, highest priority first" role="list">
        {preferredGroups.map(({ course, componentType, groupNumber, priority }, index) => {
          const offering = offerings?.find((item) => String(item.course?._id || item.course) === String(course?._id || course));
          const option = offering && preferenceGroupOptions(offering).find((item) => item.componentType === componentType && item.groupNumber === groupNumber);
          const identity = course?.code ? course : offering?.course;
          return <li key={`${course?._id || course}-${componentType}-${groupNumber}-${index}`}>
            <OfferingCourseIcon code={identity?.code} />
            <div className="preference-course-description">
              <small>{[identity?.code, `Priority ${priority ?? index + 1}`].filter(Boolean).join(" · ")}</small>
              <strong>{identity?.name || identity?.code || "Course"}</strong>
              <span className="preference-group-type">{componentType} {groupNumber}</span>
              {option ? option.sessions.map((session, position) => <span className="preference-meeting" key={session._id || position}>{preferenceMeetingLabel(session)}</span>) : <span className="preference-meeting">{offerings ? "Group is no longer published" : "Meeting details are unavailable"}</span>}
            </div>
          </li>;
        })}
      </ol> : <p className="preference-missing">No preferred course groups.</p>}
    </section>
    <aside className="preference-note-detail">
      <h3>Student note</h3>
      {note ? <blockquote>{note}</blockquote> : <p className="preference-missing">No note submitted.</p>}
    </aside>
    </div>
  </div>;
}

const dayRows = [
  ["Preferred days", "prefer"],
  ["Days to avoid", "avoid"],
  ["Desired days off", "off"],
];

function DayPlanner({ preferred = [], avoided = [], daysOff = [] }) {
  const selections = [preferred, avoided, daysOff];
  return <section className="preference-day-planner" aria-label="Weekday priorities">
    <div className="preference-week-heading"><h3>Weekdays</h3><small>1 = highest priority</small></div>
    <div className="preference-week-sheet">
      <div className="preference-day-head" aria-hidden="true">
        {PREFERENCE_DAYS.map(day => <span key={day}>{day.slice(0, 3)}</span>)}
      </div>
      {dayRows.map(([label, kind], row) => <div className="preference-day-row" key={kind}>
        <span className="preference-day-label">{label}</span>
        {selections[row].length ? <ol role="list" aria-label={label + ", highest priority first"}>
          {selections[row].map(({day, priority}, index) => <li className={`preference-day-mark is-${kind}`} key={day}
            style={{ gridColumn: PREFERENCE_DAYS.indexOf(day) + 1, gridRow: 1 }} title={`${day} · Priority ${priority ?? index + 1}`}>
            <span className="preference-sr">Priority </span>{priority ?? index + 1}<span className="preference-sr">{day}</span>
          </li>)}
        </ol> : <small className="preference-missing">None submitted</small>}
      </div>)}
    </div>
  </section>;
}

function TimePlanner({ preferred = [], avoided = [] }) {
  const windows = [...preferred, ...avoided];
  const start = Math.floor(Math.min(480, ...windows.map(item => item.startMinute)) / 60) * 60;
  const end = Math.ceil(Math.max(1080, ...windows.map(item => item.endMinute)) / 60) * 60;
  return <section className="preference-time-planner" aria-label="Teaching time priorities">
    <h3>Teaching times</h3>
    <div className="preference-hour-axis" aria-hidden="true">
      {[start, (start + end) / 2, end].map(minute => <span key={minute}>{minutesToTime(minute)}</span>)}
    </div>
    {[[preferred, "Preferred times", "prefer"], [avoided, "Times to avoid", "avoid"]].map(([items, label, kind]) =>
      <div className="preference-time-row" key={kind}>
        <span className="preference-time-label">{label}</span>
        {items.length ? <ol role="list" aria-label={label + ", highest priority first"}>{items.map((window, index) =>
          <li key={formatWindow(window)}>
            <span className={`preference-time-track is-${kind}`} aria-hidden="true"><i style={{
              left: `${100 * (window.startMinute - start) / (end - start)}%`,
              width: `${100 * (window.endMinute - window.startMinute) / (end - start)}%`,
            }} /></span>
            <span className="preference-window-label">{formatWindow(window)} <small>Priority {window.priority ?? index + 1}</small></span>
          </li>)}</ol> : <small className="preference-missing">None submitted</small>}
      </div>)}
  </section>;
}
