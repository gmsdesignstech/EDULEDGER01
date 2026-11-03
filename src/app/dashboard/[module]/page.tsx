import{notFound}from"next/navigation";import dynamic from "next/dynamic";import{ModuleWorkspace}from"@/components/module-workspace";import{moduleConfigs}from"@/config/modules";
const SalaryManagement=dynamic(()=>import("@/components/school-salary-management").then(module=>module.SalaryManagement),{loading:()=> <div className="card h-96 animate-pulse"/>});
export default async function Module({params}:{params:Promise<{module:string}>}){const{module}=await params;if(!moduleConfigs[module])notFound();return module==="salary-management"?<SalaryManagement/>:<ModuleWorkspace module={module}/>}
