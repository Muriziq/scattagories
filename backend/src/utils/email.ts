import { Resend } from "resend";

const clientUrl = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.replace(/\/+$/, "")
  : "http://localhost:3000";

// Resend HTTP API client (runs over HTTPS Port 443, never blocked by cloud hosts)
const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Dispatches an email payload via Resend HTTPS API.
 * Returns { success: boolean, error?: string } rather than throwing,
 * ensuring registration and auth endpoints never crash or leave users stuck.
 */
async function sendEmailPayload(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!resendClient) {
    console.warn(
      "[Email Service] RESEND_API_KEY is not configured in environment variables. Email dispatch skipped."
    );
    return { success: false, error: "RESEND_API_KEY is not configured" };
  }

  try {
    const fromAddress = process.env.RESEND_FROM || "ScatterBlitz <onboarding@resend.dev>";
    const { error } = await resendClient.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.warn("[Email Service] Resend API error:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email Service] Successfully sent email to ${options.to} via Resend`);
    return { success: true };
  } catch (err: any) {
    console.warn("[Email Service] Resend request failed:", err?.message || err);
    return { success: false, error: err?.message || "Failed to send email" };
  }
}

// Dispatches account verification email with 15-minute expiring link
export async function sendVerificationEmail(
  username: string,
  email: string,
  verifyToken: string
): Promise<{ success: boolean; error?: string }> {
  const verificationUrl = `${clientUrl}/user/verify-email?token=${verifyToken}`;

  const html = `
    <h2>Hello ${username}!</h2>
    <p>Welcome to ScatterBlitz. Please click the button below to verify your email address:</p>
    <p style="margin: 24px 0;">
      <a href="${verificationUrl}" style="padding: 12px 24px; background-color: #fa7301; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        Verify My Email
      </a>
    </p>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p><a href="${verificationUrl}" style="color: #f3b900;">${verificationUrl}</a></p>
    <p style="color: #888888; font-size: 0.85rem; margin-top: 20px;">This link will expire in 15 minutes.</p>
  `;

  return sendEmailPayload({
    to: email,
    subject: "Verify your ScatterBlitz email address",
    html,
  });
}

// Dispatches password reset link with 15-minute expiring token
export async function sendPasswordResetEmail(
  username: string,
  email: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${clientUrl}/user/reset-password?token=${resetToken}`;

  const html = `
    <h2>Hello ${username}!</h2>
    <p>We received a request to reset your password. Click the button below to set a new password:</p>
    <p style="margin: 24px 0;">
      <a href="${resetUrl}" style="padding: 12px 24px; background-color: #fa7301; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        Reset Password
      </a>
    </p>
    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}" style="color: #f3b900;">${resetUrl}</a></p>
    <p style="color: #888888; font-size: 0.85rem; margin-top: 20px;">This link will expire in 15 minutes. If you did not request this, you can safely ignore this email.</p>
  `;

  return sendEmailPayload({
    to: email,
    subject: "Reset your ScatterBlitz password",
    html,
  });
}
