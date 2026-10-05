// Team B - B2 Controller logic
// Requirements covered:
//   Req 9  - View/select student details
//   Req 10 - Activate/deactivate user account
//   Req 11 - Add advisor via GUC email (with lookup)
//   Req 12 - Remove advisor from advising system
//   Req 13 - Email notification on advisor add/remove

import { User, StudentProfile, AdvisorAssignment } from "../models/identity.js";
import { Notification } from "../models/communications.js";

// ============================================================
// Req 9: GET /api/admin/students/:id
// Returns full student profile for the coordinator/admin view.
// ============================================================
export const getStudentDetails = async (req, res) => {
  try {
    const student = await StudentProfile.findById(req.params.id)
      .populate("user", "fullName email role isActive lastLoginAt")
      .populate("assignedAdvisor", "fullName email");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(student);
  } catch (error) {
    // Invalid ObjectId or other cast errors
    res.status(400).json({ message: error.message });
  }
};

// ============================================================
// Req 10: PATCH /api/admin/users/:id/status
// Body: { "isActive": true | false }
// Deactivation prevents login but keeps all history.
// ============================================================
export const setUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: "fullName email role isActive" }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============================================================
// Req 11 (part 1): GET /api/admin/advisors/lookup?email=...
// Verifies an advisor email exists and returns their full name.
// ============================================================
export const lookupAdvisor = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: "email query param is required" });
    }

    const advisor = await User.findOne({
      email: email.toLowerCase(),
      role: "advisor",
      isActive: true,
    }).select("fullName email");

    if (!advisor) {
      return res
        .status(404)
        .json({ message: "No active advisor found with that email" });
    }

    res.json(advisor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============================================================
// Req 11 (part 2) + Req 13: POST /api/admin/advisors
// Body: { "email": "advisor@guc.edu.eg" }
// Adds the advisor to the advising system and sends an email
// notification (stored as a Notification record).
// ============================================================
export const addAdvisor = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const advisor = await User.findOne({
      email: email.toLowerCase(),
      role: "advisor",
    });

    if (!advisor) {
      return res.status(404).json({ message: "Advisor not found" });
    }

    // Reactivate in case they were previously removed
    advisor.isActive = true;
    await advisor.save();

    // Req 13: email notification
    await Notification.create({
      recipient: advisor._id,
      type: "advisorAssigned",
      title: "You have been added to the advising system",
      message: `You have been added as an advisor in the university schedule management system.`,
      channels: ["email"],
      deliveryStatus: "sent",
      sentAt: new Date(),
    });

    res.status(201).json({
      message: "Advisor added to the advising system",
      advisor: {
        _id: advisor._id,
        fullName: advisor.fullName,
        email: advisor.email,
        isActive: advisor.isActive,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ============================================================
// Req 12 + Req 13: DELETE /api/admin/advisors/:email
// Ends all active assignments (preserves history) and sends
// an email notification.
// ============================================================
export const removeAdvisor = async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();

    const advisor = await User.findOne({ email, role: "advisor" });
    if (!advisor) {
      return res.status(404).json({ message: "Advisor not found" });
    }

    // End active assignments — history is preserved (Req 12)
    const result = await AdvisorAssignment.updateMany(
      { advisor: advisor._id, endedAt: null },
      { $set: { endedAt: new Date(), endedBy: advisor._id } }
    );

    // Req 13: email notification
    await Notification.create({
      recipient: advisor._id,
      type: "advisorRemoved",
      title: "You have been removed from the advising system",
      message: `You have been removed from the advising system. Your previous actions remain in the schedule activity history.`,
      channels: ["email"],
      deliveryStatus: "sent",
      sentAt: new Date(),
    });

    res.json({
      message: "Advisor removed from the advising system",
      assignmentsEnded: result.modifiedCount,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
