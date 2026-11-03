import { NextResponse } from "next/server";
import { getInstitution, listManagedExaminations, listTeacherModuleRecords, listUserNotifications, teacherAssignedStudents } from "@/lib/db";
import { teacherApiContext, teacherNoStore } from "@/lib/teacher-auth";

export const runtime = "nodejs";
export async function GET() {
  const context = await teacherApiContext();
  if ("response" in context) return context.response;
  const { user, scope } = context;
  const [school, students, homework, leaveRequests, notifications] = await Promise.all([
    getInstitution(user.institutionId),
    teacherAssignedStudents(user.institutionId, scope.assignments),
    listTeacherModuleRecords(user.institutionId, "teacher_homework", user.id),
    listTeacherModuleRecords(user.institutionId, "teacher_leave_requests", user.id),
    listUserNotifications(user.id),
  ]);
  const examinations = new Map<string, Awaited<ReturnType<typeof listManagedExaminations>>[number]>();
  for (const assignment of scope.assignments)
    for (const exam of await listManagedExaminations(user.institutionId, assignment))
      examinations.set(exam.id, exam);
  return NextResponse.json({
    user: { name: user.name, email: user.email },
    school: { name: school.name, academicYear: school.academicYear },
    teacher: scope.teacher,
    assignments: scope.assignments,
    timetable: scope.timetable,
    students,
    homework,
    leaveRequests,
    examinations: [...examinations.values()],
    notifications: notifications.items,
    unread: notifications.unread,
  }, { headers: teacherNoStore });
}
