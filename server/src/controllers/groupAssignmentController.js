// Requirement 30 (depends on 27): as a Coordinator, assign or reassign NORMAL
// students to a standard schedule group.
//
//   "A student's processed schedule is created from the assigned group's
//    published template."
//
// So the only legal source of a processed schedule here is a ScheduleTemplate
// with isPublished === true, whose entries point at PUBLISHED CourseOfferings.
import Joi from 'joi';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
// Course is imported for its side effect as well as its use below: populating
// CourseOffering.course needs the 'Course' model to be registered on mongoose.
import { Course } from '../models/Course.js';
import { AcademicTerm } from '../models/AcademicTerm.js';
import { CourseOffering } from '../models/CourseOffering.js';
import { ScheduleTemplate } from '../models/ScheduleTemplate.js';
import { StudentSchedule } from '../models/StudentSchedule.js';
import { findFirstClash, describeSlot } from '../utils/timetable.js';

const COMPONENTS = [
  { type: 'lecture', field: 'lectureSlotId' },
  { type: 'tutorial', field: 'tutorialSlotId' },
  { type: 'lab', field: 'labSlotId' }
];

const objectId = Joi.string().hex().length(24);
const humanStudentId = Joi.string().pattern(/^\d{2}-\d{4}$/);

const assignSchema = Joi.object({
  studentId: Joi.alternatives().try(objectId, humanStudentId).required(),
  termId: objectId.allow(null, ''),
  studyGroup: Joi.string().trim().required()
});

/* ------------------------------------------------------------------ helpers */

// `termId` is optional everywhere: when it is omitted we fall back to the term
// flagged isCurrent (requirement 16 guarantees exactly one).
// Exported for reuse by requirement 31 (scheduleController.js).
export async function resolveTerm(termId) {
  if (termId) {
    if (!mongoose.isValidObjectId(termId)) return { error: { status: 400, message: 'Invalid termId' } };
    const term = await AcademicTerm.findById(termId);
    if (!term) return { error: { status: 404, message: 'Academic term not found' } };
    return { term };
  }
  const term = await AcademicTerm.findOne({ isCurrent: true });
  if (!term) {
    return { error: { status: 404, message: 'No current academic term is defined. Pass ?termId=...' } };
  }
  return { term };
}

// The contract is the Mongo _id of the Student document, but the human
// XX-XXXX student id is accepted too because that is what a Coordinator reads
// off the screen.
export async function resolveStudent(id) {
  if (mongoose.isValidObjectId(id)) {
    const byMongoId = await Student.findById(id).populate('user', 'fullName email role isActive');
    if (byMongoId) return byMongoId;
  }
  if (/^\d{2}-\d{4}$/.test(String(id))) {
    return Student.findOne({ studentId: id }).populate('user', 'fullName email role isActive');
  }
  return null;
}

function studentView(student, schedule) {
  return {
    _id: student._id,
    studentId: student.studentId,
    fullName: student.user ? student.user.fullName : null,
    email: student.user ? student.user.email : null,
    studentType: student.studentType,
    faculty: student.faculty,
    major: student.major,
    currentSemester: student.currentSemester,
    gpa: student.gpa,
    academicStanding: student.academicStanding,
    isActive: student.user ? student.user.isActive : null,
    assignment: schedule
      ? {
          scheduleId: schedule._id,
          studyGroup: schedule.studyGroup,
          template: schedule.template,
          status: schedule.status,
          assignedAt: schedule.assignedAt,
          courseCount: schedule.entries ? schedule.entries.length : 0
        }
      : null
  };
}

