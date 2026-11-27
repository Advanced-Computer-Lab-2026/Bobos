import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";
import { slotChanges } from "../controllers/slot-changes.controller.js";

const router = express.Router();
const student = requireRole("advisingStudent");
const staff = requireRole("advisor", "coordinator");

router.use(requireAuth);
router.get("/me", student, slotChanges.mine);
router.post("/", student, slotChanges.submit);
router.post("/:id/withdraw", student, slotChanges.withdraw);
router.get("/", staff, slotChanges.list);
router.get("/:id", staff, slotChanges.details);
router.post("/:id/decision", staff, slotChanges.decide);

export default router;
