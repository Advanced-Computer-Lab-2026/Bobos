import express from 'express';
import { createAcademicTerm } from '../controllers/academicTerm.controller.js';

const router = express.Router();

router.post('/', createAcademicTerm);

export default router;
