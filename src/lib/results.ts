export type GradeBand={minimum:number;grade:string};
export type ResultSettings={gradeBands:GradeBand[];overallPassPercent:number;requireSubjectPass:boolean;rankingEnabled:boolean;principalRemarks:string;classTeacherRemarks:string;reportFormat:string};
export const defaultResultSettings:ResultSettings={gradeBands:[{minimum:90,grade:"A+"},{minimum:80,grade:"A"},{minimum:70,grade:"B+"},{minimum:60,grade:"B"},{minimum:50,grade:"C"},{minimum:35,grade:"D"},{minimum:0,grade:"F"}],overallPassPercent:35,requireSubjectPass:true,rankingEnabled:false,principalRemarks:"",classTeacherRemarks:"",reportFormat:"Standard"};
export type MarkStatus="Scored"|"Absent"|"Exempt";
export type SubjectOutcome={subjectId:string;subject:string;maximumCent:number;passingCent:number;required:boolean;obtainedCent:number|null;markStatus:MarkStatus|null;remarks:string};
export function toCent(value:number){if(!Number.isFinite(value)||value<0||Math.abs(Math.round(value*100)-value*100)>1e-8)throw new Error("Marks must be a non-negative number with at most two decimal places.");return Math.round(value*100)}
export function validateGradeBands(bands:GradeBand[]){
  if(!bands.length||bands.length>20||bands.some(band=>!Number.isInteger(band.minimum)||band.minimum<0||band.minimum>100||!band.grade.trim()||band.grade.length>10))throw new Error("Enter valid grade thresholds between 0 and 100.");
  const ordered=[...bands].sort((a,b)=>b.minimum-a.minimum);
  if(ordered.at(-1)?.minimum!==0||new Set(ordered.map(item=>item.minimum)).size!==ordered.length)throw new Error("Grade thresholds must be unique and include zero.");
  return ordered;
}
export function calculateStudentResult(subjects:SubjectOutcome[],settings:ResultSettings){
  const expected=subjects.length,entered=subjects.filter(item=>item.markStatus!==null).length;
  const counted=subjects.filter(item=>item.markStatus==="Scored"&&item.obtainedCent!==null);
  const totalCent=counted.reduce((sum,item)=>sum+item.obtainedCent!,0);
  // The denominator is the maximum for every non-exempt subject. Including
  // absent subjects keeps percentages and report-card totals accurate.
  const maximumCent=subjects.filter(item=>item.markStatus!=="Exempt").reduce((sum,item)=>sum+item.maximumCent,0);
  const percentageHundredths=maximumCent?Math.round(totalCent*10000/maximumCent):0;
  const percentage=percentageHundredths/100;
  const grade=validateGradeBands(settings.gradeBands).find(item=>percentageHundredths>=item.minimum*100)?.grade||"F";
  const absent=subjects.some(item=>item.markStatus==="Absent");
  const failed=settings.requireSubjectPass&&subjects.some(item=>item.required&&item.markStatus==="Scored"&&item.obtainedCent!==null&&item.obtainedCent<item.passingCent);
  const overallPass=percentageHundredths>=settings.overallPassPercent*100;
  const status=entered<expected?"Incomplete":absent?"Absent":failed||!overallPass?"Fail":counted.length===0?"Exempt":"Pass";
  return {totalCent,maximumCent,percentage,grade,status,entered,expected};
}
