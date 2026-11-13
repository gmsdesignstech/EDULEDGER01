import "server-only";
import nodemailer from "nodemailer";

export type SendPasswordResetOptions = {
  to: string;
  name?: string;
  resetUrl: string;
  expiresInMinutes?: number;
};

/**
 * Checks whether an outbound email transport (SMTP or Resend) is configured.
 */
export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return true;
  return false;
}

export function getEmailProviderStatus() {
  if (process.env.RESEND_API_KEY) {
    return {
      configured: true,
      provider: "Resend",
      from: process.env.EMAIL_FROM || "EduLedger <no-reply@eduledger.co.in>",
    };
  }
  if (process.env.SMTP_HOST) {
    return {
      configured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
      provider: `SMTP (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`,
      from: process.env.SMTP_FROM || process.env.EMAIL_FROM || "EduLedger Support <no-reply@eduledger.co.in>",
    };
  }
  return {
    configured: false,
    provider: "None",
    from: "EduLedger Support <no-reply@eduledger.co.in>",
  };
}

/**
 * Creates a configured Nodemailer transporter or returns null if unconfigured.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Generates responsive, professional HTML template for password reset.
 */
export function renderPasswordResetEmailHtml(options: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): string {
  const { name, resetUrl, expiresInMinutes } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your EduLedger Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      padding: 36px 30px;
      text-align: center;
      color: #ffffff;
    }
    .logo-badge {
      display: inline-block;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #ffffff;
      margin-bottom: 6px;
    }
    .logo-badge span {
      color: #a855f7;
    }
    .tagline {
      font-size: 13px;
      color: #cbd5e1;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 700;
      margin: 0;
    }
    .content {
      padding: 36px 32px 30px 32px;
      color: #1e293b;
      line-height: 1.6;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      margin-top: 0;
      margin-bottom: 16px;
      color: #0f172a;
    }
    p {
      margin: 0 0 16px 0;
      font-size: 15px;
      color: #475569;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #9333ea 0%, #4f46e5 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 34px;
      border-radius: 12px;
      box-shadow: 0 4px 14px rgba(147, 51, 234, 0.35);
    }
    .link-fallback {
      background-color: #f1f5f9;
      padding: 14px 16px;
      border-radius: 10px;
      word-break: break-all;
      font-size: 12px;
      color: #64748b;
      margin: 20px 0;
      font-family: monospace;
    }
    .notice {
      border-left: 4px solid #a855f7;
      padding-left: 14px;
      margin: 24px 0 10px 0;
      font-size: 13px;
      color: #64748b;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px 30px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    .footer p {
      margin: 0 0 6px 0;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">Edu<span>Ledger</span></div>
        <p class="tagline">Simplifying School Management</p>
      </div>
      <div class="content">
        <h1>Reset Your Password</h1>
        <p>Hello ${escapeHtml(name)},</p>
        <p>We received a request to reset the password for your EduLedger account. Click the button below to choose a new, secure password:</p>
        <div class="btn-container">
          <a href="${escapeHtml(resetUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
        </div>
        <div class="notice">
          <strong>Security Notice:</strong> This reset link will expire in <strong>${expiresInMinutes} minutes</strong> and can only be used once.
        </div>
        <p style="margin-top: 24px; font-size: 13px;">If the button above does not work, copy and paste this secure link directly into your browser:</p>
        <div class="link-fallback">${escapeHtml(resetUrl)}</div>
        <p style="font-size: 13px; color: #64748b; margin-top: 24px;">If you did not request a password reset, you can safely ignore this email. Your account remains secure and your password will not be changed.</p>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} EduLedger &bull; GMS Designs and Tech &bull; All rights reserved.</p>
        <p>https://eduledger.co.in</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Dispatches a password reset email via configured email service.
 */
export async function sendPasswordResetEmail(
  options: SendPasswordResetOptions
): Promise<{ success: boolean; messageId?: string; simulated?: boolean }> {
  const { to, name = "User", resetUrl, expiresInMinutes = 30 } = options;
  const subject = "Reset Your EduLedger Password";
  const html = renderPasswordResetEmailHtml({ name, resetUrl, expiresInMinutes });
  const text = `Hello ${name},\n\nWe received a request to reset your password for your EduLedger account.\n\nClick the link below to choose a new password:\n${resetUrl}\n\nThis link is valid for ${expiresInMinutes} minutes and can only be used once.\n\nIf you did not request this, you can safely ignore this email.\n\n— EduLedger Support`;

  // 1. Try Resend if RESEND_API_KEY is present
  if (process.env.RESEND_API_KEY) {
    const from = process.env.EMAIL_FROM || "EduLedger <no-reply@eduledger.co.in>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API delivery error: ${errText}`);
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  }

  // 2. Try Nodemailer SMTP if configured
  const transporter = getTransporter();
  if (transporter) {
    const from =
      process.env.SMTP_FROM ||
      process.env.EMAIL_FROM ||
      `"EduLedger Support" <${process.env.SMTP_USER}>`;

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });

    return { success: true, messageId: info.messageId };
  }

  // 3. Fallback when email transport is not configured
  // In development / testing, log the simulation notice with the reset link
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[EmailService:Dev] Password reset email simulated for ${to}. Reset link: ${resetUrl}`
    );
    return { success: true, simulated: true };
  }

  // In production, throw so the caller knows SMTP credentials need to be set in Vercel
  throw new Error(
    "Outbound email service is not configured. Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in Vercel environment variables."
  );
}

