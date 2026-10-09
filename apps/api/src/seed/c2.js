import mongoose from "mongoose";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bobos";

function assertLocalDatabase(uri) {
  if (process.env.C2_SEED_ALLOW_REMOTE === "true") return;

  let host;
  try {
    host = new URL(uri).hostname.toLowerCase();
  } catch {
    throw new Error("MONGODB_URI is not a valid MongoDB URL.");
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(
      "C2 seed only writes to a local MongoDB by default. Set C2_SEED_ALLOW_REMOTE=true only if you intentionally want to seed a remote development database.",
    );
  }
}

async function findOrCreate(Model, filter, fields) {
  const existing = await Model.findOne(filter);
  if (existing) return { document: existing, created: false };

  try {
    return { document: await Model.create(fields), created: true };
  } catch (error) {
    // Make reruns safe if another seed process inserts the same unique record.
    if (error.code === 11000) {
      const raced = await Model.findOne(filter);
      if (raced) return { document: raced, created: false };
    }
    throw error;
  }
}

async function seedC2() {
  assertLocalDatabase(MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  const { document: term, created: termCreated } = await findOrCreate(
    AcademicTerm,
    { code: "C2DEMO2098" },
    {
      code: "C2DEMO2098",
      academicYear: "2098/2099",
      season: "spring",
      termStart: new Date("2099-01-10T00:00:00.000Z"),
      termEnd: new Date("2099-05-31T00:00:00.000Z"),
      teachingStart: new Date("2099-01-17T00:00:00.000Z"),
      teachingEnd: new Date("2099-05-20T00:00:00.000Z"),
      registrationStart: new Date("2099-01-03T00:00:00.000Z"),
      registrationEnd: new Date("2099-01-20T00:00:00.000Z"),
      advisingDeadline: new Date("2099-01-24T00:00:00.000Z"),
      wholeScheduleSwapDeadline: new Date("2099-02-01T00:00:00.000Z"),
      isActive: false,
    },
  );

  const courseSpecs = [
    {
      code: "C2DEMO101",
      name: "C2 Demo Systems",
      creditHours: 3,
      courseType: "core",
      facultyMajors: ["CS"],
      recommendedSemester: 3,
      offeringSeasons: ["spring"],
    },
    {
      code: "C2DEMO102",
      name: "C2 Demo Mathematics",
      creditHours: 3,
      courseType: "core",
      facultyMajors: ["CS"],
      recommendedSemester: 3,
      offeringSeasons: ["spring"],
    },
    {
      code: "C2DEMO103",
      name: "C2 Demo Draft Offering",
      creditHours: 2,
      courseType: "elective",
      facultyMajors: ["CS"],
      recommendedSemester: 3,
      offeringSeasons: ["spring"],
    },
  ];

  const courses = [];
  const createdCourses = [];
  for (const spec of courseSpecs) {
    const result = await findOrCreate(Course, { code: spec.code }, spec);
    courses.push(result.document);
    if (result.created) createdCourses.push(spec.code);
  }

  const offeringSpecs = [
    {
      course: courses[0],
      isPublished: true,
      slots: [
        { componentType: "lecture", groupNumber: "L1", day: "Monday", startMinute: 540, endMinute: 600, room: "C2-DEMO-ROOM-1", capacity: 40 },
        { componentType: "lecture", groupNumber: "L2", day: "Wednesday", startMinute: 540, endMinute: 600, room: "C2-DEMO-ROOM-1", capacity: 40 },
        { componentType: "tutorial", groupNumber: "T1", day: "Tuesday", startMinute: 600, endMinute: 660, room: "C2-DEMO-ROOM-2", capacity: 20 },
        { componentType: "tutorial", groupNumber: "T2", day: "Thursday", startMinute: 600, endMinute: 660, room: "C2-DEMO-ROOM-3", capacity: 20 },
        { componentType: "lab", groupNumber: "B1", day: "Wednesday", startMinute: 720, endMinute: 780, room: "C2-DEMO-LAB-1", capacity: 18 },
      ],
    },
    {
      course: courses[1],
      isPublished: true,
      slots: [
        { componentType: "lecture", groupNumber: "L1", day: "Monday", startMinute: 660, endMinute: 720, room: "C2-DEMO-ROOM-1", capacity: 40 },
        { componentType: "tutorial", groupNumber: "T1", day: "Tuesday", startMinute: 720, endMinute: 780, room: "C2-DEMO-ROOM-2", capacity: 20 },
      ],
    },
    {
      course: courses[2],
      isPublished: false,
      slots: [
        { componentType: "lecture", groupNumber: "L1", day: "Friday", startMinute: 540, endMinute: 600, room: "C2-DEMO-ROOM-4", capacity: 35 },
      ],
    },
  ];

  const offerings = [];
  const createdOfferings = [];
  for (const spec of offeringSpecs) {
    const { course, ...offeringFields } = spec;
    const result = await findOrCreate(
      CourseOffering,
      { term: term._id, course: course._id },
      {
        course: course._id,
        term: term._id,
        academicYear: term.academicYear,
        instructors: [{ fullName: "C2 Demo Instructor", email: "c2.demo@guc.edu.eg" }],
        eligibleGroups: [{ major: "CS", semester: 3, studyGroup: "C2-DEMO-G1" }],
        ...offeringFields,
      },
    );
    offerings.push(result.document);
    if (result.created) createdOfferings.push(course.code);
  }

  console.log("C2 development seed is ready.");
  console.log(`Term: ${term.code} (${termCreated ? "created" : "already existed"})`);
  console.log(`Term ID: ${term._id}`);
  console.log(`Academic year/season: ${term.academicYear} / ${term.season}`);
  console.log(`Courses: ${courses.map((course) => course.code).join(", ")}`);
  console.log(`Offerings: ${offerings.map((offering, index) => `${courses[index].code}=${offering._id}${offering.isPublished ? " [published]" : " [draft]"}`).join("; ")}`);
  console.log(`New courses this run: ${createdCourses.length ? createdCourses.join(", ") : "none (already present)"}`);
  console.log(`New offerings this run: ${createdOfferings.length ? createdOfferings.join(", ") : "none (already present)"}`);
}

seedC2()
  .catch((error) => {
    console.error("C2 seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
