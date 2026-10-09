import express from "express";
import { downloadMySchedule, getMyCourseDetails, getMyRegisteredCourses, getMySchedule, getStudentSchedule, listStudentsWithSchedules } from "../controllers/scheduling.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();
router.use(requireAuth);
router.get("/me", requireRole("normalStudent", "advisingStudent"), getMySchedule);
router.get("/me/courses", requireRole("normalStudent", "advisingStudent"), getMyRegisteredCourses);
router.get("/me/download", requireRole("normalStudent", "advisingStudent"), downloadMySchedule);
router.get("/me/courses/:courseId", requireRole("normalStudent", "advisingStudent"), getMyCourseDetails);
router.get("/students", requireRole("advisor", "coordinator", "administrator"), listStudentsWithSchedules);
router.get("/student/:studentId", getStudentSchedule);

export default router;
