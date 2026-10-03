import express from "express";
import { getStudents } from "../controllers/admin.controller.js";

const router = express.Router();
const directoryRoles = ["coordinator", "administrator"];

export function requireDirectoryRole(req, res, next) {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (!directoryRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Coordinator or Administrator access required" });
  }
  next();
}

router.get("/students", requireDirectoryRole, getStudents);

export default router;
