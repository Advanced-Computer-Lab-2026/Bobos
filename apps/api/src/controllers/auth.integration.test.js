import assert from "node:assert/strict";
import test, { before, after, beforeEach } from "node:test";
import { once } from "node:events";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { SMTPServer } from "smtp-server";
import app from "../app.js";
import { User } from "../models/identity.js";
import { USER_ROLES } from "../models/shared.js";
import { passwordResetEmail } from "../services/password-reset-email.js";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../middleware/auth.middleware.js";

let database, smtp, http, baseUrl;
let requestNumber = 0;
const messages = [];
const password = "OriginalPassword123!";
const newPassword = "ChangedPassword456!";
const passwordHash = await bcrypt.hash(password, 4);

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: "bobos_auth_test" });
  await User.init();
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    disableReverseLookup: true,
    onData(stream, session, callback) {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => {
        messages.push({ recipient: session.envelope.rcptTo[0].address, content: Buffer.concat(chunks).toString() });
        callback();
      });
    },
  });
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(0, "127.0.0.1", resolve);
  });
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(smtp.server.address().port);
  process.env.SMTP_FROM = "test-sender@guc.edu.eg";
  process.env.SMTP_REQUIRE_TLS = "false";
  process.env.SMTP_SECURE = "false";
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.ALLOW_DEMO_SEED;

  // Trust only the local test client so each simulated IP has its own rate limit.
  app.set("trust proxy", "loopback");
  http = app.listen(0, "127.0.0.1");
  await once(http, "listening");
  baseUrl = `http://127.0.0.1:${http.address().port}/api/identity`;
});

