import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import {
  StudentProfile,
  User,
  AcademicTerm,
  Course,
  CourseAttempt,
  ExtraHoursRequest,
  Notification,
  FinancialTransaction,
} from "../models/index.js";
import { standardCreditAllowance } from "../utils/credit-allowance.js";
import { notifyStudents } from "../services/student-notifications.js";

const { Types } = mongoose;
const populatedRequest = (id) => ExtraHoursRequest.findById(id)
  .populate({ path: "student", populate: { path: "user", select: "fullName email" } })
  .populate("advisor", "fullName email")
  .populate("decidedBy", "fullName email")
  .populate("term", "code season academicYear")
  .populate("courses.course", "code name creditHours");

async function studentAndWallet(userId) {
  const student = await StudentProfile.findOne({ user: userId });
  if (!student) return { student: null, balance: 0 };
  const transactions = await FinancialTransaction.find({ student: student._id, kind: { $in: ["walletTopUp", "refund", "extraHoursWalletPayment"] }, status: "succeeded" }).select("kind amount").lean();
  const balance = transactions.reduce((sum, txn) => sum + (txn.kind === "extraHoursWalletPayment" ? -1 : 1) * Number(txn.amount), 0);
  return { student, balance: Math.round(balance * 100) / 100 };
}

function notifyExtraHoursDecision(request, message, session) {
  return notifyStudents({ _id: request.student, studentType: "advising" }, {
    type: "extraHoursDecision",
    title: `Extra-hours request ${request.decisionStatus}`,
    message,
    relatedModel: "ExtraHoursRequest", relatedId: request._id,
  }, session);
}

function notifyExtraHoursSettlement(transaction, session) {
  const deferred = transaction.kind === "deferredCharge";
  const amount = `${transaction.amount} ${transaction.currency}`;
  return notifyStudents({ _id: transaction.student, studentType: "advising" }, {
    type: deferred ? "deferredChargeUpdated" : "paymentUpdated",
    title: deferred ? "Extra-hours charge deferred" : `Extra-hours payment ${transaction.status}`,
    message: deferred ? `Your extra-hours charge of ${amount} will be added to your next university installment.`
      : `Your extra-hours payment of ${amount} ${transaction.status === "cancelled" ? "was cancelled" : transaction.status}.`,
    relatedModel: "FinancialTransaction", relatedId: transaction._id,
  }, session);
}

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
      history: [{ action: "submitted", actor: req.user._id, note: "Extra-hours request submitted." }],
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

    await mongoose.connection.transaction(async (session) => {
      const request = await ExtraHoursRequest.findById(id).session(session);
      if (!request) throw Object.assign(new Error("Extra-hours request not found."), { status: 404 });
      if (String(request.advisor) !== String(req.user._id) || req.user.role !== "advisor") {
        throw Object.assign(new Error("You are not authorized to withdraw this request."), { status: 403 });
      }
      if (request.decisionStatus !== "pending") {
        throw Object.assign(new Error("An approved, rejected, paid or deferred request cannot be withdrawn."), { status: 400 });
      }

      request.decisionStatus = "withdrawn";
      request.history.push({ action: "withdrawn", actor: req.user._id, note: "Request withdrawn by its Advisor." });
      await request.save({ session });
      await notifyExtraHoursDecision(request, "Your Advisor withdrew the extra-hours request.", session);
    });

    const populated = await ExtraHoursRequest.findById(id)
      .populate("student")
      .populate("advisor", "fullName email")
      .populate("term", "code season academicYear")
      .populate("courses.course", "code name creditHours");

    return res.json(populated);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || "Unable to withdraw extra-hours request." });
  }
}

/** Req. 84-87: Coordinator queue and decision. */
export async function listExtraHoursRequests(req, res) {
  try {
    const filter = {};
    if (req.query.advisorId) filter.advisor = req.query.advisorId;
    if (req.query.decisionStatus) filter.decisionStatus = req.query.decisionStatus;
    if (req.query.settlementOption) filter.settlementOption = req.query.settlementOption;
    if (req.query.settlementStatus) filter.settlementStatus = req.query.settlementStatus;
    if (req.query.studentId) {
      const student = await StudentProfile.findOne({ studentId: String(req.query.studentId).trim() }).select("_id");
      if (!student) return res.json([]);
      filter.student = student._id;
    }
    const rows = await ExtraHoursRequest.find(filter).sort({ createdAt: -1 }).populate({ path: "student", populate: { path: "user", select: "fullName email" } }).populate("advisor", "fullName email").populate("decidedBy", "fullName email").populate("term", "code season academicYear").populate("courses.course", "code name creditHours");
    return res.json(rows);
  } catch (err) { return res.status(500).json({ message: err.message }); }
}

