// Requirement 31: view a student's current weekly schedule (course code, course
// name, lecture/tutorial/lab times and locations) as a weekly calendar with
// days off. Read-only. Visibility rules live in utils/scheduleAccess.js and the
// calendar is built in utils/weeklyCalendar.js so reqs 32/33/49 share them.
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { StudentSchedule } from '../models/StudentSchedule.js';
import { Course } from '../models/Course.js';
import { CourseOffering } from '../models/CourseOffering.js';
import { resolveTerm, resolveStudent } from './groupAssignmentController.js';
import { checkScheduleAccess, NO_VISIBLE_SCHEDULE } from '../utils/scheduleAccess.js';
import { buildPdfModel, renderSchedulePdf } from '../utils/schedulePdf.js';
import { buildWeeklyCalendar } from '../utils/weeklyCalendar.js';
import { buildRegisteredCourses } from '../utils/registeredCourses.js';
import { findCourseEntry, buildCourseDetails } from '../utils/courseDetails.js';

function termView(term) {
  return { _id: term._id, academicYear: term.academicYear, season: term.season };
}

function studentView(student) {
  return {
    _id: student._id,
    studentId: student.studentId,
    fullName: student.user ? student.user.fullName : null,
    email: student.user ? student.user.email : null,
    studentType: student.studentType,
    major: student.major,
    currentSemester: student.currentSemester
  };
}

async function sendSchedule(req, res, student) {
  const { term, error } = await resolveTerm(req.query.termId);
  if (error) return res.status(error.status).json({ message: error.message });

  const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id });
  const access = checkScheduleAccess(req.user, student, schedule);
  if (access.status !== 200) return res.status(access.status).json({ message: access.message });

  const calendar = buildWeeklyCalendar(schedule.entries);
  return res.json({
    term: termView(term),
    student: studentView(student),
    schedule: {
      _id: schedule._id,
      status: schedule.status,
      studyGroup: schedule.studyGroup,
      assignedAt: schedule.assignedAt || null,
      ...calendar
    },
    readOnly: access.readOnly
  });
}

// Shared by the student-only "/me" endpoints (reqs 31, 32): 403 for staff,
// 404 when no Student is linked. Returns the student or null (response sent).
async function ownStudentOr403(req, res) {
  if (req.user.role !== 'student') {
    res.status(403).json({
      message: 'Only students have their own schedule. Use GET /api/schedules/student/:studentId to view a student.'
    });
    return null;
  }
  const student = await Student.findOne({ user: req.user.id }).populate('user', 'fullName email');
  if (!student) {
    res.status(404).json({ message: 'No student record is linked to this account.' });
    return null;
  }
  return student;
}

// GET /api/schedules/me?termId=
export async function getMySchedule(req, res, next) {
  try {
    const student = await ownStudentOr403(req, res);
    if (!student) return undefined;
    return await sendSchedule(req, res, student);
  } catch (err) { next(err); }
}

// Requirement 32 - GET /api/schedules/me/courses?termId=
// The student's registered courses = the entries of their own VISIBLE
// schedule (same checkScheduleAccess rules and neutral 404 as req 31).
export async function getMyRegisteredCourses(req, res, next) {
  try {
    const student = await ownStudentOr403(req, res);
    if (!student) return undefined;

    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id });
    const access = checkScheduleAccess(req.user, student, schedule);
    if (access.status !== 200) return res.status(access.status).json({ message: access.message });

    const courseIds = schedule.entries.map((e) => e.course).filter(Boolean);
    const catalogue = await Course.find({ _id: { $in: courseIds } }).select('courseType').lean();
    const courseTypeById = new Map(catalogue.map((c) => [String(c._id), c.courseType]));
    const { courses, totalCreditHours, courseCount } = buildRegisteredCourses(schedule.entries, courseTypeById);

    const { _id, studentId, fullName, studentType, major, currentSemester } = studentView(student);
    return res.json({
      term: termView(term),
      student: { _id, studentId, fullName, studentType, major, currentSemester },
      status: schedule.status,
      studyGroup: schedule.studyGroup,
      courses,
      totalCreditHours,
      courseCount
    });
  } catch (err) { next(err); }
}

