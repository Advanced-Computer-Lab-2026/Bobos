import express from "express";
import {
  createMandatoryRemovalRequest,
  listMandatoryRemovalRequests,
  getMandatoryRemovalRequestById,
  decideMandatoryRemovalRequest,
} from "../controllers/mandatoryRemoval.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();
router.use(requireAuth);

router.post("/", requireRole("advisor", "coordinator"), createMandatoryRemovalRequest);
router.get("/", requireRole("coordinator", "advisor", "administrator"), listMandatoryRemovalRequests);
router.get("/:id", requireRole("coordinator", "advisor", "administrator"), getMandatoryRemovalRequestById);
router.patch("/:id/decision", requireRole("coordinator", "administrator"), decideMandatoryRemovalRequest);

export default router;
