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
import { FinancialReversalRequest, FinancialTransaction } from "../../apps/api/src/models/finance.js";
import { ScheduleTemplate, SchedulingPreference, StudentSchedule } from "../../apps/api/src/models/academics.js";
import { AcademicTerm, Course, CourseOffering } from "../../apps/api/src/models/catalogue.js";
import { Notification, ScheduleActivity } from "../../apps/api/src/models/communications.js";
import { StudentProfile, User } from "../../apps/api/src/models/identity.js";
import { ExtraHoursRequest, MandatoryCourseRemovalRequest } from "../../apps/api/src/models/requests.js";

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
    { recipient: student._id, type: "scheduleReopened", title: "Regression schedule review", message: "Review the latest changes." },
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
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByText("Overview", { exact: true })).toHaveCount(0);
  await expect(page.locator(".student-inbox .notification-plate")).toHaveCount(0);
  const homeInbox = page.getByRole("region", { name: /Notifications/ });
  const timetable = homeInbox.locator("details").filter({ hasText: "Regression timetable" });
  await expect(homeInbox.locator("details")).toHaveCount(2);
  await expect(timetable.getByText("Your schedule is available.")).toBeHidden();
  await timetable.locator("summary").press("Enter");
  await expect(timetable.getByText("Your schedule is available.")).toBeVisible();
  await expect(page.locator(".workspace")).toHaveCSS("overflow-y", "visible");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("link", { name: "My profile", exact: true }).click();
  await expect(page.getByRole("main")).toContainText(email);
  await expect(page.getByRole("main")).toContainText("28-90001");
  await page.reload();
  const bell = page.locator("[data-notification-bell]");
  await expect(bell).toHaveAccessibleName("Notifications, 2 unread");
  await bell.click();
  const notice = page.getByRole("article").filter({ hasText: "Regression timetable" });
  await expect(notice).toBeVisible();
  await expect(page.getByText("Private administrator notice")).toHaveCount(0);
  await notice.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(notice.getByText("Read", { exact: true })).toBeVisible();
  await expect(bell).toHaveAccessibleName("Notifications, 1 unread");
  await page.reload();
  await expect(notice.getByText("Read", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(bell).toHaveAccessibleName("Notifications");
  await expect(bell.locator(".notification-count")).toHaveCount(0);
  await navigation.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveTitle("Portal · Home");
  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
});

test("Staff inbox shows the linked student and preserves the portrait after marking a notice read", async ({ page }) => {
  const { passwordHash } = await User.findOne({ email: "regression@guc.edu.eg" }).select("+passwordHash");
  const coordinator = await User.create({ role: "coordinator", email: "notice.coordinator@guc.edu.eg", fullName: "Inbox Coordinator", passwordHash });
  const request = await MandatoryCourseRemovalRequest.create({
    student: regressionStudent._id, advisor: coordinator._id, course: new mongoose.Types.ObjectId(),
    term: new mongoose.Types.ObjectId(), reason: "other", explanation: "Already credited.",
  });
  await Notification.create({ recipient: coordinator._id, type: "advisingDeadlineReminder", title: "Term deadline", message: "Review the calendar." });
  await page.goto(baseURL + "/?page=notifications");
  await signIn(page, coordinator.email, password);
  const notice = page.getByRole("article").filter({ hasText: "Mandatory course removal requested" });
  await expect(notice.locator(".notice-person")).toContainText("Regression Student");
  await expect(notice.locator(":scope > .avatar")).toHaveText("RS");
  await expect(notice.locator(".notice-person small")).toHaveText("28-90001");
  await expect(notice.getByText(/has a request for you to review/)).toHaveCount(0);
  const deadline = page.getByRole("article").filter({ hasText: "Term deadline" });
  await expect(deadline.locator('.notice-symbol[data-kind="advisingDeadlineReminder"] svg')).toBeVisible();
  await expect(deadline.locator(".avatar")).toHaveCount(0);
  await expect(page.getByText("Private administrator notice")).toHaveCount(0);
  await notice.getByRole("button", { name: "Mark as read" }).click();
  await expect(notice.getByText("Read", { exact: true })).toBeVisible();
  await expect(notice.locator(".notice-person")).toContainText("Regression Student");
  await expect(notice.locator(":scope > .avatar")).toHaveText("RS");
  await page.getByRole("tab", { name: /unread/i }).click();
  await expect(notice).toHaveCount(0);
  expect((await Notification.findOne({ recipient: coordinator._id, relatedId: String(request._id) })).readAt).toBeTruthy();
});

