import { AdvisorAssignment, StudentProfile } from "../models/identity.js";
import { SlotChangeRequest } from "../models/requests.js";
import { saveInAppEvents } from "./in-app-notifications.js";

function assignmentEvent(assignment, student) {
  return {
    type: "advisorAssigned",
    title: "Advising student assigned",
    message: `Advising student ${student.studentId} has been assigned to you.`,
    relatedModel: "AdvisorAssignment",
    relatedId: assignment._id,
    occurredAt: assignment.createdAt,
  };
}

export async function notifyAdvisorOfAssignment(assignment, student, session) {
  await saveInAppEvents(assignment.advisor, "advisor", [assignmentEvent(assignment, student)], session);
}

function containsTime({ createdAt, endedAt }, occurredAt) {
  return occurredAt && createdAt && createdAt <= occurredAt && (!endedAt || occurredAt < endedAt);
}

function slotChangeEvent(request, student, action, occurredAt) {
  const submitted = action === "submitted";
  const course = request.course?.code ? ` for ${request.course.code} (${request.componentType})` : "";
  return {
    type: submitted ? "slotChangeSubmitted" : "slotChangeWithdrawn",
    title: submitted ? "Slot-change request submitted" : "Slot-change request withdrawn",
    message: `Advising student ${student.studentId} ${action} a slot-change request${course}.`,
    relatedModel: "SlotChangeRequest",
    relatedId: request._id,
    occurredAt,
  };
}

export async function syncAdvisorNotifications(advisorId) {
  const advisor = String(advisorId);
  const assignedStudentIds = await AdvisorAssignment.distinct("student", { advisor: advisorId });
  const students = await StudentProfile.find({
    studentType: "advising",
    $or: [{ _id: { $in: assignedStudentIds } }, { assignedAdvisor: advisorId }],
  }).select("studentId assignedAdvisor createdAt updatedAt").lean();
  if (!students.length) return;

  const studentIds = students.map(student => student._id);
  const requests = await SlotChangeRequest.find({ student: { $in: studentIds } })
    .select("student course componentType status createdAt withdrawnAt updatedAt")
    .populate("course", "code").lean();
  // Read the history after the events so a newer reassignment can close the prior interval.
  const assignments = await AdvisorAssignment.find({ student: { $in: studentIds } })
    .select("student advisor createdAt endedAt").sort({ createdAt: -1, _id: -1 }).lean();

  const studentsById = new Map(students.map(student => [String(student._id), student]));
  const historyByStudent = new Map(students.map(student => [String(student._id), []]));
  const events = [];
  for (const assignment of assignments) {
    const studentId = String(assignment.student);
    const student = studentsById.get(studentId);
    historyByStudent.get(studentId).push(assignment);
    if (String(assignment.advisor) === advisor && assignment.createdAt &&
        (assignment.endedAt || String(student.assignedAdvisor) === advisor)) {
      events.push(assignmentEvent(assignment, student));
    }
  }

  for (const request of requests) {
    const id = String(request.student);
    const student = studentsById.get(id);
    const history = historyByStudent.get(id);
    const currentAdvisor = String(student.assignedAdvisor);
    // A legacy profile can attest to its current advisor from its most recent recorded update.
    const intervals = history.length ? history.filter(assignment => assignment.endedAt || String(assignment.advisor) === currentAdvisor)
      : [{ advisor: student.assignedAdvisor, createdAt: student.updatedAt || student.createdAt, endedAt: null }];
    const submittedDuring = intervals.find(interval => containsTime(interval, request.createdAt));
    if (String(submittedDuring?.advisor) === advisor) {
      events.push(slotChangeEvent(request, student, "submitted", request.createdAt));
    }
    if (request.status !== "withdrawn") continue;

    // An undated withdrawal can be attributed when both timestamps fall in the same assignment.
    const lastUpdatedDuring = intervals.find(interval => containsTime(interval, request.updatedAt));
    const withdrawnAt = request.withdrawnAt || (submittedDuring && submittedDuring === lastUpdatedDuring ? request.updatedAt : null);
    const withdrawnDuring = intervals.find(interval => containsTime(interval, withdrawnAt));
    if (String(withdrawnDuring?.advisor) === advisor) {
      events.push(slotChangeEvent(request, student, "withdrew", withdrawnAt));
    }
  }
  await saveInAppEvents(advisorId, "advisor", events);
}
