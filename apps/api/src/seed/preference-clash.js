import mongoose from "mongoose";
import { AcademicTerm, CourseOffering } from "../models/catalogue.js";
import { StudentProfile } from "../models/identity.js";
import { StudentSchedule } from "../models/academics.js";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Set MONGODB_URI before seeding the preference clash.");

let hostname;
try {
  hostname = new URL(uri).hostname.toLowerCase();
} catch {
  throw new Error("MONGODB_URI is not a valid MongoDB URL.");
}
if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
  throw new Error("Preference clash demo data can only be seeded in a local MongoDB database.");
}

const studentId = "26-54321";
const firstCode = "DMET601";
const secondCode = "DMET603";

function hasGroup(offering, componentType, groupNumber) {
  return offering.slots.some(slot => slot.componentType === componentType && slot.groupNumber === groupNumber);
}

function addGroup(offering, componentType, groupNumber, schedule) {
  if (hasGroup(offering, componentType, groupNumber)) return false;
  offering.slots.push({ componentType, groupNumber, ...schedule, capacity: 30, assignedStudentCount: 0 });
  return true;
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000 });
try {
  const term = await AcademicTerm.findOne({ isActive: true });
  if (!term) throw new Error("No active academic term exists.");
  const student = await StudentProfile.findOne({ studentId });
  if (!student) throw new Error(`Demo student ${studentId} is missing.`);
  const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, scheduleType: "advising" })
    .populate("courses.course", "code");
  if (!schedule || ![firstCode, secondCode].every(code => schedule.courses.some(entry => entry.course?.code === code))) {
    throw new Error(`${studentId} must have both ${firstCode} and ${secondCode} in the current advising schedule.`);
  }

  const offerings = await CourseOffering.find({ term: term._id, isPublished: true })
    .populate("course", "code");
  const first = offerings.find(offering => offering.course?.code === firstCode);
  const second = offerings.find(offering => offering.course?.code === secondCode);
  if (!first || !second) throw new Error("Both demo courses need published offerings in the active term.");
  const lab = first.slots.find(slot => slot.componentType === "lab" && slot.groupNumber === "1" && slot.day === "Monday");
  if (!lab) throw new Error(`${firstCode} lab group 1 on Monday is missing.`);

  const clashStart = lab.startMinute + 30;
  const clashEnd = clashStart + 60;
  if (clashStart >= lab.endMinute || clashEnd > 1440) throw new Error("The regular lecture group would not overlap the existing lab.");
  const legacyClash = second.slots.find(slot => slot.componentType === "lecture" && slot.groupNumber === "DEMO-CLASH");
  const numberedLecture3 = second.slots.find(slot => slot.componentType === "lecture" && slot.groupNumber === "3");
  if (legacyClash && numberedLecture3 && legacyClash !== numberedLecture3) {
    throw new Error(`${secondCode} already has lecture group 3 as well as the old demo clash group; resolve the duplicate before reseeding.`);
  }

  if (legacyClash) {
    legacyClash.groupNumber = "3";
    legacyClash.day = lab.day;
    legacyClash.startMinute = clashStart;
    legacyClash.endMinute = clashEnd;
    legacyClash.room = "E1.301";
  } else if (numberedLecture3) {
    const overlaps = numberedLecture3.day === lab.day && numberedLecture3.startMinute < lab.endMinute && numberedLecture3.endMinute > lab.startMinute;
    if (!overlaps) throw new Error(`${secondCode} lecture group 3 exists but does not overlap ${firstCode} lab group 1.`);
  } else {
    second.slots.push({
      componentType: "lecture",
      groupNumber: "3",
      day: lab.day,
      startMinute: clashStart,
      endMinute: clashEnd,
      room: "E1.301",
      capacity: 30,
      assignedStudentCount: 0,
    });
  }

  const firstLectureAdded = addGroup(first, "lecture", "3", { day: "Sunday", startMinute: 630, endMinute: 690, room: "E1.201" });
  const firstLabAdded = addGroup(first, "lab", "3", { day: "Wednesday", startMinute: 720, endMinute: 780, room: "E2.201" });
  const secondChanged = addGroup(second, "tutorial", "3", { day: "Tuesday", startMinute: 720, endMinute: 780, room: "E2.201" });
  await Promise.all([
    ...(firstLectureAdded || firstLabAdded ? [first.save()] : []),
    ...(secondChanged || legacyClash || !numberedLecture3 ? [second.save()] : []),
  ]);

  console.log(`${studentId}: both courses now have three groups for each offered component. Select ${firstCode} lab 1, then ${secondCode} lecture 3 to see the Monday timetable clash.`);
} finally {
  await mongoose.disconnect();
}
