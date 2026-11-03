import { NextResponse } from "next/server";
import { teacherAssignedStudents } from "@/lib/db";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const { user, scope } = context;
  const q = new URL(request.url).searchParams;
  const className = q.get("className");
  const section = q.get("section");

  let filteredAssignments = scope.assignments;
  if (className) {
    filteredAssignments = filteredAssignments.filter(
      a => a.className.trim().toLowerCase() === className.trim().toLowerCase()
    );
  }
  if (section) {
    filteredAssignments = filteredAssignments.filter(
      a => a.section.trim().toLowerCase() === section.trim().toLowerCase()
    );
  }

  const students = await teacherAssignedStudents(user.institutionId, filteredAssignments);
  return NextResponse.json({
    students,
    assignments: scope.assignments,
  }, { headers: teacherNoStore });
}

