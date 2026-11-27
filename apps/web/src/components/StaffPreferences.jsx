import { useCallback, useEffect, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import { minutesToTime, preferenceGroupOptions, preferenceMeetingLabel } from "../preference-groups.js";
import { termLabel } from "../term-label.js";
import { RegisterEmpty, RegisterRow, StudentIdentity, StudentRegister } from "./CoordinatorRecords.jsx";
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
  const [assignedStudents, setAssignedStudents] = useState(null);
  const [linkedStudentPending, setLinkedStudentPending] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return !studentTarget && !profileId && Boolean(params.get("student")?.trim() && params.get("term"));
  });
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
      setTerms(rows);
      setTermId((current) => current || rows.find((term) => term.isActive)?._id || "");
    }).catch((error) => {
      if (!signal.aborted) setTermError(explainApiError(error, "Academic terms"));
    }).finally(() => {
      if (!signal.aborted) setTermsLoading(false);
    });
    return () => controller.abort();
  }, [termAttempt, token]);

  useEffect(() => {
    if (profile.role !== "advisor" || selectedId || linkedStudentPending) return;
    const controller = new AbortController();
    api("/api/schedules/students", { token, signal: controller.signal }).then(({ students = [] }) => {
      if (!controller.signal.aborted) {
        setAssignedStudents(students.filter(student => student.isActive)
          .sort((a, b) => studentName(a).localeCompare(studentName(b))));
      }
    }).catch(() => {
      if (!controller.signal.aborted) setAssignedStudents([]);
    });
    return () => controller.abort();
  }, [linkedStudentPending, profile.role, selectedId, token]);

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
    if (!term) {
      setReadError("The linked academic term is unavailable.");
      setLinkedStudentPending(false);
      return;
    }
    setTermId(term._id);
    setSearch(student);
    findStudent(student, true).finally(() => setLinkedStudentPending(false));
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
    clearRecord();
    setSelectedStudent(student);
    setSearch(student.studentId);
    setMatches([]);
    requestAnimationFrame(() => termSelect.current?.focus());
  }

  const showAssigned = profile.role === "advisor" && !selectedStudent && !linkedStudentPending && !search.trim();
  const quickStudents = showAssigned ? assignedStudents ?? [] : [];
  const lookupStudents = matches.length ? matches : quickStudents;
  const waitingForRecord = !readError && (loading || (canLoad && !record));
  const waitingForSelection = !termError && (linkedStudentPending || (selectedId && termsLoading));
  return <div className="page-stack schedule-preferences-page staff-preferences">
    <div className="page-title-row"><div><h1>Student preferences</h1></div></div>
    <section className="preference-context" aria-label="Student and term">
      <div className="preference-identify">
        {selectedStudent ? <div className="preference-student-selected">
          <StudentIdentity name={studentName(selectedStudent)} id={selectedStudent.studentId} email={studentEmail(selectedStudent)} />
          <button className="outline-button preference-change" type="button" onClick={changeStudent}>Change student</button>
        </div> : linkedStudentPending ? <p className="preference-read-progress" role="status">Opening linked student…</p> : <>
          <form className="preference-student-lookup" onSubmit={(event) => { event.preventDefault(); findStudent(search.trim()); }}>
            <label className="field"><span>Find advising student</span><input ref={studentSearch} type="search" autoComplete="off" value={search} onChange={(event) => { setSearch(event.target.value); setMatches([]); setLookupError(""); }} placeholder="Student ID, name, or email" disabled={searching} /></label>
            <button className="outline-button" type="submit" disabled={searching}>{searching ? "Searching…" : "Find student"}</button>
          </form>
          {lookupError && <p className="feedback error" role="alert">{lookupError}</p>}
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
    {showAssigned && assignedStudents === null && <p className="preference-read-progress" role="status">Loading assigned students…</p>}
    {lookupStudents.length > 0 && <section className="preference-lookup-results">
      <header className="preference-reading-heading"><h2>{showAssigned ? "Assigned students" : "Matching students"}</h2><p>{lookupStudents.length} {lookupStudents.length === 1 ? "student" : "students"}</p></header>
      <StudentRegister className="preference-student-results" label={showAssigned ? "Assigned students" : "Matching students"} columns={["Student", "Action"]}>
        {lookupStudents.map((student) => <RegisterRow key={studentProfileId(student)}>
          <StudentIdentity name={studentName(student)} id={student.studentId} email={studentEmail(student)} />
          <button className="outline-button" type="button" onClick={() => selectMatch(student)} aria-label={`View preferences for ${studentName(student)}`}>View preferences</button>
        </RegisterRow>)}
      </StudentRegister>
    </section>}
    <section className="preference-reading" aria-label="Submitted preferences">
      {(readError || waitingForRecord || (waitingForSelection && selectedId)) && <div className="preference-read-error">
        {!readError ? <p className="preference-read-progress" role="status">{record ? "Refreshing saved preferences…" : "Loading saved preferences…"}</p> : <>
          <p className="feedback error" role="alert">{readError}</p>
          {canLoad && <button className="outline-button" type="button" onClick={() => load(selectedId, termId)}>Retry</button>}
        </>}
      </div>}
      {record ? record.submitted && record.preferences ? <PreferenceSubmission preferences={record.preferences} offerings={record.offerings} updatedAt={record.lastUpdatedAt} /> :
        <RegisterEmpty art="submitted-plan.svg" title="No preferences submitted" description={`${studentName(selectedStudent)} hasn’t shared scheduling preferences for ${termLabel(selectedTerm)}. You can still start a draft.`} /> :
        !waitingForRecord && !waitingForSelection && !termsLoading && !canLoad && !readError && !lookupError && !termError && !searching && !lookupStudents.length && !(showAssigned && assignedStudents === null) && <RegisterEmpty art="submitted-plan.svg" title={selectedStudent ? "Choose an academic term" : "Find a student to review"} description={selectedStudent ? "Select the term to see this student’s saved preferences." : "Search the advising roster by name, student ID, or email."} />}
      {canOpenDraft && <footer className="preference-draft-handoff">
        <button className="outline-button" type="button" onClick={() => onOpenDraftSchedule?.({ ...selectedStudent, fullName: studentName(selectedStudent) }, selectedTerm.code || termId)}>Create or update draft schedule <span aria-hidden="true">→</span></button>
      </footer>}
    </section>
  </div>;
}

