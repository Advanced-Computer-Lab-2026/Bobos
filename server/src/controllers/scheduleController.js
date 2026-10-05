// Requirement 31: view a student's current weekly schedule (course code, course
// name, lecture/tutorial/lab times and locations) as a weekly calendar with
// days off. Read-only. Visibility rules live in utils/scheduleAccess.js and the
// calendar is built in utils/weeklyCalendar.js so reqs 32/33/49 share them.
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { StudentSchedule } from '../models/StudentSchedule.js';
import { resolveTerm, resolveStudent } from './groupAssignmentController.js';
import { checkScheduleAccess } from '../utils/scheduleAccess.js';
import { buildWeeklyCalendar } from '../utils/weeklyCalendar.js';

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

// GET /api/schedules/me?termId=
export async function getMySchedule(req, res, next) {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({
        message: 'Only students have their own schedule. Use GET /api/schedules/student/:studentId to view a student.'
      });
    }
    const student = await Student.findOne({ user: req.user.id }).populate('user', 'fullName email');
    if (!student) return res.status(404).json({ message: 'No student record is linked to this account.' });
    return await sendSchedule(req, res, student);
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
