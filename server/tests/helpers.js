// Shared test setup. Runs against a REAL MongoDB (standalone is fine) at
// process.env.MONGO_URI_TEST, default mongodb://127.0.0.1:27017/bobos_test.
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import { User } from '../src/models/User.js';
import { Student } from '../src/models/Student.js';
import { AcademicTerm } from '../src/models/AcademicTerm.js';
import { Course } from '../src/models/Course.js';
import { CourseOffering } from '../src/models/CourseOffering.js';
import { ScheduleTemplate } from '../src/models/ScheduleTemplate.js';
import { StudentSchedule } from '../src/models/StudentSchedule.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

export const TEST_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/bobos_test';

export async function connectTestDb() {
  await mongoose.connect(TEST_URI, { autoIndex: true });
}

export async function dropTestDb() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}

export async function clearCollections() {
  const models = [StudentSchedule, ScheduleTemplate, CourseOffering, Course, Student, AcademicTerm, User];
  for (const model of models) await model.deleteMany({});
}

export function tokenFor(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function slot(type, groupNumber, day, startTime, endTime, room, maxCapacity = 30, assignedCount = 0) {
  return { type, groupNumber, day, startTime, endTime, room, maxCapacity, assignedCount };
}

/*
 * A deliberately small, fully controlled fixture:
 *
 *   CS / semester 5, term = current Winter 2026/2027
 *   two published offerings: CSEN 501 (lecture+tutorial+lab), MATH 501 (lecture+tutorial)
 *   template '1' published  -> group-1 slots
 *   template '2' published  -> group-2 slots
 *   template '3' published  -> group-3 slots, whose CSEN 501 LECTURE is already FULL
 *   template '4' UNPUBLISHED -> group-1 slots
 */
export async function buildFixture() {
  const passwordHash = await bcrypt.hash('Bobos#2026', 4);

  const [coordinator, administrator, advisor, normalUser, advisingUser] = await User.create([
    { fullName: 'Coordinator One', email: 'coordinator@guc.edu.eg', password: passwordHash, role: 'coordinator' },
    { fullName: 'Admin One', email: 'administrator@guc.edu.eg', password: passwordHash, role: 'administrator' },
    { fullName: 'Advisor One', email: 'advisor1@guc.edu.eg', password: passwordHash, role: 'advisor' },
    { fullName: 'Normal Student', email: 'normal.student@student.guc.edu.eg', password: passwordHash, role: 'student' },
    { fullName: 'Advising Student', email: 'advising.student@student.guc.edu.eg', password: passwordHash, role: 'student' }
  ]);

  const term = await AcademicTerm.create({
    academicYear: '2026/2027',
    season: 'Winter',
    termStart: new Date('2026-10-03'),
    termEnd: new Date('2027-01-30'),
    isCurrent: true
  });

  const [csen501, math501] = await Course.create([
    { code: 'CSEN 501', name: 'Data Base I', creditHours: 6, courseType: 'core', major: 'ALL', recommendedSemester: 5 },
    { code: 'MATH 501', name: 'Mathematics V (Discrete Math)', creditHours: 4, courseType: 'core', major: 'ALL', recommendedSemester: 5 }
  ]);

  const dbOffering = await CourseOffering.create({
    course: csen501._id,
    term: term._id,
    instructors: ['Dr. Test'],
    eligibleMajors: ['CS'],
    eligibleSemesters: [5],
    isPublished: true,
    slots: [
      slot('lecture', '1', 'Saturday', '08:15', '10:00', 'H1'),
      slot('tutorial', '1', 'Sunday', '08:15', '10:00', 'C7.1'),
      slot('lab', '1', 'Monday', '08:15', '10:00', 'Lab 1'),
      slot('lecture', '2', 'Saturday', '10:15', '12:00', 'H2'),
      slot('tutorial', '2', 'Sunday', '10:15', '12:00', 'C7.2'),
      slot('lab', '2', 'Monday', '10:15', '12:00', 'Lab 2'),
      // group 3's lecture is already at capacity
      slot('lecture', '3', 'Saturday', '12:15', '14:00', 'H3', 1, 1),
      slot('tutorial', '3', 'Sunday', '12:15', '14:00', 'C7.3'),
      slot('lab', '3', 'Monday', '12:15', '14:00', 'Lab 3')
    ]
  });

  const mathOffering = await CourseOffering.create({
    course: math501._id,
    term: term._id,
    instructors: ['Dr. Test'],
    eligibleMajors: ['CS'],
    eligibleSemesters: [5],
    isPublished: true,
    slots: [
      slot('lecture', '1', 'Tuesday', '08:15', '10:00', 'H4'),
      slot('tutorial', '1', 'Wednesday', '08:15', '10:00', 'C7.4'),
      slot('lecture', '2', 'Tuesday', '10:15', '12:00', 'H5'),
      slot('tutorial', '2', 'Wednesday', '10:15', '12:00', 'C7.5'),
      slot('lecture', '3', 'Tuesday', '12:15', '14:00', 'H6'),
      slot('tutorial', '3', 'Wednesday', '12:15', '14:00', 'C7.6')
    ]
  });

  const slotOf = (offering, type, groupNumber) =>
    offering.slots.find((s) => s.type === type && s.groupNumber === groupNumber)._id;

  const templateEntriesFor = (group) => [
    {
      offering: dbOffering._id,
      lectureSlotId: slotOf(dbOffering, 'lecture', group),
      tutorialSlotId: slotOf(dbOffering, 'tutorial', group),
      labSlotId: slotOf(dbOffering, 'lab', group)
    },
    {
      offering: mathOffering._id,
      lectureSlotId: slotOf(mathOffering, 'lecture', group),
      tutorialSlotId: slotOf(mathOffering, 'tutorial', group),
      labSlotId: null // MATH 501 has no lab - a null component is legal
    }
  ];

  const templates = await ScheduleTemplate.create([
    { term: term._id, major: 'CS', semester: 5, studyGroup: '1', isPublished: true, entries: templateEntriesFor('1') },
    { term: term._id, major: 'CS', semester: 5, studyGroup: '2', isPublished: true, entries: templateEntriesFor('2') },
    { term: term._id, major: 'CS', semester: 5, studyGroup: '3', isPublished: true, entries: templateEntriesFor('3') },
    { term: term._id, major: 'CS', semester: 5, studyGroup: '4', isPublished: false, entries: templateEntriesFor('1') }
  ]);

  const [normalStudent, advisingStudent] = await Student.create([
    {
      user: normalUser._id,
      studentId: '52-0001',
      studentType: 'normal',
      major: 'CS',
      currentSemester: 5,
      gpa: 1.4
    },
    {
      user: advisingUser._id,
      studentId: '49-0001',
      studentType: 'advising',
      major: 'CS',
      currentSemester: 5,
      gpa: 2.2,
      academicStanding: 'Probation'
    }
  ]);

  return {
    users: { coordinator, administrator, advisor, normalUser, advisingUser },
    tokens: {
      coordinator: tokenFor(coordinator),
      administrator: tokenFor(administrator),
      advisor: tokenFor(advisor),
      student: tokenFor(normalUser)
    },
    term,
    courses: { csen501, math501 },
    offerings: { dbOffering, mathOffering },
    templates: {
      g1: templates[0],
      g2: templates[1],
      g3Full: templates[2],
      g4Unpublished: templates[3]
    },
    students: { normalStudent, advisingStudent }
  };
}

// Reads one slot back from the database - used to assert assignedCount changes.
export async function readSlot(offeringId, type, groupNumber) {
  const offering = await CourseOffering.findById(offeringId);
  return offering.slots.find((s) => s.type === type && s.groupNumber === groupNumber);
}
