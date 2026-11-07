import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  adminContext: {
    id: "admin-1",
    role: "SCHOOL_ADMIN",
    institutionId: "school-a",
  },
  parentContext: {
    user: { id: "parent-1", role: "PARENT", institutionId: "school-a" },
    children: [{ id: "student-1", name: "Sara Khan" }],
  },
  submitSchoolQrPayment: vi.fn(),
  listSchoolQrPayments: vi.fn(),
  verifySchoolQrPayment: vi.fn(),
  rejectSchoolQrPayment: vi.fn(),
  refundSchoolQrPayment: vi.fn(),
  getSchoolPaymentSettings: vi.fn(),
  saveSchoolPaymentSettings: vi.fn(),
}));

vi.mock("../src/lib/session", () => ({
  currentUser: vi.fn(async () => boundary.adminContext),
}));

vi.mock("../src/lib/cached-school", () => ({
  invalidateSchoolCache: vi.fn(),
}));

vi.mock("../src/lib/parent-auth", () => ({
  parentApiContext: vi.fn(async (studentId?: string | null) => {
    if (studentId === "student-foreign") {
      return { response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) };
    }
    return boundary.parentContext;
  }),
  parentNoStore: { "Cache-Control": "private, no-store" },
}));

vi.mock("../src/lib/db", () => ({
  submitSchoolQrPayment: boundary.submitSchoolQrPayment,
  listSchoolQrPayments: boundary.listSchoolQrPayments,
  verifySchoolQrPayment: boundary.verifySchoolQrPayment,
  rejectSchoolQrPayment: boundary.rejectSchoolQrPayment,
  refundSchoolQrPayment: boundary.refundSchoolQrPayment,
  getSchoolPaymentSettings: boundary.getSchoolPaymentSettings,
  saveSchoolPaymentSettings: boundary.saveSchoolPaymentSettings,
}));

import { POST as parentQrPaymentPost } from "../src/app/api/parent/children/[id]/qr-payment/route";
import { GET as adminQrListGet, POST as adminQrActionPost } from "../src/app/api/fees/qr-payments/route";
import { POST as paymentSettingsPost, GET as paymentSettingsGet } from "../src/app/api/settings/payment/route";

