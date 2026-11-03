import dynamic from "next/dynamic";
const StudentAttendance=dynamic(()=>import("@/components/student-attendance").then(module=>module.StudentAttendance),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <StudentAttendance/>}
