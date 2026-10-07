import mongoose from 'mongoose';
import { AcademicTerm } from '../models/catalogue.js';

const termFields = [
  'code', 'academicYear', 'season', 'termStart', 'termEnd',
  'teachingStart', 'teachingEnd', 'registrationStart', 'registrationEnd',
  'advisingDeadline', 'wholeScheduleSwapDeadline',
   'isActive',
];

export const  createAcademicTerm = async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Request body must be a JSON object' });
    }

    const unknown = Object.keys(req.body).filter(field => !termFields.includes(field));
    if (unknown.length) return res.status(400).json({ message: `Unknown field(s): ${unknown.join(', ')}` });

    const term = await AcademicTerm.create(req.body);
    res.status(201).json(term);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An academic term with this code or year and season already exists' });
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

export const updateAcademicTerm = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid academic term ID' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ message: 'Request body must be a JSON object' });
    }

    const unknown = Object.keys(req.body).filter(field => !termFields.includes(field));
    if (unknown.length) return res.status(400).json({ message: `Unknown field(s): ${unknown.join(', ')}` });
    if (!Object.keys(req.body).length) return res.status(400).json({ message: 'Provide at least one field to update' });

    const term = await AcademicTerm.findById(id);
    if (!term) return res.status(404).json({ message: 'Academic term not found' });

    Object.assign(term, req.body);
    await term.save();
    res.json(term);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An academic term with this code or year and season already exists' });
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  
  }
};
