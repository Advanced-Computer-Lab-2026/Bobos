import mongoose from "mongoose";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { StudentProfile, User } from "../models/identity.js";
import { CourseAttempt, ScheduleTemplate, SchedulingPreference, StudentSchedule } from "../models/academics.js";
import { ExtraHoursRequest, MandatoryCourseRemovalRequest, WholeScheduleSwapRequest } from "../models/requests.js";
import { ScheduleActivity } from "../models/communications.js";
import { calculateDraftCreditPolicy } from "../utils/credit-allowance.js";
import { majorMatches } from "../utils/major.js";
import { buildWeeklyCalendar } from "../../../../server/src/utils/weeklyCalendar.js";
import { toMinutes, findFirstClash, describeSlot, slotsOverlap } from "../../../../server/src/utils/timetable.js";
import { buildRegisteredCourses } from "../../../../server/src/utils/registeredCourses.js";
import { buildCourseDetails, findCourseEntry } from "../../../../server/src/utils/courseDetails.js";
import { buildPdfModel, renderSchedulePdf } from "../../../../server/src/utils/schedulePdf.js";

const TEACHING_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const STUDENT_ROLES = ["normalStudent", "advisingStudent"];
const STAFF_ROLES = ["advisor", "coordinator", "administrator"];
const NO_VISIBLE_SCHEDULE = "No schedule is available to view yet.";
const NOT_FINAL_YET = "Your schedule is not final yet. You can download it once it has been processed.";
const COURSE_NOT_REGISTERED = "This course is not in your registered courses.";

const idOf = (value) => value == null ? null : String(value._id || value);
const clock = (minute) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const isId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);
const REGEX_META = new Set(".*+?^${}()|[]");
const escapedRegex = (value) => [...value].map((character) =>
  REGEX_META.has(character) || character.charCodeAt(0) === 92
    ? String.fromCharCode(92) + character
    : character
).join("");

async function resolveTerm(termId) {
  if (termId) {
    if (typeof termId !== "string" || !termId.trim()) return { error: { status: 400, message: "Invalid termId" } };
    const identifier = termId.trim();
    const term = isId(identifier)
      ? await AcademicTerm.findById(identifier)
      : await AcademicTerm.findOne({ code: identifier });
    return term ? { term } : { error: { status: 404, message: "Academic term not found" } };
  }
  const term = await AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 });
  return term ? { term } : { error: { status: 404, message: "No active academic term is defined. Pass ?termId=..." } };
}

async function resolveStudent(studentId) {
  if (!studentId || typeof studentId !== "string") return null;
  const byId = isId(studentId) ? await StudentProfile.findById(studentId) : null;
  const student = byId || await StudentProfile.findOne({ studentId: studentId.trim() });
  return student ? StudentProfile.populate(student, { path: "user", select: "fullName email role isActive" }) : null;
}

function termView(term) {
  return {
    _id: term._id,
    code: term.code,
    academicYear: term.academicYear,
    season: term.season,
    isActive: term.isActive,
    swapDeadline: term.wholeScheduleSwapDeadline || null,
  };
}

function studentView(student, schedule = null) {
  return {
    _id: student._id,
    studentId: student.studentId,
    fullName: student.user?.fullName || null,
    email: student.user?.email || null,
    studentType: student.studentType,
    major: student.major,
    currentSemester: student.currentSemester,
    academicStanding: student.academicStanding,
    isActive: student.user?.isActive ?? student.enrollmentStatus === "active",
    assignment: schedule ? {
      scheduleId: schedule._id,
      studyGroup: schedule.template?.studyGroup || schedule.studyGroup || student.studyGroup || null,
      template: schedule.template || null,
      status: schedule.status,
      assignedAt: schedule.processedAt || schedule.updatedAt || null,
      courseCount: schedule.courses?.length || 0,
    } : null,
  };
}

function slotView(slot, courseCode) {
  if (!Number.isInteger(slot.startMinute) || !Number.isInteger(slot.endMinute) || slot.endMinute <= slot.startMinute) {
    return { error: `A schedule slot for ${courseCode} has invalid meeting times.` };
  }
  if (!TEACHING_DAYS.includes(slot.day)) return { error: `A schedule slot for ${courseCode} uses an unsupported teaching day.` };
  return {
    slotId: slot._id,
    type: slot.componentType,
    groupNumber: slot.groupNumber,
    day: slot.day,
    startTime: clock(slot.startMinute),
    endTime: clock(slot.endMinute),
    room: slot.room,
  };
}

function eligibleOffering(offering, major, semester, studyGroup) {
  return (offering.eligibleGroups || []).some((group) =>
    group.major === major && (group.semester == null || Number(group.semester) === Number(semester)) &&
    (!group.studyGroup || String(group.studyGroup) === String(studyGroup))
  );
}

async function resolveTemplates(templates, { student } = {}) {
  const offeringIds = new Set();
  const courseIds = new Set();
  for (const template of templates) {
    for (const course of template.courses || []) {
      if (course.courseOffering) offeringIds.add(idOf(course.courseOffering));
      if (course.course) courseIds.add(idOf(course.course));
      for (const slot of course.slots || []) if (slot.courseOffering) offeringIds.add(idOf(slot.courseOffering));
    }
  }
  const [offerings, courses] = await Promise.all([
    CourseOffering.find({ _id: { $in: [...offeringIds] } }).lean(),
    Course.find({ _id: { $in: [...courseIds] } }).lean(),
  ]);
  const offeringById = new Map(offerings.map((offering) => [idOf(offering._id), offering]));
  const courseById = new Map(courses.map((course) => [idOf(course._id), course]));

  return new Map(templates.map((template) => {
    const entries = [];
    const flatSlots = [];
    const seenCourses = new Set();
    const seenSlotRefs = new Set();
    let error = null;
    if (!template.courses?.length) error = `Study group ${template.studyGroup} has no courses in its template.`;

    for (const templateCourse of template.courses || []) {
      if (error) break;
      const courseId = idOf(templateCourse.course);
      const offeringId = idOf(templateCourse.courseOffering);
      const course = courseById.get(courseId);
      const offering = offeringById.get(offeringId);
      const courseCode = course?.code || "unknown course";
      if (!course || !offering) {
        error = `Study group ${template.studyGroup} references a course or offering that no longer exists.`;
        break;
      }
      if (seenCourses.has(courseId)) {
        error = `Study group ${template.studyGroup} contains ${courseCode} more than once.`;
        break;
      }
      seenCourses.add(courseId);
      if (idOf(offering.course) !== courseId || idOf(offering.term) !== idOf(template.term)) {
        error = `The offering for ${courseCode} does not match the course and term in this template.`;
        break;
      }
      if (!offering.isPublished) {
        error = `The course offering for ${courseCode} is not published for this term.`;
        break;
      }
      const eligibilityTarget = student || { major: template.major, currentSemester: template.semester };
      if (!eligibleOffering(offering, eligibilityTarget.major, eligibilityTarget.currentSemester, template.studyGroup)) {
        error = `${courseCode} is not offered to ${eligibilityTarget.major} semester ${eligibilityTarget.currentSemester} group ${template.studyGroup}.`;
        break;
      }

      const slots = [];
      const selectedSlots = templateCourse.slots || [];
      if (!selectedSlots.length) {
        error = `No lecture, tutorial, or lab slot is selected for ${courseCode} in group ${template.studyGroup}.`;
        break;
      }
      for (const slotRef of selectedSlots) {
        const slotOfferingId = idOf(slotRef.courseOffering || templateCourse.courseOffering);
        const slotOffering = offeringById.get(slotOfferingId);
        const slotId = idOf(slotRef.slotGroupId);
        const slot = slotOffering?.slots?.find((candidate) => idOf(candidate._id) === slotId);
        if (!slot || slotOfferingId !== offeringId || slot.componentType !== slotRef.componentType) {
          error = `The ${slotRef.componentType || "selected"} slot for ${courseCode} no longer matches its template. Update the template before assigning students.`;
          break;
        }
        const slotKey = `${slotOfferingId}:${slotId}`;
        if (seenSlotRefs.has(slotKey)) {
          error = `A schedule slot is referenced more than once in group ${template.studyGroup}.`;
          break;
        }
        seenSlotRefs.add(slotKey);
        const viewed = slotView(slot, courseCode);
        if (viewed.error) { error = viewed.error; break; }
        const enriched = {
          ...viewed,
          offeringId: slotOfferingId,
          courseCode,
          capacity: Number(slot.capacity) || 0,
          assignedStudentCount: Number(slot.assignedStudentCount) || 0,
        };
        slots.push(viewed);
        flatSlots.push(enriched);
      }
      if (error) break;
      entries.push({
        course: course._id,
        courseCode: course.code,
        courseName: course.name,
        creditHours: course.creditHours,
        courseType: course.courseType,
        offering: offering._id,
        instructors: offering.instructors || [],
        slots,
      });
    }
    return [idOf(template._id), { entries, slots: flatSlots, error }];
  }));
}

function scheduleCourses(resolvedEntries) {
  return resolvedEntries.map((entry) => ({
    course: entry.course,
    courseOffering: entry.offering,
    slots: entry.slots.map((slot) => ({
      componentType: slot.type,
      courseOffering: entry.offering,
      slotGroupId: slot.slotId,
    })),
    isMandatory: false,
    isExtraHours: false,
    creditHoursSnapshot: entry.creditHours,
  }));
}

