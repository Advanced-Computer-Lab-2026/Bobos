import mongoose from 'mongoose';

// A slot is a lecture / tutorial / lab GROUP of one course offering.
// It is stored as a subdocument so that it keeps its own _id: that _id is the
// STABLE SLOT ID referenced by ScheduleTemplate.entries and by the denormalised
// StudentSchedule.entries[].slots[].slotId.
const slotSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['lecture', 'tutorial', 'lab'], required: true },
    groupNumber: { type: String, required: true, trim: true },
    day: {
      type: String,
      enum: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      required: true
    },
    startTime: { type: String, required: true }, // 'HH:mm', 24h
    endTime: { type: String, required: true }, // 'HH:mm', 24h
    room: { type: String, required: true, trim: true },
    maxCapacity: { type: Number, required: true, min: 0 },
    assignedCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

slotSchema.virtual('remainingCapacity').get(function () {
  return Math.max(0, (this.maxCapacity || 0) - (this.assignedCount || 0));
});

const offeringSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    term: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicTerm', required: true },
    instructors: [{ type: String, trim: true }],
    eligibleMajors: [{ type: String }],
    eligibleSemesters: [{ type: Number }],
    isPublished: { type: Boolean, default: false },
    slots: [slotSchema]
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

offeringSchema.index({ course: 1, term: 1 }, { unique: true });

export const CourseOffering = mongoose.model('CourseOffering', offeringSchema);
