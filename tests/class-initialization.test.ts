import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { createAccount, getCompleteSettings, listClassSummaries, saveCompleteSettings } from "../src/lib/db";

describe("school class initialization", () => {
  it("keeps class and section reads empty until an administrator configures them", async () => {
    const stamp = `${Date.now()}-${Math.random()}`;
    const owner = await createAccount({
      name: "Class Setup Admin",
      email: `class-setup-${stamp}@example.com`,
      institution: `Class Setup School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    const first = await getCompleteSettings(owner.institutionId);
    const second = await getCompleteSettings(owner.institutionId);
    const summaries = await listClassSummaries(owner.institutionId, first.academicYear);

    expect(first.classes).toEqual([]);
    expect(second.classes).toEqual([]);
    expect(summaries).toEqual([]);
  });

  it("persists only explicitly selected classes and sections without recreating removed items",async()=>{
    const stamp=`${Date.now()}-${Math.random()}`,owner=await createAccount({name:"Manual Class Admin",email:`manual-classes-${stamp}@example.com`,institution:`Manual Class School ${stamp}`,passwordHash:await hash("password123",4)}),current=await getCompleteSettings(owner.institutionId);
    const base={...current,schoolCode:"MNL",startMonth:4,endMonth:3,academicYears:current.years.map(({name,startMonth,endMonth,status})=>({name,startMonth,endMonth,status}))};
    await saveCompleteSettings(owner.institutionId,owner.id,{...base,classes:[{name:"Nursery",sections:["A"]},{name:"LKG",sections:["A","B"]}]});
    expect((await getCompleteSettings(owner.institutionId)).classes.filter(item=>item.active).map(item=>({name:item.name,sections:item.sections}))).toEqual([{name:"Nursery",sections:["A"]},{name:"LKG",sections:["A","B"]}]);
    await saveCompleteSettings(owner.institutionId,owner.id,{...base,classes:[{name:"Nursery",sections:["A"]},{name:"LKG",sections:["A"]}]});
    const reloaded=await getCompleteSettings(owner.institutionId);
    expect(reloaded.classes.filter(item=>item.active).map(item=>({name:item.name,sections:item.sections}))).toEqual([{name:"Nursery",sections:["A"]},{name:"LKG",sections:["A"]}]);
    expect(reloaded.classes.some(item=>item.name==="LG")).toBe(false);
  });
});
