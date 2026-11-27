function TermsWorkspace({ token, role, notify }) {
  const [form, setForm] = useState(blankTerm);
  const [termId, setTermId] = useState('');
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingTerms, setFetchingTerms] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [recordingStanding, setRecordingStanding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [touched, setTouched] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ year: '', season: '', status: '' });
  const editor = useRef(null);
  const validation = validateAcademicTerm(form);
  const visibleError = field => (attempt || touched[field]) ? validation[field] : '';

  const loadTerms = async () => {
    setFetchingTerms(true); setLoadError('');
    try {
      const data = await api('/api/academic-terms/academicTerm', { token });
      setTerms(Array.isArray(data) ? data : []);
    } catch {
      setLoadError('Could not refresh academic terms. Your last loaded terms are still shown.');
      setTerms(current => current.length ? current : readRecentTerms());
    } finally { setFetchingTerms(false); }
  };
  useEffect(() => { loadTerms(); }, [token]);
  useEffect(() => {
    if (attempt) editor.current?.querySelector('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  const update = (field, value) => { setForm(current => ({ ...current, [field]: value })); setError(''); };
  const openEditor = term => {
    setTermId(term?._id || term?.code || ''); setForm(term ? termToForm(term) : { ...blankTerm });
    setTouched({}); setAttempt(0); setError(''); setMessage(''); setViewing(null); setEditing(true);
  };
  const submit = async event => {
    event.preventDefault(); if (loading) return;
    setAttempt(value => value + 1); setError('');
    if (Object.keys(validation).length) return;
    const payload = Object.fromEntries(Object.keys(blankTerm).map(key => [key,
      termDateFields.includes(key) ? dateToIso(form[key]) : typeof form[key] === 'string' ? form[key].trim() : form[key],
    ]));
    payload.code = form.code || `${form.season}-${form.academicYear.replace(/[^0-9]/g, '')}`;
    setLoading(true);
    try {
      const data = await api(termId ? `/api/academic-terms/academicTerm/${encodeURIComponent(termId)}` : '/api/academic-terms/academicTerm', {
        token, method: termId ? 'PUT' : 'POST', body: payload,
      });
      const next = [data, ...terms.filter(term => term._id !== data._id && term.code !== data.code)];
      setTerms(next); setTermId(data._id || data.code);
      window.localStorage.setItem('bobos.recentTerms', JSON.stringify(next.slice(0, 8)));
      window.localStorage.setItem('bobos.lastTermId', data.code || data._id);
      setEditing(false); setMessage(`${termLabel(data)} saved.`); notify('success', `${termLabel(data)} saved.`);
      loadTerms();
    } catch (requestError) {
      setError(requestError.status === 409
        ? 'This academic year and season already exist. Edit that term or choose a different season.'
        : requestError.status === 400 ? 'The term could not be saved. Check the dates and try again.'
        : 'Could not save the term. Your entries are kept. Please try again.');
    } finally { setLoading(false); }
  };
  const standingSaved = ({ warningEmailStatus }) => {
    setRecordingStanding(false);
    const text = warningEmailStatus === 'sent' ? 'Standing saved. Probation warning email sent.'
      : warningEmailStatus === 'failed' ? 'Standing saved. The probation warning email could not be sent.'
      : warningEmailStatus === 'pending' ? 'Standing saved. The probation warning email is pending.' : 'Standing saved.';
    setMessage(text); notify(warningEmailStatus === 'failed' ? 'warning' : 'success', text);
  };
  const dateField = (field, shortLabel) => {
    const problem = visibleError(field);
    const minimum = field === 'termEnd' || field === 'teachingStart' ? form.termStart
      : field === 'teachingEnd' ? form.teachingStart : field === 'registrationEnd' ? form.registrationStart : '';
    return <label className="field" key={field}><span>{shortLabel}</span>
      <input id={`term-${field}`} name={field} type="date" aria-label={termFieldLabels[field]} required value={form[field]}
        min={minimum || undefined} max={field === 'teachingEnd' ? form.termEnd || undefined : undefined}
        aria-invalid={Boolean(problem)} aria-describedby={problem ? `term-${field}-error` : undefined}
        onBlur={() => setTouched(current => ({ ...current, [field]: true }))} onChange={event => update(field, event.target.value)} />
      {problem && <small className="term-field-error" id={`term-${field}-error`}>{problem}</small>}
    </label>;
  };

  if (role !== 'administrator') {
    const selectedTerm = terms.find(term => (term._id || term.code) === termId) || terms.find(term => term.isActive) || terms[0];
    return <div className="page-stack term-register">
      <PageTitle title="Academic terms" description="Dates and deadlines for your term." />
      {loadError && <div className="feedback error" role="alert">{loadError}<button type="button" onClick={loadTerms}>Try again</button></div>}
      {fetchingTerms && !terms.length ? <Loading /> : !selectedTerm ? <EmptyState title="No academic terms" text="Terms will appear here once an administrator adds them." /> : <div className="term-read-layout">
        <label className="field term-selection"><span>Academic term</span><select value={selectedTerm._id || selectedTerm.code} onChange={event => setTermId(event.target.value)}>{terms.map(term => <option key={term._id || term.code} value={term._id || term.code}>{termLabel(term)}{term.isActive ? ' · Active' : ''}</option>)}</select></label>
        <section className="term-milestones" aria-labelledby="term-dates-heading"><div className="term-milestones-heading"><h2 id="term-dates-heading">Dates and deadlines</h2><span className={`status-pill ${selectedTerm.isActive ? 'good' : 'muted'}`}>{selectedTerm.isActive ? 'Active' : 'Inactive'}</span></div><dl className="term-dates">{Object.entries(termDateGroups).map(([label, fields]) => <div key={label}><dt>{label}</dt><dd><TermDates dates={fields.map(field => selectedTerm[field])} /></dd></div>)}</dl></section>
        <TermCalendar key={selectedTerm._id || selectedTerm.code} term={selectedTerm}/>
      </div>}
    </div>;
  }
  const years = [...new Set(terms.map(term => term.academicYear).filter(Boolean))].sort().reverse();
  const matching = terms.filter(term => (!filters.year || term.academicYear === filters.year)
    && (!filters.season || term.season === filters.season)
    && (!filters.status || Boolean(term.isActive) === (filters.status === 'active'))
    && `${termLabel(term)} ${term.code}`.toLowerCase().includes(search.trim().toLowerCase()));
  const resetFilters = () => { setSearch(''); setFilters({ year: '', season: '', status: '' }); };
  const chips = Object.entries(filters).filter(([, value]) => value).map(([key, value]) => ({
    key, label: pretty(value), onRemove: () => setFilters(current => ({ ...current, [key]: '' })),
  }));
  return <div className="page-stack terms-manager">
    <PageTitle title="Academic terms" description="Manage term dates and deadlines." action={<div className="terms-header-actions">
      <button className="outline-button" type="button" disabled={!terms.length || fetchingTerms} onClick={() => { setMessage(''); setRecordingStanding(true); }}>Record standing</button>
      <button className="primary-button" type="button" onClick={() => openEditor(null)}>New term</button>
    </div>} />
    {message && <div className="feedback success" role="status">{message}</div>}
    {loadError && <div className="feedback error terms-load-error" role="alert">{loadError}<button className="text-button" type="button" onClick={loadTerms}>Try again</button></div>}
    <FilterDisclosure search={<label className="field terms-search"><span>Find a term</span><input type="search" value={search} placeholder="Year, season or code" onChange={event => setSearch(event.target.value)} /></label>}
      chips={chips} onClear={resetFilters} actions={<button type="button" className="text-button" disabled={fetchingTerms} onClick={loadTerms}>{fetchingTerms ? 'Refreshing…' : 'Refresh'}</button>}>
      <div className="terms-filters">{[['year', 'Academic year', years], ['season', 'Season', seasons], ['status', 'Status', ['active', 'inactive']]].map(([key, label, options]) => <label key={key} className="field"><span>{label}</span><select value={filters[key]} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}><option value="">All {key === 'year' ? 'years' : key === 'season' ? 'seasons' : 'statuses'}</option>{options.map(value => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>)}</div>
    </FilterDisclosure>
    <section className="terms-results" aria-label="Configured academic terms" aria-busy={fetchingTerms}>
      <div className="terms-results-heading"><h2>Terms</h2><span role="status">{matching.length} of {terms.length}</span></div>
      {fetchingTerms && !terms.length ? <Loading /> : matching.length ? <StudentRegister label="Academic terms" columns={['Term', 'Dates', 'Status', 'Actions']} className="terms-table">
        {matching.map(term => <tr key={term._id || term.code}><td><button className="term-name" type="button" onClick={() => setViewing(term)}><span className="term-calendar-mark" aria-hidden="true">{term.termStart ? new Date(term.termStart).getUTCDate() : '–'}</span><span><strong>{termLabel(term)}</strong><small>{term.code}</small></span></button></td>
          <td><TermDates dates={[term.termStart, term.termEnd]} /></td><td><span className={`status-pill ${term.isActive ? 'good' : 'muted'}`}>{term.isActive ? 'Active' : 'Inactive'}</span></td>
          <td><button className="outline-button" type="button" aria-label={`Edit ${termLabel(term)}`} onClick={() => openEditor(term)}>Edit</button></td></tr>)}
      </StudentRegister> : <div className="terms-empty"><img src="/portal-studio/images/extra-hours-folder.svg" alt="" width="76" height="60" /><h3>{terms.length ? 'No matching terms' : 'No academic terms yet'}</h3><p>{terms.length ? 'Try another search or clear the filters.' : 'Add your first term to set up its dates.'}</p><button className="outline-button" type="button" onClick={terms.length ? resetFilters : () => openEditor(null)}>{terms.length ? 'Clear filters' : 'New term'}</button></div>}
    </section>
    {viewing && <Modal title={termLabel(viewing)} onClose={() => setViewing(null)} wide><div className="terms-detail-layout"><dl className="terms-detail-dates">{Object.entries(termDateGroups).map(([label, fields]) => <div key={label}><dt>{label}</dt><dd><TermDates dates={fields.map(field => viewing[field])} /></dd></div>)}</dl><TermCalendar term={viewing} /></div><div className="form-footer"><button type="button" className="outline-button" onClick={() => setViewing(null)}>Close</button><button type="button" className="primary-button" onClick={() => openEditor(viewing)}>Edit term</button></div></Modal>}
    {editing && <Modal title={termId ? 'Edit term' : 'New term'} onClose={() => { if (!loading) setEditing(false); }} wide>
      <form ref={editor} className="term-editor" noValidate onSubmit={submit}>
        <p className="term-editor-note">All dates are required.</p>
        {attempt > 0 && Object.keys(validation).length > 0 && <div className="term-validation-summary" role="alert">Complete {Object.keys(validation).length} highlighted {Object.keys(validation).length === 1 ? 'field' : 'fields'} before saving.</div>}
        {error && <div className="feedback error" role="alert">{error}</div>}
        <fieldset><legend>Term information</legend><div className="term-identity-fields">
          <label className="field"><span>Academic year</span><input name="academicYear" aria-invalid={Boolean(visibleError('academicYear'))} aria-describedby={visibleError('academicYear') ? 'term-year-error' : undefined} required value={form.academicYear} placeholder="2026/2027" onBlur={() => setTouched(current => ({ ...current, academicYear: true }))} onChange={event => update('academicYear', event.target.value)} />{visibleError('academicYear') && <small id="term-year-error" className="term-field-error">{visibleError('academicYear')}</small>}</label>
          <label className="field"><span>Season</span><select name="season" value={form.season} onChange={event => update('season', event.target.value)}>{seasons.map(season => <option key={season} value={season}>{pretty(season)}</option>)}</select></label>
          <label className="check-field"><input type="checkbox" checked={form.isActive} onChange={event => update('isActive', event.target.checked)} />Active term</label>
        </div></fieldset>
        <div className="term-editor-dates">{[['Term', ['termStart', 'termEnd']], ['Teaching', ['teachingStart', 'teachingEnd']], ['Registration', ['registrationStart', 'registrationEnd']]].map(([label, fields]) => <fieldset key={label}><legend>{label}</legend><div className="term-date-fields">{fields.map((field, index) => dateField(field, index ? 'Ends' : 'Starts'))}</div></fieldset>)}
          <fieldset><legend>Deadlines</legend><div className="term-date-fields">{dateField('advisingDeadline', 'Advising')}{dateField('wholeScheduleSwapDeadline', 'Schedule swaps')}</div></fieldset>
        </div>
        <div className="form-footer"><button type="button" className="outline-button" disabled={loading} onClick={() => setEditing(false)}>Cancel</button><button type="submit" className="primary-button" disabled={loading}>{loading ? 'Saving…' : 'Save term'}</button></div>
      </form>
    </Modal>}
    {recordingStanding && <TermStandingModal token={token} terms={terms} selectedTerm={terms.find(term => term._id === termId || term.code === termId) || terms.find(term => term.isActive)} onClose={() => setRecordingStanding(false)} onSaved={standingSaved} />}
  </div>;
}
