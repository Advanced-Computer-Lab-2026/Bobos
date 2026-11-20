import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test, { after, before, beforeEach } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { SMTPServer } from "smtp-server";
import app from "../app.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { AcademicTerm, Notification, StudentProfile, StudentTermStanding, User } from "../models/index.js";
import { sendProbationWarnings } from "./probation-warnings.js";

let database, smtp, server, baseUrl;
const messages = [];
let rejectNextMessage = false;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri());
  await Promise.all([AcademicTerm.init(), StudentTermStanding.init(), Notification.init(), StudentProfile.init(), User.init()]);
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    disableReverseLookup: true,
    onData(stream, session, callback) {
      const chunks = [];
      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => {
        if (rejectNextMessage) {
          rejectNextMessage = false;
          return callback(Object.assign(new Error("Temporary SMTP failure"), { responseCode: 451 }));
        }
        messages.push({
          recipient: session.envelope.rcptTo[0].address,
          content: Buffer.concat(chunks).toString().replace(/=\r?\n/g, ""),
        });
        callback();
      });
    },
  });
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(0, "127.0.0.1", resolve);
  });
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.server.address().port),
    SMTP_FROM: "test-sender@guc.edu.eg", SMTP_REQUIRE_TLS: "false", SMTP_SECURE: "false",
  });
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api/academic-terms/academicTerm`;
});

beforeEach(async () => {
  await Promise.all([AcademicTerm, Notification, StudentProfile, StudentTermStanding, User].map(Model => Model.deleteMany({})));
  messages.length = 0;
  rejectNextMessage = false;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (smtp) await new Promise(resolve => smtp.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

function term(code, academicYear, season, starts, ends) {
  const termStart = new Date(starts);
  const termEnd = new Date(ends);
  return AcademicTerm.create({
    code, academicYear, season, termStart, termEnd,
    teachingStart: termStart, teachingEnd: termEnd,
    registrationStart: termStart, registrationEnd: termStart,
    advisingDeadline: termStart, wholeScheduleSwapDeadline: termStart,
  });
}

function consecutiveTerms() {
  return Promise.all([
    term("S24", "2023/2024", "spring", "2024-02-01", "2024-06-15"),
    term("W24", "2024/2025", "winter", "2024-09-15", "2025-01-31"),
  ]);
}

async function student(number, { studentType = "advising", isActive = true, enrollmentStatus = "active" } = {}) {
  const user = await User.create({
    email: `probation-test-${number}@student.guc.edu.eg`, fullName: `Test Student ${number}`,
    role: `${studentType}Student`, passwordHash: "test-hash", isActive,
  });
  const profile = await StudentProfile.create({
    user: user._id, studentId: `64-${String(number).padStart(5, "0")}`, studentType,
    currentSemester: 4, gpa: 3.9, academicStanding: "probation", enrollmentStatus,
    advisingReason: studentType === "advising" ? "probation" : undefined,
  });
  return { user, profile };
}

function standing(profile, semester, academicStanding = "probation") {
  return {
    student: profile._id, term: semester._id, academicStanding, calculatedAt: new Date("2025-01-01"),
  };
}

test("Req 118 stores one official standing per student and term through the administrator API", async () => {
  const [semester] = await consecutiveTerms();
  const { user, profile } = await student(1);
  const admin = await User.create({
    email: "probation-test-admin@guc.edu.eg", role: "administrator", fullName: "Test Administrator", passwordHash: "test-hash",
  });
  const put = (actor, body) => fetch(`${baseUrl}/${semester.code}/standings/${profile.studentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(actor ? { Authorization: `Bearer ${generateToken(actor)}` } : {}) },
    body: JSON.stringify(body),
  });
  assert.equal((await put(null, { academicStanding: "probation" })).status, 401);
  assert.equal((await put(user, { academicStanding: "probation" })).status, 403);
  assert.equal((await put(admin, { academicStanding: "unknown" })).status, 400);
  assert.equal(await StudentTermStanding.countDocuments(), 0);

  const recorded = await put(admin, { academicStanding: "probation" });
  assert.equal(recorded.status, 200);
  const first = (await recorded.json()).standing;
  const corrected = await put(admin, { academicStanding: "goodAcademicStanding" });
  assert.equal(corrected.status, 200);
  assert.equal((await corrected.json()).standing._id, first._id);
  assert.equal(await StudentTermStanding.countDocuments({ student: profile._id, term: semester._id }), 1);
  assert.equal((await StudentTermStanding.findById(first._id)).academicStanding, "goodAcademicStanding");
});

