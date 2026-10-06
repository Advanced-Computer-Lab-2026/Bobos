// TEMPORARY DEV SHIM — delete once requirement 1 (login) is implemented by team A1.
// Delete this file, src/controllers/devController.js and the `/api/dev` mount in
// src/app.js together.
import { Router } from 'express';
import { listDevUsers, issueDevToken } from '../controllers/devController.js';

const router = Router();

router.get('/users', listDevUsers);
router.post('/token', issueDevToken);

export default router;
