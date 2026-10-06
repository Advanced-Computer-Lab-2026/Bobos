import { NOTIFICATION_TYPES, USER_ROLES, ref, registerModel, withTimestamps } from "./shared.js";

// ## Sprint 1 schemas
// Notification: Req. 5, 13; also used in Sprint 2 (Req. 117-121).
const notificationSchema = withTimestamps(
  {
    recipient: ref("User", { required: true }),
    type: { type: String, required: true, enum: NOTIFICATION_TYPES, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    channels: { type: [String], enum: ["inApp", "email"], default: ["inApp"] },
    deliveryStatus: { type: String, enum: ["pending", "sent", "failed"], default: "pending" },
    readAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    relatedModel: { type: String, trim: true },
    relatedId: { type: String, trim: true },
    deduplicationKey: { type: String, trim: true, select: false },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

notificationSchema.virtual("isRead").get(function () {
  return this.readAt !== null && this.readAt !== undefined;
});

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { deduplicationKey: 1 },
  { unique: true, partialFilterExpression: { deduplicationKey: { $type: "string" } } },
);

export const Notification = registerModel("Notification", notificationSchema);

// ## Sprint 2 schemas
// CalendarConnection: Req. 116; ScheduleActivity: Req. 123-126.
const calendarConnectionSchema = withTimestamps({
  user: ref("User", { required: true }),
  provider: { type: String, required: true, enum: ["google", "microsoft"] },
  providerAccountId: { type: String, required: true, trim: true },
  encryptedAccessToken: { type: String, required: true, select: false },
  encryptedRefreshToken: { type: String, select: false },
  tokenExpiresAt: Date,
  scopes: { type: [String], default: [] },
  syncEnabled: { type: Boolean, default: true },
  lastSyncedAt: Date,
});

calendarConnectionSchema.index({ user: 1, provider: 1 }, { unique: true });

export const CalendarConnection = registerModel("CalendarConnection", calendarConnectionSchema);

const scheduleActivitySchema = withTimestamps({
  student: ref("StudentProfile", { required: true }),
  term: ref("AcademicTerm", { required: true }),
  schedule: ref("StudentSchedule", { required: true }),
  action: { type: String, required: true, enum: ["processed", "reopened"] },
  scheduleVersion: { type: Number, required: true, min: 1 },
  actor: ref("User", { required: true }),
  actorName: { type: String, required: true, trim: true },
  actorEmail: { type: String, required: true, trim: true, lowercase: true },
  actorRole: { type: String, required: true, enum: USER_ROLES },
  occurredAt: { type: Date, required: true, default: Date.now },
  reason: { type: String, trim: true, maxlength: 2000 },
});

scheduleActivitySchema.pre("validate", function () {
  if (this.action === "reopened" && !this.reason?.trim()) {
    this.invalidate("reason", "A reason is required when reopening a schedule");
  }
});

scheduleActivitySchema.index({ term: 1, action: 1, occurredAt: -1 });
scheduleActivitySchema.index({ action: 1, occurredAt: -1 });
scheduleActivitySchema.index({ student: 1, occurredAt: -1 });
scheduleActivitySchema.index({ actorEmail: 1, occurredAt: -1 });
scheduleActivitySchema.index({ actorName: 1, occurredAt: -1 });

export const ScheduleActivity = registerModel("ScheduleActivity", scheduleActivitySchema);
