import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { StudentSchedule } from "../models/academics.js";
import { Notification, ScheduleActivity } from "../models/communications.js";
import { AcademicTerm } from "../models/catalogue.js";
import { ACADEMIC_STANDINGS, STUDENT_TYPES, WORKFLOW_STATUSES } from "../models/shared.js";
import { AdvisorAssignment, StudentProfile, User } from "../models/identity.js";
import {
  ExtraHoursRequest,
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
    if (major) profileFilter.major = major;
    if (currentSemester) profileFilter.currentSemester = Number(currentSemester);
    if (academicStanding) profileFilter.academicStanding = academicStanding;

    const searchUserIds = search
      ? await User.distinct("_id", { $or: [{ fullName: searchPattern }, { email: searchPattern }] })
      : [];
    const accountUserIds = accountStatus
      ? await User.distinct("_id", { isActive: accountStatus === "active" })
      : null;
    Object.assign(profileFilter, buildStudentSearchFilter(searchPattern, searchUserIds, accountUserIds));

    const assignedAdvisorIds = await StudentProfile.distinct("assignedAdvisor", { assignedAdvisor: { $ne: null } });
    const [profiles, advisors, majors] = await Promise.all([
      StudentProfile.find(profileFilter)
        .select("user studentId studentType major currentSemester academicStanding assignedAdvisor")
        .populate("user", "fullName email isActive")
        .populate("assignedAdvisor", "fullName email")
        .sort({ studentId: 1 })
        .lean(),
      User.find(buildAdvisorFilter(assignedAdvisorIds))
        .select("fullName email")
        .sort({ fullName: 1 })
        .lean(),
      StudentProfile.distinct("major", { major: { $nin: [null, ""] } }),
    ]);

    const studentIds = profiles.map((profile) => profile._id);
    const [schedules, swapRequests, scheduleActivities, slotChanges, removalRequests, extraHourRequests] = activeTerm && studentIds.length
      ? await Promise.all([
          StudentSchedule.find({ term: activeTerm._id, student: { $in: studentIds } })
            .select("_id student scheduleType status version updatedAt processedAt createdAt")
            .lean(),
          WholeScheduleSwapRequest.find({ term: activeTerm._id, student: { $in: studentIds } })
            .select("student status expiresAt updatedAt")
            .sort({ updatedAt: -1 })
            .lean(),
          ScheduleActivity.find({ term: activeTerm._id, student: { $in: studentIds } })
            .select("student schedule action scheduleVersion occurredAt")
            .sort({ occurredAt: -1 })
            .lean(),
          SlotChangeRequest.find({ term: activeTerm._id, student: { $in: studentIds } })
            .select("student status updatedAt")
            .lean(),
          MandatoryCourseRemovalRequest.find({ term: activeTerm._id, student: { $in: studentIds } })
            .select("student status updatedAt")
            .lean(),
          ExtraHoursRequest.find({ term: activeTerm._id, student: { $in: studentIds } })
            .select("student decisionStatus settlementStatus updatedAt")
            .lean(),
        ])
      : [[], [], [], [], [], []];
    const workflowByStudent = new Map();
    const scheduleCycleStartedAtByStudent = new Map();
    const applyWorkflow = (student, status, blockingStep, updatedAt, priority) => {
      const id = String(student);
      const current = workflowByStudent.get(id);
      const time = updatedAt ? new Date(updatedAt) : null;
      const lastUpdatedAt = !current?.lastUpdatedAt || time > current.lastUpdatedAt
        ? time
        : current.lastUpdatedAt;
      if (!current || priority > current.priority ||
        (priority === current.priority && time && (!current.statusUpdatedAt || time >= current.statusUpdatedAt))) {
        workflowByStudent.set(id, { status, blockingStep, lastUpdatedAt, statusUpdatedAt: time, priority });
      } else {
        current.lastUpdatedAt = lastUpdatedAt;
      }
    };
    const latestActivityBySchedule = new Map();
    for (const activity of scheduleActivities) {
      const key = String(activity.schedule);
      if (!latestActivityBySchedule.has(key)) latestActivityBySchedule.set(key, activity);
    }
    for (const schedule of schedules) {
      const latestActivity = latestActivityBySchedule.get(String(schedule._id));
      if (schedule.scheduleType === "advising") {
        scheduleCycleStartedAtByStudent.set(
          String(schedule.student),
          latestActivity?.action === "reopened" && latestActivity.scheduleVersion === schedule.version
            ? latestActivity.occurredAt
            : schedule.createdAt,
        );
      }
      const reopened = schedule.scheduleType === "advising" && schedule.status === "draft" &&
        latestActivity?.action === "reopened" && latestActivity.scheduleVersion === schedule.version;
      const status = schedule.scheduleType === "advising"
        ? reopened ? "reopened" : schedule.status
        : schedule.status === "processed" ? "scheduleAssigned" : null;
      if (status) {
        const scheduleUpdatedAt = schedule.updatedAt ?? schedule.processedAt ?? schedule.createdAt ?? null;
        const lastUpdatedAt = latestActivity?.occurredAt &&
          (!scheduleUpdatedAt || latestActivity.occurredAt > scheduleUpdatedAt)
          ? latestActivity.occurredAt
          : scheduleUpdatedAt;
        applyWorkflow(schedule.student, status, {
          draft: "Complete draft schedule",
          reopened: "Complete reopened schedule",
        }[status] ?? null,
        lastUpdatedAt, schedule.scheduleType === "normal" ? 2 : 1);
      }
    }
    if (activeTerm) {
      for (const profile of profiles) {
        if (profile.studentType === "advising" && !workflowByStudent.has(String(profile._id))) {
          applyWorkflow(profile._id, "notStarted", "Create advising schedule", null, 1);
        }
      }
    }
    const resolvedWorkflowByStudent = new Map();
    const markResolved = (request) => {
      const id = String(request.student);
      const updatedAt = request.updatedAt;
      if (!resolvedWorkflowByStudent.has(id) || updatedAt > resolvedWorkflowByStudent.get(id)) {
        resolvedWorkflowByStudent.set(id, updatedAt);
      }
    };
    const now = new Date();
    for (const request of swapRequests) {
      const expired = request.status === "open" && request.expiresAt <= now;
      const status = expired ? "swapExpired" : {
        open: "swapRequestOpen",
        completed: "swapCompleted",
        withdrawn: "swapWithdrawn",
        expired: "swapExpired",
      }[request.status];
      if (status) {
        applyWorkflow(request.student, status, null, expired ? request.expiresAt : request.updatedAt, 2);
      }
    }
    for (const request of slotChanges) {
      if (request.status === "pending") {
        applyWorkflow(request.student, "changeRequestPending", "Resolve pending slot-change requests", request.updatedAt, 3);
      } else {
        markResolved(request);
      }
    }
    for (const request of removalRequests) {
      if (request.status === "pending") {
        applyWorkflow(request.student, "pendingApproval", "Resolve pending coordinator approval", request.updatedAt, 4);
      } else {
        markResolved(request);
      }
    }
    for (const request of extraHourRequests) {
      const status = request.decisionStatus === "pending"
        ? "pendingApproval"
        : request.decisionStatus === "approved" && ["none", "awaitingChoice", "failed", "cancelled"].includes(request.settlementStatus)
          ? "awaitingPaymentChoice"
          : request.decisionStatus === "approved" && request.settlementStatus === "deferred" ? "deferredToNextInstallment" : null;
      if (status) {
        applyWorkflow(request.student, status, {
          pendingApproval: "Resolve pending coordinator approval",
          awaitingPaymentChoice: "Choose payment option",
        }[status] ?? null, request.updatedAt, status === "pendingApproval" ? 4 : 3);
      } else {
        markResolved(request);
      }
    }
    for (const profile of profiles) {
      const workflow = workflowByStudent.get(String(profile._id));
      const resolvedAt = resolvedWorkflowByStudent.get(String(profile._id));
      const cycleStartedAt = scheduleCycleStartedAtByStudent.get(String(profile._id));
      if (profile.studentType === "advising" && workflow?.status === "readyForStudentReview" &&
        resolvedAt && cycleStartedAt && resolvedAt >= cycleStartedAt) {
        applyWorkflow(profile._id, "readyToProcess", null, resolvedAt, 2);
      }
    }
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
          major: profile.major,
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
        majors: majors.filter(Boolean).sort(),
        blockingSteps,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
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
  const email = advisorEmail(req.query.email);
  if (!email) return res.status(400).json({ message: "Enter a valid GUC email" });
  const advisor = await User.findOne({ email, role: "advisor" }).select("fullName email isAdvisorInSystem").lean();
  if (!advisor) return res.status(404).json({ message: "Advisor not found" });
  res.json(advisor);
}

