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

const { Types } = mongoose;

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
  const { advisorId } = req.body;

  if (!Types.ObjectId.isValid(profileId)) {
    return res.status(400).json({ message: 'Invalid student profile ID' });
  }
  if (!advisorId || !Types.ObjectId.isValid(advisorId)) {
    return res.status(400).json({ message: 'advisorId is required and must be a valid ID' });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const profile = await StudentProfile.findOne(
      { _id: profileId, studentType: 'advising' },
      null,
      { session },
    );
    if (!profile) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Advising student profile not found' });
    }

    const advisor = await User.findOne(
      { _id: advisorId, role: 'advisor' },
      null,
      { session },
    );
    if (!advisor) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Advisor not found' });
    }

    const actorId = req.user._id;

    const existing = await AdvisorAssignment.findOne(
      { student: profileId, endedAt: null },
      null,
      { session },
    );
    if (existing) {
      existing.endedAt = new Date();
      existing.endedBy = actorId;
      await existing.save({ session });
    }

    await AdvisorAssignment.create(
      [{ student: profileId, advisor: advisorId, assignedBy: actorId }],
      { session },
    );

    profile.assignedAdvisor = advisorId;
    await profile.save({ session });

    await session.commitTransaction();

    const updated = await StudentProfile.findById(profileId)
      .populate('user', 'fullName email')
      .populate('assignedAdvisor', 'fullName email');

    return res.json(updated);
  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
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

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const baseMatch = { studentType: 'advising' };
    if (advisorId && Types.ObjectId.isValid(advisorId)) {
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
      const re = { $regex: search, $options: 'i' };
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

