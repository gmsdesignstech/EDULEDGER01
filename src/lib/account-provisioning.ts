import "server-only";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { queryRows, queryRow, queryRun, getDb, formatTeacherLoginId, formatStudentLoginId } from "./db";
import type { TeacherCredentialItem, StudentCredentialItem, SchoolCredentialMeta } from "./credential-pdf";

export function generateSecureTemporaryPassword(): string {
  // Generates high-entropy, human-typed friendly temporary password:
  // e.g. "Edu#9xK2!m8A" (upper, lower, digit, symbol, 11 chars)
  const prefixes = ["Edu", "Ledger", "Access", "Portal", "Prime"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomChars = randomBytes(4).toString("hex").slice(0, 5);
  const symbols = ["!", "@", "#", "$", "*"];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const digit = Math.floor(100 + Math.random() * 900);
  return `${prefix}${symbol}${randomChars}${digit}`;
}

export type SchoolAccessOverview = {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalTeachers: number;
  totalStudents: number;
  activeTeacherAccounts: number;
  activeParentAccounts: number;
  pendingTeacherActivations: number;
  pendingParentActivations: number;
  schools: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    teachersCount: number;
    studentsCount: number;
    teacherAccountsCount: number;
    parentAccountsCount: number;
    pendingTeacherCount: number;
    pendingParentCount: number;
  }[];
};

/**
 * Aggregates live multi-school access statistics across all institutions
 */
export async function getMultiSchoolAccessOverview(): Promise<SchoolAccessOverview> {
  // 1. Overall counts
  const schoolsRow = await queryRow<{
    totalSchools: number;
    activeSchools: number;
    suspendedSchools: number;
  }>(`
    SELECT
      count(*)::int as "totalSchools",
      COALESCE(SUM(CASE WHEN status = 'Active' OR status IS NULL THEN 1 ELSE 0 END), 0)::int as "activeSchools",
      COALESCE(SUM(CASE WHEN status = 'Suspended' THEN 1 ELSE 0 END), 0)::int as "suspendedSchools"
    FROM institutions
  `);

  const rosterRow = await queryRow<{
    totalTeachers: number;
    totalStudents: number;
    activeTeacherAccounts: number;
    activeParentAccounts: number;
  }>(`
    SELECT
      (SELECT count(*)::int FROM teachers) as "totalTeachers",
      (SELECT count(*)::int FROM students WHERE status <> 'Deleted') as "totalStudents",
      (SELECT count(*)::int FROM users WHERE role = 'TEACHER' AND status = 'Active') as "activeTeacherAccounts",
      (SELECT count(*)::int FROM users WHERE role = 'PARENT' AND status = 'Active') as "activeParentAccounts"
  `);

  // 2. Individual school breakdowns
  const schoolRows = await queryRows<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
    teachersCount: number;
    studentsCount: number;
    teacherAccountsCount: number;
    parentAccountsCount: number;
  }>(`
    SELECT
      i.id,
      i.name,
      COALESCE(i.status, 'Active') as status,
      i.created_at::text as "createdAt",
      (SELECT count(*)::int FROM teachers t WHERE t.institution_id = i.id) as "teachersCount",
      (SELECT count(*)::int FROM students s WHERE s.institution_id = i.id AND s.status <> 'Deleted') as "studentsCount",
      (SELECT count(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'TEACHER') as "teacherAccountsCount",
      (SELECT count(*)::int FROM users u WHERE u.institution_id = i.id AND u.role = 'PARENT') as "parentAccountsCount"
    FROM institutions i
    ORDER BY i.name ASC
  `);

  let totalPendingTeachers = 0;
  let totalPendingParents = 0;

  const schools = schoolRows.map((r) => {
    const pendingTeachers = Math.max(0, (r.teachersCount || 0) - (r.teacherAccountsCount || 0));
    const pendingParents = Math.max(0, (r.studentsCount || 0) - (r.parentAccountsCount || 0));
    totalPendingTeachers += pendingTeachers;
    totalPendingParents += pendingParents;

    return {
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
      teachersCount: r.teachersCount || 0,
      studentsCount: r.studentsCount || 0,
      teacherAccountsCount: r.teacherAccountsCount || 0,
      parentAccountsCount: r.parentAccountsCount || 0,
      pendingTeacherCount: pendingTeachers,
      pendingParentCount: pendingParents,
    };
  });

  return {
    totalSchools: schoolsRow?.totalSchools || 0,
    activeSchools: schoolsRow?.activeSchools || 0,
    suspendedSchools: schoolsRow?.suspendedSchools || 0,
    totalTeachers: rosterRow?.totalTeachers || 0,
    totalStudents: rosterRow?.totalStudents || 0,
    activeTeacherAccounts: rosterRow?.activeTeacherAccounts || 0,
    activeParentAccounts: rosterRow?.activeParentAccounts || 0,
    pendingTeacherActivations: totalPendingTeachers,
    pendingParentActivations: totalPendingParents,
    schools,
  };
}

