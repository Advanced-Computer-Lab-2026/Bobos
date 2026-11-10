import express from "express";
import {
  createExtraHoursRequest,
  withdrawExtraHoursRequest,
  getExtraHoursRequestById,
} from "../controllers/extra-hours.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();

router.use(requireAuth);

// Req 83: Advisor requests extra hours
router.post(
  "/",
  requireRole("advisor", "coordinator"),
  createExtraHoursRequest
);

// Req 96: Advisor withdraws extra hours request
router.post(
  "/:id/withdraw",
  requireRole("advisor", "coordinator"),
  withdrawExtraHoursRequest
);

// Req 88, 95: View request details
router.get(
  "/:id",
  requireRole("advisor", "coordinator", "administrator", "advisingStudent"),
  getExtraHoursRequestById
);

export default router;
