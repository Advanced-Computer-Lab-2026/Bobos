import express from 'express';
import { createAcademicTerm, updateAcademicTerm, listAcademicTerms, getAcademicTermById } from '../controllers/academicTerm.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/require-role.js';

const router = express.Router();

router.get('/', listAcademicTerms);
router.get('/academicTerm', listAcademicTerms);
router.get('/academicTerm/:id', getAcademicTermById);
router.post('/academicTerm', requireAuth, requireRole('administrator'), createAcademicTerm);
router.put('/academicTerm/:id', requireAuth, requireRole('administrator'), updateAcademicTerm);

export default router;

