import { WhatsAppCommunicationHub } from "@/components/whatsapp-communication-hub";
import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

export default async function Page() {
  const user = await requireUser();
  if (!["SCHOOL_ADMIN", "SUPER_ADMIN", "TEACHER", "ACCOUNTANT"].includes(user.role)) {
    notFound();
  }
  return <WhatsAppCommunicationHub userRole={user.role} />;
}
