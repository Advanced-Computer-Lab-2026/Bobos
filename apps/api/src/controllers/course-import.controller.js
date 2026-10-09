import mongoose from "mongoose";
import { Course } from "../models/catalogue.js";
import { ACADEMIC_SEASONS } from "../models/shared.js";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_CSV_ROWS = 5000;

const HEADER_ALIASES = {
  code: ["code", "course code"],
  name: ["name", "course name", "course title"],
  creditHours: ["credit hours", "credits", "credit hour"],
  courseType: ["course type", "type"],
  facultyMajors: ["faculty/major", "faculty / major", "faculty major", "faculty/majors", "faculty majors", "major", "majors"],
  recommendedSemester: ["recommended semester", "semester"],
  offeringSeasons: ["offering season", "offering seasons", "season", "seasons"],
  prerequisites: ["prerequisite", "prerequisites", "prerequisite course codes"],
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field.length || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

const normalizeHeader = (value) => String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const splitList = (value) => String(value || "").split(/[;|]/).map((item) => item.trim()).filter(Boolean);

function csvError(row, field, message) {
  return { row, field, message };
}

export async function importCoursesCsv(req, res) {
  const csvText = req.body?.csvText;
  if (typeof csvText !== "string" || !csvText.trim()) {
    return res.status(400).json({ success: false, message: "Choose a non-empty CSV file." });
  }
  if (Buffer.byteLength(csvText, "utf8") > MAX_CSV_BYTES) {
    return res.status(413).json({ success: false, message: "CSV files must be 2 MB or smaller." });
  }

  let rows;
  try {
    rows = parseCsv(csvText);
  } catch (error) {
    return res.status(400).json({ success: false, errors: [csvError(1, "CSV", error.message)] });
  }
  if (rows.length < 2) {
    return res.status(400).json({ success: false, errors: [csvError(1, "CSV", "Include a header row and at least one course row.")] });
  }
  if (rows.length - 1 > MAX_CSV_ROWS) {
    return res.status(400).json({ success: false, message: `A file can contain at most ${MAX_CSV_ROWS} course rows.` });
  }

  const headerIndexes = new Map();
  const errors = [];
  const headers = rows[0].map(normalizeHeader);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const matches = headers.flatMap((header, index) => aliases.includes(header) ? [index] : []);
    if (!matches.length) errors.push(csvError(1, field, `Missing required column: ${aliases[0]}.`));
    else if (matches.length > 1) errors.push(csvError(1, field, `Column appears more than once: ${aliases[0]}.`));
    else headerIndexes.set(field, matches[0]);
  }
  if (errors.length) return res.status(400).json({ success: false, errors });

  const parsedCourses = [];
  const rowByCode = new Map();
  for (const [index, row] of rows.slice(1).entries()) {
    const rowNumber = index + 2;
    if (row.length !== headers.length) {
      errors.push(csvError(rowNumber, "CSV", `Expected ${headers.length} columns but found ${row.length}.`));
      continue;
    }
    const value = (field) => String(row[headerIndexes.get(field)] ?? "").trim();
    const code = normalizeCode(value("code"));
    const name = value("name");
    const courseTypeInput = value("courseType").toLowerCase();
    const courseType = courseTypeInput === "humanities" ? "huma" : courseTypeInput;
    const creditText = value("creditHours");
    const semesterText = value("recommendedSemester");
    const creditHours = creditText === "" ? Number.NaN : Number(creditText);
    const recommendedSemester = semesterText === "" ? Number.NaN : Number(semesterText);
    const facultyMajorsText = value("facultyMajors");
    const allMajors = /^(all|all majors|all faculties)$/i.test(facultyMajorsText);
    const facultyMajors = allMajors ? [] : splitList(facultyMajorsText);
    const seasonsText = value("offeringSeasons");
    const seasonInputs = splitList(seasonsText);
    const seasonByNormalized = new Map(ACADEMIC_SEASONS.map((season) => [season.toLowerCase().replace(/\s+/g, ""), season]));
    const offeringSeasons = seasonInputs.map((season) => seasonByNormalized.get(season.toLowerCase().replace(/[\s_-]+/g, "")) || season);
    const prerequisiteCodes = splitList(value("prerequisites")).map(normalizeCode);

    if (!code) errors.push(csvError(rowNumber, "code", "Course code is required."));
    else if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(code)) errors.push(csvError(rowNumber, "code", "Course code may contain only letters, numbers, dots, underscores, and hyphens."));
    if (!name) errors.push(csvError(rowNumber, "name", "Course name is required."));
    if (!creditText || !Number.isFinite(creditHours) || creditHours < 0) errors.push(csvError(rowNumber, "creditHours", "Credit hours must be a number greater than or equal to 0."));
    if (!["core", "elective", "huma"].includes(courseType)) errors.push(csvError(rowNumber, "courseType", "Course type must be core, elective, or huma."));
    if (!semesterText || !Number.isInteger(recommendedSemester) || recommendedSemester < 1 || recommendedSemester > 10) {
      errors.push(csvError(rowNumber, "recommendedSemester", "Recommended semester must be a whole number from 1 to 10."));
    }
    if (!facultyMajorsText || (!allMajors && !facultyMajors.length)) errors.push(csvError(rowNumber, "facultyMajors", 'Faculty/Major is required; use "All" if the course is open to everyone.'));
    if (!offeringSeasons.length) errors.push(csvError(rowNumber, "offeringSeasons", "At least one offering season is required."));
    for (const season of offeringSeasons) {
      if (!ACADEMIC_SEASONS.includes(season)) errors.push(csvError(rowNumber, "offeringSeasons", `Unknown season "${season}". Use: ${ACADEMIC_SEASONS.join(", ")}.`));
    }
    if (new Set(prerequisiteCodes).size !== prerequisiteCodes.length) errors.push(csvError(rowNumber, "prerequisites", "Prerequisites cannot contain duplicate course codes."));
    if (code && rowByCode.has(code)) errors.push(csvError(rowNumber, "code", `Course code ${code} is duplicated in this file (first used on row ${rowByCode.get(code)}).`));
    else if (code) rowByCode.set(code, rowNumber);

    parsedCourses.push({ row: rowNumber, code, name, creditHours, courseType, facultyMajors, recommendedSemester, offeringSeasons, prerequisiteCodes });
  }

  if (errors.length) return res.status(400).json({ success: false, errors });

  const existingCourses = await Course.find({}, { _id: 1, code: 1 }).lean();
  const idByCode = new Map(existingCourses.map((course) => [normalizeCode(course.code), course._id]));
  for (const course of parsedCourses) {
    for (const prerequisiteCode of course.prerequisiteCodes) {
      if (prerequisiteCode === course.code) errors.push(csvError(course.row, "prerequisites", "A course cannot be its own prerequisite."));
      else if (!idByCode.has(prerequisiteCode) && !rowByCode.has(prerequisiteCode)) {
        errors.push(csvError(course.row, "prerequisites", `Prerequisite ${prerequisiteCode} is not in the catalogue or this CSV.`));
      }
    }
  }
  if (errors.length) return res.status(400).json({ success: false, errors });

  const idFor = (code) => {
    if (!idByCode.has(code)) idByCode.set(code, new mongoose.Types.ObjectId());
    return idByCode.get(code);
  };
  const validated = [];
  for (const course of parsedCourses) {
    const { row, prerequisiteCodes, ...fields } = course;
    const doc = new Course({
      _id: idFor(course.code),
      ...fields,
      prerequisites: prerequisiteCodes.map(idFor),
    });
    try {
      await doc.validate();
      validated.push(doc);
    } catch (error) {
      for (const [field, detail] of Object.entries(error.errors || {})) errors.push(csvError(row, field, detail.message));
      if (!error.errors) errors.push(csvError(row, "course", error.message));
    }
  }
  if (errors.length) return res.status(400).json({ success: false, errors });

  const existingCodes = new Set(existingCourses.map((course) => normalizeCode(course.code)));
  const now = new Date();
  const operations = validated.map((course) => {
    const { _id, code, name, creditHours, courseType, facultyMajors, recommendedSemester, offeringSeasons, prerequisites } = course;
    const fields = { name, creditHours, courseType, facultyMajors, recommendedSemester, offeringSeasons, prerequisites, updatedAt: now };
    return {
      updateOne: {
        filter: { code },
        update: {
          $set: fields,
          $setOnInsert: { _id, code, isActive: true, isBachelorProject: false, createdAt: now },
        },
        upsert: true,
      },
    };
  });

  try {
    await Course.bulkWrite(operations, { ordered: true });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "A course code changed during import. Refresh the catalogue and try again." });
    throw error;
  }

  const created = parsedCourses.filter((course) => !existingCodes.has(course.code)).length;
  res.json({ success: true, total: parsedCourses.length, created, updated: parsedCourses.length - created });
}
