import mongoose from 'mongoose';
import { CourseOffering, Course, AcademicTerm } from '../models/catalogue.js';
import { ACADEMIC_SEASONS } from '../models/shared.js';
import { ScheduleTemplate, StudentSchedule } from '../models/academics.js';

const overlaps = (first, second) =>
  first.day === second.day && first.startMinute < second.endMinute && first.endMinute > second.startMinute;

async function findAcademicTerm(identifier) {
  if (typeof identifier !== 'string' || !identifier.trim()) return null;
  const value = identifier.trim();
  return mongoose.isValidObjectId(value)
    ? AcademicTerm.findById(value)
    : AcademicTerm.findOne({ code: value });
}

function groupsOverlap(firstOffering, secondOffering) {
  return (firstOffering.eligibleGroups || []).some((first) =>
    (secondOffering.eligibleGroups || []).some((second) =>
      String(first.major || '').trim().toLowerCase() === String(second.major || '').trim().toLowerCase() &&
      (first.semester == null || second.semester == null || Number(first.semester) === Number(second.semester)) &&
      (!first.studyGroup || !second.studyGroup || String(first.studyGroup).trim() === String(second.studyGroup).trim())
    )
  );
}

function sharesInstructor(firstOffering, secondOffering) {
  return (firstOffering.instructors || []).some((first) =>
    (secondOffering.instructors || []).some((second) => {
      const firstEmail = String(first.email || '').trim().toLowerCase();
      const secondEmail = String(second.email || '').trim().toLowerCase();
      const firstName = String(first.fullName || '').trim().toLowerCase();
      const secondName = String(second.fullName || '').trim().toLowerCase();
      return (firstEmail && secondEmail && firstEmail === secondEmail) || (firstName && firstName === secondName);
    })
  );
}

function conflictMessage(candidateOffering, candidateSlot, otherOffering, otherSlot) {
  if (!overlaps(candidateSlot, otherSlot)) return null;
  const sameOffering = String(candidateOffering._id || '') === String(otherOffering._id || '');
  const candidateRoom = String(candidateSlot.room || '').trim().toLowerCase();
  const otherRoom = String(otherSlot.room || '').trim().toLowerCase();
  if (candidateRoom && candidateRoom === otherRoom) {
    return `Room ${candidateSlot.room} is already booked on ${candidateSlot.day} from ${otherSlot.startMinute} to ${otherSlot.endMinute}.`;
  }
  if (!sameOffering && sharesInstructor(candidateOffering, otherOffering)) {
    const instructor = (candidateOffering.instructors || []).find((candidate) =>
      (otherOffering.instructors || []).some((other) =>
        (candidate.email && other.email && candidate.email.toLowerCase() === other.email.toLowerCase()) ||
        (candidate.fullName && other.fullName && candidate.fullName.trim().toLowerCase() === other.fullName.trim().toLowerCase())
      )
    );
    return `Instructor ${instructor?.fullName || instructor?.email} already has a class on ${candidateSlot.day} from ${otherSlot.startMinute} to ${otherSlot.endMinute}.`;
  }
  if (!sameOffering && groupsOverlap(candidateOffering, otherOffering)) {
    return `Eligible student groups have another class on ${candidateSlot.day} from ${otherSlot.startMinute} to ${otherSlot.endMinute}.`;
  }
  return null;
}

async function findOfferingSlotConflict(candidateOffering, candidateSlot, skipSlotId) {
  const termOfferings = await CourseOffering.find({ term: candidateOffering.term });
  for (const otherOffering of termOfferings) {
    for (const otherSlot of otherOffering.slots) {
      if (skipSlotId && String(otherSlot._id) === String(skipSlotId)) continue;
      const message = conflictMessage(candidateOffering, candidateSlot, otherOffering, otherSlot);
      if (message) return message;
    }
  }
  return null;
}

