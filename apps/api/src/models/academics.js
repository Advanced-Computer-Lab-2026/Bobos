import { ACADEMIC_STANDINGS, DAYS_OF_WEEK, STUDENT_TYPES, WORKFLOW_STATUSES, ref, registerModel, Schema, withTimestamps } from "./shared.js";
import mongoose from 'mongoose';

// ## Sprint 1 schemas
// ScheduleTemplate: Req. 28-29; StudentSchedule: Req. 30-34, 49; CourseAttempt: Req. 54-56, 61.
// SchedulingPreference: Req. 57-58; StudentWorkflowState: Req. 6-8, 50-53.
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
  term: ref("AcademicTerm", { required: true }),
  major: { type: String, required: true, trim: true },
  semester: { type: Number, required: true, min: 1, max: 10 },
  studyGroup: { type: String, required: true, trim: true },
  courses: { type: [templateCourseSchema], default: [] },
  isPublished: { type: Boolean, default: false, index: true },
});

scheduleTemplateSchema.pre("validate", function () {
  if (!this.courses?.length) this.invalidate("courses", "A schedule template must include at least one course.");
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
  student: ref("StudentProfile", { required: true }),
  term: ref("AcademicTerm", { required: true }),
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
});

studentScheduleSchema.index({ student: 1, term: 1, scheduleType: 1 }, { unique: true });
studentScheduleSchema.index({ term: 1, status: 1, updatedAt: -1 });

export const StudentSchedule = registerModel("StudentSchedule", studentScheduleSchema);

const courseAttemptSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  course: ref("Course", { required: true, index: true }),
  term: ref("AcademicTerm", { required: true, index: true }),
  attemptNumber: { type: Number, required: true, min: 1, default: 1 },
  attendance: { type: String, required: true, enum: ["attended", "unattended"] },
  result: { type: String, required: true, enum: ["current", "passed", "failed"] },
  grade: {
    type: String,
    trim: true,
    required: function () { return this.result === "passed" || this.result === "failed"; },
  },
});

courseAttemptSchema.index({ student: 1, term: 1, course: 1, attemptNumber: 1 }, { unique: true });

export const CourseAttempt = registerModel("CourseAttempt", courseAttemptSchema);

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
  student: ref("StudentProfile", { required: true }),
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

// B1: Req. 6-8 directory status, blocking step, and last update projection.
const studentWorkflowStateSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  term: ref("AcademicTerm", { required: true }),
  studentType: { type: String, required: true, enum: STUDENT_TYPES },
  status: { type: String, required: true, enum: WORKFLOW_STATUSES },
  blockingStep: { type: String, trim: true, default: null },
  lastActivityAt: { type: Date, required: true, default: Date.now },
  calculatedAt: { type: Date, required: true, default: Date.now },
});

studentWorkflowStateSchema.index({ student: 1, term: 1 }, { unique: true });
studentWorkflowStateSchema.index({ term: 1, studentType: 1, status: 1, blockingStep: 1, lastActivityAt: -1 });

export const StudentWorkflowState = registerModel("StudentWorkflowState", studentWorkflowStateSchema);

// ## Sprint 2
// New schema: StudentTermStanding (Req. 118). Shared Sprint 1 schemas above also support Req. 59, 62-82, 108, and 122.
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

//Added for Req 54: View academic history
export const getAcademicHistory = async (studentId) => {
// mongoose is needed to access other models if they aren't explicitly imported here
  const StudentProfile = mongoose.model('StudentProfile');
  const Course = mongoose.model('Course');

  const profile = await StudentProfile.findById(studentId).populate('assignedAdvisor', 'fullName').lean();
  if(!profile){
    return null;
  }

  const attempts = await CourseAttempt.find({ student: studentId }).populate('course').lean();


  const completedCourses = [];
  const currentCourses = [];
  const takenCourseIds = new Set(); //this will help figuring out the remaining courses

  attempts.forEach(attempt => {
    if(attempt.course){
      if (attempt.result === 'passed' || attempt.result === 'current') takenCourseIds.add(attempt.course._id.toString());

      if(attempt.result === 'current'){
        currentCourses.push(attempt);
      }else{
        completedCourses.push(attempt);
      }
    }
  });

  const remainingCourses = await Course.find({ isActive: true, facultyMajors: profile.major, _id: { $nin: Array.from(takenCourseIds) } }).select('code name creditHours prerequisites offeringSeasons').lean();

  return{
    studentProfile: {
      advisor: profile.assignedAdvisor?.fullName ?? 'Unassigned',
      major: profile.major,
      gpa: profile.gpa,
      completedHours: [...new Map(completedCourses.filter(a => a.result === 'passed').map(a => [String(a.course._id), a.course.creditHours])).values()].reduce((sum, hours) => sum + hours, 0),
      currentSemester: profile.currentSemester
    },
    completedCourses,
    currentCourses,
    remainingCourses
  };
};


