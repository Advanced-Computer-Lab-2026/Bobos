import { Router } from "express";
import {
  deleteGraduationDraft, getGraduationPlan, getGraduationWorkspace, loadGraduationStudent,
  loadOwnGraduationPlan, requestExitExam, saveGraduationDraft, submitGraduationPlan,
} from "../controllers/graduation-plans.controller.js";
import { requireRole } from "../middleware/require-role.js";

const router = Router({ mergeParams: true });
router.use(requireRole("advisor"), loadGraduationStudent);
router.get("/", getGraduationWorkspace);
router.post("/", saveGraduationDraft);
router.post("/exit-exam-requests", requestExitExam);
router.get("/:planId", loadOwnGraduationPlan, getGraduationPlan);
router.put("/:planId", loadOwnGraduationPlan, saveGraduationDraft);
router.delete("/:planId", loadOwnGraduationPlan, deleteGraduationDraft);
router.post("/:planId/submit", loadOwnGraduationPlan, submitGraduationPlan);

export default router;
