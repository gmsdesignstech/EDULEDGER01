/**
 * EduLedger - WhatsApp Parent Communication Module
 * Official WhatsApp Click-to-Chat (wa.me) Integration
 * 
 * Free, direct, zero-credential WhatsApp messaging for schools.
 * No Meta Business API, no third-party SMS/messaging gateway, no monthly fees.
 */

export type WhatsAppCategory =
  | "STUDENT_INFO"
  | "ATTENDANCE"
  | "FEES"
  | "EXAM_RESULTS"
  | "HOMEWORK"
  | "TIMETABLE"
  | "LEAVE"
  | "ANNOUNCEMENT"
  | "CUSTOM";

export interface CategoryMetadata {
  id: WhatsAppCategory;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  requiresFinancePermission: boolean;
  defaultTemplateTitle: string;
}

export const WHATSAPP_CATEGORIES: CategoryMetadata[] = [
  {
    id: "STUDENT_INFO",
    title: "Student Information",
    shortTitle: "Student Info",
    description: "Share enrolled student profile, admission details, and class details with parents.",
    icon: "GraduationCap",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Enrolled Student Profile",
  },
  {
    id: "ATTENDANCE",
    title: "Attendance Updates",
    shortTitle: "Attendance",
    description: "Daily attendance status, monthly percentage, and attendance summary.",
    icon: "CalendarCheck2",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Daily Attendance Alert",
  },
  {
    id: "FEES",
    title: "Fee Information",
    shortTitle: "Fees",
    description: "Fee invoices, paid amount, pending balance, and payment reminders (Admin only).",
    icon: "IndianRupee",
    requiresFinancePermission: true,
    defaultTemplateTitle: "Fee Statement & Reminder",
  },
  {
    id: "EXAM_RESULTS",
    title: "Examination Results",
    shortTitle: "Exam Results",
    description: "Published examination marks, subject breakdown, percentage, and grade.",
    icon: "FileCheck2",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Term Examination Results",
  },
  {
    id: "HOMEWORK",
    title: "Homework & Assignments",
    shortTitle: "Homework",
    description: "Subject homework, instructions, and upcoming submission deadlines.",
    icon: "BookOpen",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Class Homework & Assignment",
  },
  {
    id: "TIMETABLE",
    title: "Class Timetable",
    shortTitle: "Timetable",
    description: "Daily class schedule, subjects, teachers, and period timings.",
    icon: "CalendarDays",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Daily Class Schedule",
  },
  {
    id: "LEAVE",
    title: "Leave Updates",
    shortTitle: "Leave Updates",
    description: "Student leave application status, dates, and administrative remarks.",
    icon: "Clock",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Leave Application Decision",
  },
  {
    id: "ANNOUNCEMENT",
    title: "School Announcements",
    shortTitle: "Announcements",
    description: "School holidays, events, circulars, and urgent school notices.",
    icon: "Megaphone",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Official School Notice",
  },
  {
    id: "CUSTOM",
    title: "Custom Message",
    shortTitle: "Custom",
    description: "Personalized communication tailored specifically for a student or parent.",
    icon: "MessageSquare",
    requiresFinancePermission: false,
    defaultTemplateTitle: "Direct Parent Communication",
  },
];

export interface PhoneNormalizationResult {
  raw: string;
  normalized: string; // purely digits with country code for wa.me URL (e.g., "919876543210")
  formatted: string;  // human readable (e.g., "+91 98765 43210")
  masked: string;     // privacy-safe (e.g., "+91 98*** **210")
  isValid: boolean;
  countryCode: string; // e.g. "91"
  error?: string;
}

/**
 * Normalizes phone numbers with special handling for Indian mobile numbers
 * and full support for international E.164 formats.
 * 
 * Rules:
 * 1. 10 digits starting with 6, 7, 8, or 9 -> Prepend '91' (Indian mobile).
 * 2. 11 digits starting with 0 followed by 6, 7, 8, 9 -> Strip '0' and prepend '91'.
 * 3. 12 digits starting with 91 followed by 6, 7, 8, 9 -> Valid Indian mobile.
 * 4. Other international numbers: 10 to 15 digits with valid country code.
 */
