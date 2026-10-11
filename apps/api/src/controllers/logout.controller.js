import { User } from "../models/identity.js";

export const logout = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required." });
  }
  try {
    // Incrementing the persisted version makes every previously issued token stale.
    const result = await User.updateOne({ _id: req.user._id, isActive: true }, {
      $inc: { authVersion: 1 },
    });
    if (result.modifiedCount !== 1) {
      return res.status(401).json({ success: false, message: "The account is no longer available." });
    }
    return res.status(200).json({ success: true, message: "Logged out successfully from all sessions." });
  } catch {
    return res.status(500).json({ success: false, message: "Could not log out. Please try again." });
  }
};
