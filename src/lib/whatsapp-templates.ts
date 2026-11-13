// src/lib/whatsapp-templates.ts
/**
 * WhatsApp Message Templates with Multi-Language Support (English, Kannada, Custom)
 * and dynamic placeholder interpolation.
 */

export interface MessageTemplateDefinition {
  id: string;
  name: string;
  category: string;
  language: "en" | "kn" | "custom";
  languageName: string;
  title: string;
  body: string;
  placeholders: string[];
}

export const SYSTEM_TEMPLATES: MessageTemplateDefinition[] = [
  // --- A. Attendance ---
  {
    id: "att_en",
    name: "attendance_alert_en",
    category: "Attendance",
    language: "en",
    languageName: "English",
    title: "Attendance Notice (English)",
    body: `Dear Parent,

This is an attendance update from {{school_name}}.

Student: {{student_name}}
Class: {{class_name}} {{section}}
Date: {{attendance_date}}
Status: {{attendance_status}}

Please contact the school if you need any clarification.

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "class_name",
      "section",
      "attendance_date",
      "attendance_status",
    ],
  },
  {
    id: "att_kn",
    name: "attendance_alert_kn",
    category: "Attendance",
    language: "kn",
    languageName: "ಕನ್ನಡ (Kannada)",
    title: "ಹಾಜರಾತಿ ಸೂಚನೆ (ಕನ್ನಡ)",
    body: `ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ,

ಇದು {{school_name}} ಶಾಲೆಯಿಂದ ಹಾಜರಾತಿ ಮಾಹಿತಿ.

ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು: {{student_name}}
ತರಗತಿ: {{class_name}} {{section}}
ದಿನಾಂಕ: {{attendance_date}}
ಸ್ಥಿತಿ: {{attendance_status}}

ಹೆಚ್ಚಿನ ವಿವರಗಳಿಗಾಗಿ ಶಾಲಾ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.

ಧನ್ಯವಾದಗಳೊಂದಿಗೆ,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "class_name",
      "section",
      "attendance_date",
      "attendance_status",
    ],
  },

  // --- B. Fee Reminder ---
  {
    id: "fee_rem_en",
    name: "fee_reminder_en",
    category: "Fees",
    language: "en",
    languageName: "English",
    title: "Fee Reminder (English)",
    body: `Dear Parent,

This is a fee reminder from {{school_name}}.

Student: {{student_name}}
Class: {{class_name}} {{section}}
Total Fee: ₹{{total_fee}}
Paid Amount: ₹{{paid_fee}}
Pending Amount: ₹{{pending_fee}}
Due Date: {{due_date}}

Please contact the school accounts office for assistance.

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "class_name",
      "section",
      "total_fee",
      "paid_fee",
      "pending_fee",
      "due_date",
    ],
  },
  {
    id: "fee_rem_kn",
    name: "fee_reminder_kn",
    category: "Fees",
    language: "kn",
    languageName: "ಕನ್ನಡ (Kannada)",
    title: "ಶುಲ್ಕ ಜ್ಞಾಪನೆ (ಕನ್ನಡ)",
    body: `ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ,

ಇದು {{school_name}} ಶಾಲೆಯಿಂದ ಶುಲ್ಕ ಪಾವತಿಯ ಜ್ಞಾಪನೆ.

ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು: {{student_name}}
ತರಗತಿ: {{class_name}} {{section}}
ಒಟ್ಟು ಶುಲ್ಕ: ₹{{total_fee}}
ಪಾವತಿಸಿದ ಮೊತ್ತ: ₹{{paid_fee}}
ಬಾಕಿ ಮೊತ್ತ: ₹{{pending_fee}}
ಅಂತಿಮ ದಿನಾಂಕ: {{due_date}}

ದಯವಿಟ್ಟು ಸಕಾಲದಲ್ಲಿ ಶುಲ್ಕ ಪಾವತಿಸಿ ಸಹಕರಿಸಿ.

ಧನ್ಯವಾದಗಳೊಂದಿಗೆ,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "class_name",
      "section",
      "total_fee",
      "paid_fee",
      "pending_fee",
      "due_date",
    ],
  },

  // --- C. Payment Confirmation ---
  {
    id: "pay_conf_en",
    name: "payment_confirmation_en",
    category: "Fees",
    language: "en",
    languageName: "English",
    title: "Fee Payment Confirmation (English)",
    body: `Dear Parent,

We have successfully received the fee payment at {{school_name}}.

Student: {{student_name}}
Receipt No: {{receipt_number}}
Amount Paid: ₹{{amount_paid}}
Payment Date: {{payment_date}}
Remaining Balance: ₹{{remaining_balance}}

Thank you for your prompt payment!

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "receipt_number",
      "amount_paid",
      "payment_date",
      "remaining_balance",
    ],
  },
  {
    id: "pay_conf_kn",
    name: "payment_confirmation_kn",
    category: "Fees",
    language: "kn",
    languageName: "ಕನ್ನಡ (Kannada)",
    title: "ಶುಲ್ಕ ಪಾವತಿ ದೃಢೀಕರಣ (ಕನ್ನಡ)",
    body: `ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ,

{{school_name}} ಶಾಲೆಯಲ್ಲಿ ಶುಲ್ಕ ಪಾವತಿಯನ್ನು ಸ್ವೀಕರಿಸಲಾಗಿದೆ.

ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು: {{student_name}}
ರಶೀದಿ ಸಂಖ್ಯೆ: {{receipt_number}}
ಪಾವತಿಸಿದ ಮೊತ್ತ: ₹{{amount_paid}}
ದಿನಾಂಕ: {{payment_date}}
ಉಳಿದ ಬಾಕಿ: ₹{{remaining_balance}}

ಸಕಾಲಿಕ ಪಾವತಿಗೆ ಧನ್ಯವಾದಗಳು!

ಇಂತಿ,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "receipt_number",
      "amount_paid",
      "payment_date",
      "remaining_balance",
    ],
  },

  // --- D. Examination Results ---
  {
    id: "exam_res_en",
    name: "exam_results_en",
    category: "Examinations",
    language: "en",
    languageName: "English",
    title: "Examination Results (English)",
    body: `Dear Parent,

The examination results for {{exam_name}} have been published by {{school_name}}.

Student: {{student_name}}
Class: {{class_name}} {{section}}
Marks Obtained: {{total_marks}} / {{max_marks}}
Percentage: {{percentage}}%
Grade: {{grade}}
Result Status: {{result_status}}

Congratulations to the student! You can view detailed subject-wise marks in the parent portal.

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "exam_name",
      "student_name",
      "class_name",
      "section",
      "total_marks",
      "max_marks",
      "percentage",
      "grade",
      "result_status",
    ],
  },
  {
    id: "exam_res_kn",
    name: "exam_results_kn",
    category: "Examinations",
    language: "kn",
    languageName: "ಕನ್ನಡ (Kannada)",
    title: "ಪರೀಕ್ಷಾ ಫಲಿತಾಂಶ (ಕನ್ನಡ)",
    body: `ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ,

{{school_name}} ಶಾಲೆಯ {{exam_name}} ಪರೀಕ್ಷೆಯ ಫಲಿತಾಂಶ ಪ್ರಕಟವಾಗಿದೆ.

ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು: {{student_name}}
ತರಗತಿ: {{class_name}} {{section}}
ಪಡೆದ ಅಂಕಗಳು: {{total_marks}} / {{max_marks}}
ಶೇಕಡಾವಾರು: {{percentage}}%
ಶ್ರೇಣಿ (Grade): {{grade}}
ಫಲಿತಾಂಶ: {{result_status}}

ವಿದ್ಯಾರ್ಥಿಗೆ ಶುಭಾಶಯಗಳು! ಸಂಪೂರ್ಣ ವಿಷಯವಾರು ಅಂಕಗಳನ್ನು ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿಸಬಹುದು.

ಧನ್ಯವಾದಗಳೊಂದಿಗೆ,
{{school_name}}`,
    placeholders: [
      "school_name",
      "exam_name",
      "student_name",
      "class_name",
      "section",
      "total_marks",
      "max_marks",
      "percentage",
      "grade",
      "result_status",
    ],
  },

  // --- E. Homework & Assignments ---
  {
    id: "hw_en",
    name: "homework_notice_en",
    category: "Academics",
    language: "en",
    languageName: "English",
    title: "New Homework Assigned (English)",
    body: `Dear Parent,

A new homework assignment has been assigned at {{school_name}}.

Student: {{student_name}}
Class: {{class_name}} {{section}}
Subject: {{subject}}
Title: {{homework_title}}
Due Date: {{due_date}}

Instructions: {{instructions}}

Please encourage your child to complete it on time.

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "class_name",
      "section",
      "subject",
      "homework_title",
      "due_date",
      "instructions",
    ],
  },
  {
    id: "hw_kn",
    name: "homework_notice_kn",
    category: "Academics",
    language: "kn",
    languageName: "ಕನ್ನಡ (Kannada)",
    title: "ಮನೆಕೆಲಸದ ಮಾಹಿತಿ (ಕನ್ನಡ)",
    body: `ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ,

{{school_name}} ಶಾಲೆಯಲ್ಲಿ ಹೊಸ ಮನೆಕೆಲಸವನ್ನು ನೀಡಲಾಗಿದೆ.

ವಿದ್ಯಾರ್ಥಿ: {{student_name}}
ತರಗತಿ: {{class_name}} {{section}}
ವಿಷಯ: {{subject}}
ಶೀರ್ಷಿಕೆ: {{homework_title}}
ಸಲ್ಲಿಸಬೇಕಾದ ದಿನಾಂಕ: {{due_date}}

ಸೂಚನೆ: {{instructions}}

ನಿಗದಿತ ಸಮಯದಲ್ಲಿ ಮನೆಕೆಲಸ ಪೂರ್ಣಗೊಳಿಸಲು ವಿದ್ಯಾರ್ಥಿಗೆ ಮಾರ್ಗದರ್ಶನ ನೀಡಿ.

ಧನ್ಯವಾದಗಳೊಂದಿಗೆ,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "class_name",
      "section",
      "subject",
      "homework_title",
      "due_date",
      "instructions",
    ],
  },

  // --- F. Timetable Notification ---
  {
    id: "tt_en",
    name: "timetable_update_en",
    category: "Timetable",
    language: "en",
    languageName: "English",
    title: "Timetable Schedule Update (English)",
    body: `Dear Parent,

This is to inform you that the class timetable for {{class_name}} {{section}} has been updated at {{school_name}}.

Effective Date: {{effective_date}}
Note: {{timetable_notes}}

Please check the student's timetable schedule in the portal for the updated period timings and subjects.

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "class_name",
      "section",
      "effective_date",
      "timetable_notes",
    ],
  },

  // --- G. Leave Updates ---
  {
    id: "leave_en",
    name: "leave_status_en",
    category: "Leave",
    language: "en",
    languageName: "English",
    title: "Leave Application Status (English)",
    body: `Dear Parent,

This is an update regarding the leave application submitted for {{student_name}} at {{school_name}}.

Dates: {{leave_dates}}
Status: {{leave_status}}
Decision Notes: {{decision_notes}}

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "student_name",
      "leave_dates",
      "leave_status",
      "decision_notes",
    ],
  },

  // --- H. School Announcements ---
  {
    id: "ann_en",
    name: "school_announcement_en",
    category: "Notices",
    language: "en",
    languageName: "English",
    title: "Official School Announcement (English)",
    body: `*OFFICIAL ANNOUNCEMENT*
From: {{school_name}}

Title: {{announcement_title}}
Date: {{announcement_date}}

{{announcement_content}}

For any questions, please contact the school administration.

Regards,
{{school_name}}`,
    placeholders: [
      "school_name",
      "announcement_title",
      "announcement_date",
      "announcement_content",
    ],
  },
  {
    id: "ann_kn",
    name: "school_announcement_kn",
    category: "Notices",
    language: "kn",
    languageName: "ಕನ್ನಡ (Kannada)",
    title: "ಶಾಲಾ ಪ್ರಕಟಣೆ (ಕನ್ನಡ)",
    body: `*ಶಾಲಾ ಅಧಿಕೃತ ಪ್ರಕಟಣೆ*
ಶಾಲೆ: {{school_name}}

ಶೀರ್ಷಿಕೆ: {{announcement_title}}
ದಿನಾಂಕ: {{announcement_date}}

{{announcement_content}}

ಹೆಚ್ಚಿನ ವಿವರಗಳಿಗಾಗಿ ಶಾಲಾ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.

ಧನ್ಯವಾದಗಳೊಂದಿಗೆ,
{{school_name}}`,
    placeholders: [
      "school_name",
      "announcement_title",
      "announcement_date",
      "announcement_content",
    ],
  },
];

/**
 * Replaces placeholders like {{key}} with corresponding values from the data map.
 */
export function interpolateTemplate(
  templateBody: string,
  variables: Record<string, string | number | null | undefined>
): string {
  return templateBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const val = variables[key];
    if (val !== undefined && val !== null && String(val).trim().length > 0) {
      return String(val);
    }
    return `[${key.replace(/_/g, " ")}]`;
  });
}

