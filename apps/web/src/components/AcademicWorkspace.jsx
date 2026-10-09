import { useCallback, useEffect, useState } from "react";
import { api, explainApiError } from "../api.js";

const pretty = (value = "") => String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
const seasons = ["winter", "spring", "summer", "firstMakeup", "secondMakeup"];
const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AcademicWorkspace({ token, role, section, notify }) {
  if (section === "courses") return <CoursesWorkspace token={token} role={role} notify={notify} />;
  if (section === "terms") return <TermsWorkspace token={token} notify={notify} />;
  if (section === "offerings") return <OfferingsWorkspace token={token} notify={notify} />;
  return <TemplatesWorkspace token={token} notify={notify} />;
}

function CoursesWorkspace({ token, role, notify }) {
  const [courses, setCourses] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [query, setQuery] = useState(""); const [editing, setEditing] = useState(null); const [saving, setSaving] = useState(false);
  const [csvFile, setCsvFile] = useState(null); const [importing, setImporting] = useState(false); const [importErrors, setImportErrors] = useState([]);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setCourses(await api("/api/catalogue/courses", { token })); } catch (e) { setError(explainApiError(e, "Course catalogue")); } finally { setLoading(false); } }, [token]);
  useEffect(() => { load(); }, [load]);
  const importCsv = async (event) => {
    event.preventDefault();
    if (!csvFile) return;
    const formElement = event.currentTarget;
    setImporting(true); setImportErrors([]); setError("");
    try {
      const result = await api("/api/catalogue/courses/import", { token, method: "POST", body: { csvText: await csvFile.text() } });
      setCsvFile(null); formElement.reset();
      notify("success", `Imported ${result.total} courses: ${result.created} created, ${result.updated} updated.`);
      await load();
    } catch (e) {
      setImportErrors(e.data?.errors || []);
      setError(e.data?.message || (e.data?.errors?.length ? "The CSV has errors. Correct every listed row and upload it again; no courses were imported." : e.message));
    } finally { setImporting(false); }
  };
  const removeCourse = async (course) => {
    if (!window.confirm(`Delete ${course.code} · ${course.name}?`)) return;
    try { await api(`/api/catalogue/courses/${course._id}`, { token, method: "DELETE" }); notify("success", `${course.code} deleted.`); load(); }
    catch (e) { setError(e.message); }
  };
  const [viewing, setViewing] = useState(null);
  const visible = courses.filter((course) => `${course.code} ${course.name} ${course.courseType} ${(course.facultyMajors || []).join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const saveCourse = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const prerequisites = [...event.currentTarget.elements.prerequisites.selectedOptions].map((option) => option.value);
    const payload = {
      code: form.get("code"), name: form.get("name"), creditHours: Number(form.get("creditHours")), courseType: form.get("courseType"),
      facultyMajors: splitLines(form.get("facultyMajors")), offeringSeasons: [...event.currentTarget.elements.offeringSeasons.selectedOptions].map((option) => option.value),
      prerequisites, recommendedSemester: form.get("recommendedSemester") ? Number(form.get("recommendedSemester")) : undefined,
      lectureHours: form.get("lectureHours") ? Number(form.get("lectureHours")) : undefined,
      tutorialHours: form.get("tutorialHours") ? Number(form.get("tutorialHours")) : undefined,
      labHours: form.get("labHours") ? Number(form.get("labHours")) : undefined,
      isBachelorProject: form.get("isBachelorProject") === "on", isActive: form.get("isActive") === "on",
    };
    try {
      await api(editing?._id ? `/api/catalogue/courses/${editing._id}` : "/api/catalogue/courses", { token, method: editing?._id ? "PUT" : "POST", body: payload });
      notify("success", editing?._id ? "Course updated." : "Course added to the catalogue."); setEditing(null); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  return <div className="page-stack"><PageTitle eyebrow="GROUP C · COURSE CATALOGUE" title="Course catalogue" description="Create, search, and maintain the university course catalogue." action={<button className="primary-button" type="button" onClick={() => setEditing({})}>＋ Add course</button>} />
    {error && <div className="feedback error" role="alert">{error}</div>}
    {role === "administrator" && <section className="panel course-import-panel"><div className="results-heading"><div><p className="eyebrow">ADMINISTRATOR</p><h2>Import courses from CSV</h2></div></div><p className="helper-text">Required columns: Course Code, Course Name, Credit Hours, Course Type, Faculty/Major, Recommended Semester, Offering Season, Prerequisites. Separate multiple majors, seasons, and prerequisite codes with semicolons. If any row is invalid, nothing is imported.</p><form className="inline-controls" onSubmit={importCsv}><label className="field"><span>CSV file</span><input type="file" accept=".csv,text/csv" onChange={(event) => { setCsvFile(event.target.files?.[0] || null); setImportErrors([]); }} required /></label><button className="primary-button" disabled={importing || !csvFile}>{importing ? "Validating and importing…" : "Validate and import"}</button><a className="text-button" download="course-import-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent("Course Code,Course Name,Credit Hours,Course Type,Faculty/Major,Recommended Semester,Offering Season,Prerequisites\n")}`}>Download CSV template</a></form>{importErrors.length > 0 && <div className="course-import-errors" role="alert"><h3>Fix these CSV errors</h3><div className="table-scroll"><table><thead><tr><th>Row</th><th>Column</th><th>Error</th></tr></thead><tbody>{importErrors.map((item, index) => <tr key={`${item.row}-${item.field}-${index}`}><td>{item.row}</td><td>{item.field}</td><td>{item.message}</td></tr>)}</tbody></table></div></div>}</section>}
    <section className="panel"><div className="results-heading"><div><p className="eyebrow">CATALOGUE</p><h2>Courses</h2></div><span className="result-count">{courses.length} total</span></div><label className="search-control"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by course code, name, or major" /></label>{loading ? <Loading /> : visible.length ? <div className="table-scroll"><table><thead><tr><th>Course</th><th>Credits</th><th>Type</th><th>Majors</th><th>Semester</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map((course) => <tr key={course._id}><td><button type="button" className="text-button" style={{ textAlign: "left", padding: 0, textDecoration: "none" }} onClick={() => setViewing(course)}><strong>{course.code}</strong><span className="secondary-text" style={{ display: "block", textDecoration: "underline" }}>{course.name}</span></button></td><td>{course.creditHours}</td><td>{pretty(course.courseType)}</td><td>{(course.facultyMajors || []).join(", ") || "All"}</td><td>{course.recommendedSemester || "—"}</td><td><span className={`status-pill ${course.isActive ? "good" : "muted"}`}>{course.isActive ? "Active" : "Inactive"}</span></td><td><div className="table-actions"><button className="text-button" type="button" onClick={() => setViewing(course)}>View</button><button className="text-button" type="button" onClick={() => setEditing(course)}>Edit</button><button className="text-button danger-text" type="button" onClick={() => removeCourse(course)}>Delete</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No courses found" text={query ? "Try another search." : "Add a course to start building the catalogue."} />}</section>
    {viewing && <CourseDetailsModal course={viewing} allCourses={courses} onClose={() => setViewing(null)} onEdit={() => { const target = viewing; setViewing(null); setEditing(target); }} />}
    {editing && <Modal title={editing._id ? "Edit course" : "Add a course"} eyebrow="COURSE CATALOGUE" onClose={() => setEditing(null)}><form className="form-stack" onSubmit={saveCourse}><div className="form-grid"><Field label="Course code"><input name="code" required maxLength={24} defaultValue={editing.code || ""} placeholder="CSEN704" /></Field><Field label="Course name"><input name="name" required defaultValue={editing.name || ""} placeholder="Course title" /></Field><Field label="Credit hours"><input name="creditHours" required type="number" min="0" step="0.5" defaultValue={editing.creditHours ?? ""} /></Field><Field label="Course type"><select name="courseType" defaultValue={editing.courseType || "core"}><option value="core">Core</option><option value="elective">Elective</option><option value="huma">Humanities</option></select></Field><Field label="Recommended semester"><input name="recommendedSemester" type="number" min="1" max="10" defaultValue={editing.recommendedSemester ?? ""} /></Field><Field label="Lecture hours"><input name="lectureHours" type="number" min="0" step="0.5" defaultValue={editing.lectureHours ?? ""} /></Field><Field label="Tutorial hours"><input name="tutorialHours" type="number" min="0" step="0.5" defaultValue={editing.tutorialHours ?? ""} /></Field><Field label="Lab hours"><input name="labHours" type="number" min="0" step="0.5" defaultValue={editing.labHours ?? ""} /></Field><Field label="Majors (one per line)" className="span-two"><textarea name="facultyMajors" rows={3} defaultValue={(editing.facultyMajors || []).join("\n")} placeholder="Computer Science\nDigital Media Engineering" /></Field><Field label="Offered in seasons"><select name="offeringSeasons" multiple defaultValue={editing.offeringSeasons || []}>{seasons.map((season) => <option key={season} value={season}>{pretty(season)}</option>)}</select><small>Use Ctrl or ⌘ to select more than one.</small></Field><Field label="Prerequisites"><select name="prerequisites" multiple defaultValue={(editing.prerequisites || []).map((entry) => entry._id || entry)}>{courses.filter((course) => course._id !== editing._id).map((course) => <option key={course._id} value={course._id}>{course.code} · {course.name}</option>)}</select></Field><label className="check-field"><input type="checkbox" name="isBachelorProject" defaultChecked={editing.isBachelorProject || false} /> Bachelor project</label><label className="check-field"><input type="checkbox" name="isActive" defaultChecked={editing.isActive !== false} /> Active in catalogue</label></div><FormFooter onCancel={() => setEditing(null)} busy={saving} submitText={editing._id ? "Save changes" : "Create course"} /></form></Modal>}
  </div>;
}

