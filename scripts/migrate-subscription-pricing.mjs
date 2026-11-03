import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url=process.env.DATABASE_URL?.trim();
if(!url||!/^postgres(?:ql)?:\/\//i.test(url))throw new Error("A PostgreSQL DATABASE_URL is required.");
const files=[
  "../prisma/migrations/202609220002_subscription_onboarding/migration.sql",
  "../prisma/migrations/202609220003_fifty_per_student_pricing/migration.sql",
  "../prisma/migrations/202610260001_hundred_per_student_pricing/migration.sql",
];
const migrations=await Promise.all(files.map(file=>readFile(new URL(file,import.meta.url),"utf8")));
const sql=postgres(url,{max:1,connect_timeout:15,idle_timeout:5,prepare:false,ssl:"require"});
try{
  await sql.begin(async transaction=>{for(const migration of migrations)await transaction.unsafe(migration)});
  console.log("Subscription onboarding and current ₹100 pricing migrations completed.");
}finally{await sql.end({timeout:5})}
