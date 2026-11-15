import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { synchronizeAllInstitutionAccounts } from "@/lib/account-provisioning";
import { logServerError } from "@/lib/server-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: Administrator access required" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await synchronizeAllInstitutionAccounts(user.institutionId, {
      regenerateAllTeachers: Boolean(body?.regenerateAllTeachers),
      regenerateAllStudents: Boolean(body?.regenerateAllStudents),
      adminUserId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const requestId = crypto.randomUUID();
    logServerError("admin.accounts.synchronize", error, { requestId });
    return NextResponse.json(
      { error: "Account synchronization failed. Please try again." },
      { status: 500 }
    );
  }
}
