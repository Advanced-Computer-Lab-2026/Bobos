import mongoose from 'mongoose';
import { CourseOffering, Course, AcademicTerm } from '../models/catalogue.js';
import { ACADEMIC_SEASONS } from '../models/shared.js';

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

export const createOffering = async (req, res) => {
  try {
    const { course, term, instructors, eligibleGroups, slots, isPublished } = req.body;
    
    // Check if course and term exist (basic validation)
    const existingCourse = await Course.findById(course);
    if (!existingCourse) return res.status(404).json({ message: 'Course not found' });
    
    const existingTerm = await AcademicTerm.findById(term);
    if (!existingTerm) return res.status(404).json({ message: 'Academic Term not found' });

    const newOffering = new CourseOffering({
      course,
      term,
      instructors,
      eligibleGroups,
      slots,
      isPublished
    });

    await newOffering.save();
    res.status(201).json(newOffering);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getOfferings = async (req, res) => {
  try {
    const { termId } = req.query;
    const filter = termId ? { term: termId } : {};
    
    const offerings = await CourseOffering.find(filter)
      .populate('course', 'code name creditHours')
      .populate('term', 'code academicYear season');
      
    res.json(offerings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOfferingById = async (req, res) => {
  try {
    const offering = await CourseOffering.findById(req.params.id)
      .populate('course')
      .populate('term');
      
    if (!offering) return res.status(404).json({ message: 'Course Offering not found' });
    
    res.json(offering);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
