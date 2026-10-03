import mongoose from "mongoose";
import { StudentWorkflowState } from "../models/academics.js";
import { AcademicTerm } from "../models/catalogue.js";
import { ACADEMIC_STANDINGS, STUDENT_TYPES, WORKFLOW_STATUSES } from "../models/shared.js";
import { StudentProfile, User } from "../models/identity.js";

const filterKeys = [
  "search",
  "studentType",
  "advisor",
  "major",
  "currentSemester",
  "academicStanding",
  "workflowStatus",
  "blockingStep",
  "accountStatus",
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function getStudents(req, res) {
  try {
    for (const key of filterKeys) {
      if (req.query[key] !== undefined && typeof req.query[key] !== "string") {
        return res.status(400).json({ message: "Invalid " + key + " filter" });
      }
    }

    const filters = Object.fromEntries(filterKeys.map((key) => [key, req.query[key]?.trim() ?? ""]));
    const {
      search,
      studentType,
      advisor,
      major,
      currentSemester,
      academicStanding,
      workflowStatus,
      blockingStep,
      accountStatus,
    } = filters;

    if (search.length > 100) return res.status(400).json({ message: "Search must be 100 characters or fewer" });
    if (studentType && !STUDENT_TYPES.includes(studentType)) {
      return res.status(400).json({ message: "Invalid student type" });
    }
    if (advisor && !mongoose.isValidObjectId(advisor)) {
      return res.status(400).json({ message: "Invalid advisor" });
    }
    if (major.length > 100) return res.status(400).json({ message: "Invalid major" });
    if (currentSemester) {
      const semester = Number(currentSemester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 10) {
        return res.status(400).json({ message: "Current semester must be between 1 and 10" });
      }
    }
    if (academicStanding && !ACADEMIC_STANDINGS.includes(academicStanding)) {
      return res.status(400).json({ message: "Invalid academic standing" });
    }
    if (workflowStatus && !WORKFLOW_STATUSES.includes(workflowStatus)) {
      return res.status(400).json({ message: "Invalid workflow status" });
    }
    if (blockingStep.length > 100) return res.status(400).json({ message: "Invalid blocking step" });
    if (accountStatus && !["active", "inactive"].includes(accountStatus)) {
      return res.status(400).json({ message: "Invalid account status" });
    }

    const searchPattern = search ? new RegExp(escapeRegex(search), "i") : null;
    const activeTerm = await AcademicTerm.findOne({ isActive: true })
      .sort({ termStart: -1 })
      .select("code academicYear season")
      .lean();
    const profileFilter = {};

    if (studentType) profileFilter.studentType = studentType;
    if (advisor) profileFilter.assignedAdvisor = advisor;
    if (major) profileFilter.major = major;
    if (currentSemester) profileFilter.currentSemester = Number(currentSemester);
    if (academicStanding) profileFilter.academicStanding = academicStanding;

    const userFilter = {};
    if (search) {
      userFilter.$or = [{ fullName: searchPattern }, { email: searchPattern }];
    }
    if (accountStatus) userFilter.isActive = accountStatus === "active";

    let matchingUserIds;
    if (search || accountStatus) matchingUserIds = await User.distinct("_id", userFilter);
    if (accountStatus) profileFilter.user = { $in: matchingUserIds };
    if (search) {
      profileFilter.$or = [
        { studentId: searchPattern },
        { user: { $in: matchingUserIds } },
      ];
    }

    if (workflowStatus || blockingStep) {
      const workflowFilter = { term: activeTerm?._id };
      if (workflowStatus) workflowFilter.status = workflowStatus;
      if (blockingStep) workflowFilter.blockingStep = blockingStep;
      const studentIds = activeTerm ? await StudentWorkflowState.distinct("student", workflowFilter) : [];
      profileFilter._id = { $in: studentIds };
    }

    const [profiles, advisors, majors, blockingSteps] = await Promise.all([
      StudentProfile.find(profileFilter)
        .select("user studentId studentType major currentSemester academicStanding assignedAdvisor")
        .populate("user", "fullName email isActive")
        .populate("assignedAdvisor", "fullName email")
        .sort({ studentId: 1 })
        .lean(),
      User.find({ role: "advisor" }).select("fullName email").sort({ fullName: 1 }).lean(),
      StudentProfile.distinct("major", { major: { $nin: [null, ""] } }),
      activeTerm
        ? StudentWorkflowState.distinct("blockingStep", {
            term: activeTerm._id,
            blockingStep: { $nin: [null, ""] },
          })
        : [],
    ]);

    const states = activeTerm && profiles.length
      ? await StudentWorkflowState.find({
          term: activeTerm._id,
          student: { $in: profiles.map((profile) => profile._id) },
        }).select("student status blockingStep lastActivityAt").lean()
      : [];
    const stateByStudent = new Map(states.map((state) => [String(state.student), state]));

    res.json({
      term: activeTerm ? {
        code: activeTerm.code,
        academicYear: activeTerm.academicYear,
        season: activeTerm.season,
      } : null,
      students: profiles.map((profile) => {
        const state = stateByStudent.get(String(profile._id));
        return {
          id: String(profile._id),
          studentId: profile.studentId,
          fullName: profile.user?.fullName ?? "",
          email: profile.user?.email ?? "",
          accountStatus: profile.user ? (profile.user.isActive ? "active" : "inactive") : null,
          studentType: profile.studentType,
          major: profile.major,
          currentSemester: profile.currentSemester,
          academicStanding: profile.academicStanding,
          assignedAdvisor: profile.assignedAdvisor ? {
            id: String(profile.assignedAdvisor._id),
            fullName: profile.assignedAdvisor.fullName,
            email: profile.assignedAdvisor.email,
          } : null,
          workflowStatus: state?.status ?? null,
          blockingStep: state?.blockingStep ?? null,
          lastUpdatedAt: state?.lastActivityAt ?? null,
        };
      }),
      filters: {
        studentTypes: STUDENT_TYPES,
        academicStandings: ACADEMIC_STANDINGS,
        workflowStatuses: WORKFLOW_STATUSES,
        advisors: advisors.map((user) => ({ id: String(user._id), fullName: user.fullName, email: user.email })),
        majors: majors.filter(Boolean).sort(),
        blockingSteps: blockingSteps.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
}
