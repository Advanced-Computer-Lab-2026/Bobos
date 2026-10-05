// Requirement 34 - /api/swaps (namespace reserved for C3: whole-schedule swaps).
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getEligibleGroups } from '../controllers/swapController.js';

const router = Router();

router.use(requireAuth);

// Role rules (normal students only) are enforced in the controller so advising
// students and staff get a specific 403 message.
router.get('/eligible-groups', getEligibleGroups);
// Requirement 35 (submit a swap request) will add its routes here.

export default router;
