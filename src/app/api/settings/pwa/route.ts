import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getPwaDiagnosticsData, getUserActiveDeviceTokens } from "@/lib/db";
import { dispatchNotificationEvent, getFirebaseCredentials, testFirebaseAuth } from "@/lib/notifications";

export const runtime = "nodejs";

const ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"];

export async function GET() {
  const user = await currentUser();
  if (!user || !user.institutionId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: Administrator access required" }, { status: 403 });
  }

  try {
    // 1. Firebase Server Environment Validation (Without revealing secrets)
    const creds = getFirebaseCredentials();
    const hasVapidKey = Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    );
    const hasClientApiKey = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
    const hasClientAppId = Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
    const hasClientConfig = hasClientApiKey && hasClientAppId;
    const hasProjectId = Boolean(creds?.projectId || process.env.FIREBASE_PROJECT_ID);
    const hasClientEmail = Boolean(creds?.clientEmail || process.env.FIREBASE_CLIENT_EMAIL);
    const hasPrivateKey = Boolean(
      creds?.privateKey || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    );
    const hasCredentials = Boolean(creds);
    const isFirebaseConfigured = hasCredentials && hasVapidKey && hasClientConfig;

    // Check OAuth verify when credentials exist (even before VAPID is set)
    let oauthStatus: "PASS" | "FAILED" | "NOT_CONFIGURED" = "NOT_CONFIGURED";
    if (hasCredentials) {
      try {
        const authCheck = await testFirebaseAuth();
        oauthStatus = authCheck.status;
      } catch {
        oauthStatus = "FAILED";
      }
    }

    // 2. Query FCM Device Token Counts & Delivery Statistics for this School
    const { tokenSummary, totalActiveDevices, deliveryStats, notifSettings } =
      await getPwaDiagnosticsData(user.institutionId);

    const userTokens = await getUserActiveDeviceTokens(user.id);

    const isFullyConfigured = hasCredentials && hasVapidKey && hasClientConfig && oauthStatus === "PASS";
    const overallFirebaseStatus: "READY" | "BLOCKED" | "NOT CONFIGURED" | "TEST REQUIRED" | "ERROR" =
      !hasCredentials
        ? "NOT CONFIGURED"
        : !hasVapidKey || !hasClientConfig
          ? "BLOCKED"
          : oauthStatus === "FAILED"
            ? "ERROR"
            : userTokens.length === 0
              ? "TEST REQUIRED"
              : "READY";

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      institutionId: user.institutionId,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      pwa: {
        status: "PASS",
        scope: "/",
        startUrl: "/",
        manifestUrl: "/manifest.webmanifest",
        teacherManifestUrl: "/manifest-teacher.webmanifest",
        parentManifestUrl: "/manifest-parent.webmanifest",
        serviceWorkerUrl: "/sw.js",
        offlineFallbackUrl: "/offline.html",
      },
      firebase: {
        status: overallFirebaseStatus,
        configured: isFullyConfigured,
        hasCredentials,
        oauthStatus,
        hasVapidKey,
        hasClientApiKey,
        hasClientAppId,
        hasProjectId,
        hasClientEmail,
        hasPrivateKey,
        pushService: "Firebase Cloud Messaging v1 (HTTP v1)",
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
        remediation: !hasVapidKey
          ? "Public Web Push VAPID key is missing. Add NEXT_PUBLIC_FIREBASE_VAPID_KEY in Vercel to enable browser push subscriptions."
          : !hasCredentials
          ? "Server credentials missing. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
          : !hasClientConfig
          ? "Client Firebase configuration missing. Add NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_APP_ID to enable browser FCM token generation."
          : oauthStatus === "FAILED"
          ? "Google OAuth 2.0 assertion failed. Verify service account private key format."
          : userTokens.length === 0
          ? "Firebase is fully configured! Click 'Enable Notifications' to enroll this browser and test push delivery."
          : undefined,
      },
      adminDevice: {
        registeredOnThisAccount: userTokens.length > 0,
        activeTokensCount: userTokens.length,
      },
      devices: {
        totalActiveDevices,
        breakdown: tokenSummary,
      },
      deliveries: deliveryStats,
      notificationSettings: notifSettings || {
        pushEnabled: true,
        studentAbsent: true,
        feePayment: true,
        feeReminders: true,
        homework: true,
        examResults: true,
        announcements: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load PWA diagnostics" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !user.institutionId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: Administrator access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action || "test_push";

  if (action === "test_oauth") {
    const result = await testFirebaseAuth();
    return NextResponse.json({ ok: result.valid, ...result });
  }

  if (action === "test_push") {
    const tokens = await getUserActiveDeviceTokens(user.id);
    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "NO_ACTIVE_DEVICE_TOKENS",
        message: "No active device tokens found for your account. Please enable push notifications on this device first.",
      });
    }

    const testEventKey = `test_push_${user.id}_${Date.now()}`;
    const dispatchResult = await dispatchNotificationEvent({
      institutionId: user.institutionId,
      eventKey: testEventKey,
      eventType: "announcements",
      title: "EduLedger Test Notification",
      body: "Controlled test push alert from EduLedger School Administration.",
      deepLink: "/dashboard/settings/pwa",
      recipientUserIds: [user.id],
      data: { isTest: "true" },
      isServerAuthorizedTest: true,
    });

    return NextResponse.json({
      ok: !dispatchResult.skipped && (dispatchResult.pushSentCount > 0 || dispatchResult.inAppCount > 0),
      result: dispatchResult,
      recipientCount: dispatchResult.recipientCount,
      pushSentCount: dispatchResult.pushSentCount,
      inAppCount: dispatchResult.inAppCount,
      skipped: dispatchResult.skipped,
      reason: dispatchResult.reason,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
