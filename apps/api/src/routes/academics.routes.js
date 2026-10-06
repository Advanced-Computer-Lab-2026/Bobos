import express from 'express';
import {
  createScheduleTemplate,
  updateScheduleTemplate,
  getScheduleTemplates,
  getScheduleTemplateById,
} from '../controllers/academics.controller.js';

const router = express.Router();

// Req 28: Create a standard schedule template
router.post('/schedule-templates', createScheduleTemplate);

// Helper: View schedule templates (for testing)
router.get('/schedule-templates', getScheduleTemplates);

// Helper: View a single schedule template by ID
router.get('/schedule-templates/:id', getScheduleTemplateById);

// Req 29: Update a standard schedule template
router.put('/schedule-templates/:id', updateScheduleTemplate);

export default router;
