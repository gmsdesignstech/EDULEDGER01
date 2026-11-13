// src/lib/whatsapp-config.ts
/**
 * Central configuration for WhatsApp Cloud API + n8n automation integration.
 * All secrets are read from server‑only environment variables.
 */
import "server-only";

export const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";
export const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "";
export const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
export const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || "";
export const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET?.trim() || "";
export const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
export const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v21.0";

// n8n Webhook Configuration
export const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL?.trim() || "";
export const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET?.trim() || "";

// EduLedger outbound webhook signing secret
export const EDULEDGER_WEBHOOK_SECRET =
  process.env.EDULEDGER_WEBHOOK_SECRET?.trim() ||
  process.env.N8N_WEBHOOK_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  "eduledger-default-webhook-secret-change-in-production";

export type IntegrationLifecycleState =
  | "Not Configured"
  | "Configured but Disabled"
  | "Configured and Enabled";

/**
 * Check overall readiness of the WhatsApp Cloud API and n8n webhook setup.
 * Exposes the strict 3-state configuration lifecycle:
 * 1. "Not Configured" - Essential credentials missing
 * 2. "Configured but Disabled" - Credentials present but WHATSAPP_ENABLED !== "true"
 * 3. "Configured and Enabled" - Ready for active dispatching
 */
export function getWhatsAppIntegrationStatus() {
  const missing: string[] = [];
  if (!WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
  if (!WHATSAPP_PHONE_NUMBER_ID) missing.push("WHATSAPP_PHONE_NUMBER_ID");
  if (!WHATSAPP_BUSINESS_ACCOUNT_ID) missing.push("WHATSAPP_BUSINESS_ACCOUNT_ID");
  if (!N8N_WEBHOOK_URL) missing.push("N8N_WEBHOOK_URL");

  const whatsappConfigured = Boolean(
    WHATSAPP_ACCESS_TOKEN &&
    WHATSAPP_PHONE_NUMBER_ID &&
    WHATSAPP_BUSINESS_ACCOUNT_ID
  );

  const n8nConfigured = Boolean(N8N_WEBHOOK_URL);
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
    enabled: WHATSAPP_ENABLED,
    configured: fullyConfigured,
    whatsappConfigured,
    n8nConfigured,
    ready: WHATSAPP_ENABLED && fullyConfigured,
    missing,
    details: {
      hasAccessToken: Boolean(WHATSAPP_ACCESS_TOKEN),
      hasPhoneNumberId: Boolean(WHATSAPP_PHONE_NUMBER_ID),
      hasBusinessAccountId: Boolean(WHATSAPP_BUSINESS_ACCOUNT_ID),
      hasAppSecret: Boolean(WHATSAPP_APP_SECRET),
      hasN8nWebhookUrl: Boolean(N8N_WEBHOOK_URL),
      hasN8nSecret: Boolean(N8N_WEBHOOK_SECRET || EDULEDGER_WEBHOOK_SECRET),
      graphVersion: WHATSAPP_GRAPH_VERSION,
    },
  };
}
