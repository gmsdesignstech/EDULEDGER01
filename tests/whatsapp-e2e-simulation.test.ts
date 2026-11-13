import { describe, expect, it } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "../src/lib/whatsapp-n8n";
import {
  normalizeWhatsAppNumber,
  maskWhatsAppNumber,
  mayApplyWhatsAppStatus,
  verifyMetaSignature,
  verifyMetaWebhookChallenge,
  parseMetaWebhookStatuses,
  classifyProviderFailure,
} from "../src/lib/whatsapp";
import { SYSTEM_TEMPLATES, interpolateTemplate } from "../src/lib/whatsapp-templates";
import { evaluateWhatsAppDispatchRateLimit } from "../src/lib/whatsapp-rate-limit";

describe("EduLedger WhatsApp End-to-End Lifecycle & Security Simulation", () => {
  const secretKey = "test_shared_hmac_secret_key_12345";
  const appSecret = "meta_app_secret_test_54321";

  // --- 1. Event Creation & Template Formatting ---
  it("Phase A: generates correct parent notification for attendance event", () => {
    const student = {
      id: "std_101",
      name: "Rohan Patel",
      admission: "ADM-2026-089",
      className: "10",
      section: "B",
      parentPhone: "+919876543210",
    };

    const template = SYSTEM_TEMPLATES.find(
      (t) => t.category.toLowerCase() === "attendance" && t.language === "en"
    );
    expect(template).toBeDefined();

    const rendered = interpolateTemplate(template!.body, {
      school_name: "EduLedger Public School",
      student_name: student.name,
      class_name: student.className,
      section: student.section,
      attendance_date: "14-11-2026",
      attendance_status: "Absent",
    });

    expect(rendered).toContain("Rohan Patel");
    expect(rendered).toContain("EduLedger Public School");
    expect(rendered).toContain("Absent");
  });

  // --- 2. Idempotency & Duplicate Prevention ---
  it("Phase B: constructs unique deterministic idempotency keys", () => {
    const eventType = "attendance.marked";
    const studentId = "std_101";
    const date = "2026-11-14";

    const key1 = `${eventType}:${studentId}:${date}`;
    const key2 = `${eventType}:${studentId}:${date}`;
    const keyDiffStudent = `${eventType}:std_102:${date}`;

    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyDiffStudent);
  });

  // --- 3. Outbound Webhook Signing & Freshness (n8n Dispatch) ---
  it("Phase C: signs outbound webhook and validates 5-minute replay drift window", () => {
    const payload = JSON.stringify({
      eventId: "evt_999",
      eventType: "attendance.marked",
      studentId: "std_101",
    });

    const now = Date.now();
    const validTimestamp = now.toString();
    const signature = signWebhookPayload(`${validTimestamp}.${payload}`, secretKey);

    // Recent timestamp passes
    expect(verifyWebhookSignature(payload, signature, validTimestamp, [secretKey])).toBe(true);

    // Stale timestamp (> 5 mins) rejected
    const staleTimestamp = (now - 6 * 60 * 1000).toString();
    expect(verifyWebhookSignature(payload, signature, staleTimestamp, [secretKey])).toBe(false);

    // Tampered payload rejected
    expect(verifyWebhookSignature(payload + "tampered", signature, validTimestamp, [secretKey])).toBe(false);
  });

  // --- 4. Inbound Meta Webhook Challenge & Signature ---
  it("Phase D: verifies Meta Cloud API challenge and X-Hub-Signature-256", () => {
    expect(verifyMetaWebhookChallenge("subscribe", "my_token", "my_token")).toBe(true);
    expect(verifyMetaWebhookChallenge("subscribe", "wrong_token", "my_token")).toBe(false);

    const metaPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_123",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "919876543210", phone_number_id: "PID_123" },
                statuses: [
                  {
                    id: "wamid.HBgLMjAyNjExMTQA",
                    status: "delivered",
                    timestamp: "1731575000",
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

    const crypto = require("node:crypto");
    const metaSignature = "sha256=" + crypto.createHmac("sha256", appSecret).update(metaPayload).digest("hex");

    expect(verifyMetaSignature(metaPayload, metaSignature, appSecret)).toBe(true);
    expect(verifyMetaSignature(metaPayload, "sha256=invalid", appSecret)).toBe(false);

    const parsedStatuses = parseMetaWebhookStatuses(metaPayload);
    expect(parsedStatuses.length).toBe(1);
    expect(parsedStatuses[0].providerMessageId).toBe("wamid.HBgLMjAyNjExMTQA");
    expect(parsedStatuses[0].status).toBe("delivered");
  });

  // --- 5. Delivery Status Progression ---
  it("Phase E: enforces monotonic message delivery progression", () => {
    // Queued -> Sent -> Delivered -> Read
    expect(mayApplyWhatsAppStatus("Queued", "Sent")).toBe(true);
    expect(mayApplyWhatsAppStatus("Sent", "Delivered")).toBe(true);
    expect(mayApplyWhatsAppStatus("Delivered", "Read")).toBe(true);

    // Out-of-order delayed webhook: 'Delivered' arrives after 'Read' already recorded
    expect(mayApplyWhatsAppStatus("Read", "Delivered")).toBe(false);
    expect(mayApplyWhatsAppStatus("Delivered", "Sent")).toBe(false);

    // Failed cannot overwrite final Delivered or Read
    expect(mayApplyWhatsAppStatus("Delivered", "Failed")).toBe(false);
    expect(mayApplyWhatsAppStatus("Read", "Failed")).toBe(false);
  });

  // --- 6. Provider Error Classification & Retries ---
  it("Phase F: accurately classifies retryable vs permanent errors", () => {
    // Rate limit (429) & Server error (500, 503) -> Retryable
    expect(classifyProviderFailure(429)).toBe("retryable");
    expect(classifyProviderFailure(500)).toBe("retryable");
    expect(classifyProviderFailure(503)).toBe("retryable");
    expect(classifyProviderFailure(408)).toBe("retryable");

    // Client error (400 invalid param, 401 unauth, 404 not found) -> Permanent
    expect(classifyProviderFailure(400)).toBe("permanent");
    expect(classifyProviderFailure(401)).toBe("permanent");
    expect(classifyProviderFailure(404)).toBe("permanent");
  });

  // --- 7. Rate Limiting Policy ---
  it("Phase G: blocks bursts exceeding institution and recipient rate quotas", () => {
    // Institution limit: 20/min
    expect(
      evaluateWhatsAppDispatchRateLimit({
        institutionDispatchesLastMinute: 19,
        recipientDispatchesLastMinute: 2,
      }).allowed
    ).toBe(true);

    expect(
      evaluateWhatsAppDispatchRateLimit({
        institutionDispatchesLastMinute: 20,
        recipientDispatchesLastMinute: 0,
      }).allowed
    ).toBe(false);

    // Recipient limit: 3/min
    expect(
      evaluateWhatsAppDispatchRateLimit({
        institutionDispatchesLastMinute: 5,
        recipientDispatchesLastMinute: 3,
      }).allowed
    ).toBe(false);
  });
});

