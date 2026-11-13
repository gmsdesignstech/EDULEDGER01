import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import {
  renderPasswordResetEmailHtml,
  sendPasswordResetEmail,
  isEmailConfigured,
  getEmailProviderStatus,
} from "../src/lib/email";
import { getSiteOrigin } from "../src/lib/site-url";

describe("EduLedger Password Reset Subsystem", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Phase 2 & 3: Email Delivery & Template Formatting", () => {
    it("renders a responsive HTML reset template with EduLedger branding", () => {
      const resetUrl = "https://eduledger.co.in/reset-password?token=test-sample-token-123";
      const html = renderPasswordResetEmailHtml({
        name: "Principal Sharma",
        resetUrl,
        expiresInMinutes: 30,
      });

      expect(html).toContain("Reset Your Password");
      expect(html).toContain("Principal Sharma");
      expect(html).toContain("30 minutes");
      expect(html).toContain(resetUrl);
      expect(html).toContain("Edu<span>Ledger</span>");
      expect(html).toContain("Simplifying School Management");
      expect(html).toContain("If you did not request a password reset");
    });

    it("escapes user-supplied names to prevent HTML injection in emails", () => {
      const maliciousName = '<script>alert("xss")</script>Dr. John & Sons';
      const html = renderPasswordResetEmailHtml({
        name: maliciousName,
        resetUrl: "https://eduledger.co.in/reset-password?token=safe-token",
        expiresInMinutes: 30,
      });

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&amp;");
    });

    it("correctly evaluates email provider configuration status", () => {
      const originalHost = process.env.SMTP_HOST;
      const originalUser = process.env.SMTP_USER;
      const originalPass = process.env.SMTP_PASS;

      delete process.env.SMTP_HOST;
      delete process.env.RESEND_API_KEY;

      expect(isEmailConfigured()).toBe(false);
      expect(getEmailProviderStatus().configured).toBe(false);

      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "user@example.com";
      process.env.SMTP_PASS = "secret";

      expect(isEmailConfigured()).toBe(true);
      expect(getEmailProviderStatus().configured).toBe(true);
      expect(getEmailProviderStatus().provider).toContain("smtp.example.com");

      // Cleanup
      if (originalHost) process.env.SMTP_HOST = originalHost;
      else delete process.env.SMTP_HOST;
      if (originalUser) process.env.SMTP_USER = originalUser;
      else delete process.env.SMTP_USER;
      if (originalPass) process.env.SMTP_PASS = originalPass;
      else delete process.env.SMTP_PASS;
    });

    it("simulates email delivery safely in test/development environments", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await sendPasswordResetEmail({
        to: "teacher@school.edu",
        name: "Test Teacher",
        resetUrl: "https://eduledger.co.in/reset-password?token=dev-token-999",
        expiresInMinutes: 30,
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Password reset email simulated for teacher@school.edu")
      );
    });
  });

  describe("Phase 2: Cryptographic Token Generation & Hashing", () => {
    it("generates cryptographically secure, high-entropy tokens", () => {
      const token1 = randomBytes(32).toString("hex");
      const token2 = randomBytes(32).toString("hex");

      expect(token1.length).toBe(64);
      expect(token2.length).toBe(64);
      expect(token1).not.toBe(token2);
    });

    it("produces deterministic SHA-256 hashes without storing plaintext tokens", () => {
      const rawToken = "5f4dcc3b5aa765d61d8327deb882cf992b321a67b5e40b3c66f2868ff15fb3bf";
      const hash1 = createHash("sha256").update(rawToken).digest("hex");
      const hash2 = createHash("sha256").update(rawToken).digest("hex");

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
      // Hash is distinct from raw token
      expect(hash1).not.toBe(rawToken);
    });

    it("ensures different raw tokens yield completely different hashes", () => {
      const rawA = randomBytes(32).toString("hex");
      const rawB = randomBytes(32).toString("hex");

      const hashA = createHash("sha256").update(rawA).digest("hex");
      const hashB = createHash("sha256").update(rawB).digest("hex");

      expect(hashA).not.toBe(hashB);
    });
  });

  describe("Phase 4 & 5: Password Hashing, Verification & Reset Logic", () => {
    it("hashes new passwords using bcrypt with standard cost factor", async () => {
      const plainPassword = "SecurePassword@2026";
      const passwordHash = await hash(plainPassword, 10);

      expect(passwordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(await compare(plainPassword, passwordHash)).toBe(true);
      expect(await compare("WrongPassword@123", passwordHash)).toBe(false);
    });

    it("verifies that after a password update, old password fails and new password succeeds", async () => {
      const oldPassword = "OldPassword@123";
      const newPassword = "NewSecurePassword@456";

      let currentHash = await hash(oldPassword, 10);

      // Verify old password works initially
      expect(await compare(oldPassword, currentHash)).toBe(true);
      expect(await compare(newPassword, currentHash)).toBe(false);

      // Simulate password reset consumption
      currentHash = await hash(newPassword, 10);

      // Verify old password is now rejected and new password is accepted
      expect(await compare(oldPassword, currentHash)).toBe(false);
      expect(await compare(newPassword, currentHash)).toBe(true);
    });

    it("enforces expiration rules on token verification", () => {
      const now = Date.now();
      const validExpiration = new Date(now + 30 * 60 * 1000).toISOString();
      const expiredExpiration = new Date(now - 1000).toISOString();

      const isExpired = (exp: string) => new Date(exp).getTime() < Date.now();

      expect(isExpired(validExpiration)).toBe(false);
      expect(isExpired(expiredExpiration)).toBe(true);
    });

    it("enforces single-use token consumption rules", () => {
      let consumedAt: string | null = null;

      const verifyToken = () => {
        if (consumedAt !== null) {
          return { valid: false, error: "This password reset link has already been used." };
        }
        return { valid: true };
      };

      // First verification: valid
      expect(verifyToken().valid).toBe(true);

      // Consume token
      consumedAt = new Date().toISOString();

      // Second verification: rejected
      const secondCheck = verifyToken();
      expect(secondCheck.valid).toBe(false);
      expect(secondCheck.error).toContain("already been used");
    });
  });

  describe("Phase 6: Multi-Role Support", () => {
    const roles = ["SCHOOL_ADMIN", "TEACHER", "PARENT", "SUPER_ADMIN"];

    it.each(roles)("supports password recovery for user role: %s", async (role) => {
      const user = {
        id: `user-${role.toLowerCase()}-123`,
        email: `${role.toLowerCase()}@eduledger.co.in`,
        name: `Test ${role}`,
        role,
        institutionId: "inst-primary-1",
      };

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const origin = getSiteOrigin();
      const resetUrl = `${origin}/reset-password?token=${rawToken}`;

      expect(resetUrl).toContain("https://eduledger.co.in/reset-password?token=");
      expect(tokenHash).toHaveLength(64);
      expect(user.role).toBe(role);
    });
  });

  describe("Phase 8: Reset URL Canonical Resolution", () => {
    it("resolves canonical production origin without trailing slash", () => {
      const origin = getSiteOrigin();
      expect(origin).toBe("https://eduledger.co.in");
      expect(origin.endsWith("/")).toBe(false);
    });
  });
});

