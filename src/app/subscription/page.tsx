import Link from "next/link";
import { Logo } from "@/components/logo";
import { ActivationPanel } from "@/components/subscription-activation";
import { SubscriptionDetails } from "@/components/subscription-details";
import { getInstitution, getSubscription } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ANNUAL_SERVICE_PLAN_ID, STARTER_PLAN_ID, starterPlanForStudentCount, SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import type { Metadata } from "next";
import { safeSchoolRedirect } from "@/lib/auth-redirect";
export const runtime = "nodejs";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
function subscriptionReturnPath(query:{plan?:string;students?:string;next?:string}){
  const params=new URLSearchParams(),count=Number(query.students),next=safeSchoolRedirect(query.next);
  if(query.plan&&[STARTER_PLAN_ID,ANNUAL_SERVICE_PLAN_ID].includes(query.plan))params.set("plan",query.plan);
  if(Number.isInteger(count)&&count>=1&&count<=100000)params.set("students",String(count));
  if(next!=="/dashboard")params.set("next",next);
  return `/subscription${params.size?`?${params}`:""}`;
}
export default async function Subscription({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; students?: string; next?: string }>;
}) {
  const query = await searchParams,
    user = await requireUser(subscriptionReturnPath(query)),
    [subscription,institution] = await Promise.all([getSubscription(user.institutionId),getInstitution(user.institutionId)]),
    billingStudentCount=subscription.billingStudentCount,
    starter=starterPlanForStudentCount(billingStudentCount),
    selected=starter?STARTER_PLAN_ID:ANNUAL_SERVICE_PLAN_ID,
    requestedNext=safeSchoolRedirect(query.next),
    successHref=requestedNext==="/whatsapp/subscribe"||requestedNext.startsWith("/whatsapp/subscribe?")?requestedNext:"/dashboard";
  return (
    <main className="min-h-screen overflow-x-hidden bg-white px-4 py-5 text-[#10203b] sm:px-8 sm:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-3">
          <Logo />
          {(subscription.status==="ACTIVE"||subscription.status==="EXPIRING_SOON")&&<Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold shadow-sm transition hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Back to dashboard
          </Link>}
        </header>
        <ActivationPanel
          plans={starter?[starter]:SUBSCRIPTION_PLANS}
          initialPlanId={selected}
          subscription={{...subscription,billingStudentCount}}
          schoolName={institution.name}
          successHref={successHref}
        />
        <SubscriptionDetails subscription={subscription} />
      </div>
    </main>
  );
}
