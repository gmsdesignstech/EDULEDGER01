import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyRazorpaySignature } from "../src/lib/payment";
import { can } from "../src/lib/rbac";
import { ANNUAL_PRICE_PER_STUDENT, HISTORICAL_ANNUAL_PRICE_PER_STUDENT, STARTER_ANNUAL_PRICE, STARTER_PLAN_ID, STARTER_STUDENT_LIMIT, SUBSCRIPTION_PLANS, annualPricePerStudentForNewPurchase, annualSubscriptionPlan, getPlan, isValidSubscriptionPricing, planForStudentCount, starterPlanForStudentCount } from "../src/lib/subscription-plans";
import { addOneYear, capacityMessage, getDaysRemaining, getSubscriptionStatus, isSubscriptionActive, isVerifiedPaidSubscription, verifyWebhookSignature } from "../src/lib/subscription";

describe("authorization", () => {
  it("restricts student financial access", () => expect(can("STUDENT", "fees:write")).toBe(false));
  it("allows school admin attendance management", () => expect(can("SCHOOL_ADMIN", "attendance:write")).toBe(true));
});

describe("payment verification", () => {
  it("accepts only a valid HMAC", () => {
    const signature = createHmac("sha256", "secret").update("order|payment").digest("hex");
    expect(verifyRazorpaySignature("order", "payment", signature, "secret")).toBe(true);
    expect(verifyRazorpaySignature("order", "payment", "0".repeat(64), "secret")).toBe(false);
  });
  it("shows success only for server-recorded paid subscription states", () => {
    expect(isVerifiedPaidSubscription("ACTIVE", "Paid", "pay_1")).toBe(true);
    expect(isVerifiedPaidSubscription("UPCOMING", "Paid", "pay_2")).toBe(true);
    expect(isVerifiedPaidSubscription("EXPIRING_SOON", "Paid", "pay_3")).toBe(true);
    expect(isVerifiedPaidSubscription("PENDING", "Pending", null)).toBe(false);
    expect(isVerifiedPaidSubscription("ACTIVE", "Pending", "pay_4")).toBe(false);
  });
});

