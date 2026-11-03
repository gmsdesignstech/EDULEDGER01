import { describe, expect, it } from "vitest";
import {
  evaluateWhatsAppDispatchRateLimit,
  WHATSAPP_INSTITUTION_SENDS_PER_MINUTE,
  WHATSAPP_RECIPIENT_SENDS_PER_MINUTE,
} from "../src/lib/whatsapp-rate-limit";

describe("WhatsApp offline dispatch rate policy", () => {
  it("allows traffic below both conservative limits", () => {
    expect(evaluateWhatsAppDispatchRateLimit({ institutionDispatchesLastMinute: WHATSAPP_INSTITUTION_SENDS_PER_MINUTE - 1, recipientDispatchesLastMinute: WHATSAPP_RECIPIENT_SENDS_PER_MINUTE - 1 })).toEqual({ allowed: true });
  });

  it("defers an institution at its per-minute limit", () => {
    expect(evaluateWhatsAppDispatchRateLimit({ institutionDispatchesLastMinute: WHATSAPP_INSTITUTION_SENDS_PER_MINUTE, recipientDispatchesLastMinute: 0 })).toMatchObject({ allowed: false, reason: "institution_rate_limit" });
  });

  it("defers a recipient at its per-minute limit", () => {
    expect(evaluateWhatsAppDispatchRateLimit({ institutionDispatchesLastMinute: 0, recipientDispatchesLastMinute: WHATSAPP_RECIPIENT_SENDS_PER_MINUTE })).toMatchObject({ allowed: false, reason: "recipient_rate_limit" });
  });

  it("fails closed for contradictory or unavailable counter data", () => {
    expect(evaluateWhatsAppDispatchRateLimit({ institutionDispatchesLastMinute: Number.NaN, recipientDispatchesLastMinute: 0 })).toMatchObject({ allowed: false });
    expect(evaluateWhatsAppDispatchRateLimit({ institutionDispatchesLastMinute: -1, recipientDispatchesLastMinute: 0 })).toMatchObject({ allowed: false });
  });
});
