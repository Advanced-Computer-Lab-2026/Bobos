import mongoose from 'mongoose';
import { ScheduleTemplate } from '../models/academics.js';
import { CourseOffering, AcademicTerm, Course } from '../models/catalogue.js';

const isId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value);
const idOf = (value) => String(value?._id || value || '');

async function findAcademicTerm(identifier) {
  if (typeof identifier !== 'string' || !identifier.trim()) return null;
  const value = identifier.trim();
  return isId(value) ? AcademicTerm.findById(value) : AcademicTerm.findOne({ code: value });
}

function eligibleForTemplate(offering, major, semester, studyGroup) {
  return (offering.eligibleGroups || []).some((group) =>
    group.major === major &&
    (group.semester == null || Number(group.semester) === Number(semester)) &&
    (!group.studyGroup || String(group.studyGroup) === String(studyGroup))
  );
}

async function validateTemplateCourses(courses, { term, major, semester, studyGroup }) {
  if (!Array.isArray(courses) || courses.length === 0) {
    return { error: 'Add at least one course to the schedule template.' };
  }

  const seenCourses = new Set();
  const normalized = [];

  for (let i = 0; i < courses.length; i += 1) {
    const entry = courses[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !isId(idOf(entry.course)) || !isId(idOf(entry.courseOffering))) {
      return { error: `Course entry ${i + 1} must include valid course and course offering IDs.` };
    }

    const courseId = idOf(entry.course);
    const offeringId = idOf(entry.courseOffering);
    if (seenCourses.has(courseId)) return { error: `Course ${courseId} is included more than once.` };
    seenCourses.add(courseId);

    const [course, offering] = await Promise.all([
      Course.findById(courseId),
      CourseOffering.findById(offeringId),
    ]);
    if (!course) return { error: `Course at entry ${i + 1} was not found.`, status: 404 };
    if (!offering) return { error: `Course offering at entry ${i + 1} was not found.`, status: 404 };
    if (idOf(offering.course) !== courseId) {
      return { error: `The offering at entry ${i + 1} belongs to a different course.` };
    }
    if (idOf(offering.term) !== idOf(term)) {
      return { error: `The offering for ${course.code} belongs to a different academic term.` };
    }
    if (!offering.isPublished) {
      return { error: `The offering for ${course.code} is not published. Only published offerings can be used in a template.` };
    }
    if (!eligibleForTemplate(offering, major, semester, studyGroup)) {
      return { error: `${course.code} is not eligible for ${major}, semester ${semester}, group ${studyGroup}.` };
    }

    const slotRefs = entry.slots;
    if (!Array.isArray(slotRefs) || slotRefs.length === 0) {
      return { error: `Select at least one slot for ${course.code}.` };
    }

    const availableComponents = new Set(offering.slots.map((slot) => slot.componentType));
    const selectedComponents = new Set();
    const seenSlotIds = new Set();
    const normalizedSlots = [];

    for (let j = 0; j < slotRefs.length; j += 1) {
      const slotRef = slotRefs[j];
      const slotId = idOf(slotRef?.slotGroupId);
      if (!isId(slotId)) return { error: `Select a valid slot for ${course.code}.` };
      if (slotRef.courseOffering && idOf(slotRef.courseOffering) !== offeringId) {
        return { error: `A selected slot for ${course.code} references a different offering.` };
      }
      if (seenSlotIds.has(slotId)) return { error: `A slot for ${course.code} is selected more than once.` };

      const slot = offering.slots.id(slotId);
      if (!slot || slot.componentType !== slotRef.componentType) {
        return { error: `The selected ${slotRef.componentType || ''} slot for ${course.code} does not match this offering.` };
      }
      if (selectedComponents.has(slot.componentType)) {
        return { error: `Choose only one ${slot.componentType} group for ${course.code}.` };
      }

      seenSlotIds.add(slotId);
      selectedComponents.add(slot.componentType);
      normalizedSlots.push({
        componentType: slot.componentType,
        courseOffering: offering._id,
        slotGroupId: slot._id,
      });
    }

    for (const component of availableComponents) {
      if (!selectedComponents.has(component)) {
        return { error: `Choose one ${component} group for ${course.code}.` };
      }
    }

    normalized.push({ course: course._id, courseOffering: offering._id, slots: normalizedSlots });
  }

  return { courses: normalized };
}

function validateTemplateIdentity({ major, semester, studyGroup, isPublished }) {
  if (typeof major !== 'string' || !major.trim()) return 'major is required.';
  if (!Number.isInteger(Number(semester)) || Number(semester) < 1 || Number(semester) > 10) return 'semester must be an integer from 1 to 10.';
  if (typeof studyGroup !== 'string' || !studyGroup.trim()) return 'studyGroup is required.';
  if (isPublished !== undefined && typeof isPublished !== 'boolean') return 'isPublished must be true or false.';
  return null;
}

