// Uses a disposable database and a temporary event in an already connected Google account.
// Run: node --env-file=.env scripts/verify-calendar-live.mjs student@example.edu
import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import mongoose from "mongoose";
import { User, StudentProfile, AcademicTerm, Course, CourseOffering, StudentSchedule, CalendarConnection } from "../apps/api/src/models/index.js";
import { startCalendarWorker } from "../apps/api/src/services/calendar-worker.js";

const requireApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { MongoMemoryReplSet } = requireApi("mongodb-memory-server");
const email = process.argv[2];
if (!email) throw new Error("Provide the Bobos student email whose connected calendar should be verified.");

function decrypt(payload) {
  const [iv, tag, data] = payload.split(":");
  const cipher = createDecipheriv("aes-256-gcm", Buffer.from(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY, "hex"), Buffer.from(iv, "hex"));
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([cipher.update(Buffer.from(data, "hex")), cipher.final()]).toString("utf8");
}

let database, stop, fixtureConnection;
const tracked = new Set();
async function google(method, id) {
  const connection = await CalendarConnection.findById(fixtureConnection._id).select("+encryptedAccessToken");
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId)}/events`;
  return fetch(`${base}/${id}`, { method, signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${decrypt(connection.encryptedAccessToken)}` } });
}
async function until(check, message) {
  const deadline = Date.now() + 45000;
  while (!await check()) {
    if (Date.now() > deadline) throw new Error(message);
    await delay(250);
  }
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const owner = await User.findOne({ email });
  assert.ok(owner && ["normalStudent", "advisingStudent"].includes(owner.role), "Select a student account");
  const original = await CalendarConnection.findOne({ user: owner._id, provider: "google", syncEnabled: true }).select("+encryptedAccessToken +encryptedRefreshToken").lean();
  assert.ok(original?.encryptedRefreshToken, "A real Google connection with offline access is required");
  await mongoose.disconnect();

  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const user = await User.create({ fullName: "Calendar Verification", email: "calendar-verification@student.guc.edu.eg", role: "normalStudent", passwordHash: "not-a-login-account" });
  const student = await StudentProfile.create({ user: user._id, studentId: "99-99116", studentType: "normal", major: "CS", currentSemester: 5, gpa: 2, academicStanding: "goodAcademicStanding" });
  const term = await AcademicTerm.create({ code: "VERIFY116", academicYear: "2026/2027", season: "winter", termStart: new Date("2026-10-01"), termEnd: new Date("2027-03-01"), teachingStart: new Date("2026-11-24"), teachingEnd: new Date("2026-12-01"), registrationStart: new Date("2026-09-01"), registrationEnd: new Date("2026-10-10"), advisingDeadline: new Date("2026-10-15"), wholeScheduleSwapDeadline: new Date("2026-10-20"), isActive: true });
  const course = await Course.create({ code: "BOBOS VERIFY 116", name: "Temporary calendar sync check", creditHours: 1, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 5 });
  const offering = await CourseOffering.create({ course: course._id, term: term._id, isPublished: true, eligibleGroups: [{ major: "CS", semester: 5, studyGroup: "1" }], instructors: [{ fullName: "Bobos verification" }], slots: [{ componentType: "lecture", groupNumber: "1", day: "Wednesday", startMinute: 600, endMinute: 660, room: "Verification A", capacity: 1 }] });
  const schedule = await StudentSchedule.create({ student: student._id, term: term._id, scheduleType: "normal", status: "processed", createdBy: user._id, courses: [{ course: course._id, courseOffering: offering._id, creditHoursSnapshot: 1, slots: [{ componentType: "lecture", courseOffering: offering._id, slotGroupId: offering.slots[0]._id }] }] });
  fixtureConnection = await CalendarConnection.create({ user: user._id, provider: "google", providerAccountId: original.providerAccountId, encryptedAccessToken: original.encryptedAccessToken, encryptedRefreshToken: original.encryptedRefreshToken, tokenExpiresAt: original.tokenExpiresAt, scopes: original.scopes, calendarId: original.calendarId || "primary", syncEnabled: true });
  stop = startCalendarWorker();
  await until(async () => {
    const state = await CalendarConnection.findById(fixtureConnection._id);
    state.lastSyncedEventIds.forEach(id => tracked.add(id));
    return Boolean(state.lastSyncedAt);
  }, "Initial automatic sync did not complete");
  const [id] = tracked;
  assert.ok(id);
  let response = await google("GET", id);
  assert.equal(response.status, 200, "Google must return the actual created event");
  let event = await response.json();
  assert.equal(event.location, "Verification A");
  assert.equal(event.start.timeZone, "Africa/Cairo");
  console.log("PASS: real Google recurring event created automatically in Africa/Cairo.");

  const started = Date.now();
  await CourseOffering.updateOne({ _id: offering._id }, { $set: { "slots.0.room": "Verification B", "slots.0.startMinute": 630, "slots.0.endMinute": 690 } });
  await until(async () => {
    const result = await google("GET", id);
    if (!result.ok) return false;
    event = await result.json();
    return event.location === "Verification B" && event.start.dateTime.includes("T10:30:00");
  }, "A real database change did not update the Google event");
  console.log(`PASS: MongoDB change stream updated the same Google event in ${Date.now() - started}ms, without manual sync.`);

  await StudentSchedule.updateOne({ _id: schedule._id }, { $set: { courses: [] } });
  await until(async () => {
    const result = await google("GET", id);
    if ([404, 410].includes(result.status)) return true;
    return result.ok && (await result.json()).status === "cancelled";
  }, "Removed class remained in the real Google Calendar");
  console.log("PASS: removing the class deleted the real Google event.");
  console.log(`Verified account: ${original.providerAccountId}. Production student schedules were not modified.`);
} finally {
  if (stop) await stop();
  if (fixtureConnection && mongoose.connection.readyState === 1) {
    const saved = await CalendarConnection.findById(fixtureConnection._id);
    saved?.lastSyncedEventIds.forEach(id => tracked.add(id));
    for (const id of tracked) {
      const response = await google("DELETE", id);
      assert.ok([200, 204, 404, 410].includes(response.status), `Temporary event cleanup failed (${response.status})`);
    }
    console.log("Cleanup: temporary Google events removed.");
  }
  await mongoose.disconnect();
  if (database) await database.stop();
}
