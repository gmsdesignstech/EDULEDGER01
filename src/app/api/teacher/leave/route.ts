import { NextResponse } from "next/server";
import { z } from "zod";
import { actOnSingleRecord, addTeacherModuleRecord, listTeacherModuleRecords } from "@/lib/db";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";

const schema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(5).max(1000),
}).refine(item => item.toDate >= item.fromDate, {
  message: "Leave end date must be on or after the start date.",
});

export async function GET() {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  return NextResponse.json({
    items: await listTeacherModuleRecords(context.user.institutionId, "teacher_leave_requests", context.user.id),
  }, { headers: teacherNoStore });
}

export async function POST(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid leave request." }, { status: 400, headers: teacherNoStore });
  }
  return NextResponse.json({
    item: await addTeacherModuleRecord(context.user.institutionId, "teacher_leave_requests", context.user.id, {
      ...parsed.data,
      status: "Pending",
    }),
  }, { status: 201, headers: teacherNoStore });
}

export async function DELETE(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Leave request ID is required." }, { status: 400, headers: teacherNoStore });
  try {
    const records = await listTeacherModuleRecords(context.user.institutionId, "teacher_leave_requests", context.user.id);
    const record = records.find(item => item.id === id);
    if (!record) return NextResponse.json({ error: "Leave request not found." }, { status: 404, headers: teacherNoStore });
    await actOnSingleRecord(context.user.institutionId, context.user.id, "module", id, "Teacher cancelled leave request", "teacher_leave_requests");
    return NextResponse.json({ ok: true }, { headers: teacherNoStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel leave request." }, { status: 404, headers: teacherNoStore });
  }
}
