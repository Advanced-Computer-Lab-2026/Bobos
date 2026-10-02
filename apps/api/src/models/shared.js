import mongoose from "mongoose";

export const { Schema } = mongoose;

export const withTimestamps = (fields, options = {}) =>
  new Schema(fields, { timestamps: true, ...options });

export const ref = (modelName, options = {}) => ({
  type: Schema.Types.ObjectId,
  ref: modelName,
  ...options,
});

export const registerModel = (name, schema) =>
  mongoose.models[name] ?? mongoose.model(name, schema);

export const USER_ROLES = [
  "normalStudent",
  "advisingStudent",
  "advisor",
  "coordinator",
  "administrator",
];

export const STUDENT_TYPES = ["normal", "advising"];
export const ACADEMIC_STANDINGS = ["goodAcademicStanding", "probation"];
export const ACADEMIC_SEASONS = ["winter", "spring", "summer", "firstMakeup", "secondMakeup"];
export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const NOTIFICATION_TYPES = [
  "advisorAssigned",
  "advisorRemoved",
  "slotChangeSubmitted",
  "slotChangeWithdrawn",
  "slotChangeDecision",
  "scheduleReadyForReview",
  "scheduleProcessed",
  "scheduleReopened",
  "scheduleSwapOpened",
  "scheduleSwapCompleted",
  "extraHoursDecision",
  "extraHoursRequested",
  "paymentUpdated",
  "deferredChargeUpdated",
  "refundIssued",
  "graduationPlanSubmitted",
  "graduationPlanDecision",
  "exitExamDecision",
  "exitExamRequested",
  "mandatoryCourseRemovalRequested",
  "financialReversalRequested",
  "advisingDeadlineReminder",
  "probationWarning",
];

export const WORKFLOW_STATUSES = [
  "scheduleAssigned",
  "swapRequestOpen",
  "swapCompleted",
  "swapWithdrawn",
  "swapExpired",
  "notStarted",
  "draft",
  "readyForStudentReview",
  "changeRequestPending",
  "pendingApproval",
  "awaitingPaymentChoice",
  "deferredToNextInstallment",
  "readyToProcess",
  "processed",
  "reopened",
];
