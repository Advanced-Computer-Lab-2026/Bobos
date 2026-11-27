import mongoose from "mongoose";
import { FinancialTransaction, FinancialReversalRequest } from "../models/finance.js";
import { StudentProfile, User } from "../models/identity.js";
import { AcademicTerm } from "../models/catalogue.js";
import { ExtraHoursRequest } from "../models/requests.js";
import { StudentSchedule } from "../models/academics.js";
import { changeSlotCount, collectSlotRefs } from "./scheduling.controller.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const recordOrder = { occurredAt: -1, _id: -1 };

const statusMap = {
  completed: ["succeeded", "completed", "COMPLETED"],
  succeeded: ["succeeded", "completed", "COMPLETED"],
  refunded: ["refunded", "REFUNDED"],
  pending: ["pending", "PENDING"],
  failed: ["failed", "FAILED"],
  cancelled: ["cancelled", "CANCELLED"],
};

const typeMap = {
  tuition: ["TUITION", "tuition"],
  extra_hours: ["EXTRA_HOURS", "extra_hours", "extraHoursWalletPayment", "gatewayPayment", "deferredCharge"],
  fee: ["FEE", "fee"],
  refund: ["REFUND", "refund", "deferredChargeCancellation"],
};

const typeDisplayMap = {
  tuition: "TUITION",
  TUITION: "TUITION",
  fee: "FEE",
  FEE: "FEE",
  extra_hours: "EXTRA_HOURS",
  EXTRA_HOURS: "EXTRA_HOURS",
  extraHoursWalletPayment: "EXTRA_HOURS",
  gatewayPayment: "EXTRA_HOURS",
  deferredCharge: "EXTRA_HOURS",
  refund: "REFUND",
  REFUND: "REFUND",
  deferredChargeCancellation: "REFUND",
};

function formatCSVField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const extraHoursPopulate = {
  path: "extraHoursRequest",
  populate: [
    { path: "term", select: "code season academicYear" },
    { path: "courses.course", select: "code name creditHours" },
  ],
};

/**
 * Build MongoDB query for financial records based on query parameters and user role.
 */
