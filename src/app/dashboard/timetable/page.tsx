import dynamic from "next/dynamic";
const TimetableWorkspace=dynamic(()=>import("@/components/timetable-workspace").then(module=>module.TimetableWorkspace),{loading:()=> <div className="card h-96 animate-pulse"/>});
export const runtime="nodejs";
export default function Page(){return <TimetableWorkspace/>}