export async function decideExtraHoursRequest(req, res) {
  try {
    const { id } = req.params;
    const { decision, responseNote = "" } = req.body || {};
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid request ID." });
    if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ message: "Decision must be approved or rejected." });
    await mongoose.connection.transaction(async (session) => {
      const request = await ExtraHoursRequest.findById(id).session(session);
      if (!request) throw Object.assign(new Error("Extra-hours request not found."), { status: 404 });
      if (request.decisionStatus !== "pending") throw Object.assign(new Error("Only pending requests can be decided."), { status: 409 });
      request.decisionStatus = decision;
      request.decisionNote = String(responseNote).trim();
      request.decidedBy = req.user._id;
      request.decidedAt = new Date();
      request.settlementStatus = decision === "approved" ? "awaitingChoice" : "none";
      request.history.push({ action: decision, actor: req.user._id, note: request.decisionNote, settlementStatus: request.settlementStatus });
      await request.save({ session });
      await notifyExtraHoursDecision(request, `Your extra-hours request was ${decision}. ${request.decisionNote}`.trim(), session);
    });
    return res.json(await populatedRequest(id));
  } catch (err) { return res.status(err.status || 500).json({ message: err.message }); }
}

/** Student requests are restricted to the signed-in advising student's profile. */
export async function listMyExtraHoursRequests(req, res) {
  try {
    const { student } = await studentAndWallet(req.user._id);
    if (!student) return res.status(404).json({ message: "Student profile not found." });
    const rows = await ExtraHoursRequest.find({ student: student._id }).sort({ createdAt: -1 }).populate("advisor", "fullName email").populate("decidedBy", "fullName email").populate("term", "code season academicYear").populate("courses.course", "code name creditHours");
    return res.json(rows);
  } catch (err) { return res.status(500).json({ message: err.message }); }
}

/** Req. 96: Advisors can review and withdraw requests they submitted. */
export async function listAdvisorExtraHoursRequests(req, res) {
  try {
    const rows = await ExtraHoursRequest.find({ advisor: req.user._id })
      .sort({ createdAt: -1 })
      .populate({ path: "student", populate: { path: "user", select: "fullName email" } })
      .populate("advisor", "fullName email")
      .populate("decidedBy", "fullName email")
      .populate("term", "code season academicYear")
      .populate("courses.course", "code name creditHours");
    return res.json(rows);
  } catch (err) { return res.status(500).json({ message: err.message }); }
}

