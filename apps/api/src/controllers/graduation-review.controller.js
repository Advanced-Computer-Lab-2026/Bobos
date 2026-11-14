import mongoose from "mongoose";
import { StudentProfile, User } from "../models/identity.js";
import { ExitExamRequest, GraduationPlan } from "../models/requests.js";
import { validateSelections } from "./graduation-plans.controller.js";

const reviewableStatuses = ["submitted", "accepted"];
const identityFields = "fullName email";
const courseFields = "code name creditHours";
const termFields = "code season academicYear termStart";
const examFields = "course reason status responseNote createdAt decidedAt student advisor";
const studentFields = "studentId user";
const isId = (value) => typeof value === "string" && mongoose.isObjectIdOrHexString(value);
const studentDetails = { path: "student", select: studentFields, populate: { path: "user", select: identityFields } };

function planDetails(query) {
  return query
    .populate("termPlans.term", termFields)
    .populate("termPlans.courses", courseFields)
    .populate({ path: "exitExamRequest", select: "course status", populate: { path: "course", select: courseFields } });
}

function readDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export async function listSubmittedPlans(req, res) {
  const { status, advisor, from, to, search = "", page = "1" } = req.query;
  const pageNumber = typeof page === "string" && /^\d+$/.test(page) ? Number(page) : 0;
  const fromDate = from === undefined ? null : readDate(from);
  const toDate = to === undefined ? null : readDate(to);
  if ((status !== undefined && !reviewableStatuses.includes(status)) || (advisor !== undefined && !isId(advisor)) ||
      (from !== undefined && !fromDate) || (to !== undefined && !toDate) || (fromDate && toDate && fromDate > toDate) ||
      typeof search !== "string" || search.length > 200 || !Number.isSafeInteger(pageNumber) ||
      pageNumber < 1 || pageNumber > 1_000_000) {
    return res.status(400).json({ message: "Check the status, advisor, dates, search, and page filters." });
  }
  const visible = { status: { $in: reviewableStatuses }, ...(req.user.role === "advisor" && { advisor: req.user._id }) };
  const filter = { ...visible };
  if (status) filter.status = status;
  if (advisor && req.user.role === "coordinator") filter.advisor = advisor;
  if (fromDate || toDate) {
    if (toDate) toDate.setUTCDate(toDate.getUTCDate() + 1);
    filter.submittedAt = { ...(fromDate && { $gte: fromDate }), ...(toDate && { $lt: toDate }) };
  }
  if (search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "i");
    const [students, advisors] = await Promise.all([
      StudentProfile.distinct("_id", { studentId: pattern }),
      User.distinct("_id", { $or: [{ fullName: pattern }, { email: pattern }] }),
    ]);
    filter.$or = [{ student: { $in: students } }, { advisor: { $in: advisors } }];
  }
  const limit = 20;
  const [plans, total, advisorIds] = await Promise.all([
    planDetails(GraduationPlan.find(filter).select("-__v -decidedBy").populate(studentDetails).populate("advisor", identityFields))
      .sort({ submittedAt: -1, _id: -1 }).skip((pageNumber - 1) * limit).limit(limit).lean(),
    GraduationPlan.countDocuments(filter),
    req.user.role === "coordinator" ? GraduationPlan.distinct("advisor", visible) : [],
  ]);
  const advisors = await User.find({ _id: { $in: advisorIds } }).select(identityFields).sort({ fullName: 1, _id: 1 }).lean();
  res.json({ plans, advisors, total, page: pageNumber, limit });
}

function responseNote(body, maximum) {
  const note = typeof body?.responseNote === "string" ? body.responseNote.trim() : "";
  return note.length > 0 && note.length <= maximum ? note : null;
}

