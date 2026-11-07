import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { addTimetableEntry, applyWeeklyTimetable, createAccount, getClassWorkspace, getInstitution, getTimetableSettings, listClassSummaries, listTimetableEntries, parentChildTimetable, previewWeeklyTimetable, publishTimetable, saveTeacher, saveTimetableSettings, updateTimetableEntry } from "../src/lib/db";
import { defaultTimetableSettings, timetableSlots, timeMinutes } from "../src/lib/timetable";
import { configureSchoolCode } from "./configure-school-code";

describe("weekly timetable school timing", () => {
  it("fits periods within both 4:00 PM and 4:30 PM closing times", () => {
    for (const endTime of ["16:00","16:30"]) {
      const slots=timetableSlots({...defaultTimetableSettings,endTime});
      expect(slots[0].startTime).toBe("09:00");
      expect(slots.at(-1)?.endTime).toBe(endTime);
      expect(slots.filter(item=>item.kind==="Period")).toHaveLength(9);
      expect(slots.every(item=>timeMinutes(item.endTime)<=timeMinutes(endTime))).toBe(true);
    }
    expect(() => timetableSlots({...defaultTimetableSettings,endTime:"15:30"})).toThrow("cannot fit");
    expect(timetableSlots({...defaultTimetableSettings,endTime:"15:30",periodsPerDay:8}).at(-1)?.endTime).toBe("15:30");
  });

  it("saves timing and generates only inside school hours for an existing class", async () => {
    const stamp=Date.now();
    const admin=await createAccount({name:"Timetable Admin",email:`timetable-${stamp}@example.com`,institution:`Timetable School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(admin.institutionId,admin.id);
    const academicYear=(await getInstitution(admin.institutionId)).academicYear;
    await listClassSummaries(admin.institutionId,academicYear);
    await saveTeacher(admin.institutionId,{name:"Maths Teacher",employeeId:`TT-${stamp}`,email:"",phone:"9876543210",department:"Teaching",subject:"Mathematics",classes:"Class 1",joiningDate:"2026-04-01",salary:30000,status:"Active"},admin.id);
    await addTimetableEntry(admin.institutionId,"Class 1",academicYear,{section:"A",subject:"Assembly",weekday:1,startTime:"09:00",endTime:"09:40"});
    const original=await getTimetableSettings(admin.institutionId);
    for(const endTime of ["16:00","16:30"]){
      await saveTimetableSettings(admin.institutionId,admin.id,{...original,endTime,workingDays:[1,2,3,4,5,6]});
      const preview=await previewWeeklyTimetable(admin.institutionId,"Class 1","A",academicYear);
      expect(preview.entries).toHaveLength(53);
      expect(preview.entries.every(item=>item.endTime<=endTime)).toBe(true);
      expect(new Set(preview.entries.map(item=>item.subject))).toEqual(new Set(["Mathematics"]));
      expect(preview.entries.some(item=>item.subject==="English")).toBe(false);
      await applyWeeklyTimetable(admin.institutionId,admin.id,"Class 1","A",academicYear);
      const workspace=await getClassWorkspace(admin.institutionId,"class-1",academicYear);
      expect((workspace?.timetable as {endTime:string}[]).filter(item=>item.endTime>endTime)).toHaveLength(0);
      expect((workspace?.timetable as {endTime:string}[]).length).toBe(54);
      expect((workspace?.timetable as {subject:string}[]).some(item=>item.subject==="Assembly")).toBe(true);
    }
  });

  it("keeps section A and section B timetable entries isolated", async()=>{
    const stamp=Date.now(),admin=await createAccount({name:"Section Admin",email:`sections-${stamp}@example.com`,institution:`Section School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(admin.institutionId,admin.id);const year=(await getInstitution(admin.institutionId)).academicYear;await listClassSummaries(admin.institutionId,year);
    await addTimetableEntry(admin.institutionId,"Class 1",year,{section:"A",subject:"Mathematics",weekday:1,startTime:"09:00",endTime:"09:40"});
    await addTimetableEntry(admin.institutionId,"Class 1",year,{section:"B",subject:"English",weekday:1,startTime:"09:00",endTime:"09:40"});
    expect((await listTimetableEntries(admin.institutionId,"Class 1","A",year)).map(x=>x.subject)).toEqual(["Mathematics"]);
    expect((await listTimetableEntries(admin.institutionId,"Class 1","B",year)).map(x=>x.subject)).toEqual(["English"]);
  });

  it("keeps draft edits out of parent views until timetable publication", async()=>{
    const stamp=Date.now(),admin=await createAccount({name:"Publish Admin",email:`publish-${stamp}@example.com`,institution:`Publish School ${stamp}`,passwordHash:await hash("password123",4)});
    await configureSchoolCode(admin.institutionId,admin.id);const year=(await getInstitution(admin.institutionId)).academicYear;await listClassSummaries(admin.institutionId,year);
    const teacher=await saveTeacher(admin.institutionId,{name:"Published Maths Teacher",employeeId:`PUB-${stamp}`,email:"",phone:"9876543210",department:"Teaching",subject:"Mathematics",classes:"Class 1",joiningDate:"2026-04-01",salary:30000,status:"Active"},admin.id);
    await addTimetableEntry(admin.institutionId,"Class 1",year,{section:"A",subject:"Mathematics",teacherId:teacher.id,weekday:1,startTime:"09:00",endTime:"09:40"});
    const entry=(await listTimetableEntries(admin.institutionId,"Class 1","A",year))[0];
    await updateTimetableEntry(admin.institutionId,admin.id,entry.id,{className:"Class 1",section:"A",academicYear:year,subject:"Mathematics",teacherId:teacher.id,weekday:1,startTime:"09:10",endTime:"09:50"});
    expect((await parentChildTimetable(admin.institutionId,"Class 1","A",year))).toHaveLength(0);
    expect((await listTimetableEntries(admin.institutionId,"Class 1","A",year))[0].status).toBe("Draft");
    await publishTimetable(admin.institutionId,admin.id,"Class 1","A",year);
    expect((await parentChildTimetable(admin.institutionId,"Class 1","A",year)).map(item=>item.startTime)).toEqual(["09:10"]);
    expect((await listTimetableEntries(admin.institutionId,"Class 1","A",year))[0].status).toBe("Published");
  });
});
