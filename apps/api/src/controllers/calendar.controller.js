import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { AcademicTerm, Course, CourseOffering } from "../models/catalogue.js";
import { CalendarConnection } from "../models/communications.js";
import { StudentProfile } from "../models/identity.js";
import { StudentSchedule } from "../models/academics.js";
import { JWT_SECRET } from "../middleware/auth.middleware.js";

const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];
const zone = () => process.env.UNIVERSITY_TIMEZONE || "Africa/Cairo";
const frontendUrl = () => (process.env.WEB_ORIGIN || "http://localhost:5173").split(",")[0].trim();

function encryptionKey() {
  const value = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[\da-f]{64}$/i.test(value)) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY must be a 32-byte hexadecimal key");
  return Buffer.from(value, "hex");
}

function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), data.toString("hex")].join(":");
}

function decrypt(payload) {
  const [iv, tag, data] = String(payload || "").split(":");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
}

async function googleRequest(url, accessToken, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Google Calendar request failed (${response.status})`);
    error.status = response.status;
    error.detail = body.slice(0, 500);
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

async function accessToken(connection) {
  const current = decrypt(connection.encryptedAccessToken);
  if (connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 60000) return current;
  if (!connection.encryptedRefreshToken) throw new Error("Google Calendar connection expired. Reconnect your account.");
  const body = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: decrypt(connection.encryptedRefreshToken), grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Unable to refresh Google Calendar authorization. Reconnect your account.");
  connection.encryptedAccessToken = encrypt(data.access_token);
  connection.tokenExpiresAt = new Date(Date.now() + Number(data.expires_in || 3600) * 1000);
  await connection.save();
  return data.access_token;
}

function localDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}
function weekdayNumber(name) {
  return ({ Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 })[name];
}
function timeText(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
}
function localDateTime(date, minutes) {
  const day = new Date(`${date}T00:00:00Z`);
  if (minutes === 1440) day.setUTCDate(day.getUTCDate() + 1);
  return `${day.toISOString().slice(0, 10)}T${timeText(minutes === 1440 ? 0 : minutes)}`;
}
function firstDay(start, dayName) {
  const date = new Date(`${localDate(start)}T00:00:00Z`);
  const difference = (weekdayNumber(dayName) - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + difference);
  return date.toISOString().slice(0, 10);
}
function eventFor(entry, slot, term) {
  const instructors = entry.instructors.map((item) => item.fullName).filter(Boolean).join(", ");
  const until = new Date(`${localDate(term.teachingEnd)}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + 1);
  const id = createHash("sha256").update(`${String(term._id)}:${String(entry.course)}:${String(slot.slotId)}:${slot.type}`).digest("hex").slice(0, 40);
  return {
    id,
    summary: `${entry.courseCode} — ${entry.courseName}`,
    description: [`Type: ${slot.type}`, instructors ? `Instructor: ${instructors}` : ""].filter(Boolean).join("\n"),
    location: slot.room || "",
    start: { dateTime: localDateTime(firstDay(term.teachingStart, slot.day), slot.startMinute), timeZone: zone() },
    end: { dateTime: localDateTime(firstDay(term.teachingStart, slot.day), slot.endMinute), timeZone: zone() },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${slot.day.slice(0, 2).toUpperCase()};UNTIL=${until.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`],
    extendedProperties: { private: { bobosTerm: String(term._id) } },
  };
}

export async function startCalendarConnect(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) return res.status(503).json({ message: "Google Calendar is not configured yet" });
  if (!process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ message: "Google Calendar is not configured yet" });
  try { encryptionKey(); } catch { return res.status(503).json({ message: "Calendar token encryption is not configured yet" }); }
  const state = jwt.sign({ userId: String(req.user._id), purpose: "calendar-oauth" }, JWT_SECRET, { expiresIn: "10m" });
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.GOOGLE_REDIRECT_URI, response_type: "code", scope: GOOGLE_SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  res.json({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}

export async function completeCalendarConnect(req, res) {
  try {
    const { code, state } = req.query;
    const payload = jwt.verify(state, JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.purpose !== "calendar-oauth" || !payload.userId || !code) throw new Error("Invalid authorization response");
    if (req.query.error) throw new Error("Google Calendar authorization was cancelled");
    const body = new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code" });
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw new Error("Could not complete Google Calendar authorization");
    const account = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } }).then((result) => result.json());
    if (!account.email) throw new Error("Google did not return an account email");
    const fields = { providerAccountId: account.email, encryptedAccessToken: encrypt(token.access_token), tokenExpiresAt: new Date(Date.now() + Number(token.expires_in || 3600) * 1000), scopes: String(token.scope || "").split(" "), syncEnabled: true };
    if (token.refresh_token) fields.encryptedRefreshToken = encrypt(token.refresh_token);
    const connection = await CalendarConnection.findOneAndUpdate({ user: payload.userId, provider: "google" }, {
      $set: fields,
      $setOnInsert: { calendarId: "primary", lastSyncedEventIds: [] },
    }, { upsert: true, new: true, runValidators: true });
    void connection;
    return res.redirect(`${frontendUrl()}/?calendar=connected`);
  } catch (error) {
    return res.redirect(`${frontendUrl()}/?calendar=error`);
  }
}

export async function getCalendarConnection(req, res) {
  const connection = await CalendarConnection.findOne({ user: req.user._id, provider: "google" }).select("providerAccountId syncEnabled lastSyncedAt").lean();
  res.json({ connected: Boolean(connection), provider: "google", ...(connection || {}) });
}

export async function disconnectCalendar(req, res) {
  const connection = await CalendarConnection.findOne({ user: req.user._id, provider: "google" }).select("+encryptedAccessToken");
  if (connection) {
    try {
      const token = decrypt(connection.encryptedAccessToken);
      await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
    } catch { /* Deleting the local credentials still disconnects the account. */ }
    await connection.deleteOne();
  }
  res.json({ connected: false });
}

export async function syncCalendar(req, res) {
  try {
    const [student, term, connection] = await Promise.all([
      StudentProfile.findOne({ user: req.user._id }).select("_id").lean(),
      AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 }).lean(),
      CalendarConnection.findOne({ user: req.user._id, provider: "google", syncEnabled: true }).select("+encryptedAccessToken +encryptedRefreshToken"),
    ]);
    if (!student) return res.status(403).json({ message: "Only students can sync schedules" });
    if (!connection) return res.status(409).json({ message: "Connect a Google Calendar account first" });
    if (!term) return res.status(409).json({ message: "There is no active academic term" });
    const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, status: "processed" }).lean();
    if (!schedule) return res.status(409).json({ message: "Your schedule must be processed before it can be synchronized" });
    const offeringIds = [...new Set(schedule.courses.flatMap((course) => course.slots.map((slot) => String(slot.courseOffering || course.courseOffering)).filter(Boolean)))];
    const courseIds = [...new Set(schedule.courses.map((course) => String(course.course)))];
    const [offerings, courses] = await Promise.all([CourseOffering.find({ _id: { $in: offeringIds } }).lean(), Course.find({ _id: { $in: courseIds } }).lean()]);
    const offeringMap = new Map(offerings.map((item) => [String(item._id), item]));
    const courseMap = new Map(courses.map((item) => [String(item._id), item]));
    const desired = [];
    for (const scheduled of schedule.courses) {
      const course = courseMap.get(String(scheduled.course));
      if (!course) return res.status(409).json({ message: "A course in this schedule is no longer available. Ask your advisor to review the schedule." });
      const offering = offeringMap.get(String(scheduled.courseOffering || scheduled.slots[0]?.courseOffering));
      for (const ref of scheduled.slots) {
        const source = offeringMap.get(String(ref.courseOffering || scheduled.courseOffering));
        const slot = source?.slots.find((item) => String(item._id) === String(ref.slotGroupId));
        if (!slot) return res.status(409).json({ message: `A ${ref.componentType} slot for ${course.code} is no longer available. Ask your advisor to review the schedule.` });
        desired.push(eventFor({ course: course._id, courseCode: course.code, courseName: course.name, instructors: source?.instructors || offering?.instructors || [] }, { type: slot.componentType, slotId: slot._id, day: slot.day, startMinute: slot.startMinute, endMinute: slot.endMinute, room: slot.room }, term));
      }
    }
    const token = await accessToken(connection);
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId || "primary")}/events`;
    const ids = desired.map((event) => event.id);
    for (const event of desired) {
      try {
        await googleRequest(`${base}/${event.id}`, token, { method: "PUT", body: JSON.stringify(event) });
      } catch (error) {
        if (error.status !== 404) throw error;
        await googleRequest(base, token, { method: "POST", body: JSON.stringify(event) });
      }
    }
    for (const staleId of connection.lastSyncedEventIds.filter((id) => !ids.includes(id))) {
      try { await googleRequest(`${base}/${staleId}`, token, { method: "DELETE" }); } catch (error) { if (error.status !== 404) throw error; }
    }
    connection.lastSyncedEventIds = ids;
    connection.lastSyncedAt = new Date();
    await connection.save();
    res.json({ synced: desired.length, lastSyncedAt: connection.lastSyncedAt, timeZone: zone() });
  } catch (error) {
    console.error("Calendar sync failed:", error.message);
    res.status(error.message.includes("CALENDAR_TOKEN_ENCRYPTION_KEY") ? 503 : 502).json({ message: error.message || "Calendar synchronization failed" });
  }
}
