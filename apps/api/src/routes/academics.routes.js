import express from 'express';
import {
  createScheduleTemplate,
  updateScheduleTemplate,
  getScheduleTemplates,
  getScheduleTemplateById,
} from '../controllers/academics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/require-role.js';

const router = express.Router();

// Req 28: Create a standard schedule template
router.post('/schedule-templates', requireAuth, requireRole('coordinator'), createScheduleTemplate);

// Helper: View schedule templates (for testing)
router.get('/schedule-templates', requireAuth, requireRole('coordinator'), getScheduleTemplates);

// Helper: View a single schedule template by ID
router.get('/schedule-templates/:id', requireAuth, requireRole('coordinator'), getScheduleTemplateById);

// Req 29: Update a standard schedule template
router.put('/schedule-templates/:id', requireAuth, requireRole('coordinator'), updateScheduleTemplate);

export default router;
