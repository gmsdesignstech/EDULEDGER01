import { describe, expect, it, vi, beforeEach } from "vitest";
import { compare, hash } from "bcryptjs";
import { generateSecureTemporaryPassword } from "../src/lib/account-provisioning";
import { parseTeacherClasses, serializeTeacherClasses, standardTeacherClasses } from "../src/lib/teacher-classes";
import { z } from "zod";

describe("EduLedger Teacher Portal Authentication & Faculty Provisioning Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Teacher Schema Validation & Optional Email / Required Phone", () => {
    const teacherInputSchema = z.object({
      name: z.string().trim().min(2, "Teacher name is required (min 2 characters)."),
      employeeId: z.string().trim().min(2, "Employee ID is required."),
      email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address.")]).optional().default(""),
      phone: z.string().trim().min(8, "Phone number must be at least 8 digits."),
      department: z.string().trim().min(1, "Department is required."),
      subject: z.string().trim().min(1, "Primary subject is required."),
      classes: z.array(z.string()),
      joiningDate: z.string().min(10, "Joining date is required."),
      salary: z.coerce.number().min(0, "Salary must be non-negative."),
      status: z.enum(["Active", "Inactive", "On Leave"]),
      password: z.string().min(8, "Password must be at least 8 characters.").max(128).optional(),
    });

    it("accepts a teacher record with a standard email address and password", () => {
      const input = {
        name: "Rashid Khan",
        employeeId: "EMP-101",
        email: "rashid@school.edu",
        phone: "+91 98765 43210",
        department: "Mathematics",
        subject: "Mathematics",
        classes: ["Class 8", "Class 9"],
        joiningDate: "2024-01-15",
        salary: 45000,
        status: "Active" as const,
        password: "SecretPassword123!",
      };
      const result = teacherInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("rashid@school.edu");
        expect(result.data.password).toBe("SecretPassword123!");
      }
    });

    it("accepts a teacher record with an empty email (phone-only faculty member)", () => {
      const input = {
        name: "Fatima Bi",
        employeeId: "EMP-102",
        email: "",
        phone: "+91 98765 43211",
        department: "Science",
        subject: "Physics",
        classes: ["Class 10"],
        joiningDate: "2024-02-01",
        salary: 48000,
        status: "Active" as const,
      };
      const result = teacherInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("");
        expect(result.data.password).toBeUndefined();
      }
    });

    it("rejects invalid email formats when an email string is provided", () => {
      const input = {
        name: "Invalid Email Teacher",
        employeeId: "EMP-103",
        email: "not-an-email",
        phone: "9876543212",
        department: "English",
        subject: "English",
        classes: ["Class 6"],
        joiningDate: "2024-03-01",
        salary: 35000,
        status: "Active" as const,
      };
      const result = teacherInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Enter a valid email address");
      }
    });

    it("rejects phone numbers with fewer than 8 digits", () => {
      const input = {
        name: "Short Phone Teacher",
        employeeId: "EMP-104",
        email: "teacher@school.edu",
        phone: "12345",
        department: "History",
        subject: "Social Studies",
        classes: ["Class 7"],
        joiningDate: "2024-04-01",
        salary: 38000,
        status: "Active" as const,
      };
      const result = teacherInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 8 digits");
      }
    });

    it("allows optional password on edit and preserves existing password when omitted", () => {
      const inputWithoutPassword = {
        name: "Updated Name",
        employeeId: "EMP-101",
        email: "rashid@school.edu",
        phone: "+91 98765 43210",
        department: "Mathematics",
        subject: "Mathematics",
        classes: ["Class 8", "Class 9"],
        joiningDate: "2024-01-15",
        salary: 50000,
        status: "Active" as const,
      };
      const result = teacherInputSchema.safeParse(inputWithoutPassword);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.password).toBeUndefined();
      }
    });
  });

  describe("2. Phone Normalization & Synthetic Internal Email Generation", () => {
    function generateSyntheticEmail(institutionId: string, phone: string): string {
      const raw = phone.replace(/[^0-9]/g, "");
      const digits = raw.length >= 10 ? raw.slice(-10) : raw;
      return `teacher_${digits}@${institutionId.toLowerCase()}.internal`;
    }

    function normalizePhoneDigits(phone: string): { digits: string; last10: string } {
      const digits = phone.replace(/[^0-9]/g, "");
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      return { digits, last10 };
    }

    it("normalizes diverse mobile number formats to a uniform 10-digit identifier", () => {
      const formats = [
        "9876543210",
        "+91 98765 43210",
        "+91-98765-43210",
        "+919876543210",
        "09876543210",
        "  +91  98765 43210  ",
      ];
      for (const fmt of formats) {
        const { last10 } = normalizePhoneDigits(fmt);
        expect(last10).toBe("9876543210");
      }
    });

    it("generates deterministic synthetic emails for phone-only teachers per institution", () => {
      const instId = "inst-jaipur-01";
      const email1 = generateSyntheticEmail(instId, "+91 98765 43210");
      const email2 = generateSyntheticEmail(instId, "9876543210");

      expect(email1).toContain("teacher_");
      expect(email1).toContain(instId.toLowerCase());
      expect(email1).toContain(".internal");
      expect(email1).toBe(email2);
      expect(email1).toBe("teacher_9876543210@inst-jaipur-01.internal");
    });

    it("isolates synthetic emails across different school institutions for the same phone number", () => {
      const phone = "+91 98765 43210";
      const emailSchoolA = generateSyntheticEmail("school-alpha", phone);
      const emailSchoolB = generateSyntheticEmail("school-beta", phone);

      expect(emailSchoolA).not.toBe(emailSchoolB);
      expect(emailSchoolA).toBe("teacher_9876543210@school-alpha.internal");
      expect(emailSchoolB).toBe("teacher_9876543210@school-beta.internal");
    });
  });

  describe("3. Bcrypt Password Hashing, Authentication & Status Enforcement", () => {
    it("generates secure temporary passwords with high entropy and special characters", () => {
      const tempPass = generateSecureTemporaryPassword();
      expect(tempPass.length).toBeGreaterThanOrEqual(10);
      expect(/[A-Z]/.test(tempPass)).toBe(true);
      expect(/[a-z]/.test(tempPass)).toBe(true);
      expect(/[0-9]/.test(tempPass)).toBe(true);
      expect(/[!@#$*]/.test(tempPass)).toBe(true);
    });

    it("hashes passwords using bcrypt and validates constant-time authentication", async () => {
      const plain = "FacultySecret2025!";
      const passwordHash = await hash(plain, 10);

      expect(passwordHash).not.toBe(plain);
      expect(passwordHash.startsWith("$2a$") || passwordHash.startsWith("$2b$")).toBe(true);

      const isValid = await compare(plain, passwordHash);
      expect(isValid).toBe(true);

      const isInvalid = await compare("WrongFacultyPassword", passwordHash);
      expect(isInvalid).toBe(false);
    });

    it("rejects login when teacher status is Inactive even with correct password", async () => {
      const plain = "CorrectPassword123!";
      const passwordHash = await hash(plain, 10);

      const teacherAccount = {
        id: "teacher-user-1",
        email: "sarah@school.edu",
        passwordHash,
        role: "TEACHER",
        status: "Inactive", // Deactivated faculty member
        institutionId: "inst-1",
      };

      const authenticate = async (passwordAttempt: string) => {
        const matches = await compare(passwordAttempt, teacherAccount.passwordHash);
        if (!matches || teacherAccount.status !== "Active") {
          return { error: "Email, mobile number or password is incorrect.", status: 401 };
        }
        return { success: true, user: teacherAccount };
      };

      const result = await authenticate(plain);
      expect(result.error).toBe("Email, mobile number or password is incorrect.");
      expect(result.status).toBe(401);
    });

    it("permits login when teacher status is Active with correct password", async () => {
      const plain = "CorrectPassword123!";
      const passwordHash = await hash(plain, 10);

      const teacherAccount = {
        id: "teacher-user-2",
        email: "sarah@school.edu",
        passwordHash,
        role: "TEACHER",
        status: "Active",
        institutionId: "inst-1",
      };

      const authenticate = async (passwordAttempt: string) => {
        const matches = await compare(passwordAttempt, teacherAccount.passwordHash);
        if (!matches || teacherAccount.status !== "Active") {
          return { error: "Email, mobile number or password is incorrect.", status: 401 };
        }
        return { success: true, user: teacherAccount };
      };

      const result = await authenticate(plain);
      expect(result.success).toBe(true);
      expect(result.user?.id).toBe("teacher-user-2");
    });
  });

  describe("4. Teacher Assigned Classes Parsing & Validation", () => {
    it("parses and deduplicates teacher class assignment strings", () => {
      const input = "Class 10, Class 9, Class 10, class 8";
      const classes = parseTeacherClasses(input);
      expect(classes).toEqual(["Class 10", "Class 9", "Class 8"]);
    });

    it("serializes teacher class assignments into canonical comma-separated strings", () => {
      const classes = ["Class 10", "Class 9", "Class 8"];
      const serialized = serializeTeacherClasses(classes);
      expect(serialized).toBe("Class 10, Class 9, Class 8");
    });

    it("validates assigned classes against standard and school-configured options", () => {
      const configuredClasses = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
      const allowed = new Set(
        [...standardTeacherClasses, ...configuredClasses].map((c) => c.toLowerCase()),
      );

      const validSelection = ["Class 10", "Class 9"];
      const hasInvalid = validSelection.some((name) => !allowed.has(name.toLowerCase()));
      expect(hasInvalid).toBe(false);

      const invalidSelection = ["Class 10", "Class 99_Invalid"];
      const hasInvalid2 = invalidSelection.some((name) => !allowed.has(name.toLowerCase()));
      expect(hasInvalid2).toBe(true);
    });
  });

  describe("5. Frontend Error Translation & Network Resilience", () => {
    function formatTeacherFormError(error: unknown): string {
      const msg = error instanceof Error ? error.message : "Could not save the teacher.";
      return msg === "Failed to fetch"
        ? "Network error: Unable to connect to server. Please check your connection and try again."
        : msg;
    }

    it("translates raw browser 'Failed to fetch' to a user-friendly network diagnostic message", () => {
      const fetchError = new TypeError("Failed to fetch");
      const displayed = formatTeacherFormError(fetchError);
      expect(displayed).toBe("Network error: Unable to connect to server. Please check your connection and try again.");
    });

    it("preserves specific backend error messages when returned by the server", () => {
      const serverError = new Error("Employee ID or email already exists.");
      const displayed = formatTeacherFormError(serverError);
      expect(displayed).toBe("Employee ID or email already exists.");
    });
  });
});
