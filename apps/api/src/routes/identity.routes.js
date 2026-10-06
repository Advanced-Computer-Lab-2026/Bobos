import express from "express";
import { getProfile, login, seedDemoUsers, getAcademicHistory, getTranscript, downloadTranscriptPDF, getFailedCourses, getWallet } from "../controllers/identity.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { rateLimit } from "express-rate-limit";
import { requestPasswordReset, resetPassword } from "../controllers/password-reset.controller.js";
import { logout } from "../controllers/logout.controller.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please try again in 15 minutes." },
});
const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many reset requests. Please try again in 15 minutes." },
});

// Sprint 1 - Req 1 (Login dependency)
router.post("/login", authLimiter, login);

// Sprint 1 - Req 2: Request a code by email, then submit it with a new password.
router.post("/forgot-password", resetRequestLimiter, requestPasswordReset);
router.post("/reset-password", authLimiter, resetPassword);

// Sprint 1 - Req 3: Invalidate the authenticated account's existing sessions.
router.post("/logout", requireAuth, logout);

// Sprint 1 - Req 4: View own profile applicable to role
router.get("/profile", requireAuth, getProfile);
router.get("/me", requireAuth, getProfile);

// Demo seed helper for interactive testing of all 5 roles
router.post("/seed-demo", (req, res, next) => {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEMO_SEED !== "true") {
    return res.status(404).json({ success: false, message: "Not found." });
  }
  next();
}, seedDemoUsers);

//Req 54:
router.get('/students/:studentId/history', getAcademicHistory);

//Req 55:
router.get('/students/:studentId/transcript', getTranscript);

// Req 56:
router.get('/students/:studentId/transcript/download', downloadTranscriptPDF);

// Req 61:
router.get('/students/:studentId/failed-courses', getFailedCourses);

//Req 89:
router.get('/students/:studentId/wallet', getWallet);

export default router;
