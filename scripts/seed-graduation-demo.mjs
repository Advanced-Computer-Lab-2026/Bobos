import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AcademicTerm, Course, CourseAttempt, ExtraHoursRequest, StudentProfile, User } from "../apps/api/src/models/index.js";

const uri = process.env.GRADUATION_DEMO_URI;
const target = URL.parse(uri || "");
if (target?.protocol !== "mongodb:" || !["127.0.0.1", "localhost"].includes(target.hostname)
  || !/^\/graduation_manual(?:_[a-z0-9]+)*$/.test(target.pathname) || target.username || target.password) {
  throw new Error("Set GRADUATION_DEMO_URI to a local MongoDB database named graduation_manual (an optional lowercase suffix is allowed).");
}

const day = 86_400_000;
const password = "GraduationDemo123!";

async function findOrInsert(Model, key, fields) {
  return await Model.findOne(key) ?? await Model.create({ ...key, ...fields });
}

function termDates(start) {
  return {
    termStart: start,
    termEnd: start + 50 * day,
    teachingStart: start,
    teachingEnd: start + 45 * day,
    registrationStart: start - 14 * day,
    registrationEnd: start,
    advisingDeadline: start + 5 * day,
    wholeScheduleSwapDeadline: start + 6 * day,
  };
}

await mongoose.connect(uri, { directConnection: true, serverSelectionTimeoutMS: 7000 });
try {
  const passwordHash = await bcrypt.hash(password, 10);
  const account = (name, fullName, role) => {
    const domain = role === "advisingStudent" ? "student.guc.edu.eg" : "guc.edu.eg";
    return findOrInsert(User, { email: `a3.${name}@${domain}` }, {
      fullName, role, passwordHash, isActive: true, isAdvisorInSystem: role === "advisor",
    });
  };
  const [advisor, otherAdvisor, coordinator] = await Promise.all([
    account("advisor", "A3 Advisor", "advisor"),
    account("otheradvisor", "A3 Other Advisor", "advisor"),
    account("coordinator", "A3 Coordinator", "coordinator"),
  ]);

  const now = Date.now();
  const year = new Date(now).getUTCFullYear();
  const past = await findOrInsert(AcademicTerm, { code: "A3PAST" }, {
    academicYear: `${year - 1}/${year}`, season: "spring", ...termDates(now - 120 * day),
  });
  const [winter] = await Promise.all([["A3WIN", "winter", 30], ["A3SPR", "spring", 95], ["A3SUM", "summer", 160]]
    .map(([code, season, startsIn]) => findOrInsert(AcademicTerm, { code }, {
      academicYear: `${year}/${year + 1}`, season, ...termDates(now + startsIn * day), isActive: season === "winter",
    })));

  const core = (code, name, creditHours, offeringSeasons, extra = {}) => findOrInsert(Course, { code }, {
    name, creditHours, courseType: "core", facultyMajors: ["CS", "DMET"], offeringSeasons, ...extra,
  });
  const intro = await core("A3C101", "A3 Foundation", 14, ["winter", "spring"]);
  const advanced = await core("A3C201", "A3 Advanced Course", 6, ["winter", "spring"], { prerequisites: [intro._id] });
  await core("A3C301", "A3 Project", 12, ["winter", "summer"]);
  const exam = await core("A3X401", "A3 Makeup Only Course", 4, ["firstMakeup"], { facultyMajors: ["DMET"] });
  const creditMajor = "A3 Credit Scenario";
  const creditCourses = { facultyMajors: [creditMajor] };
  await core("A3H101", "A3 Standard Course Load", 22, ["winter"], creditCourses);
  const approvedCourse = await core("A3H201", "A3 Approved Extra Course", 3, ["winter", "spring"], creditCourses);
  await core("A3H301", "A3 Other Extra Course", 3, ["winter", "spring"], creditCourses);
  const electives = await Promise.all(Array.from({ length: 4 }, (_, index) => {
    const number = index + 1;
    return findOrInsert(Course, { code: `A3E10${number}` }, {
      name: `A3 Completed Elective ${number}`, creditHours: 4, courseType: "elective",
      facultyMajors: ["CS", "DMET", creditMajor], offeringSeasons: ["winter", "spring"],
    });
  }));

  const cases = [
    { name: "plan", label: "Plan", id: "83-01001", advisor },
    { name: "exam", label: "Exam", id: "83-01002", advisor, major: "DMET", failed: [exam] },
    { name: "other", label: "Other", id: "83-01003", advisor: otherAdvisor },
    { name: "repeat", label: "Repeat", id: "83-01004", advisor, failed: [intro] },
    { name: "probation", label: "Probation", id: "83-01005", advisor, semester: 6, gpa: 3.7 },
    { name: "multiple", label: "Multiple Failures", id: "83-01006", advisor, failed: [intro, advanced] },
    { name: "credits", label: "Credits", id: "83-01007", advisor, major: creditMajor },
  ];
  for (const fixture of cases) {
    const user = await account(fixture.name, `A3 ${fixture.label} Student`, "advisingStudent");
    const student = await findOrInsert(StudentProfile, { user: user._id }, {
      assignedAdvisor: fixture.advisor._id, studentId: fixture.id, studentType: "advising",
      major: fixture.major ?? "CS", currentSemester: fixture.semester ?? 9, gpa: fixture.gpa ?? 2.5,
      academicStanding: "goodAcademicStanding", advisingReason: "failedCourses",
    });
    const recordAttempt = (course, result, grade) => findOrInsert(CourseAttempt, {
      course: course._id, student: student._id, term: past._id, attemptNumber: 1,
    }, { result, grade, attendance: "attended" });
    await Promise.all([
      ...electives.map((course) => recordAttempt(course, "passed", "A")),
      ...(fixture.failed ?? []).map((course) => recordAttempt(course, "failed", "F")),
    ]);
    if (fixture.name === "credits") {
      await findOrInsert(ExtraHoursRequest, { student: student._id, term: winter._id, "courses.course": approvedCourse._id }, {
        advisor: advisor._id,
        courses: [{ course: approvedCourse._id, hours: 3, isRepeated: false, pricePerHour: 800, subtotal: 2400 }],
        requestedHours: 3,
        totalCost: 2400,
        eligibilitySnapshot: { standardAllowance: 24, hoursBeforeRequest: 22, hoursAfterRequest: 25, isProbation: false, graduatingWithinOneYear: true },
        decisionStatus: "approved",
        decidedBy: coordinator._id,
        decisionNote: "Approved for A3H201 in A3WIN.",
        decidedAt: new Date(),
        settlementStatus: "deferred",
        settlementOption: "deferred",
      });
    }
  }

  console.log(`A3 graduation fixtures are ready in ${target.pathname.slice(1)}. Existing test progress was preserved.`);
  console.log("Advisor, other advisor, and coordinator emails use a3.advisor, a3.otheradvisor, and a3.coordinator at guc.edu.eg.");
  console.log(`Student emails use a3.plan, a3.exam, a3.other, a3.repeat, a3.probation, a3.multiple, and a3.credits at student.guc.edu.eg. Password: ${password}`);
} finally {
  await mongoose.disconnect();
}
