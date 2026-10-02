import { ref, registerModel, Schema, withTimestamps } from "./shared.js";

const wholeScheduleSwapSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true }),
  currentSchedule: ref("StudentSchedule", { required: true }),
  currentGroup: { type: String, required: true, trim: true },
  desiredGroups: {
    type: [String],
    required: true,
    validate: {
      validator: (groups) => Array.isArray(groups) && groups.length > 0,
      message: "Select at least one desired group",
    },
  },
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
  student: ref("StudentProfile", { required: true }),
  schedule: ref("StudentSchedule", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true }),
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
slotChangeRequestSchema.pre("validate", function () {
  if (this.status === "approved" && (!this.replacementOffering || !this.replacementSlotGroupId)) {
    this.invalidate("replacementSlotGroupId", "An approved request requires a replacement slot");
  }
});

export const SlotChangeRequest = registerModel("SlotChangeRequest", slotChangeRequestSchema);

const mandatoryCourseRemovalRequestSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  course: ref("Course", { required: true, index: true }),
  advisor: ref("User", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true }),
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
    hours: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: (hours) => hours > 0, message: "Course hours must be greater than zero" },
    },
    isRepeated: { type: Boolean, required: true },
    pricePerHour: { type: Number, required: true, enum: [800, 1000] },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const extraHoursRequestSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  advisor: ref("User", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true }),
  courses: {
    type: [extraHoursCourseSchema],
    required: true,
    validate: { validator: (courses) => Array.isArray(courses) && courses.length > 0, message: "Add at least one course" },
  },
  requestedHours: {
    type: Number,
    required: true,
    min: 0,
    validate: { validator: (hours) => hours > 0, message: "Requested hours must be greater than zero" },
  },
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
extraHoursRequestSchema.pre("validate", function () {
  const courses = this.courses ?? [];
  const hasCompleteAmounts = courses.every((course) =>
    Number.isFinite(course.hours) && Number.isFinite(course.pricePerHour) && Number.isFinite(course.subtotal),
  );

  if (!hasCompleteAmounts) return;

  const expectedHours = courses.reduce((total, course) => total + course.hours, 0);
  const expectedCost = courses.reduce((total, course) => total + course.subtotal, 0);
  const matchesMoney = (left, right) => Math.round(left * 100) === Math.round(right * 100);

  courses.forEach((course, index) => {
    const expectedRate = course.isRepeated ? 1000 : 800;
    if (course.pricePerHour !== expectedRate) {
      this.invalidate(`courses.${index}.pricePerHour`, "Price per hour must match whether the course is repeated");
    }
    if (!matchesMoney(course.subtotal, course.hours * course.pricePerHour)) {
      this.invalidate(`courses.${index}.subtotal`, "Course subtotal must equal hours multiplied by price per hour");
    }
  });

  if (Math.abs(this.requestedHours - expectedHours) > 1e-9) {
    this.invalidate("requestedHours", "Requested hours must equal the sum of course hours");
  }
  if (Number.isFinite(this.totalCost) && !matchesMoney(this.totalCost, expectedCost)) {
    this.invalidate("totalCost", "Total cost must equal the sum of course subtotals");
  }
});

export const ExtraHoursRequest = registerModel("ExtraHoursRequest", extraHoursRequestSchema);

const graduationTermPlanSchema = new Schema(
  {
    term: ref("AcademicTerm", { required: true }),
    courses: { type: [ref("Course")], default: [] },
  },
  { _id: false },
);

const graduationPlanSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  advisor: ref("User", { required: true }),
  termPlans: { type: [graduationTermPlanSchema], required: true },
  exitExamRequest: ref("ExitExamRequest", { default: null }),
  status: { type: String, required: true, enum: ["draft", "submitted", "accepted"], default: "draft" },
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