test("Req 6–10: student directory finds the matching profile and changes the account status", async ({ page }) => {
  await page.goto(baseURL);
  await signIn(page, "regression@guc.edu.eg", password);
  await page.getByRole("link", { name: "Student directory" }).click();
  await expect(page.getByRole("heading", { name: "Student directory" })).toBeVisible();
  const student = page.getByRole("button", { name: /^Open profile for 28-90001\b/i });
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
  await expect(details.getByText("28-90001", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: /^Filters\b/i }).click();
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
  await expect(main.getByRole("heading", { name: "Academic history" })).toBeVisible();
  await page.getByRole("tab", { name: "Transcript" }).click();
  await expect(main.getByText(/Yearly transcripts appear after an academic year has course attempts/)).toBeVisible();
  await expect(main.getByRole("button", { name: "Download PDF" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  const importer = page.getByRole("dialog", { name: "Import courses from CSV" });
  await expect(importer.getByRole("link", { name: "Download template" })).toBeVisible();
  await importer.getByLabel("CSV file").setInputFiles({
    ...file, buffer: Buffer.from(file.buffer.toString().replace(",3,core,", ",invalid,core,")),
  });
  await importer.getByRole("button", { name: "Validate and import" }).click();
  await expect(importer.getByRole("alert")).toBeVisible();
  await importer.getByLabel("CSV file").setInputFiles(file);
  await importer.getByRole("button", { name: "Validate and import" }).click();
  await expect(importer).toHaveCount(0);
  await expect(page.getByRole("button", { name: /AUD910.*Live Audit Course/ })).toBeVisible();
  await page.goto(baseURL + "/portal-studio/index.html?page=manage-courses");
  await expect(page).toHaveURL(/[?&]page=courses(?:&|$)/);
  await expect(page.getByRole("button", { name: /AUD910.*Live Audit Course/ })).toBeVisible();

  await nav.getByRole("link", { name: "Academic terms", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Academic terms", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create term", exact: true }).click();
  const termEditor = page.getByRole("dialog", { name: "Create academic term" });
  try {
    await termEditor.getByLabel("Academic year").fill("2041/2042");
    await termEditor.getByLabel("Season").selectOption("winter");
    for (const [label, date] of [
      ["Term start", "2041-09-01"], ["Term end", "2042-01-31"],
      ["Teaching start", "2041-09-10"], ["Teaching end", "2042-01-15"],
      ["Registration start", "2041-08-15"], ["Registration end", "2041-08-31"],
      ["Advising deadline", "2041-09-15"], ["Whole schedule swap deadline", "2041-09-20"],
    ]) await termEditor.getByLabel(new RegExp(`^${label}$`, "i")).fill(date);
    await termEditor.getByRole("button", { name: "Create term" }).click();
    await expect(termEditor).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Dates and deadlines" })).toBeVisible();
    await expect(page.getByText("Inactive term", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Edit term", exact: true }).click();
    const editTerm = page.getByRole("dialog", { name: "Edit academic term" });
    await expect(editTerm.getByLabel("Academic year")).toHaveValue("2041/2042");
    await editTerm.getByLabel("Advising deadline").fill("2041-09-16");
    await editTerm.getByRole("button", { name: "Update term" }).click();
    await expect(editTerm).toHaveCount(0);
    expect((await AcademicTerm.findOne({ code: "winter-20412042" })).advisingDeadline.toISOString()).toContain("2041-09-16");
  } finally {
    await AcademicTerm.deleteOne({ code: "winter-20412042" });
  }
  await page.goto(baseURL + "/portal-studio/index.html?page=student-detail&student=0");
  await expect(page).toHaveURL(/[?&]page=directory(?:&|$)/);
  await expect(page.getByRole("heading", { name: "Student directory", exact: true })).toBeVisible();
});

test("Req 29: the old template bookmark opens the live editor and saves to the database", async ({ page }) => {
  const coordinator = await User.create({
    fullName: "Template Coordinator", role: "coordinator", email: "template.coordinator@guc.edu.eg",
    passwordHash: await bcrypt.hash(password, 4),
  });
  const historicalTerm = await AcademicTerm.create({
    code: "AUD27", academicYear: "2026/2027", season: "spring",
    termStart: "2027-03-01", termEnd: "2027-08-01", teachingStart: "2027-03-07", teachingEnd: "2027-07-01",
    registrationStart: "2027-02-01", registrationEnd: "2027-03-07",
    advisingDeadline: "2027-03-10", wholeScheduleSwapDeadline: "2027-03-20",
  });
  const term = await auditTerm();
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
  const termSelect = page.getByRole("combobox", { name: /academic term/i });
  const empty = page.getByRole("heading", { name: "No schedule templates" });
  await termSelect.selectOption(historicalTerm.code);
  await expect(empty).toBeVisible();
  await mainNavigation(page).getByRole("link", { name: "Academic terms", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Academic terms", exact: true })).toBeVisible();
  await page.evaluate(termCode => localStorage.setItem("bobos.lastTermId", termCode), historicalTerm.code);
  await mainNavigation(page).getByRole("link", { name: "Schedule templates", exact: true }).click();
  await expect(termSelect).toHaveValue(term.code);
  const drafts = page.getByRole("region", { name: "Drafts", exact: true });
  await expect(drafts.getByRole("button", { name: "Group 1 CS · Semester 5", pressed: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Courses for Group 1" })).toContainText(course.name);
  await drafts.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Update schedule template" })).toBeVisible();
  await page.getByLabel("Study group").fill("2");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(drafts.getByRole("button", { name: "Group 2 CS · Semester 5", pressed: true })).toBeVisible();
  expect((await ScheduleTemplate.findById(template._id)).studyGroup).toBe("2");
  await drafts.getByRole("button", { name: "Publish template", exact: true }).click();
  const published = page.getByRole("region", { name: "Published", exact: true });
  await published.getByRole("button", { name: "Unpublish template" }).click();
  await drafts.getByRole("button", { name: /delete template for CS/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete template", exact: true }).click();
  await expect(empty).toBeVisible();
  expect(await ScheduleTemplate.exists({ _id: template._id })).toBeNull();
});

async function auditTerm() {
  return AcademicTerm.findOne({ code: "AUD31" }).then(existing => existing || AcademicTerm.create({
    code: "AUD31", academicYear: "2030/2031", season: "winter", isActive: true,
    termStart: "2030-09-01", termEnd: "2031-03-01", teachingStart: "2030-09-07", teachingEnd: "2031-02-01",
    registrationStart: "2030-08-20", registrationEnd: "2030-09-07", advisingDeadline: "2030-09-12", wholeScheduleSwapDeadline: "2030-09-18",
  }));
}

async function auditAdvisingStudent({ email, fullName, studentId, assignedAdvisor, passwordHash }) {
  const user = await User.create({ fullName, email, role: "advisingStudent", passwordHash });
  return StudentProfile.create({
    user: user._id, studentId, studentType: "advising", major: "CS", currentSemester: 5,
    gpa: 2.3, academicStanding: "goodAcademicStanding", advisingReason: "failedCourses", assignedAdvisor,
  });
}

function mainNavigation(page) {
  return page.getByRole("navigation", { name: "Main navigation" });
}

test("Req 31, 33, 81–82: student meeting details and read-only Administrator access", async ({ page }) => {
  const term = await auditTerm();
  const passwordHash = await bcrypt.hash(password, 4);
  const studentEmail = "schedule.audit@student.guc.edu.eg";
  const student = await auditAdvisingStudent({ email: studentEmail, fullName: "Timetable Audit Student", studentId: "46-00131", passwordHash });
  const admin = await User.findOne({ role: "administrator" });
  const course = await Course.create({ code: "CSEN931", name: "Timetable Audit Course", creditHours: 3, courseType: "core" });
  const offering = await CourseOffering.create({
    course: course._id, term: term._id, isPublished: true, instructors: [{ fullName: "Audit Instructor" }],
    eligibleGroups: [{ major: "CS", semester: 5 }],
    slots: [
      { componentType: "lecture", groupNumber: "L21", day: "Friday", room: "Hall 21", startMinute: 570, endMinute: 645, capacity: 20 },
      { componentType: "tutorial", groupNumber: "T11", day: "Wednesday", room: "Hall 22", startMinute: 700, endMinute: 780, capacity: 20 },
      { componentType: "lab", groupNumber: "B19", day: "Sunday", room: "Lab 19", startMinute: 800, endMinute: 860, capacity: 20 },
    ],
  });
  await StudentSchedule.create({
    student: student._id, term: term._id, scheduleType: "advising", status: "processed", createdBy: admin._id,
    courses: [{ course: course._id, courseOffering: offering._id, creditHoursSnapshot: 3,
      slots: offering.slots.map(slot => ({ componentType: slot.componentType, courseOffering: offering._id, slotGroupId: slot._id })) }],
  });
  await page.goto(baseURL);
  await signIn(page, studentEmail, password);
  await mainNavigation(page).getByRole("link", { name: "My schedule", exact: true }).click();
  await expect(page.getByRole("region", { name: "Friday", exact: true })).toContainText("09:30–10:45");
  await mainNavigation(page).getByRole("link", { name: "Registered courses", exact: true }).click();
  await page.getByRole("link", { name: "View sections" }).click();
  const sections = page.getByRole("region", { name: "Your sections" });
  for (const group of ["L21", "T11", "B19"]) await expect(sections).toContainText(`Group ${group}`);
  await expect(sections).toContainText("09:30–10:45");

  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, admin.email, password);
  await mainNavigation(page).getByRole("link", { name: "Student schedules", exact: true }).click();
  const row = page.getByRole("row", { name: /46-00131/ });
  await expect(row).toBeVisible();
  await expect(page.locator(".schedule-register").getByRole("row", { name: /46-00131/ })).toBeVisible();
  const moreActions = row.getByRole("button", { name: /More actions/ });
  await moreActions.click();
  await expect(row.getByRole("button", { name: "Advising overview" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(row.getByRole("button", { name: /manage|process|reopen/i })).toHaveCount(0);
  const view = row.getByRole("button", { name: "View schedule", exact: true });
  await view.click();
  const scheduleDialog = page.getByRole("dialog", { name: /schedule$/ });
  await expect(scheduleDialog).toContainText("09:30–10:45");
  await page.keyboard.press("Escape");
  await expect(scheduleDialog).toHaveCount(0);
  await expect(view).toBeFocused();
});

test("Req 50, 52: browse beyond the first 20 students and filter by real payment status", async ({ page }) => {
  const term = await auditTerm();
  const passwordHash = await bcrypt.hash(password, 4);
  const advisor = await User.create({ fullName: "Roster Advisor", role: "advisor", email: "roster.audit@guc.edu.eg", passwordHash, isAdvisorInSystem: true });
  const profiles = await Promise.all(Array.from({ length: 21 }, (_, index) => auditAdvisingStudent({
    email: `roster${index}@student.guc.edu.eg`, fullName: `Roster Student ${index + 1}`,
    studentId: `47-${String(index + 1).padStart(5, "0")}`, assignedAdvisor: advisor._id, passwordHash,
  })));
  await StudentProfile.updateOne({ _id: profiles[20]._id }, { major: "undeclared" });
  const course = await Course.create({ code: "CSEN952", name: "Roster Audit Course", creditHours: 3, courseType: "core" });
  await ExtraHoursRequest.create({
    student: profiles[20]._id, advisor: advisor._id, term: term._id,
    courses: [{ course: course._id, hours: 3, isRepeated: false, pricePerHour: 800, subtotal: 2400 }],
    requestedHours: 3, totalCost: 2400, decisionStatus: "approved", settlementStatus: "awaitingChoice",
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 33, isProbation: false, graduatingWithinOneYear: false },
  });
  await page.goto(baseURL);
  await signIn(page, advisor.email, password);
  await mainNavigation(page).getByRole("link", { name: "Advising students", exact: true }).click();
  const rosterPages = page.getByRole("navigation", { name: "Advising students pages" });
  await expect(rosterPages).toContainText(/^1–20 of/);
  const finalStudent = page.getByRole("row", { name: /47-00021/ });
  await expect(finalStudent).toHaveCount(0);
  await rosterPages.getByRole("button", { name: "Next", exact: true }).click();
  await expect(finalStudent).toBeVisible();
  await expect(rosterPages).toContainText(/^21–/);
  await page.getByRole("button", { name: /^Filters\b/i }).click();
  await page.getByRole("combobox", { name: "Schedule status" }).selectOption("awaitingPaymentChoice");
  await page.getByRole("combobox", { name: "Major", exact: true }).selectOption("undeclared");
  await expect(page.getByText("1 student", { exact: true })).toBeVisible();
  await expect(finalStudent).toContainText(/awaiting payment choice/i);
  await expect(rosterPages.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
});

test("Req 92, 94, 102, 120: confirm, download and cancel an installment charge through the Portal", async ({ page }) => {
  const term = await auditTerm();
  const passwordHash = await bcrypt.hash(password, 4);
  const [advisor, coordinator] = await User.create([
    { fullName: "Reversal Advisor", role: "advisor", email: "reversal.advisor@guc.edu.eg", passwordHash },
    { fullName: "Reversal Coordinator", role: "coordinator", email: "reversal.coordinator@guc.edu.eg", passwordHash },
  ]);
  const studentEmail = "reversal.audit@student.guc.edu.eg";
  const student = await auditAdvisingStudent({
    email: studentEmail, fullName: "Reversal Student", studentId: "46-00102", passwordHash, assignedAdvisor: advisor._id,
  });
  const course = await Course.create({ code: "CSEN902", name: "Reversal Audit Course", creditHours: 3, courseType: "core" });
  const request = await ExtraHoursRequest.create({
    student: student._id, advisor: advisor._id, term: term._id,
    courses: [{ course: course._id, hours: 3, isRepeated: false, pricePerHour: 800, subtotal: 2400 }],
    requestedHours: 3, totalCost: 2400, decisionStatus: "approved", settlementStatus: "awaitingChoice",
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 33, isProbation: false, graduatingWithinOneYear: false },
  });
  await page.goto(baseURL);
  await signIn(page, studentEmail, password);
  await mainNavigation(page).getByRole("link", { name: "Extra-hours requests", exact: true }).click();
  await page.getByRole("button", { name: "Add to next installment", exact: true }).click();
  const history = page.getByRole("region", { name: "Payments and deferred charges" });
  await expect(history).toContainText(/Installment INST-/);
  const charge = await FinancialTransaction.findOne({ extraHoursRequest: request._id, kind: "deferredCharge" });
  expect(charge.installmentId).toBeTruthy();
  const installmentRef = `INST-${charge.installmentId}`;
  await expect(history).toContainText(installmentRef);
  const downloading = page.waitForEvent("download");
  await history.getByRole("button", { name: "Download PDF" }).click();
  expect((await downloading).suggestedFilename()).toMatch(/^deferred-payment-confirmation/);

  await page.getByRole("button", { name: /account/i }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, coordinator.email, password);
  await mainNavigation(page).getByRole("link", { name: "Financial records", exact: true }).click();
  const row = page.getByRole("row", { name: new RegExp(charge.deferredChargeReference) })
    .filter({ has: page.getByRole("button", { name: /^View$/ }) });
  await row.getByRole("button", { name: "View", exact: true }).click();
  const details = page.getByRole("dialog");
  await expect(details).toContainText(installmentRef);
  await details.getByRole("button", { name: "Close", exact: true }).last().click();
  await row.getByRole("button", { name: "Request cancellation" }).click();
  let dialog = page.getByRole("dialog", { name: "Request charge cancellation" });
  await dialog.getByLabel(/reason/i).fill("Course no longer needed");
  await dialog.getByRole("button", { name: "Submit request" }).click();
  await row.getByRole("button", { name: "Cancel charge" }).click();
  dialog = page.getByRole("dialog", { name: "Cancel deferred charge" });
  await expect(dialog.getByLabel(/reason/i)).toHaveValue("Course no longer needed");
  await dialog.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect.poll(async () => (await FinancialTransaction.findById(charge._id)).status).toBe("cancelled");
  const reversal = await FinancialReversalRequest.findOne({ originalTransaction: charge._id });
  expect(reversal.status).toBe("completed");
  await expect(row.getByRole("button", { name: "Cancel charge" })).toHaveCount(0);
  await page.getByRole("link", { name: /^Notifications(?:, \d+ unread)?$/ }).click();
  await expect(page.getByRole("main")).toContainText("Financial reversal requested");
});

test("Coordinator schedule folders open the selected student and term across reloads", async ({ page }) => {
  const term = await auditTerm();
  const passwordHash = await bcrypt.hash(password, 4);
  const coordinator = await User.create({ role: "coordinator", email: "folders.coordinator@guc.edu.eg", fullName: "Folder Coordinator", passwordHash });
  const student = await auditAdvisingStudent({ fullName: "Folder Student", email: "folders.student@student.guc.edu.eg", studentId: "45-00019", passwordHash });
  await StudentSchedule.create({ student: student._id, term: term._id, scheduleType: "advising", status: "draft", createdBy: coordinator._id });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    window.folderArrivals = [];
    document.addEventListener("animationstart", event => {
      if (event.animationName === "folder-shelve") {
        window.folderArrivals.push(event.target.closest(".draft-file").href);
      }
    });
  });
  // Hold the roster until the shell has finished loading its independent account data.
  let releaseRoster;
  const rosterGate = new Promise(resolve => { releaseRoster = resolve; });
  await page.route("**/api/schedules/students", async route => {
    const response = await route.fetch();
    await rosterGate;
    await route.fulfill({ response });
  });
  await page.goto(baseURL);
  await signIn(page, coordinator.email, password);
  await expect(page.locator("[data-sidebar-term]")).toHaveText("Winter 2030/2031");
  await expect(page.locator(".module-intro .workspace-term")).toHaveText("Winter 2030/2031");
  releaseRoster();
  const folder = page.getByRole("link", { name: /Folder Student.*Draft.*45-00019/ });
  await expect(folder).toBeVisible();
  const folderUrl = await folder.evaluate(element => element.href);
  await expect.poll(() => page.evaluate(() => window.folderArrivals)).toContain(folderUrl);
  await folder.click();
  expect(new URL(page.url()).searchParams.get("student")).toBe(String(student._id));
  expect(new URL(page.url()).searchParams.get("term")).toBe(term.code);
  await page.reload();
  await expect(page.getByText("Folder Student · 45-00019", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Back to students/ }).click();
  await expect(page.getByRole("heading", { name: "Student schedules", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("student")).toBe(false);
});

test("Catalogue editing preserves filtered prerequisites, seasons and legacy major lines", async ({ page }) => {
  const first = await Course.create({ code: "PRQ801", name: "First prerequisite", creditHours: 3, courseType: "core" });
  const second = await Course.create({ code: "PRQ802", name: "Second prerequisite", creditHours: 3, courseType: "core" });
  const course = await Course.create({
    code: "CAT803", name: "Course for catalogue editing", creditHours: 5, courseType: "core",
    facultyMajors: ["CS\\nDMET"], prerequisites: [first._id], offeringSeasons: ["winter"],
  });
  await page.goto(baseURL + "/portal-studio/index.html?page=courses");
  await signIn(page, "regression@guc.edu.eg", password);
  await page.getByRole("searchbox", {name:"Search courses"}).fill(course.code);
  await page.getByRole("button", {name:`View course ${course.code} · ${course.name}`}).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText(first.name);
  await sheet.getByRole("button", {name:"Edit course"}).click();
  await expect(page.getByLabel("Majors (one per line)")).toHaveValue("CS\nDMET");
  await page.getByRole("searchbox", {name:"Find a prerequisite"}).fill(second.code);
  const prerequisite = page.getByRole("checkbox", {name:/PRQ802/});
  await prerequisite.focus();
  await page.keyboard.press("Space");
  await sheet.getByRole("checkbox", {name:"Spring", exact:true}).check();
  await page.getByRole("button", {name:"Save changes"}).click();
  await expect(sheet).toHaveCount(0);
  const saved = await Course.findById(course._id);
  expect(saved.prerequisites.map(String)).toEqual([String(first._id), String(second._id)]);
  expect(saved.facultyMajors).toEqual(["CS", "DMET"]);
  expect(saved.offeringSeasons).toEqual(["winter", "spring"]);
  const deleteCourse = page.getByRole("button", { name: "Delete course CAT803" });
  await deleteCourse.click();
  await expect(sheet).toContainText(course.name);
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(deleteCourse).toBeFocused();
  const dependent = await Course.create({
    code: "CAT804", name: "Dependent course", creditHours: 4, courseType: "core", prerequisites: [course._id],
  });
  await deleteCourse.click();
  const confirm = sheet.getByRole("button", { name: "Delete course", exact: true });
  try {
    await confirm.click();
    await expect(sheet.getByRole("alert")).toContainText(/prerequisite/i);
    expect(await Course.exists({ _id: course._id })).toBeTruthy();
  } finally {
    await Course.deleteOne({ _id: dependent._id });
  }
  await confirm.click();
  await expect(sheet).toHaveCount(0);
  expect(await Course.findById(course._id)).toBeNull();
});

test("Coordinator can read ranked preferences, change term and review a removal request", async ({page, browser}) => {
  const passwordHash = await bcrypt.hash(password, 4);
  const [coordinator, advisor] = await User.create([
    {fullName:"Schedule Review Coordinator", email:"schedule.review@guc.edu.eg", role:"coordinator", passwordHash},
    {fullName:"Schedule Review Advisor", email:"schedule.advisor@guc.edu.eg", role:"advisor", passwordHash},
  ]);
  const student = await auditAdvisingStudent({fullName:"Schedule Review Student", email:"schedule.review@student.guc.edu.eg", studentId:"49-00805", assignedAdvisor:advisor._id, passwordHash});
  const term = await auditTerm();
  const alternate = await AcademicTerm.create({ ...term.toObject(), _id:new mongoose.Types.ObjectId(), code:"CATALT", season:"spring", isActive:false });
  const submission = await SchedulingPreference.create({student:student._id, term:term._id, preferredDays:[{day:"Thursday",priority:4},{day:"Monday",priority:1}], preferredTimes:[{startMinute:390,endMinute:465,priority:3}], note:"Please keep the morning lab."});
  const course = await Course.create({code:"CAT805", name:"Research Methods", creditHours:3, courseType:"core"});
  const removal = await MandatoryCourseRemovalRequest.create({student:student._id, advisor:advisor._id, term:term._id, course:course._id, reason:"other", explanation:"Review this requirement against the transfer record."});
  let releasePreferences;
  const preferencesReady = new Promise(resolve => { releasePreferences = resolve; });
  await page.route(`**/api/identity/students/${student._id}/preferences?*`, async route => {
    await preferencesReady;
    await route.continue();
  }, { times: 1 });
  await page.goto(baseURL + `/portal-studio/index.html?page=preferences&student=${student.studentId}&term=${term.code}`);
  await signIn(page, coordinator.email, password);
  try {
    await expect(page.getByRole("status", { name: "", exact: true }).filter({ hasText: "Loading saved preferences" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /find a student to review|choose an academic term|no preferences submitted/i })).toHaveCount(0);
  } finally {
    releasePreferences();
  }
  await expect(page.locator(".preference-reading")).toContainText("Please keep the morning lab.");
  await expect(page.locator(".preference-reading time")).toHaveAttribute("datetime", submission.updatedAt.toISOString());
  await page.getByRole("button", {name:"Change student",exact:true}).click();
  await expect(page.getByLabel("Find advising student")).toBeFocused();
  await page.getByLabel("Find advising student").fill(student.studentId);
  await page.getByRole("button", {name:"Find student"}).click();
  const selection = page.locator(".preference-student-selected");
  await expect(selection).toContainText(student.studentId);
  await expect(selection).toContainText("schedule.review@student.guc.edu.eg");
  await expect(selection.getByRole("button", {name:"Change student",exact:true})).toBeVisible();
  await page.getByLabel("Academic term").selectOption(String(term._id));
  await expect(page.locator(".preference-reading")).toContainText("Please keep the morning lab.");
  const rankedDays = page.getByRole("list", {name:"Preferred days, highest priority first"});
  await expect(rankedDays.getByRole("listitem")).toHaveText(["MondayPriority #1", "ThursdayPriority #4"]);
  const teachingTimes = page.getByRole("list", {name:"Preferred times, highest priority first"});
  await expect(teachingTimes).toContainText("06:30–07:45");
  await expect(teachingTimes.getByRole("listitem")).toContainText("Priority #3");
  await page.getByLabel("Academic term").selectOption(String(alternate._id));
  await expect(page.getByRole("heading", {name:"No preferences submitted"})).toBeVisible();
  await expect(page.locator(".preference-reading time")).toHaveCount(0);
  await page.getByRole("button", {name:"Create or update draft schedule"}).click();
  await expect(page.getByRole("heading", {name:"Advising draft schedule"})).toBeVisible();
  await expect(page.locator(".draft-summary")).toContainText("No draft exists for this term");
  await mainNavigation(page).getByRole("link", {name:"Schedule preferences"}).click();
  await expect(page.getByLabel("Find advising student")).toBeVisible();
  await mainNavigation(page).getByRole("link", {name:"Course removals"}).click();
  const removalSearch = page.getByRole("searchbox", {name:"Search student, ID, course, or advisor"});
  await removalSearch.fill(student.studentId);
  const courseButton = page.getByRole("button", {name:"View course Research Methods"});
  await courseButton.click();
  await expect(page.getByRole("dialog", {name:"Research Methods"}).getByRole("heading", {name:"Prerequisites"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(courseButton).toBeFocused();
  const studentButton = page.getByRole("button", {name:"Open profile for Schedule Review Student"});
  await studentButton.click();
  await expect(page.getByRole("dialog", {name:"Schedule Review Student"})).toContainText("schedule.review@student.guc.edu.eg");
  await page.getByRole("dialog").getByRole("button", {name:"Close",exact:true}).click();
  await expect(studentButton).toBeFocused();
  await expect(removalSearch).toHaveValue(student.studentId);
  await page.getByRole("button", {name:"View Details"}).click();
  await expect(page.getByRole("dialog").getByRole("heading", {name:"Advisor explanation"})).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(removal.explanation);
  await page.getByRole("dialog").getByRole("button", {name:"Close",exact:true}).last().click();
  await page.getByRole("button", {name:"Reject",exact:true}).click();
  const decision = page.getByRole("dialog");
  await expect(decision.getByRole("button", {name:"Reject Request"})).toBeDisabled();
  await decision.getByRole("textbox").fill("The transfer record does not cover this course.");
  await decision.getByRole("button", {name:"Reject Request"}).click();
  await expect(decision).toHaveCount(0);
  expect((await MandatoryCourseRemovalRequest.findById(removal._id)).status).toBe("rejected");

  const advisorPage = await browser.newPage();
  try {
    await advisorPage.goto(baseURL + "/portal-studio/index.html?page=advising");
    await signIn(advisorPage, advisor.email, password);
    await advisorPage.getByRole("searchbox", {name:"Search students"}).fill(student.studentId);
    const advisorRow = advisorPage.getByRole("row").filter({ hasText: student.studentId });
    await expect(advisorRow.getByRole("button", { name: "Academic records", exact: true })).toBeVisible();
    const more = advisorRow.getByRole("button", { name: /More actions for/ });
    await more.press("Enter");
    for (const name of ["Advising details", "Request course removal", "Graduation plan", "Schedule preferences"]) {
      await expect(advisorRow.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(advisorRow.getByRole("button", { name: /assign advisor/i })).toHaveCount(0);
    await advisorRow.getByRole("button", { name: "Advising details", exact: true }).click();
    await expect(advisorPage.getByRole("dialog", { name: "Advising details" })).toContainText(student.studentId);
    await advisorPage.keyboard.press("Escape");
    await more.click();
    await advisorRow.getByRole("button", { name: "Schedule preferences", exact: true }).click();
    await expect(advisorPage.locator(".preference-student-selected")).toContainText(student.studentId);
    await advisorPage.getByLabel("Academic term").selectOption(String(term._id));
    await expect(advisorPage.locator(".preference-reading blockquote")).toHaveText(submission.note);
    await expect(advisorPage.getByRole("button", {name:"Save preferences"})).toHaveCount(0);
  } finally {
    await advisorPage.close();
  }
});

test("Populated schedule activity survives a temporary profile outage, sidebar navigation and reload", async ({page}) => {
  const coordinator = await User.create({fullName:"Activity Coordinator",role:"coordinator",email:"activity.reader@guc.edu.eg",passwordHash:await bcrypt.hash(password,4)});
  const term = await auditTerm();
  const student = await auditAdvisingStudent({fullName:"Activity Student",studentId:"49-00806",email:"activity.row@student.guc.edu.eg",passwordHash:coordinator.passwordHash});
  await ScheduleActivity.create({
    student:student._id, term:term._id, schedule:new mongoose.Types.ObjectId(), action:"processed", scheduleVersion:4,
    actor:coordinator._id, actorName:coordinator.fullName, actorEmail:coordinator.email, actorRole:coordinator.role,
  });
  await page.goto(baseURL);
  await signIn(page, coordinator.email, password);
  const nav = mainNavigation(page);
  await nav.getByRole("link", { name:"Student schedules", exact:true }).click();
  await expect(page.getByRole("heading", { name:"Student schedules",exact:true })).toBeVisible();
  await page.route("**/api/identity/profile", route => route.fulfill({status:503,json:{message:"Service temporarily unavailable"}}), {times:1});
  await nav.getByRole("link", { name:"Schedule activity", exact:true }).click();
  await expect(page.locator(".activity-entry")).toContainText(coordinator.fullName);
  await page.route("**/api/identity/profile", route => route.fulfill({status:503,json:{}}), {times:2});
  await page.reload();
  await page.getByRole("button", { name:"Try again" }).click();
  await expect(page.locator(".activity-entry")).toContainText("Version 4");
  await page.reload();
  await expect(page.locator(".activity-entry")).toContainText("Schedule processed");
});

test("Req 122: group student workflows and open individual requests without expanding a row", async ({ page }) => {
  const coordinator = await User.create({
    fullName: "Inbox Coordinator", role: "coordinator", email: "inbox.coordinator@guc.edu.eg", passwordHash: await bcrypt.hash(password, 4),
  });
  const requests = Array.from({ length: 9 }, (_, index) => ({
    id: String(index), type: "extraHours", requestedHours: index + 1, status: "pending", updatedAt: "2026-05-20T12:00:00Z",
  }));
  const student = {
    id: "sample", fullName: "Nour Adel", studentId: "27-00041", studentType: "advising", workflowStatus: "pendingApproval",
    blockingStep: "Resolve pending coordinator approval", lastUpdatedAt: requests[0].updatedAt,
    assignedAdvisor: { id: "advisor", fullName: "Dr. Amal Ali", email: "amal@guc.edu.eg" }, requests,
  };
  const normal = {
    id: "normal", fullName: "Salma Adel", studentId: "27-00042", studentType: "normal", workflowStatus: "swapCompleted",
    requests: [{ id: "swap", type: "wholeScheduleSwap", status: "completed" }],
  };
  let pendingLoads = 0;
  await page.route("**/api/admin/pending-work", route => {
    pendingLoads += 1;
    return route.fulfill({ json: {
      students: [student, normal, { ...normal, id: "other", studentId: "27-00043", fullName: "Alya Ali", workflowStatus: "notStarted", requests: [] }],
      groups: { requestType: { extraHours: 9, wholeScheduleSwap: 1, financialReversal: 0 } },
    } });
  });
  await page.route("**/api/admin/pending-work", route => route.fulfill({ status: 503, json: { message: "Pending work is temporarily unavailable" } }), { times: 1 });
  await page.goto(baseURL + "/?page=pending-work&role=coordinator");
  await signIn(page, coordinator.email, password);
  await page.getByRole("button", { name: "Try again" }).click();
  for (const groupName of ["Advising students", "Normal students"]) {
    const register = page.locator(".workflow-group").filter({ has: page.getByRole("heading", { name: groupName, exact: true }) });
    await expect(register.getByRole("table", { name: `Student scheduling workflow · ${groupName}` }).getByRole("columnheader"))
      .toHaveText(["Student", "Schedule status", "Blocking step", "Requests"]);
  }
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
  await expect(page.locator(".workflow-record")).toHaveCount(3);
  await expect(page.locator(".workflow-record").filter({hasText:"Alya Ali"})).toContainText("Not started");

  const grouping = page.getByRole("group", { name: "Group by" });
  await grouping.getByRole("button", { name: "Advisor" }).click();
  const advisorGroups = page.locator(".workflow-advisor");
  await expect(advisorGroups).toHaveCount(2);
  await expect(page.getByRole("table")).toHaveCount(0);
  const search = page.getByLabel("Search students or advisors");
  await search.fill(student.assignedAdvisor.email);
  const advisorRegister = advisorGroups.filter({ hasText: student.assignedAdvisor.fullName });
  const advisorBar = advisorRegister.locator("summary");
  await expect(advisorBar).toContainText("1 student");
  await advisorBar.focus();
  await page.keyboard.press("Enter");
  await expect(advisorRegister.getByRole("table")).toBeVisible();
  expect(await advisorBar.evaluate(heading => heading.getBoundingClientRect().bottom))
    .toBeLessThan(await advisorRegister.getByRole("columnheader", { name: "Student", exact: true }).evaluate(header => header.getBoundingClientRect().top));
  await expect(page.locator(".workflow-record")).toHaveCount(1);
  const openRequests = page.getByRole("button", {name:"View 9 requests for Nour Adel"});
  await openRequests.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", {name:"Review queue"})).toHaveCount(4);
  await dialog.getByRole("button", {name:"Next"}).click();
  await dialog.getByRole("button", {name:"Next"}).click();
  await expect(dialog).toContainText("9 extra credit hours");
  await expect(dialog.getByRole("link", {name:"Review queue"})).toHaveAttribute("href", /page=extra-hours/);
  await page.keyboard.press("Escape");
  await expect(openRequests).toBeFocused();
  await page.getByRole("button", {name:"View workflow for Nour Adel"}).click();
  await expect(dialog.getByText("Last workflow update")).toBeVisible();
  await dialog.getByRole("button", {name:"Close"}).click();

  await search.fill("");
  await grouping.getByRole("button", {name:"Request type"}).click();
  const requestType = page.getByLabel("Request type", {exact:true});
  await requestType.selectOption("wholeScheduleSwap");
  await page.getByRole("button", {name:"View whole-schedule swap for Salma Adel"}).click();
  await expect(dialog.getByText("Completed", {exact:true})).toBeVisible();
  await expect(dialog.getByRole("link")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await requestType.selectOption("financialReversal");
  await expect(page.getByRole("heading", {name:"No financial reversal requests"})).toBeVisible();
  await page.getByRole("button", {name:"Clear filters"}).click();
  await expect(page.getByRole("heading", {name:"No requests"})).toBeVisible();

  const nav = mainNavigation(page);
  await nav.getByRole("link", { name: "Course removals", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Course removals", exact: true })).toBeVisible();
  const loadsBeforeReturn = pendingLoads;
  await nav.getByRole("link", { name: "Pending work", exact: true }).click();
  await expect(page.locator(".workflow-record")).toHaveCount(3);
  expect(pendingLoads).toBeGreaterThan(loadsBeforeReturn);
});
