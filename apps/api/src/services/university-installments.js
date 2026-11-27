import mongoose from "mongoose";
import { AcademicTerm } from "../models/catalogue.js";
import { FinancialTransaction, UniversityInstallment } from "../models/finance.js";
import { StudentProfile } from "../models/identity.js";
import { ExtraHoursRequest } from "../models/requests.js";

export async function getNextUniversityInstallment(student, term, session) {
  const academicTerm = await AcademicTerm.findById(term).select("academicYear").session(session).lean();
  if (!academicTerm) return null;

  // Deferrals for different requests can share an installment. Serialize their first upsert.
  const locked = await StudentProfile.updateOne({ _id: student }, { $inc: { __v: 1 } }, { session, timestamps: false });
  if (!locked.matchedCount) return null;
  return UniversityInstallment.findOneAndUpdate(
    { student, term },
    { $setOnInsert: { label: `${academicTerm.academicYear} next installment` } },
    { upsert: true, returnDocument: "after", session },
  );
}

export async function linkOutstandingDeferredCharges() {
  const needsLink = {
    kind: "deferredCharge", status: { $in: ["pending", "PENDING"] }, installmentId: null, extraHoursRequest: { $ne: null },
  };
  const charges = FinancialTransaction.find(needsLink).select("_id").lean().cursor();
  for await (const { _id } of charges) {
    await mongoose.connection.transaction(async (session) => {
      const charge = await FinancialTransaction.findOne({ _id, ...needsLink }).session(session);
      if (!charge) return;
      const request = await ExtraHoursRequest.findOne({ _id: charge.extraHoursRequest, student: charge.student })
        .select("term").session(session).lean();
      if (!request) return;
      const installment = await getNextUniversityInstallment(charge.student, request.term, session);
      if (!installment) return;
      charge.installmentId = installment._id;
      if (!charge.installment) charge.installment = installment.label;
      await charge.save({ session });
    });
  }
}
