import mongoose from 'mongoose';

// Email rule (requirement 1): staff accounts use @guc.edu.eg, student accounts
// use @student.guc.edu.eg. Enforcement at login time belongs to team A1.
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['student', 'advisor', 'coordinator', 'administrator'],
      required: true
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
