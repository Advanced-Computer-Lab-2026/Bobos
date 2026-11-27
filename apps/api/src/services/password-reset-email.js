import { isSmtpConfigured, sendEmail } from "./smtp-email.js";

export const passwordResetEmail = {
  isConfigured: isSmtpConfigured,

  async sendOtp({ email, otp }) {
    if (!this.isConfigured()) throw new Error("Password-reset email is not configured");
    await sendEmail({
      to: email,
      subject: "Bobos password reset code",
      text: `Your one-time password reset code is ${otp}.\n\nIt expires in 10 minutes and can only be used once. If you did not request a password reset, you can ignore this email.`,
    });
  },
};
