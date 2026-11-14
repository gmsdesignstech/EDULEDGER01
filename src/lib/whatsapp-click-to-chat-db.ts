import "server-only";
import { randomUUID } from "node:crypto";
import {
  getDb,
  getInstitution,
  getStudent,
  parentChildAttendance,
  parentChildFees,
  parentChildResults,
  parentChildHomework,
  parentChildTimetable,
  listModuleRecords,
  teacherPortalScope,
  type DbStudent,
} from "./db";
import {
  DEFAULT_TEMPLATES,
  normalizeWhatsAppPhone,
  maskPhoneNumber,
  renderWhatsAppTemplate,
  type WhatsAppCategory,
  type WhatsAppTemplateData,
} from "./whatsapp-click-to-chat";

let schemaReadyPromise: Promise<void> | null = null;

/**
 * Idempotently creates the WhatsApp Click-to-Chat tables in PostgreSQL.
 * Safe for both development and production.
 */
export async function ensureWhatsAppClickToChatSchema(): Promise<void> {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const db = await getDb();
    await db.unsafe(`
      CREATE TABLE IF NOT EXISTS whatsapp_share_logs (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_name TEXT NOT NULL DEFAULT '',
        recipient_phone TEXT NOT NULL,
        recipient_name TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        message_preview TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'WhatsApp Opened / Share Initiated',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_whatsapp_share_logs_inst ON whatsapp_share_logs(institution_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_share_logs_student ON whatsapp_share_logs(institution_id, student_id);

      CREATE TABLE IF NOT EXISTS whatsapp_custom_templates (
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(institution_id, category, title)
      );

      CREATE INDEX IF NOT EXISTS idx_whatsapp_custom_templates_inst ON whatsapp_custom_templates(institution_id);
    `);
  })().catch((err) => {
    schemaReadyPromise = null;
    throw err;
  });
  return schemaReadyPromise;
}

export interface WhatsAppStudentListItem {
  id: string;
  name: string;
  admission: string;
  rollNumber: string;
  className: string;
  section: string;
  academicYear: string;
  gender: string;
  parent: string;
  parentPhone: string;
  parentWhatsapp?: string;
  whatsappConsentStatus?: string;
  hasValidWhatsApp: boolean;
  normalizedPhone: string;
  formattedPhone: string;
  maskedPhone: string;
  phoneError?: string;
  totalShares: number;
  lastSharedAt?: string;
}

export interface WhatsAppCommunicationStats {
  totalStudents: number;
  withWhatsAppCount: number;
  withoutWhatsAppCount: number;
  coveragePercentage: number;
  totalSharesInitiated: number;
  recentSharesCount: number;
  categoryBreakdown: Record<string, number>;
}

/**
 * Get aggregated statistics for the WhatsApp communication dashboard.
 */
