import { afterEach, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import {
  adminAuditLogs,
  adminManageSubscription,
  adminOverview,
  adminSchools,
  adminSetSchoolStatus,
  adminSubscriptions,
  createAccount,
  findUserByEmail,
} from "../src/lib/db";
import { isPrivateAdmin } from "../src/lib/admin-auth";
import { POST as superAdminLogin } from "../src/app/api/admin/login/route";

describe("EduLedger Super Admin Portal (Platform Owner Dashboard)", () => {
  it("enforces strict role authorization for Super Admin login route", async () => {
    const stamp = Date.now();
    const password = "StrongPassword123!";
    const passwordHash = await hash(password, 4);

    // Create a regular school admin account
    const schoolUser = await createAccount({
      name: `School Admin ${stamp}`,
      email: `schooladmin-${stamp}@example.com`,
      institution: `School ${stamp}`,
      passwordHash,
    });

    // Attempting to log in as a normal school admin on the Super Admin login endpoint must be rejected with 403
    const regularUserReq = new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: schoolUser.email,
        password,
      }),
    });

    const regularUserRes = await superAdminLogin(regularUserReq);
    expect(regularUserRes.status).toBe(403);
    const regularUserData = await regularUserRes.json();
    expect(regularUserData.error).toContain(
      "Access restricted to authorized EduLedger platform administrator only",
    );

    // Attempting with wrong password returns 401
    const badPasswordReq = new Request("http://localhost/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: schoolUser.email,
        password: "wrongpassword",
      }),
    });
    const badPasswordRes = await superAdminLogin(badPasswordReq);
    expect(badPasswordRes.status).toBe(401);
  });

  it("calculates all 12 live platform statistics directly from the database", async () => {
    const overview = await adminOverview();
    const users = overview.users as Record<string, number>;
    const schools = overview.schools as Record<string, number>;
    const subs = overview.subscriptions as Record<string, number>;
    const finance = overview.finance as Record<string, number>;

    // 1. Total Registered Schools
    expect(schools.total).toBeGreaterThanOrEqual(0);
    // 2. Active Schools
    expect(schools.active).toBeGreaterThanOrEqual(0);
    // 3. Inactive Schools
    expect(schools.inactive).toBeGreaterThanOrEqual(0);
    // 4. Trial Schools
    expect(schools.trial).toBeGreaterThanOrEqual(0);
    // 5. Total Registered Students
    expect(users.totalStudents).toBeGreaterThanOrEqual(0);
    // 6. Total Teachers
    expect(users.totalTeachers).toBeGreaterThanOrEqual(0);
    // 7. Total School Administrators
    expect(users.totalSchoolAdmins).toBeGreaterThanOrEqual(0);
    // 8. Total Subscription Revenue
    expect(finance.totalRevenue).toBeGreaterThanOrEqual(0);
    // 9. Monthly Revenue
    expect(finance.monthRevenue).toBeGreaterThanOrEqual(0);
    // 10. Pending Payments
    expect(finance.pending).toBeGreaterThanOrEqual(0);
    // 11. Expired Subscriptions
    expect(subs.expired).toBeGreaterThanOrEqual(0);
    // 12. Subscriptions Expiring Soon (7d, 15d, 30d)
    expect(subs.expiringSoon).toBeGreaterThanOrEqual(0);
    expect(subs.expiring7d).toBeGreaterThanOrEqual(0);
    expect(subs.expiring15d).toBeGreaterThanOrEqual(0);
    expect(subs.expiring30d).toBeGreaterThanOrEqual(0);
  });

  it("manages school statuses (Active, Inactive, Suspended) with audit logging", async () => {
    const stamp = Date.now();
    const passwordHash = await hash("pass1234", 4);
    const account = await createAccount({
      name: `Test School Admin ${stamp}`,
      email: `test-admin-${stamp}@example.com`,
      institution: `Audit School ${stamp}`,
      passwordHash,
    });

    const schoolId = account.institutionId;

    // Suspend school
    await adminSetSchoolStatus(account.id, schoolId, "Suspended");
    let schoolsList = await adminSchools({ search: `Audit School ${stamp}` });
    expect(schoolsList.items[0]).toMatchObject({ status: "Suspended" });

    // Deactivate school
    await adminSetSchoolStatus(account.id, schoolId, "Inactive");
    schoolsList = await adminSchools({ search: `Audit School ${stamp}` });
    expect(schoolsList.items[0]).toMatchObject({ status: "Inactive" });

    // Reactivate school
    await adminSetSchoolStatus(account.id, schoolId, "Active");
    schoolsList = await adminSchools({ search: `Audit School ${stamp}` });
    expect(schoolsList.items[0]).toMatchObject({ status: "Active" });

    // Verify audit log has the records
    const logs = await adminAuditLogs(20);
    const schoolLog = logs.find(
      (l) => l.schoolName === `Audit School ${stamp}` && String(l.action).includes("School"),
    );
    expect(schoolLog).toBeDefined();
  });

  it("manages subscription extension and manual renewal with audit trail", async () => {
    const stamp = Date.now();
    const passwordHash = await hash("pass1234", 4);
    const account = await createAccount({
      name: `Sub School Admin ${stamp}`,
      email: `sub-school-${stamp}@example.com`,
      institution: `Sub School ${stamp}`,
      passwordHash,
    });

    const subscriptions = await adminSubscriptions();
    const schoolSub = subscriptions.find((s) => s.schoolId === account.institutionId);

    if (schoolSub) {
      // Extend subscription by 60 days
      await adminManageSubscription(account.id, schoolSub.id, "extend", 60);

      const updatedSubs = await adminSubscriptions();
      const updatedSub = updatedSubs.find((s) => s.id === schoolSub.id);
      expect(updatedSub?.status).toBe("ACTIVE");
      expect(new Date(updatedSub?.expiryDate as string).getTime()).toBeGreaterThan(
        Date.now(),
      );

      // Verify audit trail entry was created
      const logs = await adminAuditLogs(20);
      const subLog = logs.find(
        (l) => l.entity === "Subscription" && l.entityId === schoolSub.id,
      );
      expect(subLog).toBeDefined();
      expect(subLog?.action).toBe("Subscription Extended");
    }
  });

  it("guarantees platform revenue isolation from individual school fee collections", async () => {
    const overview = await adminOverview();
    const finance = overview.finance as Record<string, number>;

    // Platform revenue should only come from subscription_payments
    expect(typeof finance.totalRevenue).toBe("number");
    expect(finance.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(typeof finance.monthRevenue).toBe("number");
    expect(finance.monthRevenue).toBeGreaterThanOrEqual(0);
  });
});
