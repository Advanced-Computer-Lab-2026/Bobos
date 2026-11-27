import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { AcademicTerm, Course, CourseOffering, ExtraHoursRequest, FinancialTransaction, SlotChangeRequest, StudentProfile, StudentSchedule, User } from "../models/index.js";
import { standardStudents, evaluationStudents, standardAdvisors, evaluationAdvisors } from "./portal-names.js";
import { standardCreditAllowance } from "../utils/credit-allowance.js";
import { revalidateScheduleForProcessing } from "../controllers/scheduling.controller.js";

const uri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === "production" || !uri || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(uri).hostname)) {
  throw new Error("Set MONGODB_URI to the local Portal development database.");
}
await mongoose.connect(uri);
let inserted = 0;
try {
  // A retry keeps completed reviews, existing schedules, and edited names.
  await mongoose.connection.transaction(async session => {
    inserted = 0;
    async function ensure(Model, key, fields) {
      const existing = await Model.findOne(key).session(session);
      if (existing) return existing;
      const [doc] = await Model.create([{ ...key, ...fields }], { session });
      inserted++;
      return doc;
    }
    for (const [prefix, label, students, advisors] of [
      ["", "", standardStudents, standardAdvisors], ["evaluation.", "Evaluation ", evaluationStudents, evaluationAdvisors],
    ]) {
      for (const [i, fullName] of students.entries()) {
        await User.updateOne({ email: `${prefix}student${i + 1}@student.guc.edu.eg`, fullName: `${label}Advising Student ${i + 1}` }, { $set: { fullName } }, { session });
      }
      for (const [i, fullName] of advisors.entries()) {
        const oldName = `${label}Advisor ${i + 1}`;
        await User.updateOne({ email: `${prefix}advisor${i + 1}@guc.edu.eg`, fullName: { $in: [oldName, oldName + " Name"] } }, { $set: { fullName } }, { session });
      }
    }
    const term = await AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 }).session(session);
    const advisor = await User.findOne({ email: "evaluation.advisor1@guc.edu.eg", isAdvisorInSystem: true }).session(session);
    const coordinator = await User.findOne({ email: "nadia.coordinator@guc.edu.eg" }).session(session);
    const course = await Course.findOne({ code: "SM101", isActive: true }).session(session);
    if (!term || !advisor || !coordinator || !course) throw new Error("The standard Portal demo, evaluation advisor, and Scientific Methods course are required.");
    const passwordHash = await bcrypt.hash("Password123!", 10);
    async function student(fullName, studentId, currentSemester) {
      const email = fullName.toLowerCase().replace(" ", ".") + ".studio@student.guc.edu.eg";
      const user = await ensure(User, { email }, { fullName, role: "advisingStudent", passwordHash, isActive: true });
      return ensure(StudentProfile, { user: user._id }, { studentId, currentSemester, studentType: "advising", major: "CS", gpa: 2.2,
        academicStanding: "goodAcademicStanding", advisingReason: "transfer", assignedAdvisor: advisor._id });
    }
    const nour = await student("Nour Khalil", "79-32001", 7);
    const salma = await student("Salma Amin", "79-32002", 6);
    const ziad = await student("Ziad Helmy", "79-32003", 9);
    const offering = await ensure(CourseOffering, { term: term._id, course: course._id }, { isPublished: true,
      instructors: [{ fullName: advisor.fullName, email: advisor.email }], eligibleGroups: [{ major: "CS", semester: 7 }],
      slots: [["A", "Monday", 540], ["B", "Wednesday", 720]].map(([groupNumber, day, startMinute]) => ({
        componentType: "lecture", groupNumber, day, startMinute, endMinute: startMinute + 90, room: "C3.209", capacity: 24,
      })) });
    const slot = offering.slots[0];
    const schedule = await ensure(StudentSchedule, { student: nour._id, term: term._id, scheduleType: "advising" }, {
      createdBy: advisor._id, status: "readyForStudentReview", courses: [{ course: course._id, courseOffering: offering._id,
        creditHoursSnapshot: course.creditHours, slots: [{ courseOffering: offering._id, slotGroupId: slot._id, componentType: slot.componentType }] }],
    });
    const slotKey = { student: nour._id, schedule: schedule._id, course: course._id, componentType: slot.componentType };
    if (!await SlotChangeRequest.exists(slotKey).session(session)) {
      await revalidateScheduleForProcessing(nour, term, schedule, session);
      await ensure(SlotChangeRequest, slotKey, { term: term._id, currentOffering: offering._id, currentSlotGroupId: slot._id,
        status: "pending", preferenceNote: "Could I move to the Wednesday lecture? My lab meets on Monday morning." });
    }
    for (const [person, code, paid] of [[nour, "MNGT601", false], [salma, "ENGD301", false], [ziad, "CHEMP102", true]]) {
      const extra = await Course.findOne({ code, isActive: true }).session(session);
      if (!extra) throw new Error("Missing demo course " + code);
      const hours = extra.creditHours, allowance = standardCreditAllowance(person.currentSemester), total = hours * 800;
      const history = [{ action: "submitted", actor: advisor._id }];
      if (paid) history.push({ action: "approved", actor: coordinator._id, note: "Course approved for the final study year." }, { action: "paid", actor: person.user, settlementOption: "gateway", settlementStatus: "paid", amount: total });
      const request = await ensure(ExtraHoursRequest, { student: person._id, term: term._id, "courses.course": extra._id }, {
        advisor: advisor._id, courses: [{ course: extra._id, hours, isRepeated: false, pricePerHour: 800, subtotal: total }],
        requestedHours: hours, totalCost: total, history, eligibilitySnapshot: { standardAllowance: allowance, hoursBeforeRequest: allowance,
          hoursAfterRequest: allowance + hours, isProbation: false, graduatingWithinOneYear: person.currentSemester >= 9 },
        ...(paid && { decisionStatus: "approved", decidedBy: coordinator._id, decidedAt: new Date(), decisionNote: "Course approved for the final study year.", settlementStatus: "paid", settlementOption: "gateway" }),
      });
      if (paid) await ensure(FinancialTransaction, { idempotencyKey: "portal-studio-course-payment:" + request.id }, {
        student: person._id, term: term._id, extraHoursRequest: request._id, kind: "gatewayPayment", amount: total, status: "succeeded", settlementOption: "gateway",
        transactionReference: "GUC-" + request.id.slice(-8).toUpperCase(), lineItems: [{ description: extra.name, amount: total, quantity: hours, rate: 800 }],
      });
    }
  });
  console.log(`Coordinator workspace ready. Inserted ${inserted} records.`);
} finally { await mongoose.disconnect(); }
