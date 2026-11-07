"use client";

import { readApiJson } from "@/lib/api-response";
import Image from "next/image";
import Link from "next/link";
import { Download,IdCard,Loader2,Printer,Search } from "lucide-react";
import { useEffect,useMemo,useState } from "react";
import { StudentPhotoImage } from "./student-photo-image";
import { formatParentPhone } from "@/lib/student-id-card";

type Student={id:string;name:string;admission:string;rollNumber:string;className:string;section:string;academicYear:string;dateOfBirth:string;bloodGroup:string;parent:string;parentPhone:string;status:string;photoPath?:string};
type Payload={students:Student[];configuredClasses:{name:string;sections:string[]}[];academicYears:string[];academicYear:string};
type School={name:string;address:string;phone:string;email:string;logoUrl?:string};

export function StudentIdCards(){
 const[data,setData]=useState<Payload|null>(null),[school,setSchool]=useState<School|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[query,setQuery]=useState(""),[className,setClassName]=useState(""),[section,setSection]=useState(""),[selected,setSelected]=useState<string[]>([]);
 useEffect(()=>{Promise.all([fetch("/api/students",{cache:"no-store"}),fetch("/api/settings",{cache:"no-store"})]).then(async([studentsResponse,settingsResponse])=>{const students=await readApiJson(studentsResponse),settings=await readApiJson(settingsResponse);if(!studentsResponse.ok||!settingsResponse.ok)throw new Error(students.error||settings.error||"Could not load ID cards.");setData(students);setSchool(settings.settings)}).catch(cause=>setError(cause instanceof Error?cause.message:"Could not load ID cards.")).finally(()=>setLoading(false))},[]);
 const sections=useMemo(()=>className?data?.configuredClasses.find(item=>item.name===className)?.sections||[]:[...new Set(data?.configuredClasses.flatMap(item=>item.sections)||[])],[data,className]);
 const visible=useMemo(()=>(data?.students||[]).filter(student=>student.status==="Active"&&(!className||student.className===className)&&(!section||student.section===section)&&(student.name+student.admission+student.rollNumber).toLowerCase().includes(query.toLowerCase())),[data,query,className,section]);
 const cards=visible.filter(student=>selected.includes(student.id)),allSelected=visible.length>0&&visible.every(student=>selected.includes(student.id));
 function toggleAll(){setSelected(current=>allSelected?current.filter(id=>!visible.some(student=>student.id===id)):[...new Set([...current,...visible.map(student=>student.id)])])}
 async function printCards(){await document.fonts?.ready;await Promise.all(Array.from(document.images).map(image=>image.decode().catch(()=>undefined)));await new Promise(resolve=>window.setTimeout(resolve,50));window.print()}
 if(loading)return <div className="grid min-h-96 place-items-center"><Loader2 className="animate-spin text-brand"/></div>;
 return <div className="mx-auto max-w-7xl"><header className="flex flex-wrap items-end justify-between gap-4 print:hidden"><div><p className="label">Students</p><h1 className="mt-2 text-3xl font-black">ID Cards</h1><p className="mt-1 text-muted">Select students, review their school-branded cards, then print or save the batch as PDF.</p></div><div className="flex flex-wrap gap-2"><Link href="/dashboard/students" className="btn-secondary">Students</Link><button className="btn-secondary" disabled={!cards.length} onClick={()=>void printCards()}><Download className="size-4"/>Save as PDF</button><button className="btn-primary" disabled={!cards.length} onClick={()=>void printCards()}><Printer className="size-4"/>Print selected</button></div></header>
 {error&&<p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
 <section className="card mt-6 overflow-hidden print:hidden"><div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="flex items-center gap-2 rounded-xl border px-3"><Search className="size-4 text-muted"/><input aria-label="Search students" className="w-full bg-transparent py-2.5 outline-none" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, admission or roll number"/></label><select className="rounded-xl border bg-panel px-3" aria-label="Class" value={className} onChange={event=>{setClassName(event.target.value);setSection("")}}><option value="">All classes</option>{data?.configuredClasses.map(item=><option key={item.name}>{item.name}</option>)}</select><select className="rounded-xl border bg-panel px-3" aria-label="Section" value={section} onChange={event=>setSection(event.target.value)}><option value="">All sections</option>{sections.map(item=><option key={item}>{item}</option>)}</select><button className="btn-secondary" onClick={()=>{setQuery("");setClassName("");setSection("")}}>Clear filters</button></div><div className="flex flex-wrap items-center gap-3 border-b p-4"><button className="btn-secondary" onClick={toggleAll}>{allSelected?"Deselect visible":"Select all visible"}</button><button className="btn-secondary" disabled={!selected.length} onClick={()=>setSelected([])}>Clear selection</button><span className="text-sm text-muted">{selected.length} selected</span></div><div className="max-h-80 overflow-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-canvas text-xs uppercase text-muted"><tr><th className="px-4 py-3">Select</th><th className="px-4">Student</th><th className="px-4">Admission</th><th className="px-4">Roll number</th><th className="px-4">Class</th><th className="px-4">Card</th></tr></thead><tbody className="divide-y">{visible.map(student=><tr key={student.id}><td className="px-4 py-3"><input aria-label={`Select ${student.name}`} type="checkbox" checked={selected.includes(student.id)} onChange={()=>setSelected(current=>current.includes(student.id)?current.filter(id=>id!==student.id):[...current,student.id])}/></td><td className="px-4 font-bold">{student.name}</td><td className="px-4">{student.admission}</td><td className="px-4">{student.rollNumber||"—"}</td><td className="px-4">{student.className}-{student.section}</td><td className="px-4"><Link className="font-bold text-brand" href={`/dashboard/students/${student.id}/id-card`}>View</Link></td></tr>)}</tbody></table>{!visible.length&&<p className="p-10 text-center text-muted">No active students match these filters.</p>}</div></section>
 <section className="student-id-sheet mt-6 grid gap-5 md:grid-cols-2 print:grid-cols-2 print:gap-3">{cards.map(student=><IdentityCard key={student.id} student={student} school={school}/>)}</section>{!cards.length&&<div className="card mt-6 p-12 text-center print:hidden"><IdCard className="mx-auto mb-3 size-10 text-muted"/><b>Select students to preview ID cards</b><p className="mt-1 text-sm text-muted">The cards use existing student records and saved school branding.</p></div>}</div>
}

function IdentityCard({student,school}:{student:Student;school:School|null}){
 return (
  <article className="student-id-card break-inside-avoid overflow-hidden rounded-[1.5rem] border border-violet-200 bg-white text-slate-900 shadow-lg print:rounded-xl print:shadow-none">
   <header className="flex items-center gap-3 bg-gradient-to-r from-violet-700 to-indigo-700 px-5 py-4 text-white">
    <Image src={school?.logoUrl?"/api/settings/assets/logo":"/eduledger-logo.jpeg"} unoptimized={Boolean(school?.logoUrl)} width={56} height={56} alt="School logo" className="size-14 rounded-xl bg-white object-contain p-1"/>
    <div className="min-w-0">
     <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-200">Student Identity Card</p>
     <h2 className="truncate text-lg font-black">{school?.name||"School"}</h2>
     <p className="text-[11px] text-violet-100">Academic year {student.academicYear}</p>
    </div>
   </header>
   <div className="p-5">
    <div className="flex items-start justify-between gap-4">
     <div>
      <h3 className="text-xl font-black">{student.name}</h3>
      <p className="font-semibold text-slate-500">{student.className}{student.section?` · Section ${student.section}`:""}</p>
     </div>
     {student.photoPath ? (
      <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border-2 border-violet-200 bg-slate-50 shadow-sm">
       <StudentPhotoImage studentId={student.id} name={student.name} size={80} className="size-full object-cover object-center"/>
      </div>
     ) : (
      <div aria-label="Student photo not uploaded" className="grid size-20 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-100 text-center text-xs font-black uppercase text-violet-700">
       {student.name.split(/\s+/).filter(Boolean).map(word=>word[0]).slice(0,2).join("") || "ST"}
      </div>
     )}
    </div>
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t pt-4 text-xs">
     {[
      ["Student ID", student.rollNumber||"—"],
      ["Admission", student.admission],
      ["Date of birth", student.dateOfBirth||"—"],
      ["Blood group", student.bloodGroup||"—"],
      ["Parent / Guardian", student.parent||"—"],
      ["Parent Mobile", formatParentPhone(student.parentPhone)],
     ].map(([label,value])=>(
      <div key={label}>
       <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
       <dd className="break-words font-bold text-slate-900">{value}</dd>
      </div>
     ))}
    </dl>
   </div>
   <footer className="flex items-end justify-between border-t bg-slate-50 px-5 py-3 text-[10px] text-slate-500">
    <div className="max-w-[65%] truncate">
     <p className="truncate">{[school?.address,school?.phone].filter(Boolean).join(" · ")}</p>
    </div>
    <div className="text-right">
     <span className="block w-24 border-t border-slate-400 pt-0.5 font-bold text-slate-700">Signatory</span>
    </div>
   </footer>
  </article>
 );
}
