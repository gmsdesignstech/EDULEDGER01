import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { getInstitution, getReceipt, getSchoolAsset } from "@/lib/db";
import { amountInWords, receiptDate } from "@/lib/receipt-format";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
const money = (value: number) =>
  `₹ ${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default async function Receipt({ params }: { params: Promise<{ receipt: string }> }) {
  const user = await requireUser();
  if(!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))notFound();
  const number = decodeURIComponent((await params).receipt);
  const payment = await getReceipt(user.institutionId, number);
  if (!payment) notFound();
  const school = await getInstitution(user.institutionId),[logo,signature]=await Promise.all([getSchoolAsset(user.institutionId,"logo"),getSchoolAsset(user.institutionId,"signature")]);
  return <div className="mx-auto max-w-[900px]">
    <div className="mb-5 flex flex-wrap justify-between gap-3 print:hidden">
      <Link href="/dashboard/payment-history" className="btn-secondary">Back to payment history</Link>
      <div className="flex gap-2"><a className="btn-secondary" href={`/api/receipts/${encodeURIComponent(number)}/pdf`}><Download className="size-4"/>Download PDF</a><PrintButton/></div>
    </div>
    <article className="receipt-sheet bg-white text-[#202c40] shadow-soft print:shadow-none">
      <ReceiptCopy copy="SCHOOL COPY" payment={payment} school={school} hasLogo={Boolean(logo)} hasSignature={Boolean(signature)}/>
      <div className="receipt-cut" aria-hidden="true"><span>✂</span></div>
      <ReceiptCopy copy="CANDIDATE COPY" payment={payment} school={school} hasLogo={Boolean(logo)} hasSignature={Boolean(signature)}/>
    </article>
  </div>;
}

type ReceiptData = NonNullable<Awaited<ReturnType<typeof getReceipt>>>;
type SchoolData = Awaited<ReturnType<typeof getInstitution>>;

function ReceiptCopy({copy,payment,school,hasLogo,hasSignature}:{copy:"SCHOOL COPY"|"CANDIDATE COPY";payment:ReceiptData;school:SchoolData;hasLogo:boolean;hasSignature:boolean}) {
  const words=amountInWords(payment.amount),logo=hasLogo?"/api/settings/assets/logo":"/eduledger-logo.jpeg";
  return <section className="receipt-copy">
    <header className="text-center">
      <Image src={logo} alt={`${school.name} logo`} width={54} height={50} className="mx-auto h-[50px] w-[54px] object-contain" unoptimized={hasLogo}/>
      <h1>{school.name}</h1>
      <p>{[school.address,school.phone,school.email,school.diseCode&&`DISE Code: ${school.diseCode}`].filter(Boolean).join(" | ")||"School Administration"}</p>
    </header>
    <h2>{school.feeReceiptTitle||"RECEIPT"}</h2>
    <div className="receipt-meta">
      <div><p><b>Receipt No:</b> {payment.receiptNumber}</p><p><b>Fee type:</b> {payment.feeType}</p><p><b>Student Name:</b> {payment.studentName}</p><p><b>Admission / Roll:</b> {payment.admission} / {payment.rollNumber||"-"}</p><small>[ {copy} ]</small></div>
      <div className="text-right"><p><b>Date:</b> {receiptDate(payment.paymentDate)}</p><p><b>Class &amp; Section:</b> {payment.className}{payment.section?`-${payment.section}`:""}</p><p><b>Academic Year:</b> {payment.academicYear}</p><p><b>Frequency:</b> {payment.paymentFrequency}</p><p><b>Status:</b> {payment.status}</p></div>
    </div>
    <p className="receipt-sentence">Received with thanks from Mr/Ms. <b>{payment.studentName}</b>, the sum of <b>{words}</b> by <b>{payment.method}</b> towards the following fees:</p>
    <table><thead><tr><th>Fee details</th><th>Amount</th></tr></thead><tbody><tr><td>Total fee</td><td>{money(payment.originalAmount)}</td></tr><tr><td>Discount{payment.discountReason?` (${payment.discountReason})`:""}</td><td>− {money(payment.discountAmount)}</td></tr><tr><td>Late fee</td><td>+ {money(payment.lateFee)}</td></tr><tr><td>Net payable</td><td>{money(payment.netPayable)}</td></tr><tr><td>Amount paid</td><td>{money(payment.amount)}</td></tr><tr className="receipt-total"><td>Balance due</td><td>{money(payment.remainingBalance)}</td></tr></tbody></table>
    <p className="receipt-words"><b>Amount Paid:</b> {words}</p>
    <p className="text-xs"><b>Reference:</b> {payment.transactionId||"-"} · <b>Previous balance:</b> {money(Number(payment.finalAmount)-Number(payment.previouslyPaid))} · <b>Remaining:</b> {money(payment.remainingBalance)}</p>
    <div className="receipt-signatures">
      <div><span/><b>Cashier Signature</b></div>
      <div>{hasSignature?<Image unoptimized src="/api/settings/assets/signature" alt="Authorized signature" width={94} height={40} className="mx-auto h-10 w-24 object-contain"/>:<small className="block h-10 text-muted">Signature not configured</small>}<span/><b>{school.signatureLabel||"Authorized Signatory"}</b></div>
    </div>
  </section>;
}