async function resolveStoredSchedule(schedule, session = null) {
  const offeringIds = new Set();
  const courseIds = new Set();
  for (const scheduledCourse of schedule.courses || []) {
    if (scheduledCourse.course) courseIds.add(idOf(scheduledCourse.course));
    for (const slot of scheduledCourse.slots || []) if (slot.courseOffering) offeringIds.add(idOf(slot.courseOffering));
    if (scheduledCourse.courseOffering) offeringIds.add(idOf(scheduledCourse.courseOffering));
  }
  const offeringQuery = CourseOffering.find({ _id: { $in: [...offeringIds] } }).lean();
  const courseQuery = Course.find({ _id: { $in: [...courseIds] } }).lean();
  const [offerings, courses] = session
    ? [await offeringQuery.session(session), await courseQuery.session(session)]
    : await Promise.all([offeringQuery, courseQuery]);
  const offeringById = new Map(offerings.map((offering) => [idOf(offering._id), offering]));
  const courseById = new Map(courses.map((course) => [idOf(course._id), course]));
  const entries = [];
  for (const scheduledCourse of schedule.courses || []) {
    const course = courseById.get(idOf(scheduledCourse.course));
    if (!course) return { error: "A course in this schedule no longer exists in the catalogue." };
    const slots = [];
    for (const ref of scheduledCourse.slots || []) {
      const offeringId = idOf(ref.courseOffering || scheduledCourse.courseOffering);
      const offering = offeringById.get(offeringId);
      const slot = offering?.slots?.find((candidate) => idOf(candidate._id) === idOf(ref.slotGroupId));
      if (!slot || slot.componentType !== ref.componentType) {
        return { error: `A scheduled slot for ${course.code} no longer exists. The schedule needs to be reviewed.` };
      }
      const viewed = slotView(slot, course.code);
      if (viewed.error) return { error: viewed.error };
      slots.push(viewed);
    }
    entries.push({
      course: course._id,
      courseCode: course.code,
      courseName: course.name,
      creditHours: Number(scheduledCourse.creditHoursSnapshot) || 0,
      courseType: course.courseType,
      offering: scheduledCourse.courseOffering || null,
      instructors: offeringById.get(idOf(scheduledCourse.courseOffering))?.instructors || [],
      slots,
    });
  }
  return { entries };
}

export async function processAdvisingSchedule(req, res) {
  if (!isId(req.params.studentId)) return res.status(400).json({ message: "Invalid student ID" });
  const student = await StudentProfile.findById(req.params.studentId).select("_id studentType assignedAdvisor studentId");
  if (!student || student.studentType !== "advising") return res.status(404).json({ message: "Advising student not found" });
  if (req.user.role === "advisor" && idOf(student.assignedAdvisor) !== idOf(req.user._id)) return res.status(403).json({ message: "You may only process schedules for your assigned students" });
  const termResult = await resolveTerm(req.body?.termId);
  if (termResult.error) return res.status(termResult.error.status).json({ message: termResult.error.message });
  const schedule = await StudentSchedule.findOne({ student: student._id, term: termResult.term._id, scheduleType: "advising" });
  if (!schedule || schedule.status !== "readyForStudentReview") return res.status(409).json({ message: "Only a schedule ready for student review can be processed" });
  schedule.status = "processed";
  schedule.processedBy = req.user._id;
  schedule.processedAt = new Date();
  await schedule.save();
  await ScheduleActivity.create({ student: student._id, term: schedule.term, schedule: schedule._id, action: "processed", scheduleVersion: schedule.version, actor: req.user._id, actorName: req.user.fullName, actorEmail: req.user.email, actorRole: req.user.role });
  res.json({ message: "Advising schedule processed", schedule });
}

export async function reopenAdvisingSchedule(req, res) {
  if (!isId(req.params.studentId)) return res.status(400).json({ message: "Invalid student ID" });
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason || reason.length > 2000) return res.status(400).json({ message: "Provide a reopening reason of at most 2,000 characters" });
  const student = await StudentProfile.findById(req.params.studentId).select("_id studentType assignedAdvisor");
  if (!student || student.studentType !== "advising") return res.status(404).json({ message: "Advising student not found" });
  if (req.user.role === "advisor" && idOf(student.assignedAdvisor) !== idOf(req.user._id)) return res.status(403).json({ message: "You may only reopen schedules for your assigned students" });
  const termResult = await resolveTerm(req.body?.termId);
  if (termResult.error) return res.status(termResult.error.status).json({ message: termResult.error.message });
  const schedule = await StudentSchedule.findOne({ student: student._id, term: termResult.term._id, scheduleType: "advising" });
  if (!schedule || schedule.status !== "processed") return res.status(409).json({ message: "Only a processed advising schedule can be reopened" });
  schedule.status = "draft";
  schedule.version += 1;
  schedule.processedBy = null;
  schedule.processedAt = null;
  await schedule.save();
  await ScheduleActivity.create({ student: student._id, term: schedule.term, schedule: schedule._id, action: "reopened", scheduleVersion: schedule.version, actor: req.user._id, actorName: req.user.fullName, actorEmail: req.user.email, actorRole: req.user.role, reason });
  res.json({ message: "Advising schedule reopened", schedule });
}

function accessToSchedule(viewer, student, schedule) {
  if (STUDENT_ROLES.includes(viewer.role)) {
    if (idOf(student.user) !== idOf(viewer._id)) return { status: 403, message: "Students may only view their own schedule." };
    if (!schedule) return { status: 404, message: NO_VISIBLE_SCHEDULE };
    if (viewer.role === "normalStudent" && schedule.status !== "processed") return { status: 404, message: NO_VISIBLE_SCHEDULE };
    if (viewer.role === "advisingStudent" && !["readyForStudentReview", "processed"].includes(schedule.status)) {
      return { status: 404, message: NO_VISIBLE_SCHEDULE };
    }
    return { status: 200, readOnly: true };
  }
  if (viewer.role === "advisor") {
    if (student.studentType !== "advising" || idOf(student.assignedAdvisor) !== idOf(viewer._id)) {
      return { status: 403, message: "Advisors may view schedules only for their assigned advising students." };
    }
  } else if (!STAFF_ROLES.includes(viewer.role)) {
    return { status: 403, message: "Insufficient permissions" };
  }
  if (!schedule) return { status: 404, message: NO_VISIBLE_SCHEDULE };
  return { status: 200, readOnly: viewer.role === "administrator" };
}

async function findStudentSchedule(student, term) {
  const scheduleType = student.studentType === "advising" ? "advising" : "normal";
  return StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType }).populate("template", "studyGroup major semester term isPublished");
}

async function sendSchedule(req, res, student, term) {
  const schedule = await findStudentSchedule(student, term);
  const access = accessToSchedule(req.user, student, schedule);
  if (access.status !== 200) return res.status(access.status).json({ message: access.message });
  const resolved = await resolveStoredSchedule(schedule);
  if (resolved.error) return res.status(409).json({ message: resolved.error });
  const calendar = buildWeeklyCalendar(resolved.entries);
  return res.json({
    term: termView(term),
    student: studentView(student),
    schedule: {
      _id: schedule._id,
      status: schedule.status,
      studyGroup: schedule.template?.studyGroup || student.studyGroup || null,
      assignedAt: schedule.processedAt || schedule.updatedAt || null,
      ...calendar,
    },
    readOnly: access.readOnly,
  });
}

async function ownStudentOr403(req, res) {
  if (!STUDENT_ROLES.includes(req.user.role)) {
    res.status(403).json({ message: "Only students have their own schedule." });
    return null;
  }
  const student = await StudentProfile.findOne({ user: req.user._id }).populate("user", "fullName email role isActive");
  if (!student) {
    res.status(404).json({ message: "No student record is linked to this account." });
    return null;
  }
  return student;
}

async function withOwnSchedule(req, res, callback) {
  const student = await ownStudentOr403(req, res);
  if (!student) return;
  const { term, error } = await resolveTerm(req.query.termId);
  if (error) return res.status(error.status).json({ message: error.message });
  const schedule = await findStudentSchedule(student, term);
  const access = accessToSchedule(req.user, student, schedule);
  if (access.status !== 200) return res.status(access.status).json({ message: access.message });
  const resolved = await resolveStoredSchedule(schedule);
  if (resolved.error) return res.status(409).json({ message: resolved.error });
  return callback({ student, term, schedule, entries: resolved.entries, access });
}

export async function listAssignmentTerms(_req, res, next) {
  try {
    const terms = await AcademicTerm.find({ code: { $not: /^C2DEMO/i } }).select("code academicYear season isActive termStart termEnd wholeScheduleSwapDeadline")
      .sort({ termStart: -1 }).lean();
    res.json({ terms: terms.map(termView) });
  } catch (error) { next(error); }
}

