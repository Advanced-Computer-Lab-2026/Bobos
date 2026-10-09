import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { login } from "./identity.controller.js";
import { User } from "../models/identity.js";
import { JWT_SECRET, requireAuth } from "../middleware/auth.middleware.js";
import { USER_ROLES } from "../models/shared.js";

const password = "TestPassword123!";
const passwordHash = await bcrypt.hash(password, 4);

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function account(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Test Student",
    email: "test@student.guc.edu.eg",
    role: "normalStudent",
    isActive: true,
    passwordHash,
    async save() {},
    ...overrides,
  };
}

function mockAccount(t, user) {
  return t.mock.method(User, "findOne", () => ({
    select(fields) {
      assert.equal(fields, "+passwordHash");
      return Promise.resolve(user);
    },
  }));
}

test("Requirement 1: all five active roles can log in and use their token", async (t) => {
  for (const role of USER_ROLES) {
    await t.test(role, async (t) => {
      const domain = ["normalStudent", "advisingStudent"].includes(role) ? "student.guc.edu.eg" : "guc.edu.eg";
      const user = account({ role, email: `test@${domain}` });
      const findOne = mockAccount(t, user);
      const save = t.mock.method(user, "save", async () => {});
      const res = response();

      await login({ body: { email: `  ${user.email.toUpperCase()}  `, password } }, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.deepEqual(findOne.mock.calls[0].arguments[0], { email: user.email });
      assert.equal(save.mock.callCount(), 1);
      assert.ok(user.lastLoginAt instanceof Date);
      assert.deepEqual(res.body.user, {
        _id: user._id, fullName: user.fullName, email: user.email, role,
      });
      assert.equal(JSON.stringify(res.body).includes(passwordHash), false);

      const claims = jwt.verify(res.body.token, JWT_SECRET);
      assert.equal(claims.id, user._id.toString());
      assert.equal(claims.role, role);
      assert.ok(claims.exp > claims.iat);

      t.mock.method(User, "findById", async (id) => {
        assert.equal(id, user._id.toString());
        return user;
      });
      const req = { headers: { authorization: `Bearer ${res.body.token}` } };
      let authenticated = false;
      await requireAuth(req, response(), () => { authenticated = true; });
      assert.equal(authenticated, true);
      assert.equal(req.user, user);
    });
  }
});

test("Requirement 1: missing, non-text, blank and non-GUC inputs are rejected before querying users", async (t) => {
  const findOne = t.mock.method(User, "findOne", () => { throw new Error("Unexpected database lookup"); });
  const bodies = [
    undefined, null, {},
    { email: "test@student.guc.edu.eg" },
    { email: 123, password },
    { email: { $ne: null }, password },
    { email: "test@student.guc.edu.eg", password: [password] },
    { email: "test@student.guc.edu.eg", password: "   " },
    { email: "   ", password },
    { email: "test@gmail.com", password },
    { email: "test@guc.edu.eg.attacker.com", password },
    { email: "test@@guc.edu.eg", password },
    { email: "@student.guc.edu.eg", password },
    { email: "test name@guc.edu.eg", password },
  ];
  for (const body of bodies) {
    const res = response();
    await login({ body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.token, undefined);
  }
  assert.equal(findOne.mock.callCount(), 0);
});

test("Requirement 1: unknown email and wrong password return the same credentials error", async (t) => {
  for (const [label, user] of [["unknown account", null], ["wrong password", account()]]) {
    await t.test(label, async (t) => {
      mockAccount(t, user);
      const save = user ? t.mock.method(user, "save", async () => {}) : null;
      const res = response();
      await login({ body: { email: "test@student.guc.edu.eg", password: "WrongPassword" } }, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.message, "Invalid email or password.");
      assert.equal(res.body.token, undefined);
      if (save) assert.equal(save.mock.callCount(), 0);
    });
  }
});

test("Requirement 1: inactive accounts cannot log in", async (t) => {
  const user = account({ isActive: false });
  mockAccount(t, user);
  const save = t.mock.method(user, "save", async () => {});
  const res = response();
  await login({ body: { email: user.email, password } }, res);
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /inactive/i);
  assert.equal(res.body.token, undefined);
  assert.equal(save.mock.callCount(), 0);
});

test("Requirement 1: a stored bcrypt hash or plaintext value cannot bypass password verification", async (t) => {
  for (const storedValue of [passwordHash, password]) {
    await t.test(storedValue === passwordHash ? "bcrypt hash supplied as password" : "plaintext stored value", async (t) => {
      const user = account({ passwordHash: storedValue });
      mockAccount(t, user);
      const save = t.mock.method(user, "save", async () => {});
      const res = response();
      await login({ body: { email: user.email, password: storedValue } }, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.token, undefined);
      assert.equal(save.mock.callCount(), 0);
    });
  }
});

test("Requirement 1: password whitespace is preserved when checking the hash", async (t) => {
  const spacedPassword = "  TestPassword123!  ";
  const user = account({ passwordHash: await bcrypt.hash(spacedPassword, 4) });
  mockAccount(t, user);
  const res = response();
  await login({ body: { email: user.email, password: spacedPassword } }, res);
  assert.equal(res.statusCode, 200);
});

test("Requirement 1: a database failure does not expose internal error details", async (t) => {
  t.mock.method(User, "findOne", () => { throw new Error("Internal database details"); });
  const res = response();
  await login({ body: { email: "test@student.guc.edu.eg", password } }, res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { success: false, message: "Login error." });
});

test("Requirement 1: bcrypt's 72-byte boundary cannot accept an appended password", async (t) => {
  const boundary = "x".repeat(72);
  const user = account({ passwordHash: await bcrypt.hash(boundary, 4) });
  mockAccount(t, user);
  const valid = response();
  await login({ body: { email: user.email, password: boundary } }, valid);
  assert.equal(valid.statusCode, 200);
  for (const password of [boundary + "wrong", "é".repeat(37)]) {
    const res = response();
    await login({ body: { email: user.email, password } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.token, undefined);
  }
});
