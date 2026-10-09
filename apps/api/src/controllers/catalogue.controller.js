import mongoose from 'mongoose';
import { CourseOffering, Course, AcademicTerm } from '../models/catalogue.js';
import { ACADEMIC_SEASONS } from '../models/shared.js';
import { StudentSchedule } from '../models/academics.js';

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
    const { course, term, instructors, eligibleGroups, slots, isPublished } = req.body;

    // --- Validate referenced documents exist ---
    const existingCourse = await Course.findById(course);
    if (!existingCourse) {
      return res.status(404).json({ message: 'Course not found in catalogue' });
    }

    const existingTerm = await AcademicTerm.findById(term);
    if (!existingTerm) {
      return res.status(404).json({ message: 'Academic term not found' });
    }

    // --- Prevent duplicate offering (same course + same term) ---
    const duplicate = await CourseOffering.findOne({ course, term });
    if (duplicate) {
      return res.status(409).json({
        message: `A course offering for ${existingCourse.code} already exists in ${existingTerm.code}`,
      });
    }

    // --- Validate slots ---
    if (slots && Array.isArray(slots)) {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s.componentType || !s.groupNumber || !s.day || s.startMinute == null || s.endMinute == null || !s.room || s.capacity == null) {
          return res.status(400).json({
            message: `Slot at index ${i} is missing required fields (componentType, groupNumber, day, startMinute, endMinute, room, capacity)`,
          });
        }
        if (s.endMinute <= s.startMinute) {
          return res.status(400).json({
            message: `Slot at index ${i}: end time must be after start time`,
          });
        }
        if (s.capacity < 0) {
          return res.status(400).json({
            message: `Slot at index ${i}: capacity cannot be negative`,
          });
        }
      }
    }

    const newOffering = new CourseOffering({
      course,
      academicYear: existingTerm.academicYear,
      term,
      instructors: instructors || [],
      eligibleGroups: eligibleGroups || [],
      slots: slots || [],
      isPublished: isPublished || false,
    });

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
    const term = await AcademicTerm.findById(termId);
    if (!term) {
      return res.status(404).json({ message: 'Academic term not found' });
    }

    const offerings = await CourseOffering.find({ term: termId })
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
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 23: Select an offering to view all of its details and slots ───
export const getOfferingById = async (req, res) => {
  try {
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
    const offering = await CourseOffering.findById(req.params.id);
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    const { instructors, eligibleGroups, isPublished } = req.body;

    // Update top-level offering fields (not slots — slots have their own endpoint)
    if (instructors !== undefined) offering.instructors = instructors;
    if (eligibleGroups !== undefined) offering.eligibleGroups = eligibleGroups;
    if (isPublished !== undefined) offering.isPublished = isPublished;

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
    const offering = await CourseOffering.findById(req.params.id);
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    const slot = offering.slots.id(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found in this offering' });
    }

    const { componentType, groupNumber, day, startMinute, endMinute, room, capacity } = req.body;

    // --- Validate capacity is not reduced below assigned students ---
    if (capacity !== undefined && capacity < slot.assignedStudentCount) {
      return res.status(400).json({
        message: `Cannot reduce capacity to ${capacity}. There are already ${slot.assignedStudentCount} students assigned to this slot`,
      });
    }

    // --- Validate time logic ---
    const newStart = startMinute !== undefined ? startMinute : slot.startMinute;
    const newEnd = endMinute !== undefined ? endMinute : slot.endMinute;
    if (newEnd <= newStart) {
      return res.status(400).json({ message: 'Slot end time must be after start time' });
    }

    const newDay = day !== undefined ? day : slot.day;
    const newRoom = room !== undefined ? room : slot.room;

    // --- Check for timetable conflicts (same room, same day, overlapping time) ---
    // Get all offerings in the same term to check for room conflicts
    const termOfferings = await CourseOffering.find({ term: offering.term });

    for (const otherOffering of termOfferings) {
      for (const otherSlot of otherOffering.slots) {
        // Skip the slot we are currently updating
        if (otherSlot._id.toString() === req.params.slotId) continue;

        // Check if same room + same day + overlapping time
        if (
          otherSlot.room === newRoom &&
          otherSlot.day === newDay &&
          newStart < otherSlot.endMinute &&
          newEnd > otherSlot.startMinute
        ) {
          return res.status(409).json({
            message: `Timetable conflict: room ${newRoom} on ${newDay} is already booked from ${otherSlot.startMinute} to ${otherSlot.endMinute} (${otherOffering._id}, slot ${otherSlot._id})`,
          });
        }
      }
    }

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
    const offering = await CourseOffering.findById(req.params.id)
      .populate('course', 'code name');
    if (!offering) {
      return res.status(404).json({ message: 'Course offering not found' });
    }

    const { isPublished } = req.body;
    if (isPublished === undefined) {
      return res.status(400).json({ message: 'isPublished field is required (true or false)' });
    }

    // --- Block unpublishing if an active or processed schedule references this offering ---
    if (isPublished === false && offering.isPublished === true) {
      const activeSchedules = await StudentSchedule.countDocuments({
        'courses.courseOffering': offering._id,
        status: { $in: ['draft', 'readyForStudentReview', 'processed'] },
      });

      if (activeSchedules > 0) {
        return res.status(400).json({
          message: `Cannot unpublish ${offering.course.code}: ${activeSchedules} active or processed schedule(s) reference this offering. Remove those assignments first.`,
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
