import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAcademicTerm } from './term-validation.js';
const valid = { academicYear: '2026/2027', season: 'spring', termStart: '2027-02-01', termEnd: '2027-07-01', teachingStart: '2027-02-07', teachingEnd: '2027-06-20', registrationStart: '2027-01-01', registrationEnd: '2027-01-25', advisingDeadline: '2027-02-06', wholeScheduleSwapDeadline: '2027-02-10' };
test('Academic terms: missing entries receive individual actionable messages', () => {
  const errors = validateAcademicTerm({});
  assert.equal(Object.keys(errors).length, 10);
  assert.equal(errors.academicYear, 'Enter the academic year.');
  assert.equal(errors.advisingDeadline, 'Choose the advising deadline.');
  assert.equal(errors.season, 'Choose a season.');
});
test('Academic terms: valid dates allow registration before the term and either active state', () => {
  assert.deepEqual(validateAcademicTerm({ ...valid, isActive: false }), {});
  assert.deepEqual(validateAcademicTerm({ ...valid, isActive: true }), {});
});
test('Academic terms: ordering feedback identifies the affected field', () => {
  assert.equal(validateAcademicTerm({ ...valid, termEnd: '2027-01-01' }).termEnd, 'Term end must be on or after term start.');
  assert.equal(validateAcademicTerm({ ...valid, teachingStart: '2027-01-20' }).teachingStart, 'Teaching must start on or after term start.');
  assert.equal(validateAcademicTerm({ ...valid, teachingEnd: '2027-08-01' }).teachingEnd, 'Teaching must end on or before term end.');
  assert.equal(validateAcademicTerm({ ...valid, registrationEnd: '2026-12-20' }).registrationEnd, 'Registration end must be on or after registration start.');
});
test('Academic terms: malformed years and impossible dates do not submit', () => {
  assert.match(validateAcademicTerm({ ...valid, academicYear: '2027' }).academicYear, /YYYY\/YYYY/);
  assert.equal(validateAcademicTerm({ ...valid, termStart: '2027-02-30' }).termStart, 'Choose a valid date.');
});