const blankTerm = { code: "", academicYear: "", season: "spring", termStart: "", termEnd: "", teachingStart: "", teachingEnd: "", registrationStart: "", registrationEnd: "", advisingDeadline: "", wholeScheduleSwapDeadline: "", isActive: false };
const termDateFields = ["termStart", "termEnd", "teachingStart", "teachingEnd", "registrationStart", "registrationEnd", "advisingDeadline", "wholeScheduleSwapDeadline"];
function TermsWorkspace({ token, notify }) {
  const [form, setForm] = useState(blankTerm);
  const [termId, setTermId] = useState("");
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingTerms, setFetchingTerms] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadTerms = async () => {
    setFetchingTerms(true);
    try {
      const data = await api("/api/academic-terms/academicTerm", { token });
      setTerms(Array.isArray(data) ? data : []);
    } catch {
      // Fallback to recent terms stored locally if any
      setTerms(readRecentTerms());
    } finally {
      setFetchingTerms(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, [token]);

  const update = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      // If setting termStart, ensure teachingStart defaults reasonably if empty
      return next;
    });
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
    setError("");
    setMessage("");

    const clientValidation = validateDates();
    if (clientValidation) {
      setError(clientValidation);
      return;
    }

    setLoading(true);
    try {
      const data = await api(
        termId.trim()
          ? `/api/academic-terms/academicTerm/${encodeURIComponent(termId.trim())}`
          : "/api/academic-terms/academicTerm",
        {
          token,
          method: termId.trim() ? "PUT" : "POST",
          body: toPayload(),
        }
      );
      setTermId(data._id);
      setMessage(`Term ${data.code} saved. Its ID is ready for offerings and schedule preferences.`);
      notify("success", `Academic term ${data.code} saved.`);
      window.localStorage.setItem("bobos.lastTermId", data._id);
      loadTerms();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const useTerm = (term) => {
    setTermId(term._id);
    setForm(termToForm(term));
    setMessage("");
    setError("");
  };

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="GROUP C · ACADEMIC CALENDAR"
        title="Academic terms"
        description="Define term dates and deadlines used by offerings and scheduling."
      />
      {message && <div className="feedback success" role="status">{message}</div>}
      {error && <div className="feedback error" role="alert">{error}</div>}
      <div className="content-grid term-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TERM DETAILS</p>
              <h2>{termId ? "Update term" : "Create a term"}</h2>
            </div>
            <span className="panel-count">01</span>
          </div>
          <form className="form-stack" onSubmit={submit}>
            <div className="form-grid">
              <Field label="Term code">
                <input
                  required
                  maxLength={20}
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                  placeholder="S26"
                />
              </Field>
              <Field label="Academic year">
                <input
                  required
                  value={form.academicYear}
                  onChange={(e) => update("academicYear", e.target.value)}
                  placeholder="2025/2026"
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
              {termDateFields.map((field) => (
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
            </div>
            <div className="form-footer">
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setForm(blankTerm);
                  setTermId("");
                  setMessage("");
                  setError("");
                }}
              >
                Clear form
              </button>
              <button className="primary-button" disabled={loading}>
                {loading ? "Saving…" : termId ? "Update term" : "Create term"}
                <span>→</span>
              </button>
            </div>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ACADEMIC TERMS</p>
              <h2>Configured terms</h2>
            </div>
            <span className="panel-count">{terms.length.toString().padStart(2, "0")}</span>
          </div>
          {fetchingTerms ? (
            <Loading />
          ) : terms.length ? (
            <div className="recent-terms">
              {terms.map((term) => (
                <button
                  className={`recent-term ${term._id === termId ? "selected" : ""}`}
                  key={term._id}
                  onClick={() => useTerm(term)}
                  type="button"
                >
                  <span className="term-icon">◷</span>
                  <span>
                    <strong>{term.code} · {term.academicYear}</strong>
                    <small>{pretty(term.season)}{term.isActive ? " · Active" : ""}</small>
                  </span>
                  <span className="term-id">{term._id}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No terms found"
              text="Create an academic term to begin scheduling."
              icon="◷"
            />
          )}
          <label className="field term-id-field" style={{ marginTop: "1rem" }}>
            <span>Or load/edit by term ID</span>
            <input
              value={termId}
              onChange={async (e) => {
                const val = e.target.value;
                setTermId(val);
                if (!val.trim()) {
                  setForm(blankTerm);
                } else if (val.trim().length === 24) {
                  try {
                    const loaded = await api(`/api/academic-terms/academicTerm/${encodeURIComponent(val.trim())}`, { token });
                    if (loaded) setForm(termToForm(loaded));
                  } catch {
                    // Ignore lookup if invalid ID
                  }
                }
              }}
              placeholder="Academic term MongoDB ID"
            />
          </label>
        </section>
      </div>
    </div>
  );
}

function OfferingsWorkspace({ token, notify }) {
  const [termId, setTermId] = useState(() => window.localStorage.getItem("bobos.lastTermId") || "");
  const [courses, setCourses] = useState([]); const [offerings, setOfferings] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [creating, setCreating] = useState(false); const [details, setDetails] = useState(null);
  useEffect(() => { api("/api/catalogue/courses", { token }).then(setCourses).catch(() => {}); }, [token]);
  const load = async (event) => { event?.preventDefault(); if (!termId.trim()) { setError("Enter an academic term ID."); return; } window.localStorage.setItem("bobos.lastTermId", termId.trim()); setLoading(true); setError(""); try { const data = await api(`/api/catalogue/offerings?termId=${encodeURIComponent(termId.trim())}`, { token }); setOfferings(data.offerings || []); } catch (e) { setError(explainApiError(e, "Course offerings")); setOfferings([]); } finally { setLoading(false); } };
  const openDetails = async (offering) => { setDetails({ loading: true }); try { setDetails(await api(`/api/catalogue/offerings/${offering._id}`, { token })); } catch (e) { setDetails({ error: e.message }); } };
  const togglePublish = async (offering) => { try { await api(`/api/catalogue/offerings/${offering._id}/publish`, { token, method: "PATCH", body: { isPublished: !offering.isPublished } }); notify("success", `${offering.course?.code || "Offering"} ${offering.isPublished ? "unpublished" : "published"}.`); load(); } catch (e) { setError(e.message); } };
  const removeOffering = async (offering) => { if (!window.confirm(`Delete the offering for ${offering.course?.code || "this course"}?`)) return; try { await api(`/api/catalogue/offerings/${offering._id}`, { token, method: "DELETE" }); notify("success", "Offering deleted."); load(); } catch (e) { setError(e.message); } };
  const afterSave = () => { setCreating(false); setDetails(null); load(); };
  return <div className="page-stack"><div className="page-title-row"><div><p className="eyebrow">GROUP C · OFFERINGS</p><h1>Course offerings</h1><p className="page-description">Create term offerings, manage course groups, and publish the catalogue.</p></div><button className="primary-button" type="button" onClick={() => setCreating(true)}>＋ Create offering</button></div>
    <section className="panel term-picker"><form className="inline-controls" onSubmit={load}><label className="field"><span>Academic term ID</span><input required value={termId} onChange={(event) => setTermId(event.target.value)} placeholder="Paste a term ID or create a term first" /></label><button className="outline-button" type="submit" disabled={loading}>{loading ? "Loading…" : "Load offerings"}</button></form><p className="helper-text">Open Academic terms to create or update a term. This backend has no term-list endpoint yet.</p></section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <section className="panel results-panel"><div className="results-heading"><div><p className="eyebrow">TERM OFFERINGS</p><h2>Course groups</h2></div><span className="result-count">{loading ? "Loading" : `${offerings.length} offerings`}</span></div>{loading ? <Loading /> : offerings.length === 0 ? <EmptyState title="No offerings loaded" text="Enter a term ID and load offerings, or create the first offering." icon="▤" /> : <div className="offering-grid">{offerings.map((offering) => <article className="offering-card" key={offering._id}><div className="offering-card-top"><span className="course-code-pill">{offering.course?.code || "COURSE"}</span><span className={`status-pill ${offering.isPublished ? "good" : "muted"}`}>{offering.isPublished ? "Published" : "Draft"}</span></div><h3>{offering.course?.name || "Course offering"}</h3><p>{offering.course?.creditHours ?? "—"} credits <span>·</span> {pretty(offering.course?.courseType)}</p><div className="offering-meta"><span>▧ {(offering.slots || []).length} groups</span><span>♙ {(offering.instructors || []).length} instructors</span></div><div className="offering-slot-preview">{(offering.slots || []).slice(0, 3).map((slot) => <span key={slot._id}>{pretty(slot.componentType)} {slot.groupNumber} · {slot.day} {formatMinutes(slot.startMinute)}</span>)}</div><div className="offering-actions"><button type="button" className="text-button" onClick={() => openDetails(offering)}>Manage</button><button type="button" className="text-button" onClick={() => togglePublish(offering)}>{offering.isPublished ? "Unpublish" : "Publish"}</button><button type="button" className="text-button danger-text" onClick={() => removeOffering(offering)}>Delete</button></div></article>)}</div>}</section>
    {creating && <OfferingModal token={token} courses={courses} termId={termId} onClose={() => setCreating(false)} onSaved={afterSave} />}
    {details && <OfferingDetailsModal token={token} offering={details} onClose={() => setDetails(null)} onChanged={afterSave} />}
  </div>;
}

function TemplatesWorkspace({ token, notify }) {
  const [termId, setTermId] = useState(() => window.localStorage.getItem("bobos.lastTermId") || ""); const [templates, setTemplates] = useState([]); const [offerings, setOfferings] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [form, setForm] = useState({ major: "", semester: "", studyGroup: "", isPublished: false }); const [selectedOffers, setSelectedOffers] = useState([]); const [saving, setSaving] = useState(false);
  const load = async (event) => { event?.preventDefault(); if (!termId.trim()) { setError("Enter an academic term ID."); return; } window.localStorage.setItem("bobos.lastTermId", termId.trim()); setLoading(true); setError(""); try { const [templateData, offeringData] = await Promise.all([api(`/api/academics/schedule-templates?termId=${encodeURIComponent(termId.trim())}`, { token }), api(`/api/catalogue/offerings?termId=${encodeURIComponent(termId.trim())}`, { token })]); setTemplates(templateData.templates || []); setOfferings(offeringData.offerings || []); } catch (e) { setError(explainApiError(e, "Schedule templates")); } finally { setLoading(false); } };
  const addOffering = (event) => { const id = event.target.value; if (!id) return; setSelectedOffers((current) => current.includes(id) ? current : [...current, id]); event.target.value = ""; };
  const removeSelected = (id) => setSelectedOffers((current) => current.filter((value) => value !== id));
  const createTemplate = async (event) => { event.preventDefault(); setSaving(true); setError(""); const courses = selectedOffers.map((id) => { const offering = offerings.find((entry) => entry._id === id); const courseId = offering?.course?._id || offering?.course; return { course: courseId, courseOffering: id, slots: (offering?.slots || []).map((slot) => ({ componentType: slot.componentType, slotGroupId: slot._id })) }; }); try { await api("/api/academics/schedule-templates", { token, method: "POST", body: { term: termId.trim(), major: form.major.trim(), semester: Number(form.semester), studyGroup: form.studyGroup.trim(), courses, isPublished: form.isPublished } }); notify("success", "Schedule template created."); setForm({ major: "", semester: "", studyGroup: "", isPublished: false }); setSelectedOffers([]); load(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const setPublished = async (template) => { try { await api(`/api/academics/schedule-templates/${template._id}`, { token, method: "PUT", body: { isPublished: !template.isPublished } }); notify("success", `Template ${template.isPublished ? "unpublished" : "published"}.`); load(); } catch (e) { setError(e.message); } };
  const selected = selectedOffers.map((id) => offerings.find((item) => item._id === id)).filter(Boolean);
  return <div className="page-stack"><PageTitle eyebrow="GROUP C · SCHEDULE TEMPLATES" title="Schedule templates" description="Build standard course plans for a major, semester, and study group." />
    <section className="panel term-picker"><form className="inline-controls" onSubmit={load}><label className="field"><span>Academic term ID</span><input required value={termId} onChange={(e) => setTermId(e.target.value)} placeholder="Paste a term ID" /></label><button className="outline-button" disabled={loading}>{loading ? "Loading…" : "Load templates and offerings"}</button></form><p className="helper-text">A template can use published offerings only. Create and publish offerings before adding them here.</p></section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    <div className="content-grid template-grid"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">NEW STANDARD PLAN</p><h2>Create schedule template</h2></div><span className="panel-count">01</span></div><form className="form-stack" onSubmit={createTemplate}><div className="form-grid"><Field label="Major"><input required value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} placeholder="Computer Science" /></Field><Field label="Semester"><input required type="number" min="1" max="10" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="4" /></Field><Field label="Study group"><input required value={form.studyGroup} onChange={(e) => setForm({ ...form, studyGroup: e.target.value })} placeholder="G1" /></Field><label className="check-field"><input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Publish template when saved</label><Field label="Add published offering" className="span-two"><select defaultValue="" onChange={addOffering}><option value="">Choose offering…</option>{offerings.map((offering) => <option key={offering._id} value={offering._id} disabled={!offering.isPublished}>{offering.course?.code} · {offering.course?.name}{offering.isPublished ? "" : " (draft)"}</option>)}</select></Field></div>{selected.length > 0 && <div className="selected-offerings"><p className="eyebrow">COURSES IN THIS TEMPLATE · {selected.length}</p>{selected.map((offering) => <div className="selected-offering" key={offering._id}><span><strong>{offering.course?.code}</strong> {offering.course?.name}<small>{(offering.slots || []).length} course groups included</small></span><button type="button" className="text-button danger-text" onClick={() => removeSelected(offering._id)}>Remove</button></div>)}</div>}<div className="form-footer"><span className="helper-text">Select a term before loading available offerings.</span><button className="primary-button" disabled={saving || !termId.trim()}>{saving ? "Creating…" : "Create template"}<span>→</span></button></div></form></section>
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">SAVED PLANS</p><h2>Current templates</h2></div><span className="panel-count">{templates.length.toString().padStart(2, "0")}</span></div>{loading ? <Loading /> : templates.length ? <div className="template-list">{templates.map((template) => <article className="template-card" key={template._id}><div className="template-card-title"><span className="template-icon">▧</span><div><strong>{template.major}</strong><small>Semester {template.semester} · Group {template.studyGroup}</small></div><span className={`status-pill ${template.isPublished ? "good" : "muted"}`}>{template.isPublished ? "Published" : "Draft"}</span></div><p>{template.courses?.length || 0} courses <span>·</span> {template.term?.code || "Academic term"}</p><button className="text-button" type="button" onClick={() => setPublished(template)}>{template.isPublished ? "Unpublish template" : "Publish template"}</button></article>)}</div> : <EmptyState title="No templates loaded" text="Load a term to see its schedule templates, or create the first one." icon="▧" />}</section></div>
  </div>;
}

function OfferingModal({ token, courses, termId, onClose, onSaved }) {
  const [slots, setSlots] = useState([emptySlot()]); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const setSlot = (index, key, value) => setSlots((current) => current.map((slot, position) => position === index ? { ...slot, [key]: value } : slot));
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const instructors = splitLines(form.get("instructors")).map((line) => { const [fullName, email] = line.split("|").map((part) => part.trim()); return { fullName, ...(email ? { email } : {}) }; }); const eligibleGroups = splitLines(form.get("eligibleGroups")).map((line) => { const [major, semester, studyGroup] = line.split("|").map((part) => part.trim()); return { major, ...(semester ? { semester: Number(semester) } : {}), ...(studyGroup ? { studyGroup } : {}) }; }); const payload = { course: form.get("course"), term: termId.trim(), instructors, eligibleGroups, isPublished: false, slots: slots.map((slot) => ({ componentType: slot.componentType, groupNumber: slot.groupNumber.trim(), day: slot.day, startMinute: timeToMinutes(slot.startTime), endMinute: timeToMinutes(slot.endTime), room: slot.room.trim(), capacity: Number(slot.capacity) })) }; try { await api("/api/catalogue/offerings", { token, method: "POST", body: payload }); onSaved(); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  return <Modal title="Create course offering" eyebrow="GROUP C · REQUIREMENT 22" onClose={onClose}><form className="form-stack" onSubmit={submit}><div className="form-grid"><Field label="Course"><select name="course" required defaultValue=""><option value="" disabled>Choose a course</option>{courses.map((course) => <option key={course._id} value={course._id}>{course.code} · {course.name}</option>)}</select></Field><Field label="Academic term"><input value={termId} readOnly placeholder="Enter a term ID first" /></Field><Field label="Instructors · one per line: Name | email" className="span-two"><textarea name="instructors" rows={3} placeholder="Dr. Sara Hassan | sara.hassan@guc.edu.eg" /></Field><Field label="Eligible groups · one per line: Major | semester | group" className="span-two"><textarea name="eligibleGroups" rows={3} placeholder="Computer Science | 4 | G1" /></Field></div><div className="slot-editor-heading"><div><p className="eyebrow">MEETING TIMES</p><h3>Course groups</h3></div><button className="outline-button small-button" type="button" onClick={() => setSlots([...slots, emptySlot()])}>＋ Add group</button></div>{slots.map((slot, index) => <SlotFields key={index} index={index} slot={slot} onChange={setSlot} onRemove={() => setSlots(slots.filter((_, i) => i !== index))} canRemove={slots.length > 1} />)}{error && <div className="feedback error">{error}</div>}<FormFooter onCancel={onClose} busy={saving} submitText="Create offering" /></form></Modal>;
}

function OfferingDetailsModal({ token, offering, onClose, onChanged }) {
  const [error, setError] = useState(""); const [busySlot, setBusySlot] = useState(""); const [instructors, setInstructors] = useState(""); const [groups, setGroups] = useState(""); const [savingMeta, setSavingMeta] = useState(false);
  useEffect(() => { if (!offering?.loading && !offering?.error) { setInstructors((offering.instructors || []).map((item) => `${item.fullName}${item.email ? ` | ${item.email}` : ""}`).join("\n")); setGroups((offering.eligibleGroups || []).map((item) => `${item.major} | ${item.semester || ""} | ${item.studyGroup || ""}`).join("\n")); } }, [offering]);
  if (offering?.loading) return <Modal title="Offering details" eyebrow="COURSE OFFERING" onClose={onClose}><Loading /></Modal>;
  if (offering?.error) return <Modal title="Offering details" eyebrow="COURSE OFFERING" onClose={onClose}><div className="feedback error">{offering.error}</div></Modal>;
  const saveMeta = async (event) => { event.preventDefault(); setSavingMeta(true); setError(""); const form = new FormData(event.currentTarget); const instructorsPayload = splitLines(form.get("instructors")).map((line) => { const [fullName, email] = line.split("|").map((part) => part.trim()); return { fullName, ...(email ? { email } : {}) }; }); const groupsPayload = splitLines(form.get("eligibleGroups")).map((line) => { const [major, semester, studyGroup] = line.split("|").map((part) => part.trim()); return { major, ...(semester ? { semester: Number(semester) } : {}), ...(studyGroup ? { studyGroup } : {}) }; }); try { await api(`/api/catalogue/offerings/${offering._id}`, { token, method: "PUT", body: { instructors: instructorsPayload, eligibleGroups: groupsPayload } }); onChanged(); } catch (e) { setError(e.message); } finally { setSavingMeta(false); } };
  const updateSlot = async (slotId, event) => { event.preventDefault(); setBusySlot(slotId); setError(""); const form = new FormData(event.currentTarget); try { await api(`/api/catalogue/offerings/${offering._id}/slots/${slotId}`, { token, method: "PUT", body: { componentType: form.get("componentType"), groupNumber: form.get("groupNumber"), day: form.get("day"), startMinute: timeToMinutes(form.get("startTime")), endMinute: timeToMinutes(form.get("endTime")), room: form.get("room"), capacity: Number(form.get("capacity")) } }); onChanged(); } catch (e) { setError(e.message); setBusySlot(""); } };
  const deleteSlot = async (slotId) => { if (!window.confirm("Remove this course group?")) return; try { await api(`/api/catalogue/offerings/${offering._id}/slots/${slotId}`, { token, method: "DELETE" }); onChanged(); } catch (e) { setError(e.message); } };
  return <Modal title={`${offering.course?.code || "Offering"} · Manage`} eyebrow="COURSE OFFERING" onClose={onClose} wide><div className="offering-detail-head"><div><h3>{offering.course?.name}</h3><p>{offering.term?.code} · {offering.course?.creditHours} credits</p></div><span className={`status-pill ${offering.isPublished ? "good" : "muted"}`}>{offering.isPublished ? "Published" : "Draft"}</span></div>{error && <div className="feedback error">{error}</div>}<form className="form-stack offering-meta-form" onSubmit={saveMeta}><p className="eyebrow">INSTRUCTORS AND ELIGIBLE GROUPS</p><div className="form-grid"><Field label="Instructors · one per line: Name | email"><textarea name="instructors" rows={3} value={instructors} onChange={(e) => setInstructors(e.target.value)} /></Field><Field label="Eligible groups · one per line: Major | semester | group"><textarea name="eligibleGroups" rows={3} value={groups} onChange={(e) => setGroups(e.target.value)} /></Field></div><button className="outline-button" disabled={savingMeta}>{savingMeta ? "Saving…" : "Save offering details"}</button></form><div className="slot-editor-heading"><div><p className="eyebrow">MEETING TIMES</p><h3>Course groups</h3></div></div>{(offering.slots || []).map((slot) => <form className="slot-row slot-row-existing" key={slot._id} onSubmit={(event) => updateSlot(slot._id, event)}><div className="form-grid"><Field label="Component"><select name="componentType" defaultValue={slot.componentType}>{["lecture", "tutorial", "lab"].map((type) => <option value={type} key={type}>{pretty(type)}</option>)}</select></Field><Field label="Group"><input name="groupNumber" required defaultValue={slot.groupNumber} /></Field><Field label="Day"><select name="day" defaultValue={slot.day}>{week.map((day) => <option key={day}>{day}</option>)}</select></Field><Field label="Start"><input name="startTime" type="time" required defaultValue={minutesToTime(slot.startMinute)} /></Field><Field label="End"><input name="endTime" type="time" required defaultValue={minutesToTime(slot.endMinute)} /></Field><Field label="Room"><input name="room" required defaultValue={slot.room} /></Field><Field label="Capacity"><input name="capacity" type="number" min={slot.assignedStudentCount || 0} required defaultValue={slot.capacity} /></Field></div><div className="slot-actions"><span className="helper-text">{slot.assignedStudentCount || 0} assigned · {slot.remainingCapacity ?? Math.max(0, slot.capacity - (slot.assignedStudentCount || 0))} seats left</span><button className="text-button danger-text" type="button" onClick={() => deleteSlot(slot._id)}>Remove group</button><button className="outline-button small-button" disabled={busySlot === slot._id}>{busySlot === slot._id ? "Saving…" : "Update group"}</button></div></form>)}<div className="form-footer"><button className="outline-button" type="button" onClick={onClose}>Close</button></div></Modal>;
}

function SlotFields({ index, slot, onChange, onRemove, canRemove }) {
  return <div className="slot-row"><div className="slot-row-title"><strong>Group {index + 1}</strong>{canRemove && <button className="text-button danger-text" type="button" onClick={onRemove}>Remove</button>}</div><div className="form-grid"><Field label="Component"><select value={slot.componentType} onChange={(e) => onChange(index, "componentType", e.target.value)}>{["lecture", "tutorial", "lab"].map((type) => <option value={type} key={type}>{pretty(type)}</option>)}</select></Field><Field label="Group number"><input required value={slot.groupNumber} onChange={(e) => onChange(index, "groupNumber", e.target.value)} placeholder="1" /></Field><Field label="Day"><select value={slot.day} onChange={(e) => onChange(index, "day", e.target.value)}>{week.map((day) => <option key={day}>{day}</option>)}</select></Field><Field label="Start"><input type="time" required value={slot.startTime} onChange={(e) => onChange(index, "startTime", e.target.value)} /></Field><Field label="End"><input type="time" required value={slot.endTime} onChange={(e) => onChange(index, "endTime", e.target.value)} /></Field><Field label="Room"><input required value={slot.room} onChange={(e) => onChange(index, "room", e.target.value)} placeholder="C7.301" /></Field><Field label="Capacity"><input type="number" min="0" required value={slot.capacity} onChange={(e) => onChange(index, "capacity", e.target.value)} /></Field></div></div>;
}

function PageTitle({ eyebrow, title, description, action }) { return <div className="page-title-row"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>; }
function Field({ label, children, className = "" }) { return <label className={`field ${className}`}><span>{label}</span>{children || <input />}</label>; }
function Modal({ title, eyebrow, onClose, children, wide = false }) { return <div className="modal-backdrop" onClick={onClose}><section className={`modal-card ${wide ? "wide-modal" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div>{children}</section></div>; }
function FormFooter({ onCancel, busy, submitText }) { return <div className="form-footer"><button type="button" className="outline-button" onClick={onCancel} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Saving…" : submitText}<span>→</span></button></div>; }
function Loading() { return <div className="loading-state"><span className="loader" />Loading…</div>; }
function EmptyState({ title, text, icon = "▤" }) { return <div className="empty-state"><span>{icon}</span><h3>{title}</h3><p>{text}</p></div>; }
function splitLines(value) { return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function emptySlot() { return { componentType: "lecture", groupNumber: "", day: "Monday", startTime: "09:00", endTime: "10:00", room: "", capacity: "30" }; }
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

function CourseDetailsModal({ course, allCourses = [], onClose, onEdit }) {
  if (!course) return null;
  const prereqList = (course.prerequisites || []).map((p) => {
    if (typeof p === "object" && p !== null && p.code) return p;
    return allCourses.find((c) => c._id === p || c.code === p) || { code: String(p), name: "Course ID: " + p };
  });

  return (
    <Modal title={`${course.code} · ${course.name}`} eyebrow="COURSE SPECIFICATION" onClose={onClose} wide>
      <div className="offering-detail-head" style={{ marginBottom: "1.5rem" }}>
        <div>
          <span className="course-code-pill" style={{ fontSize: "1rem", padding: "0.25rem 0.75rem", marginBottom: "0.5rem", display: "inline-block" }}>
            {course.code}
          </span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: "700", marginTop: "0.25rem" }}>{course.name}</h2>
          <p style={{ color: "#64748b" }}>
            {course.creditHours} Credit Hours · {pretty(course.courseType)}
            {course.isBachelorProject ? " · Bachelor Project" : ""}
          </p>
        </div>
        <span className={`status-pill ${course.isActive ? "good" : "muted"}`}>
          {course.isActive ? "Active in Catalogue" : "Inactive"}
        </span>
      </div>

      <div className="form-grid" style={{ gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="panel" style={{ padding: "1rem", background: "var(--surface-sunken, #f8fafc)" }}>
          <p className="eyebrow" style={{ fontSize: "0.75rem" }}>CURRICULUM HOURS</p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.95rem" }}>
            <strong>Lecture:</strong> {course.lectureHours ?? "—"} hrs/week
          </p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.95rem" }}>
            <strong>Tutorial:</strong> {course.tutorialHours ?? "—"} hrs/week
          </p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.95rem" }}>
            <strong>Lab:</strong> {course.labHours ?? "—"} hrs/week
          </p>
        </div>

        <div className="panel" style={{ padding: "1rem", background: "var(--surface-sunken, #f8fafc)" }}>
          <p className="eyebrow" style={{ fontSize: "0.75rem" }}>SEMESTER & OFFERING</p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.95rem" }}>
            <strong>Recommended Semester:</strong> {course.recommendedSemester ? `Semester ${course.recommendedSemester}` : "—"}
          </p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.95rem" }}>
            <strong>Offering Seasons:</strong> {(course.offeringSeasons || []).map(pretty).join(", ") || "All"}
          </p>
        </div>

        <div className="panel span-two" style={{ padding: "1rem", background: "var(--surface-sunken, #f8fafc)" }}>
          <p className="eyebrow" style={{ fontSize: "0.75rem" }}>FACULTY / MAJORS (MET & DMET)</p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.95rem" }}>
            {(course.facultyMajors || []).length > 0 ? (
              (course.facultyMajors || []).map((major, i) => (
                <span key={i} className="course-code-pill" style={{ marginRight: "0.5rem", marginBottom: "0.25rem", display: "inline-block" }}>
                  {major}
                </span>
              ))
            ) : (
              <span className="secondary-text">Available to all faculties</span>
            )}
          </p>
        </div>

        <div className="panel span-two" style={{ padding: "1rem", background: "var(--surface-sunken, #f8fafc)" }}>
          <p className="eyebrow" style={{ fontSize: "0.75rem" }}>PREREQUISITES</p>
          {prereqList.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
              {prereqList.map((prereq, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid var(--border, #e2e8f0)",
                    background: "var(--surface, #fff)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                  }}
                >
                  <strong style={{ color: "#2563eb" }}>{prereq.code}</strong>
                  {prereq.name ? <span style={{ marginLeft: "0.4rem", color: "#475569" }}>— {prereq.name}</span> : null}
                  {prereq.creditHours ? <small style={{ display: "block", color: "#94a3b8" }}>{prereq.creditHours} credits</small> : null}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "0.25rem 0", color: "#64748b" }}>No prerequisites required (direct entry).</p>
          )}
        </div>
      </div>

      <div className="form-footer" style={{ marginTop: "1.5rem" }}>
        <button type="button" className="outline-button" onClick={onClose}>
          Close
        </button>
        {onEdit && (
          <button type="button" className="primary-button" onClick={onEdit}>
            Edit course <span>→</span>
          </button>
        )}
      </div>
    </Modal>
  );
}
