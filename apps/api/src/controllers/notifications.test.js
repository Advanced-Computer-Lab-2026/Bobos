import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getMyNotifications, markNotificationAsRead } from "./notifications.controller.js";
import { Notification } from "../models/communications.js";

const createMockReqRes = ({ user = null, headers = {}, query = {}, body = {}, params = {} } = {}) => {
  const req = {
    user,
    headers: { ...headers },
    query: { ...query },
    body: { ...body },
    params: { ...params },
  };

  let statusCode = 200;
  let jsonBody = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonBody = data;
      return this;
    },
    getStatusCode() {
      return statusCode;
    },
    getBody() {
      return jsonBody;
    },
  };

  return { req, res };
};

test("Requirement 5: Unauthenticated user cannot retrieve notifications", async () => {
  // 1. Missing Authorization header at middleware level
  const { req: req1, res: res1 } = createMockReqRes({ headers: {} });
  let nextCalled1 = false;
  await requireAuth(req1, res1, () => { nextCalled1 = true; });

  assert.equal(nextCalled1, false, "next() must not be called when Authorization header is missing");
  assert.equal(res1.getStatusCode(), 401, "Expected 401 Unauthorized for missing auth");

  // 2. Controller-level check when user is not attached
  const { req: req2, res: res2 } = createMockReqRes({ user: null });
  await getMyNotifications(req2, res2);

  assert.equal(res2.getStatusCode(), 401);
  assert.equal(res2.getBody().success, false);
  assert.match(res2.getBody().message, /Authentication required/i);
});

test("Requirement 5: Unauthenticated user cannot mark a notification as read", async () => {
  const notificationId = new mongoose.Types.ObjectId();

  // 1. Missing Authorization header at middleware level
  const { req: req1, res: res1 } = createMockReqRes({
    headers: {},
    params: { id: notificationId.toString() },
  });
  let nextCalled1 = false;
  await requireAuth(req1, res1, () => { nextCalled1 = true; });

  assert.equal(nextCalled1, false);
  assert.equal(res1.getStatusCode(), 401);

  // 2. Controller-level check when req.user is null
  const { req: req2, res: res2 } = createMockReqRes({
    user: null,
    params: { id: notificationId.toString() },
  });
  await markNotificationAsRead(req2, res2);

  assert.equal(res2.getStatusCode(), 401);
  assert.equal(res2.getBody().success, false);
  assert.match(res2.getBody().message, /Authentication required/i);
});

