import mongoose from 'mongoose';
import {
  StudentProfile,
  User,
  AdvisorAssignment,
  StudentWorkflowState,
  SlotChangeRequest,
  ExtraHoursRequest,
  MandatoryCourseRemovalRequest,
  WholeScheduleSwapRequest,
} from '../models/index.js';
import { WORKFLOW_STATUSES } from '../models/shared.js';

const { Types } = mongoose;
const ADVISING_REASONS = ['probation', 'failedCourses', 'unattendedCourses', 'undeclaredMajor', 'transfer'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PENDING_REQUEST_MAP = {
  slotChange: {
    getCollection: () => SlotChangeRequest.collection.name,
    statusField: 'status',
    statusValue: 'pending',
  },
  extraHours: {
    getCollection: () => ExtraHoursRequest.collection.name,
    statusField: 'decisionStatus',
    statusValue: 'pending',
  },
  mandatoryCourseRemoval: {
    getCollection: () => MandatoryCourseRemovalRequest.collection.name,
    statusField: 'status',
    statusValue: 'pending',
  },
  scheduleSwap: {
    getCollection: () => WholeScheduleSwapRequest.collection.name,
    statusField: 'status',
    statusValue: 'open',
  },
};

export const listAdvisors = async (req, res) => {
  try {
    const advisors = await User.find(
      { role: 'advisor', isActive: true },
      'fullName email',
    );
    return res.json(advisors);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const assignAdvisor = async (req, res) => {
  const { profileId } = req.params;
  const advisorId = req.body?.advisorId;

  if (!Types.ObjectId.isValid(profileId)) {
    return res.status(400).json({ message: 'Invalid student profile ID' });
  }
  if (!advisorId || !Types.ObjectId.isValid(advisorId)) {
    return res.status(400).json({ message: 'advisorId is required and must be a valid ID' });
  }

  try {
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    const supportsTransactions = Boolean(topology.setName || topology.msg === 'isdbgrid');
    const actorId = req.user._id;

    if (supportsTransactions) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        const profile = await StudentProfile.findOne(
          { _id: profileId, studentType: 'advising' }, null, { session },
        );
        if (!profile) {
          await session.abortTransaction();
          return res.status(404).json({ message: 'Advising student profile not found' });
        }
        const advisor = await User.findOne(
          { _id: advisorId, role: 'advisor', isActive: true }, null, { session },
        );
        if (!advisor) {
          await session.abortTransaction();
          return res.status(404).json({ message: 'Active advisor not found' });
        }
        const existing = await AdvisorAssignment.findOne(
          { student: profileId, endedAt: null }, null, { session },
        );
        if (existing?.advisor.equals(advisor._id) && String(profile.assignedAdvisor) === String(advisor._id)) {
          await session.commitTransaction();
          const unchanged = await StudentProfile.findById(profileId)
            .populate('user', 'fullName email')
            .populate('assignedAdvisor', 'fullName email');
          return res.json(unchanged);
        }
        if (existing) {
          existing.endedAt = new Date();
          existing.endedBy = actorId;
          await existing.save({ session });
        }
        await AdvisorAssignment.create(
          [{ student: profileId, advisor: advisorId, assignedBy: actorId }], { session },
        );
        profile.assignedAdvisor = advisorId;
        await profile.save({ session });
        await session.commitTransaction();
      } catch (error) {
        if (session.inTransaction()) await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } else {
      // Local MongoDB commonly runs as a standalone server, where transactions are unavailable.
      // Apply the three writes in order and compensate if a later write fails.
      const profile = await StudentProfile.findOne({ _id: profileId, studentType: 'advising' });
      if (!profile) return res.status(404).json({ message: 'Advising student profile not found' });
      const advisor = await User.findOne({ _id: advisorId, role: 'advisor', isActive: true });
      if (!advisor) return res.status(404).json({ message: 'Active advisor not found' });
      const existing = await AdvisorAssignment.findOne({ student: profileId, endedAt: null });
      if (existing?.advisor.equals(advisor._id) && String(profile.assignedAdvisor) === String(advisor._id)) {
        const unchanged = await StudentProfile.findById(profileId)
          .populate('user', 'fullName email')
          .populate('assignedAdvisor', 'fullName email');
        return res.json(unchanged);
      }

      const previousAdvisor = profile.assignedAdvisor;
      const endedAt = existing ? new Date() : null;
      let newAssignment;
      try {
        if (existing) {
          existing.endedAt = endedAt;
          existing.endedBy = actorId;
          await existing.save();
        }
        newAssignment = await AdvisorAssignment.create({ student: profileId, advisor: advisorId, assignedBy: actorId });
        profile.assignedAdvisor = advisorId;
        await profile.save();
      } catch (error) {
        if (newAssignment) await AdvisorAssignment.deleteOne({ _id: newAssignment._id });
        if (existing) {
          existing.endedAt = null;
          existing.endedBy = null;
          await existing.save();
        }
        profile.assignedAdvisor = previousAdvisor;
        await profile.save();
        throw error;
      }
    }

    const updated = await StudentProfile.findById(profileId)
      .populate('user', 'fullName email')
      .populate('assignedAdvisor', 'fullName email');

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to assign advisor' });
  }
};

export const getMyAdvisor = async (req, res) => {
  try {
    const profile = await StudentProfile.findOne({ user: req.user._id })
      .populate('assignedAdvisor', 'fullName email');

    if (!profile) {
      return res.status(404).json({ message: 'Student profile not found' });
    }
    if (!profile.assignedAdvisor) {
      return res.status(404).json({ message: 'No advisor currently assigned' });
    }

    return res.json({
      fullName: profile.assignedAdvisor.fullName,
      email: profile.assignedAdvisor.email,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const listAdvisingStudents = async (req, res) => {
  try {
    const {
      search,
      advisorId,
      major,
      advisingReason,
      scheduleStatus,
      pendingRequestType,
      page = '1',
      limit = '20',
    } = req.query;

    for (const [name, value] of Object.entries({ search, advisorId, major, advisingReason, scheduleStatus, pendingRequestType, page, limit })) {
      if (value !== undefined && typeof value !== 'string') return res.status(400).json({ message: `Invalid ${name} filter` });
    }
    if (search && search.length > 100) return res.status(400).json({ message: 'Search must be 100 characters or fewer' });
    if (advisorId && !Types.ObjectId.isValid(advisorId)) return res.status(400).json({ message: 'Invalid advisor ID' });
    if (major && major.length > 100) return res.status(400).json({ message: 'Invalid major filter' });
    if (advisingReason && !ADVISING_REASONS.includes(advisingReason)) return res.status(400).json({ message: 'Invalid advising reason' });
    if (scheduleStatus && !WORKFLOW_STATUSES.includes(scheduleStatus)) return res.status(400).json({ message: 'Invalid schedule status' });
    if (pendingRequestType && !Object.hasOwn(PENDING_REQUEST_MAP, pendingRequestType)) return res.status(400).json({ message: 'Invalid pending request type' });
    if (!/^\d+$/.test(page) || !/^\d+$/.test(limit)) return res.status(400).json({ message: 'Page and limit must be positive integers' });
    const pageNum = Number(page);
    const limitNum = Number(limit);
    if (!Number.isSafeInteger(pageNum) || pageNum < 1 || !Number.isSafeInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ message: 'Page must be positive and limit must be between 1 and 100' });
    }
    const skip = (pageNum - 1) * limitNum;
    if (!Number.isSafeInteger(skip)) return res.status(400).json({ message: 'Page is too large' });

    const baseMatch = { studentType: 'advising' };
    if (advisorId) {
      baseMatch.assignedAdvisor = new Types.ObjectId(advisorId);
    }
    if (major) baseMatch.major = major;
    if (advisingReason) baseMatch.advisingReason = advisingReason;

    const pipeline = [
      { $match: baseMatch },
      {
        $lookup: {
          from: User.collection.name,
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: false } },
    ];

    if (search) {
      const re = { $regex: escapeRegex(search), $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { studentId: re },
            { 'userDoc.fullName': re },
            { 'userDoc.email': re },
          ],
        },
      });
    }

    pipeline.push(
      {
        $lookup: {
          from: StudentWorkflowState.collection.name,
          let: { sid: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$student', '$$sid'] } } },
            { $sort: { lastActivityAt: -1 } },
            { $limit: 1 },
          ],
          as: 'workflowDocs',
        },
      },
      {
        $addFields: { workflowState: { $arrayElemAt: ['$workflowDocs', 0] } },
      },
    );

    if (scheduleStatus) {
      pipeline.push({ $match: { 'workflowState.status': scheduleStatus } });
    }

    if (pendingRequestType && PENDING_REQUEST_MAP[pendingRequestType]) {
      const { getCollection, statusField, statusValue } = PENDING_REQUEST_MAP[pendingRequestType];
      pipeline.push(
        {
          $lookup: {
            from: getCollection(),
            let: { sid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$student', '$$sid'] },
                      { $eq: [`$${statusField}`, statusValue] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'pendingDocs',
          },
        },
        { $match: { 'pendingDocs.0': { $exists: true } } },
      );
    }

    pipeline.push(
      {
        $lookup: {
          from: User.collection.name,
          localField: 'assignedAdvisor',
          foreignField: '_id',
          as: 'advisorDoc',
        },
      },
      { $unwind: { path: '$advisorDoc', preserveNullAndEmptyArrays: true } },
    );

    const projectStage = {
      $project: {
        studentId: 1,
        major: 1,
        advisingReason: 1,
        enrollmentStatus: 1,
        updatedAt: 1,
        user: {
          _id: '$userDoc._id',
          fullName: '$userDoc.fullName',
          email: '$userDoc.email',
        },
        assignedAdvisor: {
          _id: '$advisorDoc._id',
          fullName: '$advisorDoc.fullName',
          email: '$advisorDoc.email',
        },
        workflowStatus: '$workflowState.status',
        blockingStep: '$workflowState.blockingStep',
        lastActivityAt: '$workflowState.lastActivityAt',
      },
    };

    const [countResult, students] = await Promise.all([
      StudentProfile.aggregate([...pipeline, { $count: 'total' }]),
      StudentProfile.aggregate([
        ...pipeline,
        { $skip: skip },
        { $limit: limitNum },
        projectStage,
      ]),
    ]);

    const total = countResult[0]?.total ?? 0;

    return res.json({
      data: students,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAdvisingStudent = async (req, res) => {
  const { profileId } = req.params;

  if (!Types.ObjectId.isValid(profileId)) {
    return res.status(400).json({ message: 'Invalid student profile ID' });
  }

  try {
    const profile = await StudentProfile.findOne(
      { _id: profileId, studentType: 'advising' },
    )
      .populate('user', 'fullName email')
      .populate('assignedAdvisor', 'fullName email');

    if (!profile) {
      return res.status(404).json({ message: 'Advising student profile not found' });
    }

    const [workflowState, assignmentHistory] = await Promise.all([
      StudentWorkflowState.findOne({ student: profileId }).sort({ lastActivityAt: -1 }),
      AdvisorAssignment.find({ student: profileId })
        .sort({ createdAt: -1 })
        .populate('advisor', 'fullName email')
        .populate('assignedBy', 'fullName email')
        .populate('endedBy', 'fullName email'),
    ]);

    return res.json({
      profile,
      workflowState: workflowState ?? null,
      assignmentHistory,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
