import mongoose from 'mongoose';
import {
  AcademicTerm,
  Course,
  CourseOffering,
  CourseAttempt,
  StudentProfile,
  StudentSchedule,
  StudentWorkflowState,
  MandatoryCourseRemovalRequest,
  SlotChangeRequest,
  ScheduleActivity,
  AdvisorAssignment,
  User,
} from '../models/index.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bobos';

function slotsOverlap(slotA, slotB) {
  if (slotA.day !== slotB.day) return false;
  return Math.max(slotA.startMinute, slotB.startMinute) < Math.min(slotA.endMinute, slotB.endMinute);
}

function buildScheduledCourse(offering, { isMandatory = false, isExtraHours = false, customSlots = null } = {}) {
  let selectedSlots = [];
  if (customSlots && customSlots.length > 0) {
    selectedSlots = customSlots.map((slot) => ({
      componentType: slot.componentType,
      courseOffering: offering._id,
      slotGroupId: slot._id,
    }));
  } else {
    const components = [...new Set((offering.slots || []).map((s) => s.componentType))];
    for (const comp of components) {
      const slot = (offering.slots || []).find((s) => s.componentType === comp);
      if (slot) {
        selectedSlots.push({
          componentType: comp,
          courseOffering: offering._id,
          slotGroupId: slot._id,
        });
      }
    }
  }

  return {
    course: offering.course._id || offering.course,
    courseOffering: offering._id,
    slots: selectedSlots,
    isMandatory,
    isExtraHours,
    creditHoursSnapshot: Number(offering.course?.creditHours) || 3,
  };
}

function findValidNonClashingOfferings(publishedOfferings, targetCount = 2) {
  const candidates = [];
  for (const off of publishedOfferings) {
    if (!off.course || !off.slots?.length) continue;
    const components = [...new Set(off.slots.map((s) => s.componentType))];
    const slotsByComp = components.map((c) =>
      off.slots.filter((s) => s.componentType === c && s.capacity > (s.assignedStudentCount || 0))
    );
    if (slotsByComp.some((arr) => arr.length === 0)) continue;

    function pickNonClashing(compIndex, currentPicked) {
      if (compIndex === components.length) return currentPicked;
      for (const slot of slotsByComp[compIndex]) {
        const clash = currentPicked.some((s) => slotsOverlap(s, slot));
        if (!clash) {
          const res = pickNonClashing(compIndex + 1, [...currentPicked, slot]);
          if (res) return res;
        }
      }
      return null;
    }

    const validSlots = pickNonClashing(0, []);
    if (validSlots) {
      candidates.push({ offering: off, selectedSlots: validSlots });
    }
  }

  const result = [];
  for (const cand of candidates) {
    const clashes = cand.selectedSlots.some((s1) =>
      result.some((r) => r.selectedSlots.some((s2) => slotsOverlap(s1, s2)))
    );
    if (!clashes) {
      result.push(cand);
      if (result.length >= targetCount) break;
    }
  }

  return result;
}

