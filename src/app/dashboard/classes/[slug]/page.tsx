import { ClassWorkspace } from "@/components/class-workspace";
export const runtime="nodejs";
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params;return <ClassWorkspace slug={slug}/>}
