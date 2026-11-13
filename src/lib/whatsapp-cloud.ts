// src/lib/whatsapp-cloud.ts
/**
 * Helper utilities for sending messages via WhatsApp Business Cloud API.
 * Uses native fetch and node:crypto (no external dependencies needed).
 * All secrets are read from server‑only environment variables.
 */
import "server-only";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";

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

/**
 * Send a WhatsApp message using the official Meta WhatsApp Business Cloud API.
 * Returns the WhatsApp message ID on success.
 */
export async function sendWhatsappMessage(
  payload: WhatsappMessagePayload,
  whatsappPhoneNumberId: string,
  accessToken: string,
  graphVersion = "v21.0"
): Promise<string> {
  const url = `https://graph.facebook.com/${graphVersion}/${whatsappPhoneNumberId}/messages`;
  // Clean phone number: remove any leading + sign as required by Meta Cloud API
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
    error?: { message?: string; code?: number };
  };

  if (!resp.ok) {
    const isRetryable = resp.status === 429 || resp.status >= 500;
    const errCode = data.error?.code;
    const isPermanent = resp.status === 400 || resp.status === 401 || resp.status === 403 || errCode === 100;
    const classification = isRetryable ? "[RETRYABLE]" : isPermanent ? "[PERMANENT]" : "[ERROR]";
    throw new Error(`WhatsApp Cloud API error (${resp.status}) ${classification}: ${data.error?.message || JSON.stringify(data)}`);
  }

  return data.messages?.[0]?.id ?? randomUUID();
}

/**
 * Verify a webhook signature sent by WhatsApp Business Cloud API.
 * The signature is HMAC‑SHA256 of the raw request body using the app secret.
 */
export function verifyWhatsappSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  appSecret: string
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
