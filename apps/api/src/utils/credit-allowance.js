const STANDARD_ALLOWANCES = new Map([
  [2, 34],
  [3, 34],
  [4, 34],
  [5, 30],
  [6, 30],
  [7, 28],
  [8, 24],
  [9, 24],
  [10, 24],
]);

const ACTIVATED_SETTLEMENTS = new Set(["paid", "deferred"]);
const MAXIMUM_TOTAL_HOURS = 34;
const HOUR_TOLERANCE = 1e-9;

export function standardCreditAllowance(semester) {
  return STANDARD_ALLOWANCES.get(Number(semester)) ?? null;
}

function isProbationStudent(student) {
  return student.academicStanding === "probation" ||
    student.advisingReason === "probation";
}

function isUsableApprovedRequest(request, standardAllowance) {
  const snapshot = request.eligibilitySnapshot;
  if (request.decisionStatus !== "approved" || !ACTIVATED_SETTLEMENTS.has(request.settlementStatus)) return false;
  if (!snapshot || snapshot.isProbation || snapshot.standardAllowance !== standardAllowance) return false;
  if (!Number.isFinite(request.requestedHours) || request.requestedHours <= 0) return false;
  if (!Array.isArray(request.courses) || !request.courses.length) return false;

  const linesTotal = request.courses.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  if (Math.abs(linesTotal - request.requestedHours) > HOUR_TOLERANCE) return false;
  if (!Number.isFinite(snapshot.hoursBeforeRequest) || !Number.isFinite(snapshot.hoursAfterRequest) ||
    Math.abs(snapshot.hoursBeforeRequest + request.requestedHours - snapshot.hoursAfterRequest) > HOUR_TOLERANCE) return false;
  if (request.courses.some((item) => !item.course || !Number.isFinite(item.course.creditHours) ||
    Math.abs(Number(item.course.creditHours) - Number(item.hours)) > HOUR_TOLERANCE)) return false;

  const maximumForRequest = snapshot.graduatingWithinOneYear
    ? MAXIMUM_TOTAL_HOURS
    : standardAllowance + 3;
  return Number.isFinite(snapshot.hoursAfterRequest) && snapshot.hoursAfterRequest <= maximumForRequest;
}

export function calculateDraftCreditPolicy(student, requests = []) {
  const semester = Number(student.currentSemester);
  const standardAllowance = standardCreditAllowance(semester);
  const probation = isProbationStudent(student);

  // Semester 1 has no advising students. The project owner confirmed that
  // semester 2 follows the same 34-hour allowance as semesters 3–4.
  // Semester 1 remains unconfigured and uses only the overall ceiling.
  const baseAllowance = standardAllowance == null
    ? null
    : probation ? Math.ceil(standardAllowance * 0.75) : standardAllowance;
  const activeRequests = !probation && standardAllowance != null
    ? requests.filter((request) => isUsableApprovedRequest(request, standardAllowance))
    : [];

  const authorizedCourses = new Map();
  for (const request of activeRequests) {
    for (const line of request.courses) {
      const id = String(line.course._id || line.course);
      authorizedCourses.set(id, Math.max(authorizedCourses.get(id) || 0, Number(line.hours)));
    }
  }

  let approvedExtraHours = 0;
  if (baseAllowance != null && !probation) {
    const requestedHours = [...authorizedCourses.values()].reduce((sum, hours) => sum + hours, 0);
    const allGraduateEligible = activeRequests.length > 0 && activeRequests.every((request) => request.eligibilitySnapshot.graduatingWithinOneYear);
    const policyMaximum = allGraduateEligible ? MAXIMUM_TOTAL_HOURS - standardAllowance : 3;
    approvedExtraHours = Math.min(requestedHours, policyMaximum, MAXIMUM_TOTAL_HOURS - standardAllowance);
  }

  const maximumCreditHours = Math.min(
    MAXIMUM_TOTAL_HOURS,
    (baseAllowance ?? MAXIMUM_TOTAL_HOURS) + approvedExtraHours,
  );

  return {
    semester,
    probation,
    standardAllowance,
    baseAllowance,
    approvedExtraHours,
    maximumCreditHours,
    policyConfigured: standardAllowance != null,
    approvedExtraCourses: [...authorizedCourses].map(([courseId, hours]) => ({ courseId, hours })),
  };
}
