import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { requireAuth, generateToken, JWT_SECRET } from "../middleware/auth.middleware.js";
import { getProfile } from "./identity.controller.js";
import { User, StudentProfile } from "../models/identity.js";
import { StudentWorkflowState, StudentSchedule } from "../models/academics.js";

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

test("Requirement 4: Unauthenticated users cannot access the profile endpoint", async () => {
  // 1. Missing Authorization header
  const { req: req1, res: res1 } = createMockReqRes({ headers: {} });
  let nextCalled1 = false;
  await requireAuth(req1, res1, () => { nextCalled1 = true; });

  assert.equal(nextCalled1, false, "next() must not be called when Authorization header is missing");
  assert.equal(res1.getStatusCode(), 401, "Expected 401 Unauthorized for missing auth");
  assert.match(res1.getBody().message, /Authentication required/i);

  // 2. Invalid Bearer token
  const { req: req2, res: res2 } = createMockReqRes({
    headers: { authorization: "Bearer invalid.fake.token" },
  });
  let nextCalled2 = false;
  await requireAuth(req2, res2, () => { nextCalled2 = true; });

  assert.equal(nextCalled2, false, "next() must not be called with invalid token");
  assert.equal(res2.getStatusCode(), 401, "Expected 401 Unauthorized for invalid token");
  assert.match(res2.getBody().message, /Invalid or expired/i);
});

test("Requirement 4: requireAuth rejects expired tokens and deactivated accounts", async () => {
  const testUserId = new mongoose.Types.ObjectId();

  // Expired token test
  const expiredToken = jwt.sign(
    { id: testUserId.toString(), role: "normalStudent", email: "student@student.guc.edu.eg" },
    JWT_SECRET,
    { expiresIn: "-1s" }
  );

  const { req: reqExp, res: resExp } = createMockReqRes({
    headers: { authorization: `Bearer ${expiredToken}` },
  });
  let nextExp = false;
  await requireAuth(reqExp, resExp, () => { nextExp = true; });
  assert.equal(nextExp, false);
  assert.equal(resExp.getStatusCode(), 401);

  // Deactivated account test
  const validToken = generateToken({ _id: testUserId, role: "normalStudent", email: "student@student.guc.edu.eg" });
  const originalFindById = User.findById;

  User.findById = async (id) => ({
    _id: testUserId,
    email: "student@student.guc.edu.eg",
    role: "normalStudent",
    isActive: false, // Inactive account!
  });

  try {
    const { req: reqDeact, res: resDeact } = createMockReqRes({
      headers: { authorization: `Bearer ${validToken}` },
    });
    let nextDeact = false;
    await requireAuth(reqDeact, resDeact, () => { nextDeact = true; });

    assert.equal(nextDeact, false);
    assert.equal(resDeact.getStatusCode(), 401);
    assert.match(resDeact.getBody().message, /inactive/i);
  } finally {
    User.findById = originalFindById;
  }
});

test("Requirement 4: Normal Student can view their own profile with student-specific fields", async () => {
  const normalUserId = new mongoose.Types.ObjectId();
  const normalProfileId = new mongoose.Types.ObjectId();

  const normalUser = {
    _id: normalUserId,
    fullName: "Karim Farouk",
    email: "karim.normal@student.guc.edu.eg",
    role: "normalStudent",
    isActive: true,
  };

  const originalStudentProfileFindOne = StudentProfile.findOne;
  const originalWorkflowFindOne = StudentWorkflowState.findOne;

  StudentProfile.findOne = (query) => ({
    populate: async () => ({
      _id: normalProfileId,
      user: normalUserId,
      studentId: "28-12345",
      studentType: "normal",
      faculty: "MET",
      major: "Computer Science",
      currentSemester: 4,
      academicStanding: "goodAcademicStanding",
      assignedAdvisor: null,
    }),
  });

  StudentWorkflowState.findOne = () => ({
    sort: async () => ({
      status: "scheduleAssigned",
    }),
  });

  try {
    const { req, res } = createMockReqRes({ user: normalUser });
    await getProfile(req, res);

    assert.equal(res.getStatusCode(), 200);
    const { profile } = res.getBody();

    // Verify common fields
    assert.equal(profile.fullName, "Karim Farouk");
    assert.equal(profile.email, "karim.normal@student.guc.edu.eg");
    assert.equal(profile.role, "normalStudent");

    // Verify student-specific fields
    assert.equal(profile.studentId, "28-12345");
    assert.equal(profile.studentType, "normal");
    assert.equal(profile.major, "Computer Science");
    assert.equal(profile.currentSemester, 4);
    assert.equal(profile.academicStanding, "goodAcademicStanding");
    assert.equal(profile.assignedAdvisor, null);
    assert.equal(profile.scheduleStatus, "scheduleAssigned");
  } finally {
    StudentProfile.findOne = originalStudentProfileFindOne;
    StudentWorkflowState.findOne = originalWorkflowFindOne;
  }
});