export async function decideGraduationPlan(req, res) {
  const { id } = req.params;
  const { decision } = req.body ?? {};
  const note = responseNote(req.body, 2000);
  if (!isId(id) || !["accept", "reject"].includes(decision) || !note) {
    return res.status(400).json({ message: "Choose a decision and provide a response note of up to 2,000 characters." });
  }
  const plan = await GraduationPlan.findOne({ _id: id, status: { $in: reviewableStatuses } }).lean();
  if (!plan) return res.status(404).json({ message: "Submitted graduation plan not found." });
  const conflict = () => res.status(409).json({ message: "The submission has already changed. Reload the review list." });
  if (plan.status !== "submitted" || (req.body.submittedAt !== undefined &&
      req.body.submittedAt !== (plan.submittedAt?.toISOString() ?? null))) return conflict();

  if (decision === "accept") {
    const student = await StudentProfile.findOne({ _id: plan.student, studentType: "advising" }).lean();
    if (!student) return res.status(422).json({ message: "The advising student record is unavailable." });
    const selections = {
      termPlans: plan.termPlans.map(({ term, courses }) => ({ term: String(term), courses: courses.map(String) })),
      exitExamRequest: plan.exitExamRequest,
    };
    const { issues, missing } = await validateSelections(student, selections, plan.submittedAt ?? undefined);
    if (issues.length || missing.length) {
      return res.status(422).json({ message: "The submitted plan no longer meets graduation requirements.", issues: [...issues, ...missing] });
    }
  }

  const status = decision === "accept" ? "accepted" : "draft";
  const updated = await GraduationPlan.findOneAndUpdate({
    _id: plan._id,
    status: "submitted",
    __v: plan.__v ?? { $exists: false },
  }, {
    $set: { status, responseNote: note, decidedBy: req.user._id, decidedAt: new Date() },
    $inc: { __v: 1 },
  }, { returnDocument: "after", runValidators: true }).lean();
  if (!updated) return conflict();
  res.json({ _id: updated._id, status: updated.status, responseNote: updated.responseNote, decidedAt: updated.decidedAt });
}

export async function listExitExamRequests(_req, res) {
  const requests = await ExitExamRequest.find().select(examFields).populate("course", courseFields)
    .populate(studentDetails).populate("advisor", identityFields).sort({ createdAt: -1, _id: -1 }).lean();
  res.json({ requests });
}

export async function decideExitExam(req, res) {
  const { id } = req.params;
  const { decision } = req.body ?? {};
  const note = responseNote(req.body, 1000);
  if (!isId(id) || !["approve", "reject"].includes(decision) || !note) {
    return res.status(400).json({ message: "Choose a decision and provide a response note of up to 1,000 characters." });
  }
  const status = decision === "approve" ? "approved" : "rejected";
  const request = await ExitExamRequest.findOneAndUpdate({ _id: id, status: "pending" }, {
    $set: { status, responseNote: note, decidedBy: req.user._id, decidedAt: new Date() },
  }, { returnDocument: "after", runValidators: true }).lean();
  if (request) return res.json({ _id: request._id, status, responseNote: note, decidedAt: request.decidedAt });
  if (await ExitExamRequest.exists({ _id: id })) return res.status(409).json({ message: "This exit-exam request has already been decided." });
  return res.status(404).json({ message: "Exit-exam request not found." });
}

export async function getStudentGraduation(req, res) {
  const profile = await StudentProfile.findOne({ user: req.user._id, studentType: "advising" }).select("_id").lean();
  if (!profile) return res.status(404).json({ message: "Advising student profile not found." });
  const owner = { student: profile._id };
  const [plans, exams] = await Promise.all([
    planDetails(GraduationPlan.find({ ...owner, status: "accepted" })
      .select("status termPlans exitExamRequest responseNote submittedAt decidedAt"))
      .sort({ decidedAt: -1, _id: -1 }).lean(),
    ExitExamRequest.find(owner).select("course status responseNote createdAt decidedAt").populate("course", courseFields)
      .sort({ createdAt: -1, _id: -1 }).lean(),
  ]);
  res.json({ plans, exams });
}