// Requirement 33 - GET /api/schedules/me/courses/:courseId?termId=
// One registered course with its assigned lecture / tutorial / lab, taken from
// the student's own VISIBLE schedule snapshot (same rules as reqs 31/32). A
// course outside that schedule gets one neutral 404, whether or not it exists.
export const COURSE_NOT_REGISTERED = 'This course is not in your registered courses.';

export async function getMyCourseDetails(req, res, next) {
  try {
    const student = await ownStudentOr403(req, res);
    if (!student) return undefined;

    if (!mongoose.isValidObjectId(req.params.courseId)) {
      return res.status(400).json({ message: 'Invalid courseId' });
    }

    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id });
    const access = checkScheduleAccess(req.user, student, schedule);
    if (access.status !== 200) return res.status(access.status).json({ message: access.message });

    const entry = findCourseEntry(schedule.entries, req.params.courseId);
    if (!entry) return res.status(404).json({ message: COURSE_NOT_REGISTERED });

    const [course, offering] = await Promise.all([
      Course.findById(entry.course).select('courseType').lean(),
      entry.offering ? CourseOffering.findById(entry.offering).select('instructors').lean() : null
    ]);
    const details = buildCourseDetails(entry, {
      courseType: course ? course.courseType : null,
      instructors: offering ? offering.instructors : []
    });

    const { _id, studentId, fullName, studentType, major, currentSemester } = studentView(student);
    return res.json({
      term: termView(term),
      student: { _id, studentId, fullName, studentType, major, currentSemester },
      status: schedule.status,
      studyGroup: schedule.studyGroup,
      ...details
    });
  } catch (err) { next(err); }
}

// Requirement 49 - GET /api/schedules/me/download?termId=
// The student's own PROCESSED schedule as a PDF (built in memory). Visibility
// is the req-31 matrix (checkScheduleAccess); on top of it only 'processed' may
// be downloaded: an advising student's 'ready_for_student_review' -> 409, and
// a draft / no schedule keeps the neutral 404 so a draft is never revealed.
export const NOT_FINAL_YET = 'Your schedule is not final yet. You can download it once it has been processed.';

export async function downloadMySchedule(req, res, next) {
  try {
    const student = await ownStudentOr403(req, res);
    if (!student) return undefined;

    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id });
    const access = checkScheduleAccess(req.user, student, schedule);
    if (access.status !== 200) return res.status(access.status).json({ message: access.message });
    if (schedule.status === 'ready_for_student_review') return res.status(409).json({ message: NOT_FINAL_YET });
    if (schedule.status !== 'processed') return res.status(404).json({ message: NO_VISIBLE_SCHEDULE });

    const model = buildPdfModel({
      student: studentView(student),
      term: termView(term),
      schedule: { status: schedule.status, studyGroup: schedule.studyGroup },
      calendar: buildWeeklyCalendar(schedule.entries)
    });
    const pdf = await renderSchedulePdf({ model });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${model.fileName}"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'no-store'
    });
    return res.status(200).end(pdf);
  } catch (err) { next(err); }
}

// GET /api/schedules/student/:studentId?termId=   (Mongo _id or XX-XXXX)
export async function getStudentSchedule(req, res, next) {
  try {
    const student = await resolveStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    return await sendSchedule(req, res, student);
  } catch (err) { next(err); }
}

// GET /api/schedules/students?search=&termId=
// Picker for the staff screen. Advisors see advising students only (the same
// rule as the schedule itself); Coordinators and Administrators see everyone.
export async function listStudentsWithSchedules(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const filter = {};
    if (req.user.role === 'advisor') filter.studentType = 'advising';

    const search = (req.query.search || '').trim();
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const users = await User.find({ $or: [{ fullName: rx }, { email: rx }] }).select('_id').lean();
      filter.$or = [{ studentId: rx }, { user: { $in: users.map((u) => u._id) } }];
    }

    const students = await Student.find(filter).populate('user', 'fullName email').sort({ studentId: 1 });
    const schedules = await StudentSchedule.find({
      term: term._id,
      student: { $in: students.map((s) => s._id) }
    }).select('student status');
    const statusByStudent = new Map(schedules.map((s) => [String(s.student), s.status]));

    const rows = students.map((s) => ({
      ...studentView(s),
      scheduleStatus: statusByStudent.get(String(s._id)) || null
    }));
    res.json({ term: termView(term), count: rows.length, students: rows });
  } catch (err) { next(err); }
}