test("Requirement 4: Advising Student can view their own profile including assigned advisor and schedule status", async () => {
  const advisingUserId = new mongoose.Types.ObjectId();
  const advisorUserId = new mongoose.Types.ObjectId();
  const advisingProfileId = new mongoose.Types.ObjectId();

  const advisingUser = {
    _id: advisingUserId,
    fullName: "Layla Tarek",
    email: "layla.advising@student.guc.edu.eg",
    role: "advisingStudent",
    isActive: true,
  };

  const advisorDoc = {
    _id: advisorUserId,
    fullName: "Dr. Sherif Hassan",
    email: "sherif.advisor@guc.edu.eg",
    role: "advisor",
  };

  const originalStudentProfileFindOne = StudentProfile.findOne;
  const originalWorkflowFindOne = StudentWorkflowState.findOne;

  StudentProfile.findOne = (query) => ({
    populate: async () => ({
      _id: advisingProfileId,
      user: advisingUserId,
      studentId: "26-54321",
      studentType: "advising",
      faculty: "MET",
      major: "Digital Media Engineering",
      currentSemester: 6,
      academicStanding: "probation",
      assignedAdvisor: advisorDoc,
    }),
  });

  StudentWorkflowState.findOne = () => ({
    sort: async () => ({
      status: "readyForStudentReview",
    }),
  });

  try {
    const { req, res } = createMockReqRes({ user: advisingUser });
    await getProfile(req, res);

    assert.equal(res.getStatusCode(), 200);
    const { profile } = res.getBody();

    // Common fields
    assert.equal(profile.fullName, "Layla Tarek");
    assert.equal(profile.email, "layla.advising@student.guc.edu.eg");
    assert.equal(profile.role, "advisingStudent");

    // Student fields
    assert.equal(profile.studentId, "26-54321");
    assert.equal(profile.studentType, "advising");
    assert.equal(profile.major, "Digital Media Engineering");
    assert.equal(profile.currentSemester, 6);
    assert.equal(profile.academicStanding, "probation");
    assert.deepEqual(profile.assignedAdvisor, {
      _id: advisorUserId,
      fullName: "Dr. Sherif Hassan",
      email: "sherif.advisor@guc.edu.eg",
    });
    assert.equal(profile.scheduleStatus, "readyForStudentReview");
  } finally {
    StudentProfile.findOne = originalStudentProfileFindOne;
    StudentWorkflowState.findOne = originalWorkflowFindOne;
  }
});

test("Requirement 4: Advisor can view their own profile (only applicable non-student fields)", async () => {
  const advisorUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Dr. Sherif Hassan",
    email: "sherif.advisor@guc.edu.eg",
    role: "advisor",
    isActive: true,
  };

  const { req, res } = createMockReqRes({ user: advisorUser });
  await getProfile(req, res);

  assert.equal(res.getStatusCode(), 200);
  const { profile } = res.getBody();

  // Role applicable fields
  assert.equal(profile.fullName, "Dr. Sherif Hassan");
  assert.equal(profile.email, "sherif.advisor@guc.edu.eg");
  assert.equal(profile.role, "advisor");

  // MUST NOT include student-specific fields
  assert.equal(profile.studentId, undefined);
  assert.equal(profile.studentType, undefined);
  assert.equal(profile.academicStanding, undefined);
  assert.equal(profile.assignedAdvisor, undefined);
  assert.equal(profile.scheduleStatus, undefined);
  assert.equal(profile.major, undefined);
  assert.equal(profile.currentSemester, undefined);
});

