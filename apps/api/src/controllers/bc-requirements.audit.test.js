import assert from "node:assert/strict";
import test, { before, after, beforeEach } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "../app.js";
import {
  User, StudentProfile, AcademicTerm, Course, CourseOffering, StudentSchedule,
  CourseAttempt, ScheduleActivity, CalendarConnection, SlotChangeRequest,
  MandatoryCourseRemovalRequest, ExtraHoursRequest, FinancialTransaction,
  FinancialReversalRequest, GraduationPlan, ExitExamRequest, StudentWorkflowState,
} from "../models/index.js";
import { generateToken } from "../middleware/auth.middleware.js";
import { getWallet } from "../models/academics.js";

// Known gaps still execute their assertions. Strict mode makes them ordinary failures.
// This keeps the regression suite usable while exposing unmet acceptance criteria explicitly.
const gap = (reason) => process.env.BC_AUDIT_STRICT === "1" ? {} : { todo: reason };
let database, server, base, users, student, other, normal, term, course, offering;
const realFetch = globalThis.fetch;
const oid = () => new mongoose.Types.ObjectId();

before(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(database.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  globalThis.fetch = realFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  if (database) await database.stop();
});
beforeEach(async () => {
  globalThis.fetch = realFetch;
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
  users = {};
  for (const role of ["advisor", "coordinator", "administrator", "advisingStudent", "normalStudent"]) {
    users[role] = await User.create({ fullName: `${role} Audit`, email: `${role}@${role.endsWith("Student") ? "student.guc.edu.eg" : "guc.edu.eg"}`,
      role, passwordHash: "audit-not-a-login-password", isActive: true, isAdvisorInSystem: role === "advisor" });
  }
  student = await StudentProfile.create({ user: users.advisingStudent._id, studentId: "70-00001", studentType: "advising", major: "CS", currentSemester: 5,
    gpa: 2, academicStanding: "goodAcademicStanding", advisingReason: "unattendedCourses", assignedAdvisor: users.advisor._id });
  const extraUser = await User.create({ role: "advisingStudent", fullName: "Other student", email: "other@student.guc.edu.eg", passwordHash: "unused" });
  other = await StudentProfile.create({ user: extraUser._id, studentId: "70-00002", studentType: "advising", major: "CS", currentSemester: 5,
    gpa: 2, academicStanding: "goodAcademicStanding", advisingReason: "unattendedCourses", assignedAdvisor: users.advisor._id });
  normal = await StudentProfile.create({ user: users.normalStudent._id, studentId: "70-00003", studentType: "normal", major: "CS", currentSemester: 5,
    gpa: 2, academicStanding: "goodAcademicStanding" });
  term = await AcademicTerm.create({ code: "AUD26", academicYear: "2026/2027", season: "winter", termStart: new Date("2026-10-01"), termEnd: new Date("2027-03-01"),
    teachingStart: new Date("2026-10-05"), teachingEnd: new Date("2027-01-20"), registrationStart: new Date("2026-09-01"), registrationEnd: new Date("2026-10-10"),
    advisingDeadline: new Date(Date.now() + 86400000), wholeScheduleSwapDeadline: new Date(Date.now() + 86400000), isActive: true });
  course = await Course.create({ code: "CSEN 501", name: "Audit systems", creditHours: 4, courseType: "core", facultyMajors: ["CS"], recommendedSemester: 5 });
  offering = await CourseOffering.create({ course: course._id, term: term._id, academicYear: term.academicYear, isPublished: true,
    instructors: [{ fullName: "Dr Audit", email: "audit@guc.edu.eg" }], eligibleGroups: [{ major: "CS", semester: 5, studyGroup: "1" }],
    slots: ["lecture", "tutorial", "lab"].flatMap((componentType, index) => [1, 2].map((group) => ({ componentType, groupNumber: String(group), day: ["Monday", "Tuesday", "Wednesday"][index],
      startMinute: 540 + group * 120, endMinute: 600 + group * 120, room: `A${index}${group}`, capacity: 2, assignedStudentCount: 0 }))) });
});

