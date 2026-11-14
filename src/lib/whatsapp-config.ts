// src/lib/whatsapp-config.ts
/**
 * Central configuration for direct Meta WhatsApp Business Cloud API.
 * Single Direct WhatsApp Cloud API — n8n and alternative providers removed.
 * All secrets are read from server-only environment variables.
 */
import "server-only";

export const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";
export const WHATSAPP_DISPATCH_ENABLED = process.env.WHATSAPP_DISPATCH_ENABLED?.trim() === "1";
export const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
export const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
export const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || "";
export const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET?.trim() || "";
export const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
export const WHATSAPP_GRAPH_VERSION =
  process.env.WHATSAPP_GRAPH_VERSION?.trim() ||
  process.env.WHATSAPP_API_VERSION?.trim() ||
  "v21.0";
export const WHATSAPP_DOCUMENT_SIGNING_SECRET =
  process.env.WHATSAPP_DOCUMENT_SIGNING_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  "";

export type IntegrationLifecycleState =
  | "Not Configured"
  | "Configured but Disabled"
  | "Configured and Enabled";

/**
 * Check overall readiness of the Direct WhatsApp Cloud API setup.
 * Exposes the strict 3-state configuration lifecycle:
 * 1. "Not Configured" - Essential credentials missing
 * 2. "Configured but Disabled" - Credentials present but WHATSAPP_ENABLED !== "true" or WHATSAPP_DISPATCH_ENABLED !== "1"
 * 3. "Configured and Enabled" - Ready for active direct dispatching
 */
export function getWhatsAppIntegrationStatus() {
  const missing: string[] = [];
  if (!WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!WHATSAPP_PHONE_NUMBER_ID) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) missing.push("WHATSAPP_BUSINESS_ACCOUNT_ID");

  const whatsappConfigured = Boolean(
    WHATSAPP_ACCESS_TOKEN &&
    WHATSAPP_PHONE_NUMBER_ID &&
    WHATSAPP_BUSINESS_ACCOUNT_ID
  );

  const fullyConfigured = missing.length === 0;

  let state: IntegrationLifecycleState = "Not Configured";
  if (!fullyConfigured) {
    state = "Not Configured";
  } else if (!WHATSAPP_ENABLED) {
    state = "Configured but Disabled";
  } else {
    state = "Configured and Enabled";
  }

  return {
    state,
    provider: "Direct WhatsApp Cloud API (Meta)",
    enabled: WHATSAPP_ENABLED,
    dispatchEnabled: WHATSAPP_DISPATCH_ENABLED,
    configured: fullyConfigured,
    whatsappConfigured,
    ready: WHATSAPP_ENABLED && fullyConfigured,
    missing,
    details: {
      hasAccessToken: Boolean(WHATSAPP_ACCESS_TOKEN),
      hasPhoneNumberId: Boolean(WHATSAPP_PHONE_NUMBER_ID),
      hasBusinessAccountId: Boolean(WHATSAPP_BUSINESS_ACCOUNT_ID),
      hasAppSecret: Boolean(WHATSAPP_APP_SECRET),
      hasVerifyToken: Boolean(WHATSAPP_VERIFY_TOKEN),
      phoneNumberIdMasked: WHATSAPP_PHONE_NUMBER_ID
        ? `${WHATSAPP_PHONE_NUMBER_ID.slice(0, 4)}••••${WHATSAPP_PHONE_NUMBER_ID.slice(-4)}`
        : null,
      businessAccountIdMasked: WHATSAPP_BUSINESS_ACCOUNT_ID
        ? `${WHATSAPP_BUSINESS_ACCOUNT_ID.slice(0, 4)}••••${WHATSAPP_BUSINESS_ACCOUNT_ID.slice(-4)}`
        : null,
      graphVersion: WHATSAPP_GRAPH_VERSION,
    },
  };
}
