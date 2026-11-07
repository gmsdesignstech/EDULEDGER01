import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getPwaDiagnosticsData } from "@/lib/db";

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
    const hasVapidKey = Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    );
    const hasProjectId = Boolean(process.env.FIREBASE_PROJECT_ID);
    const hasClientEmail = Boolean(process.env.FIREBASE_CLIENT_EMAIL);
    const hasPrivateKey = Boolean(
      process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    );
    const isFirebaseConfigured = hasProjectId && hasClientEmail && hasPrivateKey && hasVapidKey;

    // 2. Query FCM Device Token Counts & Delivery Statistics for this School
    const { tokenSummary, totalActiveDevices, deliveryStats, notifSettings } =
      await getPwaDiagnosticsData(user.institutionId);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      institutionId: user.institutionId,
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
        status: isFirebaseConfigured ? "PASS" : "NOT CONFIGURED",
        configured: isFirebaseConfigured,
        hasVapidKey,
        hasProjectId,
        hasClientEmail,
        hasPrivateKey,
        pushService: "Firebase Cloud Messaging v1 (HTTP v1)",
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
