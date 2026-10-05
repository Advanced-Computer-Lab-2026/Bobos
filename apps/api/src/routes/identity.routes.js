import express from "express";
import { getProfile, login, seedDemoUsers } from "../controllers/identity.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

// Sprint 1 - Req 1 (Login dependency)
router.post("/login", login);

// Sprint 1 - Req 4: View own profile applicable to role
router.get("/profile", requireAuth, getProfile);
router.get("/me", requireAuth, getProfile);

// Demo seed helper for interactive testing of all 5 roles
router.post("/seed-demo", seedDemoUsers);

export default router;
const identityController = require('../controllers/identity.controller');

//Req 54:
router.get('/students/:studentId/history', identityController.getAcademicHistory);

//Req 55:
router.get('/students/:studentId/transcript', identityController.getTranscript);

// Req 56:
router.get('/students/:studentId/transcript/download', identityController.downloadTranscriptPDF);

// Req 61:
router.get('/students/:studentId/failed-courses', identityController.getFailedCourses);

//Req 89:
router.get('/students/:studentId/wallet', identityController.getWallet);

module.exports = router;
