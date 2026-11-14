import mongoose from "mongoose";
import { AcademicTerm, Course } from "../models/catalogue.js";
import { StudentProfile } from "../models/identity.js";
import { ExitExamRequest, GraduationPlan } from "../models/requests.js";
import { exitExamEligibility, loadGraduationContext, validateGraduationPlan } from "../services/graduation-planning.js";

const isId = (value) => typeof value === "string" && mongoose.isObjectIdOrHexString(value);
const planView = (plan) => ({
  _id: plan._id,
  status: plan.status,
  termPlans: plan.termPlans,
  exitExamRequest: plan.exitExamRequest,
  responseNote: plan.responseNote,
  updatedAt: plan.updatedAt,
  submittedAt: plan.submittedAt,
  version: plan.__v ?? 0,
});

export async function loadGraduationStudent(req, res, next) {
  const { studentId } = req.params;
  if (!isId(studentId)) return res.status(400).json({ message: "Invalid student profile ID." });
  const student = await StudentProfile.findOne({ _id: studentId, studentType: "advising" }).lean();
  if (!student) return res.status(404).json({ message: "Advising student not found." });
  req.graduationStudent = student;
  next();
}

export async function loadOwnGraduationPlan(req, res, next) {
  if (!isId(req.params.planId)) return res.status(400).json({ message: "Invalid graduation plan ID." });
  const plan = await GraduationPlan.findOne({
    _id: req.params.planId,
    student: req.graduationStudent._id,
    advisor: req.user._id,
  }).lean();
  if (!plan) return res.status(404).json({ message: "Graduation plan not found." });
  req.graduationPlan = plan;
  next();
}

function readSelections(body) {
  if (!Array.isArray(body?.termPlans) || body.termPlans.length > 3) return null;
  if (body.termPlans.some((plan) => !isId(plan?.term) || !Array.isArray(plan.courses) || !plan.courses.every(isId))) return null;
  if (body.exitExamRequest != null && !isId(body.exitExamRequest)) return null;
  return {
    termPlans: body.termPlans.map(({ term, courses }) => ({
      term: term.toLowerCase(),
      courses: courses.map((course) => course.toLowerCase()),
    })),
    exitExamRequest: body.exitExamRequest?.toLowerCase() ?? null,
  };
}

function draftFilter(plan) {
  return { _id: plan._id, advisor: plan.advisor, student: plan.student, status: "draft", __v: plan.__v ?? { $exists: false } };
}

const draftConflict = (res) => res.status(409).json({ message: "This draft is read-only or has changed. Reopen it to see the latest version." });
const hasStaleVersion = (req, plan) => req.body?.version != null && req.body.version !== (plan.__v ?? 0);

export async function validateSelections(student, selections, planningDate) {
  const examId = selections.exitExamRequest;
  const [context, exam] = await Promise.all([
    loadGraduationContext(student, planningDate),
    examId ? ExitExamRequest.findOne({ _id: examId, student: student._id, status: "approved" }).lean() : null,
  ]);
  const validation = validateGraduationPlan(context, selections.termPlans, exam, { reviewing: planningDate !== undefined });
  if (examId && !exam) validation.issues.push("Select an approved exit exam for this student.");
  return validation;
}

export async function getGraduationWorkspace(req, res) {
  const student = req.graduationStudent;
  const owner = { student: student._id, advisor: req.user._id };
  const [context, plans, exams] = await Promise.all([
    loadGraduationContext(student),
    GraduationPlan.find(owner).sort({ updatedAt: -1 }).lean(),
    ExitExamRequest.find({ student: student._id, $or: [{ advisor: req.user._id }, { status: "approved" }] })
      .select("course status responseNote decidedAt").sort({ createdAt: -1 }).lean(),
  ]);
  const savedTerms = plans.flatMap((plan) => plan.termPlans.map(({ term }) => term));
  const savedCourses = plans.flatMap((plan) => plan.termPlans.flatMap(({ courses }) => courses));
  const [termLabels, courseLabels] = await Promise.all([
    AcademicTerm.find({ _id: { $in: savedTerms } }).select("code").lean(),
    Course.find({ _id: { $in: [...savedCourses, ...exams.map(({ course }) => course)] } }).select("code").lean(),
  ]);
  const { course, message } = exitExamEligibility(context);
  res.json({
    terms: context.terms.map(({ creditPolicy, ...term }) => ({
      ...term,
      baseAllowance: creditPolicy.baseAllowance ?? creditPolicy.maximumCreditHours,
      maximumCreditHours: creditPolicy.maximumCreditHours,
      approvedExtraCourses: creditPolicy.approvedExtraCourses,
    })),
    courses: context.courses,
    electiveRequirement: context.electiveRequirement,
    prerequisiteCodes: Object.fromEntries(context.courses.flatMap((course) => course.prerequisites)
      .filter((id) => context.courseCodes.has(id)).map((id) => [id, context.courseCodes.get(id)])),
    savedTermCodes: Object.fromEntries(termLabels.map(({ _id, code }) => [_id, code])),
    savedCourseCodes: Object.fromEntries(courseLabels.map(({ _id, code }) => [_id, code])),
    plans: plans.map(planView),
    exams,
    missingSeasons: context.missingSeasons,
    examEligibility: { courseId: course?._id ?? null, message },
  });
}

