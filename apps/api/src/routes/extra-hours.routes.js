import express from "express";
import {
  createExtraHoursRequest,
  withdrawExtraHoursRequest,
  getExtraHoursRequestById,
  listExtraHoursRequests,
  decideExtraHoursRequest,
  listMyExtraHoursRequests,
  listAdvisorExtraHoursRequests,
  chooseExtraHoursSettlement,
  getExtraHoursFinancialHistory,
  getExtraHoursWallet,
  downloadExtraHoursConfirmation,
} from "../controllers/extra-hours.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", requireRole("coordinator", "administrator"), listExtraHoursRequests);
router.get("/mine", requireRole("advisingStudent"), listMyExtraHoursRequests);
router.get("/advisor/mine", requireRole("advisor"), listAdvisorExtraHoursRequests);
router.get("/mine/financial-history", requireRole("advisingStudent"), getExtraHoursFinancialHistory);
router.get("/mine/wallet", requireRole("advisingStudent"), getExtraHoursWallet);
router.get("/mine/financial-history/:transactionId/download", requireRole("advisingStudent"), downloadExtraHoursConfirmation);
router.post("/:id/decision", requireRole("coordinator"), decideExtraHoursRequest);
router.post("/:id/settlement", requireRole("advisingStudent"), chooseExtraHoursSettlement);

// Req 83: Advisor requests extra hours
router.post(
  "/",
  requireRole("advisor", "coordinator"),
  createExtraHoursRequest
);

// Req 96: Advisor withdraws extra hours request
router.post(
  "/:id/withdraw",
  requireRole("advisor"),
  withdrawExtraHoursRequest
);

// Req 88, 95: View request details
router.get(
  "/:id",
  requireRole("advisor", "coordinator", "administrator", "advisingStudent"),
  getExtraHoursRequestById
);

export default router;