async function call(path, { role = "coordinator", method = "GET", body } = {}) {
  const headers = role ? { Authorization: `Bearer ${generateToken(users[role])}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await realFetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: res.headers.get("content-type")?.includes("json") && text ? JSON.parse(text) : text };
}
const schedulePath = () => `/schedules/advising/${student._id}`;
async function schedule(profile = student, status = "readyForStudentReview", reserved = true) {
  const slots = offering.slots.filter((slot) => slot.groupNumber === "1");
  return StudentSchedule.create({ student: profile._id, term: term._id, scheduleType: "advising", status, seatsReserved: reserved, createdBy: users.advisor._id,
    courses: [{ course: course._id, courseOffering: offering._id, creditHoursSnapshot: 4, slots: slots.map((slot) => ({ componentType: slot.componentType, courseOffering: offering._id, slotGroupId: slot._id })) }] });
}
async function extraRequest(overrides = {}) {
  return ExtraHoursRequest.create({ student: student._id, advisor: users.advisor._id, term: term._id,
    courses: [{ course: course._id, hours: 4, isRepeated: false, pricePerHour: 800, subtotal: 3200 }], requestedHours: 4, totalCost: 3200,
    eligibilitySnapshot: { standardAllowance: 30, hoursBeforeRequest: 30, hoursAfterRequest: 34, isProbation: false, graduatingWithinOneYear: true },
    decisionStatus: "approved", settlementStatus: "paid", ...overrides });
}
async function activity(profile, action, occurredAt, actorName = "Dr Audit", actorEmail = "audit@guc.edu.eg") {
  return ScheduleActivity.create({ student: profile._id, term: term._id, schedule: oid(), action, scheduleVersion: 2,
    actor: users.advisor._id, actorName, actorEmail, actorRole: "advisor", occurredAt: new Date(occurredAt), ...(action === "reopened" ? { reason: "Correct timetable" } : {}) });
}

test("B1 Req 116: OAuth requires student auth/config; invalid state cannot create a connection", async () => {
  assert.equal((await call("/calendar/connect", { role: null })).status, 401);
  assert.equal((await call("/calendar/connect", { role: "advisor" })).status, 403);
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost/calendar/callback";
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = "42".repeat(32);
  const connect = await call("/calendar/connect", { role: "advisingStudent" });
  assert.equal(connect.status, 200);
  const url = new URL(connect.body.authorizationUrl);
  assert.equal(url.origin, "https://accounts.google.com");
  assert.match(url.searchParams.get("scope"), /calendar.events/);
  assert.equal(url.searchParams.get("client_secret"), null);
  const failed = await call("/calendar/oauth/callback?state=invalid&code=bad", { role: null });
  assert.equal(failed.status, 302);
  assert.match(failed.headers.get("location"), /calendar=error/);
  assert.equal(await CalendarConnection.countDocuments(), 0);
});

test("B1 Req 116: OAuth encrypts tokens; recurring sync includes all slot types, refreshes tokens and deletes stale events", async () => {
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost/calendar/callback";
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = "42".repeat(32);
  process.env.UNIVERSITY_TIMEZONE = "Africa/Cairo";
  const events = [], removals = [], requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url); requests.push({ address, options });
    if (address.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "secret-access", refresh_token: "secret-refresh", expires_in: 3600, scope: "calendar.events" });
    if (address.includes("userinfo")) return Response.json({ email: "calendar@example.com" });
    if (address.includes("/events")) {
      if (options.method === "PUT") return new Response("missing", { status: 404 });
      if (options.method === "DELETE") { removals.push(address); return new Response(null, { status: 204 }); }
      const event = JSON.parse(options.body); events.push(event); return Response.json({ id: event.id });
    }
    if (address.includes("/revoke")) return new Response(null, { status: 200 });
    throw new Error(`Unexpected external request ${address}`);
  };
  try {
    const start = await call("/calendar/connect", { role: "advisingStudent" });
    const state = new URL(start.body.authorizationUrl).searchParams.get("state");
    const callback = await call(`/calendar/oauth/callback?state=${encodeURIComponent(state)}&code=valid`, { role: null });
    assert.match(callback.headers.get("location"), /calendar=connected/);
    const stored = await CalendarConnection.findOne().select("+encryptedAccessToken +encryptedRefreshToken").lean();
    assert.ok(stored.encryptedAccessToken && !stored.encryptedAccessToken.includes("secret-access"));
    assert.ok(stored.encryptedRefreshToken && !stored.encryptedRefreshToken.includes("secret-refresh"));
    const publicConnection = await call("/calendar/connection", { role: "advisingStudent" });
    assert.equal(publicConnection.body.encryptedAccessToken, undefined);
    assert.equal((await call("/calendar/connection", { role: "normalStudent" })).body.connected, false);
    assert.equal((await call("/calendar/sync", { role: "advisingStudent", method: "POST" })).status, 409);
    const saved = await schedule(student, "processed");
    const sync = await call("/calendar/sync", { role: "advisingStudent", method: "POST" });
    assert.equal(sync.status, 200, JSON.stringify(sync.body));
    assert.equal(sync.body.synced, 3);
    assert.equal(events.length, 3);
    for (const event of events) {
      assert.match(event.summary, /CSEN 501.*Audit systems/);
      assert.match(event.description, /Type: (lecture|tutorial|lab)/);
      assert.match(event.description, /Dr Audit/);
      assert.ok(event.location);
      assert.equal(event.start.timeZone, "Africa/Cairo");
      assert.match(event.recurrence[0], /FREQ=WEEKLY;BYDAY=.+;UNTIL=/);
      assert.ok(event.start.dateTime >= "2026-10-05");
    }
    assert.equal(new Set(events.map((event) => event.id)).size, 3);
    await CalendarConnection.updateOne({ _id: stored._id }, { tokenExpiresAt: new Date(0) });
    await StudentSchedule.updateOne({ _id: saved._id }, { $set: { "courses.0.slots": saved.courses[0].slots.slice(0, 1) } });
    const again = await call("/calendar/sync", { role: "advisingStudent", method: "POST" });
    assert.equal(again.status, 200);
    assert.equal(again.body.synced, 1);
    assert.equal(removals.length, 2);
    assert.equal(events[0].id, events[3].id, "event IDs remain stable across resyncs");
    assert.ok(requests.some(({ options }) => String(options.body).includes("grant_type=refresh_token")));
    assert.equal((await call("/calendar/connection", { role: "advisingStudent", method: "DELETE" })).status, 200);
    assert.equal(await CalendarConnection.countDocuments(), 0);
  } finally { globalThis.fetch = realFetch; }
});

test("B1 Req 122: dashboard derives states, includes both student types and groups requests/advisors", async () => {
  assert.equal((await call("/admin/pending-work", { role: null })).status, 401);
  for (const role of ["advisor", "administrator", "normalStudent", "advisingStudent"]) assert.equal((await call("/admin/pending-work", { role })).status, 403);
  const saved = await schedule(student, "draft");
  await SlotChangeRequest.create({ student: student._id, schedule: saved._id, term: term._id, course: course._id,
    componentType: "lecture", currentOffering: offering._id, currentSlotGroupId: offering.slots[0]._id });
  const response = await call("/admin/pending-work");
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.students.length, 3);
  assert.equal(response.body.groups.studentType.advising, 2);
  assert.equal(response.body.groups.studentType.normal, 1);
  assert.equal(response.body.groups.requestType.slotChange, 1);
  const row = response.body.students.find((item) => item.id === String(student._id));
  assert.equal(row.workflowStatus ?? row.workflow?.status ?? row.status, "changeRequestPending");
  assert.equal(row.requests[0].type, "slotChange");
});

test("B1 Req 123: history supports global and student scopes and preserves actor snapshots", async () => {
  await activity(student, "processed", "2026-11-01T10:00:00Z");
  await activity(other, "reopened", "2026-11-02T10:00:00Z");
  await User.updateOne({ _id: users.advisor._id }, { fullName: "Renamed advisor" });
  assert.equal((await call("/admin/schedule-activity", { role: null })).status, 401);
  assert.equal((await call("/admin/schedule-activity", { role: "advisor" })).status, 403);
  const all = await call("/admin/schedule-activity", { role: "administrator" });
  assert.equal(all.body.total, 2);
  const single = await call(`/admin/students/${student._id}/schedule-activity`);
  assert.equal(single.body.total, 1);
  const event = single.body.activities[0];
  assert.equal(event.studentId, student.studentId);
  assert.equal(event.staffName, "Dr Audit");
  assert.equal(event.staffEmail, "audit@guc.edu.eg");
  assert.equal(event.staffRole, "advisor");
  assert.equal(event.scheduleVersion, 2);
  assert.ok(event.occurredAt);
  assert.equal((await call(`/admin/students/${normal._id}/schedule-activity`)).status, 404);
  assert.equal((await call("/admin/students/bad/schedule-activity")).status, 400);
});

test("B1 Req 124: action/date filters compose and reject malformed or reversed ranges", async () => {
  await activity(student, "processed", "2026-11-01T23:59:59.999Z");
  await activity(student, "reopened", "2026-11-02T00:00:00Z");
  const filtered = await call("/admin/schedule-activity?action=processed&from=2026-11-01&to=2026-11-01");
  assert.equal(filtered.body.total, 1);
  for (const query of ["action=delete", "from=2026-02-30", "from=2026-11-02&to=2026-11-01", "termId=bad"]) {
    assert.equal((await call(`/admin/schedule-activity?${query}`)).status, 400, query);
  }
});

test("B1 Req 125: literal search matches student IDs, staff name and email without regex injection", async () => {
  await activity(student, "processed", "2026-11-01", "Dr [Audit]", "audit@guc.edu.eg");
  await activity(other, "reopened", "2026-11-02", "Dr Other", "other@guc.edu.eg");
  for (const search of [student.studentId, "[Audit]", "audit@guc.edu.eg"]) {
    const result = await call(`/admin/schedule-activity?search=${encodeURIComponent(search)}`);
    assert.equal(result.body.total, 1, search);
    assert.equal(result.body.activities[0].studentId, student.studentId);
  }
  assert.equal((await call("/admin/schedule-activity?search=.%2A")).body.total, 0);
});

test("B1 Req 126: CSV exports every matching page, excludes other actions and protects spreadsheet cells", async () => {
  const rows = Array.from({ length: 105 }, () => ({ student: student._id, term: term._id, schedule: oid(), action: "processed", scheduleVersion: 1,
    actor: users.advisor._id, actorName: '=HYPERLINK("bad")', actorEmail: "audit@guc.edu.eg", actorRole: "advisor", occurredAt: new Date("2026-11-01") }));
  await ScheduleActivity.insertMany(rows);
  await activity(other, "reopened", "2026-11-02");
  const csv = await call("/admin/schedule-activity/export?action=processed", { role: "administrator" });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.match(csv.headers.get("content-disposition"), /attachment/);
  assert.equal(csv.body.trim().split(/\r?\n/).length, 106);
  assert.match(csv.body, /'=HYPERLINK/);
  assert.ok(!csv.body.includes(other.studentId));
});

test("B2 Req 97-101,127: request/reference searches and combined filters preserve student ownership in details and exports", async () => {
  const request = await extraRequest();
  const owned = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "deferredCharge", amount: 3200, status: "pending",
    settlementOption: "deferred", deferredChargeReference: "DEFER-AUDIT", occurredAt: new Date("2026-11-01T23:59:59.999Z") });
  await FinancialTransaction.create({ student: other._id, kind: "gatewayPayment", amount: 999, status: "succeeded", settlementOption: "gateway", transactionReference: "OTHER-REF" });
  for (const search of [student.studentId, String(request._id), "DEFER-AUDIT"]) {
    const result = await call(`/finance/records?search=${encodeURIComponent(search)}`, { role: "administrator" });
    assert.equal(result.body.total, 1, search);
    assert.equal(result.body.records[0]._id, String(owned._id));
  }
  const query = "settlementOption=deferred&status=pending&startDate=2026-11-01&endDate=2026-11-01";
  const filtered = await call(`/finance/records?${query}`);
  assert.equal(filtered.body.total, 1);
  assert.equal((await call("/finance/records?search=OTHER-REF", { role: "advisingStudent" })).body.total, 0);
  assert.equal((await call("/finance/records/export", { role: "advisingStudent" })).status, 403);
  const csv = await call(`/finance/export?${query}`);
  assert.equal(csv.status, 200);
  assert.ok(csv.body.includes(student.studentId));
  assert.ok(!csv.body.includes(other.studentId));
});

test("C3 Req 40-42,46-48: tutorial and lab requests preserve other components, withdrawal and exact replacement response", async () => {
  await schedule();
  await CourseOffering.updateOne({ _id: offering._id }, { $set: { "slots.$[slot].assignedStudentCount": 1 } }, { arrayFilters: [{ "slot.groupNumber": "1" }] });
  for (const componentType of ["tutorial", "lab"]) {
    const current = offering.slots.find((slot) => slot.componentType === componentType && slot.groupNumber === "1");
    const next = offering.slots.find((slot) => slot.componentType === componentType && slot.groupNumber === "2");
    const created = await call("/slot-changes", { role: "advisingStudent", method: "POST", body: { courseId: String(course._id), slotId: String(current._id), preferenceNote: "Later group" } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.request._id;
    assert.equal((await call(`/slot-changes/${id}`)).status, 200);
    const decided = await call(`/slot-changes/${id}/decision`, { method: "POST", body: { decision: "approved", replacementSlotId: String(next._id), responseNote: "Changed exactly this component" } });
    assert.equal(decided.status, 200, JSON.stringify(decided.body));
    assert.equal((await call(`/slot-changes/${id}/withdraw`, { role: "advisingStudent", method: "POST" })).status, 409);
    const own = await call("/slot-changes/me", { role: "advisingStudent" });
    const row = own.body.requests.find((item) => item._id === id);
    assert.equal(row.status, "approved");
    assert.equal(String(row.replacementSlotGroupId), String(next._id));
    assert.match(row.responseNote, /Changed exactly/);
    const live = await CourseOffering.findById(offering._id);
    assert.equal(live.slots.id(current._id).assignedStudentCount, 0);
    assert.equal(live.slots.id(next._id).assignedStudentCount, 1);
  }
  const saved = await StudentSchedule.findOne({ student: student._id });
  assert.equal(saved.status, "readyForStudentReview");
  assert.equal(String(saved.courses[0].slots.find((slot) => slot.componentType === "lecture").slotGroupId), String(offering.slots[0]._id));
});

test("C2 Req 74-78: resume all component choices, change a tutorial and remove a lab with exact reservation deltas", async () => {
  const endpoint = `${schedulePath()}/draft`;
  const selections = ["lecture", "tutorial", "lab"].map((componentType) => ({ componentType, groupNumber: "1" }));
  const save = (version, groups) => call(endpoint, { method: "PUT", body: { version, courses: [{ courseOffering: String(offering._id), groups }] } });
  const first = await save(0, selections);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  const resumed = await call(endpoint);
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.schedule.courses[0].groups.length, 3);
  for (const componentType of ["lecture", "tutorial", "lab"]) {
    const group = resumed.body.offerings[0].groups.find((item) => item.componentType === componentType && item.groupNumber === "1");
    assert.ok(group && group.slots.length, `Req 75 available ${componentType} slots`);
  }
  const changed = await save(first.body.schedule.version, selections.map((pick) => pick.componentType === "tutorial" ? { ...pick, groupNumber: "2" } : pick));
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  const removed = await save(changed.body.schedule.version, [{ componentType: "lecture", groupNumber: "1" }, { componentType: "tutorial", groupNumber: "2" }]);
  assert.equal(removed.status, 200);
  const live = await CourseOffering.findById(offering._id);
  const count = (type, group) => live.slots.find((slot) => slot.componentType === type && slot.groupNumber === group).assignedStudentCount;
  assert.equal(count("lecture", "1"), 1);
  assert.equal(count("tutorial", "1"), 0);
  assert.equal(count("tutorial", "2"), 1);
  assert.equal(count("lab", "1"), 0);
  assert.equal((await StudentSchedule.findOne({ student: student._id })).status, "draft");
  const incomplete = await call(endpoint);
  assert.ok(incomplete.body.validationIssues.some((issue) => /lab/i.test(issue.message)), "incomplete draft still exposes its missing lab");
});

test("B3 Req 82: reopen hides the schedule from its owner and automatically records a reason", async () => {
  await schedule(student, "processed");
  assert.equal((await call("/schedules/me", { role: "advisingStudent" })).status, 200);
  assert.equal((await call(`${schedulePath()}/reopen`, { method: "POST", body: { reason: "   " } })).status, 400);
  const reopened = await call(`${schedulePath()}/reopen`, { method: "POST", body: { reason: "Correct lab selection" } });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.schedule.status, "draft");
  assert.equal((await call("/schedules/me", { role: "advisingStudent" })).status, 404);
  const history = await call(`/admin/students/${student._id}/schedule-activity`);
  assert.equal(history.body.activities[0].reason, "Correct lab selection");
});

test("B3 Req 65-68: removal search and combined advisor/status/date filters include the full final day", async () => {
  const baseRequest = { student: student._id, advisor: users.advisor._id, course: course._id, term: term._id, reason: "other", explanation: "Audit request" };
  const first = await MandatoryCourseRemovalRequest.create({ ...baseRequest, createdAt: new Date("2026-11-01T00:00:00Z") });
  const last = await MandatoryCourseRemovalRequest.create({ ...baseRequest, createdAt: new Date("2026-11-01T23:59:59.999Z") });
  await MandatoryCourseRemovalRequest.create({ ...baseRequest, createdAt: new Date("2026-11-02T00:00:00Z") });
  await MandatoryCourseRemovalRequest.create({ ...baseRequest, status: "rejected", createdAt: new Date("2026-11-01T12:00:00Z") });
  const filters = `advisor=${users.advisor._id}&status=pending&dateFrom=2026-11-01&dateTo=2026-11-01`;
  for (const search of [student.studentId, course.code, users.advisor.fullName, users.advisor.email]) {
    const result = await call(`/mandatory-removals?${filters}&search=${encodeURIComponent(search)}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.map((item) => item._id).sort(), [String(first._id), String(last._id)].sort());
  }
  assert.equal((await call(`/mandatory-removals/${last._id}`)).body._id, String(last._id));
});

