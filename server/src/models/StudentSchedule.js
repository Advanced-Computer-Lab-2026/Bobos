import mongoose from 'mongoose';

// The student's PROCESSED schedule. `entries` is a DENORMALISED SNAPSHOT of the
// template at assignment time so that requirements 31/32/33/34/49 can render a
// weekly calendar, credit-hour totals and slot details without re-joining the
// offerings.
const scheduleSlotSchema = new mongoose.Schema(
  {
    slotId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['lecture', 'tutorial', 'lab'], required: true },
    groupNumber: { type: String },
    day: {
      type: String,
      enum: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
    },
    startTime: { type: String },
    endTime: { type: String },
    room: { type: String }
  },
  { _id: false }
);

const scheduleEntrySchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    courseCode: { type: String },
    courseName: { type: String },
    creditHours: { type: Number },
    offering: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering' },
    slots: [scheduleSlotSchema]
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['assigned', 'reassigned', 'unassigned'], required: true },
    fromGroup: { type: String, default: null },
    toGroup: { type: String, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

const studentScheduleSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    term: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicTerm', required: true },
    studyGroup: { type: String, required: true, trim: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduleTemplate' },
    status: { type: String, enum: ['processed'], default: 'processed' },
    entries: [scheduleEntrySchema],
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },
    history: [historySchema]
  },
  { timestamps: true }
);

studentScheduleSchema.index({ student: 1, term: 1 }, { unique: true });

export const StudentSchedule = mongoose.model('StudentSchedule', studentScheduleSchema);
