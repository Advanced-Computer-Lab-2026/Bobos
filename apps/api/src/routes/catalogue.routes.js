import express from 'express';
import {
  createCourse, 
  getCourseById, 
  getCourses, 
  updateCourse,
  deleteCourse,
  createOffering,
  getOfferings,
  getOfferingById,
  addOfferingSlots,
  updateOffering,
  updateOfferingSlot,
  deleteOffering,
  deleteOfferingSlot,
  togglePublishOffering,
} from '../controllers/catalogue.controller.js';
import { importCoursesCsv } from "../controllers/course-import.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();

// Req 22: Create a course offering with its slots
router.post('/offerings', requireAuth, requireRole('administrator'), createOffering);

// Req 23 and Req 57–58: students need published groups for preferences;
// advisors also need published groups when reviewing those preferences.
router.get('/offerings', requireAuth, requireRole('administrator', 'coordinator', 'advisor', 'advisingStudent'), getOfferings);

// Req 23: Select an offering to view all of its details and slots
router.get('/offerings/:id', requireAuth, requireRole('administrator', 'coordinator'), getOfferingById);

// Req 25: Add groups to an existing course offering.
router.post('/offerings/:id/slots', requireAuth, requireRole('administrator'), addOfferingSlots);

// Courses managment
router.post('/courses/import', express.json({ limit: "2mb" }), requireAuth, requireRole('administrator'), importCoursesCsv);
router.post('/courses', createCourse);
router.get('/courses/:id', getCourseById);
router.get('/courses', getCourses);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);
// Req 25: Update a course offering (top-level fields)
router.put('/offerings/:id', requireAuth, requireRole('administrator'), updateOffering);

// Req 25: Update a specific slot within a course offering
router.put('/offerings/:id/slots/:slotId', requireAuth, requireRole('administrator'), updateOfferingSlot);

// Req 26: Delete a course offering
router.delete('/offerings/:id', requireAuth, requireRole('administrator'), deleteOffering);

// Req 26: Delete a specific slot from a course offering
router.delete('/offerings/:id/slots/:slotId', requireAuth, requireRole('administrator'), deleteOfferingSlot);

// Req 27: Publish or unpublish a course offering
router.patch('/offerings/:id/publish', requireAuth, requireRole('administrator'), togglePublishOffering);

export default router;
