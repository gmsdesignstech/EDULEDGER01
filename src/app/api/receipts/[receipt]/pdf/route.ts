import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import { getInstitution, getReceipt, getReceiptForAdmin, getSchoolAsset, type DbPayment } from "@/lib/db";
import { amountInWords, receiptDate } from "@/lib/receipt-format";
import { currentUser } from "@/lib/session";
import { isPrivateAdmin } from "@/lib/admin-auth";
import { verifyWhatsAppDocumentSignature } from "@/lib/whatsapp";

export const runtime = "nodejs";
const blue=rgb(.13,.26,.56),ink=rgb(.12,.17,.25),muted=rgb(.33,.38,.47),line=rgb(.73,.8,.9),pale=rgb(.87,.91,1),totalBg=rgb(.93,.95,.98);

export async function GET(request:Request,{params}:{params:Promise<{receipt:string}>}) {
  const number=decodeURIComponent((await params).receipt),query=new URL(request.url).searchParams,expires=Number(query.get("wa_expires")),documentSignature=query.get("wa_signature")||"",signed=verifyWhatsAppDocumentSignature(`receipt:${number}`,expires,documentSignature),user=signed?undefined:await currentUser();
  if(!signed&&!user)return Response.json({error:"Unauthenticated"},{status:401});
  if(user&&!isPrivateAdmin(user)&&!["SCHOOL_ADMIN","SUPER_ADMIN","ACCOUNTANT"].includes(user.role))return Response.json({error:"Forbidden"},{status:403});
  const receipt=signed||isPrivateAdmin(user)?await getReceiptForAdmin(number):await getReceipt(user!.institutionId,number);
  if(!receipt)return Response.json({error:"Receipt not found"},{status:404});
  const institutionId=("institutionId" in receipt?receipt.institutionId:user!.institutionId) as string,school=await getInstitution(institutionId),doc=await PDFDocument.create(),page=doc.addPage([612,792]),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const [savedLogo,savedSignature]=await Promise.all([getSchoolAsset(institutionId,"logo"),getSchoolAsset(institutionId,"signature")]);
  const logo=await embedAsset(doc,savedLogo,"eduledger-logo.jpeg"),signature=await embedAsset(doc,savedSignature);
  drawCopy(page,760,"SCHOOL COPY",receipt,school,font,bold,logo!,signature);
  drawCutLine(page,397);
  drawCopy(page,372,"CANDIDATE COPY",receipt,school,font,bold,logo!,signature);
  const bytes=await doc.save();
  return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="EduLedger_Receipt_${receipt.receiptNumber}.pdf"`,"Cache-Control":"private, no-store"}});
}

function drawCutLine(page:PDFPage,y:number){
  const cut=rgb(.91,.2,.34),guide=rgb(.52,.64,.8),center=306;
  page.drawLine({start:{x:42,y},end:{x:center-12,y},thickness:.8,color:guide,dashArray:[3,2]});
  page.drawLine({start:{x:center+12,y},end:{x:570,y},thickness:.8,color:guide,dashArray:[3,2]});
  page.drawCircle({x:center-4,y:y+3,size:2.6,borderColor:cut,borderWidth:1.2});
  page.drawCircle({x:center+4,y:y+3,size:2.6,borderColor:cut,borderWidth:1.2});
  page.drawLine({start:{x:center-2,y:y+1},end:{x:center+7,y:y-7},thickness:1.2,color:cut});
  page.drawLine({start:{x:center+2,y:y+1},end:{x:center-7,y:y-7},thickness:1.2,color:cut});
}

type School=Awaited<ReturnType<typeof getInstitution>>;
type ImageRef=PDFImage;

async function embedAsset(doc:PDFDocument,asset:{mimeType:string;data:Buffer}|undefined,fallback?:string){
  if(asset?.mimeType==="image/png")return doc.embedPng(asset.data);
  if(asset?.mimeType==="image/jpeg")return doc.embedJpg(asset.data);
  if(asset?.mimeType==="image/webp")return doc.embedPng(await sharp(asset.data).png().toBuffer());
  return fallback?doc.embedJpg(await readFile(join(process.cwd(),"public",fallback))):undefined;
}

function drawCopy(page:PDFPage,top:number,copy:string,receipt:DbPayment,school:School,font:PDFFont,bold:PDFFont,logo:ImageRef,signature:ImageRef|undefined) {
  const left=54,right=558,width=right-left;
  const text=(value:string,x:number,y:number,size=8,isBold=false,color=ink)=>page.drawText(value,{x,y,size,font:isBold?bold:font,color});
  const centered=(value:string,y:number,size:number,isBold=false,color=ink)=>text(value,left+(width-(isBold?bold:font).widthOfTextAtSize(value,size))/2,y,size,isBold,color);
  page.drawImage(logo,{x:289,y:top-44,width:34,height:34});
  centered(school.name.toUpperCase(),top-57,15,true,blue);
  const contact=[school.address,school.phone,school.email,school.diseCode&&`DISE Code: ${school.diseCode}`].filter(Boolean).join(" | ")||"School Administration";
  centered(fit(contact,font,7,width),top-69,7,false,muted);
  page.drawLine({start:{x:left,y:top-77},end:{x:right,y:top-77},thickness:.7,color:line});
  centered((school.feeReceiptTitle||"Fee Payment Receipt").toUpperCase(),top-92,12,true,blue);
  page.drawLine({start:{x:left,y:top-97},end:{x:right,y:top-97},thickness:.7,color:line});
  text(`Receipt No: ${receipt.receiptNumber}`,left,top-114,7.5,true);
  text(`Date: ${receiptDate(receipt.paymentDate)}`,right-bold.widthOfTextAtSize(`Date: ${receiptDate(receipt.paymentDate)}`,7.5),top-114,7.5,true);
  text(`Student Name: ${receipt.studentName}`,left,top-128,7.5,true);
  const classText=`Class & Section: ${receipt.className}-${receipt.section}`;
  text(classText,right-bold.widthOfTextAtSize(classText,7.5),top-128,7.5,true);
  text(`[ ${copy} ]`,left,top-142,6.5,true,muted);
  const yearText=`Academic Year: ${receipt.academicYear}`;
  text(yearText,right-bold.widthOfTextAtSize(yearText,7.5),top-142,7.5,true);
  text(`Admission: ${fit(receipt.admission,font,7,180)}`,left,top-153,7);
  text(`Roll number: ${receipt.rollNumber||"-"}`,320,top-153,7);
  text(fit(`Payment frequency: ${receipt.paymentFrequency}  |  Status: ${receipt.status}`,font,7,width),left,top-164,7,true);
  const words=amountInWords(receipt.amount),sentence=`Received with thanks from Mr/Ms. ${receipt.studentName}, the sum of ${words} by ${receipt.method} towards the following fees:`;
  const sentenceLines=wrap(sentence,font,7.4,width);
  sentenceLines.slice(0,2).forEach((value,index)=>text(value,left,top-181-index*10,7.4));
  const tableTop=top-211,rowHeight=16,amountX=420;
  page.drawRectangle({x:left,y:tableTop-rowHeight,width,height:rowHeight,color:pale,borderColor:line,borderWidth:.7});
  page.drawLine({start:{x:amountX,y:tableTop},end:{x:amountX,y:tableTop-rowHeight*3},thickness:.7,color:line});
  text("Particulars",left+7,tableTop-11,8,true,blue);text("Amount",right-45,tableTop-11,8,true,blue);
  page.drawRectangle({x:left,y:tableTop-rowHeight*2,width,height:rowHeight,borderColor:line,borderWidth:.7});
  text(fit(`${receipt.feeType} (net payable)`,font,8,amountX-left-14),left+7,tableTop-rowHeight-11,8);rightText(text,font,`Rs. ${receipt.netPayable.toLocaleString("en-IN")}`,right-7,tableTop-rowHeight-11,8);
  page.drawRectangle({x:left,y:tableTop-rowHeight*3,width,height:rowHeight,color:totalBg,borderColor:line,borderWidth:.7});
  rightText(text,bold,"Amount paid",amountX-7,tableTop-rowHeight*2-11,8,true);rightText(text,bold,`Rs. ${receipt.amount.toLocaleString("en-IN")}`,right-7,tableTop-rowHeight*2-11,8,true);
  text(`Amount Paid: ${words}`,left,tableTop-62,7.4,true);
  text(`Original: Rs. ${Number(receipt.originalAmount).toLocaleString("en-IN")}  Discount: Rs. ${Number(receipt.discountAmount).toLocaleString("en-IN")}  Late fee: Rs. ${Number(receipt.lateFee).toLocaleString("en-IN")}`,left,tableTop-74,7);
  text(`Remaining: Rs. ${Number(receipt.remainingBalance).toLocaleString("en-IN")}`,315,tableTop-74,7);
  text(`Reference: ${fit(receipt.transactionId||"-",font,7,190)}`,left,tableTop-86,7);
  page.drawLine({start:{x:left,y:tableTop-96},end:{x:right,y:tableTop-96},thickness:.6,color:line,dashArray:[2,2]});
  const signatureY=tableTop-126;
  page.drawLine({start:{x:left,y:signatureY},end:{x:145,y:signatureY},thickness:.8,color:ink});centeredAt(text,bold,"Cashier Signature",99.5,signatureY-11,7,true);
  if(signature)page.drawImage(signature,{x:466,y:signatureY+3,width:66,height:28});
  else centeredAt(text,font,"Signature not configured",506.5,signatureY+10,6.5);
  page.drawLine({start:{x:455,y:signatureY},end:{x:right,y:signatureY},thickness:.8,color:ink});centeredAt(text,bold,school.signatureLabel||"Authorized Signatory",506.5,signatureY-11,7,true);
}

function fit(value:string,font:PDFFont,size:number,width:number){let result=value;while(result.length>3&&font.widthOfTextAtSize(result,size)>width)result=result.slice(0,-1);return result===value?result:`${result.slice(0,-3)}...`;}
function wrap(value:string,font:PDFFont,size:number,width:number){const lines:string[]=[],words=value.split(" ");let current="";for(const word of words){const next=current?`${current} ${word}`:word;if(font.widthOfTextAtSize(next,size)<=width)current=next;else{if(current)lines.push(current);current=word}}if(current)lines.push(current);return lines;}
function rightText(draw:(value:string,x:number,y:number,size?:number,isBold?:boolean)=>void,font:PDFFont,value:string,right:number,y:number,size:number,isBold=false){draw(value,right-font.widthOfTextAtSize(value,size),y,size,isBold);}
function centeredAt(draw:(value:string,x:number,y:number,size?:number,isBold?:boolean)=>void,font:PDFFont,value:string,center:number,y:number,size:number,isBold=false){draw(value,center-font.widthOfTextAtSize(value,size)/2,y,size,isBold);}
