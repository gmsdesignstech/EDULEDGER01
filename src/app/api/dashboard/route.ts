import { NextResponse } from "next/server";
import { dashboardData, dashboardYears } from "@/lib/db";
import { currentUser } from "@/lib/session";
export const runtime = "nodejs";
export async function GET(request:Request) {
  const user = await currentUser();
  if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
  if(!["SCHOOL_ADMIN","ACCOUNTANT","LIBRARIAN","STAFF"].includes(user.role))
    return NextResponse.json({error:"Forbidden"},{status:403});
  const years=await dashboardYears(user.institutionId);
  const requested=new URL(request.url).searchParams.get("year");
  if(requested&&!years.some(y=>y.name===requested))return NextResponse.json({error:"Academic year unavailable"},{status:404});
  const selected=requested??years.find(y=>y.isActive)?.name??years[0]?.name;
  return NextResponse.json(selected?await dashboardData(user.institutionId,selected):{error:"No academic year available"},{status:selected?200:404});
}