//Added for Req 55: View transcript for a selected academic year
export const getTranscriptByYear = async (studentId, year) => {
  const attempts = await CourseAttempt.find({ student: studentId })
    .populate({
      path: 'term',
      match: { academicYear: year }
    })
    .populate('course')
    .exec();

  const validAttempts = attempts.filter(attempt => attempt.term !== null);
  if (validAttempts.length === 0) return null;

  const transcript = {
    studentId,
    year,
    terms: {
      winter: [],
      spring: [],
      summer: [],
      firstMakeup: [],
      secondMakeup: []
    }
  };

  validAttempts.forEach(attempt => {
    const season = attempt.term.season ? attempt.term.season.toLowerCase() : '';

    if (season === 'winter') transcript.terms.winter.push(attempt);
    else if (season === 'spring') transcript.terms.spring.push(attempt);
    else if (season === 'summer') transcript.terms.summer.push(attempt);
    else if (season.includes('first') && season.includes('makeup')) transcript.terms.firstMakeup.push(attempt);
    else if (season.includes('second') && season.includes('makeup')) transcript.terms.secondMakeup.push(attempt);
  });

  return transcript;
};

//Added for Req 61: View failed and unattended courses
export const getFailedAndUnattended = async (studentId, termId) => {
  const RemovalRequest = mongoose.model('MandatoryCourseRemovalRequest');
  const AcademicTerm = mongoose.model('AcademicTerm');
  const currentTerm = termId ? { _id: termId } : await AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 });
  const removed = currentTerm ? await RemovalRequest.find({ student: studentId, term: currentTerm._id, status: 'approved' }).select('course').lean() : [];
  const excluded = new Set(removed.map(request => String(request.course)));
  const passed = await CourseAttempt.distinct('course', { student: studentId, result: 'passed' });
  for (const courseId of passed) excluded.add(String(courseId));
  const mandatoryCandidates = await CourseAttempt.find({
     student: studentId,
    $or: [
      { result: 'failed' },
      { attendance: 'unattended' }
    ]
  })
  .populate('course')
  .populate('term')
  .exec();

  mandatoryCandidates.sort((a, b) => new Date(b.term?.termStart ?? b.createdAt) - new Date(a.term?.termStart ?? a.createdAt) || b.attemptNumber - a.attemptNumber);
  const seen = new Set();
  return mandatoryCandidates.filter(attempt => {
    const courseId = String(attempt.course?._id ?? attempt._id);
    if (excluded.has(courseId) || seen.has(courseId)) return false;
    seen.add(courseId);
    return true;
  })
    .map(attempt => ({ ...attempt.toObject(), isMandatory: true }));
};

export const getAttendedAcademicYears = async (studentId) => {
  const AcademicTerm = mongoose.model('AcademicTerm');
  const termIds = await CourseAttempt.distinct('term', { student: studentId });
  const terms = await AcademicTerm.find({ _id: { $in: termIds } }).sort({ termStart: -1 }).select('academicYear').lean();
  return [...new Set(terms.map(term => term.academicYear))];
};

//Added for Req 89: View wallet
export const getWallet = async (studentId) => {
  const FinancialTransaction = mongoose.model('FinancialTransaction');

  const transactions = await FinancialTransaction.find({ student: studentId })
    .where('kind').in(['walletTopUp', 'refund', 'extraHoursWalletPayment'])
    .sort({ occurredAt: 1, _id: 1 })
    .lean();

  if (!transactions) {
    return null;
  }

  let balanceCents = 0;

  transactions.forEach(txn => {
    if (txn.status === 'succeeded') {
      if (txn.kind === 'walletTopUp' || txn.kind === 'refund') {
        balanceCents += Math.round(txn.amount * 100);
      } else if (txn.kind === 'extraHoursWalletPayment') {
        balanceCents -= Math.round(txn.amount * 100);
      }
    }
    txn.resultingBalance = balanceCents / 100;
    txn.direction = txn.kind === 'extraHoursWalletPayment' ? 'debit' : 'credit';
  });

  return {
    studentId,
    balance: balanceCents / 100,
    currency: "EGP",
    transactions: transactions.reverse()
  };
};
