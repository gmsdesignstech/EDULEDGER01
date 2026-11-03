import dynamic from "next/dynamic";
const AccountsDashboard=dynamic(()=>import("@/components/accounts-dashboard").then(module=>module.AccountsDashboard),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <AccountsDashboard/>}
