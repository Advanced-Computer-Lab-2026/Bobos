import express from 'express';
import { createOffering, getOfferings, getOfferingById } from '../controllers/catalogue.controller.js';

const router = express.Router();

// Admin routes for Course Offerings (Req 22 & 23)
router.post('/offerings', createOffering);
router.get('/offerings', getOfferings);
router.get('/offerings/:id', getOfferingById);

export default router;
