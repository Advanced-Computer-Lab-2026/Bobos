import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    studentId: { type: String, required: true, unique: true, trim: true, match: /^\d{2}-\d{4}$/ },
    studentType: { type: String, enum: ['normal', 'advising'], required: true },
    faculty: { type: String, default: 'MET' },
    major: { type: String, enum: ['CS', 'DMET'], required: true },
    currentSemester: { type: Number, required: true, min: 1, max: 10 },
    gpa: { type: Number },
    academicStanding: {
      type: String,
      enum: ['Good Academic Standing', 'Probation'],
      default: 'Good Academic Standing'
    },
    advisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

export const Student = mongoose.model('Student', studentSchema);
