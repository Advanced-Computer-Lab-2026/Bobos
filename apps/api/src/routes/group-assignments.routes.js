import express from "express";
import { assignStudentToGroup, getStudentAssignment, listAssignableGroups, listAssignmentTerms, listNormalStudents, unassignStudent } from "../controllers/scheduling.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();
router.use(requireAuth);
router.get("/terms", requireRole("coordinator", "administrator"), listAssignmentTerms);
router.get("/students", requireRole("coordinator", "administrator"), listNormalStudents);
router.get("/groups", requireRole("coordinator", "administrator"), listAssignableGroups);
router.get("/:studentId", requireRole("coordinator", "administrator"), getStudentAssignment);
router.post("/", requireRole("coordinator"), assignStudentToGroup);
router.delete("/:studentId", requireRole("coordinator"), unassignStudent);

export default router;
