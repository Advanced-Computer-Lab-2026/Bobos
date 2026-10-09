import mongoose from "mongoose";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { StudentProfile, User } from "../models/identity.js";
import { ScheduleTemplate, StudentSchedule } from "../models/academics.js";
import { buildWeeklyCalendar } from "../../../../server/src/utils/weeklyCalendar.js";
import { toMinutes, findFirstClash, describeSlot } from "../../../../server/src/utils/timetable.js";
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

async function resolveStoredSchedule(schedule) {
  const offeringIds = new Set();
  const courseIds = new Set();
  for (const scheduledCourse of schedule.courses || []) {
    if (scheduledCourse.course) courseIds.add(idOf(scheduledCourse.course));
    for (const slot of scheduledCourse.slots || []) if (slot.courseOffering) offeringIds.add(idOf(slot.courseOffering));
    if (scheduledCourse.courseOffering) offeringIds.add(idOf(scheduledCourse.courseOffering));
  }
  const [offerings, courses] = await Promise.all([
    CourseOffering.find({ _id: { $in: [...offeringIds] } }).lean(),
    Course.find({ _id: { $in: [...courseIds] } }).lean(),
  ]);
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
    if (student.studentType !== "advising") {
      return { status: 403, message: "Advisors may view schedules only for advising students." };
    }
  } else if (!STAFF_ROLES.includes(viewer.role)) {
    return { status: 403, message: "Insufficient permissions" };
  }
  if (!schedule) return { status: 404, message: NO_VISIBLE_SCHEDULE };
  return { status: 200, readOnly: viewer.role === "administrator" };
}

async function findStudentSchedule(student, term) {
  const scheduleType = student.studentType === "advising" ? "advising" : "normal";
  return StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType }).populate("template", "studyGroup major semester");
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
    const terms = await AcademicTerm.find().select("code academicYear season isActive termStart termEnd wholeScheduleSwapDeadline")
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
    { $inc: { "slots.$.assignedStudentCount": delta } },
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
        { $inc: { "slots.$.assignedStudentCount": -ref.count } },
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
    if (req.user.role === "advisor") filter.studentType = "advising";
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
    const templates = await ScheduleTemplate.find({ term: term._id, isPublished: true }).lean();
    const matchingTemplates = templates.filter((template) => template.major === student.major && Number(template.semester) === Number(student.currentSemester));
    const resolvedById = await resolveTemplates(matchingTemplates, { student });
    const currentCourseCodes = ownResolved.entries.map((entry) => String(entry.courseCode || "").trim().toUpperCase()).filter(Boolean);
    const currentSet = new Set(currentCourseCodes);
    const candidates = [];
    for (const template of matchingTemplates) {
      if (idOf(template._id) === idOf(schedule.template)) continue;
      const resolved = resolvedById.get(idOf(template._id));
      if (!resolved || resolved.error || resolved.entries.length !== currentCourseCodes.length) continue;
      const codes = resolved.entries.map((entry) => String(entry.courseCode || "").trim().toUpperCase()).filter(Boolean);
      if (codes.length !== currentCourseCodes.length || new Set(codes).size !== currentSet.size || codes.some((code) => !currentSet.has(code))) continue;
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
      },
      eligibleGroups: candidates,
      count: candidates.length,
    });
  } catch (error) { next(error); }
}
