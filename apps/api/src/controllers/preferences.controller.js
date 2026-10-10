import mongoose from "mongoose";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { SchedulingPreference } from "../models/academics.js";
import { DAYS_OF_WEEK } from "../models/shared.js";

const dayFields = ["preferredDays", "avoidedDays", "desiredDaysOff"];
const timeFields = ["preferredTimes", "avoidedTimes"];
const fields = [...dayFields, ...timeFields, "preferredGroups", "note"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;

function validateBody(body) {
  if (!object(body)) throw new Error("Preferences must be a JSON object.");
  if (Object.keys(body).some(key => !fields.includes(key))) throw new Error("Unknown preference field. Student and term are selected by the server and URL.");
  const result = {};
  for (const field of fields.filter(field => field !== "note")) {
    const entries = body[field] === undefined ? [] : body[field];
    if (!Array.isArray(entries)) throw new Error(`${field} must be an array.`);
    const seen = new Set();
    result[field] = entries.map((entry, index) => {
      if (!object(entry)) throw new Error(`${field} entries must be objects.`);
      const allowed = dayFields.includes(field) ? ["day", "priority"]
        : timeFields.includes(field) ? ["startMinute", "endMinute", "priority"]
          : ["course", "componentType", "groupNumber", "priority"];
      if (Object.keys(entry).some(key => !allowed.includes(key))) throw new Error(`Unknown field in ${field}.`);
      const priority = entry.priority === undefined ? index + 1 : entry.priority;
      if (!positiveInteger(priority)) throw new Error("Priority must be a positive integer.");
      let normalized, key;
      if (dayFields.includes(field)) {
        if (!DAYS_OF_WEEK.includes(entry.day)) throw new Error("Day must be a full weekday name, for example Monday.");
        normalized = { day: entry.day, priority };
        key = entry.day;
      } else if (timeFields.includes(field)) {
        const { startMinute, endMinute } = entry;
        if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || endMinute > 1440 || endMinute <= startMinute) {
          throw new Error("Time ranges require integer minutes with 0 <= start < end <= 1440.");
        }
        normalized = { startMinute, endMinute, priority };
        key = `${startMinute}:${endMinute}`;
      } else {
        if (typeof entry.course !== "string" || !mongoose.isValidObjectId(entry.course)) throw new Error("Preferred group requires a valid course ID.");
        if (!["lecture", "tutorial", "lab"].includes(entry.componentType)) throw new Error("Group component must be lecture, tutorial or lab.");
        if (typeof entry.groupNumber !== "string" || !entry.groupNumber.trim()) throw new Error("Group number must be non-empty text.");
        normalized = { course: entry.course.toLowerCase(), componentType: entry.componentType, groupNumber: entry.groupNumber.trim(), priority };
        key = JSON.stringify([normalized.course, normalized.componentType, normalized.groupNumber]);
      }
      if (seen.has(key)) throw new Error(`Duplicate entry in ${field}.`);
      seen.add(key);
      return normalized;
    }).sort((a, b) => a.priority - b.priority);
  }
  if (body.note !== undefined && (typeof body.note !== "string" || body.note.trim().length > 1000)) throw new Error("Note must be text of at most 1000 characters.");
  result.note = body.note?.trim() ?? "";
  return result;
}

async function resolveTerm(req, res) {
  if (Object.keys(req.query).some(key => key !== 'term')) {
    res.status(400).json({ success: false, message: "Only the term query parameter is supported." });
    return null;
  }
  const { term } = req.query;
  if (term !== undefined && (typeof term !== "string" || !mongoose.isValidObjectId(term))) {
    res.status(400).json({ success: false, message: "Invalid academic term ID." });
    return null;
  }
  const terms = term ? [await AcademicTerm.findById(term)] : await AcademicTerm.find({ isActive: true }).limit(2);
  if (!terms.length || !terms[0]) {
    res.status(404).json({ success: false, message: "Academic term not found. Select an existing term." });
    return null;
  }
  if (terms.length > 1) {
    res.status(409).json({ success: false, message: "Multiple terms are active. Select a term explicitly." });
    return null;
  }
  return terms[0];
}

async function preferenceResponse(student, term) {
  const preferences = await SchedulingPreference.findOne({ student, term })
    .populate("preferredGroups.course", "code name").lean();
  if (preferences) {
    for (const field of fields.filter(field => field !== 'note')) {
      preferences[field].sort((a, b) => a.priority - b.priority);
    }
  }
  return { success: true, submitted: Boolean(preferences), advisoryOnly: true, preferences, lastUpdatedAt: preferences?.updatedAt ?? null };
}

