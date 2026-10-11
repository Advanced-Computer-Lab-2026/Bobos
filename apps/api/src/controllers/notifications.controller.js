import mongoose from "mongoose";
import { Notification } from "../models/communications.js";

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

    // Explicitly query ONLY for the authenticated user's notifications.
    const notifications = await Notification.find({
      recipient: user._id,
    }).sort({ createdAt: -1 });

    const formatted = notifications.map((n) => {
      const doc = n.toObject ? n.toObject() : { ...n };
      return {
        _id: doc._id,
        recipient: doc.recipient,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        channels: doc.channels,
        deliveryStatus: doc.deliveryStatus,
        readAt: doc.readAt,
        isRead: Boolean(doc.readAt),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

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

    const doc = notification.toObject ? notification.toObject() : { ...notification };

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
      notification: {
        _id: doc._id,
        recipient: doc.recipient,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        channels: doc.channels,
        deliveryStatus: doc.deliveryStatus,
        readAt: doc.readAt,
        isRead: true,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read.",
    });
  }
};
