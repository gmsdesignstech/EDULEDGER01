import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { currentUser } from "@/lib/session";
import { roleHome, safeParentRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Parent Sign In | EduLedger",
  manifest: "/manifest-parent.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Parent Portal" },
  robots: { index: false, follow: false },
};

export default async function ParentLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  const query = searchParams ? await searchParams : undefined;
  const next = safeParentRedirect(query?.next);
  if (user) redirect(user.role === "PARENT" ? next : roleHome(user.role));
  return <AuthForm mode="login" audience="parent" afterLoginHref={next} />;
}