test("GAP B2 Req 102: an active, uncancelled extra-hours request cannot be refunded", gap("Refund endpoint never checks cancellation/reversal eligibility"), async () => {
  const request = await extraRequest();
  const payment = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "gatewayPayment", amount: 3200, status: "succeeded", settlementOption: "gateway" });
  const res = await call(`/finance/${payment._id}/refund`, { method: "POST", body: {} });
  assert.ok([400, 409].includes(res.status), `active request was refunded: ${res.status}`);
  assert.equal(await FinancialTransaction.countDocuments({ kind: "refund" }), 0);
});

test("GAP B2 Req 102: cancelling an unpaid deferred charge never credits the wallet", gap("Deferred cancellation path is absent; generic refund credits wallet"), async () => {
  const request = await extraRequest({ decisionStatus: "withdrawn", settlementStatus: "deferred", settlementOption: "deferred" });
  const charge = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "deferredCharge", amount: 3200, status: "succeeded", settlementOption: "deferred", deferredChargeReference: "D-102" });
  await FinancialReversalRequest.create({ student: student._id, extraHoursRequest: request._id, originalTransaction: charge._id, requestedBy: users.advisor._id, reversalType: "cancelDeferredCharge" });
  const before = (await getWallet(student._id)).balance;
  const res = await call(`/finance/${charge._id}/refund`, { method: "POST", body: {} });
  assert.equal(res.status, 200);
  assert.equal((await getWallet(student._id)).balance, before, "unpaid deferred debt must not become wallet credit");
  assert.equal(await FinancialTransaction.countDocuments({ kind: "deferredChargeCancellation" }), 1);
});

