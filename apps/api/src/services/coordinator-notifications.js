import { User } from "../models/identity.js";
import { FinancialReversalRequest } from "../models/finance.js";
import { ExitExamRequest, GraduationPlan, MandatoryCourseRemovalRequest } from "../models/requests.js";
import { saveInAppEvents } from "./in-app-notifications.js";

const queues = [
  [GraduationPlan, "submitted", "graduationPlanSubmitted", "Graduation plan submitted", "review", "submittedAt"],
  [ExitExamRequest, "pending", "exitExamRequested", "Exit exam requested", "review", "createdAt"],
  [MandatoryCourseRemovalRequest, "pending", "mandatoryCourseRemovalRequested", "Mandatory course removal requested", "review", "createdAt"],
  [FinancialReversalRequest, "pending", "financialReversalRequested", "Financial reversal requested", "process", "createdAt"],
];

function requestEvent([model, , type, title, action, dateField], record, studentId) {
  return {
    type, title,
    message: studentId
      ? `Student ${studentId} has a request for you to ${action}.`
      : `A student request is waiting for you to ${action}.`,
    relatedModel: model.modelName,
    relatedId: record._id,
    occurredAt: record[dateField],
    decisionVersion: dateField === "submittedAt" ? record.submittedAt?.toISOString() : undefined,
  };
}

export async function notifyCoordinatorsOfRequest(model, record, studentId, session) {
  const queue = queues.find(([item]) => item === model);
  const event = requestEvent(queue, record, studentId);
  const coordinators = await User.distinct("_id", { role: "coordinator", isActive: true }).session(session);
  for (const coordinator of coordinators) {
    await saveInAppEvents(coordinator, "coordinator", [event], session);
  }
}

export async function syncCoordinatorNotifications(coordinatorId) {
  const pendingEvents = await Promise.all(queues.map(async (queue) => {
    const [model, status, , , , dateField] = queue;
    const records = await model.find({ status })
      .select(`student ${dateField}`).populate("student", "studentId").lean();
    return records.map(record => requestEvent(queue, record, record.student?.studentId));
  }));
  await saveInAppEvents(coordinatorId, "coordinator", pendingEvents.flat());
}
