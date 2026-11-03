import{describe,expect,it}from"vitest";
import{academicYearSubscriptionPeriod,getSubscriptionStatus,parseSubscriptionPeriod,resolveSubscriptionPeriod}from"../src/lib/subscription";

describe("school subscription periods",()=>{
 it.each([["2026-04","2027-03"],["2026-06","2027-05"],["2026-07","2027-06"]])("supports cross-year period %s to %s",(start,end)=>{const period=parseSubscriptionPeriod(start,end);expect(period.startDate.toISOString()).toContain(`${start}-01`);expect(period.endDate.getUTCFullYear()).toBe(Number(end.slice(0,4)));expect(period.endDate.getUTCMonth()+1).toBe(Number(end.slice(5))) });
 it("rejects an end month before the start month",()=>expect(()=>parseSubscriptionPeriod("2027-04","2027-03")).toThrow("valid subscription period"));
 it("repairs a missing legacy period from the school's academic year",()=>{const period=resolveSubscriptionPeriod(null,null,"2026-2027");expect(period.startDate.toISOString()).toBe("2026-04-01T00:00:00.000Z");expect(period.endDate.toISOString()).toBe("2027-03-31T23:59:59.999Z")});
 it("falls back to the current academic year when legacy settings are malformed",()=>expect(academicYearSubscriptionPeriod("",new Date("2026-09-24T00:00:00Z")).startYear).toBe(2026));
 it("preserves an existing valid stored period",()=>{const period=resolveSubscriptionPeriod("2026-06-01T00:00:00.000Z","2027-05-31T23:59:59.999Z","2026-2027");expect(period.startMonth).toBe(6);expect(period.endMonth).toBe(5)});
 it("keeps a paid future period upcoming",()=>expect(getSubscriptionStatus("ACTIVE","2027-03-31T23:59:59.999Z",new Date("2026-09-01T00:00:00Z"),30,"2026-10-01T00:00:00Z")).toBe("UPCOMING"));
 it("uses the selected dates even when payment happens after the start",()=>expect(getSubscriptionStatus("ACTIVE","2027-03-31T23:59:59.999Z",new Date("2026-09-01T00:00:00Z"),30,"2026-04-01T00:00:00Z")).toBe("ACTIVE"));
 it("expires after the selected final day",()=>expect(getSubscriptionStatus("ACTIVE","2027-03-31T23:59:59.999Z",new Date("2027-04-01T00:00:00Z"),30,"2026-04-01T00:00:00Z")).toBe("EXPIRED"));
});
