import dynamic from "next/dynamic";
const Teachers=dynamic(()=>import("@/components/teachers").then(module=>module.Teachers),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <Teachers/>}
