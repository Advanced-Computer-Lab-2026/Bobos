import express from 'express';
import {
  assignAdvisor,
  getMyAdvisor,
  listAdvisingStudents,
  getAdvisingStudent,
  listAdvisors,
} from '../controllers/advisor.controller.js';

const router = express.Router();

router.get('/advisors', listAdvisors);
router.get('/my-advisor', getMyAdvisor);
router.get('/students', listAdvisingStudents);
router.get('/students/:profileId', getAdvisingStudent);
router.patch('/students/:profileId/advisor', assignAdvisor);

export default router;

