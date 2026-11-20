import { Schema, ref, registerModel, withTimestamps } from "./shared.js";

// ## Sprint 1 schemas
// FinancialTransaction: Req. 89; also used in Sprint 2 (Req. 90-102, 127).
const financialTransactionSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  extraHoursRequest: ref("ExtraHoursRequest", { default: null, index: true }),
  linkedRequest: { type: Schema.Types.Mixed, default: null },
  kind: {
    type: String,
    enum: [
      "walletTopUp",
      "extraHoursWalletPayment",
      "gatewayPayment",
      "deferredCharge",
      "refund",
      "deferredChargeCancellation",
      "TUITION",
      "EXTRA_HOURS",
      "FEE",
      "REFUND",
      "tuition",
      "extra_hours",
      "fee",
    ],
  },
  type: {
    type: String,
    trim: true,
    index: true,
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: "EGP" },
  status: {
    type: String,
    required: true,
    enum: [
      "pending",
      "succeeded",
      "failed",
      "cancelled",
      "PENDING",
      "COMPLETED",
      "REFUNDED",
      "FAILED",
      "completed",
      "refunded",
    ],
  },
  settlementOption: { type: String, enum: ["wallet", "gateway", "deferred", null], default: null },
  transactionReference: { type: String, trim: true, index: true },
  deferredChargeReference: { type: String, trim: true, index: true },
  receiptId: { type: String, trim: true, index: true },
  referenceNumber: { type: String, trim: true, index: true },
  term: { type: Schema.Types.Mixed, default: null, index: true },
  lineItems: [
    {
      description: { type: String, trim: true },
      amount: { type: Number, min: 0 },
      quantity: { type: Number, default: 1 },
      rate: { type: Number },
    },
  ],
  metadata: { type: Schema.Types.Mixed, default: {} },
  refundedAt: { type: Date, default: null },
  refundedBy: ref("User", { default: null }),
  refundReason: { type: String, trim: true },
  installment: { type: String, trim: true },
  relatedTransaction: ref("FinancialTransaction", { default: null }),
  idempotencyKey: { type: String, trim: true, select: false },
  occurredAt: { type: Date, required: true, default: Date.now, index: true },
});

financialTransactionSchema.pre("validate", function () {
  if (!this.kind && this.type) {
    this.kind = this.type;
  }
  if (!this.type && this.kind) {
    this.type = this.kind;
  }
  if (this.referenceNumber && !this.transactionReference) {
    this.transactionReference = this.referenceNumber;
  }
  if (this.transactionReference && !this.referenceNumber) {
    this.referenceNumber = this.transactionReference;
  }
  if (this.receiptId && !this.transactionReference) {
    this.transactionReference = this.receiptId;
  }
  if (this.transactionReference && !this.receiptId) {
    this.receiptId = this.transactionReference;
  }
});

financialTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
financialTransactionSchema.index({ student: 1, occurredAt: -1 });
financialTransactionSchema.index({ kind: 1, status: 1, occurredAt: -1 });
financialTransactionSchema.index({ settlementOption: 1, status: 1, occurredAt: -1 });
financialTransactionSchema.index({ student: 1, status: 1, type: 1, createdAt: -1 });
financialTransactionSchema.index({ student: 1, status: 1, createdAt: -1 });
financialTransactionSchema.index({ status: 1, type: 1, createdAt: -1 });
financialTransactionSchema.index({ createdAt: -1 });

export const FinancialTransaction = registerModel("FinancialTransaction", financialTransactionSchema);

// ## Sprint 2 schemas
// FinancialReversalRequest: Req. 102.
const financialReversalRequestSchema = withTimestamps({
  student: ref("StudentProfile", { required: true, index: true }),
  extraHoursRequest: ref("ExtraHoursRequest", { required: true }),
  originalTransaction: ref("FinancialTransaction", { required: true, unique: true }),
  requestedBy: ref("User", { required: true }),
  reversalType: { type: String, required: true, enum: ["refundToWallet", "cancelDeferredCharge"] },
  status: { type: String, required: true, enum: ["pending", "completed"], default: "pending" },
  decidedBy: ref("User", { default: null }),
  decidedAt: { type: Date, default: null },
});

financialReversalRequestSchema.index({ extraHoursRequest: 1 }, { unique: true });
financialReversalRequestSchema.index({ status: 1, createdAt: -1 });

export const FinancialReversalRequest = registerModel("FinancialReversalRequest", financialReversalRequestSchema);
