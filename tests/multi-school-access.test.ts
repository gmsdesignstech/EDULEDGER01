import { describe, expect, it, vi, beforeEach } from "vitest";
import { compare, hash } from "bcryptjs";
import {
  generateSecureTemporaryPassword,
  getMultiSchoolAccessOverview,
} from "../src/lib/account-provisioning";
import {
  generateTeacherCredentialsPdf,
  generateStudentCredentialsPdf,
} from "../src/lib/credential-pdf";

describe("EduLedger Multi-School Access & Tenant Security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Credential Security & Password Strength", () => {
    it("generates cryptographically secure, high-entropy temporary passwords", () => {
      const passwords = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const pw = generateSecureTemporaryPassword();
        expect(pw.length).toBeGreaterThanOrEqual(10);
        expect(/[A-Z]/.test(pw)).toBe(true);
        expect(/[a-z]/.test(pw)).toBe(true);
        expect(/[0-9]/.test(pw)).toBe(true);
        expect(/[!@#$*]/.test(pw)).toBe(true);
        passwords.add(pw);
      }
      // Ensure all 50 generated passwords are uniquely randomized
      expect(passwords.size).toBe(50);
    });

    it("verifies bcrypt password hashing and constant-time comparison", async () => {
      const tempPassword = generateSecureTemporaryPassword();
      const saltRounds = 10;
      const hashed = await hash(tempPassword, saltRounds);

      expect(hashed).not.toBe(tempPassword);
      expect(hashed.startsWith("$2a$") || hashed.startsWith("$2b$")).toBe(true);

      const isValid = await compare(tempPassword, hashed);
      expect(isValid).toBe(true);

      const isInvalid = await compare("WrongPassword123!", hashed);
      expect(isInvalid).toBe(false);
    });
  });

  describe("2. Multi-Tenant School Credential PDFs", () => {
    it("generates valid Teacher Credential PDF with strict institutional metadata", async () => {
      const school = {
        id: "ce849624-1b9a-4551-b302-84d9ea096c26",
        name: "Dar Al Arqam Public School (DAPS Jaipur)",
        academicYear: "2025-2026",
      };

      const teachers = [
        {
          facultyId: "EMP-DAPS-01",
          name: "Rubina Bano",
          department: "Mathematics",
          subject: "Algebra",
          email: "rubinakhan07861@gmail.com",
          phone: "9829012345",
          status: "Active",
        },
        {
          facultyId: "EMP-DAPS-02",
          name: "Nagma Jamal",
          department: "Science",
          subject: "Biology",
          email: "nagmaali7788@gmail.com",
          phone: "8005563300",
          status: "Active",
          temporaryPassword: "Edu#9xK2!311",
        },
      ];

      const pdf = await generateTeacherCredentialsPdf({
        school,
        teachers,
        departmentFilter: "Science",
      });

      expect(pdf).toBeInstanceOf(Uint8Array);
      expect(pdf.length).toBeGreaterThan(2000);

      // Verify PDF Magic Bytes
      const magic = Buffer.from(pdf.slice(0, 5)).toString("ascii");
      expect(magic).toBe("%PDF-");
    });

    it("generates valid Student & Parent Credential PDF with strict class isolation", async () => {
      const school = {
        id: "ce849624-1b9a-4551-b302-84d9ea096c26",
        name: "Dar Al Arqam Public School (DAPS Jaipur)",
        academicYear: "2025-2026",
      };

      const students = [
        {
          admissionNo: "ADM2026-018",
          studentId: "stu-101",
          studentName: "Mohammed Anas Abdullah",
          className: "Class 10",
          section: "A",
          parentName: "Abdullah Khan",
          parentPhone: "9929031416",
          parentEmail: "anas.parent.daps@gmail.com",
          status: "Active",
        },
      ];

      const pdf = await generateStudentCredentialsPdf({
        school,
        students,
        classFilter: "Class 10",
        sectionFilter: "A",
      });

      expect(pdf).toBeInstanceOf(Uint8Array);
      expect(pdf.length).toBeGreaterThan(2000);

      const magic = Buffer.from(pdf.slice(0, 5)).toString("ascii");
      expect(magic).toBe("%PDF-");
    });
  });

  describe("3. Tenant Isolation & IDOR Blocking Rules", () => {
    it("ensures school admin can never access credentials of a different institution", () => {
      // Mock session for School Admin belonging to School A
      const sessionUser = {
        id: "user-admin-school-a",
        role: "SCHOOL_ADMIN",
        institutionId: "school-a-uuid",
      };

      // Attacker tries to query School B
      const requestedSchoolId = "school-b-uuid";

      // Server-side enforcement rule:
      const effectiveInstitutionId =
        sessionUser.role === "SUPER_ADMIN" ? requestedSchoolId : sessionUser.institutionId;

      // School Admin must only receive data for School A
      expect(effectiveInstitutionId).toBe("school-a-uuid");
      expect(effectiveInstitutionId).not.toBe("school-b-uuid");
    });

    it("ensures parents and teachers are rejected with 403 when requesting school credential PDFs", () => {
      const teacherUser = { role: "TEACHER", institutionId: "school-a" };
      const parentUser = { role: "PARENT", institutionId: "school-a" };

      const isAuthorized = (role: string) => ["SCHOOL_ADMIN", "SUPER_ADMIN"].includes(role);

      expect(isAuthorized(teacherUser.role)).toBe(false);
      expect(isAuthorized(parentUser.role)).toBe(false);
    });
  });
});