export async function listNormalStudents(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    const filter = { studentType: "normal" };
    if (req.query.major) filter.major = String(req.query.major).trim();
    if (req.query.semester) {
      const semester = Number(req.query.semester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 10) return res.status(400).json({ message: "semester must be between 1 and 10" });
      filter.currentSemester = semester;
    }
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length > 100) return res.status(400).json({ message: "search must be at most 100 characters" });
    if (search) {
      const rx = new RegExp(escapedRegex(search), "i");
      const userIds = await User.find({ $or: [{ fullName: rx }, { email: rx }] }).distinct("_id");
      filter.$or = [{ studentId: rx }, { user: { $in: userIds } }];
    }
    const students = await StudentProfile.find(filter).populate("user", "fullName email role isActive").sort({ studentId: 1 }).lean();
    const schedules = await StudentSchedule.find({ term: term._id, scheduleType: "normal", student: { $in: students.map((student) => student._id) } })
      .select("student template status processedAt courses").populate("template", "studyGroup").lean();
    const schedulesByStudent = new Map(schedules.map((schedule) => [idOf(schedule.student), schedule]));
    let rows = students.map((student) => studentView(student, schedulesByStudent.get(idOf(student._id))));
    if (req.query.assigned === "true") rows = rows.filter((row) => row.assignment);
    if (req.query.assigned === "false") rows = rows.filter((row) => !row.assignment);
    if (req.query.assigned && !["true", "false"].includes(req.query.assigned)) return res.status(400).json({ message: "assigned must be true or false" });
    res.json({ term: termView(term), count: rows.length, students: rows });
  } catch (error) { next(error); }
}

export async function listAssignableGroups(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    const filter = { term: term._id, isPublished: true };
    if (req.query.major) filter.major = String(req.query.major).trim();
    if (req.query.semester) {
      const semester = Number(req.query.semester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 10) return res.status(400).json({ message: "semester must be between 1 and 10" });
      filter.semester = semester;
    }
    const templates = await ScheduleTemplate.find(filter).sort({ major: 1, semester: 1, studyGroup: 1 }).lean();
    const resolvedById = await resolveTemplates(templates);
    const counts = await StudentSchedule.aggregate([
      { $match: { term: term._id, scheduleType: "normal", template: { $in: templates.map((template) => template._id) } } },
      { $group: { _id: "$template", count: { $sum: 1 } } },
    ]);
    const assignedByTemplate = new Map(counts.map((row) => [idOf(row._id), row.count]));
    const groups = templates.map((template) => {
      const resolved = resolvedById.get(idOf(template._id)) || { entries: [], slots: [], error: "Could not resolve template." };
      const capacities = resolved.slots.map((slot) => Math.max(0, slot.capacity - slot.assignedStudentCount));
      return {
        _id: template._id,
        term: template.term,
        major: template.major,
        semester: template.semester,
        studyGroup: template.studyGroup,
        isPublished: template.isPublished,
        courseCount: resolved.entries.length,
        courseCodes: resolved.entries.map((entry) => entry.courseCode),
        totalCreditHours: resolved.entries.reduce((sum, entry) => sum + Number(entry.creditHours || 0), 0),
        assignedStudents: assignedByTemplate.get(idOf(template._id)) || 0,
        minRemainingCapacity: capacities.length ? Math.min(...capacities) : null,
        slots: resolved.slots,
        issue: resolved.error,
      };
    });
    res.json({ term: termView(term), count: groups.length, groups });
  } catch (error) { next(error); }
}

export async function getStudentAssignment(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    const student = await resolveStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const schedule = await findStudentSchedule(student, term);
    res.json({ term: termView(term), student: studentView(student, schedule), schedule });
  } catch (error) { next(error); }
}

function canManageAdvisingStudent(viewer, student) {
  if (student.studentType !== "advising") return { status: 400, message: "Draft schedules are only available for advising students." };
  if (student.enrollmentStatus !== "active" || student.user?.isActive === false) return { status: 409, message: "Inactive advising students cannot receive a new or updated draft schedule." };
  if (viewer.role === "advisor" && idOf(student.assignedAdvisor) !== idOf(viewer._id)) {
    return { status: 403, message: "Advisors may manage drafts only for their assigned advising students." };
  }
  return null;
}

function offeringEligibleForStudent(offering, student) {
  const course = offering.course;
  const majorIsEligible = !course.facultyMajors?.length || course.facultyMajors.some((major) => majorMatches(major, student.major));
  return majorIsEligible && (offering.eligibleGroups || []).some((group) =>
    majorMatches(group.major, student.major) && (group.semester == null || Number(group.semester) === Number(student.currentSemester)) &&
    (!group.studyGroup || !student.studyGroup || String(group.studyGroup) === String(student.studyGroup))
  );
}

function groupDraftOffering(offering, preferenceGroups, reservedSlots) {
  const byComponent = new Map();
  for (const slot of offering.slots || []) {
    const key = `${slot.componentType}:${slot.groupNumber}`;
    const group = byComponent.get(key) || {
      componentType: slot.componentType,
      groupNumber: slot.groupNumber,
      slots: [],
      availableSeats: Number.MAX_SAFE_INTEGER,
      preferredPriorities: [],
      valid: true,
    };
    const remainingCapacity = Math.max(0, slot.capacity - (slot.assignedStudentCount || 0));
    group.slots.push({
      slotGroupId: slot._id,
      day: slot.day,
      startTime: clock(slot.startMinute),
      endTime: clock(slot.endMinute),
      room: slot.room,
      capacity: slot.capacity,
      assignedStudentCount: slot.assignedStudentCount || 0,
      remainingCapacity,
    });
    if (!TEACHING_DAYS.includes(slot.day) || !Number.isInteger(slot.startMinute) || !Number.isInteger(slot.endMinute) || slot.endMinute <= slot.startMinute) group.valid = false;
    group.availableSeats = Math.min(group.availableSeats, remainingCapacity);
    byComponent.set(key, group);
  }
  const courseId = idOf(offering.course);
  const groups = [...byComponent.values()];
  for (const group of groups) {
    const preferred = preferenceGroups.filter((item) => idOf(item.course?._id || item.course) === courseId &&
      item.componentType === group.componentType && item.groupNumber === group.groupNumber);
    group.preferredPriorities = preferred.map((item) => item.priority).sort((a, b) => a - b);
    group.reservedForStudent = group.slots.every((slot) => reservedSlots.has(`${offering._id}:${slot.slotGroupId}`));
    if (group.availableSeats === Number.MAX_SAFE_INTEGER || !group.valid) group.availableSeats = 0;
  }
  return {
    _id: offering._id,
    course: {
      _id: offering.course._id,
      code: offering.course.code,
      name: offering.course.name,
      creditHours: offering.course.creditHours,
      courseType: offering.course.courseType,
      prerequisites: (offering.course.prerequisites || []).map((item) => ({ _id: item._id, code: item.code, name: item.name })),
    },
    instructors: offering.instructors || [],
    components: [...new Set(groups.map((group) => group.componentType))],
    groups,
  };
}

async function resolveDraftContext(req, res) {
  const student = await resolveStudent(req.params.studentId);
  if (!student) {
    res.status(404).json({ message: "Student not found." });
    return null;
  }
  const accessError = canManageAdvisingStudent(req.user, student);
  if (accessError) {
    res.status(accessError.status).json({ message: accessError.message });
    return null;
  }
  const termResult = await resolveTerm(req.query.termId);
  if (termResult.error) {
    res.status(termResult.error.status).json({ message: termResult.error.message });
    return null;
  }
  return { student, term: termResult.term };
}

