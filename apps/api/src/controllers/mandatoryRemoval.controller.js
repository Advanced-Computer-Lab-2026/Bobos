import mongoose from "mongoose";
import { MandatoryCourseRemovalRequest } from "../models/requests.js";
import { StudentProfile, User } from "../models/identity.js";
import { Course, CourseOffering, AcademicTerm } from "../models/catalogue.js";
import { StudentSchedule, CourseAttempt } from "../models/academics.js";
import { majorMatches } from "../utils/major.js";

const VALID_REASONS = [
  "incorrectMandatoryDesignation",
  "makeupEligibility",
  "completedHours",
  "restrictedCoursePair",
  "other",
];

const idOf = (value) => (value == null ? null : String(value._id || value));

async function validateRemovalReasonEligibility(student, course, term, reason) {
  if (reason === "completedHours") {
    const passedAttempts = await CourseAttempt.find({ student: student._id, result: "passed" })
      .populate("course", "creditHours")
      .lean();
    const completedHours = [
      ...new Map(
        passedAttempts
          .filter((attempt) => attempt.course)
          .map((attempt) => [String(attempt.course._id), Number(attempt.course.creditHours) || 0])
      ).values(),
    ].reduce((sum, hours) => sum + hours, 0);

    if (completedHours <= 157) {
      return "Removal request ineligible for the specified reason: student must have more than 157 completed credit hours.";
    }
    return null;
  }

  if (reason === "makeupEligibility") {
    const attendedFailure = await CourseAttempt.exists({
      student: student._id,
      course: course._id,
      attendance: "attended",
      result: "failed",
    });
    if (!attendedFailure) {
      return "Removal request ineligible for the specified reason: makeup eligibility requires an attended failed course attempt.";
    }
    return null;
  }

  if (reason === "restrictedCoursePair") {
    const passedIds = (
      await CourseAttempt.distinct("course", { student: student._id, result: "passed" })
    ).map((courseId) => String(courseId));
    const passedSet = new Set(passedIds);
    const hasUnmetPrereq = (course.prerequisites || []).some(
      (prereqId) => !passedSet.has(String(prereqId))
    );

    let hasDependentConflict = false;
    if (!hasUnmetPrereq) {
      const [otherFailedIds, draftSchedule] = await Promise.all([
        CourseAttempt.distinct("course", {
          student: student._id,
          course: { $ne: course._id },
          $or: [{ result: "failed" }, { attendance: "unattended" }],
        }),
        StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: "advising" })
          .select("courses.course")
          .lean(),
      ]);
      const relatedCourseIds = [
        ...new Set([
          ...otherFailedIds.map((courseId) => String(courseId)),
          ...(draftSchedule?.courses || [])
            .map((entry) => String(entry.course))
            .filter((courseId) => courseId !== String(course._id)),
        ]),
      ];
      if (relatedCourseIds.length > 0) {
        hasDependentConflict = Boolean(
          await Course.exists({
            _id: { $in: relatedCourseIds },
            prerequisites: course._id,
          })
        );
      }
    }

    if (!hasUnmetPrereq && !hasDependentConflict) {
      return "Removal request ineligible for the specified reason: no prerequisite or restricted course pair conflict exists in the student's academic history.";
    }
    return null;
  }

  if (reason === "incorrectMandatoryDesignation") {
    const alreadyPassed = await CourseAttempt.exists({
      student: student._id,
      course: course._id,
      result: "passed",
    });
    const majorMismatch =
      Array.isArray(course.facultyMajors) &&
      course.facultyMajors.length > 0 &&
      !course.facultyMajors.some((major) => majorMatches(major, student.major));
    const isElective = course.courseType === "elective";
    const advisingReasonExempt = ["transfer", "undeclaredMajor"].includes(student.advisingReason);

    if (!alreadyPassed && !majorMismatch && !isElective && !advisingReasonExempt) {
      return "Removal request ineligible for the specified reason: course is a valid mandatory core requirement for the student's major.";
    }
    return null;
  }

  return null;
}

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
      "_id studentType assignedAdvisor studentId user major currentSemester gpa academicStanding advisingReason"
    );
    if (!student || student.studentType !== "advising") {
      return res.status(404).json({ message: "Advising student profile not found." });
    }

    if (req.user.role === "advisor" && idOf(student.assignedAdvisor) !== idOf(req.user._id)) {
      return res.status(403).json({
        message: "Advisors may only submit removal requests for their assigned students.",
      });
    }

    const course = await Course.findById(courseId).select(
      "_id code name creditHours courseType facultyMajors prerequisites recommendedSemester"
    );
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

    const failedOrUnattended = await CourseAttempt.findOne({
      student: student._id,
      course: course._id,
      $or: [{ result: "failed" }, { attendance: "unattended" }],
    });
    if (!failedOrUnattended) {
      return res.status(400).json({
        message: "Course is not in the student's failed or unattended history.",
      });
    }

    const eligibilityError = await validateRemovalReasonEligibility(student, course, term, reason);
    if (eligibilityError) {
      return res.status(400).json({ message: eligibilityError });
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
            toDate.setUTCHours(23, 59, 59, 999);
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

    const request = await MandatoryCourseRemovalRequest.findOneAndUpdate(
      { _id: id, status: "pending" },
      {
        $set: {
          status: decision,
          responseNote: responseNote.trim(),
          decidedBy: req.user._id,
          decidedAt: new Date(),
        },
      },
      { returnDocument: "after", runValidators: true }
    );
    if (!request) {
      const existing = await MandatoryCourseRemovalRequest.findById(id).select("status").lean();
      if (!existing) {
        return res.status(404).json({ message: "Mandatory course removal request not found." });
      }
      return res.status(409).json({
        message: `This request has already been decided (${existing.status}).`,
      });
    }

    if (decision === "approved") {
      const draftSchedule = await StudentSchedule.findOneAndUpdate(
        {
          student: request.student,
          term: request.term,
          status: "draft",
          "courses.course": request.course,
        },
        {
          $pull: { courses: { course: request.course } },
          $inc: { version: 1 },
        },
        { returnDocument: "before" }
      );

      if (draftSchedule) {
        const courseToRemove = draftSchedule.courses.find(
          (c) => String(c.course) === String(request.course)
        );

        if (courseToRemove && draftSchedule.seatsReserved && courseToRemove.slots?.length) {
          for (const slot of courseToRemove.slots) {
            const offeringId = slot.courseOffering || courseToRemove.courseOffering;
            const slotId = slot.slotGroupId;
            if (offeringId && slotId) {
              await CourseOffering.updateOne(
                {
                  _id: offeringId,
                  slots: { $elemMatch: { _id: slotId, assignedStudentCount: { $gt: 0 } } },
                },
                { $inc: { "slots.$.assignedStudentCount": -1 } }
              );
            }
          }
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