export async function getWhatsAppCommunicationStats(
  institutionId: string,
  teacherClasses?: string[],
): Promise<WhatsAppCommunicationStats> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  let studentFilter = "institution_id = $1 AND status = 'Active'";
  const studentArgs: unknown[] = [institutionId];

  if (teacherClasses && teacherClasses.length > 0) {
    studentFilter += ` AND LOWER(class_name) = ANY($2)`;
    studentArgs.push(teacherClasses.map((c) => c.toLowerCase().trim()));
  }

  const students = (await db.unsafe(
    `SELECT id, parent_phone AS "parentPhone" FROM students WHERE ${studentFilter}`,
    studentArgs as never[],
  )) as Array<{ id: string; parentPhone: string }>;

  let withWhatsAppCount = 0;
  for (const s of students) {
    const norm = normalizeWhatsAppPhone(s.parentPhone);
    if (norm.isValid) withWhatsAppCount++;
  }

  const totalStudents = students.length;
  const withoutWhatsAppCount = totalStudents - withWhatsAppCount;
  const coveragePercentage = totalStudents > 0 ? Math.round((withWhatsAppCount / totalStudents) * 100) : 0;

  // Share logs statistics
  const logStats = (await db.unsafe(
    `SELECT category, COUNT(*)::int AS count
     FROM whatsapp_share_logs
     WHERE institution_id = $1
     GROUP BY category`,
    [institutionId] as never[],
  )) as Array<{ category: string; count: number }>;

  const categoryBreakdown: Record<string, number> = {};
  let totalSharesInitiated = 0;
  for (const item of logStats) {
    categoryBreakdown[item.category] = item.count;
    totalSharesInitiated += item.count;
  }

  // Count shares in the last 7 days
  const recentCountRow = (await db.unsafe(
    `SELECT COUNT(*)::int AS count
     FROM whatsapp_share_logs
     WHERE institution_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
    [institutionId] as never[],
  )) as Array<{ count: number }>;
  const recentSharesCount = recentCountRow[0]?.count ?? 0;

  return {
    totalStudents,
    withWhatsAppCount,
    withoutWhatsAppCount,
    coveragePercentage,
    totalSharesInitiated,
    recentSharesCount,
    categoryBreakdown,
  };
}

/**
 * List students with their WhatsApp status and share count.
 */
export async function listWhatsAppStudents(
  institutionId: string,
  options: {
    className?: string;
    section?: string;
    hasWhatsApp?: "all" | "yes" | "no";
    search?: string;
    limit?: number;
    offset?: number;
    teacherClasses?: string[];
  } = {},
): Promise<{ students: WhatsAppStudentListItem[]; total: number }> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  const where: string[] = ["s.institution_id = $1", "s.status = 'Active'"];
  const args: unknown[] = [institutionId];
  let argIndex = 2;

  if (options.teacherClasses && options.teacherClasses.length > 0) {
    where.push(`LOWER(s.class_name) = ANY($${argIndex++})`);
    args.push(options.teacherClasses.map((c) => c.toLowerCase().trim()));
  }

  if (options.className && options.className !== "ALL") {
    where.push(`s.class_name = $${argIndex++}`);
    args.push(options.className);
  }

  if (options.section && options.section !== "ALL") {
    where.push(`s.section = $${argIndex++}`);
    args.push(options.section);
  }

  if (options.search) {
    const term = `%${options.search.trim()}%`;
    where.push(
      `(s.name ILIKE $${argIndex} OR s.admission ILIKE $${argIndex} OR s.roll_number ILIKE $${argIndex} OR s.parent ILIKE $${argIndex} OR s.parent_phone ILIKE $${argIndex})`,
    );
    args.push(term);
    argIndex++;
  }

  const query = `
    SELECT 
      s.id,
      s.name,
      s.admission,
      s.roll_number AS "rollNumber",
      s.class_name AS "className",
      s.section,
      COALESCE(s.academic_year, '') AS "academicYear",
      s.gender,
      s.parent,
      s.parent_phone AS "parentPhone",
      COALESCE(COUNT(l.id), 0)::int AS "totalShares",
      MAX(l.created_at)::text AS "lastSharedAt"
    FROM students s
    LEFT JOIN whatsapp_share_logs l ON l.student_id = s.id AND l.institution_id = s.institution_id
    WHERE ${where.join(" AND ")}
    GROUP BY s.id, s.name, s.admission, s.roll_number, s.class_name, s.section, s.academic_year, s.gender, s.parent, s.parent_phone
    ORDER BY s.class_name ASC, s.section ASC, s.name ASC
  `;

  const rows = (await db.unsafe(query, args as never[])) as Array<{
    id: string;
    name: string;
    admission: string;
    rollNumber: string;
    className: string;
    section: string;
    academicYear: string;
    gender: string;
    parent: string;
    parentPhone: string;
    totalShares: number;
    lastSharedAt: string | null;
  }>;

  const items: WhatsAppStudentListItem[] = rows.map((r) => {
    const norm = normalizeWhatsAppPhone(r.parentPhone);
    return {
      id: r.id,
      name: r.name,
      admission: r.admission,
      rollNumber: r.rollNumber || "—",
      className: r.className,
      section: r.section || "A",
      academicYear: r.academicYear,
      gender: r.gender,
      parent: r.parent || "Parent",
      parentPhone: r.parentPhone || "",
      hasValidWhatsApp: norm.isValid,
      normalizedPhone: norm.normalized,
      formattedPhone: norm.formatted,
      maskedPhone: norm.masked,
      phoneError: norm.error,
      totalShares: r.totalShares,
      lastSharedAt: r.lastSharedAt || undefined,
    };
  });

  // Filter in memory for hasWhatsApp if specified
  let filtered = items;
  if (options.hasWhatsApp === "yes") {
    filtered = items.filter((item) => item.hasValidWhatsApp);
  } else if (options.hasWhatsApp === "no") {
    filtered = items.filter((item) => !item.hasValidWhatsApp);
  }

  const total = filtered.length;
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const paged = filtered.slice(offset, offset + limit);

  return { students: paged, total };
}

export interface StudentWhatsAppContext {
  student: DbStudent;
  school: {
    name: string;
    phone: string;
    email: string;
    address: string;
    academicYear: string;
  };
  phoneStatus: {
    raw: string;
    normalized: string;
    formatted: string;
    masked: string;
    isValid: boolean;
    error?: string;
  };
  attendance: {
    todayStatus: string;
    todayRemarks: string;
    monthlyPercentage: number;
    presentCount: number;
    absentCount: number;
    totalDays: number;
    recentDates: Array<{ date: string; status: string; remarks: string }>;
  };
  fees?: {
    totalFee: number;
    paidFee: number;
    pendingFee: number;
    dueDate: string;
    status: string;
    latestInvoice?: string;
  };
  results: Array<{
    examId: string;
    examName: string;
    subject: string;
    marks: number;
    maxMarks: number;
    percentage: number;
    grade: string;
    status: string;
  }>;
  homework: Array<{
    id: string;
    title: string;
    subject: string;
    dueDate: string;
    instructions: string;
  }>;
  timetable: Array<{
    subject: string;
    teacherName: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>;
  leaves: Array<{
    id: string;
    dates: string;
    reason: string;
    status: string;
    remarks: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    date: string;
  }>;
  recentShares: Array<{
    id: string;
    category: string;
    status: string;
    createdAt: string;
    userName: string;
  }>;
}

/**
 * Compiles complete context for a student across all 9 message categories.
 * Enforces role-based data isolation:
 * If the user is a TEACHER, teacherScope checks assigned classes,
 * and FINANCIAL data (fees) is strictly excluded.
 */
export async function getWhatsAppStudentContext(
  institutionId: string,
  studentId: string,
  user: { id: string; role: string; email: string },
): Promise<StudentWhatsAppContext> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  const student = await getStudent(institutionId, studentId);
  if (!student) {
    throw new Error("Student record not found or access unauthorized.");
  }

  // Teacher scope check: teachers can only access their assigned classes
  const isTeacher = user.role === "TEACHER";
  if (isTeacher) {
    const scope = await teacherPortalScope(institutionId, user.email);
    const assignedClassNames = new Set(
      scope.assignments.map((a) => a.className.toLowerCase().trim()),
    );
    if (!assignedClassNames.has(student.className.toLowerCase().trim())) {
      throw new Error("Access denied: You are not assigned to this student's class.");
    }
  }

  const school = await getInstitution(institutionId);
  const normPhone = normalizeWhatsAppPhone(student.parentPhone);

  // 1. Attendance Data
  const attendanceReport = await parentChildAttendance(institutionId, studentId);
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const todayRow = (await db.unsafe(
    "SELECT status, remarks FROM attendance WHERE institution_id=$1 AND student_id=$2 AND date=$3",
    [institutionId, studentId, todayStr] as never[],
  )) as Array<{ status: string; remarks: string }>;

  const todayAttendance = todayRow[0] || { status: "Present", remarks: "" };

  // 2. Fees Data (Omitted entirely if Teacher)
  let feesData: StudentWhatsAppContext["fees"] = undefined;
  if (!isTeacher) {
    const feeOverview = await parentChildFees(institutionId, studentId);
    const activeInvoice = feeOverview.invoices.find((i) => i.status !== "Paid") || feeOverview.invoices[0];
    feesData = {
      totalFee: Math.round(feeOverview.summary.totalFee),
      paidFee: Math.round(feeOverview.summary.paidFee),
      pendingFee: Math.round(feeOverview.summary.pendingFee),
      dueDate: activeInvoice?.dueDate || "End of term",
      status: activeInvoice?.status || (feeOverview.summary.pendingFee > 0 ? "Pending" : "Paid"),
      latestInvoice: activeInvoice?.invoiceNumber,
    };
  }

  // 3. Examination Results
  const resultsData = await parentChildResults(institutionId, studentId);
  const formattedResults = resultsData.slice(0, 10).map((r) => ({
    examId: r.examId,
    examName: r.examName,
    subject: r.subject,
    marks: r.marks,
    maxMarks: r.maxMarks,
    percentage: r.maxMarks > 0 ? Math.round((r.marks / r.maxMarks) * 100) : 0,
    grade: r.grade,
    status: r.status,
  }));

  // 4. Homework & Assignments
  const homeworkList = await parentChildHomework(institutionId, student.className, student.section);
  const formattedHomework = homeworkList.slice(0, 5).map((h) => ({
    id: h.id,
    title: h.title,
    subject: h.subject,
    dueDate: h.dueDate,
    instructions: h.description,
  }));

  // 5. Timetable Schedule
  const timetableSlots = await parentChildTimetable(
    institutionId,
    student.className,
    student.section,
    student.academicYear || school.academicYear || "",
  );

  // 6. Leaves (From attendance records marked as Leave/Excused)
  const leaveRows = attendanceReport.records
    .filter((r) => r.status === "Leave" || r.status === "Excused")
    .slice(0, 5)
    .map((r, i) => ({
      id: `att-leave-${i}`,
      dates: r.date,
      reason: r.remarks || "Personal / Medical Leave",
      status: "Approved",
      remarks: "Logged in school attendance register",
    }));

  // 7. Announcements
  const rawAnnouncements = (await listModuleRecords(institutionId, "announcements")) as Array<{
    id: string;
    title?: string;
    content?: string;
    date?: string;
    createdAt?: string;
  }>;
  const announcements = rawAnnouncements.slice(0, 5).map((a) => ({
    id: a.id,
    title: a.title || "School Notice",
    content: a.content || "",
    date: a.date || a.createdAt?.slice(0, 10) || todayStr,
  }));

  // 8. Recent Shares for this student
  const shareLogs = (await db.unsafe(
    `SELECT id, category, status, created_at::text AS "createdAt", user_name AS "userName"
     FROM whatsapp_share_logs
     WHERE institution_id=$1 AND student_id=$2
     ORDER BY created_at DESC LIMIT 5`,
    [institutionId, studentId] as never[],
  )) as Array<{ id: string; category: string; status: string; createdAt: string; userName: string }>;

  return {
    student,
    school: {
      name: school.name || "EduLedger Partner School",
      phone: school.phone || "School Office",
      email: school.email || "",
      address: school.address || "",
      academicYear: school.academicYear || "2026-2027",
    },
    phoneStatus: {
      raw: student.parentPhone || "",
      normalized: normPhone.normalized,
      formatted: normPhone.formatted,
      masked: normPhone.masked,
      isValid: normPhone.isValid,
      error: normPhone.error,
    },
    attendance: {
      todayStatus: todayAttendance.status || "Present",
      todayRemarks: todayAttendance.remarks || "",
      monthlyPercentage: attendanceReport.summary.attendancePercentage,
      presentCount: attendanceReport.summary.presentCount,
      absentCount: attendanceReport.summary.absentCount,
      totalDays: attendanceReport.summary.totalDays,
      recentDates: attendanceReport.records.slice(0, 5).map((r) => ({
        date: r.date,
        status: r.status,
        remarks: r.remarks,
      })),
    },
    fees: feesData,
    results: formattedResults,
    homework: formattedHomework,
    timetable: timetableSlots.map((t) => ({
      subject: t.subject,
      teacherName: t.teacherName || "Class Teacher",
      weekday: t.weekday,
      startTime: t.startTime,
      endTime: t.endTime,
    })),
    leaves: leaveRows,
    announcements,
    recentShares: shareLogs,
  };
}

/**
 * Log a share initiation event.
 * Note: Status is strictly 'WhatsApp Opened / Share Initiated'.
 * Never mark as 'Delivered', 'Sent', or 'Read' without independent verification.
 */
export async function logWhatsAppShareInitiation(input: {
  institutionId: string;
  studentId?: string;
  userId: string;
  userName: string;
  recipientPhone: string;
  recipientName?: string;
  category: WhatsAppCategory | string;
  messagePreview: string;
}): Promise<{ id: string; status: string; createdAt: string }> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  const id = randomUUID();
  const status = "WhatsApp Opened / Share Initiated";
  const preview = input.messagePreview.slice(0, 300);

  await db.unsafe(
    `INSERT INTO whatsapp_share_logs(
      id, institution_id, student_id, user_id, user_name, recipient_phone, recipient_name, category, message_preview, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.institutionId,
      input.studentId || null,
      input.userId,
      input.userName,
      input.recipientPhone,
      input.recipientName || "",
      input.category,
      preview,
      status,
    ] as never[],
  );

  return { id, status, createdAt: new Date().toISOString() };
}

