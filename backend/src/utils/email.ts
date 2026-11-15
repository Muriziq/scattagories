const clientUrl = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.replace(/\/+$/, "")
  : "http://localhost:3000";

// Brevo (formerly Sendinblue) & Resend HTTPS API configuration
const brevoApiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.SENDER_EMAIL || process.env.EMAIL_USER || "scatterblitz1@gmail.com";
const senderName = process.env.SENDER_NAME || "ScatterBlitz";

/**
 * Dispatches an email payload via Brevo HTTPS REST API (Port 443 - never blocked by Render).
 * Falls back to console logging during development or when API keys are not configured.
 * Returns { success: boolean, error?: string } rather than throwing,
 * ensuring registration and auth endpoints never crash or leave users stuck.
 */
async function sendEmailPayload(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!brevoApiKey) {
    console.warn(
      "[Email Service] BREVO_API_KEY is not configured in environment variables. Email dispatch skipped."
    );
    return { success: false, error: "BREVO_API_KEY is not configured" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: options.to,
          },
        ],
        subject: options.subject,
        htmlContent: options.html,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn("[Email Service] Brevo API error:", data);
      return {
        success: false,
        error: data.message || `Brevo request failed with status ${response.status}`,
      };
    }

    console.log(`[Email Service] Successfully delivered email to ${options.to} via Brevo (messageId: ${data.messageId})`);
    return { success: true };
  } catch (err: any) {
    console.warn("[Email Service] Brevo request failed:", err?.message || err);
    return { success: false, error: err?.message || "Failed to send email via Brevo" };
  }
}

// Dispatches account verification email with 15-minute expiring link
export async function sendVerificationEmail(
  username: string,
  email: string,
  verifyToken: string
): Promise<{ success: boolean; error?: string }> {
  const verificationUrl = `${clientUrl}/user/verify-email?token=${verifyToken}`;

  // Always log verification link in console during local development or testing
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📧 [DEV VERIFICATION LINK for ${email}]:\n${verificationUrl}\n`);
  }

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

  const result = await sendEmailPayload({
    to: email,
    subject: "Verify your ScatterBlitz email address",
    html,
  });

  // If email failed (e.g. Resend 403 restriction), print the link so developer/tester is never blocked
  if (!result.success && process.env.NODE_ENV === "production") {
    console.log(`\n⚠️ [FALLBACK VERIFICATION LINK for ${email}]:\n${verificationUrl}\n`);
  }

  return result;
}

// Dispatches password reset link with 15-minute expiring token
export async function sendPasswordResetEmail(
  username: string,
  email: string,
  resetToken: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${clientUrl}/user/reset-password?token=${resetToken}`;

  // Always log reset link in console during local development or testing
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n🔑 [DEV RESET PASSWORD LINK for ${email}]:\n${resetUrl}\n`);
  }

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

  const result = await sendEmailPayload({
    to: email,
    subject: "Reset your ScatterBlitz password",
    html,
  });

  if (!result.success && process.env.NODE_ENV === "production") {
    console.log(`\n⚠️ [FALLBACK RESET PASSWORD LINK for ${email}]:\n${resetUrl}\n`);
  }

  return result;
}