async function buildFinancialQuery(req) {
  const { search, type, status, term, startDate, endDate, settlementOption } = req.query;
  const query = {};
  const andConditions = [];

  // Role-based scoping: advisingStudent can only see their own records
  if (req.user.role === "advisingStudent") {
    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      return { empty: true };
    }
    query.student = profile._id;
  } else if (!["coordinator", "administrator"].includes(req.user.role)) {
    return { forbidden: true };
  }

  // Multi-field search (Req 98, 99)
  if (search && typeof search === "string" && search.trim()) {
    const searchPattern = new RegExp(escapeRegex(search.trim()), "i");

    // Search students by name or email
    const matchingUsers = await User.find({
      $or: [{ fullName: searchPattern }, { email: searchPattern }],
    }).select("_id");
    const userIds = matchingUsers.map((u) => u._id);

    // Search student profiles by studentId or user
    const matchingProfiles = await StudentProfile.find({
      $or: [{ studentId: searchPattern }, { user: { $in: userIds } }],
    }).select("_id");
    const profileIds = matchingProfiles.map((p) => p._id);

    const isObjectId = mongoose.isValidObjectId(search.trim());

    const searchConditions = [
      { student: { $in: profileIds } },
      { transactionReference: searchPattern },
      { deferredChargeReference: searchPattern },
      { receiptId: searchPattern },
      { referenceNumber: searchPattern },
    ];

    if (isObjectId) {
      const objId = new mongoose.Types.ObjectId(search.trim());
      searchConditions.push({ _id: objId });
      searchConditions.push({ extraHoursRequest: objId });
      if (!query.student) {
        searchConditions.push({ student: objId });
      }
    }

    andConditions.push({ $or: searchConditions });
  }

  // Filter by Type / Kind (Req 99)
  if (type && typeof type === "string" && type.trim()) {
    const typeClean = type.trim();
    const mappedTypes = typeMap[typeClean.toLowerCase()];
    if (mappedTypes) {
      andConditions.push({
        $or: [{ type: { $in: mappedTypes } }, { kind: { $in: mappedTypes } }],
      });
    } else {
      const typePattern = new RegExp(`^${escapeRegex(typeClean)}$`, "i");
      andConditions.push({
        $or: [{ type: typePattern }, { kind: typePattern }],
      });
    }
  }

  // Filter by Status (Req 99)
  if (status && typeof status === "string" && status.trim()) {
    const sLower = status.trim().toLowerCase();
    const mappedStatuses = statusMap[sLower] || [status.trim()];
    query.status = { $in: mappedStatuses };
  }

  // Filter by Settlement Option (Req 99, 100)
  if (settlementOption && typeof settlementOption === "string" && settlementOption.trim()) {
    query.settlementOption = settlementOption.trim();
  }

  // Filter by Academic Term (Req 99)
  if (term && typeof term === "string" && term.trim()) {
    const termClean = term.trim();
    const isTermObjectId = mongoose.isValidObjectId(termClean);
    const termPattern = new RegExp(`^${escapeRegex(termClean)}$`, "i");

    const matchingTerms = await AcademicTerm.find({
      $or: [{ code: termPattern }, { academicYear: termPattern }],
    }).select("_id");
    const termIds = matchingTerms.map((t) => t._id);
    const allTermIds = isTermObjectId ? [...termIds, new mongoose.Types.ObjectId(termClean)] : termIds;

    const matchingExtraRequests = allTermIds.length > 0
      ? await ExtraHoursRequest.find({ term: { $in: allTermIds } }).select("_id")
      : [];
    const extraRequestIds = matchingExtraRequests.map((r) => r._id);

    const termConditions = [
      { term: termPattern },
      ...(allTermIds.length > 0 ? [{ term: { $in: allTermIds } }] : []),
      ...(extraRequestIds.length > 0 ? [{ extraHoursRequest: { $in: extraRequestIds } }] : []),
    ];
    andConditions.push({ $or: termConditions });
  }

  // Filter by Date Range (Req 99)
  if (startDate || endDate) {
    const dateRange = {};
    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) {
        dateRange.$gte = s;
      }
    }
    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) {
        if (typeof endDate === "string" && endDate.trim().length === 10) {
          e.setUTCHours(23, 59, 59, 999);
        }
        dateRange.$lte = e;
      }
    }

    if ((startDate && !dateRange.$gte) || (endDate && !dateRange.$lte)
      || dateRange.$gte > dateRange.$lte) {
      return { invalidDates: true };
    }
    if (Object.keys(dateRange).length > 0) {
      andConditions.push({
        $or: [{ occurredAt: dateRange }, { occurredAt: null, createdAt: dateRange }],
      });
    }
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  return { query };
}

/**
 * Format raw transaction object into standardized response shape
 */
function availableReversal(transaction, linkedRequest, reversal) {
  if (transaction.refundedAt || ["REFUNDED", "refunded"].includes(transaction.status)
    || ["REFUND", "refund", "deferredChargeCancellation", "walletTopUp"].includes(transaction.kind)) return null;

  const deferred = transaction.kind === "deferredCharge";
  const action = deferred ? "cancelDeferredCharge" : "refundToWallet";
  const completed = ["COMPLETED", "succeeded", "completed"].includes(transaction.status);
  if (!linkedRequest) return !deferred && completed && !transaction.extraHoursRequest ? action : null;
  if (String(linkedRequest.student) !== String(transaction.student?._id || transaction.student)) return null;

  const approvedReversal = reversal?.reversalType === action
    && String(reversal.student) === String(linkedRequest.student)
    && String(reversal.extraHoursRequest) === String(linkedRequest._id);
  if (linkedRequest.decisionStatus !== "withdrawn" && !approvedReversal) return null;
  if (deferred) {
    return linkedRequest.settlementStatus === "deferred"
      && (completed || ["pending", "PENDING"].includes(transaction.status)) ? action : null;
  }
  return completed && linkedRequest.settlementStatus === "paid"
    && ["extraHoursWalletPayment", "gatewayPayment"].includes(transaction.kind) ? action : null;
}

