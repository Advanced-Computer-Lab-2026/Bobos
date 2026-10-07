import mongoose from "mongoose";
import { StudentProfile } from "../models/identity.js";

export function studentRecordAccess(roles) {
  return async (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Your role cannot access these records." });
    }
    if (!mongoose.isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ message: "Invalid student profile ID." });
    }
    try {
      const profile = await StudentProfile.findById(req.params.studentId);
      if (!profile) return res.status(404).json({ message: "Student profile not found." });
      if (profile.studentType !== "advising") {
        return res.status(403).json({ message: "These records are available for advising students only." });
      }
      if (req.user.role === "advisingStudent" && !profile.user.equals(req.user._id)) {
        return res.status(403).json({ message: "You can only access your own student records." });
      }
      req.studentProfile = profile;
      next();
    } catch (error) {
      next(error);
    }
  };
}
