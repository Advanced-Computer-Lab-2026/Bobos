import mongoose from 'mongoose';
import {
  User,
  StudentProfile,
  AdvisorAssignment,
  StudentWorkflowState,
  AcademicTerm,
  Course,
  MandatoryCourseRemovalRequest
} from './src/models/index.js';

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bobos?replicaSet=rs0";

const ADVISING_REASONS = ["probation", "failedCourses", "unattendedCourses", "undeclaredMajor", "transfer"];
const MAJORS = ["CS", "DMET"];
const STATUSES = ["notStarted", "draft", "readyForStudentReview", "processed", "changeRequestPending"];
const STUDY_GROUPS = ["1st", "2nd", "3rd", "4th"];

async function seed() {
  try {
    console.log(`Connecting to ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // 1. Clear existing relevant collections
    console.log('Clearing old data...');
    await User.deleteMany({});
    await StudentProfile.deleteMany({});
    await AdvisorAssignment.deleteMany({});
    await StudentWorkflowState.deleteMany({});
    await AcademicTerm.deleteMany({});
    await Course.deleteMany({});
    await MandatoryCourseRemovalRequest.deleteMany({});

    // 2. Create foundational reference data (Term and Course for requests/workflow states)
    console.log('Creating Term and Course...');
    const now = new Date();
    const future = new Date(now);
    future.setMonth(future.getMonth() + 4);

    const term = await AcademicTerm.create({
      code: 'FALL26',
      academicYear: '2026/2027',
      season: 'winter',
      termStart: now,
      termEnd: future,
      teachingStart: now,
      teachingEnd: future,
      registrationStart: now,
      registrationEnd: future,
      advisingDeadline: future,
      wholeScheduleSwapDeadline: future,
      isActive: true,
    });

    const course = await Course.create({
      code: 'CSEN101',
      name: 'Introduction to Computer Science',
      creditHours: 4,
      courseType: 'core',
    });

    // 3. Create Coordinator
    console.log('Creating Coordinator...');
    const coordinator = await User.create({
      fullName: 'Head Coordinator',
      email: 'coordinator@guc.edu.eg',
      passwordHash: 'dummy_hash',
      role: 'coordinator',
      isActive: true,
    });

    const administrator = await User.create({
      fullName: 'System Administrator',
      email: 'administrator@guc.edu.eg',
      passwordHash: 'dummy_hash',
      role: 'administrator',
      isActive: true,
    });

    // 4. Create 5 Advisors
    console.log('Creating Advisors...');
    const advisors = [];
    for (let i = 1; i <= 5; i++) {
      const adv = await User.create({
        fullName: `Advisor ${i} Name`,
        email: `advisor${i}@guc.edu.eg`,
        passwordHash: 'dummy_hash',
        role: 'advisor',
        isActive: true,
        isAdvisorInSystem: true,
      });
      advisors.push(adv);
    }

    // 5. Create 10 Advising Students
    console.log('Creating Advising Students...');
    const studentsCreated = [];

    for (let i = 1; i <= 10; i++) {
      // Create User
      const studentUser = await User.create({
        fullName: `Advising Student ${i}`,
        email: `student${i}@student.guc.edu.eg`,
        passwordHash: 'dummy_hash',
        role: 'advisingStudent',
        isActive: true,
      });

      // Leave three students unassigned so B3 assignment can be tested.
      const isAssigned = i <= 7;
      const assignedAdvisor = isAssigned ? advisors[i % advisors.length] : null;

      // Create StudentProfile
      const profile = await StudentProfile.create({
        user: studentUser._id,
        studentId: `64-${String(i).padStart(5, '0')}`,
        studentType: 'advising',
        major: MAJORS[i % MAJORS.length],
        currentSemester: (i % 10) + 1,
        studyGroup: STUDY_GROUPS[i % STUDY_GROUPS.length],
        gpa: Number((Math.random() * 4).toFixed(2)),
        academicStanding: i % 4 === 0 ? 'probation' : 'goodAcademicStanding',
        enrollmentStatus: i % 5 === 0 ? 'inactive' : 'active',
        advisingReason: ADVISING_REASONS[i % ADVISING_REASONS.length],
        assignedAdvisor: assignedAdvisor ? assignedAdvisor._id : null,
      });

      // Create AdvisorAssignment history if assigned
      if (assignedAdvisor) {
        await AdvisorAssignment.create({
          student: profile._id,
          advisor: assignedAdvisor._id,
          assignedBy: coordinator._id,
        });
      }

      // Create StudentWorkflowState
      await StudentWorkflowState.create({
        student: profile._id,
        term: term._id,
        studentType: 'advising',
        status: STATUSES[i % STATUSES.length],
        blockingStep: i % 3 === 0 ? 'Missing graduation plan' : null,
        lastActivityAt: new Date(now.getTime() - i * 10000000), // staggering times
      });

      // Create a pending request for a few students to test the "pendingRequestType" filter
      // E.g., student 1 and 4 have a pending MandatoryCourseRemovalRequest
      if (isAssigned && (i === 1 || i === 4)) {
        await MandatoryCourseRemovalRequest.create({
          student: profile._id,
          course: course._id,
          advisor: assignedAdvisor._id,
          term: term._id,
          reason: 'other',
          explanation: 'Testing pending request filter',
          status: 'pending',
        });
      }

      studentsCreated.push({
        id: profile._id,
        studentId: profile.studentId,
        name: studentUser.fullName,
        email: studentUser.email,
        advisor: assignedAdvisor ? assignedAdvisor.fullName : 'Unassigned',
      });
    }

    console.log('Creating normal-student directory examples...');
    for (let i = 1; i <= 2; i++) {
      const user = await User.create({
        fullName: `Normal Student ${i}`,
        email: `normal${i}@student.guc.edu.eg`,
        passwordHash: 'dummy_hash',
        role: 'normalStudent',
        isActive: i === 1,
      });
      const profile = await StudentProfile.create({
        user: user._id,
        studentId: `64-${String(10000 + i).padStart(5, '0')}`,
        studentType: 'normal',
        major: MAJORS[i % MAJORS.length],
        currentSemester: i + 1,
        studyGroup: STUDY_GROUPS[i],
        gpa: 3.2,
        academicStanding: 'goodAcademicStanding',
        enrollmentStatus: 'active',
      });
      await StudentWorkflowState.create({
        student: profile._id,
        term: term._id,
        studentType: 'normal',
        status: 'scheduleAssigned',
        lastActivityAt: now,
      });
    }

    console.log('\n--- Seeding Complete ---\n');
    
    console.log('Coordinator:');
    console.log(`- ID: ${coordinator._id} | Email: ${coordinator.email}\n`);

    console.log('Administrator:');
    console.log(`- ID: ${administrator._id} | Email: ${administrator.email}\n`);

    console.log('Advisors:');
    advisors.forEach(a => {
      console.log(`- ID: ${a._id} | Email: ${a.email}`);
    });
    console.log('');

    console.log('Advising Students (10 total, 7 assigned, 3 unassigned):');
    studentsCreated.forEach(s => {
      console.log(`- Profile ID: ${s.id} | ${s.studentId} | ${s.email} | Advisor: ${s.advisor}`);
    });
    
    console.log('\nNote: Students 1 and 4 have a pending mandatoryCourseRemoval request attached to them for testing the filter.');

    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
}

seed();