async function pendingReversals(records) {
  const ids = records.filter(record => record.extraHoursRequest).map(record => record._id);
  if (!ids.length) return new Map();
  const requests = await FinancialReversalRequest.find({ originalTransaction: { $in: ids }, status: "pending" }).lean();
  return new Map(requests.map(request => [String(request.originalTransaction), request]));
}

function formatTransactionRecord(record) {
  if (!record) return null;
  const doc = record.toObject ? record.toObject() : { ...record };

  if (doc.student) {
    doc.student = {
      ...doc.student,
      name: doc.student.user?.fullName || doc.student.name || "",
      email: doc.student.user?.email || doc.student.email || "",
      faculty: doc.student.faculty || "MET",
      studentId: doc.student.studentId || "",
    };
  }

  const rawType = doc.type || doc.kind || "";
  doc.kind = doc.kind || rawType;
  doc.type = typeDisplayMap[rawType] || typeDisplayMap[doc.kind] || rawType;
  doc.referenceNumber = doc.referenceNumber || doc.transactionReference || doc.deferredChargeReference || "";
  doc.receiptId = doc.receiptId || doc.transactionReference || "";
  doc.term = doc.term || doc.extraHoursRequest?.term || null;

  if ((!Array.isArray(doc.lineItems) || doc.lineItems.length === 0)
    && Array.isArray(doc.extraHoursRequest?.courses)
    && doc.extraHoursRequest.courses.length > 0) {
    doc.lineItems = doc.extraHoursRequest.courses.map((item) => ({
      description: item.course?.code
        ? `${item.course.code}${item.course.name ? ` — ${item.course.name}` : ""}`
        : "Extra-hours course charge",
      quantity: item.hours,
      rate: item.pricePerHour,
      amount: item.subtotal,
    }));
  } else {
    doc.lineItems = doc.lineItems || [];
  }

  doc.timestamps = {
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    occurredAt: doc.occurredAt,
  };
  doc.linkedRequest = doc.linkedRequest || doc.extraHoursRequest || null;

  return doc;
}

/**
 * Req 97, 98, 99: View and search financial transaction records (paginated ledger)
 */
export async function getRecords(req, res) {
  try {
    const buildResult = await buildFinancialQuery(req);

    if (buildResult.invalidDates) {
      return res.status(400).json({ message: "Enter a valid financial record date range." });
    }
    if (buildResult.forbidden) {
      return res.status(403).json({ message: "Insufficient permissions to view financial records." });
    }
    if (buildResult.empty) {
      return res.status(200).json({ records: [], total: 0, page: 1, totalPages: 0 });
    }

    const { query } = buildResult;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const total = await FinancialTransaction.countDocuments(query);
    const rawRecords = await FinancialTransaction.find(query)
      .sort(recordOrder)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "student",
        select: "studentId faculty major currentSemester user",
        populate: { path: "user", select: "fullName email role" },
      })
      .populate(extraHoursPopulate)
      .populate("refundedBy", "fullName email role")
      .populate("relatedTransaction");

    const records = rawRecords.map(formatTransactionRecord);
    if (req.user.role !== "advisingStudent") {
      const reversals = await pendingReversals(rawRecords);
      for (const record of records) {
        record.availableReversal = availableReversal(record, record.extraHoursRequest, reversals.get(String(record._id)));
      }
    }
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return res.status(200).json({
      records,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve financial records.", error: error.message });
  }
}

/**
 * Req 100: Detailed record breakdown
 */
