import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyWhatsappSignature,
  verifyWhatsappChallenge,
  dispatchDirectWhatsAppMessage,
} from "../src/lib/whatsapp-cloud";
import {
  normalizeWhatsAppNumber,
  maskWhatsAppNumber,
  verifyMetaSignature,
  verifyMetaWebhookChallenge,
  parseMetaWebhookStatuses,
  classifyProviderFailure,
} from "../src/lib/whatsapp";
import { SYSTEM_TEMPLATES, interpolateTemplate } from "../src/lib/whatsapp-templates";
import { getWhatsAppIntegrationStatus } from "../src/lib/whatsapp-config";

describe("EduLedger Direct WhatsApp Business Cloud API Integration", () => {
  const secret = "meta_app_secret_test_key_12345";
  const samplePayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID_98765",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "919876543210", phone_number_id: "1029384756" },
              statuses: [
                {
                  id: "wamid.HBgNNzk4NzY1NDMyMTAVAgARGBI1OTg3NkZDRDAxNDc=",
                  status: "delivered",
                  timestamp: "1763123456",
                  recipient_id: "919876543210",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  });

  it("verifies Meta webhook challenge correctly", () => {
    expect(verifyWhatsappChallenge("subscribe", "my_secret_token", "my_secret_token")).toBe(true);
    expect(verifyWhatsappChallenge("subscribe", "wrong_token", "my_secret_token")).toBe(false);
    expect(verifyWhatsappChallenge("unsubscribe", "my_secret_token", "my_secret_token")).toBe(false);
  });

  it("verifies Meta X-Hub-Signature-256 HMAC-SHA256 signature correctly", () => {
    const signature = "sha256=" + createHmac("sha256", secret).update(samplePayload, "utf8").digest("hex");
    expect(verifyWhatsappSignature(samplePayload, signature, secret)).toBe(true);
    expect(verifyMetaSignature(samplePayload, signature, secret)).toBe(true);
  });

  it("rejects tampered webhook payloads or invalid signatures", () => {
    const signature = "sha256=" + createHmac("sha256", secret).update(samplePayload, "utf8").digest("hex");
    const tampered = samplePayload.replace("delivered", "failed");
    expect(verifyWhatsappSignature(tampered, signature, secret)).toBe(false);
    expect(verifyWhatsappSignature(samplePayload, "sha256=invalid_hex", secret)).toBe(false);
  });

  it("correctly parses Meta Cloud API webhook delivery status events", () => {
    const statuses = parseMetaWebhookStatuses(samplePayload);
    expect(statuses.length).toBe(1);
    expect(statuses[0].status).toBe("delivered");
    expect(statuses[0].providerMessageId).toContain("wamid.");
    expect(statuses[0].timestamp).toBeInstanceOf(Date);
  });

  it("normalizes phone numbers to standard E.164 and masks accurately", () => {
    expect(normalizeWhatsAppNumber("9876543210")).toBe("+919876543210");
    expect(normalizeWhatsAppNumber("+91 98765 43210")).toBe("+919876543210");
    expect(normalizeWhatsAppNumber("09876543210")).toBe("+919876543210");

    const masked = maskWhatsAppNumber("+919876543210");
    expect(masked).toBe("+91••••••210");
  });

  it("correctly renders template variables with Kannada and English templates", () => {
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

  it("classifies provider errors into retryable vs permanent correctly", () => {
    expect(classifyProviderFailure(429)).toBe("retryable");
    expect(classifyProviderFailure(500)).toBe("retryable");
    expect(classifyProviderFailure(503)).toBe("retryable");
    expect(classifyProviderFailure(400)).toBe("permanent");
    expect(classifyProviderFailure(401)).toBe("permanent");
    expect(classifyProviderFailure(403)).toBe("permanent");
  });

  it("evaluates direct WhatsApp integration status safely without throwing", () => {
    const status = getWhatsAppIntegrationStatus();
    expect(status.provider).toBe("Direct WhatsApp Cloud API (Meta)");
    expect(["Not Configured", "Configured but Disabled", "Configured and Enabled"]).toContain(status.state);
  });

  it("safely reports unconfigured status when credentials are missing", async () => {
    const result = await dispatchDirectWhatsAppMessage({
      to: "+919876543210",
      text: "Test notification",
    });
    // In test environment where Meta credentials are empty, it must safely report not configured
    if (!process.env.WHATSAPP_ACCESS_TOKEN) {
      expect(result.success).toBe(false);
      expect(result.error).toContain("WhatsApp");
      expect(result.provider).toBe("whatsapp_cloud");
    }
  });
});
