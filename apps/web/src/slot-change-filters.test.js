import test from "node:test";
import assert from "node:assert/strict";
import { filterSlotChanges } from "./slot-change-filters.js";

const rows = [
  { _id: "1", student: { studentId: "70-001", user: { fullName: "Ali [Audit]" }, assignedAdvisor: { _id: "advisor1" } }, course: { code: "CSEN 501" }, status: "pending", createdAt: "2026-11-01T00:00:00.000Z" },
  { _id: "2", student: { studentId: "70-002", user: { fullName: "Mona Student" }, assignedAdvisor: { _id: "advisor2" } }, course: { code: "MATH 501" }, status: "approved", createdAt: "2026-11-02T23:59:59.999Z" },
  { _id: "3", student: { studentId: "70-003", user: { fullName: "Unassigned Student" } }, course: { code: "CSEN 501" }, status: "withdrawn", createdAt: "2026-11-03T00:00:00.000Z" },
];
rows.forEach((row, index) => { row.createdAt = new Date(2026, 10, index + 1, index === 1 ? 23 : 0, 59, 59, 999).toISOString(); });
const ids = (filters) => filterSlotChanges(rows, filters).map((row) => row._id);

test("C3 Req 44: staff search matches student ID, case-insensitive name and course code literally", () => {
  assert.deepEqual(ids({ search: "70-001" }), ["1"]);
  assert.deepEqual(ids({ search: " ALI [AUDIT] " }), ["1"]);
  assert.deepEqual(ids({ search: "math 501" }), ["2"]);
  assert.deepEqual(ids({ search: ".*" }), []);
});
test("C3 Req 45: status, advisor and course filters work independently and in combination", () => {
  for (const status of ["pending", "approved", "withdrawn"]) assert.equal(ids({ status }).length, 1);
  assert.deepEqual(ids({ status: "rejected" }), []);
  assert.deepEqual(ids({ advisor: "advisor1" }), ["1"]);
  assert.deepEqual(ids({ advisor: "unassigned" }), ["3"]);
  assert.deepEqual(ids({ course: "CSEN 501" }), ["1", "3"]);
  assert.deepEqual(ids({ status: "pending", advisor: "advisor1", course: "CSEN 501", search: "Ali" }), ["1"]);
  assert.deepEqual(ids({ status: "approved", advisor: "advisor1" }), []);
});
test("C3 Req 45: inclusive submission dates compose with search without mutating the source list", () => {
  assert.deepEqual(ids({ from: "2026-11-02", to: "2026-11-02" }), ["2"]);
  assert.deepEqual(ids({ from: "2026-11-01", to: "2026-11-03", search: "Student" }), ["2", "3"]);
  assert.deepEqual(ids({ from: "2026-11-03", to: "2026-11-02" }), []);
  assert.equal(rows.length, 3);
  assert.deepEqual(ids({}), ["1", "2", "3"]);
});
