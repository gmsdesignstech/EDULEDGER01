import { beforeAll, describe, expect, it } from "vitest";

let database: typeof import("../src/lib/db");

beforeAll(async () => {
  database = await import("../src/lib/db");
});

describe("registration persistence", () => {
  it("atomically creates a school administrator, workspace, settings, and session", async () => {
    const email = `registration-${crypto.randomUUID()}@example.test`;
    const result = await database.createAccountWithSession({
      name: "Registration Test",
      email,
      institution: "Registration Test School",
      phone: "+91 98765 43210",
      passwordHash: "a-non-secret-test-hash",
    });

    expect(result.user).toMatchObject({ email, role: "SCHOOL_ADMIN" });
    expect(result.session.token).toBeTruthy();
    expect(await database.findUserByEmail(email)).toMatchObject({
      id: result.user.id,
      institutionId: result.user.institutionId,
    });
    expect(await database.getUserBySession(result.session.token)).toMatchObject({
      id: result.user.id,
      institutionId: result.user.institutionId,
    });
    expect(await database.getInstitution(result.user.institutionId)).toMatchObject({
      name: "Registration Test School",
      email,
      phone: "+91 98765 43210",
    });
    await expect(
      database.saveSubscriptionStudentCount(result.user.institutionId, result.user.id, 250),
    ).resolves.toMatchObject({ billingStudentCount: 250, annualAmount: 25000 });
  });

  it("enforces the case-insensitive application email convention", async () => {
    await expect(
      database.createAccountWithSession({
        name: "Duplicate Registration",
        email: "REGISTRATION-DUPLICATE@example.test",
        institution: "First School",
        passwordHash: "a-non-secret-test-hash",
      }),
    ).resolves.toBeDefined();

    await expect(
      database.createAccountWithSession({
        name: "Duplicate Registration",
        email: "registration-duplicate@example.test",
        institution: "Second School",
        passwordHash: "a-non-secret-test-hash",
      }),
    ).rejects.toMatchObject({ code: expect.any(String) });
  });

  it("allows exactly one tenant-scoped active student before first subscription checkout", async () => {
    const stamp=crypto.randomUUID(),account=await database.createAccountWithSession({
      name:"Onboarding Administrator",
      email:`onboarding-${stamp}@example.test`,
      institution:`Onboarding School ${stamp}`,
      passwordHash:"a-non-secret-test-hash",
    });
    const settings=await database.getCompleteSettings(account.user.institutionId);
    await database.saveCompleteSettings(account.user.institutionId,account.user.id,{
      ...settings,
      schoolCode:"ONB",
      academicYear:"2026-2027",
      startMonth:4,
      endMonth:3,
      academicYears:[{name:"2026-2027",startMonth:4,endMonth:3,status:"Active"}],
      classes:[{name:"Class 1",sections:["A"]}],
    });
    const student={name:"First Student",admission:`ONB-${stamp}`,gender:"Other" as const,dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Parent Name",parentPhone:"+919876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:"2026-2027",dueDate:"2027-03-01"};
    await expect(database.addStudent(account.user.institutionId,student,account.user.id,{enforceCapacity:true,allowFirstUnpaidEnrollment:true})).resolves.toMatchObject({name:"First Student",status:"Active"});
    await expect(database.addStudent(account.user.institutionId,{...student,name:"Second Student",admission:`ONB-2-${stamp}`},account.user.id,{enforceCapacity:true,allowFirstUnpaidEnrollment:true})).rejects.toThrow("SUBSCRIPTION_REQUIRED");
    expect(await database.getActiveStudentCount(account.user.institutionId)).toBe(1);
  });

  it("uses real active enrollment instead of a stale registration estimate", async () => {
    const stamp=crypto.randomUUID(),account=await database.createAccountWithSession({
      name:"Enrollment Authority Administrator",
      email:`enrollment-authority-${stamp}@example.test`,
      institution:`Enrollment Authority School ${stamp}`,
      passwordHash:"a-non-secret-test-hash",
      studentCount:150,
    });
    const settings=await database.getCompleteSettings(account.user.institutionId);
    await database.saveCompleteSettings(account.user.institutionId,account.user.id,{...settings,schoolCode:"EAS",academicYear:"2026-2027",startMonth:4,endMonth:3,academicYears:[{name:"2026-2027",startMonth:4,endMonth:3,status:"Active"}],classes:[{name:"Class 1",sections:["A"]}]});
    await database.addStudent(account.user.institutionId,{name:"Enrolled Student",admission:`EAS-${stamp}`,gender:"Other",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Parent",parentPhone:"+919876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:"2026-2027",dueDate:"2027-03-01"},account.user.id,{enforceCapacity:true,allowFirstUnpaidEnrollment:true});
    await expect(database.getSubscription(account.user.institutionId)).resolves.toMatchObject({studentUsage:1,billingStudentCount:1,annualAmount:10000});
    await expect(database.getSubscriptionBillingStudentCount(account.user.institutionId)).resolves.toBe(1);
  });
});
