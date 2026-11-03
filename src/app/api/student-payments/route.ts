import { NextResponse } from "next/server";
import { z } from "zod";
import { listPayments, recordPayment } from "@/lib/db";
import { currentUser } from "@/lib/session";
export const runtime = "nodejs";
const schema = z.object({
  feeId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.enum(["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Online", "Other"]),
  frequency:z.enum(["Daily","Weekly","Monthly","Quarterly","Half-Yearly","Yearly","Custom"]).default("Custom"),
  discountType:z.enum(["Fixed","Percentage"]).default("Fixed"),
  discountValue:z.coerce.number().min(0).max(100000000).default(0),
  discountReason:z.string().trim().max(250).default(""),
  lateFee:z.coerce.number().min(0).max(100000000).default(0),
  paymentDate: z.string().min(10),
  transactionId: z.string().trim().max(100).default(""),
  notes: z.string().trim().max(500).default(""),
  requestId:z.string().uuid().optional(),
});
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if(!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  const q = new URL(request.url).searchParams;
  return NextResponse.json({
    payments: await listPayments(user.institutionId, {
      search: q.get("search") || undefined,
      className: q.get("class") || undefined,
      section: q.get("section") || undefined,
      method: q.get("method") || undefined,
      status: q.get("status") || undefined,
      from: q.get("from") || undefined,
      to: q.get("to") || undefined,
      studentId: q.get("studentId") || undefined,
      academicYear:q.get("year")||undefined,
    }),
  });
}
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "ACCOUNTANT"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid payment" },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      { payment: await recordPayment(user.institutionId, user.id, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment failed" },
      { status: 400 },
    );
  }
}
