// src/lib/whatsapp-cloud.ts
/**
 * Direct WhatsApp Business Cloud API Integration Engine for EduLedger.
 * Single Direct WhatsApp Cloud API — n8n and alternative providers removed.
 *
 * Uses official Meta WhatsApp Business Cloud API endpoints:
 *   POST https://graph.facebook.com/{version}/{phone_number_id}/messages
 *
 * All secrets are server-only.
 */
import "server-only";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import {
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_BUSINESS_ACCOUNT_ID,
  WHATSAPP_APP_SECRET,
  WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_GRAPH_VERSION,
  WHATSAPP_ENABLED,
  WHATSAPP_DISPATCH_ENABLED,
} from "./whatsapp-config";

export interface WhatsappMessagePayload {
  to: string; // E.164 formatted phone number (e.g. +919876543210 or 919876543210)
  type: "text" | "template";
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: Array<{
      type: "body";
      parameters: Array<{ type: "text"; text: string }>;
    }>;
  };
  messaging_product?: string;
}

export interface DirectDispatchParams {
  to: string;
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
  schoolId?: string;
  schoolName?: string;
  studentId?: string;
  parentName?: string;
}

export interface DirectDispatchResult {
  success: boolean;
  messageId: string;
  provider: "whatsapp_cloud";
  error?: string;
}

/**
 * Send a WhatsApp message directly using the official Meta WhatsApp Business Cloud API.
 * Returns the Meta WhatsApp message ID (`wamid.xxx`) on success.
 */
export async function sendWhatsappMessage(
  payload: WhatsappMessagePayload,
  whatsappPhoneNumberId: string,
  accessToken: string,
  graphVersion = "v21.0"
): Promise<string> {
  const url = `https://graph.facebook.com/${graphVersion}/${whatsappPhoneNumberId}/messages`;
  // Clean phone number: remove any non-digit characters as required by Meta Cloud API
  const cleanTo = payload.to.replace(/\D/g, "");
  const { to: _origTo, ...restPayload } = payload;
  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    ...restPayload,
    to: cleanTo,
    ...(payload.text ? { text: payload.text } : {}),
    ...(payload.template ? { template: payload.template } : {}),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await resp.json().catch(() => ({}))) as {
    messages?: Array<{ id: string }>;
    error?: { message?: string; code?: number; type?: string };
  };

  if (!resp.ok) {
    const isRetryable = resp.status === 429 || resp.status >= 500;
    const errCode = data.error?.code;
    const isPermanent =
      resp.status === 400 || resp.status === 401 || resp.status === 403 || errCode === 100;
    const classification = isRetryable ? "[RETRYABLE]" : isPermanent ? "[PERMANENT]" : "[ERROR]";
    throw new Error(
      `WhatsApp Cloud API error (${resp.status}) ${classification}: ${data.error?.message || JSON.stringify(data)}`
    );
  }

  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp Cloud API responded with success status but returned no message ID.");
  }

  return messageId;
}

/**
 * High-level direct dispatch function for EduLedger parent communications.
 * Sends directly to Meta WhatsApp Cloud API without any intermediary like n8n.
 */
export async function dispatchDirectWhatsAppMessage(
  params: DirectDispatchParams
): Promise<DirectDispatchResult> {
  const generatedId = `msg_${randomUUID()}`;

  // 1. Verify credentials existence
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    return {
      success: false,
      messageId: generatedId,
      provider: "whatsapp_cloud",
      error:
        "WhatsApp Cloud API is not configured. Complete the required server-side configuration (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID) to enable messaging.",
    };
  }

  // 2. Verify dispatch is enabled
  if (!WHATSAPP_ENABLED) {
    return {
      success: false,
      messageId: generatedId,
      provider: "whatsapp_cloud",
      error: "WhatsApp messaging is disabled in system configuration (WHATSAPP_ENABLED is false).",
    };
  }

  if (!WHATSAPP_DISPATCH_ENABLED) {
    return {
      success: false,
      messageId: generatedId,
      provider: "whatsapp_cloud",
      error: "WhatsApp active dispatch is disabled in system configuration (WHATSAPP_DISPATCH_ENABLED != 1).",
    };
  }

  // 3. Construct message payload
  const payload: WhatsappMessagePayload = params.templateName
    ? {
        to: params.to,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.templateLanguage || "en" },
          components: params.templateParameters?.length
            ? [
                {
                  type: "body",
                  parameters: params.templateParameters.map((text) => ({ type: "text", text })),
                },
              ]
            : undefined,
        },
      }
    : {
        to: params.to,
        type: "text",
        text: { body: params.text || "" },
      };

  // 4. Send directly to Meta WhatsApp Cloud API
  try {
    const waId = await sendWhatsappMessage(
      payload,
      WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_GRAPH_VERSION
    );

    return {
      success: true,
      messageId: waId,
      provider: "whatsapp_cloud",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "WhatsApp Cloud API error";
    return {
      success: false,
      messageId: generatedId,
      provider: "whatsapp_cloud",
      error: errorMsg,
    };
  }
}

/**
 * Verify a webhook signature sent by WhatsApp Business Cloud API.
 * The signature is HMAC-SHA256 of the raw request body using WHATSAPP_APP_SECRET.
 */
export function verifyWhatsappSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  appSecret = WHATSAPP_APP_SECRET
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const signature = signatureHeader.replace(/^sha256=/, "");
  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify the Webhook subscription challenge sent by Meta on webhook setup.
 */
export function verifyWhatsappChallenge(
  mode: string | null,
  token: string | null,
  expected = WHATSAPP_VERIFY_TOKEN
): boolean {
  if (mode !== "subscribe" || !token || !expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
