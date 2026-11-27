import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SMTPServer } from "smtp-server";
import api from "../../apps/api/src/app.js";
import { FinancialTransaction } from "../../apps/api/src/models/finance.js";
import { ScheduleTemplate } from "../../apps/api/src/models/academics.js";
import { AcademicTerm, Course, CourseOffering } from "../../apps/api/src/models/catalogue.js";
import { Notification } from "../../apps/api/src/models/communications.js";
import { StudentProfile, User } from "../../apps/api/src/models/identity.js";

let database, server, smtp, baseURL, regressionStudent;
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
  regressionStudent = await StudentProfile.create({
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
  const student = page.getByRole("button", { name: /28-90001.*Regression Student/i });
  await expect(student).toBeVisible();
  const filterSemester = async (semester) => {
    await page.getByRole("button", { name: /^Filters\b/i }).click();
    await page.getByRole("combobox", { name: /semester/i }).selectOption(semester);
    await page.getByRole("button", { name: "Apply filters" }).click();
  };
  await filterSemester("4");
  await expect(page.getByRole("heading", { name: "No students to show" })).toBeVisible();
  await filterSemester("5");
  await expect(student).toBeVisible();
  const search = page.getByLabel("Search students");
  await search.fill("does-not-exist");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "No students to show" })).toBeVisible();
  await search.fill("28-90001");
  await search.press("Enter");
  await student.click();
  const details = page.getByRole("dialog", { name: "Student details" });
  await expect(details).toContainText(email);
  await details.getByRole("button", { name: "Deactivate account" }).click();
  await expect(details.getByRole("button", { name: "Activate account" })).toBeVisible();
  await details.getByRole("button", { name: "Activate account" }).click();
  await expect(details.getByRole("button", { name: "Deactivate account" })).toBeVisible();
});

test("Req 100 and 127: the Portal ledger and downloaded CSV use the same date and settlement filters", async ({ page }) => {
  await FinancialTransaction.create([
    { student: regressionStudent._id, settlementOption: "wallet", transactionReference: "AUDIT-MATCH", occurredAt: "2025-09-15T12:00:00Z" },
    { student: regressionStudent._id, settlementOption: "gateway", transactionReference: "AUDIT-OTHER-METHOD", occurredAt: "2025-09-15T12:00:00Z" },
    { student: regressionStudent._id, settlementOption: "wallet", transactionReference: "AUDIT-OTHER-DATE", occurredAt: "2025-09-16T12:00:00Z" },
  ].map(record => ({ kind: "extra_hours", status: "succeeded", amount: 800, ...record })));

  await page.goto(baseURL);
  await signIn(page, "regression@guc.edu.eg", password);
  await page.getByRole("link", { name: "Financial records", exact: true }).click();
  const matching = page.getByRole("row", { name: /AUDIT-MATCH/ });
  const otherMethod = page.getByRole("row", { name: /AUDIT-OTHER-METHOD/ });
  const otherDate = page.getByRole("row", { name: /AUDIT-OTHER-DATE/ });
  await expect(matching).toBeVisible();
  await expect(otherMethod).toBeVisible();
  await expect(otherDate).toBeVisible();
  await page.getByRole("combobox", { name: /settlement option/i }).selectOption("wallet");
  await page.getByLabel("From date").fill("2025-09-15");
  await page.getByLabel("To date").fill("2025-09-15");

  await expect(matching).toBeVisible();
  await expect(otherMethod).toHaveCount(0);
  await expect(otherDate).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /export/i }).click();
  const download = await downloading;
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("AUDIT-MATCH");
  expect(csv).not.toContain("AUDIT-OTHER-METHOD");
  expect(csv).not.toContain("AUDIT-OTHER-DATE");
});

test("Req 15: My advisor uses the illustrated page for navigation, bookmarks, and reload", async ({ page }) => {
  const passwordHash = await bcrypt.hash(password, 4);
  const [advisor, student] = await User.create([
    { fullName: "Dr. Regression Advisor", role: "advisor", email: "actual.advisor@guc.edu.eg", passwordHash },
    { fullName: "Advisor Regression Student", role: "advisingStudent", email: "advisor.regression@student.guc.edu.eg", passwordHash },
  ]);
  const profile = await StudentProfile.create({
    user: student._id, studentId: "28-90055", studentType: "advising", advisingReason: "failedCourses",
    major: "CS", currentSemester: 5, gpa: 2, academicStanding: "goodAcademicStanding", assignedAdvisor: advisor._id,
  });
  const main = page.getByRole("main");
  async function expectIllustratedAdvisor() {
    await expect(page).toHaveURL(/[?&]page=my-advisor(?:&|$)/);
    await expect(main.getByRole("heading", { name: advisor.fullName, exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: advisor.email })).toHaveAttribute("href", `mailto:${advisor.email}`);
    await expect(main.locator(".advisor-callout .student-desk-art")).toBeVisible();
    await expect(main.locator("[data-portal-service]")).toHaveCount(0);
  }

  await page.goto(baseURL);
  await signIn(page, student.email, password);
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "My advisor" }).click();
  await expectIllustratedAdvisor();
  await page.reload();
  await expectIllustratedAdvisor();
  for (const bookmark of ["/portal-studio/index.html?page=advisor-assignment", "/workspace.html?screen=my-advisor", "/portal-studio/index.html?page=my-advisor&role=coordinator"]) {
    await page.goto(baseURL + bookmark);
    await expectIllustratedAdvisor();
  }

  await StudentProfile.updateOne({ _id: profile._id }, { $unset: { assignedAdvisor: 1 } });
  await page.reload();
  await expect(main.getByRole("status")).toHaveText(/don’t have an assigned advisor/);
  await expect(main.getByRole("link", { name: advisor.email })).toHaveCount(0);
  await expect(main.locator(".advisor-callout .student-desk-art")).toBeVisible();

  await page.route("**/api/advisor/my-advisor", route => route.fulfill({ status: 503, json: {} }));
  await page.reload();
  await expect(main.getByRole("alert")).toHaveText(/could not load your advisor/i);
  await expect(main.locator(".advisor-callout .student-desk-art")).toBeVisible();

  await FinancialTransaction.create({ student: profile._id, kind: "walletTopUp", status: "succeeded", amount: 1234.56 });
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Academic records" }).click();
  await page.getByRole("tab", { name: "Wallet" }).click();
  await expect(main).toContainText("1,234.56");
  await page.goto(baseURL + "/workspace.html?screen=records");
  await expect(page).toHaveURL(/[?&]page=records(?:&|$)/);
  await page.getByRole("tab", { name: "Wallet" }).click();
  await expect(main).toContainText("1,234.56");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Extra-hours requests" }).click();
  await expect(main.getByRole("heading", { name: "No extra-hours requests" })).toBeVisible();
  await expect(main.getByRole("button", { name: /sample requests/i })).toHaveCount(0);
});

