import { NextResponse } from "next/server";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";

export async function GET() {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  return NextResponse.json({
    timetable: context.scope.timetable,
    assignments: context.scope.assignments,
    teacher: context.scope.teacher,
  }, { headers: teacherNoStore });
}

