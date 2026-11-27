import { flushSync } from "react-dom";
import OfferingCourseIcon from "./OfferingCourseIcon.jsx";
import { termLabel } from "../term-label.js";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, explainApiError } from "../api.js";
import PaperTossButton, { waitForPaperToss } from "./PaperTossButton.jsx";

const pretty = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const seasons = ["winter", "spring", "summer", "firstMakeup", "secondMakeup"];
const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AcademicWorkspace({ token, role, section, notify }) {
  if (section === "courses") return <CoursesWorkspace token={token} role={role} notify={notify} />;
  if (section === "terms") return <TermsWorkspace token={token} role={role} notify={notify} />;
  if (section === "offerings") return role === "administrator" ? <OfferingsWorkspace token={token} notify={notify} /> : <div className="feedback error" role="alert">Only administrators can manage course offerings.</div>;
  if (section === "templates") return role === "coordinator" ? <TemplatesWorkspace token={token} notify={notify} /> : <div className="feedback error" role="alert">Only coordinators can manage schedule templates.</div>;
  return null;
}

const courseImportColumns = "Course Code,Course Name,Credit Hours,Course Type,Faculty/Major,Recommended Semester,Offering Season,Prerequisites\n";

function CoursesWorkspace({ token, role, notify }) {
  const canManage = role === "administrator";
  const [courses, setCourses] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [query, setQuery] = useState(""); const [editing, setEditing] = useState(null); const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(null); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [csvFile, setCsvFile] = useState(null); const [importing, setImporting] = useState(false); const [importErrors, setImportErrors] = useState([]);
  const [curriculumOfferingSeasons, setCurriculumOfferingSeasons] = useState(["winter", "spring"]);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setCourses(await api("/api/catalogue/courses", { token })); } catch (e) { setError(explainApiError(e, "Course catalogue")); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  const resetImportErrors = () => {
    setImportError("");
    setImportErrors([]);
  };
  const closeImport = () => {
    if (importing) return;
    setCsvFile(null);
    resetImportErrors();
    setImportOpen(false);
  };
  const importCsv = async (event) => {
    event.preventDefault();
    if (!csvFile) return;
    resetImportErrors();
    setImporting(true);
    try {
      const result = await api("/api/catalogue/courses/import", { token, method: "POST", body: { csvText: await csvFile.text(), curriculumOfferingSeasons } });
      setCsvFile(null);
      setImportOpen(false);
      const skipped = result.skippedPlaceholders ? ` Skipped ${result.skippedPlaceholders} unnumbered elective placeholders.` : "";
      const seasonNote = result.format === "curriculum" ? ` Default seasons applied: ${curriculumOfferingSeasons.map(pretty).join(", ")}.` : "";
      notify("success", `Imported ${result.total} courses: ${result.created} created, ${result.updated} updated.${skipped}${seasonNote}`);
      await load();
    } catch (e) {
      setImportErrors(e.data?.errors || []);
      setImportError(e.data?.message || (e.data?.errors?.length ? "Correct the listed rows and try again. No courses were imported." : explainApiError(e, "Import courses")));
    } finally { setImporting(false); }
  };
  const removeCourse = async () => {
    if (!confirmingDelete) return;
    setDeleting(true); setDeleteError("");
    try {
      await waitForPaperToss();
      await api(`/api/catalogue/courses/${confirmingDelete._id}`, { token, method: "DELETE" });
      notify("success", `${confirmingDelete.code} was removed from the catalogue.`);
      setConfirmingDelete(null);
      await load();
    } catch (e) { setDeleteError(explainApiError(e, "Delete course")); }
    finally { setDeleting(false); }
  };
  const [viewing, setViewing] = useState(null);
  const initialCourse = useRef(new URLSearchParams(window.location.search).get("course"));
  useEffect(() => {
    if (!courses.length || !initialCourse.current) return;
    const target = courses.find(course => course.code.replace(/\s/g, "").toUpperCase() === initialCourse.current.replace(/\s/g, "").toUpperCase() || course._id === initialCourse.current);
    initialCourse.current = null;
    if (target) setViewing(target);
  }, [courses]);
  const openCourseEditor = (course) => { setEditError(""); setEditing(course); };
  const visible = courses.filter((course) => `${course.code} ${course.name} ${course.courseType} ${(course.facultyMajors || []).join(" ")}`.toLowerCase().includes(query.trim().toLowerCase()));
  const saveCourse = async (event) => {
    event.preventDefault(); setSaving(true); setEditError("");
    const form = new FormData(event.currentTarget);
    const prerequisites = form.getAll("prerequisites");
    const payload = {
      code: form.get("code"), name: form.get("name"), creditHours: Number(form.get("creditHours")), courseType: form.get("courseType"),
      facultyMajors: splitLines(form.get("facultyMajors")), offeringSeasons: form.getAll("offeringSeasons"),
      prerequisites, recommendedSemester: form.get("recommendedSemester") ? Number(form.get("recommendedSemester")) : undefined,
      lectureHours: form.get("lectureHours") ? Number(form.get("lectureHours")) : undefined,
      tutorialHours: form.get("tutorialHours") ? Number(form.get("tutorialHours")) : undefined,
      labHours: form.get("labHours") ? Number(form.get("labHours")) : undefined,
      isBachelorProject: form.get("isBachelorProject") === "on", isActive: form.get("isActive") === "on",
    };
    try {
      await api(editing?._id ? `/api/catalogue/courses/${editing._id}` : "/api/catalogue/courses", { token, method: editing?._id ? "PUT" : "POST", body: payload });
      notify("success", editing?._id ? "Course updated." : "Course added to the catalogue."); setEditing(null); load();
    } catch (e) { setEditError(e.message); }
    finally { setSaving(false); }
  };
  return <div className="page-stack course-register">
    <PageTitle title="Course catalogue" description="Course requirements, teaching hours and offering seasons." action={canManage && <div className="catalogue-tools">
      <button className="outline-button" type="button" onClick={() => setImportOpen(true)}>Import CSV</button>
      <button className="primary-button" type="button" onClick={() => openCourseEditor({})}>Add course</button>
    </div>} />
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="catalogue-register" aria-label="Catalogue courses">
      <div className="register-controls catalogue-search">
        <label className="field"><span>Search courses</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Course code, name or major" /></label>
        <span className="register-count" role="status">{loading ? "Loading courses…" : query.trim() ? `${visible.length} of ${courses.length} courses` : `${courses.length} ${courses.length === 1 ? "course" : "courses"}`}</span>
      </div>
      {loading ? <Loading /> : visible.length ? <table className="catalogue-table" role="table">
        <thead role="rowgroup"><tr role="row">
          {["Course", "Credits", "Type", "Majors", "Semester", "Status"].map(label => <th key={label} role="columnheader" scope="col">{label}</th>)}
          {canManage && <th role="columnheader" scope="col"><span className="sr-only">Actions</span></th>}
        </tr></thead>
        <tbody role="rowgroup">{visible.map(course => <tr key={course._id} role="row">
          <td role="cell"><button type="button" className="catalogue-name" aria-label={`View course ${course.code} · ${course.name}`} onClick={() => setViewing(course)}><OfferingCourseIcon code={course.code} /><span><strong>{course.name}</strong><small>{course.code}</small></span></button></td>
          <td role="cell"><span className="catalogue-cell-label" aria-hidden="true">Credits</span>{course.creditHours}</td>
          <td role="cell"><span className="catalogue-cell-label" aria-hidden="true">Type</span>{course.courseType === "huma" ? "Humanities" : pretty(course.courseType)}</td>
          <td role="cell"><span className="catalogue-cell-label" aria-hidden="true">Majors</span>{catalogueMajors(course).join(", ") || "All"}</td>
          <td role="cell"><span className="catalogue-cell-label" aria-hidden="true">Semester</span>{course.recommendedSemester || "—"}</td>
          <td role="cell"><span className="catalogue-cell-label" aria-hidden="true">Status</span><span className={`status-pill ${course.isActive ? "good" : "muted"}`}>{course.isActive ? "Active" : "Inactive"}</span></td>
          {canManage && <td className="catalogue-actions" role="cell"><div className="table-actions"><button className="outline-button" type="button" onClick={() => openCourseEditor(course)}>Edit</button><PaperTossButton label={`Delete course ${course.code}`} onClick={() => { setDeleteError(""); setConfirmingDelete(course); }}>Delete</PaperTossButton></div></td>}
        </tr>)}</tbody>
      </table> : <EmptyState title="No courses found" text={query ? "Try another course code, name or major." : "Courses will appear here when added to the catalogue."} />}
    </section>
    {viewing && <CourseDetailsModal course={viewing} allCourses={courses} onClose={() => setViewing(null)} onEdit={canManage ? () => { setViewing(null); openCourseEditor(viewing); } : undefined} />}
    {editing && <CourseEditor course={editing} courses={courses} onSave={saveCourse} onClose={() => !saving && setEditing(null)} saving={saving} error={editError} />}
    {importOpen && <Modal title="Import courses from CSV" onClose={closeImport}>
      <form className="form-stack catalogue-import" onSubmit={importCsv}>
        <p className="catalogue-dialog-copy">Use the catalogue CSV template or upload a MET/DMET curriculum export.</p>
        <label className="field">
          <span>CSV file</span>
          <input type="file" accept=".csv,text/csv" disabled={importing} required onChange={event => {
            setCsvFile(event.target.files?.[0] || null);
            resetImportErrors();
          }} />
        </label>
        <fieldset className="catalogue-import-seasons" disabled={importing}>
          <legend>Offering seasons for curriculum exports</legend>
          <p className="catalogue-dialog-copy">The standard template uses its own Offering Season column.</p>
          <div className="season-checkboxes">{seasons.map(season => <label key={season}>
            <input type="checkbox" checked={curriculumOfferingSeasons.includes(season)}
              onChange={event => setCurriculumOfferingSeasons(current => event.target.checked ? [...current, season] : current.filter(item => item !== season))} />
            {pretty(season)}
          </label>)}</div>
        </fieldset>
        {importError && <p className="feedback error" role="alert">{importError}</p>}
        {importErrors.length > 0 && <div className="course-import-errors">
          <h3>Rows to correct</h3>
          <div className="table-scroll"><table><thead><tr><th>Row</th><th>Field</th><th>Error</th></tr></thead>
            <tbody>{importErrors.map((item, index) => <tr key={`${item.row}-${item.field}-${index}`}><td>{item.row}</td><td>{item.field}</td><td>{item.message}</td></tr>)}</tbody>
          </table></div>
        </div>}
        <div className="form-footer catalogue-import-actions">
          <a className="outline-button" download="course-import-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(courseImportColumns)}`}>Download template</a>
          <button className="primary-button" disabled={importing || !csvFile}>{importing ? "Validating and importing…" : "Validate and import"}</button>
        </div>
      </form>
    </Modal>}
    {confirmingDelete && <Modal title="Delete course?" onClose={() => !deleting && setConfirmingDelete(null)}>
      <div className="catalogue-delete" aria-busy={deleting}>
        <div className="catalogue-delete-course">
          <OfferingCourseIcon code={confirmingDelete.code} />
          <div><strong>{confirmingDelete.name}</strong><small>{confirmingDelete.code}</small></div>
        </div>
        <p className="catalogue-dialog-copy">This permanently removes the course from the catalogue.</p>
        {deleteError && <p className="feedback error" role="alert">{deleteError}</p>}
        <div className="form-footer">
          <button type="button" className="outline-button" disabled={deleting} onClick={() => setConfirmingDelete(null)}>Cancel</button>
          <PaperTossButton disabled={deleting} tossing={deleting} onClick={removeCourse}>{deleting ? "Deleting…" : "Delete course"}</PaperTossButton>
        </div>
      </div>
    </Modal>}
  </div>;
}

