import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { AcademicTerm, Course, CourseAttempt, CourseOffering, ExtraHoursRequest, FinancialTransaction, StudentProfile, StudentSchedule, User } from "../apps/api/src/models/index.js";

const uri = process.env.EXTRA_HOURS_DEMO_URI;
const target = new URL(uri || "mongodb://invalid/");
if (target.protocol !== "mongodb:" || !["127.0.0.1", "localhost"].includes(target.hostname)
  || target.pathname !== "/extra_hours_manual" || target.username || target.password) {
  throw new Error("Set EXTRA_HOURS_DEMO_URI to the local replica set database extra_hours_manual.");
}

const roleDomain = (role) => role === "advisingStudent" ? "student.guc.edu.eg" : "guc.edu.eg";
const cases = [
  ["wallet", "80-01001"], ["gateway", "80-01002"], ["defer", "80-01003"],
  ["withdraw", "80-01004"], ["reject", "80-01005"], ["create", "80-01006"],
  ["blank", "80-01007"], ["probation", "80-01008"], ["graduate", "80-01009"],
  ["activation", "80-01010"], ["retry", "80-01011"],
  ["retrymanual", "80-01012"], ["refund", "80-01013"],
  ["withdrawcheck", "80-01014"],
];
const pending = new Set(["wallet", "gateway", "defer", "withdraw", "reject", "blank", "activation", "retry", "retrymanual", "refund", "withdrawcheck"]);
const day = 86_400_000;

async function findOrInsert(Model, key, fields) {
  const existing = await Model.findOne(key);
  return existing || Model.create(fields);
}

await mongoose.connect(uri);
try {
  const passwordHash = await bcrypt.hash("ExtraHoursDemo123!", 10);
  const account = (name, fullName, role) => {
    const email = `extra.${name}@${roleDomain(role)}`;
    return findOrInsert(User, { email }, { email, fullName, role, passwordHash, isActive: true, isAdvisorInSystem: role === "advisor" });
  };
  const advisor = await account("advisor", "Extra Hours Advisor", "advisor");
  await account("coordinator", "Extra Hours Coordinator", "coordinator");

  const now = Date.now();
  const addTerm = (code, date, academicYear, isActive) => findOrInsert(AcademicTerm, { code }, {
    code, season: "winter", academicYear, isActive,
    termStart: date, termEnd: date + 50 * day, teachingStart: date, teachingEnd: date + 45 * day,
    registrationStart: date - 14 * day, registrationEnd: date,
    advisingDeadline: date + 5 * day, wholeScheduleSwapDeadline: date + 6 * day,
  });
  const term = await addTerm("EHTEST", now + day, "2026/2027", true);
  const past = await addTerm("EHPAST", now - 180 * day, "2025/2026", false);
  const courses = [
    ["EHT101", "Extra Hours Workshop", 1],
    ["EHT202", "Extra Hours Seminar", 2],
    ["EHT301", "Extra Hours Lab", 3],
    ["EHT404", "Extra Hours Capstone", 4],
  ];
  for (const [code, name, creditHours] of courses) {
    await findOrInsert(Course, { code }, { code, name, creditHours, courseType: "core", facultyMajors: ["CS"], isActive: true });
  }
  const course = await Course.findOne({ code: "EHT301" });
  // A full draft makes the extra three hours observable at the scheduling boundary.
  const baseline = await findOrInsert(Course, { code: "EHTBASE" }, {
    code: "EHTBASE", name: "Demo Standard Course Load", creditHours: 30,
    courseType: "core", facultyMajors: ["CS"], isActive: true,
  });
  const publishOffering = (entry, day) => findOrInsert(CourseOffering, { course: entry._id, term: term._id }, {
    course: entry._id, term: term._id, academicYear: term.academicYear, isPublished: true,
    eligibleGroups: [{ major: "CS", semester: 5 }],
    instructors: [{ fullName: "Demo Instructor", email: "extra.advisor@guc.edu.eg" }],
    slots: [{ componentType: "lecture", groupNumber: "1", day, startMinute: 600, endMinute: 660, room: "Demo 1", capacity: 10 }],
  });
  const baselineOffering = await publishOffering(baseline, "Tuesday");
  await publishOffering(course, "Wednesday");

  for (const [scenario, studentId] of cases) {
    const user = await account(scenario, `Extra ${scenario[0].toUpperCase()}${scenario.slice(1)}`, "advisingStudent");
    const probation = scenario === "probation";
    const student = await findOrInsert(StudentProfile, { user: user._id }, {
      user: user._id, studentId, studentType: "advising", assignedAdvisor: advisor._id,
      academicStanding: probation ? "probation" : "goodAcademicStanding",
      advisingReason: probation ? "probation" : "unattendedCourses",
      major: "CS", currentSemester: 5, gpa: probation ? 3.8 : 2,
    });
    if (scenario === "activation") {
      const key = { student: student._id, term: term._id, scheduleType: "advising" };
      await findOrInsert(StudentSchedule, key, {
        ...key, createdBy: advisor._id,
        courses: [{
          course: baseline._id, courseOffering: baselineOffering._id, creditHoursSnapshot: 30,
          slots: [{ componentType: "lecture", courseOffering: baselineOffering._id, slotGroupId: baselineOffering.slots[0]._id }],
        }],
      });
    }
    if (scenario === "wallet" && !await FinancialTransaction.exists({ student: student._id, kind: "walletTopUp" })) {
      const idempotencyKey = "extra-hours-demo-wallet";
      await findOrInsert(FinancialTransaction, { idempotencyKey }, {
        student: student._id, kind: "walletTopUp", amount: 3000, status: "succeeded", idempotencyKey,
      });
    }
    const isRepeated = scenario === "gateway";
    if (isRepeated) {
      const attempt = { student: student._id, course: course._id, term: past._id, attemptNumber: 1 };
      await findOrInsert(CourseAttempt, attempt, { ...attempt, result: "failed", attendance: "attended", grade: "F" });
    }
    if (pending.has(scenario) && !await ExtraHoursRequest.exists({ student: student._id, term: term._id })) {
      const pricePerHour = isRepeated ? 1000 : 800;
      await ExtraHoursRequest.create({
        student: student._id, advisor: advisor._id, term: term._id,
        courses: [{ course: course._id, hours: 3, pricePerHour, subtotal: pricePerHour * 3, isRepeated }],
        requestedHours: 3, totalCost: pricePerHour * 3,
        eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 33, isProbation: false, graduatingWithinOneYear: false },
        history: [{ action: "submitted", actor: advisor._id, note: "Demo extra-hours request submitted." }],
      });
    }
  }
  console.log("Extra-hours demo ready, including a 30-hour activation draft. Existing test progress was preserved.");
} finally {
  await mongoose.disconnect();
}
