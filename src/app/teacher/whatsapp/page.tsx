import { WhatsAppCommunicationHub } from "@/components/whatsapp-communication-hub";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export default async function TeacherWhatsAppPage() {
  const user = await requireRole("TEACHER", "/teacher");
  return <WhatsAppCommunicationHub userRole={user.role} isTeacherView={true} />;
}