const blankTerm = { code: "", academicYear: "2026/2027", season: "spring", termStart: "", termEnd: "", teachingStart: "", teachingEnd: "", registrationStart: "", registrationEnd: "", advisingDeadline: "", wholeScheduleSwapDeadline: "", isActive: false };
const termDateGroups = {
  "Term dates": ["termStart", "termEnd"],
  "Teaching dates": ["teachingStart", "teachingEnd"],
  Registration: ["registrationStart", "registrationEnd"],
  "Advising deadline": ["advisingDeadline"],
  "Whole-schedule swap deadline": ["wholeScheduleSwapDeadline"],
};
const termDateFields = Object.values(termDateGroups).flat();

function TermDates({ dates }) {
  const values = dates.map(value => value ? new Date(value) : null);
  const sameYear = values.length === 2 && values[0]?.getUTCFullYear() === values[1]?.getUTCFullYear();
  return values.map((date, index) => {
    const year = sameYear && index === 0 ? undefined : "numeric";
    return <span key={index}>{index > 0 && " – "}{date && Number.isFinite(date.getTime())
      ? <time dateTime={date.toISOString().slice(0, 10)}>{date.toLocaleDateString(undefined, { day: "numeric", month: "short", year, timeZone: "UTC" })}</time>
      : "Unspecified"}</span>;
  });
}

function TermCalendar({ term }) {
  const milestones = termDateFields.filter(key => term[key]).map(key => ({date:new Date(term[key]), label:pretty(key)})).filter(item => Number.isFinite(item.date.getTime()));
  const monthOf = date => date.getUTCFullYear() * 12 + date.getUTCMonth();
  const months = milestones.map(item => monthOf(item.date));
  const first = Math.min(...months), last = Math.max(...months);
  const [month, setMonth] = useState(() => Math.min(last, Math.max(first, monthOf(new Date()))));
  if (!months.length) return null;
  const firstDay = new Date(Date.UTC(Math.floor(month / 12), month % 12, 1));
  const monthName = firstDay.toLocaleDateString(undefined, {month:"long", year:"numeric", timeZone:"UTC"});
  const days = new Date(Date.UTC(Math.floor(month / 12), month % 12 + 1, 0)).getUTCDate();
  const offset = (firstDay.getUTCDay() + 1) % 7;
  const events = milestones.filter(item => monthOf(item.date) === month);
  return <section className="term-calendar" aria-label="Term calendar">
    <div className="term-calendar-paper">
      <div className="term-calendar-binding" aria-hidden="true"><i/><i/><i/></div>
      <div className="term-calendar-month"><h3 aria-live="polite">{monthName}</h3><div>
        <button type="button" disabled={month <= first} onClick={() => setMonth(value => value - 1)} aria-label="Previous calendar month">‹</button>
        <button type="button" disabled={month >= last} onClick={() => setMonth(value => value + 1)} aria-label="Next calendar month">›</button>
      </div></div>
      <div className="term-calendar-grid">
        {["Sa","Su","Mo","Tu","We","Th","Fr"].map(day => <small key={day}>{day}</small>)}
        {Array.from({length:offset}, (_,i) => <span key={`space-${i}`} />)}
        {Array.from({length:days}, (_,i) => { const day = i + 1; const labels = events.filter(item => item.date.getUTCDate() === day).map(item => item.label); return <span key={day} className={labels.length ? "term-date-mark" : undefined} title={labels.join(", ") || undefined}>{day}</span>; })}
      </div>
    </div>
    {events.length > 0 && <p className="calendar-caption">{events.sort((a,b) => a.date-b.date).map(item => `${item.date.getUTCDate()} · ${item.label}`).join("  /  ")}</p>}
  </section>;
}

function TermsWorkspace({ token, role, notify }) {
  const canManage = role === "administrator";
  const [editor, setEditor] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(blankTerm);
  const [termId, setTermId] = useState("");
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingTerms, setFetchingTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recordingStanding, setRecordingStanding] = useState(false);

  const loadTerms = async () => {
    setFetchingTerms(true);
    try {
      const data = await api("/api/academic-terms/academicTerm", { token });
      setTerms(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(explainApiError(e, "Academic terms"));
      setTerms(readRecentTerms());
    } finally {
      setFetchingTerms(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, [token]);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toPayload = () => {
    const payload = {};
    for (const key of Object.keys(blankTerm)) {
      if (form[key] !== undefined) {
        payload[key] = termDateFields.includes(key) && form[key]
          ? dateToIso(form[key])
          : form[key];
      }
    }
    payload.code = form.code || `${form.season}-${form.academicYear.replace(/[^0-9]/g, "")}`;
    return payload;
  };

  const validateDates = () => {
    if (form.termStart && form.termEnd && form.termStart > form.termEnd) {
      return "Term end must be on or after term start.";
    }
    if (form.teachingStart && form.teachingEnd && form.teachingStart > form.teachingEnd) {
      return "Teaching end must be on or after teaching start.";
    }
    if (form.termStart && form.teachingStart && form.teachingStart < form.termStart) {
      return "Teaching start must be on or after term start (Teaching must start during the term).";
    }
    if (form.termEnd && form.teachingEnd && form.teachingEnd > form.termEnd) {
      return "Teaching end must be on or before term end (Teaching must end during the term).";
    }
    if (form.registrationStart && form.registrationEnd && form.registrationStart > form.registrationEnd) {
      return "Registration end must be on or after registration start.";
    }
    return null;
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");
    setMessage("");

    const clientValidation = validateDates();
    if (clientValidation) {
      setFormError(clientValidation);
      return;
    }

    const editingId = editor === "edit" ? termId : "";
    setLoading(true);
    try {
      const data = await api(
        editingId
          ? `/api/academic-terms/academicTerm/${encodeURIComponent(editingId)}`
          : "/api/academic-terms/academicTerm",
        {
          token,
          method: editingId ? "PUT" : "POST",
          body: toPayload(),
        }
      );
      setTermId(data._id || data.code);
      setEditor("");
      const next = [data, ...terms.filter((term) => term._id !== data._id && term.code !== data.code)].slice(0, 8);
      window.localStorage.setItem("bobos.recentTerms", JSON.stringify(next));
      window.localStorage.setItem("bobos.lastTermId", data.code || data._id);
      setMessage(`${termLabel(data)} saved.`);
      notify("success", `${termLabel(data)} saved.`);
      loadTerms();
    } catch (e) {
      setFormError(explainApiError(e, "Save academic term"));
    } finally {
      setLoading(false);
    }
  };

  const standingSaved = ({ warningEmailStatus }) => {
    setRecordingStanding(false);
    setMessage(warningEmailStatus === "sent" ? "Semester standing saved. Probation warning email sent." : "Semester standing saved.");
    if (warningEmailStatus === "failed") setError("The probation warning email could not be delivered.");
    if (warningEmailStatus === "pending") setMessage("Semester standing saved. The probation warning check is pending.");
  };

  const selectedTerm = terms.find(term => (term._id || term.code) === termId) || terms.find(term => term.isActive) || terms[0];
  const openEditor = (mode) => {
    if (mode === "edit") setTermId(selectedTerm._id || selectedTerm.code);
    setForm(mode === "edit" ? termToForm(selectedTerm) : blankTerm);
    setFormError("");
    setEditor(mode);
  };
  const closeEditor = () => { if (!loading) setEditor(""); };
  const editorTitle = editor === "edit" ? "Edit academic term" : "Create academic term";

  return <div className="page-stack term-register">
    <PageTitle title="Academic terms" description="Teaching dates, registration windows and scheduling deadlines."
      action={canManage && <div className="term-management-actions">
        {terms.length > 0 && <button className="outline-button" type="button" onClick={() => { setMessage(""); setError(""); setRecordingStanding(true); }}>Record standing</button>}
        <button className="primary-button" type="button" onClick={() => openEditor("create")}>Create term</button>
      </div>} />
    {message && <div className="feedback success" role="status">{message}</div>}
    {error && <div className="feedback error" role="alert">{error}</div>}
    {fetchingTerms ? <Loading /> : !selectedTerm ? <EmptyState title="No academic terms" text="Configured terms and their dates will appear here." /> : <>
      <div className="term-read-layout">
        <div className="term-picker-row">
          <label className="field term-selection"><span>Academic term</span><select value={selectedTerm._id || selectedTerm.code} onChange={event => setTermId(event.target.value)}>{terms.map(term => <option key={term._id || term.code} value={term._id || term.code}>{termLabel(term)}{term.isActive ? " · Active" : ""}</option>)}</select></label>
          {canManage && <button className="outline-button" type="button" onClick={() => openEditor("edit")}>Edit term</button>}
        </div>
        <section className="term-milestones" aria-labelledby="term-dates-heading">
          <div className="term-milestones-heading"><h2 id="term-dates-heading">Dates and deadlines</h2><span className={`status-pill ${selectedTerm.isActive ? "good" : "muted"}`}>{selectedTerm.isActive ? "Active term" : "Inactive term"}</span></div>
          <dl className="term-dates">{Object.entries(termDateGroups).map(([label, fields]) => <div className={fields.length === 1 ? "term-deadline" : undefined} key={label}><dt>{label}</dt><dd><TermDates dates={fields.map(field => selectedTerm[field])} /></dd></div>)}</dl>
        </section>
        <TermCalendar key={selectedTerm._id || selectedTerm.code} term={selectedTerm}/>
      </div>
    </>}
    {canManage && editor && <Modal title={editorTitle} onClose={closeEditor} wide>
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Academic year">
            <input
              required
              value={form.academicYear}
              onChange={(e) => update("academicYear", e.target.value)}
              placeholder="2026/2027"
            />
          </Field>
          <Field label="Season">
            <select value={form.season} onChange={(e) => update("season", e.target.value)}>
              {seasons.map((season) => (
                <option key={season} value={season}>{pretty(season)}</option>
              ))}
            </select>
          </Field>
          <label className="check-field term-active">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update("isActive", e.target.checked)}
            /> Active term
          </label>
        </div>
        {Object.entries(termDateGroups).slice(0,3).map(([group, fields]) => <fieldset className="term-date-pair" key={group}><legend>{group}</legend><div className="form-grid">
          {fields.map((field) => (
            <Field key={field} label={pretty(field)}>
              <input
                type="date"
                required
                value={form[field]}
                min={
                  field === "teachingStart" && form.termStart
                    ? form.termStart
                    : field === "termEnd" && form.termStart
                    ? form.termStart
                    : undefined
                }
                max={
                  field === "teachingEnd" && form.termEnd
                    ? form.termEnd
                    : undefined
                }
                onChange={(e) => update(field, e.target.value)}
              />
            </Field>
          ))}
        </div></fieldset>)}
        <fieldset className="term-date-pair"><legend>Scheduling deadlines</legend><div className="form-grid">{termDateFields.slice(-2).map(field => <Field key={field} label={pretty(field)}><input type="date" required value={form[field]} onChange={event => update(field, event.target.value)} /></Field>)}</div></fieldset>
        {formError && <div className="feedback error" role="alert">{formError}</div>}
        <FormFooter onCancel={closeEditor} busy={loading} submitText={editor === "edit" ? "Update term" : "Create term"} />
      </form>
    </Modal>}
    {canManage && recordingStanding && <TermStandingModal
      token={token}
      terms={terms}
      selectedTerm={selectedTerm}
      onClose={() => setRecordingStanding(false)}
      onSaved={standingSaved}
    />}
  </div>;
}

function TermStandingModal({ token, terms, selectedTerm, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const term = form.get("term");
    const studentId = form.get("studentId").trim();
    if (!studentId) {
      setError("Enter a student ID.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await api(`/api/academic-terms/academicTerm/${encodeURIComponent(term)}/standings/${encodeURIComponent(studentId)}`, {
        token,
        method: "PUT",
        body: { academicStanding: form.get("academicStanding") },
      });
      onSaved(result);
    } catch (requestError) {
      setError(explainApiError(requestError, "Semester standing"));
    } finally {
      setSaving(false);
    }
  };

  return <Modal title="Record semester standing" eyebrow="ACADEMIC TERMS" onClose={() => !saving && onClose()}>
    <form className="form-stack" onSubmit={save}>
      <Field label="Academic term">
        <select name="term" defaultValue={selectedTerm?._id || selectedTerm?.code || ""} required>
          <option value="" disabled>Choose a term</option>
          {terms.map(term => <option key={term._id || term.code} value={term._id || term.code}>
            {termLabel(term)}
          </option>)}
        </select>
      </Field>
      <Field label="Student ID">
        <input name="studentId" placeholder="e.g. 61-00002" maxLength={24} required />
      </Field>
      <Field label="Academic standing">
        <select name="academicStanding" defaultValue="" required>
          <option value="" disabled>Choose a standing</option>
          <option value="goodAcademicStanding">Good academic standing</option>
          <option value="probation">Probation</option>
        </select>
      </Field>
      {error && <div className="feedback error" role="alert">{error}</div>}
      <FormFooter onCancel={onClose} busy={saving} submitText="Save standing" />
    </form>
  </Modal>;
}


