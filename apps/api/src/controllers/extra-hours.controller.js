import mongoose from "mongoose";
import {
  StudentProfile,
  User,
  AcademicTerm,
  Course,
  CourseAttempt,
  ExtraHoursRequest,
  Notification,
} from "../models/index.js";
import { standardCreditAllowance } from "../utils/credit-allowance.js";

const { Types } = mongoose;

/**
 * Req 83: Advisor - request extra credit hours for an advising student
 * Extra comments / Advising rules:
 * - Probation students cannot receive extra hours (GPA >= 3.70 or standing/reason = probation).
 * - Other students may not exceed 34 total hours.
 * - A student not graduating within one year may add at most three hours above the standard allowance.
 * - A student graduating within one year may add hours up to the 34-hour maximum.
 * - Repeated-course hours cost EGP 1,000 each; new-course hours cost EGP 800 each.
 */
export async function createExtraHoursRequest(req, res) {
  try {
    const {
      studentId,
      termId,
      courseIds,
      graduatingWithinOneYear,
    } = req.body;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required." });
    }

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ message: "At least one course must be selected." });
    }

    // Resolve StudentProfile by _id or studentId string
    const studentQuery = Types.ObjectId.isValid(studentId)
      ? { _id: studentId }
      : { studentId };

    const student = await StudentProfile.findOne(studentQuery).populate("user", "fullName email");
    if (!student) {
      return res.status(404).json({ message: "Student profile not found." });
    }

    if (student.studentType !== "advising") {
      return res.status(400).json({ message: "Extra hours can only be requested for advising students." });
    }

    // Resolve Academic Term
    let term = null;
    if (termId) {
      const termQuery = Types.ObjectId.isValid(termId) ? { _id: termId } : { code: termId };
      term = await AcademicTerm.findOne(termQuery);
    } else {
      term = await AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 });
    }

    if (!term) {
      return res.status(404).json({ message: "Academic term not found." });
    }

    // Check if there is already an active/pending extra-hours request for this student in this term
    const existingPending = await ExtraHoursRequest.findOne({
      student: student._id,
      term: term._id,
      decisionStatus: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        message: "A pending extra-hours request already exists for this student in the selected term.",
        existingRequestId: existingPending._id,
      });
    }

    // Rule 1: Probation check
    // On the GUC scale, GPA 3.70 or above is probation.
    const isProbation =
      student.academicStanding === "probation" ||
      student.advisingReason === "probation" ||
      (typeof student.gpa === "number" && student.gpa >= 3.70);

    if (isProbation) {
      return res.status(400).json({
        message: "Probation students cannot receive extra credit hours.",
      });
    }

    // Rule 2: Standard credit allowance
    const standardAllowance = standardCreditAllowance(student.currentSemester);
    if (!standardAllowance) {
      return res.status(400).json({
        message: `Standard credit allowance is not configured for semester ${student.currentSemester}.`,
      });
    }

    // Determine graduation status:
    // If explicitly provided in the request body, use it; otherwise infer from semester >= 9.
    const isGraduating = typeof graduatingWithinOneYear === "boolean"
      ? graduatingWithinOneYear
      : Boolean(student.currentSemester >= 9);

    // Rule 3: Validate requested courses and calculate repeated vs new rates
    const validCourseObjectIds = courseIds.filter((id) => Types.ObjectId.isValid(id));
    if (validCourseObjectIds.length !== courseIds.length) {
      return res.status(400).json({ message: "One or more course IDs are invalid." });
    }

    const courses = await Course.find({ _id: { $in: validCourseObjectIds }, isActive: true });
    if (courses.length !== courseIds.length) {
      return res.status(404).json({ message: "One or more courses were not found or are inactive." });
    }

    // Check course attempt history for this student to determine repeated courses
    const studentAttempts = await CourseAttempt.distinct("course", {
      student: student._id,
      course: { $in: validCourseObjectIds },
    });
    const repeatedCourseIds = new Set(studentAttempts.map(String));

    const itemizedCourses = courses.map((course) => {
      const isRepeated = repeatedCourseIds.has(String(course._id));
      const pricePerHour = isRepeated ? 1000 : 800;
      const hours = Number(course.creditHours);
      const subtotal = hours * pricePerHour;
      return {
        course: course._id,
        hours,
        isRepeated,
        pricePerHour,
        subtotal,
      };
    });

    const requestedHours = itemizedCourses.reduce((sum, item) => sum + item.hours, 0);
    const totalCost = itemizedCourses.reduce((sum, item) => sum + item.subtotal, 0);

    // Hours before and after
    const hoursBeforeRequest = standardAllowance;
    const hoursAfterRequest = hoursBeforeRequest + requestedHours;

    // Rule 4: Total hours and graduation caps
    if (hoursAfterRequest > 34) {
      return res.status(400).json({
        message: `Total credit hours (${hoursAfterRequest}) cannot exceed the 34-hour university maximum.`,
      });
    }

    if (!isGraduating && requestedHours > 3) {
      return res.status(400).json({
        message: `A student not graduating within one year may add at most 3 hours above standard allowance (${standardAllowance} standard + 3 max extra = ${standardAllowance + 3}). Requested: ${requestedHours} extra hours.`,
      });
    }

    // Create the extra-hours request
    const extraHoursRequest = await ExtraHoursRequest.create({
      student: student._id,
      advisor: req.user._id,
      term: term._id,
      courses: itemizedCourses,
      requestedHours,
      totalCost,
      currency: "EGP",
      eligibilitySnapshot: {
        standardAllowance,
        hoursBeforeRequest,
        hoursAfterRequest,
        isProbation: false,
        graduatingWithinOneYear: isGraduating,
      },
      decisionStatus: "pending",
      settlementStatus: "none",
    });

    // Notify Coordinators (Req 120: receive notifications when extra-hours requires action)
    const coordinators = await User.find({ role: "coordinator", isActive: true }).select("_id");
    if (coordinators.length > 0) {
      const notifications = coordinators.map((coord) => ({
        recipient: coord._id,
        type: "extraHoursRequested",
        title: "Extra Credit Hours Request",
        message: `Advisor submitted an extra credit hours request (${requestedHours} hrs, ${totalCost} EGP) for student ${student.studentId}.`,
        relatedModel: "ExtraHoursRequest",
        relatedId: String(extraHoursRequest._id),
      }));
      await Notification.insertMany(notifications).catch(() => {});
    }

    const populated = await ExtraHoursRequest.findById(extraHoursRequest._id)
      .populate("student")
      .populate("advisor", "fullName email")
      .populate("term", "code season academicYear")
      .populate("courses.course", "code name creditHours");

    return res.status(201).json(populated);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to submit extra-hours request." });
  }
}

