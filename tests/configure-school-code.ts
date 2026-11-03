import { getCompleteSettings, saveCompleteSettings } from "../src/lib/db";

export async function configureSchoolCode(institutionId: string, userId: string, schoolCode = "TST") {
  const current = await getCompleteSettings(institutionId);
  return saveCompleteSettings(institutionId, userId, {
    ...current,
    schoolCode,
    academicYears: current.years.some(item=>item.name==="2027-2028")
      ? current.years.map(({ name, startMonth, endMonth, status }) => ({ name, startMonth, endMonth, status }))
      : [...current.years.map(({ name, startMonth, endMonth, status }) => ({ name, startMonth, endMonth, status })),{name:"2027-2028",startMonth:4,endMonth:3,status:"Active" as const}],
    classes: current.classes.some(item=>item.active)
      ? current.classes.filter(item => item.active).map(({ name, sections }) => ({ name, sections }))
      : Array.from({length:5},(_,index)=>({name:`Class ${index+1}`,sections:["A","B"]})),
    startMonth: current.years.find(item => item.name === current.academicYear)?.startMonth || 4,
    endMonth: current.years.find(item => item.name === current.academicYear)?.endMonth || 3,
  });
}
