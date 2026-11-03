import dynamic from "next/dynamic";
const Classes=dynamic(()=>import("@/components/classes").then(module=>module.Classes),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <Classes/>}