async function hasOfferingReferences(offeringId) {
  const [template, schedule] = await Promise.all([
    ScheduleTemplate.exists({
      $or: [
        { 'courses.courseOffering': offeringId },
        { 'courses.slots.courseOffering': offeringId },
      ],
    }),
    StudentSchedule.exists({
      $or: [
        { 'courses.courseOffering': offeringId },
        { 'courses.slots.courseOffering': offeringId },
      ],
    }),
  ]);
  return { template: Boolean(template), schedule: Boolean(schedule) };
}

async function hasSlotReferences(offeringId, slotId) {
  const [template, schedule] = await Promise.all([
    ScheduleTemplate.exists({
      courses: { $elemMatch: {
        courseOffering: offeringId,
        slots: { $elemMatch: { slotGroupId: slotId } },
      } },
    }),
    StudentSchedule.exists({
      courses: { $elemMatch: {
        slots: { $elemMatch: { courseOffering: offeringId, slotGroupId: slotId } },
      } },
    }),
  ]);
  return { template: Boolean(template), schedule: Boolean(schedule) };
}

export const createCourse = async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ message: 'Request body must be a JSON object' });
    }
    const {
      code, name, creditHours, courseType, facultyMajors = [],
      recommendedSemester, lectureHours, tutorialHours, labHours,
      offeringSeasons = [], prerequisites = [], isBachelorProject, isActive,
    } = body;

    for (const [field, value] of Object.entries({ code, name, courseType })) {
      if (typeof value !== 'string' || !value.trim()) {
        return res.status(400).json({ message: `${field} is required and must be a non-empty string` });
      }
    }
    if (typeof creditHours !== 'number' || !Number.isFinite(creditHours) || creditHours < 0) {
      return res.status(400).json({ message: 'creditHours is required and must be a number greater than or equal to 0' });
    }
    if (!['core', 'elective', 'huma'].includes(courseType)) {
      return res.status(400).json({ message: 'courseType must be core, elective, or huma' });
    }
    for (const [field, min, max] of [
      ['recommendedSemester', 1, 10], ['lectureHours', 0, Infinity],
      ['tutorialHours', 0, Infinity], ['labHours', 0, Infinity],
    ]) {
      const value = body[field];
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)) {
        return res.status(400).json({ message: `${field} must be a number from ${min} to ${max === Infinity ? 'infinity' : max}` });
      }
    }
    for (const [field, value] of Object.entries({ facultyMajors, offeringSeasons, prerequisites })) {
      if (!Array.isArray(value)) return res.status(400).json({ message: `${field} must be an array` });
    }
    if (facultyMajors.some(value => typeof value !== 'string' || !value.trim())) {
      return res.status(400).json({ message: 'facultyMajors must contain only non-empty strings' });
    }
    if (offeringSeasons.some(value => !ACADEMIC_SEASONS.includes(value))) {
      return res.status(400).json({ message: `offeringSeasons values must be one of: ${ACADEMIC_SEASONS.join(', ')}` });
    }
    if (prerequisites.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: 'Each prerequisite must be a valid course ID' });
    }
    if (new Set(prerequisites.map(String)).size !== prerequisites.length) {
      return res.status(400).json({ message: 'prerequisites cannot contain duplicate course IDs' });
    }
    for (const field of ['isBachelorProject', 'isActive']) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') {
        return res.status(400).json({ message: `${field} must be a boolean` });
      }
    }

    const normalizedCode = code.trim().toUpperCase();
    const existingCourse = await Course.findOne({ code: normalizedCode });
    if (existingCourse) return res.status(400).json({ message: 'Course code already exists' });

    if (prerequisites.length) {
      const found = await Course.countDocuments({ _id: { $in: prerequisites } });
      if (found !== prerequisites.length) {
        return res.status(400).json({ message: 'One or more prerequisites do not exist' });
      }
    }

    const newCourse = new Course({
      code: normalizedCode,
      name: name.trim(),
      creditHours,
      courseType,
      facultyMajors: facultyMajors.map(value => value.trim()),
      recommendedSemester,
      lectureHours,
      tutorialHours,
      labHours,
      offeringSeasons,
      prerequisites,
      ...(isBachelorProject !== undefined && { isBachelorProject }),
      ...(isActive !== undefined && { isActive }),
    });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: 'Course code already exists' });
    res.status(400).json({ message: error.message });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('prerequisites');
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Get all courses
export const getCourses = async (req, res) => {
  try {
    const courses = await Course.find().populate('prerequisites');
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    // 1. Validate ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }
    // 2. Make sure there is something to update
    if (!Object.keys(req.body).length) {
      return res.status(400).json({
        message: "Provide at least one field to update"
      });
    }
    // 3. Find the course
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        message: "Course not found"
      });
    }
    // 4. Normalize fields
    const updates = { ...req.body };
    if (typeof updates.code === "string") {
      updates.code = updates.code.trim().toUpperCase();
    }
    if (typeof updates.name === "string") {
      updates.name = updates.name.trim();
    }
    // 5. Check prerequisite IDs if they're being updated
    if (updates.prerequisites !== undefined) {
      if (
        !Array.isArray(updates.prerequisites) ||
        updates.prerequisites.some(
          id => !mongoose.isValidObjectId(id)
        )
      ) {
        return res.status(400).json({
          message: "Invalid prerequisites"
        });
      }

      const found = await Course.countDocuments({
        _id: { $in: updates.prerequisites }
      });

      if (found !== updates.prerequisites.length) {
        return res.status(400).json({
          message: "One or more prerequisites do not exist"
        });
      }
    }
    // 6. Check duplicate course code
    if (updates.code) {
      const duplicate = await Course.exists({
        code: updates.code,
        _id: { $ne: id }
      });

      if (duplicate) {
        return res.status(400).json({
          message: "Course code already exists"
        });
      }
    }
    // 7. Apply updates
    Object.assign(course, updates);
    // 8. Save and return the updated course
    await course.save();
    res.json(course);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Course code already exists"
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message
      });
    }

    res.status(500).json({
      message: error.message
    });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid course ID' });
    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const usedAsPrerequisite = await Course.exists({ prerequisites: id });
    if (usedAsPrerequisite) return res.status(409).json({ message: 'Cannot delete this course because another course uses it as a prerequisite' });
    await course.deleteOne();
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 22: Create a course offering and its lecture, tutorial and lab slots ───
export const createOffering = async (req, res) => {
  try {
    const { course, term, academicYear, instructors, eligibleGroups, slots = [], isPublished = false } = req.body || {};
    if (!mongoose.isValidObjectId(course)) return res.status(400).json({ message: 'A valid course ID is required.' });
    if (typeof term !== 'string' || !term.trim()) return res.status(400).json({ message: 'An academic term code or ID is required.' });
    if (academicYear !== undefined && (typeof academicYear !== 'string' || !academicYear.trim())) return res.status(400).json({ message: 'academicYear must be a non-empty string.' });
    if (!Array.isArray(slots)) return res.status(400).json({ message: 'slots must be an array.' });
    if (typeof isPublished !== 'boolean') return res.status(400).json({ message: 'isPublished must be true or false.' });

    // --- Validate referenced documents exist ---
    const existingCourse = await Course.findById(course);
    if (!existingCourse) {
      return res.status(404).json({ message: 'Course not found in catalogue' });
    }

    const existingTerm = await findAcademicTerm(term);
    if (!existingTerm) {
      return res.status(404).json({ message: 'Academic term not found' });
    }

    // --- Prevent duplicate offering (same course + same term) ---
    const duplicate = await CourseOffering.findOne({ course, term: existingTerm._id });
    if (duplicate) {
      return res.status(409).json({
        message: `A course offering for ${existingCourse.code} already exists in ${existingTerm.code}`,
      });
    }

    // --- Validate slots ---
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot || typeof slot !== 'object' || Array.isArray(slot) || !slot.componentType || !slot.groupNumber || !slot.day || slot.startMinute == null || slot.endMinute == null || typeof slot.room !== 'string' || !slot.room.trim() || slot.capacity == null) {
        return res.status(400).json({ message: `Slot at index ${i} is missing required fields.` });
      }
      if (!Number.isInteger(slot.startMinute) || !Number.isInteger(slot.endMinute) || slot.endMinute <= slot.startMinute) {
        return res.status(400).json({ message: `Slot at index ${i} must have integer times and end after start.` });
      }
      if (!Number.isInteger(slot.capacity) || slot.capacity < 0) {
        return res.status(400).json({ message: `Slot at index ${i} capacity must be a non-negative integer.` });
      }
    }

    const newOffering = new CourseOffering({
      course,
      academicYear: academicYear?.trim() || existingTerm.academicYear || '2026/2027',
      term: existingTerm._id,
      instructors: instructors || [],
      eligibleGroups: eligibleGroups || [],
      slots: slots || [],
      isPublished,
    });

    for (let i = 0; i < newOffering.slots.length; i += 1) {
      const slot = newOffering.slots[i];
      const conflict = await findOfferingSlotConflict(newOffering, slot);
      if (conflict) return res.status(409).json({ message: `Slot ${slot.componentType} group ${slot.groupNumber}: ${conflict}` });
      for (let j = 0; j < i; j += 1) {
        const internalConflict = conflictMessage(newOffering, slot, newOffering, newOffering.slots[j]);
        if (internalConflict) return res.status(409).json({ message: `Slots in this offering conflict: ${internalConflict}` });
      }
    }

    await newOffering.save();

    // Return the populated offering so the client gets readable data
    const populated = await CourseOffering.findById(newOffering._id)
      .populate('course', 'code name creditHours courseType facultyMajors')
      .populate('term', 'code academicYear season');

    res.status(201).json(populated);
  } catch (error) {
    // Handle Mongoose validation errors with readable messages
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    // Handle duplicate key (race condition on unique index)
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This course offering already exists for the selected term' });
    }
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid course or term ID.' });
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 23: View course offerings for an academic term ───
export const getOfferings = async (req, res) => {
  try {
    const { termId } = req.query;

    if (!termId) {
      return res.status(400).json({ message: 'termId query parameter is required' });
    }

    // Verify the term exists
    const term = await findAcademicTerm(termId);
    if (!term) {
      return res.status(404).json({ message: 'Academic term not found' });
    }

    const offerings = await CourseOffering.find({ term: term._id })
      .populate('course', 'code name creditHours courseType facultyMajors')
      .populate('term', 'code academicYear season');

    res.json({
      term: {
        _id: term._id,
        code: term.code,
        academicYear: term.academicYear,
        season: term.season,
      },
      count: offerings.length,
      offerings,
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid termId.' });
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 23: Select an offering to view all of its details and slots ───
export const getOfferingById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid offering ID format' });
    const offering = await CourseOffering.findById(req.params.id)
      .populate('course')
      .populate('term');

    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    // Build a detailed response with computed remaining capacity per slot
    const offeringObj = offering.toObject({ virtuals: true });

    res.json(offeringObj);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid offering ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 25: Update a course offering or one of its lecture, tutorial or lab slots ───
// Extra comments: Updating a slot must not create a timetable conflict or reduce
// capacity below its assigned-student count.
export const updateOffering = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid offering ID format' });
    const offering = await CourseOffering.findById(req.params.id);
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    const { academicYear, instructors, eligibleGroups, isPublished } = req.body || {};

    if (isPublished !== undefined) {
      return res.status(400).json({ message: 'Change publication state through the dedicated publish endpoint.' });
    }
    if (academicYear !== undefined && (typeof academicYear !== 'string' || !academicYear.trim())) return res.status(400).json({ message: 'academicYear must be a non-empty string.' });
    if (instructors !== undefined && !Array.isArray(instructors)) return res.status(400).json({ message: 'instructors must be an array.' });
    if (eligibleGroups !== undefined && !Array.isArray(eligibleGroups)) return res.status(400).json({ message: 'eligibleGroups must be an array.' });

    // Update top-level offering fields (not slots — slots have their own endpoint)
    if (instructors !== undefined) offering.instructors = instructors;
    if (eligibleGroups !== undefined) offering.eligibleGroups = eligibleGroups;
    if (academicYear !== undefined) offering.academicYear = academicYear.trim();

    for (const slot of offering.slots) {
      const conflict = await findOfferingSlotConflict(offering, slot, slot._id);
      if (conflict) return res.status(409).json({ message: `Offering update would create a timetable conflict: ${conflict}` });
    }

    await offering.save();

    const populated = await CourseOffering.findById(offering._id)
      .populate('course', 'code name creditHours courseType facultyMajors')
      .populate('term', 'code academicYear season');

    res.json(populated);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid offering ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 25: Update a specific slot within a course offering ───
export const updateOfferingSlot = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.slotId)) {
      return res.status(400).json({ message: 'Invalid offering or slot ID format.' });
    }
    const offering = await CourseOffering.findById(req.params.id);
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    const slot = offering.slots.id(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found in this offering' });
    }

    const { componentType, groupNumber, day, startMinute, endMinute, room, capacity } = req.body || {};

    // --- Validate capacity is not reduced below assigned students ---
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 0)) {
      return res.status(400).json({ message: 'Capacity must be a non-negative integer.' });
    }
    if (capacity !== undefined && capacity < slot.assignedStudentCount) {
      return res.status(400).json({
        message: `Cannot reduce capacity to ${capacity}. There are already ${slot.assignedStudentCount} students assigned to this slot`,
      });
    }

    // --- Validate time logic ---
    const newStart = startMinute !== undefined ? startMinute : slot.startMinute;
    const newEnd = endMinute !== undefined ? endMinute : slot.endMinute;
    if (!Number.isInteger(newStart) || !Number.isInteger(newEnd)) {
      return res.status(400).json({ message: 'Slot times must be integer minutes.' });
    }
    if (newEnd <= newStart) {
      return res.status(400).json({ message: 'Slot end time must be after start time' });
    }

    const candidateSlot = {
      ...slot.toObject(),
      componentType: componentType ?? slot.componentType,
      groupNumber: groupNumber ?? slot.groupNumber,
      day: day ?? slot.day,
      startMinute: newStart,
      endMinute: newEnd,
      room: room ?? slot.room,
      capacity: capacity ?? slot.capacity,
    };
    if (typeof candidateSlot.room !== 'string' || !candidateSlot.room.trim()) {
      return res.status(400).json({ message: 'Room is required.' });
    }

    const conflict = await findOfferingSlotConflict(offering, candidateSlot, slot._id);
    if (conflict) return res.status(409).json({ message: `Timetable conflict: ${conflict}` });

    // --- Apply updates ---
    if (componentType !== undefined) slot.componentType = componentType;
    if (groupNumber !== undefined) slot.groupNumber = groupNumber;
    if (day !== undefined) slot.day = day;
    if (startMinute !== undefined) slot.startMinute = startMinute;
    if (endMinute !== undefined) slot.endMinute = endMinute;
    if (room !== undefined) slot.room = room;
    if (capacity !== undefined) slot.capacity = capacity;

    await offering.save();

    const populated = await CourseOffering.findById(offering._id)
      .populate('course', 'code name creditHours courseType facultyMajors')
      .populate('term', 'code academicYear season');

    res.json(populated.toObject({ virtuals: true }));
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 26: Delete a course offering ───
// Extra comments: An offering or slot with assigned students cannot be deleted
// until those assignments are moved or removed.
export const deleteOffering = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid offering ID format' });
    const offering = await CourseOffering.findById(req.params.id)
      .populate('course', 'code');
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    // --- Block deletion if any slot has assigned students ---
    const hasAssigned = offering.slots.some((s) => s.assignedStudentCount > 0);
    if (hasAssigned) {
      return res.status(400).json({
        message: 'Cannot delete this offering because one or more slots have students assigned. Move or remove those assignments first.',
      });
    }

    const references = await hasOfferingReferences(offering._id);
    if (references.template || references.schedule) {
      const usedBy = [references.template && 'a schedule template', references.schedule && 'a student schedule'].filter(Boolean).join(' and ');
      return res.status(409).json({ message: `Cannot delete this offering because it is referenced by ${usedBy}. Remove or update those references first.` });
    }

    await CourseOffering.findByIdAndDelete(req.params.id);

    res.json({ message: `Course offering for ${offering.course.code} deleted successfully` });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid offering ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 26: Delete a specific slot from a course offering ───
