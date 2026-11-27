import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import mongoose from "mongoose";
import { startCalendarWorker } from "./calendar-worker.js";
import { completeCalendarConnect, startCalendarConnect } from "../controllers/calendar.controller.js";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { CalendarConnection } from "../models/communications.js";
import { StudentProfile } from "../models/identity.js";
import { StudentSchedule } from "../models/academics.js";

test("connected calendar follows processed changes without a browser or a manual sync", async t => {
  process.env.GOOGLE_CLIENT_ID = "fixture-client";
  process.env.GOOGLE_CLIENT_SECRET = "fixture-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = "31".repeat(32);
  process.env.UNIVERSITY_TIMEZONE = "Africa/Cairo";

  const scope = "https://www.googleapis.com/auth/calendar.events";
  const student = { _id: "student" }, user = { _id: "user" };
  const term = { _id: "term", teachingStart: "2026-10-05", teachingEnd: "2026-10-12" };
  const course = { _id: "course", code: "CSEN", name: "Graphics" };
  const slot = { _id: "slot", componentType: "lecture", day: "Monday", startMinute: 600, endMinute: 660, room: "A" };
  const offering = { _id: "offering", slots: [slot], instructors: [{ fullName: "Dr A" }] };
  const schedule = { courses: [{ course: course._id, courseOffering: offering._id, slots: [{ slotGroupId: slot._id }] }] };
  let processed = false;
  let connection;
  const lean = value => ({ lean: async () => value });
  t.mock.method(StudentProfile, "findOne", () => ({ select: () => lean(student) }));
  t.mock.method(AcademicTerm, "findOne", () => ({ sort: () => lean(term) }));
  t.mock.method(StudentSchedule, "findOne", ({status}) => lean(processed && status === "processed" ? schedule : null));
  t.mock.method(CourseOffering, "find", () => lean([offering]));
  t.mock.method(Course, "find", () => lean([course]));
  t.mock.method(CalendarConnection, "findOne", () => ({ select: async () => connection }));
  t.mock.method(CalendarConnection, "findOneAndUpdate", async (filter, update) => {
    connection = { ...filter, ...update.$set, save: async () => {} };
  });
  t.mock.method(CalendarConnection, "updateOne", async () => ({}));
  t.mock.method(CalendarConnection, "find", () => ({ select: () => ({ lean: () => ({ cursor: () => connection ? [connection] : [] }) }) }));
  const stream = new EventEmitter();
  stream.close = async () => {};
  const previousDb = mongoose.connection.db;
  mongoose.connection.db = { watch: () => stream };
  t.after(() => { mongoose.connection.db = previousDb; });

  const events = new Map();
  let writes = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/token")) return Response.json({ access_token: "access", refresh_token: "refresh", scope });
    if (url.endsWith("/userinfo")) return Response.json({ email: "student@example.test" });
    assert.match(url, /^https:\/\/www.googleapis.com\/calendar\/v3\/calendars\/primary\/events/);
    assert.equal(options.headers.Authorization, "Bearer access");
    const id = url.split("/").at(-1);
    if (options.method === "DELETE") {
      events.delete(id);
      return new Response(null, { status: 204 });
    }
    if (options.method === "PUT" && !events.has(id)) return new Response(null, { status: 404 });
    const event = JSON.parse(options.body);
    events.set(event.id, event);
    writes++;
    return Response.json({ id: event.id });
  });
  let authorizationUrl;
  await startCalendarConnect({ user }, { json: data => { authorizationUrl = data.authorizationUrl; } });
  const state = new URL(authorizationUrl).searchParams.get("state");
  await completeCalendarConnect({ query: { code: "fixture-code", state } }, { redirect: url => assert.match(url, /calendar=connected$/) });
  assert.equal(connection.providerAccountId, "student@example.test");
  assert.notEqual(connection.encryptedRefreshToken, "refresh");

  const stop = startCalendarWorker();
  try {
    await delay(20);
    assert.equal(events.size, 0);
    processed = true;
    stream.emit("change");
    await delay(20);
    const [original] = events.values();
    assert.match(original.summary, /CSEN.+Graphics/);
    assert.equal(original.description, "Type: lecture\nInstructor: Dr A");
    assert.equal(original.start.timeZone, "Africa/Cairo");
    assert.equal(original.start.dateTime, "2026-10-05T10:00:00");
    assert.deepEqual(original.recurrence, ["RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2"]);
    stream.emit("change");
    await delay(20);
    assert.equal(writes, 1);
    slot.room = "B";
    stream.emit("change");
    await delay(20);
    assert.equal(events.get(original.id).location, "B");
    assert.equal(events.size, 1);
    schedule.courses = [];
    stream.emit("change");
    await delay(20);
    assert.equal(events.size, 0);
  } finally { await stop(); }
});
