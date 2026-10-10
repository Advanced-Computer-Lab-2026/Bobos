import assert from "node:assert/strict";
import test from "node:test";
import { calculateDraftCreditPolicy, standardCreditAllowance } from "./credit-allowance.js";

function activatedRequest({ hours = 3, settlementStatus = "paid", graduatingWithinOneYear = false, hoursBeforeRequest = 30 } = {}) {
  const course = { _id: "course-1", creditHours: hours, code: "EXTRA1" };
  return {
    decisionStatus: "approved",
    settlementStatus,
    requestedHours: hours,
    courses: [{ course, hours }],
    eligibilitySnapshot: {
      standardAllowance: 30,
      hoursBeforeRequest,
      hoursAfterRequest: hoursBeforeRequest + hours,
      isProbation: false,
      graduatingWithinOneYear,
    },
  };
}

test("standard allowances match the requirement's semester bands", () => {
  assert.equal(standardCreditAllowance(2), 34);
  assert.equal(standardCreditAllowance(3), 34);
  assert.equal(standardCreditAllowance(4), 34);
  assert.equal(standardCreditAllowance(5), 30);
  assert.equal(standardCreditAllowance(6), 30);
  assert.equal(standardCreditAllowance(7), 28);
  assert.equal(standardCreditAllowance(8), 24);
  assert.equal(standardCreditAllowance(10), 24);
  assert.equal(standardCreditAllowance(1), null);
});

test("semester 2 uses the 34-hour allowance and semester 1 has no advising baseline", () => {
  const semesterTwo = calculateDraftCreditPolicy({ currentSemester: 2 });
  const semesterOne = calculateDraftCreditPolicy({ currentSemester: 1 });
  assert.equal(semesterTwo.policyConfigured, true);
  assert.equal(semesterTwo.baseAllowance, 34);
  assert.equal(semesterTwo.maximumCreditHours, 34);
  assert.equal(semesterOne.policyConfigured, false);
  assert.equal(semesterOne.maximumCreditHours, 34);
});

test("probation allowance is 75 percent rounded up and never receives extra hours", () => {
  const policy = calculateDraftCreditPolicy({ currentSemester: 5, academicStanding: "probation", gpa: 2 }, [activatedRequest()]);
  assert.equal(policy.baseAllowance, 23);
  assert.equal(policy.approvedExtraHours, 0);
  assert.equal(policy.maximumCreditHours, 23);
  assert.deepEqual(policy.approvedExtraCourses, []);
});

test("GPA alone does not mark a student as on probation", () => {
  const policy = calculateDraftCreditPolicy({ currentSemester: 5, academicStanding: "goodAcademicStanding", advisingReason: "failedCourses", gpa: 3.9 }, [activatedRequest()]);
  assert.equal(policy.probation, false);
  assert.equal(policy.baseAllowance, 30);
  assert.equal(policy.maximumCreditHours, 33);
});

test("approved hours activate only after paid or deferred settlement", () => {
  const student = { currentSemester: 5, academicStanding: "goodAcademicStanding", advisingReason: "failedCourses", gpa: 2.5 };
  const awaiting = calculateDraftCreditPolicy(student, [activatedRequest({ settlementStatus: "awaitingChoice" })]);
  const paid = calculateDraftCreditPolicy(student, [activatedRequest({ settlementStatus: "paid" })]);
  const deferred = calculateDraftCreditPolicy(student, [activatedRequest({ settlementStatus: "deferred" })]);
  assert.equal(awaiting.maximumCreditHours, 30);
  assert.equal(paid.maximumCreditHours, 33);
  assert.equal(deferred.maximumCreditHours, 33);
  assert.equal(paid.approvedExtraCourses[0].hours, 3);
});

test("non-graduating students are limited to three extra hours and graduating students to 34 total", () => {
  const student = { currentSemester: 5, academicStanding: "goodAcademicStanding", advisingReason: "failedCourses", gpa: 2.5 };
  const invalidNonGraduating = calculateDraftCreditPolicy(student, [activatedRequest({ hours: 4, hoursBeforeRequest: 30 })]);
  const graduating = calculateDraftCreditPolicy(student, [activatedRequest({ hours: 4, hoursBeforeRequest: 30, graduatingWithinOneYear: true })]);
  assert.equal(invalidNonGraduating.maximumCreditHours, 30);
  assert.equal(invalidNonGraduating.approvedExtraCourses.length, 0);
  assert.equal(graduating.maximumCreditHours, 34);
});
