import { CourseOffering, Course, AcademicTerm } from '../models/catalogue.js';

export const createCourse = async (req, res) => {
  try {
    const { code, name, creditHours } = req.body;
    const newCourse = new Course({ code, name, creditHours });
    await newCourse.save();
    res.status(201).json(newCourse);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getCourses = async (req, res) => {
}

export const updateCourse = async (req, res) => {
}

export const deleteCourse = async (req, res) => {
}

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
