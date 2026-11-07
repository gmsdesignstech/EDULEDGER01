import { Shell } from "@/components/dashboard";
import { getInstitution, getSubscription } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { EduCacheProvider } from "@/components/edu-cache-provider";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { roleHome } from "@/lib/auth-redirect";
import { PortalNetworkStatus } from "@/components/portal-network-status";
export const runtime = "nodejs";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if(["SUPER_ADMIN","TEACHER","PARENT","STUDENT"].includes(user.role))redirect(roleHome(user.role));
  const
    [subscription,institution] = await Promise.all([getSubscription(user.institutionId),getInstitution(user.institutionId)]);
  return (
    <EduCacheProvider scope={`${user.institutionId}:${user.id}`}>
    <Shell
      user={{ name: user.name, role: user.role }}
      schoolName={institution.name}
      academicYear={institution.academicYear}
      subscription={subscription}
    >
      <PortalNetworkStatus />
      {children}
    </Shell>
    </EduCacheProvider>
  );
}
