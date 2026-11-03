export const WHATSAPP_INSTITUTION_SENDS_PER_MINUTE = 20;
export const WHATSAPP_RECIPIENT_SENDS_PER_MINUTE = 3;

export type WhatsAppRateLimitSnapshot = {
  institutionDispatchesLastMinute: number;
  recipientDispatchesLastMinute: number;
};

export type WhatsAppRateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: "institution_rate_limit" | "recipient_rate_limit"; retryAfterMs: number };

export function evaluateWhatsAppDispatchRateLimit(
  snapshot: WhatsAppRateLimitSnapshot,
): WhatsAppRateLimitDecision {
  if (
    !Number.isInteger(snapshot.institutionDispatchesLastMinute) ||
    !Number.isInteger(snapshot.recipientDispatchesLastMinute) ||
    snapshot.institutionDispatchesLastMinute < 0 ||
    snapshot.recipientDispatchesLastMinute < 0
  ) {
    return { allowed: false, reason: "institution_rate_limit", retryAfterMs: 60_000 };
  }
  if (snapshot.institutionDispatchesLastMinute >= WHATSAPP_INSTITUTION_SENDS_PER_MINUTE) {
    return { allowed: false, reason: "institution_rate_limit", retryAfterMs: 60_000 };
  }
  if (snapshot.recipientDispatchesLastMinute >= WHATSAPP_RECIPIENT_SENDS_PER_MINUTE) {
    return { allowed: false, reason: "recipient_rate_limit", retryAfterMs: 60_000 };
  }
  return { allowed: true };
}
