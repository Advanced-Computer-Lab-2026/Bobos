import { CourseAttempt } from "../models/academics.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { FinancialReversalRequest, FinancialTransaction } from "../models/finance.js";
import { ExtraHoursRequest } from "../models/requests.js";
import { calculateDraftCreditPolicy } from "../utils/credit-allowance.js";
import { majorMatches } from "../utils/major.js";

const planningSeasons = ["winter", "spring", "summer"];
const hourTolerance = 1e-9;
const idOf = (value) => String(value._id ?? value);
// MET curriculum: two four-hour electives in semester 9 and two in semester 10,
// for both CS and DMET.
const requiredElectiveCount = 4;
const requiredElectiveHours = 16;

export async function loadGraduationContext(student, now = new Date()) {
  const windowEnd = new Date(now);
  windowEnd.setUTCFullYear(windowEnd.getUTCFullYear() + 1);
  const [catalogue, attempts, futureTerms] = await Promise.all([
    Course.find().select("code name courseType isActive facultyMajors creditHours prerequisites offeringSeasons recommendedSemester")
      .sort({ recommendedSemester: 1, code: 1 }).lean(),
    CourseAttempt.find({ student: student._id }).select("course result term attemptNumber createdAt")
      .populate("term", "termStart termEnd").lean(),
    AcademicTerm.find({ season: { $in: planningSeasons }, termStart: { $gt: now }, termEnd: { $lte: windowEnd } })
      .select("code season academicYear termStart termEnd").sort({ termStart: 1, _id: 1 }).lean(),
  ]);
  const termsBySeason = new Map();
  for (const term of futureTerms) {
    if (!termsBySeason.has(term.season)) termsBySeason.set(term.season, term);
  }
  const terms = [...termsBySeason.values()];
  const termIds = terms.map((term) => term._id);
  const passed = new Set(attempts.filter((attempt) => attempt.result === "passed").map((attempt) => idOf(attempt.course)));
  const current = new Map();
  const latest = new Map();
  attempts.sort((a, b) => new Date(b.term?.termStart ?? b.createdAt) - new Date(a.term?.termStart ?? a.createdAt)
    || b.attemptNumber - a.attemptNumber || new Date(b.createdAt) - new Date(a.createdAt));
  for (const attempt of attempts) {
    const courseId = idOf(attempt.course);
    if (latest.has(courseId)) continue;
    latest.set(courseId, attempt);
    if (attempt.result !== "current") continue;
    const end = attempt.term?.termEnd?.getTime() ?? Infinity;
    // An expired current record is unresolved, so it must not waive a requirement.
    if (end >= Date.now()) current.set(courseId, end);
  }
  const failed = new Set(attempts.filter((attempt) => attempt.result === "failed").map((attempt) => idOf(attempt.course)));
  const remaining = catalogue.filter((course) => {
    const courseId = idOf(course);
    return !passed.has(courseId) && !current.has(courseId)
      && (!course.facultyMajors?.length || course.facultyMajors.some((major) => majorMatches(major, student.major)));
  });
  const completedElectives = catalogue.filter((course) => course.courseType === "elective"
    && (passed.has(idOf(course)) || (current.get(idOf(course)) ?? Infinity) <= windowEnd.getTime())
    && (!course.facultyMajors?.length || course.facultyMajors.some((major) => majorMatches(major, student.major))));
  const electiveRequirement = {
    count: Math.max(0, requiredElectiveCount - completedElectives.length),
    hours: Math.max(0, requiredElectiveHours - completedElectives.reduce((sum, course) => sum + course.creditHours, 0)),
  };
  const [offerings, requests] = await Promise.all([
    CourseOffering.find({ course: { $in: remaining.map((course) => course._id) }, term: { $in: termIds }, isPublished: true })
      .select("course term").lean(),
    ExtraHoursRequest.find({ student: student._id, term: { $in: termIds }, decisionStatus: "approved", settlementStatus: { $in: ["paid", "deferred"] } })
      .populate("courses.course", "creditHours").lean(),
  ]);
  const requestIds = requests.map((request) => request._id);
  const [reversals, reversalEntries] = requestIds.length ? await Promise.all([
    FinancialReversalRequest.distinct("extraHoursRequest", { student: student._id, extraHoursRequest: { $in: requestIds }, status: "completed" }),
    FinancialTransaction.distinct("extraHoursRequest", { student: student._id, extraHoursRequest: { $in: requestIds },
      kind: { $in: ["refund", "deferredChargeCancellation"] }, status: "succeeded" }),
  ]) : [[], []];
  const revoked = new Set([...reversals, ...reversalEntries].map(idOf));
  const published = new Set(offerings.map((offering) => `${idOf(offering.course)}:${idOf(offering.term)}`));
  const courses = remaining.map((course) => ({
    _id: idOf(course),
    code: course.code,
    name: course.name,
    creditHours: course.creditHours,
    elective: course.courseType === "elective",
    required: course.courseType !== "elective" || failed.has(idOf(course)),
    prerequisites: (course.prerequisites ?? []).map(idOf),
    offeringSeasons: course.offeringSeasons ?? [],
    offeringKnown: Boolean(course.offeringSeasons?.length) || terms.some((term) => published.has(`${idOf(course)}:${idOf(term)}`)),
    termIds: terms.filter((term) => course.isActive && (course.offeringSeasons?.length
      ? course.offeringSeasons.includes(term.season)
      : published.has(`${idOf(course)}:${idOf(term)}`))).map(idOf),
    failed: failed.has(idOf(course)),
  }));
  return {
    terms: terms.map((term) => ({
      ...term,
      _id: idOf(term),
      creditPolicy: calculateDraftCreditPolicy(student, requests.filter((request) =>
        idOf(request.term) === idOf(term) && !revoked.has(idOf(request)))),
    })),
    courses,
    electiveRequirement,
    passed,
    current,
    missingSeasons: planningSeasons.filter((season) => !termsBySeason.has(season)),
    courseCodes: new Map(catalogue.map((course) => [idOf(course), course.code])),
  };
}

