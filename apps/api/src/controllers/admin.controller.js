import { loadStudentWorkflows } from "../services/student-workflow-status.js";
import mongoose from "mongoose";
import { isSmtpConfigured, sendEmail } from "../services/smtp-email.js";
import { Notification } from "../models/communications.js";
import { AcademicTerm } from "../models/catalogue.js";
import { ACADEMIC_STANDINGS, STUDENT_TYPES, WORKFLOW_STATUSES } from "../models/shared.js";
import { AdvisorAssignment, StudentProfile, User } from "../models/identity.js";
import { FinancialReversalRequest } from "../models/finance.js";
import { canonicalMajor } from "../utils/major.js";
import {
  ExtraHoursRequest,
  ExitExamRequest,
  GraduationPlan,
  MandatoryCourseRemovalRequest,
  SlotChangeRequest,
  WholeScheduleSwapRequest,
} from "../models/requests.js";

const filterKeys = [
  "search",
  "studentType",
  "advisor",
  "major",
  "currentSemester",
  "academicStanding",
  "workflowStatus",
  "blockingStep",
  "accountStatus",
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const displayMajor = (value) => {
  const canonical = canonicalMajor(value);
  if (canonical === "cs") return "CS";
  if (canonical === "dmet") return "DMET";
  return String(value ?? "").trim();
};

export function buildStudentSearchFilter(searchPattern, searchUserIds, accountUserIds) {
  const filter = {};
  if (accountUserIds) filter.user = { $in: accountUserIds };
  if (searchPattern) {
    filter.$or = [
      { studentId: searchPattern },
      { user: { $in: searchUserIds } },
    ];
  }
  return filter;
}

export function buildAdvisorFilter(assignedAdvisorIds) {
  return {
    role: "advisor",
    $or: [
      { _id: { $in: assignedAdvisorIds } },
      { isAdvisorInSystem: true },
    ],
  };
}

export async function getStudents(req, res) {
  try {
    for (const key of filterKeys) {
      if (req.query[key] !== undefined && typeof req.query[key] !== "string") {
        return res.status(400).json({ message: "Invalid " + key + " filter" });
      }
    }

    const filters = Object.fromEntries(filterKeys.map((key) => [key, req.query[key]?.trim() ?? ""]));
    const {
      search,
      studentType,
      advisor,
      major,
      currentSemester,
      academicStanding,
      workflowStatus,
      blockingStep,
      accountStatus,
    } = filters;

    if (search.length > 100) return res.status(400).json({ message: "Search must be 100 characters or fewer" });
    if (studentType && !STUDENT_TYPES.includes(studentType)) {
      return res.status(400).json({ message: "Invalid student type" });
    }
    if (advisor && !mongoose.isValidObjectId(advisor)) {
      return res.status(400).json({ message: "Invalid advisor" });
    }
    if (major.length > 100) return res.status(400).json({ message: "Invalid major" });
    if (currentSemester) {
      const semester = Number(currentSemester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 10) {
        return res.status(400).json({ message: "Current semester must be between 1 and 10" });
      }
    }
    if (academicStanding && !ACADEMIC_STANDINGS.includes(academicStanding)) {
      return res.status(400).json({ message: "Invalid academic standing" });
    }
    if (workflowStatus && !WORKFLOW_STATUSES.includes(workflowStatus)) {
      return res.status(400).json({ message: "Invalid workflow status" });
    }
    if (blockingStep.length > 100) return res.status(400).json({ message: "Invalid blocking step" });
    if (accountStatus && !["active", "inactive"].includes(accountStatus)) {
      return res.status(400).json({ message: "Invalid account status" });
    }

    const searchPattern = search ? new RegExp(escapeRegex(search), "i") : null;
    const activeTerm = await AcademicTerm.findOne({ isActive: true })
      .sort({ termStart: -1 })
      .select("code academicYear season")
      .lean();
    const profileFilter = {};

    if (studentType) profileFilter.studentType = studentType;
    if (advisor) profileFilter.assignedAdvisor = advisor;
    if (currentSemester) profileFilter.currentSemester = Number(currentSemester);
    if (academicStanding) profileFilter.academicStanding = academicStanding;

    const searchUserIds = search
      ? await User.distinct("_id", { $or: [{ fullName: searchPattern }, { email: searchPattern }] })
      : [];
    const accountUserIds = accountStatus
      ? await User.distinct("_id", { isActive: accountStatus === "active" })
      : null;
    Object.assign(profileFilter, buildStudentSearchFilter(searchPattern, searchUserIds, accountUserIds));

    const [assignedAdvisorIds, storedMajors] = await Promise.all([
      StudentProfile.distinct("assignedAdvisor", { assignedAdvisor: { $ne: null } }),
      StudentProfile.distinct("major", { major: { $nin: [null, ""] } }),
    ]);
    if (major) {
      const requestedMajor = canonicalMajor(major);
      const matchingStoredMajors = storedMajors.filter((value) => canonicalMajor(value) === requestedMajor);
      profileFilter.major = matchingStoredMajors.length ? { $in: matchingStoredMajors } : major;
    }

    const [profiles, advisors] = await Promise.all([
      StudentProfile.find(profileFilter)
        .select("user studentId studentType major currentSemester academicStanding assignedAdvisor updatedAt")
        .populate("user", "fullName email isActive")
        .populate("assignedAdvisor", "fullName email")
        .sort({ studentId: 1 })
        .lean(),
      User.find(buildAdvisorFilter(assignedAdvisorIds))
        .select("fullName email")
        .sort({ fullName: 1 })
        .lean(),
    ]);

    const workflowByStudent = await loadStudentWorkflows(profiles, activeTerm?._id);
    const blockingSteps = [...new Set([...workflowByStudent.values()].map((workflow) => workflow.blockingStep).filter(Boolean))].sort();
    const visibleProfiles = profiles.filter((profile) => {
      const workflow = workflowByStudent.get(String(profile._id));
      return (!workflowStatus || workflow?.status === workflowStatus) &&
        (!blockingStep || workflow?.blockingStep === blockingStep);
    });

    res.json({
      currentUserRole: req.user.role,
      term: activeTerm ? {
        code: activeTerm.code,
        academicYear: activeTerm.academicYear,
        season: activeTerm.season,
      } : null,
      students: visibleProfiles.map((profile) => {
        const workflow = workflowByStudent.get(String(profile._id));
        return {
          id: String(profile._id),
          studentId: profile.studentId,
          fullName: profile.user?.fullName ?? "",
          email: profile.user?.email ?? "",
          accountStatus: profile.user ? (profile.user.isActive ? "active" : "inactive") : null,
          studentType: profile.studentType,
          major: displayMajor(profile.major),
          currentSemester: profile.currentSemester,
          academicStanding: profile.academicStanding,
          assignedAdvisor: profile.assignedAdvisor ? {
            id: String(profile.assignedAdvisor._id),
            fullName: profile.assignedAdvisor.fullName,
            email: profile.assignedAdvisor.email,
          } : null,
          workflowStatus: workflow?.status ?? null,
          blockingStep: workflow?.blockingStep ?? null,
          lastUpdatedAt: workflow?.lastUpdatedAt ?? null,
        };
      }),
      filters: {
        studentTypes: STUDENT_TYPES,
        academicStandings: ACADEMIC_STANDINGS,
        workflowStatuses: WORKFLOW_STATUSES,
        advisors: advisors.map((user) => ({ id: String(user._id), fullName: user.fullName, email: user.email })),
        majors: [...new Set(storedMajors.map(displayMajor).filter(Boolean))].sort(),
        blockingSteps,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Dashboard data reuses the directory's derived workflow states so staff never edit statuses by hand.
export async function getPendingWork(req, res) {
  let directoryResponse;
  const proxy = {
    status(code) { this.code = code; return this; },
    json(body) { directoryResponse = { code: this.code || 200, body }; return this; },
  };
  await getStudents({ ...req, query: {} }, proxy);
  if (!directoryResponse || directoryResponse.code !== 200) {
    return res.status(directoryResponse?.code || 500).json(directoryResponse?.body || { message: "Unable to load workflow dashboard" });
  }
  const students = directoryResponse.body.students;
  const ids = students.map((student) => student.id);
  const normalStudentIds = students.filter((student) => student.studentType === "normal").map((student) => student.id);
  const term = directoryResponse.body.term;
  let termId = null;
  if (term) termId = await AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 }).select("_id").lean().then((value) => value?._id);
  const currentTermRequests = ids.length ? await Promise.all([
    termId && normalStudentIds.length ? WholeScheduleSwapRequest.find({ term: termId, student: { $in: normalStudentIds }, $or: [{ status: "completed" }, { status: "open", expiresAt: { $gt: new Date() } }] })
      .select("student status expiresAt updatedAt").lean().then((rows) => rows.map((row) => ({ ...row, type: "wholeScheduleSwap" }))) : [],
    termId ? SlotChangeRequest.find({ term: termId, student: { $in: ids }, status: "pending" })
      .select("student status updatedAt").lean().then((rows) => rows.map((row) => ({ ...row, type: "slotChange" }))) : [],
    termId ? MandatoryCourseRemovalRequest.find({ term: termId, student: { $in: ids }, status: "pending" })
      .select("student status updatedAt").lean().then((rows) => rows.map((row) => ({ ...row, type: "mandatoryCourseRemoval" }))) : [],
    termId ? ExtraHoursRequest.find({ term: termId, student: { $in: ids } })
      .select("_id student decisionStatus settlementStatus updatedAt").lean() : [],
    GraduationPlan.find({ student: { $in: ids }, status: "submitted" })
      .select("student status submittedAt updatedAt").lean().then((rows) => rows.map((row) => ({ ...row, updatedAt: row.updatedAt || row.submittedAt, type: "graduationPlan" }))),
    ExitExamRequest.find({ student: { $in: ids }, status: "pending" })
      .select("student status updatedAt").lean().then((rows) => rows.map((row) => ({ ...row, type: "exitExam" }))),
  ]) : [[], [], [], [], [], []];
  const [swapRequests, slotChanges, removalRequests, extraHours, graduationPlans, exitExams] = currentTermRequests;
  const actionableExtraHours = extraHours.filter((request) => request.decisionStatus === "pending" ||
    (request.decisionStatus === "approved" && ["none", "awaitingChoice", "failed", "deferred"].includes(request.settlementStatus)))
    .map((row) => ({ ...row, type: "extraHours" }));
  const financialReversals = ids.length ? await FinancialReversalRequest.find({
    student: { $in: ids }, status: "pending",
  }).select("student extraHoursRequest reversalType status updatedAt").lean()
    .then((rows) => rows.map((row) => ({ ...row, type: "financialReversal" }))) : [];
  const requests = [...swapRequests, ...slotChanges, ...removalRequests, ...actionableExtraHours, ...graduationPlans, ...exitExams, ...financialReversals];
  const requestsByStudent = new Map();
  for (const request of requests) {
    const id = String(request.student);
    const list = requestsByStudent.get(id) || [];
    const status = request.type === "extraHours"
      ? `${request.decisionStatus}${request.settlementStatus && request.settlementStatus !== "none" ? `:${request.settlementStatus}` : ""}`
      : request.status;
    list.push({ id: String(request._id), type: request.type, status, updatedAt: request.updatedAt || null });
    requestsByStudent.set(id, list);
  }
  const approvalBlockers = {
    mandatoryCourseRemoval: "Resolve pending coordinator approval",
    extraHours: "Resolve pending coordinator approval",
    graduationPlan: "Review submitted graduation plan",
    exitExam: "Review exit-exam request",
    financialReversal: "Process financial reversal",
  };
  const rows = students.map((student) => {
    const studentRequests = (requestsByStudent.get(student.id) || []).sort((left, right) =>
      new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0));
    const newestCoordinatorApproval = studentRequests.find((request) => approvalBlockers[request.type] &&
      (request.type !== "extraHours" || request.status === "pending") &&
      (request.type !== "mandatoryCourseRemoval" || request.status === "pending"));
    const baseLastUpdated = student.lastUpdatedAt ? new Date(student.lastUpdatedAt) : null;
    const requestLastUpdated = studentRequests.reduce((latest, request) => {
      const updatedAt = request.updatedAt ? new Date(request.updatedAt) : null;
      return updatedAt && (!latest || updatedAt > latest) ? updatedAt : latest;
    }, null);
    const lastUpdatedAt = !baseLastUpdated || (requestLastUpdated && requestLastUpdated > baseLastUpdated)
      ? requestLastUpdated : baseLastUpdated;
    return {
      ...student,
      workflowStatus: newestCoordinatorApproval ? "pendingApproval" : student.workflowStatus || "notStarted",
      blockingStep: newestCoordinatorApproval ? approvalBlockers[newestCoordinatorApproval.type] : student.blockingStep,
      lastUpdatedAt,
      requests: studentRequests,
    };
  });
  const countBy = (key) => Object.fromEntries([...new Set(rows.map((row) => key(row) || "unassigned"))]
    .sort().map((value) => [value, rows.filter((row) => (key(row) || "unassigned") === value).length]));
  res.json({
    term: directoryResponse.body.term,
    students: rows,
    groups: {
      studentType: countBy((row) => row.studentType),
      advisor: countBy((row) => row.assignedAdvisor?.fullName),
      requestType: Object.fromEntries(["wholeScheduleSwap", "slotChange", "mandatoryCourseRemoval", "extraHours", "graduationPlan", "exitExam", "financialReversal"]
        .map((type) => [type, requests.filter((request) => request.type === type).length])),
    },
  });
}

export async function getStudentDetails(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid student ID" });
  const student = await StudentProfile.findById(req.params.id)
    .select("user studentId studentType faculty major currentSemester gpa academicStanding enrollmentStatus studyGroup advisingReason assignedAdvisor")
    .populate("user", "fullName email role isActive lastLoginAt")
    .populate("assignedAdvisor", "fullName email").lean();
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json(student);
}

export async function setUserStatus(req, res) {
  if (typeof req.body?.isActive !== "boolean") return res.status(400).json({ message: "isActive must be a boolean" });
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid user ID" });
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { isActive: req.body.isActive }, $inc: { authVersion: 1 } },
    { new: true, runValidators: true, select: "fullName email role isActive" },
  );
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
}

function advisorEmail(value) {
  return typeof value === "string" && /^[^\s@]+@guc\.edu\.eg$/i.test(value.trim()) ? value.trim().toLowerCase() : null;
}

export async function lookupAdvisor(req, res) {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@(?:student\.)?guc\.edu\.eg$/i.test(email)) {
    return res.status(400).json({ message: "Enter a valid GUC email" });
  }
  if (email.endsWith("@student.guc.edu.eg")) {
    return res.status(404).json({ message: "Not an advisor" });
  }
  const advisor = await User.findOne({ email }).select("fullName email role isAdvisorInSystem").lean();
  if (!advisor) return res.status(404).json({ message: "Advisor not found" });
  if (advisor.role !== "advisor") return res.status(404).json({ message: "Not an advisor" });
  delete advisor.role;
  res.json(advisor);
}

