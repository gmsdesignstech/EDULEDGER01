import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "bcryptjs";
import { createAccount, getUserActiveDeviceTokens, recordNotificationDelivery, registerDeviceToken } from "../src/lib/db";

const testContext = vi.hoisted(() => ({
  user: null as { id: string; email: string; name: string; role: string; institutionId: string } | null,
}));

vi.mock("../src/lib/session", () => ({
  currentUser: vi.fn(async () => testContext.user),
}));

import { DELETE as deleteTokenHandler, POST as postTokenHandler } from "../src/app/api/notifications/push-token/route";
import { POST as ackHandler } from "../src/app/api/notifications/ack/route";
import { GET as getSettingsHandler, PUT as putSettingsHandler } from "../src/app/api/notifications/settings/route";

describe("Notification Engine API Routes", () => {
  let realAdmin: { id: string; email: string; name: string; role: string; institutionId: string };

  beforeAll(async () => {
    const stamp = `${Date.now()}_routes`;
    const admin = await createAccount({
      name: "Route Admin",
      email: `route_${stamp}@school.test`,
      institution: `Route School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    realAdmin = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: "SCHOOL_ADMIN",
      institutionId: admin.institutionId,
    };
  });

  beforeEach(() => {
    testContext.user = { ...realAdmin };
  });

  describe("POST & DELETE /api/notifications/push-token", () => {
    it("rejects unauthenticated requests with 401", async () => {
      testContext.user = null;
      const req = new Request("http://localhost/api/notifications/push-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "test_token_12345" }),
      });
      const res = await postTokenHandler(req);
      expect(res.status).toBe(401);
    });

    it("registers a device token successfully", async () => {
      const token = `fcm_web_token_${Date.now()}`;
      const req = new Request("http://localhost/api/notifications/push-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, deviceType: "web_pwa" }),
      });
      const res = await postTokenHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.deviceToken.token).toBe(token);
    });

    it("revokes a registered device token successfully", async () => {
      const token = `fcm_web_token_revoke_${Date.now()}`;
      // First register
      await registerDeviceToken(realAdmin.institutionId, realAdmin.id, token, "web");

      const req = new Request("http://localhost/api/notifications/push-token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const res = await deleteTokenHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.revoked).toBe(true);

      const active = await getUserActiveDeviceTokens(realAdmin.id);
      expect(active.some((t) => t.token === token)).toBe(false);
    });
  });

  describe("POST /api/notifications/ack", () => {
    it("requires an authenticated session", async () => {
      testContext.user = null;
      const req = new Request("http://localhost/api/notifications/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: "delivery-id" }),
      });
      expect((await ackHandler(req)).status).toBe(401);
    });

    it("returns 400 for invalid deliveryId payload", async () => {
      const req = new Request("http://localhost/api/notifications/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await ackHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 for unknown deliveryId", async () => {
      const req = new Request("http://localhost/api/notifications/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: "non_existent_delivery_id" }),
      });
      const res = await ackHandler(req);
      expect(res.status).toBe(404);
    });

    it("does not acknowledge another user's delivery", async () => {
      const deliveryId = await recordNotificationDelivery({
        institutionId: realAdmin.institutionId,
        userId: realAdmin.id,
        channel: "FCM",
        status: "SENT",
      });
      const other = await createAccount({
        name: "Other School Admin",
        email: `other-${Date.now()}@school.test`,
        institution: `Other School ${Date.now()}`,
        passwordHash: await hash("password123", 4),
      });
      testContext.user = { ...other };
      const req = new Request("http://localhost/api/notifications/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId }),
      });
      expect((await ackHandler(req)).status).toBe(404);
    });

    it("successfully confirms delivery receipt", async () => {
      const deliveryId = await recordNotificationDelivery({
        institutionId: realAdmin.institutionId,
        userId: realAdmin.id,
        channel: "FCM",
        status: "SENT",
      });

      const req = new Request("http://localhost/api/notifications/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId }),
      });
      const res = await ackHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.delivered).toBe(true);
    });
  });

  describe("GET & PUT /api/notifications/settings", () => {
    it("fetches school notification preferences for authenticated user", async () => {
      const res = await getSettingsHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.settings).toBeDefined();
      expect(data.canEdit).toBe(true);
      expect(data.settings.pushEnabled).toBe(true);
    });

    it("forbids non-admin users from updating notification preferences", async () => {
      testContext.user = {
        id: realAdmin.id,
        email: realAdmin.email,
        name: realAdmin.name,
        role: "PARENT",
        institutionId: realAdmin.institutionId,
      };

      const req = new Request("http://localhost/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentAbsent: false }),
      });
      const res = await putSettingsHandler(req);
      expect(res.status).toBe(403);
    });

    it("allows school admins to update notification preferences", async () => {
      const req = new Request("http://localhost/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentAbsent: false, feePayment: true }),
      });
      const res = await putSettingsHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.settings.studentAbsent).toBe(false);
      expect(data.settings.feePayment).toBe(true);
    });
  });
});
