import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { CourseAttempt, StudentSchedule, StudentTermStanding } from "./academics.js";
import { Course, CourseOffering } from "./catalogue.js";
import { Notification, ScheduleActivity } from "./communications.js";
import { FinancialReversalRequest } from "./finance.js";
import { StudentProfile, User } from "./identity.js";
import { ExtraHoursRequest, GraduationPlan, SlotChangeRequest, WholeScheduleSwapRequest } from "./requests.js";

const id = () => new mongoose.Types.ObjectId();
const invalid = (document) => assert.rejects(document.validate(), mongoose.Error.ValidationError);
const valid = (document) => assert.doesNotReject(document.validate());

test("courses retain curriculum component hours without changing the CSV fields", async () => {
  await valid(new Course({
    code: "CSEN 101",
    name: "Intro to Computer Science",
    creditHours: 6,
    courseType: "core",
    lectureHours: 2,
    tutorialHours: 2,
    labHours: 2,
  }));

  await valid(new Course({
    code: "CSEN 102",
    name: "Another Course",
    creditHours: 4,
    courseType: "core",
  }));
});

test("student term standings can retain a standing snapshot", async () => {
  await valid(new StudentTermStanding({
    student: id(),
    term: id(),
    academicStanding: "probation",
  }));
});

test("completed course attempts require a grade", async () => {
  const fields = { student: id(), course: id(), term: id(), attendance: "attended" };

  await invalid(new CourseAttempt({ ...fields, result: "passed" }));
  await invalid(new CourseAttempt({ ...fields, result: "failed" }));
  await valid(new CourseAttempt({ ...fields, result: "passed", grade: "A" }));
  await valid(new CourseAttempt({ ...fields, result: "current" }));
});

test("advising students require a supported advising reason", async () => {
  const fields = {
    user: id(),
    studentId: "26-12345",
    studentType: "advising",
    currentSemester: 1,
    gpa: 2.5,
    academicStanding: "goodAcademicStanding",
  };

  await invalid(new StudentProfile(fields));
  await valid(new StudentProfile({ ...fields, advisingReason: "probation" }));
  await valid(new StudentProfile({ ...fields, studentType: "normal" }));
});

test("advisor roster membership does not change account activity", async () => {
  const advisor = new User({ email: "advisor@guc.edu.eg", fullName: "Advisor", passwordHash: "hash", role: "advisor" });
  assert.equal(advisor.isAdvisorInSystem, false);
  assert.equal(advisor.isActive, true);
  await valid(advisor);
});

test("graduation plans use draft when a coordinator rejects them", async () => {
  const fields = { student: id(), advisor: id(), termPlans: [] };

  await invalid(new GraduationPlan({ ...fields, status: "rejected" }));
  await valid(new GraduationPlan({ ...fields, status: "draft" }));
});

test("financial reversal requests capture a pending coordinator action", async () => {
  await valid(new FinancialReversalRequest({
    student: id(),
    extraHoursRequest: id(),
    originalTransaction: id(),
    requestedBy: id(),
    reversalType: "refundToWallet",
  }));
  await invalid(new FinancialReversalRequest({
    student: id(),
    extraHoursRequest: id(),
    originalTransaction: id(),
    requestedBy: id(),
    reversalType: "walletRefund",
  }));
});

test("required notification events are valid notification types", async () => {
  for (const type of ["slotChangeWithdrawn", "exitExamRequested", "extraHoursRequested"]) {
    await valid(new Notification({ recipient: id(), type, title: "Update", message: "Action needed" }));
  }
});

test("offering capacity cannot be lower than assigned students", async () => {
  const fields = {
    academicYear: "2025/2026",
    course: id(),
    term: id(),
    slots: [{
      componentType: "lecture",
      groupNumber: "1",
      day: "Monday",
      startMinute: 540,
      endMinute: 600,
      room: "A1",
      capacity: 1,
      assignedStudentCount: 2,
    }],
  };

  await invalid(new CourseOffering(fields));
  await valid(new CourseOffering({
    ...fields,
    slots: [{ ...fields.slots[0], capacity: 2 }],
  }));
});

