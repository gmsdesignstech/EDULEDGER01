import Link from "next/link";
import { CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/logo";
import { getVerifiedPaymentConfirmation } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { safeSchoolRedirect } from "@/lib/auth-redirect";
import { formatInr } from "@/lib/subscription-plans";
import { isVerifiedPaidSubscription } from "@/lib/subscription";

export const runtime = "nodejs";
export const metadata = { title: "Payment Status | EduLedger", robots: { index: false, follow: false, nocache: true } };

export default async function PaymentSuccessPage({searchParams}:{searchParams:Promise<{product?:string;order?:string;next?:string}>}) {
  const query=await searchParams,product=query.product==="whatsapp"?"whatsapp":query.product==="subscription"?"subscription":undefined,
    orderId=typeof query.order==="string"&&query.order.length<=100?query.order:"",
    returnPath=`/payment/success?product=${product??""}&order=${encodeURIComponent(orderId)}&next=${encodeURIComponent(safeSchoolRedirect(query.next))}`,
    user=await requireUser(returnPath),
    confirmation=product&&orderId?await getVerifiedPaymentConfirmation(user.institutionId,product,orderId):undefined,
    verified=isVerifiedPaidSubscription(confirmation?.status,confirmation?.paymentStatus,confirmation?.paymentId),
    active=confirmation?.status==="ACTIVE"||confirmation?.status==="EXPIRING_SOON",
    next=safeSchoolRedirect(query.next),
    failed=confirmation&&["FAILED","CANCELLED","REFUNDED"].includes(confirmation.status);

  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5 text-slate-950">
    <section className="w-full max-w-2xl rounded-[2rem] border bg-white p-7 shadow-xl sm:p-10">
      <Logo />
      {!confirmation?<Status icon={<ShieldAlert className="size-8"/>} tone="rose" title="Payment record not found" copy="This payment does not belong to the signed-in school, or the payment reference is invalid."/>:
      verified?<>
        <Status icon={<CheckCircle2 className="size-8"/>} tone="emerald" title="Payment Successful" copy={active?"Razorpay payment was verified on the server and the subscription is active.":"Razorpay payment was verified on the server. Your subscription will activate on its scheduled start date."}/>
        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          <Item label="School" value={confirmation.schoolName}/><Item label="Purchased" value={confirmation.productName}/>
          <Item label="Amount paid" value={formatInr(confirmation.amountPaid)}/><Item label="Payment status" value="Verified · Paid"/>
          <Item label="Billing period" value={`${date(confirmation.activationDate)} – ${date(confirmation.expiryDate)}`}/><Item label="Payment reference" value={confirmation.paymentId!}/>
          <Item label="Order ID" value={confirmation.orderId}/>
        </dl>
        <Link href={next} className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 font-extrabold text-white hover:bg-emerald-700">{next.startsWith("/whatsapp/subscribe")?"Continue to WhatsApp checkout":"Continue to Dashboard"}</Link>
      </>:<>
        <Status icon={<Clock3 className="size-8"/>} tone="amber" title="Payment processing" copy="Payment has not been confirmed as captured. No entitlement has been activated from this page."/>
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Status: {confirmation.paymentStatus} · {confirmation.status}</p>
        {failed?<Link href={product==="subscription"?"/subscription":"/whatsapp/subscribe"} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 font-bold text-white">Return to secure checkout</Link>:<Link href={returnPath} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl border font-bold">Check payment status again</Link>}
      </>}
    </section>
  </main>;
}

function Status({icon,tone,title,copy}:{icon:React.ReactNode;tone:"emerald"|"amber"|"rose";title:string;copy:string}){const colors={emerald:"bg-emerald-100 text-emerald-700",amber:"bg-amber-100 text-amber-700",rose:"bg-rose-100 text-rose-700"};return <div className="mt-10 text-center"><span className={`mx-auto grid size-16 place-items-center rounded-full ${colors[tone]}`}>{icon}</span><h1 className="mt-5 text-3xl font-black">{title}</h1><p className="mx-auto mt-2 max-w-lg text-slate-600">{copy}</p></div>}
function Item({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 break-all font-black">{value}</dd></div>}
function date(value:string){return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(value))}
