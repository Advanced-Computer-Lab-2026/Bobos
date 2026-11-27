import mongoose from "mongoose";
import { Notification } from "../models/communications.js";
import { syncAdvisorNotifications } from "../services/advisor-notifications.js";
import { syncCoordinatorNotifications } from "../services/coordinator-notifications.js";
import { syncAdvisingNotifications } from "../services/student-notifications.js";
import { AdvisorAssignment, StudentProfile } from "../models/identity.js";
import { StudentSchedule } from "../models/academics.js";
import { ExitExamRequest, ExtraHoursRequest, GraduationPlan, MandatoryCourseRemovalRequest, SlotChangeRequest } from "../models/requests.js";
import { FinancialReversalRequest } from "../models/finance.js";

// Staff events whose producer records a single student as their subject.
const studentSources = new Map([
  ["advisorAssigned", AdvisorAssignment], ["slotChangeSubmitted", SlotChangeRequest],
  ["slotChangeWithdrawn", SlotChangeRequest], ["advisingDeadlineReminder", StudentSchedule],
  ["graduationPlanSubmitted", GraduationPlan], ["exitExamRequested", ExitExamRequest],
  ["mandatoryCourseRemovalRequested", MandatoryCourseRemovalRequest],
  ["financialReversalRequested", FinancialReversalRequest], ["extraHoursRequested", ExtraHoursRequest],
]);

function formatNotification(n) {
  return {
    _id: n._id, recipient: n.recipient, type: n.type, title: n.title, message: n.message,
    channels: n.channels, deliveryStatus: n.deliveryStatus, readAt: n.readAt,
    isRead: Boolean(n.readAt), createdAt: n.createdAt, updatedAt: n.updatedAt,
  };
}

async function attachStudentSubjects(notifications, items) {
  const batches = new Map();
  for (const n of notifications) {
    const model = studentSources.get(n.type);
    if (!model || model.modelName !== n.relatedModel || !mongoose.isObjectIdOrHexString(n.relatedId)) continue;
    if (!batches.has(model)) batches.set(model, new Set());
    batches.get(model).add(n.relatedId);
  }
  const recordStudents = new Map();
  await Promise.all([...batches].map(async ([model, ids]) => {
    const records = await model.find({ _id: { $in: [...ids] } }).select("student").lean();
    for (const record of records) recordStudents.set(`${model.modelName}:${record._id}`, String(record.student));
  }));
  if (!recordStudents.size) return;
  const students = await StudentProfile.find({ _id: { $in: [...new Set(recordStudents.values())] } })
    .select("studentId user").populate("user", "fullName").lean();
  const identities = new Map(students.filter(student => student.user?.fullName).map(student =>
    [String(student._id), { fullName: student.user.fullName, studentId: student.studentId }]));
  notifications.forEach((n, i) => {
    if (studentSources.get(n.type)?.modelName !== n.relatedModel) return;
    const subject = identities.get(recordStudents.get(`${n.relatedModel}:${n.relatedId}`));
    if (subject) items[i].subjectStudent = subject;
  });
}

/**
 * Requirement 5: Retrieve currently authenticated user's in-app notifications.
 * - Extracts recipient identity strictly from req.user._id (via requireAuth middleware).
 * - Client-supplied user IDs in query, body, or params are completely ignored.
 * - Supports all 5 roles: Normal Student, Advising Student, Advisor, Coordinator, Administrator.
 * - Returns only notifications belonging to the authenticated user.
 */
export const getMyNotifications = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to retrieve notifications.",
      });
    }

    if (user.role === "advisingStudent") await syncAdvisingNotifications(user._id);
    if (user.role === "advisor") await syncAdvisorNotifications(user._id);
    if (user.role === "coordinator") await syncCoordinatorNotifications(user._id);

    // Explicitly query ONLY for the authenticated user's notifications.
    const notifications = await Notification.find({
      recipient: user._id,
    }).sort({ createdAt: -1 });

    const formatted = notifications.map(formatNotification);
    if (["coordinator", "advisor", "administrator"].includes(user.role)) {
      try { await attachStudentSubjects(notifications, formatted); }
      catch (error) { console.warn("Notification student portraits unavailable:", error.message); }
    }

    return res.status(200).json({
      success: true,
      count: formatted.length,
      notifications: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications.",
    });
  }
};

/** Development-only helper for verifying the authenticated user's inbox end to end. */
export const createTestNotification = async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ success: false, message: "Not found." });
  }

  const user = req.user;
  if (!user?._id) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }

  try {
    const notification = await Notification.create({
      recipient: user._id,
      type: "advisorAssigned",
      title: "Test notification",
      message: "This test confirms that notifications can be saved and shown in your inbox.",
      channels: ["inApp"],
    });
    return res.status(201).json({ success: true, notification: { _id: notification._id } });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to create a test notification." });
  }
};

/**
 * Requirement 5: Mark a notification as read.
 * - Notification ID is supplied as a route parameter (:id).
 * - Verifies that the notification belongs to the authenticated user.
 * - Rejects unauthorized attempts to mark another user's notification with 403 Forbidden.
 * - Handled safely and idempotently if already marked as read.
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to update notification.",
      });
    }

    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format.",
      });
    }

    let notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    // Verify ownership: A user can NEVER mark another user's notification as read
    const recipientId = notification.recipient?._id
      ? notification.recipient._id.toString()
      : notification.recipient.toString();

    if (recipientId !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only mark your own notifications as read.",
      });
    }

    // Idempotent update: if not yet read, record read timestamp
    if (!notification.readAt) {
      const updated = await Notification.findOneAndUpdate(
        { _id: id, recipient: user._id, readAt: null },
        { $set: { readAt: new Date() } },
        { returnDocument: 'after' },
      );
      notification = updated ?? await Notification.findById(id);
      if (!notification) return res.status(404).json({ success: false, message: "Notification not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification: formatNotification(notification),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read.",
    });
  }
};
