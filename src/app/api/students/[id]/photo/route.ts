import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { getStudent, getSchoolAsset, putSchoolAsset, deleteSchoolAsset, updateStudentPhotoPath, parentChildren, teacherPortalScope, teacherHasAssignment } from "@/lib/db";
import { logServerError } from "@/lib/server-errors";
import { detectedImageMime } from "@/lib/security";

export const runtime="nodejs";
const MAX_BYTES=5*1024*1024;
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
type Context={params:Promise<{id:string}>};

export async function GET(_request:Request,{params}:Context){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});
 const {id}=await params,student=await getStudent(user.institutionId,id);if(!student)return NextResponse.json({error:"Student not found."},{status:404});
 if(user.role==="PARENT"){
  const children=await parentChildren(user.institutionId,user.id);if(!children.some(child=>child.id===id))return NextResponse.json({error:"Forbidden"},{status:403});
 }else if(user.role==="TEACHER"){
  try{const scope=await teacherPortalScope(user.institutionId,user.email);if(!teacherHasAssignment(scope.assignments,{academicYear:student.academicYear,className:student.className,section:student.section}))return NextResponse.json({error:"Forbidden"},{status:403})}catch{return NextResponse.json({error:"Forbidden"},{status:403})}
 }else if(user.role==="STUDENT"){
  if(user.id!==id)return NextResponse.json({error:"Forbidden"},{status:403});
 }else if(!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT","STAFF"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
 const path=String(student.photoPath||"");if(!path)return NextResponse.json({error:"No student photo is available."},{status:404});
 try{const asset=await getSchoolAsset(user.institutionId,`student-photo:${id}`);if(!asset)return NextResponse.json({error:"No student photo is available."},{status:404});return new Response(Buffer.from(asset.data),{headers:{"Content-Type":asset.mimeType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})}catch(error){logServerError("students.photo.read",error);return NextResponse.json({error:"Could not load the student photo."},{status:500})}
}

export async function PUT(request:Request,{params}:Context){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});if(!["SCHOOL_ADMIN","SUPER_ADMIN","STAFF"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
 const {id}=await params,student=await getStudent(user.institutionId,id);if(!student)return NextResponse.json({error:"Student not found."},{status:404});
 try{
  const form=await request.formData(),file=form.get("photo");if(!(file instanceof File)||file.size===0)return NextResponse.json({error:"Choose a photo to upload."},{status:400});if(file.size>MAX_BYTES)return NextResponse.json({error:"Photo must be 5 MB or smaller."},{status:413});if(!allowed.has(file.type))return NextResponse.json({error:"Upload a JPG, PNG, or WebP image."},{status:415});
  const bytes=new Uint8Array(await file.arrayBuffer());if(!validImage(bytes,file.type)||detectedImageMime(Buffer.from(bytes))!==file.type)return NextResponse.json({error:"This image is corrupted or does not match its file type."},{status:400});
  const dimensions=imageDimensions(bytes,file.type);if(!dimensions||dimensions.width<120||dimensions.height<120||dimensions.width>8000||dimensions.height>8000)return NextResponse.json({error:"Photo dimensions must be between 120×120 and 8000×8000 pixels."},{status:400});
  const kind=`student-photo:${id}`,path=`${user.institutionId}/${id}/${crypto.randomUUID()}`;
  const oldAsset=await getSchoolAsset(user.institutionId,kind);
  try{await putSchoolAsset(user.institutionId,user.id,kind,file.type,Buffer.from(bytes));await updateStudentPhotoPath(user.institutionId,id,path)}catch(error){if(oldAsset)await putSchoolAsset(user.institutionId,user.id,kind,oldAsset.mimeType,oldAsset.data);else await deleteSchoolAsset(user.institutionId,user.id,kind);throw error}
  return NextResponse.json({photoUrl:`/api/students/${id}/photo`,photoPath:path});
 }catch(error){logServerError("students.photo.upload",error);return NextResponse.json({error:"Could not save the student photo."},{status:500})}
}

export async function DELETE(_request:Request,{params}:Context){
 const user=await currentUser();if(!user)return NextResponse.json({error:"Unauthenticated"},{status:401});if(!["SCHOOL_ADMIN","SUPER_ADMIN","STAFF"].includes(user.role))return NextResponse.json({error:"Forbidden"},{status:403});
 const {id}=await params,student=await getStudent(user.institutionId,id);if(!student)return NextResponse.json({error:"Student not found."},{status:404});
 await updateStudentPhotoPath(user.institutionId,id,null);await deleteSchoolAsset(user.institutionId,user.id,`student-photo:${id}`);return NextResponse.json({ok:true});
}

function validImage(b:Uint8Array,type:string){
 if(type==="image/jpeg")return b.length>3&&b[0]===0xff&&b[1]===0xd8&&b[b.length-2]===0xff&&b[b.length-1]===0xd9;
 if(type==="image/png")return b.length>24&&b[0]===0x89&&String.fromCharCode(...b.slice(1,4))==="PNG"&&String.fromCharCode(...b.slice(12,16))==="IHDR";
 if(type==="image/webp")return b.length>30&&String.fromCharCode(...b.slice(0,4))==="RIFF"&&String.fromCharCode(...b.slice(8,12))==="WEBP";
 return false;
}
function imageDimensions(b:Uint8Array,type:string):{width:number;height:number}|null{
 if(type==="image/png")return{width:new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(16),height:new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(20)};
 if(type==="image/webp"&&String.fromCharCode(...b.slice(12,16))==="VP8X")return{width:1+b[24]+(b[25]<<8)+(b[26]<<16),height:1+b[27]+(b[28]<<8)+(b[29]<<16)};
 if(type==="image/jpeg"){let i=2;while(i+9<b.length){if(b[i++]!==0xff)continue;const marker=b[i++],len=(b[i]<<8)|b[i+1];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{height:(b[i+3]<<8)|b[i+4],width:(b[i+5]<<8)|b[i+6]};if(len<2)break;i+=len}}return null;
}