async function emailAdvisor(advisor, type, title, message) {
  const notification = await Notification.create({ recipient: advisor._id, type, title, message, channels: ["email"], deliveryStatus: "pending" });
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return notification;
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === undefined ? port === 465 : process.env.SMTP_SECURE === "true";
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      requireTLS: !secure && process.env.SMTP_REQUIRE_TLS !== "false",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM, to: advisor.email, subject: title, text: message });
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
  const session = await mongoose.startSession();
  let advisor;
  let result;
  try {
    session.startTransaction();
    advisor = await User.findOne({ email, role: "advisor" }, null, { session });
    if (!advisor) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Advisor not found" });
    }
    if (!advisor.isAdvisorInSystem) {
      await session.abortTransaction();
      return res.status(409).json({ message: "Advisor is not in the advising system" });
    }
    const endedAt = new Date();
    result = await AdvisorAssignment.updateMany(
      { advisor: advisor._id, endedAt: null },
      { $set: { endedAt, endedBy: req.user._id } },
      { session },
    );
    await StudentProfile.updateMany(
      { assignedAdvisor: advisor._id },
      { $set: { assignedAdvisor: null } },
      { session },
    );
    advisor.isAdvisorInSystem = false;
    await advisor.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
  const notification = await emailAdvisor(advisor, "advisorRemoved", "You have been removed from the advising system", "You have been removed from the advising system. Your previous schedule activity history has been preserved.");
  res.json({ assignmentsEnded: result.modifiedCount, emailStatus: notification.deliveryStatus });
}
