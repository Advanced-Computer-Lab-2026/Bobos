import mongoose from "mongoose";
import { AcademicTerm, CourseOffering } from "../models/catalogue.js";
import { StudentProfile } from "../models/identity.js";
import { StudentSchedule } from "../models/academics.js";
import { SlotChangeRequest } from "../models/requests.js";
import { changeSlotCount, collectSlotRefs, resolveStoredSchedule, resolveTerm, slotView } from "./scheduling.controller.js";
import { describeSlot, slotsOverlap } from "../../../../server/src/utils/timetable.js";

const ready = "readyForStudentReview";
const statusMessage = "The schedule must be ready for student review.";
const slotLabel = (slot) => `${describeSlot(slot)} · ${slot.room}`;
const same = (a, b) => String(a) === String(b);
const validId = (id) => typeof id === "string" && mongoose.isObjectIdOrHexString(id);
const fail = (status, message) => { throw Object.assign(new Error(message), { slotChangeStatus: status }); };
const handler = (fn) => async (req, res, next) => {
  try { await fn(req, res); }
  catch (error) {
    if (error.slotChangeStatus) return res.status(error.slotChangeStatus).json({ message: error.message });
    next(error);
  }
};

function note(value) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.trim().length > 1000) fail(400, "Notes must be at most 1,000 characters.");
  return value.trim();
}

async function ownProfile(req, session = null) {
  const profile = await StudentProfile.findOne({ user: req.user._id, studentType: "advising" }).session(session).lean();
  if (!profile) fail(403, "An advising student profile is required.");
  return profile;
}

async function activeTerm(req) {
  const { term, error } = await resolveTerm(req.query.termId);
  if (error) fail(error.status, error.message);
  return term;
}

function studentScope(req) {
  return { studentType: "advising", ...(req.user.role === "advisor" ? { assignedAdvisor: req.user._id } : {}) };
}

function queryView(query) {
  return query.populate("course", "code name")
    .populate("term", "code")
    .populate({ path: "student", select: "studentId user assignedAdvisor",
      populate: [{ path: "user", select: "fullName" }, { path: "assignedAdvisor", select: "fullName" }],
    })
    .populate("decidedBy", "fullName role").lean();
}

async function requestContext(req, session = null) {
  if (!validId(req.params.id)) fail(400, "Invalid request ID.");
  const request = await SlotChangeRequest.findById(req.params.id).session(session).lean();
  const student = request && await StudentProfile.findOne({ ...studentScope(req), _id: request.student }).session(session).lean();
  if (!student) fail(404, "Slot change request not found.");
  return { request, student };
}

function scheduleFilter(request) {
  return { _id: request.schedule, student: request.student, term: request.term, scheduleType: "advising" };
}

function locateSlot(schedule, request) {
  const course = schedule?.courses.find((entry) => same(entry.course, request.course));
  const index = course?.slots.findIndex((slot) =>
    same(slot.courseOffering || course.courseOffering, request.currentOffering) &&
    same(slot.slotGroupId, request.currentSlotGroupId) && slot.componentType === request.componentType);
  return index >= 0 ? { course, index } : null;
}

async function compare(request, session = null) {
  const schedule = await StudentSchedule.findOne(scheduleFilter(request)).session(session).lean();
  const target = locateSlot(schedule, request);
  const offering = await CourseOffering.findOne({
    _id: request.currentOffering, term: request.term, course: request.course,
  }).session(session).lean();
  const slot = offering?.slots.find((item) => same(item._id, request.currentSlotGroupId));
  const viewed = slot && slotView(slot);
  const current = viewed && !viewed.error ? viewed : null;
  if (request.status !== "pending") return { current, alternatives: [] };
  if (schedule?.status !== ready) return { current, alternatives: [], issue: statusMessage };
  if (!target || !current || !offering?.isPublished) {
    return { current, alternatives: [], issue: "The original assigned slot is no longer available." };
  }
  const resolved = await resolveStoredSchedule(schedule, session);
  if (resolved.error) return { current, alternatives: [], issue: resolved.error };
  const otherSlots = resolved.entries.flatMap((entry) => entry.slots
    .filter((item) => !same(item.slotId, request.currentSlotGroupId))
    .map((item) => ({ ...item, courseCode: entry.courseCode })));
  const alternatives = offering.slots.flatMap((item) => {
    if (item.componentType !== request.componentType || same(item._id, request.currentSlotGroupId)) return [];
    const view = slotView(item);
    if (view.error) return [];
    const clashes = otherSlots.filter((other) => slotsOverlap(other, view)).map(describeSlot);
    return [{ ...view, offeringId: offering._id, remainingSeats: Math.max(0, item.capacity - item.assignedStudentCount), clashes }];
  });
  return { schedule, target, current, alternatives };
}

