import assert from "node:assert/strict";
import test from "node:test";
import { buildAdvisorFilter, buildStudentSearchFilter } from "./admin.controller.js";

test("student ID search remains compatible with account-status filtering", () => {
  const idPattern = /64-10002/i;
  const filter = buildStudentSearchFilter(idPattern, [], ["active-user"]);

  assert.deepEqual(filter, {
    user: { $in: ["active-user"] },
    $or: [
      { studentId: idPattern },
      { user: { $in: [] } },
    ],
  });
});

test("advisor filter options include assigned advisors and advisors in the system", () => {
  assert.deepEqual(buildAdvisorFilter(["assigned-advisor"]), {
    role: "advisor",
    $or: [
      { _id: { $in: ["assigned-advisor"] } },
      { isAdvisorInSystem: true },
    ],
  });
});
