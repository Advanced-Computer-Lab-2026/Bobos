import express from "express";
import {
  getRecords,
  getRecordById,
  processRefund,
  exportRecords,
} from "../controllers/finance.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();

router.use(requireAuth);

// 1. Export routes (must be mounted before /:id)
router.get("/export", requireRole("coordinator", "administrator"), exportRecords);
router.get("/records/export", requireRole("coordinator", "administrator"), exportRecords);

// 2. Records listing (must be mounted before /:id)
router.get("/records", getRecords);
router.get("/", getRecords);

// 3. Refund processing
router.post("/refund", requireRole("coordinator", "administrator"), processRefund);
router.post("/records/:id/refund", requireRole("coordinator", "administrator"), processRefund);
router.post("/:id/refund", requireRole("coordinator", "administrator"), processRefund);

// 4. Single record details
router.get("/records/:id", getRecordById);
router.get("/:id", getRecordById);

export default router;
