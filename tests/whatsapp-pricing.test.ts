import { describe, expect, it } from "vitest";
import {
  WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT,
  whatsappAddonQuote,
} from "../src/lib/whatsapp-pricing";
import { ANNUAL_PRICE_PER_STUDENT, HISTORICAL_ANNUAL_PRICE_PER_STUDENT } from "../src/lib/subscription-plans";

describe("WhatsApp Communication add-on pricing", () => {
  it("keeps ₹100 as the authoritative per-student annual rate", () => {
    expect(WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT).toBe(100);
  });

  it.each([
    [1, 10_000, "fixed"],
    [10, 10_000, "fixed"],
    [33, 10_000, "fixed"],
    [77, 10_000, "fixed"],
    [99, 10_000, "fixed"],
    [100, 10_000, "fixed"],
    [101, 10_100, "per-student"],
    [120, 12_000, "per-student"],
    [200, 20_000, "per-student"],
  ])("calculates %i students as ₹%i per year using %s pricing", (students, amount, pricingMethod) => {
    expect(whatsappAddonQuote(students)).toEqual({
      studentCount: students,
      pricePerStudent: 100,
      amount,
      billingPeriod: "year",
      pricingMethod,
    });
  });

  it("rejects invalid or understated eligible student counts", () => {
    expect(whatsappAddonQuote(0)).toBeUndefined();
    expect(whatsappAddonQuote(-1)).toBeUndefined();
    expect(whatsappAddonQuote(1.5)).toBeUndefined();
    expect(whatsappAddonQuote(9, 10)).toBeUndefined();
    expect(whatsappAddonQuote(100_001)).toBeUndefined();
  });

  it("does not change existing EduLedger subscription prices", () => {
    expect(HISTORICAL_ANNUAL_PRICE_PER_STUDENT).toBe(50);
    expect(ANNUAL_PRICE_PER_STUDENT).toBe(100);
  });
});
