import dynamic from "next/dynamic";
const CashBook=dynamic(()=>import("@/components/cash-book").then(module=>module.CashBook),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default function Page(){return <CashBook/>}