test("GAP B2 Req 102: refund revokes approved hours and removes unapplied draft additions", gap("Refund never updates extra-hours settlement or draft courses"), async () => {
  const request = await extraRequest({ decisionStatus: "withdrawn" });
  const payment = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "gatewayPayment", amount: 3200, status: "succeeded", settlementOption: "gateway" });
  await FinancialReversalRequest.create({ student: student._id, extraHoursRequest: request._id, originalTransaction: payment._id, requestedBy: users.advisor._id, reversalType: "refundToWallet" });
  await schedule(student, "draft");
  const res = await call(`/finance/${payment._id}/refund`, { method: "POST", body: {} });
  assert.equal(res.status, 200);
  assert.ok(["refunded", "cancelled"].includes((await ExtraHoursRequest.findById(request._id)).settlementStatus));
  assert.equal((await StudentSchedule.findOne({ student: student._id })).courses.length, 0);
});

test("GAP B2 Req 102: simultaneous refund requests produce only one credit", gap("Refund read/save/ledger operations are not atomic"), async () => {
  const request = await extraRequest({ decisionStatus: "withdrawn" });
  const payment = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "gatewayPayment", amount: 3200, status: "succeeded" });
  const responses = await Promise.all(Array.from({ length: 8 }, () => call(`/finance/${payment._id}/refund`, { method: "POST", body: {} })));
  assert.equal(responses.filter((res) => res.status === 200).length, 1);
  assert.equal(await FinancialTransaction.countDocuments({ relatedTransaction: payment._id, kind: "refund" }), 1);
});