test("Req 118 checks the selected student as soon as an administrator saves their second probation semester", async (t) => {
  const previousSetting = process.env.PROBATION_WARNINGS_ENABLED;
  process.env.PROBATION_WARNINGS_ENABLED = "true";
  t.after(() => {
    if (previousSetting === undefined) delete process.env.PROBATION_WARNINGS_ENABLED;
    else process.env.PROBATION_WARNINGS_ENABLED = previousSetting;
  });
  const [first, second] = await consecutiveTerms();
  const { user, profile } = await student(1);
  const other = await student(2);
  await StudentTermStanding.insertMany([standing(other.profile, first), standing(other.profile, second)]);
  const admin = await User.create({
    email: "probation-test-admin@guc.edu.eg", role: "administrator", fullName: "Test Administrator", passwordHash: "test-hash",
  });
  const save = async (semester) => {
    const response = await fetch(`${baseUrl}/${semester._id}/standings/${profile.studentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${generateToken(admin)}` },
      body: JSON.stringify({ academicStanding: "probation" }),
    });
    const result = await response.json();
    assert.equal(response.status, 200, result.message);
    return result;
  };

  assert.equal((await save(first)).warningEmailStatus, undefined);
  assert.equal(messages.length, 0);
  assert.equal((await save(second)).warningEmailStatus, "sent");
  assert.equal((await save(second)).warningEmailStatus, undefined);
  assert.deepEqual(messages.map(message => message.recipient), [user.email]);

  const inbox = await fetch(new URL("/api/notifications", baseUrl), {
    headers: { Authorization: `Bearer ${generateToken(user)}` },
  });
  assert.equal(inbox.status, 200);
  const [warning] = (await inbox.json()).notifications;
  assert.equal(warning.title, "Academic probation warning");
  assert.equal(warning.deliveryStatus, "sent");
});

test("Req 118 waits for the second semester to finish and sends one warning despite overlapping checks", async () => {
  const [first, second] = await consecutiveTerms();
  await term("SUM24", "2023/2024", "summer", "2024-07-01", "2024-08-20");
  const alias = await term("W24-legacy", "2024-2025", "winter", "2024-09-15", "2025-01-31");
  const { user, profile } = await student(1);
  await StudentTermStanding.insertMany([standing(profile, first), standing(profile, second), standing(profile, alias)]);
  assert.deepEqual(await sendProbationWarnings({ now: new Date("2025-01-30") }), { sent: 0, failed: 0 });
  assert.equal(messages.length, 0);

  const afterSecond = { now: new Date("2025-02-01") };
  const runs = await Promise.all([sendProbationWarnings(afterSecond), sendProbationWarnings(afterSecond)]);
  assert.equal(runs.reduce((total, run) => total + run.sent, 0), 1);
  assert.deepEqual(await sendProbationWarnings(afterSecond), { sent: 0, failed: 0 });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].recipient, user.email);
  assert.match(messages[0].content, /Subject: Academic probation warning/);
  assert.match(messages[0].content, /two consecutive semesters/);
  assert.match(messages[0].content, /following semester, you may face termination from the university/);
  const notices = await Notification.find({ type: "probationWarning" }).lean();
  assert.equal(notices.length, 1);
  assert.equal(String(notices[0].recipient), String(user._id));
  assert.deepEqual(notices[0].channels, ["email"]);
  assert.equal(notices[0].deliveryStatus, "sent");
  assert.ok(notices[0].sentAt instanceof Date);
});

