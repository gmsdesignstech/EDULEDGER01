import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getCompleteSettings, getInstitution, getTimetableSettings } from "./db";

const tag=(institutionId:string,kind:string)=>`school:${institutionId}:${kind}`;

export function cachedInstitution(institutionId:string){return unstable_cache(()=>getInstitution(institutionId),["institution-profile",institutionId],{revalidate:300,tags:[tag(institutionId,"settings")]})()}
export function cachedCompleteSettings(institutionId:string){return unstable_cache(()=>getCompleteSettings(institutionId),["complete-settings",institutionId],{revalidate:300,tags:[tag(institutionId,"settings"),tag(institutionId,"classes")]})()}
export function cachedTimetableSettings(institutionId:string){return unstable_cache(()=>getTimetableSettings(institutionId),["timetable-settings",institutionId],{revalidate:300,tags:[tag(institutionId,"timetable"),tag(institutionId,"settings")]})()}

export function invalidateSchoolCache(institutionId:string,...kinds:("settings"|"classes"|"timetable")[]){for(const kind of kinds)revalidateTag(tag(institutionId,kind),{expire:0})}
