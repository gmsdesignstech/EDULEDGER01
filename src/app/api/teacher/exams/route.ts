import { NextResponse } from "next/server";
import { z } from "zod";
import { listManagedExaminations, managedResultDetail, saveManagedMarks, teacherHasAssignment } from "@/lib/db";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";

const marks = z.object({
  examId: z.string().trim().min(1).max(100),
  subjectId: z.string().trim().min(1).max(100),
  items: z.array(z.object({
    studentId: z.string().trim().min(1).max(100),
    markStatus: z.enum(["Scored", "Absent", "Exempt"]),
    obtainedMarks: z.number().nullable().optional(),
    remarks: z.string().max(500).default(""),
  })).min(1).max(500),
});

function scoped(detail: Awaited<ReturnType<typeof managedResultDetail>>, assignments: Parameters<typeof teacherHasAssignment>[0]) {
  const subjects = detail.subjects.filter(subject =>
    teacherHasAssignment(assignments, {
      academicYear: detail.exam.academicYear,
      className: detail.exam.className,
      section: detail.exam.section,
      subject: subject.subject,
    })
  );
  const ids = new Set(subjects.map(item => item.id));
  return {
    ...detail,
    subjects,
    students: detail.students.map(student => ({
      ...student,
      subjects: student.subjects.filter(item => ids.has(item.subjectId)),
    })),
  };
}

export async function GET(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const examId = new URL(request.url).searchParams.get("examId");
  if (!examId) {
    const examinations = new Map<string, Awaited<ReturnType<typeof listManagedExaminations>>[number]>();
    for (const assignment of context.scope.assignments) {
      for (const exam of await listManagedExaminations(context.user.institutionId, assignment)) {
        examinations.set(exam.id, exam);
      }
    }
    return NextResponse.json({ items: [...examinations.values()] }, { headers: teacherNoStore });
  }
  try {
    const detail = scoped(await managedResultDetail(context.user.institutionId, examId), context.scope.assignments);
    if (!detail.subjects.length) {
      return NextResponse.json({ error: "You are not assigned to this examination." }, { status: 403, headers: teacherNoStore });
    }
    return NextResponse.json({ detail }, { headers: teacherNoStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load examination." }, { status: 404, headers: teacherNoStore });
  }
}

export async function POST(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const parsed = marks.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid marks." }, { status: 400, headers: teacherNoStore });
  }
  try {
    const detail = await managedResultDetail(context.user.institutionId, parsed.data.examId);
    const subject = detail.subjects.find(item => item.id === parsed.data.subjectId);
    if (
      !subject ||
      !teacherHasAssignment(context.scope.assignments, {
        academicYear: detail.exam.academicYear,
        className: detail.exam.className,
        section: detail.exam.section,
        subject: subject.subject,
      })
    ) {
      return NextResponse.json({ error: "You can only enter marks for your assigned subject, class, and section." }, { status: 403, headers: teacherNoStore });
    }
    return NextResponse.json({
      detail: scoped(await saveManagedMarks(context.user.institutionId, context.user.id, parsed.data.examId, parsed.data.subjectId, parsed.data.items), context.scope.assignments),
    }, { headers: teacherNoStore });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save marks." }, { status: 409, headers: teacherNoStore });
  }
}
