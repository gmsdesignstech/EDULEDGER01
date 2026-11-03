import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { isPrivateAdmin } from "@/lib/admin-auth";
import { roleHome } from "@/lib/auth-redirect";
import { SuperAdminLoginForm } from "@/components/super-admin-login-form";

export const metadata: Metadata = {
  title: "Super Admin Portal | EduLedger Platform Owner Access",
  description:
    "Secure administrative control center for the EduLedger SaaS platform owner.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SuperAdminLoginPage() {
  const user = (await currentUser()) as
    | { id: string; email: string; name: string; role: string; institutionId: string }
    | undefined;

  if (user) {
    if (isPrivateAdmin(user)) {
      redirect("/admin/dashboard");
    } else {
      // Normal school users, teachers, parents get redirected to their portal
      redirect(roleHome(user.role));
    }
  }

  return <SuperAdminLoginForm />;
}

