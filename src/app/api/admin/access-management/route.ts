import { NextResponse } from "next/server";
import { privateAdmin } from "@/lib/admin-auth";
import {
  getMultiSchoolAccessOverview,
  provisionSchoolAccounts,
  toggleInstitutionStatus,
} from "@/lib/account-provisioning";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function GET() {
  const admin = await privateAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Private admin authorization required." }, { status: 403 });
  }

  try {
    const overview = await getMultiSchoolAccessOverview();
    return NextResponse.json({ success: true, ...overview });
  } catch (error) {
    const requestId = crypto.randomUUID();
    logServerError("admin.access-management.GET", error, { requestId, role: admin.role, httpStatus: 500 });
    return NextResponse.json(
      { error: "Unable to load multi-school access data. Please try again.", requestId },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const admin = await privateAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Private admin authorization required." }, { status: 403 });
  }

  const requestId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const { action, institutionId, target } = body;

    if (action === "provision" && institutionId) {
      const result = await provisionSchoolAccounts(institutionId, {
        target: target || "all",
        adminUserId: admin.id,
      });
      return NextResponse.json(result);
    }

    if (action === "provision-all") {
      const overview = await getMultiSchoolAccessOverview();
      const results = [];
      for (const school of overview.schools) {
        if (school.pendingTeacherCount > 0 || school.pendingParentCount > 0) {
          const res = await provisionSchoolAccounts(school.id, {
            target: "all",
            adminUserId: admin.id,
          });
          results.push(res);
        }
      }
      return NextResponse.json({
        success: true,
        action: "provision-all",
        processedSchoolsCount: results.length,
        results,
      });
    }

    return NextResponse.json({ error: "Invalid action or missing institutionId" }, { status: 400 });
  } catch (error) {
    logServerError("admin.access-management.POST", error, { requestId, role: admin.role, httpStatus: 500 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Account provisioning failed.", requestId },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await privateAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Private admin authorization required." }, { status: 403 });
  }

  const requestId = crypto.randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const { action, institutionId, status } = body;

    if (action === "toggle-status" && institutionId && (status === "Active" || status === "Suspended")) {
      const result = await toggleInstitutionStatus(institutionId, status, admin.id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid patch payload" }, { status: 400 });
  } catch (error) {
    logServerError("admin.access-management.PATCH", error, { requestId, role: admin.role, httpStatus: 500 });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status update failed.", requestId },
      { status: 500 }
    );
  }
}

