import bcrypt from "bcryptjs";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { User } from "../models/identity.js";
import { JWT_SECRET } from "../middleware/auth.middleware.js";
import { passwordResetEmail } from "../services/password-reset-email.js";

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const REQUEST_MESSAGE = "If an active account exists for this email, a reset code will be sent. Please wait 60 seconds before requesting another code.";
const INVALID_CODE = "The reset code is invalid or expired. Please request a new code.";

function normalizeEmail(email) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@(student\.guc\.edu\.eg|guc\.edu\.eg)$/.test(normalized) ? normalized : null;
}

function hashOtp(userId, otp) {
  return createHmac("sha256", JWT_SECRET).update(`password-reset:${userId}:${otp}`).digest("hex");
}

function usableCodeFilter(userId, otpHash) {
  return {
    _id: userId,
    isActive: true,
    "passwordReset.otpHash": otpHash,
    "passwordReset.expiresAt": { $gt: new Date() },
    "passwordReset.attempts": { $lt: MAX_ATTEMPTS },
  };
}

export const requestPasswordReset = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ success: false, message: "Please use a valid GUC email address." });
  if (!passwordResetEmail.isConfigured()) {
    return res.status(503).json({ success: false, message: "Password-reset email is not configured. Please contact your administrator." });
  }

  try {
    const user = await User.findOne({ email, isActive: true });
    if (!user) return res.status(200).json({ success: true, message: REQUEST_MESSAGE });

    const now = new Date();
    const otp = String(randomInt(0, 1000000)).padStart(6, "0");
    const otpHash = hashOtp(user._id, otp);
    const result = await User.updateOne({
      _id: user._id,
      isActive: true,
      $or: [
        { "passwordReset.requestedAt": { $exists: false } },
        { "passwordReset.requestedAt": { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
      ],
    }, { $set: { passwordReset: {
      otpHash,
      expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
      requestedAt: now,
      attempts: 0,
    } } });

    if (result.modifiedCount === 1) {
      try {
        await passwordResetEmail.sendOtp({ email: user.email, otp });
      } catch {
        // Only clear this request, never a newer OTP created by another request.
        await User.updateOne({ _id: user._id, "passwordReset.otpHash": otpHash }, { $unset: { passwordReset: "" } });
        return res.status(503).json({ success: false, message: "The reset email could not be sent. Please try again later." });
      }
    }
    return res.status(200).json({ success: true, message: REQUEST_MESSAGE });
  } catch {
    return res.status(500).json({ success: false, message: "Could not request a password reset." });
  }
};

export const resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const { otp, newPassword } = req.body ?? {};
  if (!email || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: "A valid GUC email and six-digit reset code are required." });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8 || !newPassword.trim() || Buffer.byteLength(newPassword, "utf8") > 72) {
    return res.status(400).json({ success: false, message: "The new password must have at least 8 characters and at most 72 UTF-8 bytes." });
  }

  try {
    const user = await User.findOne({ email, isActive: true }).select("+passwordReset");
    const reset = user?.passwordReset;
    if (!reset || reset.expiresAt <= new Date() || reset.attempts >= MAX_ATTEMPTS) {
      return res.status(400).json({ success: false, message: INVALID_CODE });
    }
    const suppliedHash = Buffer.from(hashOtp(user._id, otp), "hex");
    const storedHash = Buffer.from(reset.otpHash, "hex");
    if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
      await User.updateOne(usableCodeFilter(user._id, reset.otpHash), { $inc: { "passwordReset.attempts": 1 } });
      return res.status(400).json({ success: false, message: INVALID_CODE });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // The matching OTP is consumed in the same atomic write as the password change.
    const result = await User.updateOne(usableCodeFilter(user._id, reset.otpHash), {
      $set: { passwordHash },
      $unset: { passwordReset: "" },
      $inc: { authVersion: 1 },
    });
    if (result.modifiedCount !== 1) {
      return res.status(400).json({ success: false, message: INVALID_CODE });
    }
    return res.status(200).json({ success: true, message: "Password reset successfully. Please log in with your new password." });
  } catch {
    return res.status(500).json({ success: false, message: "Could not reset your password." });
  }
};
