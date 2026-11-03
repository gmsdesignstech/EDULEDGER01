import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  user: { id: "admin-a", role: "SCHOOL_ADMIN", institutionId: "school-a" } as
    | { id: string; role: string; institutionId?: string }
    | undefined,
  order: {
    id: "addon-a",
    institutionId: "school-a",
    studentCount: 77,
    pricePerStudent: 100,
    amountPaid: 10_000,
    status: "PENDING",
    paymentId: null,
  } as Record<string, unknown> | undefined,
  payment: {
    id: "pay-a",
    order_id: "order-a",
    amount: 1_000_000,
    currency: "INR",
    status: "captured",
    captured: true,
  },
  activate: vi.fn(),
}));

vi.mock("../src/lib/session", () => ({
  currentUser: vi.fn(async () => boundary.user),
}));
vi.mock("../src/lib/db", () => ({
  findWhatsAppAddonByOrder: vi.fn(async () => boundary.order),
  activateVerifiedWhatsAppAddon: boundary.activate,
}));
vi.mock("../src/lib/payment", async (original) => {
  const actual = await original<typeof import("../src/lib/payment")>();
  return {
    ...actual,
    getRazorpayPayment: vi.fn(async () => boundary.payment),
  };
});

import { POST } from "../src/app/api/whatsapp/addon/verify/route";

const secret = "test-only-razorpay-secret";
function request(overrides: Record<string, string> = {}) {
  const orderId = overrides.razorpay_order_id ?? "order-a";
  const paymentId = overrides.razorpay_payment_id ?? "pay-a";
  const signature =
    overrides.razorpay_signature ??
    createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  return new Request("http://local/api/whatsapp/addon/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    }),
  });
}

describe("WhatsApp add-on payment verification boundary", () => {
  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = secret;
    boundary.user = {
      id: "admin-a",
      role: "SCHOOL_ADMIN",
      institutionId: "school-a",
    };
    boundary.order = {
      id: "addon-a",
      institutionId: "school-a",
      studentCount: 77,
      pricePerStudent: 100,
      amountPaid: 10_000,
      status: "PENDING",
      paymentId: null,
    };
    boundary.payment = {
      id: "pay-a",
      order_id: "order-a",
      amount: 1_000_000,
      currency: "INR",
      status: "captured",
      captured: true,
    };
    boundary.activate.mockReset().mockResolvedValue({
      status: "ACTIVE",
      paymentStatus: "Paid",
      amountPaid: 10_000,
    });
  });

  it("activates only after signature and provider details are verified", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      verified: true,
      addon: { status: "ACTIVE", paymentStatus: "Paid" },
    });
    expect(boundary.activate).toHaveBeenCalledOnce();
    expect(boundary.activate).toHaveBeenCalledWith(
      "order-a",
      "pay-a",
      expect.any(String),
    );
  });

  it("rejects another school's order and a forged signature", async () => {
    boundary.order = { ...boundary.order!, institutionId: "school-b" };
    expect((await POST(request())).status).toBe(404);
    boundary.order = { ...boundary.order!, institutionId: "school-a" };
    expect(
      (await POST(request({ razorpay_signature: "0".repeat(64) }))).status,
    ).toBe(401);
    expect(boundary.activate).not.toHaveBeenCalled();
  });

  it.each([
    [{ order_id: "order-other" }, 409],
    [{ amount: 999_900 }, 409],
    [{ currency: "USD" }, 409],
  ])("rejects mismatched provider payment details", async (change, status) => {
    boundary.payment = { ...boundary.payment, ...change };
    expect((await POST(request())).status).toBe(status);
    expect(boundary.activate).not.toHaveBeenCalled();
  });

  it("keeps an authorized but uncaptured payment pending", async () => {
    boundary.payment = {
      ...boundary.payment,
      status: "authorized",
      captured: false,
    };
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(boundary.activate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated, non-admin, and malformed requests", async () => {
    boundary.user = undefined;
    expect((await POST(request())).status).toBe(401);
    boundary.user = {
      id: "teacher-a",
      role: "TEACHER",
      institutionId: "school-a",
    };
    expect((await POST(request())).status).toBe(403);
    boundary.user = {
      id: "admin-a",
      role: "SCHOOL_ADMIN",
      institutionId: "school-a",
    };
    const malformed = new Request("http://local/api/whatsapp/addon/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect((await POST(malformed)).status).toBe(400);
    expect(boundary.activate).not.toHaveBeenCalled();
  });
});
