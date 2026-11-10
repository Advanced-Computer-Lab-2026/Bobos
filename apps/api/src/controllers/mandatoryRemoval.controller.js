import mongoose from "mongoose";
import { MandatoryCourseRemovalRequest } from "../models/requests.js";
import { StudentProfile, User } from "../models/identity.js";
import { Course, CourseOffering, AcademicTerm } from "../models/catalogue.js";
import { StudentSchedule } from "../models/academics.js";

const VALID_REASONS = [
  "incorrectMandatoryDesignation",
  "makeupEligibility",
  "completedHours",
  "restrictedCoursePair",
  "other",
];

const idOf = (value) => (value == null ? null : String(value._id || value));

export async function createMandatoryRemovalRequest(req, res) {
  try {
    const { studentProfileId, courseId, termId, reason, explanation } = req.body || {};

    if (!studentProfileId || !mongoose.isValidObjectId(studentProfileId)) {
      return res.status(400).json({ message: "A valid studentProfileId is required." });
    }
    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: "A valid courseId is required." });
    }
    if (!termId || (!mongoose.isValidObjectId(termId) && typeof termId !== "string")) {
      return res.status(400).json({ message: "A valid termId is required." });
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({
        message: `reason must be one of: ${VALID_REASONS.join(", ")}`,
      });
    }
    if (typeof explanation !== "string" || !explanation.trim()) {
      return res.status(400).json({ message: "An explanation is required." });
    }
    if (explanation.trim().length > 2000) {
      return res.status(400).json({ message: "Explanation cannot exceed 2000 characters." });
    }

    const student = await StudentProfile.findById(studentProfileId).select(
      "_id studentType assignedAdvisor studentId user"
    );
    if (!student || student.studentType !== "advising") {
      return res.status(404).json({ message: "Advising student profile not found." });
    }

    if (req.user.role === "advisor" && idOf(student.assignedAdvisor) !== idOf(req.user._id)) {
      return res.status(403).json({
        message: "Advisors may only submit removal requests for their assigned students.",
      });
    }

    const course = await Course.findById(courseId).select("_id code name creditHours");
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const term = mongoose.isValidObjectId(termId)
      ? await AcademicTerm.findById(termId)
      : await AcademicTerm.findOne({ code: String(termId).trim() });
    if (!term) {
      return res.status(404).json({ message: "Academic term not found." });
    }

    const existingPending = await MandatoryCourseRemovalRequest.findOne({
      student: student._id,
      course: course._id,
      term: term._id,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({
        message: "A pending removal request for this course already exists for this student and term.",
      });
    }

    const created = await MandatoryCourseRemovalRequest.create({
      student: student._id,
      course: course._id,
      advisor: req.user._id,
      term: term._id,
      reason,
      explanation: explanation.trim(),
      status: "pending",
    });

    const populated = await MandatoryCourseRemovalRequest.findById(created._id)
      .populate({
        path: "student",
        populate: { path: "user", select: "fullName email" },
      })
      .populate("course", "code name creditHours")
      .populate("advisor", "fullName email")
      .populate("term", "code academicYear season");

    return res.status(201).json(populated);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function listMandatoryRemovalRequests(req, res) {
  try {
    const { search, advisor, status, dateFrom, dateTo } = req.query || {};

    const filter = {};

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    if (advisor && mongoose.isValidObjectId(advisor)) {
      filter.advisor = advisor;
    }

    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        if (!isNaN(fromDate.getTime())) {
          filter.createdAt.$gte = fromDate;
        }
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        if (!isNaN(toDate.getTime())) {
          if (typeof dateTo === "string" && dateTo.length === 10) {
            toDate.setHours(23, 59, 59, 999);
          }
          filter.createdAt.$lte = toDate;
        }
      }
    }

    if (search && typeof search === "string" && search.trim()) {
      const termRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

      const [matchingCourses, matchingAdvisors, matchingStudentUsers] = await Promise.all([
        Course.find({ code: termRegex }).select("_id"),
        User.find({
          role: { $in: ["advisor", "coordinator"] },
          $or: [{ fullName: termRegex }, { email: termRegex }],
        }).select("_id"),
        User.find({
          $or: [{ fullName: termRegex }, { email: termRegex }],
        }).select("_id"),
      ]);

      const courseIds = matchingCourses.map((c) => c._id);
      const advisorIds = matchingAdvisors.map((u) => u._id);
      const studentUserIds = matchingStudentUsers.map((u) => u._id);

      const matchingProfiles = await StudentProfile.find({
        $or: [
          { studentId: termRegex },
          { user: { $in: studentUserIds } },
        ],
      }).select("_id");
      const profileIds = matchingProfiles.map((p) => p._id);

      filter.$or = [
        { course: { $in: courseIds } },
        { advisor: { $in: advisorIds } },
        { student: { $in: profileIds } },
      ];
    }

    const requests = await MandatoryCourseRemovalRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate({
        path: "student",
        populate: { path: "user", select: "fullName email" },
      })
      .populate("course", "code name creditHours")
      .populate("advisor", "fullName email")
      .populate("term", "code academicYear season")
      .populate("decidedBy", "fullName email");

    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function getMandatoryRemovalRequestById(req, res) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid removal request ID." });
    }

    const request = await MandatoryCourseRemovalRequest.findById(id)
      .populate({
        path: "student",
        populate: { path: "user", select: "fullName email" },
      })
      .populate("course", "code name creditHours")
      .populate("advisor", "fullName email")
      .populate("term", "code academicYear season")
      .populate("decidedBy", "fullName email");

    if (!request) {
      return res.status(404).json({ message: "Mandatory course removal request not found." });
    }

    return res.json(request);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function decideMandatoryRemovalRequest(req, res) {
  try {
    const { id } = req.params;
    const { decision, responseNote } = req.body || {};

    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid removal request ID." });
    }
    if (!decision || !["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision must be either 'approved' or 'rejected'." });
    }
    if (typeof responseNote !== "string" || !responseNote.trim()) {
      return res.status(400).json({ message: "responseNote is mandatory." });
    }
    if (responseNote.trim().length > 1000) {
      return res.status(400).json({ message: "responseNote cannot exceed 1000 characters." });
    }

    const request = await MandatoryCourseRemovalRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Mandatory course removal request not found." });
    }
    if (request.status !== "pending") {
      return res.status(409).json({
        message: `This request has already been decided (${request.status}).`,
      });
    }

    request.status = decision;
    request.responseNote = responseNote.trim();
    request.decidedBy = req.user._id;
    request.decidedAt = new Date();
    await request.save();

    if (decision === "approved") {
      const draftSchedule = await StudentSchedule.findOne({
        student: request.student,
        term: request.term,
        status: "draft",
      });

      if (draftSchedule) {
        const courseToRemove = draftSchedule.courses.find(
          (c) => String(c.course) === String(request.course)
        );

        if (courseToRemove) {
          if (draftSchedule.seatsReserved && courseToRemove.slots?.length) {
            for (const slot of courseToRemove.slots) {
              const offeringId = slot.courseOffering;
              const slotId = slot.slotGroupId;
              if (offeringId && slotId) {
                await CourseOffering.updateOne(
                  { _id: offeringId, "slots._id": slotId },
                  { $inc: { "slots.$.assignedStudentCount": -1 } }
                );
              }
            }
          }

          draftSchedule.courses = draftSchedule.courses.filter(
            (c) => String(c.course) !== String(request.course)
          );
          await draftSchedule.save();
        }
      }
    }

    const updated = await MandatoryCourseRemovalRequest.findById(request._id)
      .populate({
        path: "student",
        populate: { path: "user", select: "fullName email" },
      })
      .populate("course", "code name creditHours")
      .populate("advisor", "fullName email")
      .populate("term", "code academicYear season")
      .populate("decidedBy", "fullName email");

    return res.json({ message: `Request ${decision}.`, request: updated });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
