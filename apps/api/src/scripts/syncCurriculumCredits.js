import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Course } from "../models/catalogue.js";
import { StudentSchedule } from "../models/academics.js";
import { parseCurriculumCsv } from "./importCourses.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const csvPath = path.join(projectRoot, "apps/api/src/scripts/courses.csv");
const envPath = path.join(projectRoot, ".env");

async function main() {
  const apply = process.argv.includes("--apply");
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  const sourceCourses = parseCurriculumCsv(fs.readFileSync(csvPath, "utf8")).courses;
  const expectedByCode = new Map(sourceCourses.map(({ code, creditHours }) => [code, creditHours]));
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 7000 });
  try {
    const catalogue = await Course.find({ code: { $in: [...expectedByCode.keys()] } }, { code: 1, creditHours: 1 }).lean();
    const courseByCode = new Map(catalogue.map(course => [course.code, course]));
    const missing = [...expectedByCode.keys()].filter(code => !courseByCode.has(code));
    if (missing.length) throw new Error(`Catalogue is missing curriculum courses: ${missing.join(", ")}`);

    const expectedById = new Map(catalogue.map(course => [String(course._id), expectedByCode.get(course.code)]));
    const schedules = await StudentSchedule.find(
      { "courses.course": { $in: catalogue.map(course => course._id) } },
      { courses: 1 },
    ).lean();
    const courseUpdates = catalogue.filter(course => Number(course.creditHours) !== expectedByCode.get(course.code));
    const scheduleUpdates = schedules.map(schedule => {
      const set = {};
      schedule.courses.forEach((entry, index) => {
        const expected = expectedById.get(String(entry.course));
        if (expected !== undefined && Number(entry.creditHoursSnapshot) !== expected) {
          set[`courses.${index}.creditHoursSnapshot`] = expected;
        }
      });
      return { _id: schedule._id, set };
    }).filter(schedule => Object.keys(schedule.set).length);
    const snapshotCount = scheduleUpdates.reduce((count, schedule) => count + Object.keys(schedule.set).length, 0);

    console.log(`${apply ? "Applying" : "Dry run"}: ${sourceCourses.length} curriculum courses; ${courseUpdates.length} catalogue credits and ${snapshotCount} saved schedule credits to correct across ${scheduleUpdates.length} schedules.`);
    if (!apply) return;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const course of courseUpdates) {
          await Course.updateOne(
            { _id: course._id },
            { $set: { creditHours: expectedByCode.get(course.code) } },
            { session },
          );
        }
        for (const schedule of scheduleUpdates) {
          await StudentSchedule.updateOne(
            { _id: schedule._id },
            { $set: schedule.set },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    const updatedCourses = await Course.find({ code: { $in: [...expectedByCode.keys()] } }, { code: 1, creditHours: 1 }).lean();
    const updatedSchedules = await StudentSchedule.find(
      { "courses.course": { $in: catalogue.map(course => course._id) } },
      { courses: 1 },
    ).lean();
    if (updatedCourses.some(course => Number(course.creditHours) !== expectedByCode.get(course.code)) ||
        updatedSchedules.some(schedule => schedule.courses.some(entry => {
          const expected = expectedById.get(String(entry.course));
          return expected !== undefined && Number(entry.creditHoursSnapshot) !== expected;
        }))) {
      throw new Error("Credit-hour verification failed after the update");
    }
    console.log("Catalogue and saved schedule credits now match the curriculum.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(`Credit-hour sync failed: ${error.message}`);
  process.exitCode = 1;
});
