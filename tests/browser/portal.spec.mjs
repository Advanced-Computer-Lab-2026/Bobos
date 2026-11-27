import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SMTPServer } from "smtp-server";
import api from "../../apps/api/src/app.js";
import { Notification } from "../../apps/api/src/models/communications.js";
import { StudentProfile, User } from "../../apps/api/src/models/identity.js";

let database, server, smtp, baseURL;
const messages = [];
const email = "regression@student.guc.edu.eg";
const password = "RegressionOnly123!";
const nextPassword = "RegressionChanged456!";

test.beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  const passwordHash = await bcrypt.hash(password, 4);
  const [student, administrator] = await User.create([
    { fullName: "Regression Student", role: "normalStudent", email, passwordHash },
    { fullName: "Regression Administrator", role: "administrator", email: "regression@guc.edu.eg", passwordHash },
  ]);
  await StudentProfile.create({
    user: student._id, studentId: "28-90001", studentType: "normal", major: "CS",
    currentSemester: 5, gpa: 2, academicStanding: "goodAcademicStanding",
  });
  await Notification.create([
    { recipient: student._id, type: "scheduleProcessed", title: "Regression timetable", message: "Your schedule is available." },
    { recipient: administrator._id, type: "scheduleProcessed", title: "Private administrator notice", message: "This belongs to a different user." },
  ]);
  smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    disableReverseLookup: true,
    onData(stream, session, callback) {
      const chunks = [];
      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => {
        messages.push({ to: session.envelope.rcptTo[0].address, text: Buffer.concat(chunks).toString() });
        callback();
      });
    },
  });
  await new Promise((resolve, reject) => {
    smtp.once("error", reject);
    smtp.listen(0, "127.0.0.1", resolve);
  });
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtp.server.address().port),
    SMTP_FROM: "regression@guc.edu.eg",
    SMTP_REQUIRE_TLS: "false",
    SMTP_SECURE: "false",
  });
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  const app = express();
  app.use(api);
  app.use(express.static(fileURLToPath(new URL("../../apps/web/dist", import.meta.url))));
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (smtp) await new Promise(resolve => smtp.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});

async function signIn(page, account, pass) {
  await page.getByLabel("University email").fill(account);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: /continue/i }).click();
}

test("Req 1–5: reset through email, view your profile and inbox, and sign out", async ({ page }) => {
  await page.goto(baseURL);
  await page.getByRole("link", { name: /forgot password/i }).click();
  await page.getByLabel("University email").fill(email);
  await page.getByRole("button", { name: /send reset code/i }).click();
  await expect(page.getByRole("heading", { name: /choose a new password/i })).toBeVisible();
  const message = messages.find(entry => entry.to === email);
  const code = message?.text.match(/code is (\d{6})/)?.[1];
  expect(code).toBeTruthy();
  await page.getByLabel("University email").fill(email);
  await page.getByLabel("Reset code").fill(code);
  await page.getByLabel("New password", { exact: true }).fill(nextPassword);
  await page.getByLabel("Confirm new password").fill(nextPassword);
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page.getByRole("status").filter({ hasText: /password reset successfully/i })).toBeVisible();
  await signIn(page, email, nextPassword);
  await expect(page.getByRole("button", { name: /account menu for regression student/i })).toBeVisible();
  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await expect(page.getByRole("main")).toContainText(email);
  await expect(page.getByRole("main")).toContainText("28-90001");
  await page.getByRole("link", { name: "Notifications", exact: true }).click();
  const notice = page.getByRole("article").filter({ hasText: "Regression timetable" });
  await expect(notice).toBeVisible();
  await expect(page.getByText("Private administrator notice")).toHaveCount(0);
  await notice.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(notice.getByText("Read", { exact: true })).toBeVisible();
  await page.reload();
  await expect(notice.getByText("Read", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
});

test("Req 6–10: student directory finds the matching profile and changes the account status", async ({ page }) => {
  await page.goto(baseURL);
  await signIn(page, "regression@guc.edu.eg", password);
  await page.getByRole("link", { name: "Student directory" }).click();
  await expect(page.getByRole("heading", { name: "Student directory" })).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByLabel("Semester", { exact: true }).selectOption("5");
  await page.getByRole("button", { name: "Apply filters" }).click();
  const search = page.getByLabel("Search students");
  await search.fill("does-not-exist");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "No students to show" })).toBeVisible();
  await search.fill("28-90001");
  await search.press("Enter");
  await page.getByRole("button", { name: /28-90001.*Regression Student/i }).click();
  const details = page.getByRole("dialog", { name: "Student details" });
  await expect(details).toContainText(email);
  await details.getByRole("button", { name: "Deactivate account" }).click();
  await expect(details.getByRole("button", { name: "Activate account" })).toBeVisible();
  await details.getByRole("button", { name: "Activate account" }).click();
  await expect(details.getByRole("button", { name: "Deactivate account" })).toBeVisible();
});
