import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getInstitution,getSchoolAsset,getStudent } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const runtime="nodejs";

export default async function StudentIdCard({params}:{params:Promise<{id:string}>}){
 const user=await requireUser();
 if(!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT","STAFF"].includes(user.role))notFound();
 const student=await getStudent(user.institutionId,(await params).id);
 if(!student)notFound();
 const[school,logo]=await Promise.all([getInstitution(user.institutionId),getSchoolAsset(user.institutionId,"logo")]);
 return <div className="mx-auto max-w-3xl">
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href={`/dashboard/payments?search=${encodeURIComponent(student.admission)}`} className="btn-secondary">Back to fee collection</Link><PrintButton/></div>
  <article className="mx-auto w-full max-w-[560px] overflow-hidden rounded-[2rem] border border-violet-200 bg-white text-slate-900 shadow-2xl print:shadow-none">
   <header className="bg-gradient-to-r from-violet-700 to-indigo-700 px-7 py-6 text-white"><div className="flex items-center gap-4"><Image src={logo?"/api/settings/assets/logo":"/eduledger-logo.jpeg"} unoptimized={Boolean(logo)} width={64} height={64} alt={`${school.name} logo`} className="size-16 rounded-2xl bg-white object-contain p-1"/><div><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-200">Student Identity Card</p><h1 className="mt-1 text-2xl font-black">{school.name}</h1><p className="mt-1 text-xs text-violet-100">Academic year {student.academicYear}</p></div></div></header>
   <div className="p-7"><div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-600">Student</p><h2 className="mt-1 text-2xl font-black">{student.name}</h2><p className="mt-1 font-semibold text-slate-500">{student.className}{student.section?` · Section ${student.section}`:""}</p></div><div className="grid size-24 shrink-0 place-items-center rounded-3xl bg-violet-100 text-3xl font-black text-violet-700">{student.name.split(" ").map(part=>part[0]).slice(0,2).join("").toUpperCase()}</div></div>
    <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-200 pt-6 text-sm">{[["Student Number / USN",student.rollNumber||"—"],["Admission Number",student.admission],["Class",student.className],["Section",student.section||"—"],["Date of Birth",student.dateOfBirth||"—"],["Blood Group",student.bloodGroup||"—"],["Parent / Guardian",student.parent||"—"],["Status",student.status]].map(([label,value])=><div key={label}><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl>
   </div>
   <footer className="flex items-end justify-between border-t border-slate-200 bg-slate-50 px-7 py-5 text-xs text-slate-500"><div>{school.address&&<p>{school.address}</p>}{school.phone&&<p>{school.phone}</p>}</div><div className="text-right"><span className="block w-28 border-t border-slate-500 pt-1 font-bold text-slate-700">Authorized Signatory</span></div></footer>
  </article>
 </div>;
}