// Turns one template into the flat list of real slot subdocuments it points at.
// Returns { entries, slots } on success or { error } with the HTTP status and a
// message that names the offending course.
function resolveTemplateSlots(template, offeringsById) {
  const entries = [];
  const slots = [];

  for (const entry of template.entries) {
    const offering = offeringsById.get(String(entry.offering));
    if (!offering) {
      return {
        error: {
          status: 409,
          message: `Study group ${template.studyGroup} references a course offering that no longer exists. Ask the Coordinator to update the template (requirement 29).`
        }
      };
    }

    const course = offering.course || {};
    const courseCode = course.code || 'unknown course';

    if (!offering.isPublished) {
      return {
        error: {
          status: 409,
          message: `The course offering for ${courseCode} is not published for this term, so it cannot be scheduled (requirement 27). Publish it first.`
        }
      };
    }

    const entrySlots = [];
    for (const component of COMPONENTS) {
      const slotId = entry[component.field];
      // A null id simply means this course has no such component (e.g. a course
      // with no lab). That is legal - skip it.
      if (!slotId) continue;

      const slot = offering.slots.find((s) => String(s._id) === String(slotId));
      if (!slot) {
        return {
          error: {
            status: 409,
            message: `The ${component.type} slot selected for ${courseCode} in study group ${template.studyGroup} no longer exists on the course offering. The template must be updated (requirement 29).`
          }
        };
      }
      if (slot.type !== component.type) {
        return {
          error: {
            status: 409,
            message: `The slot selected as the ${component.type} of ${courseCode} in study group ${template.studyGroup} is actually a ${slot.type} slot. The template must be updated (requirement 29).`
          }
        };
      }

      const view = {
        slotId: slot._id,
        type: slot.type,
        groupNumber: slot.groupNumber,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room
      };
      entrySlots.push(view);
      slots.push({
        ...view,
        offeringId: offering._id,
        courseCode,
        maxCapacity: slot.maxCapacity,
        assignedCount: slot.assignedCount
      });
    }

    entries.push({
      course: course._id || offering.course,
      courseCode: course.code,
      courseName: course.name,
      creditHours: course.creditHours,
      offering: offering._id,
      slots: entrySlots
    });
  }

  return { entries, slots };
}

/*
 * CONCURRENCY / ATOMICITY CAVEAT - please read before "fixing" this.
 *
 * Real atomicity across several documents needs a MongoDB transaction, which
 * needs a replica set. The project runs against a STANDALONE mongod, so
 * transactions are not available and this code does NOT claim to be atomic.
 *
 * What it does instead:
 *   - every capacity change is a CONDITIONAL updateOne (increments require
 *     assignedCount < maxCapacity, decrements require assignedCount > 0), so a
 *     lost race is detected rather than silently overbooking or going negative;
 *   - every applied change is recorded and rolled back (inverse $inc) if a
 *     later step fails.
 *
 * A crash between two updates can still leave an assignedCount off by one.
 * A periodic reconciliation job (recount from StudentSchedule) is the honest
 * fix and is out of scope for Sprint 1.
 */
async function applySlotDelta(offeringId, slotId, delta, maxCapacity) {
  const elem = { _id: slotId };
  if (delta > 0) elem.assignedCount = { $lt: maxCapacity };
  else elem.assignedCount = { $gt: 0 };

  const result = await CourseOffering.updateOne(
    { _id: offeringId, slots: { $elemMatch: elem } },
    { $inc: { 'slots.$.assignedCount': delta } }
  );
  return result.modifiedCount === 1;
}

async function rollback(applied) {
  for (const op of applied.slice().reverse()) {
    // Best effort: a failed rollback must not mask the original error.
    try {
      await applySlotDelta(op.offeringId, op.slotId, -op.delta, Number.MAX_SAFE_INTEGER);
    } catch (err) {
      console.error('Failed to roll back slot count', op, err.message);
    }
  }
}

/* -------------------------------------------------------------- controllers */

// GET /api/group-assignments/terms
// TEMPORARY CONVENIENCE: the term list really belongs to /api/terms
// (requirements 16/17, owned by the Administrator team). Until that exists the
// requirement-30 screen needs a term selector, so it is served from this
// namespace. Delete this handler, its route and the client call in
// AssignScheduleGroups.jsx once /api/terms ships.
export async function listTerms(req, res, next) {
  try {
    const terms = await AcademicTerm.find()
      .select('academicYear season isCurrent termStart termEnd swapDeadline')
      .sort({ termStart: -1 });
    res.json({ terms });
  } catch (err) { next(err); }
}

