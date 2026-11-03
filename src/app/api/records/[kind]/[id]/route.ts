import { NextResponse } from "next/server";
import { z } from "zod";
import { actOnSingleRecord, setClassArchived, type SingleRecordKind } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { moduleConfigs } from "@/config/modules";
import { logServerError } from "@/lib/server-errors";
export const runtime="nodejs";
const kinds=["module","attendance","fee","payment","salary","account","class","section","timetable","exam","result","academic-year"] as const;
const bodySchema=z.object({reason:z.string().trim().max(500).default("")});
export async function DELETE(request:Request,{params}:{params:Promise<{kind:string;id:string}>}){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
  const {kind,id}=await params;
  if(!kinds.includes(kind as typeof kinds[number])||!z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/).safeParse(id).success)return NextResponse.json({error:"Invalid record"},{status:400});
  if(!["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  const body=bodySchema.safeParse(await request.json().catch(()=>({})));
  if(!body.success)return NextResponse.json({error:"Invalid reason"},{status:400});
  if(["payment","account"].includes(kind)&&!body.data.reason)return NextResponse.json({error:"A reason is required to void financial records."},{status:400});
  const moduleName=new URL(request.url).searchParams.get("module")||undefined;
  if(kind==="module"&&(!moduleName||!moduleConfigs[moduleName]||moduleConfigs[moduleName].comingSoon))return NextResponse.json({error:"Unknown module"},{status:404});
  try{
    const message=await actOnSingleRecord(user.institutionId,user.id,kind as SingleRecordKind,id,body.data.reason,moduleName,new URL(request.url).searchParams.get("year")||undefined);
    return NextResponse.json({ok:true,message},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    if(error instanceof Error&&/not found|already voided/i.test(error.message))return NextResponse.json({error:error.message},{status:404});
    if(error instanceof Error&&/cannot|first|history|results|active year/i.test(error.message))return NextResponse.json({error:error.message},{status:409});
    logServerError("single-record.delete",error);
    return NextResponse.json({error:"Unable to change this record. Please try again."},{status:500});
  }
}
export async function PATCH(request:Request,{params}:{params:Promise<{kind:string;id:string}>}){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
  if(!["SCHOOL_ADMIN","SUPER_ADMIN"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  const {kind,id}=await params,year=new URL(request.url).searchParams.get("year");
  if(kind!=="class"||!year||!/^\d{4}-\d{4}$/.test(year))return NextResponse.json({error:"Invalid class or year"},{status:400});
  try{return NextResponse.json({ok:true,message:await setClassArchived(user.institutionId,user.id,id,year,false)});}catch{return NextResponse.json({error:"Unable to restore class."},{status:409});}
}
