import assert from "node:assert/strict";
import test from "node:test";
import { requireDirectoryRole, requireRole } from "./admin.routes.js";

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

test("B2 actions are limited to their assigned roles", () => {
  const administrator = requireRole("administrator");
  const coordinator = requireRole("coordinator");
  const canAccess = (middleware, role) => {
    const result = { status: 200, continued: false };
    const req = role ? { user: { role } } : {};
    const res = { status(code) { result.status = code; return this; }, json() { return this; } };
    middleware(req, res, () => { result.continued = true; });
    return result;
  };

  assert.equal(canAccess(administrator).status, 401);
  assert.equal(canAccess(administrator, "coordinator").status, 403);
  assert.equal(canAccess(administrator, "administrator").continued, true);
  assert.equal(canAccess(coordinator, "administrator").status, 403);
  assert.equal(canAccess(coordinator, "coordinator").continued, true);
});