function OfferingsWorkspace({ token, notify }) {
  const [termId, setTermId] = useState(() => window.localStorage.getItem("bobos.lastTermId") || "");
  const [terms, setTerms] = useState([]);
  const [duplicating, setDuplicating] = useState(() => new URLSearchParams(window.location.search).get("page") === "copy-offerings");
  const requestVersion = useRef(0);
  const [courses, setCourses] = useState([]); const [offerings, setOfferings] = useState([]); const [termSummary, setTermSummary] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [creating, setCreating] = useState(false); const [details, setDetails] = useState(null); const [confirmingDelete, setConfirmingDelete] = useState(null); const [deleteError, setDeleteError] = useState(""); const [deleting, setDeleting] = useState(false);
  useEffect(() => { api("/api/catalogue/courses", { token }).then(setCourses).catch(() => {}); }, [token]);
  const load = async (event, identifier = termId.trim()) => { event?.preventDefault(); if (!identifier) { setError("Select an academic term."); return; } const version = ++requestVersion.current; window.localStorage.setItem("bobos.lastTermId", identifier); setLoading(true); setError(""); try { const data = await api(`/api/catalogue/offerings?termId=${encodeURIComponent(identifier)}`, { token }); if (version !== requestVersion.current) return; setOfferings(data.offerings || []); setTermSummary(data.term); } catch (e) { if (version !== requestVersion.current) return; setError(explainApiError(e, "Course offerings")); setOfferings([]); setTermSummary(null); } finally { if (version === requestVersion.current) setLoading(false); } };
  useEffect(() => {
    let alive = true;
    api("/api/academic-terms/academicTerm", { token }).then(rows => {
      if (!alive) return;
      setTerms(rows);
      const selected = rows.find(term => term._id === termId || term.code === termId) || rows.find(term => term.isActive) || rows[0];
      if (selected) { setTermId(selected.code); load(undefined, selected.code); }
    }).catch(failure => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [token]);
  const openDetails = async (offering) => { setDetails({ loading: true }); try { setDetails(await api(`/api/catalogue/offerings/${offering._id}`, { token })); } catch (e) { setDetails({ error: e.message }); } };
  const togglePublish = async (offering) => { try { await api(`/api/catalogue/offerings/${offering._id}/publish`, { token, method: "PATCH", body: { isPublished: !offering.isPublished } }); notify("success", `${offering.course?.code || "Offering"} ${offering.isPublished ? "unpublished" : "published"}.`); load(); } catch (e) { setError(e.message); } };
  const removeOffering = async () => { if (!confirmingDelete) return; setDeleting(true); setDeleteError(""); try { await waitForPaperToss(); await api(`/api/catalogue/offerings/${confirmingDelete._id}`, { token, method: "DELETE" }); notify("success", `${confirmingDelete.course?.code || "Offering"} deleted.`); setConfirmingDelete(null); load(); } catch (e) { setDeleteError(e.message); } finally { setDeleting(false); } };
  const afterSave = (message) => { notify("success", message); setCreating(false); setDetails(null); load(); };
  return <div className="page-stack"><div className="page-title-row"><div><p className="eyebrow">OFFERINGS</p><h1>Course offerings</h1><p className="page-description">Create term offerings, manage course groups, and publish the catalogue.</p></div><div className="form-actions"><button className="outline-button" type="button" disabled={!termSummary || loading} onClick={() => setDuplicating(true)}>Duplicate offerings</button><button className="primary-button" type="button" disabled={!termSummary || loading} onClick={() => setCreating(true)}>Create offering</button></div></div>
    <section className="panel term-picker"><form className="inline-controls" onSubmit={load}><label className="field"><span>Target academic term</span><select required value={termId} onChange={(event) => { setTermId(event.target.value); setTermSummary(null); setOfferings([]); load(undefined, event.target.value); }}><option value="">Select a target term</option>{terms.map(term => <option key={term._id} value={term.code}>{pretty(term.season)} {term.academicYear}</option>)}</select></label></form><p className="helper-text">Offerings load automatically for the selected term. Choose a previous source term below to duplicate courses.</p></section>
    {termSummary && duplicating && <DuplicateOfferings key={termSummary._id} token={token} target={termSummary} targetOfferings={offerings} loading={loading} onClose={() => setDuplicating(false)} onCopied={() => load(undefined, termSummary.code)} />}
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel results-panel"><div className="results-heading"><div><p className="eyebrow">TERM OFFERINGS</p><h2>Course groups</h2></div><span className="result-count">{loading ? "Loading" : `${offerings.length} offerings`}</span></div>{loading ? <Loading /> : offerings.length === 0 ? <div className="offering-empty" role="status"><img src="/portal-studio/images/extra-hours-folder.svg" alt="" width="100" height="76" /><h3>No offerings yet</h3><p>This term’s course register is empty. Use Create offering or Duplicate offerings above to get started.</p></div> : <div className="table-scroll offering-register"><table><thead><tr><th>Course</th><th>Credits</th><th>Groups</th><th>Instructors</th><th>Status</th><th>Actions</th></tr></thead><tbody>{offerings.map(offering => <tr key={offering._id}>
      <td><div className="offering-course-identity"><OfferingCourseIcon code={offering.course?.code} /><div><strong>{offering.course?.name || "Course offering"}</strong><span className="secondary-text">{offering.course?.code}</span></div></div></td>
      <td>{offering.course?.creditHours ?? "—"}</td><td>{(offering.slots || []).length}</td><td>{(offering.instructors || []).map(person => person.fullName).join(", ") || "Not assigned"}</td>
      <td><span className={`status-pill ${offering.isPublished ? "good" : "muted"}`}>{offering.isPublished ? "Published" : "Draft"}</span></td>
      <td><div className="table-actions"><button type="button" className="text-button" onClick={() => openDetails(offering)}>Manage</button><button type="button" className="text-button" onClick={() => togglePublish(offering)}>{offering.isPublished ? "Unpublish" : "Publish"}</button><PaperTossButton label={`Delete ${offering.course?.code || 'course'} offering`} onClick={() => { setDeleteError(""); setConfirmingDelete(offering); }}>Delete</PaperTossButton></div></td>
    </tr>)}</tbody></table></div>}</section>
    {creating && <OfferingModal token={token} courses={courses} termId={termId} term={termSummary} onClose={() => setCreating(false)} onSaved={() => afterSave("Course offering created.")} />}
    {details && <OfferingDetailsModal token={token} offering={details} onClose={() => setDetails(null)} onChanged={afterSave} />}
    {confirmingDelete && <Modal title="Delete course offering?" eyebrow="REMOVE OFFERING" onClose={() => !deleting && setConfirmingDelete(null)}>
      <div className="confirmation-content"><span className="confirmation-icon" aria-hidden="true">!</span><div><p>Remove <strong>{confirmingDelete.course?.code || "this course"}</strong> from <strong>{termLabel(confirmingDelete.term || termSummary)}</strong>?</p><p className="helper-text">This also removes its lecture, tutorial, and lab groups. The API will block deletion if the offering is still referenced by schedules or templates.</p></div></div>
      {deleteError && <div className="feedback error" role="alert">{deleteError}</div>}
      <div className="form-footer"><button type="button" className="outline-button" disabled={deleting} onClick={() => setConfirmingDelete(null)}>Cancel</button><PaperTossButton disabled={deleting} tossing={deleting} onClick={removeOffering}>{deleting ? "Deleting…" : "Delete offering"}</PaperTossButton></div>
    </Modal>}
  </div>;
}

