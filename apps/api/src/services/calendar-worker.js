import mongoose from "mongoose";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { CalendarConnection } from "../models/communications.js";
import { StudentSchedule } from "../models/academics.js";
import { synchronizeCalendar } from "../controllers/calendar.controller.js";

export function startCalendarWorker({ recoveryIntervalMs = 60000 } = {}) {
  const sources = [AcademicTerm, Course, CourseOffering, StudentSchedule].map(model => model.collection.name);
  const filter = { $match: { $or: [
    { "ns.coll": { $in: sources } },
    { "ns.coll": CalendarConnection.collection.name, operationType: { $in: ["insert", "replace"] } },
    { "ns.coll": CalendarConnection.collection.name, "updateDescription.updatedFields.encryptedRefreshToken": { $exists: true } },
  ] } };
  let running;
  let dirty = false;
  let stopped = false;
  let stream;

  async function drain() {
    do {
      dirty = false;
      const connections = CalendarConnection.find({ provider: "google", syncEnabled: true }).select("user").lean().cursor();
      for await (const connection of connections) {
        if (stopped) break;
        try {
          await synchronizeCalendar(connection.user, true);
        } catch (error) {
          await CalendarConnection.updateOne({ _id: connection._id }, { $set: { lastSyncError: error.message } });
          if (error.httpStatus !== 409) console.error("Automatic calendar sync failed:", error.message);
        }
      }
    } while (dirty && !stopped);
  }

  function wake() {
    if (stopped) return;
    dirty = true;
    if (!running) running = drain().catch(error => console.error("Calendar reconciliation failed:", error.message))
      .finally(() => { running = undefined; if (dirty && !stopped) wake(); });
  }

  function watch() {
    if (stream || stopped) return;
    const watcher = mongoose.connection.db.watch([filter]);
    stream = watcher;
    watcher.on("change", wake);
    watcher.on("error", error => {
      console.error("Calendar change stream interrupted:", error.message);
      void watcher.close().catch(() => {});
    });
    watcher.on("close", () => { if (stream === watcher) stream = undefined; });
  }

  watch();
  wake();
  const recovery = setInterval(() => { watch(); wake(); }, recoveryIntervalMs);
  recovery.unref();
  return async () => {
    stopped = true;
    clearInterval(recovery);
    await stream?.close();
    await running;
  };
}