export const deleteOfferingSlot = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.slotId)) {
      return res.status(400).json({ message: 'Invalid offering or slot ID format.' });
    }
    const offering = await CourseOffering.findById(req.params.id);
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    const slot = offering.slots.id(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found in this offering' });
    }

    // --- Block deletion if the slot has assigned students ---
    if (slot.assignedStudentCount > 0) {
      return res.status(400).json({
        message: `Cannot delete this slot because ${slot.assignedStudentCount} student(s) are assigned. Move or remove those assignments first.`,
      });
    }

    const references = await hasSlotReferences(offering._id, slot._id);
    if (references.template || references.schedule) {
      const usedBy = [references.template && 'a schedule template', references.schedule && 'a student schedule'].filter(Boolean).join(' and ');
      return res.status(409).json({ message: `Cannot delete this slot because it is referenced by ${usedBy}. Remove or update those references first.` });
    }

    offering.slots.pull(req.params.slotId);
    await offering.save();

    const populated = await CourseOffering.findById(offering._id)
      .populate('course', 'code name creditHours courseType facultyMajors')
      .populate('term', 'code academicYear season');

    res.json(populated.toObject({ virtuals: true }));
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 27: Publish or unpublish course offerings for a term ───
// Extra comments: Only published offerings appear during schedule creation,
// graduation planning or slot-change requests. Unpublishing is blocked when
// it would invalidate an active or processed schedule.
export const togglePublishOffering = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid offering ID format' });
    const offering = await CourseOffering.findById(req.params.id)
      .populate('course', 'code name');
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    const { isPublished } = req.body || {};
    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ message: 'isPublished must be true or false.' });
    }

    // --- Block unpublishing if an active or processed schedule references this offering ---
    if (isPublished === false && offering.isPublished === true) {
      const [activeSchedules, templates] = await Promise.all([
        StudentSchedule.countDocuments({
          $or: [
            { 'courses.courseOffering': offering._id },
            { 'courses.slots.courseOffering': offering._id },
          ],
        }),
        ScheduleTemplate.countDocuments({
          $or: [
            { 'courses.courseOffering': offering._id },
            { 'courses.slots.courseOffering': offering._id },
          ],
        }),
      ]);

      if (activeSchedules > 0 || templates > 0) {
        const reasons = [];
        if (activeSchedules) reasons.push(`${activeSchedules} student schedule(s)`);
        if (templates) reasons.push(`${templates} schedule template(s)`);
        return res.status(409).json({
          message: `Cannot unpublish ${offering.course.code}: it is referenced by ${reasons.join(' and ')}. Update those references first.`,
        });
      }
    }

    offering.isPublished = isPublished;
    await offering.save();

    const populated = await CourseOffering.findById(offering._id)
      .populate('course', 'code name creditHours courseType facultyMajors')
      .populate('term', 'code academicYear season');

    res.json({
      message: `${offering.course.code} is now ${isPublished ? 'published' : 'unpublished'}`,
      offering: populated,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid offering ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};
