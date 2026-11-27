import { FinancialReversalRequest } from "../models/finance.js";
import { ExitExamRequest, GraduationPlan, MandatoryCourseRemovalRequest } from "../models/requests.js";
import { saveInAppEvents } from "./in-app-notifications.js";

const queues = [
  [GraduationPlan, "submitted", "graduationPlanSubmitted", "Graduation plan submitted", "review", "submittedAt"],
  [ExitExamRequest, "pending", "exitExamRequested", "Exit exam requested", "review", "createdAt"],
  [MandatoryCourseRemovalRequest, "pending", "mandatoryCourseRemovalRequested", "Mandatory course removal requested", "review", "createdAt"],
  [FinancialReversalRequest, "pending", "financialReversalRequested", "Financial reversal requested", "process", "createdAt"],
];

export async function syncCoordinatorNotifications(coordinatorId) {
  const pendingEvents = await Promise.all(queues.map(async ([model, status, type, title, action, dateField]) => {
    const records = await model.find({ status })
      .select(`student ${dateField}`).populate("student", "studentId").lean();
    return records.map(record => ({
      type,
      title,
      message: record.student?.studentId
        ? `Student ${record.student.studentId} has a request for you to ${action}.`
        : `A student request is waiting for you to ${action}.`,
      relatedModel: model.modelName,
      relatedId: record._id,
      occurredAt: record[dateField],
      decisionVersion: dateField === "submittedAt" ? record.submittedAt?.toISOString() : undefined,
    }));
  }));
  await saveInAppEvents(coordinatorId, "coordinator", pendingEvents.flat());
}
