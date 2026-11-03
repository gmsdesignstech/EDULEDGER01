import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { getInstitution, parentChildren } from "@/lib/db";
import { ParentProvider } from "@/components/parent-context";
import { ParentShell } from "@/components/parent-shell";

export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "Parent Portal | EduLedger",
  manifest: "/manifest-parent.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Parent Portal" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("PARENT", "/parent");
  const school = await getInstitution(user.institutionId);
  const initialChildren = await parentChildren(user.institutionId, user.id);

  return (
    <ParentProvider initialChildren={initialChildren}>
      <ParentShell
        user={{ name: user.name, role: user.role, email: user.email }}
        schoolName={school.name}
        academicYear={school.academicYear}
      >
        {children}
      </ParentShell>
    </ParentProvider>
  );
}