export function termCredits(term, courses) {
  const selected = new Set(courses.map((course) => course._id));
  const policy = term.creditPolicy;
  const total = courses.reduce((sum, course) => sum + course.creditHours, 0);
  const extra = policy.approvedExtraCourses.reduce((sum, line) =>
    sum + (selected.has(line.courseId) ? line.hours : 0), 0);
  const limit = policy.baseAllowance == null ? policy.maximumCreditHours
    : Math.min(policy.maximumCreditHours, policy.baseAllowance + extra);
  return { total, limit, valid: total <= limit + hourTolerance };
}

function prerequisiteBefore(context, prerequisite, term, placements) {
  return context.passed.has(prerequisite)
    || (context.current.get(prerequisite) ?? Infinity) <= term.termStart.getTime()
    || (placements.has(prerequisite) && placements.get(prerequisite).termEnd <= term.termStart);
}

export function validateGraduationPlan(context, termPlans, exam, { reviewing = false } = {}) {
  const issues = [];
  const missing = [];
  const terms = new Map(context.terms.map((term) => [term._id, term]));
  const courses = new Map(context.courses.map((course) => [course._id, course]));
  const placements = new Map();
  const seenTerms = new Set();

  for (const plan of termPlans) {
    const term = terms.get(plan.term);
    if (!term || seenTerms.has(plan.term)) {
      issues.push("Use each available planning term at most once.");
      continue;
    }
    seenTerms.add(plan.term);
    const selected = [];
    for (const courseId of plan.courses) {
      if (reviewing && context.passed.has(courseId)) continue;
      const course = courses.get(courseId);
      if (!course || placements.has(courseId)) {
        issues.push("Assign each remaining course at most once.");
        continue;
      }
      selected.push(course);
      placements.set(courseId, term);
      if (!course.termIds.includes(term._id)) issues.push(`${course.code} is not offered in ${term.code}.`);
    }
    const credits = termCredits(term, selected);
    if (!credits.valid) issues.push(`${term.code} has ${credits.total} credit hours. The limit for these courses is ${credits.limit}.`);
  }

  const failed = context.courses.filter((course) => course.failed);
  const completedExam = reviewing && exam && context.passed.has(idOf(exam.course));
  const examCourse = exam?.status === "approved" && failed.length === 1 && failed[0]._id === idOf(exam.course)
    ? failed[0]._id : null;
  if (exam && !examCourse && !completedExam) issues.push("Select an approved exit exam for the student's single remaining failed course.");
  if (examCourse && placements.has(examCourse)) issues.push("Remove the term assignment for the course covered by the exit exam.");
  for (const course of context.courses) {
    const term = placements.get(course._id);
    if (!term) {
      if (course.required && course._id !== examCourse) missing.push(`Assign ${course.code} to a term.`);
      continue;
    }
    for (const prerequisite of course.prerequisites) {
      if (prerequisiteBefore(context, prerequisite, term, placements)) continue;
      const code = context.courseCodes.get(prerequisite) ?? "a prerequisite";
      const message = `${course.code} requires ${code} before ${term.code}.`;
      if (courses.has(prerequisite) && !placements.has(prerequisite) && prerequisite !== examCourse) missing.push(message);
      else issues.push(message);
    }
  }
  const electives = context.courses.filter((course) => course.elective && (placements.has(course._id) || course._id === examCourse));
  if (electives.length < context.electiveRequirement.count ||
      electives.reduce((sum, course) => sum + course.creditHours, 0) < context.electiveRequirement.hours) {
    missing.push(`Assign at least ${context.electiveRequirement.count} remaining electives totalling ${context.electiveRequirement.hours} credit hours.`);
  }
  return { issues, missing };
}

