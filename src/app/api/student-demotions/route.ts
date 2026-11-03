import { z } from "zod";
import { currentUser } from "@/lib/session";
import { demoteStudent, demotionHistory, demotionOptions, undoStudentDemotion } from "@/lib/db";
import { logServerError } from "@/lib/server-errors";

export const runtime="nodejs";
const admin=(role:string)=>role==="SCHOOL_ADMIN"||role==="SUPER_ADMIN";
const demote=z.object({action:z.literal("demote"),studentId:z.string().min(1),newClassId:z.string().min(1),newSectionId:z.string().min(1),academicYearId:z.string().min(1),reason:z.string().trim().min(3).max(500),remarks:z.string().trim().max(1000).default("")});
const undo=z.object({action:z.literal("undo"),id:z.string().min(1)});
export async function GET(request:Request){const user=await currentUser();if(!user)return Response.json({error:"Unauthenticated"},{status:401});if(!admin(user.role))return Response.json({error:"Forbidden"},{status:403});const studentId=new URL(request.url).searchParams.get("studentId")||"";if(!studentId)return Response.json({error:"Select a student."},{status:400});try{return Response.json({options:await demotionOptions(user.institutionId,studentId),history:await demotionHistory(user.institutionId,studentId)});}catch(error){return Response.json({error:error instanceof Error?error.message:"Could not load demotion details."},{status:404})}}
export async function POST(request:Request){const user=await currentUser();if(!user)return Response.json({error:"Unauthenticated"},{status:401});if(!admin(user.role))return Response.json({error:"Forbidden"},{status:403});const parsed=z.union([demote,undo]).safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:parsed.error.issues[0]?.message||"Invalid demotion request."},{status:400});try{const data=parsed.data;return Response.json(data.action==="demote"?await demoteStudent(user.institutionId,user.id,data):await undoStudentDemotion(user.institutionId,user.id,data.id));}catch(error){logServerError("student-demotion",error);return Response.json({error:error instanceof Error?error.message:"Could not update student placement."},{status:409})}}
