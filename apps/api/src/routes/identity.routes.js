import express from "express";
import { getProfile, login, seedDemoUsers, getAcademicHistory, getTranscript, downloadTranscriptPDF, getFailedCourses, getWallet, getAcademicYears } from "../controllers/identity.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { rateLimit } from "express-rate-limit";
import { requestPasswordReset, resetPassword } from "../controllers/password-reset.controller.js";
import { logout } from "../controllers/logout.controller.js";
import { studentRecordAccess } from "../middleware/student-records.middleware.js";
import { getPreferences, savePreferences } from "../controllers/preferences.controller.js";

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
router.use('/students/:studentId', requireAuth);
const advisingRecords = studentRecordAccess(['advisingStudent', 'advisor', 'coordinator']);
// Req 57/58: students update their own hints; advising staff read them.
router.get('/students/:studentId/preferences', advisingRecords, getPreferences);
router.put('/students/:studentId/preferences', studentRecordAccess(['advisingStudent']), savePreferences);
router.get('/students/:studentId/history', advisingRecords, getAcademicHistory);

//Req 55:
router.get('/students/:studentId/transcript', advisingRecords, getTranscript);
router.get('/students/:studentId/transcript/years', advisingRecords, getAcademicYears);

// Req 56:
router.get('/students/:studentId/transcript/download', advisingRecords, downloadTranscriptPDF);

// Req 61:
router.get('/students/:studentId/failed-courses', advisingRecords, getFailedCourses);

//Req 89:
router.get('/students/:studentId/wallet', studentRecordAccess(['advisingStudent']), getWallet);

export default router;
