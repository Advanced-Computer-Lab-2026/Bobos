import express from "express";
import { completeCalendarConnect, disconnectCalendar, getCalendarConnection, startCalendarConnect, syncCalendar } from "../controllers/calendar.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();
router.get("/oauth/callback", completeCalendarConnect);
router.use(requireAuth, requireRole("normalStudent", "advisingStudent"));
router.get("/connection", getCalendarConnection);
router.get("/connect", startCalendarConnect);
router.delete("/connection", disconnectCalendar);
router.post("/sync", syncCalendar);

export default router;