describe("annual subscriptions", () => {
  it("keeps Starter separate from the preserved annual service", () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(2);
    expect(getPlan("annual-service", 250, 50)).toMatchObject({ name: "Annual Service", price: 12500, studentCount: 250, pricePerStudent: 50, billingPeriod: "year" });
    expect(getPlan(STARTER_PLAN_ID, 100)).toMatchObject({ name: "EduLedger Starter", price: 10000, studentLimit: 100, pricingModel: "FIXED" });
    expect(getPlan("annual-service", 101, 100)).toMatchObject({ price: 10100, studentCount: 101, pricingModel: "PER_STUDENT" });
  });
  it("charges one fixed school fee from 1 through 99 students", () => {
    expect([1, 10, 33, 99].map((count) => starterPlanForStudentCount(count)?.price)).toEqual([10000, 10000, 10000, 10000]);
    expect(STARTER_ANNUAL_PRICE).toBe(10000);
    expect(STARTER_STUDENT_LIMIT).toBe(100);
  });
  it.each([[0,undefined],[1,10000],[10,10000],[18,10000],[50,10000],[76,10000],[99,10000],[100,10000],[101,10100],[150,15000],[200,20000]])("prices %i active students at %s",(count,amount)=>{
    expect(annualSubscriptionPlan(count)?.price).toBe(amount);
  });
  it("rejects zero and 101 students for Starter while accepting the 100-student boundary", () => {
    expect(starterPlanForStudentCount(0)).toBeUndefined();
    expect(starterPlanForStudentCount(100)?.price).toBe(10000);
    expect(starterPlanForStudentCount(101)).toBeUndefined();
    expect(() => getPlan(STARTER_PLAN_ID, 101)).toThrow("1–100");
  });
  it("validates fixed and legacy purchase snapshots", () => {
    expect(isValidSubscriptionPricing({ planId: STARTER_PLAN_ID, amountPaid: 10000, studentCount: 99, pricePerStudent: 0, pricingModel: "FIXED" })).toBe(true);
    expect(isValidSubscriptionPricing({ planId: STARTER_PLAN_ID, amountPaid: 10000, studentCount: 100, pricePerStudent: 0, pricingModel: "FIXED" })).toBe(true);
    expect(isValidSubscriptionPricing({ planId: STARTER_PLAN_ID, amountPaid: 5000, studentCount: 50, pricePerStudent: 100, pricingModel: "FIXED" })).toBe(false);
    expect(isValidSubscriptionPricing({ planId: "annual-service", amountPaid: 500, studentCount: 10, pricePerStudent: 50, pricingModel: "PER_STUDENT" })).toBe(true);
    expect(isValidSubscriptionPricing({ planId: STARTER_PLAN_ID, amountPaid: "10000", studentCount: "18", pricePerStudent: "0.00", pricingModel: "FIXED" })).toBe(true);
    expect(isValidSubscriptionPricing({ planId: "annual-service", amountPaid: "15000.00", studentCount: "150", pricePerStudent: "100.00", pricingModel: "PER_STUDENT" })).toBe(true);
  });
  it("uses ₹100 for future per-student purchases while retaining the historical constant", () => {
    expect(annualPricePerStudentForNewPurchase()).toBe(100);
    expect(ANNUAL_PRICE_PER_STUDENT).toBe(100);
    expect(HISTORICAL_ANNUAL_PRICE_PER_STUDENT).toBe(50);
    expect(planForStudentCount(250)).toMatchObject({ pricePerStudent: 100, price: 25000 });
  });
  it("calculates legacy totals from the server-selected rate", () => {
    expect([1, 10, 50, 100, 250].map((count) => planForStudentCount(count, 100)?.price)).toEqual([100, 1000, 5000, 10000, 25000]);
    expect(planForStudentCount(0, 100)).toBeUndefined();
    expect(planForStudentCount(-1, 100)).toBeUndefined();
    expect(planForStudentCount(1.5, 100)).toBeUndefined();
  });
  it("expires active subscriptions after their end date", () => expect(getSubscriptionStatus("ACTIVE", "2026-01-01T00:00:00.000Z", new Date("2026-09-11T00:00:00.000Z"))).toBe("EXPIRED"));
  it("adds one calendar year for activation and renewal", () => expect(addOneYear(new Date("2024-02-29T00:00:00.000Z")).toISOString()).toBe("2025-03-01T00:00:00.000Z"));
  it("returns capacity details without silently exceeding the plan", () => expect(capacityMessage(250, 250)).toContain("250 of 250"));
  it("verifies webhook signatures deterministically for idempotent event processing", () => {
    const body = JSON.stringify({ event: "payment.captured", id: "evt_1" });
    const signature = createHmac("sha256", "hook-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature, "hook-secret")).toBe(true);
    expect(verifyWebhookSignature(body, "0".repeat(64), "hook-secret")).toBe(false);
  });
});

describe("subscription lifecycle", () => {
  const now = new Date("2026-09-15T00:00:00.000Z");
  it("calculates days remaining in UTC", () => expect(getDaysRemaining("2026-09-30T00:00:00.000Z", now)).toBe(15));
  it("marks a valid plan expiring soon without removing access", () => {
    const status = getSubscriptionStatus("ACTIVE", "2026-09-30T00:00:00.000Z", now, 30);
    expect(status).toBe("EXPIRING_SOON");
    expect(isSubscriptionActive(status)).toBe(true);
  });
  it("never revives suspended or cancelled plans", () => {
    expect(getSubscriptionStatus("SUSPENDED", "2027-09-30T00:00:00.000Z", now)).toBe("SUSPENDED");
    expect(getSubscriptionStatus("CANCELLED", "2027-09-30T00:00:00.000Z", now)).toBe("CANCELLED");
  });
});