async function loadDraftData(student, term, session = null) {
  const queries = [
    SchedulingPreference.findOne({ student: student._id, term: term._id }).populate("preferredGroups.course", "code name").lean(),
    StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: "advising" }).lean(),
    CourseOffering.find({ term: term._id, isPublished: true }).populate({ path: "course", match: { isActive: true }, select: "code name creditHours courseType facultyMajors prerequisites isActive", populate: { path: "prerequisites", select: "code name" } }).lean(),
    CourseAttempt.distinct("course", { student: student._id, result: "passed" }),
    CourseAttempt.distinct("course", { student: student._id, $or: [{ result: "failed" }, { attendance: "unattended" }] }),
    MandatoryCourseRemovalRequest.distinct("course", { student: student._id, term: term._id, status: "approved" }),
    ExtraHoursRequest.find({ student: student._id, term: term._id, decisionStatus: "approved", settlementStatus: { $in: ["paid", "deferred"] } })
      .populate("courses.course", "code creditHours").lean(),
  ];
  const results = [];
  // MongoDB transactions require operations on their session to run sequentially.
  if (session) {
    for (const query of queries) results.push(await query.session(session));
  } else {
    results.push(...await Promise.all(queries));
  }
  const [preference, schedule, publishedOfferings, passedCourseIds, mandatoryCourseIds, removedCourseIds, extraHoursRequests] = results;
  const creditPolicy = calculateDraftCreditPolicy(student, extraHoursRequests);
  const reservedSlots = collectSlotRefs(schedule?.seatsReserved ? schedule.courses : []);
  const preferenceGroups = [...(preference?.preferredGroups || [])].sort((a, b) => a.priority - b.priority);
  const availableOfferingRecords = publishedOfferings.filter((offering) => offering.course && offeringEligibleForStudent(offering, student));
  const offerings = availableOfferingRecords
    .map((offering) => groupDraftOffering(offering, preferenceGroups, reservedSlots))
    .sort((a, b) => a.course.code.localeCompare(b.course.code));
  const passed = new Set(passedCourseIds.map(idOf));
  const removed = new Set(removedCourseIds.map(idOf));
  const mandatoryIds = [...new Set(mandatoryCourseIds.map(idOf))].filter((courseId) => !passed.has(courseId) && !removed.has(courseId));
  const coursesById = new Map(offerings.map((offering) => [idOf(offering.course._id), offering.course]));
  const missingMandatoryIds = mandatoryIds.filter((courseId) => !coursesById.has(courseId));
  const missingMandatoryCourses = missingMandatoryIds.length
    ? await Course.find({ _id: { $in: missingMandatoryIds } }).select("code name creditHours courseType").session(session).lean()
    : [];
  const mandatoryCourses = [
    ...mandatoryIds.map((courseId) => coursesById.get(courseId)).filter(Boolean).map((course) => ({ ...course, availableForTerm: true })),
    ...missingMandatoryCourses.map((course) => ({ ...course, availableForTerm: false })),
  ];
  const currentSelections = [];
  let staleCourseCount = 0;
  if (schedule) {
    const availableOfferings = new Map(offerings.map((offering) => [idOf(offering._id), offering]));
    for (const scheduledCourse of schedule.courses || []) {
      const offering = availableOfferings.get(idOf(scheduledCourse.courseOffering));
      if (!offering) { staleCourseCount += 1; continue; }
      const choices = new Map();
      for (const slotRef of scheduledCourse.slots || []) {
        const group = offering.groups.find((candidate) => candidate.componentType === slotRef.componentType && candidate.slots.some((slot) => idOf(slot.slotGroupId) === idOf(slotRef.slotGroupId)));
        const slot = group?.slots.find((candidate) => idOf(candidate.slotGroupId) === idOf(slotRef.slotGroupId));
        if (slot && group) choices.set(`${group.componentType}:${group.groupNumber}`, { componentType: group.componentType, groupNumber: group.groupNumber });
      }
      currentSelections.push({ courseOffering: idOf(scheduledCourse.courseOffering), groups: [...choices.values()] });
    }
  }
  return {
    preference: preference ? {
      preferredDays: [...(preference.preferredDays || [])].sort((a, b) => a.priority - b.priority),
      avoidedDays: [...(preference.avoidedDays || [])].sort((a, b) => a.priority - b.priority),
      preferredTimes: [...(preference.preferredTimes || [])].sort((a, b) => a.priority - b.priority),
      avoidedTimes: [...(preference.avoidedTimes || [])].sort((a, b) => a.priority - b.priority),
      desiredDaysOff: [...(preference.desiredDaysOff || [])].sort((a, b) => a.priority - b.priority),
      preferredGroups: preferenceGroups,
      note: preference.note || "",
    } : null,
    preferenceLastUpdatedAt: preference?.updatedAt || null,
    creditPolicy,
    offerings,
    availableOfferingRecords,
    storedSchedule: schedule,
    mandatoryCourses,
    passedCourseIds: [...passed],
    schedule: schedule ? {
      _id: schedule._id,
      status: schedule.status,
      version: schedule.version,
      updatedAt: schedule.updatedAt,
      totalCreditHours: (schedule.courses || []).reduce((total, course) => total + Number(course.creditHoursSnapshot || 0), 0),
      staleCourseCount,
      courses: currentSelections,
    } : null,
  };
}

function validateDraftSelections(data, selections) {
  const issues = [];
  const addIssue = (code, message, blocksSave = true, status = 409) => {
    issues.push({ code, message, blocksSave, status });
  };
  const offeringById = new Map(data.availableOfferingRecords.map((offering) => [idOf(offering._id), offering]));
  const reserved = collectSlotRefs(data.storedSchedule?.seatsReserved ? data.storedSchedule.courses : []);
  const approvedExtraHours = new Map(data.creditPolicy.approvedExtraCourses.map(({ courseId, hours }) => [courseId, hours]));
  const mandatoryIds = new Set(data.mandatoryCourses.map((course) => idOf(course._id)));
  const selectedCourseIds = new Set();
  const passed = new Set(data.passedCourseIds);
  const courses = [];
  const flatSlots = [];
  if (!selections.length) addIssue("emptySchedule", "Add at least one course before sending this schedule for student review.", false);

  for (const selection of selections) {
    if (!selection || Object.keys(selection).some((key) => !["courseOffering", "groups"].includes(key)) || !isId(selection.courseOffering) || !Array.isArray(selection.groups)) {
      throw draftError(400, "Each course selection needs a valid courseOffering and a groups array.");
    }
    const offering = offeringById.get(selection.courseOffering.toLowerCase());
    if (!offering) {
      addIssue("unavailableOffering", `Offering ${selection.courseOffering} is unpublished, unavailable, or ineligible for this student and term.`, true, 400);
      continue;
    }
    const course = offering.course;
    const courseId = idOf(course);
    if (selectedCourseIds.has(courseId)) {
      throw draftError(400, `${course.code} can only be selected once.`);
    }
    selectedCourseIds.add(courseId);
    if (passed.has(courseId)) addIssue("passedCourse", `${course.code} has already been passed and cannot be scheduled again in this draft.`);
    const missingPrerequisites = (course.prerequisites || []).filter((item) => !passed.has(idOf(item)));
    if (missingPrerequisites.length) {
      addIssue("prerequisites", `${course.code} requires previously passed ${missingPrerequisites.map((item) => item.code).join(", ")}.`);
    }

    const chosenComponents = new Set();
    const slotRefs = [];
    for (const group of selection.groups) {
      if (!group || Object.keys(group).some((key) => !["componentType", "groupNumber"].includes(key)) ||
        !["lecture", "tutorial", "lab"].includes(group.componentType) || typeof group.groupNumber !== "string" || !group.groupNumber.trim()) {
        throw draftError(400, "Each selected group needs a componentType and groupNumber.");
      }
      if (chosenComponents.has(group.componentType)) {
        throw draftError(400, `Choose only one ${group.componentType} group for ${course.code}.`);
      }
      chosenComponents.add(group.componentType);
      const selectedSlots = offering.slots.filter((slot) => slot.componentType === group.componentType && slot.groupNumber === group.groupNumber.trim());
      if (!selectedSlots.length) {
        addIssue("unavailableSlot", `${course.code} ${group.componentType} group ${group.groupNumber} is no longer available.`, true, 400);
      }
      for (const slot of selectedSlots) {
        const count = slot.assignedStudentCount ?? 0;
        const ownSeat = reserved.has(`${offering._id}:${slot._id}`);
        if (count > slot.capacity || (!ownSeat && count >= slot.capacity)) {
          addIssue("capacity", `${course.code} ${slot.componentType} group ${slot.groupNumber} is full.`);
        } else if (ownSeat && count === 0) {
          addIssue("capacity", `${course.code} ${slot.componentType} group ${slot.groupNumber} has an inconsistent reservation count.`);
        }
        const viewed = slotView(slot, course.code);
        if (viewed.error) addIssue("invalidSlot", viewed.error);
        else flatSlots.push({ ...viewed, courseCode: course.code });
        slotRefs.push({ componentType: slot.componentType, courseOffering: offering._id, slotGroupId: slot._id });
      }
    }
    for (const component of new Set(offering.slots.map((slot) => slot.componentType))) {
      if (!chosenComponents.has(component)) addIssue("missingSlot", `${course.code} needs a ${component} group.`, false);
    }
    if (!offering.slots.length) addIssue("missingSlot", `${course.code} has no scheduled groups.`, false);
    courses.push({
      course: course._id,
      courseOffering: offering._id,
      slots: slotRefs,
      isMandatory: mandatoryIds.has(courseId),
      isExtraHours: approvedExtraHours.has(courseId),
      creditHoursSnapshot: course.creditHours,
    });
  }

  const missingMandatory = data.mandatoryCourses.filter((course) => !selectedCourseIds.has(idOf(course._id)));
  const includesElective = courses.some((course) => !course.isMandatory);
  for (const course of missingMandatory) {
    const message = course.availableForTerm
      ? `Add the required failed/unattended courses before adding other courses: ${course.code} is missing.`
      : `Required failed/unattended course ${course.code} has no eligible published offering for this term.`;
    addIssue("missingMandatoryCourse", message, includesElective);
  }
  for (const [index, slot] of flatSlots.entries()) {
    for (const other of flatSlots.slice(index + 1)) {
      if (slotsOverlap(slot, other)) {
        addIssue("timetableClash", `Selected groups overlap: ${describeSlot(slot)} overlaps ${describeSlot(other)}. Choose a different group.`);
      }
    }
  }
  const total = courses.reduce((sum, course) => sum + course.creditHoursSnapshot, 0);
  const { baseAllowance, maximumCreditHours, probation } = data.creditPolicy;
  const selectedApprovedExtraHours = courses.reduce((sum, course) => sum + Math.min(approvedExtraHours.get(idOf(course.course)) || 0, course.creditHoursSnapshot), 0);
  const extraNeeded = total - (baseAllowance ?? 34);
  if (total > maximumCreditHours + 1e-9) {
    addIssue("creditHours", `The draft totals ${total} credit hours, above the allowed ${maximumCreditHours}${probation ? " probation" : ""} hours for this student. Only approved and activated extra hours count.`);
  } else if (extraNeeded > selectedApprovedExtraHours + 1e-9) {
    addIssue("creditHours", `The draft exceeds the standard ${baseAllowance}-hour allowance. Include the student's approved extra-hours courses after they are paid or deferred; approval alone does not activate them.`);
  }
  return { courses, issues };
}

function draftError(status, message, validationIssues) {
  return Object.assign(new Error(message), { status, validationIssues });
}