describe("School Payment QR & Automated Fee Accounting Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("School Payment Settings Configuration", () => {
    it("returns payment settings for authorized administrators", async () => {
      boundary.getSchoolPaymentSettings.mockResolvedValueOnce({
        institutionName: "Dar Al Arqam Public School",
        upiEnabled: true,
        upiId: "school@upi",
        payeeName: "Dar Al Arqam Public School",
        paymentMethodName: "School UPI / QR Code",
        bankName: "State Bank of India",
        accountNumber: "1234567890",
        ifscCode: "SBIN0001234",
        paymentInstructions: "Scan and pay.",
        qrCodeUrl: "/api/settings/assets/payment-qr",
      });

      const res = await paymentSettingsGet();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.settings.upiEnabled).toBe(true);
      expect(data.settings.upiId).toBe("school@upi");
      expect(data.canEdit).toBe(true);
    });

    it("saves payment settings and audits updates", async () => {
      boundary.saveSchoolPaymentSettings.mockResolvedValueOnce({
        institutionName: "Dar Al Arqam Public School",
        upiEnabled: true,
        upiId: "daralarqam@oksbi",
        payeeName: "Dar Al Arqam School",
        paymentMethodName: "School UPI / QR Code",
        bankName: "SBI",
        accountNumber: "987654321",
        ifscCode: "SBIN0009999",
        paymentInstructions: "Please submit 12 digit UTR.",
        qrCodeUrl: "/api/settings/assets/payment-qr",
      });

      const req = new Request("http://local/api/settings/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upiEnabled: true,
          upiId: "daralarqam@oksbi",
          payeeName: "Dar Al Arqam School",
          paymentInstructions: "Please submit 12 digit UTR.",
        }),
      });

      const res = await paymentSettingsPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.settings.upiId).toBe("daralarqam@oksbi");
      expect(boundary.saveSchoolPaymentSettings).toHaveBeenCalledWith(
        "school-a",
        "admin-1",
        expect.objectContaining({
          upiEnabled: true,
          upiId: "daralarqam@oksbi",
        })
      );
    });
  });

  describe("Parent QR Payment Submission", () => {
    it("submits payment verification request with valid UTR and amount", async () => {
      boundary.submitSchoolQrPayment.mockResolvedValueOnce({
        id: "qr-1",
        institutionId: "school-a",
        studentId: "student-1",
        feeId: "fee-1",
        amount: 5000,
        utrNumber: "402812345678",
        paymentDate: "2026-11-07",
        screenshotAssetId: null,
        status: "PENDING",
      });

      const req = new Request("http://local/api/parent/children/student-1/qr-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId: "fee-1",
          amount: 5000,
          utrNumber: "402812345678",
          paymentDate: "2026-11-07",
        }),
      });

      const res = await parentQrPaymentPost(req, { params: Promise.resolve({ id: "student-1" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.payment.status).toBe("PENDING");
      expect(boundary.submitSchoolQrPayment).toHaveBeenCalledWith(
        "school-a",
        "student-1",
        expect.objectContaining({
          feeId: "fee-1",
          amount: 5000,
          utrNumber: "402812345678",
        })
      );
    });

    it("rejects submission if student does not belong to parent", async () => {
      const req = new Request("http://local/api/parent/children/student-foreign/qr-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeId: "fee-1", amount: 1000, utrNumber: "402812345678" }),
      });

      const res = await parentQrPaymentPost(req, { params: Promise.resolve({ id: "student-foreign" }) });
      expect(res.status).toBe(403);
      expect(boundary.submitSchoolQrPayment).not.toHaveBeenCalled();
    });

    it("rejects submission with empty or too short UTR", async () => {
      const req = new Request("http://local/api/parent/children/student-1/qr-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeId: "fee-1", amount: 1000, utrNumber: "12" }),
      });

      const res = await parentQrPaymentPost(req, { params: Promise.resolve({ id: "student-1" }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("valid UPI / UTR");
    });
  });

  describe("Admin QR Payment Verification & Accounting Workflow", () => {
    it("lists QR verification requests for administrators", async () => {
      boundary.listSchoolQrPayments.mockResolvedValueOnce({
        total: 1,
        items: [
          {
            id: "qr-1",
            studentId: "student-1",
            studentName: "Sara Khan",
            admission: "ADM-001",
            amount: 5000,
            utrNumber: "402812345678",
            status: "PENDING",
          },
        ],
      });

      const req = new Request("http://local/api/fees/qr-payments?status=PENDING");
      const res = await adminQrListGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.items[0].utrNumber).toBe("402812345678");
    });

    it("verifying a QR payment triggers receipt generation and Cash Book entry", async () => {
      boundary.verifySchoolQrPayment.mockResolvedValueOnce({
        success: true,
        paymentId: "pay-123",
        receiptNumber: "REC-2026-0042",
      });

      const req = new Request("http://local/api/fees/qr-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY",
          paymentId: "qr-1",
        }),
      });

      const res = await adminQrActionPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.receiptNumber).toBe("REC-2026-0042");
      expect(boundary.verifySchoolQrPayment).toHaveBeenCalledWith(
        "school-a",
        "admin-1",
        "qr-1",
        expect.anything()
      );
    });

    it("rejecting a QR payment requires a reason and does not touch accounts", async () => {
      const reqMissingReason = new Request("http://local/api/fees/qr-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          paymentId: "qr-1",
        }),
      });

      const resMissing = await adminQrActionPost(reqMissingReason);
      expect(resMissing.status).toBe(400);
      expect(boundary.rejectSchoolQrPayment).not.toHaveBeenCalled();

      boundary.rejectSchoolQrPayment.mockResolvedValueOnce({ success: true });

      const reqValidReject = new Request("http://local/api/fees/qr-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          paymentId: "qr-1",
          reason: "UTR not found in bank statement.",
        }),
      });

      const resValid = await adminQrActionPost(reqValidReject);
      expect(resValid.status).toBe(200);
      expect(boundary.rejectSchoolQrPayment).toHaveBeenCalledWith(
        "school-a",
        "admin-1",
        "qr-1",
        "UTR not found in bank statement."
      );
    });

    it("refunds verified QR payment safely", async () => {
      boundary.refundSchoolQrPayment.mockResolvedValueOnce({ success: true });

      const req = new Request("http://local/api/fees/qr-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REFUND",
          paymentId: "qr-1",
          reason: "Double payment refund",
        }),
      });

      const res = await adminQrActionPost(req);
      expect(res.status).toBe(200);
      expect(boundary.refundSchoolQrPayment).toHaveBeenCalledWith(
        "school-a",
        "admin-1",
        "qr-1",
        "Double payment refund"
      );
    });

    it("rejects duplicate UTR submission with informative error", async () => {
      boundary.submitSchoolQrPayment.mockRejectedValueOnce(
        new Error('A payment with UTR "402812345678" has already been submitted (Status: PENDING).')
      );

      const req = new Request("http://local/api/parent/children/student-1/qr-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId: "fee-1",
          amount: 2500,
          utrNumber: "402812345678",
          paymentDate: "2026-11-07",
        }),
      });

      const res = await parentQrPaymentPost(req, { params: Promise.resolve({ id: "student-1" }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("already been submitted");
    });

    it("supports partial fee payments and verifies single Cash Book entry", async () => {
      boundary.verifySchoolQrPayment.mockResolvedValueOnce({
        success: true,
        paymentId: "pay-partial-1",
        receiptNumber: "REC-2026-0099",
      });

      const req = new Request("http://local/api/fees/qr-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY",
          paymentId: "qr-partial-1",
          notes: "Partial fee payment verified",
        }),
      });

      const res = await adminQrActionPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.receiptNumber).toBe("REC-2026-0099");
    });

    it("enforces multi-tenant isolation preventing cross-school access", async () => {
      // Admin from school-b attempts action
      boundary.adminContext.institutionId = "school-b";

      boundary.listSchoolQrPayments.mockResolvedValueOnce({
        total: 0,
        items: [],
      });

      const req = new Request("http://local/api/fees/qr-payments");
      const res = await adminQrListGet(req);
      expect(res.status).toBe(200);
      expect(boundary.listSchoolQrPayments).toHaveBeenCalledWith(
        "school-b",
        expect.anything()
      );

      // Restore
      boundary.adminContext.institutionId = "school-a";
    });
  });
});
