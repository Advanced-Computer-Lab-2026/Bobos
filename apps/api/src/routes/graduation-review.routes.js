import { Router } from "express";
import {
  decideExitExam, decideGraduationPlan, getStudentGraduation, listExitExamRequests, listSubmittedPlans,
} from "../controllers/graduation-review.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router();
const coordinatorOnly = requireRole("coordinator");
router.use(requireAuth);
router.get("/plans", requireRole("advisor", "coordinator"), listSubmittedPlans);
router.post("/plans/:id/decision", coordinatorOnly, decideGraduationPlan);
router.get("/exit-exams", coordinatorOnly, listExitExamRequests);
router.post("/exit-exams/:id/decision", coordinatorOnly, decideExitExam);
router.get("/me", requireRole("advisingStudent"), getStudentGraduation);

export default router;
