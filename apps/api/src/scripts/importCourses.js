import fs from "node:fs";
import mongoose from "mongoose";
import { Course } from "../models/catalogue.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(projectRoot, ".env");
const csvPath = path.join(scriptDir, "courses.csv");

function readCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ""; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length || row.length) { row.push(field); if (row.some(value => value.trim())) rows.push(row); }
  return rows;
}

function normalizeCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parseCurriculumCsv(text) {
  const rows = readCsv(text);
  const courses = new Map();
  let mergedListings = 0;
  let semester;
  let humanitiesSection = false;
  let major;
  let skippedPlaceholders = 0;

  rows.forEach((row, index) => {
    const firstCell = (row[0] ?? "").trim();
    const semesterMatch = firstCell.match(/^(\d+)(?:st|nd|rd|th)\s+Semester$/i);
    if (semesterMatch) {
      semester = Number(semesterMatch[1]);
      humanitiesSection = false;
      major = undefined;
      return;
    }
    if (/^(English|German) courses/i.test(firstCell)) {
      semester = undefined;
      humanitiesSection = true;
      major = undefined;
      return;
    }
    const majorMatch = firstCell.match(/^For\s+(CSEN|DMET)\s+Major:?$/i);
    if (majorMatch) {
      major = majorMatch[1].toUpperCase();
      return;
    }
    if (/^Course Code$/i.test(firstCell) || !firstCell || !row[1]?.trim() || !row[2]?.trim()) return;

    const rowNumber = index + 1;
    const localCode = row[1].trim();
    if (/xxxx/i.test(localCode) || firstCell.includes("/")) {
      skippedPlaceholders += 1;
      return;
    }
    const code = normalizeCode(`${firstCell}${localCode}`);
    if (!code) return;

    let lectureHours;
    let tutorialHours;
    let labHours;
    let creditHours;
    const componentTexts = [row[3], row[4], row[5]].map(value => (value ?? "").trim());
    const standaloneHours = componentTexts[0].match(/^(\d+(?:\.\d+)?)\s*Hours?$/i);
    if (componentTexts.some(Boolean) && !standaloneHours) {
      const components = componentTexts.map((value, column) => {
        if (!value) return 0;
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) {
          throw new Error(`CSV row ${rowNumber}: expected a non-negative hours value in column ${column + 4}`);
        }
        return number;
      });
      [lectureHours, tutorialHours, labHours] = components;
      // The sheet's note says two contact hours equal one credit hour.
      creditHours = components.reduce((sum, value) => sum + value, 0) / 2;
      // The sheet's Total Hours column can be inconsistent; component columns are the source for credit calculation.
    } else {
      if (!standaloneHours) throw new Error(`CSV row ${rowNumber}: course has no readable hours value`);
      creditHours = Number(standaloneHours[1]) / 2;
    }

    const prerequisites = row.slice(7, 10)
      .map(value => (value ?? "").trim())
      .filter(value => value && value.toUpperCase() !== "X")
      .map(normalizeCode);
    const course = {
      code,
      name: row[2].trim(),
      creditHours,
      courseType: humanitiesSection || normalizeCode(firstCell) === "HUMA" ? "huma" : "core",
      facultyMajors: major ? [major] : [],
      lectureHours,
      tutorialHours,
      labHours,
      prerequisites,
      ...(semester && { recommendedSemester: semester }),
    };

    if (courses.has(code)) {
      const existing = courses.get(code);
      existing.facultyMajors = [...new Set([...existing.facultyMajors, ...course.facultyMajors])];
      existing.prerequisites = [...new Set([...existing.prerequisites, ...course.prerequisites])];
      // recommendedSemester is singular in the model, so retain the first curriculum listing.
      mergedListings += 1;
      return;
    }
    courses.set(code, course);
  });

  if (!courses.size) throw new Error("No importable course rows found in courses.csv");
  const codes = new Set(courses.keys());
  for (const course of courses.values()) {
    for (const prerequisite of course.prerequisites) {
      if (!codes.has(prerequisite)) {
        throw new Error(`Course ${course.code} refers to prerequisite ${prerequisite}, which is not in this CSV`);
      }
      if (prerequisite === course.code) throw new Error(`Course ${course.code} cannot be its own prerequisite`);
    }
  }
  return { courses: [...courses.values()], mergedListings, skippedPlaceholders };
}

async function main() {
  if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
  if (!fs.existsSync(csvPath) || fs.statSync(csvPath).size === 0) {
    throw new Error(`CSV is missing or empty: ${csvPath}`);
  }

  const { courses, mergedListings, skippedPlaceholders } = parseCurriculumCsv(fs.readFileSync(csvPath, "utf8"));
  console.log(`Parsed ${courses.length} unique courses; merged ${mergedListings} repeated major/semester listing(s); skipped ${skippedPlaceholders} elective placeholders.`);
  if (process.argv.includes("--dry-run")) return;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error(`MONGODB_URI is not set. Add it to ${envPath}.`);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 7000 });
  console.log("Connected to MongoDB");
  try {
    for (const course of courses) {
      const { prerequisites, ...courseData } = course;
      await Course.findOneAndUpdate(
        { code: course.code },
        { $set: courseData },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
      );
    }

    const idsByCode = new Map((await Course.find({ code: { $in: courses.map(course => course.code) } }, { code: 1 }).lean()).map(course => [course.code, course._id]));
    for (const course of courses) {
      await Course.updateOne(
        { code: course.code },
        { $set: { prerequisites: course.prerequisites.map(code => idsByCode.get(code)) } },
        { runValidators: true },
      );
    }
    console.log(`Imported or updated ${courses.length} course(s) from ${csvPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error(`Course import failed: ${error.message}`);
  if (mongoose.connection.readyState !== 0) mongoose.disconnect().finally(() => process.exitCode = 1);
  else process.exitCode = 1;
});