export function PreferenceSubmission({ preferences, offerings, updatedAt, title = "Scheduling priorities", draft = false }) {
  const { preferredDays, avoidedDays, desiredDaysOff, preferredTimes, avoidedTimes, preferredGroups, note } = preferences;
  return <div className="preference-submission">
    <header className="preference-reading-heading"><h2>{title}</h2>
      {updatedAt && <p>Last updated <time dateTime={updatedAt}>{updatedAtFormat.format(new Date(updatedAt))} Cairo</time></p>}
    </header>
    <table className="preference-priorities" aria-label="Scheduling priorities">
      <thead><tr><th scope="col">Preference</th><th scope="col">Weekdays</th><th scope="col">Teaching times</th></tr></thead>
      <tbody>
        <PriorityRow title="Preferred" kind="good" dayLabel="Preferred days" days={preferredDays} timeLabel="Preferred times" times={preferredTimes} />
        <PriorityRow title="To avoid" kind="danger" dayLabel="Days to avoid" days={avoidedDays} timeLabel="Times to avoid" times={avoidedTimes} />
        <PriorityRow title="Days off" dayLabel="Desired days off" days={desiredDaysOff} />
      </tbody>
    </table>
    <section className="preference-group-register">
      <h3>Preferred course groups</h3>
      {preferredGroups?.length ? <ol className="preferred-group-reading" aria-label="Preferred course groups, highest priority first" role="list">
        {preferredGroups.map(({ course, componentType, groupNumber, priority }, index) => {
          const offering = offerings?.find((item) => String(item.course?._id || item.course) === String(course?._id || course));
          const groups = offering?.groups || (offering && preferenceGroupOptions(offering));
          const option = groups?.find((item) => item.componentType === componentType && item.groupNumber === groupNumber);
          const sessions = option?.sessions || option?.slots || [];
          const identity = course?.code ? course : offering?.course;
          return <li key={`${course?._id || course}-${componentType}-${groupNumber}-${index}`}>
            <OfferingCourseIcon code={identity?.code} />
            <div className="registered-course-title">
              <strong>{identity?.name || identity?.code || "Course"}</strong>
              <small>{[identity?.code, `Priority ${priority ?? index + 1}`].filter(Boolean).join(" · ")}</small>
            </div>
            <div className="preference-group-detail">
              <strong className="preference-group-type">{componentType} {groupNumber}</strong>
              {option ? sessions.map((session, position) => <small key={session._id || position}>{session.startTime ? [session.day, `${session.startTime}–${session.endTime}`, session.room].filter(Boolean).join(" · ") : preferenceMeetingLabel(session)}</small>) : <small>{offerings && !draft ? "Group is no longer published" : "Meeting details are unavailable"}</small>}
            </div>
          </li>;
        })}
      </ol> : <p className="preference-missing">No preferred course groups.</p>}
    </section>
    <aside className="preference-note-detail">
      <h3>Student note</h3>
      {note ? <blockquote>{note}</blockquote> : <p className="preference-missing">No note submitted.</p>}
    </aside>
  </div>;
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
