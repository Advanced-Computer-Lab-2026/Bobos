import { ScheduleTemplate } from '../models/academics.js';
import { CourseOffering, AcademicTerm } from '../models/catalogue.js';

// ─── Req 28: Create a standard schedule template for normal students ───
// by major, semester and study group
export const createScheduleTemplate = async (req, res) => {
  try {
    const { term, major, semester, studyGroup, courses, isPublished } = req.body;

    // --- Validate the term exists ---
    const existingTerm = await AcademicTerm.findById(term);
    if (!existingTerm) {
      return res.status(404).json({ message: 'Academic term not found' });
    }

    // --- Prevent duplicate template (same term + major + semester + studyGroup) ---
    const duplicate = await ScheduleTemplate.findOne({ term, major, semester, studyGroup });
    if (duplicate) {
      return res.status(409).json({
        message: `A schedule template for ${major} semester ${semester} group ${studyGroup} already exists in ${existingTerm.code}`,
      });
    }

    // --- Validate course offerings exist and are published ---
    if (courses && Array.isArray(courses)) {
      for (let i = 0; i < courses.length; i++) {
        const entry = courses[i];
        if (!entry.course || !entry.courseOffering) {
          return res.status(400).json({
            message: `Course entry at index ${i} is missing required fields (course, courseOffering)`,
          });
        }

        const offering = await CourseOffering.findById(entry.courseOffering);
        if (!offering) {
          return res.status(404).json({
            message: `Course offering at index ${i} (${entry.courseOffering}) not found`,
          });
        }
        if (!offering.isPublished) {
          return res.status(400).json({
            message: `Course offering at index ${i} (${entry.courseOffering}) is not published. Only published offerings can be used in schedule templates.`,
          });
        }

        // Validate that slot IDs in the entry actually exist in the offering
        if (entry.slots && Array.isArray(entry.slots)) {
          for (let j = 0; j < entry.slots.length; j++) {
            const slotRef = entry.slots[j];
            const matchingSlot = offering.slots.id(slotRef.slotGroupId);
            if (!matchingSlot) {
              return res.status(400).json({
                message: `Slot at courses[${i}].slots[${j}] references slotGroupId ${slotRef.slotGroupId} which does not exist in the offering`,
              });
            }
          }
        }
      }
    }

    const template = new ScheduleTemplate({
      term,
      major,
      semester,
      studyGroup,
      courses: courses || [],
      isPublished: isPublished || false,
    });

    await template.save();

    const populated = await ScheduleTemplate.findById(template._id)
      .populate('term', 'code academicYear season')
      .populate('courses.course', 'code name creditHours')
      .populate('courses.courseOffering', 'isPublished');

    res.status(201).json(populated);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A schedule template for this major, semester and study group already exists in this term' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Req 29: Update a standard schedule template for normal students ───
// by major, semester and study group
export const updateScheduleTemplate = async (req, res) => {
  try {
    const template = await ScheduleTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Schedule template not found' });
    }

    const { major, semester, studyGroup, courses, isPublished } = req.body;

    // --- Validate updated course offerings exist and are published ---
    if (courses && Array.isArray(courses)) {
      for (let i = 0; i < courses.length; i++) {
        const entry = courses[i];
        if (!entry.course || !entry.courseOffering) {
          return res.status(400).json({
            message: `Course entry at index ${i} is missing required fields (course, courseOffering)`,
          });
        }

        const offering = await CourseOffering.findById(entry.courseOffering);
        if (!offering) {
          return res.status(404).json({
            message: `Course offering at index ${i} (${entry.courseOffering}) not found`,
          });
        }
        if (!offering.isPublished) {
          return res.status(400).json({
            message: `Course offering at index ${i} (${entry.courseOffering}) is not published. Only published offerings can be used in schedule templates.`,
          });
        }

        // Validate slot IDs exist in the offering
        if (entry.slots && Array.isArray(entry.slots)) {
          for (let j = 0; j < entry.slots.length; j++) {
            const slotRef = entry.slots[j];
            const matchingSlot = offering.slots.id(slotRef.slotGroupId);
            if (!matchingSlot) {
              return res.status(400).json({
                message: `Slot at courses[${i}].slots[${j}] references slotGroupId ${slotRef.slotGroupId} which does not exist in the offering`,
              });
            }
          }
        }
      }
    }

    // --- Apply updates ---
    if (major !== undefined) template.major = major;
    if (semester !== undefined) template.semester = semester;
    if (studyGroup !== undefined) template.studyGroup = studyGroup;
    if (courses !== undefined) template.courses = courses;
    if (isPublished !== undefined) template.isPublished = isPublished;

    await template.save();

    const populated = await ScheduleTemplate.findById(template._id)
      .populate('term', 'code academicYear season')
      .populate('courses.course', 'code name creditHours')
      .populate('courses.courseOffering', 'isPublished');

    res.json(populated);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A schedule template with this major, semester and study group already exists in this term' });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── Helper: View schedule templates (useful for testing 28 & 29) ───
export const getScheduleTemplates = async (req, res) => {
  try {
    const { termId } = req.query;
    const filter = termId ? { term: termId } : {};

    const templates = await ScheduleTemplate.find(filter)
      .populate('term', 'code academicYear season')
      .populate('courses.course', 'code name creditHours')
      .populate('courses.courseOffering', 'isPublished');

    res.json({ count: templates.length, templates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getScheduleTemplateById = async (req, res) => {
  try {
    const template = await ScheduleTemplate.findById(req.params.id)
      .populate('term', 'code academicYear season')
      .populate('courses.course', 'code name creditHours courseType')
      .populate('courses.courseOffering');

    if (!template) {
      return res.status(404).json({ message: 'Schedule template not found' });
    }

    res.json(template);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid template ID format' });
    }
    res.status(500).json({ message: error.message });
  }
};
