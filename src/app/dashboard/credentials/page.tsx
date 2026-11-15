import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { AccountCredentialManagement } from "@/components/account-credential-management";

export const metadata: Metadata = {
  title: "Account & Credential Management | EduLedger",
  description: "Centralized account provisioning, default password management, and official credentials PDF generation.",
};

export default async function CredentialsPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/login");
  }

  if (!["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    redirect("/dashboard");
  }

  return <AccountCredentialManagement />;
}
