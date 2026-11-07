import { afterEach, describe, expect, it, vi } from "vitest";
import { sendFcmMessage } from "../src/lib/notifications";

describe("Firebase Cloud Messaging configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not report a successful delivery when provider credentials are missing", async () => {
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_KEY", "");
    vi.stubEnv("FIREBASE_PROJECT_ID", "");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFcmMessage("registered-device-token", {
      title: "Test notification",
      body: "Provider readiness check",
      deliveryId: "delivery-test",
    })).resolves.toEqual({
      success: false,
      errorCode: "FCM_NOT_CONFIGURED",
      errorMessage: "Firebase Cloud Messaging is not configured.",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