export const slotChanges = {
  mine: handler(async (req, res) => {
    const student = await ownProfile(req);
    const [requests, term] = await Promise.all([
      queryView(SlotChangeRequest.find({ student: student._id }).sort({ createdAt: -1 })),
      activeTerm(req).catch((error) => { if (!req.query.termId && error.slotChangeStatus === 404) return null; throw error; }),
    ]);
    const schedule = term && await StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: "advising" }).lean();
    const canSubmit = schedule?.status === ready && Date.now() < +term.advisingDeadline && student.enrollmentStatus === "active";
    const resolved = canSubmit ? await resolveStoredSchedule(schedule) : null;
    const slots = resolved?.entries?.flatMap((course) => course.slots.map((slot) => ({
      ...slot, courseId: course.course, courseCode: course.courseCode,
    }))) || [];
    res.json({ requests, slots, term: term && { code: term.code, advisingDeadline: term.advisingDeadline },
      issue: resolved?.error || (!term ? "No active academic term." : schedule?.status !== ready ? statusMessage :
        !(Date.now() < +term.advisingDeadline) ? "The advising deadline has passed." :
          student.enrollmentStatus !== "active" ? "Only active students can submit a request." : "") });
  }),

  submit: handler(async (req, res) => {
    const { courseId, slotId } = req.body || {};
    if (!validId(courseId) || !validId(slotId)) fail(400, "Choose a course and one of its assigned slots.");
    const preferenceNote = note(req.body.preferenceNote);
    const term = await activeTerm(req);
    let request;
    await mongoose.connection.transaction(async (session) => {
      const student = await ownProfile(req, session);
      if (student.enrollmentStatus !== "active") fail(403, "Only active students can submit a request.");
      const currentTerm = await AcademicTerm.findById(term._id).session(session).lean();
      if (!currentTerm || !(Date.now() < +currentTerm.advisingDeadline)) fail(409, "The advising deadline has passed.");
      const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: "advising" }).session(session).lean();
      if (schedule?.status !== ready) fail(409, statusMessage);
      const course = schedule.courses.find((entry) => same(entry.course, courseId.toLowerCase()));
      const ref = course?.slots.find((slot) => same(slot.slotGroupId, slotId.toLowerCase()));
      if (!ref) fail(400, "Choose a slot currently assigned to your course.");
      const offering = await CourseOffering.findOne({
        _id: ref.courseOffering || course.courseOffering, term: term._id, course: course.course, isPublished: true,
      }).session(session).lean();
      const slot = offering?.slots.find((item) => same(item._id, ref.slotGroupId) && item.componentType === ref.componentType);
      const view = slot && slotView(slot);
      if (!view || view.error) fail(409, "This slot is no longer available.");
      const key = { student: student._id, schedule: schedule._id, term: term._id, course: course.course,
        componentType: ref.componentType, currentOffering: offering._id, currentSlotGroupId: slot._id };
      if (await SlotChangeRequest.exists({ ...key, status: "pending" }).session(session)) fail(409, "This slot already has a pending request.");
      // Serialize submission with other schedule changes (and duplicate submissions).
      const updated = await StudentSchedule.updateOne({ _id: schedule._id, status: ready, version: schedule.version }, { $inc: { version: 1 } }, { session });
      if (!updated.modifiedCount) fail(409, "The schedule changed. Refresh and try again.");
      [request] = await SlotChangeRequest.create([{ ...key, preferenceNote, currentSlotLabel: slotLabel(view) }], { session });
    });
    res.status(201).json({ request });
  }),

  withdraw: handler(async (req, res) => {
    if (!validId(req.params.id)) fail(400, "Invalid request ID.");
    const student = await ownProfile(req);
    const key = { _id: req.params.id, student: student._id };
    const request = await SlotChangeRequest.findOneAndUpdate({ ...key, status: "pending" },
      { $set: { status: "withdrawn", withdrawnAt: new Date() } }, { returnDocument: "after" });
    if (!request) {
      if (!await SlotChangeRequest.exists(key)) fail(404, "Slot change request not found.");
      fail(409, "Only pending requests can be withdrawn.");
    }
    res.json({ request });
  }),

  list: handler(async (req, res) => {
    const studentIds = await StudentProfile.distinct("_id", studentScope(req));
    const requests = await queryView(SlotChangeRequest.find({ student: { $in: studentIds } }).sort({ createdAt: -1 }));
    res.json({ requests });
  }),

  details: handler(async (req, res) => {
    const { request } = await requestContext(req);
    const { current, alternatives, issue } = await compare(request);
    res.json({ request: await queryView(SlotChangeRequest.findById(request._id)), current, alternatives, issue });
  }),

  decide: handler(async (req, res) => {
    const { decision, replacementSlotId } = req.body || {};
    if (!["approved", "rejected"].includes(decision)) fail(400, "Choose approve or reject.");
    if (decision === "approved" && !validId(replacementSlotId)) fail(400, "Choose the exact replacement slot.");
    const responseNote = note(req.body.responseNote);
    await mongoose.connection.transaction(async (session) => {
      const { request } = await requestContext(req, session);
      if (request.status !== "pending") fail(409, "This request has already been resolved.");
      const update = { status: decision, responseNote, decidedAt: new Date(), decidedBy: req.user._id };
      if (decision === "approved") {
        const { schedule, target, alternatives, issue } = await compare(request, session);
        if (issue) fail(409, issue);
        const slot = alternatives.find((item) => same(item.slotId, replacementSlotId.toLowerCase()));
        if (!slot || !slot.remainingSeats || slot.clashes.length) fail(409, "The replacement is unavailable, full, or clashes with the timetable. Refresh the request.");
        const previous = schedule.seatsReserved ? collectSlotRefs(schedule.courses) : new Map();
        target.course.slots[target.index] = { componentType: request.componentType, courseOffering: slot.offeringId, slotGroupId: slot.slotId };
        const next = collectSlotRefs(schedule.courses);
        // Review schedules created before seat reservations were introduced have no seats to release.
        for (const [key, ref] of new Map([...previous, ...next])) {
          const delta = (next.get(key)?.count || 0) - (previous.get(key)?.count || 0);
          if (!delta) continue;
          const offering = await CourseOffering.findById(ref.offeringId).session(session);
          const live = offering?.slots.id(ref.slotId);
          if (!live || (delta > 0 && !offering.isPublished) ||
            !await changeSlotCount({ ...ref, delta, capacity: live.capacity }, session)) {
            fail(409, "A timetable slot changed or no longer has enough seats.");
          }
        }
        const updated = await StudentSchedule.updateOne({ ...scheduleFilter(request), status: ready, version: schedule.version },
          { $set: { courses: schedule.courses, seatsReserved: true }, $inc: { version: 1 } }, { session, runValidators: true });
        if (!updated.modifiedCount) fail(409, "The schedule has changed. Refresh the request.");
        Object.assign(update, { replacementOffering: slot.offeringId, replacementSlotGroupId: slot.slotId, replacementSlotLabel: slotLabel(slot) });
      }
      const updated = await SlotChangeRequest.updateOne({ _id: request._id, status: "pending" }, { $set: update }, { session, runValidators: true });
      if (!updated.modifiedCount) fail(409, "This request has already been resolved.");
    });
    res.json({ message: decision === "approved" ? "Request approved and schedule updated." : "Request rejected." });
  }),
};
