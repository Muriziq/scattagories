import nodemailer from "nodemailer";

const clientUrl = process.env.CLIENT_URL || "http://localhost:3000/user";

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendVerificationEmail(
  username: string,
  email: string,
  verifyToken: string
): Promise<void> {
  const verificationUrl = `${clientUrl}/verify-email?token=${verifyToken}`;
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Scattagories" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your email address",
    html: `
      <h2>Hello ${username}!</h2>
      <p>Welcome to Scatterblitz. Please click the link below to verify your account:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #e20c26; color: white; text-decoration: none; border-radius: 5px;">Verify My Email</a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${verificationUrl}</p>
      <p>This link will expire in 15 minutes.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export async function sendPasswordResetEmail(
  username: string,
  email: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Scattagories" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <h2>Hello ${username}!</h2>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #e20c26; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 15 minutes.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}
