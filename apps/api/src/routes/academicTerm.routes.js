import express from 'express';
import { createAcademicTerm, updateAcademicTerm, listAcademicTerms, getAcademicTermById } from '../controllers/academicTerm.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/require-role.js';

const router = express.Router();

// Any signed-in user may read terms (schedules, preferences and planning all
// need the current term). Creating and updating a term is Administrator-only
// (requirements 16 and 17).
router.get('/', requireAuth, listAcademicTerms);
router.get('/academicTerm', requireAuth, listAcademicTerms);
router.get('/academicTerm/:id', requireAuth, getAcademicTermById);
router.post('/academicTerm', requireAuth, requireRole('administrator'), createAcademicTerm);
router.put('/academicTerm/:id', requireAuth, requireRole('administrator'), updateAcademicTerm);

export default router;

