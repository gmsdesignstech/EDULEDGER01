// src/lib/whatsapp-n8n-definitions.ts
/**
 * Metadata and workflow definitions for all 8 EduLedger n8n automated parent communication workflows.
 */

export interface N8nWorkflowMeta {
  id: string;
  code: string;
  name: string;
  trigger: string;
  triggerDescription: string;
  category: string;
  summary: string;
  filename: string;
  sampleMessageEn: string;
  sampleMessageKn: string;
}

export const N8N_WORKFLOWS_CATALOG: N8nWorkflowMeta[] = [
  {
    id: "workflow-a",
    code: "WF-A",
    name: "Attendance Notification",
    trigger: "attendance.marked",
    triggerDescription: "Triggered whenever student attendance is submitted and marked Absent or on Leave.",
    category: "Attendance",
    summary: "Verifies student absence, checks parent consent, interpolates details, sends WhatsApp message via Cloud API, and reports delivery status to EduLedger.",
    filename: "workflow-a-attendance.json",
    sampleMessageEn: "Dear Parent, This is an attendance update from Greenwood High. Student: Aarav Sharma, Class: 5 A, Date: 13 Nov 2026, Status: Absent.",
    sampleMessageKn: "ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ, ಇದು ಗ್ರೀನ್‌ವುಡ್ ಶಾಲೆಯಿಂದ ಹಾಜರಾತಿ ಮಾಹಿತಿ. ವಿದ್ಯಾರ್ಥಿ: ಆರವ್ ಶರ್ಮ, ತರಗತಿ: 5 A, ದಿನಾಂಕ: 13 Nov 2026, ಸ್ಥಿತಿ: ಗೈರುಹಾಜರಿ.",
  },
  {
    id: "workflow-b",
    code: "WF-B",
    name: "Fee Reminder",
    trigger: "fee.reminder",
    triggerDescription: "Scheduled daily at 9:00 AM (or manual trigger) to check overdue and upcoming fees.",
    category: "Fees",
    summary: "Identifies students with pending dues, checks deduplication to prevent spam, verifies consent, and sends personalized WhatsApp payment reminders.",
    filename: "workflow-b-fee-reminder.json",
    sampleMessageEn: "Dear Parent, This is a fee reminder from Greenwood High. Student: Aarav Sharma, Class: 5 A, Total: ₹25,000, Paid: ₹15,000, Pending: ₹10,000, Due: 20 Nov 2026.",
    sampleMessageKn: "ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ, ಇದು ಶುಲ್ಕ ಪಾವತಿಯ ಜ್ಞಾಪನೆ. ವಿದ್ಯಾರ್ಥಿ: ಆರವ್ ಶರ್ಮ, ಒಟ್ಟು ಶುಲ್ಕ: ₹25,000, ಪಾವತಿಸಿದ ಮೊತ್ತ: ₹15,000, ಬಾಕಿ ಮೊತ್ತ: ₹10,000, ಅಂತಿಮ ದಿನಾಂಕ: 20 Nov 2026.",
  },
  {
    id: "workflow-c",
    code: "WF-C",
    name: "Payment Confirmation",
    trigger: "fee.payment_received",
    triggerDescription: "Triggered automatically when a fee receipt or payment transaction is recorded in EduLedger.",
    category: "Fees",
    summary: "Sends instant digital receipt confirmation with receipt number, paid amount, and remaining balance to the verified parent WhatsApp number.",
    filename: "workflow-c-payment-confirmation.json",
    sampleMessageEn: "Dear Parent, We have received fee payment of ₹10,000 for Aarav Sharma. Receipt: REC-849201, Date: 13 Nov 2026, Remaining: ₹0. Thank you!",
    sampleMessageKn: "ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ, ಆರವ್ ಶರ್ಮ ವಿದ್ಯಾರ್ಥಿಯ ₹10,000 ಶುಲ್ಕ ಪಾವತಿಯನ್ನು ಸ್ವೀಕರಿಸಲಾಗಿದೆ. ರಶೀದಿ: REC-849201, ದಿನಾಂಕ: 13 Nov 2026, ಬಾಕಿ: ₹0. ಧನ್ಯವಾದಗಳು!",
  },
  {
    id: "workflow-d",
    code: "WF-D",
    name: "Examination Results",
    trigger: "examination.published",
    triggerDescription: "Triggered when term/annual exam results are officially published by the school administration.",
    category: "Examinations",
    summary: "Verifies results are officially published (never sends drafts), compiles marks, percentage, grade and result status, and delivers result cards.",
    filename: "workflow-d-examination-results.json",
    sampleMessageEn: "Dear Parent, Examination results for Term 1 have been published. Student: Aarav Sharma, Marks: 465/500, Percentage: 93%, Grade: A+, Status: Pass.",
    sampleMessageKn: "ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ, Term 1 ಪರೀಕ್ಷಾ ಫಲಿತಾಂಶ ಪ್ರಕಟವಾಗಿದೆ. ವಿದ್ಯಾರ್ಥಿ: ಆರವ್ ಶರ್ಮ, ಅಂಕಗಳು: 465/500, ಶೇಕಡಾವಾರು: 93%, ಶ್ರೇಣಿ: A+, ಫಲಿತಾಂಶ: ಉತ್ತೀರ್ಣ.",
  },
  {
    id: "workflow-e",
    code: "WF-E",
    name: "Homework Notification",
    trigger: "homework.published",
    triggerDescription: "Triggered when a subject teacher publishes homework or class assignments in EduLedger.",
    category: "Academics",
    summary: "Notifies parents of students in the assigned class section with assignment subject, title, instructions, and submission deadline.",
    filename: "workflow-e-homework-notification.json",
    sampleMessageEn: "Dear Parent, New homework assigned: Mathematics - Quadratic Equations exercises 4.1 to 4.3. Due Date: 15 Nov 2026.",
    sampleMessageKn: "ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ, ಹೊಸ ಮನೆಕೆಲಸವನ್ನು ನೀಡಲಾಗಿದೆ: ಗಣಿತ - ಅಭ್ಯಾಸ 4.1 ರಿಂದ 4.3. ಸಲ್ಲಿಸಬೇಕಾದ ದಿನಾಂಕ: 15 Nov 2026.",
  },
  {
    id: "workflow-f",
    code: "WF-F",
    name: "School Announcements",
    trigger: "announcement.published",
    triggerDescription: "Triggered when administrator broadcasts school-wide or class-specific notices or holiday alerts.",
    category: "Notices",
    summary: "Requires administrator confirmation for bulk broadcasting. Sends holiday notifications, circulars, and event updates to consented parents.",
    filename: "workflow-f-school-announcements.json",
    sampleMessageEn: "*OFFICIAL ANNOUNCEMENT* Greenwood High: School will remain closed on Friday, 14 Nov 2026 on account of Children's Day celebrations.",
    sampleMessageKn: "*ಶಾಲಾ ಅಧಿಕೃತ ಪ್ರಕಟಣೆ* ಗ್ರೀನ್‌ವುಡ್ ಶಾಲೆ: ಮಕ್ಕಳ ದಿನಾಚರಣೆ ಪ್ರಯುಕ್ತ ಶುಕ್ರವಾರ 14 Nov 2026 ರಂದು ಶಾಲೆಗೆ ರಜೆ ಇರುತ್ತದೆ.",
  },
  {
    id: "workflow-g",
    code: "WF-G",
    name: "Leave Notification",
    trigger: "leave.status_updated",
    triggerDescription: "Triggered when a student leave request is approved or rejected by the class teacher/principal.",
    category: "Leave",
    summary: "Sends immediate leave decision notification with authorized dates and administrative remarks to the parent.",
    filename: "workflow-g-leave-notification.json",
    sampleMessageEn: "Dear Parent, Leave application for Aarav Sharma for 18-20 Nov 2026 has been Approved by the Principal.",
    sampleMessageKn: "ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ, ಆರವ್ ಶರ್ಮ ವಿದ್ಯಾರ್ಥಿಯ 18-20 Nov 2026 ದಿನಾಂಕದ ರಜೆ ಅರ್ಜಿಯು ಅನುಮೋದಿಸಲ್ಪಟ್ಟಿದೆ.",
  },
  {
    id: "workflow-h",
    code: "WF-H",
    name: "Timetable Notification",
    trigger: "timetable.updated",
    triggerDescription: "Triggered when weekly class timetable schedule or period timings are updated.",
    category: "Timetable",
    summary: "Delivers timetable change notifications strictly to parents of students in the affected class and section.",
    filename: "workflow-h-timetable-notification.json",
    sampleMessageEn: "Dear Parent, The class timetable for Grade 5 Section A has been updated with revised science laboratory timings.",
    sampleMessageKn: "ಗೌರವಾನ್ವಿತ ಪೋಷಕರೇ, ತರಗತಿ 5 A ಯ ವೇಳಾಪಟ್ಟಿಯನ್ನು ನವೀಕರಿಸಲಾಗಿದೆ. ವಿವರಗಳನ್ನು ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ನೋಡಿ.",
  },
];

