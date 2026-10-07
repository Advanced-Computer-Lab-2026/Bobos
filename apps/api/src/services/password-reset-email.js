import nodemailer from "nodemailer";

export const passwordResetEmail = {
  isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
  },

  async sendOtp({ email, otp }) {
    if (!this.isConfigured()) throw new Error("Password-reset email is not configured");
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === undefined
      ? port === 465
      : process.env.SMTP_SECURE === "true";
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      requireTLS: !secure && process.env.SMTP_REQUIRE_TLS !== "false",
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Bobos password reset code",
      text: `Your one-time password reset code is ${otp}.\n\nIt expires in 10 minutes and can only be used once. If you did not request a password reset, you can ignore this email.`,
    });
  },
};