/**
 * List communication history logs with masked phone numbers.
 */
export async function listWhatsAppShareLogs(
  institutionId: string,
  options: {
    studentId?: string;
    category?: string;
    limit?: number;
    offset?: number;
    teacherClasses?: string[];
  } = {},
): Promise<{ logs: Array<Record<string, unknown>>; total: number }> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  const where: string[] = ["l.institution_id = $1"];
  const args: unknown[] = [institutionId];
  let argIndex = 2;

  if (options.studentId) {
    where.push(`l.student_id = $${argIndex++}`);
    args.push(options.studentId);
  }

  if (options.category && options.category !== "ALL") {
    where.push(`l.category = $${argIndex++}`);
    args.push(options.category);
  }

  if (options.teacherClasses && options.teacherClasses.length > 0) {
    where.push(`(s.class_name IS NULL OR LOWER(s.class_name) = ANY($${argIndex++}))`);
    args.push(options.teacherClasses.map((c) => c.toLowerCase().trim()));
  }

  const query = `
    SELECT 
      l.id,
      l.institution_id AS "institutionId",
      l.student_id AS "studentId",
      COALESCE(s.name, 'All Students') AS "studentName",
      COALESCE(s.admission, '—') AS "admission",
      COALESCE(s.class_name, '—') AS "className",
      COALESCE(s.section, '—') AS "section",
      l.user_id AS "userId",
      l.user_name AS "userName",
      l.recipient_phone AS "recipientPhone",
      l.recipient_name AS "recipientName",
      l.category,
      l.message_preview AS "messagePreview",
      l.status,
      l.created_at::text AS "createdAt"
    FROM whatsapp_share_logs l
    LEFT JOIN students s ON s.id = l.student_id AND s.institution_id = l.institution_id
    WHERE ${where.join(" AND ")}
    ORDER BY l.created_at DESC
    LIMIT $${argIndex++} OFFSET $${argIndex++}
  `;

  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;
  args.push(limit, offset);

  const rows = (await db.unsafe(query, args as never[])) as Array<{
    id: string;
    institutionId: string;
    studentId: string | null;
    studentName: string;
    admission: string;
    className: string;
    section: string;
    userId: string;
    userName: string;
    recipientPhone: string;
    recipientName: string;
    category: string;
    messagePreview: string;
    status: string;
    createdAt: string;
  }>;

  // Mask recipient phone numbers for privacy
  const maskedLogs = rows.map((r) => ({
    ...r,
    maskedPhone: maskPhoneNumber(r.recipientPhone),
  }));

  const countQuery = `
    SELECT COUNT(*)::int AS count
    FROM whatsapp_share_logs l
    LEFT JOIN students s ON s.id = l.student_id AND s.institution_id = l.institution_id
    WHERE ${where.join(" AND ")}
  `;
  const countArgs = args.slice(0, argIndex - 3);
  const countResult = (await db.unsafe(countQuery, countArgs as never[])) as Array<{ count: number }>;
  const total = countResult[0]?.count ?? 0;

  return { logs: maskedLogs, total };
}

