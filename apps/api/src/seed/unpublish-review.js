import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { StudentProfile, User } from "../models/identity.js";
import { ScheduleTemplate, StudentSchedule, StudentWorkflowState } from "../models/academics.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bobos";
const STUDENT_EMAIL = "unpublish.test@student.guc.edu.eg";
const STUDENT_ID = "61-90000";
const STUDENT_PASSWORD = "Password123!";
const TERM_CODE = "60-";
const COURSE_CODE = "ELEC001";

function assertLocalDatabase(uri) {
  if (process.env.UNPUBLISH_SEED_ALLOW_REMOTE === "true") return;
  let hostname;
  try {
    hostname = new URL(uri).hostname.toLowerCase();
  } catch {
    throw new Error("MONGODB_URI is not a valid MongoDB URL.");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("This seed writes only to local MongoDB by default.");
  }
}

async function seedUnpublishReview() {
  assertLocalDatabase(MONGODB_URI);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 7000 });
  try {
    const term = await AcademicTerm.findOne({ code: TERM_CODE });
    if (!term) throw new Error(`Term ${TERM_CODE} is missing. Run the evaluation seed first.`);

    const course = await Course.findOne({ code: COURSE_CODE });
    if (!course) throw new Error(`Course ${COURSE_CODE} is missing. Run the evaluation seed first.`);

    const offering = await CourseOffering.findOne({ term: term._id, course: course._id });
    if (!offering?.isPublished || !offering.slots.length) {
      throw new Error(`${COURSE_CODE} must have a published offering with slots in term ${TERM_CODE}. Run the evaluation seed first.`);
    }

    const templateReferences = await ScheduleTemplate.countDocuments({
      $or: [
        { "courses.courseOffering": offering._id },
        { "courses.slots.courseOffering": offering._id },
      ],
    });
    if (templateReferences) {
      throw new Error(`${COURSE_CODE} is already referenced by ${templateReferences} schedule template(s); choose a published offering with no template references to isolate the student-schedule check.`);
    }

    const passwordHash = await bcrypt.hash(STUDENT_PASSWORD, 10);
    let user = await User.findOne({ email: STUDENT_EMAIL });
    if (user && user.role !== "advisingStudent") {
      throw new Error(`${STUDENT_EMAIL} already belongs to a non-advising account; refusing to change it.`);
    }
    if (!user) {
      user = new User({
        email: STUDENT_EMAIL,
        role: "advisingStudent",
      });
    }
    user.fullName = "Unpublish Review Test Student";
    user.passwordHash = passwordHash;
    user.isActive = true;
    await user.save();

    const advisor = await User.findOne({ role: "advisor", isActive: true }).sort({ email: 1 });
    const administrator = await User.findOne({ role: "administrator", isActive: true }).sort({ email: 1 });
    if (!administrator) throw new Error("No active administrator exists. Run the evaluation seed first.");

    let student = await StudentProfile.findOne({ user: user._id });
    if (!student) {
      const idOwner = await StudentProfile.findOne({ studentId: STUDENT_ID });
      if (idOwner) throw new Error(`Student ID ${STUDENT_ID} is already in use; refusing to attach the test account to another student's record.`);
      student = await StudentProfile.create({
        user: user._id,
        studentId: STUDENT_ID,
        studentType: "advising",
        faculty: "MET",
        major: "CS",
        currentSemester: 9,
        gpa: 3.0,
        academicStanding: "goodAcademicStanding",
        enrollmentStatus: "active",
        studyGroup: "9th",
        advisingReason: "undeclaredMajor",
        assignedAdvisor: advisor?._id || null,
      });
    } else if (student.studentType !== "advising") {
      throw new Error(`${STUDENT_EMAIL} is linked to a non-advising student profile; refusing to change it.`);
    }

    const courses = [{
      course: course._id,
      courseOffering: offering._id,
      slots: offering.slots.map((slot) => ({
        componentType: slot.componentType,
        courseOffering: offering._id,
        slotGroupId: slot._id,
      })),
      isMandatory: true,
      isExtraHours: false,
      creditHoursSnapshot: course.creditHours,
    }];

    const schedule = await StudentSchedule.findOneAndUpdate(
      { student: student._id, term: term._id, scheduleType: "advising" },
      {
        $set: {
          status: "readyForStudentReview",
          template: null,
          courses,
          createdBy: administrator._id,
          processedBy: null,
          processedAt: null,
        },
        $setOnInsert: { student: student._id, term: term._id, scheduleType: "advising" },
      },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    );

    await StudentWorkflowState.findOneAndUpdate(
      { student: student._id, term: term._id },
      {
        $set: {
          student: student._id,
          term: term._id,
          studentType: "advising",
          status: "readyForStudentReview",
          blockingStep: null,
          lastActivityAt: new Date(),
          calculatedAt: new Date(),
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    console.log("Ready-for-review unpublish test data is ready.");
    console.log(`Student: ${student.studentId} · ${user.fullName} (${user.email})`);
    console.log(`Student password: ${STUDENT_PASSWORD}`);
    console.log(`Term: ${term.code} · ${term.academicYear} · ${term.season}`);
    console.log(`Offering: ${course.code} · ${offering._id} (published)`);
    console.log(`Schedule: ${schedule.status}; it references ${course.code} and its ${offering.slots.length} slots.`);
    console.log("Expected unpublish result: HTTP 409 with one active or processed student schedule reference.");
  } finally {
    await mongoose.disconnect();
  }
}

seedUnpublishReview().catch((error) => {
  console.error(`Unpublish review seed failed: ${error.message}`);
  process.exitCode = 1;
});
