import mongoose from "mongoose";
import { StudentProfile } from "../models/identity.js";

export async function requireOwnStudentRecords(req, res, next) {
  if (!["normalStudent", "advisingStudent"].includes(req.user.role)) {
    return res.status(403).json({ message: "Student access required." });
  }
  if (!mongoose.isValidObjectId(req.params.studentId)) {
    return res.status(400).json({ message: "Invalid student profile ID." });
  }
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile || String(profile._id) !== req.params.studentId) {
      return res.status(403).json({ message: "You can only access your own student records." });
    }
    next();
  } catch (error) {
    next(error);
  }
}
