import mongoose from "mongoose";
import { User, StudentProfile } from "../models/identity.js";
import { Course, AcademicTerm, CourseOffering } from "../models/catalogue.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bobos";

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB for seeding...");

    // Clear existing data (optional, but good for idempotency)
    await User.deleteMany({});
    await StudentProfile.deleteMany({});
    await Course.deleteMany({});
    await AcademicTerm.deleteMany({});
    await CourseOffering.deleteMany({});

    console.log("Cleared existing data.");

    // 1. 1 Administrator
    const admin = await User.create({
      email: "admin@guc.edu.eg",
      fullName: "System Administrator",
      passwordHash: "dummy_hash",
      role: "administrator"
    });

    // 2. 1 Coordinator
    const coordinator = await User.create({
      email: "coordinator@guc.edu.eg",
      fullName: "MET Coordinator",
      passwordHash: "dummy_hash",
      role: "coordinator"
    });

    // 3. 5 Advisors
    const advisors = [];
    for (let i = 1; i <= 5; i++) {
      const advisor = await User.create({
        email: `advisor${i}@guc.edu.eg`,
        fullName: `Advisor ${i}`,
        passwordHash: "dummy_hash",
        role: "advisor"
      });
      advisors.push(advisor);
    }

    // 4. 10 Advising Students
    const studentPromises = [];
    for (let i = 1; i <= 10; i++) {
      const isProbation = i <= 5;
      const major = i % 2 === 0 ? "CS" : "DMET";
      const gpa = isProbation ? 1.5 + (i * 0.1) : 3.0 + (i * 0.1);
      
      const user = await User.create({
        email: `student${i}@student.guc.edu.eg`,
        fullName: `Advising Student ${i}`,
        passwordHash: "dummy_hash",
        role: "advisingStudent"
      });

      studentPromises.push(StudentProfile.create({
        user: user._id,
        studentId: `55-${String(i).padStart(5, '0')}`,
        studentType: "advising",
        faculty: "MET",
        major: major,
        currentSemester: (i % 10) + 1,
        gpa: parseFloat(gpa.toFixed(2)),
        academicStanding: isProbation ? "probation" : "goodAcademicStanding",
        enrollmentStatus: i === 10 ? "inactive" : "active",
        studyGroup: `Group ${i}`,
        advisingReason: isProbation ? "probation" : "failedCourses",
        assignedAdvisor: advisors[i % 5]._id
      }));
    }
    await Promise.all(studentPromises);

    // 5. CS and DMET Courses
    const coreCourses = [
      { code: "CSEN102", name: "Introduction to Computer Science", creditHours: 4, courseType: "core", facultyMajors: ["CS", "DMET"], recommendedSemester: 1, offeringSeasons: ["winter", "spring"] },
      { code: "CSEN202", name: "Introduction to Computer Programming", creditHours: 4, courseType: "core", facultyMajors: ["CS", "DMET"], recommendedSemester: 2, offeringSeasons: ["winter", "spring"] },
      { code: "CSEN301", name: "Data Structures and Algorithms", creditHours: 4, courseType: "core", facultyMajors: ["CS", "DMET"], recommendedSemester: 3, offeringSeasons: ["winter", "spring"] },
      { code: "DMET501", name: "Introduction to Media Engineering", creditHours: 4, courseType: "core", facultyMajors: ["DMET"], recommendedSemester: 5, offeringSeasons: ["winter"] },
      { code: "CSEN401", name: "Computer Programming Lab", creditHours: 4, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 4, offeringSeasons: ["winter", "spring"] },
      { code: "MATH103", name: "Maths", creditHours: 6, courseType: "core", facultyMajors: ["CS", "DMET"], recommendedSemester: 1, offeringSeasons: ["winter", "spring"] },
    ];
    const insertedCourses = await Course.insertMany(coreCourses);

    // 6. 10 Electives
    const electives = [];
    for (let i = 1; i <= 10; i++) {
      electives.push({
        code: `ELEC0${i < 10 ? '0'+i : i}`,
        name: `Elective Course ${i}`,
        creditHours: 4,
        courseType: "elective",
        facultyMajors: i % 2 === 0 ? ["CS"] : ["DMET"],
        offeringSeasons: ["winter", "spring"],
      });
    }
    await Course.insertMany(electives);

    // 7. Academic Terms (needed for Req 22 & 23)
    const winterTerm = await AcademicTerm.create({
      code: "W2026",
      academicYear: "2025-2026",
      season: "winter",
      termStart: new Date("2026-02-01"),
      termEnd: new Date("2026-06-15"),
      teachingStart: new Date("2026-02-08"),
      teachingEnd: new Date("2026-06-01"),
      registrationStart: new Date("2026-01-15"),
      registrationEnd: new Date("2026-02-15"),
      advisingDeadline: new Date("2026-02-20"),
      wholeScheduleSwapDeadline: new Date("2026-03-01"),
      isActive: false,
    });

    const springTerm = await AcademicTerm.create({
      code: "S2026",
      academicYear: "2025-2026",
      season: "spring",
      termStart: new Date("2026-09-15"),
      termEnd: new Date("2027-01-31"),
      teachingStart: new Date("2026-09-22"),
      teachingEnd: new Date("2027-01-15"),
      registrationStart: new Date("2026-09-01"),
      registrationEnd: new Date("2026-09-20"),
      advisingDeadline: new Date("2026-09-25"),
      wholeScheduleSwapDeadline: new Date("2026-10-05"),
      isActive: true,
    });

    // 8. Sample Course Offerings with slots (Req 22 demo data)
    await CourseOffering.create({
      course: insertedCourses[0]._id, // CSEN102
      term: springTerm._id,
      instructors: [
        { fullName: "Dr. Slim Abdennadher", email: "slim.abdennadher@guc.edu.eg" },
      ],
      eligibleGroups: [
        { major: "CS", semester: 1 },
        { major: "DMET", semester: 1 },
      ],
      isPublished: true,
      slots: [
        { componentType: "lecture", groupNumber: "1", day: "Monday", startMinute: 510, endMinute: 600, room: "C7.301", capacity: 150 },
        { componentType: "lecture", groupNumber: "2", day: "Wednesday", startMinute: 510, endMinute: 600, room: "C7.301", capacity: 150 },
        { componentType: "tutorial", groupNumber: "T1", day: "Tuesday", startMinute: 615, endMinute: 705, room: "C6.202", capacity: 35 },
        { componentType: "tutorial", groupNumber: "T2", day: "Thursday", startMinute: 615, endMinute: 705, room: "C6.203", capacity: 35 },
        { componentType: "lab", groupNumber: "L1", day: "Wednesday", startMinute: 720, endMinute: 810, room: "B4.014", capacity: 25 },
        { componentType: "lab", groupNumber: "L2", day: "Thursday", startMinute: 720, endMinute: 810, room: "B4.015", capacity: 25 },
      ],
    });

    await CourseOffering.create({
      course: insertedCourses[5]._id, // MATH103
      term: springTerm._id,
      instructors: [
        { fullName: "Dr. Ahmed ElSheikh", email: "ahmed.elsheikh@guc.edu.eg" },
      ],
      eligibleGroups: [
        { major: "CS", semester: 1 },
        { major: "DMET", semester: 1 },
      ],
      isPublished: true,
      slots: [
        { componentType: "lecture", groupNumber: "1", day: "Sunday", startMinute: 510, endMinute: 600, room: "C7.101", capacity: 200 },
        { componentType: "lecture", groupNumber: "2", day: "Tuesday", startMinute: 510, endMinute: 600, room: "C7.101", capacity: 200 },
        { componentType: "tutorial", groupNumber: "T1", day: "Monday", startMinute: 615, endMinute: 705, room: "C5.101", capacity: 40 },
        { componentType: "tutorial", groupNumber: "T2", day: "Wednesday", startMinute: 615, endMinute: 705, room: "C5.102", capacity: 40 },
      ],
    });

    console.log("Seeding completed successfully!");
    console.log("  - 1 Admin, 1 Coordinator, 5 Advisors, 10 Students");
    console.log("  - 6 Core courses, 10 Electives");
    console.log("  - 2 Academic terms (Winter 2026, Spring 2026)");
    console.log("  - 2 Sample course offerings with slots");
    process.exit(0);
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
}

seed();
