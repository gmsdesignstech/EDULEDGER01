import { currentUser } from "@/lib/session";
import { getSchoolQrPaymentScreenshot, getSchoolQrPayment } from "@/lib/db";
import { parentChildren } from "@/lib/db";

export const runtime = "nodejs";

const noStore = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) return new Response("Unauthenticated", { status: 401, headers: noStore });

  // Verify access: Admin/Accountant or Parent of the child
  const payment = await getSchoolQrPayment(user.institutionId, id);
  if (!payment) return new Response("Not found", { status: 404, headers: noStore });

  if (user.role === "PARENT") {
    const children = await parentChildren(user.institutionId, user.id);
    const authorized = children.some((c) => c.id === payment.studentId);
    if (!authorized) {
      return new Response("Forbidden", { status: 403, headers: noStore });
    }
  } else if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role)) {
    return new Response("Forbidden", { status: 403, headers: noStore });
  }

  const asset = await getSchoolQrPaymentScreenshot(user.institutionId, id);
  if (!asset) return new Response("Screenshot not found", { status: 404, headers: noStore });

  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, no-store",
    },
  });
}

