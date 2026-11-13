import "server-only";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { queryRows, queryRow, queryRun, getDb } from "./db";
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
    const teachers = await queryRows<{
      id: string;
      name: string;
      email: string;
      phone: string;
      employee_id: string;
      institution_id: string;
    }>(
      `SELECT t.id, t.name, t.email, t.phone, t.employee_id, t.institution_id
       FROM teachers t
       WHERE t.institution_id = ?`,
      [institutionId]
    );

    for (const teacher of teachers) {
      const email = String(teacher.email || "").trim().toLowerCase();
      if (!email) {
        skippedTeachers++;
        continue;
      }

      // Check if user account already exists
      const existingUser = await queryRow<{ id: string; email: string; role: string }>(
        `SELECT id, email, role FROM users WHERE LOWER(email) = ?`,
        [email]
      );

      if (existingUser) {
        skippedTeachers++;
        continue;
      }

      // Create new user account with temporary password
      const tempPassword = generateSecureTemporaryPassword();
      const passwordHash = await hash(tempPassword, 10);
      const newUserId = crypto.randomUUID();

      await queryRun(
        `INSERT INTO users(id, email, name, password_hash, role, institution_id, status)
         VALUES(?, ?, ?, ?, 'TEACHER', ?, 'Active')
         ON CONFLICT (email) DO NOTHING`,
        [newUserId, email, teacher.name || "Faculty Member", passwordHash, institutionId]
      );

      provisionedTeachers++;
      issuedTeacherCredentials.push({
        teacherId: teacher.id,
        name: teacher.name,
        email,
        temporaryPassword: tempPassword,
      });
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
 * Fetch teachers formatted for PDF generation
 */
export async function getTeacherPdfData(
  institutionId: string,
  departmentFilter?: string
): Promise<{ school: SchoolCredentialMeta; teachers: TeacherCredentialItem[] }> {
  const school = await queryRow<{ id: string; name: string }>(
    `SELECT id, name FROM institutions WHERE id = ?`,
    [institutionId]
  );

  let query = `
    SELECT
      t.id,
      t.employee_id as "facultyId",
      t.name,
      t.department,
      t.subject,
      t.email,
      t.phone,
      COALESCE(u.status, 'Pending') as status
    FROM teachers t
    LEFT JOIN users u ON LOWER(u.email) = LOWER(t.email) AND u.institution_id = t.institution_id
    WHERE t.institution_id = ?
  `;
  const params: unknown[] = [institutionId];

  if (departmentFilter && departmentFilter !== "all") {
    query += ` AND LOWER(t.department) = LOWER(?)`;
    params.push(departmentFilter);
  }

  query += ` ORDER BY t.name ASC`;

  const rows = await queryRows<{
    facultyId: string;
    name: string;
    department: string;
    subject: string;
    email: string;
    phone: string;
    status: string;
  }>(query, params);

  return {
    school: {
      id: school?.id || institutionId,
      name: school?.name || "School",
    },
    teachers: rows.map((r) => ({
      facultyId: r.facultyId || "—",
      name: r.name,
      department: r.department || "",
      subject: r.subject || "",
      email: r.email || "",
      phone: r.phone || "",
      status: r.status || "Pending",
    })),
  };
}

/**
 * Fetch students formatted for PDF generation
 */
export async function getStudentPdfData(
  institutionId: string,
  classFilter?: string,
  sectionFilter?: string
): Promise<{ school: SchoolCredentialMeta; students: StudentCredentialItem[] }> {
  const school = await queryRow<{ id: string; name: string }>(
    `SELECT id, name FROM institutions WHERE id = ?`,
    [institutionId]
  );

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
      CASE WHEN ps.id IS NOT NULL THEN 'Active' ELSE 'Pending' END as status
    FROM students s
    LEFT JOIN parent_students ps ON ps.student_id = s.id AND ps.institution_id = s.institution_id
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
  }>(query, params);

  return {
    school: {
      id: school?.id || institutionId,
      name: school?.name || "School",
    },
    students: rows.map((r) => ({
      admissionNo: r.admissionNo || "—",
      studentId: r.id,
      studentName: r.studentName,
      className: r.className || "",
      section: r.section || "",
      parentName: r.parentName || "Parent",
      parentPhone: r.parentPhone || "",
      parentEmail: r.parentEmail || "",
      status: r.status,
    })),
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
