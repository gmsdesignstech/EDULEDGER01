import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getAdminSalary } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SalarySlipPrintButton } from "@/components/salary-slip-actions";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const money = (paise: unknown) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(paise || 0) / 100);
const Field = ({ label, value }: { label: string; value: unknown }) => <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{String(value || "—")}</dd></div>;

export default async function SalarySlipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(user.role)) notFound();
  const salary = await getAdminSalary((await params).id,user.institutionId);
  if (!salary || Number(salary.paid_paise || 0) <= 0) notFound();
  const period = `${months[Number(salary.salary_month) - 1]} ${salary.salary_year}`;
  const earnings = [["Basic Salary", salary.basic_paise], ["Allowances", salary.allowances_paise], ["Bonus", salary.bonus_paise], ["Overtime", salary.overtime_paise], ["Other Earnings", salary.other_earnings_paise]];
  const deductions = [["Standard Deductions", salary.deductions_paise], ["Advance Deduction", salary.advance_deduction_paise], ["Other Deductions", salary.other_deductions_paise]];
  return <div className="mx-auto max-w-4xl pb-10">
    <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden"><Link href="/dashboard/salary-management" className="btn-secondary">Back</Link><a href={`/api/salaries/${salary.id}/pdf`} className="btn-primary"><Download className="size-4"/>Download PDF</a><SalarySlipPrintButton/></div>
    <article className="overflow-hidden rounded-2xl border bg-white text-slate-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
      <header className="grid gap-5 bg-slate-900 px-6 py-7 text-white sm:grid-cols-[72px_1fr_auto] sm:items-center sm:px-10">
        <Image src="/api/settings/assets/logo" alt="School logo" width={64} height={64} unoptimized className="size-16 rounded-xl bg-white object-contain p-1"/>
        <div><h1 className="text-xl font-black sm:text-2xl">{String(salary.school || "School")}</h1><p className="mt-1 text-sm text-slate-300">{[salary.address, salary.phone].filter(Boolean).map(String).join(" · ")}</p></div>
        <div className="sm:text-right"><h2 className="text-xl font-black tracking-wider">SALARY SLIP</h2><p className="mt-1 text-sm text-slate-300">{period}</p></div>
      </header>
      <div className="space-y-7 p-6 sm:p-10">
        <dl className="grid gap-5 rounded-xl border bg-slate-50 p-5 sm:grid-cols-2"><Field label="Payment Reference" value={salary.payment_reference || salary.payslip_number}/><Field label="Payment Date" value={salary.payment_date}/><Field label="Salary Month" value={period}/><Field label="Payment Status" value={String(salary.payment_status).toUpperCase()}/></dl>
        <section><h3 className="border-b pb-2 text-sm font-black tracking-wider text-blue-800">EMPLOYEE INFORMATION</h3><dl className="mt-4 grid gap-5 sm:grid-cols-2"><Field label="Staff Name" value={salary.employee_name}/><Field label="Staff ID" value={salary.employee_number}/><Field label="Designation" value={salary.designation || salary.employee_role}/><Field label="Department" value={salary.department}/></dl></section>
        <div className="grid gap-5 md:grid-cols-2">
          <Breakdown title="EARNINGS" rows={earnings} totalLabel="Gross Salary" total={salary.gross_paise}/>
          <Breakdown title="DEDUCTIONS" rows={deductions} totalLabel="Total Deductions" total={salary.total_deductions_paise}/>
        </div>
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-black tracking-wider text-emerald-700">NET SALARY</p><p className="mt-1 text-3xl font-black text-emerald-800">{money(salary.net_paise)}</p></div><div className="text-sm sm:text-right"><b>{String(salary.payment_method || "—")}</b><p className="text-slate-600">{String(salary.payment_status).toUpperCase()}</p></div></section>
        <footer className="grid gap-12 pt-10 text-center text-sm sm:grid-cols-2"><div><div className="mx-auto h-12 max-w-40 border-b"/><b className="mt-2 block">Employee Signature</b></div><div><Image src="/api/settings/assets/signature" alt="Authorized signature" width={160} height={48} unoptimized className="mx-auto h-12 max-w-40 object-contain"/><div className="mx-auto max-w-40 border-b"/><b className="mt-2 block">{String(salary.signatureLabel || "Authorized Signatory")}</b></div></footer>
      </div>
    </article>
  </div>;
}

function Breakdown({ title, rows, totalLabel, total }: { title: string; rows: unknown[][]; totalLabel: string; total: unknown }) { return <section className="overflow-hidden rounded-xl border"><h3 className="bg-blue-900 px-4 py-3 text-sm font-black tracking-wider text-white">{title}</h3><dl className="divide-y">{rows.map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 px-4 py-3 text-sm"><dt>{String(label)}</dt><dd className="font-semibold">{money(value)}</dd></div>)}</dl><div className="flex justify-between bg-slate-50 px-4 py-3 font-black"><span>{totalLabel}</span><span>{money(total)}</span></div></section>; }
