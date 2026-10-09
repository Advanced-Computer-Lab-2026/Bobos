import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { AdvisorAssignment, StudentProfile, User } from '../models/identity.js';
import { AcademicTerm, Course, CourseOffering } from '../models/catalogue.js';
import { StudentWorkflowState } from '../models/academics.js';
import { parseCurriculumCsv } from '../scripts/importCourses.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bobos';
const DEVELOPMENT_PASSWORD = 'Password123!';
const CURRICULUM_URL = new URL('../scripts/courses.csv', import.meta.url);

async function upsertUser(email, fields) {
  let user = await User.findOne({ email });
  if (!user) user = new User({ email, ...fields });
  else Object.assign(user, fields);
  await user.save();
  return user;
}

function assertLocalDatabase(uri) {
  if (process.env.EVALUATION_SEED_ALLOW_REMOTE === 'true') return;
  let hostname;
  try {
    hostname = new URL(uri).hostname.toLowerCase();
  } catch {
    throw new Error('MONGODB_URI is not a valid MongoDB URL.');
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Evaluation seed writes only to local MongoDB by default. Set EVALUATION_SEED_ALLOW_REMOTE=true only when intentionally seeding a remote development database.');
  }
}

function academicYear(startYear) {
  return `${startYear}/${startYear + 1}`;
}

function termDates(code, startYear, season) {
  const spring = season === 'spring';
  const start = spring ? new Date(Date.UTC(startYear, 8, 15)) : new Date(Date.UTC(startYear + 1, 1, 1));
  const end = spring ? new Date(Date.UTC(startYear + 1, 0, 31)) : new Date(Date.UTC(startYear + 1, 5, 15));
  const day = 24 * 60 * 60 * 1000;
  return {
    code,
    academicYear: academicYear(startYear),
    season,
    termStart: start,
    termEnd: end,
    teachingStart: new Date(start.getTime() + 7 * day),
    teachingEnd: new Date(end.getTime() - 14 * day),
    registrationStart: new Date(start.getTime() - 14 * day),
    registrationEnd: new Date(start.getTime() + 5 * day),
    advisingDeadline: new Date(start.getTime() + 14 * day),
    wholeScheduleSwapDeadline: new Date(start.getTime() + 21 * day),
    isActive: code === '60-',
  };
}

const termsToSeed = [
  termDates('54-', 2023, 'spring'), termDates('55-', 2023, 'winter'),
  termDates('56-', 2024, 'spring'), termDates('57-', 2024, 'winter'),
  termDates('58-', 2025, 'spring'), termDates('59-', 2025, 'winter'),
  termDates('60-', 2026, 'spring'), termDates('61-', 2026, 'winter'),
];

