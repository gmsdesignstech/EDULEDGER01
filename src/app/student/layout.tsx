import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { getInstitution } from "@/lib/db";
import { StudentPortal } from "@/components/student-portal";

export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "Student Portal | EduLedger",
  manifest: "/manifest-student.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Student Portal" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT", "/student");
  const school = await getInstitution(user.institutionId);
  return <StudentPortal user={{ name: user.name }} schoolName={school.name}>{children}</StudentPortal>;
}
