import mongoose from 'mongoose';

const academicTermSchema = new mongoose.Schema(
  {
    academicYear: { type: String, required: true, trim: true },
    season: { type: String, enum: ['Winter', 'Spring', 'Summer'], required: true },
    termStart: { type: Date },
    termEnd: { type: Date },
    teachingStart: { type: Date },
    teachingEnd: { type: Date },
    advisingDeadline: { type: Date },
    swapDeadline: { type: Date },
    isCurrent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

academicTermSchema.index({ academicYear: 1, season: 1 }, { unique: true });

export const AcademicTerm = mongoose.model('AcademicTerm', academicTermSchema);