function sendDraftError(error, res, next) {
  if (error.code === 11000) return res.status(409).json({ message: "A draft was created at the same time. Reload it before saving." });
  if (!error.status) return next(error);
  return res.status(error.status).json({ message: error.message, validationIssues: error.validationIssues });
}

export async function getAdvisingDraft(req, res, next) {
  try {
    const context = await resolveDraftContext(req, res);
    if (!context) return;
    const { availableOfferingRecords, storedSchedule, ...data } = await loadDraftData(context.student, context.term);
    const selections = data.schedule?.courses || [];
    const { courses, issues } = validateDraftSelections({ ...data, availableOfferingRecords, storedSchedule }, selections);
    const resolvedSlots = collectSlotRefs(courses);
    const availableIds = new Set(selections.map((selection) => selection.courseOffering));
    for (const course of storedSchedule?.courses || []) {
      if (!availableIds.has(idOf(course.courseOffering))) {
        issues.push({ code: "unavailableOffering", message: `Saved offering ${course.courseOffering} is unpublished, unavailable, or ineligible for this student and term.`, blocksSave: true });
        continue;
      }
      for (const [key] of collectSlotRefs([course])) {
        if (!resolvedSlots.has(key)) {
          issues.push({ code: "unavailableSlot", message: `A saved slot for offering ${course.courseOffering} is no longer available.`, blocksSave: true });
        }
      }
    }
    res.json({ term: termView(context.term), student: studentView(context.student), ...data, validationIssues: issues, editable: !data.schedule || data.schedule.status === "draft" });
  } catch (error) { sendDraftError(error, res, next); }
}

function readDraftSelections(body) {
  if (!Array.isArray(body?.courses) || body.courses.length > 100) {
    throw draftError(400, "courses must be an array of at most 100 course selections.");
  }
  return body.courses;
}

export async function validateAdvisingDraft(req, res, next) {
  try {
    const selections = readDraftSelections(req.body);
    const context = await resolveDraftContext(req, res);
    if (!context) return;
    const data = await loadDraftData(context.student, context.term);
    res.json({ validationIssues: validateDraftSelections(data, selections).issues });
  } catch (error) { sendDraftError(error, res, next); }
}

export async function saveAdvisingDraft(req, res, next) {
  try {
    const selections = readDraftSelections(req.body);
    if (Object.keys(req.body).some((key) => !["version", "courses", "submitForReview"].includes(key))) {
      throw draftError(400, "Send only version, courses, and optional submitForReview in the draft request.");
    }
    const { version, submitForReview } = req.body;
    if (!Number.isSafeInteger(version) || version < 0) throw draftError(400, "version must be a non-negative integer.");
    if (submitForReview !== undefined && typeof submitForReview !== "boolean") throw draftError(400, "submitForReview must be a boolean.");
    const context = await resolveDraftContext(req, res);
    if (!context) return;
    const { student, term } = context;
    const status = submitForReview ? "readyForStudentReview" : "draft";
    const { schedule, created } = await mongoose.connection.transaction(async (session) => {
      const data = await loadDraftData(student, term, session);
      const existing = data.storedSchedule;
      if (existing && existing.status !== "draft") {
        throw draftError(409, "Only an open draft can be edited. This schedule has already moved to student review or processing.");
      }
      if ((existing?.version || 0) !== version) throw draftError(409, "This draft changed since it was loaded. Reload it before saving.");
      const { courses, issues } = validateDraftSelections(data, selections);
      const blockingIssue = issues.find((issue) => issue.blocksSave || submitForReview);
      if (blockingIssue) throw draftError(submitForReview ? 409 : blockingIssue.status, blockingIssue.message, issues);

      await updateDraftReservations(existing, courses, session);
      const changes = { courses, status, seatsReserved: true };
      if (!existing) {
        const [schedule] = await StudentSchedule.create([{
          student: student._id, term: term._id, scheduleType: "advising", createdBy: req.user._id, ...changes,
        }], { session });
        return { schedule, created: true };
      }
      const schedule = await StudentSchedule.findOneAndUpdate(
        { _id: existing._id, version, status: "draft" },
        { $set: changes, $inc: { version: 1 } },
        { session, returnDocument: "after", runValidators: true },
      );
      if (!schedule) throw draftError(409, "This draft changed while it was being saved. Reload it and try again.");
      return { schedule, created: false };
    });
    const message = submitForReview ? "Schedule saved and sent for student review." : created ? "Draft schedule created." : "Draft schedule updated.";
    res.status(created ? 201 : 200).json({ message, schedule });
  } catch (error) { sendDraftError(error, res, next); }
}

async function updateDraftReservations(existing, courses, session) {
  const previous = collectSlotRefs(existing?.seatsReserved ? existing.courses : []);
  const selected = collectSlotRefs(courses);
  const keys = [...new Set([...previous.keys(), ...selected.keys()])].sort();
  for (const key of keys) {
    const oldRef = previous.get(key);
    const newRef = selected.get(key);
    const { offeringId, slotId } = newRef || oldRef;
    const delta = (newRef?.count || 0) - (oldRef?.count || 0);
    const result = await CourseOffering.updateOne(
      { _id: offeringId, ...(newRef ? { isPublished: true } : {}), "slots._id": slotId },
      { $inc: { __v: 1, ...(delta ? { "slots.$.assignedStudentCount": delta } : {}) } },
      { session },
    );
    // A retained slot still gets a write so a concurrent change to the
    // offering invalidates the snapshot used for timetable/capacity validation.
    if (result.matchedCount !== 1 && newRef) {
      throw draftError(409, "A selected slot changed while saving. Reload the draft and try again.");
    }
    if (delta < 0 && result.matchedCount) {
      const invalid = await CourseOffering.exists({ _id: offeringId, slots: { $elemMatch: { _id: slotId, assignedStudentCount: { $lt: 0 } } } }).session(session);
      if (invalid) throw draftError(409, "A previous slot has an inconsistent seat count. Contact an administrator.");
    }
  }
}

function collectSlotRefs(courses) {
  const refs = new Map();
  for (const course of courses || []) {
    for (const slot of course.slots || []) {
      const offeringId = idOf(slot.courseOffering || course.courseOffering);
      const slotId = idOf(slot.slotGroupId);
      if (!offeringId || !slotId) continue;
      const key = `${offeringId}:${slotId}`;
      const current = refs.get(key) || { offeringId, slotId, count: 0 };
      current.count += 1;
      refs.set(key, current);
    }
  }
  return refs;
}

async function changeSlotCount({ offeringId, slotId, delta, capacity = Number.MAX_SAFE_INTEGER }) {
  if (!delta) return true;
  const bounds = delta > 0
    ? { $gte: 0, $lte: capacity - delta }
    : { $gte: -delta };
  const result = await CourseOffering.updateOne(
    { _id: offeringId, slots: { $elemMatch: { _id: slotId, assignedStudentCount: bounds } } },
    { $inc: { "slots.$.assignedStudentCount": delta, __v: 1 } },
  );
  return result.modifiedCount === 1;
}

async function rollbackSlotChanges(changes) {
  for (const change of [...changes].reverse()) {
    try { await changeSlotCount({ ...change, delta: -change.delta }); }
    catch (error) { console.error("Failed to roll back a schedule slot count", error.message); }
  }
}

