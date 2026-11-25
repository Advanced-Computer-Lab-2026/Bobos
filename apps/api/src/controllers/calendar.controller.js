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
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
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
  const response = await fetch("https://oauth2.googleapis.com/token", { signal: AbortSignal.timeout(15000), method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await response.json();
  if (data.error === "invalid_grant") {
    await CalendarConnection.updateOne({ _id: connection._id, encryptedRefreshToken: connection.encryptedRefreshToken }, { $set: { syncEnabled: false } });
  }
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
  const first = firstDay(term.teachingStart, slot.day);
  const count = 1 + Math.floor((Date.parse(localDate(term.teachingEnd)) - Date.parse(first)) / (7 * 86400000));
  if (count < 1) return null;
  const id = createHash("sha256").update(`${String(entry.student)}:${String(term._id)}:${String(entry.course)}:${String(slot.slotId)}:${slot.type}`).digest("hex").slice(0, 40);
  return {
    id,
    summary: `${entry.courseCode} — ${entry.courseName}`,
    description: [`Type: ${slot.type}`, instructors ? `Instructor: ${instructors}` : ""].filter(Boolean).join("\n"),
    location: slot.room || "",
    start: { dateTime: localDateTime(first, slot.startMinute), timeZone: zone() },
    end: { dateTime: localDateTime(first, slot.endMinute), timeZone: zone() },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${slot.day.slice(0, 2).toUpperCase()};COUNT=${count}`],
    extendedProperties: { private: { bobosTerm: String(term._id), bobosStudent: String(entry.student) } },
  };
}

export async function startCalendarConnect(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) return res.status(503).json({ message: "Google Calendar is not configured yet" });
  if (!process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ message: "Google Calendar is not configured yet" });
  try { encryptionKey(); } catch { return res.status(503).json({ message: "Calendar token encryption is not configured yet" }); }
  const state = jwt.sign({ userId: String(req.user._id), purpose: "calendar-oauth", role: req.user.role }, JWT_SECRET, { expiresIn: "10m" });
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.GOOGLE_REDIRECT_URI, response_type: "code", scope: GOOGLE_SCOPES.join(" "), access_type: "offline", prompt: "select_account consent", include_granted_scopes: "true", state });
  res.json({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
}

export async function completeCalendarConnect(req, res) {
  let role = "normalStudent";
  const returnToPortal = result => `${frontendUrl()}/portal-studio/index.html?${new URLSearchParams({ page: "calendar-sync", role, preview: "live", calendar: result })}`;
  try {
    const { code, state } = req.query;
    const payload = jwt.verify(state, JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.purpose !== "calendar-oauth" || !payload.userId || !code) throw new Error("Invalid authorization response");
    if (payload.role === "advisingStudent") role = payload.role;
    if (req.query.error) throw new Error("Google Calendar authorization was cancelled");
    const body = new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: "authorization_code" });
    const response = await fetch("https://oauth2.googleapis.com/token", { signal: AbortSignal.timeout(15000), method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw new Error("Could not complete Google Calendar authorization");
    const account = await googleRequest("https://www.googleapis.com/oauth2/v2/userinfo", token.access_token);
    if (!String(token.scope || "").split(" ").includes(GOOGLE_SCOPES[2])) throw new Error("Calendar access was not granted");
    if (!account.email) throw new Error("Google did not return an account email");
    const fields = { providerAccountId: account.email, encryptedAccessToken: encrypt(token.access_token), tokenExpiresAt: new Date(Date.now() + Number(token.expires_in || 3600) * 1000), scopes: String(token.scope || "").split(" "), syncEnabled: true };
    const previous = await CalendarConnection.findOne({ user: payload.userId, provider: "google" }).select("+encryptedRefreshToken");
    const sameAccount = previous?.providerAccountId === account.email;
    fields.encryptedRefreshToken = token.refresh_token ? encrypt(token.refresh_token) : sameAccount && previous.encryptedRefreshToken;
    if (!fields.encryptedRefreshToken) throw new Error("Google did not grant offline calendar access");
    if (!sameAccount) {
      fields.lastSyncedEventIds = [];
      fields.lastSyncedAt = null;
    }
    fields.syncFingerprint = "";
    fields.lastSyncError = "";
    await CalendarConnection.findOneAndUpdate({ user: payload.userId, provider: "google" }, {
      $set: fields,
      $setOnInsert: { calendarId: "primary" },
    }, { upsert: true, new: true, runValidators: true });

    return res.redirect(returnToPortal("connected"));
  } catch (error) {
    console.error("Google Calendar authorization failed:", error.message);
    return res.redirect(returnToPortal("error"));
  }
}

export async function getCalendarConnection(req, res) {
  const connection = await CalendarConnection.findOne({ user: req.user._id, provider: "google" }).select("providerAccountId syncEnabled lastSyncedAt lastSyncError").lean();
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && /^[\da-f]{64}$/i.test(process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || ""));
  res.json({ configured, connected: Boolean(connection && connection.syncEnabled !== false), provider: "google", ...(connection || {}) });
}

export async function disconnectCalendar(req, res) {
  const connection = await CalendarConnection.findOne({ user: req.user._id, provider: "google" }).select("+encryptedAccessToken");
  if (connection) {
    try {
      const token = decrypt(connection.encryptedAccessToken);
      await fetch("https://oauth2.googleapis.com/revoke", { signal: AbortSignal.timeout(15000), method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
    } catch { /* Deleting the local credentials still disconnects the account. */ }
    await connection.deleteOne();
  }
  res.json({ connected: false });
}

async function synchronize(userId, automatic) {
  const [student, term, connection] = await Promise.all([
    StudentProfile.findOne({ user: userId }).select("_id").lean(),
    AcademicTerm.findOne({ isActive: true }).sort({ termStart: -1 }).lean(),
    CalendarConnection.findOne({ user: userId, provider: "google", syncEnabled: true }).select("+encryptedAccessToken +encryptedRefreshToken +syncFingerprint"),
  ]);
  if (!student) throw Object.assign(new Error("Only students can sync schedules"), { httpStatus: 403 });
  if (!connection) throw Object.assign(new Error("Connect a Google Calendar account first"), { httpStatus: 409 });
  if (!term) throw Object.assign(new Error("There is no active academic term"), { httpStatus: 409 });
  const schedule = await StudentSchedule.findOne({ student: student._id, term: term._id, status: "processed" }).lean();
  if (!schedule) throw Object.assign(new Error("Your schedule must be processed before it can be synchronized"), { httpStatus: 409 });
  const offeringIds = [...new Set(schedule.courses.flatMap((course) => course.slots.map((slot) => String(slot.courseOffering || course.courseOffering)).filter(Boolean)))];
  const courseIds = [...new Set(schedule.courses.map((course) => String(course.course)))];
  const [offerings, courses] = await Promise.all([CourseOffering.find({ _id: { $in: offeringIds } }).lean(), Course.find({ _id: { $in: courseIds } }).lean()]);
  const offeringMap = new Map(offerings.map((item) => [String(item._id), item]));
  const courseMap = new Map(courses.map((item) => [String(item._id), item]));
  const desired = [];
  for (const scheduled of schedule.courses) {
    const course = courseMap.get(String(scheduled.course));
    if (!course) throw Object.assign(new Error("A course in this schedule is no longer available. Ask your advisor to review the schedule."), { httpStatus: 409 });
    const offering = offeringMap.get(String(scheduled.courseOffering || scheduled.slots[0]?.courseOffering));
    for (const ref of scheduled.slots) {
      const source = offeringMap.get(String(ref.courseOffering || scheduled.courseOffering));
      const slot = source?.slots.find((item) => String(item._id) === String(ref.slotGroupId));
      if (!slot) throw Object.assign(new Error(`A ${ref.componentType} slot for ${course.code} is no longer available. Ask your advisor to review the schedule.`), { httpStatus: 409 });
      const event = eventFor({ student: student._id, course: course._id, courseCode: course.code, courseName: course.name, instructors: source?.instructors || offering?.instructors || [] }, { type: slot.componentType, slotId: slot._id, day: slot.day, startMinute: slot.startMinute, endMinute: slot.endMinute, room: slot.room }, term);
      if (event) desired.push(event);
    }
  }
  desired.sort((a, b) => a.id.localeCompare(b.id));
  const fingerprint = createHash("sha256").update(JSON.stringify([connection.providerAccountId, connection.calendarId, desired])).digest("hex");
  if (automatic && connection.syncFingerprint === fingerprint) return;
  const token = await accessToken(connection);
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId || "primary")}/events`;
  const ids = desired.map((event) => event.id);
  // Keep a durable record of every ID that may reach Google, even if a later request fails.
  const trackedIds = new Set([...connection.lastSyncedEventIds, ...ids]);
  if (connection.syncFingerprint || trackedIds.size !== connection.lastSyncedEventIds.length) {
    connection.lastSyncedEventIds = [...trackedIds];
    connection.syncFingerprint = "";
    await connection.save();
  }
  for (const event of desired) {
    try {
      await googleRequest(`${base}/${event.id}`, token, { method: "PUT", body: JSON.stringify(event) });
    } catch (error) {
      if (error.status !== 404) throw error;
      try {
        await googleRequest(base, token, { method: "POST", body: JSON.stringify(event) });
      } catch (insertError) {
        // An earlier request may have succeeded before its response was lost.
        if (insertError.status !== 409) throw insertError;
        await googleRequest(`${base}/${event.id}`, token, { method: "PUT", body: JSON.stringify(event) });
      }
    }
  }
  for (const staleId of connection.lastSyncedEventIds.filter((id) => !ids.includes(id))) {
    try { await googleRequest(`${base}/${staleId}`, token, { method: "DELETE" }); } catch (error) { if (![404, 410].includes(error.status)) throw error; }
  }
  connection.syncFingerprint = fingerprint;
  connection.lastSyncedEventIds = ids;
  connection.lastSyncedAt = new Date();
  connection.lastSyncError = "";
  await connection.save();
  return { synced: desired.length, lastSyncedAt: connection.lastSyncedAt, timeZone: zone() };
}

const pending = new Map();

export function synchronizeCalendar(userId, automatic = false) {
  const key = String(userId);
  const previous = pending.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(() => synchronize(userId, automatic));
  pending.set(key, next);
  return next.finally(() => { if (pending.get(key) === next) pending.delete(key); });
}

export async function syncCalendar(req, res) {
  try {
    res.json(await synchronizeCalendar(req.user._id));
  } catch (error) {
    res.status(error.httpStatus || 502).json({ message: error.message || "Calendar synchronization failed" });
  }
}
