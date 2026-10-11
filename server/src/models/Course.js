import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    creditHours: { type: Number, required: true },
    courseType: { type: String, enum: ['core', 'elective', 'huma'], required: true },
    faculty: { type: String, default: 'MET' },
    major: { type: String, enum: ['CS', 'DMET', 'ALL'], default: 'ALL' },
    recommendedSemester: { type: Number },
    offeringSeason: { type: String, enum: ['Winter', 'Spring', 'Summer', 'Any'], default: 'Any' },
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }]
  },
  { timestamps: true }
);

export const Course = mongoose.model('Course', courseSchema);
