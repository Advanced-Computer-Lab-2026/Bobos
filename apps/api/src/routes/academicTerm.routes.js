import express from 'express';
import { createAcademicTerm, updateAcademicTerm } from '../controllers/academicTerm.controller.js';

const router = express.Router();

router.post('/academicTerm', createAcademicTerm);
router.put('/academicTerm/:id', updateAcademicTerm);

export default router;
