import { StudentSchedule } from "../models/academics.js";
import { ScheduleActivity } from "../models/communications.js";
import { ExtraHoursRequest, MandatoryCourseRemovalRequest, SlotChangeRequest, WholeScheduleSwapRequest } from "../models/requests.js";

export async function loadStudentWorkflows(profiles, termId) {
  const studentIds = profiles.map((profile) => profile._id);
  const [schedules, swapRequests, scheduleActivities, slotChanges, removalRequests, extraHourRequests] = termId && studentIds.length
    ? await Promise.all([
        StudentSchedule.find({ term: termId, student: { $in: studentIds } })
          .select("_id student scheduleType status version updatedAt processedAt createdAt")
          .lean(),
        WholeScheduleSwapRequest.find({ term: termId, student: { $in: studentIds } })
          .select("student status expiresAt updatedAt")
          .sort({ updatedAt: -1 })
          .lean(),
        ScheduleActivity.find({ term: termId, student: { $in: studentIds } })
          .select("student schedule action scheduleVersion occurredAt")
          .sort({ occurredAt: -1 })
          .lean(),
        SlotChangeRequest.find({ term: termId, student: { $in: studentIds } })
          .select("student status updatedAt")
          .lean(),
        MandatoryCourseRemovalRequest.find({ term: termId, student: { $in: studentIds } })
          .select("student status updatedAt")
          .lean(),
        ExtraHoursRequest.find({ term: termId, student: { $in: studentIds } })
          .select("student decisionStatus settlementStatus updatedAt")
          .lean(),
      ])
    : [[], [], [], [], [], []];
  const workflowByStudent = new Map();
  const scheduleCycleStartedAtByStudent = new Map();
  const reopenedAtByStudent = new Map();
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
      if (latestActivity?.action === "reopened") reopenedAtByStudent.set(String(schedule.student), latestActivity.occurredAt);
      scheduleCycleStartedAtByStudent.set(
        String(schedule.student),
        latestActivity?.action === "reopened"
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
  if (termId) {
    for (const profile of profiles) {
      if (workflowByStudent.has(String(profile._id))) continue;
      if (profile.studentType === "advising") {
        applyWorkflow(profile._id, "notStarted", "Create advising schedule", profile.updatedAt, 1);
      } else {
        applyWorkflow(profile._id, "notStarted", "Assign standard schedule", profile.updatedAt, 1);
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
      : request.decisionStatus === "approved" && ["none", "awaitingChoice", "failed"].includes(request.settlementStatus)
        ? "awaitingPaymentChoice"
        : request.decisionStatus === "approved" && request.settlementStatus === "deferred" ? "deferredToNextInstallment" : null;
    if (status === "deferredToNextInstallment") {
      const id = String(request.student);
      const workflow = workflowByStudent.get(id);
      const reopenedAt = reopenedAtByStudent.get(id);
      if (workflow?.status === "processed" || (reopenedAt && request.updatedAt <= reopenedAt)) continue;
    }
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
  return workflowByStudent;
}
