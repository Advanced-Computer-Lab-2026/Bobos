export const termFieldLabels = {
  academicYear: 'Academic year', season: 'Season', termStart: 'Term start', termEnd: 'Term end',
  teachingStart: 'Teaching start', teachingEnd: 'Teaching end', registrationStart: 'Registration start',
  registrationEnd: 'Registration end', advisingDeadline: 'Advising deadline', wholeScheduleSwapDeadline: 'Whole-schedule swap deadline',
};

export function validateAcademicTerm(form) {
  const errors = {};
  const missingDate = { termStart: 'Choose when the term starts.', termEnd: 'Choose when the term ends.', teachingStart: 'Choose when teaching starts.', teachingEnd: 'Choose when teaching ends.', registrationStart: 'Choose when registration opens.', registrationEnd: 'Choose when registration closes.', advisingDeadline: 'Choose the advising deadline.', wholeScheduleSwapDeadline: 'Choose the schedule-swap deadline.' };
  for (const [field, label] of Object.entries(termFieldLabels)) {
    if (!String(form[field] || '').trim()) errors[field] = field === 'season' ? 'Choose a season.' : field === 'academicYear' ? 'Enter the academic year.' : missingDate[field];
  }
  if (form.academicYear?.trim() && !/^\d{4}\/\d{4}$/.test(form.academicYear.trim())) errors.academicYear = 'Use YYYY/YYYY, for example 2026/2027.';
  for (const field of Object.keys(termFieldLabels).filter(key => !['academicYear', 'season'].includes(key))) {
    if (!form[field]) continue;
    const value = String(form[field]);
    const parsed = new Date(value + 'T12:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) errors[field] = 'Choose a valid date.';
  }
  for (const [start, end, message] of [
    ['termStart', 'termEnd', 'Term end must be on or after term start.'],
    ['teachingStart', 'teachingEnd', 'Teaching end must be on or after teaching start.'],
    ['registrationStart', 'registrationEnd', 'Registration end must be on or after registration start.'],
  ]) if (form[start] && form[end] && !errors[start] && !errors[end] && form[start] > form[end]) errors[end] = message;
  if (form.teachingStart && form.termStart && !errors.teachingStart && !errors.termStart && form.teachingStart < form.termStart) errors.teachingStart = 'Teaching must start on or after term start.';
  if (form.teachingEnd && form.termEnd && !errors.teachingEnd && !errors.termEnd && form.teachingEnd > form.termEnd) errors.teachingEnd = 'Teaching must end on or before term end.';
  return errors;
}
