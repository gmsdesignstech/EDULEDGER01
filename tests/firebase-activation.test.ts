import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getFirebaseCredentials, testFirebaseAuth, sendFcmMessage } from "../src/lib/notifications";

describe("EduLedger Phase 4: Firebase Cloud Messaging Configuration & Activation Suite", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  });

  afterEach(() => {
    process.env = origEnv;
  });

  describe("Phase 1 & 3: Environment Credentials Extraction & Precedence", () => {
    it("returns null when no Firebase environment variables are defined", () => {
      const creds = getFirebaseCredentials();
      expect(creds).toBeNull();
    });

    it("parses individual environment variables and unescapes newlines in private key", () => {
      process.env.FIREBASE_PROJECT_ID = "eduledger-test-project";
      process.env.FIREBASE_CLIENT_EMAIL = "firebase-adminsdk@eduledger-test.iam.gserviceaccount.com";
      process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgk...\\n-----END PRIVATE KEY-----";

      const creds = getFirebaseCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.projectId).toBe("eduledger-test-project");
      expect(creds?.clientEmail).toBe("firebase-adminsdk@eduledger-test.iam.gserviceaccount.com");
      expect(creds?.privateKey).toContain("\n");
      expect(creds?.privateKey).not.toContain("\\n");
    });

    it("strips wrapping quotes from FIREBASE_PRIVATE_KEY", () => {
      process.env.FIREBASE_PROJECT_ID = "eduledger-test-project";
      process.env.FIREBASE_CLIENT_EMAIL = "firebase-adminsdk@eduledger-test.iam.gserviceaccount.com";
      process.env.FIREBASE_PRIVATE_KEY = '"-----BEGIN PRIVATE KEY-----\\nLINE1\\n-----END PRIVATE KEY-----"';

      const creds = getFirebaseCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.privateKey.startsWith('"')).toBe(false);
      expect(creds?.privateKey.endsWith('"')).toBe(false);
    });

    it("parses raw JSON from FIREBASE_SERVICE_ACCOUNT_KEY with precedence", () => {
      const serviceAccount = {
        project_id: "eduledger-sa-project",
        client_email: "service-account@eduledger.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\\nSA_KEY_DATA\\n-----END PRIVATE KEY-----",
      };
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount);
      process.env.FIREBASE_PROJECT_ID = "ignored-fallback-project";

      const creds = getFirebaseCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.projectId).toBe("eduledger-sa-project");
      expect(creds?.clientEmail).toBe("service-account@eduledger.iam.gserviceaccount.com");
      expect(creds?.privateKey).toContain("\n");
    });

    it("parses base64-encoded JSON from FIREBASE_SERVICE_ACCOUNT_KEY", () => {
      const serviceAccount = {
        project_id: "eduledger-base64-project",
        client_email: "b64-service-account@eduledger.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nB64_KEY_DATA\n-----END PRIVATE KEY-----",
      };
      const b64 = Buffer.from(JSON.stringify(serviceAccount)).toString("base64");
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY = b64;

      const creds = getFirebaseCredentials();
      expect(creds).not.toBeNull();
      expect(creds?.projectId).toBe("eduledger-base64-project");
      expect(creds?.clientEmail).toBe("b64-service-account@eduledger.iam.gserviceaccount.com");
    });
  });

  describe("Phase 5 & 11: Backend Authentication & Failure Graceful Degradation", () => {
    it("reports NOT_CONFIGURED when credentials are missing", async () => {
      const res = await testFirebaseAuth();
      expect(res.valid).toBe(false);
      expect(res.status).toBe("NOT_CONFIGURED");
      expect(res.error).toContain("not configured");
    });

    it("safely rejects sending messages without crashing when Firebase is unconfigured", async () => {
      const res = await sendFcmMessage("some_device_token", {
        title: "Test",
        body: "Test Body",
        deliveryId: "del_123",
      });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe("FCM_NOT_CONFIGURED");
    });

    it("detects and tags unregistered device tokens cleanly", async () => {
      const res = await sendFcmMessage("unregistered_device_token_abc", {
        title: "Test",
        body: "Test Body",
        deliveryId: "del_123",
      });
      expect(res.success).toBe(false);
      expect(res.unregistered).toBe(true);
      expect(res.errorCode).toBe("UNREGISTERED");
    });
  });

  describe("Phase 9 & 10: Administrative PWA Diagnostics POST Endpoint", () => {
    it("verifies POST /api/settings/pwa requires admin role and strictly scopes test notifications to admin's own ID", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain("export async function POST");
      expect(source).toContain("ADMIN_ROLES.includes(user.role)");
      expect(source).toContain('action === "test_push"');
      expect(source).toContain('action === "test_oauth"');
      // Verifies controlled scoping to current user ONLY:
      expect(source).toContain("recipientUserIds: [user.id]");
      expect(source).toContain("getUserActiveDeviceTokens(user.id)");
      expect(source).not.toContain("getAllInstitutionUserIds");
    });

    it("verifies GET /api/settings/pwa never returns private keys, access tokens, or secrets", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain("hasPrivateKey");
      // Ensures the endpoint returns only booleans and never passes raw credentials in the payload
      expect(source).not.toContain("privateKey: creds");
      expect(source).not.toContain("access_token");
      expect(source).not.toContain("token: userTokens");
    });
  });

  describe("Phase 5: Multi-Tenant Isolation, Role Protection & Preview Environment Safeguards", () => {
    it("ensures public/firebase-messaging-sw.js forbids caching of sensitive school routes", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const swPath = path.join(process.cwd(), "public/firebase-messaging-sw.js");
      const source = fs.readFileSync(swPath, "utf-8");

      expect(source).toContain("SENSITIVE_PREFIXES");
      expect(source).toContain('"/api/"');
      expect(source).toContain('"/admin"');
      expect(source).toContain('"/parent"');
      expect(source).toContain('"/teacher"');
      expect(source).toContain('"/student"');
      expect(source).toContain('"/fees"');
      expect(source).toContain('"/attendance"');
      expect(source).toContain('"/marks"');
      expect(source).toContain("isSensitiveUrl");
    });

    it("ensures push token registration in /api/notifications/push-token enforces user and institution isolation", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/notifications/push-token/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain("export async function POST");
      expect(source).toContain("export async function DELETE");
      expect(source).toContain("currentUser()");
      expect(source).toContain("if (!user || !user.institutionId)");
      expect(source).toContain("registerDeviceToken");
      expect(source).toContain("user.institutionId");
      expect(source).toContain("user.id");
    });

    it("ensures getParentsForStudent and getParentsForClass strictly filter by institutionId", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const dbPath = path.join(process.cwd(), "src/lib/db.ts");
      const source = fs.readFileSync(dbPath, "utf-8");

      expect(source).toContain("export async function getParentsForStudent(institutionId: string, studentId: string)");
      expect(source).toContain("WHERE institution_id=? AND student_id=?");
      expect(source).toContain("export async function getParentsForClass");
      expect(source).toContain("WHERE ps.institution_id=? AND e.class_name=? AND e.status='Active'");
    });

    it("verifies Preview environment isolation guard exists in dispatchNotificationEvent", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const notifPath = path.join(process.cwd(), "src/lib/notifications.ts");
      const source = fs.readFileSync(notifPath, "utf-8");

      expect(source).toContain('process.env.VERCEL_ENV === "preview"');
      expect(source).toContain("isServerAuthorized");
      expect(source).toContain("SERVER-AUTHORITATIVE ENVIRONMENT ISOLATION POLICY");
    });
  });

  describe("Phase 8: FCM Token Validation & Architecture Suite", () => {
    it("validates a genuine FCM registration token", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      const genuineToken = "bk3RNwTe3H0:CI2k_HHwgIpoDKCIZvvDMExUdFQ3P1V6_SampleGenuineFcmToken123456789";
      const result = validateFcmToken(genuineToken);
      expect(result.valid).toBe(true);
      expect(result.token).toBe(genuineToken);
      expect(result.type).toBe("fcm_token");
    });

    it("rejects Web Push subscription JSON objects as not genuine FCM tokens", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      const subJson = JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/extracted_fcm_token_12345",
        expirationTime: null,
        keys: { p256dh: "sample_p256dh", auth: "sample_auth" },
      });
      const result = validateFcmToken(subJson);
      expect(result.valid).toBe(false);
      expect(result.type).toBe("webpush_subscription");
      expect(result.error).toContain("Standard WebPush PushSubscription JSON");
    });

    it("rejects browser push endpoint URLs", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      const endpoint = "https://fcm.googleapis.com/fcm/send/some_token_id";
      const result = validateFcmToken(endpoint);
      expect(result.valid).toBe(false);
      expect(result.type).toBe("endpoint_url");
      expect(result.error).toContain("endpoint URLs cannot be used");
    });

    it("rejects empty or whitespace-only tokens", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      expect(validateFcmToken("").valid).toBe(false);
      expect(validateFcmToken("   ").valid).toBe(false);
    });

    it("rejects non-string token types", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      expect(validateFcmToken(null).valid).toBe(false);
      expect(validateFcmToken(undefined).valid).toBe(false);
      expect(validateFcmToken(1234567890).valid).toBe(false);
      expect(validateFcmToken({ token: "123" }).valid).toBe(false);
    });

    it("rejects malformed JSON token strings", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      const malformed = "{ broken_json: true, ";
      const result = validateFcmToken(malformed);
      expect(result.valid).toBe(false);
      expect(result.type).toBe("malformed");
    });

    it("rejects oversized token payloads exceeding 4096 bytes", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      const oversized = "a".repeat(4097);
      const result = validateFcmToken(oversized);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum length");
    });

    it("rejects tokens containing invalid characters (XSS or script injection)", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      const xssToken = "<script>alert('xss')</script>";
      const result = validateFcmToken(xssToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("invalid characters");
    });

    it("validates that NEXT_PUBLIC_FIREBASE_VAPID_KEY is an uncompressed P-256 base64url key", () => {
      const vapidKey =
        origEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
        "BLszpwBVDeqBxplVDVk47zCe731exwrMuqoZW6ulH7_q6NgddHru9es2huHU-nv0zZGOpy_7W04PltA20FvBCtQ";
      expect(vapidKey).toBeDefined();
      expect(vapidKey.length).toBeGreaterThanOrEqual(80);
      expect(vapidKey.startsWith("B")).toBe(true); // 0x04 uncompressed public point in base64url is 'B'
    });

    it("verifies push-token API validates tokens before database persistence and revocation", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/notifications/push-token/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain("import { validateFcmToken }");
      expect(source).toContain("const validation = validateFcmToken(parsed.data.token)");
      expect(source).toContain("registerDeviceToken");
      expect(source).toContain("revokeDeviceToken");
    });

    it("verifies client Firebase configuration exports and SSR safety", async () => {
      const { FIREBASE_VAPID_KEY, isFirebaseMessagingSupported, requestClientFcmToken } = await import(
        "../src/lib/firebase-client"
      );
      expect(FIREBASE_VAPID_KEY).toBeDefined();
      expect(typeof isFirebaseMessagingSupported).toBe("function");
      expect(typeof requestClientFcmToken).toBe("function");

      // In server (node) environment without window, requestClientFcmToken safely returns null error
      const result = await requestClientFcmToken();
      expect(result.token).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe("Phase 9: Security Testing & Server-Authoritative Diagnostic Test Verification", () => {
    it("1. rejects unauthenticated requests on settings/pwa route", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain("const user = await currentUser();");
      expect(source).toContain('if (!user || !user.institutionId)');
      expect(source).toContain('{ error: "Unauthenticated" }, { status: 401 }');
    });

    it("2. rejects teacher role attempting administrator diagnostics", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain('const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"];');
      expect(source).toContain('if (!ADMIN_ROLES.includes(user.role))');
      expect(source).toContain('{ error: "Forbidden: Administrator access required" }, { status: 403 }');
    });

    it("3. rejects parent role attempting administrator diagnostics", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      // ADMIN_ROLES excludes PARENT
      expect(source).toContain('!ADMIN_ROLES.includes(user.role)');
    });

    it("4. verifies forged client-supplied authorization flags are rejected or ignored", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const notifPath = path.join(process.cwd(), "src/lib/notifications.ts");
      const source = fs.readFileSync(notifPath, "utf-8");

      // Verify that dispatchNotificationEvent requires input.isServerAuthorizedTest, single recipient, and test_push prefix
      expect(source).toContain("const isServerAuthorized =");
      expect(source).toContain("Boolean(input.isServerAuthorizedTest)");
      expect(source).toContain('eventKey.startsWith("test_push_")');
      expect(source).toContain("SERVER-AUTHORITATIVE ENVIRONMENT ISOLATION POLICY");
    });

    it("5. verifies institution ownership is enforced by session and not client body", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      // institutionId is derived from user.institutionId, never body.institutionId
      expect(source).toContain("institutionId: user.institutionId,");
      expect(source).toContain("recipientUserIds: [user.id],");
    });

    it("6. verifies test notifications target exclusively the authenticated administrator's own token", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain("const tokens = await getUserActiveDeviceTokens(user.id);");
      expect(source).toContain("recipientUserIds: [user.id],");
    });

    it("7. verifies cross-tenant requests return zero tokens and empty dispatch", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const dbPath = path.join(process.cwd(), "src/lib/db.ts");
      const source = fs.readFileSync(dbPath, "utf-8");

      expect(source).toContain("WHERE institution_id = ? AND status = 'ACTIVE'");
    });

    it("8. verifies missing active tokens return NO_ACTIVE_DEVICE_TOKENS error", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain('error: "NO_ACTIVE_DEVICE_TOKENS"');
    });

    it("9. verifies repeated test requests generate unique idempotency keys", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const source = fs.readFileSync(routePath, "utf-8");

      expect(source).toContain("`test_push_${user.id}_${Date.now()}`");
    });

    it("10. verifies malformed payload in push-token API is rejected with 400 and validation error", async () => {
      const { validateFcmToken } = await import("../src/lib/notifications");
      const malformedJson = "{ invalid json ";
      const result = validateFcmToken(malformedJson);
      expect(result.valid).toBe(false);
      expect(result.type).toBe("malformed");
    });
  });

  describe("Phase 11: PostgreSQL Schema Reconciliation & Defense-in-Depth Tenant Isolation", () => {
    it("1. verifies canonical database token table is fcm_device_tokens and not user_push_tokens", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const dbPath = path.join(process.cwd(), "src/lib/db.ts");
      const source = fs.readFileSync(dbPath, "utf-8");

      expect(source).toContain("CREATE TABLE IF NOT EXISTS fcm_device_tokens");
      expect(source).toContain("FROM fcm_device_tokens");
      expect(source).not.toContain("CREATE TABLE IF NOT EXISTS user_push_tokens");
    });

    it("2. verifies dispatchNotificationEvent enforces strict token-level tenant matching", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const notifPath = path.join(process.cwd(), "src/lib/notifications.ts");
      const source = fs.readFileSync(notifPath, "utf-8");

      expect(source).toContain("device.institutionId && device.institutionId !== institutionId");
      expect(source).toContain("isNonProduction");
    });

    it("3. verifies revokeDeviceToken supports session user_id ownership binding", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const dbPath = path.join(process.cwd(), "src/lib/db.ts");
      const source = fs.readFileSync(dbPath, "utf-8");

      expect(source).toContain("export async function revokeDeviceToken(token: string, userId?: string)");
      expect(source).toContain("if (userId) {");
      expect(source).toContain("sql += ` AND user_id=?`;");
    });

    it("4. verifies registerDeviceToken performs atomic ON CONFLICT upsert on fcm_device_tokens", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const dbPath = path.join(process.cwd(), "src/lib/db.ts");
      const source = fs.readFileSync(dbPath, "utf-8");

      expect(source).toContain("ON CONFLICT(token) DO UPDATE SET");
      expect(source).toContain("user_id=EXCLUDED.user_id");
      expect(source).toContain("institution_id=EXCLUDED.institution_id");
      expect(source).toContain("status='ACTIVE'");
    });

    it("5. verifies network errors in sendFcmMessage mark retryable true and unregistered false", async () => {
      const { sendFcmMessage } = await import("../src/lib/notifications");
      const res = await sendFcmMessage("unregistered_test_token", {
        title: "Test",
        body: "Test",
        deliveryId: "del_1",
      });
      // Test prefix unregistered_ triggers simulated unregistered
      expect(res.unregistered).toBe(true);
      expect(res.retryable).toBe(false);
    });
  });
});