test("GAP B2 Req 102: refunding a wallet payment restores the balance exactly once", gap("Marking the original wallet debit REFUNDED removes its debit and then adds a second credit"), async () => {
  const request = await extraRequest({ decisionStatus: "withdrawn" });
  await FinancialTransaction.create({ student: student._id, kind: "walletTopUp", amount: 5000, status: "succeeded" });
  const payment = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "extraHoursWalletPayment", amount: 3200, status: "succeeded", settlementOption: "wallet" });
  assert.equal((await getWallet(student._id)).balance, 1800);
  const result = await call(`/finance/${payment._id}/refund`, { method: "POST", body: {} });
  assert.equal(result.status, 200);
  assert.equal((await getWallet(student._id)).balance, 5000, "refund must reverse a 3200 debit exactly once");
});

test("GAP C1 Req 59: GPA 3.70 independently applies the probation credit reduction", gap("Allowance uses standing/reason but ignores GPA >= 3.70"), async () => {
  await StudentProfile.updateOne({ _id: student._id }, { gpa: 3.70 });
  const response = await call(`${schedulePath()}/overview`);
  assert.equal(response.body.creditHours.allowedHours, 23);
  assert.equal(response.body.creditHours.extraHoursAllowed, false);
});

test("GAP C1 Req 60: every course taken with the bachelor project requires extra-hours activation", gap("Only humanities are flagged as extra hours; accompanying core courses bypass approval/payment"), async () => {
  // With only one catalogue course, an earlier failed course is a permitted bachelor exception.
  await CourseAttempt.create({ student: student._id, course: course._id, term: term._id, attendance: "attended", result: "failed", grade: "F" });
  assert.equal((await call(`${schedulePath()}/bachelor-project`, { method: "PUT", body: { season: "winter" } })).status, 201);
  const picks = [{ courseOffering: String(offering._id), groups: ["lecture", "tutorial", "lab"].map((componentType) => ({ componentType, groupNumber: "1" })) }];
  const response = await call(`${schedulePath()}/draft/validate`, { method: "POST", body: { courses: picks } });
  assert.equal(response.status, 200);
  assert.ok(response.body.validationIssues.some((issue) => issue.code === "bachelorProjectExtraHours"), "core companion course bypassed extra-hours flow");
});

