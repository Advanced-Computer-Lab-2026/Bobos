import { Notification } from "../models/communications.js";
import { FinancialTransaction } from "../models/finance.js";
import { StudentProfile, User } from "../models/identity.js";
import { ExitExamRequest, GraduationPlan, SlotChangeRequest } from "../models/requests.js";
import { inAppNotification, saveInAppEvents } from "./in-app-notifications.js";

export async function notifyStudents(studentFilter, event, session) {
  const profiles = await StudentProfile.find(studentFilter).select("user").session(session).lean();
  if (!profiles.length) return;
  const recipients = await User.find({
    _id: { $in: profiles.map(profile => profile.user) },
    role: `${studentFilter.studentType}Student`,
    isActive: true,
  }).select("_id").session(session).lean();
  if (recipients.length) {
    await Notification.insertMany(recipients.map(user => inAppNotification(user._id, event)), { session });
  }
}

function decisionEvent(record, relatedModel, type, title, decision) {
  return {
    type, title,
    message: `${decision}${record.responseNote ? ` ${record.responseNote}` : ""}`,
    relatedModel, relatedId: record._id, occurredAt: record.decidedAt || record.updatedAt || record.createdAt,
    decisionVersion: relatedModel === "GraduationPlan" ? record.decidedAt?.getTime() : undefined,
  };
}

// These workflows can be integrated independently. Their saved decisions and ledger entries
// are enough to deliver the owner's alerts when the inbox loads.
export async function syncAdvisingNotifications(userId) {
  const student = await StudentProfile.findOne({ user: userId, studentType: "advising" }).select("_id").lean();
  if (!student) return;

  const owner = { student: student._id };
  const decisionFields = "status responseNote decidedAt updatedAt createdAt";
  const [slotChanges, plans, exams, reversals] = await Promise.all([
    SlotChangeRequest.find({ ...owner, status: { $in: ["approved", "rejected"] } }).select(decisionFields).lean(),
    GraduationPlan.find({ ...owner, $or: [
      { status: "accepted" }, { status: { $in: ["draft", "submitted"] }, decidedAt: { $type: "date" } },
    ] }).select(decisionFields).lean(),
    ExitExamRequest.find({ ...owner, status: { $in: ["approved", "rejected"] } }).select(decisionFields).lean(),
    FinancialTransaction.find({
      ...owner, extraHoursRequest: { $ne: null }, status: "succeeded",
      kind: { $in: ["refund", "deferredChargeCancellation"] },
    }).select("kind amount currency occurredAt createdAt").lean(),
  ]);

  const events = [
    ...slotChanges.map(record => decisionEvent(record, "SlotChangeRequest", "slotChangeDecision",
      "Slot-change decision", `Your slot-change request was ${record.status}.`)),
    ...plans.map(record => decisionEvent(record, "GraduationPlan", "graduationPlanDecision",
      "Graduation plan decision", record.status === "accepted"
        ? "Your graduation plan was accepted." : "Your graduation plan was returned to your advisor for revision.")),
    ...exams.map(record => decisionEvent(record, "ExitExamRequest", "exitExamDecision",
      "Exit-exam decision", `Your exit-exam request was ${record.status}.`)),
    ...reversals.map(record => {
      const refunded = record.kind === "refund";
      return {
        type: refunded ? "refundIssued" : "deferredChargeUpdated",
        title: refunded ? "Extra-hours refund issued" : "Deferred extra-hours charge cancelled",
        message: refunded ? `${record.amount} ${record.currency} was refunded to your wallet.`
          : `Your deferred extra-hours charge of ${record.amount} ${record.currency} was cancelled.`,
        relatedModel: "FinancialTransaction", relatedId: record._id, occurredAt: record.occurredAt || record.createdAt,
      };
    }),
  ];
  await saveInAppEvents(userId, "student", events);
}