test("retired Portal paths cannot serve design studies or alternate workflow screens", async ({ page, request }) => {
  for (const path of ["/feedback-studies.html", "/portal-studio/logo-study.html", "/portal-studio/variants/01-front-desk/logos/comparison.html"]) {
    expect((await request.get(baseURL + path)).status()).toBe(404);
  }

  await page.goto(baseURL);
  await signIn(page, "regression@guc.edu.eg", password);
  const calendar = page.getByRole("region", { name: "Academic calendar" });
  await expect(calendar).toBeVisible();
  const firstMonth = await calendar.locator(".folio-month .sr-only").first().textContent();
  await calendar.getByRole("button", { name: "Next month" }).click();
  await expect(calendar.locator(".folio-paper:not(.binder-waiting-sheet) .folio-month .sr-only")).not.toHaveText(firstMonth);

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Course catalogue", exact: true }).click();
  const file = {
    name: "portal-audit.csv", mimeType: "text/csv",
    buffer: Buffer.from("Course Code,Course Name,Credit Hours,Course Type,Faculty/Major,Recommended Semester,Offering Season,Prerequisites\nAUD910,Live Audit Course,3,core,CS,5,winter,"),
  };
  await page.getByLabel("CSV file").setInputFiles(file);
  await page.getByRole("button", { name: "Validate and import" }).click();
  await expect(page.getByRole("button", { name: /AUD910.*Live Audit Course/ })).toBeVisible();
  await page.goto(baseURL + "/portal-studio/index.html?page=manage-courses");
  await expect(page).toHaveURL(/[?&]page=courses(?:&|$)/);
  await expect(page.getByRole("button", { name: /AUD910.*Live Audit Course/ })).toBeVisible();

  await nav.getByRole("link", { name: "Academic terms", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Academic terms", exact: true })).toBeVisible();
  await page.goto(baseURL + "/portal-studio/index.html?page=student-detail&student=0");
  await expect(page).toHaveURL(/[?&]page=directory(?:&|$)/);
  await expect(page.getByRole("heading", { name: "Student directory", exact: true })).toBeVisible();
});

test("Req 29: the old template bookmark opens the live editor and saves to the database", async ({ page }) => {
  const coordinator = await User.create({
    fullName: "Template Coordinator", role: "coordinator", email: "template.coordinator@guc.edu.eg",
    passwordHash: await bcrypt.hash(password, 4),
  });
  const term = await AcademicTerm.create({
    code: "AUD27", academicYear: "2026/2027", season: "spring",
    termStart: "2027-03-01", termEnd: "2027-08-01", teachingStart: "2027-03-07", teachingEnd: "2027-07-01",
    registrationStart: "2027-02-01", registrationEnd: "2027-03-07",
    advisingDeadline: "2027-03-10", wholeScheduleSwapDeadline: "2027-03-20",
  });
  const course = await Course.create({ code: "CSEN992", name: "Template Audit Course", creditHours: 3, courseType: "core" });
  const offering = await CourseOffering.create({
    course: course._id, term: term._id, isPublished: true, instructors: [{ fullName: "Dr. Audit" }],
    eligibleGroups: [{ major: "CS", semester: 5 }],
    slots: [{ componentType: "lecture", groupNumber: "1", day: "Monday", room: "R1", startMinute: 540, endMinute: 600, capacity: 20 }],
  });
  const template = await ScheduleTemplate.create({
    term: term._id, major: "CS", semester: 5, studyGroup: "1",
    courses: [{ course: course._id, courseOffering: offering._id, slots: [
      { componentType: "lecture", courseOffering: offering._id, slotGroupId: offering.slots[0]._id },
    ] }],
  });
  await page.goto(baseURL + "/portal-studio/index.html?page=template-detail&group=1");
  await signIn(page, coordinator.email, password);
  await expect(page).toHaveURL(/[?&]page=templates(?:&|$)/);
  await page.getByRole("combobox", { name: /academic term/i }).selectOption(term.code);
  await page.getByRole("button", { name: "Load templates and offerings" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Update schedule template" })).toBeVisible();
  await page.getByLabel("Study group").fill("2");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText("Semester 5 · Group 2", { exact: true })).toBeVisible();
  expect((await ScheduleTemplate.findById(template._id)).studyGroup).toBe("2");
});