export async function seedB3Demo() {
  console.log(`Connecting to MongoDB at: ${uri}`);
  await mongoose.connect(uri);

  try {
    // 1. Find Base Records
    const term =
      (await AcademicTerm.findOne({ isActive: true })) ||
      (await AcademicTerm.findOne().sort({ termStart: -1 }));
    if (!term) {
      throw new Error('No academic term found. Please run the evaluation seed first.');
    }

    const pastTerm =
      (await AcademicTerm.findOne({ _id: { $ne: term._id } })) || term;

    let advisors = await User.find({ role: 'advisor', isActive: true });
    if (!advisors.length) advisors = await User.find({ role: 'advisor' });
    if (!advisors.length) {
      throw new Error('No advisors found. Please run the evaluation seed first.');
    }

    const coordinator =
      (await User.findOne({ role: 'coordinator', isActive: true })) ||
      (await User.findOne({ role: 'coordinator' })) ||
      advisors[0];

    const students = await StudentProfile.find({ studentType: 'advising' })
      .populate('user')
      .sort({ studentId: 1 });

    if (students.length < 5) {
      throw new Error(
        `Found only ${students.length} advising students. At least 5 advising students are required for the 5 B3 scenarios. Please run npm run seed:evaluation first.`
      );
    }

    // Ensure all 5 students have an assigned advisor and advisor assignment record
    for (let i = 0; i < 5; i++) {
      if (!students[i].assignedAdvisor) {
        students[i].assignedAdvisor = advisors[i % advisors.length]._id;
        await students[i].save();
      }
      await AdvisorAssignment.findOneAndUpdate(
        { student: students[i]._id, endedAt: null },
        {
          $set: {
            student: students[i]._id,
            advisor: students[i].assignedAdvisor,
            assignedBy: coordinator._id,
            endedAt: null,
          },
        },
        { upsert: true }
      );
    }

    const activeCourses = await Course.find({ isActive: true }).limit(5);
    if (activeCourses.length < 3) {
      throw new Error('At least 3 active courses are required in the database.');
    }

    const publishedOfferings = await CourseOffering.find({
      term: term._id,
      isPublished: true,
      'slots.0': { $exists: true },
    }).populate('course');

    if (!publishedOfferings.length) {
      throw new Error('No published course offerings with slots found for the active term.');
    }

    // Map offerings by course ID
    const offeringByCourseId = new Map();
    for (const off of publishedOfferings) {
      if (off.course) {
        offeringByCourseId.set(String(off.course._id || off.course), off);
      }
    }

    // Offerings available with slots
    const availableCourseList = publishedOfferings.map((o) => o.course).filter(Boolean);
    const course0 = availableCourseList[0] || activeCourses[0];
    const course1 = availableCourseList[1] || activeCourses[1];
    const course2 = availableCourseList[2] || activeCourses[2];

    const offering0 = offeringByCourseId.get(String(course0._id)) || publishedOfferings[0];
    const offering2 =
      offeringByCourseId.get(String(course2._id)) ||
      publishedOfferings[Math.min(2, publishedOfferings.length - 1)];

    // -------------------------------------------------------------------------
    // Scenario 1 (Req 64 & 69 - Removal Request & Draft Cascade):
    // Student 0:
    // - 2 failed attempts: Course[0] (attended, failed) and Course[1] (unattended, failed)
    // - Open 'draft' StudentSchedule containing Course[0] and Course[2]
    // - 1 MandatoryCourseRemovalRequest in 'pending' status for Course[0]
    // -------------------------------------------------------------------------
    const student0 = students[0];
    await StudentSchedule.deleteMany({ term: term._id, student: student0._id });
    await CourseAttempt.deleteMany({
      student: student0._id,
      course: { $in: [course0._id, course1._id] },
    });
    await CourseAttempt.create([
      {
        student: student0._id,
        course: course0._id,
        term: pastTerm._id,
        attemptNumber: 1,
        attendance: 'attended',
        result: 'failed',
        grade: 'F',
      },
      {
        student: student0._id,
        course: course1._id,
        term: pastTerm._id,
        attemptNumber: 1,
        attendance: 'unattended',
        result: 'failed',
        grade: 'F',
      },
    ]);

    const scheduledCourse0 = buildScheduledCourse(offering0, { isMandatory: true });
    const scheduledCourse2 = buildScheduledCourse(offering2, { isMandatory: false });

    await StudentSchedule.findOneAndUpdate(
      { student: student0._id, term: term._id, scheduleType: 'advising' },
      {
        $set: {
          student: student0._id,
          term: term._id,
          scheduleType: 'advising',
          status: 'draft',
          courses: [scheduledCourse0, scheduledCourse2],
          seatsReserved: false,
          version: 1,
          createdBy: student0.assignedAdvisor || advisors[0]._id,
          processedBy: null,
          processedAt: null,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    await StudentWorkflowState.findOneAndUpdate(
      { student: student0._id, term: term._id },
      {
        $set: {
          student: student0._id,
          term: term._id,
          studentType: 'advising',
          status: 'draft',
          blockingStep: 'Resolve pending coordinator approval',
          lastActivityAt: new Date(),
          calculatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await MandatoryCourseRemovalRequest.deleteMany({
      student: student0._id,
      term: term._id,
    });
    await MandatoryCourseRemovalRequest.create({
      student: student0._id,
      course: course0._id,
      advisor: student0.assignedAdvisor || advisors[0]._id,
      term: term._id,
      reason: 'incorrectMandatoryDesignation',
      explanation:
        'Student completed equivalent coursework; request removal of mandatory course designation.',
      status: 'pending',
    });

    // -------------------------------------------------------------------------
    // Scenario 2 (Req 65–68 - Filterable Removal Requests):
    // Student 1:
    // - 1 MandatoryCourseRemovalRequest with status: 'approved' and coordinator responseNote
    // - 1 MandatoryCourseRemovalRequest with status: 'rejected' and coordinator responseNote
    // -------------------------------------------------------------------------
    const student1 = students[1];
    await MandatoryCourseRemovalRequest.deleteMany({
      student: student1._id,
      term: term._id,
    });
    await MandatoryCourseRemovalRequest.create([
      {
        student: student1._id,
        course: course1._id,
        advisor: student1.assignedAdvisor || advisors[0]._id,
        term: term._id,
        reason: 'makeupEligibility',
        explanation:
          'Student eligible for makeup examination; removal from mandatory term registration.',
        status: 'approved',
        decidedBy: coordinator._id,
        responseNote: 'Approved: Department confirmation of makeup eligibility received.',
        decidedAt: new Date(Date.now() - 86400000),
      },
      {
        student: student1._id,
        course: course2._id,
        advisor: student1.assignedAdvisor || advisors[0]._id,
        term: term._id,
        reason: 'completedHours',
        explanation: 'Student claims completed hours satisfy requirement.',
        status: 'rejected',
        decidedBy: coordinator._id,
        responseNote: 'Rejected: Incomplete prerequisite hours; course remains mandatory.',
        decidedAt: new Date(),
      },
    ]);

    await StudentWorkflowState.findOneAndUpdate(
      { student: student1._id, term: term._id },
      {
        $set: {
          student: student1._id,
          term: term._id,
          studentType: 'advising',
          status: 'draft',
          blockingStep: 'Complete draft schedule',
          lastActivityAt: new Date(),
          calculatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // -------------------------------------------------------------------------
    // Scenario 3 (Req 80 - Validation Pass & Student Review):
    // Student 2:
    // - Complete, valid 'draft' StudentSchedule with all required lecture/tutorial/lab slots assigned and no clashes.
    // -------------------------------------------------------------------------
    const student2 = students[2];
    await StudentSchedule.deleteMany({ term: term._id, student: student2._id });
    await CourseAttempt.deleteMany({
      student: student2._id,
      $or: [{ result: 'failed' }, { attendance: 'unattended' }],
    });
    await MandatoryCourseRemovalRequest.deleteMany({
      student: student2._id,
      term: term._id,
    });
    await SlotChangeRequest.deleteMany({
      student: student2._id,
      term: term._id,
    });

    const nonClashing = findValidNonClashingOfferings(publishedOfferings, 2);
    const validOfferingsToUse =
      nonClashing.length > 0
        ? nonClashing
        : [{ offering: publishedOfferings[0], selectedSlots: publishedOfferings[0].slots }];

    const scheduledCoursesForStudent2 = validOfferingsToUse.map(({ offering, selectedSlots }) =>
      buildScheduledCourse(offering, { customSlots: selectedSlots })
    );

    // Ensure any prerequisites for the selected courses are recorded as passed
    for (const item of scheduledCoursesForStudent2) {
      const courseDoc = await Course.findById(item.course);
      if (courseDoc?.prerequisites?.length) {
        for (const prereqId of courseDoc.prerequisites) {
          await CourseAttempt.findOneAndUpdate(
            { student: student2._id, course: prereqId },
            {
              $set: {
                student: student2._id,
                course: prereqId,
                term: pastTerm._id,
                attemptNumber: 1,
                attendance: 'attended',
                result: 'passed',
                grade: 'A',
              },
            },
            { upsert: true }
          );
        }
      }
    }

    await StudentSchedule.findOneAndUpdate(
      { student: student2._id, term: term._id, scheduleType: 'advising' },
      {
        $set: {
          student: student2._id,
          term: term._id,
          scheduleType: 'advising',
          status: 'draft',
          courses: scheduledCoursesForStudent2,
          seatsReserved: false,
          version: 1,
          createdBy: student2.assignedAdvisor || advisors[0]._id,
          processedBy: null,
          processedAt: null,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    await StudentWorkflowState.findOneAndUpdate(
      { student: student2._id, term: term._id },
      {
        $set: {
          student: student2._id,
          term: term._id,
          studentType: 'advising',
          status: 'draft',
          blockingStep: 'Complete draft schedule',
          lastActivityAt: new Date(),
          calculatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // -------------------------------------------------------------------------
    // Scenario 4 (Req 81 - Blocking Guards for Process Schedule / Step 4 Test):
    // Student 3:
    // - StudentSchedule with status: 'readyForStudentReview'
    // - 1 SlotChangeRequest with status: 'pending'
    // -------------------------------------------------------------------------
    const student3 = students[3];

    // 3. Clear any existing schedules that reference non-existent course offerings:
    await StudentSchedule.deleteMany({ term: term._id, student: student3._id });

    // 1. Query an actual published offering from the active term:
    const offering = await CourseOffering.findOne({ term: term._id, isPublished: true }).populate('course');
    if (!offering || !offering.course) {
      throw new Error('No published course offering with course details found for the active term.');
    }

    // 2. Ensure the draft courses array references courseOffering: offering._id and course: offering.course._id with valid slots from offering.slots:
    const validSlots = (offering.slots || []).map((slot) => ({
      componentType: slot.componentType,
      courseOffering: offering._id,
      slotGroupId: slot._id,
    }));

    const scheduledCourse3 = {
      course: offering.course._id,
      courseOffering: offering._id,
      slots: validSlots,
      isMandatory: false,
      isExtraHours: false,
      creditHoursSnapshot: Number(offering.course?.creditHours) || 3,
    };

    const schedule3 = await StudentSchedule.create({
      student: student3._id,
      term: term._id,
      scheduleType: 'advising',
      status: 'readyForStudentReview',
      courses: [scheduledCourse3],
      seatsReserved: true,
      version: 1,
      createdBy: student3.assignedAdvisor || advisors[0]._id,
      processedBy: null,
      processedAt: null,
    });

    const targetSlot = validSlots[0] || {
      componentType: 'lecture',
      courseOffering: offering._id,
      slotGroupId: offering.slots?.[0]?._id,
    };

    await SlotChangeRequest.deleteMany({ student: student3._id, term: term._id });
    await SlotChangeRequest.create({
      student: student3._id,
      schedule: schedule3._id,
      term: term._id,
      course: offering.course._id,
      componentType: targetSlot.componentType,
      currentOffering: targetSlot.courseOffering,
      currentSlotGroupId: targetSlot.slotGroupId,
      preferenceNote: 'Student requested slot change due to transportation conflict.',
      status: 'pending',
    });

    await StudentWorkflowState.findOneAndUpdate(
      { student: student3._id, term: term._id },
      {
        $set: {
          student: student3._id,
          term: term._id,
          studentType: 'advising',
          status: 'readyForStudentReview',
          blockingStep: 'Resolve pending slot-change requests',
          lastActivityAt: new Date(),
          calculatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // -------------------------------------------------------------------------
    // Scenario 5 (Req 81 Clean Process & Req 82 Reopen):
    // Student 4:
    // - StudentSchedule with status: 'processed', version: 1, processedAt = new Date()
    // -------------------------------------------------------------------------
    const student4 = students[4];
    await StudentSchedule.deleteMany({ term: term._id, student: student4._id });
    await SlotChangeRequest.deleteMany({ student: student4._id, term: term._id });
    await MandatoryCourseRemovalRequest.deleteMany({ student: student4._id, term: term._id });

    const offForStudent4 = validOfferingsToUse[0]?.offering || publishedOfferings[0];
    const scheduledCourse4 = buildScheduledCourse(offForStudent4);
    const processedAt = new Date();

    const schedule4 = await StudentSchedule.findOneAndUpdate(
      { student: student4._id, term: term._id, scheduleType: 'advising' },
      {
        $set: {
          student: student4._id,
          term: term._id,
          scheduleType: 'advising',
          status: 'processed',
          courses: [scheduledCourse4],
          seatsReserved: true,
          version: 1,
          createdBy: student4.assignedAdvisor || advisors[0]._id,
          processedBy: coordinator._id,
          processedAt,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    await ScheduleActivity.deleteMany({ student: student4._id, term: term._id });
    await ScheduleActivity.create({
      student: student4._id,
      term: term._id,
      schedule: schedule4._id,
      action: 'processed',
      scheduleVersion: 1,
      actor: coordinator._id,
      actorName: coordinator.fullName,
      actorEmail: coordinator.email,
      actorRole: coordinator.role,
      occurredAt: processedAt,
    });

    await StudentWorkflowState.findOneAndUpdate(
      { student: student4._id, term: term._id },
      {
        $set: {
          student: student4._id,
          term: term._id,
          studentType: 'advising',
          status: 'processed',
          blockingStep: null,
          lastActivityAt: processedAt,
          calculatedAt: processedAt,
        },
      },
      { upsert: true }
    );

    // -------------------------------------------------------------------------
    // Output Formatted Summary Table & Instructions
    // -------------------------------------------------------------------------
    const summaryRows = [
      {
        Scenario: 'Scenario 1: Removal Request & Draft Cascade',
        StudentID: student0.studentId,
        StudentName: student0.user?.fullName || 'Student 0',
        Status: 'Draft with Pending Removal',
        TestingInstructions:
          '1) Open RequestRemovalModal to verify failed Course[1] appears. 2) Coordinator approves pending removal for Course[0] -> cascades and removes Course[0] from draft schedule (Req 64 & 69).',
      },
      {
        Scenario: 'Scenario 2: Filterable Removal Requests',
        StudentID: student1.studentId,
        StudentName: student1.user?.fullName || 'Student 1',
        Status: 'Has Approved & Rejected Requests',
        TestingInstructions:
          'Go to Coordinator Removal Requests (Req 65-68). Filter by status: "approved" and "rejected" to view populated request cards, coordinator decision notes, and details.',
      },
      {
        Scenario: 'Scenario 3: Validation Pass & Student Review',
        StudentID: student2.studentId,
        StudentName: student2.user?.fullName || 'Student 2',
        Status: 'Valid Draft (No Clashes)',
        TestingInstructions:
          'Open draft schedule for Student 2. Click "Send for Student Review" (Req 80). Validations pass successfully and schedule transitions to "readyForStudentReview".',
      },
      {
        Scenario: 'Scenario 4: Process Blocking Guard',
        StudentID: student3.studentId,
        StudentName: student3.user?.fullName || 'Student 3',
        Status: 'ReadyForReview + Pending SlotChange',
        TestingInstructions:
          'Attempt to process schedule (Req 81). Blocked with 400/409 conflict error because student has a pending slot-change request.',
      },
      {
        Scenario: 'Scenario 5: Reopen Processed Schedule',
        StudentID: student4.studentId,
        StudentName: student4.user?.fullName || 'Student 4',
        Status: 'Processed (Version 1)',
        TestingInstructions:
          'Test Req 82 (Reopen Schedule): Provide an explanation note and call POST /api/schedules/advising/:studentId/reopen. Schedule reverts to "draft", version increments to 2, and ScheduleActivity logs reopening.',
      },
    ];

    console.log('\n================================================================================');
    console.log('              PART B3 DEMO SEED COMPLETED SUCCESSFULLY (REQS 64-69, 80-82)      ');
    console.log('================================================================================\n');
    console.table(
      summaryRows.map((r) => ({
        Scenario: r.Scenario,
        'Student ID': r.StudentID,
        'Student Name': r.StudentName,
        'Current Status': r.Status,
      }))
    );

    console.log('\n--- DETAILED TEST INSTRUCTIONS ---');
    summaryRows.forEach((r, idx) => {
      console.log(`\n[${idx + 1}] ${r.Scenario}`);
      console.log(`    Student: ${r.StudentID} (${r.StudentName})`);
      console.log(`    Instructions: ${r.TestingInstructions}`);
    });
    console.log('\n================================================================================\n');
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

seedB3Demo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('B3 Demo Seed Error:', err);
    process.exit(1);
  });
