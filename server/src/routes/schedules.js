// Requirement 31 - /api/schedules (namespace reserved for C3: reqs 31/32/33/49)
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getMySchedule,
  getMyRegisteredCourses,
  getMyCourseDetails,
  downloadMySchedule,
  getStudentSchedule,
  listStudentsWithSchedules
} from '../controllers/scheduleController.js';

const router = Router();

router.use(requireAuth);

// Literal paths before '/student/:studentId'. Every route is GET: the
// Administrator's access is read-only by construction.
router.get('/me', getMySchedule);
// Requirement 32 - registered courses + credit hours (students only).
router.get('/me/courses', getMyRegisteredCourses);
// Requirement 49 - download the processed schedule as a PDF (students only).
router.get('/me/download', downloadMySchedule);
// Requirement 33 - one registered course's assigned lecture/tutorial/lab.
router.get('/me/courses/:courseId', getMyCourseDetails);
router.get('/students', requireRole('advisor', 'coordinator', 'administrator'), listStudentsWithSchedules);
// Students may call this too, but scheduleAccess.js limits them to themselves.
router.get('/student/:studentId', getStudentSchedule);

export default router;
