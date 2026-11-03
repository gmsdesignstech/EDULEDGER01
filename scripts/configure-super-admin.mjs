import{createInterface}from"node:readline/promises";
import{stdin as input,stdout as output}from"node:process";
import bcrypt from"bcryptjs";
import postgres from"postgres";

const email=process.argv[2]?.trim().toLowerCase(),url=process.env.DATABASE_URL?.trim(),configuredId=process.env.ADMIN_USER_ID?.trim();
if(!email||!email.includes("@"))throw new Error("A valid admin email argument is required.");
if(!url)throw new Error("DATABASE_URL is required.");
if(!configuredId)throw new Error("ADMIN_USER_ID is required to safely update the configured administrator.");
const prompt=createInterface({input,output,terminal:false});
const password=await prompt.question("Super Admin password: ");prompt.close();
if(password.length<8||password.length>128)throw new Error("The Super Admin password must contain 8 to 128 characters.");
const databaseHost=new URL(url).hostname;
const ssl=["localhost","127.0.0.1","::1"].includes(databaseHost)?false:"require";
const passwordHash=await bcrypt.hash(password,12),sql=postgres(url,{max:1,connect_timeout:15,idle_timeout:5,prepare:false,ssl});
let userId=configuredId;
try{await sql.begin(async tx=>{
 const configured=await tx`SELECT id FROM users WHERE id=${configuredId} AND role='SUPER_ADMIN' LIMIT 1`,current=configured.length?configured:await tx`SELECT id FROM users WHERE role='SUPER_ADMIN' LIMIT 2`,target=await tx`SELECT id FROM users WHERE LOWER(email)=LOWER(${email}) LIMIT 1`;
 if(current.length>1)throw new Error("Multiple Super Admin records require manual review.");
 if(current.length){userId=current[0].id;if(target.length&&target[0].id!==userId)throw new Error("The requested email already belongs to another account.");await tx`UPDATE users SET email=${email},name='EduLedger Super Admin',password_hash=${passwordHash},status='Active' WHERE id=${userId}`}
 else if(target.length){userId=target[0].id;await tx`UPDATE users SET name='EduLedger Super Admin',password_hash=${passwordHash},role='SUPER_ADMIN',status='Active' WHERE id=${userId}`}
 else{const institutionId=randomUUID();userId=randomUUID();await tx`INSERT INTO institutions(id,name,status) VALUES(${institutionId},'EduLedger Platform Administration','Active')`;await tx`INSERT INTO users(id,email,name,password_hash,role,institution_id,status) VALUES(${userId},${email},'EduLedger Super Admin',${passwordHash},'SUPER_ADMIN',${institutionId},'Active')`}
 await tx`DELETE FROM sessions WHERE user_id=${userId}`;
});console.log(`Super Admin configured successfully. User ID: ${userId}`)}finally{await sql.end({timeout:5})}
import{randomUUID}from"node:crypto";
