import mongoose from "mongoose";
import { FinancialTransaction, FinancialReversalRequest } from "../models/finance.js";
import { StudentProfile, User } from "../models/identity.js";
import { AcademicTerm } from "../models/catalogue.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const statusMap = {
  completed: ["succeeded", "completed", "COMPLETED"],
  succeeded: ["succeeded", "completed", "COMPLETED"],
  refunded: ["refunded", "REFUNDED"],
  pending: ["pending", "PENDING"],
  failed: ["failed", "FAILED"],
  cancelled: ["cancelled", "CANCELLED"],
};

function formatCSVField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build MongoDB query for financial records based on query parameters and user role.
 */
async function buildFinancialQuery(req) {
  const { search, type, status, term, startDate, endDate, settlementOption } = req.query;
  const query = {};

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

    if (query.student) {
      // If already scoped to a student, ensure we don't widen the scope
      query.$and = query.$and || [];
      query.$and.push({ $or: searchConditions });
    } else {
      query.$or = searchConditions;
    }
  }

  // Filter by Type / Kind (Req 99)
  if (type && typeof type === "string" && type.trim()) {
    const typePattern = new RegExp(`^${escapeRegex(type.trim())}$`, "i");
    const typeCondition = {
      $or: [{ type: typePattern }, { kind: typePattern }],
    };
    if (query.$and) {
      query.$and.push(typeCondition);
    } else if (query.$or) {
      query.$and = [{ $or: query.$or }, typeCondition];
      delete query.$or;
    } else {
      query.$or = typeCondition.$or;
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

    const termConditions = [{ term: termClean }, { term: { $in: termIds } }];
    if (isTermObjectId) {
      termConditions.push({ term: new mongoose.Types.ObjectId(termClean) });
    }

    if (query.$and) {
      query.$and.push({ $or: termConditions });
    } else if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: termConditions }];
      delete query.$or;
    } else {
      query.$or = termConditions;
    }
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

    if (Object.keys(dateRange).length > 0) {
      const dateCondition = {
        $or: [{ occurredAt: dateRange }, { createdAt: dateRange }],
      };
      if (query.$and) {
        query.$and.push(dateCondition);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, dateCondition];
        delete query.$or;
      } else {
        query.$or = dateCondition.$or;
      }
    }
  }

  return { query };
}

/**
 * Format raw transaction object into standardized response shape
 */
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

  doc.type = doc.type || doc.kind || "";
  doc.kind = doc.kind || doc.type || "";
  doc.referenceNumber = doc.referenceNumber || doc.transactionReference || doc.deferredChargeReference || "";
  doc.receiptId = doc.receiptId || doc.transactionReference || "";
  doc.lineItems = doc.lineItems || [];
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
      .sort({ createdAt: -1, occurredAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "student",
        select: "studentId faculty major currentSemester user",
        populate: { path: "user", select: "fullName email role" },
      })
      .populate("extraHoursRequest")
      .populate("refundedBy", "fullName email role")
      .populate("relatedTransaction");

    const records = rawRecords.map(formatTransactionRecord);
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
      .populate("extraHoursRequest")
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

    const id = req.params.id || req.body.transactionId || req.body.id;
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    const transaction = await FinancialTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    // Check if already refunded
    const isAlreadyRefunded =
      ["REFUNDED", "refunded"].includes(transaction.status) ||
      transaction.refundedAt !== null;

    if (isAlreadyRefunded) {
      return res.status(400).json({ message: "Transaction has already been refunded." });
    }

    // Check if there is an existing refund transaction referencing this
    const existingRefund = await FinancialTransaction.findOne({
      relatedTransaction: transaction._id,
      kind: "refund",
    });
    if (existingRefund) {
      return res.status(400).json({ message: "Transaction has already been refunded." });
    }

    // Validate that transaction has status COMPLETED or succeeded
    const isCompleted = ["COMPLETED", "succeeded", "completed"].includes(transaction.status);
    if (!isCompleted) {
      return res.status(400).json({ message: "Only completed transactions are eligible for refund." });
    }

    const refundReason = (req.body.reason || req.body.refundReason || "Administrative refund").trim();
    const refundAmount = Number(req.body.amount) || transaction.amount;
    if (refundAmount <= 0 || refundAmount > transaction.amount) {
      return res.status(400).json({ message: "Invalid refund amount." });
    }

    const now = new Date();

    // Mark original transaction as REFUNDED with audit metadata
    transaction.status = "REFUNDED";
    transaction.refundedAt = now;
    transaction.refundedBy = req.user._id;
    transaction.refundReason = refundReason;
    await transaction.save();

    // Create balancing ledger entry to atomically credit wallet
    const refundRef = `REF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [refundRecord] = await FinancialTransaction.create([
      {
        student: transaction.student,
        extraHoursRequest: transaction.extraHoursRequest || null,
        kind: "refund",
        type: "REFUND",
        amount: refundAmount,
        currency: transaction.currency || "EGP",
        status: "succeeded",
        settlementOption: "wallet",
        transactionReference: refundRef,
        referenceNumber: refundRef,
        receiptId: refundRef,
        relatedTransaction: transaction._id,
        refundedAt: now,
        refundedBy: req.user._id,
        refundReason: refundReason,
        occurredAt: now,
      },
    ]);

    // Update pending reversal request if exists
    await FinancialReversalRequest.findOneAndUpdate(
      { originalTransaction: transaction._id },
      {
        status: "completed",
        decidedBy: req.user._id,
        decidedAt: now,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Refund processed successfully.",
      originalTransaction: formatTransactionRecord(transaction),
      refundRecord: formatTransactionRecord(refundRecord),
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
    if (buildResult.forbidden) {
      return res.status(403).json({ message: "Insufficient permissions to export financial records." });
    }

    const query = buildResult.empty ? { _id: null } : buildResult.query;

    const rawRecords = await FinancialTransaction.find(query)
      .sort({ createdAt: -1, occurredAt: -1 })
      .populate({
        path: "student",
        select: "studentId faculty major currentSemester user",
        populate: { path: "user", select: "fullName email role" },
      })
      .populate("extraHoursRequest");

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
