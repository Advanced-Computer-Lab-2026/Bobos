import express from "express";
import {
  getMyNotifications,
  markNotificationAsRead,
} from "../controllers/notifications.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// Sprint 1 - Req 5: View own in-app notifications
router.get("/", requireAuth, getMyNotifications);

// Sprint 1 - Req 5: Mark notification as read
router.patch("/:id/read", requireAuth, markNotificationAsRead);
router.put("/:id/read", requireAuth, markNotificationAsRead);
router.patch("/:id", requireAuth, markNotificationAsRead);

export default router;
