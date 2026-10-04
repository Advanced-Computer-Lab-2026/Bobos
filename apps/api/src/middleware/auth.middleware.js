import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { User } from "../models/identity.js";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required in production");
}
// Set JWT_SECRET in .env to keep development sessions valid across API restarts.
export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString("hex");

/**
 * Generate a signed JWT for a given user document or object
 */
export const generateToken = (user) => {
  const userId = user._id ? user._id.toString() : user.id;
  return jwt.sign(
    {
      id: userId,
      role: user.role,
      email: user.email,
      authVersion: user.authVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/**
 * Authentication middleware.
 * Verifies Bearer JWT token from Authorization header and attaches the authenticated user to req.user.
 * Rejects unauthenticated, invalid, or expired tokens with 401 Unauthorized.
 */
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid Bearer token in Authorization header.",
      });
    }

    const token = authHeader.split(" ")[1]?.trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token missing.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    const userId = decoded.id || decoded.userId;
    if (typeof userId !== "string" || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user not found.",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive.",
      });
    }

    if ((decoded.authVersion ?? 0) !== (user.authVersion ?? 0)) {
      return res.status(401).json({
        success: false,
        message: "Your session has ended. Please log in again.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};