export async function getRecordById(req, res) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Financial record not found." });
    }

    const rawRecord = await FinancialTransaction.findById(id)
      .populate({
        path: "student",
        select: "studentId faculty major currentSemester user",
        populate: { path: "user", select: "fullName email role" },
      })
      .populate(extraHoursPopulate)
      .populate("refundedBy", "fullName email role")
      .populate("relatedTransaction");

    if (!rawRecord) {
      return res.status(404).json({ message: "Financial record not found." });
    }

    // Role check: advising students can only view their own records
    if (req.user.role === "advisingStudent") {
      const studentUserId = rawRecord.student?.user?._id || rawRecord.student?.user;
      if (!studentUserId || !studentUserId.equals(req.user._id)) {
        return res.status(403).json({ message: "You can only access your own financial records." });
      }
    } else if (!["coordinator", "administrator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions to view this financial record." });
    }

    const record = formatTransactionRecord(rawRecord);
    if (req.user.role !== "advisingStudent") {
      const reversals = await pendingReversals([rawRecord]);
      record.availableReversal = availableReversal(record, record.extraHoursRequest, reversals.get(String(record._id)));
    }
    return res.status(200).json(record);
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve financial record details.", error: error.message });
  }
}

/**
 * Req 101, 102: Refund processing & validation
 */
export async function processRefund(req, res) {
  try {
    // Ensure requesting user has administrative/financial role authority
    if (!["coordinator", "administrator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions to process refunds." });
    }

    const body = req.body || {};
    const id = req.params.id || body.transactionId || body.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    const outcome = await mongoose.connection.transaction(async (session) => {
      const transaction = await FinancialTransaction.findById(id).session(session);
      if (!transaction) return { status: 404, message: "Transaction not found." };

      if (["refund", "REFUND", "deferredChargeCancellation"].includes(transaction.kind)
        || ["REFUND", "refund", "deferredChargeCancellation"].includes(transaction.type)) {
        return { status: 400, message: "Refund or cancellation entries cannot be refunded." };
      }

      const existingRefund = await FinancialTransaction.exists({
        relatedTransaction: transaction._id,
        kind: { $in: ["refund", "deferredChargeCancellation"] },
      }).session(session);
      if (["REFUNDED", "refunded"].includes(transaction.status) || transaction.refundedAt || existingRefund) {
        return { status: 400, message: "Transaction has already been refunded." };
      }

      let linkedReq = null;
      let reversalReq = null;
      if (transaction.extraHoursRequest) {
        linkedReq = await ExtraHoursRequest.findById(transaction.extraHoursRequest).session(session);
        reversalReq = await FinancialReversalRequest.findOne({ originalTransaction: transaction._id, status: "pending" }).session(session);
      }

      const action = availableReversal(transaction, linkedReq, reversalReq);
      if (!action) {
        return { status: 400, message: "This transaction is not eligible for refund or cancellation." };
      }

      const isDeferred = action === "cancelDeferredCharge";
      const refundReason = String(body.reason || body.refundReason || "Administrative refund").trim();
      const refundAmount = body.amount === undefined ? transaction.amount : Number(body.amount);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > transaction.amount
        || (linkedReq && refundAmount !== transaction.amount)) {
        return { status: 400, message: "Invalid refund amount." };
      }

      const now = new Date();
      transaction.status = isDeferred ? "cancelled" : "REFUNDED";
      transaction.refundedAt = now;
      transaction.refundedBy = req.user._id;
      transaction.refundReason = refundReason;
      await transaction.save({ session });

      const refundRef = `REF-${new mongoose.Types.ObjectId()}`;
      const [refundRecord] = await FinancialTransaction.create([{
        student: transaction.student,
        extraHoursRequest: transaction.extraHoursRequest || null,
        kind: isDeferred ? "deferredChargeCancellation" : "refund",
        type: "REFUND",
        amount: refundAmount,
        currency: transaction.currency || "EGP",
        status: "succeeded",
        settlementOption: isDeferred ? "deferred" : "wallet",
        term: transaction.term,
        installment: transaction.installment,
        deferredChargeReference: transaction.deferredChargeReference,
        transactionReference: refundRef,
        relatedTransaction: transaction._id,
        refundedAt: now,
        refundedBy: req.user._id,
        refundReason,
        occurredAt: now,
      }], { session });

      if (reversalReq) {
        reversalReq.status = "completed";
        reversalReq.decidedBy = req.user._id;
        reversalReq.decidedAt = now;
        await reversalReq.save({ session });
      }

      if (linkedReq) {
        const nextSettlementStatus = isDeferred ? "cancelled" : "refunded";
        await ExtraHoursRequest.updateOne(
          { _id: linkedReq._id, student: transaction.student },
          {
            $set: { settlementStatus: nextSettlementStatus },
            $push: {
              history: {
                action: isDeferred ? "cancelled" : "refunded",
                actor: req.user._id,
                note: refundReason.slice(0, 1000),
                settlementOption: transaction.settlementOption,
                settlementStatus: nextSettlementStatus,
                amount: refundAmount,
                occurredAt: now,
              },
            },
          },
          { session, runValidators: true },
        );

        const revokedCourseIds = new Set(linkedReq.courses.map(({ course }) => String(course)));
        const schedules = await StudentSchedule.find({
          student: transaction.student,
          term: linkedReq.term,
          status: { $in: ["draft", "readyForStudentReview"] },
          "courses.course": { $in: [...revokedCourseIds] },
        }).session(session);
        for (const schedule of schedules) {
          const removed = schedule.courses.filter(course => revokedCourseIds.has(String(course.course)) && !course.isMandatory);
          if (!removed.length) continue;
          if (schedule.seatsReserved) {
            for (const slot of collectSlotRefs(removed).values()) {
              await changeSlotCount({ ...slot, delta: -slot.count }, session);
            }
          }
          schedule.courses = schedule.courses.filter(course => !removed.includes(course));
          schedule.status = "draft";
          schedule.version += 1;
          await schedule.save({ session });
        }
      }

      return { transaction, refundRecord };
    });

    if (outcome.status) return res.status(outcome.status).json({ message: outcome.message });
    return res.status(200).json({
      success: true,
      message: outcome.refundRecord.kind === "deferredChargeCancellation" ? "Deferred charge cancelled." : "Refund processed successfully.",
      originalTransaction: formatTransactionRecord(outcome.transaction),
      refundRecord: formatTransactionRecord(outcome.refundRecord),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to process refund.", error: error.message });
  }
}

