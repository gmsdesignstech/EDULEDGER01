import dynamic from "next/dynamic";
const Students=dynamic(()=>import("@/components/students").then(module=>module.Students),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <Students/>}