async function emailAdvisor(advisor, type, title, message) {
  const notification = await Notification.create({ recipient: advisor._id, type, title, message, channels: ["email"], deliveryStatus: "pending" });
  if (!isSmtpConfigured()) return notification;
  try {
    await sendEmail({ to: advisor.email, subject: title, text: message });
    notification.deliveryStatus = "sent";
    notification.sentAt = new Date();
  } catch {
    notification.deliveryStatus = "failed";
  }
  await notification.save();
  return notification;
}

export async function addAdvisor(req, res) {
  const email = advisorEmail(req.body?.email);
  if (!email) return res.status(400).json({ message: "Enter a valid GUC email" });
  const advisor = await User.findOne({ email, role: "advisor" });
  if (!advisor) return res.status(404).json({ message: "Advisor not found" });
  if (advisor.isAdvisorInSystem) return res.status(409).json({ message: "Advisor is already in the advising system" });
  advisor.isAdvisorInSystem = true;
  await advisor.save();
  const notification = await emailAdvisor(advisor, "advisorAssigned", "You have been added to the advising system", "You have been added as an advisor in the university schedule management system.");
  res.status(201).json({ advisor: { id: String(advisor._id), fullName: advisor.fullName, email: advisor.email }, emailStatus: notification.deliveryStatus });
}

