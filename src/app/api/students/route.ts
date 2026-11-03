import { NextResponse } from "next/server";
import { z } from "zod";
import { bloodGroupSchema, motherNameSchema } from "@/lib/student-fields";
import { quotaDescriptionSchema, quotaPairError, specialQuotaSchema } from "@/lib/student-quota";
import {
  addStudent,
  assertStudentCapacity,
  getCompleteSettings,
  getSubscription,
  listStudents,
  previewStudentRoll,
} from "@/lib/db";
import { currentUser } from "@/lib/session";
import {
  explainCapacityError,
  subscriptionAccessError,
} from "@/lib/subscription-access";
import { isUniqueConstraintError, logServerError } from "@/lib/server-errors";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
export const runtime = "nodejs";
const studentInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  admission: z.string().trim().min(2).max(40),
  gender: z.enum(["Male", "Female", "Other"]),
  bloodGroup: bloodGroupSchema,
  motherName: motherNameSchema,
  specialQuota: specialQuotaSchema,
  specialQuotaDescription: quotaDescriptionSchema,
  dateOfBirth: z.string().min(10),
  className: z.string().trim().min(1).max(40),
  section: z.string().trim().max(20),
  parent: z.string().trim().min(2).max(100),
  parentPhone: z
    .string()
    .trim()
    .transform(value=>normalizeWhatsAppNumber(value)),
  whatsappEnabled: z.boolean().default(false),
  whatsappAttendance: z.boolean().default(false),
  whatsappAcademics: z.boolean().default(false),
  whatsappFees: z.boolean().default(false),
  whatsappNotices: z.boolean().default(false),
  whatsappGeneral: z.boolean().default(false),
  parentEmail: z.union([z.literal(""), z.string().email()]),
  address: z.string().trim().max(500),
  admissionDate: z.string().min(10),
  totalFee: z.coerce.number().min(0).max(100000000),
  academicYear: z.string().trim().min(4).max(20),
  dueDate: z.string().min(10),
});
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const settings=await getCompleteSettings(user.institutionId),selectedYear=q.get("year")||settings.academicYear;
  const students = await listStudents(user.institutionId, {
    search: q.get("search") || undefined,
    className: q.get("class") || undefined,
    section: q.get("section") || undefined,
    fee: q.get("fee") || undefined,
    limit: q.get("limit") ? Number(q.get("limit")) : undefined,
    offset: q.get("offset") ? Number(q.get("offset")) : undefined,
    academicYear:selectedYear,
    status:q.get("status")||undefined,
  });
  let rollPreview="",rollError="";
  try { rollPreview=await previewStudentRoll(user.institutionId,selectedYear); }
  catch(error) { rollError=error instanceof Error&&/^(School code must|Select a valid academic year)/.test(error.message)?error.message:"Unable to generate roll number."; }
  return NextResponse.json({
    students,
    rollPreview,
    rollError,
    schoolCode:settings.schoolCode,
    academicYear: selectedYear,
    academicYears:settings.years.map(item=>item.name),
    configuredClasses: settings.classes.filter(item=>item.active).map(item=>({name:item.name,sections:item.sections})),
    canDemote:["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role),
    canGenerateIds:["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role),
    canManageLifecycle:["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role),
  });
}
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "STAFF"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const subscription=await getSubscription(user.institutionId),allowFirstUnpaidEnrollment=user.role==="SCHOOL_ADMIN"&&!['ACTIVE','EXPIRING_SOON'].includes(subscription.status)&&subscription.studentUsage===0;
  const access = await subscriptionAccessError(user.institutionId);
  if (access&&!allowFirstUnpaidEnrollment) return NextResponse.json(access, { status: access.status });
  const parsed = studentInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid student details" },
      { status: 400 },
    );
  const quotaError = quotaPairError(parsed.data.specialQuota, parsed.data.specialQuotaDescription);
  if (quotaError) return NextResponse.json({ error: quotaError }, { status: 400 });
  try {
    const settings=await getCompleteSettings(user.institutionId);
    if(!settings.years.some(year=>year.name===parsed.data.academicYear&&year.status==="Active"))return NextResponse.json({error:"Select an available academic year."},{status:400});
    await previewStudentRoll(user.institutionId,parsed.data.academicYear);
    if(!allowFirstUnpaidEnrollment)await assertStudentCapacity(user.institutionId);
    return NextResponse.json(
      { student: await addStudent(user.institutionId, parsed.data, user.id, { enforceCapacity: true,allowFirstUnpaidEnrollment }) },
      { status: 201 },
    );
  } catch (error) {
    if(error instanceof Error&&/School code must|Select a valid academic year/.test(error.message))return NextResponse.json({error:error.message},{status:400});
    const capacity = explainCapacityError(error);
    if (capacity)
      return NextResponse.json({ error: capacity }, { status: 409 });
    if (isUniqueConstraintError(error))
      return NextResponse.json(
        { error: "That admission number already exists." },
        { status: 409 },
      );
    logServerError("students.create", error);
    return NextResponse.json(
      { error: "Could not save the student. Please try again." },
      { status: 500 },
    );
  }
}
