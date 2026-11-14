import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { getInstitution } from "@/lib/db";
import { TeacherChangePasswordForm } from "./form";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Set Your Password | EduLedger Teacher Portal",
  manifest: "/teacher/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "EduLedger Teacher" },
  icons: {
    icon: "/icons/teacher/icon-192.png",
    apple: "/icons/teacher/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};

export default async function TeacherChangePasswordPage() {
  const user = await requireRole("TEACHER", "/teacher/change-password");
  const school = await getInstitution(user.institutionId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <TeacherChangePasswordForm
          teacherName={user.name}
          teacherEmail={user.email}
          schoolName={school.name}
        />
      </div>
    </main>
  );
}
