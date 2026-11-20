import mongoose from "mongoose";
import { AcademicTerm } from "../models/catalogue.js";
import { ScheduleActivity } from "../models/communications.js";
import { StudentProfile } from "../models/identity.js";

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

async function queryActivities(req, res, { studentId } = {}) {
  const { action = "", from = "", to = "", search = "", termId = "" } = req.query;
  if (![action, from, to, search, termId].every((value) => typeof value === "string")) return res.status(400).json({ message: "Invalid filter" });
  if (action && !["processed", "reopened"].includes(action)) return res.status(400).json({ message: "Invalid action filter" });
  if (from && !validDate(from)) return res.status(400).json({ message: "Start date must use YYYY-MM-DD" });
  if (to && !validDate(to)) return res.status(400).json({ message: "End date must use YYYY-MM-DD" });
  if (from && to && from > to) return res.status(400).json({ message: "Start date must be on or before end date" });
  if (search.length > 100) return res.status(400).json({ message: "Search must be 100 characters or fewer" });
  if (termId && !mongoose.isValidObjectId(termId)) return res.status(400).json({ message: "Invalid term" });
  if (studentId && !mongoose.isValidObjectId(studentId)) return res.status(400).json({ message: "Invalid student ID" });
  const term = termId ? await AcademicTerm.findById(termId).select("_id code academicYear season").lean() : null;
  if (termId && !term) return res.status(404).json({ message: "Term not found" });
  const profiles = studentId
    ? await StudentProfile.find({ _id: studentId, studentType: "advising" }).select("_id studentId user").populate("user", "fullName email").lean()
    : await StudentProfile.find({ studentType: "advising" }).select("_id studentId user").populate("user", "fullName email").lean();
  if (studentId && !profiles.length) return res.status(404).json({ message: "Advising student not found" });
  const filter = { student: { $in: profiles.map((profile) => profile._id) } };
  if (term) filter.term = term._id;
  if (action) filter.action = action;
  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) {
      const dayAfter = new Date(`${to}T00:00:00.000Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      filter.occurredAt.$lt = dayAfter;
    }
  }
  if (search) {
    const pattern = new RegExp(escaped(search), "i");
    const matchingStudents = profiles.filter((profile) => pattern.test(profile.studentId));
    const studentIds = matchingStudents.map((profile) => profile._id);
    filter.$or = [{ student: { $in: studentIds } }, { actorName: pattern }, { actorEmail: pattern }];
  }
  const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const [total, rows] = await Promise.all([
    ScheduleActivity.countDocuments(filter),
    ScheduleActivity.find(filter).sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .populate("student", "studentId user").populate({ path: "student", populate: { path: "user", select: "fullName email" } })
      .populate("schedule", "version").lean(),
  ]);
  return { term, total, page, limit, activities: rows.map((row) => ({
    id: String(row._id), studentId: row.student?.studentId || "", studentName: row.student?.user?.fullName || "",
    action: row.action, scheduleVersion: row.scheduleVersion, staffName: row.actorName, staffEmail: row.actorEmail,
    staffRole: row.actorRole, occurredAt: row.occurredAt, reason: row.reason || "",
  })) };
}

export async function getScheduleActivity(req, res) {
  try {
    const data = await queryActivities(req, res, { studentId: req.params.studentId });
    if (!res.headersSent) res.json(data);
  } catch (error) {
    console.error("Schedule activity lookup failed:", error.message);
    res.status(500).json({ message: "Unable to load schedule activity" });
  }
}

export async function exportScheduleActivity(req, res) {
  try {
    const firstPage = await queryActivities({ ...req, query: { ...req.query, page: "1", limit: "100" } }, res);
    if (res.headersSent) return;
    const data = firstPage;
    for (let page = 2; page <= Math.ceil(firstPage.total / firstPage.limit); page += 1) {
      const next = await queryActivities({ ...req, query: { ...req.query, page: String(page), limit: "100" } }, res);
      if (res.headersSent) return;
      data.activities.push(...next.activities);
    }
    const quote = (value) => `"${String(value ?? "").replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const lines = [["Student ID", "Action", "Schedule version", "Staff name", "Staff email", "Role", "Date/time", "Reopening reason"],
      ...data.activities.map((row) => [row.studentId, row.action, row.scheduleVersion, row.staffName, row.staffEmail, row.staffRole, row.occurredAt?.toISOString?.() || "", row.reason])];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="schedule-activity.csv"');
    res.send(`\uFEFF${lines.map((line) => line.map(quote).join(",")).join("\r\n")}`);
  } catch (error) {
    console.error("Schedule activity export failed:", error.message);
    res.status(500).json({ message: "Unable to export schedule activity" });
  }
}
