// src/lib/whatsapp-n8n.ts
/**
 * EduLedger n8n + WhatsApp Cloud API Integration Engine
 * Handles secure webhook dispatching to n8n with HMAC-SHA256 signatures,
 * E.164 phone normalization, consent checking, and multi-school isolation.
 */
import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  WHATSAPP_ENABLED,
  N8N_WEBHOOK_URL,
  N8N_WEBHOOK_SECRET,
  EDULEDGER_WEBHOOK_SECRET,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN,
  getWhatsAppIntegrationStatus,
} from "./whatsapp-config";
import { sendWhatsappMessage } from "./whatsapp-cloud";
import { maskWhatsAppNumber, normalizeWhatsAppNumber } from "./whatsapp";

export type WhatsAppEventType =
  | "attendance.marked"
  | "fee.reminder"
  | "fee.payment_received"
  | "examination.published"
  | "homework.published"
  | "announcement.published"
  | "leave.status_updated"
  | "timetable.updated"
  | "manual.custom_message";

export interface EventStudentPayload {
  id: string;
  name: string;
  admission: string;
  className: string;
  section: string;
  rollNumber?: string;
}

export interface EventParentPayload {
  name: string;
  phone: string;
  rawPhone: string;
  relationship?: string;
  hasConsent: boolean;
  optedOut: boolean;
}

export interface WebhookEventPayload {
  eventId: string;
  eventType: WhatsAppEventType;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  student: EventStudentPayload;
  parent: EventParentPayload;
  data: Record<string, unknown>;
  template: {
    name: string;
    category: string;
    language: string;
    renderedMessage: string;
  };
}

/**
 * Generate HMAC-SHA256 signature for outbound n8n webhooks.
 */
export function signWebhookPayload(payload: string, secret = EDULEDGER_WEBHOOK_SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Verify inbound webhook signature from n8n or internal webhook callers.
 * Supports:
 * - Secret rotation (checks primary EDULEDGER_WEBHOOK_SECRET, then N8N_WEBHOOK_SECRET)
 * - Replay attack prevention via timestamp header (5-minute window)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  timestampHeader?: string | undefined | null,
  secrets: string[] = [EDULEDGER_WEBHOOK_SECRET, N8N_WEBHOOK_SECRET].filter(Boolean)
): boolean {
  if (!signatureHeader || secrets.length === 0) return false;

  // Replay attack prevention: if timestamp header is provided, verify it is within 5 minutes
  if (timestampHeader) {
    const timestampMs = Number(timestampHeader);
    if (!Number.isFinite(timestampMs)) return false;
    const now = Date.now();
    const maxAgeMs = 5 * 60 * 1000; // 5 minutes
    if (Math.abs(now - timestampMs) > maxAgeMs) {
      return false; // Stale or future timestamp
    }
  }

  const signature = signatureHeader.replace(/^sha256=/, "");
  let signatureBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  for (const secret of secrets) {
    // If timestamp was provided, check both timestamp-prefixed and raw payload signatures
    const candidates = timestampHeader
      ? [`${timestampHeader}.${rawBody}`, rawBody]
      : [rawBody];

    for (const candidate of candidates) {
      const expected = createHmac("sha256", secret).update(candidate, "utf8").digest("hex");
      const expectedBuffer = Buffer.from(expected, "hex");
      if (
        expectedBuffer.length === signatureBuffer.length &&
        timingSafeEqual(expectedBuffer, signatureBuffer)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Dispatches an event to n8n webhook endpoint with HMAC signature and retry handling.
 * Returns { success, messageId, error }.
 */
export async function dispatchToN8n(
  event: WebhookEventPayload
): Promise<{ success: boolean; messageId: string; forwardedToN8n: boolean; error?: string }> {
  const messageId = `msg_${randomUUID()}`;
  const timestamp = Date.now().toString();
  const rawPayload = JSON.stringify({ ...event, messageId });
  const signature = signWebhookPayload(`${timestamp}.${rawPayload}`);

  // If n8n webhook URL is configured, forward securely to n8n
  if (N8N_WEBHOOK_URL) {
    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EduLedger-Signature": signature,
          "X-EduLedger-Timestamp": timestamp,
          "X-EduLedger-Event-Id": event.eventId,
          "X-EduLedger-Event-Type": event.eventType,
          "X-EduLedger-School-Id": event.schoolId,
        },
        body: rawPayload,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return {
          success: false,
          messageId,
          forwardedToN8n: true,
          error: `n8n webhook responded with status ${response.status}: ${errorText.slice(0, 200)}`,
        };
      }

      return { success: true, messageId, forwardedToN8n: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "n8n webhook network error";
      return {
        success: false,
        messageId,
        forwardedToN8n: true,
        error: `Could not reach n8n webhook (${N8N_WEBHOOK_URL}): ${errorMsg}`,
      };
    }
  }

  // Fallback: If n8n is not configured but direct WhatsApp Cloud credentials exist and WhatsApp is enabled
  if (WHATSAPP_ENABLED && WHATSAPP_PHONE_NUMBER_ID && WHATSAPP_ACCESS_TOKEN) {
    try {
      const waId = await sendWhatsappMessage(
        {
          to: event.parent.phone,
          type: "text",
          text: { body: event.template.renderedMessage },
        },
        WHATSAPP_PHONE_NUMBER_ID,
        WHATSAPP_ACCESS_TOKEN
      );
      return { success: true, messageId: waId, forwardedToN8n: false };
    } catch (err) {
      return {
        success: false,
        messageId,
        forwardedToN8n: false,
        error: err instanceof Error ? err.message : "WhatsApp Cloud API error",
      };
    }
  }

  // Neither n8n nor WhatsApp credentials active
  return {
    success: false,
    messageId,
    forwardedToN8n: false,
    error: "Neither n8n webhook (N8N_WEBHOOK_URL) nor direct WhatsApp credentials are fully configured on server.",
  };
}