/** Req. 90-94: Student confirms payment now or defers to the next installment. */
export async function chooseExtraHoursSettlement(req, res) {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { option, method, gatewayResult = "succeeded" } = req.body || {};
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid request ID." });
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ message: "Student profile not found." });
    let paymentId;
    await session.withTransaction(async () => {
      const request = await ExtraHoursRequest.findOne({ _id: id, student: profile._id }).session(session);
      if (!request) throw Object.assign(new Error("Extra-hours request not found."), { status: 404 });
      if (request.decisionStatus !== "approved") throw Object.assign(new Error("Only an approved request can be settled."), { status: 409 });
      if (request.settlementStatus === "paid" || request.settlementStatus === "deferred") throw Object.assign(new Error("This request has already been settled."), { status: 409 });
      if (["cancelled", "refunded"].includes(request.settlementStatus)) throw Object.assign(new Error("This request is no longer available for settlement."), { status: 409 });
      let transaction;
      if (option === "deferred") {
        if (request.settlementStatus !== "awaitingChoice") throw Object.assign(new Error("This request is not awaiting a payment choice."), { status: 409 });
        const installment = `${(await AcademicTerm.findById(request.term).session(session))?.academicYear || "Next"} next installment`;
        const reference = `DEF-${request._id}`;
        [transaction] = await FinancialTransaction.create([{ student: profile._id, extraHoursRequest: request._id, kind: "deferredCharge", amount: request.totalCost, status: "pending", settlementOption: "deferred", deferredChargeReference: reference, installment, idempotencyKey: `extra-hours:${request._id}:deferred` }], { session });
        request.settlementOption = "deferred";
        request.settlementStatus = "deferred";
        request.history.push({ action: "deferred", actor: req.user._id, note: `Deferred to ${installment}.`, settlementOption: "deferred", settlementStatus: "deferred", amount: request.totalCost });
      } else if (option === "now") {
        if (!["wallet", "gateway"].includes(method)) throw Object.assign(new Error("Choose wallet or gateway payment."), { status: 400 });
        let status = "succeeded";
        const kind = method === "wallet" ? "extraHoursWalletPayment" : "gatewayPayment";
        const transactionReference = `GW-${new mongoose.Types.ObjectId()}`;
        const previousChoice = request.settlementOption;
        request.settlementOption = method;
        if (method === "wallet") {
          const entries = await FinancialTransaction.find({ student: profile._id, kind: { $in: ["walletTopUp", "refund", "extraHoursWalletPayment"] }, status: "succeeded" }).session(session).select("kind amount").lean();
          const balance = entries.reduce((sum, txn) => sum + (txn.kind === "extraHoursWalletPayment" ? -1 : 1) * Number(txn.amount), 0);
          if (balance + 1e-9 < request.totalCost) throw Object.assign(new Error("Your wallet balance is not sufficient for this payment."), { status: 409 });
        } else {
          if (!["succeeded", "failed", "cancelled"].includes(gatewayResult)) throw Object.assign(new Error("Invalid sandbox gateway result."), { status: 400 });
          status = gatewayResult;
        }
        if (status === "succeeded") {
          const alreadyPaid = await FinancialTransaction.exists({ extraHoursRequest: request._id, status: "succeeded", kind: { $in: ["extraHoursWalletPayment", "gatewayPayment"] } }).session(session);
          if (alreadyPaid) throw Object.assign(new Error("This request has already been paid."), { status: 409 });
          const reference = method === "gateway" ? `GW-${new mongoose.Types.ObjectId()}` : `WAL-${new mongoose.Types.ObjectId()}`;
          [transaction] = await FinancialTransaction.create([{ student: profile._id, extraHoursRequest: request._id, kind, amount: request.totalCost, status, settlementOption: method, transactionReference: reference, idempotencyKey: `extra-hours:${request._id}:${method}` }], { session });
          request.settlementStatus = "paid";
          request.history.push({ action: "paid", actor: req.user._id, note: `Paid using ${method}.`, settlementOption: method, settlementStatus: "paid", amount: request.totalCost });
        } else {
          [transaction] = await FinancialTransaction.create([{ student: profile._id, extraHoursRequest: request._id, kind, amount: request.totalCost, status, settlementOption: method, transactionReference, idempotencyKey: `extra-hours:${request._id}:${method}:${Date.now()}` }], { session });
          request.settlementStatus = "awaitingChoice";
          request.history.push({ action: "paymentAttempt", actor: req.user._id, note: `Sandbox gateway payment ${status}.`, settlementOption: method, settlementStatus: status, amount: request.totalCost });
        }
        if (status !== "succeeded" && !previousChoice) request.settlementOption = null;
      } else throw Object.assign(new Error("Choose pay now or defer to your next university installment."), { status: 400 });
      await request.save({ session });
      await notifyExtraHoursSettlement(transaction, session);
      paymentId = transaction._id;
    });
    const request = await populatedRequest(id);
    const transaction = paymentId ? await FinancialTransaction.findById(paymentId).lean() : null;
    return res.json({ request, transaction, confirmation: transaction?.kind === "deferredCharge" ? { type: "deferredPaymentConfirmation", installment: transaction.installment, amountDue: transaction.amount, confirmedAt: transaction.occurredAt, reference: transaction.deferredChargeReference } : transaction?.status === "succeeded" ? { type: "paidReceipt", method: transaction.settlementOption, amount: transaction.amount, transactionReference: transaction.transactionReference, paidAt: transaction.occurredAt } : null });
  } catch (err) { return res.status(err.status || 500).json({ message: err.message || "Unable to settle extra-hours request." }); }
  finally { await session.endSession(); }
}