function findPreferredGroupConflict(preferredGroups, offerings) {
  for (let firstIndex = 0; firstIndex < preferredGroups.length; firstIndex += 1) {
    const first = preferredGroups[firstIndex];
    const firstCourseId = String(first.course);
    const firstOffering = offerings.find(offering => String(offering.course) === firstCourseId);
    if (!firstOffering) continue;
    const firstSlots = firstOffering.slots.filter(slot => slot.componentType === first.componentType && slot.groupNumber === first.groupNumber);
    for (let secondIndex = firstIndex + 1; secondIndex < preferredGroups.length; secondIndex += 1) {
      const second = preferredGroups[secondIndex];
      if (String(second.course) === firstCourseId) continue;
      const secondOffering = offerings.find(offering => String(offering.course) === String(second.course));
      if (!secondOffering) continue;
      const secondSlots = secondOffering.slots.filter(slot => slot.componentType === second.componentType && slot.groupNumber === second.groupNumber);
      for (const firstSlot of firstSlots) {
        for (const secondSlot of secondSlots) {
          if (firstSlot.day !== secondSlot.day) continue;
          const startMinute = Math.max(firstSlot.startMinute, secondSlot.startMinute);
          const endMinute = Math.min(firstSlot.endMinute, secondSlot.endMinute);
          if (startMinute < endMinute) {
            return {
              firstCode: firstOffering.courseCode,
              firstGroup: `${first.componentType} ${first.groupNumber}`,
              secondCode: secondOffering.courseCode,
              secondGroup: `${second.componentType} ${second.groupNumber}`,
              day: firstSlot.day,
              startMinute,
              endMinute,
            };
          }
        }
      }
    }
  }
  return null;
}

function formatTime(minute) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

// Req 58: absence of preferences is a successful, non-blocking read.
export async function getPreferences(req, res) {
  try {
    const term = await resolveTerm(req, res);
    if (!term) return;
    res.status(200).json(await preferenceResponse(req.studentProfile._id, term._id));
  } catch {
    res.status(500).json({ success: false, message: "Could not retrieve scheduling preferences." });
  }
}

// Req 57: replace this student's preferences for this term only. These hints
// never mutate schedules, seats, prerequisites, mandatory courses or payments.
export async function savePreferences(req, res) {
  let preferences;
  try {
    preferences = validateBody(req.body);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  try {
    const term = await resolveTerm(req, res);
    if (!term) return;
    if (!term.advisingDeadline || !Number.isFinite(term.advisingDeadline.getTime())) {
      return res.status(409).json({ success: false, message: "The term has no valid advising deadline." });
    }
    if (Date.now() >= term.advisingDeadline.getTime()) {
      return res.status(403).json({ success: false, message: "The advising deadline has passed. Preferences cannot be changed." });
    }
    if (preferences.preferredGroups.length) {
      const ids = [...new Set(preferences.preferredGroups.map(group => group.course))];
      const [courses, offerings] = await Promise.all([
        Course.find({ _id: { $in: ids }, isActive: true }).select('_id code').lean(),
        CourseOffering.find({ term: term._id, course: { $in: ids }, isPublished: true }).select('course slots.componentType slots.groupNumber slots.day slots.startMinute slots.endMinute').lean(),
      ]);
      const activeCourses = new Set(courses.map(course => String(course._id)));
      const courseCodes = new Map(courses.map(course => [String(course._id), course.code]));
      offerings.forEach(offering => { offering.courseCode = courseCodes.get(String(offering.course)); });
      const publishedGroups = new Set(offerings.flatMap(offering => offering.slots.map(slot => JSON.stringify([String(offering.course), slot.componentType, slot.groupNumber]))));
      if (preferences.preferredGroups.some(group => !activeCourses.has(group.course) || !publishedGroups.has(JSON.stringify([group.course, group.componentType, group.groupNumber])))) {
        return res.status(400).json({ success: false, message: "Preferred groups must exist in a published offering for the selected term and an active course." });
      }
      const conflict = findPreferredGroupConflict(preferences.preferredGroups, offerings);
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `Selected groups overlap: ${conflict.firstCode} ${conflict.firstGroup} and ${conflict.secondCode} ${conflict.secondGroup} on ${conflict.day}, ${formatTime(conflict.startMinute)}–${formatTime(conflict.endMinute)}. Choose a different group.`,
        });
      }
    }
    // Re-read after group validation so a deadline changed meanwhile is honored.
    const openTerm = await AcademicTerm.exists({ _id: term._id, advisingDeadline: { $gt: new Date() } });
    if (!openTerm) return res.status(403).json({ success: false, message: "The advising deadline has passed. Preferences cannot be changed." });
    const filter = { student: req.studentProfile._id, term: term._id };
    try {
      await SchedulingPreference.findOneAndUpdate(filter, { $set: preferences }, { upsert: true, runValidators: true, returnDocument: 'after' });
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Two first submissions can race; the unique student/term index prevents
      // duplicate rows, and the later complete replacement remains valid.
      await SchedulingPreference.findOneAndUpdate(filter, { $set: preferences }, { runValidators: true, returnDocument: 'after' });
    }
    res.status(200).json(await preferenceResponse(filter.student, filter.term));
  } catch {
    res.status(500).json({ success: false, message: "Could not save scheduling preferences." });
  }
}
