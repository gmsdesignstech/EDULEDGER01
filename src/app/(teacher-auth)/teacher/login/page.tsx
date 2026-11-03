import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/session";
import { roleHome, safeTeacherRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Teacher Sign In | EduLedger",
  robots: { index: false, follow: false },
};

export default async function TeacherLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  const query = searchParams ? await searchParams : undefined;
  const next = safeTeacherRedirect(query?.next);
  if (user) redirect(user.role === "TEACHER" ? next : roleHome(user.role));
  return <AuthForm mode="login" audience="teacher" afterLoginHref={next} />;
}