export function normalizeWhatsAppPhone(phone: string | null | undefined): PhoneNormalizationResult {
  if (!phone || typeof phone !== "string") {
    return {
      raw: "",
      normalized: "",
      formatted: "",
      masked: "—",
      isValid: false,
      countryCode: "",
      error: "Parent mobile number is missing",
    };
  }

  const raw = phone.trim();
  // Strip all non-digit characters except leading plus if present
  const hasPlus = raw.startsWith("+");
  const digitsOnly = raw.replace(/\D/g, "");

  if (!digitsOnly) {
    return {
      raw,
      normalized: "",
      formatted: "",
      masked: "—",
      isValid: false,
      countryCode: "",
      error: "Phone number contains no numeric digits",
    };
  }

  let normalized = digitsOnly;
  let countryCode = "";
  let isValid = false;

  // Case 1: Indian 10-digit mobile (starts with 6, 7, 8, or 9)
  if (/^[6-9]\d{9}$/.test(normalized)) {
    normalized = `91${normalized}`;
    countryCode = "91";
    isValid = true;
  }
  // Case 2: Indian 11-digit mobile starting with 0 (e.g. 09876543210)
  else if (/^0[6-9]\d{9}$/.test(normalized)) {
    normalized = `91${normalized.slice(1)}`;
    countryCode = "91";
    isValid = true;
  }
  // Case 3: Indian 12-digit mobile starting with 91 (e.g. 919876543210)
  else if (/^91[6-9]\d{9}$/.test(normalized)) {
    countryCode = "91";
    isValid = true;
  }
  // Case 4: International number with leading 00 (e.g. 0015551234567)
  else if (normalized.startsWith("00") && normalized.length >= 12 && normalized.length <= 17) {
    normalized = normalized.slice(2);
    if (/^\d{10,15}$/.test(normalized)) {
      countryCode = normalized.slice(0, 2);
      isValid = true;
    }
  }
  // Case 5: International number explicitly marked with + or valid E.164 length (10-15 digits)
  else if (/^\d{10,15}$/.test(normalized)) {
    countryCode = normalized.slice(0, Math.min(3, normalized.length - 7));
    isValid = true;
  } else {
    isValid = false;
  }

  // Format string for human readability
  let formatted = normalized;
  if (normalized.startsWith("91") && normalized.length === 12) {
    formatted = `+91 ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
  } else if (hasPlus || isValid) {
    formatted = `+${normalized}`;
  }

  const masked = maskPhoneNumber(normalized);

  return {
    raw,
    normalized,
    formatted,
    masked,
    isValid,
    countryCode,
    error: isValid ? undefined : "Phone number is not a valid 10-digit Indian or E.164 mobile number",
  };
}

/**
 * Mask phone number for privacy in UI logs and lists: +91 98*** **210
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "••••••";
  
  if (digits.startsWith("91") && digits.length === 12) {
    return `+91 ${digits.slice(2, 4)}*** **${digits.slice(-3)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 2)}*** **${digits.slice(-3)}`;
  }
  return `+${digits.slice(0, 3)}***${digits.slice(-3)}`;
}

/**
 * Build the official WhatsApp Click-to-Chat URL
 * Format: https://wa.me/<number>?text=<encoded_text>
 */
export function buildWhatsAppClickToChatUrl(phone: string, message: string): string {
  const norm = normalizeWhatsAppPhone(phone);
  if (!norm.isValid) {
    throw new Error(norm.error || "Cannot generate WhatsApp link for invalid phone number");
  }
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${norm.normalized}?text=${encodedText}`;
}

export interface WhatsAppTemplateData {
  school_name?: string;
  school_phone?: string;
  school_email?: string;
  school_address?: string;
  student_name?: string;
  admission_number?: string;
  class_name?: string;
  section?: string;
  roll_number?: string;
  academic_year?: string;
  gender?: string;
  blood_group?: string;
  parent_name?: string;
  parent_phone?: string;
  // Attendance
  attendance_date?: string;
  attendance_status?: string;
  attendance_percentage?: number | string;
  present_count?: number | string;
  absent_count?: number | string;
  attendance_summary?: string;
  // Fees
  total_fee?: number | string;
  paid_fee?: number | string;
  pending_fee?: number | string;
  due_date?: string;
  fee_status?: string;
  invoice_number?: string;
  // Exams
  exam_name?: string;
  percentage?: number | string;
  grade?: string;
  total_marks?: number | string;
  max_marks?: number | string;
  result_status?: string;
  subject_scores?: string;
  // Homework
  subject?: string;
  homework_title?: string;
  instructions?: string;
  // Timetable
  timetable_schedule?: string;
  // Leave
  leave_status?: string;
  leave_dates?: string;
  leave_reason?: string;
  leave_remarks?: string;
  // Announcement
  announcement_title?: string;
  announcement_content?: string;
  announcement_date?: string;
  // Custom
  custom_title?: string;
  custom_content?: string;
  [key: string]: unknown;
}

/**
 * Default templates for each of the 9 categories.
 * Crafted with WhatsApp markdown formatting (*bold*, _italic_), clean separators, and respectful tone.
 */
