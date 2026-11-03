import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { WhatsAppAddonCheckout } from "@/components/whatsapp-addon-checkout";
import { getInstitution, getSubscription, getWhatsAppAddonSubscription } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isSubscriptionActive } from "@/lib/subscription";
import { WHATSAPP_ADDON_MAX_STUDENTS } from "@/lib/whatsapp-pricing";

export const runtime = "nodejs";

export default async function WhatsAppSubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ students?: string }>;
}) {
  const query = await searchParams;
  const parsedStudents = query?.students ? Number(query.students) : undefined;
  const urlRequestedStudentCount =
    Number.isInteger(parsedStudents) &&
    parsedStudents! >= 1 &&
    parsedStudents! <= WHATSAPP_ADDON_MAX_STUDENTS
      ? parsedStudents
      : undefined;
  const returnPath = urlRequestedStudentCount
    ? `/whatsapp/subscribe?students=${urlRequestedStudentCount}`
    : "/whatsapp/subscribe";
  const user = await requireUser(returnPath);
  const [institution, subscription, addon] = await Promise.all([
    getInstitution(user.institutionId),
    getSubscription(user.institutionId),
    getWhatsAppAddonSubscription(user.institutionId),
  ]);
  const minimum = Math.max(1, subscription.studentUsage);
  const initial = urlRequestedStudentCount ?? Math.min(WHATSAPP_ADDON_MAX_STUDENTS, minimum);

  if (!isSubscriptionActive(subscription.status))
    redirect(
      `/subscription?students=${initial}&next=${encodeURIComponent(returnPath)}`,
    );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4"><Logo /><Link href="/dashboard/whatsapp" className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Back to WhatsApp</Link></header>
        <div className="mt-10">
          {addon?.status === "ACTIVE" ? (
            <section className="rounded-[2rem] border border-emerald-200 bg-white p-8 shadow-xl">
              <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Active add-on</p>
              <h1 className="mt-3 text-3xl font-black">WhatsApp Communication is active</h1>
              <p className="mt-3 text-slate-600">Your existing paid price and coverage remain unchanged until {new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "UTC" }).format(new Date(addon.expiryDate))}.</p>
            </section>
          ) : (
            <WhatsAppAddonCheckout
              schoolName={institution.name}
              initialStudentCount={initial}
              minimumStudentCount={minimum}
              urlRequestedStudentCount={urlRequestedStudentCount}
            />
          )}
        </div>
      </div>
    </main>
  );
}