test("Requirement 4: Coordinator can view their own profile (only applicable non-student fields)", async () => {
  const coordinatorUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Eng. Nadia El-Sayed",
    email: "nadia.coordinator@guc.edu.eg",
    role: "coordinator",
    isActive: true,
  };

  const { req, res } = createMockReqRes({ user: coordinatorUser });
  await getProfile(req, res);

  assert.equal(res.getStatusCode(), 200);
  const { profile } = res.getBody();

  assert.equal(profile.fullName, "Eng. Nadia El-Sayed");
  assert.equal(profile.email, "nadia.coordinator@guc.edu.eg");
  assert.equal(profile.role, "coordinator");

  // MUST NOT include student-specific fields
  assert.equal(profile.studentId, undefined);
  assert.equal(profile.studentType, undefined);
  assert.equal(profile.academicStanding, undefined);
  assert.equal(profile.assignedAdvisor, undefined);
  assert.equal(profile.scheduleStatus, undefined);
});

test("Requirement 4: Administrator can view their own profile (only applicable non-student fields)", async () => {
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Dr. Laila Mansour",
    email: "admin@guc.edu.eg",
    role: "administrator",
    isActive: true,
  };

  const { req, res } = createMockReqRes({ user: adminUser });
  await getProfile(req, res);

  assert.equal(res.getStatusCode(), 200);
  const { profile } = res.getBody();

  assert.equal(profile.fullName, "Dr. Laila Mansour");
  assert.equal(profile.email, "admin@guc.edu.eg");
  assert.equal(profile.role, "administrator");

  // MUST NOT include student-specific fields
  assert.equal(profile.studentId, undefined);
  assert.equal(profile.studentType, undefined);
  assert.equal(profile.academicStanding, undefined);
  assert.equal(profile.assignedAdvisor, undefined);
  assert.equal(profile.scheduleStatus, undefined);
});

test("Requirement 4: Student-specific fields appear correctly for students", async () => {
  const studentUser = {
    _id: new mongoose.Types.ObjectId(),
    fullName: "Omar Student",
    email: "omar.student@student.guc.edu.eg",
    role: "normalStudent",
    isActive: true,
  };

  const originalStudentProfileFindOne = StudentProfile.findOne;
  const originalWorkflowFindOne = StudentWorkflowState.findOne;

  StudentProfile.findOne = () => ({
    populate: async () => ({
      _id: new mongoose.Types.ObjectId(),
      studentId: "29-99999",
      studentType: "normal",
      major: "Networks",
      currentSemester: 5,
      academicStanding: "goodAcademicStanding",
      assignedAdvisor: null,
    }),
  });

  StudentWorkflowState.findOne = () => ({
    sort: async () => ({
      status: "scheduleAssigned",
    }),
  });

  try {
    const { req, res } = createMockReqRes({ user: studentUser });
    await getProfile(req, res);

    const { profile } = res.getBody();
    // Validate each student-specific field explicitly
    assert.ok("studentId" in profile, "Profile must contain studentId");
    assert.ok("studentType" in profile, "Profile must contain studentType");
    assert.ok("major" in profile, "Profile must contain major");
    assert.ok("currentSemester" in profile, "Profile must contain currentSemester");
    assert.ok("academicStanding" in profile, "Profile must contain academicStanding");
    assert.ok("assignedAdvisor" in profile, "Profile must contain assignedAdvisor");
    assert.ok("scheduleStatus" in profile, "Profile must contain scheduleStatus");
  } finally {
    StudentProfile.findOne = originalStudentProfileFindOne;
    StudentWorkflowState.findOne = originalWorkflowFindOne;
  }
});

test("Requirement 4: A user cannot access another user's profile via query params or request body", async () => {
  const victimId = new mongoose.Types.ObjectId();
  const attackerId = new mongoose.Types.ObjectId();

  const attackerUser = {
    _id: attackerId,
    fullName: "Attacker User",
    email: "attacker@guc.edu.eg",
    role: "coordinator",
    isActive: true,
  };

  // Attacker tries to inject victim's user ID into query string and request body
  const { req, res } = createMockReqRes({
    user: attackerUser,
    query: { userId: victimId.toString(), email: "victim@student.guc.edu.eg" },
    body: { userId: victimId.toString() },
    params: { id: victimId.toString() },
  });

  await getProfile(req, res);

  assert.equal(res.getStatusCode(), 200);
  const { profile } = res.getBody();

  // The profile returned MUST be attackerUser's profile, NOT the victim's
  assert.equal(profile.fullName, "Attacker User");
  assert.equal(profile.email, "attacker@guc.edu.eg");
  assert.notEqual(profile._id?.toString(), victimId.toString());
  assert.equal(profile._id?.toString(), attackerId.toString());
});
