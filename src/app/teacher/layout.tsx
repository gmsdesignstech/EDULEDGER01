import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { getInstitution } from "@/lib/db";
import { TeacherShell } from "@/components/teacher-shell";

export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "Teacher Portal | EduLedger",
  manifest: "/manifest-teacher.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Teacher Portal" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER", "/teacher");
  const school = await getInstitution(user.institutionId);
  return (
    <TeacherShell
      user={{ name: user.name, role: user.role, email: user.email }}
      schoolName={school.name}
      academicYear={school.academicYear}
    >
      {children}
    </TeacherShell>
  );
}
