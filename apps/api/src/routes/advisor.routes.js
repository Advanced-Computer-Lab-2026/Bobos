import express from 'express';
import {
  assignAdvisor,
  getMyAdvisor,
  listAdvisingStudents,
  getAdvisingStudent,
  listAdvisors,
} from '../controllers/advisor.controller.js';
import { requireRole } from '../middleware/require-role.js';

const router = express.Router();

router.get('/advisors', requireRole('advisor', 'coordinator'), listAdvisors);
router.get('/my-advisor', requireRole('advisingStudent'), getMyAdvisor);
router.get('/students', requireRole('advisor', 'coordinator'), listAdvisingStudents);
router.get('/students/:profileId', requireRole('advisor', 'coordinator'), getAdvisingStudent);
router.patch('/students/:profileId/advisor', requireRole('coordinator'), assignAdvisor);

export default router;
