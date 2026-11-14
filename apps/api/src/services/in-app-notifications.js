import { Notification } from "../models/communications.js";

export function inAppNotification(recipient, { type, title, message, relatedModel, relatedId }, sentAt = new Date()) {
  return {
    recipient, type, title, message, relatedModel, relatedId: String(relatedId),
    channels: ["inApp"], deliveryStatus: "sent", sentAt,
  };
}

export async function saveInAppEvents(recipient, scope, events, session) {
  if (!events.length) return;
  const operations = events.map(event => {
    const occurredAt = event.occurredAt || new Date();
    const deduplicationKey = `${scope}:${recipient}:${event.relatedModel}:${event.relatedId}:${event.type}:${event.decisionVersion ?? ""}`;
    return {
      updateOne: {
        filter: { deduplicationKey },
        update: { $setOnInsert: {
          ...inAppNotification(recipient, event, occurredAt), deduplicationKey,
          createdAt: occurredAt, updatedAt: occurredAt,
        } },
        upsert: true,
        timestamps: false,
      },
    };
  });
  try {
    await Notification.bulkWrite(operations, { ordered: false, session });
  } catch (error) {
    // Concurrent inbox requests may both try to insert the same event.
    if (session || error.code !== 11000 || error.writeErrors?.some(entry => entry.code !== 11000)) throw error;
  }
}
