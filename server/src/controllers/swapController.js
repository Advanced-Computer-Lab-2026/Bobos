// Requirement 34 - a Normal Student views the eligible destination groups (and
// their complete weekly schedules) for a whole-schedule swap. Read-only.
// The eligibility rule lives in utils/swapEligibility.js.
//
// Extension point: requirement 35 (submit a swap request) belongs in this file
// and must re-run findEligibleGroups() for the chosen templateId server-side.
import { Student } from '../models/Student.js';
import { StudentSchedule } from '../models/StudentSchedule.js';
import { ScheduleTemplate } from '../models/ScheduleTemplate.js';
// Course is imported so CourseOffering.course can be populated.
import '../models/Course.js';
import { CourseOffering } from '../models/CourseOffering.js';
import { resolveTerm } from './groupAssignmentController.js';
import { NO_VISIBLE_SCHEDULE } from '../utils/scheduleAccess.js';
import { findEligibleGroups } from '../utils/swapEligibility.js';

export const ONLY_NORMAL_STUDENTS =
  'Only normal students can swap their whole schedule with another standard schedule group.';
export const ADVISING_CANNOT_SWAP =
  'Advising students cannot swap schedule groups. Ask your academic advisor for a change request instead.';

// GET /api/swaps/eligible-groups?termId=
export async function getEligibleGroups(req, res, next) {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ message: ONLY_NORMAL_STUDENTS });

    const student = await Student.findOne({ user: req.user.id }).populate('user', 'fullName');
    if (!student) return res.status(404).json({ message: 'No student record is linked to this account.' });
    if (student.studentType !== 'normal') return res.status(403).json({ message: ADVISING_CANNOT_SWAP });

    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, status: 'processed' });
    if (!schedule) return res.status(404).json({ message: NO_VISIBLE_SCHEDULE });

    // Two queries for every candidate in the term - no N+1 per template.
    const templates = await ScheduleTemplate.find({ term: term._id, isPublished: true }).lean();
    const offeringIds = [...new Set(templates.flatMap((t) => t.entries.map((e) => String(e.offering))))];
    const offerings = await CourseOffering.find({ _id: { $in: offeringIds } })
      .populate('course', 'code name creditHours')
      .lean();
    const offeringsById = new Map(offerings.map((o) => [String(o._id), o]));

    const courseCodes = schedule.entries.map((e) => e.courseCode).filter(Boolean);
    const eligibleGroups = findEligibleGroups({
      studentCourseCodes: courseCodes,
      currentTemplateId: schedule.template,
      templates,
      offeringsById
    });

    const ownTemplate = templates.find((t) => String(t._id) === String(schedule.template));
    res.json({
      term: {
        _id: term._id,
        academicYear: term.academicYear,
        season: term.season,
        swapDeadline: term.swapDeadline || null
      },
      student: {
        _id: student._id,
        studentId: student.studentId,
        fullName: student.user ? student.user.fullName : null,
        major: student.major,
        currentSemester: student.currentSemester
      },
      currentGroup: {
        templateId: schedule.template || null,
        studyGroup: schedule.studyGroup,
        major: ownTemplate ? ownTemplate.major : student.major,
        semester: ownTemplate ? ownTemplate.semester : student.currentSemester,
        courseCodes,
        totalCreditHours: schedule.entries.reduce((sum, e) => sum + (e.creditHours || 0), 0)
      },
      eligibleGroups,
      count: eligibleGroups.length
    });
  } catch (err) { next(err); }
}