async function seedTerms() {
  const terms = [];
  for (const fields of termsToSeed) {
    const term = await AcademicTerm.findOneAndUpdate(
      { academicYear: fields.academicYear, season: fields.season },
      { $set: fields },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    terms.push(term);
  }
  return terms;
}

async function seedCurriculum() {
  const csv = await readFile(CURRICULUM_URL, 'utf8');
  const { courses: curriculumCourses, mergedListings, skippedPlaceholders } = parseCurriculumCsv(csv);
  const electives = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    return {
      code: `ELEC${String(number).padStart(3, '0')}`,
      name: [
        'Artificial Intelligence Applications', 'Data Visualization', 'Human Computer Interaction',
        'Cybersecurity Fundamentals', 'Digital Storytelling', 'Mobile Application Development',
        'Machine Learning', 'Game Design', 'Cloud Computing', 'Media Production',
      ][index],
      creditHours: 4,
      courseType: 'elective',
      facultyMajors: ['CS', 'DMET'],
      recommendedSemester: 9,
      offeringSeasons: ['winter', 'spring'],
      isActive: true,
    };
  });
  const allCourses = [...curriculumCourses, ...electives];

  for (const course of allCourses) {
    const { prerequisites, ...fields } = course;
    await Course.findOneAndUpdate(
      { code: course.code },
      { $set: { ...fields, prerequisites: [] } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const idsByCode = new Map((await Course.find({ code: { $in: allCourses.map(({ code }) => code) } }, { code: 1 }).lean())
    .map(({ code, _id }) => [code, _id]));
  for (const course of curriculumCourses) {
    await Course.updateOne(
      { code: course.code },
      { $set: { prerequisites: course.prerequisites.map((code) => idsByCode.get(code)) } },
      { runValidators: true },
    );
  }

  return { curriculumCount: curriculumCourses.length, electiveCount: electives.length, mergedListings, skippedPlaceholders };
}

async function seedAccounts(currentTerm, passwordHash) {
  const administrator = await upsertUser('evaluation.admin@guc.edu.eg', {
    fullName: 'Evaluation Administrator', passwordHash, role: 'administrator', isActive: true,
  });
  const coordinator = await upsertUser('evaluation.coordinator@guc.edu.eg', {
    fullName: 'Evaluation Coordinator', passwordHash, role: 'coordinator', isActive: true,
  });
  const advisors = [];
  for (let index = 1; index <= 5; index += 1) {
    const email = `evaluation.advisor${index}@guc.edu.eg`;
    advisors.push(await upsertUser(email, {
      fullName: `Evaluation Advisor ${index}`, passwordHash, role: 'advisor', isActive: true, isAdvisorInSystem: true,
    }));
  }

  const studyGroups = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
  const students = [];
  for (let index = 1; index <= 10; index += 1) {
    const email = `evaluation.student${index}@student.guc.edu.eg`;
    const user = await upsertUser(email, {
      fullName: `Evaluation Advising Student ${index}`, passwordHash, role: 'advisingStudent', isActive: true,
    });
    const onProbation = index === 2 || index === 5 || index === 8 || index === 10;
    const advisor = advisors[(index - 1) % advisors.length];
    const profile = await StudentProfile.findOneAndUpdate(
      { user: user._id },
      { $set: {
        user: user._id,
        studentId: `61-${String(index).padStart(5, '0')}`,
        studentType: 'advising',
        faculty: 'MET',
        major: index % 2 === 0 ? 'CS' : 'DMET',
        currentSemester: index,
        gpa: onProbation ? Number((1.4 + (index % 6) * 0.1).toFixed(2)) : Number((2.45 + (index % 14) * 0.1).toFixed(2)),
        academicStanding: onProbation ? 'probation' : 'goodAcademicStanding',
        enrollmentStatus: index === 10 ? 'inactive' : 'active',
        studyGroup: studyGroups[index - 1],
        advisingReason: onProbation ? 'probation' : index % 3 === 0 ? 'failedCourses' : 'undeclaredMajor',
        assignedAdvisor: advisor._id,
      } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    await AdvisorAssignment.findOneAndUpdate(
      { student: profile._id, endedAt: null },
      { $set: { student: profile._id, advisor: advisor._id, assignedBy: coordinator._id, endedAt: null } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    await StudentWorkflowState.findOneAndUpdate(
      { student: profile._id, term: currentTerm._id },
      { $set: { student: profile._id, term: currentTerm._id, studentType: 'advising', status: 'notStarted', lastActivityAt: new Date(), calculatedAt: new Date() } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    students.push({ user, profile });
  }

  return { administrator, coordinator, advisors, students };
}

async function seedCurrentTermOfferings(term) {
  const specs = [
    {
      courseCode: 'CSEN102', isPublished: true,
      eligibleGroups: [{ major: 'CS', semester: 1 }, { major: 'DMET', semester: 1 }],
      slots: [
        { componentType: 'lecture', groupNumber: '1', day: 'Monday', startMinute: 540, endMinute: 600, room: 'C7.301', capacity: 120 },
        { componentType: 'tutorial', groupNumber: '1', day: 'Tuesday', startMinute: 600, endMinute: 660, room: 'C6.202', capacity: 35 },
        { componentType: 'lab', groupNumber: '1', day: 'Wednesday', startMinute: 720, endMinute: 780, room: 'B4.014', capacity: 25 },
      ],
    },
    {
      courseCode: 'MATH103', isPublished: true,
      eligibleGroups: [{ major: 'CS', semester: 1 }, { major: 'DMET', semester: 1 }],
      slots: [
        { componentType: 'lecture', groupNumber: '1', day: 'Monday', startMinute: 660, endMinute: 720, room: 'C7.101', capacity: 120 },
        { componentType: 'tutorial', groupNumber: '1', day: 'Tuesday', startMinute: 720, endMinute: 780, room: 'C5.101', capacity: 35 },
      ],
    },
    {
      courseCode: 'ELEC001', isPublished: true,
      eligibleGroups: [{ major: 'CS', semester: 9 }],
      slots: [
        { componentType: 'lecture', groupNumber: '1', day: 'Thursday', startMinute: 540, endMinute: 600, room: 'C6.101', capacity: 45 },
      ],
    },
    {
      courseCode: 'CSEN202', isPublished: false,
      eligibleGroups: [{ major: 'CS', semester: 2 }, { major: 'DMET', semester: 2 }],
      slots: [
        { componentType: 'lecture', groupNumber: '1', day: 'Friday', startMinute: 540, endMinute: 600, room: 'C7.302', capacity: 100 },
      ],
    },
  ];
  const offerings = [];
  for (const spec of specs) {
    const course = await Course.findOne({ code: spec.courseCode });
    if (!course) throw new Error(`Cannot seed ${spec.courseCode}: course is missing from the curriculum.`);
    const { courseCode, ...fields } = spec;
    const offering = await CourseOffering.findOneAndUpdate(
      { term: term._id, course: course._id },
      { $setOnInsert: {
        course: course._id,
        term: term._id,
        academicYear: term.academicYear,
        instructors: [{ fullName: 'Evaluation Faculty Member', email: 'evaluation.faculty@guc.edu.eg' }],
        ...fields,
      } },
      { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
    );
    offerings.push({ code: course.code, isPublished: offering.isPublished });
  }
  return offerings;
}

async function seedEvaluationData() {
  assertLocalDatabase(MONGODB_URI);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 7000 });
  try {
    const passwordHash = await bcrypt.hash(DEVELOPMENT_PASSWORD, 10);
    const terms = await seedTerms();
    const courses = await seedCurriculum();
    const accounts = await seedAccounts(terms.find(({ code }) => code === '60-'), passwordHash);
    const offerings = await seedCurrentTermOfferings(terms.find(({ code }) => code === '60-'));
    const totalTermCount = await AcademicTerm.countDocuments();

    console.log('Evaluation seed completed (idempotent; no collections were cleared).');
    console.log(`Advising students: ${accounts.students.length}; advisors: ${accounts.advisors.length}; coordinator: 1; administrator: 1`);
    console.log(`Courses: ${courses.curriculumCount} curriculum courses from courses.csv + ${courses.electiveCount} electives`);
    console.log(`Terms added/updated: ${terms.map(({ code }) => code).join(', ')}; total terms in database: ${totalTermCount}; active term: 60-`);
    console.log(`Offerings in active term 60-: ${offerings.map(({ code, isPublished }) => `${code} (${isPublished ? 'published' : 'draft'})`).join(', ')}`);
    console.log(`Curriculum repeated listings merged: ${courses.mergedListings}; elective placeholders skipped: ${courses.skippedPlaceholders}`);
    console.log(`Evaluation account password: ${DEVELOPMENT_PASSWORD}`);
    console.log('Accounts: evaluation.admin@guc.edu.eg; evaluation.coordinator@guc.edu.eg; evaluation.advisor1-5@guc.edu.eg; evaluation.student1-10@student.guc.edu.eg');
  } finally {
    await mongoose.disconnect();
  }
}

seedEvaluationData().catch((error) => {
  console.error(`Evaluation seed failed: ${error.message}`);
  process.exitCode = 1;
});