/**
 * List all templates for an institution:
 * merges system defaults with any custom templates authored by administrators.
 */
export async function listWhatsAppTemplates(institutionId: string): Promise<
  Array<{
    id: string;
    category: WhatsAppCategory;
    title: string;
    content: string;
    isCustom: boolean;
    isDefault: boolean;
  }>
> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  const customRows = (await db.unsafe(
    `SELECT id, category, title, content, is_default AS "isDefault"
     FROM whatsapp_custom_templates
     WHERE institution_id = $1
     ORDER BY category, title`,
    [institutionId] as never[],
  )) as Array<{
    id: string;
    category: string;
    title: string;
    content: string;
    isDefault: boolean;
  }>;

  const result: Array<{
    id: string;
    category: WhatsAppCategory;
    title: string;
    content: string;
    isCustom: boolean;
    isDefault: boolean;
  }> = [];

  const customCategories = new Set(customRows.map((r) => r.category));

  // Add system defaults
  for (const [cat, defaultText] of Object.entries(DEFAULT_TEMPLATES)) {
    const category = cat as WhatsAppCategory;
    const hasCustom = customRows.filter((r) => r.category === category);
    if (hasCustom.length === 0) {
      result.push({
        id: `default-${category.toLowerCase()}`,
        category,
        title: `Standard ${category.replace("_", " ")} Template`,
        content: defaultText,
        isCustom: false,
        isDefault: true,
      });
    }
  }

  // Add custom templates
  for (const r of customRows) {
    result.push({
      id: r.id,
      category: r.category as WhatsAppCategory,
      title: r.title,
      content: r.content,
      isCustom: true,
      isDefault: r.isDefault,
    });
  }

  return result;
}