test("Req 118 skips interrupted streaks, a third probation semester and ineligible recipients", async () => {
  const [first, second] = await consecutiveTerms();
  const preceding = await term("W23", "2023/2024", "winter", "2023-09-15", "2024-01-31");
  const makeup = await term("M24", "2023/2024", "firstMakeup", "2024-08-01", "2024-08-31");
  const [three, gap, recovered, one, normal, disabled, inactive, eligible] = await Promise.all([
    student(1), student(2), student(3), student(4),
    student(5, { studentType: "normal" }), student(6, { isActive: false }),
    student(7, { enrollmentStatus: "inactive" }), student(8),
  ]);
  await StudentTermStanding.insertMany([
    ...[preceding, first, second].map(semester => standing(three.profile, semester)),
    ...[preceding, second].map(semester => standing(gap.profile, semester)),
    standing(recovered.profile, first), standing(recovered.profile, second, "goodAcademicStanding"),
    standing(one.profile, makeup), standing(one.profile, second),
    ...[normal, disabled, inactive, eligible].flatMap(({ profile }) => [standing(profile, first), standing(profile, second)]),
    standing(eligible.profile, preceding, "goodAcademicStanding"),
  ]);

  assert.deepEqual(await sendProbationWarnings(), { sent: 1, failed: 0 });
  assert.deepEqual(messages.map(message => message.recipient), [eligible.user.email]);
});

test("Req 118 does not join probation standings across a missing academic year", async () => {
  const old = await term("W22", "2022/2023", "winter", "2022-09-15", "2023-01-31");
  const latest = await term("S25", "2024/2025", "spring", "2025-02-01", "2025-06-15");
  const { profile } = await student(1);
  await StudentTermStanding.insertMany([standing(profile, old), standing(profile, latest)]);
  assert.deepEqual(await sendProbationWarnings(), { sent: 0, failed: 0 });
  assert.equal(await Notification.countDocuments({ type: "probationWarning" }), 0);
});

test("Req 118 retries an SMTP failure using the same warning record", async () => {
  const [first, second] = await consecutiveTerms();
  const { profile } = await student(1);
  await StudentTermStanding.insertMany([standing(profile, first), standing(profile, second)]);
  rejectNextMessage = true;
  assert.deepEqual(await sendProbationWarnings(), { sent: 0, failed: 1 });
  const failed = await Notification.findOne({ type: "probationWarning" });
  assert.equal(failed.deliveryStatus, "failed");
  assert.equal(failed.sentAt, null);
  assert.equal(messages.length, 0);
  assert.deepEqual(await sendProbationWarnings(), { sent: 1, failed: 0 });
  assert.equal((await Notification.findById(failed._id)).deliveryStatus, "sent");
  assert.equal(await Notification.countDocuments({ type: "probationWarning" }), 1);
  assert.equal(messages.length, 1);
});

test("Req 118 automatically checks for eligible warnings when the production API starts", async () => {
  const [first, second] = await consecutiveTerms();
  const { user, profile } = await student(1);
  await StudentTermStanding.insertMany([standing(profile, first), standing(profile, second)]);
  const env = {
    ...process.env, NODE_ENV: "production", JWT_SECRET: "req118-test-only",
    MONGODB_URI: database.getUri(), PORT: "0",
  };
  delete env.PROBATION_WARNINGS_ENABLED;
  const api = spawn(process.execPath, ["apps/api/src/index.js"], { env, stdio: ["ignore", "ignore", "pipe"] });
  const closed = once(api, "close");
  let stderr = "";
  api.stderr.on("data", chunk => { stderr += chunk; });
  try {
    const deadline = Date.now() + 8000;
    let delivered = false;
    while (Date.now() < deadline && api.exitCode == null) {
      delivered = Boolean(await Notification.exists({ type: "probationWarning", deliveryStatus: "sent" }));
      if (delivered) break;
      await delay(50);
    }
    assert.ok(delivered, stderr || "API startup did not deliver the warning");
    assert.deepEqual(messages.map(message => message.recipient), [user.email]);
  } finally {
    api.kill();
    await closed;
  }
});