after(async () => {
  if (http) await new Promise((resolve) => http.close(resolve));
  if (smtp) await new Promise((resolve) => smtp.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

beforeEach(async () => {
  // This database belongs only to this test's temporary MongoDB process.
  await User.deleteMany({});
  messages.length = 0;
});

async function request(path, body, { token, ip } = {}) {
  const headers = { "Content-Type": "application/json", "X-Forwarded-For": ip || `192.0.2.${++requestNumber % 250 + 1}` };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function createUser(role = "normalStudent", extra = {}) {
  const domain = ["normalStudent", "advisingStudent"].includes(role) ? "student.guc.edu.eg" : "guc.edu.eg";
  return User.create({ email: `${role.toLowerCase()}@${domain}`, fullName: "Test Account", role, passwordHash, ...extra });
}

function lastOtp() {
  const match = messages.at(-1)?.content.match(/code is (\d{6})/);
  assert.ok(match, "The local SMTP server must receive a six-digit OTP");
  return match[1];
}

test("The combined API starts with authentication and teammate routes mounted", async () => {
  const health = await fetch(baseUrl.replace("/api/identity", "/api/health"));
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", database: "connected" });
  // Student records require authentication before any record is queried.
  const transcript = await request("/students/not-an-id/transcript");
  assert.equal(transcript.status, 401);
  const term = await fetch(baseUrl.replace("/api/identity", "/api/academic-terms/academicTerm/not-an-id"), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(term.status, 400);
  assert.equal((await term.json()).message, "Invalid academic term ID");
});

test("Requirement 2: all five roles receive an email OTP and can change their password", async (t) => {
  for (const role of USER_ROLES) {
    await t.test(role, async () => {
      const user = await createUser(role);
      const loggedIn = await request("/login", { email: user.email, password });
      assert.equal(loggedIn.status, 200);

      const requested = await request("/forgot-password", { email: ` ${user.email.toUpperCase()} ` });
      assert.equal(requested.status, 200);
      const otp = lastOtp();
      assert.equal(messages.at(-1).recipient, user.email);
      assert.equal(JSON.stringify(requested.body).includes(otp), false);
      const stored = await User.findById(user._id).select("+passwordReset");
      assert.notEqual(stored.passwordReset.otpHash, otp);
      assert.equal((await User.findById(user._id)).passwordReset, undefined);

      const changed = await request("/reset-password", { email: user.email, otp, newPassword });
      assert.equal(changed.status, 200);
      const afterReset = await User.findById(user._id).select("+passwordHash +passwordReset");
      assert.equal(await bcrypt.compare(newPassword, afterReset.passwordHash), true);
      assert.equal(afterReset.passwordReset, undefined);
      assert.equal(afterReset.authVersion, 1);
      assert.equal((await request("/login", { email: user.email, password })).status, 401);
      assert.equal((await request("/login", { email: user.email, password: newPassword })).status, 200);
      assert.equal((await request("/me", undefined, { token: loggedIn.body.token })).status, 401);
      assert.equal((await request("/reset-password", { email: user.email, otp, newPassword })).status, 400);
    });
  }
});

test("Requirement 2: unknown and inactive accounts get the same response and no email", async () => {
  const inactive = await createUser("advisor", { isActive: false });
  const missing = await request("/forgot-password", { email: "missing@guc.edu.eg" });
  const blocked = await request("/forgot-password", { email: inactive.email });
  assert.deepEqual(missing, blocked);
  assert.equal(missing.status, 200);
  assert.equal(messages.length, 0);
});

test("Requirement 2: expired codes cannot change the password", async () => {
  const user = await createUser();
  await request("/forgot-password", { email: user.email });
  const otp = lastOtp();
  await User.updateOne({ _id: user._id }, { $set: { "passwordReset.expiresAt": new Date(0) } });
  assert.equal((await request("/reset-password", { email: user.email, otp, newPassword })).status, 400);
  assert.equal((await request("/login", { email: user.email, password })).status, 200);
});

test("Requirement 2: five wrong codes block further verification", async () => {
  const user = await createUser();
  await request("/forgot-password", { email: user.email });
  const otp = lastOtp();
  const wrong = otp === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    assert.equal((await request("/reset-password", { email: user.email, otp: wrong, newPassword })).status, 400);
  }
  assert.equal((await User.findById(user._id).select("+passwordReset")).passwordReset.attempts, 5);
  assert.equal((await request("/reset-password", { email: user.email, otp, newPassword })).status, 400);
});

test("Requirement 2: resend cooldown and concurrent requests produce only one email", async () => {
  const user = await createUser();
  const results = await Promise.all([
    request("/forgot-password", { email: user.email }),
    request("/forgot-password", { email: user.email }),
  ]);
  assert.equal(results.every((result) => result.status === 200), true);
  assert.equal(messages.length, 1);
  const otp = lastOtp();
  assert.equal((await request("/forgot-password", { email: user.email })).status, 200);
  assert.equal(messages.length, 1);
  assert.equal((await request("/reset-password", { email: user.email, otp, newPassword })).status, 200);
});

test("Requirement 2: concurrent submissions can consume the code only once", async () => {
  const user = await createUser();
  await request("/forgot-password", { email: user.email });
  const otp = lastOtp();
  const results = await Promise.all([
    request("/reset-password", { email: user.email, otp, newPassword }),
    request("/reset-password", { email: user.email, otp, newPassword: "OtherPassword789!" }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 400]);
  assert.equal((await User.findById(user._id)).authVersion, 1);
});

test("Requirement 2: SMTP failure clears the undelivered code", async (t) => {
  const user = await createUser();
  t.mock.method(passwordResetEmail, "sendOtp", async () => { throw new Error("Delivery failed"); });
  assert.equal((await request("/forgot-password", { email: user.email })).status, 503);
  assert.equal((await User.findById(user._id).select("+passwordReset")).passwordReset, undefined);
});

test("Requirement 2: missing SMTP configuration returns an actionable error", async (t) => {
  t.mock.method(passwordResetEmail, "isConfigured", () => false);
  assert.equal((await request("/forgot-password", { email: "test@guc.edu.eg" })).status, 503);
  assert.equal(messages.length, 0);
});

test("Requirement 2: malformed inputs and invalid password lengths are rejected", async () => {
  for (const body of [null, {}, { email: { $ne: null } }, { email: "test@gmail.com" }]) {
    assert.equal((await request("/forgot-password", body)).status, 400);
  }
  for (const body of [
    {}, { email: "test@guc.edu.eg", otp: 123456, newPassword },
    { email: "test@guc.edu.eg", otp: "123456", newPassword: "short" },
    { email: "test@guc.edu.eg", otp: "123456", newPassword: "x".repeat(73) },
    { email: "test@guc.edu.eg", otp: "123456", newPassword: "é".repeat(37) },
    { email: "test@guc.edu.eg", otp: "123456", newPassword: "        " },
  ]) {
    assert.equal((await request("/reset-password", body)).status, 400);
  }
});

test("Authentication routes limit repeated requests from one IP", async () => {
  const ip = "198.51.100.10";
  for (let i = 0; i < 30; i++) {
    assert.equal((await request("/login", {}, { ip })).status, 400);
  }
  assert.equal((await request("/login", {}, { ip })).status, 429);
  const resetIp = "198.51.100.11";
  for (let i = 0; i < 10; i++) {
    assert.equal((await request("/forgot-password", { email: "missing@guc.edu.eg" }, { ip: resetIp })).status, 200);
  }
  assert.equal((await request("/forgot-password", { email: "missing@guc.edu.eg" }, { ip: resetIp })).status, 429);
});

test("The demo-account endpoint is disabled by default", async () => {
  assert.equal((await request("/seed-demo", {})).status, 404);
  assert.equal(await User.countDocuments(), 0);
});

test("Requirement 3: all five roles can log out, invalidating existing tokens", async (t) => {
  for (const role of USER_ROLES) {
    await t.test(role, async () => {
      const user = await createUser(role);
      const first = await request("/login", { email: user.email, password });
      const second = await request("/login", { email: user.email, password });
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal((await request("/me", undefined, { token: first.body.token })).status, 200);
      const loggedOut = await request("/logout", {}, { token: first.body.token });
      assert.equal(loggedOut.status, 200);
      assert.equal((await User.findById(user._id)).authVersion, 1);
      assert.equal((await request("/me", undefined, { token: first.body.token })).status, 401);
      assert.equal((await request("/me", undefined, { token: second.body.token })).status, 401);
      assert.equal((await request("/logout", {}, { token: first.body.token })).status, 401);

      const fresh = await request("/login", { email: user.email, password });
      assert.equal(fresh.status, 200);
      assert.equal((await request("/me", undefined, { token: fresh.body.token })).status, 200);
    });
  }
});

test("Requirement 3: logout cannot invalidate another user's sessions", async () => {
  const user = await createUser("advisor");
  const other = await createUser("coordinator");
  const currentLogin = await request("/login", { email: user.email, password });
  const otherLogin = await request("/login", { email: other.email, password });
  assert.equal((await request("/logout", { userId: other._id.toString() }, { token: currentLogin.body.token })).status, 200);
  assert.equal((await User.findById(other._id)).authVersion, 0);
  assert.equal((await request("/me", undefined, { token: otherLogin.body.token })).status, 200);
});

test("Requirement 3: missing, invalid, expired and malformed-identity tokens cannot log out", async () => {
  const user = await createUser();
  const expired = jwt.sign({ id: user._id.toString(), authVersion: 0 }, JWT_SECRET, { expiresIn: "-1s" });
  const malformed = jwt.sign({ id: "not-an-object-id", authVersion: 0 }, JWT_SECRET);
  for (const token of [undefined, "invalid-token", expired, malformed]) {
    assert.equal((await request("/logout", {}, { token })).status, 401);
  }
  assert.equal((await User.findById(user._id)).authVersion, 0);
});

test("Requirement 3: inactive accounts are blocked even with a previously valid token", async () => {
  const user = await createUser();
  const loggedIn = await request("/login", { email: user.email, password });
  await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
  assert.equal((await request("/logout", {}, { token: loggedIn.body.token })).status, 401);
  assert.equal((await request("/me", undefined, { token: loggedIn.body.token })).status, 401);
});
