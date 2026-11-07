import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  context: {
    user: { id: "parent-a", role: "PARENT", institutionId: "school-a" },
  },
  fee: {
    id: "fee-a",
    invoiceNumber: "INV-001",
    pendingAmount: 250,
    finalAmount: 250,
    status: "Pending",
  } as Record<string, unknown> | undefined,
  order: {
    id: "order-a",
    amount: 25_000,
    currency: "INR",
    notes: { feeId: "fee-a", studentId: "student-a", institutionId: "school-a", parentUserId: "parent-a" },
  } as Record<string, unknown>,
  providerPayment: {
    id: "payment-a",
    order_id: "order-a",
    amount: 25_000,
    currency: "INR",
    status: "captured",
    captured: true,
  } as Record<string, unknown>,
  signatureValid: true,
  recordPayment: vi.fn(),
  getParentChildFeeInvoice: vi.fn(),
  getRazorpayOrder: vi.fn(),
  getRazorpayPayment: vi.fn(),
  verifyRazorpaySignature: vi.fn(),
}));

vi.mock("../src/lib/parent-auth", () => ({
  parentApiContext: vi.fn(async () => boundary.context),
  parentNoStore: { "Cache-Control": "private, no-store" },
}));
vi.mock("../src/lib/db", () => ({
  getParentChildFeeInvoice: boundary.getParentChildFeeInvoice,
  recordPayment: boundary.recordPayment,
}));
vi.mock("../src/lib/payment", () => ({
  getRazorpayOrder: boundary.getRazorpayOrder,
  getRazorpayPayment: boundary.getRazorpayPayment,
  verifyRazorpaySignature: boundary.verifyRazorpaySignature,
}));

import { POST } from "../src/app/api/parent/children/[id]/verify-payment/route";

function request(payload: Record<string, unknown> = {}) {
  return new Request("http://local/api/parent/children/student-a/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      feeId: "fee-a",
      razorpay_order_id: "order-a",
      razorpay_payment_id: "payment-a",
      razorpay_signature: "signed",
      ...payload,
    }),
  });
}

describe("parent fee Razorpay verification boundary", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = "test-only-secret";
    boundary.context = {
      user: { id: "parent-a", role: "PARENT", institutionId: "school-a" },
    };
    boundary.fee = {
      id: "fee-a",
      invoiceNumber: "INV-001",
      pendingAmount: 250,
      finalAmount: 250,
      status: "Pending",
    };
    boundary.order = {
      id: "order-a",
      amount: 25_000,
      currency: "INR",
      notes: { feeId: "fee-a", studentId: "student-a", institutionId: "school-a", parentUserId: "parent-a" },
    };
    boundary.providerPayment = {
      id: "payment-a",
      order_id: "order-a",
      amount: 25_000,
      currency: "INR",
      status: "captured",
      captured: true,
    };
    boundary.signatureValid = true;
    boundary.recordPayment.mockReset().mockResolvedValue({ id: "payment-record-a" });
    boundary.getParentChildFeeInvoice.mockReset().mockResolvedValue(boundary.fee);
    boundary.getRazorpayOrder.mockReset().mockImplementation(async () => boundary.order);
    boundary.getRazorpayPayment.mockReset().mockImplementation(async () => boundary.providerPayment);
    boundary.verifyRazorpaySignature.mockReset().mockImplementation(() => boundary.signatureValid);
  });

  it("records only the provider-confirmed captured amount and uses payment idempotency", async () => {
    const response = await POST(request({ amount: 0.01 } as Record<string, unknown>), {
      params: Promise.resolve({ id: "student-a" }),
    });
    expect(response.status).toBe(200);
    expect(boundary.recordPayment).toHaveBeenCalledWith("school-a", "parent-a", expect.objectContaining({
      feeId: "fee-a",
      amount: 250,
      transactionId: "payment-a",
      requestId: "razorpay:payment-a",
    }));
  });

  it("requires a signature and configured verification secret", async () => {
    expect((await POST(request({ razorpay_signature: "" }), { params: Promise.resolve({ id: "student-a" }) })).status).toBe(400);
    delete process.env.RAZORPAY_KEY_SECRET;
    expect((await POST(request(), { params: Promise.resolve({ id: "student-a" }) })).status).toBe(503);
    expect(boundary.recordPayment).not.toHaveBeenCalled();
  });

  it.each([
    [{ signatureValid: false }, 400],
    [{ order: { ...boundary.order, notes: { ...boundary.order.notes, studentId: "student-b" } } }, 409],
    [{ order: { ...boundary.order, notes: { ...boundary.order.notes, institutionId: "school-b" } } }, 409],
    [{ providerPayment: { ...boundary.providerPayment, order_id: "order-b" } }, 409],
    [{ providerPayment: { ...boundary.providerPayment, amount: 24_999 } }, 409],
    [{ providerPayment: { ...boundary.providerPayment, status: "authorized", captured: false } }, 409],
  ])("rejects forged, unrelated, mismatched, or uncaptured provider state", async (change, status) => {
    if ("signatureValid" in change) boundary.signatureValid = change.signatureValid;
    if ("order" in change) boundary.order = change.order;
    if ("providerPayment" in change) boundary.providerPayment = change.providerPayment;
    const response = await POST(request(), { params: Promise.resolve({ id: "student-a" }) });
    expect(response.status).toBe(status);
    expect(boundary.recordPayment).not.toHaveBeenCalled();
  });
});
