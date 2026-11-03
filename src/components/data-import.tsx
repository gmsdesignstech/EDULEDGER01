"use client";

import * as XLSX from "xlsx";
import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { parseImportMatrix, type ImportRow } from "@/lib/import-schema";
import { parseApiResponse } from "@/lib/api-response";
import { useEduCache } from "./edu-cache-provider";

type ImportError = { row:number; message:string };
type Result = { success:boolean; message:string; total:number; valid:number; invalid:number; imported:number; skipped:number; failed:number; duplicates:number; errors:ImportError[] };
type Detection = { headerRow:number; detectedColumns:string[]; mappedColumns:{source:string;target:string}[]; unmappedColumns:string[] };
const labels = { students:"Students", teachers:"Teachers", classes:"Classes", attendance:"Attendance", fees:"Fees", payments:"Fee Payments", reports:"Reports / Fees", assignments:"Assignments", messages:"Messages" };
// Each student also creates enrollment, roll-number and optional fee records.
// Small transactions stay within serverless execution limits while the UI
// presents all chunks as one resumable import operation.
const IMPORT_BATCH_SIZE=5;

export function DataImport() {
  const {invalidate}=useEduCache();
  const [type,setType]=useState<keyof typeof labels>("students"),[rows,setRows]=useState<ImportRow[]>([]),[fileName,setFileName]=useState(""),[fileSize,setFileSize]=useState(""),[loading,setLoading]=useState(false),[processed,setProcessed]=useState(0),[resumeFrom,setResumeFrom]=useState(0),[attempted,setAttempted]=useState(false),[error,setError]=useState(""),[result,setResult]=useState<Result|null>(null),[detection,setDetection]=useState<Detection|null>(null),[dragging,setDragging]=useState(false);
  useEffect(()=>{const requested=new URLSearchParams(location.search).get("type");if(requested&&requested in labels)setType(requested as keyof typeof labels)},[]);

  async function choose(file?:File){
    if(!file)return;
    setError("");setResult(null);setDetection(null);setProcessed(0);setResumeFrom(0);setAttempted(false);
    if(!/\.(xlsx|xls|csv)$/i.test(file.name)){setError("Choose an Excel .xlsx/.xls file or a UTF-8 CSV file.");return}
    try{
      const bytes=await file.arrayBuffer(),book=XLSX.read(bytes,{type:"array",cellDates:false,raw:false});
      const usable=book.SheetNames.map(name=>({name,sheet:book.Sheets[name]})).find(item=>XLSX.utils.sheet_to_json<unknown[]>(item.sheet,{header:1,defval:"",raw:false}).some(row=>Array.isArray(row)&&row.some(value=>String(value).trim())));
      if(!usable)throw new Error("The workbook contains no populated worksheet.");
      const matrix=XLSX.utils.sheet_to_json<unknown[]>(usable.sheet,{header:1,defval:"",raw:false,blankrows:false}),parsed=parseImportMatrix(type,matrix);
      if(!parsed.rows.length)throw new Error("The selected worksheet has headers but no populated data rows.");
      if(parsed.rows.length>5000)throw new Error("Import files are limited to 5,000 populated rows per batch.");
      setRows(parsed.rows);setDetection(parsed);setFileName(file.name);setFileSize(`${(file.size/1024).toFixed(file.size>1024*1024?0:1)} KB · sheet ${usable.name}`);
    }catch(e){setRows([]);setError(e instanceof Error?e.message:"The Excel/CSV file is corrupted or unsupported.")}
  }
  async function run(){
    if(loading)return;
    setLoading(true);setAttempted(true);setProcessed(resumeFrom);setError("");
    const aggregate:Result=resumeFrom&&result?{...result,message:"",errors:[...result.errors]}:{success:false,message:"",total:rows.length,valid:0,invalid:0,imported:0,skipped:0,failed:0,duplicates:0,errors:[]};let completed=resumeFrom;
    try{
      for(let offset=resumeFrom;offset<rows.length;offset+=IMPORT_BATCH_SIZE){
        const batch=rows.slice(offset,offset+IMPORT_BATCH_SIZE),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),180_000);
        try{
          const response=await fetch("/api/import",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({type,rows:batch,rowOffset:offset,headerRow:detection?.headerRow||1}),signal:controller.signal});
          const body=await parseApiResponse<Result>(response,`Import stopped while processing rows ${offset+2}-${offset+batch.length+1}. You can retry safely.`);
          const duplicates=body.duplicates||0;aggregate.valid+=body.valid||0;aggregate.invalid+=Math.max(0,(body.invalid||0)-duplicates);aggregate.imported+=body.imported||0;aggregate.failed+=Math.max(0,(body.failed||0)-duplicates);aggregate.duplicates+=duplicates;aggregate.errors.push(...(body.errors||[]));
          completed=offset+batch.length;setProcessed(completed);
        }finally{clearTimeout(timeout)}
      }
      aggregate.skipped=aggregate.duplicates;aggregate.success=aggregate.imported>0;aggregate.message=`Import completed: ${aggregate.imported} imported, ${aggregate.skipped} skipped, ${aggregate.failed} failed.`;setResumeFrom(0);setResult({...aggregate});
      if(aggregate.imported)await invalidate("/api/students","/api/classes","/api/dashboard","/api/attendance","/api/finance/options");
    }catch(cause){
      const message=cause instanceof DOMException&&cause.name==="AbortError"?`The import timed out after ${completed} of ${rows.length} records. Retry is safe; existing admission numbers will be skipped.`:cause instanceof Error?cause.message:"The import was interrupted. Retry is safe.";
      setError(message);setResumeFrom(completed);aggregate.skipped=aggregate.duplicates;aggregate.message=message;setResult({...aggregate});
    }finally{setLoading(false)}
  }
  const columns=rows.length?Object.keys(rows[0]):[],attention=result?.errors||[];
  return <div className="mx-auto max-w-7xl">
    <div><p className="label">Data tools</p><h1 className="mt-2 text-3xl font-black">Excel / CSV Import</h1><p className="mt-1 text-muted">Detect headers, preview mappings, validate records, and import only valid data.</p></div>
    <div className="mt-7 grid gap-5 lg:grid-cols-[320px_1fr]">
      <aside className="card h-fit p-5">
        <label className="text-sm font-bold">Import type<select className="mt-2 w-full rounded-xl border bg-canvas px-4 py-3" value={type} disabled={loading} onChange={event=>{setType(event.target.value as keyof typeof labels);setRows([]);setResult(null);setDetection(null);setProcessed(0);setResumeFrom(0);setAttempted(false)}}>{Object.entries(labels).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select></label>
        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted">Blank templates</p><div className="mt-2 grid grid-cols-2 gap-2"><a className="btn-secondary w-full" href={`/api/export?type=${type}&format=xlsx&template=1`}><Download className="size-4"/>Excel</a><a className="btn-secondary w-full" href={`/api/export?type=${type}&format=csv&template=1`}><Download className="size-4"/>CSV</a></div>
        <label onDragEnter={()=>setDragging(true)} onDragLeave={()=>setDragging(false)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();setDragging(false);void choose(event.dataTransfer.files[0])}} className={`mt-4 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition ${dragging?"border-brand bg-brand/5":"hover:border-brand"}`}><FileSpreadsheet className="mb-3 text-brand"/><b>Drag & drop or choose a file</b><span className="mt-1 text-xs text-muted">.xlsx, .xls or .csv · up to 5,000 rows</span><input className="sr-only" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event=>void choose(event.target.files?.[0])}/></label>
        {fileName&&<div className="mt-3 rounded-xl bg-canvas p-3 text-xs"><b className="block break-all">{fileName}</b><span className="text-muted">{fileSize}</span></div>}
        <button className="btn-primary mt-4 w-full" disabled={!rows.length||loading} onClick={()=>void run()}>{loading?<Loader2 className="size-4 animate-spin"/>:<Upload className="size-4"/>}{loading?`Importing… ${processed} / ${rows.length}`:error&&attempted?"Retry import":result?"Import completed":"Import valid records"}</button>
        {loading&&<div className="mt-3" aria-live="polite"><div className="h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full bg-brand transition-all" style={{width:`${rows.length?Math.round(processed/rows.length*100):0}%`}}/></div><p className="mt-1 text-center text-xs text-muted">Importing students… {processed} / {rows.length}</p></div>}
      </aside>
      <main>
        {error&&<p className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {detection&&<section className="card mb-5 p-5"><b>Column detection</b><p className="mt-1 text-sm text-muted">Header row {detection.headerRow} · {detection.detectedColumns.length} columns detected</p><div className="mt-3 flex flex-wrap gap-2">{detection.mappedColumns.map(item=><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800" key={`${item.source}-${item.target}`}>{item.source} → {item.target}</span>)}{detection.unmappedColumns.map(item=><span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800" key={item}>{item} · unmapped</span>)}</div></section>}
        {result&&<>
          <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-6">
            {[["Total",result.total],["Valid",result.valid],["Invalid",result.invalid],["Imported",result.imported],["Duplicates",result.duplicates||0],["Skipped",result.skipped]].map(([key,value])=><div className="card p-4" key={key}><p className="text-xs text-muted">{key}</p><b className="text-2xl">{value}</b></div>)}
          </section>
          {attention.length>0&&<div className="mb-5 overflow-hidden rounded-2xl border border-amber-200">
            <div className="bg-amber-50 p-4"><b className="text-amber-800">Rows requiring attention</b><p className="mt-1 text-xs text-amber-700">Skipped duplicates are safe. Correct failed rows in the source file before retrying them.</p></div>
            <div className="max-h-72 overflow-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="sticky top-0 bg-panel"><tr>{["Row","Student","Admission Number","Status","Reason"].map(label=><th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{attention.map(item=>{
              const sourceIndex=item.row-(detection?.headerRow||1)-1,source=rows[sourceIndex]||{},duplicate=/duplicate|already exists/i.test(item.message);
              return <tr key={`${item.row}-${item.message}`}><td className="px-4 py-3">{item.row}</td><td className="px-4 py-3">{String(source["Student Name"]||"—")}</td><td className="px-4 py-3">{String(source["Admission Number"]||"—")}</td><td className={`px-4 py-3 font-bold ${duplicate?"text-amber-700":"text-red-700"}`}>{duplicate?"Skipped":"Failed"}</td><td className={`px-4 py-3 ${duplicate?"text-amber-700":"text-red-700"}`}>{item.message}</td></tr>
            })}</tbody></table></div>
          </div>}
        </>}
        <div className="card overflow-hidden"><div className="border-b p-4"><b>Data preview</b><p className="text-sm text-muted">{rows.length?`${rows.length} populated rows loaded. Showing the first 25.`:"Upload a file to preview its normalized records."}</p></div><div className="overflow-x-auto">{rows.length?<table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-canvas text-xs uppercase text-muted"><tr>{columns.map(column=><th className="px-4 py-3" key={column}>{column}</th>)}</tr></thead><tbody className="divide-y">{rows.slice(0,25).map((row,index)=><tr key={index}>{columns.map(column=><td className="px-4 py-3" key={column}>{String(row[column]??"")}</td>)}</tr>)}</tbody></table>:<div className="p-16 text-center text-muted">No file selected.</div>}</div></div>
      </main>
    </div>
  </div>
}
