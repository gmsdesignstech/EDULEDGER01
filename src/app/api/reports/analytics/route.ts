import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { dashboardYears, schoolReportAnalytics } from "@/lib/db";

export const runtime="nodejs";

function validIsoDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export async function GET(request:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
  if(!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  try{
    const params=new URL(request.url).searchParams,years=await dashboardYears(user.institutionId),selected=params.get("year")||years.find(item=>item.isActive)?.name||years[0]?.name;
    if(!selected)return NextResponse.json({error:"No academic year is available."},{status:404});
    const year=years.find(item=>item.name===selected);
    if(!year)return NextResponse.json({error:"Academic year unavailable."},{status:404});
    const startYear=Number(selected.slice(0,4));
    if(!Number.isInteger(startYear)||startYear<1900||startYear>2200)return NextResponse.json({error:"Invalid academic year."},{status:400});
    const endYear=year.endMonth<year.startMonth?startYear+1:startYear;
    const yearStart=`${startYear}-${String(year.startMonth).padStart(2,"0")}-01`;
    const yearEnd=new Date(Date.UTC(endYear,year.endMonth,0)).toISOString().slice(0,10);
    const from=params.get("from")||yearStart,to=params.get("to")||yearEnd;
    if(!validIsoDate(from)||!validIsoDate(to)||from>to)return NextResponse.json({error:"Choose a valid report date range."},{status:400});
    const data=await schoolReportAnalytics(user.institutionId,selected,from,to);
    return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    const message=error instanceof Error?error.message:"Could not load report analytics.";
    if(/date range|Academic year unavailable/.test(message))return NextResponse.json({error:message},{status:400});
    return NextResponse.json({error:"Could not load report analytics."},{status:500});
  }
}
