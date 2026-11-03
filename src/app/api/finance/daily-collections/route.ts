import { NextResponse } from "next/server";
import { dailyFeeCollections,dashboardYears } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { logServerError } from "@/lib/server-errors";

export const runtime="nodejs";

export async function GET(request:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
  if(!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  const query=new URL(request.url).searchParams,year=query.get("year")||"",from=query.get("from")||"",to=query.get("to")||"";
  try{
    const years=await dashboardYears(user.institutionId);
    if(!years.some(item=>item.name===year))return NextResponse.json({error:"Academic year unavailable"},{status:404});
    return NextResponse.json(await dailyFeeCollections(user.institutionId,year,from,to),{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    logServerError("finance.daily-collections",error,{institutionId:user.institutionId});
    const invalid=error instanceof Error&&/(valid|start date|366 days)/i.test(error.message);
    return NextResponse.json({error:invalid?error.message:"Unable to load fee collection data."},{status:invalid?400:500});
  }
}
