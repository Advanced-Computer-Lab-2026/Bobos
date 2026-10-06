// TEMPORARY DEV SHIM — delete once requirement 1 (login) is implemented by team A1.
// It exists only so the requirement-30 screens are demoable before the real
// /api/auth/login route lands. It performs NO password check and is never
// mounted when NODE_ENV === 'production' (see src/app.js).
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';

const tokenSchema = Joi.object({
  email: Joi.string().email().required()
});

// GET /api/dev/users
export async function listDevUsers(req, res, next) {
  try {
    const users = await User.find({ isActive: true })
      .select('fullName email role isActive')
      .sort({ role: 1, fullName: 1 })
      .lean();

    const students = await Student.find({ user: { $in: users.map((u) => u._id) } })
      .select('user studentId studentType major currentSemester')
      .lean();
    const byUser = new Map(students.map((s) => [String(s.user), s]));

    res.json({
      users: users.map((u) => ({
        ...u,
        student: byUser.get(String(u._id)) || null
      }))
    });
  } catch (err) { next(err); }
}

// POST /api/dev/token  { email } -> { token, user }
export async function issueDevToken(req, res, next) {
  try {
    const { value, error } = tokenSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const user = await User.findOne({ email: value.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });

    const token = jwt.sign(
      { id: String(user._id), role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: String(user._id),
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) { next(err); }
}
