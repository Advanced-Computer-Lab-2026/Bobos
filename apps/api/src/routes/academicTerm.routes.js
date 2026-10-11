import express from 'express';
import { createAcademicTerm, updateAcademicTerm, listAcademicTerms, getAcademicTermById } from '../controllers/academicTerm.controller.js';

const router = express.Router();

router.get('/', listAcademicTerms);
router.get('/academicTerm', listAcademicTerms);
router.get('/academicTerm/:id', getAcademicTermById);
router.post('/academicTerm', createAcademicTerm);
router.put('/academicTerm/:id', updateAcademicTerm);

export default router;