// GET /api/group-assignments/students?termId=&search=&major=&semester=&assigned=
export async function listNormalStudents(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const filter = { studentType: 'normal' };
    if (req.query.major) filter.major = req.query.major;
    if (req.query.semester) {
      const semester = Number(req.query.semester);
      if (!Number.isFinite(semester)) {
        return res.status(400).json({ message: 'semester must be a number' });
      }
      filter.currentSemester = semester;
    }

    // fullName / email live on User, so a free-text search needs the user ids.
    const search = (req.query.search || '').trim();
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const users = await User.find({ $or: [{ fullName: rx }, { email: rx }] }).select('_id').lean();
      filter.$or = [{ studentId: rx }, { user: { $in: users.map((u) => u._id) } }];
    }

    const students = await Student.find(filter)
      .populate('user', 'fullName email role isActive')
      .sort({ studentId: 1 });

    const schedules = await StudentSchedule.find({
      term: term._id,
      student: { $in: students.map((s) => s._id) }
    }).select('student studyGroup template status assignedAt entries');
    const byStudent = new Map(schedules.map((s) => [String(s.student), s]));

    let rows = students.map((s) => studentView(s, byStudent.get(String(s._id))));

    if (req.query.assigned === 'true') rows = rows.filter((r) => r.assignment);
    if (req.query.assigned === 'false') rows = rows.filter((r) => !r.assignment);

    res.json({ term, count: rows.length, students: rows });
  } catch (err) { next(err); }
}

// GET /api/group-assignments/groups?termId=&major=&semester=
// The assignable "standard schedule groups" are the PUBLISHED templates.
export async function listAssignableGroups(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const filter = { term: term._id, isPublished: true };
    if (req.query.major) filter.major = req.query.major;
    if (req.query.semester) {
      const semester = Number(req.query.semester);
      if (!Number.isFinite(semester)) {
        return res.status(400).json({ message: 'semester must be a number' });
      }
      filter.semester = semester;
    }

    const templates = await ScheduleTemplate.find(filter).sort({ major: 1, semester: 1, studyGroup: 1 });

    const offeringIds = templates.flatMap((t) => t.entries.map((e) => e.offering));
    const offerings = await CourseOffering.find({ _id: { $in: offeringIds } })
      .populate('course', 'code name creditHours');
    const offeringsById = new Map(offerings.map((o) => [String(o._id), o]));

    const counts = await StudentSchedule.aggregate([
      { $match: { term: term._id, template: { $in: templates.map((t) => t._id) } } },
      { $group: { _id: '$template', n: { $sum: 1 } } }
    ]);
    const assignedByTemplate = new Map(counts.map((c) => [String(c._id), c.n]));

    const groups = templates.map((template) => {
      const resolved = resolveTemplateSlots(template, offeringsById);
      const courseCodes = (resolved.entries || []).map((e) => e.courseCode).filter(Boolean);
      const totalCreditHours = (resolved.entries || []).reduce(
        (sum, e) => sum + (e.creditHours || 0),
        0
      );
      const remaining = (resolved.slots || []).map((s) =>
        Math.max(0, (s.maxCapacity || 0) - (s.assignedCount || 0))
      );

      return {
        _id: template._id,
        term: template.term,
        major: template.major,
        semester: template.semester,
        studyGroup: template.studyGroup,
        isPublished: template.isPublished,
        courseCount: courseCodes.length,
        courseCodes,
        totalCreditHours,
        assignedStudents: assignedByTemplate.get(String(template._id)) || 0,
        minRemainingCapacity: remaining.length ? Math.min(...remaining) : null,
        // Weekly preview for the UI. `issue` is set when the template cannot be
        // resolved - the group is then shown but cannot be assigned.
        slots: (resolved.slots || []).map((s) => ({
          slotId: s.slotId,
          courseCode: s.courseCode,
          type: s.type,
          groupNumber: s.groupNumber,
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
          maxCapacity: s.maxCapacity,
          assignedCount: s.assignedCount,
          remainingCapacity: Math.max(0, (s.maxCapacity || 0) - (s.assignedCount || 0))
        })),
        issue: resolved.error ? resolved.error.message : null
      };
    });

    res.json({ term, count: groups.length, groups });
  } catch (err) { next(err); }
}