test("Requirement 5: Each required role can retrieve their own notifications", async () => {
  const roles = [
    { role: "normalStudent", email: "student.norm@student.guc.edu.eg", name: "Normal Student" },
    { role: "advisingStudent", email: "student.adv@student.guc.edu.eg", name: "Advising Student" },
    { role: "advisor", email: "advisor@guc.edu.eg", name: "Dr. Advisor" },
    { role: "coordinator", email: "coord@guc.edu.eg", name: "Eng. Coordinator" },
    { role: "administrator", email: "admin@guc.edu.eg", name: "Admin" },
  ];

  const originalFind = Notification.find;

  for (const { role, email, name } of roles) {
    const userId = new mongoose.Types.ObjectId();
    const user = { _id: userId, email, role, fullName: name, isActive: true };

    const mockNotifs = [
      {
        _id: new mongoose.Types.ObjectId(),
        recipient: userId,
        type: "scheduleProcessed",
        title: `Welcome ${role}`,
        message: `Notification for ${name}`,
        channels: ["inApp"],
        deliveryStatus: "sent",
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    Notification.find = (filter) => {
      assert.equal(filter.recipient.toString(), userId.toString());
      return {
        sort: async () => mockNotifs,
      };
    };

    const { req, res } = createMockReqRes({ user });
    await getMyNotifications(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.notifications[0].title, `Welcome ${role}`);
    assert.equal(body.notifications[0].isRead, false);
  }

  Notification.find = originalFind;
});

test("Requirement 5: Only the authenticated user's notifications are returned", async () => {
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  const userA = {
    _id: userAId,
    fullName: "User A",
    email: "userA@student.guc.edu.eg",
    role: "normalStudent",
  };

  const originalFind = Notification.find;

  Notification.find = (filter) => {
    // Assert query explicitly filters by userA's ID only
    assert.equal(filter.recipient.toString(), userAId.toString());
    assert.notEqual(filter.recipient.toString(), userBId.toString());

    return {
      sort: async () => [
        {
          _id: new mongoose.Types.ObjectId(),
          recipient: userAId,
          type: "scheduleAssigned",
          title: "User A Schedule",
          message: "Only for User A",
          readAt: null,
          createdAt: new Date(),
        },
      ],
    };
  };

  try {
    // Attempt tampering: passing user B's ID in query and body
    const { req, res } = createMockReqRes({
      user: userA,
      query: { userId: userBId.toString(), recipient: userBId.toString() },
      body: { userId: userBId.toString() },
    });

    await getMyNotifications(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.count, 1);
    assert.equal(body.notifications[0].recipient.toString(), userAId.toString());
    assert.equal(body.notifications[0].title, "User A Schedule");
  } finally {
    Notification.find = originalFind;
  }
});

test("Requirement 5: Authenticated user can mark their own notification as read", async () => {
  const userId = new mongoose.Types.ObjectId();
  const notificationId = new mongoose.Types.ObjectId();

  const user = {
    _id: userId,
    fullName: "Student User",
    email: "student@student.guc.edu.eg",
    role: "normalStudent",
  };

  let saved = false;
  const mockNotification = {
    _id: notificationId,
    recipient: userId,
    type: "scheduleAssigned",
    title: "Schedule Update",
    message: "Your schedule is ready",
    readAt: null,
    channels: ["inApp"],
    deliveryStatus: "sent",
    createdAt: new Date("2026-03-01"),
    updatedAt: new Date("2026-03-01"),
    save: async function () {
      saved = true;
      return this;
    },
  };

  const originalFindById = Notification.findById;
  Notification.findById = async (id) => {
    if (id.toString() === notificationId.toString()) return mockNotification;
    return null;
  };

  try {
    const { req, res } = createMockReqRes({
      user,
      params: { id: notificationId.toString() },
    });

    await markNotificationAsRead(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.success, true);
    assert.equal(body.notification.isRead, true);
    assert.ok(body.notification.readAt instanceof Date);
    assert.equal(saved, true, "Notification must be saved with new readAt timestamp");
  } finally {
    Notification.findById = originalFindById;
  }
});

test("Requirement 5: Authenticated user cannot mark another user's notification as read", async () => {
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();
  const notificationBId = new mongoose.Types.ObjectId();

  const userA = {
    _id: userAId,
    fullName: "User A",
    email: "userA@student.guc.edu.eg",
    role: "normalStudent",
  };

  let saved = false;
  const mockNotificationB = {
    _id: notificationBId,
    recipient: userBId, // Belongs to User B!
    type: "probationWarning",
    title: "User B Warning",
    message: "Strictly for User B",
    readAt: null,
    save: async function () {
      saved = true;
      return this;
    },
  };

  const originalFindById = Notification.findById;
  Notification.findById = async (id) => {
    if (id.toString() === notificationBId.toString()) return mockNotificationB;
    return null;
  };

  try {
    const { req, res } = createMockReqRes({
      user: userA, // User A attempts to mark User B's notification
      params: { id: notificationBId.toString() },
    });

    await markNotificationAsRead(req, res);

    assert.equal(res.getStatusCode(), 403, "Must return 403 Forbidden");
    assert.equal(res.getBody().success, false);
    assert.match(res.getBody().message, /Access denied/i);
    assert.equal(saved, false, "Notification must NOT be saved");
    assert.equal(mockNotificationB.readAt, null, "readAt must remain null");
  } finally {
    Notification.findById = originalFindById;
  }
});

test("Requirement 5: Already-read notification can safely be marked read again (idempotent)", async () => {
  const userId = new mongoose.Types.ObjectId();
  const notificationId = new mongoose.Types.ObjectId();
  const initialReadAt = new Date("2026-03-01T10:00:00Z");

  const user = {
    _id: userId,
    fullName: "Student User",
    email: "student@student.guc.edu.eg",
    role: "normalStudent",
  };

  let saveCalled = false;
  const mockNotification = {
    _id: notificationId,
    recipient: userId,
    type: "scheduleAssigned",
    title: "Schedule Update",
    message: "Already read notice",
    readAt: initialReadAt,
    channels: ["inApp"],
    save: async function () {
      saveCalled = true;
      return this;
    },
  };

  const originalFindById = Notification.findById;
  Notification.findById = async (id) => mockNotification;

  try {
    const { req, res } = createMockReqRes({
      user,
      params: { id: notificationId.toString() },
    });

    await markNotificationAsRead(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.success, true);
    assert.equal(body.notification.isRead, true);
    assert.equal(body.notification.readAt.toISOString(), initialReadAt.toISOString());
    assert.equal(saveCalled, false, "Should not re-save if already read");
  } finally {
    Notification.findById = originalFindById;
  }
});

test("Requirement 5: Unread and read status is correctly returned", async () => {
  const userId = new mongoose.Types.ObjectId();
  const user = { _id: userId, email: "test@guc.edu.eg", role: "advisor" };

  const unreadDate = null;
  const readDate = new Date("2026-03-04T12:00:00Z");

  const mockNotifs = [
    {
      _id: new mongoose.Types.ObjectId(),
      recipient: userId,
      type: "advisorAssigned",
      title: "Unread Notification",
      message: "You have a new advising assignment",
      readAt: unreadDate,
      createdAt: new Date("2026-03-04T11:00:00Z"),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      recipient: userId,
      type: "scheduleReadyForReview",
      title: "Read Notification",
      message: "Schedule reviewed",
      readAt: readDate,
      createdAt: new Date("2026-03-03T11:00:00Z"),
    },
  ];

  const originalFind = Notification.find;
  Notification.find = () => ({
    sort: async () => mockNotifs,
  });

  try {
    const { req, res } = createMockReqRes({ user });
    await getMyNotifications(req, res);

    assert.equal(res.getStatusCode(), 200);
    const body = res.getBody();
    assert.equal(body.count, 2);

    const unread = body.notifications.find((n) => n.title === "Unread Notification");
    const read = body.notifications.find((n) => n.title === "Read Notification");

    assert.equal(unread.isRead, false);
    assert.equal(unread.readAt, null);

    assert.equal(read.isRead, true);
    assert.equal(read.readAt.toISOString(), readDate.toISOString());
  } finally {
    Notification.find = originalFind;
  }
});
