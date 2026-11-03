import { NextResponse } from "next/server";
import { z } from "zod";
import { adminSalaryEmployees, cancelAdminSalary, createAdminSalary, getAdminSalary, reconcileSalaryTransactions, schoolSalaryData, updateAdminSalaryPayment } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
const allowed = (role: string) => ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(role);
const money = z.union([z.string(), z.number()]).transform(String).refine(value => /^\d+(\.\d{1,2})?$/.test(value)).transform(value => Math.round(Number(value) * 100));
const create = z.object({ employeeKey: z.string(), month: z.coerce.number().int().min(1).max(12), year: z.coerce.number().int().min(2000).max(2200), basicPaise: money, allowancesPaise: money, bonusPaise: money, overtimePaise: money, otherEarningsPaise: money, deductionsPaise: money, advanceDeductionPaise: money, otherDeductionsPaise: money, notes: z.string().max(1000).default("") });
const payment = z.object({ action: z.literal("payment"), id: z.string().uuid(), paidAmount: money, paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), paymentMethod: z.enum(["Cash", "Bank Transfer", "UPI", "Cheque", "Other"]), paymentReference: z.string().max(100), paymentNotes: z.string().max(500), requestId: z.string().uuid() });
const cancel = z.object({ action: z.literal("cancel"), id: z.string().uuid() });
const reconcile = z.object({ action: z.literal("reconcile") });

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || !allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const q = new URL(request.url).searchParams;
    return NextResponse.json(await schoolSalaryData(user.institutionId, { search: q.get("search") || undefined, status: q.get("status") || undefined, month: Number(q.get("month")) || undefined, year: Number(q.get("year")) || undefined, limit: 25, offset: Number(q.get("offset")) || 0 }));
  } catch { return NextResponse.json({ error: "Unable to load salary records." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || !allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid salary details." }, { status: 400 });
  const employee = (await adminSalaryEmployees()).find(item => item.key === parsed.data.employeeKey && item.institutionId === user.institutionId);
  if (!employee) return NextResponse.json({ error: "Employee does not belong to your school." }, { status: 403 });
  try { return NextResponse.json(await createAdminSalary(user.id, parsed.data), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: /unique/i.test(String(error)) ? "Salary already exists for this employee and month." : error instanceof Error ? error.message : "Unable to save salary." }, { status: 409 }); }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !allowed(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = z.union([payment, cancel, reconcile]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  try {
    if (parsed.data.action === "reconcile") {
      if (!["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Only school administrators can reconcile salary transactions." }, { status: 403 });
      return NextResponse.json({ summary: await reconcileSalaryTransactions(user.institutionId, user.id) });
    }
    const salary = await getAdminSalary(parsed.data.id,user.institutionId);
    if (!salary) return NextResponse.json({ error: "Salary record not found." }, { status: 404 });
    if (parsed.data.action === "cancel") { await cancelAdminSalary(user.id,user.institutionId,parsed.data.id); return NextResponse.json({ success: true }); }
    return NextResponse.json(await updateAdminSalaryPayment(user.id, user.institutionId, parsed.data.id, { amountPaise: parsed.data.paidAmount, paymentDate: parsed.data.paymentDate, paymentMethod: parsed.data.paymentMethod, paymentReference: parsed.data.paymentReference, paymentNotes: parsed.data.paymentNotes, requestId: parsed.data.requestId }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Payment failed." }, { status: 409 }); }
}