export async function assignStudentToGroup(req, res, next) {
  const applied = [];
  let savedSchedule = null;
  let wasNew = false;
  let oldScheduleState = null;
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ message: "Request body must be a JSON object" });
    const { studentId, termId, studyGroup, templateId } = req.body;
    if (typeof studentId !== "string" || !studentId.trim() || (studyGroup == null && templateId == null)) {
      return res.status(400).json({ message: "studentId and either studyGroup or templateId are required" });
    }
    if (termId != null && termId !== "" && typeof termId !== "string") return res.status(400).json({ message: "Invalid termId" });
    if (templateId != null && !isId(templateId)) return res.status(400).json({ message: "Invalid templateId" });
    const student = await resolveStudent(studentId.trim());
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (student.studentType !== "normal" || student.enrollmentStatus !== "active" || student.user?.isActive === false) {
      return res.status(400).json({ message: "Only active normal students can be assigned to a standard schedule group." });
    }
    const termResult = await resolveTerm(termId || undefined);
    if (termResult.error) return res.status(termResult.error.status).json({ message: termResult.error.message });
    const { term } = termResult;
    const templateFilter = { term: term._id, major: student.major, semester: student.currentSemester };
    if (templateId) templateFilter._id = templateId;
    else templateFilter.studyGroup = String(studyGroup).trim();
    const template = await ScheduleTemplate.findOne(templateFilter).lean();
    if (!template) return res.status(404).json({ message: "No standard schedule group exists for this student and term." });
    if (!template.isPublished) return res.status(409).json({ message: `Study group ${template.studyGroup} is not published.` });
    const resolved = (await resolveTemplates([template], { student })).get(idOf(template._id));
    if (resolved.error) return res.status(409).json({ message: resolved.error });
    const clash = findFirstClash(resolved.slots);
    if (clash) return res.status(409).json({ message: `The group has a timetable clash: ${describeSlot(clash[0])} overlaps ${describeSlot(clash[1])}. Fix the template before assigning students.` });

    const existing = await StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: "normal" });
    if (existing && existing.status !== "processed") return res.status(409).json({ message: "This normal student's schedule is not processed; it must be reviewed before reassignment." });
    const oldSlots = collectSlotRefs(existing?.courses || []);
    const newSlots = collectSlotRefs(scheduleCourses(resolved.entries));
    const changeMap = new Map();
    for (const [key, ref] of oldSlots) changeMap.set(key, { ...ref, delta: -ref.count });
    for (const [key, ref] of newSlots) {
      const change = changeMap.get(key) || { ...ref, delta: 0 };
      change.delta += ref.count;
      changeMap.set(key, change);
    }
    const slotByKey = new Map(resolved.slots.map((slot) => [`${slot.offeringId}:${idOf(slot.slotId)}`, slot]));
    const changes = [...changeMap.values()].filter((change) => change.delta !== 0);
    for (const change of changes) {
      const target = slotByKey.get(`${change.offeringId}:${change.slotId}`);
      const capacity = target?.capacity ?? Number.MAX_SAFE_INTEGER;
      const currentlyAssigned = target?.assignedStudentCount;
      if (change.delta < 0 && target && currentlyAssigned < -change.delta) {
        return res.status(409).json({ message: "Stored slot counts do not match the current schedule. Reconcile schedule capacity before retrying." });
      }
      if (target && currentlyAssigned + change.delta > capacity) {
        return res.status(409).json({ message: `${target.courseCode} ${target.type} group ${target.groupNumber} is full.` });
      }
      const appliedChange = { ...change, capacity };
      if (!await changeSlotCount(appliedChange)) {
        await rollbackSlotChanges(applied);
        applied.length = 0;
        return res.status(409).json({ message: "A slot filled or changed while the assignment was being saved. Reload the student and try again." });
      }
      applied.push(appliedChange);
    }

    wasNew = !existing;
    if (existing) {
      oldScheduleState = {
        template: existing.template,
        courses: existing.courses,
        status: existing.status,
        createdBy: existing.createdBy,
        processedBy: existing.processedBy,
        processedAt: existing.processedAt,
        version: existing.version,
      };
      savedSchedule = await StudentSchedule.findOneAndUpdate(
        { _id: existing._id, __v: existing.__v || 0 },
        {
          $set: {
            template: template._id,
            courses: scheduleCourses(resolved.entries),
            status: "processed",
            processedBy: req.user._id,
            processedAt: new Date(),
          },
          $inc: { version: 1, __v: 1 },
        },
        { returnDocument: "after", runValidators: true },
      );
      if (!savedSchedule) {
        await rollbackSlotChanges(applied);
        applied.length = 0;
        return res.status(409).json({ message: "This schedule changed while the reassignment was being saved. Reload the student and try again." });
      }
    } else {
      savedSchedule = await StudentSchedule.create({
        student: student._id,
        term: term._id,
        scheduleType: "normal",
        status: "processed",
        template: template._id,
        courses: scheduleCourses(resolved.entries),
        createdBy: req.user._id,
        processedBy: req.user._id,
        processedAt: new Date(),
      });
    }
    if (term.isActive) student.studyGroup = template.studyGroup;
    await student.save();
    const populated = await StudentProfile.populate(student, { path: "user", select: "fullName email role isActive" });
    const responseSchedule = await StudentSchedule.findById(savedSchedule._id).populate("template", "studyGroup major semester");
    return res.status(wasNew ? 201 : 200).json({
      message: wasNew ? `Assigned ${student.studentId} to group ${template.studyGroup}.` : `Reassigned ${student.studentId} to group ${template.studyGroup}.`,
      student: studentView(populated, responseSchedule),
      schedule: responseSchedule,
    });
  } catch (error) {
    await rollbackSlotChanges(applied);
    if (savedSchedule) {
      try {
        if (wasNew) await savedSchedule.deleteOne();
        else if (oldScheduleState) {
          Object.assign(savedSchedule, oldScheduleState);
          await savedSchedule.save();
        }
      } catch (rollbackError) { console.error("Failed to restore schedule after assignment error", rollbackError.message); }
    }
    if (error.code === 11000) return res.status(409).json({ message: "This student was just assigned by another coordinator. Reload and try again." });
    next(error);
  }
}

export async function unassignStudent(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    const student = await resolveStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: "normal" });
    if (!schedule) return res.status(404).json({ message: "This student has no assigned group for this term." });
    const template = schedule.template ? await ScheduleTemplate.findById(schedule.template).select("studyGroup").lean() : null;
    const unassignedFrom = template?.studyGroup || student.studyGroup || null;
    const refs = collectSlotRefs(schedule.courses);
    const changed = [];
    for (const ref of refs.values()) {
      const result = await CourseOffering.updateOne(
        { _id: ref.offeringId, slots: { $elemMatch: { _id: ref.slotId, assignedStudentCount: { $gte: ref.count } } } },
        { $inc: { "slots.$.assignedStudentCount": -ref.count, __v: 1 } },
      );
      if (!result.modifiedCount) {
        for (const previous of changed.reverse()) await changeSlotCount({ ...previous, delta: previous.count });
        return res.status(409).json({ message: "Stored slot counts do not match the current schedule. Reconcile capacity before unassigning." });
      }
      changed.push(ref);
    }
    await schedule.deleteOne();
    if (term.isActive && unassignedFrom && String(student.studyGroup) === String(unassignedFrom)) {
      student.studyGroup = undefined;
      await student.save();
    }
    res.json({ message: `Removed ${student.studentId} from group ${unassignedFrom || "their schedule group"}.`, student: studentView(student), unassignedFrom });
  } catch (error) { next(error); }
}

export async function getMySchedule(req, res, next) {
  try {
    const student = await ownStudentOr403(req, res);
    if (!student) return;
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    return await sendSchedule(req, res, student, term);
  } catch (error) { next(error); }
}

export async function getMyRegisteredCourses(req, res, next) {
  try {
    return await withOwnSchedule(req, res, async ({ student, term, schedule, entries }) => {
      const courseIds = entries.map((entry) => entry.course).filter(Boolean);
      const catalogue = await Course.find({ _id: { $in: courseIds } }).select("courseType").lean();
      const courseTypeById = new Map(catalogue.map((course) => [idOf(course._id), course.courseType]));
      const { courses, totalCreditHours, courseCount } = buildRegisteredCourses(entries, courseTypeById);
      return res.json({ term: termView(term), student: studentView(student), status: schedule.status, studyGroup: schedule.template?.studyGroup || student.studyGroup || null, courses, totalCreditHours, courseCount });
    });
  } catch (error) { next(error); }
}

export async function getMyCourseDetails(req, res, next) {
  try {
    if (!isId(req.params.courseId)) return res.status(400).json({ message: "Invalid courseId" });
    return await withOwnSchedule(req, res, async ({ student, term, schedule, entries }) => {
      const entry = findCourseEntry(entries, req.params.courseId);
      if (!entry) return res.status(404).json({ message: COURSE_NOT_REGISTERED });
      const details = buildCourseDetails(entry, { courseType: entry.courseType, instructors: entry.instructors });
      return res.json({ term: termView(term), student: studentView(student), status: schedule.status, studyGroup: schedule.template?.studyGroup || student.studyGroup, ...details });
    });
  } catch (error) { next(error); }
}

export async function downloadMySchedule(req, res, next) {
  try {
    return await withOwnSchedule(req, res, async ({ student, term, schedule, entries }) => {
      if (schedule.status === "readyForStudentReview") return res.status(409).json({ message: NOT_FINAL_YET });
      if (schedule.status !== "processed") return res.status(404).json({ message: NO_VISIBLE_SCHEDULE });
      const calendar = buildWeeklyCalendar(entries);
      const user = student.user || await User.findById(student.user).select("fullName email").lean();
      const model = buildPdfModel({
        student: { ...studentView(student), fullName: user?.fullName, email: user?.email },
        term: termView(term),
        schedule: { status: schedule.status, studyGroup: schedule.template?.studyGroup || student.studyGroup },
        calendar,
      });
      const pdf = await renderSchedulePdf({ model });
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${model.fileName}"`,
        "Content-Length": pdf.length,
        "Cache-Control": "no-store",
      });
      return res.status(200).end(pdf);
    });
  } catch (error) { next(error); }
}

export async function getStudentSchedule(req, res, next) {
  try {
    const student = await resolveStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    return await sendSchedule(req, res, student, term);
  } catch (error) { next(error); }
}

export async function listStudentsWithSchedules(req, res, next) {
  try {
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    const filter = {};
    if (req.user.role === "advisor") Object.assign(filter, { studentType: "advising", assignedAdvisor: req.user._id });
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length > 100) return res.status(400).json({ message: "search must be at most 100 characters" });
    if (search) {
      const rx = new RegExp(escapedRegex(search), "i");
      const users = await User.find({ $or: [{ fullName: rx }, { email: rx }] }).distinct("_id");
      filter.$or = [{ studentId: rx }, { user: { $in: users } }];
    }
    const students = await StudentProfile.find(filter).populate("user", "fullName email role isActive").sort({ studentId: 1 }).lean();
    const schedules = await StudentSchedule.find({ term: term._id, student: { $in: students.map((student) => student._id) } }).select("student status").lean();
    const statuses = new Map(schedules.map((schedule) => [idOf(schedule.student), schedule.status]));
    const rows = students.map((student) => ({ ...studentView(student), scheduleStatus: statuses.get(idOf(student._id)) || null }));
    res.json({ term: termView(term), count: rows.length, students: rows });
  } catch (error) { next(error); }
}

