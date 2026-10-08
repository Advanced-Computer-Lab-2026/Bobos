// Requirement 34 - which standard schedule groups a Normal Student may swap
// their WHOLE schedule into. Pure function (no database access) so the rule is
// unit-tested in isolation and reqs 35/37 can re-check it when a swap request
// is submitted / approved.
//
//   Rule: only PUBLISHED standard schedule groups of the SAME term whose set of
//   registered course codes EXACTLY equals the student's current set (no extra
//   and no missing subject). The student's own current group is excluded.
//
// Capacity, deadline and major are deliberately NOT filtered here: they are
// validated when the request is submitted/approved (reqs 35/37). They are only
// reported (minRemainingCapacity) for the UI.
import { resolveTemplateSlots } from '../controllers/groupAssignmentController.js';
import { buildWeeklyCalendar } from './weeklyCalendar.js';

const norm = (code) => String(code || '').trim().toUpperCase();

export function courseCodeSet(codes = []) {
  return new Set(codes.map(norm).filter(Boolean));
}

// true when both lists name exactly the same course codes (order-insensitive).
export function isExactCourseSet(a, b) {
  const left = courseCodeSet(a);
  const right = courseCodeSet(b);
  if (left.size !== right.size) return false;
  for (const code of left) if (!right.has(code)) return false;
  return true;
}

export const compareStudyGroups = (a, b) =>
  String(a.studyGroup).localeCompare(String(b.studyGroup), undefined, { numeric: true }) ||
  String(a.major).localeCompare(String(b.major)) ||
  (a.semester || 0) - (b.semester || 0);

/**
 * @param {object}   args
 * @param {string[]} args.studentCourseCodes  codes in the student's processed schedule
 * @param {*}        args.currentTemplateId   template the student is assigned to (excluded)
 * @param {object[]} args.templates           candidate ScheduleTemplates (same term)
 * @param {Map}      args.offeringsById       String(offering _id) -> offering with populated course
 * @returns {object[]} eligible groups, sorted by study group (numeric-aware)
 */
export function findEligibleGroups({ studentCourseCodes = [], currentTemplateId = null, templates = [], offeringsById = new Map() }) {
  const wanted = courseCodeSet(studentCourseCodes);
  if (wanted.size === 0) return [];

  const eligible = [];
  for (const template of templates) {
    if (!template || !template.isPublished) continue;
    // Match by template id, not group string: "group 1" exists in every cohort.
    if (currentTemplateId && String(template._id) === String(currentTemplateId)) continue;

    // A missing / unpublished offering or a stale slot id makes the template
    // ineligible (never a crash).
    const resolved = resolveTemplateSlots(template, offeringsById);
    if (resolved.error) continue;

    const codes = resolved.entries.map((e) => e.courseCode);
    if (codes.some((c) => !c) || !isExactCourseSet(codes, [...wanted])) continue;

    const remaining = resolved.slots.map((s) => Math.max(0, (s.maxCapacity || 0) - (s.assignedCount || 0)));
    const { courses, week, daysOff, totalCreditHours } = buildWeeklyCalendar(resolved.entries);

    eligible.push({
      templateId: template._id,
      studyGroup: template.studyGroup,
      major: template.major,
      semester: template.semester,
      totalCreditHours,
      minRemainingCapacity: remaining.length ? Math.min(...remaining) : null,
      courses,
      week,
      daysOff
    });
  }

  return eligible.sort(compareStudyGroups);
}