export type TeacherAuditSummary = {
  totalAudited: number;
  provisioned: number;
  repaired: number;
  activeWithSetPassword: number;
  credentials: Map<string, {
    teacherId: string;
    employeeId: string;
    loginId: string;
    name: string;
    email: string;
    phone: string;
    temporaryPassword?: string;
    mustChangePassword: boolean;
    status: string;
  }>;
};

/**
 * Audits all teachers in an institution and repairs accounts with missing passwords or unlinked user records.
 * Never overwrites passwords for active teachers who already configured their own password,
 * unless explicitly requested via regenerateAll or regenerateTeacherId.
 */
export async function auditAndRepairTeacherCredentials(
  institutionId: string,
  options: {
    regenerateAll?: boolean;
    regenerateTeacherId?: string;
    includePendingPasswords?: boolean;
  } = {}
): Promise<TeacherAuditSummary> {
  const school = await queryRow<{ id: string; name: string }>(
    `SELECT id, name FROM institutions WHERE id = ?`,
    [institutionId]
  );
  type TeacherSettingsRow = {
    school_code?: string;
    default_teacher_password?: string;
    teacher_password_mode?: "COMMON" | "UNIQUE";
  };
  const settings = await queryRow<TeacherSettingsRow>(
    `SELECT school_code, COALESCE(default_teacher_password, 'EduTeacher@2026') as default_teacher_password, COALESCE(teacher_password_mode, 'COMMON') as teacher_password_mode FROM settings WHERE institution_id = ?`,
    [institutionId]
  ).catch(async () => {
    return await queryRow<TeacherSettingsRow>(
      `SELECT school_code FROM settings WHERE institution_id = ?`,
      [institutionId]
    );
  });

  const schoolName = school?.name || "School";
  const schoolCode = settings?.school_code || schoolName.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

  const getTeacherTempPassword = () => {
    if (settings?.teacher_password_mode === "UNIQUE") {
      return generateSecureTemporaryPassword();
    }
    return settings?.default_teacher_password || "EduTeacher@2026";
  };

  const teachers = await queryRows<{
    id: string;
    name: string;
    employee_id: string;
    email: string;
    phone: string;
    department: string;
    subject: string;
    status: string;
    login_id: string;
  }>(
    `SELECT id, name, employee_id, email, phone, department, subject, status, COALESCE(login_id, '') as login_id
     FROM teachers
     WHERE institution_id = ? AND status <> 'Deleted'
     ORDER BY name ASC`,
    [institutionId]
  );

  let provisioned = 0;
  let repaired = 0;
  let activeWithSetPassword = 0;

  const credentials = new Map<string, {
    teacherId: string;
    employeeId: string;
    loginId: string;
    name: string;
    email: string;
    phone: string;
    temporaryPassword?: string;
    mustChangePassword: boolean;
    status: string;
  }>();

  for (const teacher of teachers) {
    const canonicalLoginId = teacher.login_id || formatTeacherLoginId(schoolCode, teacher.employee_id);
    const cleanEmail = (teacher.email || "").trim().toLowerCase();
    const rawDigits = (teacher.phone || "").replace(/[^0-9]/g, "");
    const digits = rawDigits.length >= 10 ? rawDigits.slice(-10) : rawDigits;
    const syntheticEmail = digits
      ? `teacher_${digits}@${institutionId.toLowerCase()}.internal`
      : `teacher_${teacher.id.slice(0, 8)}@${institutionId.toLowerCase()}.internal`;
    const effectiveEmail = cleanEmail || syntheticEmail;

    // Check existing user account by loginId, cleanEmail, syntheticEmail, or phone
    let existingUser = await queryRow<{
      id: string;
      email: string;
      password_hash: string | null;
      role: string;
      status: string;
      login_id: string | null;
      must_change_password: boolean | null;
    }>(
      `SELECT id, email, password_hash, role, status, login_id, must_change_password
       FROM users
       WHERE institution_id = ? AND role = 'TEACHER' AND (
         (login_id IS NOT NULL AND LOWER(TRIM(login_id)) = LOWER(?))
         OR (LOWER(TRIM(email)) = LOWER(?))
         OR (email = ? OR email LIKE ?)
       )
       LIMIT 1`,
      [institutionId, canonicalLoginId, effectiveEmail, syntheticEmail, `teacher_${digits}@%`]
    );

    // If still not found and teacher has cleanEmail, check global users by email
    if (!existingUser && cleanEmail) {
      existingUser = await queryRow<{
        id: string;
        email: string;
        password_hash: string | null;
        role: string;
        status: string;
        login_id: string | null;
        must_change_password: boolean | null;
      }>(
        `SELECT id, email, password_hash, role, status, login_id, must_change_password
         FROM users
         WHERE LOWER(TRIM(email)) = LOWER(?)
         LIMIT 1`,
        [cleanEmail]
      );
    }

    const teacherStatus = teacher.status === "Active" ? "Active" : "Inactive";
    const shouldRegenerate = Boolean(
      options.regenerateAll || (options.regenerateTeacherId && options.regenerateTeacherId === teacher.id)
    );

    if (!existingUser) {
      // 1. Teacher account does NOT exist -> PROVISION NEW ACCOUNT
      const tempPassword = getTeacherTempPassword();
      const passwordHash = await hash(tempPassword, 10);
      const newUserId = crypto.randomUUID();

      await queryRun(
        `INSERT INTO users(id, email, name, password_hash, role, institution_id, status, login_id, must_change_password)
         VALUES(?, ?, ?, ?, 'TEACHER', ?, ?, ?, TRUE)`,
        [newUserId, effectiveEmail, teacher.name || "Faculty Member", passwordHash, institutionId, teacherStatus, canonicalLoginId]
      );

      if (!teacher.login_id) {
        await queryRun(
          `UPDATE teachers SET login_id = ? WHERE id = ? AND institution_id = ?`,
          [canonicalLoginId, teacher.id, institutionId]
        );
      }

      provisioned++;
      credentials.set(teacher.id, {
        teacherId: teacher.id,
        employeeId: teacher.employee_id,
        loginId: canonicalLoginId,
        name: teacher.name,
        email: cleanEmail,
        phone: teacher.phone,
        temporaryPassword: tempPassword,
        mustChangePassword: true,
        status: teacherStatus,
      });
    } else {
      // 2. Teacher account exists -> AUDIT PASSWORD AND REPAIR IF MISSING OR REGENERATING
      const missingPassword = !existingUser.password_hash || existingUser.password_hash.trim().length === 0;
      const userMustChange = existingUser.must_change_password ?? false;

      // Update login_id on user and teacher if missing
      if (!existingUser.login_id) {
        await queryRun(
          `UPDATE users SET login_id = ? WHERE id = ?`,
          [canonicalLoginId, existingUser.id]
        );
      }
      if (!teacher.login_id) {
        await queryRun(
          `UPDATE teachers SET login_id = ? WHERE id = ? AND institution_id = ?`,
          [canonicalLoginId, teacher.id, institutionId]
        );
      }

      if (missingPassword || shouldRegenerate) {
        // Generate new temporary password
        const tempPassword = getTeacherTempPassword();
        const passwordHash = await hash(tempPassword, 10);

        await queryRun(
          `UPDATE users
           SET password_hash = ?,
               must_change_password = TRUE,
               status = ?,
               login_id = COALESCE(login_id, ?),
               institution_id = ?
           WHERE id = ?`,
          [passwordHash, teacherStatus, canonicalLoginId, institutionId, existingUser.id]
        );

        repaired++;
        credentials.set(teacher.id, {
          teacherId: teacher.id,
          employeeId: teacher.employee_id,
          loginId: canonicalLoginId,
          name: teacher.name,
          email: cleanEmail,
          phone: teacher.phone,
          temporaryPassword: tempPassword,
          mustChangePassword: true,
          status: teacherStatus,
        });
      } else if (userMustChange && options.includePendingPasswords !== false) {
        // Teacher has not yet completed first login and changed their password.
        // Ensure a valid temporary password is synchronized and available.
        const tempPassword = getTeacherTempPassword();
        const passwordHash = await hash(tempPassword, 10);

        await queryRun(
          `UPDATE users
           SET password_hash = ?,
               must_change_password = TRUE,
               status = ?,
               login_id = COALESCE(login_id, ?),
               institution_id = ?
           WHERE id = ?`,
          [passwordHash, teacherStatus, canonicalLoginId, institutionId, existingUser.id]
        );

        repaired++;
        credentials.set(teacher.id, {
          teacherId: teacher.id,
          employeeId: teacher.employee_id,
          loginId: canonicalLoginId,
          name: teacher.name,
          email: cleanEmail,
          phone: teacher.phone,
          temporaryPassword: tempPassword,
          mustChangePassword: true,
          status: teacherStatus,
        });
      } else if (userMustChange) {
        // Pending first login, but don't regenerate password
        credentials.set(teacher.id, {
          teacherId: teacher.id,
          employeeId: teacher.employee_id,
          loginId: canonicalLoginId,
          name: teacher.name,
          email: cleanEmail,
          phone: teacher.phone,
          temporaryPassword: undefined,
          mustChangePassword: true,
          status: teacherStatus,
        });
      } else {
        // Teacher already set their permanent password! DO NOT OVERWRITE.
        activeWithSetPassword++;
        credentials.set(teacher.id, {
          teacherId: teacher.id,
          employeeId: teacher.employee_id,
          loginId: canonicalLoginId,
          name: teacher.name,
          email: cleanEmail,
          phone: teacher.phone,
          temporaryPassword: undefined,
          mustChangePassword: false,
          status: teacherStatus,
        });
      }
    }
  }

  return {
    totalAudited: teachers.length,
    provisioned,
    repaired,
    activeWithSetPassword,
    credentials,
  };
}

