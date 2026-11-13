import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { deleteTeacher, getCompleteSettings, listTeachers, updateTeacher, upsertTeacherAccount } from "@/lib/db";
import { parseTeacherClasses, serializeTeacherClasses, standardTeacherClasses, teacherClassesInputSchema } from "@/lib/teacher-classes";
import { isUniqueConstraintError, logServerError } from "@/lib/server-errors";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

const teacherSchema = z.object({
  name: z.string().trim().min(2, "Teacher name is required (min 2 characters)."),
  employeeId: z.string().trim().min(2, "Employee ID is required."),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]).optional().default(""),
  phone: z.string().trim().min(8, "Phone number must be at least 8 digits."),
  department: z.string().trim().min(1, "Department is required."),
  subject: z.string().trim().min(1, "Primary subject is required."),
  classes: teacherClassesInputSchema,
  joiningDate: z.string().min(10, "Joining date is required."),
  salary: z.coerce.number().min(0, "Salary must be non-negative."),
  status: z.enum(["Active", "Inactive", "On Leave"]),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const parsed = teacherSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid teacher data." },
        { status: 400 },
      );
    }

    const id = (await params).id;
    const current = (await listTeachers(user.institutionId)).find((item) => item.id === id);
    if (!current) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    const settings = await getCompleteSettings(user.institutionId);
    const allowed = new Set(
      [
        ...standardTeacherClasses,
        ...settings.classes.filter((item) => item.active).map((item) => item.name),
        ...parseTeacherClasses(current.classes),
      ].map((name) => name.toLowerCase()),
    );
    if (parsed.data.classes.some((name) => !allowed.has(name.toLowerCase()))) {
      return NextResponse.json(
        { error: "Select classes from the available options." },
        { status: 400 },
      );
    }

    const teacher = await updateTeacher(
      user.institutionId,
      id,
      { ...parsed.data, classes: serializeTeacherClasses(parsed.data.classes) },
      user.id,
    );

    let passwordHash: string | undefined = undefined;
    if (parsed.data.password) {
      passwordHash = await hash(parsed.data.password, 10);
    }

    await upsertTeacherAccount(user.institutionId, {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      status: parsed.data.status,
      previousEmail: current.email,
      teacherId: id,
      passwordHash,
    });

    return NextResponse.json({ teacher });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "Employee ID or email already exists." },
        { status: 409 },
      );
    }
    logServerError("teachers.update", error);
    return NextResponse.json(
      { error: "Could not update the teacher. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = (await params).id;
    const ok = await deleteTeacher(user.institutionId, id, user.id);
    return ok
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  } catch (error) {
    logServerError("teachers.delete", error);
    return NextResponse.json(
      { error: "Could not delete the teacher. Please try again." },
      { status: 500 },
    );
  }
}
