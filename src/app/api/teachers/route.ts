import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { formatTeacherLoginId, getCompleteSettings, getInstitution, listTeachers, saveTeacher, upsertTeacherAccount } from "@/lib/db";
import { parseTeacherClasses, standardTeacherClasses, teacherClassesInputSchema, serializeTeacherClasses } from "@/lib/teacher-classes";
import { isUniqueConstraintError, logServerError } from "@/lib/server-errors";
import { currentUser } from "@/lib/session";
import { generateSecureTemporaryPassword } from "@/lib/account-provisioning";

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

export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const [teachers, settings] = await Promise.all([
      listTeachers(user.institutionId, new URL(request.url).searchParams.get("search") || ""),
      getCompleteSettings(user.institutionId),
    ]);
    return NextResponse.json({
      teachers: teachers.map((teacher) => ({
        ...teacher,
        assignedClasses: parseTeacherClasses(teacher.classes),
      })),
      classOptions: [
        ...new Set([
          ...standardTeacherClasses,
          ...settings.classes.filter((item) => item.active).map((item) => item.name),
        ]),
      ],
      canEdit: ["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role),
    });
  } catch (error) {
    logServerError("teachers.list", error);
    return NextResponse.json(
      { error: "Could not load teachers. Please try again." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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

    const [settings, school] = await Promise.all([
      getCompleteSettings(user.institutionId),
      getInstitution(user.institutionId),
    ]);
    const allowed = new Set(
      [
        ...standardTeacherClasses,
        ...settings.classes.filter((item) => item.active).map((item) => item.name),
      ].map((name) => name.toLowerCase()),
    );
    if (parsed.data.classes.some((name) => !allowed.has(name.toLowerCase()))) {
      return NextResponse.json(
        { error: "Select classes from the available options." },
        { status: 400 },
      );
    }

    const schoolCode = settings.schoolCode || school.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();
    const loginId = formatTeacherLoginId(schoolCode, parsed.data.employeeId);

    const teacher = await saveTeacher(
      user.institutionId,
      { ...parsed.data, loginId, classes: serializeTeacherClasses(parsed.data.classes) },
      user.id,
    );

    let temporaryPassword = "";
    const plainPassword =
      parsed.data.password || (temporaryPassword = generateSecureTemporaryPassword());
    const passwordHash = await hash(plainPassword, 10);
    const mustChangePassword = !parsed.data.password;

    await upsertTeacherAccount(user.institutionId, {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      phone: parsed.data.phone,
      status: parsed.data.status,
      teacherId: teacher.id,
      loginId,
      mustChangePassword,
    });

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "eduledger.co.in";
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const loginUrl = `${origin}/teacher/login`;

    return NextResponse.json(
      {
        teacher: { ...teacher, loginId },
        temporaryPassword: temporaryPassword || undefined,
        credentials: {
          teacherId: teacher.id,
          name: teacher.name,
          employeeId: teacher.employeeId,
          loginId,
          temporaryPassword: plainPassword,
          email: teacher.email || undefined,
          phone: teacher.phone,
          schoolName: school.name,
          loginUrl,
          status: teacher.status,
          mustChangePassword,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "Employee ID or email already exists." },
        { status: 409 },
      );
    }
    logServerError("teachers.create", error);
    return NextResponse.json(
      { error: "Could not save the teacher. Please try again." },
      { status: 500 },
    );
  }
}
