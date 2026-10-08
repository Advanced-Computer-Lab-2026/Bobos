import express from 'express';
import {
  assignAdvisor,
  getMyAdvisor,
  listAdvisingStudents,
  getAdvisingStudent,
  listAdvisors,
} from '../controllers/advisor.controller.js';
import { requireRole } from './admin.routes.js';

const router = express.Router();

router.get('/advisors', requireRole('advisor', 'coordinator'), listAdvisors);
router.get('/my-advisor', requireRole('normalStudent', 'advisingStudent'), getMyAdvisor);
router.get('/students', requireRole('advisor', 'coordinator'), listAdvisingStudents);
router.get('/students/:profileId', requireRole('advisor', 'coordinator'), getAdvisingStudent);
router.patch('/students/:profileId/advisor', requireRole('advisor', 'coordinator'), assignAdvisor);

export default router;
