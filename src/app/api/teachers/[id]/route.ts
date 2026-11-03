import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { deleteTeacher, getCompleteSettings, listTeachers, updateTeacher, upsertTeacherAccount } from "@/lib/db";
import { parseTeacherClasses, serializeTeacherClasses, standardTeacherClasses, teacherClassesInputSchema } from "@/lib/teacher-classes";
import { isUniqueConstraintError, logServerError } from "@/lib/server-errors";
import { currentUser } from "@/lib/session";
export const runtime = "nodejs";
const teacherSchema = z.object({
  name: z.string().trim().min(2),
  employeeId: z.string().trim().min(2),
  email: z.string(),
  phone: z.string().trim().min(8),
  department: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  classes: teacherClassesInputSchema,
  joiningDate: z.string().min(10),
  salary: z.coerce.number().min(0),
  status: z.enum(["Active", "Inactive", "On Leave"]),
  password: z.string().min(8).max(128).optional(),
});
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = teacherSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid teacher" },
      { status: 400 },
    );
  const id=(await params).id;
  const current=(await listTeachers(user.institutionId)).find(item=>item.id===id);
  if(!current)return NextResponse.json({error:"Teacher not found"},{status:404});
  const settings=await getCompleteSettings(user.institutionId);
  const allowed=new Set([...standardTeacherClasses,...settings.classes.filter(item=>item.active).map(item=>item.name),...parseTeacherClasses(current.classes)].map(name=>name.toLocaleLowerCase()));
  if(parsed.data.classes.some(name=>!allowed.has(name.toLocaleLowerCase())))return NextResponse.json({error:"Select classes from the available options."},{status:400});
  try {
    const teacher=await updateTeacher(user.institutionId,id,{...parsed.data,classes:serializeTeacherClasses(parsed.data.classes)},user.id);
    if (parsed.data.password && parsed.data.email) {
      const passwordHash = await hash(parsed.data.password, 10);
      await upsertTeacherAccount(user.institutionId, {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        phone: parsed.data.phone,
      });
    }
    return NextResponse.json({teacher});
  } catch(error) {
    if(isUniqueConstraintError(error))return NextResponse.json({error:"Employee ID already exists."},{status:409});
    logServerError("teachers.update",error);
    return NextResponse.json({error:"Could not update the teacher. Please try again."},{status:500});
  }
}
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return (await deleteTeacher(user.institutionId, (await params).id, user.id))
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Teacher not found" }, { status: 404 });
}
