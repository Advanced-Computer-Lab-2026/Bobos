import { ACADEMIC_STANDINGS, DAYS_OF_WEEK, STUDENT_TYPES, WORKFLOW_STATUSES, ref, registerModel, Schema, withTimestamps } from "./shared.js";

const scheduleSlotSchema = new Schema(
  {
    componentType: { type: String, required: true, enum: ["lecture", "tutorial", "lab"] },
    courseOffering: ref("CourseOffering", { required: true }),
    slotGroupId: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const templateCourseSchema = new Schema(
  {
    course: ref("Course", { required: true }),
    courseOffering: ref("CourseOffering", { required: true }),
    slots: { type: [scheduleSlotSchema], default: [] },
  },
  { _id: false },
);

const scheduleTemplateSchema = withTimestamps({
  term: ref("AcademicTerm", { required: true, index: true }),
  major: { type: String, required: true, trim: true },
  semester: { type: Number, required: true, min: 1, max: 10 },
  studyGroup: { type: String, required: true, trim: true },
  courses: { type: [templateCourseSchema], default: [] },
  isPublished: { type: Boolean, default: false, index: true },
});

scheduleTemplateSchema.index({ term: 1, major: 1, semester: 1, studyGroup: 1 }, { unique: true });

export const ScheduleTemplate = registerModel("ScheduleTemplate", scheduleTemplateSchema);

const scheduledCourseSchema = new Schema(
  {
    course: ref("Course", { required: true }),
    courseOffering: ref("CourseOffering", { required: true }),
    slots: { type: [scheduleSlotSchema], default: [] },
    isMandatory: { type: Boolean, default: false },
    isExtraHours: { type: Boolean, default: false },
    creditHoursSnapshot: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const studentScheduleSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  scheduleType: { type: String, required: true, enum: ["normal", "advising"] },
  status: {
    type: String,
    required: true,
    enum: ["draft", "readyForStudentReview", "processed"],
    default: "draft",
  },
  template: ref("ScheduleTemplate", { default: null }),
  courses: { type: [scheduledCourseSchema], default: [] },
  version: { type: Number, default: 1, min: 1 },
  createdBy: ref("User", { required: true }),
  processedBy: ref("User", { default: null }),
  processedAt: { type: Date, default: null },
  reopenedAt: { type: Date, default: null },
  reopenReason: { type: String, trim: true },
});

studentScheduleSchema.index({ student: 1, term: 1, scheduleType: 1 }, { unique: true });
studentScheduleSchema.index({ term: 1, status: 1, updatedAt: -1 });
studentScheduleSchema.pre("validate", function () {
  if (this.reopenedAt && !this.reopenReason?.trim()) {
    this.invalidate("reopenReason", "A reason is required when reopening a schedule");
  }
});

export const StudentSchedule = registerModel("StudentSchedule", studentScheduleSchema);

const courseAttemptSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  course: ref("Course", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  attemptNumber: { type: Number, required: true, min: 1, default: 1 },
  attendance: { type: String, required: true, enum: ["attended", "unattended"] },
  result: { type: String, required: true, enum: ["current", "passed", "failed"] },
  grade: { type: String, trim: true },
});

courseAttemptSchema.index({ student: 1, term: 1, course: 1, attemptNumber: 1 }, { unique: true });

export const CourseAttempt = registerModel("CourseAttempt", courseAttemptSchema);

const studentTermStandingSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  academicStanding: {
    type: String,
    required: true,
    enum: ACADEMIC_STANDINGS,
  },
  calculatedAt: { type: Date, required: true, default: Date.now },
});

studentTermStandingSchema.index({ student: 1, term: 1 }, { unique: true });

export const StudentTermStanding = registerModel("StudentTermStanding", studentTermStandingSchema);

const rankedDaySchema = new Schema(
  {
    day: { type: String, required: true, enum: DAYS_OF_WEEK },
    priority: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const rankedTimeRangeSchema = new Schema(
  {
    startMinute: { type: Number, required: true, min: 0, max: 1439 },
    endMinute: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
      validate: {
        validator(value) {
          return value > this.startMinute;
        },
        message: "Preferred time range end must be after its start",
      },
    },
    priority: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const rankedGroupSchema = new Schema(
  {
    course: ref("Course", { required: true }),
    componentType: { type: String, required: true, enum: ["lecture", "tutorial", "lab"] },
    groupNumber: { type: String, required: true, trim: true },
    priority: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const schedulingPreferenceSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  preferredDays: { type: [rankedDaySchema], default: [] },
  avoidedDays: { type: [rankedDaySchema], default: [] },
  preferredTimes: { type: [rankedTimeRangeSchema], default: [] },
  avoidedTimes: { type: [rankedTimeRangeSchema], default: [] },
  preferredGroups: { type: [rankedGroupSchema], default: [] },
  desiredDaysOff: { type: [rankedDaySchema], default: [] },
  note: { type: String, trim: true, maxlength: 1000 },
});

schedulingPreferenceSchema.index({ student: 1, term: 1 }, { unique: true });

export const SchedulingPreference = registerModel("SchedulingPreference", schedulingPreferenceSchema);

const studentWorkflowStateSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  studentType: { type: String, required: true, enum: STUDENT_TYPES },
  status: { type: String, required: true, enum: WORKFLOW_STATUSES },
  blockingStep: { type: String, trim: true, default: null },
  lastActivityAt: { type: Date, required: true, default: Date.now },
  calculatedAt: { type: Date, required: true, default: Date.now },
});

studentWorkflowStateSchema.index({ student: 1, term: 1 }, { unique: true });
studentWorkflowStateSchema.index({ term: 1, studentType: 1, status: 1, blockingStep: 1, lastActivityAt: -1 });

export const StudentWorkflowState = registerModel("StudentWorkflowState", studentWorkflowStateSchema);
