import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, StudentProfile } from "../models/identity.js";
import { StudentWorkflowState, StudentSchedule } from "../models/academics.js";
import { AcademicTerm } from "../models/catalogue.js";
import { generateToken } from "../middleware/auth.middleware.js";

/**
 * Requirement 4: Retrieve currently authenticated user's profile.
 * - Extracts identity strictly from req.user (set by requireAuth middleware).
 * - Prevents URL, query param, or request body tampering.
 * - Returns only role-applicable information:
 *   - All users: fullName, email, role.
 *   - Students additionally: studentId, studentType, major, currentSemester,
 *     academicStanding, assignedAdvisor (when applicable), scheduleStatus.
 */
export const getProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to view profile.",
      });
    }

    // Role-applicable fields
    const isStudent = ["normalStudent", "advisingStudent"].includes(user.role);

    // Common fields for all roles
    const baseProfile = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };

    // Non-student roles: Advisor, Coordinator, Administrator
    // Return only information applicable to their role
    if (!isStudent) {
      return res.status(200).json({
        success: true,
        profile: baseProfile,
      });
    }

    // Student roles: Normal Student, Advising Student
    const studentProfile = await StudentProfile.findOne({ user: user._id })
      .populate("assignedAdvisor", "fullName email role");

    let studentData = {
      studentId: studentProfile?.studentId ?? null,
      studentType: studentProfile?.studentType ?? (user.role === "advisingStudent" ? "advising" : "normal"),
      major: studentProfile?.major ?? "undeclared",
      currentSemester: studentProfile?.currentSemester ?? 1,
      academicStanding: studentProfile?.academicStanding ?? "goodAcademicStanding",
      assignedAdvisor: null,
      scheduleStatus: "Not Assigned",
    };

    if (studentProfile) {
      // Assigned advisor when applicable
      if (studentProfile.assignedAdvisor) {
        studentData.assignedAdvisor = {
          _id: studentProfile.assignedAdvisor._id,
          fullName: studentProfile.assignedAdvisor.fullName,
          email: studentProfile.assignedAdvisor.email,
        };
      }

      // Schedule status: resolve from StudentWorkflowState, fallback to StudentSchedule
      const workflowState = await StudentWorkflowState.findOne({ student: studentProfile._id })
        .sort({ calculatedAt: -1, updatedAt: -1 });

      if (workflowState?.status) {
        studentData.scheduleStatus = workflowState.status;
      } else {
        const schedule = await StudentSchedule.findOne({ student: studentProfile._id })
          .sort({ updatedAt: -1 });
        if (schedule?.status) {
          studentData.scheduleStatus = schedule.status;
        } else if (studentProfile.studentType === "advising") {
          studentData.scheduleStatus = "notStarted";
        } else {
          studentData.scheduleStatus = "Not Assigned";
        }
      }
    }

    return res.status(200).json({
      success: true,
      profile: {
        ...baseProfile,
        ...studentData,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve profile.",
      error: error.message,
    });
  }
};

/**
 * Login endpoint to authenticate users and return JWT.
 * Supports Requirement 1 (dependency of Req 4).
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@(student\.guc\.edu\.eg|guc\.edu\.eg)$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please use a valid GUC email address.",
      });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.isActive !== true) {
      return res.status(401).json({
        success: false,
        message: "Account is inactive. Please contact an administrator.",
      });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login error.",
    });
  }
};

/**
 * Helper to seed sample accounts for all 5 roles for development and interactive testing.
 */
