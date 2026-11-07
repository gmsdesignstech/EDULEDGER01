import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { applyWeeklyTimetable, createTimetableEntry, deleteTimetableEntry, ensureTimetableSchema, getInstitution, listTimetableEntries, listTeachers, previewWeeklyTimetable, publishTimetable, saveClassTimetable, saveTimetableSettings, updateTimetableEntry } from "@/lib/db";
import { timetableSlots } from "@/lib/timetable";
import { logServerError } from "@/lib/server-errors";
import { cachedCompleteSettings, cachedTimetableSettings, invalidateSchoolCache } from "@/lib/cached-school";

export const runtime = "nodejs";
const admins = ["SCHOOL_ADMIN","SUPER_ADMIN"];
const settingsSchema=z.object({startTime:z.string(),endTime:z.string(),periodMinutes:z.number().int(),shortBreakMinutes:z.number().int(),lunchMinutes:z.number().int(),periodsPerDay:z.number().int(),workingDays:z.array(z.number().int()),timezone:z.string().min(1).max(100)});
const targetSchema=z.object({className:z.string().trim().min(1),section:z.string().trim().min(1),academicYear:z.string().trim().min(4)});
const entrySchema=targetSchema.extend({id:z.string().uuid(),weekday:z.number().int().min(1).max(6),startTime:z.string(),endTime:z.string(),subject:z.string().trim().min(1).max(100),teacherId:z.string().uuid().nullable().optional()});
export async function GET(request:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
  if(!admins.includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  await ensureTimetableSchema().catch(() => {});
  try{
    const q=new URL(request.url).searchParams,school=await getInstitution(user.institutionId),academicYear=q.get("academicYear")||school.academicYear,settings=await cachedTimetableSettings(user.institutionId),configured=await cachedCompleteSettings(user.institutionId),classes=configured.classes.filter(item=>item.active).flatMap(item=>item.sections.map(section=>({name:item.name,section,academicYear,status:"Active"}))),slots=timetableSlots(settings);
    const target=q.get("className")&&q.get("section")?targetSchema.parse({className:q.get("className"),section:q.get("section"),academicYear}):null;
    let preview=null,previewError="";
    if(target)try{preview=await previewWeeklyTimetable(user.institutionId,target.className,target.section,target.academicYear)}
    catch(error){if(error instanceof Error&&/^(Choose|Assign|School|Period|Number|Short|Lunch|Enter)/.test(error.message))previewError=error.message;else{logServerError("timetable.preview",error);previewError="Could not preview timetable."}}
    const entries=target?await listTimetableEntries(user.institutionId,target.className,target.section,target.academicYear):[],teachers=(await listTeachers(user.institutionId)).filter(item=>item.status==="Active");
    return NextResponse.json({academicYear,settings,classes,slots,preview,previewError,entries,teachers:teachers.map(item=>({id:item.id,name:item.name,subject:item.subject})),canEdit:admins.includes(user.role)});
  }catch(error){
    if(error instanceof Error&&/^(Choose|Assign|School|Period|Number|Short|Lunch|Enter|There)/.test(error.message))return NextResponse.json({error:error.message},{status:400});
    logServerError("timetable.get",error);
    return NextResponse.json({error:"Could not load timetable."},{status:500});
  }
}
export async function PATCH(request:Request){const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});if(!admins.includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});await ensureTimetableSchema().catch(()=>{});const parsed=entrySchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid timetable entry."},{status:400});try{const entries=await updateTimetableEntry(user.institutionId,user.id,parsed.data.id,parsed.data);invalidateSchoolCache(user.institutionId,"timetable");return NextResponse.json({entries});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not update timetable entry."},{status:409})}}
export async function POST(request:Request){const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});if(!admins.includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});await ensureTimetableSchema().catch(()=>{});const payload=await request.json().catch(()=>null);
if(payload?.action==="save-edited"){
  const parsed=targetSchema.extend({status:z.enum(["Draft","Published"]).optional(),entries:z.array(z.object({id:z.string().optional(),weekday:z.number().int().min(1).max(6),startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),subject:z.string().trim().min(1).max(100),teacherId:z.string().nullable().optional()}))}).safeParse(payload);
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid timetable data."},{status:400});
  try{const entries=await saveClassTimetable(user.institutionId,user.id,parsed.data);invalidateSchoolCache(user.institutionId,"timetable");return NextResponse.json({ok:true,entries})}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not save timetable."},{status:409})}
}
if(payload?.action==="add"){const parsed=targetSchema.extend({weekday:z.number().int().min(1).max(6),startTime:z.string().regex(/^\d{2}:\d{2}$/),endTime:z.string().regex(/^\d{2}:\d{2}$/),subject:z.string().trim().min(1).max(100),teacherId:z.string().uuid().nullable().optional()}).safeParse(payload);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid timetable entry."},{status:400});try{const entries=await createTimetableEntry(user.institutionId,user.id,parsed.data);invalidateSchoolCache(user.institutionId,"timetable");return NextResponse.json({entries})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not add timetable entry."},{status:409})}}const parsed=targetSchema.safeParse(payload);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Choose a class and section."},{status:400});try{if(payload?.action==="publish"){const entries=await publishTimetable(user.institutionId,user.id,parsed.data.className,parsed.data.section,parsed.data.academicYear);invalidateSchoolCache(user.institutionId,"timetable");return NextResponse.json({entries})}const result=await applyWeeklyTimetable(user.institutionId,user.id,parsed.data.className,parsed.data.section,parsed.data.academicYear);invalidateSchoolCache(user.institutionId,"timetable");return NextResponse.json({result});}catch(error){if(error instanceof Error&&/^(Choose|Assign|School|Period|Number|Short|Lunch|Enter|This timetable|A teacher|Add at least)/.test(error.message))return NextResponse.json({error:error.message},{status:409});logServerError("timetable.write",error);return NextResponse.json({error:"Could not save the timetable."},{status:500});}}
export async function DELETE(request:Request){const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});if(!admins.includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});await ensureTimetableSchema().catch(()=>{});const id=new URL(request.url).searchParams.get("id");if(!id)return NextResponse.json({error:"Timetable entry is required."},{status:400});try{await deleteTimetableEntry(user.institutionId,user.id,id);invalidateSchoolCache(user.institutionId,"timetable");return new Response(null,{status:204})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Could not delete timetable entry."},{status:404})}}
export async function PUT(request:Request){
  const user=await currentUser();
  if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
  if(!admins.includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
  await ensureTimetableSchema().catch(() => {});
  const parsed=settingsSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid timetable settings."},{status:400});
  try{const settings=await saveTimetableSettings(user.institutionId,user.id,parsed.data);invalidateSchoolCache(user.institutionId,"settings","timetable");return NextResponse.json({settings});}
  catch(error){if(error instanceof Error&&/^(School|Period|Number|Short|Lunch|Choose|Enter)/.test(error.message))return NextResponse.json({error:error.message},{status:400});logServerError("timetable.settings",error);return NextResponse.json({error:"Could not save timetable settings."},{status:500});}
}