// GET /api/group-assignments/:studentId?termId=
export async function getStudentAssignment(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const student = await resolveStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id })
      .populate('template', 'studyGroup major semester isPublished')
      .populate('assignedBy', 'fullName email role');

    res.json({
      term,
      student: studentView(student, schedule),
      schedule: schedule || null
    });
  } catch (err) { next(err); }
}

// POST /api/group-assignments  { studentId, termId?, studyGroup }
export async function assignStudentToGroup(req, res, next) {
  const applied = [];
  try {
    const { value, error: validationError } = assignSchema.validate(req.body);
    if (validationError) return res.status(400).json({ message: validationError.message });

    // 1-2. the student must exist and must be a NORMAL student: advising
    // students receive their schedule through the advising workflow (reqs 62+).
    const student = await resolveStudent(value.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (student.studentType !== 'normal') {
      return res.status(400).json({
        message:
          'Only normal students can be assigned to a standard schedule group. Advising students receive their schedule through the advising workflow.'
      });
    }

    // 3. the term
    const { term, error: termError } = await resolveTerm(value.termId);
    if (termError) return res.status(termError.status).json({ message: termError.message });

    // 4. the standard schedule group = the template for
    //    (term, student's major, student's current semester, studyGroup)
    const template = await ScheduleTemplate.findOne({
      term: term._id,
      major: student.major,
      semester: student.currentSemester,
      studyGroup: value.studyGroup
    });
    if (!template) {
      return res.status(404).json({
        message: `No standard schedule group "${value.studyGroup}" exists for ${student.major} semester ${student.currentSemester} in this term.`
      });
    }
    if (!template.isPublished) {
      return res.status(409).json({
        message: `Study group "${value.studyGroup}" is not published. A student's processed schedule is created from the assigned group's published template, so the Coordinator must publish this template first.`
      });
    }

    // 5. every offering the template points at, with its course
    const offerings = await CourseOffering.find({
      _id: { $in: template.entries.map((e) => e.offering) }
    }).populate('course', 'code name creditHours');
    const offeringsById = new Map(offerings.map((o) => [String(o._id), o]));

    // 6. resolve the slot ids into real slot subdocuments
    const resolved = resolveTemplateSlots(template, offeringsById);
    if (resolved.error) {
      return res.status(resolved.error.status).json({ message: resolved.error.message });
    }

    const existing = await StudentSchedule.findOne({ student: student._id, term: term._id });
    const heldSlotIds = new Set(
      existing ? existing.entries.flatMap((e) => e.slots.map((s) => String(s.slotId))) : []
    );

    // 7. capacity. A slot the student ALREADY occupies is not double counted,
    // so reassigning into a group that shares a slot with the old group is not
    // spuriously reported full.
    const full = resolved.slots.filter((slot) => {
      const effective = (slot.assignedCount || 0) - (heldSlotIds.has(String(slot.slotId)) ? 1 : 0);
      return effective >= slot.maxCapacity;
    });
    if (full.length) {
      return res.status(409).json({
        message: `Study group "${value.studyGroup}" cannot be assigned because these slots are full: ${full
          .map((s) => `${s.courseCode} ${s.type} group ${s.groupNumber}`)
          .join(', ')}.`
      });
    }

    // 8. no timetable clash inside the processed schedule
    const clash = findFirstClash(resolved.slots);
    if (clash) {
      return res.status(409).json({
        message: `Study group "${value.studyGroup}" has a timetable clash: ${describeSlot(clash[0])} overlaps ${describeSlot(clash[1])}. Fix the template before assigning students.`
      });
    }

    // 9. apply. See the CONCURRENCY / ATOMICITY CAVEAT above: conditional
    // updates plus rollback, NOT a transaction.
    if (existing) {
      for (const entry of existing.entries) {
        for (const slot of entry.slots) {
          const ok = await applySlotDelta(entry.offering, slot.slotId, -1, 0);
          if (ok) applied.push({ offeringId: entry.offering, slotId: slot.slotId, delta: -1 });
          // A slot already at 0 is left alone - counts must never go negative.
        }
      }
    }

    for (const slot of resolved.slots) {
      const ok = await applySlotDelta(slot.offeringId, slot.slotId, 1, slot.maxCapacity);
      if (!ok) {
        await rollback(applied);
        return res.status(409).json({
          message: `${slot.courseCode} ${slot.type} group ${slot.groupNumber} filled up while this assignment was being saved. Nothing was changed - please try again.`
        });
      }
      applied.push({ offeringId: slot.offeringId, slotId: slot.slotId, delta: 1 });
    }

    const now = new Date();
    const isReassignment = Boolean(existing);
    const fromGroup = existing ? existing.studyGroup : null;

    try {
      let schedule;
      if (existing) {
        existing.studyGroup = template.studyGroup;
        existing.template = template._id;
        existing.status = 'processed';
        existing.entries = resolved.entries;
        existing.assignedBy = req.user.id;
        existing.assignedAt = now;
        existing.history.push({
          action: 'reassigned',
          fromGroup,
          toGroup: template.studyGroup,
          by: req.user.id,
          at: now
        });
        schedule = await existing.save();
      } else {
        schedule = await StudentSchedule.create({
          student: student._id,
          term: term._id,
          studyGroup: template.studyGroup,
          template: template._id,
          status: 'processed',
          entries: resolved.entries,
          assignedBy: req.user.id,
          assignedAt: now,
          history: [
            {
              action: 'assigned',
              fromGroup: null,
              toGroup: template.studyGroup,
              by: req.user.id,
              at: now
            }
          ]
        });
      }

      const populated = await StudentSchedule.findById(schedule._id)
        .populate('template', 'studyGroup major semester isPublished')
        .populate('assignedBy', 'fullName email role');

      return res.status(isReassignment ? 200 : 201).json({
        message: isReassignment
          ? `Reassigned ${student.studentId} from group ${fromGroup} to group ${template.studyGroup}.`
          : `Assigned ${student.studentId} to group ${template.studyGroup}.`,
        student: studentView(student, populated),
        schedule: populated
      });
    } catch (saveError) {
      await rollback(applied);
      // Two coordinators assigned the same student at the same time: the unique
      // (student, term) index rejected the loser. The counts were already rolled
      // back above, so this is a clean retry, not a server fault.
      if (saveError.code === 11000) {
        return res.status(409).json({
          message:
            'This student was just assigned by someone else. Reload the page to see their current group, then try again.'
        });
      }
      throw saveError;
    }
  } catch (err) {
    next(err);
  }
}

// DELETE /api/group-assignments/:studentId?termId=
// The schedule DOCUMENT IS REMOVED (so requirements 31/32/33 see no stale
// processed schedule) and the 'unassigned' history entry is returned in the
// response rather than kept in the database. Persisting the audit trail across
// an unassignment belongs to the activity-history requirement (48).
export async function unassignStudent(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });

    const student = await resolveStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id });
    if (!schedule) {
      return res.status(404).json({ message: 'This student has no assigned group for this term.' });
    }

    for (const entry of schedule.entries) {
      for (const slot of entry.slots) {
        await applySlotDelta(entry.offering, slot.slotId, -1, 0);
      }
    }

    const history = [
      ...schedule.history.map((h) => (h.toObject ? h.toObject() : h)),
      {
        action: 'unassigned',
        fromGroup: schedule.studyGroup,
        toGroup: null,
        by: req.user.id,
        at: new Date()
      }
    ];

    await schedule.deleteOne();

    res.json({
      message: `Removed ${student.studentId} from group ${schedule.studyGroup}.`,
      student: studentView(student, null),
      unassignedFrom: schedule.studyGroup,
      history
    });
  } catch (err) { next(err); }
}
