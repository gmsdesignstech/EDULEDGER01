import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getAccountTransactionsForVoucher,getInstitution,getSchoolAsset,type AccountTransaction } from "@/lib/db";
import { amountInWords,receiptDate } from "@/lib/receipt-format";
import { requireUser } from "@/lib/session";

export const runtime="nodejs";
const roles=["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"];
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const money=(paise:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}).format(paise/100);

export default async function VoucherPreview({searchParams}:{searchParams:Promise<{ids?:string}>}){
 const user=await requireUser();
 if(!roles.includes(user.role))notFound();
 const raw=(await searchParams).ids||"",ids=raw.split(",").map(value=>value.trim()).filter(Boolean);
 if(ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>!idPattern.test(id)))notFound();
 const [transactions,school,logo]=await Promise.all([getAccountTransactionsForVoucher(user.institutionId,ids),getInstitution(user.institutionId),getSchoolAsset(user.institutionId,"logo")]);
 if(transactions.length!==ids.length)notFound();
 return <div className="voucher-preview mx-auto max-w-[900px]">
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
   <Link href="/dashboard/cash-book" className="btn-secondary">Back to Cash Book</Link>
   <div className="flex flex-wrap gap-2"><PrintButton label="Print vouchers"/><span className="self-center text-xs text-muted">Choose “Save as PDF” in the print dialog to download.</span></div>
  </div>
  <article className="voucher-sheet bg-white text-[#202c40] shadow-soft print:shadow-none">
   <Voucher transaction={transactions[0]} school={school} hasLogo={Boolean(logo)}/>
   <div className="voucher-cut" aria-hidden="true"><span>✂</span></div>
   {transactions[1]?<Voucher transaction={transactions[1]} school={school} hasLogo={Boolean(logo)}/>:<div className="voucher-slot voucher-slot-empty" aria-hidden="true"/>}
  </article>
 </div>;
}

type School=Awaited<ReturnType<typeof getInstitution>>;
function Voucher({transaction,school,hasLogo}:{transaction:AccountTransaction;school:School;hasLogo:boolean}){
 const income=transaction.transactionType==="income",amount=transaction.amountPaise/100,logo=hasLogo?"/api/settings/assets/logo":"/eduledger-logo.jpeg";
 return <section className="voucher-slot">
  <header className="voucher-header">
   <Image src={logo} alt={`${school.name} logo`} width={54} height={50} className="h-[50px] w-[54px] object-contain" unoptimized={hasLogo}/>
   <div><h1>{school.name}</h1><p>{[school.address,school.phone,school.email,school.diseCode&&`DISE Code: ${school.diseCode}`].filter(Boolean).join(" | ")||"School Administration"}</p></div>
  </header>
  <h2>{income?"RECEIPT VOUCHER":"PAYMENT VOUCHER"}</h2>
  <div className="voucher-meta">
   <p><b>Transaction ID:</b> {transaction.id}</p><p><b>Date:</b> {receiptDate(transaction.transactionDate)}</p>
   {transaction.referenceNumber&&<p><b>Reference:</b> {transaction.referenceNumber}</p>}<p><b>Status:</b> {transaction.status}</p>
   <p><b>Category:</b> {transaction.category}</p><p><b>Payment Method:</b> {transaction.paymentMethod}</p>
  </div>
  <div className="voucher-narration"><b>Description / Narration</b><p>{transaction.description}</p>{transaction.notes&&<small>Notes: {transaction.notes}</small>}</div>
  <div className="voucher-amount"><span>Total Amount</span><strong>{money(transaction.amountPaise)}</strong></div>
  <p className="voucher-words"><b>Amount in words:</b> {amountInWords(amount)}</p>
  <div className="voucher-signatures"><span>Payment Approved By</span><span>{income?"Received By":"Payment Received By"}</span></div>
 </section>;
}
