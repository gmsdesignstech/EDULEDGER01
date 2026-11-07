import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/session";
import { roleHome, safeStudentRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Student Sign In | EduLedger",
  manifest: "/manifest-student.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Student Portal" },
  robots: { index: false, follow: false },
};

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  const query = searchParams ? await searchParams : undefined;
  const next = safeStudentRedirect(query?.next);
  if (user) redirect(user.role === "STUDENT" ? next : roleHome(user.role));
  return <AuthForm mode="login" audience="student" afterLoginHref={next} />;
}
