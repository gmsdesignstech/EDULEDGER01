import { NextResponse } from "next/server";
import { changeStudentStatus, deleteStudent, getStudent, updateStudent } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { z } from "zod";
import { bloodGroupSchema, motherNameSchema } from "@/lib/student-fields";
import { quotaDescriptionSchema, quotaPairError, specialQuotaSchema } from "@/lib/student-quota";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
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
  parentPhone: z.string().trim().transform(value=>normalizeWhatsAppNumber(value)),
  whatsappEnabled: z.boolean(),
  whatsappAttendance: z.boolean(),
  whatsappAcademics: z.boolean(),
  whatsappFees: z.boolean(),
  whatsappNotices: z.boolean(),
  whatsappGeneral: z.boolean(),
  parentEmail: z.union([z.literal(""), z.string().email()]),
  address: z.string().trim().max(500),
  admissionDate: z.string().min(10),
  totalFee: z.coerce.number().min(0).max(100000000),
  academicYear: z.string().trim().min(4).max(20),
  dueDate: z.string(),
});
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params,
    student = await getStudent(user.institutionId, id);
  return student
    ? NextResponse.json({ student })
    : NextResponse.json({ error: "Student not found" }, { status: 404 });
}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "STAFF"].includes(user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = studentInputSchema
    .partial()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid student details" },
      { status: 400 },
    );
  const old = await getStudent(user.institutionId, (await params).id);
  if (!old) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  if (parsed.data.specialQuota !== undefined && parsed.data.specialQuota !== "Other" && parsed.data.specialQuotaDescription === undefined) parsed.data.specialQuotaDescription = "";
  const quotaError = quotaPairError(parsed.data.specialQuota ?? old.specialQuota, parsed.data.specialQuotaDescription ?? old.specialQuotaDescription);
  if (quotaError) return NextResponse.json({ error: quotaError }, { status: 400 });
  try {
    return NextResponse.json({
      student: await updateStudent(
        user.institutionId,
        (await params).id,
        parsed.data,
        user.id,
      ),
    });
  } catch (error) {
    const message=error instanceof Error?error.message:"";
    const safeMessage=/^(Total Fee|Choose a class|Student not found)/.test(message)?message:"Could not update the student.";
    return NextResponse.json(
      { error: safeMessage },
      { status: 400 },
    );
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
  try {
    return (await deleteStudent(user.institutionId, (await params).id, user.id))
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Student not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not delete student",
      },
      { status: 409 },
    );
  }
}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});if(!["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
 const parsed=z.object({status:z.enum(["Active","Inactive","Left Out","Transferred","Graduated","Archived"]),leavingDate:z.string().min(10).optional(),reason:z.string().trim().max(250).optional(),remarks:z.string().trim().max(500).optional()}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid status change"},{status:400});
 try{return NextResponse.json({student:await changeStudentStatus(user.institutionId,(await params).id,user.id,parsed.data)})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not update student status"},{status:400})}
}