export async function getExtraHoursFinancialHistory(req, res) {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ message: "Student profile not found." });
    const rows = await FinancialTransaction.find({ student: profile._id, extraHoursRequest: { $ne: null } }).sort({ occurredAt: -1 }).populate("extraHoursRequest", "requestedHours totalCost decisionStatus settlementStatus settlementOption").lean();
    return res.json(rows);
  } catch (err) { return res.status(500).json({ message: err.message }); }
}

export async function getExtraHoursWallet(req, res) {
  try {
    const { student, balance } = await studentAndWallet(req.user._id);
    if (!student) return res.status(404).json({ message: "Student profile not found." });
    const rows = await FinancialTransaction.find({ student: student._id, kind: { $in: ["walletTopUp", "refund", "extraHoursWalletPayment"] } }).sort({ occurredAt: 1, _id: 1 }).lean();
    let running = 0;
    for (const row of rows) {
      if (row.status === "succeeded") running += row.kind === "extraHoursWalletPayment" ? -Number(row.amount) : Number(row.amount);
      row.resultingBalance = Math.round(running * 100) / 100;
      row.direction = row.kind === "extraHoursWalletPayment" ? "debit" : "credit";
    }
    return res.json({ studentId: student.studentId, balance, currency: "EGP", transactions: rows.reverse() });
  } catch (err) { return res.status(500).json({ message: err.message }); }
}

export async function downloadExtraHoursConfirmation(req, res) {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid transaction ID." });
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ message: "Student profile not found." });
    const transaction = await FinancialTransaction.findOne({ _id: req.params.id, student: profile._id, extraHoursRequest: { $ne: null } }).populate("extraHoursRequest", "requestedHours totalCost currency").lean();
    if (!transaction) return res.status(404).json({ message: "Confirmation is not available for this financial record." });
    const deferred = transaction.kind === "deferredCharge";
    if (deferred && transaction.status !== "pending") return res.status(404).json({ message: "Deferred-payment confirmation is available only for an outstanding deferred charge." });
    if (!deferred && transaction.status !== "succeeded") return res.status(404).json({ message: "A paid receipt is available only after successful payment." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${deferred ? "deferred-payment-confirmation" : "extra-hours-receipt"}-${transaction._id}.pdf"`);
    const doc = new PDFDocument({ margin: 56 });
    doc.pipe(res);
    doc.fontSize(20).text(deferred ? "Deferred Payment Confirmation" : "Extra-Hours Payment Receipt");
    doc.moveDown().fontSize(11).text(`Record reference: ${transaction._id}`);
    doc.text(`Request reference: ${transaction.extraHoursRequest?._id || transaction.extraHoursRequest}`);
    doc.text(`Amount: ${Number(transaction.amount).toLocaleString()} ${transaction.currency}`);
    if (deferred) {
      doc.text(`Settlement option: Add to university installment`);
      doc.text(`Installment: ${transaction.installment || "Next installment"}`);
      doc.text(`Deferred charge reference: ${transaction.deferredChargeReference || "—"}`);
      doc.text(`Confirmation date: ${new Date(transaction.occurredAt).toLocaleString()}`);
      doc.moveDown().text("This document confirms a deferred charge. It is not a paid receipt.");
    } else {
      doc.text(`Payment method: ${transaction.settlementOption || "—"}`);
      doc.text(`Transaction reference: ${transaction.transactionReference || "—"}`);
      doc.text(`Payment date: ${new Date(transaction.occurredAt).toLocaleString()}`);
      doc.text("Status: Paid");
    }
    doc.end();
  } catch (err) { return res.status(500).json({ message: err.message || "Unable to create confirmation." }); }
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
      if (!studentProfile || String(request.student._id || request.student) !== String(studentProfile._id)) return res.status(403).json({ message: "Access denied." });
    } else if (req.user.role === "advisor") {
      const studentProfile = await StudentProfile.findById(request.student._id || request.student).select("assignedAdvisor");
      if (!studentProfile || String(studentProfile.assignedAdvisor) !== String(req.user._id)) return res.status(403).json({ message: "You may only view requests for your assigned students." });
    }

    return res.json(request);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