/**
 * Req 96: Advisor - withdraw an extra-hours request before Coordinator approval
 * Rules:
 * - Can only be withdrawn while decisionStatus === 'pending'.
 * - An approved, rejected, paid or deferred request cannot be withdrawn.
 */
export async function withdrawExtraHoursRequest(req, res) {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid request ID." });
    }

    const request = await ExtraHoursRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: "Extra-hours request not found." });
    }

    // Check authorization: only the requesting advisor (or coordinator) can withdraw
    const isOwner = String(request.advisor) === String(req.user._id);
    const isCoordinator = req.user.role === "coordinator";
    if (!isOwner && !isCoordinator) {
      return res.status(403).json({ message: "You are not authorized to withdraw this request." });
    }

    // Check status: can only withdraw while pending
    if (request.decisionStatus !== "pending") {
      return res.status(400).json({
        message: "An approved, rejected, paid or deferred request cannot be withdrawn.",
      });
    }

    request.decisionStatus = "withdrawn";
    await request.save();

    const populated = await ExtraHoursRequest.findById(request._id)
      .populate("student")
      .populate("advisor", "fullName email")
      .populate("term", "code season academicYear")
      .populate("courses.course", "code name creditHours");

    return res.json(populated);
  } catch (err) {
    return res.status(500).json({ message: err.message || "Unable to withdraw extra-hours request." });
  }
}

/**
 * Req 88, 95: View single extra-hours request details and decision/settlement history
 */
export async function getExtraHoursRequestById(req, res) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid request ID." });
    }

    const request = await ExtraHoursRequest.findById(id)
      .populate("student")
      .populate("advisor", "fullName email")
      .populate("decidedBy", "fullName email")
      .populate("term", "code season academicYear")
      .populate("courses.course", "code name creditHours");

    if (!request) {
      return res.status(404).json({ message: "Extra-hours request not found." });
    }

    // If student role, ensure it's their own request
    if (req.user.role === "advisingStudent") {
      const studentProfile = await StudentProfile.findOne({ user: req.user._id });
      if (!studentProfile || String(request.student._id || request.student) !== String(studentProfile._id)) {
        return res.status(403).json({ message: "Access denied." });
      }
    }

    return res.json(request);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
