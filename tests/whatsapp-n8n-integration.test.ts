import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "../src/lib/whatsapp-n8n";
import { normalizeWhatsAppNumber, maskWhatsAppNumber } from "../src/lib/whatsapp";
import { SYSTEM_TEMPLATES, interpolateTemplate } from "../src/lib/whatsapp-templates";
import { N8N_WORKFLOWS_CATALOG } from "../src/lib/whatsapp-n8n-definitions";

describe("EduLedger n8n + WhatsApp Webhook Security & Dispatch", () => {
  const secret1 = "secret_primary_test_key_12345";
  const secret2 = "secret_fallback_test_key_67890";
  const samplePayload = JSON.stringify({
    eventId: "evt_test_123",
    eventType: "attendance.marked",
    student: { name: "Aarav Sharma" },
  });

  it("generates and verifies HMAC-SHA256 signature correctly", () => {
    const signature = signWebhookPayload(samplePayload, secret1);
    expect(signature.startsWith("sha256=")).toBe(true);
    expect(verifyWebhookSignature(samplePayload, signature, undefined, [secret1])).toBe(true);
  });

  it("rejects tampered payload or invalid signature", () => {
    const signature = signWebhookPayload(samplePayload, secret1);
    const tampered = samplePayload.replace("Aarav", "Rohan");
    expect(verifyWebhookSignature(tampered, signature, undefined, [secret1])).toBe(false);
    expect(verifyWebhookSignature(samplePayload, "sha256=invalidhex", undefined, [secret1])).toBe(false);
  });

  it("supports secret rotation (validates against primary or fallback secret)", () => {
    const sigWithSecret2 = signWebhookPayload(samplePayload, secret2);
    expect(verifyWebhookSignature(samplePayload, sigWithSecret2, undefined, [secret1, secret2])).toBe(true);
  });

  it("enforces timestamp replay attack prevention within 5 minutes", () => {
    const now = Date.now();
    const timestamp = now.toString();
    const payloadWithTime = `${timestamp}.${samplePayload}`;
    const signature = signWebhookPayload(payloadWithTime, secret1);

    // Valid recent timestamp
    expect(verifyWebhookSignature(samplePayload, signature, timestamp, [secret1])).toBe(true);

    // Replay attack: timestamp older than 5 minutes (e.g., 6 minutes ago)
    const staleTimestamp = (now - 6 * 60 * 1000).toString();
    expect(verifyWebhookSignature(samplePayload, signature, staleTimestamp, [secret1])).toBe(false);

    // Future timestamp beyond 5 minutes
    const futureTimestamp = (now + 6 * 60 * 1000).toString();
    expect(verifyWebhookSignature(samplePayload, signature, futureTimestamp, [secret1])).toBe(false);
  });

  it("normalizes phone numbers to standard E.164 and masks correctly", () => {
    expect(normalizeWhatsAppNumber("9876543210")).toBe("+919876543210");
    expect(normalizeWhatsAppNumber("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeWhatsAppNumber("09876543210")).toBe("+919876543210");

    const masked = maskWhatsAppNumber("+919876543210");
    expect(masked).toBe("+91••••••210");
  });

  it("correctly renders template variables with Kannada (ಕನ್ನಡ) and English templates", () => {
    const enTemplate = SYSTEM_TEMPLATES.find((t) => t.category.toLowerCase() === "attendance" && t.language === "en");
    expect(enTemplate).toBeDefined();

    const renderedEn = interpolateTemplate(enTemplate!.body, {
      school_name: "EduLedger Academy",
      student_name: "Aarav Sharma",
      class_name: "5",
      section: "A",
      attendance_date: "14-11-2026",
      attendance_status: "Absent",
    });
    expect(renderedEn).toContain("Aarav Sharma");
    expect(renderedEn).toContain("EduLedger Academy");

    const knTemplate = SYSTEM_TEMPLATES.find((t) => t.category.toLowerCase() === "attendance" && t.language === "kn");
    expect(knTemplate).toBeDefined();
    const renderedKn = interpolateTemplate(knTemplate!.body, {
      school_name: "ಎಡುಲೆಡ್ಜರ್ ಅಕಾಡೆಮಿ",
      student_name: "ಆರವ್ ಶರ್ಮಾ",
      class_name: "5",
      section: "A",
      attendance_date: "14-11-2026",
      attendance_status: "ಗೈರುಹಾಜರಿ",
    });
    expect(renderedKn).toContain("ಆರವ್ ಶರ್ಮಾ");
    expect(renderedKn).toContain("ಎಡುಲೆಡ್ಜರ್ ಅಕಾಡೆಮಿ");
  });

  it("catalogs all 8 n8n workflow definitions with metadata", () => {
    expect(N8N_WORKFLOWS_CATALOG.length).toBe(8);
    for (const wf of N8N_WORKFLOWS_CATALOG) {
      expect(wf.id).toBeDefined();
      expect(wf.name).toBeDefined();
      expect(wf.trigger).toBeDefined();
      expect(wf.filename).toBeDefined();
    }
  });
});
