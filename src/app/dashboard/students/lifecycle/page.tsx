import dynamic from "next/dynamic";

const StudentLifecycle=dynamic(()=>import("@/components/student-lifecycle").then(module=>module.StudentLifecycle),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <StudentLifecycle/>}
