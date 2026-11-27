import { AcademicTerm, StudentSchedule, User } from "../models/index.js";
import { saveInAppEvents } from "./in-app-notifications.js";

const day = 24 * 60 * 60 * 1000;

export async function sendDeadlineReminders(now = new Date()) {
  const terms = await AcademicTerm.find({
    advisingDeadline: { $gt: now, $lte: new Date(now.getTime() + day) },
  }).select("code advisingDeadline").lean();
  for (const term of terms) {
    const schedules = await StudentSchedule.find({
      term: term._id, scheduleType: "advising", status: { $in: ["draft", "readyForStudentReview"] },
    }).select("student").populate("student", "studentId assignedAdvisor").lean();
    const coordinators = await User.distinct("_id", { role: "coordinator", isActive: true });
    for (const schedule of schedules) {
      const student = schedule.student;
      if (!student?.assignedAdvisor) continue;
      const event = {
        type: "advisingDeadlineReminder", title: "Advising deadline approaching",
        message: `Student ${student.studentId} still has an open schedule for ${term.code}. Advising closes ${term.advisingDeadline.toUTCString()}.`,
        relatedModel: "StudentSchedule", relatedId: schedule._id,
        decisionVersion: term.advisingDeadline.toISOString(),
      };
      const recipients = new Set([student.assignedAdvisor, ...coordinators].map(String));
      for (const recipient of recipients) await saveInAppEvents(recipient, "deadline", [event]);
    }
  }
}

export function startDeadlineReminders() {
  async function run() {
    try {
      await sendDeadlineReminders();
    } catch (error) {
      console.error("Could not send advising deadline reminders", error.message);
    } finally {
      setTimeout(run, 60000).unref();
    }
  }
  void run();
}
