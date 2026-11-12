import { StudentTermStanding } from "../models/academics.js";
import { AcademicTerm } from "../models/catalogue.js";
import { Notification } from "../models/communications.js";
import { StudentProfile } from "../models/identity.js";
import { isSmtpConfigured, sendEmail } from "./smtp-email.js";

const REGULAR_SEMESTERS = ["winter", "spring"];
const STUDENT_EMAIL = /^[^\s@]+@student\.guc\.edu\.eg$/i;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const SUBJECT = "Academic probation warning";

async function recentCompletedSemesters(now) {
  const terms = await AcademicTerm.find({ season: { $in: REGULAR_SEMESTERS }, termStart: { $lte: now } })
    .select("code academicYear season termStart termEnd").sort({ termStart: -1, termEnd: -1, _id: -1 }).lean();
  const semesters = new Map();
  for (const term of terms) {
    // The existing seeds use both 2025/2026 and 2025-2026 for the same year.
    const year = /^(\d{4})(?:\s*[/–—-]\s*(?:\d{4}|\d{2}))?$/.exec(term.academicYear)?.[1] ?? term.academicYear;
    const key = `${year}:${term.season}`;
    const semester = semesters.get(key);
    if (semester) {
      semester.termIds.push(term._id);
      if (term.termEnd > semester.termEnd) semester.termEnd = term.termEnd;
    } else {
      semesters.set(key, { ...term, year, key, termIds: [term._id] });
    }
  }
  return [...semesters.values()].filter(semester => semester.termEnd <= now).slice(0, 3);
}

function areConsecutive(earlier, later) {
  if (!earlier || !later || earlier.season === later.season || earlier.termEnd > later.termStart) return false;
  if (earlier.year === later.year) return true;
  // Consecutive semesters across academic years share the calendar year of the summer break.
  return Number(later.year) === Number(earlier.year) + 1 &&
    earlier.termEnd.getUTCFullYear() === later.termStart.getUTCFullYear();
}

async function warningRecipients(second, first, preceding, now, studentId) {
  const termPositions = new Map();
  [second, first, preceding].forEach((semester, index) => {
    for (const id of semester?.termIds ?? []) termPositions.set(String(id), index);
  });
  const standings = await StudentTermStanding.find({
    term: { $in: [...termPositions.keys()] },
    calculatedAt: { $lte: now },
    ...(studentId ? { student: studentId } : {}),
  }).select("student term academicStanding")
    .sort({ calculatedAt: -1, updatedAt: -1, _id: -1 }).lean();

  const histories = new Map();
  for (const standing of standings) {
    const id = String(standing.student);
    if (!histories.has(id)) histories.set(id, []);
    const semester = termPositions.get(String(standing.term));
    histories.get(id)[semester] ??= standing.academicStanding;
  }
  const studentIds = [...histories].filter(([, [current, previous, older]]) =>
    current === "probation" && previous === "probation" && older !== "probation").map(([id]) => id);

  return StudentProfile.find({ _id: { $in: studentIds }, studentType: "advising", enrollmentStatus: { $ne: "inactive" } })
    .select("user")
    .populate({
      path: "user",
      match: { role: "advisingStudent", isActive: true, email: STUDENT_EMAIL },
      select: "email fullName",
    }).lean();
}

async function deliverWarning(student, first, second) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + DELIVERY_LEASE_MS);
  const deduplicationKey = `probationWarning:${student._id}:${second.key}`;
  const message = `Dear ${student.user.fullName},\n\nYour academic standing was probation for two consecutive semesters (${first.code} and ${second.code}). If you do not leave probation in the following semester, you may face termination from the university.\n\nPlease contact your academic advisor to discuss your next steps.`;
  let notification;
  try {
    notification = await Notification.findOneAndUpdate(
      {
        deduplicationKey,
        deliveryStatus: { $in: ["pending", "failed"] },
        $or: [{ deliveryLeaseUntil: null }, { deliveryLeaseUntil: { $lte: now } }],
      },
      {
        $setOnInsert: { deduplicationKey, type: "probationWarning", title: SUBJECT, channels: ["email"] },
        $set: {
          recipient: student.user._id, message, deliveryStatus: "pending", deliveryLeaseUntil: leaseUntil,
          relatedModel: "AcademicTerm", relatedId: String(second._id),
        },
      },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
  } catch (error) {
    // An existing warning already holds the lease or has been sent.
    if (error.code === 11000 && error.keyPattern?.deduplicationKey) return;
    throw error;
  }

  const claim = { _id: notification._id, deliveryLeaseUntil: leaseUntil };
  try {
    await sendEmail({
      to: student.user.email, subject: SUBJECT, text: message,
      messageId: `<probation-warning.${notification._id}@bobos>`,
    });
  } catch {
    await Notification.updateOne(claim, { $set: { deliveryStatus: "failed" }, $unset: { deliveryLeaseUntil: "" } });
    return "failed";
  }
  await Notification.updateOne(claim, {
    $set: { deliveryStatus: "sent", sentAt: new Date() },
    $unset: { deliveryLeaseUntil: "" },
  });
  return "sent";
}

export async function sendProbationWarnings({ now = new Date(), studentId } = {}) {
  const result = { sent: 0, failed: 0 };
  if (!isSmtpConfigured()) return result;

  const [second, first, older] = await recentCompletedSemesters(now);
  if (!areConsecutive(first, second)) return result;
  const preceding = areConsecutive(older, first) ? older : null;
  const students = await warningRecipients(second, first, preceding, now, studentId);
  for (const student of students) {
    if (!student.user) continue;
    const outcome = await deliverWarning(student, first, second);
    if (outcome) result[outcome] += 1;
  }
  return result;
}

export function probationWarningsEnabled() {
  const setting = process.env.PROBATION_WARNINGS_ENABLED ?? (process.env.NODE_ENV === "production" ? "true" : "false");
  return setting === "true";
}

export function startProbationWarnings() {
  if (!isSmtpConfigured()) {
    console.warn("Probation warning emails require SMTP_HOST and SMTP_FROM.");
    return;
  }
  async function check() {
    try {
      const { failed } = await sendProbationWarnings();
      if (failed) console.warn(`Could not deliver ${failed} probation warning email(s). Delivery will be retried.`);
    } catch (error) {
      console.error("Could not check probation warnings:", error.name);
    } finally {
      setTimeout(check, CHECK_INTERVAL_MS).unref();
    }
  }
  void check();
}