export const DEFAULT_TEMPLATES: Record<WhatsAppCategory, string> = {
  STUDENT_INFO: `🎓 *STUDENT PROFILE* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

Here are the enrolled academic details for *{{student_name}}*:

• *Student Name:* {{student_name}}
• *Admission No:* {{admission_number}}
• *Class & Section:* {{class_name}} - {{section}}
• *Roll Number:* {{roll_number}}
• *Academic Year:* {{academic_year}}
• *Gender:* {{gender}}
• *Blood Group:* {{blood_group}}

🏫 *School Details:*
{{school_name}}
📞 {{school_phone}}
📍 {{school_address}}

━━━━━━━━━━━━━━━━━━━━━
_This is an official communication from {{school_name}}._`,

  ATTENDANCE: `📅 *ATTENDANCE UPDATE* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

Attendance report for *{{student_name}}* (Class {{class_name}}-{{section}}):

• *Date:* {{attendance_date}}
• *Today's Status:* *{{attendance_status}}*
• *Overall Attendance:* {{attendance_percentage}}%
• *Term Summary:* Present: {{present_count}} days | Absent: {{absent_count}} days

{{attendance_summary}}

━━━━━━━━━━━━━━━━━━━━━
_Regular attendance supports consistent student progress. For questions, please contact the class teacher._`,

  FEES: `💳 *FEE STATEMENT & REMINDER* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

Fee statement for *{{student_name}}* (Adm No: {{admission_number}}):

• *Total Annual Fee:* ₹{{total_fee}}
• *Amount Paid:* ₹{{paid_fee}}
• *Remaining Balance:* *₹{{pending_fee}}*
• *Due Date:* {{due_date}}
• *Current Status:* {{fee_status}}

━━━━━━━━━━━━━━━━━━━━━
_Please ensure outstanding balances are cleared on or before the due date. For fee receipts, visit the school administration office._`,

  EXAM_RESULTS: `📊 *EXAMINATION RESULTS* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

Result statement for *{{student_name}}* (Class {{class_name}}-{{section}}):

*Exam:* {{exam_name}}
*Academic Year:* {{academic_year}}

*Subject-Wise Marks:*
{{subject_scores}}

━━━━━━━━━━━━━━━━━━━━━
• *Total Marks:* {{total_marks}} / {{max_marks}}
• *Percentage:* {{percentage}}%
• *Grade:* *{{grade}}*
• *Final Result:* *{{result_status}}*

_We encourage you to review your child's performance and celebrate their progress!_`,

  HOMEWORK: `📝 *HOMEWORK & ASSIGNMENTS* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

New assignment for *{{student_name}}* (Class {{class_name}}-{{section}}):

• *Subject:* {{subject}}
• *Topic:* *{{homework_title}}*
• *Submission Due Date:* {{due_date}}

📖 *Instructions:*
{{instructions}}

━━━━━━━━━━━━━━━━━━━━━
_Please ensure {{student_name}} completes and submits their work on time._`,

  TIMETABLE: `🗓️ *CLASS TIMETABLE* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

Weekly class schedule for *{{student_name}}* (Class {{class_name}}-{{section}}):

{{timetable_schedule}}

━━━━━━━━━━━━━━━━━━━━━
_Please help your child pack books and materials according to their daily schedule._`,

  LEAVE: `📋 *LEAVE APPLICATION STATUS* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

Leave application update for *{{student_name}}* (Class {{class_name}}-{{section}}):

• *Status:* *{{leave_status}}*
• *Leave Period:* {{leave_dates}}
• *Reason:* {{leave_reason}}
• *School Remarks:* {{leave_remarks}}

━━━━━━━━━━━━━━━━━━━━━
_For any updates or medical records, please submit them to the school office._`,

  ANNOUNCEMENT: `📢 *SCHOOL ANNOUNCEMENT* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear Parents,

*{{announcement_title}}*

{{announcement_content}}

• *Date / Effective Period:* {{announcement_date}}
• *Applies to:* Class {{class_name}}-{{section}}

━━━━━━━━━━━━━━━━━━━━━
_Issued by Administration, {{school_name}}._`,

  CUSTOM: `💬 *MESSAGE FROM SCHOOL* - {{school_name}}
━━━━━━━━━━━━━━━━━━━━━
Dear {{parent_name}},

Regarding *{{student_name}}* (Class {{class_name}}-{{section}}):

*{{custom_title}}*

{{custom_content}}

━━━━━━━━━━━━━━━━━━━━━
_Warm regards,_
*{{school_name}}*
📞 {{school_phone}}`,
};

/**
 * Replaces dynamic placeholders {{variable}} with actual database values.
 * Missing/null/undefined values are handled safely and never leak as "undefined" or "null".
 */
export function renderWhatsAppTemplate(template: string, data: WhatsAppTemplateData): string {
  if (!template) return "";

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const val = data[key];
    if (val === null || val === undefined || val === "") {
      // Clean fallback according to key
      if (key === "parent_name") return "Parent / Guardian";
      if (key === "student_name") return "Student";
      if (key === "roll_number") return "—";
      if (key === "blood_group") return "Not specified";
      if (key === "gender") return "—";
      if (key === "school_name") return "EduLedger Partner School";
      if (key === "school_phone") return "School Office";
      if (key === "school_address") return "";
      if (key === "instructions") return "Please refer to the classroom notebook.";
      if (key === "attendance_summary") return "";
      if (key === "attendance_status") return "Recorded";
      if (key === "attendance_percentage") return "100";
      if (key === "total_fee" || key === "paid_fee" || key === "pending_fee") return "0";
      if (key === "percentage") return "0";
      if (key === "grade") return "—";
      if (key === "result_status") return "Completed";
      if (key === "due_date") return "As scheduled";
      if (key === "timetable_schedule") return "Please check with the class teacher for today's periods.";
      if (key === "leave_remarks") return "None";
      if (key === "leave_status") return "Processed";
      return "—";
    }
    return String(val);
  }).replace(/\n{3,}/g, "\n\n").trim();
}

