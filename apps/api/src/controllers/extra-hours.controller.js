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
import { getWallet } from "../models/academics.js";
import { walletDelta, walletKinds } from "../models/finance.js";
import { standardCreditAllowance } from "../utils/credit-allowance.js";
import { notifyStudents } from "../services/student-notifications.js";
import { getNextUniversityInstallment } from "../services/university-installments.js";
import { createStripeCheckout, expireStripeCheckout, getStripeCheckout, stripeCheckoutConfigured } from "../services/stripe-checkout.js";

const { Types } = mongoose;
const isProbationStudent = (student) => student.academicStanding === "probation"
  || student.advisingReason === "probation" || student.gpa >= 3.70;

async function creditHoursBefore(student, term, standardAllowance, { session, exclude } = {}) {
  const requests = await ExtraHoursRequest.find({
    student, term, decisionStatus: "approved",
    settlementStatus: { $in: ["awaitingChoice", "paid", "deferred"] },
    ...(exclude && { _id: { $ne: exclude } }),
  }).session(session ?? null).select("requestedHours").lean();
  return requests.reduce((total, request) => total + request.requestedHours, standardAllowance);
}

const populatedRequest = (id) => ExtraHoursRequest.findById(id)
  .populate({ path: "student", populate: { path: "user", select: "fullName email" } })
  .populate("advisor", "fullName email")
  .populate("decidedBy", "fullName email")
  .populate("term", "code season academicYear")
  .populate("courses.course", "code name creditHours");

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
    if (req.user.role === "advisor" && !student.assignedAdvisor?.equals(req.user._id)) {
      return res.status(403).json({ message: "You can only request extra hours for your assigned students." });
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
    const isProbation = isProbationStudent(student);

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
    const hoursBeforeRequest = await creditHoursBefore(student._id, term._id, standardAllowance);
    const hoursAfterRequest = hoursBeforeRequest + requestedHours;

    // Rule 4: Total hours and graduation caps
    if (hoursAfterRequest > 34) {
      return res.status(400).json({
        message: `Total credit hours (${hoursAfterRequest}) cannot exceed the 34-hour university maximum.`,
      });
    }

    if (!isGraduating && hoursAfterRequest > standardAllowance + 3) {
      return res.status(400).json({
        message: `A student not graduating within one year may add at most 3 hours above standard allowance (${standardAllowance} standard + 3 max extra = ${standardAllowance + 3}). This request would bring the total to ${hoursAfterRequest} hours.`,
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

/** Req. 86: Include historical request submitters in the coordinator's filter. */
export async function listExtraHoursRequestingAdvisors(_req, res) {
  try {
    const ids = await ExtraHoursRequest.distinct("advisor");
    const advisors = await User.find({ _id: { $in: ids } })
      .select("fullName")
      .sort({ fullName: 1, _id: 1 })
      .lean();
    return res.json(advisors);
  } catch {
    return res.status(500).json({ message: "Unable to load requesting advisors." });
  }
}

export async function decideExtraHoursRequest(req, res) {
  try {
    const { id } = req.params;
    const { decision, responseNote = "" } = req.body || {};
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid request ID." });
    if (!["approved", "rejected"].includes(decision)) return res.status(400).json({ message: "Decision must be approved or rejected." });
    if (typeof responseNote !== "string" || !responseNote.trim() || responseNote.trim().length > 1000) {
      return res.status(400).json({ message: "Enter a response note between 1 and 1000 characters." });
    }
    await mongoose.connection.transaction(async (session) => {
      const request = await ExtraHoursRequest.findById(id).session(session);
      if (!request) throw Object.assign(new Error("Extra-hours request not found."), { status: 404 });
      if (request.decisionStatus !== "pending") throw Object.assign(new Error("Only pending requests can be decided."), { status: 409 });
      if (decision === "approved") {
        // Updating the student serializes approvals that share a credit limit.
        const student = await StudentProfile.findByIdAndUpdate(request.student, { $inc: { __v: 1 } }, { session });
        if (!student || student.studentType !== "advising" || isProbationStudent(student)) {
          throw Object.assign(new Error("The student is no longer eligible for extra hours."), { status: 409 });
        }
        const allowance = standardCreditAllowance(student.currentSemester);
        if (!allowance) throw Object.assign(new Error("The student's standard credit allowance is unavailable."), { status: 409 });
        const before = await creditHoursBefore(student._id, request.term, allowance, { session, exclude: request._id });
        const after = before + request.requestedHours;
        const limit = request.eligibilitySnapshot.graduatingWithinOneYear ? 34 : Math.min(34, allowance + 3);
        if (after > limit) throw Object.assign(new Error(`Approval would exceed the student's ${limit}-hour limit.`), { status: 409 });
        request.eligibilitySnapshot.standardAllowance = allowance;
        request.eligibilitySnapshot.hoursBeforeRequest = before;
        request.eligibilitySnapshot.hoursAfterRequest = after;
      }
      request.decisionStatus = decision;
      request.decisionNote = responseNote.trim();
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
    const student = await StudentProfile.findOne({ user: req.user._id });
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

/** Req. 91, 93: Pay or retry through hosted card checkout. */
const pendingStripe = { kind: "gatewayPayment", status: "pending", "metadata.stripeCheckout": true };

function settlementRequest(request) {
  if (!request) throw Object.assign(new Error("Extra-hours request not found."), { status: 404 });
  if (request.decisionStatus !== "approved" || request.settlementStatus !== "awaitingChoice") {
    throw Object.assign(new Error("This request is no longer awaiting payment."), { status: 409 });
  }
}

async function reconcileStripeCheckout(attempt, checkout, declinedBeforeClosing = false) {
  if (checkout.livemode !== false || checkout.id !== attempt.metadata.stripeSessionId ||
      checkout.client_reference_id !== attempt.id || checkout.currency !== "egp" ||
      checkout.amount_total !== Math.round(attempt.amount * 100)) {
    throw Object.assign(new Error("Stripe checkout did not match the payment request."), { status: 502 });
  }
  const paid = checkout.status === "complete" && checkout.payment_status === "paid";
  const closed = checkout.status === "expired" || checkout.status === "complete";
  if (!paid && !closed) return "pending";
  const declined = declinedBeforeClosing || Boolean(checkout.payment_intent?.last_payment_error);
  const status = paid ? "succeeded" : (declined || checkout.status === "complete" ? "failed" : "cancelled");
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const transaction = await FinancialTransaction.findById(attempt.id).session(session);
      if (transaction.status !== "pending") return transaction.status;
      const request = await ExtraHoursRequest.findById(transaction.extraHoursRequest).session(session);
      settlementRequest(request);
      transaction.status = status;
      transaction.occurredAt = new Date();
      if (paid) {
        transaction.transactionReference = checkout.payment_intent?.id || checkout.id;
        request.settlementStatus = "paid";
        request.settlementOption = "gateway";
      }
      request.history.push({
        action: paid ? "paid" : "paymentAttempt",
        actor: attempt.metadata.actor,
        note: `Card payment ${status}.`,
        settlementOption: "gateway", settlementStatus: paid ? "paid" : status, amount: transaction.amount,
      });
      await transaction.save({ session });
      await request.save({ session });
      await notifyExtraHoursSettlement(transaction, session);
      return status;
    });
  } finally {
    await session.endSession();
  }
}

async function reserveStripeCheckout(id, student, actor) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const request = await ExtraHoursRequest.findOne({ _id: id, student }).session(session);
      settlementRequest(request);
      const existing = await FinancialTransaction.findOne({ ...pendingStripe, extraHoursRequest: id }).session(session);
      if (existing) return existing;
      // Serialize checkout starts with wallet payments and installment deferrals.
      await ExtraHoursRequest.updateOne({ _id: id }, { $inc: { __v: 1 } }, { session });
      const [attempt] = await FinancialTransaction.create([{
        student, extraHoursRequest: id, kind: "gatewayPayment", amount: request.totalCost,
        status: "pending", settlementOption: "gateway", metadata: { stripeCheckout: true, actor },
      }], { session });
      return attempt;
    });
  } finally {
    await session.endSession();
  }
}

export async function startExtraHoursCheckout(req, res) {
  try {
    if (!stripeCheckoutConfigured()) return res.status(503).json({ message: "Card payments are temporarily unavailable." });
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid request ID." });
    const profile = await StudentProfile.findOne({ user: req.user._id }).select("_id");
    if (!profile) return res.status(404).json({ message: "Student profile not found." });
    let attempt = await reserveStripeCheckout(req.params.id, profile.id, req.user._id);
    if (attempt.metadata.stripeSessionId) {
      const existing = await getStripeCheckout(attempt.metadata.stripeSessionId);
      const status = await reconcileStripeCheckout(attempt, existing);
      if (status === "pending") return res.json({ checkoutUrl: existing.url });
      if (status === "succeeded") return res.json({ status });
      attempt = await reserveStripeCheckout(req.params.id, profile.id, req.user._id);
    }
    let checkout;
    try {
      checkout = await createStripeCheckout(attempt);
    } catch (err) {
      // Stripe rejected these parameters before creating a Checkout session.
      if (err.stripeStatus === 400 && err.stripeErrorType === "invalid_request_error") {
        await FinancialTransaction.updateOne(
          { _id: attempt.id, status: "pending", "metadata.stripeSessionId": { $exists: false } },
          { $set: { status: "failed" } },
        );
      }
      throw err;
    }
    if (checkout.livemode !== false || checkout.client_reference_id !== attempt.id ||
        !/^cs_test_/.test(checkout.id || "") || !checkout.url?.startsWith("https://checkout.stripe.com/")) {
      throw Object.assign(new Error("Stripe did not return a valid checkout."), { status: 502 });
    }
    await FinancialTransaction.updateOne({ _id: attempt.id }, { $set: { "metadata.stripeSessionId": checkout.id } });
    return res.status(201).json({ checkoutUrl: checkout.url });
  } catch (err) {
    return res.status(err.status || 502).json({ message: err.message || "Could not start Stripe checkout." });
  }
}

export async function checkExtraHoursCheckout(req, res) {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid request ID." });
    const profile = await StudentProfile.findOne({ user: req.user._id }).select("_id");
    if (!profile) return res.status(404).json({ message: "Student profile not found." });
    const attemptId = req.body?.attemptId;
    if (attemptId !== undefined && !Types.ObjectId.isValid(attemptId)) return res.status(400).json({ message: "Invalid checkout ID." });
    const attempt = await FinancialTransaction.findOne({
      kind: "gatewayPayment", "metadata.stripeCheckout": true, student: profile.id, extraHoursRequest: req.params.id,
      ...(attemptId && { _id: attemptId }),
    }).sort({ createdAt: -1, _id: -1 });
    if (!attempt) return res.status(404).json({ message: "No Stripe checkout found." });
    if (attempt.status !== "pending" || !attempt.metadata.stripeSessionId) return res.json({ status: attempt.status });
    let checkout = await getStripeCheckout(attempt.metadata.stripeSessionId);
    const declinedBeforeClosing = Boolean(checkout.payment_intent?.last_payment_error);
    if (req.body?.cancel === true && checkout.status === "open") {
      try {
        await expireStripeCheckout(checkout.id);
      } catch (err) {
        if (err.stripeStatus !== 400) throw err;
      }
      checkout = await getStripeCheckout(checkout.id);
    }
    return res.json({ status: await reconcileStripeCheckout(attempt, checkout, declinedBeforeClosing) });
  } catch (err) {
    return res.status(err.status || 502).json({ message: err.message || "Could not verify Stripe checkout." });
  }
}

