// Seed script - `npm run seed` (from server/) or `npm run seed` (from the root).
//
// Produces everything the course's "Evaluation DB" sheet asks for (the whole CS
// and DMET catalogue, 10 electives, 5 advisors, 1 coordinator, 1 administrator,
// 10 advising students) PLUS what requirement 30 needs to be demoable today:
// academic terms, PUBLISHED course offerings with real lecture/tutorial/lab
// slots, PUBLISHED standard schedule templates (and one unpublished one), and
// normal students that are deliberately left UNASSIGNED.
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { AcademicTerm } from '../models/AcademicTerm.js';
import { Course } from '../models/Course.js';
import { CourseOffering } from '../models/CourseOffering.js';
import { ScheduleTemplate } from '../models/ScheduleTemplate.js';
import { StudentSchedule } from '../models/StudentSchedule.js';
import { findFirstClash, describeSlot, DAYS } from '../utils/timetable.js';
import { CURRICULUM, ELECTIVES, COHORT_COURSES, INSTRUCTORS } from './curriculumData.js';

const DEV_PASSWORD = 'Bobos#2026';
const PUBLISHED_GROUPS = ['1', '2', '3'];
const UNPUBLISHED_GROUP = '4';
const SLOT_CAPACITY = 30;

// GUC-style teaching periods, Saturday to Thursday.
const PERIODS = [
  { start: '08:15', end: '10:00' },
  { start: '10:15', end: '12:00' },
  { start: '12:15', end: '14:00' },
  { start: '14:15', end: '16:00' },
  { start: '16:15', end: '18:00' }
];

const COMPONENTS = ['lecture', 'tutorial', 'lab'];

// Sheet rule: "2 hours = 1 lecture or 1 tutorial or 1 lab".
function sessionsPerWeek(hours) {
  return hours > 0 ? Math.ceil(hours / 2) : 0;
}

// A ScheduleTemplate entry references exactly ONE lecture, ONE tutorial and ONE
// lab slot id, so a component that the sheet says runs for several sessions is
// seeded as one longer block spanning consecutive periods (capped at 2 periods).
function periodSpan(hours) {
  return Math.min(Math.max(sessionsPerWeek(hours), 1), 2);
}

function hoursOf(course, component) {
  if (component === 'lecture') return course.lec;
  if (component === 'tutorial') return course.tut;
  return course.lab;
}

function roomFor(component, index) {
  if (component === 'lecture') return `H${(index % 6) + 1}`;
  if (component === 'tutorial') return `C7.${(index % 8) + 1}`;
  return `Lab ${(index % 5) + 1}`;
}

/* ----------------------------------------------------------- slot generation */

// Allocates clash-free (day, period) blocks for ONE cohort group. Because every
// cohort group gets its own slots, a template built from them cannot clash.
function makeAllocator(startOffset) {
  const cells = [];
  for (const day of DAYS) {
    for (let p = 0; p < PERIODS.length; p += 1) cells.push({ day, period: p });
  }
  const used = new Set();
  let cursor = startOffset % cells.length;

  return function take(span) {
    for (let step = 0; step < cells.length; step += 1) {
      const index = (cursor + step) % cells.length;
      const cell = cells[index];
      if (cell.period + span > PERIODS.length) continue;

      let free = true;
      for (let k = 0; k < span; k += 1) {
        if (used.has(`${cell.day}-${cell.period + k}`)) { free = false; break; }
      }
      if (!free) continue;

      for (let k = 0; k < span; k += 1) used.add(`${cell.day}-${cell.period + k}`);
      cursor = (index + span) % cells.length;
      return {
        day: cell.day,
        startTime: PERIODS[cell.period].start,
        endTime: PERIODS[cell.period + span - 1].end
      };
    }
    throw new Error('Ran out of free timetable cells - add more periods or days.');
  };
}

/* -------------------------------------------------------------------- helpers */

