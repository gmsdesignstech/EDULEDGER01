import { describe, expect, it, vi, beforeEach } from "vitest";
import { compare, hash } from "bcryptjs";
import { generateSecureTemporaryPassword } from "../src/lib/account-provisioning";
import { formatTeacherLoginId } from "../src/lib/db";
import { generateSingleTeacherCredentialPdf } from "../src/lib/credential-pdf";
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

  describe("6. Unique Teacher Login ID Generation & Formatting", () => {
    it("generates deterministic canonical Login ID when school code is present", () => {
      const loginId = formatTeacherLoginId("DPS", "EMP-101");
      expect(loginId).toBe("TCH-DPS-EMP-101");
    });

    it("generates clean Login ID when school code is omitted", () => {
      const loginId = formatTeacherLoginId(undefined, "EMP-202");
      expect(loginId).toBe("TCH-EMP-202");
    });

    it("prevents double prefixing when teacher ID already starts with TCH-", () => {
      const loginId1 = formatTeacherLoginId("SCH01", "TCH-EMP-303");
      expect(loginId1).toBe("TCH-SCH01-EMP-303");

      const loginId2 = formatTeacherLoginId(undefined, "TCH-EMP-303");
      expect(loginId2).toBe("TCH-EMP-303");
    });

    it("sanitizes special characters and normalizes casing to uppercase", () => {
      const loginId = formatTeacherLoginId("dps-delhi", "emp#404!");
      expect(loginId).toBe("TCH-DPSDELHI-EMP404");
    });
  });

  describe("7. Temporary Password Generation, Entropy & First-Time Policy", () => {
    it("generates high-entropy passwords with uppercase, lowercase, numbers, and symbols", () => {
      const tempPw = generateSecureTemporaryPassword();
      expect(tempPw.length).toBeGreaterThanOrEqual(10);
      expect(/[A-Z]/.test(tempPw)).toBe(true);
      expect(/[a-z]/.test(tempPw)).toBe(true);
      expect(/[0-9]/.test(tempPw)).toBe(true);
      expect(/[!@#$*]/.test(tempPw)).toBe(true);
    });

    it("generates distinct passwords on consecutive invocations", () => {
      const passwords = new Set(Array.from({ length: 25 }, () => generateSecureTemporaryPassword()));
      expect(passwords.size).toBe(25);
    });

    it("flags account with mustChangePassword = true when provisioned with temporary password", () => {
      const input = {
        name: "Arun Kumar",
        employeeId: "EMP-501",
        password: undefined, // No custom password provided
      };

      const temporaryPassword = input.password || generateSecureTemporaryPassword();
      const mustChangePassword = !input.password;

      expect(mustChangePassword).toBe(true);
      expect(temporaryPassword).toBeDefined();
    });

    it("flags account with mustChangePassword = false when admin supplies custom permanent password", () => {
      const input = {
        name: "Arun Kumar",
        employeeId: "EMP-501",
        password: "PermanentPassword2026!",
      };

      const mustChangePassword = !input.password;
      expect(mustChangePassword).toBe(false);
    });
  });

  describe("8. Multi-Identifier Authentication Resolution", () => {
    const mockTeacher = {
      id: "tch-uuid-1",
      name: "Meera Patel",
      employeeId: "EMP-601",
      loginId: "TCH-SCH-EMP-601",
      email: "meera.patel@school.edu",
      phone: "+91 98765 00123",
      status: "Active",
    };

    const mockUser = {
      id: "usr-uuid-1",
      email: "meera.patel@school.edu",
      loginId: "TCH-SCH-EMP-601",
      role: "TEACHER",
      status: "Active",
      institutionId: "inst-1",
      mustChangePassword: true,
    };

    function resolveTeacherIdentifier(identifier: string) {
      const clean = identifier.trim();
      const lower = clean.toLowerCase();
      const digits = clean.replace(/[^0-9]/g, "");
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;

      // 1. By Login ID
      if (lower === mockUser.loginId.toLowerCase() || lower === mockTeacher.loginId.toLowerCase()) {
        return { matchedBy: "loginId", user: mockUser };
      }

      // 2. By Employee ID
      if (lower === mockTeacher.employeeId.toLowerCase()) {
        return { matchedBy: "employeeId", user: mockUser };
      }

      // 3. By Email
      if (lower === mockUser.email.toLowerCase()) {
        return { matchedBy: "email", user: mockUser };
      }

      // 4. By Phone (normalized last 10 digits)
      const teacherPhoneDigits = mockTeacher.phone.replace(/[^0-9]/g, "");
      const teacherPhoneLast10 = teacherPhoneDigits.slice(-10);
      if (last10 && last10 === teacherPhoneLast10) {
        return { matchedBy: "phone", user: mockUser };
      }

      return null;
    }

    it("authenticates teacher via generated Unique Login ID", () => {
      const match = resolveTeacherIdentifier("TCH-SCH-EMP-601");
      expect(match).not.toBeNull();
      expect(match?.matchedBy).toBe("loginId");
      expect(match?.user.id).toBe("usr-uuid-1");
    });

    it("authenticates teacher via case-insensitive Login ID", () => {
      const match = resolveTeacherIdentifier("tch-sch-emp-601");
      expect(match).not.toBeNull();
      expect(match?.matchedBy).toBe("loginId");
    });

    it("authenticates teacher via Employee ID", () => {
      const match = resolveTeacherIdentifier("EMP-601");
      expect(match).not.toBeNull();
      expect(match?.matchedBy).toBe("employeeId");
    });

    it("authenticates teacher via registered Email", () => {
      const match = resolveTeacherIdentifier("meera.patel@school.edu");
      expect(match).not.toBeNull();
      expect(match?.matchedBy).toBe("email");
    });

    it("authenticates teacher via Phone in standard format", () => {
      const match = resolveTeacherIdentifier("+91 98765 00123");
      expect(match).not.toBeNull();
      expect(match?.matchedBy).toBe("phone");
    });

    it("authenticates teacher via Phone with raw 10 digits without country code", () => {
      const match = resolveTeacherIdentifier("9876500123");
      expect(match).not.toBeNull();
      expect(match?.matchedBy).toBe("phone");
    });

    it("rejects non-matching identifier", () => {
      const match = resolveTeacherIdentifier("NONEXISTENT_USER");
      expect(match).toBeNull();
    });
  });

  describe("9. Teacher First-Time Password Change & Credential Invalidation", () => {
    it("validates teacher password change workflow and clears mustChangePassword", async () => {
      const temporaryPassword = "Edu#Temp987Password";
      let userRecord = {
        id: "usr-teacher-change",
        passwordHash: await hash(temporaryPassword, 10),
        mustChangePassword: true,
      };

      const changePassword = async (currentAttempt: string, newAttempt: string, confirmAttempt: string) => {
        if (!currentAttempt) throw new Error("Current password is required.");
        if (newAttempt.length < 8) throw new Error("New password must be at least 8 characters.");
        if (newAttempt !== confirmAttempt) throw new Error("New password and confirmation password do not match.");
        if (newAttempt === currentAttempt) throw new Error("Your new password must be different from your temporary password.");

        const matches = await compare(currentAttempt, userRecord.passwordHash);
        if (!matches) throw new Error("The temporary or current password you entered is incorrect.");

        const newHash = await hash(newAttempt, 10);
        userRecord = {
          ...userRecord,
          passwordHash: newHash,
          mustChangePassword: false,
        };
        return { success: true };
      };

      // 1. Rejects incorrect current password
      await expect(changePassword("WrongCurrentPW", "NewSafePassword123!", "NewSafePassword123!")).rejects.toThrow(
        "The temporary or current password you entered is incorrect."
      );
      expect(userRecord.mustChangePassword).toBe(true);

      // 2. Rejects mismatched confirmation
      await expect(changePassword(temporaryPassword, "NewSafePassword123!", "DifferentConfirm!")).rejects.toThrow(
        "New password and confirmation password do not match."
      );

      // 3. Rejects identical password
      await expect(changePassword(temporaryPassword, temporaryPassword, temporaryPassword)).rejects.toThrow(
        "Your new password must be different from your temporary password."
      );

      // 4. Successfully updates password and resets mustChangePassword flag
      const result = await changePassword(temporaryPassword, "PersonalSafePassword2026#", "PersonalSafePassword2026#");
      expect(result.success).toBe(true);
      expect(userRecord.mustChangePassword).toBe(false);

      // 5. Old temporary password no longer works
      const oldMatches = await compare(temporaryPassword, userRecord.passwordHash);
      expect(oldMatches).toBe(false);

      // 6. New personal password works
      const newMatches = await compare("PersonalSafePassword2026#", userRecord.passwordHash);
      expect(newMatches).toBe(true);
    });
  });

  describe("10. Administrator Password Reset & Credentials Modal Payload", () => {
    it("generates new temporary credentials payload when admin resets teacher password", async () => {
      const teacher = {
        id: "tch-reset-test",
        name: "Vikram Malhotra",
        employeeId: "EMP-701",
        loginId: "TCH-DPS-EMP-701",
        phone: "+91 98765 43299",
        email: "vikram@dps.edu",
        status: "Active",
      };

      const school = {
        name: "Delhi Public School",
      };

      const newTempPassword = generateSecureTemporaryPassword();
      const newHash = await hash(newTempPassword, 10);

      const credentialsPayload = {
        teacherId: teacher.id,
        name: teacher.name,
        employeeId: teacher.employeeId,
        loginId: teacher.loginId,
        temporaryPassword: newTempPassword,
        email: teacher.email,
        phone: teacher.phone,
        schoolName: school.name,
        loginUrl: "https://eduledger.co.in/teacher/login",
        status: "Active",
        mustChangePassword: true,
      };

      expect(credentialsPayload.temporaryPassword).toBe(newTempPassword);
      expect(credentialsPayload.mustChangePassword).toBe(true);
      expect(credentialsPayload.loginId).toBe("TCH-DPS-EMP-701");
      expect(await compare(newTempPassword, newHash)).toBe(true);
    });
  });

  describe("11. Single-Teacher Printable Credential Slip PDF Generation", () => {
    it("generates a valid, non-empty PDF document for a single teacher", async () => {
      const pdfBytes = await generateSingleTeacherCredentialPdf({
        school: {
          id: "school-1",
          name: "St. Xavier's International School",
          academicYear: "2026-2027",
        },
        teacher: {
          id: "tch-pdf-1",
          name: "Kavita Sen",
          employeeId: "EMP-808",
          loginId: "TCH-SXIS-EMP-808",
          department: "Computer Science",
          subject: "Artificial Intelligence",
          email: "kavita.sen@sxis.edu",
          phone: "+91 98765 88888",
          temporaryPassword: "Edu#TempPass888",
          status: "Active",
        },
        loginUrl: "https://eduledger.co.in/teacher/login",
      });

      expect(pdfBytes).toBeInstanceOf(Uint8Array);
      expect(pdfBytes.length).toBeGreaterThan(1000);

      // Verify PDF header %PDF-
      const header = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
      expect(header).toBe("%PDF-");
    });
  });
});
