import express from "express";
import {
  addAdvisor,
  getStudentDetails,
  getStudents,
  lookupAdvisor,
  removeAdvisor,
  setUserStatus,
} from "../controllers/admin.controller.js";

const router = express.Router();

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: "Insufficient permissions" });
    next();
  };
}

export const requireDirectoryRole = requireRole("coordinator", "administrator");

router.get("/students", requireDirectoryRole, getStudents);
router.get("/students/:id", requireDirectoryRole, getStudentDetails);
router.patch("/users/:id/status", requireRole("administrator"), setUserStatus);
router.get("/advisors/lookup", requireRole("coordinator"), lookupAdvisor);
router.post("/advisors", requireRole("coordinator"), addAdvisor);
router.delete("/advisors/:email", requireRole("coordinator"), removeAdvisor);

export default router;