/**
 * Req 127: Financial records export (CSV format)
 */
export async function exportRecords(req, res) {
  try {
    // Enforce role privileges
    if (!["coordinator", "administrator"].includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions to export financial records." });
    }

    const buildResult = await buildFinancialQuery(req);
    if (buildResult.invalidDates) {
      return res.status(400).json({ message: "Enter a valid financial record date range." });
    }
    if (buildResult.forbidden) {
      return res.status(403).json({ message: "Insufficient permissions to export financial records." });
    }

    const query = buildResult.empty ? { _id: null } : buildResult.query;

    const rawRecords = await FinancialTransaction.find(query)
      .sort(recordOrder)
      .populate({
        path: "student",
        select: "studentId faculty major currentSemester user",
        populate: { path: "user", select: "fullName email role" },
      })
      .populate(extraHoursPopulate);

    const records = rawRecords.map(formatTransactionRecord);

    const headers = [
      "Transaction ID",
      "Student ID",
      "Student Name",
      "Type",
      "Amount",
      "Status",
      "Term",
      "Date",
    ];

    const rows = records.map((r) => [
      formatCSVField(r.referenceNumber || r.receiptId || r.transactionReference || r._id),
      formatCSVField(r.student?.studentId || ""),
      formatCSVField(r.student?.name || r.student?.user?.fullName || ""),
      formatCSVField(r.type || r.kind || ""),
      formatCSVField(r.amount),
      formatCSVField(r.status),
      formatCSVField(r.term?.code || (typeof r.term === "string" ? r.term : "") || ""),
      formatCSVField(r.occurredAt ? new Date(r.occurredAt).toISOString() : (r.createdAt ? new Date(r.createdAt).toISOString() : "")),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="financial_records.csv"');

    return res.status(200).send(csvContent);
  } catch (error) {
    return res.status(500).json({ message: "Failed to export financial records.", error: error.message });
  }
}
