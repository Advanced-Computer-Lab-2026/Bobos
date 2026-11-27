import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import {
  AcademicTerm, AdvisorAssignment, Course, CourseOffering, ExtraHoursRequest, GraduationPlan,
  MandatoryCourseRemovalRequest, SchedulingPreference, SlotChangeRequest, StudentProfile, StudentSchedule, User,
} from "../models/index.js";

const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === "production" || !uri || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(uri).hostname)) {
  throw new Error("Use an explicit local development database for the Advisor preview.");
}

async function ensure(Model, key, fields) {
  return (await Model.findOne(key)) || Model.create({ ...fields, ...key });
}

await mongoose.connect(uri);
try {
  const [term, advisor, coordinator, course] = await Promise.all([
    AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 }),
    User.findOne({ email: "sherif.advisor@guc.edu.eg", role: "advisor", isActive: true }),
    User.findOne({ email: "nadia.coordinator@guc.edu.eg", role: "coordinator", isActive: true }),
    Course.findOne({ code: "SM101", isActive: true }),
  ]);
  if (!term || !advisor || !coordinator || !course) throw new Error("Load the standard local portal accounts and curriculum first.");
  const [offering, planTerm] = await Promise.all([
    CourseOffering.findOne({ course: course._id, term: term._id, isPublished: true }),
    AcademicTerm.findOne({ termStart: { $gt: term.termStart } }).sort({ termStart: 1 }),
  ]);
  const [original, alternative] = (offering?.slots || []).filter(slot => slot.componentType === "lecture");
  if (!original || !alternative || !planTerm) throw new Error("An active Scientific Methods offering with two lecture groups and a future term are required.");

  const passwordHash = await bcrypt.hash("Password123!", 10);
  async function student(studentId, email, fullName, semester) {
    const user = await ensure(User, { email }, { fullName, passwordHash, role: "advisingStudent", isActive: true });
    const profile = await ensure(StudentProfile, { user: user._id }, {
      studentId, studentType: "advising", faculty: "MET", major: "CS", currentSemester: semester, gpa: 2.55,
      academicStanding: "goodAcademicStanding", advisingReason: "failedCourses", enrollmentStatus: "active", assignedAdvisor: advisor._id,
    });
    await ensure(AdvisorAssignment, { student: profile._id, advisor: advisor._id }, { assignedBy: coordinator._id });
    return profile;
  }

  const [jana, omar, nadine] = await Promise.all([
    student("94-00101", "jana.reda@student.guc.edu.eg", "Jana Reda", 7),
    student("94-00102", "omar.makram@student.guc.edu.eg", "Omar Makram", 7),
    student("94-00103", "nadine.salem@student.guc.edu.eg", "Nadine Salem", 9),
  ]);
  const ids = profile => ({ student: profile._id, term: term._id });
  const courseSelection = {
    course: course._id, courseOffering: offering._id, creditHoursSnapshot: course.creditHours,
    slots: [{ componentType: original.componentType, courseOffering: offering._id, slotGroupId: original._id }],
  };
  const schedule = await ensure(StudentSchedule, { ...ids(jana), scheduleType: "advising" }, {
    status: "readyForStudentReview", createdBy: advisor._id, courses: [courseSelection], seatsReserved: true,
  });
  await ensure(StudentSchedule, { ...ids(omar), scheduleType: "advising" }, {
    status: "draft", createdBy: advisor._id, courses: [courseSelection],
  });
  const reservations = await StudentSchedule.countDocuments({
    seatsReserved: true, "courses.slots.slotGroupId": original._id,
  });
  await CourseOffering.updateOne({ _id: offering._id, "slots._id": original._id }, { $set: { "slots.$.assignedStudentCount": reservations } });

  for (const profile of [jana, omar]) {
    await ensure(SchedulingPreference, ids(profile), {
      preferredDays: [{ day: alternative.day, priority: 1 }], desiredDaysOff: [{ day: "Thursday", priority: 1 }],
      preferredTimes: [{ startMinute: 660, endMinute: 900, priority: 1 }],
      preferredGroups: [{ course: course._id, componentType: "lecture", groupNumber: alternative.groupNumber, priority: 1 }],
      note: "The later lecture gives me enough time to get to campus after my morning commitment.",
    });
  }
  await ensure(SlotChangeRequest, { ...ids(jana), course: course._id, componentType: "lecture" }, {
    schedule: schedule._id, currentOffering: offering._id, currentSlotGroupId: original._id,
    preferenceNote: "Could I move to the later lecture group? My current lecture overlaps a recurring commitment.",
  });
  await ensure(MandatoryCourseRemovalRequest, { ...ids(omar), course: course._id }, {
    advisor: advisor._id, reason: "incorrectMandatoryDesignation",
    explanation: "The transfer credit covers this course. Please review whether it should remain mandatory.",
  });
  for (const [profile, decisionStatus, settlementStatus] of [[omar, "pending", "none"], [nadine, "approved", "awaitingChoice"]]) {
    const hours = course.creditHours;
    await ensure(ExtraHoursRequest, ids(profile), {
      advisor: advisor._id, requestedHours: hours, totalCost: 800 * hours, decisionStatus, settlementStatus,
      courses: [{ course: course._id, hours, isRepeated: false, pricePerHour: 800, subtotal: 800 * hours }],
      eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 30 + hours, isProbation: false, graduatingWithinOneYear: true },
      ...(decisionStatus === "approved" ? { decidedBy: coordinator._id, decidedAt: new Date() } : {}),
    });
  }
  await ensure(GraduationPlan, { student: nadine._id, advisor: advisor._id }, {
    status: "submitted", submittedAt: new Date(), termPlans: [{ term: planTerm._id, courses: [course._id] }],
  });
  console.log("Advisor preview ready: schedules, preferences, removal, slot change, extra hours and a submitted plan.");
} finally {
  await mongoose.disconnect();
}