function matchingCourseCodes(left, right) {
  const a = left.map(code => String(code || "").trim().toUpperCase());
  const b = right.map(code => String(code || "").trim().toUpperCase());
  return a.length === b.length && new Set(a).size === a.length && new Set(b).size === b.length && a.every(code => b.includes(code));
}

async function eligibleSwapOptions(student, term, schedule, ownResolved) {
    const templates = await ScheduleTemplate.find({ term: term._id, isPublished: true, major: student.major, semester: student.currentSemester }).lean();
    const resolvedById = await resolveTemplates(templates, { student });
    const currentCourseCodes = ownResolved.entries.map(entry => entry.courseCode);
    const candidates = [];
    for (const template of templates) {
      if (idOf(template._id) === idOf(schedule.template)) continue;
      const resolved = resolvedById.get(idOf(template._id));
      if (!resolved || resolved.error || resolved.entries.length !== currentCourseCodes.length) continue;
      const codes = resolved.entries.map(entry => entry.courseCode);
      if (!matchingCourseCodes(codes, currentCourseCodes)) continue;
      const calendar = buildWeeklyCalendar(resolved.entries);
      const capacities = resolved.slots.map((slot) => Math.max(0, slot.capacity - slot.assignedStudentCount));
      candidates.push({
        templateId: template._id,
        studyGroup: template.studyGroup,
        major: template.major,
        semester: template.semester,
        courseCodes: codes,
        totalCreditHours: calendar.totalCreditHours,
        minRemainingCapacity: capacities.length ? Math.min(...capacities) : null,
        slots: resolved.slots,
        week: calendar.week,
        daysOff: calendar.daysOff,
      });
    }
    candidates.sort((a, b) => Number(a.studyGroup) - Number(b.studyGroup) || String(a.studyGroup).localeCompare(String(b.studyGroup)));
    return { currentCourseCodes, candidates };
}

export async function getEligibleGroups(req, res, next) {
  try {
    if (req.user.role !== "normalStudent") {
      const message = req.user.role === "advisingStudent"
        ? "Advising students cannot swap schedule groups. Ask your academic advisor for a change request instead."
        : "Only normal students can swap their whole schedule with another standard schedule group.";
      return res.status(403).json({ message });
    }
    const student = await StudentProfile.findOne({ user: req.user._id }).populate("user", "fullName").lean();
    if (!student) return res.status(404).json({ message: "No student record is linked to this account." });
    const { term, error } = await resolveTerm(req.query.termId);
    if (error) return res.status(error.status).json({ message: error.message });
    const schedule = await findStudentSchedule(student, term);
    if (!schedule || schedule.status !== "processed") return res.status(404).json({ message: NO_VISIBLE_SCHEDULE });
    const ownResolved = await resolveStoredSchedule(schedule);
    if (ownResolved.error) return res.status(409).json({ message: ownResolved.error });
    const { currentCourseCodes, candidates } = await eligibleSwapOptions(student, term, schedule, ownResolved);
    const currentCalendar = buildWeeklyCalendar(ownResolved.entries);
    res.json({
      term: termView(term),
      student: studentView(student),
      currentGroup: {
        templateId: schedule.template || null,
        studyGroup: schedule.template?.studyGroup || student.studyGroup || null,
        major: student.major,
        semester: student.currentSemester,
        courseCodes: currentCourseCodes,
        totalCreditHours: ownResolved.entries.reduce((sum, entry) => sum + (Number(entry.creditHours) || 0), 0),
        week: currentCalendar.week,
        daysOff: currentCalendar.daysOff,
      },
      eligibleGroups: candidates,
      count: candidates.length,
    });
  } catch (error) { next(error); }
}

function swapFailure(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendSwapFailure(error, res, next) {
  return error.status ? res.status(error.status).json({ message: error.message }) : next(error);
}

function swapDeadlinePassed(term, now) {
  return !term?.wholeScheduleSwapDeadline || term.wholeScheduleSwapDeadline <= now;
}

function assertSwapDeadline(term, now = new Date()) {
  if (swapDeadlinePassed(term, now)) {
    throw swapFailure(409, "The whole-schedule swap deadline has passed.");
  }
}

function swapRequestExpired(request, term, now) {
  return !request.expiresAt || request.expiresAt <= now || swapDeadlinePassed(term, now);
}

async function ownNormalSwapContext(req) {
  if (req.user.role !== "normalStudent") throw swapFailure(403, "Only normal students can swap whole schedules.");
  const student = await StudentProfile.findOne({ user: req.user._id }).lean();
  if (!student) throw swapFailure(404, "No student record is linked to this account.");
  const { term, error } = await resolveTerm(req.query.termId);
  if (error) throw swapFailure(error.status, error.message);
  const schedule = await findStudentSchedule(student, term);
  if (!schedule || schedule.status !== "processed") throw swapFailure(404, NO_VISIBLE_SCHEDULE);
  const resolved = await resolveStoredSchedule(schedule);
  if (resolved.error) throw swapFailure(409, resolved.error);
  return { student, term, schedule, resolved };
}

async function ownSwapHistoryStudent(req) {
  if (req.user.role !== "normalStudent") throw swapFailure(403, "Only normal students can view swap requests.");
  const student = await StudentProfile.findOne({ user: req.user._id }).lean();
  if (!student) throw swapFailure(404, "No student record is linked to this account.");
  return student;
}

export async function createSwapRequest(req, res, next) {
  try {
    const { student, term, schedule, resolved } = await ownNormalSwapContext(req);
    assertSwapDeadline(term);
    const desiredGroups = req.body?.desiredGroups;
    if (!Array.isArray(desiredGroups) || !desiredGroups.length || desiredGroups.length > 20 ||
        desiredGroups.some(group => typeof group !== "string" || !group.trim())) {
      throw swapFailure(400, "Select at least one eligible destination group.");
    }
    const selected = [...new Set(desiredGroups.map(group => group.trim()))];
    const { currentCourseCodes, candidates } = await eligibleSwapOptions(student, term, schedule, resolved);
    if (selected.some(group => !candidates.some(candidate => candidate.studyGroup === group))) {
      throw swapFailure(409, "A selected group is no longer eligible. Refresh the available groups.");
    }
    const existing = await WholeScheduleSwapRequest.findOne({ student: student._id, status: "open" })
      .populate("term", "wholeScheduleSwapDeadline").lean();
    const now = new Date();
    assertSwapDeadline(term, now);
    if (existing) {
      if (!swapRequestExpired(existing, existing.term, now)) {
        throw swapFailure(409, "You already have an open swap request. Withdraw it before creating another.");
      }
      await WholeScheduleSwapRequest.updateOne({ _id: existing._id, status: "open" }, { $set: { status: "expired" } });
    }
    const request = await WholeScheduleSwapRequest.create({
      student: student._id,
      term: term._id,
      currentSchedule: schedule._id,
      currentGroup: schedule.template?.studyGroup || student.studyGroup,
      desiredGroups: selected,
      courseCodesSnapshot: currentCourseCodes,
      expiresAt: term.wholeScheduleSwapDeadline,
    });
    res.status(201).json({ request: { _id: request._id, status: request.status, currentGroup: request.currentGroup, desiredGroups: request.desiredGroups }, message: "Swap request submitted. A student in one of your selected groups can complete the exchange." });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "You already have an open swap request." });
    return sendSwapFailure(error, res, next);
  }
}

export async function getMySwapRequests(req, res, next) {
  try {
    const student = await ownSwapHistoryStudent(req);
    const filter = { $or: [{ student: student._id }, { completedWith: student._id, status: "completed" }] };
    if (req.query.termId !== undefined) {
      const { term, error } = await resolveTerm(req.query.termId);
      if (error) throw swapFailure(error.status, error.message);
      filter.term = term._id;
    }
    const requests = await WholeScheduleSwapRequest.find(filter)
      .populate("term", "code wholeScheduleSwapDeadline").sort({ createdAt: -1 }).lean();
    const now = new Date();
    res.json({ requests: requests.map(request => {
      const isRequester = idOf(request.student) === idOf(student._id);
      const completed = request.status === "completed";
      const accepterGroup = request.completedFromGroup ?? (request.desiredGroups.length === 1 ? request.desiredGroups[0] : null);
      return {
        _id: request._id,
        term: request.term ? { _id: request.term._id, code: request.term.code } : null,
        currentGroup: request.currentGroup,
        desiredGroups: request.desiredGroups,
        role: isRequester ? "requester" : "accepter",
        fromGroup: isRequester ? request.currentGroup : accepterGroup,
        toGroup: completed ? (isRequester ? accepterGroup : request.currentGroup) : null,
        status: request.status === "open" && swapRequestExpired(request, request.term, now) ? "expired" : request.status,
        createdAt: request.createdAt,
        completedAt: request.completedAt,
        withdrawnAt: request.withdrawnAt,
      };
    }) });
  } catch (error) { return sendSwapFailure(error, res, next); }
}

