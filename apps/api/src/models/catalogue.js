import { ACADEMIC_SEASONS, DAYS_OF_WEEK, ref, registerModel, Schema, withTimestamps } from "./shared.js";

const academicTermSchema = withTimestamps({
  code: { type: String, required: true, trim: true, unique: true },
  academicYear: { type: String, required: true, trim: true },
  season: { type: String, required: true, enum: ACADEMIC_SEASONS },
  termStart: { type: Date, required: true },
  termEnd: { type: Date, required: true },
  teachingStart: { type: Date, required: true },
  teachingEnd: { type: Date, required: true },
  registrationStart: { type: Date, required: true },
  registrationEnd: { type: Date, required: true },
  advisingDeadline: { type: Date, required: true },
  wholeScheduleSwapDeadline: { type: Date, required: true },
  isActive: { type: Boolean, default: false, index: true },
});

academicTermSchema.pre("validate", function () {
  for (const [start, end] of [
    ["termStart", "termEnd"],
    ["teachingStart", "teachingEnd"],
    ["registrationStart", "registrationEnd"],
  ]) {
    if (this[start] && this[end] && this[start] > this[end]) {
      this.invalidate(end, `${end} must be on or after ${start}`);
    }
  }

  if (this.termStart && this.teachingStart && this.teachingStart < this.termStart) {
    this.invalidate("teachingStart", "Teaching must start during the term");
  }
  if (this.termEnd && this.teachingEnd && this.teachingEnd > this.termEnd) {
    this.invalidate("teachingEnd", "Teaching must end during the term");
  }
});

academicTermSchema.index({ academicYear: 1, season: 1 }, { unique: true });

export const AcademicTerm = registerModel("AcademicTerm", academicTermSchema);

const courseSchema = withTimestamps({
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  name: { type: String, required: true, trim: true },
  creditHours: { type: Number, required: true, min: 0 },
  courseType: { type: String, required: true, enum: ["core", "elective", "huma"] },
  facultyMajors: { type: [String], default: [] },
  recommendedSemester: { type: Number, min: 1, max: 10 },
  lectureHours: { type: Number, min: 0 },
  tutorialHours: { type: Number, min: 0 },
  labHours: { type: Number, min: 0 },
  offeringSeasons: { type: [String], enum: ACADEMIC_SEASONS, default: [] },
  prerequisites: { type: [ref("Course")], default: [] },
  isBachelorProject: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
});

courseSchema.index({ name: 1 });

export const Course = registerModel("Course", courseSchema);

const eligibleGroupSchema = new Schema(
  {
    major: { type: String, required: true },
    semester: { type: Number, min: 1, max: 10 },
    studyGroup: { type: String, trim: true },
  },
  { _id: false },
);

const instructorSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { _id: false },
);

const offeringSlotSchema = new Schema(
  {
    componentType: { type: String, required: true, enum: ["lecture", "tutorial", "lab"] },
    groupNumber: { type: String, required: true, trim: true },
    day: { type: String, required: true, enum: DAYS_OF_WEEK },
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
        message: "Slot end must be after its start",
      },
    },
    room: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 0 },
    assignedStudentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

offeringSlotSchema.pre("validate", function () {
  if (this.capacity < this.assignedStudentCount) {
    this.invalidate("capacity", "Capacity cannot be lower than assigned student count");
  }
});

offeringSlotSchema.virtual("remainingCapacity").get(function () {
  return Math.max(0, this.capacity - this.assignedStudentCount);
});

const courseOfferingSchema = withTimestamps({
  course: ref("Course", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  instructors: { type: [instructorSchema], default: [] },
  eligibleGroups: { type: [eligibleGroupSchema], default: [] },
  isPublished: { type: Boolean, default: false, index: true },
  slots: { type: [offeringSlotSchema], default: [] },
});

courseOfferingSchema.index({ term: 1, course: 1 }, { unique: true });
courseOfferingSchema.index({ term: 1, isPublished: 1 });

export const CourseOffering = registerModel("CourseOffering", courseOfferingSchema);