export function startExtraHoursCheckoutReconciliation() {
  if (!stripeCheckoutConfigured()) return;
  async function check() {
    try {
      const attempts = FinancialTransaction.find({ ...pendingStripe, "metadata.stripeSessionId": { $exists: true } }).cursor();
      for await (const attempt of attempts) {
        try {
          await reconcileStripeCheckout(attempt, await getStripeCheckout(attempt.metadata.stripeSessionId));
        } catch {
          console.warn("Could not reconcile a Stripe test checkout. It will be retried.");
        }
      }
    } catch {
      console.warn("Could not check pending Stripe test checkouts.");
    } finally {
      setTimeout(check, 60000).unref();
    }
  }
  void check();
}

/** Req. 90-94: Student pays from their wallet or defers to the next installment. */
export async function chooseExtraHoursSettlement(req, res) {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { option, method } = req.body || {};
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid request ID." });
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ message: "Student profile not found." });
    let paymentId;
    await session.withTransaction(async () => {
      const request = await ExtraHoursRequest.findOne({ _id: id, student: profile._id }).session(session);
      settlementRequest(request);
      if (await FinancialTransaction.exists({ ...pendingStripe, extraHoursRequest: id }).session(session)) {
        throw Object.assign(new Error("Finish or cancel the open Stripe checkout first."), { status: 409 });
      }
      let transaction;
      if (option === "deferred") {
        const installment = await getNextUniversityInstallment(profile._id, request.term, session);
        if (!installment) throw Object.assign(new Error("The academic term for this installment is unavailable."), { status: 409 });
        const [charge] = await FinancialTransaction.create([{
          student: profile._id, extraHoursRequest: request._id,
          kind: "deferredCharge", amount: request.totalCost, status: "pending", settlementOption: "deferred",
          deferredChargeReference: `DEF-${request._id}`, installment: installment.label, installmentId: installment._id,
          idempotencyKey: `extra-hours:${request._id}:deferred`,
        }], { session });
        transaction = charge;
        request.settlementOption = "deferred";
        request.settlementStatus = "deferred";
        request.history.push({ action: "deferred", actor: req.user._id, note: `Deferred to ${installment.label}.`, settlementOption: "deferred", settlementStatus: "deferred", amount: request.totalCost });
      } else if (option === "now") {
        if (method !== "wallet") throw Object.assign(new Error("Open Stripe Checkout for card payments."), { status: 400 });
        // Payments for different requests share one wallet.
        await StudentProfile.updateOne({ _id: profile._id }, { $inc: { __v: 1 } }, { session });
        const entries = await FinancialTransaction.find({ student: profile._id, kind: { $in: walletKinds } }).session(session).select("kind amount status").lean();
        const balance = entries.reduce((sum, txn) => sum + walletDelta(txn), 0);
        if (balance < Math.round(request.totalCost * 100)) throw Object.assign(new Error("Your wallet balance is not sufficient for this payment."), { status: 409 });
        const alreadyPaid = await FinancialTransaction.exists({ extraHoursRequest: request._id, status: "succeeded", kind: { $in: ["extraHoursWalletPayment", "gatewayPayment"] } }).session(session);
        if (alreadyPaid) throw Object.assign(new Error("This request has already been paid."), { status: 409 });
        const reference = `WAL-${new mongoose.Types.ObjectId()}`;
        [transaction] = await FinancialTransaction.create([{ student: profile._id, extraHoursRequest: request._id, kind: "extraHoursWalletPayment", amount: request.totalCost, status: "succeeded", settlementOption: "wallet", transactionReference: reference, idempotencyKey: `extra-hours:${request._id}:wallet` }], { session });
        request.settlementOption = "wallet";
        request.settlementStatus = "paid";
        request.history.push({ action: "paid", actor: req.user._id, note: "Paid using wallet.", settlementOption: "wallet", settlementStatus: "paid", amount: request.totalCost });
      } else throw Object.assign(new Error("Choose pay now or defer to your next university installment."), { status: 400 });
      await request.save({ session });
      await notifyExtraHoursSettlement(transaction, session);
      paymentId = transaction._id;
    });
    const request = await populatedRequest(id);
    const transaction = paymentId ? await FinancialTransaction.findById(paymentId).lean() : null;
    return res.json({ request, transaction, confirmation: transaction?.kind === "deferredCharge" ? { type: "deferredPaymentConfirmation", installment: transaction.installment, installmentId: transaction.installmentId, amountDue: transaction.amount, confirmedAt: transaction.occurredAt, reference: transaction.deferredChargeReference } : transaction?.status === "succeeded" ? { type: "paidReceipt", method: transaction.settlementOption, amount: transaction.amount, transactionReference: transaction.transactionReference, paidAt: transaction.occurredAt } : null });
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
    const student = await StudentProfile.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ message: "Student profile not found." });
    const wallet = await getWallet(student._id);
    return res.json({ ...wallet, studentId: student.studentId });
  } catch (err) { return res.status(500).json({ message: err.message }); }
}

export async function downloadExtraHoursConfirmation(req, res) {
  try {
    const transactionId = req.params.transactionId;
    if (!Types.ObjectId.isValid(transactionId)) return res.status(400).json({ message: "Invalid transaction ID." });
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ message: "Student profile not found." });
    const transaction = await FinancialTransaction.findOne({ _id: transactionId, student: profile._id, extraHoursRequest: { $ne: null } }).populate("extraHoursRequest", "requestedHours totalCost currency").lean();
    if (!transaction) return res.status(404).json({ message: "Confirmation is not available for this financial record." });
    const deferred = transaction.kind === "deferredCharge";
    if (deferred && !["pending", "PENDING"].includes(transaction.status)) return res.status(404).json({ message: "Deferred-payment confirmation is available only for an outstanding deferred charge." });
    if (!deferred && (!["extraHoursWalletPayment", "gatewayPayment"].includes(transaction.kind) || transaction.status !== "succeeded")) {
      return res.status(404).json({ message: "A paid receipt is available only after successful payment." });
    }
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
      if (transaction.installmentId) doc.text(`Installment reference: INST-${transaction.installmentId}`);
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