export async function getOpenSwapRequests(req, res, next) {
  try {
    const { student, term, schedule, resolved } = await ownNormalSwapContext(req);
    const now = new Date();
    const viewerTemplate = schedule.template;
    const currentGroup = viewerTemplate?.studyGroup;
    if (schedule.scheduleType !== "normal" || !currentGroup || !viewerTemplate.isPublished ||
        idOf(viewerTemplate.term) !== idOf(term._id) || swapDeadlinePassed(term, now)) {
      return res.json({ requests: [] });
    }

    const courseCodes = resolved.entries.map(entry => entry.courseCode);
    const requests = await WholeScheduleSwapRequest.find({
      term: term._id,
      status: "open",
      expiresAt: { $gt: now },
      student: { $ne: student._id },
      currentGroup: { $ne: currentGroup },
      desiredGroups: currentGroup,
    }).select("student currentSchedule currentGroup desiredGroups courseCodesSnapshot").sort({ createdAt: -1 }).lean();
    const candidates = requests.filter(request => matchingCourseCodes(request.courseCodesSnapshot, courseCodes));
    if (!candidates.length) return res.json({ requests: [] });

    const [requesters, schedules] = await Promise.all([
      StudentProfile.find({
        _id: { $in: candidates.map(request => request.student) },
        studentType: "normal",
        major: student.major,
        currentSemester: student.currentSemester,
      }).select("_id").lean(),
      StudentSchedule.find({
        _id: { $in: candidates.map(request => request.currentSchedule) },
        term: term._id,
        scheduleType: "normal",
        status: "processed",
      }).populate("template", "studyGroup term isPublished").lean(),
    ]);
    const requesterIds = new Set(requesters.map(idOf));
    const schedulesById = new Map(schedules.map(schedule => [idOf(schedule), schedule]));
    const available = [];

    for (const request of candidates) {
      const requesterId = idOf(request.student);
      const requesterSchedule = schedulesById.get(idOf(request.currentSchedule));
      const requesterTemplate = requesterSchedule?.template;
      if (!requesterIds.has(requesterId) || idOf(requesterSchedule?.student) !== requesterId ||
          !requesterTemplate?.isPublished || idOf(requesterTemplate.term) !== idOf(term._id) ||
          requesterTemplate.studyGroup !== request.currentGroup) continue;

      const requesterResolved = await resolveStoredSchedule(requesterSchedule);
      if (requesterResolved.error || !matchingCourseCodes(requesterResolved.entries.map(entry => entry.courseCode), courseCodes)) continue;
      const calendar = buildWeeklyCalendar(requesterResolved.entries);
      available.push({
        _id: request._id,
        currentGroup: request.currentGroup,
        desiredGroups: request.desiredGroups,
        courseCodes: request.courseCodesSnapshot,
        week: calendar.week,
        daysOff: calendar.daysOff,
      });
    }
    res.json({ requests: available });
  } catch (error) { return sendSwapFailure(error, res, next); }
}

export async function withdrawSwapRequest(req, res, next) {
  try {
    const student = await ownSwapHistoryStudent(req);
    if (!isId(req.params.id)) throw swapFailure(400, "Invalid swap request ID.");
    const ownedOpenRequest = { _id: req.params.id, student: student._id, status: "open" };
    if (req.query.termId !== undefined) {
      const { term, error } = await resolveTerm(req.query.termId);
      if (error) throw swapFailure(error.status, error.message);
      ownedOpenRequest.term = term._id;
    }
    const request = await WholeScheduleSwapRequest.findOne(ownedOpenRequest)
      .populate("term", "wholeScheduleSwapDeadline").lean();
    if (!request) throw swapFailure(409, "Only your open swap request can be withdrawn.");
    const now = new Date();
    if (swapRequestExpired(request, request.term, now)) throw swapFailure(409, "This swap request has expired.");

    const withdrawn = await WholeScheduleSwapRequest.updateOne(
      { ...ownedOpenRequest, term: request.term._id, expiresAt: { $gt: now } },
      { $set: { status: "withdrawn", withdrawnAt: now } },
    );
    if (withdrawn.modifiedCount !== 1) throw swapFailure(409, "Only your open swap request can be withdrawn.");
    res.json({ message: "Swap request withdrawn." });
  } catch (error) { return sendSwapFailure(error, res, next); }
}

function coursesWithSwappedSlots(ownCourses, otherCourses) {
  const otherCoursesById = new Map(otherCourses.map(course => [idOf(course.course), course]));
  return ownCourses.map(course => {
    const other = otherCoursesById.get(idOf(course.course));
    if (!other) throw swapFailure(409, "The registered course sets no longer match.");
    return { ...course, courseOffering: other.courseOffering, slots: other.slots };
  });
}

export async function completeSwapRequest(req, res, next) {
  if (!isId(req.params.id)) return res.status(400).json({ message: "Invalid swap request ID." });
  if (req.user.role !== "normalStudent") return res.status(403).json({ message: "Only normal students can complete swaps." });
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const viewer = await StudentProfile.findOne({ user: req.user._id }).session(session).lean();
      const request = await WholeScheduleSwapRequest.findById(req.params.id).session(session).lean();
      if (viewer?.studentType !== "normal" || !request || request.status !== "open" || idOf(request.student) === idOf(viewer._id)) {
        throw swapFailure(409, "This swap request is no longer available.");
      }
      const term = await AcademicTerm.findById(request.term).session(session).lean();
      const startedAt = new Date();
      assertSwapDeadline(term, startedAt);
      if (swapRequestExpired(request, term, startedAt)) throw swapFailure(409, "This swap request has expired.");
      const requester = await StudentProfile.findById(request.student).session(session).lean();
      const viewerSchedule = await StudentSchedule.findOne({ student: viewer._id, term: term._id, scheduleType: "normal", status: "processed" }).session(session).lean();
      const requesterSchedule = await StudentSchedule.findOne({ _id: request.currentSchedule, student: request.student, term: term._id, scheduleType: "normal", status: "processed" }).session(session).lean();
      if (requester?.studentType !== "normal" || !viewerSchedule || !requesterSchedule ||
          viewer.major !== requester.major || Number(viewer.currentSemester) !== Number(requester.currentSemester)) {
        throw swapFailure(409, "The students or processed schedules are no longer eligible.");
      }
      const viewerTemplate = await ScheduleTemplate.findById(viewerSchedule.template).session(session).lean();
      const requesterTemplate = await ScheduleTemplate.findById(requesterSchedule.template).session(session).lean();
      if (!viewerTemplate?.isPublished || !requesterTemplate?.isPublished ||
          viewerTemplate.studyGroup === requesterTemplate.studyGroup ||
          !request.desiredGroups.includes(viewerTemplate.studyGroup) ||
          requesterTemplate.studyGroup !== request.currentGroup ||
          idOf(viewerTemplate.term) !== idOf(term._id) || idOf(requesterTemplate.term) !== idOf(term._id)) {
        throw swapFailure(409, "The requested groups have changed. Refresh the swap page.");
      }
      const viewerResolved = await resolveStoredSchedule(viewerSchedule, session);
      const requesterResolved = await resolveStoredSchedule(requesterSchedule, session);
      if (viewerResolved.error || requesterResolved.error || !viewerResolved.entries.length ||
          [...viewerResolved.entries, ...requesterResolved.entries].some(entry => !entry.slots.length)) {
        throw swapFailure(409, "The processed schedules no longer have valid slot assignments.");
      }
      const viewerCodes = viewerResolved.entries.map(entry => entry.courseCode);
      const requesterCodes = requesterResolved.entries.map(entry => entry.courseCode);
      if (!matchingCourseCodes(viewerCodes, requesterCodes) || !matchingCourseCodes(requesterCodes, request.courseCodesSnapshot)) {
        throw swapFailure(409, "The registered course sets no longer match.");
      }
      for (const [own, other, incomingTemplate] of [
        [viewerSchedule, requesterSchedule, requesterTemplate],
        [requesterSchedule, viewerSchedule, viewerTemplate],
      ]) {
        const courses = coursesWithSwappedSlots(own.courses, other.courses);
        const updated = await StudentSchedule.updateOne(
          { _id: own._id, status: "processed", version: own.version },
          { $set: { template: incomingTemplate._id, courses }, $inc: { version: 1 } },
          { session },
        );
        if (updated.modifiedCount !== 1) throw swapFailure(409, "A schedule changed during the swap. Please refresh and try again.");
        if (term.isActive) {
          await StudentProfile.updateOne({ _id: own.student }, { $set: { studyGroup: incomingTemplate.studyGroup } }, { session });
        }
      }
      const now = new Date();
      assertSwapDeadline(term, now);
      if (swapRequestExpired(request, term, now)) throw swapFailure(409, "This swap request has expired.");
      const completed = await WholeScheduleSwapRequest.updateOne(
        { _id: request._id, status: "open", expiresAt: { $gt: now } },
        { $set: { status: "completed", completedWith: viewer._id, completedFromGroup: viewerTemplate.studyGroup, completedAt: now } },
        { session },
      );
      if (completed.modifiedCount !== 1) throw swapFailure(409, "Another student completed this request first.");
      await WholeScheduleSwapRequest.updateMany({ _id: { $ne: request._id }, term: term._id, status: "open", student: { $in: [viewer._id, requester._id] } },
        { $set: { status: "expired" } }, { session });
      result = { message: `Swap completed. You are now in Group ${requesterTemplate.studyGroup}.`, studyGroup: requesterTemplate.studyGroup };
    });
    res.json(result);
  } catch (error) { return sendSwapFailure(error, res, next); }
  finally { await session.endSession(); }
}
