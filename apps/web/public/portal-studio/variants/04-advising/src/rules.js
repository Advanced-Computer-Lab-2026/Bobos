/* Small, deterministic preview rules. The connected React adapters defer to the API. */
(function (global) {
  'use strict';
  const staff = ['advisor', 'coordinator'];
  const can = (role, task) => ({
    directory: ['coordinator', 'administrator'],
    'student-detail': ['advisor', 'coordinator', 'administrator'],
    advising: staff,
    'student-schedules': [...staff, 'administrator'],
    'draft-schedule': [...staff, 'administrator'],
    'mandatory-removals': [...staff, 'administrator'],
    edit: staff, assign: ['coordinator'], account: ['administrator'],
    removalRequest: ['advisor'], removalDecision: ['coordinator'],
    slotReview: staff,
  }[task] || []).includes(role);
  function allowance(student) {
    const standard = student.semester <= 4 ? 34 : student.semester <= 6 ? 30 : student.semester === 7 ? 28 : 24;
    const probation = Number(student.gpa) >= 3.7 || student.standing === 'Probation' || student.reason === 'Probation';
    return { standard, probation, allowed: probation ? Math.ceil(standard * .75) : standard };
  }
  const minutes = value => { const [h, m] = String(value).split(':').map(Number); return h * 60 + m; };
  const overlap = (a, b) => a.day === b.day && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
  function totals(draft, student, courses) {
    const selected = draft.courses.reduce((sum, code) => sum + (courses.find(c => c.code === code)?.credits || 0), 0);
    const base = allowance(student);
    const extra = base.probation ? 0 : (draft.extra?.approved && ['paid', 'deferred'].includes(draft.extra.settlement) ? draft.extra.hours : 0);
    return { selected, allowed: base.allowed, extra, remaining: base.allowed + extra - selected };
  }
  function validate(draft, student, courses, slots) {
    const issues = [], selectedSlots = [];
    for (const code of draft.mandatory) {
      if (!draft.removed.includes(code) && !draft.courses.includes(code)) issues.push(`Select mandatory course ${code}.`);
    }
    for (const code of draft.courses) {
      const course = courses.find(c => c.code === code);
      if (!course) { issues.push(`${code} is no longer in the catalogue.`); continue; }
      if (!course.published) issues.push(`${code} has no published offering.`);
      if (!course.eligible) issues.push(`${code} does not meet prerequisite or progression rules.`);
      for (const component of course.components) {
        const id = draft.slots[code]?.[component], slot = slots.find(s => s.id === id);
        if (!slot) { issues.push(`${code}: assign a ${component}.`); continue; }
        if (slot.course !== code || slot.component !== component) { issues.push(`${code}: invalid ${component} selection.`); continue; }
        if (slot.remaining <= 0 && !draft.reserved.includes(slot.id)) issues.push(`${code}: ${component} group ${slot.group} is full.`);
        selectedSlots.push(slot);
      }
    }
    for (let i = 0; i < selectedSlots.length; i++) for (let j = i + 1; j < selectedSlots.length; j++) {
      if (overlap(selectedSlots[i], selectedSlots[j])) issues.push(`${selectedSlots[i].course} and ${selectedSlots[j].course} clash on ${selectedSlots[i].day}.`);
    }
    if (!draft.courses.length) issues.push('Select at least one course.');
    if (totals(draft, student, courses).remaining < 0) issues.push('Selected credits exceed the allowed and activated extra hours.');
    if (draft.bachelor && !student.bachelorEligible) issues.push('Bachelor project eligibility is not satisfied.');
    if (draft.bachelor && !['Winter', 'Spring'].includes(draft.bachelor)) issues.push('Choose Winter or Spring for the bachelor project.');
    if (draft.bachelor) {
      const core = draft.courses.filter(code => courses.find(c => c.code === code)?.type === 'core').length;
      const huma = draft.courses.filter(code => courses.find(c => c.code === code)?.type === 'huma').length;
      if (core > 2 || huma > 2 || draft.courses.length > 4) issues.push('With the bachelor project, select at most two core and two humanities courses.');
      if (draft.courses.length && !(draft.extra?.approved && ['paid', 'deferred'].includes(draft.extra.settlement))) issues.push('Courses accompanying the bachelor project require extra-hours approval and a payment choice.');
    }
    return [...new Set(issues)];
  }
  function blockers(draft) {
    return [
      draft.pendingSlot ? 'Resolve the pending slot-change request.' : '',
      draft.pendingRemoval ? 'Resolve the mandatory-course removal request.' : '',
      draft.extra && !draft.extra.approved ? 'Extra-hours approval is still pending.' : '',
      draft.extra?.approved && !['paid', 'deferred'].includes(draft.extra.settlement) ? 'The student must choose payment or the next installment.' : '',
    ].filter(Boolean);
  }
  function status(draft) {
    if (draft.status === 'Processed') return 'Processed';
    if (draft.pendingSlot) return 'Change request pending';
    if (draft.pendingRemoval || (draft.extra && !draft.extra.approved)) return 'Pending approval';
    if (draft.extra?.approved && !['paid', 'deferred'].includes(draft.extra.settlement)) return 'Awaiting payment choice';
    return draft.status || 'Not started';
  }
  function removalEligible(student, reason) {
    if (reason === 'First makeup') return true;
    if (reason === 'Second makeup') return student.failedCount >= 1 && student.failedCount <= 2;
    if (reason === 'Completed hours') return student.completedHours > 157;
    if (reason === 'Restricted pair') return !!student.restrictedPair;
    return false;
  }
  function filter(records, values) {
    const search = (values.search || '').trim().toLowerCase();
    return records.filter(record => {
      if (search && ![record.name, record.id, record.studentId, record.email, record.course, record.advisor, record.advisorEmail].join(' ').toLowerCase().includes(search)) return false;
      return Object.entries(values).every(([key, value]) => {
        if (!value || ['search','focus','compare','letter'].includes(key)) return true;
        if (key === 'from') return record.date >= value;
        if (key === 'to') return record.date <= value;
        return String(record[key] ?? '') === String(value);
      });
    });
  }
  const api = { can, allowance, minutes, overlap, totals, validate, blockers, status, removalEligible, filter };
  global.PortalAdvisingRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
