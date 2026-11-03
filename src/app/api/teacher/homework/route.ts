import { NextResponse } from "next/server";
import { z } from "zod";
import { actOnSingleRecord, addTeacherModuleRecord, listTeacherModuleRecords, teacherHasAssignment, updateTeacherHomeworkStatus } from "@/lib/db";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";

const create = z.object({
  academicYear: z.string().trim().min(4).max(20),
  className: z.string().trim().min(1).max(100),
  section: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(100),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().min(2).max(2000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const update = z.object({
  id: z.string().trim().min(1).max(100),
  status: z.enum(["Active", "Archived"]),
});

export async function GET() {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  return NextResponse.json({
    items: await listTeacherModuleRecords(context.user.institutionId, "teacher_homework", context.user.id),
    assignments: context.scope.assignments,
  }, { headers: teacherNoStore });
}

export async function POST(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const parsed = create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid homework." }, { status: 400, headers: teacherNoStore });
  }
  if (!teacherHasAssignment(context.scope.assignments, parsed.data)) {
    return NextResponse.json({ error: "You can only assign homework to your assigned subject, class, and section." }, { status: 403, headers: teacherNoStore });
  }
  return NextResponse.json({
    item: await addTeacherModuleRecord(context.user.institutionId, "teacher_homework", context.user.id, { ...parsed.data, status: "Active" }),
  }, { status: 201, headers: teacherNoStore });
}

export async function PATCH(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const parsed = update.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid homework update." }, { status: 400, headers: teacherNoStore });
  }
  try {
    return NextResponse.json({
      item: await updateTeacherHomeworkStatus(context.user.institutionId, context.user.id, parsed.data.id, parsed.data.status),
    }, { headers: teacherNoStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update homework." }, { status: 404, headers: teacherNoStore });
  }
}

export async function DELETE(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Homework ID is required." }, { status: 400, headers: teacherNoStore });
  try {
    const records = await listTeacherModuleRecords(context.user.institutionId, "teacher_homework", context.user.id);
    const record = records.find(item => item.id === id);
    if (!record) return NextResponse.json({ error: "Homework not found." }, { status: 404, headers: teacherNoStore });
    await actOnSingleRecord(context.user.institutionId, context.user.id, "module", id, "Teacher deleted homework", "teacher_homework");
    return NextResponse.json({ ok: true }, { headers: teacherNoStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete homework." }, { status: 404, headers: teacherNoStore });
  }
}