export async function removeAdvisor(req, res) {
  const email = advisorEmail(req.params.email);
  if (!email) return res.status(400).json({ message: "Enter a valid GUC email" });
  const isSingle = mongoose.connection.client?.topology?.description?.type === 'Single';
  const session = isSingle ? null : await mongoose.startSession();
  const sessionOpt = session ? { session } : {};
  let advisor;
  let result;
  try {
    if (session) session.startTransaction();
    advisor = await User.findOne({ email, role: "advisor" }, null, sessionOpt);
    if (!advisor) {
      if (session?.inTransaction()) await session.abortTransaction();
      return res.status(404).json({ message: "Advisor not found" });
    }
    if (!advisor.isAdvisorInSystem) {
      if (session?.inTransaction()) await session.abortTransaction();
      return res.status(409).json({ message: "Advisor is not in the advising system" });
    }
    const endedAt = new Date();
    result = await AdvisorAssignment.updateMany(
      { advisor: advisor._id, endedAt: null },
      { $set: { endedAt, endedBy: req.user._id } },
      sessionOpt,
    );
    await StudentProfile.updateMany(
      { assignedAdvisor: advisor._id },
      { $set: { assignedAdvisor: null } },
      sessionOpt,
    );
    advisor.isAdvisorInSystem = false;
    await advisor.save(sessionOpt);
    if (session?.inTransaction()) await session.commitTransaction();
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    if (session) session.endSession();
  }
  const notification = await emailAdvisor(advisor, "advisorRemoved", "You have been removed from the advising system", "You have been removed from the advising system. Your previous schedule activity history has been preserved.");
  res.json({ assignmentsEnded: result.modifiedCount, emailStatus: notification.deliveryStatus });
}
