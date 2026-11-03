import { currentUser } from "@/lib/session";
import { cachedCompleteSettings } from "@/lib/cached-school";
export const runtime="nodejs";
export async function GET(){const user=await currentUser();if(!user)return Response.json({error:"Unauthenticated"},{status:401});if(!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))return Response.json({error:"Forbidden"},{status:403});const settings=await cachedCompleteSettings(user.institutionId);return Response.json({currentYear:settings.academicYear,years:settings.years.map(item=>item.name),classes:settings.classes.filter(item=>item.active).map(item=>({name:item.name,sections:item.sections}))})}