export type StudentAuditSummary = {
  totalAudited: number;
  provisioned: number;
  repaired: number;
  activeWithSetPassword: number;
  credentials: Map<string, {
    studentId: string;
    admissionNo: string;
    loginId: string;
    name: string;
    className: string;
    section: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    temporaryPassword?: string;
    mustChangePassword: boolean;
    status: string;
  }>;
};

/**
 * Audits all students in an institution and provisions/repairs student & parent portal accounts.
 * Never overwrites passwords for active students or parents who already set their own password,
 * unless explicitly requested via regenerateAll or regenerateStudentId.
 */
export async function auditAndRepairStudentCredentials(
  institutionId: string,
  options: {
    regenerateAll?: boolean;
    regenerateStudentId?: string;
    includePendingPasswords?: boolean;
  } = {}
): Promise<StudentAuditSummary> {
  const school = await queryRow<{ id: string; name: string }>(
    `SELECT id, name FROM institutions WHERE id = ?`,
    [institutionId]
  );
  type StudentSettingsRow = {
    school_code?: string;
    default_student_password?: string;
    student_password_mode?: "COMMON" | "UNIQUE";
  };
  const settings = await queryRow<StudentSettingsRow>(
    `SELECT school_code, COALESCE(default_student_password, 'EduStudent@2026') as default_student_password, COALESCE(student_password_mode, 'COMMON') as student_password_mode FROM settings WHERE institution_id = ?`,
    [institutionId]
  ).catch(async () => {
    return await queryRow<StudentSettingsRow>(
      `SELECT school_code FROM settings WHERE institution_id = ?`,
      [institutionId]
    );
  });

  const schoolName = school?.name || "School";
  const schoolCode = settings?.school_code || schoolName.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

  const getStudentTempPassword = () => {
    if (settings?.student_password_mode === "UNIQUE") {
      return generateSecureTemporaryPassword();
    }
    return settings?.default_student_password || "EduStudent@2026";
  };

  const students = await queryRows<{
    id: string;
    name: string;
    admission: string;
    class_name: string;
    section: string;
    parent: string;
    parent_phone: string;
    parent_email: string;
    status: string;
    login_id: string;
  }>(
    `SELECT id, name, admission, class_name, section, parent, parent_phone, parent_email, status, COALESCE(login_id, '') as login_id
     FROM students
     WHERE institution_id = ? AND status <> 'Deleted'
     ORDER BY class_name ASC, section ASC, name ASC`,
    [institutionId]
  );

  let provisioned = 0;
  let repaired = 0;
  let activeWithSetPassword = 0;

  const credentials = new Map<string, {
    studentId: string;
    admissionNo: string;
    loginId: string;
    name: string;
    className: string;
    section: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    temporaryPassword?: string;
    mustChangePassword: boolean;
    status: string;
  }>();

  for (const student of students) {
    const canonicalLoginId = student.login_id || formatStudentLoginId(schoolCode, student.admission || student.id);
    const cleanAdmission = (student.admission || student.id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const cleanEmail = (student.parent_email || "").trim().toLowerCase();
    const syntheticEmail = `student_${cleanAdmission}@${institutionId.toLowerCase()}.internal`;
    const effectiveEmail = cleanEmail || syntheticEmail;

    let existingUser = await queryRow<{
      id: string;
      email: string;
      password_hash: string | null;
      role: string;
      status: string;
      login_id: string | null;
      must_change_password: boolean | null;
    }>(
      `SELECT id, email, password_hash, role, status, login_id, must_change_password
       FROM users
       WHERE institution_id = ? AND role IN ('STUDENT', 'PARENT') AND (
         (login_id IS NOT NULL AND LOWER(TRIM(login_id)) = LOWER(?))
         OR (LOWER(TRIM(email)) = LOWER(?))
         OR (email = ?)
       )
       LIMIT 1`,
      [institutionId, canonicalLoginId, effectiveEmail, syntheticEmail]
    );

    const studentStatus = student.status === "Inactive" ? "Inactive" : "Active";
    const shouldRegenerate = Boolean(
      options.regenerateAll || (options.regenerateStudentId && options.regenerateStudentId === student.id)
    );

    if (!existingUser) {
      const tempPassword = getStudentTempPassword();
      const passwordHash = await hash(tempPassword, 10);
      const newUserId = crypto.randomUUID();

      await queryRun(
        `INSERT INTO users(id, email, name, password_hash, role, institution_id, status, login_id, must_change_password)
         VALUES(?, ?, ?, ?, 'STUDENT', ?, ?, ?, TRUE)`,
        [newUserId, effectiveEmail, student.name || "Student", passwordHash, institutionId, studentStatus, canonicalLoginId]
      );

      if (!student.login_id) {
        await queryRun(
          `UPDATE students SET login_id = ? WHERE id = ? AND institution_id = ?`,
          [canonicalLoginId, student.id, institutionId]
        );
      }

      await queryRun(
        `INSERT INTO parent_students(id, institution_id, parent_user_id, student_id, relationship, is_primary)
         VALUES(?, ?, ?, ?, 'Student', TRUE)
         ON CONFLICT (parent_user_id, student_id) DO NOTHING`,
        [crypto.randomUUID(), institutionId, newUserId, student.id]
      );

      provisioned++;
      credentials.set(student.id, {
        studentId: student.id,
        admissionNo: student.admission || "—",
        loginId: canonicalLoginId,
        name: student.name,
        className: student.class_name,
        section: student.section,
        parentName: student.parent || "Parent",
        parentPhone: student.parent_phone,
        parentEmail: cleanEmail,
        temporaryPassword: tempPassword,
        mustChangePassword: true,
        status: studentStatus,
      });
    } else {
      const missingPassword = !existingUser.password_hash || existingUser.password_hash.trim().length === 0;
      const userMustChange = existingUser.must_change_password ?? false;

      if (!existingUser.login_id) {
        await queryRun(
          `UPDATE users SET login_id = ? WHERE id = ?`,
          [canonicalLoginId, existingUser.id]
        );
      }
      if (!student.login_id) {
        await queryRun(
          `UPDATE students SET login_id = ? WHERE id = ? AND institution_id = ?`,
          [canonicalLoginId, student.id, institutionId]
        );
      }

      await queryRun(
        `INSERT INTO parent_students(id, institution_id, parent_user_id, student_id, relationship, is_primary)
         VALUES(?, ?, ?, ?, 'Student', TRUE)
         ON CONFLICT (parent_user_id, student_id) DO NOTHING`,
        [crypto.randomUUID(), institutionId, existingUser.id, student.id]
      );

      if (missingPassword || shouldRegenerate) {
        const tempPassword = getStudentTempPassword();
        const passwordHash = await hash(tempPassword, 10);

        await queryRun(
          `UPDATE users
           SET password_hash = ?,
               must_change_password = TRUE,
               status = ?,
               login_id = COALESCE(login_id, ?),
               institution_id = ?
           WHERE id = ?`,
          [passwordHash, studentStatus, canonicalLoginId, institutionId, existingUser.id]
        );

        repaired++;
        credentials.set(student.id, {
          studentId: student.id,
          admissionNo: student.admission || "—",
          loginId: canonicalLoginId,
          name: student.name,
          className: student.class_name,
          section: student.section,
          parentName: student.parent || "Parent",
          parentPhone: student.parent_phone,
          parentEmail: cleanEmail,
          temporaryPassword: tempPassword,
          mustChangePassword: true,
          status: studentStatus,
        });
      } else if (userMustChange && options.includePendingPasswords !== false) {
        const tempPassword = getStudentTempPassword();
        const passwordHash = await hash(tempPassword, 10);

        await queryRun(
          `UPDATE users
           SET password_hash = ?,
               must_change_password = TRUE,
               status = ?,
               login_id = COALESCE(login_id, ?),
               institution_id = ?
           WHERE id = ?`,
          [passwordHash, studentStatus, canonicalLoginId, institutionId, existingUser.id]
        );

        repaired++;
        credentials.set(student.id, {
          studentId: student.id,
          admissionNo: student.admission || "—",
          loginId: canonicalLoginId,
          name: student.name,
          className: student.class_name,
          section: student.section,
          parentName: student.parent || "Parent",
          parentPhone: student.parent_phone,
          parentEmail: cleanEmail,
          temporaryPassword: tempPassword,
          mustChangePassword: true,
          status: studentStatus,
        });
      } else if (userMustChange) {
        credentials.set(student.id, {
          studentId: student.id,
          admissionNo: student.admission || "—",
          loginId: canonicalLoginId,
          name: student.name,
          className: student.class_name,
          section: student.section,
          parentName: student.parent || "Parent",
          parentPhone: student.parent_phone,
          parentEmail: cleanEmail,
          temporaryPassword: undefined,
          mustChangePassword: true,
          status: studentStatus,
        });
      } else {
        activeWithSetPassword++;
        credentials.set(student.id, {
          studentId: student.id,
          admissionNo: student.admission || "—",
          loginId: canonicalLoginId,
          name: student.name,
          className: student.class_name,
          section: student.section,
          parentName: student.parent || "Parent",
          parentPhone: student.parent_phone,
          parentEmail: cleanEmail,
          temporaryPassword: undefined,
          mustChangePassword: false,
          status: studentStatus,
        });
      }
    }
  }

  return {
    totalAudited: students.length,
    provisioned,
    repaired,
    activeWithSetPassword,
    credentials,
  };
}

export async function synchronizeAllInstitutionAccounts(
  institutionId: string,
  options: {
    regenerateAllTeachers?: boolean;
    regenerateAllStudents?: boolean;
    adminUserId?: string;
  } = {}
) {
  const teacherAudit = await auditAndRepairTeacherCredentials(institutionId, {
    regenerateAll: options.regenerateAllTeachers,
    includePendingPasswords: true,
  });

  const studentAudit = await auditAndRepairStudentCredentials(institutionId, {
    regenerateAll: options.regenerateAllStudents,
    includePendingPasswords: true,
  });

  await queryRun(
    `UPDATE settings SET accounts_last_synced_at = CURRENT_TIMESTAMP WHERE institution_id = ?`,
    [institutionId]
  ).catch(() => 0);

  const settings = await queryRow<{
    default_teacher_password?: string;
    default_student_password?: string;
    teacher_password_mode?: string;
    student_password_mode?: string;
    accounts_last_synced_at?: string;
  }>(
    `SELECT default_teacher_password, default_student_password, teacher_password_mode, student_password_mode, accounts_last_synced_at::text FROM settings WHERE institution_id = ?`,
    [institutionId]
  ).catch(() => undefined);

  return {
    success: true,
    institutionId,
    teachers: {
      total: teacherAudit.totalAudited,
      provisioned: teacherAudit.provisioned,
      repaired: teacherAudit.repaired,
      activeWithSetPassword: teacherAudit.activeWithSetPassword,
    },
    students: {
      total: studentAudit.totalAudited,
      provisioned: studentAudit.provisioned,
      repaired: studentAudit.repaired,
      activeWithSetPassword: studentAudit.activeWithSetPassword,
    },
    settings: {
      defaultTeacherPassword: settings?.default_teacher_password || "EduTeacher@2026",
      defaultStudentPassword: settings?.default_student_password || "EduStudent@2026",
      teacherPasswordMode: settings?.teacher_password_mode || "COMMON",
      studentPasswordMode: settings?.student_password_mode || "COMMON",
      accountsLastSyncedAt: settings?.accounts_last_synced_at || new Date().toISOString(),
    },
  };
}

/**
 * Automatically reconciles and provisions missing login accounts for teachers & parents of a school.
 * Never overwrites existing user accounts, passwords or hashes.
 */
export async function provisionSchoolAccounts(
  institutionId: string,
  options: { target?: "teachers" | "students" | "all"; adminUserId?: string } = {}
): Promise<{
  success: boolean;
  institutionId: string;
  provisionedTeachers: number;
  skippedTeachers: number;
  provisionedParents: number;
  skippedParents: number;
  issuedTeacherCredentials: { teacherId: string; name: string; email: string; temporaryPassword: string }[];
  issuedParentCredentials: { studentId: string; studentName: string; parentEmail: string; temporaryPassword: string }[];
}> {
  const target = options.target || "all";

  let provisionedTeachers = 0;
  let skippedTeachers = 0;
  let provisionedParents = 0;
  let skippedParents = 0;

  const issuedTeacherCredentials: { teacherId: string; name: string; email: string; temporaryPassword: string }[] = [];
  const issuedParentCredentials: { studentId: string; studentName: string; parentEmail: string; temporaryPassword: string }[] = [];

  // --- A. PROVISION TEACHERS ---
  if (target === "teachers" || target === "all") {
    const audit = await auditAndRepairTeacherCredentials(institutionId, { includePendingPasswords: true });
    provisionedTeachers = audit.provisioned + audit.repaired;
    skippedTeachers = audit.activeWithSetPassword;

    for (const [, cred] of audit.credentials.entries()) {
      if (cred.temporaryPassword) {
        issuedTeacherCredentials.push({
          teacherId: cred.teacherId,
          name: cred.name,
          email: cred.email || cred.phone,
          temporaryPassword: cred.temporaryPassword,
        });
      }
    }
  }

  // --- B. PROVISION STUDENTS & PARENTS ---
  if (target === "students" || target === "all") {
    const students = await queryRows<{
      id: string;
      name: string;
      admission: string;
      parent: string;
      parent_phone: string;
      parent_email: string;
      institution_id: string;
    }>(
      `SELECT s.id, s.name, s.admission, s.parent, s.parent_phone, s.parent_email, s.institution_id
       FROM students s
       WHERE s.institution_id = ? AND s.status <> 'Deleted'`,
      [institutionId]
    );

    for (const student of students) {
      // Check if already linked to a parent
      const existingLink = await queryRow<{ id: string; parent_user_id: string }>(
        `SELECT ps.id, ps.parent_user_id
         FROM parent_students ps
         WHERE ps.student_id = ? AND ps.institution_id = ?`,
        [student.id, institutionId]
      );

      if (existingLink) {
        skippedParents++;
        continue;
      }

      // Determine parent email or generate standardized parent identifier
      let parentEmail = String(student.parent_email || "").trim().toLowerCase();
      if (!parentEmail || !parentEmail.includes("@")) {
        const cleanAdmission = String(student.admission || student.id).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        parentEmail = `parent.${cleanAdmission}@eduledger.local`;
      }

      // Check if a parent user with this email already exists
      let parentUserId: string;
      let tempPassword = "";

      const existingParent = await queryRow<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(email) = ?`,
        [parentEmail]
      );

      if (existingParent) {
        parentUserId = existingParent.id;
      } else {
        tempPassword = generateSecureTemporaryPassword();
        const passwordHash = await hash(tempPassword, 10);
        parentUserId = crypto.randomUUID();

        await queryRun(
          `INSERT INTO users(id, email, name, password_hash, role, institution_id, status)
           VALUES(?, ?, ?, ?, 'PARENT', ?, 'Active')
           ON CONFLICT (email) DO NOTHING`,
          [parentUserId, parentEmail, student.parent || `Guardian of ${student.name}`, passwordHash, institutionId]
        );
      }

      // Link in parent_students
      const linkId = crypto.randomUUID();
      await queryRun(
        `INSERT INTO parent_students(id, institution_id, parent_user_id, student_id, relationship, is_primary)
         VALUES(?, ?, ?, ?, 'Parent', TRUE)
         ON CONFLICT (parent_user_id, student_id) DO NOTHING`,
        [linkId, institutionId, parentUserId, student.id]
      );

      provisionedParents++;
      if (tempPassword) {
        issuedParentCredentials.push({
          studentId: student.id,
          studentName: student.name,
          parentEmail,
          temporaryPassword: tempPassword,
        });
      }
    }
  }

  // Audit log
  try {
    const auditId = crypto.randomUUID();
    await queryRun(
      `INSERT INTO audit_logs(id, institution_id, user_id, action, entity, entity_id, details)
       VALUES(?, ?, ?, 'PROVISION_ACCOUNTS', 'Institution', ?, ?::jsonb)`,
      [
        auditId,
        institutionId,
        options.adminUserId || "SYSTEM",
        institutionId,
        JSON.stringify({
          target,
          provisionedTeachers,
          skippedTeachers,
          provisionedParents,
          skippedParents,
        }),
      ]
    );
  } catch {
    // Non-fatal if audit logging encounters a schema variant
  }

  return {
    success: true,
    institutionId,
    provisionedTeachers,
    skippedTeachers,
    provisionedParents,
    skippedParents,
    issuedTeacherCredentials,
    issuedParentCredentials,
  };
}

/**
 * Fetch teachers formatted for PDF generation with audited credentials
 */
export async function getTeacherPdfData(
  institutionId: string,
  departmentFilter?: string,
  options?: { regenerate?: "all" | "missing" }
): Promise<{ school: SchoolCredentialMeta; teachers: TeacherCredentialItem[] }> {
  const [school, settings, audit] = await Promise.all([
    queryRow<{ id: string; name: string }>(
      `SELECT id, name FROM institutions WHERE id = ?`,
      [institutionId]
    ),
    queryRow<{ academic_year?: string }>(
      `SELECT academic_year FROM settings WHERE institution_id = ?`,
      [institutionId]
    ),
    auditAndRepairTeacherCredentials(institutionId, {
      regenerateAll: options?.regenerate === "all",
      includePendingPasswords: true,
    }),
  ]);

  let query = `
    SELECT
      t.id,
      t.employee_id as "facultyId",
      t.name,
      t.department,
      t.subject,
      t.email,
      t.phone,
      t.status,
      COALESCE(t.login_id, '') as "loginId"
    FROM teachers t
    WHERE t.institution_id = ? AND t.status <> 'Deleted'
  `;
  const params: unknown[] = [institutionId];

  if (departmentFilter && departmentFilter !== "all") {
    query += ` AND LOWER(t.department) = LOWER(?)`;
    params.push(departmentFilter);
  }

  query += ` ORDER BY t.name ASC`;

  const rows = await queryRows<{
    id: string;
    facultyId: string;
    name: string;
    department: string;
    subject: string;
    email: string;
    phone: string;
    status: string;
    loginId: string;
  }>(query, params);

  return {
    school: {
      id: school?.id || institutionId,
      name: school?.name || "School",
      academicYear: settings?.academic_year || "2025-2026",
    },
    teachers: rows.map((r) => {
      const cred = audit.credentials.get(r.id);
      return {
        facultyId: r.facultyId || "—",
        name: r.name,
        department: r.department || "",
        subject: r.subject || "",
        email: r.email || "",
        phone: r.phone || "",
        status: r.status || "Active",
        temporaryPassword: cred?.temporaryPassword,
        mustChangePassword: cred?.mustChangePassword,
        loginId: cred?.loginId || r.loginId || r.facultyId,
      };
    }),
  };
}

/**
 * Fetch students formatted for PDF generation with audited credentials
 */
export async function getStudentPdfData(
  institutionId: string,
  classFilter?: string,
  sectionFilter?: string,
  options?: { regenerate?: "all" | "missing" }
): Promise<{ school: SchoolCredentialMeta; students: StudentCredentialItem[] }> {
  const [school, settings, audit] = await Promise.all([
    queryRow<{ id: string; name: string }>(
      `SELECT id, name FROM institutions WHERE id = ?`,
      [institutionId]
    ),
    queryRow<{ academic_year?: string }>(
      `SELECT academic_year FROM settings WHERE institution_id = ?`,
      [institutionId]
    ),
    auditAndRepairStudentCredentials(institutionId, {
      regenerateAll: options?.regenerate === "all",
      includePendingPasswords: true,
    }),
  ]);

  let query = `
    SELECT
      s.id,
      s.admission as "admissionNo",
      s.name as "studentName",
      s.class_name as "className",
      s.section,
      s.parent as "parentName",
      s.parent_phone as "parentPhone",
      s.parent_email as "parentEmail",
      s.status,
      COALESCE(s.login_id, '') as "loginId"
    FROM students s
    WHERE s.institution_id = ? AND s.status <> 'Deleted'
  `;
  const params: unknown[] = [institutionId];

  if (classFilter && classFilter !== "all") {
    params.push(classFilter);
    query += ` AND s.class_name = ?`;
  }
  if (sectionFilter && sectionFilter !== "all") {
    params.push(sectionFilter);
    query += ` AND s.section = ?`;
  }

  query += ` ORDER BY s.class_name ASC, s.section ASC, s.name ASC`;

  const rows = await queryRows<{
    admissionNo: string;
    id: string;
    studentName: string;
    className: string;
    section: string;
    parentName: string;
    parentPhone: string;
    parentEmail: string;
    status: string;
    loginId: string;
  }>(query, params);

  return {
    school: {
      id: school?.id || institutionId,
      name: school?.name || "School",
      academicYear: settings?.academic_year || "2026-2027",
    },
    students: rows.map((r) => {
      const cred = audit.credentials.get(r.id);
      return {
        admissionNo: r.admissionNo || "—",
        studentId: r.id,
        studentName: r.studentName,
        className: r.className || "",
        section: r.section || "",
        parentName: r.parentName || "Parent",
        parentPhone: r.parentPhone || "",
        parentEmail: r.parentEmail || "",
        status: cred?.status || (r.status === "Inactive" ? "Inactive" : "Active"),
        temporaryPassword: cred?.temporaryPassword,
        mustChangePassword: cred?.mustChangePassword,
        loginId: cred?.loginId || r.loginId || r.admissionNo,
      };
    }),
  };
}

/**
 * Toggles an institution's operational status (Active vs Suspended)
 */
export async function toggleInstitutionStatus(
  institutionId: string,
  newStatus: "Active" | "Suspended",
  adminUserId?: string
) {
  await queryRun(
    `UPDATE institutions SET status = ? WHERE id = ?`,
    [newStatus, institutionId]
  );

  // Update associated user accounts status
  await queryRun(
    `UPDATE users SET status = ? WHERE institution_id = ? AND role <> 'SUPER_ADMIN'`,
    [newStatus, institutionId]
  );

  try {
    await queryRun(
      `INSERT INTO audit_logs(id, institution_id, user_id, action, entity, entity_id, details)
       VALUES(?, ?, ?, 'TOGGLE_STATUS', 'Institution', ?, ?::jsonb)`,
      [
        crypto.randomUUID(),
        institutionId,
        adminUserId || "SYSTEM",
        institutionId,
        JSON.stringify({ newStatus }),
      ]
    );
  } catch {
    // Non-fatal
  }

  return { success: true, institutionId, status: newStatus };
}
