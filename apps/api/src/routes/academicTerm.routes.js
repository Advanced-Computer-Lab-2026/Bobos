import express from 'express';
import { createAcademicTerm, updateAcademicTerm } from '../controllers/academicTerm.controller.js';

const router = express.Router();

router.post('/', createAcademicTerm);
router.put('/:id', updateAcademicTerm);

export default router;
