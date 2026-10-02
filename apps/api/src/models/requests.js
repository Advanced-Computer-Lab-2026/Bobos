import { ref, registerModel, Schema, withTimestamps } from "./shared.js";

const wholeScheduleSwapSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  currentSchedule: ref("StudentSchedule", { required: true }),
  currentGroup: { type: String, required: true, trim: true },
  desiredGroups: { type: [String], required: true },
  courseCodesSnapshot: { type: [String], required: true },
  status: { type: String, required: true, enum: ["open", "completed", "withdrawn", "expired"], default: "open" },
  completedWith: ref("StudentProfile", { default: null }),
  completedAt: { type: Date, default: null },
  withdrawnAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
});

wholeScheduleSwapSchema.index(
  { student: 1, term: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);
wholeScheduleSwapSchema.index({ term: 1, status: 1, createdAt: -1 });

export const WholeScheduleSwapRequest = registerModel("WholeScheduleSwapRequest", wholeScheduleSwapSchema);

const slotChangeRequestSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  schedule: ref("StudentSchedule", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  course: ref("Course", { required: true }),
  componentType: { type: String, required: true, enum: ["lecture", "tutorial", "lab"] },
  currentOffering: ref("CourseOffering", { required: true }),
  currentSlotGroupId: { type: Schema.Types.ObjectId, required: true },
  preferenceNote: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, required: true, enum: ["pending", "approved", "rejected", "withdrawn"], default: "pending" },
  replacementOffering: ref("CourseOffering", { default: null }),
  replacementSlotGroupId: { type: Schema.Types.ObjectId, default: null },
  decidedBy: ref("User", { default: null }),
  responseNote: { type: String, trim: true, maxlength: 1000 },
  decidedAt: { type: Date, default: null },
  withdrawnAt: { type: Date, default: null },
});

slotChangeRequestSchema.index({ term: 1, status: 1, createdAt: -1 });
slotChangeRequestSchema.index({ student: 1, status: 1 });

export const SlotChangeRequest = registerModel("SlotChangeRequest", slotChangeRequestSchema);

const mandatoryCourseRemovalRequestSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  course: ref("Course", { required: true, index: true }),
  advisor: ref("User", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  reason: {
    type: String,
    required: true,
    enum: ["incorrectMandatoryDesignation", "makeupEligibility", "completedHours", "restrictedCoursePair", "other"],
  },
  explanation: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, required: true, enum: ["pending", "approved", "rejected"], default: "pending" },
  decidedBy: ref("User", { default: null }),
  responseNote: { type: String, trim: true, maxlength: 1000 },
  decidedAt: { type: Date, default: null },
});

mandatoryCourseRemovalRequestSchema.index({ term: 1, status: 1, createdAt: -1 });
mandatoryCourseRemovalRequestSchema.index({ student: 1, course: 1, status: 1 });

export const MandatoryCourseRemovalRequest = registerModel(
  "MandatoryCourseRemovalRequest",
  mandatoryCourseRemovalRequestSchema,
);

const extraHoursCourseSchema = new Schema(
  {
    course: ref("Course", { required: true }),
    hours: { type: Number, required: true, min: 0 },
    isRepeated: { type: Boolean, required: true },
    pricePerHour: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const extraHoursRequestSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  advisor: ref("User", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  courses: { type: [extraHoursCourseSchema], required: true },
  requestedHours: { type: Number, required: true, min: 0 },
  totalCost: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: "EGP", enum: ["EGP"] },
  eligibilitySnapshot: {
    standardAllowance: { type: Number, required: true, min: 0 },
    hoursBeforeRequest: { type: Number, required: true, min: 0 },
    hoursAfterRequest: { type: Number, required: true, min: 0 },
    isProbation: { type: Boolean, required: true },
    graduatingWithinOneYear: { type: Boolean, required: true },
  },
  decisionStatus: { type: String, required: true, enum: ["pending", "approved", "rejected", "withdrawn"], default: "pending" },
  decidedBy: ref("User", { default: null }),
  decisionNote: { type: String, trim: true, maxlength: 1000 },
  decidedAt: { type: Date, default: null },
  settlementStatus: {
    type: String,
    required: true,
    enum: ["none", "awaitingChoice", "paid", "deferred", "failed", "cancelled", "refunded"],
    default: "none",
  },
  settlementOption: { type: String, enum: ["wallet", "gateway", "deferred", null], default: null },
});

extraHoursRequestSchema.index({ term: 1, decisionStatus: 1, settlementStatus: 1, createdAt: -1 });
extraHoursRequestSchema.index({ student: 1, createdAt: -1 });

export const ExtraHoursRequest = registerModel("ExtraHoursRequest", extraHoursRequestSchema);

const graduationTermPlanSchema = new Schema(
  {
    term: ref("AcademicTerm", { required: true }),
    courses: { type: [ref("Course")], default: [] },
  },
  { _id: false },
);

const graduationPlanSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  advisor: ref("User", { required: true, index: true }),
  termPlans: { type: [graduationTermPlanSchema], required: true },
  exitExamRequest: ref("ExitExamRequest", { default: null }),
  status: { type: String, required: true, enum: ["draft", "submitted", "accepted", "rejected"], default: "draft" },
  responseNote: { type: String, trim: true, maxlength: 2000 },
  decidedBy: ref("User", { default: null }),
  submittedAt: { type: Date, default: null },
  decidedAt: { type: Date, default: null },
});

graduationPlanSchema.index({ advisor: 1, status: 1, submittedAt: -1 });
graduationPlanSchema.index({ student: 1, status: 1, updatedAt: -1 });

export const GraduationPlan = registerModel("GraduationPlan", graduationPlanSchema);

const exitExamRequestSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  advisor: ref("User", { required: true, index: true }),
  course: ref("Course", { required: true, index: true }),
  reason: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, required: true, enum: ["pending", "approved", "rejected"], default: "pending" },
  responseNote: { type: String, trim: true, maxlength: 1000 },
  decidedBy: ref("User", { default: null }),
  decidedAt: { type: Date, default: null },
});

exitExamRequestSchema.index({ status: 1, createdAt: -1 });

export const ExitExamRequest = registerModel("ExitExamRequest", exitExamRequestSchema);
