import express from "express";
import { processAdvisingSchedule, reopenAdvisingSchedule, downloadMySchedule, addDraftCourse, createAdvisingDraft, getDraftCreditHours, getEligibleCourses, removeDraftCourse, selectMandatoryCourses, getAdvisingDraft, getAdvisingOverview, removeBachelorProject, setBachelorProject, getMyCourseDetails, getMyRegisteredCourses, getMySchedule, getStudentSchedule, listStudentsWithSchedules, saveAdvisingDraft, validateAdvisingDraft } from "../controllers/scheduling.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/require-role.js";

const router = express.Router();
router.use(requireAuth);
router.get("/me", requireRole("normalStudent", "advisingStudent"), getMySchedule);
router.get("/me/courses", requireRole("normalStudent", "advisingStudent"), getMyRegisteredCourses);
router.get("/me/download", requireRole("normalStudent", "advisingStudent"), downloadMySchedule);
router.get("/me/courses/:courseId", requireRole("normalStudent", "advisingStudent"), getMyCourseDetails);
router.get("/students", requireRole("advisor", "coordinator", "administrator"), listStudentsWithSchedules);
router.get("/advising/:studentId/overview", requireRole("advisor", "coordinator", "administrator"), getAdvisingOverview);
router.put("/advising/:studentId/bachelor-project", requireRole("advisor", "coordinator"), setBachelorProject);
router.delete("/advising/:studentId/bachelor-project", requireRole("advisor", "coordinator"), removeBachelorProject);
router.post("/advising/:studentId/draft", requireRole("advisor", "coordinator"), createAdvisingDraft);
router.put("/advising/:studentId/mandatory-courses", requireRole("advisor", "coordinator"), selectMandatoryCourses);
router.get("/advising/:studentId/eligible-courses", requireRole("advisor", "coordinator"), getEligibleCourses);
router.get("/advising/:studentId/credit-hours", requireRole("advisor", "coordinator"), getDraftCreditHours);
router.post("/advising/:studentId/courses", requireRole("advisor", "coordinator"), addDraftCourse);
router.delete("/advising/:studentId/courses/:courseOffering", requireRole("advisor", "coordinator"), removeDraftCourse);
router.get("/advising/:studentId/draft", requireRole("advisor", "coordinator"), getAdvisingDraft);
router.put("/advising/:studentId/draft", requireRole("advisor", "coordinator"), saveAdvisingDraft);
router.post("/advising/:studentId/draft/validate", requireRole("advisor", "coordinator"), validateAdvisingDraft);
router.post("/advising/:studentId/process", requireRole("advisor", "coordinator"), processAdvisingSchedule);
router.post("/advising/:studentId/reopen", requireRole("advisor", "coordinator"), reopenAdvisingSchedule);
router.get("/student/:studentId", getStudentSchedule);

export default router;
