import { readFile } from "node:fs/promises";
import process from "node:process";
import postgres from "postgres";

const url=process.env.DATABASE_URL?.trim();
if(!url||!/^postgres(?:ql)?:\/\//i.test(url))throw new Error("A PostgreSQL DATABASE_URL is required.");
const sql=postgres(url,{max:1,idle_timeout:5,connect_timeout:15,prepare:false,ssl:"require"});
try{
  const before=await sql`SELECT
    (SELECT COUNT(*)::int FROM institution_classes WHERE UPPER(TRIM(name))='LG' AND status='Active') active_definitions,
    (SELECT COUNT(*)::int FROM classes WHERE UPPER(TRIM(name))='LG' AND status='Active') active_operational_rows,
    (SELECT COUNT(*)::int FROM students WHERE UPPER(TRIM(class_name))='LG' AND status<>'Deleted') affected_students`;
  const migration=await readFile(new URL("../database/migrations/202609250001_manual_class_configuration.sql",import.meta.url),"utf8");
  await sql.unsafe(migration);
  const after=await sql`SELECT
    (SELECT COUNT(*)::int FROM institution_classes WHERE UPPER(TRIM(name))='LG' AND status='Active') active_definitions,
    (SELECT COUNT(*)::int FROM classes WHERE UPPER(TRIM(name))='LG' AND status='Active') active_operational_rows`;
  console.log(JSON.stringify({before:before[0],after:after[0],dataDeleted:false}));
}finally{await sql.end({timeout:5})}