test("published offerings require an instructor, eligible group, and slot", async () => {
  const fields = { course: id(), term: id(), academicYear: "2025/2026", isPublished: true };

  await invalid(new CourseOffering(fields));
  await valid(new CourseOffering({
    ...fields,
    instructors: [{ fullName: "Instructor" }],
    eligibleGroups: [{ major: "CS" }],
    slots: [{
      componentType: "lecture",
      groupNumber: "1",
      day: "Monday",
      startMinute: 540,
      endMinute: 600,
      room: "A1",
      capacity: 30,
    }],
  }));
  await valid(new CourseOffering({ course: id(), term: id(), academicYear: "2025/2026" }));
});

test("an open swap requires at least one desired group", async () => {
  const fields = {
    student: id(),
    term: id(),
    currentSchedule: id(),
    currentGroup: "1",
    courseCodesSnapshot: ["CSEN 101"],
    expiresAt: new Date(),
  };

  await invalid(new WholeScheduleSwapRequest({ ...fields, desiredGroups: [] }));
  await valid(new WholeScheduleSwapRequest({ ...fields, desiredGroups: ["2"] }));
});

test("extra-hours requests require courses and a positive hour count", async () => {
  const fields = {
    student: id(),
    advisor: id(),
    term: id(),
    totalCost: 1600,
    eligibilitySnapshot: {
      standardAllowance: 30,
      hoursBeforeRequest: 30,
      hoursAfterRequest: 32,
      isProbation: false,
      graduatingWithinOneYear: false,
    },
  };
  const course = { course: id(), hours: 2, isRepeated: false, pricePerHour: 800, subtotal: 1600 };

  await invalid(new ExtraHoursRequest({ ...fields, courses: [], requestedHours: 0 }));
  await invalid(new ExtraHoursRequest({ ...fields, courses: [course], requestedHours: 0 }));
  await valid(new ExtraHoursRequest({ ...fields, courses: [course], requestedHours: 2 }));
  await invalid(new ExtraHoursRequest({ ...fields, courses: [{ ...course, pricePerHour: 1000 }], requestedHours: 2 }));
  await invalid(new ExtraHoursRequest({ ...fields, courses: [{ ...course, subtotal: 1500 }], requestedHours: 2 }));
  await invalid(new ExtraHoursRequest({ ...fields, courses: [course], requestedHours: 3 }));
  await invalid(new ExtraHoursRequest({ ...fields, courses: [course], requestedHours: 2, totalCost: 1500 }));
});

test("approved slot changes require a replacement offering and slot", async () => {
  const fields = {
    student: id(),
    schedule: id(),
    term: id(),
    course: id(),
    componentType: "lecture",
    currentOffering: id(),
    currentSlotGroupId: id(),
    status: "approved",
  };

  await invalid(new SlotChangeRequest(fields));
  await valid(new SlotChangeRequest({
    ...fields,
    replacementOffering: id(),
    replacementSlotGroupId: id(),
  }));
});

test("reopened schedules use the draft status", async () => {
  const fields = { student: id(), term: id(), scheduleType: "advising", createdBy: id() };

  await invalid(new StudentSchedule({ ...fields, status: "reopened" }));
  await valid(new StudentSchedule({ ...fields, status: "draft" }));
});

test("reopened activity records require a reason", async () => {
  const fields = {
    student: id(),
    term: id(),
    schedule: id(),
    action: "reopened",
    scheduleVersion: 2,
    actor: id(),
    actorName: "Coordinator",
    actorEmail: "coordinator@guc.edu.eg",
    actorRole: "coordinator",
  };

  await invalid(new ScheduleActivity(fields));
  await valid(new ScheduleActivity({ ...fields, reason: "Correcting a course assignment" }));
});
