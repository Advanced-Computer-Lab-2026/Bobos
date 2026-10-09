import express from "express";
import { getEligibleGroups } from "../controllers/scheduling.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(requireAuth);
router.get("/eligible-groups", getEligibleGroups);

export default router;
