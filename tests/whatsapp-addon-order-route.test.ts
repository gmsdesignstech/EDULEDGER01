import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  user: { id: "admin-a", role: "SCHOOL_ADMIN", institutionId: "school-a" } as { id: string; role: string; institutionId?: string } | undefined,
  activeCount: 99,
  countError: false,
  subscription: { status: "ACTIVE", studentUsage: 99 },
  addonSubscription: undefined as unknown,
  createPendingWhatsAppAddon: vi.fn(),
  findReusablePendingWhatsAppAddon: vi.fn(),
  createRazorpayOrder: vi.fn(),
}));

vi.mock("../src/lib/session", () => ({ currentUser: vi.fn(async () => boundary.user) }));
vi.mock("../src/lib/db", () => ({
  getSubscription: vi.fn(async () => boundary.subscription),
  getActiveStudentCount: vi.fn(async () => {
    if (boundary.countError) throw new Error("synthetic database failure");
    return boundary.activeCount;
  }),
  getWhatsAppAddonSubscription: vi.fn(async () => boundary.addonSubscription),
  createPendingWhatsAppAddon: boundary.createPendingWhatsAppAddon,
  findReusablePendingWhatsAppAddon: boundary.findReusablePendingWhatsAppAddon,
}));
vi.mock("../src/lib/payment", () => ({
  createRazorpayOrder: boundary.createRazorpayOrder,
  paymentErrorMessage: vi.fn(() => "Payment service unavailable"),
  PaymentServiceError: class PaymentServiceError extends Error { code = "TEST"; status = 503; },
  razorpayPublicKey: vi.fn(() => "rzp_test_public"),
}));

import { GET, POST } from "../src/app/api/whatsapp/addon/order/route";

function request(body: Record<string, unknown>) {
  return new Request("http://local/api/whatsapp/addon/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("WhatsApp add-on order authority boundary", () => {
  beforeEach(() => {
    boundary.user = { id: "admin-a", role: "SCHOOL_ADMIN", institutionId: "school-a" };
    boundary.activeCount = 99;
    boundary.countError = false;
    boundary.subscription = { status: "ACTIVE", studentUsage: 99 };
    boundary.addonSubscription = undefined;
    boundary.createPendingWhatsAppAddon.mockReset().mockResolvedValue(undefined);
    boundary.findReusablePendingWhatsAppAddon.mockReset().mockResolvedValue(undefined);
    boundary.createRazorpayOrder.mockReset().mockResolvedValue({ id: "order-wa", amount: 1_000_000, currency: "INR", key: "rzp_test_public" });
  });

  it.each([
    [1, 1_000_000],
    [10, 1_000_000],
    [23, 1_000_000],
    [76, 1_000_000],
    [99, 1_000_000],
    [100, 1_000_000],
    [101, 1_010_000],
    [150, 1_500_000],
    [200, 2_000_000],
  ])("uses the server's %i active students to create an order for %i paise", async (students, amount) => {
    boundary.activeCount = students;
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(boundary.createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({ amount }));
    expect(boundary.createPendingWhatsAppAddon).toHaveBeenCalledWith("school-a", "order-wa", students, amount / 100);
  });

  it("provides authoritative count and pricing over GET for verified schools", async () => {
    boundary.activeCount = 23;
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      eligible: true,
      verifiedStudentCount: 23,
      amount: 10_000,
      pricePerStudent: 100,
      pricingMethod: "fixed",
      billingPeriod: "year",
    });
  });

  it("reuses a recent matching pending order instead of creating a duplicate", async () => {
    boundary.activeCount = 77;
    boundary.findReusablePendingWhatsAppAddon.mockResolvedValue({ orderId: "order-existing" });
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "order-existing", amount: 1_000_000, reused: true });
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
    expect(boundary.createPendingWhatsAppAddon).not.toHaveBeenCalled();
  });

  it("rejects an already-active add-on before creating a Razorpay order", async () => {
    boundary.addonSubscription = { status: "ACTIVE" };
    const response = await POST(request({}));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ADDON_ALREADY_ACTIVE" });
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
    expect(boundary.createPendingWhatsAppAddon).not.toHaveBeenCalled();
  });

  it("returns an authoritative retry quote if enrollment changes during persistence", async () => {
    boundary.createPendingWhatsAppAddon.mockImplementationOnce(async () => {
      boundary.activeCount = 101;
      throw new Error("The eligible student count or WhatsApp add-on price changed. Refresh and try again.");
    });
    const response = await POST(request({}));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "STUDENT_COUNT_CHANGED",
      verifiedStudentCount: 101,
      amount: 10_100,
      pricePerStudent: 100,
    });
  });

  it("reports zero active students clearly over GET without creating false eligibility", async () => {
    boundary.activeCount = 0;
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      eligible: false,
      verifiedStudentCount: 0,
      code: "NO_ACTIVE_STUDENTS",
    });
  });

  it("reports a recoverable 503 over GET when student count lookup fails", async () => {
    boundary.countError = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "STUDENT_COUNT_UNAVAILABLE" });
    log.mockRestore();
  });

  it("ignores URL/display counts and rejects client-supplied billing authority", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(200);
    expect(boundary.createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 1_000_000 }));
    expect((await POST(request({ studentCount: 1 }))).status).toBe(400);
    expect((await POST(request({ amount: 1 }))).status).toBe(400);
  });

  it("reports a verified zero only as an ineligible active-student result", async () => {
    boundary.activeCount = 0;
    const response = await POST(request({}));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "NO_ACTIVE_STUDENTS", verifiedStudentCount: 0 });
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("returns a retryable service error without converting a count failure to zero", async () => {
    boundary.countError = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request({}));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "STUDENT_COUNT_UNAVAILABLE" });
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("rejects an expired session and missing tenant context safely", async () => {
    boundary.user = undefined;
    const expired = await POST(request({}));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({ code: "UNAUTHENTICATED" });
    expect((await GET()).status).toBe(401);

    boundary.user = { id: "admin-a", role: "SCHOOL_ADMIN" };
    const missingTenant = await POST(request({}));
    expect(missingTenant.status).toBe(403);
    expect(await missingTenant.json()).toMatchObject({ code: "TENANT_CONTEXT_MISSING" });
    expect((await GET()).status).toBe(403);

    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("does not treat the Super Admin system tenant as a school with zero students", async () => {
    boundary.user = { id: "super-admin", role: "SUPER_ADMIN", institutionId: "system-tenant" };
    boundary.activeCount = 0;
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "SCHOOL_TENANT_REQUIRED" });
    expect(boundary.createRazorpayOrder).not.toHaveBeenCalled();
  });

});