function pad(n, width = 4) {
  return String(n).padStart(width, '0');
}

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bobos';
  await mongoose.connect(uri, { autoIndex: true });
  console.log(`Connected to ${uri}`);

  // Wipe only the collections this seed owns.
  await Promise.all([
    StudentSchedule.deleteMany({}),
    ScheduleTemplate.deleteMany({}),
    CourseOffering.deleteMany({}),
    Course.deleteMany({}),
    Student.deleteMany({}),
    AcademicTerm.deleteMany({}),
    User.deleteMany({})
  ]);
  console.log('Cleared Users, Students, AcademicTerms, Courses, CourseOfferings, ScheduleTemplates, StudentSchedules');

  /* ----------------------------------------------------------------- courses */
  const allCourseData = [...CURRICULUM, ...ELECTIVES];
  const courseDocs = await Course.insertMany(
    allCourseData.map((c) => ({
      code: c.code,
      name: c.name,
      creditHours: c.total,
      courseType: c.type,
      faculty: 'MET',
      major: c.major,
      recommendedSemester: c.semester,
      offeringSeason: 'Any',
      prerequisites: []
    }))
  );
  const courseByCode = new Map(courseDocs.map((c) => [c.code, c]));

  // Second pass: wire prerequisites now that every code has an _id.
  for (const data of allCourseData) {
    if (!data.prereqs.length) continue;
    const ids = data.prereqs
      .map((code) => courseByCode.get(code))
      .filter(Boolean)
      .map((c) => c._id);
    if (ids.length) await Course.updateOne({ code: data.code }, { $set: { prerequisites: ids } });
  }

  /* ------------------------------------------------------------------- terms */
  const [pastTerm, currentTerm] = await AcademicTerm.insertMany([
    {
      academicYear: '2025/2026',
      season: 'Spring',
      termStart: new Date('2026-02-07'),
      termEnd: new Date('2026-06-12'),
      teachingStart: new Date('2026-02-14'),
      teachingEnd: new Date('2026-05-21'),
      advisingDeadline: new Date('2026-02-05'),
      swapDeadline: new Date('2026-02-28'),
      isCurrent: false
    },
    {
      academicYear: '2026/2027',
      season: 'Winter',
      termStart: new Date('2026-10-03'),
      termEnd: new Date('2027-01-30'),
      teachingStart: new Date('2026-10-10'),
      teachingEnd: new Date('2027-01-14'),
      advisingDeadline: new Date('2026-09-26'),
      swapDeadline: new Date('2026-10-24'),
      isCurrent: true
    }
  ]);

  /* ------------------------------------------------------------------- users */
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const advisorData = [
    'Dr. Amr Desouky',
    'Dr. Nourhan Ehab',
    'Dr. Mervat Abu-Elkheir',
    'Dr. Hassan Soubra',
    'Dr. Milad Ghantous'
  ].map((fullName, i) => ({
    fullName,
    email: `advisor${i + 1}@guc.edu.eg`,
    password: passwordHash,
    role: 'advisor',
    isActive: true
  }));

  const coordinatorData = {
    fullName: 'Dr. Yasmine Elhefnawy',
    email: 'coordinator@guc.edu.eg',
    password: passwordHash,
    role: 'coordinator',
    isActive: true
  };

  const administratorData = {
    fullName: 'Eng. Omar Shalash',
    email: 'administrator@guc.edu.eg',
    password: passwordHash,
    role: 'administrator',
    isActive: true
  };

  const advisors = await User.insertMany(advisorData);
  const [coordinator] = await User.insertMany([coordinatorData]);
  const [administrator] = await User.insertMany([administratorData]);

  // 10 advising students (Evaluation DB sheet).
  const advisingSeed = [
    { fullName: 'Mariam Hossam', major: 'CS', semester: 9, gpa: 1.3, standing: 'Good Academic Standing' },
    { fullName: 'Youssef Nabil', major: 'CS', semester: 9, gpa: 2.4, standing: 'Probation' },
    { fullName: 'Hana Tarek', major: 'DMET', semester: 9, gpa: 1.0, standing: 'Good Academic Standing' },
    { fullName: 'Karim Adel', major: 'CS', semester: 10, gpa: 1.7, standing: 'Good Academic Standing' },
    { fullName: 'Salma Ashraf', major: 'DMET', semester: 10, gpa: 2.8, standing: 'Probation' },
    { fullName: 'Omar Zaki', major: 'CS', semester: 10, gpa: 1.5, standing: 'Good Academic Standing' },
    { fullName: 'Nour Khaled', major: 'DMET', semester: 9, gpa: 2.1, standing: 'Good Academic Standing' },
    // semester 6 -> 5 (requirement 31): seeded templates only exist for semesters 5 and 7
    { fullName: 'Laila Mostafa', major: 'CS', semester: 5, gpa: 3.1, standing: 'Probation' },
    // semester 6 -> 5 (requirement 31), same reason
    { fullName: 'Ahmed Fathy', major: 'DMET', semester: 5, gpa: 1.9, standing: 'Good Academic Standing' },
    { fullName: 'Farida Sameh', major: 'CS', semester: 7, gpa: 2.6, standing: 'Probation' }
  ];

  // At least 12 normal students, several sharing the same major + semester so
  // the whole-schedule swap of requirement 34 will have candidates later.
  const normalSeed = [
    { fullName: 'Aliaa Faramawy', major: 'CS', semester: 7, gpa: 1.2, standing: 'Good Academic Standing' },
    { fullName: 'Mostafa Gamal', major: 'CS', semester: 7, gpa: 1.6, standing: 'Good Academic Standing' },
    { fullName: 'Rana Ibrahim', major: 'CS', semester: 7, gpa: 2.0, standing: 'Good Academic Standing' },
    { fullName: 'Seif Eldin Magdy', major: 'CS', semester: 7, gpa: 2.9, standing: 'Probation' },
    { fullName: 'Malak Sherif', major: 'CS', semester: 5, gpa: 1.4, standing: 'Good Academic Standing' },
    { fullName: 'Ziad Hatem', major: 'CS', semester: 5, gpa: 1.8, standing: 'Good Academic Standing' },
    { fullName: 'Jana Wael', major: 'CS', semester: 5, gpa: 2.2, standing: 'Good Academic Standing' },
    { fullName: 'Marwan Essam', major: 'CS', semester: 5, gpa: 3.0, standing: 'Probation' },
    { fullName: 'Habiba Yasser', major: 'DMET', semester: 7, gpa: 1.1, standing: 'Good Academic Standing' },
    { fullName: 'Tamer Sobhy', major: 'DMET', semester: 7, gpa: 1.9, standing: 'Good Academic Standing' },
    { fullName: 'Dina Raafat', major: 'DMET', semester: 7, gpa: 2.5, standing: 'Probation' },
    { fullName: 'Kareem Louis', major: 'DMET', semester: 5, gpa: 1.3, standing: 'Good Academic Standing' },
    { fullName: 'Nadine Amr', major: 'DMET', semester: 5, gpa: 1.7, standing: 'Good Academic Standing' },
    { fullName: 'Bassem Shady', major: 'DMET', semester: 5, gpa: 2.3, standing: 'Good Academic Standing' },
    { fullName: 'Shahd Mahmoud', major: 'DMET', semester: 5, gpa: 2.7, standing: 'Probation' },
    { fullName: 'Hazem Ragab', major: 'CS', semester: 5, gpa: 1.5, standing: 'Good Academic Standing' }
  ];

  function emailFor(fullName, index, prefix) {
    const slug = fullName.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
    return `${slug}.${prefix}${index + 1}@student.guc.edu.eg`;
  }

  const advisingUsers = await User.insertMany(
    advisingSeed.map((s, i) => ({
      fullName: s.fullName,
      email: emailFor(s.fullName, i, 'a'),
      password: passwordHash,
      role: 'student',
      isActive: true
    }))
  );

  const normalUsers = await User.insertMany(
    normalSeed.map((s, i) => ({
      fullName: s.fullName,
      email: emailFor(s.fullName, i, 'n'),
      password: passwordHash,
      role: 'student',
      isActive: true
    }))
  );

  const advisingStudents = await Student.insertMany(
    advisingSeed.map((s, i) => ({
      user: advisingUsers[i]._id,
      studentId: `49-${pad(i + 1)}`,
      studentType: 'advising',
      faculty: 'MET',
      major: s.major,
      currentSemester: s.semester,
      gpa: s.gpa,
      academicStanding: s.standing,
      advisor: advisors[i % advisors.length]._id
    }))
  );

  const normalStudents = await Student.insertMany(
    normalSeed.map((s, i) => ({
      user: normalUsers[i]._id,
      studentId: `52-${pad(i + 1)}`,
      studentType: 'normal',
      faculty: 'MET',
      major: s.major,
      currentSemester: s.semester,
      gpa: s.gpa,
      academicStanding: s.standing,
      advisor: null
    }))
  );

  /* ------------------------------------------------- offerings + their slots */
  const cohorts = Object.keys(COHORT_COURSES).map((key) => {
    const [major, semester] = key.split('-');
    return { key, major, semester: Number(semester), codes: COHORT_COURSES[key] };
  });

  // courseCode -> { slots: [...], majors: Set, semesters: Set }
  const perCourse = new Map();
  // `${cohortKey}|${group}` -> [{ courseCode, lecture, tutorial, lab }] where the
  // component values are the groupNumber strings used to find the slot ids back.
  const cohortPlans = new Map();
  let roomCounter = 0;

  const allGroups = [...PUBLISHED_GROUPS, UNPUBLISHED_GROUP];

  for (const cohort of cohorts) {
    allGroups.forEach((group, groupIndex) => {
      const take = makeAllocator(groupIndex * 7 + cohort.semester);
      const groupNumber = `${cohort.major}${cohort.semester}-${group}`;
      const plan = [];

      for (const code of cohort.codes) {
        const data = allCourseData.find((c) => c.code === code);
        if (!data) throw new Error(`Cohort ${cohort.key} references unknown course ${code}`);

        if (!perCourse.has(code)) {
          perCourse.set(code, { slots: [], majors: new Set(), semesters: new Set() });
        }
        const bucket = perCourse.get(code);
        bucket.majors.add(cohort.major);
        bucket.semesters.add(cohort.semester);

        const planEntry = { courseCode: code, lecture: null, tutorial: null, lab: null };

        for (const component of COMPONENTS) {
          const hours = hoursOf(data, component);
          if (!hours) continue; // the course has no such component - legal
          const when = take(periodSpan(hours));
          roomCounter += 1;
          bucket.slots.push({
            type: component,
            groupNumber,
            day: when.day,
            startTime: when.startTime,
            endTime: when.endTime,
            room: roomFor(component, roomCounter),
            maxCapacity: SLOT_CAPACITY,
            assignedCount: 0
          });
          planEntry[component] = groupNumber;
        }

        plan.push(planEntry);
      }

      cohortPlans.set(`${cohort.key}|${group}`, plan);
    });
  }

  const offeringDocs = [];
  for (const [code, bucket] of perCourse) {
    const course = courseByCode.get(code);
    offeringDocs.push({
      course: course._id,
      term: currentTerm._id,
      instructors: [INSTRUCTORS[offeringDocs.length % INSTRUCTORS.length]],
      eligibleMajors: [...bucket.majors],
      eligibleSemesters: [...bucket.semesters].sort((a, b) => a - b),
      isPublished: true, // requirement 27: only published offerings can be scheduled
      slots: bucket.slots
    });
  }
  const offerings = await CourseOffering.insertMany(offeringDocs);
  const offeringByCode = new Map();
  for (const offering of offerings) {
    const code = courseDocs.find((c) => String(c._id) === String(offering.course)).code;
    offeringByCode.set(code, offering);
  }

  /* --------------------------------------------- standard schedule templates */
  const templateDocs = [];
  for (const cohort of cohorts) {
    for (const group of allGroups) {
      const plan = cohortPlans.get(`${cohort.key}|${group}`);
      const entries = [];
      const resolvedForCheck = [];

      for (const planEntry of plan) {
        const offering = offeringByCode.get(planEntry.courseCode);
        const entry = { offering: offering._id, lectureSlotId: null, tutorialSlotId: null, labSlotId: null };

        for (const component of COMPONENTS) {
          if (!planEntry[component]) continue;
          const slot = offering.slots.find(
            (s) => s.type === component && s.groupNumber === planEntry[component]
          );
          if (!slot) {
            throw new Error(
              `Seed bug: no ${component} slot "${planEntry[component]}" on offering ${planEntry.courseCode}`
            );
          }
          entry[`${component}SlotId`] = slot._id;
          resolvedForCheck.push({
            courseCode: planEntry.courseCode,
            type: slot.type,
            groupNumber: slot.groupNumber,
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime
          });
        }

        entries.push(entry);
      }

      // Assert the generated timetable really is clash-free before inserting.
      const clash = findFirstClash(resolvedForCheck);
      if (clash) {
        throw new Error(
          `Seed bug: template ${cohort.key} group ${group} clashes - ${describeSlot(clash[0])} overlaps ${describeSlot(clash[1])}`
        );
      }

      templateDocs.push({
        term: currentTerm._id,
        major: cohort.major,
        semester: cohort.semester,
        studyGroup: group,
        // Group 4 is left UNPUBLISHED on purpose so that the requirement-30 rule
        // "the processed schedule is created from the assigned group's PUBLISHED
        // template" is demonstrable.
        isPublished: group !== UNPUBLISHED_GROUP,
        entries
      });
    }
  }
  const templates = await ScheduleTemplate.insertMany(templateDocs);

  /* ------------------------------------- requirement 31: demo student schedules */
  // So every visibility rule of requirement 31 can be demoed without the
  // advising workflow (reqs 62+): three ADVISING students get a schedule in each
  // status, and ONE normal student is assigned (the other 15 stay unassigned for
  // the requirement-30 demo). Snapshots are built from the published templates
  // and every slot's assignedCount is incremented so capacity stays true.
  const offeringById = new Map(offerings.map((o) => [String(o._id), o]));
  const courseById = new Map(courseDocs.map((c) => [String(c._id), c]));

  function snapshotFromTemplate(template) {
    return template.entries.map((entry) => {
      const offering = offeringById.get(String(entry.offering));
      const course = courseById.get(String(offering.course));
      const slots = COMPONENTS.map((component) => entry[`${component}SlotId`])
        .filter(Boolean)
        .map((slotId) => {
          const s = offering.slots.find((x) => String(x._id) === String(slotId));
          return { slotId: s._id, type: s.type, groupNumber: s.groupNumber, day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room };
        });
      return { course: course._id, courseCode: course.code, courseName: course.name, creditHours: course.creditHours, offering: offering._id, slots };
    });
  }

  const demoSchedules = [
    { student: advisingStudents[9], group: '1', status: 'processed', by: advisors[9 % advisors.length] }, // Farida, CS 7
    { student: advisingStudents[7], group: '2', status: 'ready_for_student_review', by: advisors[7 % advisors.length] }, // Laila, CS 5
    { student: advisingStudents[8], group: '1', status: 'draft', by: advisors[8 % advisors.length] }, // Ahmed, DMET 5
    { student: normalStudents[0], group: '1', status: 'processed', by: coordinator } // Aliaa, CS 7
  ];
  const scheduleDocs = [];
  for (const demo of demoSchedules) {
    const template = templates.find(
      (t) => t.isPublished && t.major === demo.student.major && t.semester === demo.student.currentSemester && t.studyGroup === demo.group
    );
    if (!template) throw new Error(`Seed bug: no published template for ${demo.student.studentId}`);
    const entries = snapshotFromTemplate(template);
    for (const entry of entries) {
      for (const slot of entry.slots) {
        await CourseOffering.updateOne(
          { _id: entry.offering, 'slots._id': slot.slotId },
          { $inc: { 'slots.$.assignedCount': 1 } }
        );
      }
    }
    const now = new Date();
    scheduleDocs.push({
      student: demo.student._id,
      term: currentTerm._id,
      studyGroup: template.studyGroup,
      template: template._id,
      status: demo.status,
      entries,
      assignedBy: demo.by._id,
      assignedAt: now,
      history: [{ action: 'assigned', fromGroup: null, toGroup: template.studyGroup, by: demo.by._id, at: now }]
    });
  }
  const studentSchedules = await StudentSchedule.insertMany(scheduleDocs);
  const userById = new Map([...advisingUsers, ...normalUsers].map((u) => [String(u._id), u]));

  /* ----------------------------------------------------------------- summary */
  const publishedTemplates = templates.filter((t) => t.isPublished);
  const slotCount = offerings.reduce((n, o) => n + o.slots.length, 0);

  console.log('\n================ Bobos seed complete ================');
  console.log(`Courses                : ${courseDocs.length} (${CURRICULUM.length} curriculum + ${ELECTIVES.length} electives)`);
  console.log(`Academic terms         : 2`);
  console.log(`  current term         : ${currentTerm.season} ${currentTerm.academicYear} (${currentTerm._id})`);
  console.log(`  past term            : ${pastTerm.season} ${pastTerm.academicYear}`);
  console.log(`Advisors               : ${advisors.length}`);
  console.log(`Coordinators           : 1  -> ${coordinator.email}`);
  console.log(`Administrators         : 1  -> ${administrator.email}`);
  console.log(`Advising students      : ${advisingStudents.length}`);
  console.log(`Normal students        : ${normalStudents.length} (${normalStudents.length - 1} deliberately UNASSIGNED, 1 assigned for requirement 31)`);
  console.log(`Course offerings       : ${offerings.length} (all published), ${slotCount} slots, capacity ${SLOT_CAPACITY} each`);
  console.log(`Schedule templates     : ${templates.length} => ${publishedTemplates.length} published, ${templates.length - publishedTemplates.length} unpublished`);
  console.log(`  cohorts              : ${cohorts.map((c) => `${c.major} sem ${c.semester}`).join(', ')}`);
  console.log(`  published groups     : ${PUBLISHED_GROUPS.join(', ')}   unpublished group: ${UNPUBLISHED_GROUP}`);
  console.log(`Student schedules      : ${studentSchedules.length} (requirement 31 demo)`);
  demoSchedules.forEach((demo) => {
    const u = userById.get(String(demo.student.user));
    console.log(`  ${demo.student.studentId} ${demo.student.studentType.padEnd(8)} ${demo.status.padEnd(24)} ${u.email}`);
  });
  console.log(`\nShared dev password for EVERY seeded account: ${DEV_PASSWORD}`);
  console.log(`Coordinator login      : ${coordinator.email} / ${DEV_PASSWORD}`);
  console.log('Requirement 1 (login) is not implemented yet - use POST /api/dev/token { email } to mint a token.');
  console.log('=====================================================\n');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