export const seedDemoUsers = async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Term definition for workflow state
    let term = await AcademicTerm.findOne({ code: "S26" });
    if (!term) {
      term = await AcademicTerm.create({
        code: "S26",
        academicYear: "2025/2026",
        season: "spring",
        termStart: new Date("2026-02-01"),
        termEnd: new Date("2026-06-30"),
        teachingStart: new Date("2026-02-08"),
        teachingEnd: new Date("2026-05-30"),
        registrationStart: new Date("2026-01-15"),
        registrationEnd: new Date("2026-01-30"),
        advisingDeadline: new Date("2026-02-20"),
        wholeScheduleSwapDeadline: new Date("2026-02-28"),
        isActive: true,
      });
    }

    // 1. Administrator
    const admin = await User.findOneAndUpdate(
      { email: "admin@guc.edu.eg" },
      {
        fullName: "Dr. Laila Mansour (Admin)",
        email: "admin@guc.edu.eg",
        passwordHash,
        role: "administrator",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 2. Coordinator
    const coordinator = await User.findOneAndUpdate(
      { email: "nadia.coordinator@guc.edu.eg" },
      {
        fullName: "Eng. Nadia El-Sayed (Coordinator)",
        email: "nadia.coordinator@guc.edu.eg",
        passwordHash,
        role: "coordinator",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 3. Advisor
    const advisor = await User.findOneAndUpdate(
      { email: "sherif.advisor@guc.edu.eg" },
      {
        fullName: "Dr. Sherif Hassan (Advisor)",
        email: "sherif.advisor@guc.edu.eg",
        passwordHash,
        role: "advisor",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 4. Normal Student
    const normalUser = await User.findOneAndUpdate(
      { email: "karim.normal@student.guc.edu.eg" },
      {
        fullName: "Karim Farouk (Normal Student)",
        email: "karim.normal@student.guc.edu.eg",
        passwordHash,
        role: "normalStudent",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const normalProfile = await StudentProfile.findOneAndUpdate(
      { user: normalUser._id },
      {
        user: normalUser._id,
        studentId: "28-12345",
        studentType: "normal",
        faculty: "MET",
        major: "Computer Science",
        currentSemester: 4,
        gpa: 3.42,
        academicStanding: "goodAcademicStanding",
        enrollmentStatus: "active",
        assignedAdvisor: null,
      },
      { upsert: true, new: true }
    );

    await StudentWorkflowState.findOneAndUpdate(
      { student: normalProfile._id, term: term._id },
      {
        student: normalProfile._id,
        term: term._id,
        studentType: "normal",
        status: "scheduleAssigned",
        calculatedAt: new Date(),
        lastActivityAt: new Date(),
      },
      { upsert: true }
    );

    // 5. Advising Student
    const advisingUser = await User.findOneAndUpdate(
      { email: "layla.advising@student.guc.edu.eg" },
      {
        fullName: "Layla Tarek (Advising Student)",
        email: "layla.advising@student.guc.edu.eg",
        passwordHash,
        role: "advisingStudent",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    const advisingProfile = await StudentProfile.findOneAndUpdate(
      { user: advisingUser._id },
      {
        user: advisingUser._id,
        studentId: "26-54321",
        studentType: "advising",
        faculty: "MET",
        major: "Digital Media Engineering",
        currentSemester: 6,
        gpa: 1.85,
        academicStanding: "probation",
        advisingReason: "probation",
        enrollmentStatus: "active",
        assignedAdvisor: advisor._id,
      },
      { upsert: true, new: true }
    );

    await StudentWorkflowState.findOneAndUpdate(
      { student: advisingProfile._id, term: term._id },
      {
        student: advisingProfile._id,
        term: term._id,
        studentType: "advising",
        status: "readyForStudentReview",
        calculatedAt: new Date(),
        lastActivityAt: new Date(),
      },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Demo users created/updated successfully across all 5 roles.",
      accounts: [
        { role: "normalStudent", email: "karim.normal@student.guc.edu.eg", password: "Password123!" },
        { role: "advisingStudent", email: "layla.advising@student.guc.edu.eg", password: "Password123!" },
        { role: "advisor", email: "sherif.advisor@guc.edu.eg", password: "Password123!" },
        { role: "coordinator", email: "nadia.coordinator@guc.edu.eg", password: "Password123!" },
        { role: "administrator", email: "admin@guc.edu.eg", password: "Password123!" },
      ],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to seed demo users.",
      error: error.message,
    });
  }
};
