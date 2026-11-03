import { beforeEach, describe, expect, it, vi } from "vitest";
import { ANNUAL_SERVICE_PLAN_ID, STARTER_PLAN_ID } from "../src/lib/subscription-plans";

const boundary = vi.hoisted(() => ({
  user: { id: "admin-a", role: "SCHOOL_ADMIN", institutionId: "school-a" } as { id: string; role: string; institutionId: string } | undefined,
  activeCount: 1,
  createPendingSubscription: vi.fn(),
  findReusablePendingSubscription: vi.fn(),
  createRazorpayOrder: vi.fn(),
  getCapturedRazorpayPaymentForOrder: vi.fn(),
  activateVerifiedSubscription: vi.fn(),
}));

vi.mock("../src/lib/session", () => ({ currentUser: vi.fn(async () => boundary.user) }));
vi.mock("../src/lib/db", () => ({
  getSubscriptionBillingStudentCount: vi.fn(async () => boundary.activeCount),
  createPendingSubscription: boundary.createPendingSubscription,
  findReusablePendingSubscription: boundary.findReusablePendingSubscription,
  activateVerifiedSubscription: boundary.activateVerifiedSubscription,
}));
vi.mock("../src/lib/payment", () => ({
  createRazorpayOrder: boundary.createRazorpayOrder,
  getCapturedRazorpayPaymentForOrder: boundary.getCapturedRazorpayPaymentForOrder,
  razorpayPublicKey: vi.fn(() => "rzp_test_public"),
  paymentErrorMessage: vi.fn(() => "Payment service unavailable"),
  PaymentServiceError: class PaymentServiceError extends Error { code = "TEST"; status = 503; },
}));

import { POST } from "../src/app/api/subscription/order/route";

function request(body: Record<string, unknown>) {
  return new Request("http://local/api/subscription/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("subscription order authority boundary", () => {
  beforeEach(() => {
    boundary.user = { id: "admin-a", role: "SCHOOL_ADMIN", institutionId: "school-a" };
    boundary.activeCount = 1;
    boundary.createPendingSubscription.mockReset().mockResolvedValue(undefined);
    boundary.findReusablePendingSubscription.mockReset().mockResolvedValue(undefined);
    boundary.getCapturedRazorpayPaymentForOrder.mockReset().mockResolvedValue(undefined);
    boundary.activateVerifiedSubscription.mockReset().mockResolvedValue({status:"ACTIVE"});
    boundary.createRazorpayOrder.mockReset().mockResolvedValue({ id: "order-1", amount: 1_000_000, currency: "INR", key: "rzp_test_public" });
  });

  it("ignores forged count, price, and school fields for Starter", async () => {
    const response = await POST(request({ planId: STARTER_PLAN_ID, studentCount: 99, price: 1, institutionId: "school-b" }));
    expect(response.status).toBe(200);
    expect(boundary.createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 1_000_000, notes: expect.objectContaining({ institutionId: "school-a", studentCount: "1" }) }));
    expect(boundary.createPendingSubscription).toHaveBeenCalledWith("school-a", STARTER_PLAN_ID, "order-1", 1, 10_000, 0);
  });

  it.each([1,10,18,50,76,99,100])("charges the fixed ₹10,000 school fee for %i active students", async (count) => {
    boundary.activeCount = count;
    const response = await POST(request({ studentCount: 200, price: 1 }));
    expect(response.status).toBe(200);
    expect(boundary.createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 1_000_000 }));
    expect(boundary.createPendingSubscription).toHaveBeenCalledWith("school-a", STARTER_PLAN_ID, "order-1", count, 10_000, 0);
  });

  it("rejects zero active students even when the browser submits a stale count", async () => {
    boundary.activeCount = 0;
    const response = await POST(request({ planId: STARTER_PLAN_ID, studentCount: 77, price: 10_000 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"NO_ELIGIBLE_STUDENTS",verifiedStudentCount:0});
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it.each([[101,10_100],[120,12_000],[150,15_000],[200,20_000]])("uses ₹100 per active student for %i students", async (count,amount) => {
    boundary.activeCount = count;
    const response = await POST(request({ planId: STARTER_PLAN_ID, studentCount: 1, price: 1 }));
    expect(response.status).toBe(200);
    expect(boundary.createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: amount*100 }));
    expect(boundary.createPendingSubscription).toHaveBeenCalledWith("school-a", ANNUAL_SERVICE_PLAN_ID, "order-1", count, amount, 100);
  });

  it("requires an authenticated school administrator", async () => {
    boundary.user = { id: "teacher-a", role: "TEACHER", institutionId: "school-a" };
    expect((await POST(request({ planId: STARTER_PLAN_ID }))).status).toBe(403);
    boundary.user = { id: "super-a", role: "SUPER_ADMIN", institutionId: "system" };
    expect((await POST(request({ planId: STARTER_PLAN_ID }))).status).toBe(403);
    boundary.user = undefined;
    expect((await POST(request({ planId: STARTER_PLAN_ID }))).status).toBe(401);
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("reconciles a captured reusable order instead of reopening Razorpay", async () => {
    boundary.findReusablePendingSubscription.mockResolvedValue({orderId:"order-paid"});
    boundary.getCapturedRazorpayPaymentForOrder.mockResolvedValue({id:"pay-paid",order_id:"order-paid",amount:1_000_000,currency:"INR",status:"captured",captured:true});
    const response=await POST(request({}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({id:"order-paid",reused:true,verified:true});
    expect(boundary.activateVerifiedSubscription).toHaveBeenCalledWith("order-paid","pay-paid","provider-reconciliation");
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("refuses to reconcile a captured payment with the wrong amount", async () => {
    boundary.findReusablePendingSubscription.mockResolvedValue({orderId:"order-mismatch"});
    boundary.getCapturedRazorpayPaymentForOrder.mockResolvedValue({id:"pay-mismatch",order_id:"order-mismatch",amount:999,currency:"INR",status:"captured",captured:true});
    const response=await POST(request({}));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"PAYMENT_MISMATCH"});
    expect(boundary.activateVerifiedSubscription).not.toHaveBeenCalled();
  });
});