test("GAP B3 Req 64: completed-hours deferral requires more than 157 completed hours", gap("Only failed-course membership and nonempty reason are validated"), async () => {
  await CourseAttempt.create({ student: student._id, course: course._id, term: term._id, result: "failed", attendance: "attended", grade: "F" });
  const response = await call("/mandatory-removals", { role: "advisor", method: "POST", body: { studentProfileId: String(student._id), courseId: String(course._id), termId: String(term._id), reason: "completedHours", explanation: "Defer this course" } });
  assert.ok([400, 409, 422].includes(response.status), "student with zero completed hours qualified for >157 hour deferral");
});

test("GAP B3 Req 69: concurrent removal decisions release each seat only once", gap("Approval, schedule removal and capacity release are not one transaction/conditional decision"), async () => {
  await schedule(student, "draft");
  await CourseOffering.updateOne({ _id: offering._id }, { $set: { "slots.$[slot].assignedStudentCount": 1 } }, { arrayFilters: [{ "slot.groupNumber": "1" }] });
  const request = await MandatoryCourseRemovalRequest.create({ student: student._id, advisor: users.advisor._id, course: course._id, term: term._id, reason: "other", explanation: "Audit concurrent decision" });
  const decisions = await Promise.all(Array.from({ length: 8 }, () => call(`/mandatory-removals/${request._id}/decision`, { method: "PATCH", body: { decision: "approved", responseNote: "Approved removal" } })));
  assert.equal(decisions.filter((result) => result.status === 200).length, 1, "only one decision may win");
  const live = await CourseOffering.findById(offering._id);
  assert.ok(live.slots.every((slot) => slot.assignedStudentCount === 0), "capacity must not go negative");
});

