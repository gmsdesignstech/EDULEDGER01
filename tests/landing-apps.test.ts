import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { generateQrMatrix } from "../src/lib/qr-code";
import { GET as parentManifestHandler } from "../src/app/manifest-parent.webmanifest/route";
import { GET as teacherManifestHandler } from "../src/app/manifest-teacher.webmanifest/route";

describe("Landing Page Application Cards & PWA Ecosystem", () => {
  it("generates valid QR code matrices for Parent and Teacher application URLs", () => {
    const parentMatrix = generateQrMatrix("https://eduledger.co.in/parent");
    expect(parentMatrix.length).toBeGreaterThanOrEqual(25);
    expect(parentMatrix.length).toBe(parentMatrix[0].length);

    // Verify top-left finder pattern center is black (true)
    expect(parentMatrix[3][3]).toBe(true);

    const teacherMatrix = generateQrMatrix("https://eduledger.co.in/teacher");
    expect(teacherMatrix.length).toBeGreaterThanOrEqual(25);
    expect(teacherMatrix.length).toBe(teacherMatrix[0].length);
    expect(teacherMatrix[3][3]).toBe(true);
  });

  it("verifies landing page includes the App Download section with required headings, cards and CTAs", () => {
    const componentPath = path.join(process.cwd(), "src", "components", "app-download-section.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
    const content = fs.readFileSync(componentPath, "utf-8");

    // Section Heading & Subtitle
    expect(content).toContain("Everything Your School Needs.");
    expect(content).toContain("Everyone Connected.");
    expect(content).toContain(
      "Stay connected with your school from anywhere. Download the EduLedger Parent and Teacher Apps for a smarter school experience."
    );

    // Card 1: Parent App
    expect(content).toContain("EduLedger Parent App");
    expect(content).toContain("Parent numbers come from the school&apos;s existing student profiles.");
    expect(content).toContain(
      "Stay updated with your child’s academic progress, attendance, homework, examination results, fee payments and important school announcements."
    );
    expect(content).toContain("Track your child’s attendance.");
    expect(content).toContain("View examination results.");
    expect(content).toContain("Check homework and assignments.");
    expect(content).toContain("View fee details and payment history.");
    expect(content).toContain("Receive school announcements.");
    expect(content).toContain("Access your child’s timetable.");
    expect(content).toContain("View academic reports.");
    expect(content).toContain("Install Parent App");

    // Card 2: Teacher App
    expect(content).toContain("EduLedger Teacher App");
    expect(content).toContain(
      "Manage your classes, mark attendance, share assignments, update examination marks and stay connected with your school."
    );
    expect(content).toContain("Manage assigned classes.");
    expect(content).toContain("Mark student attendance.");
    expect(content).toContain("Upload assignments and study materials.");
    expect(content).toContain("Enter examination marks.");
    expect(content).toContain("Access class timetables.");
    expect(content).toContain("View student academic performance.");
    expect(content).toContain("Receive school notifications.");
    expect(content).toContain("Install Teacher App");
  });

  it("verifies landing-page.tsx integrates AppDownloadSection without altering other sections", () => {
    const pagePath = path.join(process.cwd(), "src", "components", "landing-page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("AppDownloadSection");
    expect(content).toContain("<AppDownloadSection />");
    expect(content).toContain("<PublicFooter />");
  });

  it("supports parent authentication lookup by registered mobile phone number from student profiles", async () => {
    const {
      activateParentAccount,
      addStudent,
      createAccount,
      createParentInvitation,
      findUserByEmailOrPhone,
      getCompleteSettings,
      getInstitution,
      saveCompleteSettings,
    } = await import("../src/lib/db");
    const { hash } = await import("bcryptjs");
    const { configureSchoolCode } = await import("./configure-school-code");

    const stamp = `${Date.now()}_phone`;
    const admin = await createAccount({
      name: "School Head",
      email: `admin_${stamp}@school.test`,
      institution: `School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });

    await configureSchoolCode(admin.institutionId, admin.id);
    const inst = await getInstitution(admin.institutionId);
    const current = await getCompleteSettings(admin.institutionId);
    await saveCompleteSettings(admin.institutionId, admin.id, {
      ...current,
      startMonth: 4,
      endMonth: 3,
      academicYears: current.years.map((y) => ({
        name: y.name,
        startMonth: y.startMonth,
        endMonth: y.endMonth,
        status: y.status,
      })),
      classes: [{ name: "Class 6", sections: ["A"] }],
    });

    // Student profile has parent phone
    const student = await addStudent(
      admin.institutionId,
      {
        name: "Dev Patel",
        admission: `ADM-${stamp}`,
        gender: "Male",
        dateOfBirth: "2013-08-10",
        className: "Class 6",
        section: "A",
        rollNumber: "15",
        parent: "Kiran Patel",
        parentPhone: "9876543210",
        parentEmail: `kiran_${stamp}@parent.test`,
        address: "45 Ocean Road",
        admissionDate: "2024-04-01",
        totalFee: 30000,
        dueDate: "2025-03-31",
        academicYear: inst.academicYear,
      },
      admin.id,
    );

    // Parent activates account
    const invitation = await createParentInvitation(admin.institutionId, admin.id, {
      studentId: student.id,
      parentName: "Kiran Patel",
      parentEmail: `kiran_${stamp}@parent.test`,
      parentPhone: "9876543210",
    });

    const parentUser = await activateParentAccount(admin.institutionId, {
      invitationCode: invitation.code,
      name: "Kiran Patel",
      email: `kiran_${stamp}@parent.test`,
      passwordHash: await hash("parentPass123", 4),
    });

    // 1. Lookup by parent email
    const byEmail = await findUserByEmailOrPhone(`kiran_${stamp}@parent.test`);
    expect(byEmail).toBeDefined();
    expect(byEmail?.id).toBe(parentUser.userId);
    expect(byEmail?.role).toBe("PARENT");

    // 2. Lookup by parent phone number coming from the student profile
    const byPhone = await findUserByEmailOrPhone("9876543210");
    expect(byPhone).toBeDefined();
    expect(byPhone?.id).toBe(parentUser.userId);
    expect(byPhone?.role).toBe("PARENT");

    // 3. Lookup with country code prefix (+91 9876543210)
    const byFormattedPhone = await findUserByEmailOrPhone("+91 9876543210");
    expect(byFormattedPhone).toBeDefined();
    expect(byFormattedPhone?.id).toBe(parentUser.userId);
  });
});