// Test placements in prerequisite order. Each branch assigns a course to one of at most three terms.
function canFitCourses(context, courses) {
  const remaining = new Map(courses.map((course) => [course._id, course]));
  const ordered = [];
  while (remaining.size) {
    const next = [...remaining.values()].filter((course) => course.prerequisites.every((id) => !remaining.has(id)))
      .sort((a, b) => a.termIds.length - b.termIds.length || b.creditHours - a.creditHours)[0];
    if (!next) return false;
    remaining.delete(next._id);
    ordered.push(next);
  }

  const placements = new Map();
  const selections = new Map(context.terms.map((term) => [term._id, []]));
  let attempts = 0;
  function search(index) {
    if (index === ordered.length) {
      const electives = courses.filter((course) => course.elective && placements.has(course._id));
      return electives.length >= context.electiveRequirement.count
        && electives.reduce((sum, course) => sum + course.creditHours, 0) >= context.electiveRequirement.hours
        && context.terms.every((term) => termCredits(term, selections.get(term._id)).valid);
    }
    if (++attempts > 100_000) return null;
    const course = ordered[index];
    if (!course.required) {
      const skipped = search(index + 1);
      if (skipped !== false) return skipped;
    }
    for (const term of context.terms) {
      if (!course.termIds.includes(term._id) ||
          !course.prerequisites.every((id) => prerequisiteBefore(context, id, term, placements))) continue;
      const selected = selections.get(term._id);
      selected.push(course);
      placements.set(course._id, term);
      // A later course with activated extra hours can increase the selection's effective limit.
      const total = selected.reduce((sum, item) => sum + item.creditHours, 0);
      const result = total <= term.creditPolicy.maximumCreditHours + hourTolerance ? search(index + 1) : false;
      if (result !== false) return result;
      placements.delete(course._id);
      selected.pop();
    }
    return false;
  }

  return search(0);
}

export function exitExamEligibility(context) {
  const failed = context.courses.filter((course) => course.failed);
  if (failed.length !== 1) return { message: "An exit exam requires exactly one remaining failed course." };
  const [course] = failed;
  if (course.offeringSeasons.length && !course.offeringSeasons.some((season) => planningSeasons.includes(season))) {
    return { course };
  }
  if (context.missingSeasons.length) {
    return { course, message: `The planning calendar is missing upcoming ${context.missingSeasons.join(", ")} terms.` };
  }
  if (!course.offeringKnown) return { course, message: `Confirm offering seasons for ${course.code} before requesting an exit exam.` };
  if (!course.termIds.length) return { course };
  const fit = canFitCourses(context, context.courses);
  if (fit === true) return { course, message: `${course.code} can be repeated within the planning window.` };
  const replacementContext = {
    ...context,
    electiveRequirement: course.elective ? {
      count: Math.max(0, context.electiveRequirement.count - 1),
      hours: Math.max(0, context.electiveRequirement.hours - course.creditHours),
    } : context.electiveRequirement,
  };
  const withoutFailed = canFitCourses(replacementContext, context.courses.filter((item) => item._id !== course._id));
  if (fit === null || withoutFailed !== true) {
    return { course, message: "Could not establish that the failed course alone prevents a feasible plan. Review course availability and prerequisites." };
  }
  return { course };
}