export function getGraduationPlan(req, res) {
  res.json(planView(req.graduationPlan));
}

export async function saveGraduationDraft(req, res) {
  const existing = req.graduationPlan;
  if (existing && (existing.status !== "draft" || hasStaleVersion(req, existing))) return draftConflict(res);
  const selections = readSelections(req.body);
  if (!selections) return res.status(400).json({ message: "Provide term and course IDs for the draft." });
  const student = req.graduationStudent;
  const { issues, missing } = await validateSelections(student, selections);
  if (issues.length) return res.status(422).json({ message: "Correct the draft assignments.", issues });

  const plan = existing
    ? await GraduationPlan.findOneAndUpdate(draftFilter(existing), { $set: selections, $inc: { __v: 1 } },
      { returnDocument: "after", runValidators: true })
    : await GraduationPlan.create({ ...selections, student: student._id, advisor: req.user._id });
  if (!plan) return draftConflict(res);
  res.status(existing ? 200 : 201).json({ ...planView(plan), missing });
}

export async function deleteGraduationDraft(req, res) {
  const plan = req.graduationPlan;
  if (plan.status !== "draft" || hasStaleVersion(req, plan)) return draftConflict(res);
  const result = await GraduationPlan.deleteOne(draftFilter(plan));
  if (!result.deletedCount) return draftConflict(res);
  res.sendStatus(204);
}

export async function submitGraduationPlan(req, res) {
  const plan = req.graduationPlan;
  if (plan.status !== "draft" || hasStaleVersion(req, plan)) return draftConflict(res);
  const selections = {
    termPlans: plan.termPlans.map(({ term, courses }) => ({ term: String(term), courses: courses.map(String) })),
    exitExamRequest: plan.exitExamRequest,
  };
  const { issues, missing } = await validateSelections(req.graduationStudent, selections);
  if (issues.length || missing.length) {
    return res.status(422).json({ message: "Complete the graduation plan before submitting.", issues: [...issues, ...missing] });
  }
  const submitted = await GraduationPlan.findOneAndUpdate(draftFilter(plan), {
    $set: { status: "submitted", submittedAt: new Date() },
    $inc: { __v: 1 },
  }, { returnDocument: "after", runValidators: true });
  if (!submitted) return draftConflict(res);
  res.json(planView(submitted));
}

export async function requestExitExam(req, res) {
  const courseId = req.body?.courseId;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!isId(courseId) || !reason || reason.length > 2000) {
    return res.status(400).json({ message: "Select a course and give a reason of 1–2000 characters." });
  }
  const student = req.graduationStudent;
  const { course, message } = exitExamEligibility(await loadGraduationContext(student));
  if (message || course?._id !== courseId.toLowerCase()) {
    return res.status(422).json({ message: message ?? "Select the student's single remaining failed course." });
  }
  const key = { student: student._id, course: course._id };
  const duplicate = () => res.status(409).json({ message: "A pending or approved exit-exam request already exists for this course." });
  if (await ExitExamRequest.exists({ ...key, status: { $in: ["pending", "approved"] } })) return duplicate();
  try {
    const request = await ExitExamRequest.create({ ...key, advisor: req.user._id, reason });
    res.status(201).json({ _id: request._id, course: request.course, status: request.status });
  } catch (error) {
    if (error.code === 11000) return duplicate();
    throw error;
  }
}