/**
 * Save or update a custom WhatsApp template (Admin only).
 */
export async function saveWhatsAppCustomTemplate(
  institutionId: string,
  userId: string,
  input: {
    id?: string;
    category: WhatsAppCategory;
    title: string;
    content: string;
    isDefault?: boolean;
  },
): Promise<{ id: string }> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  const id = input.id || randomUUID();
  const isDefault = Boolean(input.isDefault);

  await db.unsafe(
    `INSERT INTO whatsapp_custom_templates(
      id, institution_id, category, title, content, is_default, created_by, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (institution_id, category, title)
    DO UPDATE SET content = EXCLUDED.content, is_default = EXCLUDED.is_default, updated_at = CURRENT_TIMESTAMP`,
    [id, institutionId, input.category, input.title.trim(), input.content.trim(), isDefault, userId] as never[],
  );

  return { id };
}

/**
 * Delete a custom template.
 */
export async function deleteWhatsAppCustomTemplate(
  institutionId: string,
  templateId: string,
): Promise<boolean> {
  await ensureWhatsAppClickToChatSchema();
  const db = await getDb();

  const res = (await db.unsafe(
    "DELETE FROM whatsapp_custom_templates WHERE institution_id = $1 AND id = $2 RETURNING id",
    [institutionId, templateId] as never[],
  )) as Array<{ id: string }>;

  return res.length > 0;
}

