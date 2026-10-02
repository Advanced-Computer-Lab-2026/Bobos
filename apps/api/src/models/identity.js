import { USER_ROLES, ref, registerModel, withTimestamps, NOTIFICATION_TYPES } from "./shared.js";

const userSchema = withTimestamps({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    validate: {
      validator(email) {
        const studentRole = ["normalStudent", "advisingStudent"].includes(this.role);
        return email.endsWith(studentRole ? "@student.guc.edu.eg" : "@guc.edu.eg");
      },
      message: "Email domain does not match the account role",
    },
  },
  fullName: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: USER_ROLES },
  isActive: { type: Boolean, default: true, index: true },
  lastLoginAt: Date,
});

userSchema.index({ fullName: 1 });

export const User = registerModel("User", userSchema);

const studentProfileSchema = withTimestamps({
  user: ref("User", { required: true, unique: true }),
  studentId: { type: String, required: true, trim: true, unique: true, match: /^\d{2}-\d{5}$/ },
  studentType: { type: String, required: true, enum: ["normal", "advising"] },
  faculty: { type: String, default: "MET", trim: true },
  major: { type: String, trim: true, default: "undeclared" },
  currentSemester: { type: Number, required: true, min: 1, max: 10 },
  gpa: { type: Number, required: true, min: 0 },
  academicStanding: { type: String, required: true, enum: ["goodAcademicStanding", "probation"] },
  enrollmentStatus: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  studyGroup: { type: String, trim: true },
  advisingReason: {
    type: String,
    enum: ["probation", "failedCourses", "unattendedCourses", "undeclaredMajor", "transfer"],
  },
  assignedAdvisor: ref("User", { default: null }),
});

studentProfileSchema.index({ studentType: 1, assignedAdvisor: 1, major: 1, currentSemester: 1 });

export const StudentProfile = registerModel("StudentProfile", studentProfileSchema);

const advisorAssignmentSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  advisor: ref("User", { required: true, index: true }),
  assignedBy: ref("User", { required: true }),
  endedBy: ref("User", { default: null }),
  endedAt: { type: Date, default: null },
});

advisorAssignmentSchema.index(
  { student: 1 },
  { unique: true, partialFilterExpression: { endedAt: null } },
);
advisorAssignmentSchema.index({ advisor: 1, createdAt: -1 });

export const AdvisorAssignment = registerModel("AdvisorAssignment", advisorAssignmentSchema);

const passwordResetTokenSchema = withTimestamps({
  user: ref("User", { required: true, index: true }),
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
});

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = registerModel("PasswordResetToken", passwordResetTokenSchema);

const notificationPreferenceSchema = withTimestamps({
  user: ref("User", { required: true, unique: true }),
  inAppEnabled: { type: Boolean, default: true },
  emailEnabled: { type: Boolean, default: true },
  mutedEvents: { type: [String], enum: NOTIFICATION_TYPES, default: [] },
});

export const NotificationPreference = registerModel("NotificationPreference", notificationPreferenceSchema);