function DuplicateOfferings({ token, target, targetOfferings, loading, onCopied, onClose }) {
  const [terms, setTerms] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [fetching, setFetching] = useState(true);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    api("/api/academic-terms/academicTerm", { token, signal: controller.signal })
      .then(setTerms)
      .catch((failure) => { if (failure.name !== "AbortError") setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!sourceId) return;
    const controller = new AbortController();
    api(`/api/catalogue/offerings?termId=${encodeURIComponent(sourceId)}`, { token, signal: controller.signal })
      .then(({ offerings }) => {
        if (controller.signal.aborted) return;
        const rows = offerings.filter((offering) => offering.course);
        setPreview(rows);
        setSelectedIds(rows.map((offering) => offering._id));
      })
      .catch((failure) => {
        if (!controller.signal.aborted) { setError(failure.message); setPreview([]); }
      });
    return () => controller.abort();
  }, [sourceId, token]);

  const targetCourseIds = new Set(targetOfferings.map((offering) => offering.course?._id));
  const sources = terms.filter((term) => ["winter", "spring", "summer"].includes(term.season) && Date.parse(term.termStart) < Date.parse(target.termStart));
  async function copy(event) {
    event.preventDefault();
    const source = sources.find((term) => term._id === sourceId);
    if (!source || !selectedIds.length) return;
    setCopying(true);
    setError("");
    setResult(null);
    try {
      setResult(await api("/api/catalogue/offerings/duplicate", {
        token, method: "POST", body: { sourceAcademicYear: source.academicYear, sourceSeason: source.season, targetTermId: target._id, offeringIds: selectedIds },
      }));
      await onCopied();
    } catch (failure) { setError(failure.message); }
    finally { setCopying(false); }
  }

  return <Modal title="Duplicate course offerings" eyebrow="COURSE OFFERINGS" onClose={() => !copying && onClose()} wide><div className="offering-copy-dialog">
    <p className="helper-text">Choose which courses to copy as unpublished drafts. Existing offerings are skipped.</p>
    <form className="form-stack" onSubmit={copy}>
      <label className="field"><span>Source academic year and season</span><select required value={sourceId} disabled={fetching || copying} onChange={(event) => {
        setSourceId(event.target.value);
        setPreview(null);
        setSelectedIds([]);
        setResult(null);
        setError("");
      }}>
        <option value="">{fetching ? "Loading terms…" : sources.length ? "Select a previous term" : "No previous terms found"}</option>
        {sources.map((term) => <option key={term._id} value={term._id}>{pretty(term.season)} {term.academicYear}</option>)}
      </select></label>
      {sourceId && !preview && <p role="status">Loading source offerings…</p>}
      {preview?.length === 0 && !error && <p>No offerings in this source term.</p>}
      {preview?.length > 0 && <fieldset className="form-stack" disabled={copying}>
        <legend>Courses to copy</legend>
        <div className="table-actions">
          <button className="text-button" type="button" onClick={() => setSelectedIds(preview.map(({ _id }) => _id))}>Select all</button>
          <button className="text-button" type="button" onClick={() => setSelectedIds([])}>Clear selection</button>
        </div>
        {preview.map((offering) => <label key={offering._id}>
          <input type="checkbox" checked={selectedIds.includes(offering._id)} onChange={(event) => {
            const checked = event.target.checked;
            setSelectedIds((current) => checked ? [...current, offering._id] : current.filter((id) => id !== offering._id));
          }} />
          {" "}<OfferingCourseIcon code={offering.course.code} /><strong>{offering.course.code}</strong> · {offering.course.name} · {offering.slots.length} groups
          {targetCourseIds.has(offering.course._id) && <span className="secondary-text">Already in target · will be skipped</span>}
        </label>)}
      </fieldset>}
      <div><button className="outline-button" type="submit" disabled={loading || copying || !selectedIds.length}>{copying ? "Copying…" : `Copy selected as drafts (${selectedIds.length})`}</button></div>
    </form>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {result && <div role="status">
      <p>{result.created.length} draft offerings created. {result.skipped.length} existing offerings skipped.</p>
      {result.skipped.length > 0 && <p className="helper-text">Skipped {result.skipped.join(", ")}.</p>}
      {result.conflicts.length > 0 && <div className="feedback warning"><strong>Conflicts to review</strong><ul>{result.conflicts.map((conflict, index) => <li key={index}>{conflict.courseCode} {conflict.componentType} {conflict.groupNumber} overlaps {conflict.otherCourseCode}. {conflict.message}</li>)}</ul></div>}
    </div>}
  </div></Modal>;
}

const blankTemplate = { major: "", semester: "", studyGroup: "", isPublished: false };
const templateDays = [...week.slice(5), ...week.slice(0, 5)];
const templateStatus = [
  { label: "All templates", value: "all" },
  { label: "Published", value: "published" },
  { label: "Drafts", value: "draft" },
];

function templateMatches(template, query) {
  const terms = query.trim().toLowerCase().split(/\s+/);
  const courses = (template.courses || []).map(entry => `${entry.course?.code || ""} ${entry.course?.name || ""}`).join(" ");
  const text = `Group ${template.studyGroup} ${template.major} Semester ${template.semester} ${courses}`.toLowerCase();
  return terms.every(term => text.includes(term));
}

function templateMeeting(entry, slot) {
  return entry.courseOffering?.slots?.find(group => group._id === slot.slotGroupId);
}

function TemplateStatus({ published }) {
  return <span className={`status-pill ${published ? "good" : "draft"}`}>{published ? "Published" : "Draft"}</span>;
}

function TemplateMeetingTime({ meeting }) {
  return <span className="template-meeting-time">
    <span>{minutesToTime(meeting.startMinute)}–{minutesToTime(meeting.endMinute)}</span>
    {meeting.room && <span>{meeting.room}</span>}
  </span>;
}

function TemplateCourses({ template }) {
  const [view, setView] = useState("courses");
  const courses = template.courses || [];
  const meetings = courses.flatMap(entry => (entry.slots || []).flatMap(slot => {
    const meeting = templateMeeting(entry, slot);
    return meeting ? [{ entry, meeting }] : [];
  }));

  return <section className="template-course-sheet" aria-labelledby="template-course-heading">
    <div className="template-course-toolbar">
      <h3 id="template-course-heading">{view === "courses" ? `Courses for Group ${template.studyGroup}` : `Teaching week for Group ${template.studyGroup}`}</h3>
      <div className="template-view-switch" role="group" aria-label="Schedule view">
        <button type="button" aria-pressed={view === "courses"} onClick={() => setView("courses")}>Courses</button>
        <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Teaching week</button>
      </div>
    </div>
    {view === "courses" ? <>
      {courses.length ? <ul className="template-course-list" role="list">{courses.map((entry, index) => <li key={entry.course?._id || index}>
        <div className="template-course-identity">
          <OfferingCourseIcon code={entry.course?.code} />
          <div><strong>{entry.course?.name || "Course unavailable"}</strong>{entry.course?.code && <small>{entry.course.code}</small>}</div>
        </div>
        <ul className="template-assigned-groups" role="list" aria-label="Assigned meeting groups">
          {(entry.slots || []).map(slot => {
            const meeting = templateMeeting(entry, slot);
            return <li key={slot.slotGroupId}>
              <strong>{pretty(slot.componentType)}{meeting ? ` ${meeting.groupNumber}` : ""}</strong>
              {meeting ? <div><span>{meeting.day}</span><TemplateMeetingTime meeting={meeting} /></div> : <span>Group unavailable</span>}
            </li>;
          })}
        </ul>
      </li>)}</ul> : <p className="template-muted">No courses in this template.</p>}
    </> : meetings.length ? <div className="template-teaching-week">
      {templateDays.map(day => {
        const daily = meetings.filter(({ meeting }) => meeting.day === day).sort((left, right) => left.meeting.startMinute - right.meeting.startMinute);
        if (!daily.length) return null;
        return <section key={day} className="template-teaching-day">
          <h4>{day}</h4>
          <ul role="list">{daily.map(({ entry, meeting }) => <li key={meeting._id}>
            <div className="template-course-identity">
              <OfferingCourseIcon code={entry.course?.code} />
              <div><strong>{entry.course?.name || "Course unavailable"}</strong><small>{pretty(meeting.componentType)} {meeting.groupNumber}</small></div>
            </div>
            <TemplateMeetingTime meeting={meeting} />
          </li>)}</ul>
        </section>;
      })}
    </div> : <p className="template-muted">No meeting times available.</p>}
  </section>;
}