test("GAP B3 Req 81: a pending mandatory-removal approval blocks final processing", gap("Processing does not query pending mandatory-removal decisions"), async () => {
  await schedule();
  await MandatoryCourseRemovalRequest.create({ student: student._id, advisor: users.advisor._id, course: course._id, term: term._id, reason: "other", explanation: "Awaiting approval" });
  const result = await call(`${schedulePath()}/process`, { method: "POST", body: {} });
  assert.ok([400, 409].includes(result.status), "required coordinator approval is unresolved");
});

test("GAP B3 Req 81: processing revalidates current published offerings and required slots", gap("Processing checks state and two request types but never revalidates schedule contents"), async () => {
  await schedule();
  await CourseOffering.updateOne({ _id: offering._id }, { isPublished: false });
  const response = await call(`${schedulePath()}/process`, { method: "POST", body: {} });
  assert.ok([400, 409, 422].includes(response.status), `unpublished offering was finalized: ${response.status}`);
  assert.equal((await StudentSchedule.findOne({ student: student._id })).status, "readyForStudentReview");
});

test("GAP B3 Req 81,123: two staff processing simultaneously finalize and log exactly once", gap("Processing has no transaction or conditional update; duplicate actions can succeed"), async () => {
  await schedule();
  const responses = await Promise.all(Array.from({ length: 8 }, () => call(`${schedulePath()}/process`, { method: "POST", body: {} })));
  assert.equal(responses.filter((res) => res.status === 200).length, 1);
  assert.equal(await ScheduleActivity.countDocuments({ action: "processed" }), 1);
});

