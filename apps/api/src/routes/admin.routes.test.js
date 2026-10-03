import assert from "node:assert/strict";
import test from "node:test";
import { requireDirectoryRole } from "./admin.routes.js";

function checkAccess(role) {
  const result = { status: 200, body: null, continued: false };
  const req = role ? { user: { role } } : {};
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };

  requireDirectoryRole(req, res, () => { result.continued = true; });
  return result;
}

test("student directory is limited to coordinators and administrators", () => {
  assert.equal(checkAccess().status, 401);
  assert.equal(checkAccess("advisor").status, 403);
  assert.equal(checkAccess("coordinator").continued, true);
  assert.equal(checkAccess("administrator").continued, true);
});
