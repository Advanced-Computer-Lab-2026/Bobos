import mongoose from 'mongoose';

// The "standard schedule template" of requirements 28/29 (owned by team C2).
// C3 defines it here, minimally, because requirement 30 reads from it: a
// student's processed schedule is created from the assigned group's PUBLISHED
// template. C2 should extend this file rather than replace it.
const templateEntrySchema = new mongoose.Schema(
  {
    offering: { type: mongoose.Schema.Types.ObjectId, ref: 'CourseOffering', required: true },
    lectureSlotId: { type: mongoose.Schema.Types.ObjectId, default: null },
    tutorialSlotId: { type: mongoose.Schema.Types.ObjectId, default: null },
    labSlotId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  { _id: false }
);

const scheduleTemplateSchema = new mongoose.Schema(
  {
    term: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicTerm', required: true },
    major: { type: String, enum: ['CS', 'DMET'], required: true },
    semester: { type: Number, required: true },
    studyGroup: { type: String, required: true, trim: true },
    isPublished: { type: Boolean, default: false },
    entries: [templateEntrySchema]
  },
  { timestamps: true }
);

scheduleTemplateSchema.index(
  { term: 1, major: 1, semester: 1, studyGroup: 1 },
  { unique: true }
);

export const ScheduleTemplate = mongoose.model('ScheduleTemplate', scheduleTemplateSchema);
