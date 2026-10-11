import express from "express";
import { completeSwapRequest, createSwapRequest, getEligibleGroups, getMySwapRequests, getOpenSwapRequests, withdrawSwapRequest } from "../controllers/scheduling.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(requireAuth);
router.get("/eligible-groups", getEligibleGroups);
router.get("/requests/me", getMySwapRequests);
router.get("/requests/open", getOpenSwapRequests);
router.post("/requests", createSwapRequest);
router.post("/requests/:id/complete", completeSwapRequest);
router.post("/requests/:id/withdraw", withdrawSwapRequest);

export default router;
