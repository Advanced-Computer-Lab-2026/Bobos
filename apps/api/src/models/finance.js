import { ref, registerModel, withTimestamps } from "./shared.js";

const financialTransactionSchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  extraHoursRequest: ref("ExtraHoursRequest", { default: null, index: true }),
  kind: {
    type: String,
    required: true,
    enum: ["walletTopUp", "extraHoursWalletPayment", "gatewayPayment", "deferredCharge", "refund", "deferredChargeCancellation"],
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: "EGP", enum: ["EGP"] },
  status: { type: String, required: true, enum: ["pending", "succeeded", "failed", "cancelled"] },
  settlementOption: { type: String, enum: ["wallet", "gateway", "deferred", null], default: null },
  transactionReference: { type: String, trim: true, index: true },
  deferredChargeReference: { type: String, trim: true, index: true },
  installment: { type: String, trim: true },
  relatedTransaction: ref("FinancialTransaction", { default: null }),
  idempotencyKey: { type: String, trim: true, select: false },
  occurredAt: { type: Date, required: true, default: Date.now, index: true },
});

financialTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
financialTransactionSchema.index({ student: 1, occurredAt: -1 });
financialTransactionSchema.index({ kind: 1, status: 1, occurredAt: -1 });
financialTransactionSchema.index({ settlementOption: 1, status: 1, occurredAt: -1 });

export const FinancialTransaction = registerModel("FinancialTransaction", financialTransactionSchema);

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
