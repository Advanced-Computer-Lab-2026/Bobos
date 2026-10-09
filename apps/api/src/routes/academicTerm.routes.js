import express from 'express';
import { createAcademicTerm, updateAcademicTerm } from '../controllers/academicTerm.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/require-role.js';

const router = express.Router();

router.post('/academicTerm', requireAuth, requireRole('administrator'), createAcademicTerm);
router.put('/academicTerm/:id', requireAuth, requireRole('administrator'), updateAcademicTerm);

export default router;
