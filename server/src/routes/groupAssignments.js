// Requirement 30 - /api/group-assignments
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listTerms,
  listNormalStudents,
  listAssignableGroups,
  getStudentAssignment,
  assignStudentToGroup,
  unassignStudent
} from '../controllers/groupAssignmentController.js';

const router = Router();

router.use(requireAuth);

// Reading the roster and the published groups is also useful to an
// Administrator (read-only access, see requirement 31). Assigning is
// Coordinator-only, exactly as requirement 30 states.
const canRead = requireRole('coordinator', 'administrator');
const canAssign = requireRole('coordinator');

// Literal paths must be registered before '/:studentId'.
router.get('/terms', canRead, listTerms); // temporary - see the controller
router.get('/students', canRead, listNormalStudents);
router.get('/groups', canRead, listAssignableGroups);
router.get('/:studentId', canRead, getStudentAssignment);

router.post('/', canAssign, assignStudentToGroup);
router.delete('/:studentId', canAssign, unassignStudent);

export default router;