test("GAP C1 Req 59: overview recomputes status after saving an empty draft instead of trusting a stale projection", gap("Overview prioritizes stored workflow projection over current schedule/actions"), async () => {
  await StudentWorkflowState.create({ student: student._id, term: term._id, studentType: "advising", status: "processed" });
  assert.equal((await call(`${schedulePath()}/draft`, { method: "POST" })).status, 201);
  const overview = await call(`${schedulePath()}/overview`);
  assert.equal(overview.body.scheduleStatus, "draft");
});

test("GAP B1 Req 122: dashboard includes graduation, exit-exam and financial reversal action requests", gap("Dashboard loads only swap, slot-change, mandatory-removal and extra-hours requests"), async () => {
  await GraduationPlan.create({ student: student._id, advisor: users.advisor._id, termPlans: [{ term: term._id, courses: [course._id] }], status: "submitted" });
  await ExitExamRequest.create({ student: student._id, advisor: users.advisor._id, course: course._id, reason: "Final failed course" });
  const request = await extraRequest();
  const payment = await FinancialTransaction.create({ student: student._id, extraHoursRequest: request._id, kind: "gatewayPayment", amount: 3200, status: "succeeded" });
  await FinancialReversalRequest.create({ student: student._id, extraHoursRequest: request._id, originalTransaction: payment._id, requestedBy: users.advisor._id, reversalType: "refundToWallet" });
  const result = await call("/admin/pending-work");
  const row = result.body.students.find((item) => item.id === String(student._id));
  for (const type of ["graduationPlan", "exitExam", "financialReversal"]) assert.ok(row.requests.some((item) => item.type === type), `missing ${type}`);
});
