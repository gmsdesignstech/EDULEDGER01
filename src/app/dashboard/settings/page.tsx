import dynamic from "next/dynamic";
const SettingsPage=dynamic(()=>import("@/components/settings").then(module=>module.SettingsPage),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <SettingsPage/>}
