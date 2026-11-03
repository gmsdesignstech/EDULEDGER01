import dynamic from "next/dynamic";

const StudentIdCards=dynamic(()=>import("@/components/student-id-cards").then(module=>module.StudentIdCards),{loading:()=> <div className="card h-96 animate-pulse"/>});

export default function Page(){return <StudentIdCards/>}
