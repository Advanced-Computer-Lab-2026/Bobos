import assert from "node:assert/strict";
import test from "node:test";
import advisorRoutes from "./advisor.routes.js";
import { requireDirectoryRole, requireRole } from "./admin.routes.js";

function checkMiddleware(middleware, role) {
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

  middleware(req, res, () => { result.continued = true; });
  return result;
}

function checkAccess(role) {
  return checkMiddleware(requireDirectoryRole, role);
}

function checkAdvisorRoute(method, path, role) {
  const route = advisorRoutes.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  return checkMiddleware(route.route.stack[0].handle, role);
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

test("B3 routes require the right role", () => {
  assert.equal(checkAdvisorRoute("get", "/advisors", "normalStudent").status, 403);
  assert.equal(checkAdvisorRoute("get", "/advisors", "advisor").continued, true);
  assert.equal(checkAdvisorRoute("get", "/my-advisor", "advisingStudent").continued, true);
  assert.equal(checkAdvisorRoute("get", "/my-advisor", "advisor").status, 403);
  assert.equal(checkAdvisorRoute("get", "/students", "coordinator").continued, true);
  assert.equal(checkAdvisorRoute("get", "/students", "normalStudent").status, 403);
  assert.equal(checkAdvisorRoute("patch", "/students/:profileId/advisor", "advisor").status, 403);
  assert.equal(checkAdvisorRoute("patch", "/students/:profileId/advisor", "coordinator").continued, true);
});