function TemplatesWorkspace({ token, notify }) {
  const [termOptions, setTermOptions] = useState([]);
  const [termId, setTermId] = useState("");
  const [termsLoading, setTermsLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const loadVersion = useRef(0);
  const indexRef = useRef(null);
  const inspectorRef = useRef(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(blankTemplate);
  const [selectedOffers, setSelectedOffers] = useState([]);
  const [slotSelections, setSlotSelections] = useState({});
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    api("/api/academic-terms/academicTerm", { token, signal: controller.signal }).then(terms => {
      setTermOptions(terms);
      const term = terms.find(item => item.isActive) || terms[0];
      if (term) {
        setLoading(true);
        setTermId(term.code);
      }
    }).catch(e => {
      if (!controller.signal.aborted) setError(explainApiError(e, "Academic terms"));
    }).finally(() => {
      if (!controller.signal.aborted) setTermsLoading(false);
    });
    return () => controller.abort();
  }, [token]);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (!termId) return;
    const version = ++loadVersion.current;
    if (!refresh) setLoading(true);
    setError("");
    try {
      const [templateData, offeringData] = await Promise.all([
        api(`/api/academics/schedule-templates?termId=${encodeURIComponent(termId)}`, { token }),
        api(`/api/catalogue/offerings?termId=${encodeURIComponent(termId)}&publishedOnly=true`, { token }),
      ]);
      if (version !== loadVersion.current) return;
      setTemplates(templateData.templates || []);
      setOfferings(offeringData.offerings || []);
    } catch (e) {
      if (version === loadVersion.current) setError(explainApiError(e, "Schedule templates"));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [termId, token]);

  useEffect(() => { load(); return () => { loadVersion.current++; }; }, [load]);

  const selectTerm = (event) => {
    if (event.target.value === termId) return;
    setTemplates([]);
    setOfferings([]);
    setSelectedTemplateId("");
    setInspecting(false);
    setLoading(true);
    setTermId(event.target.value);
  };

  // The paper inspector replaces the index at narrow container widths.
  const selectTemplate = (template) => {
    setSelectedTemplateId(template._id);
    setInspecting(true);
    requestAnimationFrame(() => {
      const inspector = inspectorRef.current;
      if (inspector?.querySelector(".template-back").getClientRects().length) {
        inspector.querySelector("h2").focus();
      }
    });
  };

  const backToIndex = () => {
    setInspecting(false);
    requestAnimationFrame(() => indexRef.current?.querySelector('[aria-pressed="true"].template-identity')?.focus());
  };

  const clearEditor = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
    setForm(blankTemplate);
    setSelectedOffers([]);
    setSlotSelections({});
    setEditorError("");
  };

  const addOffering = (event) => {
    const id = event.target.value;
    if (!id || selectedOffers.includes(id)) return;
    const offering = offerings.find(item => item._id === id);
    if (!offeringMatchesMajor(offering, form.major)) {
      setEditorError(`${offering?.course?.code || "This course"} is not listed for the template major ${form.major.trim()}.`);
      return;
    }
    setEditorError("");
    setSelectedOffers(current => [...current, id]);
    setSlotSelections(current => ({ ...current, [id]: {} }));
  };

  const removeSelected = (id) => {
    setSelectedOffers(current => current.filter(value => value !== id));
    setSlotSelections(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
    setEditorError("");
  };

  const editTemplate = (template) => {
    const nextSelections = {};
    const ids = [];
    for (const [index, entry] of (template.courses || []).entries()) {
      const id = entry.courseOffering?._id || entry.courseOffering || `unavailable-${index}`;
      const choices = {};
      for (const slot of entry.slots || []) if (!choices[slot.componentType]) choices[slot.componentType] = String(slot.slotGroupId);
      nextSelections[id] = choices;
      ids.push(id);
    }
    setEditingTemplate(template);
    setEditorOpen(true);
    setForm({ major: template.major || "", semester: String(template.semester || ""), studyGroup: template.studyGroup || "", isPublished: Boolean(template.isPublished) });
    setSelectedOffers(ids);
    setSlotSelections(nextSelections);
    setEditorError("");
  };

  const revealSavedTemplate = (template) => {
    setTemplates(current => current.some(item => item._id === template._id)
      ? current.map(item => item._id === template._id ? template : item)
      : [...current, template]);
    setSelectedTemplateId(template._id);
    if (!templateMatches(template, query)) setQuery("");
    if (status !== "all") setStatus(template.isPublished ? "published" : "draft");
  };

  const saveTemplate = async (event) => {
    event.preventDefault();
    setEditorError("");
    if (!selectedOffers.length) {
      setEditorError("Add at least one course to the schedule template.");
      return;
    }
    const courses = [];
    for (const id of selectedOffers) {
      const offering = offerings.find(entry => entry._id === id);
      if (!offering) {
        setEditorError("Remove the unavailable offering or replace it with a published offering before saving.");
        return;
      }
      if (!offeringMatchesMajor(offering, form.major)) {
        setEditorError(`${offering.course?.code || "This course"} is not listed for the template major ${form.major.trim()}. Remove it or correct the major before saving.`);
        return;
      }
      const selectedSlots = [];
      for (const componentType of offeringComponentTypes(offering)) {
        const slotId = slotSelections[id]?.[componentType];
        if (!slotId) {
          setEditorError(`Choose one ${pretty(componentType)} group for ${offering.course?.code || "each selected course"}.`);
          return;
        }
        const slot = offering.slots.find(candidate => candidate._id === slotId);
        if (!slot) {
          setEditorError(`The selected ${pretty(componentType)} group no longer exists. Reload the term.`);
          return;
        }
        selectedSlots.push({ componentType, slotGroupId: slot._id, courseOffering: id });
      }
      courses.push({ course: offering.course?._id || offering.course, courseOffering: id, slots: selectedSlots });
    }

    const payload = {
      ...(editingTemplate ? {} : { term: termId.trim() }),
      major: form.major.trim(), semester: Number(form.semester), studyGroup: form.studyGroup.trim(),
      courses, isPublished: form.isPublished,
    };
    setSaving(true);
    try {
      const saved = await api(editingTemplate ? `/api/academics/schedule-templates/${editingTemplate._id}` : "/api/academics/schedule-templates", {
        token, method: editingTemplate ? "PUT" : "POST", body: payload,
      });
      revealSavedTemplate(saved);
      notify("success", editingTemplate ? "Schedule template updated." : "Schedule template created.");
      clearEditor();
      selectTemplate(saved);
      await load({ refresh: true });
    } catch (e) {
      setEditorError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (template) => {
    if (publishing) return;
    setPublishing(true);
    setError("");
    try {
      const saved = await api(`/api/academics/schedule-templates/${template._id}`, { token, method: "PUT", body: { isPublished: !template.isPublished } });
      revealSavedTemplate(saved);
      notify("success", `Template ${saved.isPublished ? "published" : "unpublished"}.`);
      await load({ refresh: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const deleteTemplate = async () => {
    if (!confirmingDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await waitForPaperToss();
      await api(`/api/academics/schedule-templates/${confirmingDelete._id}`, { token, method: "DELETE" });
      setTemplates(current => current.filter(template => template._id !== confirmingDelete._id));
      setSelectedTemplateId("");
      setConfirmingDelete(null);
      setInspecting(false);
      notify("success", "Schedule template deleted.");
      await load({ refresh: true });
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const selectedTerm = termOptions.find(term => term.code === termId);
  const matches = templates.filter(template => templateMatches(template, query));
  const counts = {
    all: matches.length,
    published: matches.filter(template => template.isPublished).length,
  };
  counts.draft = counts.all - counts.published;
  const visibleTemplates = matches.filter(template => status === "all" || Boolean(template.isPublished) === (status === "published"));
  const selectedTemplate = visibleTemplates.find(template => template._id === selectedTemplateId)
    || visibleTemplates.find(template => template.isPublished) || visibleTemplates[0];
  const isBusy = saving || publishing || deleting;
  const canCreate = Boolean(termId && !loading && !termsLoading);
  const submitLabel = editingTemplate
    ? editingTemplate.isPublished === form.isPublished ? "Save changes" : form.isPublished ? "Save and publish" : "Save and unpublish"
    : form.isPublished ? "Create and publish" : "Save draft";

  const selectedCourses = selectedOffers.map((id, index) => {
    const offering = offerings.find(item => item._id === id);
    const original = editingTemplate?.courses?.find(entry => (entry.courseOffering?._id || entry.courseOffering) === id)
      || (id.startsWith("unavailable-") ? editingTemplate.courses[Number(id.split("-")[1])] : null);
    return { id, offering, course: offering?.course || original?.course, index };
  });

  return <div className="template-register" data-inspecting={Boolean(inspecting && selectedTemplate)}>
    <PageTitle title="Schedule templates" description="Standard schedules for normal students, organized by major, semester, and study group." action={
      <button className="primary-button template-create" type="button" disabled={!canCreate || isBusy} onClick={() => { clearEditor(); setEditorOpen(true); }}>
        Create template
      </button>
    } />
    <div className="template-scope">
      <Field label="Academic term">
        <select required value={termId} disabled={termsLoading || isBusy} onChange={selectTerm}>
          <option value="" disabled>Choose a term</option>
          {termOptions.map(term => <option key={term._id} value={term.code}>{termLabel(term)}{term.isActive ? " · Active" : ""}</option>)}
        </select>
      </Field>
      <Field label="Find a template" className="template-search">
        <input type="search" placeholder="Group, major, semester or course" value={query} disabled={!termId || isBusy}
          onChange={event => { setQuery(event.target.value); setInspecting(false); }} />
      </Field>
    </div>
    {error && <div className="feedback error template-feedback" role="alert">{error}{termId && <button className="outline-button" type="button" onClick={() => load()}>Retry</button>}</div>}
    {termsLoading || loading ? <Loading /> : !termId ? !error && <div className="register-empty"><h3>No academic terms</h3><p>Schedule templates are filed by academic term.</p></div> : <>
      <div className="template-filters" role="group" aria-label="Filter by publication status">
        {templateStatus.map(filter => <button key={filter.value} type="button" aria-pressed={status === filter.value} disabled={isBusy}
          onClick={() => { setStatus(filter.value); setInspecting(false); }}>
          <span>{filter.label}</span><span className="template-filter-count">{counts[filter.value]}</span>
        </button>)}
      </div>
      {selectedTemplate ? <div className="template-library">
        <section className="template-index" aria-label="Templates for this term" ref={indexRef}>
          <div className="template-index-labels" aria-hidden="true"><span>Study group</span><span>Publication</span></div>
          <ul role="list">{visibleTemplates.map(template => {
            const isSelected = template._id === selectedTemplate._id;
            const labelId = `template-label-${template._id}`;
            const statusId = `template-status-${template._id}`;
            return <li key={template._id}>
              <button className="template-identity" type="button" aria-pressed={isSelected} aria-controls="template-inspector"
                aria-labelledby={labelId} aria-describedby={statusId} disabled={isBusy} onClick={() => selectTemplate(template)}>
                <span id={labelId}><strong>Group {template.studyGroup}</strong><small>{template.major} · Semester {template.semester}</small></span>
                <span id={statusId}><TemplateStatus published={template.isPublished} /></span>
              </button>
            </li>;
          })}</ul>
        </section>
        <section className="template-inspector" id="template-inspector" aria-label="Selected schedule template" ref={inspectorRef}>
          <button type="button" className="text-button template-back" onClick={backToIndex}><span aria-hidden="true">←</span> Back to templates</button>
          <div className="template-paper">
            <header className="template-paper-head">
              <div>
                <p className="template-sheet-term">{termLabel(selectedTemplate.term || selectedTerm)}</p>
                <h2 tabIndex="-1">Group {selectedTemplate.studyGroup}</h2>
                <p className="template-sheet-cohort">{selectedTemplate.major} <span aria-hidden="true">·</span> Semester {selectedTemplate.semester}</p>
              </div>
              <TemplateStatus published={selectedTemplate.isPublished} />
            </header>
            <div className="template-paper-actions" role="group" aria-label={`Actions for Group ${selectedTemplate.studyGroup}`}>
              <button className="outline-button" type="button" disabled={isBusy} onClick={() => editTemplate(selectedTemplate)}>Edit template</button>
              <button className={selectedTemplate.isPublished ? "outline-button" : "primary-button"} type="button" disabled={isBusy}
                onClick={() => togglePublished(selectedTemplate)}>{selectedTemplate.isPublished ? "Unpublish template" : "Publish template"}</button>
              <PaperTossButton disabled={isBusy} label={`Delete template for ${selectedTemplate.major}, semester ${selectedTemplate.semester}, group ${selectedTemplate.studyGroup}`}
                onClick={() => { setConfirmingDelete(selectedTemplate); setDeleteError(""); }}>Delete</PaperTossButton>
              <p>{selectedTemplate.isPublished ? "Available for new group assignments." : "Publish to make this template available for group assignments."}</p>
            </div>
            <TemplateCourses key={selectedTemplate._id} template={selectedTemplate} />
          </div>
        </section>
      </div> : !error && <div className="register-empty">
        <img src="/portal-studio/images/extra-hours-folder.svg" alt="" width="144" height="105" />
        <h3>{templates.length ? "No matching templates" : "No schedule templates"}</h3>
        <p>{templates.length ? "Change the search or publication filter to see more templates." : "Create a template using this term’s published course offerings."}</p>
        {templates.length > 0 && <button className="outline-button" type="button" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button>}
      </div>}
    </>}
    {editorOpen && <Modal title={editingTemplate ? "Update schedule template" : "Create schedule template"}
      description={termLabel(selectedTerm)} onClose={() => !saving && clearEditor()} wide className="template-editor">
      <form className="template-editor-form" onSubmit={saveTemplate}>
        <div className="template-editor-body">
          <section className="template-editor-cohort" aria-labelledby="template-cohort-heading">
            <h3 id="template-cohort-heading">Student cohort</h3>
            <div className="form-grid template-editor-identity">
              <Field label="Major"><input required value={form.major} onChange={event => { setForm({ ...form, major: event.target.value }); setEditorError(""); }} placeholder="Computer Science" /></Field>
              <Field label="Semester"><input required type="number" min="1" max="10" step="1" value={form.semester} onChange={event => setForm({ ...form, semester: event.target.value })} placeholder="4" /></Field>
              <Field label="Study group"><input required value={form.studyGroup} onChange={event => setForm({ ...form, studyGroup: event.target.value })} placeholder="G1" /></Field>
            </div>
          </section>
          <section className="template-editor-courses" aria-labelledby="template-editor-courses-heading">
            <h3 id="template-editor-courses-heading">Courses and meeting groups</h3>
            <Field label="Add published offering">
              <select value="" onChange={addOffering} disabled={!offerings.length}>
                <option value="">{offerings.length ? "Choose a course" : "No published offerings for this term"}</option>
                {offerings.map(offering => {
                  const wrongMajor = !offeringMatchesMajor(offering, form.major);
                  return <option key={offering._id} value={offering._id} disabled={!offering.isPublished || selectedOffers.includes(offering._id) || wrongMajor}>
                    {offering.course?.code} · {offering.course?.name}{!offering.isPublished ? " (draft)" : wrongMajor ? " (different major)" : ""}
                  </option>;
                })}
              </select>
            </Field>
            {selectedCourses.length ? <ul className="template-editor-course-list" role="list">{selectedCourses.map(({ id, offering, course }) => <li key={id}>
              <div className="template-editor-course-heading">
                <div className="template-course-identity"><OfferingCourseIcon code={course?.code} />
                  <div><strong>{course?.name || "Course unavailable"}</strong>{course?.code && <small>{course.code}</small>}</div>
                </div>
                <button type="button" className="text-button danger-text" onClick={() => removeSelected(id)} aria-label={`Remove ${course?.name || "course"}`}>Remove</button>
              </div>
              {offering ? <fieldset className="template-editor-groups">
                <legend>Meeting groups</legend>
                <div className="form-grid">{offeringComponentTypes(offering).map(componentType => <Field key={componentType} label={`${pretty(componentType)} group`}>
                  <select required value={slotSelections[id]?.[componentType] || ""} onChange={event => setSlotSelections(current => ({ ...current, [id]: { ...current[id], [componentType]: event.target.value } }))}>
                    <option value="">Choose a group</option>
                    {offering.slots.filter(slot => slot.componentType === componentType).map(slot => <option key={slot._id} value={slot._id}>
                      {slot.groupNumber} · {slot.day} · {minutesToTime(slot.startMinute)}–{minutesToTime(slot.endMinute)}{slot.room ? ` · ${slot.room}` : ""}
                    </option>)}
                  </select>
                </Field>)}</div>
              </fieldset> : <p className="template-muted">This offering is no longer available. Remove it before saving.</p>}
            </li>)}</ul> : <p className="template-muted">Add at least one course and choose a group for every meeting type.</p>}
          </section>
          <fieldset className="template-editor-publication">
            <legend>Publication status</legend>
            <div>{[
              { label: "Draft", description: "Keep this schedule in the template library.", published: false },
              { label: "Published", description: "Make this template available for new group assignments.", published: true },
            ].map(({ label, description, published }) => <label key={label}>
              <input type="radio" name="template-publication" aria-label={label} aria-describedby={`template-publication-${label}`}
                checked={form.isPublished === published} onChange={() => setForm({ ...form, isPublished: published })} />
              <span><strong>{label}</strong><small id={`template-publication-${label}`}>{description}</small></span>
            </label>)}</div>
          </fieldset>
        </div>
        <div className="template-editor-footer">
          {editorError && <div className="feedback error" role="alert">{editorError}</div>}
          <div className="form-footer">
            <button className="outline-button" type="button" onClick={clearEditor} disabled={saving}>Cancel</button>
            <button className="primary-button" disabled={saving || !termId.trim()}>{saving ? "Saving…" : submitLabel}</button>
          </div>
        </div>
      </form>
    </Modal>}
    {confirmingDelete && <Modal title="Delete schedule template?" onClose={() => !deleting && setConfirmingDelete(null)}>
      <div className="confirmation-content"><span className="confirmation-icon" aria-hidden="true">!</span><div><p>Delete the template for <strong>{confirmingDelete.major}</strong>, semester <strong>{confirmingDelete.semester}</strong>, group <strong>{confirmingDelete.studyGroup}</strong>?</p><p className="helper-text">Reassign any student schedules using this template before deleting it.</p></div></div>
      {deleteError && <div className="feedback error" role="alert">{deleteError}</div>}
      <div className="form-footer"><button type="button" className="outline-button" disabled={deleting} onClick={() => setConfirmingDelete(null)}>Cancel</button><PaperTossButton disabled={deleting} tossing={deleting} onClick={deleteTemplate}>{deleting ? "Deleting…" : "Delete template"}</PaperTossButton></div>
    </Modal>}
  </div>;
}

function offeringComponentTypes(offering) {
  return [...new Set((offering?.slots || []).map((slot) => slot.componentType))];
}

function OfferingModal({ token, courses, termId, term, onClose, onSaved }) {
  const [slots, setSlots] = useState([emptySlot("1")]); const [isPublished, setIsPublished] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const setSlot = (index, key, value) => setSlots((current) => current.map((slot, position) => {
    if (position !== index) return slot;
    if (key === "componentType") return { ...slot, componentType: value, groupNumber: slot.groupNumberEdited ? slot.groupNumber : nextGroupNumber(current, index, value) };
    if (key === "groupNumber") return { ...slot, groupNumber: value, groupNumberEdited: true };
    return { ...slot, [key]: value };
  }));
  const addSlot = () => setSlots((current) => [...current, emptySlot(nextGroupNumber(current, -1, "lecture"))]);
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const instructors = splitLines(form.get("instructors")).map((line) => { const [fullName, email] = line.split("|").map((part) => part.trim()); return { fullName, ...(email ? { email } : {}) }; }); const eligibleGroups = splitLines(form.get("eligibleGroups")).map((line) => { const [major, semester, studyGroup] = line.split("|").map((part) => part.trim()); return { major, ...(semester ? { semester: Number(semester) } : {}), ...(studyGroup ? { studyGroup } : {}) }; }); const payload = { course: form.get("course"), term: termId.trim(), instructors, eligibleGroups, isPublished, slots: slots.map((slot) => ({ componentType: slot.componentType, groupNumber: slot.groupNumber.trim(), day: slot.day, startMinute: timeToMinutes(slot.startTime), endMinute: timeToMinutes(slot.endTime), room: slot.room.trim(), capacity: Number(slot.capacity) })) }; try { await api("/api/catalogue/offerings", { token, method: "POST", body: payload }); onSaved(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  return <Modal title="Create course offering" eyebrow="COURSE OFFERING" onClose={onClose} wide><form className="form-stack offering-create-form" onSubmit={submit}><div className="form-grid"><Field label="Course"><select name="course" required defaultValue=""><option value="" disabled>Choose a course</option>{courses.map((course) => <option key={course._id} value={course._id}>{course.code} · {course.name}</option>)}</select></Field><Field label="Academic term"><input value={[pretty(term?.season), term?.academicYear].filter(Boolean).join(" ")} readOnly /></Field><Field label="Publication status"><select value={isPublished ? "published" : "draft"} onChange={(event) => setIsPublished(event.target.value === "published")}><option value="draft">Draft</option><option value="published">Published</option></select></Field><Field label="Instructors"><textarea name="instructors" rows={3} placeholder="Dr. Sara Hassan | sara.hassan@guc.edu.eg" /><small>One instructor per line: Name | email</small></Field><Field label="Eligible student groups"><textarea name="eligibleGroups" rows={3} placeholder="Computer Science | 4 | G1" /><small>One group per line: Major | semester | group</small></Field></div><div className="slot-editor-heading"><div><p className="eyebrow">MEETING TIMES</p><h3>Course groups</h3></div><button className="outline-button small-button" type="button" onClick={addSlot}>＋ Add group</button></div>{slots.map((slot, index) => <SlotFields key={index} index={index} slot={slot} onChange={setSlot} onRemove={() => setSlots((current) => current.filter((_, i) => i !== index))} canRemove={slots.length > 1} />)}{error && <div className="feedback error" role="alert">{error}</div>}<FormFooter onCancel={onClose} busy={saving} submitText="Create offering" /></form></Modal>;
}

function OfferingDetailsModal({ token, offering, onClose, onChanged }) {
  const [error, setError] = useState(""); const [busySlot, setBusySlot] = useState(""); const [instructors, setInstructors] = useState(""); const [groups, setGroups] = useState(""); const [savingMeta, setSavingMeta] = useState(false); const [addingGroups, setAddingGroups] = useState(false); const [newSlots, setNewSlots] = useState([]); const [savingGroups, setSavingGroups] = useState(false); const [removeSlotTarget, setRemoveSlotTarget] = useState(null); const [removingSlot, setRemovingSlot] = useState(false); const [removeSlotError, setRemoveSlotError] = useState("");
  useEffect(() => { if (!offering?.loading && !offering?.error) { setInstructors((offering.instructors || []).map((item) => `${item.fullName}${item.email ? ` | ${item.email}` : ""}`).join("\n")); setGroups((offering.eligibleGroups || []).map((item) => `${item.major} | ${item.semester || ""} | ${item.studyGroup || ""}`).join("\n")); } }, [offering]);
  if (offering?.loading) return <Modal title="Offering details" eyebrow="COURSE OFFERING" onClose={onClose}><Loading /></Modal>;
  if (offering?.error) return <Modal title="Offering details" eyebrow="COURSE OFFERING" onClose={onClose}><div className="feedback error" role="alert">{offering.error}</div></Modal>;
  const saveMeta = async (event) => { event.preventDefault(); setSavingMeta(true); setError(""); const form = new FormData(event.currentTarget); const instructorsPayload = splitLines(form.get("instructors")).map((line) => { const [fullName, email] = line.split("|").map((part) => part.trim()); return { fullName, ...(email ? { email } : {}) }; }); const groupsPayload = splitLines(form.get("eligibleGroups")).map((line) => { const [major, semester, studyGroup] = line.split("|").map((part) => part.trim()); return { major, ...(semester ? { semester: Number(semester) } : {}), ...(studyGroup ? { studyGroup } : {}) }; }); try { await api(`/api/catalogue/offerings/${offering._id}`, { token, method: "PUT", body: { instructors: instructorsPayload, eligibleGroups: groupsPayload } }); onChanged("Offering details saved."); } catch (e) { setError(e.message); } finally { setSavingMeta(false); } };
  const addNewGroup = () => {
    setNewSlots((current) => [...current, emptySlot(nextGroupNumber([...(offering.slots || []), ...current], -1, "lecture"))]);
    setAddingGroups(true);
  };
  const changeNewSlot = (index, key, value) => setNewSlots((current) => current.map((slot, position) => {
    if (position !== index) return slot;
    if (key === "componentType") return { ...slot, componentType: value, groupNumber: slot.groupNumberEdited ? slot.groupNumber : nextGroupNumber([...(offering.slots || []), ...current], index + (offering.slots || []).length, value) };
    if (key === "groupNumber") return { ...slot, groupNumber: value, groupNumberEdited: true };
    return { ...slot, [key]: value };
  }));
  const saveNewGroups = async (event) => {
    event.preventDefault(); setSavingGroups(true); setError("");
    try {
      const slots = newSlots.map((slot) => ({ componentType: slot.componentType, groupNumber: slot.groupNumber.trim(), day: slot.day, startMinute: timeToMinutes(slot.startTime), endMinute: timeToMinutes(slot.endTime), room: slot.room.trim(), capacity: Number(slot.capacity) }));
      await api(`/api/catalogue/offerings/${offering._id}/slots`, { token, method: "POST", body: { slots } });
      onChanged(slots.length === 1 ? "Course group added." : "Course groups added.");
    } catch (e) { setError(e.message); }
    finally { setSavingGroups(false); }
  };
  const updateSlot = async (slotId, event) => { event.preventDefault(); setBusySlot(slotId); setError(""); const form = new FormData(event.currentTarget); try { await api(`/api/catalogue/offerings/${offering._id}/slots/${slotId}`, { token, method: "PUT", body: { componentType: form.get("componentType"), groupNumber: form.get("groupNumber"), day: form.get("day"), startMinute: timeToMinutes(form.get("startTime")), endMinute: timeToMinutes(form.get("endTime")), room: form.get("room"), capacity: Number(form.get("capacity")) } }); onChanged("Course group updated."); } catch (e) { setError(e.message); setBusySlot(""); } };
  const deleteSlot = async () => {
    if (!removeSlotTarget) return;
    setRemovingSlot(true); setRemoveSlotError("");
    try {
      await waitForPaperToss();
      await api(`/api/catalogue/offerings/${offering._id}/slots/${removeSlotTarget._id}`, { token, method: "DELETE" });
      setRemoveSlotTarget(null); onChanged("Course group removed.");
    } catch (e) { setRemoveSlotError(e.message); }
    finally { setRemovingSlot(false); }
  };
  return <Modal title={`${offering.course?.code || "Offering"} · Manage`} eyebrow="COURSE OFFERING" onClose={onClose} wide><div className="offering-detail-head"><div><h3>{offering.course?.name}</h3><p>{termLabel(offering.term)} · {offering.course?.creditHours} credits</p></div><div className="offering-status"><span className="eyebrow">PUBLICATION STATUS</span><span className={`status-pill ${offering.isPublished ? "good" : "muted"}`}>{offering.isPublished ? "Published" : "Draft"}</span></div></div>{error && <div className="feedback error" role="alert">{error}</div>}<form className="form-stack offering-meta-form" onSubmit={saveMeta}><p className="eyebrow">INSTRUCTORS AND ELIGIBLE GROUPS</p><div className="form-grid"><Field label="Instructors · one per line: Name | email"><textarea name="instructors" rows={3} value={instructors} onChange={(e) => setInstructors(e.target.value)} /></Field><Field label="Eligible groups · one per line: Major | semester | group"><textarea name="eligibleGroups" rows={3} value={groups} onChange={(e) => setGroups(e.target.value)} /></Field></div><button className="outline-button" disabled={savingMeta}>{savingMeta ? "Saving…" : "Save offering details"}</button></form><div className="slot-editor-heading"><div><p className="eyebrow">MEETING TIMES</p><h3>Course groups</h3></div><button type="button" className="outline-button small-button" onClick={addNewGroup}>＋ Add group</button></div>{(offering.slots || []).map((slot) => <form className="slot-row slot-row-existing" key={slot._id} onSubmit={(event) => updateSlot(slot._id, event)}><div className="form-grid"><Field label="Component"><select name="componentType" defaultValue={slot.componentType}>{["lecture", "tutorial", "lab"].map((type) => <option value={type} key={type}>{pretty(type)}</option>)}</select></Field><Field label="Group"><input name="groupNumber" required defaultValue={slot.groupNumber} /></Field><Field label="Day"><select name="day" defaultValue={slot.day}>{week.map((day) => <option key={day}>{day}</option>)}</select></Field><Field label="Start"><input name="startTime" type="time" required defaultValue={minutesToTime(slot.startMinute)} /></Field><Field label="End"><input name="endTime" type="time" required defaultValue={minutesToTime(slot.endMinute)} /></Field><Field label="Room"><input name="room" required defaultValue={slot.room} /></Field><Field label="Capacity"><input name="capacity" type="number" min={slot.assignedStudentCount || 0} required defaultValue={slot.capacity} /></Field></div><div className="slot-capacity-summary"><div><span>Assigned student count</span><strong>{slot.assignedStudentCount || 0}</strong></div><div><span>Remaining capacity</span><strong>{slot.remainingCapacity ?? Math.max(0, slot.capacity - (slot.assignedStudentCount || 0))}</strong></div><div className="slot-actions"><PaperTossButton label={`Remove group ${slot.groupNumber} (${pretty(slot.componentType)})`} onClick={() => { setRemoveSlotError(""); setRemoveSlotTarget(slot); }}>Remove group</PaperTossButton><button className="outline-button small-button" disabled={busySlot === slot._id}>{busySlot === slot._id ? "Saving…" : "Update group"}</button></div></div></form>)}{addingGroups && <form className="form-stack new-groups-form" onSubmit={saveNewGroups}><div className="slot-editor-heading"><div><p className="eyebrow">NEW MEETING TIMES</p><h3>Add groups</h3></div><button type="button" className="text-button" onClick={() => { setAddingGroups(false); setNewSlots([]); }}>Cancel</button></div>{newSlots.map((slot, index) => <SlotFields key={index} index={index} slot={slot} onChange={changeNewSlot} onRemove={() => setNewSlots((current) => current.filter((_, position) => position !== index))} canRemove />)}<div className="form-footer"><button type="button" className="outline-button" onClick={addNewGroup}>＋ Add another group</button><button className="primary-button" disabled={savingGroups || !newSlots.length}>{savingGroups ? "Adding…" : "Save groups"}</button></div></form>}<div className="form-footer"><button className="outline-button" type="button" onClick={onClose}>Close</button></div>{removeSlotTarget && <Modal title="Remove this course group?" eyebrow="REMOVE MEETING GROUP" onClose={() => !removingSlot && setRemoveSlotTarget(null)}><div className="confirmation-content"><span className="confirmation-icon" aria-hidden="true">!</span><div><p>Remove <strong>{pretty(removeSlotTarget.componentType)} group {removeSlotTarget.groupNumber}</strong> on <strong>{removeSlotTarget.day}</strong> at <strong>{formatMinutes(removeSlotTarget.startMinute)}–{formatMinutes(removeSlotTarget.endMinute)}</strong>?</p><p className="helper-text">Groups used by students, schedules, or templates cannot be removed. The system will explain what needs to be updated first.</p></div></div>{removeSlotError && <div className="feedback error" role="alert">{removeSlotError}</div>}<div className="form-footer"><button className="outline-button" type="button" disabled={removingSlot} onClick={() => setRemoveSlotTarget(null)}>Cancel</button><PaperTossButton disabled={removingSlot} tossing={removingSlot} onClick={deleteSlot}>{removingSlot ? "Removing…" : "Remove group"}</PaperTossButton></div></Modal>}</Modal>;
}

function SlotFields({ index, slot, onChange, onRemove, canRemove }) {
  const capacity = Number(slot.capacity);
  const remaining = Number.isInteger(capacity) && capacity > 0 ? capacity : 0;
  return <div className="slot-row">{canRemove && <div className="slot-row-title"><button className="text-button danger-text" type="button" onClick={onRemove}>Remove</button></div>}<div className="form-grid"><Field label="Component"><select value={slot.componentType} onChange={(e) => onChange(index, "componentType", e.target.value)}>{["lecture", "tutorial", "lab"].map((type) => <option value={type} key={type}>{pretty(type)}</option>)}</select></Field><Field label={`${pretty(slot.componentType)} group number`}><input required value={slot.groupNumber} onChange={(e) => onChange(index, "groupNumber", e.target.value)} placeholder="1" /></Field><Field label="Day"><select value={slot.day} onChange={(e) => onChange(index, "day", e.target.value)}>{week.map((day) => <option key={day}>{day}</option>)}</select></Field><Field label="Start"><input type="time" required value={slot.startTime} onChange={(e) => onChange(index, "startTime", e.target.value)} /></Field><Field label="End"><input type="time" required value={slot.endTime} onChange={(e) => onChange(index, "endTime", e.target.value)} /></Field><Field label="Room"><input required value={slot.room} onChange={(e) => onChange(index, "room", e.target.value)} placeholder="C7.301" /></Field><Field label="Maximum capacity"><input type="number" min="0" step="1" required value={slot.capacity} onChange={(e) => onChange(index, "capacity", e.target.value)} /></Field></div><div className="slot-capacity-summary"><div><span>Assigned student count</span><strong>0</strong></div><div><span>Remaining capacity (calculated)</span><strong>{remaining}</strong></div></div></div>;
}

function PageTitle({ eyebrow, title, description, action }) { return <div className="page-title-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>; }
function Field({ label, children, className = "" }) { return <label className={`field ${className}`}><span>{label}</span>{children || <input />}</label>; }
export function Modal({ title, eyebrow, description, onClose, closeLabel, children, wide = false, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className={`academic-dialog modal-backdrop ${className}`} aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === ref.current) onClose(); }}>
    <section className={`modal-card ${wide ? "wide-modal" : ""}`}>
      <div className="modal-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p className="modal-description">{description}</p>}</div>
        <button className={closeLabel ? "outline-button" : "icon-button"} type="button" onClick={onClose} aria-label={closeLabel || "Close"}>{closeLabel || "×"}</button>
      </div>
      {children}
    </section>
  </dialog>;
}
function FormFooter({ onCancel, busy, submitText }) { return <div className="form-footer"><button type="button" className="outline-button" onClick={onCancel} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : submitText}<span>→</span></button></div>; }
function Loading() { return <div className="loading-state"><span className="loader" />Loading…</div>; }
function EmptyState({ title, text, icon = "▤" }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>; }
function splitLines(value) { return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function offeringMatchesMajor(offering, major) { const courseMajors = offering?.course?.facultyMajors || []; if (!courseMajors.length || !String(major || "").trim()) return true; return courseMajors.some((courseMajor) => majorsMatch(courseMajor, major)); }
function majorsMatch(left, right) { const canonical = (value) => { const key = String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]/g, ""); const aliases = { cs: "cs", csen: "cs", computerscience: "cs", dmet: "dmet", dme: "dmet", digitalmediaengineering: "dmet", digitalmediaengineeringtechnology: "dmet", digitalmediaengineeringandtechnology: "dmet" }; return aliases[key] || key; }; return canonical(left) === canonical(right); }
function emptySlot(groupNumber = "1") { return { componentType: "lecture", groupNumber, groupNumberEdited: false, day: "Monday", startTime: "09:00", endTime: "10:00", room: "", capacity: "30" }; }
function nextGroupNumber(slots, currentIndex, componentType) {
  const used = new Set(slots.flatMap((slot, index) => {
    if (index === currentIndex || slot.componentType !== componentType) return [];
    const number = Number(slot.groupNumber);
    return Number.isInteger(number) && number > 0 ? [number] : [];
  }));
  let next = 1;
  while (used.has(next)) next += 1;
  return String(next);
}
function timeToMinutes(value) { const match = /^(\d{2}):(\d{2})$/.exec(value || ""); if (!match) throw new Error("Meeting times must use HH:MM."); const hours = Number(match[1]); const minutes = Number(match[2]); if (hours > 24 || minutes > 59 || (hours === 24 && minutes)) throw new Error("Enter a valid 24-hour meeting time."); return hours * 60 + minutes; }
function minutesToTime(value) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
function formatMinutes(value) { return minutesToTime(value); }
function dateToIso(value) { if (!value) return ""; return new Date(`${value}T12:00:00`).toISOString(); }
function termToForm(term) {
  const result = { ...blankTerm };
  if (!term) return result;
  for (const key of Object.keys(blankTerm)) {
    if (term[key] !== undefined) {
      result[key] = termDateFields.includes(key) && term[key]
        ? new Date(term[key]).toISOString().slice(0, 10)
        : term[key];
    }
  }
  return result;
}
function readRecentTerms() { try { return JSON.parse(window.localStorage.getItem("bobos.recentTerms") || "[]"); } catch { return []; } }

function catalogueMajors(course) {
  return (course.facultyMajors || []).flatMap(major => splitLines(String(major).replaceAll("\\n", "\n")));
}

function CourseEditor({ course, courses, onSave, onClose, saving, error }) {
  const [section, setSection] = useState("details");
  const [search, setSearch] = useState("");
  const [requiredIds, setRequiredIds] = useState(() => (course.prerequisites || []).map(item => item._id || item));
  const options = courses.filter(item => item._id !== course._id && `${item.code} ${item.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Modal title={course._id ? "Edit course" : "Add a course"} onClose={onClose} wide>
    <form className="form-stack catalogue-editor" onSubmit={onSave} onInvalid={event => {
      const panel = event.target.closest("fieldset[data-course-section]");
      if (panel?.hidden) flushSync(() => setSection(panel.dataset.courseSection));
    }}>
      <nav className="course-editor-tabs" aria-label="Course editor sections">
        {Object.entries({ details: "Course details", curriculum: "Curriculum placement", teaching: "Teaching and availability", prerequisites: "Prerequisites" }).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={section === key} aria-controls={`course-editor-${key}`} onClick={() => setSection(key)}>
            {label}{key === "prerequisites" ? ` (${requiredIds.length})` : ""}
          </button>
        ))}
      </nav>
      <fieldset id="course-editor-details" data-course-section="details" hidden={section !== "details"}><legend>Course details</legend><div className="form-grid">
        <Field label="Course code"><input name="code" required maxLength={24} defaultValue={course.code} placeholder="CSEN704" /></Field>
        <Field label="Course name"><input name="name" required defaultValue={course.name} /></Field>
        <Field label="Credit hours"><input name="creditHours" required type="number" min="0" step="0.5" defaultValue={course.creditHours} /></Field>
        <Field label="Course type"><select name="courseType" defaultValue={course.courseType || "core"}><option value="core">Core</option><option value="elective">Elective</option><option value="huma">Humanities</option></select></Field>
      </div></fieldset>
      <fieldset id="course-editor-curriculum" data-course-section="curriculum" hidden={section !== "curriculum"}><legend>Curriculum placement</legend><div className="form-grid">
        <Field label="Recommended semester"><input name="recommendedSemester" type="number" min="1" max="10" defaultValue={course.recommendedSemester} /></Field>
        <Field label="Majors (one per line)"><textarea name="facultyMajors" rows={2} defaultValue={catalogueMajors(course).join("\n")} placeholder="One major per line" /></Field>
      </div></fieldset>
      <fieldset id="course-editor-teaching" data-course-section="teaching" hidden={section !== "teaching"}><legend>Teaching and availability</legend>
        <div className="teaching-hours">
          {["lectureHours", "tutorialHours", "labHours"].map(key => <Field key={key} label={pretty(key)}><input type="number" name={key} min="0" step="0.5" defaultValue={course[key]} /></Field>)}
        </div>
        <fieldset className="course-settings"><legend>Offering seasons</legend><div className="course-checks">{seasons.map(season => <label key={season}><input type="checkbox" name="offeringSeasons" value={season} defaultChecked={course.offeringSeasons?.includes(season)} />{pretty(season)}</label>)}</div></fieldset>
        <div className="course-checks course-settings"><label><input type="checkbox" name="isBachelorProject" defaultChecked={course.isBachelorProject} />Bachelor project</label><label><input type="checkbox" name="isActive" defaultChecked={course.isActive !== false} />Active in catalogue</label></div>
      </fieldset>
      <fieldset id="course-editor-prerequisites" data-course-section="prerequisites" hidden={section !== "prerequisites"}>
        <legend>Prerequisites</legend>
        <label className="field"><span>Find a prerequisite</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Course code or name" /></label>
        {requiredIds.map(id => <input key={id} type="hidden" name="prerequisites" value={id} />)}
        <div className="prerequisite-options">{options.map(item => <label key={item._id}><input type="checkbox" checked={requiredIds.includes(item._id)} onChange={event => setRequiredIds(ids => event.target.checked ? [...ids, item._id] : ids.filter(id => id !== item._id))} /><span><small>{item.code}</small> {item.name}</span></label>)}{!options.length && <p>No matching courses.</p>}</div>
      </fieldset>
      {error && <div className="feedback error" role="alert">{error}</div>}
      <FormFooter onCancel={onClose} busy={saving} submitText={course._id ? "Save changes" : "Create course"} />
    </form>
  </Modal>;
}

export function CourseDetailsModal({ course, allCourses = [], onClose, onEdit }) {
  const prerequisites = (course.prerequisites || []).map(entry => entry?.code ? entry : allCourses.find(item => item._id === (entry?._id || entry)) || {code: String(entry?._id || entry)});
  const facts = [
    ["Credit hours", course.creditHours], ["Course type", course.courseType === "huma" ? "Humanities" : pretty(course.courseType)],
    ["Recommended semester", course.recommendedSemester || "Unspecified"], ["Majors", catalogueMajors(course).join(", ") || "All majors"],
    ["Offering seasons", (course.offeringSeasons || []).map(pretty).join(", ") || "All seasons"],
    ...(course.isBachelorProject ? [["Project", "Bachelor project"]] : []),
  ];
  return <Modal title={course.name} eyebrow={course.code} onClose={onClose} wide>
    <div className="course-sheet">
      <div className="course-sheet-identity"><OfferingCourseIcon code={course.code}/><strong>{course.code}</strong><span className={`status-pill ${course.isActive ? "good" : "muted"}`}>{course.isActive ? "Active" : "Inactive"}</span></div>
      <div className="course-sheet-columns"><section><h3>Course information</h3><dl>{facts.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <section><h3>Weekly teaching hours</h3><dl>{["lecture", "tutorial", "lab"].map(type => <div key={type}><dt>{pretty(type)}</dt><dd>{course[`${type}Hours`] ?? "—"}</dd></div>)}</dl></section></div>
      <section><h3>Prerequisites</h3>{prerequisites.length ? <ul className="prerequisite-list">{prerequisites.map(item => <li key={item.code}><OfferingCourseIcon code={item.code}/><span><small>{item.code}</small><strong>{item.name || item.code}</strong></span></li>)}</ul> : <p>No prerequisites required.</p>}</section>
      <div className="form-footer"><button type="button" className="outline-button" onClick={onClose}>Close</button>{onEdit && <button type="button" className="primary-button" onClick={onEdit}>Edit course</button>}</div>
    </div>
  </Modal>;
}
