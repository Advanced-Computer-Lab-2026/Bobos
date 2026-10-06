import express from 'express';
import { createOffering, getOfferings, getOfferingById, createCourse, getCourseById, getCourses, updateCourse, deleteCourse} from '../controllers/catalogue.controller.js';

const router = express.Router();

// Admin routes for Course Offerings (Req 22 & 23)
router.post('/offerings', createOffering);
router.get('/offerings', getOfferings);
router.get('/offerings/:id', getOfferingById);

// Courses managment
router.post('/courses', createCourse);
router.get('/courses/:id', getCourseById);
router.get('/courses', getCourses);
router.put('/courses/:id', updateCourse);
router.delete('/courses/:id', deleteCourse);

export default router;
