import "server-only";
import ExcelJS from "exceljs";

type SchoolBrand={name:string;address?:string;city?:string;state?:string;pinCode?:string;phone?:string;email?:string;academicYear?:string};
type Logo={mimeType:string;data:Buffer|Uint8Array};
type ExcelReportInput={school:SchoolBrand;logo?:Logo;title:string;academicYear:string;rows:Record<string,unknown>[];filters?:string[];sheetName?:string;theme?:string};
const COLORS={school:"FFF2CC",title:"FFD966",table:"4472C4",white:"FFFFFF",stripe:"F7F9FC",text:"1F2937",border:"D1D5DB"};
const FONT="Times New Roman";
const humanize=(value:string)=>value.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/[-_]/g," ").replace(/\b\w/g,character=>character.toUpperCase());
const safeSheet=(value:string)=>value.replace(/[\\/*?:[\]]/g," ").slice(0,31)||"Report";
const fill=(argb:string):ExcelJS.Fill=>({type:"pattern",pattern:"solid",fgColor:{argb}});
const border=(color=COLORS.border):Partial<ExcelJS.Borders>=>({top:{style:"thin",color:{argb:color}},left:{style:"thin",color:{argb:color}},bottom:{style:"thin",color:{argb:color}},right:{style:"thin",color:{argb:color}}});

export async function createSchoolExcelReport(input:ExcelReportInput){
 const workbook=new ExcelJS.Workbook();workbook.creator="EduLedger";workbook.created=new Date();workbook.modified=new Date();
 const sheet=workbook.addWorksheet(safeSheet(input.sheetName||input.title),{properties:{defaultRowHeight:20},pageSetup:{orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,horizontalCentered:true,margins:{left:0.3,right:0.3,top:0.5,bottom:0.5,header:0.2,footer:0.2}}});
 const keys=input.rows[0]?Object.keys(input.rows[0]):["Message"],columnCount=Math.max(keys.length,5),last=sheet.getColumn(columnCount).letter;
 for(let row=1;row<=6;row++)sheet.mergeCells(`A${row}:${last}${row}`);
 const address=[input.school.address,input.school.city,input.school.state,input.school.pinCode].filter(Boolean).join(", "),filters=(input.filters||[]).filter(Boolean).join("   |   ");
 const header=[input.school.name,address,`Contact: ${input.school.phone||"Not provided"}   •   Email: ${input.school.email||"Not provided"}`,`Academic Year: ${input.academicYear}`,input.title.toUpperCase(),`${filters}${filters?"   |   ":""}Generated: ${new Date().toLocaleDateString("en-IN")}`];
 header.forEach((value,index)=>{const row=sheet.getRow(index+1);for(let column=1;column<=columnCount;column++){row.getCell(column).fill=fill(index===4?COLORS.title:COLORS.school);row.getCell(column).border=border(index===4?"B7A13B":"D6B656");}const cell=row.getCell(1);cell.value=value;cell.alignment={horizontal:"center",vertical:"middle",wrapText:false,shrinkToFit:true};cell.font={name:FONT,bold:index===0||index===4,size:index===0?18:index===4?14:index<4?11:10,color:{argb:COLORS.text}}});
 [27,20,20,20,24,18].forEach((height,index)=>sheet.getRow(index+1).height=height);
 if(input.logo){try{const extension=/png/i.test(input.logo.mimeType)?"png":/jpe?g/i.test(input.logo.mimeType)?"jpeg":undefined;if(extension){const imageId=workbook.addImage({buffer:Buffer.from(input.logo.data) as unknown as ExcelJS.Buffer,extension});sheet.addImage(imageId,{tl:{col:0.12,row:0.08},ext:{width:62,height:62},editAs:"oneCell"})}}catch{/* Optional malformed logos must not prevent exports. */}}
 const headerRow=8,tableHeader=sheet.getRow(headerRow);keys.forEach((key,index)=>{const cell=tableHeader.getCell(index+1);cell.value=humanize(key);cell.font={name:FONT,bold:true,color:{argb:COLORS.white},size:11};cell.fill=fill(COLORS.table);cell.alignment={vertical:"middle",horizontal:"center",wrapText:true};cell.border=border("A9B9D6")});tableHeader.height=28;
 const data=input.rows.length?input.rows:[{Message:"NO RECORDS FOUND"}];data.forEach((item,rowIndex)=>{const row=sheet.getRow(headerRow+1+rowIndex);row.height=21;keys.forEach((key,index)=>{const value=item[key],cell=row.getCell(index+1);cell.value=value instanceof Date?value:value==null?"":typeof value==="object"?JSON.stringify(value):value as string|number|boolean;cell.alignment={vertical:"middle",horizontal:typeof value==="number"?"right":"left",wrapText:true};cell.border=border();cell.font={name:FONT,color:{argb:COLORS.text}};cell.fill=fill(rowIndex%2?COLORS.stripe:COLORS.white);if(typeof value==="number"&&/amount|fee|paid|balance|salary|discount|income|expense|total/i.test(key))cell.numFmt='₹#,##0.00'})});
 keys.forEach((key,index)=>{const samples=data.slice(0,200).map(row=>String(row[key]??"").length),width=Math.min(45,Math.max(12,humanize(key).length+3,...samples.map(length=>length+2)));sheet.getColumn(index+1).width=width});
 sheet.views=[{state:"frozen",ySplit:headerRow,xSplit:0}];sheet.autoFilter={from:{row:headerRow,column:1},to:{row:headerRow,column:keys.length}};sheet.pageSetup.printTitlesRow=`${headerRow}:${headerRow}`;sheet.pageSetup.printArea=`A1:${last}${headerRow+data.length}`;sheet.headerFooter.oddFooter="&LEduLedger&CPage &P of &N&R&D";
 return Buffer.from(await workbook.xlsx.writeBuffer());
}
export function brandedExcelFilename(schoolName:string,title:string,from?:string,to?:string){const safe=(value:string)=>value.normalize("NFKD").replace(/[^A-Za-z0-9]+/g,"_").replace(/^_|_$/g,"");return[safe(schoolName),safe(title),from&&to?`${from.split("-").reverse().join("-")}_to_${to.split("-").reverse().join("-")}`:""].filter(Boolean).join("_")+".xlsx"}
