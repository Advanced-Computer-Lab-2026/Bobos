import express from "express";
import {
  addAdvisor,
  getStudentDetails,
  getStudents,
  lookupAdvisor,
  removeAdvisor,
  setUserStatus,
} from "../controllers/admin.controller.js";
import { requireDirectoryRole, requireRole } from "../middleware/require-role.js";

const router = express.Router();

export { requireDirectoryRole, requireRole };

router.get("/students", requireDirectoryRole, getStudents);
router.get("/students/:id", requireDirectoryRole, getStudentDetails);
router.patch("/users/:id/status", requireRole("administrator"), setUserStatus);
router.get("/advisors/lookup", requireRole("coordinator"), lookupAdvisor);
router.post("/advisors", requireRole("coordinator"), addAdvisor);
router.delete("/advisors/:email", requireRole("coordinator"), removeAdvisor);

export default router;