function handleError(res, error) {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validation failed', errors: Object.values(error.errors).map((item) => item.message) });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'A schedule template for this major, semester and study group already exists in this term.' });
  }
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid ID format.' });
  return res.status(500).json({ message: error.message });
}

async function populatedTemplate(id) {
  return ScheduleTemplate.findById(id)
    .populate('term', 'code academicYear season')
    .populate('courses.course', 'code name creditHours')
    .populate('courses.courseOffering', 'isPublished slots');
}

// Req 28: create a standard schedule template by term, major, semester and group.
export const createScheduleTemplate = async (req, res) => {
  try {
    const { term, major, semester, studyGroup, courses, isPublished = false } = req.body || {};
    const identityError = validateTemplateIdentity({ major, semester, studyGroup, isPublished });
    if (identityError) return res.status(400).json({ message: identityError });
    if (typeof term !== 'string' || !term.trim()) return res.status(400).json({ message: 'An academic term code or ID is required.' });

    const existingTerm = await findAcademicTerm(term);
    if (!existingTerm) return res.status(404).json({ message: 'Academic term not found.' });
    const termId = existingTerm._id;

    const normalizedMajor = major.trim();
    const normalizedGroup = studyGroup.trim();
    const duplicate = await ScheduleTemplate.exists({ term: termId, major: normalizedMajor, semester: Number(semester), studyGroup: normalizedGroup });
    if (duplicate) {
      return res.status(409).json({ message: `A schedule template for ${normalizedMajor} semester ${semester} group ${normalizedGroup} already exists in ${existingTerm.code}.` });
    }

    const checked = await validateTemplateCourses(courses, { term: termId, major: normalizedMajor, semester: Number(semester), studyGroup: normalizedGroup });
    if (checked.error) return res.status(checked.status || 400).json({ message: checked.error });

    const template = await ScheduleTemplate.create({
      term: termId,
      major: normalizedMajor,
      semester: Number(semester),
      studyGroup: normalizedGroup,
      courses: checked.courses,
      isPublished,
    });
    res.status(201).json(await populatedTemplate(template._id));
  } catch (error) {
    return handleError(res, error);
  }
};

// Req 29: update template identity, selected courses/slots, or publication state.
export const updateScheduleTemplate = async (req, res) => {
  try {
    const template = await ScheduleTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Schedule template not found.' });

    const { major, semester, studyGroup, courses, isPublished } = req.body || {};
    const next = {
      major: major === undefined ? template.major : major,
      semester: semester === undefined ? template.semester : semester,
      studyGroup: studyGroup === undefined ? template.studyGroup : studyGroup,
      isPublished: isPublished === undefined ? template.isPublished : isPublished,
    };
    const identityError = validateTemplateIdentity(next);
    if (identityError) return res.status(400).json({ message: identityError });

    const normalizedMajor = next.major.trim();
    const normalizedGroup = next.studyGroup.trim();
    const checked = await validateTemplateCourses(courses === undefined ? template.courses : courses, {
      term: template.term,
      major: normalizedMajor,
      semester: Number(next.semester),
      studyGroup: normalizedGroup,
    });
    if (checked.error) return res.status(checked.status || 400).json({ message: checked.error });

    template.major = normalizedMajor;
    template.semester = Number(next.semester);
    template.studyGroup = normalizedGroup;
    template.courses = checked.courses;
    template.isPublished = next.isPublished;
    await template.save();

    res.json(await populatedTemplate(template._id));
  } catch (error) {
    return handleError(res, error);
  }
};

export const getScheduleTemplates = async (req, res) => {
  try {
    const { termId } = req.query;
    const term = termId ? await findAcademicTerm(termId) : null;
    if (termId && !term) return res.status(404).json({ message: 'Academic term not found.' });
    const templates = await ScheduleTemplate.find(term ? { term: term._id } : {})
      .populate('term', 'code academicYear season')
      .populate('courses.course', 'code name creditHours')
      .populate('courses.courseOffering', 'isPublished slots');
    res.json({ count: templates.length, templates });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getScheduleTemplateById = async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid template ID format.' });
    const template = await ScheduleTemplate.findById(req.params.id)
      .populate('term', 'code academicYear season')
      .populate('courses.course', 'code name creditHours courseType')
      .populate('courses.courseOffering');
    if (!template) return res.status(404).json({ message: 'Schedule template not found.' });
    res.json(template);
  } catch (error) {
    return handleError(res, error);
  }
};
