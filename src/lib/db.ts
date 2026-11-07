import "server-only";
import postgres from "postgres";
import { assertRuntimePostgresTarget } from "./postgres-target";
import { createHash, randomUUID } from "node:crypto";
import { admissionYear, formatRollNumber, isValidStudentId, normalizeSchoolCode, parseStudentId } from "./roll-number";
import { parseTeacherClasses, serializeTeacherClasses } from "./teacher-classes";
import { schoolParts, workingMinutes, zonedInstant, nextDate, previousDate, validDate, validTime, validTimezone, type StaffAttendanceStatus } from "./staff-time";
import { ANNUAL_PRICE_PER_STUDENT, STARTER_ANNUAL_PRICE, STARTER_PLAN_ID, SUBSCRIPTION_PLANS, getPlan, isValidSubscriptionPricing, starterPlanForStudentCount } from "./subscription-plans";
import { defaultTimetableSettings, timeMinutes, timetableSlots, validateTimetableSettings, type TimetableSettings } from "./timetable";
import { calculateStudentResult, defaultResultSettings, toCent, validateGradeBands, type ResultSettings, type MarkStatus, type SubjectOutcome } from "./results";
import {assertWhatsAppDispatchEnabled,maskWhatsAppNumber,mayApplyWhatsAppProviderEvent,metaCloudWhatsAppProvider,normalizeWhatsAppNumber,signWhatsAppDocument,whatsappDispatchEnabled,whatsappInstitutionProviderStatus,whatsappProviderCredentials,whatsappWebhookConfigurationStatus,whatsappWebhookEventKey,WhatsAppProviderError} from "./whatsapp";
import {persistWhatsAppWebhookAtomically} from "./whatsapp-webhook-transaction";
import {buildAudiencePreview,messageCategory,whatsappTemplateVariablesSafe,type AudienceRecord,type ConsentStatus,type TemplateRecord} from "./whatsapp-messaging";
import {authorizeWhatsAppDispatch,type WhatsAppDispatchAuthorizationSnapshot} from "./whatsapp-dispatch-policy";
import {evaluateWhatsAppDispatchRateLimit} from "./whatsapp-rate-limit";
import { WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT, whatsappAddonQuote } from "./whatsapp-pricing";
import { calculatePayrollAmounts } from "./payroll-calculations";
import { getSiteOrigin } from "./site-url";
import { normalizeEligibleStudentCount } from "./student-eligibility";
import { subscriptionCapacityQuote } from "./subscription-change";
import {
  getDaysRemaining,
  getSubscriptionStatus,
  addOneYear,
  isSubscriptionActive,
  resolveSubscriptionPeriod,
  type SubscriptionStatus,
} from "./subscription";

export type DbUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  institutionId: string;
};
type FeeStatus = "Paid" | "Partially Paid" | "Pending" | "Overdue";
export type DbStudent = {
  id: string;
  name: string;
  admission: string;
  gender: string;
  photoPath: string;
  bloodGroup: string;
  motherName: string;
  specialQuota: string;
  specialQuotaDescription: string;
  dateOfBirth: string;
  className: string;
  section: string;
  grade: string;
  rollNumber: string;
  parent: string;
  parentPhone: string;
  whatsappEnabled: boolean;
  whatsappAttendance: boolean;
  whatsappAcademics: boolean;
  whatsappFees: boolean;
  whatsappNotices: boolean;
  whatsappGeneral: boolean;
  parentEmail: string;
  address: string;
  admissionDate: string;
  attendance: number;
  fee: FeeStatus;
  totalFee: number;
  paidFee: number;
  pendingFee: number;
  status: string;
  leavingDate: string;
  leavingReason: string;
  leavingRemarks: string;
  academicYear: string;
  createdAt: string;
};
export type DbTeacher = {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  department: string;
  subject: string;
  classes: string;
  joiningDate: string;
  salary: number;
  status: string;
  createdAt: string;
};
export type DbClass = {
  id: string;
  name: string;
  section: string;
  teacher: string;
  academicYear: string;
  capacity: number;
  currentStudents: number;
  status: string;
};
export type DbPayment = {
  id: string;
  feeId: string;
  studentId: string;
  studentName: string;
  admission: string;
  className: string;
  section: string;
  rollNumber: string;
  parent: string;
  invoiceNumber: string;
  feeType: string;
  academicYear: string;
  discount: number;
  paymentFrequency: string;
  originalAmount: number;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  discountReason: string;
  lateFee: number;
  netPayable: number;
  finalAmount: number;
  receiptNumber: string;
  amount: number;
  method: string;
  transactionId: string;
  paymentDate: string;
  status: string;
  notes: string;
  previouslyPaid: number;
  totalPaid: number;
  remainingBalance: number;
  createdAt: string;
};
export type StudentInput = {
  name: string;
  admission: string;
  gender: string;
  bloodGroup?: string;
  motherName?: string;
  specialQuota?: string;
  specialQuotaDescription?: string;
  dateOfBirth: string;
  className: string;
  section: string;
  rollNumber?: string;
  parent: string;
  parentPhone: string;
  whatsappEnabled?: boolean;
  whatsappAttendance?: boolean;
  whatsappAcademics?: boolean;
  whatsappFees?: boolean;
  whatsappNotices?: boolean;
  whatsappGeneral?: boolean;
  parentEmail: string;
  address: string;
  admissionDate: string;
  totalFee: number;
  academicYear: string;
  dueDate: string;
};
export type SubscriptionSummary = {
  status: SubscriptionStatus;
  planId: string | null;
  planName: string | null;
  studentCapacity: number | null;
  studentCountAtPurchase: number | null;
  pricingModel: "FIXED" | "PER_STUDENT";
  planVersion: number;
  pricePerStudent: number;
  annualAmount: number;
  amountPaid: number;
  activationDate: string | null;
  expiryDate: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  razorpaySignature: string | null;
  studentUsage: number;
  billingStudentCount: number;
  daysRemaining: number;
  daysUntilStart: number;
  durationProgress: number;
  currency: string;
  paymentStatus: string;
  autoRenew: boolean;
};
export type WhatsAppAddonSummary = {
  status: string;
  studentCount: number;
  pricePerStudent: number;
  amountPaid: number;
  activationDate: string;
  expiryDate: string;
  paymentStatus: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
};
type ModuleRecord = { id: string; [key: string]: string };

type QueryResult = Record<string, unknown>[] & { count?: number };
type Sql = {
  unsafe(query: string, args?: unknown[]): Promise<QueryResult>;
  begin<T>(callback: (sql: Sql) => Promise<T>): Promise<T>;
};

let client: Sql | undefined, initializing: Promise<void> | undefined;

function connection() {
  assertRuntimePostgresTarget();
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error("No PostgreSQL connection URL is configured. Set DATABASE_URL to the approved PostgreSQL target.");
  if (!/^postgres(?:ql)?:\/\//i.test(url))
    throw new Error(
      "DATABASE_URL must be a postgres:// or postgresql:// TCP connection URL. This application cannot use a prisma+postgres:// Accelerate URL with postgres.js.",
    );
  if (client) return client;
  const sql = postgres(url, {
    // Serverless instances share the provider pool. Keep each warm instance
    // deliberately small so admin dashboards cannot exhaust connections when
    // several aggregate queries and cold starts overlap.
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    ssl: process.env.NODE_ENV === "production" ? "require" : undefined,
  });
  const adapter: Sql = {
    unsafe: (query, args = []) =>
      sql.unsafe(query, args as never[]) as unknown as Promise<QueryResult>,
    async begin<T>(callback: (sql: Sql) => Promise<T>) {
      const result = await sql.begin((transaction) => {
        const transactionAdapter: Sql = {
          unsafe: (query, args = []) =>
            transaction.unsafe(query, args as never[]) as unknown as Promise<QueryResult>,
          begin: async () => {
            throw new Error("Nested database transactions are not supported");
          },
        };
        return callback(transactionAdapter);
      });
      return result as unknown as T;
    },
  };
  client = adapter;
  return adapter;
}
function bind(query: string, sql: Sql) {
  let n = 0;
  return query.replace(/\?/g, () => `$${++n}`);
}
async function rows<T extends Record<string, unknown>>(
  query: string,
  args: unknown[] = [],
  sql: Sql = connection(),
) {
  return (await sql.unsafe(bind(query, sql), args)) as unknown as T[];
}
async function row<T extends Record<string, unknown>>(
  query: string,
  args: unknown[] = [],
  sql: Sql = connection(),
) {
  return (await rows<T>(query, args, sql))[0];
}
async function run(
  query: string,
  args: unknown[] = [],
  sql: Sql = connection(),
) {
  return Number((await sql.unsafe(bind(query, sql), args)).count ?? 0);
}

async function initialize() {
  if (initializing) return initializing;
  initializing = (async () => {
    if (process.env.EDULEDGER_ENVIRONMENT === "development" && process.env.EDULEDGER_ALLOW_SCHEMA_INITIALIZATION !== "1")
      throw new Error("Development schema initialization is disabled until the database schema is owner-verified.");
    if (process.env.EDULEDGER_ENVIRONMENT === "test" && process.env.TEST_DATABASE_ALLOW_SCHEMA_INIT !== "1")
      throw new Error("Test schema initialization requires explicit authorization for the isolated test target.");
    const sql = connection();
    await sql.unsafe(`
CREATE TABLE IF NOT EXISTS institutions(id TEXT PRIMARY KEY,name TEXT NOT NULL,planned_student_count INTEGER NOT NULL DEFAULT 0,subscription_start_date TIMESTAMPTZ,subscription_end_date TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,institution_id TEXT NOT NULL REFERENCES institutions(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),name TEXT NOT NULL,admission TEXT NOT NULL,gender TEXT NOT NULL DEFAULT '',photo_path TEXT,date_of_birth TEXT NOT NULL DEFAULT '',class_name TEXT NOT NULL DEFAULT '',section TEXT NOT NULL DEFAULT '',grade TEXT NOT NULL,parent TEXT NOT NULL,roll_number TEXT NOT NULL DEFAULT '',parent_phone TEXT NOT NULL DEFAULT '',parent_email TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',admission_date TEXT NOT NULL DEFAULT '',attendance INTEGER NOT NULL DEFAULT 100,fee TEXT NOT NULL DEFAULT 'Pending',total_fee DOUBLE PRECISION NOT NULL DEFAULT 0,paid_fee DOUBLE PRECISION NOT NULL DEFAULT 0,pending_fee DOUBLE PRECISION NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'Active',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,admission));
CREATE TABLE IF NOT EXISTS module_records(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL,module TEXT NOT NULL,data JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS teachers(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),name TEXT NOT NULL,employee_id TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',department TEXT NOT NULL DEFAULT '',subject TEXT NOT NULL DEFAULT '',assigned_classes TEXT NOT NULL DEFAULT '',joining_date TEXT NOT NULL,salary DOUBLE PRECISION NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'Active',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,employee_id));
CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),name TEXT NOT NULL,section TEXT NOT NULL,teacher TEXT NOT NULL DEFAULT '',academic_year TEXT NOT NULL,capacity INTEGER NOT NULL DEFAULT 40,status TEXT NOT NULL DEFAULT 'Active',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,name,section,academic_year));
CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Leave','Excused','Half-day','Half Day')),remarks TEXT NOT NULL DEFAULT '',marked_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(student_id,date));
CREATE TABLE IF NOT EXISTS attendance_audit_logs(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),attendance_id TEXT,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,academic_year TEXT NOT NULL,class_name TEXT NOT NULL,section TEXT NOT NULL,date TEXT NOT NULL,previous_status TEXT,new_status TEXT NOT NULL,previous_remarks TEXT NOT NULL DEFAULT '',new_remarks TEXT NOT NULL DEFAULT '',changed_by TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS school_holidays(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),academic_year TEXT NOT NULL,date TEXT NOT NULL,name TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'Public Holiday' CHECK(type IN ('Public Holiday','School Holiday','Vacation','Weather Emergency','Administrative')),description TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,date));
CREATE TABLE IF NOT EXISTS fees(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,invoice_number TEXT NOT NULL UNIQUE,fee_type TEXT NOT NULL DEFAULT 'Annual Fee',academic_year TEXT NOT NULL,total_amount DOUBLE PRECISION NOT NULL CHECK(total_amount>=0),discount DOUBLE PRECISION NOT NULL DEFAULT 0,final_amount DOUBLE PRECISION NOT NULL CHECK(final_amount>=0),paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0,pending_amount DOUBLE PRECISION NOT NULL CHECK(pending_amount>=0),due_date TEXT NOT NULL,status TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),student_id TEXT NOT NULL REFERENCES students(id),fee_id TEXT NOT NULL REFERENCES fees(id),receipt_number TEXT NOT NULL UNIQUE,amount DOUBLE PRECISION NOT NULL CHECK(amount>0),payment_method TEXT NOT NULL,transaction_id TEXT NOT NULL DEFAULT '',payment_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Success',notes TEXT NOT NULL DEFAULT '',request_id TEXT,created_by TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),receipt_number TEXT NOT NULL UNIQUE,student_id TEXT NOT NULL REFERENCES students(id),payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),invoice_number TEXT NOT NULL,amount DOUBLE PRECISION NOT NULL,payment_method TEXT NOT NULL,transaction_id TEXT NOT NULL DEFAULT '',issued_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Issued',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS activities(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),type TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,student_id TEXT,payment_id TEXT,amount DOUBLE PRECISION,timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,status TEXT NOT NULL DEFAULT 'Success');
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),user_id TEXT,type TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',read_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS whatsapp_configurations(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,enabled BOOLEAN NOT NULL DEFAULT FALSE,business_account_id TEXT NOT NULL DEFAULT '',phone_number_id TEXT NOT NULL DEFAULT '',display_number TEXT NOT NULL DEFAULT '',access_token_ciphertext TEXT NOT NULL DEFAULT '',configuration_status TEXT NOT NULL DEFAULT 'Not Configured',webhook_status TEXT NOT NULL DEFAULT 'Not Configured',auto_absence BOOLEAN NOT NULL DEFAULT FALSE,auto_fee_receipt BOOLEAN NOT NULL DEFAULT FALSE,auto_fee_reminder BOOLEAN NOT NULL DEFAULT FALSE,auto_marksheet BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS whatsapp_templates(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,name TEXT NOT NULL,category TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'en',provider_template_name TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,variables JSONB NOT NULL DEFAULT '[]'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,name));
CREATE TABLE IF NOT EXISTS whatsapp_messages(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,student_id TEXT REFERENCES students(id) ON DELETE SET NULL,recipient_name TEXT NOT NULL DEFAULT '',recipient_phone TEXT NOT NULL,message_type TEXT NOT NULL,template_name TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'en',parameters JSONB NOT NULL DEFAULT '[]'::jsonb,document_kind TEXT,document_reference TEXT,provider_message_id TEXT,idempotency_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Queued',attempt_count INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,error_code TEXT NOT NULL DEFAULT '',error_message TEXT NOT NULL DEFAULT '',sent_by TEXT NOT NULL REFERENCES users(id),sent_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,read_at TIMESTAMPTZ,failed_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,idempotency_key),UNIQUE(provider_message_id));
CREATE TABLE IF NOT EXISTS whatsapp_consent_events(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,contact_fingerprint TEXT NOT NULL,status TEXT NOT NULL,source TEXT NOT NULL,changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS whatsapp_webhook_events(id TEXT PRIMARY KEY,provider_event_key TEXT NOT NULL UNIQUE,provider_message_id TEXT NOT NULL,event_status TEXT NOT NULL,event_at TIMESTAMPTZ,payload_hash TEXT NOT NULL,processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS whatsapp_addon_subscriptions(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,student_count INTEGER NOT NULL CHECK(student_count>0),price_per_student DOUBLE PRECISION NOT NULL CHECK(price_per_student>0),amount_paid DOUBLE PRECISION NOT NULL CHECK((student_count<=100 AND amount_paid=10000) OR (student_count>100 AND amount_paid=student_count*price_per_student)),status TEXT NOT NULL CHECK(status IN ('PENDING','ACTIVE','EXPIRED','FAILED','CANCELLED')),payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending','Paid','Failed','Cancelled')),currency TEXT NOT NULL DEFAULT 'INR' CHECK(currency='INR'),activation_date TIMESTAMPTZ NOT NULL,expiry_date TIMESTAMPTZ NOT NULL,razorpay_order_id TEXT NOT NULL UNIQUE,razorpay_payment_id TEXT UNIQUE,razorpay_signature TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK(expiry_date>activation_date));
CREATE TABLE IF NOT EXISTS settings(institution_id TEXT PRIMARY KEY REFERENCES institutions(id),academic_year TEXT NOT NULL DEFAULT '2026-2027',school_address TEXT NOT NULL DEFAULT '',school_phone TEXT NOT NULL DEFAULT '',school_email TEXT NOT NULL DEFAULT '',logo_url TEXT NOT NULL DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS academic_years(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),name TEXT NOT NULL,start_month INTEGER NOT NULL DEFAULT 4 CHECK(start_month BETWEEN 1 AND 12),end_month INTEGER NOT NULL DEFAULT 3 CHECK(end_month BETWEEN 1 AND 12),status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Archived')),is_active BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,name));
CREATE TABLE IF NOT EXISTS institution_classes(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,name));
CREATE TABLE IF NOT EXISTS institution_sections(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),class_id TEXT NOT NULL REFERENCES institution_classes(id) ON DELETE RESTRICT,name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(class_id,name));
CREATE TABLE IF NOT EXISTS school_assets(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),kind TEXT NOT NULL CHECK(kind IN ('logo','signature','payment-qr') OR kind LIKE 'student-photo:%' OR kind LIKE 'payment-screenshot:%'),mime_type TEXT NOT NULL,data BYTEA NOT NULL,size_bytes INTEGER NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,kind));
CREATE TABLE IF NOT EXISTS student_enrollments(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,academic_year TEXT NOT NULL,class_name TEXT NOT NULL,section TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Active',promoted_from_enrollment_id TEXT REFERENCES student_enrollments(id) ON DELETE SET NULL,promoted_at TIMESTAMPTZ,promoted_by TEXT REFERENCES users(id) ON DELETE SET NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,student_id,academic_year));
CREATE TABLE IF NOT EXISTS promotion_batches(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),source_academic_year TEXT NOT NULL,target_academic_year TEXT NOT NULL,source_class TEXT NOT NULL,source_section TEXT NOT NULL DEFAULT '',target_class TEXT NOT NULL,target_section TEXT NOT NULL DEFAULT '',promoted_by TEXT NOT NULL REFERENCES users(id),promoted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,status TEXT NOT NULL DEFAULT 'Completed',correction_reason TEXT);
CREATE TABLE IF NOT EXISTS promotion_items(id TEXT PRIMARY KEY,batch_id TEXT NOT NULL REFERENCES promotion_batches(id) ON DELETE RESTRICT,institution_id TEXT NOT NULL REFERENCES institutions(id),student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,source_enrollment_id TEXT NOT NULL REFERENCES student_enrollments(id),target_enrollment_id TEXT NOT NULL REFERENCES student_enrollments(id),status TEXT NOT NULL DEFAULT 'Promoted',error_message TEXT NOT NULL DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,student_id,target_enrollment_id));
CREATE TABLE IF NOT EXISTS student_demotions(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,previous_class_id TEXT REFERENCES institution_classes(id),new_class_id TEXT REFERENCES institution_classes(id),previous_section_id TEXT REFERENCES institution_sections(id),new_section_id TEXT REFERENCES institution_sections(id),previous_academic_year_id TEXT REFERENCES academic_years(id),new_academic_year_id TEXT REFERENCES academic_years(id),previous_class TEXT NOT NULL,new_class TEXT NOT NULL,previous_section TEXT NOT NULL,new_section TEXT NOT NULL,previous_year TEXT NOT NULL,new_year TEXT NOT NULL,reason TEXT NOT NULL,remarks TEXT NOT NULL DEFAULT '',changed_by TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,undone_by TEXT REFERENCES users(id),undone_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS counters(institution_id TEXT NOT NULL,kind TEXT NOT NULL,year TEXT NOT NULL,value INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(institution_id,kind,year));
CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),user_id TEXT,action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT,details JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscription_plans(id TEXT PRIMARY KEY,name TEXT NOT NULL UNIQUE,student_limit INTEGER NOT NULL,price DOUBLE PRECISION NOT NULL,billing_period TEXT NOT NULL DEFAULT 'year',active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),plan_id TEXT NOT NULL REFERENCES subscription_plans(id),student_capacity INTEGER NOT NULL,price_per_student DOUBLE PRECISION NOT NULL DEFAULT 0,amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0,status TEXT NOT NULL,activation_date TIMESTAMPTZ,expiry_date TIMESTAMPTZ,razorpay_order_id TEXT NOT NULL UNIQUE,razorpay_payment_id TEXT UNIQUE,razorpay_signature TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscription_payments(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),plan TEXT NOT NULL,student_capacity INTEGER NOT NULL,amount DOUBLE PRECISION NOT NULL,razorpay_payment_id TEXT NOT NULL UNIQUE,payment_date TEXT NOT NULL,starts_at TIMESTAMPTZ NOT NULL,ends_at TIMESTAMPTZ NOT NULL,status TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscription_adjustments(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),subscription_id TEXT NOT NULL REFERENCES subscriptions(id),old_capacity INTEGER NOT NULL,new_capacity INTEGER NOT NULL,amount DOUBLE PRECISION NOT NULL DEFAULT 0,credit_amount DOUBLE PRECISION NOT NULL DEFAULT 0,status TEXT NOT NULL,razorpay_order_id TEXT UNIQUE,razorpay_payment_id TEXT UNIQUE,created_by TEXT REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS razorpay_webhook_events(id TEXT PRIMARY KEY,event_type TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscription_notification_events(id TEXT PRIMARY KEY,subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,institution_id TEXT NOT NULL REFERENCES institutions(id),milestone TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'SENT',attempts INTEGER NOT NULL DEFAULT 1,last_error TEXT NOT NULL DEFAULT '',sent_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(subscription_id,milestone));
CREATE TABLE IF NOT EXISTS subscription_processing_logs(id TEXT PRIMARY KEY,started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,finished_at TIMESTAMPTZ,status TEXT NOT NULL,checked_count INTEGER NOT NULL DEFAULT 0,expired_count INTEGER NOT NULL DEFAULT 0,notification_count INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS timetable_entries(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),class_name TEXT NOT NULL,section TEXT NOT NULL,academic_year TEXT NOT NULL,subject TEXT NOT NULL,teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 6),start_time TEXT NOT NULL,end_time TEXT NOT NULL,generated BOOLEAN NOT NULL DEFAULT FALSE,status TEXT NOT NULL DEFAULT 'Published' CHECK(status IN ('Draft','Published','Archived')),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_active_slot ON timetable_entries(institution_id,class_name,section,academic_year,weekday,start_time) WHERE status<>'Archived';
CREATE TABLE IF NOT EXISTS class_exams(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),class_name TEXT NOT NULL,section TEXT NOT NULL,academic_year TEXT NOT NULL,name TEXT NOT NULL,exam_date TEXT NOT NULL,subject TEXT NOT NULL,max_marks DOUBLE PRECISION NOT NULL,passing_marks DOUBLE PRECISION NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS class_results(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),exam_id TEXT NOT NULL REFERENCES class_exams(id) ON DELETE CASCADE,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,marks DOUBLE PRECISION NOT NULL,grade TEXT NOT NULL,status TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(exam_id,student_id));
CREATE TABLE IF NOT EXISTS account_transactions(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),academic_year TEXT NOT NULL,transaction_type TEXT NOT NULL CHECK(transaction_type IN ('income','expense')),category TEXT NOT NULL,amount_paise INTEGER NOT NULL CHECK(amount_paise>0),transaction_date TEXT NOT NULL,description TEXT NOT NULL,payment_method TEXT NOT NULL,reference_number TEXT NOT NULL DEFAULT '',source_type TEXT NOT NULL DEFAULT 'cash_book',source_id TEXT,status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Voided')),notes TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS salaries(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),employee_key TEXT NOT NULL,teacher_id TEXT REFERENCES teachers(id) ON DELETE RESTRICT,user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,employee_name TEXT NOT NULL,employee_number TEXT NOT NULL,employee_role TEXT NOT NULL,department TEXT NOT NULL DEFAULT '',designation TEXT NOT NULL DEFAULT '',salary_month INTEGER NOT NULL CHECK(salary_month BETWEEN 1 AND 12),salary_year INTEGER NOT NULL CHECK(salary_year BETWEEN 2000 AND 2200),basic_paise INTEGER NOT NULL CHECK(basic_paise>=0),allowances_paise INTEGER NOT NULL DEFAULT 0 CHECK(allowances_paise>=0),bonus_paise INTEGER NOT NULL DEFAULT 0 CHECK(bonus_paise>=0),overtime_paise INTEGER NOT NULL DEFAULT 0 CHECK(overtime_paise>=0),other_earnings_paise INTEGER NOT NULL DEFAULT 0 CHECK(other_earnings_paise>=0),gross_paise INTEGER NOT NULL CHECK(gross_paise>=0),deductions_paise INTEGER NOT NULL DEFAULT 0 CHECK(deductions_paise>=0),advance_deduction_paise INTEGER NOT NULL DEFAULT 0 CHECK(advance_deduction_paise>=0),other_deductions_paise INTEGER NOT NULL DEFAULT 0 CHECK(other_deductions_paise>=0),total_deductions_paise INTEGER NOT NULL CHECK(total_deductions_paise>=0),net_paise INTEGER NOT NULL CHECK(net_paise>=0),paid_paise INTEGER NOT NULL DEFAULT 0 CHECK(paid_paise>=0),payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending','Paid','Partially Paid','Cancelled','On Hold')),payment_date TEXT,payment_method TEXT,payment_reference TEXT NOT NULL DEFAULT '',payment_notes TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',payslip_number TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(employee_key,salary_month,salary_year));
CREATE TABLE IF NOT EXISTS salary_payment_events(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),salary_id TEXT NOT NULL REFERENCES salaries(id) ON DELETE RESTRICT,request_id TEXT NOT NULL,amount_paise INTEGER NOT NULL CHECK(amount_paise>0),account_transaction_id TEXT NOT NULL REFERENCES account_transactions(id) ON DELETE RESTRICT,created_by TEXT NOT NULL REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,request_id));
CREATE TABLE IF NOT EXISTS parent_students(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,relationship TEXT NOT NULL DEFAULT 'Parent',is_primary BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(parent_user_id,student_id));
CREATE TABLE IF NOT EXISTS parent_invitations(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,parent_name TEXT NOT NULL,parent_email TEXT NOT NULL,parent_phone TEXT NOT NULL DEFAULT '',invitation_code TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','EXPIRED')),expires_at TIMESTAMPTZ NOT NULL,created_by TEXT REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,accepted_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS fcm_device_tokens(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token TEXT NOT NULL UNIQUE,device_type TEXT NOT NULL DEFAULT 'web',user_agent TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,revoked_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS notification_events(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),event_key TEXT NOT NULL UNIQUE,event_type TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,data JSONB NOT NULL DEFAULT '{}'::jsonb,deep_link TEXT NOT NULL DEFAULT '',recipient_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK(status IN ('QUEUED','PROCESSED','FAILED')),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notification_deliveries(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),event_id TEXT REFERENCES notification_events(id) ON DELETE CASCADE,notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,device_token_id TEXT REFERENCES fcm_device_tokens(id) ON DELETE SET NULL,channel TEXT NOT NULL DEFAULT 'FCM' CHECK(channel IN ('FCM','IN_APP')),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','DELIVERED','FAILED','REVOKED')),attempt_count INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 3,provider_message_id TEXT,error_code TEXT NOT NULL DEFAULT '',error_message TEXT NOT NULL DEFAULT '',next_retry_at TIMESTAMPTZ,sent_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS school_notification_settings(institution_id TEXT PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,push_enabled BOOLEAN NOT NULL DEFAULT TRUE,student_absent BOOLEAN NOT NULL DEFAULT TRUE,attendance_correction BOOLEAN NOT NULL DEFAULT TRUE,fee_payment BOOLEAN NOT NULL DEFAULT TRUE,fee_reminders BOOLEAN NOT NULL DEFAULT TRUE,homework BOOLEAN NOT NULL DEFAULT TRUE,exam_results BOOLEAN NOT NULL DEFAULT TRUE,announcements BOOLEAN NOT NULL DEFAULT TRUE,teacher_leave BOOLEAN NOT NULL DEFAULT TRUE,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_students_institution ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_super_admin ON users(role) WHERE role='SUPER_ADMIN';
CREATE INDEX IF NOT EXISTS idx_module_records ON module_records(institution_id,module);
CREATE INDEX IF NOT EXISTS idx_attendance_scope ON attendance(institution_id,date,status);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_scope ON attendance_audit_logs(institution_id,class_name,section,date);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_student ON attendance_audit_logs(student_id,date);
CREATE INDEX IF NOT EXISTS idx_school_holidays_scope ON school_holidays(institution_id,academic_year,date);
CREATE INDEX IF NOT EXISTS idx_fees_scope ON fees(institution_id,status,due_date);
CREATE INDEX IF NOT EXISTS idx_payments_scope ON payments(institution_id,payment_date,created_at);
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_entries(institution_id,class_name,academic_year);
CREATE INDEX IF NOT EXISTS idx_exams_class ON class_exams(institution_id,class_name,academic_year);
CREATE INDEX IF NOT EXISTS idx_accounts_scope ON account_transactions(institution_id,academic_year,transaction_date,status);
CREATE INDEX IF NOT EXISTS idx_salaries_scope ON salaries(institution_id,salary_year,salary_month,payment_status);
CREATE INDEX IF NOT EXISTS idx_salaries_employee ON salaries(employee_key,created_at);
CREATE INDEX IF NOT EXISTS idx_salaries_payment_date ON salaries(payment_date);
CREATE INDEX IF NOT EXISTS idx_salary_payment_events_salary ON salary_payment_events(institution_id,salary_id,created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(status,expiry_date);
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_school ON subscription_adjustments(institution_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id,read_at,created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue ON whatsapp_messages(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_history ON whatsapp_messages(institution_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_student ON whatsapp_messages(institution_id,student_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_addon_school ON whatsapp_addon_subscriptions(institution_id,status,expiry_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_source ON account_transactions(institution_id,source_type,source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_academic_years_scope ON academic_years(institution_id,status,is_active);
CREATE INDEX IF NOT EXISTS idx_institution_classes_scope ON institution_classes(institution_id,status,sort_order);
CREATE INDEX IF NOT EXISTS idx_institution_sections_scope ON institution_sections(institution_id,class_id,status,sort_order);
CREATE INDEX IF NOT EXISTS idx_enrollments_scope ON student_enrollments(institution_id,academic_year,class_name,section,status);
CREATE INDEX IF NOT EXISTS idx_promotion_batches_scope ON promotion_batches(institution_id,promoted_at);
CREATE INDEX IF NOT EXISTS idx_promotion_items_scope ON promotion_items(institution_id,student_id,created_at);
CREATE INDEX IF NOT EXISTS idx_student_demotions_scope ON student_demotions(institution_id,student_id,created_at);
CREATE INDEX IF NOT EXISTS idx_parent_students_user ON parent_students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_invitations_code ON parent_invitations(invitation_code,status);
CREATE INDEX IF NOT EXISTS idx_parent_invitations_student ON parent_invitations(institution_id,student_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_device_tokens(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_inst ON fcm_device_tokens(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_events_key ON notification_events(event_key);
CREATE INDEX IF NOT EXISTS idx_notif_events_inst ON notification_events(institution_id, event_type);
CREATE INDEX IF NOT EXISTS idx_notif_deliv_status ON notification_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_notif_deliv_user ON notification_deliveries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_deliv_event ON notification_deliveries(event_id);
`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS admin_settings(id TEXT PRIMARY KEY,application_name TEXT NOT NULL DEFAULT 'EduLedger',support_email TEXT NOT NULL DEFAULT '',currency TEXT NOT NULL DEFAULT 'INR',timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',session_timeout_minutes INTEGER NOT NULL DEFAULT 10080,updated_by TEXT,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
    const additions={settings:["result_grade_bands TEXT NOT NULL DEFAULT ''","result_overall_pass_percent INTEGER NOT NULL DEFAULT 35","result_require_subject_pass BOOLEAN NOT NULL DEFAULT TRUE","result_ranking_enabled BOOLEAN NOT NULL DEFAULT FALSE","result_principal_remarks TEXT NOT NULL DEFAULT ''","result_class_teacher_remarks TEXT NOT NULL DEFAULT ''","result_report_format TEXT NOT NULL DEFAULT 'Standard'","timetable_start_time TEXT NOT NULL DEFAULT '09:00'","timetable_end_time TEXT NOT NULL DEFAULT '16:00'","timetable_period_minutes INTEGER NOT NULL DEFAULT 40","timetable_short_break_minutes INTEGER NOT NULL DEFAULT 15","timetable_lunch_minutes INTEGER NOT NULL DEFAULT 40","timetable_periods_per_day INTEGER NOT NULL DEFAULT 9","timetable_working_days TEXT NOT NULL DEFAULT '1,2,3,4,5'","timetable_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'","school_code TEXT NOT NULL DEFAULT ''","dise_code TEXT NOT NULL DEFAULT ''","website TEXT NOT NULL DEFAULT ''","city TEXT NOT NULL DEFAULT ''","state TEXT NOT NULL DEFAULT ''","pin_code TEXT NOT NULL DEFAULT ''","principal_name TEXT NOT NULL DEFAULT ''","registration_number TEXT NOT NULL DEFAULT ''","affiliation TEXT NOT NULL DEFAULT ''","motto TEXT NOT NULL DEFAULT ''","school_type TEXT NOT NULL DEFAULT ''","fee_receipt_title TEXT NOT NULL DEFAULT 'Fee Payment Receipt'","fee_receipt_subheader TEXT NOT NULL DEFAULT 'Standard Fee Receipt Template'","payslip_title TEXT NOT NULL DEFAULT 'Pay Slip'","payslip_subheader TEXT NOT NULL DEFAULT 'Standard Pay Slip Template'","footer_text TEXT NOT NULL DEFAULT ''","signature_label TEXT NOT NULL DEFAULT 'Authorized Signatory'","attendance_correction_window_hours INTEGER NOT NULL DEFAULT 24","upi_enabled BOOLEAN NOT NULL DEFAULT FALSE","upi_id TEXT NOT NULL DEFAULT ''","payee_name TEXT NOT NULL DEFAULT ''","payment_method_name TEXT NOT NULL DEFAULT 'School UPI / QR Code'","bank_name TEXT NOT NULL DEFAULT ''","account_number TEXT NOT NULL DEFAULT ''","ifsc_code TEXT NOT NULL DEFAULT ''","payment_instructions TEXT NOT NULL DEFAULT ''"],students:["blood_group TEXT","mother_name TEXT","special_quota TEXT","special_quota_description TEXT","academic_year TEXT NOT NULL DEFAULT ''","leaving_date TEXT","leaving_reason TEXT NOT NULL DEFAULT ''","graduation_date TEXT","leaving_remarks TEXT NOT NULL DEFAULT ''","photo_path TEXT"],payments:["payment_frequency TEXT NOT NULL DEFAULT 'Custom'","original_amount DOUBLE PRECISION NOT NULL DEFAULT 0","discount_type TEXT NOT NULL DEFAULT 'Fixed'","discount_value DOUBLE PRECISION NOT NULL DEFAULT 0","discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0","discount_reason TEXT NOT NULL DEFAULT ''","late_fee DOUBLE PRECISION NOT NULL DEFAULT 0","net_payable DOUBLE PRECISION NOT NULL DEFAULT 0"],users:["status TEXT NOT NULL DEFAULT 'Active'","last_login_at TIMESTAMPTZ"],institutions:["status TEXT NOT NULL DEFAULT 'Active'"],subscriptions:["payment_status TEXT NOT NULL DEFAULT 'Pending'","plan_type TEXT NOT NULL DEFAULT 'Yearly'","currency TEXT NOT NULL DEFAULT 'INR'","renewal_date TIMESTAMPTZ","auto_renew BOOLEAN NOT NULL DEFAULT FALSE","last_notification_sent TIMESTAMPTZ","grace_period_days INTEGER NOT NULL DEFAULT 0"],notifications:["link TEXT NOT NULL DEFAULT ''","delivery_status TEXT NOT NULL DEFAULT 'SENT'"],admin_settings:["subscription_warning_days TEXT NOT NULL DEFAULT '30,15,7,3,1,0,-1'","subscription_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE","in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE","email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE","subscription_grace_days INTEGER NOT NULL DEFAULT 0"]} as const;

      for(const [table,definitions] of Object.entries(additions))for(const definition of definitions)await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${definition}`);

    const fixedPricingAdditions={subscriptions:["student_count_at_purchase INTEGER","pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT'","plan_version INTEGER NOT NULL DEFAULT 1"],subscription_plans:["pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT'","plan_version INTEGER NOT NULL DEFAULT 1","effective_at TIMESTAMPTZ","eligible_new_schools BOOLEAN NOT NULL DEFAULT FALSE"],subscription_payments:["student_count_at_purchase INTEGER","pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT'","plan_version INTEGER NOT NULL DEFAULT 1"]} as const;

      for(const [table,definitions] of Object.entries(fixedPricingAdditions))for(const definition of definitions)await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${definition}`);

    const whatsappStudentAdditions=["parent_relationship TEXT NOT NULL DEFAULT ''","parent_whatsapp TEXT NOT NULL DEFAULT ''","alternate_whatsapp TEXT NOT NULL DEFAULT ''","whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE","whatsapp_attendance BOOLEAN NOT NULL DEFAULT FALSE","whatsapp_academics BOOLEAN NOT NULL DEFAULT FALSE","whatsapp_fees BOOLEAN NOT NULL DEFAULT FALSE","whatsapp_notices BOOLEAN NOT NULL DEFAULT FALSE","whatsapp_general BOOLEAN NOT NULL DEFAULT FALSE","whatsapp_consent_status TEXT NOT NULL DEFAULT 'UNKNOWN'","whatsapp_consent_at TIMESTAMPTZ","whatsapp_consent_source TEXT NOT NULL DEFAULT ''","whatsapp_opted_out_at TIMESTAMPTZ","whatsapp_contact_verified_at TIMESTAMPTZ"];
    for(const definition of whatsappStudentAdditions)await sql.unsafe(`ALTER TABLE students ADD COLUMN IF NOT EXISTS ${definition}`);
    const templateAdditions=["approval_status TEXT NOT NULL DEFAULT 'UNKNOWN'","provider_category TEXT NOT NULL DEFAULT ''","rejection_reason TEXT NOT NULL DEFAULT ''","provider_updated_at TIMESTAMPTZ","last_synced_at TIMESTAMPTZ"];
    for(const definition of templateAdditions)await sql.unsafe(`ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS ${definition}`);
    const messageAdditions=["scheduled_at TIMESTAMPTZ","cancelled_at TIMESTAMPTZ","claimed_at TIMESTAMPTZ","lease_owner TEXT","lease_expires_at TIMESTAMPTZ","provider_status_at TIMESTAMPTZ","outcome_class TEXT NOT NULL DEFAULT ''","last_worker_id TEXT NOT NULL DEFAULT ''"];
    for(const definition of messageAdditions)await sql.unsafe(`ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS ${definition}`);
    await sql.unsafe("ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_id TEXT");
    await sql.unsafe("CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_request_id ON payments(institution_id,request_id) WHERE request_id IS NOT NULL");

      await sql.unsafe("ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS generated BOOLEAN NOT NULL DEFAULT FALSE");
      await sql.unsafe("ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Published'");
      await sql.unsafe("ALTER TABLE timetable_entries DROP CONSTRAINT IF EXISTS timetable_entries_institution_id_class_name_section_academic_year_weekday_start_time_key");
      await sql.unsafe("CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_active_slot ON timetable_entries(institution_id,class_name,section,academic_year,weekday,start_time) WHERE status<>'Archived'");
      await sql.unsafe("CREATE INDEX IF NOT EXISTS idx_timetable_published_scope ON timetable_entries(institution_id,academic_year,class_name,section,weekday,start_time) WHERE status='Published'");

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS result_examinations(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),name TEXT NOT NULL,academic_year TEXT NOT NULL,class_name TEXT NOT NULL,section TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,publication_date TEXT,status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Marks Entry Open','Marks Entry Closed','Results Under Review','Approved','Published','Archived')),created_by TEXT REFERENCES users(id),verified_by TEXT REFERENCES users(id),approved_by TEXT REFERENCES users(id),published_by TEXT REFERENCES users(id),published_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,academic_year,class_name,section,name));
CREATE INDEX IF NOT EXISTS idx_result_examinations_scope ON result_examinations(institution_id,academic_year,class_name,section,status);
CREATE INDEX IF NOT EXISTS idx_result_examinations_publish ON result_examinations(institution_id,status,published_at);`);
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS result_publication_snapshots(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),examination_id TEXT NOT NULL REFERENCES result_examinations(id) ON DELETE RESTRICT,version INTEGER NOT NULL,snapshot JSONB NOT NULL,published_by TEXT NOT NULL REFERENCES users(id),published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(examination_id,version));
CREATE INDEX IF NOT EXISTS idx_result_snapshots_scope ON result_publication_snapshots(institution_id,examination_id,version);`);
    const resultAdditions={class_exams:["result_examination_id TEXT REFERENCES result_examinations(id)","max_marks_cent INTEGER","passing_marks_cent INTEGER","required BOOLEAN NOT NULL DEFAULT TRUE"],class_results:["marks_cent INTEGER","mark_status TEXT NOT NULL DEFAULT 'Scored'","remarks TEXT NOT NULL DEFAULT ''","updated_by TEXT REFERENCES users(id)","updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"]} as const;
    for(const [table,definitions] of Object.entries(resultAdditions))for(const definition of definitions)await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${definition}`);
    await sql.unsafe("CREATE UNIQUE INDEX IF NOT EXISTS idx_class_exam_group_subject ON class_exams(result_examination_id,subject) WHERE result_examination_id IS NOT NULL");
    await sql.unsafe("CREATE INDEX IF NOT EXISTS idx_class_results_exam ON class_results(institution_id,exam_id,student_id)");
    const duplicateRoll=await row<{count:number}>("SELECT COUNT(*)::int count FROM (SELECT 1 FROM students WHERE roll_number<>'' GROUP BY institution_id,roll_number HAVING COUNT(*)>1) duplicates",[],sql);
    if(!duplicateRoll.count) await sql.unsafe("CREATE UNIQUE INDEX IF NOT EXISTS students_school_roll_unique ON students(institution_id,roll_number) WHERE roll_number<>''");
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS staff_attendance_settings(institution_id TEXT PRIMARY KEY REFERENCES institutions(id),work_start_time TEXT NOT NULL DEFAULT '09:00',work_end_time TEXT NOT NULL DEFAULT '17:00',late_after_time TEXT NOT NULL DEFAULT '09:15',break_minutes INTEGER NOT NULL DEFAULT 30,working_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6',timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',allow_self_checkin BOOLEAN NOT NULL DEFAULT FALSE,correction_requires_approval BOOLEAN NOT NULL DEFAULT FALSE,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS staff_attendance(id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id),staff_key TEXT NOT NULL,teacher_id TEXT REFERENCES teachers(id) ON DELETE RESTRICT,user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,attendance_date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Half Day','On Leave','Holiday','Work From Home')),check_in_at TIMESTAMPTZ,check_out_at TIMESTAMPTZ,break_minutes INTEGER NOT NULL DEFAULT 0,total_work_minutes INTEGER,remarks TEXT NOT NULL DEFAULT '',created_by TEXT REFERENCES users(id),updated_by TEXT REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,staff_key,attendance_date),CHECK((teacher_id IS NULL) <> (user_id IS NULL)));
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(institution_id,attendance_date,status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_person ON staff_attendance(institution_id,staff_key,attendance_date);`);
    for (const p of SUBSCRIPTION_PLANS)
      await run(
        "INSERT INTO subscription_plans(id,name,student_limit,price,billing_period,active,pricing_model,plan_version,effective_at,eligible_new_schools)VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,student_limit=EXCLUDED.student_limit,price=EXCLUDED.price,billing_period=EXCLUDED.billing_period,active=EXCLUDED.active,pricing_model=EXCLUDED.pricing_model,plan_version=EXCLUDED.plan_version,effective_at=EXCLUDED.effective_at,eligible_new_schools=EXCLUDED.eligible_new_schools,updated_at=CURRENT_TIMESTAMP",
        [p.id,p.name,p.id==="annual-service"?2147483647:p.studentLimit,p.id==="annual-service"?p.pricePerStudent:p.price,p.billingPeriod,p.active,p.pricingModel,p.version,p.effectiveAt,p.eligibleNewSchools],
        sql,
      );
    await sql.unsafe("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_per_student NUMERIC(12,2) NOT NULL DEFAULT 0");
    await sql.unsafe("ALTER TABLE institutions ADD COLUMN IF NOT EXISTS planned_student_count INTEGER NOT NULL DEFAULT 0");await sql.unsafe("ALTER TABLE institutions ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ");await sql.unsafe("ALTER TABLE institutions ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ")

      await sql.unsafe(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'whatsapp_addon_amount_matches_students') THEN ALTER TABLE whatsapp_addon_subscriptions DROP CONSTRAINT whatsapp_addon_amount_matches_students; ALTER TABLE whatsapp_addon_subscriptions ADD CONSTRAINT whatsapp_addon_amount_matches_students CHECK ((student_count <= 100 AND amount_paid = 10000) OR (student_count > 100 AND amount_paid = student_count * price_per_student)); END IF; END $$;`);


      await sql.unsafe(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_status_check') THEN ALTER TABLE attendance DROP CONSTRAINT attendance_status_check; END IF; ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK(status IN ('Present','Absent','Late','Leave','Excused','Half-day','Half Day')); END $$;`);

      await sql.unsafe(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'school_assets' AND constraint_name = 'school_assets_kind_check') THEN
          ALTER TABLE school_assets DROP CONSTRAINT school_assets_kind_check;
        END IF;
        ALTER TABLE school_assets ADD CONSTRAINT school_assets_kind_check CHECK(kind IN ('logo','signature','payment-qr') OR kind LIKE 'student-photo:%' OR kind LIKE 'payment-screenshot:%');
      END $$;`);

      await sql.unsafe(`CREATE TABLE IF NOT EXISTS school_qr_payments(
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        fee_id TEXT NOT NULL REFERENCES fees(id) ON DELETE RESTRICT,
        amount DOUBLE PRECISION NOT NULL CHECK(amount > 0),
        utr_number TEXT NOT NULL,
        payment_date TEXT NOT NULL,
        screenshot_asset_id TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','REJECTED','REFUNDED')),
        rejection_reason TEXT NOT NULL DEFAULT '',
        verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        verified_at TIMESTAMPTZ,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(institution_id, utr_number)
      );
      CREATE INDEX IF NOT EXISTS idx_school_qr_payments_scope ON school_qr_payments(institution_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_school_qr_payments_student ON school_qr_payments(institution_id, student_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_school_qr_payments_utr ON school_qr_payments(institution_id, utr_number);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_school_qr_payments_utr_upper ON school_qr_payments(institution_id, UPPER(utr_number));`);

  })().catch((error) => {
    initializing = undefined;
    throw error;
  });
  return initializing;
}

let essentialSchemaPromise: Promise<void> | null = null;
export async function ensureEssentialProductionSchema(customDb?: Sql): Promise<void> {
  if (essentialSchemaPromise) return essentialSchemaPromise;
  essentialSchemaPromise = (async () => {
    const db = customDb || (await ready());
    await db.unsafe(`
      -- Timetable settings columns in settings table
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_start_time TEXT NOT NULL DEFAULT '09:00';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_end_time TEXT NOT NULL DEFAULT '16:00';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_period_minutes INTEGER NOT NULL DEFAULT 40;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_short_break_minutes INTEGER NOT NULL DEFAULT 15;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_lunch_minutes INTEGER NOT NULL DEFAULT 40;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_periods_per_day INTEGER NOT NULL DEFAULT 9;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_working_days TEXT NOT NULL DEFAULT '1,2,3,4,5';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

      -- Timetable entries columns & indexes
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS generated BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Published';
      ALTER TABLE timetable_entries DROP CONSTRAINT IF EXISTS timetable_entries_institution_id_class_name_section_academic_year_weekday_start_time_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_active_slot ON timetable_entries(institution_id,class_name,section,academic_year,weekday,start_time) WHERE status<>'Archived';
      CREATE INDEX IF NOT EXISTS idx_timetable_published_scope ON timetable_entries(institution_id,academic_year,class_name,section,weekday,start_time) WHERE status='Published';

      -- Payment settings columns in settings table
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS upi_enabled BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS upi_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS payee_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_method_name TEXT NOT NULL DEFAULT 'School UPI / QR Code';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS bank_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS account_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS ifsc_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT NOT NULL DEFAULT '';

      -- School QR payments table & indexes
      CREATE TABLE IF NOT EXISTS school_qr_payments(
        id TEXT PRIMARY KEY,
        institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        fee_id TEXT NOT NULL REFERENCES fees(id) ON DELETE RESTRICT,
        amount DOUBLE PRECISION NOT NULL CHECK(amount > 0),
        utr_number TEXT NOT NULL,
        payment_date TEXT NOT NULL,
        screenshot_asset_id TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','REJECTED','REFUNDED')),
        rejection_reason TEXT NOT NULL DEFAULT '',
        verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        verified_at TIMESTAMPTZ,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(institution_id, utr_number)
      );
      CREATE INDEX IF NOT EXISTS idx_school_qr_payments_scope ON school_qr_payments(institution_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_school_qr_payments_student ON school_qr_payments(institution_id, student_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_school_qr_payments_utr ON school_qr_payments(institution_id, utr_number);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_school_qr_payments_utr_upper ON school_qr_payments(institution_id, UPPER(utr_number));

      -- School branding and settings columns
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS school_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS dise_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS pin_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS principal_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS registration_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS affiliation TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS motto TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS school_type TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS fee_receipt_title TEXT NOT NULL DEFAULT 'Fee Payment Receipt';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS fee_receipt_subheader TEXT NOT NULL DEFAULT 'Standard Fee Receipt Template';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS payslip_title TEXT NOT NULL DEFAULT 'Pay Slip';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS payslip_subheader TEXT NOT NULL DEFAULT 'Standard Pay Slip Template';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS footer_text TEXT NOT NULL DEFAULT '';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS signature_label TEXT NOT NULL DEFAULT 'Authorized Signatory';
      ALTER TABLE settings ADD COLUMN IF NOT EXISTS attendance_correction_window_hours INTEGER NOT NULL DEFAULT 24;

      -- Students table columns
      ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_path TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS blood_group TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS mother_name TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS special_quota TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS special_quota_description TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year TEXT NOT NULL DEFAULT '';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_date TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_reason TEXT NOT NULL DEFAULT '';
      ALTER TABLE students ADD COLUMN IF NOT EXISTS graduation_date TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_remarks TEXT NOT NULL DEFAULT '';
    `);
  })().catch((err) => {
    essentialSchemaPromise = null;
    throw err;
  });
  return essentialSchemaPromise;
}

export async function ensurePaymentSettingsSchema(customDb?: Sql): Promise<void> {
  return ensureEssentialProductionSchema(customDb);
}
export async function ensureTimetableSchema(customDb?: Sql): Promise<void> {
  return ensureEssentialProductionSchema(customDb);
}

async function ready() {
  const sql = connection();
  // Production schema changes are applied explicitly before deployment. Running
  // the full idempotent bootstrap in every new serverless instance adds tens of
  // seconds to cold requests and creates unnecessary DDL contention.
  if (process.env.NODE_ENV !== "production") {
    await initialize();
  } else {
    // Non-blocking background check so essential schema self-heals without delaying production cold requests
    ensureEssentialProductionSchema(sql).catch(() => {});
  }
  return sql;
}
export async function databaseHealth() {
  await row<{ ok: number }>("SELECT 1 AS ok", [], await ready());
}
export async function recordUserLogin(userId:string){await run("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?",[userId],await ready())}
async function audit(
  institutionId: string,
  userId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  details: Record<string, unknown> = {},
  sql?: Sql,
) {
  await run(
    "INSERT INTO audit_logs(id,institution_id,user_id,action,entity,entity_id,details)VALUES(?,?,?,?,?,?,?::jsonb)",
    [
      randomUUID(),
      institutionId,
      userId ?? null,
      action,
      entity,
      entityId ?? null,
      JSON.stringify(details),
    ],
    sql ?? (await ready()),
  );
}
async function activity(
  institutionId: string,
  type: string,
  title: string,
  description: string,
  studentId?: string,
  paymentId?: string,
  amount?: number,
  sql?: Sql,
) {
  await run(
    "INSERT INTO activities(id,institution_id,type,title,description,student_id,payment_id,amount)VALUES(?,?,?,?,?,?,?,?)",
    [
      randomUUID(),
      institutionId,
      type,
      title,
      description,
      studentId ?? null,
      paymentId ?? null,
      amount ?? null,
    ],
    sql ?? (await ready()),
  );
}
async function notify(
  institutionId: string,
  userId: string | undefined,
  type: string,
  title: string,
  description: string,
  sql?: Sql,
  notificationId?: string,
) {
  await run(
    "INSERT INTO notifications(id,institution_id,user_id,type,title,description)VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
    [notificationId??randomUUID(), institutionId, userId ?? null, type, title, description],
    sql ?? (await ready()),
  );
}
export async function addNotification(
  institutionId: string,
  userId: string | undefined,
  type: string,
  title: string,
  description: string,
) {
  return notify(institutionId, userId, type, title, description);
}
async function nextNumber(
  _institutionId: string,
  kind: "REC" | "INV",
  date = new Date(),
  sql?: Sql,
) {
  const db = sql ?? (await ready()),year = String(date.getFullYear());
  // Both identifier columns are globally unique. A shared counter gives every
  // school a short number without risking a duplicate across tenants. Legacy
  // identifiers remain untouched; skip any older records using this format.
  for(;;){
    const result=await row<{value:number}>("INSERT INTO counters(institution_id,kind,year,value)VALUES(?,?,?,1) ON CONFLICT(institution_id,kind,year) DO UPDATE SET value=counters.value+1 RETURNING value",["__global__",kind,year],db);
    const candidate=`${kind}-${year}-${String(result.value).padStart(6,"0")}`;
    const table=kind==="INV"?"fees":"payments",column=kind==="INV"?"invoice_number":"receipt_number";
    if(!await row<{id:string}>(`SELECT id FROM ${table} WHERE ${column}=?`,[candidate],db))return candidate;
  }
}

async function rollCandidate(institutionId: string, code: string, year: string, start: number, db: Sql) {
  let serial = start;
  for (;;) {
    const candidate = formatRollNumber(code, year, serial);
    const used = await row<{ id: string }>("SELECT id FROM students WHERE institution_id=? AND roll_number=? LIMIT 1", [institutionId, candidate], db);
    if (!used) return { candidate, serial };
    serial++;
  }
}

export async function previewStudentRoll(institutionId: string, academicYear: string) {
  const db = await ready();
  const settings = await row<{ schoolCode: string }>('SELECT school_code AS "schoolCode" FROM settings WHERE institution_id=?', [institutionId], db);
  const code = normalizeSchoolCode(settings?.schoolCode || "");
  const year = admissionYear(academicYear);
  const counter = await row<{ value: number }>("SELECT value FROM counters WHERE institution_id=? AND kind='ROLL' AND year=?", [institutionId, year], db);
  return (await rollCandidate(institutionId, code, year, (counter?.value || 0) + 1, db)).candidate;
}

async function allocateStudentRoll(institutionId: string, academicYear: string, db: Sql) {
  const settings = await row<{ schoolCode: string }>('SELECT school_code AS "schoolCode" FROM settings WHERE institution_id=?', [institutionId], db);
  const code = normalizeSchoolCode(settings?.schoolCode || "");
  const year = admissionYear(academicYear);
  const counter = await row<{ value: number }>("INSERT INTO counters(institution_id,kind,year,value)VALUES(?,'ROLL',?,1) ON CONFLICT(institution_id,kind,year) DO UPDATE SET value=counters.value+1 RETURNING value", [institutionId, year], db);
  const next = await rollCandidate(institutionId, code, year, counter.value, db);
  if (next.serial !== counter.value) await run("UPDATE counters SET value=? WHERE institution_id=? AND kind='ROLL' AND year=?", [next.serial, institutionId, year], db);
  return next.candidate;
}

async function reserveImportedRoll(institutionId: string, academicYear: string, supplied: string, db: Sql) {
  const settings = await row<{ schoolCode: string }>('SELECT school_code AS "schoolCode" FROM settings WHERE institution_id=?', [institutionId], db);
  const code = normalizeSchoolCode(settings?.schoolCode || "");
  const year = admissionYear(academicYear);
  const parsed = parseStudentId(supplied);
  const serial = parsed?.serial || 0;
  if (!parsed || parsed.code !== code || parsed.year !== year || supplied !== formatRollNumber(code, year, serial))
    throw new Error(`Student ID must match ${code}-${year}-0001 format.`);
  await run("INSERT INTO counters(institution_id,kind,year,value)VALUES(?,'ROLL',?,?) ON CONFLICT(institution_id,kind,year) DO UPDATE SET value=CASE WHEN counters.value>EXCLUDED.value THEN counters.value ELSE EXCLUDED.value END", [institutionId, year, serial], db);
  const used = await row<{ id: string }>("SELECT id FROM students WHERE institution_id=? AND roll_number=? LIMIT 1", [institutionId, supplied], db);
  if (used) throw new Error("Roll number already exists in this school.");
  return supplied;
}

export async function generateMissingStudentIds(institutionId:string,userId:string){
  const db=await ready();
  return db.begin(async tx=>{
    const settings=await row<{schoolCode:string}>('SELECT school_code AS "schoolCode" FROM settings WHERE institution_id=? FOR UPDATE',[institutionId],tx);
    const code=normalizeSchoolCode(settings?.schoolCode||"");
    const students=await rows<{id:string;rollNumber:string;academicYear:string;createdAt:string}>('SELECT id,roll_number AS "rollNumber",academic_year AS "academicYear",created_at::text AS "createdAt" FROM students WHERE institution_id=? ORDER BY created_at,id FOR UPDATE',[institutionId],tx);
    const seen=new Set<string>();
    let generated=0,preserved=0,errors=0;
    for(const student of students){
      try{
        const year=admissionYear(student.academicYear);
        const normalized=(student.rollNumber||"").trim().toUpperCase();
        if(isValidStudentId(normalized,year)&&!seen.has(normalized)){seen.add(normalized);preserved++;continue}
        const next=await allocateStudentRoll(institutionId,student.academicYear,tx);
        await run('UPDATE students SET roll_number=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[next,student.id,institutionId],tx);
        seen.add(next);generated++;
        await audit(institutionId,userId,"Student ID Backfilled","Student",student.id,{studentId:next,previousStudentId:normalized||null},tx);
      }catch{errors++}
    }
    const duplicates=await row<{count:number}>("SELECT COUNT(*)::int count FROM (SELECT roll_number FROM students WHERE institution_id=? AND roll_number<>'' GROUP BY roll_number HAVING COUNT(*)>1) d",[institutionId],tx);
    const globalDuplicates=await row<{count:number}>("SELECT COUNT(*)::int count FROM (SELECT institution_id,roll_number FROM students WHERE roll_number<>'' GROUP BY institution_id,roll_number HAVING COUNT(*)>1) d",[],tx);
    if(!globalDuplicates.count)await tx.unsafe('CREATE UNIQUE INDEX IF NOT EXISTS students_school_roll_unique ON students(institution_id,roll_number) WHERE roll_number<>\'\'');
    await audit(institutionId,userId,"Student ID Bulk Generation","Student",institutionId,{checked:students.length,generated,preserved,errors,duplicates:duplicates.count,schoolCode:code},tx);
    return{checked:students.length,generated,preserved,errors,duplicates:duplicates.count};
  });
}

export async function getInstitution(institutionId: string) {
  return await row<{
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl: string;
    academicYear: string;
    schoolCode: string;
    diseCode: string; website: string; city: string; state: string; pinCode: string;
    principalName: string; registrationNumber: string; affiliation: string; motto: string; schoolType: string;
    feeReceiptTitle: string; feeReceiptSubheader: string; payslipTitle: string; payslipSubheader: string; footerText: string; signatureLabel: string;
  }>(
    `SELECT i.id,i.name,COALESCE(s.school_address,'') address,COALESCE(s.school_phone,'') phone,COALESCE(s.school_email,'') email,COALESCE(s.logo_url,'') AS "logoUrl",COALESCE(s.academic_year,'2026-2027') AS "academicYear",COALESCE(s.school_code,'') AS "schoolCode",COALESCE(s.dise_code,'') AS "diseCode",COALESCE(s.website,'') website,COALESCE(s.city,'') city,COALESCE(s.state,'') state,COALESCE(s.pin_code,'') AS "pinCode",COALESCE(s.principal_name,'') AS "principalName",COALESCE(s.registration_number,'') AS "registrationNumber",COALESCE(s.affiliation,'') affiliation,COALESCE(s.motto,'') motto,COALESCE(s.school_type,'') AS "schoolType",COALESCE(s.fee_receipt_title,'Fee Payment Receipt') AS "feeReceiptTitle",COALESCE(s.fee_receipt_subheader,'Standard Fee Receipt Template') AS "feeReceiptSubheader",COALESCE(s.payslip_title,'Pay Slip') AS "payslipTitle",COALESCE(s.payslip_subheader,'Standard Pay Slip Template') AS "payslipSubheader",COALESCE(s.footer_text,'') AS "footerText",COALESCE(s.signature_label,'Authorized Signatory') AS "signatureLabel" FROM institutions i LEFT JOIN settings s ON s.institution_id=i.id WHERE i.id=?`,
    [institutionId],
    await ready(),
  );
}
export async function findUserByEmail(email: string) {
  return await row<DbUser & { passwordHash: string; status:string }>(
    'SELECT id,email,name,password_hash AS "passwordHash",role,status,institution_id AS "institutionId" FROM users WHERE LOWER(email)=?',
    [email.toLowerCase()],
    await ready(),
  );
}

export async function findUserByEmailOrPhone(identifier: string) {
  const clean = identifier.trim();
  const lower = clean.toLowerCase();
  const digits = clean.replace(/[^0-9]/g, "");
  const db = await ready();

  // 1. Try exact email lookup
  let u = await row<DbUser & { passwordHash: string; status: string }>(
    'SELECT id,email,name,password_hash AS "passwordHash",role,status,institution_id AS "institutionId" FROM users WHERE LOWER(email)=?',
    [lower],
    db,
  );
  if (u) return u;

  // 2. Parent lookup: Parent numbers come from the school's existing student profiles (students.parent_phone / parent_whatsapp)
  if (digits.length >= 7) {
    const last10 = digits.length > 10 ? digits.slice(-10) : digits;
    const parentUser = await row<DbUser & { passwordHash: string; status: string }>(
      `SELECT u.id, u.email, u.name, u.password_hash AS "passwordHash", u.role, u.status, u.institution_id AS "institutionId"
       FROM users u
       JOIN students s ON s.institution_id = u.institution_id
       LEFT JOIN parent_students ps ON ps.parent_user_id=u.id AND ps.student_id=s.id AND ps.institution_id=s.institution_id
       WHERE u.role='PARENT' AND s.status<>'Deleted' AND (
         s.parent_phone=? OR s.parent_phone LIKE ? OR s.parent_phone LIKE ? OR
         s.parent_whatsapp=? OR s.parent_whatsapp LIKE ? OR s.parent_whatsapp LIKE ?
       )
       ORDER BY CASE WHEN ps.parent_user_id IS NOT NULL THEN 0 ELSE 1 END, s.created_at DESC
       LIMIT 1`,
      [clean, `%${digits}%`, `%${last10}%`, clean, `%${digits}%`, `%${last10}%`],
      db,
    );
    if (parentUser) return parentUser;

    // 3. Teacher lookup: Teacher numbers come from existing teacher profiles (teachers.phone)
    const teacherUser = await row<DbUser & { passwordHash: string; status: string }>(
      `SELECT u.id, u.email, u.name, u.password_hash AS "passwordHash", u.role, u.status, u.institution_id AS "institutionId"
       FROM users u
       JOIN teachers t ON LOWER(t.email) = LOWER(u.email) AND t.institution_id = u.institution_id
       WHERE u.role='TEACHER' AND (t.phone=? OR t.phone LIKE ? OR t.phone LIKE ?)
       LIMIT 1`,
      [clean, `%${digits}%`, `%${last10}%`],
      db,
    );
    if (teacherUser) return teacherUser;
  }

  return undefined;
}
function defaultAcademicYear(date = new Date()) {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export async function createAccount(input: {
  name: string;
  email: string;
  institution: string;
  phone?: string;
  passwordHash: string;
  studentCount?: number;
}) {
  await ready();
  const institutionId = randomUUID(),
    id = randomUUID(),
    email = input.email.toLowerCase();
  await connection().begin(async (tx) => {
    await run(
      "INSERT INTO institutions(id,name,planned_student_count)VALUES(?,?,?)",
      [institutionId, input.institution, input.studentCount ?? 0],
      tx,
    );
    await run(
      "INSERT INTO users(id,email,name,password_hash,role,institution_id)VALUES(?,?,?,?,?,?)",
      [
        id,
        email,
        input.name,
        input.passwordHash,
        "SCHOOL_ADMIN",
        institutionId,
      ],
      tx,
    );
    await run(
      "INSERT INTO settings(institution_id,school_email,school_phone,academic_year)VALUES(?,?,?,?)",
      [institutionId, email, input.phone?.trim() || "", defaultAcademicYear()],
      tx,
    );
    await seedDashboardDefaults(institutionId, defaultAcademicYear(), tx);
  });
  return {
    id,
    email,
    name: input.name,
    role: "SCHOOL_ADMIN",
    institutionId,
  } as DbUser;
}
export async function createAccountWithSession(input: {
  name: string;
  email: string;
  institution: string;
  phone?: string;
  passwordHash: string;
  studentCount?: number;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
}) {
  const db = await ready();
  const institutionId = randomUUID();
  const userId = randomUUID();
  const token = randomUUID() + randomUUID().replaceAll("-", "");
  const expires = new Date(Date.now() + 10080 * 60_000);
  const email = input.email.toLowerCase();
  const academicYear=defaultAcademicYear().split("-").map(Number),subscriptionStartDate=input.subscriptionStartDate??new Date(Date.UTC(academicYear[0],3,1)),subscriptionEndDate=input.subscriptionEndDate??new Date(Date.UTC(academicYear[1],3,1)-1);

  await db.begin(async (tx) => {
    await run("INSERT INTO institutions(id,name,planned_student_count,subscription_start_date,subscription_end_date)VALUES(?,?,?,?,?)", [institutionId, input.institution, input.studentCount ?? 0,subscriptionStartDate,subscriptionEndDate], tx);
    await run(
      "INSERT INTO users(id,email,name,password_hash,role,institution_id)VALUES(?,?,?,?,?,?)",
      [userId, email, input.name, input.passwordHash, "SCHOOL_ADMIN", institutionId],
      tx,
    );
    await run("INSERT INTO settings(institution_id,school_email,school_phone,academic_year)VALUES(?,?,?,?)", [institutionId, email, input.phone?.trim() || "", defaultAcademicYear()], tx);
    await seedDashboardDefaults(institutionId, defaultAcademicYear(), tx);
    await run("INSERT INTO sessions(token,user_id,expires_at)VALUES(?,?,?)", [token, userId, expires], tx);
  });

  return {
    user: { id: userId, email, name: input.name, role: "SCHOOL_ADMIN", institutionId } as DbUser,
    session: { token, expires },
  };
}
export async function createSession(userId: string) {
  const db = await ready(),
    token = randomUUID() + randomUUID().replaceAll("-", ""),
    account=await row<{id:string;email:string;role:string}>("SELECT id,email,role FROM users WHERE id=?",[userId],db),
    configuredId=process.env.ADMIN_USER_ID?.trim(),configuredEmail=process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    isAdmin=Boolean(account&&account.role==="SUPER_ADMIN"&&(configuredId?account.id===configuredId:configuredEmail&&account.email.toLowerCase()===configuredEmail)),
    adminSettings=isAdmin?await row<{minutes:number}>('SELECT session_timeout_minutes AS minutes FROM admin_settings WHERE id=\'global\'',[],db):undefined,
    expires = new Date(Date.now() + (adminSettings?.minutes||10080) * 60_000);
  await run("DELETE FROM sessions WHERE expires_at<CURRENT_TIMESTAMP", [], db);
  await run(
    "INSERT INTO sessions(token,user_id,expires_at)VALUES(?,?,?)",
    [token, userId, expires],
    db,
  );
  return { token, expires };
}
export async function getUserBySession(token: string) {
  return await row<DbUser>(
    'SELECT u.id,u.email,u.name,u.role,u.institution_id AS "institutionId" FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>CURRENT_TIMESTAMP AND u.status=\'Active\'',
    [token],
    await ready(),
  );
}
export async function deleteSession(token: string) {
  await run("DELETE FROM sessions WHERE token=?", [token], await ready());
}
export async function deleteOtherUserSessions(userId: string, currentToken: string) {
  const result = await run(
    "DELETE FROM sessions WHERE user_id=? AND token<>?",
    [userId, currentToken],
    await ready(),
  );
  return result;
}
export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  currentToken: string,
) {
  const db = await ready();
  return db.begin(async (tx) => {
    await run(
      "UPDATE users SET password_hash=? WHERE id=?",
      [passwordHash, userId],
      tx,
    );
    const result = await run(
      "DELETE FROM sessions WHERE user_id=? AND token<>?",
      [userId, currentToken],
      tx,
    );
    return result;
  });
}

const studentSelect = `SELECT s.id,s.name,s.admission,s.gender,COALESCE(s.photo_path,'') AS "photoPath",COALESCE(s.blood_group,'') AS "bloodGroup",COALESCE(s.mother_name,'') AS "motherName",COALESCE(s.special_quota,'') AS "specialQuota",COALESCE(s.special_quota_description,'') AS "specialQuotaDescription",s.date_of_birth AS "dateOfBirth",s.class_name AS "className",s.section,s.grade,s.roll_number AS "rollNumber",s.parent,s.parent_phone AS "parentPhone",s.whatsapp_enabled AS "whatsappEnabled",s.whatsapp_attendance AS "whatsappAttendance",s.whatsapp_academics AS "whatsappAcademics",s.whatsapp_fees AS "whatsappFees",s.whatsapp_notices AS "whatsappNotices",s.whatsapp_general AS "whatsappGeneral",s.parent_email AS "parentEmail",s.address,s.admission_date AS "admissionDate",s.attendance,s.fee,s.total_fee AS "totalFee",s.paid_fee AS "paidFee",s.pending_fee AS "pendingFee",s.status,s.academic_year AS "academicYear",COALESCE(s.leaving_date,'') AS "leavingDate",COALESCE(s.leaving_reason,'') AS "leavingReason",COALESCE(s.leaving_remarks,'') AS "leavingRemarks",s.created_at::text AS "createdAt" FROM students s`;
async function refreshFees(institutionId: string, sql?: Sql) {
  const db = sql ?? (await ready()),
    today = new Date().toISOString().slice(0, 10);
  await run(
    "UPDATE fees SET status=CASE WHEN pending_amount=0 THEN 'Paid' WHEN due_date<? THEN 'Overdue' WHEN paid_amount>0 THEN 'Partially Paid' ELSE 'Pending' END WHERE institution_id=?",
    [today, institutionId],
    db,
  );
  await run(
    "UPDATE students SET fee=CASE WHEN EXISTS(SELECT 1 FROM fees WHERE student_id=students.id AND status='Overdue') THEN 'Overdue' WHEN pending_fee=0 THEN 'Paid' WHEN paid_fee>0 THEN 'Partially Paid' ELSE 'Pending' END WHERE institution_id=?",
    [institutionId],
    db,
  );
}
export async function listStudents(
  institutionId: string,
  filters: {
    search?: string;
    className?: string;
    section?: string;
    fee?: string;
    studentId?: string;
    academicYear?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const db = await ready();
  if(filters.academicYear)await ensureStudentEnrollments(institutionId,db);
  await refreshFees(institutionId, db);
  const where = ["s.institution_id=?", "s.status<>'Deleted'"],
    args: unknown[] = [institutionId];
  const scopedSelect=filters.academicYear?studentSelect.replace('s.class_name AS "className",s.section','e.class_name AS "className",e.section').replace('s.academic_year AS "academicYear"','e.academic_year AS "academicYear"').replace(' FROM students s',' FROM students s JOIN student_enrollments e ON e.student_id=s.id AND e.institution_id=s.institution_id') : studentSelect;
  if(filters.academicYear){where.push("e.academic_year=?");args.push(filters.academicYear)}
  if(filters.status&&filters.status!=="All"){where.push("s.status=?");args.push(filters.status)}
  if(filters.studentId){where.push("s.id=?");args.push(filters.studentId)}
  if (filters.search) {
    where.push(
      "(s.name ILIKE ? OR s.admission ILIKE ? OR s.roll_number ILIKE ? OR s.parent_phone ILIKE ? OR COALESCE(s.special_quota,'') ILIKE ?)",
    );
    const q = `%${filters.search}%`;
    args.push(q, q, q, q, q);
  }
  for (const [k, col] of [
    ["className", filters.academicYear ? "e.class_name" : "s.class_name"],
    ["section", filters.academicYear ? "e.section" : "s.section"],
    ["fee", "s.fee"],
  ] as const)
    if (filters[k]) {
      where.push(`${col}=?`);
      args.push(filters[k]);
    }
  let query = `${scopedSelect} WHERE ${where.join(" AND ")} ORDER BY s.created_at DESC`;
  if (filters.limit) {
    query += " LIMIT ? OFFSET ?";
    args.push(filters.limit, filters.offset ?? 0);
  }
  return await rows<DbStudent>(query, args, db);
}
export async function getStudent(institutionId: string, id: string) {
  return await row<DbStudent>(
    `${studentSelect} WHERE s.institution_id=? AND s.id=? AND s.status<>'Deleted'`,
    [institutionId, id],
    await ready(),
  );
}
export async function updateStudentPhotoPath(institutionId:string,id:string,photoPath:string|null){
 const db=await ready(),changed=await run("UPDATE students SET photo_path=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND id=? AND status<>'Deleted'",[photoPath,institutionId,id],db);
 if(!changed)throw new Error("Student not found.");
 return getStudent(institutionId,id);
}
export async function findStudentByAdmission(
  institutionId: string,
  admission: string,
) {
  return await row<DbStudent>(
    `${studentSelect} WHERE s.institution_id=? AND s.admission=?`,
    [institutionId, admission],
    await ready(),
  );
}
export async function studentImportKeys(institutionId:string){
  return rows<{admission:string;rollNumber:string}>('SELECT admission,roll_number AS "rollNumber" FROM students WHERE institution_id=? AND status<>\'Deleted\'',[institutionId],await ready());
}
async function insertStudent(
  institutionId: string,
  input: StudentInput,
  userId: string | undefined,
  tx: Sql,
  options?: { allowImportedRoll?: boolean; enforceCapacity?: boolean; bulkImport?:boolean;allowFirstUnpaidEnrollment?:boolean },
) {
  const id = randomUUID(),
    today = new Date(),
    admission =
      input.admission ||
      `EDL-${today.getFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`,
    pending = Math.max(input.totalFee, 0);
    if(options?.enforceCapacity){
      const institution=await row<{id:string}>("SELECT id FROM institutions WHERE id=? FOR UPDATE",[institutionId],tx);
      if(!institution)throw new Error("School account not found.");
      const lockedSubscription=await row<{studentCapacity:number}>("SELECT student_capacity AS \"studentCapacity\" FROM subscriptions WHERE institution_id=? AND status IN ('ACTIVE','EXPIRING_SOON') AND expiry_date>CURRENT_TIMESTAMP ORDER BY expiry_date DESC LIMIT 1 FOR UPDATE",[institutionId],tx);
      const activeUsage=(await row<{count:number}>("SELECT COUNT(*)::int count FROM students WHERE institution_id=? AND LOWER(TRIM(status))='active'",[institutionId],tx)).count;
      if(!lockedSubscription?.studentCapacity){
        if(!options.allowFirstUnpaidEnrollment||activeUsage!==0)throw new Error("SUBSCRIPTION_REQUIRED");
      }else if(activeUsage+1>lockedSubscription.studentCapacity)throw new Error(`CAPACITY_EXCEEDED:${activeUsage}:${lockedSubscription.studentCapacity}:1`);
    }
    if(!options?.bulkImport){const placement=await row<{count:number}>("SELECT COUNT(*)::int count FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id JOIN academic_years y ON y.institution_id=c.institution_id WHERE c.institution_id=? AND c.name=? AND c.status='Active' AND s.name=? AND s.status='Active' AND y.name=? AND y.status='Active'",[institutionId,input.className,input.section,input.academicYear],tx);if(!placement.count)throw new Error("Choose a class, section, and academic year configured in Settings.")}
    const rollNumber = options?.allowImportedRoll && input.rollNumber?.trim()
      ? await reserveImportedRoll(institutionId, input.academicYear, input.rollNumber.trim(), tx)
      : await allocateStudentRoll(institutionId, input.academicYear, tx);
    await run(
      "INSERT INTO students(id,institution_id,name,admission,gender,blood_group,mother_name,special_quota,special_quota_description,date_of_birth,class_name,section,grade,roll_number,parent,parent_phone,parent_email,address,admission_date,total_fee,paid_fee,pending_fee,attendance,fee,status,academic_year)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        institutionId,
        input.name,
        admission,
        input.gender,
        input.bloodGroup || null,
        input.motherName?.trim() || null,
        input.specialQuota || null,
        input.specialQuota === "Other" ? input.specialQuotaDescription?.trim() || null : null,
        input.dateOfBirth,
        input.className,
        input.section,
        `${input.className}${input.section ? `-${input.section}` : ""}`,
        rollNumber,
        input.parent,
        input.parentPhone,
        input.parentEmail,
        input.address,
        input.admissionDate,
        input.totalFee,
        0,
        pending,
        100,
        pending ? "Pending" : "Paid",
        "Active",
        input.academicYear,
      ],
      tx,
    );
    await run("INSERT INTO student_enrollments(id,institution_id,student_id,academic_year,class_name,section,status)VALUES(?,?,?,?,?,?,'Active')",[randomUUID(),institutionId,id,input.academicYear,input.className,input.section],tx);
    if (input.totalFee > 0) {
      const invoice = await nextNumber(institutionId, "INV", today, tx);
      await run(
        "INSERT INTO fees(id,institution_id,student_id,invoice_number,academic_year,total_amount,final_amount,pending_amount,due_date,status)VALUES(?,?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          institutionId,
          id,
          invoice,
          input.academicYear,
          input.totalFee,
          input.totalFee,
          input.totalFee,
          input.dueDate,
          "Pending",
        ],
        tx,
      );
    }
    if(!options?.bulkImport)await audit(
      institutionId,
      userId,
      "Student Added",
      "Student",
      id,
      { name: input.name, admission },
      tx,
    );
    if(!options?.bulkImport)await activity(
      institutionId,
      "student",
      "New student added",
      `${input.name} (${admission}) was enrolled`,
      id,
      undefined,
      undefined,
      tx,
    );
    await run("UPDATE students SET parent_whatsapp=?,whatsapp_enabled=?,whatsapp_attendance=?,whatsapp_academics=?,whatsapp_fees=?,whatsapp_notices=?,whatsapp_general=? WHERE id=? AND institution_id=?",[input.parentPhone,Boolean(input.whatsappEnabled),Boolean(input.whatsappAttendance),Boolean(input.whatsappAcademics),Boolean(input.whatsappFees),Boolean(input.whatsappNotices),Boolean(input.whatsappGeneral),id,institutionId],tx);
    if(!options?.bulkImport)await notify(
      institutionId,
      userId,
      "student",
      "New student added",
      `${input.name} was enrolled successfully.`,
      tx,
    );
  return id;
}

export async function addStudent(
  institutionId: string,
  input: StudentInput,
  userId?: string,
  options?: { allowImportedRoll?: boolean; enforceCapacity?: boolean; bulkImport?:boolean;allowFirstUnpaidEnrollment?:boolean },
) {
  await ready();
  const id=await connection().begin(tx=>insertStudent(institutionId,input,userId,tx,options));
  return (await getStudent(institutionId, id))!;
}

export async function addStudentsAtomic(
  institutionId:string,
  inputs:StudentInput[],
  userId:string,
  options?:{allowImportedRoll?:boolean;enforceCapacity?:boolean},
){
  await ready();
  return connection().begin(async tx=>{
    if(options?.enforceCapacity){
      const locked=await row<{studentCapacity:number}>("SELECT student_capacity AS \"studentCapacity\" FROM subscriptions WHERE institution_id=? AND status IN ('ACTIVE','EXPIRING_SOON') AND expiry_date>CURRENT_TIMESTAMP ORDER BY expiry_date DESC LIMIT 1 FOR UPDATE",[institutionId],tx);
      if(!locked?.studentCapacity)throw new Error("SUBSCRIPTION_REQUIRED");
      const usage=(await row<{count:number}>("SELECT COUNT(*)::int count FROM students WHERE institution_id=? AND LOWER(TRIM(status))='active'",[institutionId],tx)).count;
      if(usage+inputs.length>locked.studentCapacity)throw new Error(`CAPACITY_EXCEEDED:${usage}:${locked.studentCapacity}:${inputs.length}`);
    }
    const ids:string[]=[];
    for(const input of inputs)ids.push(await insertStudent(institutionId,input,userId,tx,{allowImportedRoll:options?.allowImportedRoll,enforceCapacity:false,bulkImport:true}));
    return ids;
  });
}
export async function updateStudent(
  institutionId: string,
  id: string,
  input: Partial<StudentInput>,
  userId?: string,
) {
  const requestedFee=input.totalFee===undefined?undefined:normalizeStudentFee(input.totalFee);
  await ready();
  await connection().begin(async tx=>{
    const old=await row<DbStudent>(`${studentSelect} WHERE s.institution_id=? AND s.id=? AND s.status<>'Deleted'`,[institutionId,id],tx);
    if(!old)throw new Error("Student not found");
    const value={...old,...input,totalFee:requestedFee??old.totalFee};
    const placement=await row<{count:number}>("SELECT COUNT(*)::int count FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id JOIN academic_years y ON y.institution_id=c.institution_id WHERE c.institution_id=? AND c.name=? AND c.status='Active' AND s.name=? AND s.status='Active' AND y.name=? AND y.status='Active'",[institutionId,value.className,value.section,value.academicYear],tx);
    if(!placement.count)throw new Error("Choose a class, section, and academic year configured in Settings.");
    await run("UPDATE students SET name=?,admission=?,gender=?,blood_group=?,mother_name=?,special_quota=?,special_quota_description=?,date_of_birth=?,class_name=?,section=?,grade=?,roll_number=?,parent=?,parent_phone=?,parent_email=?,address=?,admission_date=?,academic_year=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[value.name,value.admission,value.gender,value.bloodGroup||null,value.motherName?.trim()||null,value.specialQuota||null,value.specialQuota==="Other"?value.specialQuotaDescription?.trim()||null:null,value.dateOfBirth,value.className,value.section,`${value.className}${value.section?`-${value.section}`:""}`,old.rollNumber,value.parent,value.parentPhone,value.parentEmail,value.address,value.admissionDate,value.academicYear,id,institutionId],tx);
    await run("UPDATE students SET parent_whatsapp=?,whatsapp_enabled=?,whatsapp_attendance=?,whatsapp_academics=?,whatsapp_fees=?,whatsapp_notices=?,whatsapp_general=? WHERE id=? AND institution_id=?",[value.parentPhone,Boolean(value.whatsappEnabled),Boolean(value.whatsappAttendance),Boolean(value.whatsappAcademics),Boolean(value.whatsappFees),Boolean(value.whatsappNotices),Boolean(value.whatsappGeneral),id,institutionId],tx);
    if(requestedFee!==undefined)await updateStudentFeeTotal(institutionId,id,value.academicYear,requestedFee,tx);
    await run("INSERT INTO student_enrollments(id,institution_id,student_id,academic_year,class_name,section,status)VALUES(?,?,?,?,?,?,'Active') ON CONFLICT(institution_id,student_id,academic_year) DO UPDATE SET class_name=EXCLUDED.class_name,section=EXCLUDED.section,status='Active',updated_at=CURRENT_TIMESTAMP",[randomUUID(),institutionId,id,value.academicYear,value.className,value.section],tx);
    await audit(institutionId,userId,"Student Updated","Student",id,{name:value.name,previousTotalFee:old.totalFee,totalFee:value.totalFee},tx);
  });
  return (await getStudent(institutionId, id))!;
}

export function normalizeStudentFee(value:unknown){
  const amount=typeof value==="number"?value:Number(value);
  if(!Number.isFinite(amount)||amount<0||amount>100000000||Math.abs(amount*100-Math.round(amount*100))>1e-8)throw new Error("Total Fee must be between ₹0 and ₹10,00,00,000 with at most two decimal places.");
  return Math.round(amount*100)/100;
}

async function updateStudentFeeTotal(institutionId:string,studentId:string,academicYear:string,totalFee:number,tx:Sql){
  const targetCents=Math.round(totalFee*100),invoices=await rows<{id:string;academicYear:string;totalAmount:number;finalAmount:number;paidAmount:number;dueDate:string}>("SELECT f.id,f.academic_year AS \"academicYear\",f.total_amount AS \"totalAmount\",f.final_amount AS \"finalAmount\",COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.institution_id=f.institution_id AND p.fee_id=f.id AND p.status='Success'),0) AS \"paidAmount\",f.due_date AS \"dueDate\" FROM fees f WHERE f.institution_id=? AND f.student_id=? ORDER BY CASE WHEN f.academic_year=? THEN 0 ELSE 1 END,f.created_at,f.id",[institutionId,studentId,academicYear],tx),paidCents=invoices.reduce((sum,item)=>sum+Math.round(Number(item.paidAmount)*100),0);
  if(targetCents<paidCents)throw new Error(`Total Fee cannot be lower than recorded successful payments (₹${(paidCents/100).toLocaleString("en-IN")}). Payment and receipt history was not changed.`);
  let delta=targetCents-invoices.reduce((sum,item)=>sum+Math.round(Number(item.finalAmount)*100),0);
  if(!invoices.length&&targetCents>0){const yearEnd=Number(academicYear.slice(-4)),dueDate=Number.isInteger(yearEnd)?`${yearEnd}-03-31`:new Date().toISOString().slice(0,10),invoice=await nextNumber(institutionId,"INV",new Date(),tx);await run("INSERT INTO fees(id,institution_id,student_id,invoice_number,fee_type,academic_year,total_amount,final_amount,paid_amount,pending_amount,due_date,status)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",[randomUUID(),institutionId,studentId,invoice,"Annual Fee",academicYear,totalFee,totalFee,0,totalFee,dueDate,"Pending"],tx);delta=0}
  if(delta>0){const invoice=invoices[0],nextFinal=Math.round(Number(invoice.finalAmount)*100)+delta,nextTotal=Math.round(Number(invoice.totalAmount)*100)+delta,paid=Math.round(Number(invoice.paidAmount)*100);await run("UPDATE fees SET total_amount=?,final_amount=?,paid_amount=?,pending_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[nextTotal/100,nextFinal/100,paid/100,(nextFinal-paid)/100,invoice.id,institutionId],tx)}
  if(delta<0){let reduction=-delta;for(const invoice of [...invoices].reverse()){if(!reduction)break;const final=Math.round(Number(invoice.finalAmount)*100),paid=Math.round(Number(invoice.paidAmount)*100),amount=Math.round(Number(invoice.totalAmount)*100),applied=Math.min(reduction,final-paid),nextFinal=final-applied,nextTotal=Math.max(nextFinal,amount-applied);if(applied){await run("UPDATE fees SET total_amount=?,final_amount=?,paid_amount=?,pending_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[nextTotal/100,nextFinal/100,paid/100,(nextFinal-paid)/100,invoice.id,institutionId],tx);reduction-=applied}}if(reduction)throw new Error("Total Fee could not be reduced without changing recorded payment history.")}
  const today=new Date().toISOString().slice(0,10);await run("UPDATE fees SET paid_amount=COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.institution_id=fees.institution_id AND p.fee_id=fees.id AND p.status='Success'),0),pending_amount=CASE WHEN final_amount>COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.institution_id=fees.institution_id AND p.fee_id=fees.id AND p.status='Success'),0) THEN final_amount-COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.institution_id=fees.institution_id AND p.fee_id=fees.id AND p.status='Success'),0) ELSE 0 END,status=CASE WHEN final_amount<=COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.institution_id=fees.institution_id AND p.fee_id=fees.id AND p.status='Success'),0) THEN 'Paid' WHEN due_date<? THEN 'Overdue' WHEN COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.institution_id=fees.institution_id AND p.fee_id=fees.id AND p.status='Success'),0)>0 THEN 'Partially Paid' ELSE 'Pending' END,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND student_id=?",[today,institutionId,studentId],tx);
  await run("UPDATE students SET total_fee=(SELECT COALESCE(SUM(final_amount),0) FROM fees WHERE institution_id=? AND student_id=?),paid_fee=(SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.institution_id=? AND p.student_id=? AND p.status='Success'),pending_fee=CASE WHEN (SELECT COALESCE(SUM(final_amount),0) FROM fees WHERE institution_id=? AND student_id=?)>(SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.institution_id=? AND p.student_id=? AND p.status='Success') THEN (SELECT COALESCE(SUM(final_amount),0) FROM fees WHERE institution_id=? AND student_id=?)-(SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.institution_id=? AND p.student_id=? AND p.status='Success') ELSE 0 END,fee=CASE WHEN EXISTS(SELECT 1 FROM fees WHERE institution_id=? AND student_id=? AND status='Overdue') THEN 'Overdue' WHEN ?=0 THEN 'Paid' WHEN ?>0 THEN 'Partially Paid' ELSE 'Pending' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[institutionId,studentId,institutionId,studentId,institutionId,studentId,institutionId,studentId,institutionId,studentId,institutionId,studentId,institutionId,studentId,targetCents-paidCents,paidCents,studentId,institutionId],tx)
}
export async function deleteStudent(
  institutionId: string,
  id: string,
  userId?: string,
) {
  const student = await getStudent(institutionId, id);
  if (!student) return false;
  const db = await ready();
  await run(
    "UPDATE students SET status='Deleted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",
    [id, institutionId],
    db,
  );
  await audit(
    institutionId,
    userId,
    "Student Deleted",
    "Student",
    id,
    { name: student.name },
    db,
  );
  return true;
}

export async function listTeachers(institutionId: string, search = "") {
  const q = `%${search}%`;
  return await rows<DbTeacher>(
    'SELECT id,name,employee_id AS "employeeId",email,phone,department,subject,assigned_classes AS classes,joining_date AS "joiningDate",salary,status,created_at::text AS "createdAt" FROM teachers WHERE institution_id=? AND status<>\'Deleted\' AND (name ILIKE ? OR employee_id ILIKE ? OR subject ILIKE ?) ORDER BY created_at DESC',
    [institutionId, q, q, q],
    await ready(),
  );
}

export type TeacherPortalAssignment = { academicYear:string; className:string; section:string; subject:string };
export async function teacherPortalScope(institutionId:string,email:string){
  const db=await ready();
  const teachers=await rows<DbTeacher>(`SELECT id,name,employee_id AS "employeeId",email,phone,department,subject,assigned_classes AS classes,joining_date AS "joiningDate",salary,status,created_at::text AS "createdAt" FROM teachers WHERE institution_id=? AND LOWER(TRIM(email))=LOWER(TRIM(?)) AND status='Active' ORDER BY created_at`,[institutionId,email],db);
  if(teachers.length!==1)throw new Error(teachers.length?"Teacher account is linked to multiple active staff records.":"Teacher account is not linked to an active staff record.");
  const teacher=teachers[0];
  const timetable=await rows<{id:string;academicYear:string;className:string;section:string;subject:string;weekday:number;startTime:string;endTime:string}>(`SELECT id,academic_year AS "academicYear",class_name AS "className",section,subject,weekday,start_time AS "startTime",end_time AS "endTime" FROM timetable_entries WHERE institution_id=? AND teacher_id=? AND COALESCE(status, 'Published')='Published' ORDER BY weekday,start_time,class_name,section`,[institutionId,teacher.id],db).catch(async () => {
    return rows<{id:string;academicYear:string;className:string;section:string;subject:string;weekday:number;startTime:string;endTime:string}>(`SELECT id,academic_year AS "academicYear",class_name AS "className",section,subject,weekday,start_time AS "startTime",end_time AS "endTime" FROM timetable_entries WHERE institution_id=? AND teacher_id=? ORDER BY weekday,start_time,class_name,section`,[institutionId,teacher.id],db).catch(() => []);
  });
  const unique=new Map<string,TeacherPortalAssignment>();
  for(const item of timetable){
    const assignment={academicYear:item.academicYear,className:item.className,section:item.section,subject:item.subject};
    unique.set([assignment.academicYear,assignment.className,assignment.section,assignment.subject].map(value=>value.trim().toLowerCase()).join("\u0000"),assignment);
  }
  const assignedClassNames=new Set(parseTeacherClasses(teacher.classes).map(c=>c.toLowerCase()));
  const school=await getInstitution(institutionId);
  const defaultYear=school.academicYear||new Date().getFullYear().toString();
  const classRows=await rows<{name:string;section:string;academicYear:string;teacher:string}>(`SELECT name,section,academic_year AS "academicYear",teacher FROM classes WHERE institution_id=? AND status='Active'`,[institutionId],db);
  for(const c of classRows){
    const isClassTeacher=Boolean(c.teacher&&c.teacher.trim().toLowerCase()===teacher.name.trim().toLowerCase());
    const isAssignedClass=assignedClassNames.has(c.name.trim().toLowerCase());
    if(isClassTeacher||isAssignedClass){
      const assignment={academicYear:c.academicYear||defaultYear,className:c.name,section:c.section,subject:teacher.subject||"General"};
      const key=[assignment.academicYear,assignment.className,assignment.section,assignment.subject].map(value=>value.trim().toLowerCase()).join("\u0000");
      if(!unique.has(key))unique.set(key,assignment);
    }
  }
  if(assignedClassNames.size){
    const configuredSections=await rows<{className:string;section:string}>(`SELECT c.name AS "className", s.name AS section FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id WHERE c.institution_id=? AND c.status='Active' AND s.status='Active'`,[institutionId],db);
    for(const cs of configuredSections){
      if(assignedClassNames.has(cs.className.trim().toLowerCase())){
        const assignment={academicYear:defaultYear,className:cs.className,section:cs.section,subject:teacher.subject||"General"};
        const key=[assignment.academicYear,assignment.className,assignment.section,assignment.subject].map(value=>value.trim().toLowerCase()).join("\u0000");
        if(!unique.has(key))unique.set(key,assignment);
      }
    }
    for(const cls of parseTeacherClasses(teacher.classes)){
      const hasAny=[...unique.values()].some(a=>a.className.trim().toLowerCase()===cls.trim().toLowerCase());
      if(!hasAny){
        const assignment={academicYear:defaultYear,className:cls,section:"A",subject:teacher.subject||"General"};
        unique.set([assignment.academicYear,assignment.className,assignment.section,assignment.subject].map(value=>value.trim().toLowerCase()).join("\u0000"),assignment);
      }
    }
  }
  return{teacher,timetable,assignments:[...unique.values()]};
}
export function teacherHasAssignment(assignments:TeacherPortalAssignment[],target:{academicYear:string;className:string;section:string;subject?:string}){const same=(left:string,right:string)=>left.trim().toLowerCase()===right.trim().toLowerCase();return assignments.some(item=>same(item.academicYear,target.academicYear)&&same(item.className,target.className)&&same(item.section,target.section)&&(!target.subject||same(item.subject,target.subject)))}
export async function teacherAssignedStudents(institutionId:string,assignments:TeacherPortalAssignment[]){
  const db=await ready();
  await ensureStudentEnrollments(institutionId,db);
  const scopes=new Map<string,Pick<TeacherPortalAssignment,"academicYear"|"className"|"section">>();
  for(const item of assignments)scopes.set([item.academicYear,item.className,item.section].map(value=>value.toLowerCase()).join("\u0000"),item);
  if(!scopes.size)return[];
  const where:string[]=[],args:unknown[]=[institutionId];for(const item of scopes.values()){where.push("(e.academic_year=? AND e.class_name=? AND e.section=?)");args.push(item.academicYear,item.className,item.section)}
  return rows<{id:string;name:string;admission:string;rollNumber:string;academicYear:string;className:string;section:string;gender:string;parent:string;parentPhone:string;bloodGroup:string;attendance:number}>(`SELECT s.id,s.name,s.admission,s.roll_number AS "rollNumber",e.academic_year AS "academicYear",e.class_name AS "className",e.section,s.gender,s.parent,s.parent_phone AS "parentPhone",COALESCE(s.blood_group,'') AS "bloodGroup",s.attendance FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.status='Active' AND s.status='Active' AND (${where.join(" OR ")}) ORDER BY e.class_name,e.section,s.name`,args,db);
}
export async function upsertTeacherAccount(institutionId:string,input:{name:string;email:string;passwordHash:string;phone?:string}){
  const db=await ready(),email=input.email.trim().toLowerCase();
  const existing=await row<{id:string}>("SELECT id FROM users WHERE LOWER(TRIM(email))=?",[email],db);
  if(existing){
    await run("UPDATE users SET name=?,password_hash=?,role='TEACHER',institution_id=? WHERE id=?",[input.name,input.passwordHash,institutionId,existing.id],db);
    return{id:existing.id,email,name:input.name,role:"TEACHER",institutionId};
  }
  const id=randomUUID();
  await run("INSERT INTO users(id,email,name,password_hash,role,institution_id)VALUES(?,?,?,?,?,?)",[id,email,input.name,input.passwordHash,"TEACHER",institutionId],db);
  return{id,email,name:input.name,role:"TEACHER",institutionId};
}
export async function saveTeacher(
  institutionId: string,
  input: Omit<DbTeacher, "id" | "createdAt">,
  userId?: string,
) {
  const db = await ready(),
    id = randomUUID();
  await run(
    "INSERT INTO teachers(id,institution_id,name,employee_id,email,phone,department,subject,assigned_classes,joining_date,salary,status)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      id,
      institutionId,
      input.name,
      input.employeeId,
      input.email,
      input.phone,
      input.department,
      input.subject,
      serializeTeacherClasses(parseTeacherClasses(input.classes)),
      input.joiningDate,
      input.salary,
      input.status,
    ],
    db,
  );
  await audit(
    institutionId,
    userId,
    "Teacher Added",
    "Teacher",
    id,
    { name: input.name },
    db,
  );
  await activity(
    institutionId,
    "teacher",
    "New teacher added",
    `${input.name} joined ${input.department}`,
    undefined,
    undefined,
    undefined,
    db,
  );
  return (await listTeachers(institutionId)).find((x) => x.id === id)!;
}
export async function updateTeacher(
  institutionId: string,
  id: string,
  input: Omit<DbTeacher, "id" | "createdAt">,
  userId?: string,
) {
  const db = await ready();
  await run(
    "UPDATE teachers SET name=?,employee_id=?,email=?,phone=?,department=?,subject=?,assigned_classes=?,joining_date=?,salary=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",
    [
      input.name,
      input.employeeId,
      input.email,
      input.phone,
      input.department,
      input.subject,
      serializeTeacherClasses(parseTeacherClasses(input.classes)),
      input.joiningDate,
      input.salary,
      input.status,
      id,
      institutionId,
    ],
    db,
  );
  await audit(
    institutionId,
    userId,
    "Teacher Updated",
    "Teacher",
    id,
    { name: input.name },
    db,
  );
  return (await listTeachers(institutionId)).find((x) => x.id === id);
}
export async function deleteTeacher(
  institutionId: string,
  id: string,
  userId?: string,
) {
  const db = await ready(),
    count = await run(
      "UPDATE teachers SET status='Deleted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=? AND status<>'Deleted'",
      [id, institutionId],
      db,
    );
  if (count)
    await audit(
      institutionId,
      userId,
      "Teacher Deleted",
      "Teacher",
      id,
      {},
      db,
    );
  return count > 0;
}
export async function listClasses(
  institutionId: string,
  academicYear?: string,
) {
  const year =
    academicYear ?? (await getInstitution(institutionId)).academicYear;
  return await rows<DbClass>(
    'SELECT c.id,c.name,c.section,c.teacher,c.academic_year AS "academicYear",c.capacity,c.status,COUNT(s.id)::int AS "currentStudents" FROM classes c LEFT JOIN students s ON s.institution_id=c.institution_id AND s.class_name=c.name AND s.section=c.section WHERE c.institution_id=? AND c.academic_year=? GROUP BY c.id ORDER BY c.name,c.section',
    [institutionId, year],
    await ready(),
  );
}
export async function saveClass(
  institutionId: string,
  input: Omit<DbClass, "id" | "currentStudents">,
  userId?: string,
) {
  const db = await ready(),
    id = randomUUID();
  await run(
    "INSERT INTO classes(id,institution_id,name,section,teacher,academic_year,capacity,status)VALUES(?,?,?,?,?,?,?,?)",
    [
      id,
      institutionId,
      input.name,
      input.section,
      input.teacher,
      input.academicYear,
      input.capacity,
      input.status,
    ],
    db,
  );
  await audit(institutionId, userId, "Class Added", "Class", id, input, db);
  return (await listClasses(institutionId, input.academicYear)).find(
    (x) => x.id === id,
  )!;
}

export async function listAttendance(
  institutionId: string,
  filters: {
    date?: string;
    from?: string;
    to?: string;
    studentId?: string;
    className?: string;
    section?: string;
    status?: string;
    academicYear?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const db=await ready(),where = ["a.institution_id=?", "s.status<>'Deleted'"],
    args: unknown[] = [institutionId];
  if(filters.academicYear){await ensureStudentEnrollments(institutionId,db);const year=await row<{startMonth:number;endMonth:number}>('SELECT start_month AS "startMonth",end_month AS "endMonth" FROM academic_years WHERE institution_id=? AND name=?',[institutionId,filters.academicYear],db),startYear=Number(filters.academicYear.slice(0,4)),startMonth=year?.startMonth||4,endMonth=year?.endMonth||3,endYear=endMonth<startMonth?startYear+1:startYear,start=`${startYear}-${String(startMonth).padStart(2,'0')}-01`,endDate=new Date(Date.UTC(endYear,endMonth,0)).toISOString().slice(0,10);where.push("e.academic_year=?","a.date>=?","a.date<=?");args.push(filters.academicYear,start,endDate)}
  for (const [k, col] of [
    ["date", "a.date"],
    ["studentId", "a.student_id"],
    ["className", filters.academicYear?"e.class_name":"s.class_name"],
    ["section", filters.academicYear?"e.section":"s.section"],
    ["status", "a.status"],
  ] as const)
    if (filters[k]) {
      where.push(`${col}=?`);
      args.push(filters[k]);
    }
  if (filters.from) { where.push("a.date>=?"); args.push(filters.from); }
  if (filters.to) { where.push("a.date<=?"); args.push(filters.to); }
  let query = `SELECT a.id,a.date,s.name AS "studentName",s.admission,${filters.academicYear?'e.class_name':'s.class_name'} AS "className",${filters.academicYear?'e.section':'s.section'} AS section,a.status,a.remarks,a.marked_by AS "markedBy" FROM attendance a JOIN students s ON s.id=a.student_id AND s.institution_id=a.institution_id ${filters.academicYear?'JOIN student_enrollments e ON e.student_id=s.id AND e.institution_id=s.institution_id':''} WHERE ${where.join(" AND ")} ORDER BY a.date DESC,s.name`;
  if(filters.limit){query += " LIMIT ? OFFSET ?";args.push(filters.limit,filters.offset??0)}
  return await rows(
    query,
    args,
    db,
  );
}
export async function markAttendance(
  institutionId: string,
  date: string,
  records: { studentId: string; status: string; remarks?: string }[],
  markedBy: string,
  userId?: string,
) {
  await ready();
  await connection().begin(async (tx) => {
    const allowed = new Set(
      (
        await rows<{ id: string }>(
          "SELECT id FROM students WHERE institution_id=?",
          [institutionId],
          tx,
        )
      ).map((x) => x.id),
    );
    for (const item of records) {
      if (!allowed.has(item.studentId)) throw new Error("Invalid student");
      await run(
        "INSERT INTO attendance(id,institution_id,student_id,date,status,remarks,marked_by)VALUES(?,?,?,?,?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET status=EXCLUDED.status,remarks=EXCLUDED.remarks,marked_by=EXCLUDED.marked_by,updated_at=CURRENT_TIMESTAMP",
        [
          randomUUID(),
          institutionId,
          item.studentId,
          date,
          item.status,
          item.remarks ?? "",
          markedBy,
        ],
        tx,
      );
    }
    await run(
      "UPDATE students SET attendance=COALESCE((SELECT ROUND(100.0*SUM(CASE WHEN status IN ('Present','Late') THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0)) FROM attendance WHERE student_id=students.id),100),updated_at=CURRENT_TIMESTAMP WHERE institution_id=?",
      [institutionId],
      tx,
    );
    await audit(
      institutionId,
      userId,
      "Attendance Updated",
      "Attendance",
      date,
      { count: records.length },
      tx,
    );
    await activity(
      institutionId,
      "attendance",
      "Attendance updated",
      `${records.length} records marked for ${date}`,
      undefined,
      undefined,
      undefined,
      tx,
    );
  });
}

export async function listFees(
  institutionId: string,
  filters: {
    search?: string;
    studentId?: string;
    className?: string;
    section?: string;
    status?: string;
    academicYear?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const db = await ready();
  await refreshFees(institutionId, db);
  await ensureStudentEnrollments(institutionId, db);
  const where = ["f.institution_id=?"],
    args: unknown[] = [institutionId];
  if (filters.search) {
    where.push(
      "(s.name ILIKE ? OR s.admission ILIKE ? OR s.roll_number ILIKE ? OR f.invoice_number ILIKE ? OR EXISTS(SELECT 1 FROM payments p WHERE p.fee_id=f.id AND p.institution_id=f.institution_id AND p.receipt_number ILIKE ?))",
    );
    const q = `%${filters.search}%`;
    args.push(q, q, q, q, q);
  }
  if(filters.studentId){where.push("f.student_id=?");args.push(filters.studentId)}
  for (const [k, col] of [
    ["className", "COALESCE(e.class_name,s.class_name)"],
    ["section", "COALESCE(e.section,s.section)"],
    ["status", "f.status"],
  ] as const)
    if (filters[k]) {
      where.push(`${col}=?`);
      args.push(filters[k]);
    }
  if (filters.academicYear) {
    where.push("f.academic_year=?");
    args.push(filters.academicYear);
  }
  let query=`SELECT f.id,f.student_id AS "studentId",s.name AS "studentName",s.admission,s.roll_number AS "rollNumber",s.parent,COALESCE(e.class_name,s.class_name) AS "className",COALESCE(e.section,s.section) AS section,f.invoice_number AS "invoiceNumber",f.fee_type AS "feeType",f.academic_year AS "academicYear",f.total_amount AS "totalAmount",f.discount,f.final_amount AS "finalAmount",f.paid_amount AS "paidAmount",f.pending_amount AS "pendingAmount",f.due_date AS "dueDate",f.status,(SELECT p.receipt_number FROM payments p WHERE p.fee_id=f.id AND p.institution_id=f.institution_id AND p.status='Success' ORDER BY p.created_at DESC,p.id DESC LIMIT 1) AS "latestReceipt",f.created_at::text AS "createdAt" FROM fees f JOIN students s ON s.id=f.student_id AND s.institution_id=f.institution_id LEFT JOIN student_enrollments e ON e.student_id=f.student_id AND e.institution_id=f.institution_id AND e.academic_year=f.academic_year WHERE ${where.join(" AND ")} ORDER BY f.due_date,f.created_at DESC`;
  if(filters.limit){query+=" LIMIT ? OFFSET ?";args.push(filters.limit,filters.offset??0)}
  return await rows<Record<string, string | number>>(
    query,
    args,
    db,
  );
}
export async function getFeeInvoice(institutionId:string,feeId:string){
  const item=await row<{id:string;studentId:string;studentName:string;admission:string;rollNumber:string;parent:string;className:string;section:string;invoiceNumber:string;feeType:string;academicYear:string;totalAmount:number;discount:number;finalAmount:number;paidAmount:number;pendingAmount:number;dueDate:string;status:string;createdAt:string}>('SELECT f.id,f.student_id AS "studentId",s.name AS "studentName",s.admission,s.roll_number AS "rollNumber",s.parent,COALESCE(e.class_name,s.class_name) AS "className",COALESCE(e.section,s.section) AS section,f.invoice_number AS "invoiceNumber",f.fee_type AS "feeType",f.academic_year AS "academicYear",f.total_amount AS "totalAmount",f.discount,f.final_amount AS "finalAmount",f.paid_amount AS "paidAmount",f.pending_amount AS "pendingAmount",f.due_date AS "dueDate",f.status,f.created_at::text AS "createdAt" FROM fees f JOIN students s ON s.id=f.student_id AND s.institution_id=f.institution_id LEFT JOIN student_enrollments e ON e.student_id=f.student_id AND e.institution_id=f.institution_id AND e.academic_year=f.academic_year WHERE f.institution_id=? AND f.id=?',[institutionId,feeId],await ready());
  return item;
}

export async function studentAttendanceSheet(institutionId:string,academicYear:string,className:string,section:string,date:string){
  const db=await ready();
  await ensureStudentEnrollments(institutionId,db);
  const configured=await row<{count:number}>("SELECT COUNT(*)::int count FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id WHERE c.institution_id=? AND c.name=? AND c.status='Active' AND s.name=? AND s.status='Active'",[institutionId,className,section],db);
  if(!configured.count)throw new Error("Choose a configured class and section.");
  const result=await rows<{studentId:string;name:string;admission:string;rollNumber:string;status:string|null;remarks:string;recorded:boolean|number}>(
    `SELECT st.id AS "studentId",st.name,st.admission,st.roll_number AS "rollNumber",a.status,COALESCE(a.remarks,'') remarks,(a.id IS NOT NULL) recorded FROM student_enrollments e JOIN students st ON st.id=e.student_id AND st.institution_id=e.institution_id LEFT JOIN attendance a ON a.student_id=st.id AND a.institution_id=st.institution_id AND a.date=? WHERE e.institution_id=? AND e.academic_year=? AND e.class_name=? AND e.section=? AND e.status='Active' AND st.status='Active' ORDER BY st.name`,
    [date,institutionId,academicYear,className,section],db,
  );
  return result.map(item=>({...item,recorded:Boolean(item.recorded)}));
}

export type StudentAttendanceStatus = "Present" | "Absent" | "Late" | "Excused" | "Half-day" | "Leave";

export async function saveStudentAttendance(
  institutionId: string,
  userId: string,
  input: {
    academicYear: string;
    className: string;
    section: string;
    date: string;
    records: { studentId: string; status: StudentAttendanceStatus | "Half Day"; remarks?: string }[];
  },
  options: {
    allowOverwrite?: boolean;
    isCorrection?: boolean;
    correctionReason?: string;
    userRole?: string;
  } = {}
) {
  const db = await ready();
  const existingMap = new Map<string, { id: string; status: string; remarks: string }>();
  const newlyAbsentStudentIds: string[] = [];
  const correctedRecords: Array<{ studentId: string; prevStatus: string; newStatus: string }> = [];

  await db.begin(async (tx) => {
    await ensureStudentEnrollments(institutionId, tx);
    const eligible = await rows<{ id: string }>(
      "SELECT e.student_id id FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.academic_year=? AND e.class_name=? AND e.section=? AND e.status='Active' AND s.status='Active'",
      [institutionId, input.academicYear, input.className, input.section],
      tx
    );
    const allowed = new Set(eligible.map((item) => item.id));
    if (input.records.some((item) => !allowed.has(item.studentId))) {
      throw new Error("Attendance contains a student outside the selected class.");
    }

    // Query existing records for duplicate submission check and audit logging
    const existingRows = await rows<{ id: string; studentId: string; status: string; remarks: string; createdAt: string }>(
      `SELECT a.id, a.student_id AS "studentId", a.status, COALESCE(a.remarks,'') AS remarks, a.created_at::text AS "createdAt"
       FROM attendance a
       JOIN student_enrollments e ON e.student_id=a.student_id AND e.institution_id=a.institution_id
       WHERE a.institution_id=? AND a.date=? AND e.academic_year=? AND e.class_name=? AND e.section=? AND e.status='Active'`,
      [institutionId, input.date, input.academicYear, input.className, input.section],
      tx
    );
    for (const r of existingRows) existingMap.set(r.studentId, r);

    const isAlreadyRecorded = existingRows.length > 0;
    if (isAlreadyRecorded && !options.isCorrection && options.allowOverwrite === false) {
      throw new Error("Attendance is already submitted for this class and date. Ask a school administrator to make a correction.");
    }

    // If teacher role, enforce attendance correction window
    if (options.userRole === "TEACHER") {
      const setting = await row<{ windowHours: number }>(
        'SELECT COALESCE(attendance_correction_window_hours, 24)::int AS "windowHours" FROM settings WHERE institution_id=?',
        [institutionId],
        tx
      );
      const windowHours = setting?.windowHours ?? 24;
      const attendanceDateMidnight = new Date(`${input.date}T23:59:59Z`).getTime();
      const earliestCreated = existingRows[0]?.createdAt ? new Date(existingRows[0].createdAt).getTime() : attendanceDateMidnight;
      const elapsedHours = (Date.now() - earliestCreated) / (1000 * 60 * 60);
      if (elapsedHours > windowHours) {
        throw new Error(`The attendance correction window of ${windowHours} hours has expired for ${input.date}. Please contact a school administrator to make this correction.`);
      }
    }

    // Save individual records & write to audit logs
    for (const item of input.records) {
      const rawStatus = item.status === "Half Day" ? "Half-day" : item.status;
      const remarks = item.remarks?.trim() || "";
      const prev = existingMap.get(item.studentId);

      await run(
        `INSERT INTO attendance(id,institution_id,student_id,date,status,remarks,marked_by)
         VALUES(?,?,?,?,?,?,?)
         ON CONFLICT(student_id,date)
         DO UPDATE SET status=EXCLUDED.status,remarks=EXCLUDED.remarks,marked_by=EXCLUDED.marked_by,updated_at=CURRENT_TIMESTAMP`,
        [randomUUID(), institutionId, item.studentId, input.date, rawStatus, remarks, userId],
        tx
      );

      if (!prev) {
        await run(
          `INSERT INTO attendance_audit_logs(id,institution_id,attendance_id,student_id,academic_year,class_name,section,date,previous_status,new_status,previous_remarks,new_remarks,changed_by,reason)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            randomUUID(),
            institutionId,
            null,
            item.studentId,
            input.academicYear,
            input.className,
            input.section,
            input.date,
            null,
            rawStatus,
            "",
            remarks,
            userId,
            options.correctionReason?.trim() || "Initial submission",
          ],
          tx
        );
      } else if (prev.status !== rawStatus || prev.remarks !== remarks) {
        if (prev.status !== rawStatus) {
          correctedRecords.push({ studentId: item.studentId, prevStatus: prev.status, newStatus: rawStatus });
        }
        await run(
          `INSERT INTO attendance_audit_logs(id,institution_id,attendance_id,student_id,academic_year,class_name,section,date,previous_status,new_status,previous_remarks,new_remarks,changed_by,reason)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            randomUUID(),
            institutionId,
            prev.id,
            item.studentId,
            input.academicYear,
            input.className,
            input.section,
            input.date,
            prev.status,
            rawStatus,
            prev.remarks,
            remarks,
            userId,
            options.correctionReason?.trim() || "Attendance correction",
          ],
          tx
        );
      }

      if (rawStatus === "Absent" && (!prev || prev.status !== "Absent")) {
        newlyAbsentStudentIds.push(item.studentId);
      }
    }

    // Recalculate student attendance percentage with Half-day (0.5) and Excused exclusion
    await run(
      `UPDATE students
       SET attendance = COALESCE(
         (
           SELECT ROUND(
             100.0 * SUM(
               CASE
                 WHEN status IN ('Present','Late') THEN 1.0
                 WHEN status IN ('Half-day','Half Day') THEN 0.5
                 ELSE 0.0
               END
             ) / NULLIF(COUNT(CASE WHEN status NOT IN ('Excused','Leave') THEN 1 END), 0)
           )
           FROM attendance
           WHERE student_id=students.id
         ),
         100
       ),
       updated_at=CURRENT_TIMESTAMP
       WHERE institution_id=?
         AND id IN (
           SELECT e.student_id FROM student_enrollments e
           WHERE e.institution_id=? AND e.academic_year=? AND e.class_name=? AND e.section=?
         )`,
      [institutionId, institutionId, input.academicYear, input.className, input.section],
      tx
    );

    await audit(
      institutionId,
      userId,
      isAlreadyRecorded ? "Student Attendance Corrected" : "Student Attendance Saved",
      "Attendance",
      input.date,
      {
        academicYear: input.academicYear,
        className: input.className,
        section: input.section,
        count: input.records.length,
        isCorrection: isAlreadyRecorded,
        reason: options.correctionReason || undefined,
      },
      tx
    );
  });

  // Only notify parents AFTER successful database commit
  for (const studentId of newlyAbsentStudentIds) {
    await queueAutomaticWhatsAppEvent(institutionId, userId, {
      studentId,
      event: "absence",
      idempotencyKey: `attendance:${studentId}:${input.date}:absent`,
      values: {
        class_name: input.className,
        section: input.section,
        attendance_status: "Absent",
        date: input.date,
      },
    });

    try {
      const student = await row<{ name: string }>(
        "SELECT name FROM students WHERE id=? AND institution_id=?",
        [studentId, institutionId],
        db
      );
      if (student) {
        import("./notifications").then(({ notifyStudentAbsent }) => {
          notifyStudentAbsent({
            institutionId,
            studentId,
            studentName: student.name,
            className: input.className,
            section: input.section,
            date: input.date,
            status: "Absent",
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch {
      // non-blocking
    }
  }

  for (const corr of correctedRecords) {
    try {
      const student = await row<{ name: string }>(
        "SELECT name FROM students WHERE id=? AND institution_id=?",
        [corr.studentId, institutionId],
        db
      );
      if (student) {
        import("./notifications").then(({ notifyAttendanceCorrection }) => {
          notifyAttendanceCorrection({
            institutionId,
            studentId: corr.studentId,
            studentName: student.name,
            className: input.className,
            section: input.section,
            date: input.date,
            previousStatus: corr.prevStatus,
            newStatus: corr.newStatus,
            reason: options.correctionReason,
          }).catch(() => {});
        }).catch(() => {});
      }
    } catch {
      // non-blocking
    }
  }

  return input.records.length;
}

export async function studentAttendanceSummary(institutionId:string,input:{academicYear:string;from:string;to:string;className?:string;section?:string}){
  const db=await ready();
  await ensureStudentEnrollments(institutionId,db);
  const where=["a.institution_id=?","e.academic_year=?","a.date>=?","a.date<=?","s.status<>'Deleted'"];
  const args:unknown[]=[institutionId,input.academicYear,input.from,input.to];
  if(input.className){where.push("e.class_name=?");args.push(input.className)}
  if(input.section){where.push("e.section=?");args.push(input.section)}

  const records=await rows<{date:string;className:string;section:string;present:number;absent:number;late:number;excused:number;halfDay:number;leave:number;total:number}>(
    `SELECT a.date,e.class_name AS "className",e.section,
      SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::int present,
      SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END)::int absent,
      SUM(CASE WHEN a.status='Late' THEN 1 ELSE 0 END)::int late,
      SUM(CASE WHEN a.status='Excused' THEN 1 ELSE 0 END)::int excused,
      SUM(CASE WHEN a.status IN ('Half-day','Half Day') THEN 1 ELSE 0 END)::int "halfDay",
      SUM(CASE WHEN a.status='Leave' THEN 1 ELSE 0 END)::int leave,
      COUNT(*)::int total
     FROM attendance a
     JOIN students s ON s.id=a.student_id AND s.institution_id=a.institution_id
     JOIN student_enrollments e ON e.student_id=a.student_id AND e.institution_id=a.institution_id AND e.academic_year=?
     WHERE ${where.join(" AND ")}
     GROUP BY a.date,e.class_name,e.section ORDER BY a.date DESC,e.class_name,e.section`,
    [input.academicYear,...args],db,
  );

  const totals=records.reduce((sum,item)=>({
    present: sum.present + item.present,
    absent: sum.absent + item.absent,
    late: sum.late + item.late,
    excused: sum.excused + item.excused,
    halfDay: sum.halfDay + item.halfDay,
    leave: sum.leave + item.leave,
    total: sum.total + item.total,
  }),{present:0,absent:0,late:0,excused:0,halfDay:0,leave:0,total:0});

  const studentRecords=await rows<{studentId:string;studentName:string;present:number;absent:number;late:number;excused:number;halfDay:number;leave:number;total:number}>(
    `SELECT s.id AS "studentId",s.name AS "studentName",
      SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END)::int present,
      SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END)::int absent,
      SUM(CASE WHEN a.status='Late' THEN 1 ELSE 0 END)::int late,
      SUM(CASE WHEN a.status='Excused' THEN 1 ELSE 0 END)::int excused,
      SUM(CASE WHEN a.status IN ('Half-day','Half Day') THEN 1 ELSE 0 END)::int "halfDay",
      SUM(CASE WHEN a.status='Leave' THEN 1 ELSE 0 END)::int leave,
      COUNT(*)::int total
     FROM attendance a
     JOIN students s ON s.id=a.student_id AND s.institution_id=a.institution_id
     JOIN student_enrollments e ON e.student_id=a.student_id AND e.institution_id=a.institution_id AND e.academic_year=?
     WHERE ${where.join(" AND ")}
     GROUP BY s.id,s.name ORDER BY s.name`,
    [input.academicYear,...args],db,
  );

  const effectivePresent = totals.present + totals.late + (0.5 * totals.halfDay);
  const denominator = totals.total - totals.excused - totals.leave;
  const rate = denominator > 0 ? Number(((effectivePresent / denominator) * 100).toFixed(2)) : (totals.total > 0 ? 100 : 0);

  return {...totals,rate,records,studentRecords};
}

export async function listAttendanceAuditHistory(
  institutionId: string,
  filter: {
    academicYear?: string;
    className?: string;
    section?: string;
    date?: string;
    studentId?: string;
    limit?: number;
  } = {}
) {
  const db = await ready();
  const where = ["l.institution_id = ?"];
  const args: unknown[] = [institutionId];
  if (filter.academicYear) { where.push("l.academic_year = ?"); args.push(filter.academicYear); }
  if (filter.className) { where.push("l.class_name = ?"); args.push(filter.className); }
  if (filter.section) { where.push("l.section = ?"); args.push(filter.section); }
  if (filter.date) { where.push("l.date = ?"); args.push(filter.date); }
  if (filter.studentId) { where.push("l.student_id = ?"); args.push(filter.studentId); }
  const limit = Math.min(Math.max(filter.limit || 50, 1), 200);
  args.push(limit);
  return rows<{
    id: string;
    studentId: string;
    studentName: string;
    admission: string;
    rollNumber: string;
    className: string;
    section: string;
    date: string;
    previousStatus: string | null;
    newStatus: string;
    previousRemarks: string;
    newRemarks: string;
    changedBy: string;
    changedByName: string;
    reason: string;
    createdAt: string;
  }>(
    `SELECT l.id, l.student_id AS "studentId", s.name AS "studentName", s.admission, s.roll_number AS "rollNumber",
            l.class_name AS "className", l.section, l.date, l.previous_status AS "previousStatus",
            l.new_status AS "newStatus", l.previous_remarks AS "previousRemarks", l.new_remarks AS "newRemarks",
            l.changed_by AS "changedBy", COALESCE(u.name, 'Staff') AS "changedByName", l.reason, l.created_at::text AS "createdAt"
     FROM attendance_audit_logs l
     JOIN students s ON s.id = l.student_id AND s.institution_id = l.institution_id
     LEFT JOIN users u ON u.id = l.changed_by
     WHERE ${where.join(" AND ")}
     ORDER BY l.created_at DESC, (CASE WHEN l.previous_status IS NULL THEN 0 ELSE 1 END) DESC LIMIT ?`,
    args,
    db
  );
}

export async function studentAttendanceMonthlyReport(
  institutionId: string,
  input: {
    academicYear: string;
    className: string;
    section: string;
    yearMonth: string; // YYYY-MM
  }
) {
  const db = await ready();
  await ensureStudentEnrollments(institutionId, db);
  const [yrStr, moStr] = input.yearMonth.split("-");
  const yearNum = parseInt(yrStr, 10);
  const monthNum = parseInt(moStr, 10);
  const daysInMonth = new Date(Date.UTC(yearNum, monthNum, 0)).getUTCDate();
  const startDate = `${input.yearMonth}-01`;
  const endDate = `${input.yearMonth}-${String(daysInMonth).padStart(2, "0")}`;

  const timetable = await getTimetableSettings(institutionId);
  const workingDays = new Set(timetable.workingDays || [1, 2, 3, 4, 5, 6]);

  const holidays = await rows<{ date: string; name: string; type: string }>(
    `SELECT date, name, type FROM school_holidays WHERE institution_id = ? AND date >= ? AND date <= ?`,
    [institutionId, startDate, endDate],
    db
  );
  const holidayMap = new Map(holidays.map((h) => [h.date, h]));

  const days: { date: string; day: number; weekday: number; isWeekend: boolean; holiday: string | null }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    const fullDate = `${input.yearMonth}-${dayStr}`;
    const dt = new Date(`${fullDate}T00:00:00Z`);
    const isoWeekday = dt.getUTCDay() === 0 ? 7 : dt.getUTCDay();
    const isWorking = workingDays.has(isoWeekday);
    const holidayInfo = holidayMap.get(fullDate);
    days.push({
      date: fullDate,
      day: d,
      weekday: isoWeekday,
      isWeekend: !isWorking,
      holiday: holidayInfo ? holidayInfo.name : null,
    });
  }

  const students = await rows<{
    id: string;
    name: string;
    admission: string;
    rollNumber: string;
  }>(
    `SELECT s.id, s.name, s.admission, s.roll_number AS "rollNumber"
     FROM student_enrollments e
     JOIN students s ON s.id = e.student_id AND s.institution_id = e.institution_id
     WHERE e.institution_id = ? AND e.academic_year = ? AND e.class_name = ? AND e.section = ? AND e.status = 'Active' AND s.status = 'Active'
     ORDER BY s.name`,
    [institutionId, input.academicYear, input.className, input.section],
    db
  );

  const records = await rows<{
    studentId: string;
    date: string;
    status: string;
    remarks: string;
  }>(
    `SELECT a.student_id AS "studentId", a.date, a.status, a.remarks
     FROM attendance a
     JOIN student_enrollments e ON e.student_id = a.student_id AND e.institution_id = a.institution_id
     WHERE a.institution_id = ? AND e.academic_year = ? AND e.class_name = ? AND e.section = ? AND a.date >= ? AND a.date <= ?`,
    [institutionId, input.academicYear, input.className, input.section, startDate, endDate],
    db
  );

  const studentMap = new Map<string, { [date: string]: { status: string; remarks: string } }>();
  for (const r of records) {
    if (!studentMap.has(r.studentId)) studentMap.set(r.studentId, {});
    studentMap.get(r.studentId)![r.date] = { status: r.status, remarks: r.remarks };
  }

  const studentSummaries = students.map((s) => {
    const att = studentMap.get(s.id) || {};
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let halfDay = 0;
    let totalMarked = 0;

    for (const day of days) {
      const rec = att[day.date];
      if (rec) {
        totalMarked++;
        const st = rec.status;
        if (st === "Present") present++;
        else if (st === "Absent") absent++;
        else if (st === "Late") late++;
        else if (st === "Excused" || st === "Leave") excused++;
        else if (st === "Half-day" || st === "Half Day") halfDay++;
      }
    }

    const effectivePresent = present + late + (0.5 * halfDay);
    const denominator = totalMarked - excused;
    const rate = denominator > 0 ? Number(((effectivePresent / denominator) * 100).toFixed(1)) : 100;

    return {
      studentId: s.id,
      name: s.name,
      admission: s.admission,
      rollNumber: s.rollNumber,
      statuses: att,
      present,
      absent,
      late,
      excused,
      halfDay,
      totalMarked,
      rate,
    };
  });

  return {
    yearMonth: input.yearMonth,
    className: input.className,
    section: input.section,
    days,
    students: studentSummaries,
    totalWorkingDays: days.filter((d) => !d.isWeekend && !d.holiday).length,
  };
}

export async function classAttendanceAnalytics(
  institutionId: string,
  input: {
    academicYear: string;
    className?: string;
    section?: string;
    from: string;
    to: string;
  }
) {
  const db = await ready();
  await ensureStudentEnrollments(institutionId, db);
  const where = ["a.institution_id = ?", "e.academic_year = ?", "a.date >= ?", "a.date <= ?", "s.status <> 'Deleted'"];
  const args: unknown[] = [institutionId, input.academicYear, input.from, input.to];
  if (input.className) { where.push("e.class_name = ?"); args.push(input.className); }
  if (input.section) { where.push("e.section = ?"); args.push(input.section); }

  const statusRows = await rows<{
    status: string;
    count: number;
  }>(
    `SELECT a.status, COUNT(*)::int AS count
     FROM attendance a
     JOIN students s ON s.id = a.student_id AND s.institution_id = a.institution_id
     JOIN student_enrollments e ON e.student_id = a.student_id AND e.institution_id = a.institution_id
     WHERE ${where.join(" AND ")}
     GROUP BY a.status`,
    args,
    db
  );

  let present = 0, absent = 0, late = 0, excused = 0, halfDay = 0, total = 0;
  for (const row of statusRows) {
    const c = Number(row.count);
    total += c;
    if (row.status === "Present") present += c;
    else if (row.status === "Absent") absent += c;
    else if (row.status === "Late") late += c;
    else if (row.status === "Excused" || row.status === "Leave") excused += c;
    else if (row.status === "Half-day" || row.status === "Half Day") halfDay += c;
  }

  const effectivePresent = present + late + (0.5 * halfDay);
  const denominator = total - excused;
  const overallRate = denominator > 0 ? Number(((effectivePresent / denominator) * 100).toFixed(2)) : (total > 0 ? 100 : 0);

  const dailyTrend = await rows<{
    date: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    halfDay: number;
    total: number;
  }>(
    `SELECT a.date,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int present,
            SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END)::int absent,
            SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END)::int late,
            SUM(CASE WHEN a.status IN ('Excused', 'Leave') THEN 1 ELSE 0 END)::int excused,
            SUM(CASE WHEN a.status IN ('Half-day', 'Half Day') THEN 1 ELSE 0 END)::int "halfDay",
            COUNT(*)::int total
     FROM attendance a
     JOIN students s ON s.id = a.student_id AND s.institution_id = a.institution_id
     JOIN student_enrollments e ON e.student_id = a.student_id AND e.institution_id = a.institution_id
     WHERE ${where.join(" AND ")}
     GROUP BY a.date
     ORDER BY a.date ASC`,
    args,
    db
  );

  const formattedTrend = dailyTrend.map((d) => {
    const eff = d.present + d.late + (0.5 * d.halfDay);
    const den = d.total - d.excused;
    const r = den > 0 ? Number(((eff / den) * 100).toFixed(1)) : 100;
    return { ...d, rate: r };
  });

  const lowAttendance = await rows<{
    studentId: string;
    name: string;
    admission: string;
    rollNumber: string;
    className: string;
    section: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    halfDay: number;
    total: number;
  }>(
    `SELECT s.id AS "studentId", s.name, s.admission, s.roll_number AS "rollNumber",
            e.class_name AS "className", e.section,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END)::int present,
            SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END)::int absent,
            SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END)::int late,
            SUM(CASE WHEN a.status IN ('Excused', 'Leave') THEN 1 ELSE 0 END)::int excused,
            SUM(CASE WHEN a.status IN ('Half-day', 'Half Day') THEN 1 ELSE 0 END)::int "halfDay",
            COUNT(*)::int total
     FROM attendance a
     JOIN students s ON s.id = a.student_id AND s.institution_id = a.institution_id
     JOIN student_enrollments e ON e.student_id = a.student_id AND e.institution_id = a.institution_id
     WHERE ${where.join(" AND ")}
     GROUP BY s.id, s.name, s.admission, s.roll_number, e.class_name, e.section
     HAVING COUNT(*) >= 3
     ORDER BY s.name`,
    args,
    db
  );

  const atRisk = lowAttendance
    .map((s) => {
      const eff = s.present + s.late + (0.5 * s.halfDay);
      const den = s.total - s.excused;
      const rate = den > 0 ? Number(((eff / den) * 100).toFixed(1)) : 100;
      return { ...s, rate };
    })
    .filter((s) => s.rate < 75)
    .sort((a, b) => a.rate - b.rate);

  return {
    total,
    present,
    absent,
    late,
    excused,
    halfDay,
    overallRate,
    trend: formattedTrend,
    atRiskStudents: atRisk,
  };
}

export async function listSchoolHolidays(institutionId: string, academicYear?: string) {
  const db = await ready();
  if (academicYear) {
    return rows<{ id: string; academicYear: string; date: string; name: string; type: string; description: string }>(
      `SELECT id, academic_year AS "academicYear", date, name, type, description FROM school_holidays WHERE institution_id = ? AND academic_year = ? ORDER BY date ASC`,
      [institutionId, academicYear],
      db
    );
  }
  return rows<{ id: string; academicYear: string; date: string; name: string; type: string; description: string }>(
    `SELECT id, academic_year AS "academicYear", date, name, type, description FROM school_holidays WHERE institution_id = ? ORDER BY date ASC`,
    [institutionId],
    db
  );
}

export async function addSchoolHoliday(
  institutionId: string,
  userId: string,
  input: {
    academicYear: string;
    date: string;
    name: string;
    type?: "Public Holiday" | "School Holiday" | "Vacation" | "Weather Emergency" | "Administrative";
    description?: string;
  }
) {
  const db = await ready();
  const id = randomUUID();
  const type = input.type || "School Holiday";
  const description = input.description || "";
  await run(
    `INSERT INTO school_holidays(id, institution_id, academic_year, date, name, type, description)
     VALUES(?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(institution_id, date) DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       description = EXCLUDED.description,
       academic_year = EXCLUDED.academic_year`,
    [id, institutionId, input.academicYear, input.date, input.name.trim(), type, description.trim()],
    db
  );
  await audit(institutionId, userId, "School Holiday Saved", "Holiday", input.date, { ...input }, db);
  return { id, institutionId, ...input, type, description };
}

export async function deleteSchoolHoliday(institutionId: string, userId: string, id: string) {
  const db = await ready();
  await run(`DELETE FROM school_holidays WHERE institution_id = ? AND id = ?`, [institutionId, id], db);
  await audit(institutionId, userId, "School Holiday Deleted", "Holiday", id, {}, db);
  return true;
}

export async function changeStudentStatus(institutionId:string,id:string,userId:string,input:{status:"Active"|"Inactive"|"Left Out"|"Transferred"|"Graduated"|"Archived";leavingDate?:string;reason?:string;remarks?:string}){
  const student=await getStudent(institutionId,id);if(!student)throw new Error("Student not found");
  if(student.status===input.status)throw new Error(`Student is already ${input.status}.`);
  if(input.status!=="Active"&&(!input.leavingDate||!input.reason?.trim()))throw new Error("Leaving date and reason are required.");
  if(input.status==="Active"&&student.status!=="Active")await assertStudentCapacity(institutionId,1);
  await connection().begin(async tx=>{await run("UPDATE students SET status=?,leaving_date=?,leaving_reason=?,leaving_remarks=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[input.status,input.status==="Active"?null:input.leavingDate||null,input.status==="Active"?"":input.reason?.trim()||"",input.status==="Active"?"":input.remarks?.trim()||"",id,institutionId],tx);if(input.status==="Active")await run("UPDATE student_enrollments SET status='Active',updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND student_id=? AND academic_year=?",[institutionId,id,student.academicYear],tx);else await run("UPDATE student_enrollments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND student_id=? AND academic_year=? AND status='Active'",[input.status,institutionId,id,student.academicYear],tx);await audit(institutionId,userId,input.status==="Active"?"Student Reactivated":input.status==="Graduated"?"Student Graduated":input.status==="Transferred"?"Student Transferred Out":"Student Withdrawn","Student",id,{oldStatus:student.status,newStatus:input.status,effectiveDate:input.leavingDate,reason:input.reason,remarks:input.remarks,outstandingFee:student.pendingFee},tx)});
  return (await getStudent(institutionId,id))!;
}
export async function createFee(
  institutionId: string,
  studentId: string,
  input: {
    feeType: string;
    academicYear: string;
    totalAmount: number;
    dueDate: string;
  },
  userId?: string,
) {
  if (!(await getStudent(institutionId, studentId)))
    throw new Error("Student not found");
  const id = randomUUID();
  await connection().begin(async (tx) => {
    const invoice = await nextNumber(institutionId, "INV", new Date(), tx);
    await run(
      "INSERT INTO fees(id,institution_id,student_id,invoice_number,fee_type,academic_year,total_amount,final_amount,pending_amount,due_date,status)VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        institutionId,
        studentId,
        invoice,
        input.feeType,
        input.academicYear,
        input.totalAmount,
        input.totalAmount,
        input.totalAmount,
        input.dueDate,
        "Pending",
      ],
      tx,
    );
    await run(
      "UPDATE students SET total_fee=total_fee+?,pending_fee=pending_fee+?,fee='Pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",
      [input.totalAmount, input.totalAmount, studentId, institutionId],
      tx,
    );
    await audit(
      institutionId,
      userId,
      "Fee Created",
      "Fee",
      id,
      { invoice, totalAmount: input.totalAmount },
      tx,
    );
  });
  return id;
}

const paymentSelect = `SELECT p.id,p.fee_id AS "feeId",p.student_id AS "studentId",s.name AS "studentName",s.admission,COALESCE(e.class_name,s.class_name) AS "className",COALESCE(e.section,s.section) AS section,s.roll_number AS "rollNumber",s.parent,f.invoice_number AS "invoiceNumber",f.fee_type AS "feeType",f.academic_year AS "academicYear",f.discount,f.final_amount AS "finalAmount",p.payment_frequency AS "paymentFrequency",p.original_amount AS "originalAmount",p.discount_type AS "discountType",p.discount_value AS "discountValue",p.discount_amount AS "discountAmount",p.discount_reason AS "discountReason",p.late_fee AS "lateFee",p.net_payable AS "netPayable",p.receipt_number AS "receiptNumber",p.amount,p.payment_method AS method,p.transaction_id AS "transactionId",p.payment_date AS "paymentDate",p.status,p.notes,(SELECT COALESCE(SUM(p2.amount),0) FROM payments p2 WHERE p2.institution_id=p.institution_id AND p2.fee_id=p.fee_id AND p2.status='Success' AND (p2.created_at,p2.id)<(p.created_at,p.id)) AS "previouslyPaid",(SELECT COALESCE(SUM(p2.amount),0) FROM payments p2 WHERE p2.institution_id=p.institution_id AND p2.fee_id=p.fee_id AND p2.status='Success' AND (p2.created_at,p2.id)<=(p.created_at,p.id)) AS "totalPaid",(f.final_amount-(SELECT COALESCE(SUM(p2.amount),0) FROM payments p2 WHERE p2.institution_id=p.institution_id AND p2.fee_id=p.fee_id AND p2.status='Success' AND (p2.created_at,p2.id)<=(p.created_at,p.id))) AS "remainingBalance",p.created_at::text AS "createdAt" FROM payments p JOIN students s ON s.id=p.student_id AND s.institution_id=p.institution_id JOIN fees f ON f.id=p.fee_id AND f.institution_id=p.institution_id LEFT JOIN student_enrollments e ON e.student_id=p.student_id AND e.institution_id=p.institution_id AND e.academic_year=f.academic_year`;
async function getPayment(institutionId: string, id: string) {
  return await row<DbPayment>(
    `${paymentSelect} WHERE p.institution_id=? AND p.id=?`,
    [institutionId, id],
    await ready(),
  );
}
export async function getReceipt(institutionId: string, receipt: string) {
  return await row<DbPayment>(
    `${paymentSelect} WHERE p.institution_id=? AND p.receipt_number=? AND p.status='Success'`,
    [institutionId, receipt],
    await ready(),
  );
}
export async function getReceiptForAdmin(receipt:string){return row<DbPayment&{institutionId:string}>(`${paymentSelect.replace("SELECT p.id","SELECT p.institution_id AS \"institutionId\",p.id")} WHERE p.receipt_number=? AND p.status='Success'`,[receipt],await ready())}
export async function listPayments(
  institutionId: string,
  filters: {
    search?: string;
    className?: string;
    section?: string;
    method?: string;
    status?: string;
    from?: string;
    to?: string;
    studentId?: string;
    academicYear?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const where = ["p.institution_id=?"],
    args: unknown[] = [institutionId];
  if(filters.status!=="All"){where.push("p.status=?");args.push(filters.status||"Success")}
  if (filters.search) {
    where.push(
      "(s.name ILIKE ? OR s.admission ILIKE ? OR s.roll_number ILIKE ? OR p.receipt_number ILIKE ? OR f.invoice_number ILIKE ? OR p.transaction_id ILIKE ? OR s.parent_phone ILIKE ?)",
    );
    const q = `%${filters.search}%`;
    args.push(q, q, q, q, q, q, q);
  }
  for (const [k, col] of [
    ["className", "COALESCE(e.class_name,s.class_name)"],
    ["section", "COALESCE(e.section,s.section)"],
    ["method", "p.payment_method"],
    ["studentId", "p.student_id"],
  ] as const)
    if (filters[k]) {
      where.push(`${col}=?`);
      args.push(filters[k]);
    }
  if (filters.from) {
    where.push("p.payment_date>=?");
    args.push(filters.from);
  }
  if (filters.to) {
    where.push("p.payment_date<=?");
    args.push(filters.to);
  }
  if (filters.academicYear) {
    where.push("f.academic_year=?");
    args.push(filters.academicYear);
  }
  let query = `${paymentSelect} WHERE ${where.join(" AND ")} ORDER BY p.payment_date DESC,p.created_at DESC`;
  if (filters.limit) {
    query += " LIMIT ? OFFSET ?";
    args.push(filters.limit, filters.offset ?? 0);
  }
  return await rows<DbPayment>(query, args, await ready());
}
export async function paymentRequestExists(institutionId:string,requestId:string){return Boolean(await row<{id:string}>('SELECT id FROM payments WHERE institution_id=? AND request_id=?',[institutionId,requestId],await ready()))}

export async function recordPayment(
  institutionId: string,
  userId: string,
  input: {
    feeId: string;
    amount: number;
    method: string;
    paymentDate: string;
    transactionId: string;
    notes: string;
    requestId?: string;
    frequency?: string;
    discountType?: "Fixed" | "Percentage";
    discountValue?: number;
    discountReason?: string;
    lateFee?: number;
    receiptNumber?: string;
  },
) {
  await ready();
  const frequency=input.frequency||"Custom",discountType=input.discountType||"Fixed",discountValue=input.discountValue||0,discountReason=input.discountReason||"",lateFee=input.lateFee||0;
  let id = "";
  await connection().begin(async (tx) => {
    if(input.requestId){
      const previous=await row<{id:string;feeId:string}>('SELECT id,fee_id AS "feeId" FROM payments WHERE institution_id=? AND request_id=?',[institutionId,input.requestId],tx);
      if(previous){if(previous.feeId!==input.feeId)throw new Error("Payment request belongs to another invoice.");id=previous.id;return}
    }
    const fee = await row<Record<string, string | number>>(
      'SELECT f.id,f.student_id AS "studentId",s.name AS "studentName",f.invoice_number AS "invoiceNumber",f.academic_year AS "academicYear",f.final_amount AS "finalAmount",f.paid_amount AS "paidAmount",f.pending_amount AS "pendingAmount" FROM fees f JOIN students s ON s.id=f.student_id AND s.institution_id=f.institution_id WHERE f.institution_id=? AND f.id=? FOR UPDATE',
      [institutionId, input.feeId],
      tx,
    );
    if (!fee) throw new Error("Fee invoice not found");
    const cents=Math.round(input.amount*100),pendingCents=Math.round(Number(fee.pendingAmount)*100),paidCents=Math.round(Number(fee.paidAmount)*100),finalCents=Math.round(Number(fee.finalAmount)*100),discountValueCents=Math.round(discountValue*100),lateFeeCents=Math.round(lateFee*100);
    if(!Number.isFinite(input.amount)||Math.abs(input.amount*100-cents)>1e-8||cents<=0)
      throw new Error("Payment amount must be positive with at most two decimal places.");
    if(!Number.isFinite(discountValue)||discountValueCents<0||!Number.isFinite(lateFee)||lateFeeCents<0)throw new Error("Discount and late fee must be valid non-negative amounts.");
    const discountCents=discountType==="Percentage"?Math.round(pendingCents*discountValue/100):discountValueCents;
    if(discountType==="Percentage"&&discountValue>100)throw new Error("Percentage discount cannot exceed 100%.");
    if(discountCents>pendingCents)throw new Error("Discount cannot exceed the outstanding fee.");
    const adjustedFinalCents=finalCents-discountCents+lateFeeCents,adjustedPendingCents=pendingCents-discountCents+lateFeeCents;
    if(cents>adjustedPendingCents)throw new Error("Payment cannot exceed the net payable amount.");
    const suppliedReceipt=input.receiptNumber?.trim();
    if(suppliedReceipt&&!/^[A-Za-z0-9][A-Za-z0-9/_-]{2,49}$/.test(suppliedReceipt))throw new Error("Receipt number contains unsupported characters.");
    const receipt = suppliedReceipt||await nextNumber(institutionId,"REC",new Date(input.paymentDate),tx),
      total = (paidCents+cents)/100,
      remaining = Math.max(adjustedFinalCents-paidCents-cents,0)/100,
      status = remaining ? "Partially Paid" : "Paid";
    id = randomUUID();
    await run(
      "INSERT INTO payments(id,institution_id,student_id,fee_id,receipt_number,amount,payment_method,transaction_id,payment_date,status,notes,request_id,created_by,payment_frequency,original_amount,discount_type,discount_value,discount_amount,discount_reason,late_fee,net_payable)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        institutionId,
        fee.studentId,
        input.feeId,
        receipt,
        input.amount,
        input.method,
        input.transactionId,
        input.paymentDate,
        "Success",
        input.notes,
        input.requestId||null,
        userId,
        frequency,
        pendingCents/100,
        discountType,
        discountValue,
        discountCents/100,
        discountReason,
        lateFeeCents/100,
        adjustedPendingCents/100,
      ],
      tx,
    );
    await run(
      "UPDATE fees SET discount=discount+?,final_amount=?,paid_amount=?,pending_amount=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",
      [discountCents/100,adjustedFinalCents/100,total,remaining,status,input.feeId,institutionId],
      tx,
    );
    await run(
      "UPDATE students SET paid_fee=(SELECT COALESCE(SUM(paid_amount),0) FROM fees WHERE student_id=? AND institution_id=?),pending_fee=(SELECT COALESCE(SUM(pending_amount),0) FROM fees WHERE student_id=? AND institution_id=?),total_fee=(SELECT COALESCE(SUM(final_amount),0) FROM fees WHERE student_id=? AND institution_id=?),fee=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",
      [fee.studentId,institutionId,fee.studentId,institutionId,fee.studentId,institutionId,status,fee.studentId,institutionId],
      tx,
    );
    await run(
      "INSERT INTO receipts(id,institution_id,receipt_number,student_id,payment_id,invoice_number,amount,payment_method,transaction_id,issued_date)VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(),
        institutionId,
        receipt,
        fee.studentId,
        id,
        fee.invoiceNumber,
        input.amount,
        input.method,
        input.transactionId,
        input.paymentDate,
      ],
      tx,
    );
    await run("INSERT INTO account_transactions(id,institution_id,academic_year,transaction_type,category,amount_paise,transaction_date,description,payment_method,reference_number,source_type,source_id,status,notes,created_by)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[randomUUID(),institutionId,String(fee.academicYear||""),"income","Tuition Fees",cents,input.paymentDate,`${fee.studentName} · ${fee.invoiceNumber}`,input.method,receipt,"fee_payment",id,"Active",input.notes,userId],tx);
    await activity(
      institutionId,
      "payment",
      "Fee payment received",
      `${fee.studentName} paid ₹${input.amount.toLocaleString("en-IN")}`,
      String(fee.studentId),
      id,
      input.amount,
      tx,
    );
    await audit(
      institutionId,
      userId,
      "Payment Created",
      "Payment",
      id,
      { amount: input.amount, receipt, invoice:fee.invoiceNumber,frequency,discountAmount:discountCents/100,discountReason,lateFee:lateFeeCents/100 },
      tx,
    );
    await notify(
      institutionId,
      userId,
      "payment",
      "Payment Received",
      `₹${input.amount.toLocaleString("en-IN")} student fee payment received successfully. Payment ID: ${input.transactionId||receipt}. Date: ${input.paymentDate}. Status: Successful.`,
      tx,
      `payment-${id}-${userId}`,
    );
  });
  const payment=(await getPayment(institutionId, id))!;
  await queueAutomaticWhatsAppEvent(institutionId,userId,{studentId:payment.studentId,event:"fee_receipt",idempotencyKey:`fee-receipt:${id}`,values:{amount:`₹${payment.amount.toLocaleString("en-IN")}`,receipt_number:payment.receiptNumber,date:payment.paymentDate,class_name:payment.className,section:payment.section},documentKind:"Fee Receipt PDF",documentReference:`receipt:${payment.receiptNumber}`});
  try {
    import("./notifications").then(({ notifyFeePayment }) => {
      notifyFeePayment({
        institutionId,
        studentId: payment.studentId,
        studentName: payment.studentName,
        amountPaise: Math.round(payment.amount * 100),
        paymentId: payment.id,
        receiptNumber: payment.receiptNumber,
        title: payment.feeType || "School Fees",
      }).catch(() => {});
    }).catch(() => {});
  } catch {
    // non-blocking
  }
  return payment;
}

async function listActivities(institutionId: string, limit = 25) {
  return await rows(
    'SELECT id,type,title,description,student_id AS "studentId",payment_id AS "paymentId",amount,timestamp::text,status FROM activities WHERE institution_id=? ORDER BY timestamp DESC LIMIT ?',
    [institutionId, limit],
    await ready(),
  );
}
export async function dashboardYears(institutionId: string) {
  const db = await ready();
  const years = await rows<{name:string;startMonth:number;endMonth:number;isActive:boolean}>(
    'SELECT name,start_month AS "startMonth",end_month AS "endMonth",is_active AS "isActive" FROM academic_years WHERE institution_id=? AND status=\'Active\' ORDER BY name DESC',
    [institutionId], db);
  return years;
}
export type DailyFeeCollection = { date:string; amount:number };
export async function dailyFeeCollections(institutionId:string,academicYear:string,from:string,to:string) {
  validDate(from); validDate(to);
  if(from>to)throw new Error("The start date must be on or before the end date.");
  const dayCount=Math.floor((new Date(`${to}T00:00:00Z`).getTime()-new Date(`${from}T00:00:00Z`).getTime())/864e5)+1;
  if(dayCount>366)throw new Error("Fee collection ranges cannot exceed 366 days.");
  const db=await ready();
  const school=await row<{timezone:string}>("SELECT COALESCE(NULLIF(timetable_timezone,''),'Asia/Kolkata') timezone FROM settings WHERE institution_id=?",[institutionId],db);
  const raw=await rows<{date:string;amount:number}>(
    "SELECT p.payment_date date,COALESCE(SUM(p.amount),0) amount FROM payments p JOIN fees f ON f.id=p.fee_id AND f.institution_id=p.institution_id WHERE p.institution_id=? AND f.academic_year=? AND p.status='Success' AND p.payment_date>=? AND p.payment_date<=? GROUP BY p.payment_date ORDER BY p.payment_date",
    [institutionId,academicYear,from,to],db);
  const amounts=new Map(raw.map(item=>[item.date,Number(item.amount)]));
  const data:DailyFeeCollection[]=[];
  for(let date=from;date<=to;date=nextDate(date)){
    const amount=amounts.get(date)??0;
    data.push({date,amount:Number.isFinite(amount)&&amount>=0?amount:0});
  }
  return {data,total:data.reduce((sum,item)=>sum+item.amount,0),timezone:school?.timezone||"Asia/Kolkata",from,to};
}
export async function dashboardData(institutionId: string, academicYear: string) {
  const db = await ready();
  const year = await row<{startMonth:number;endMonth:number}>(
    "SELECT start_month AS \"startMonth\",end_month AS \"endMonth\" FROM academic_years WHERE institution_id=? AND name=? AND status='Active'",
    [institutionId, academicYear], db);
  if (!year) throw new Error("Academic year unavailable");
  const startYear = Number(academicYear.slice(0, 4));
  const endYear = year.endMonth < year.startMonth ? startYear + 1 : startYear;
  const startDate = `${startYear}-${String(year.startMonth).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(endYear, year.endMonth, 0)).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10),
    month = today.slice(0, 7);
  const [
    students,
    teachers,
    staff,
    attendance,
    fees,
    collections,
    monthly,
    methods,
    recentPayments,
    activities,
    finance,
  ] = await Promise.all([
    row<{ count: number }>(
      "SELECT COUNT(*)::int count FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.academic_year=? AND s.status<>'Deleted'",
      [institutionId, academicYear],
      db,
    ),
    row<{ count: number }>(
      "SELECT COUNT(*)::int count FROM teachers WHERE institution_id=? AND status='Active'",
      [institutionId], db,
    ),
    row<{ count: number }>(
      "SELECT COUNT(*)::int count FROM users WHERE institution_id=? AND role IN ('STAFF','ACCOUNTANT','LIBRARIAN') AND COALESCE(status,'Active')='Active'",
      [institutionId], db,
    ),
    row<{ present: number | null; absent: number | null }>(
      "SELECT SUM(CASE WHEN a.status IN ('Present','Late') THEN 1 ELSE 0 END)::int present,SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END)::int absent FROM attendance a JOIN student_enrollments e ON e.student_id=a.student_id AND e.institution_id=a.institution_id JOIN students s ON s.id=a.student_id AND s.institution_id=a.institution_id AND s.status<>'Deleted' WHERE a.institution_id=? AND a.date=? AND e.academic_year=? AND a.date BETWEEN ? AND ?",
      [institutionId, today, academicYear, startDate, endDate],
      db,
    ),
    row<{ total: number; collected: number; pending: number; overdue: number }>(
      "SELECT COALESCE(SUM(f.final_amount),0) total,COALESCE(SUM(COALESCE(p.paid,0)),0) collected,COALESCE(SUM(CASE WHEN f.final_amount>COALESCE(p.paid,0) THEN f.final_amount-COALESCE(p.paid,0) ELSE 0 END),0) pending,COALESCE(SUM(CASE WHEN f.due_date<? AND f.final_amount>COALESCE(p.paid,0) THEN f.final_amount-COALESCE(p.paid,0) ELSE 0 END),0) overdue FROM fees f LEFT JOIN (SELECT institution_id,fee_id,SUM(amount) paid FROM payments WHERE status='Success' GROUP BY institution_id,fee_id) p ON p.fee_id=f.id AND p.institution_id=f.institution_id WHERE f.institution_id=? AND f.academic_year=?",
      [today, institutionId, academicYear],
      db,
    ),
    row<{ today: number; month: number; transactions: number }>(
      'SELECT COALESCE(SUM(CASE WHEN p.payment_date=? THEN p.amount ELSE 0 END),0) today,COALESCE(SUM(CASE WHEN SUBSTRING(p.payment_date,1,7)=? THEN p.amount ELSE 0 END),0) AS "month",COUNT(*)::int transactions FROM payments p JOIN fees f ON f.id=p.fee_id WHERE p.institution_id=? AND p.status=\'Success\' AND f.academic_year=?',
      [today, month, institutionId, academicYear],
      db,
    ),
    rows<{ month: string; amount: number }>(
      'SELECT SUBSTRING(p.payment_date,1,7) AS "month",SUM(p.amount) amount FROM payments p JOIN fees f ON f.id=p.fee_id WHERE p.institution_id=? AND p.status=\'Success\' AND f.academic_year=? GROUP BY SUBSTRING(p.payment_date,1,7) ORDER BY "month" DESC LIMIT 12',
      [institutionId, academicYear],
      db,
    ),
    rows(
      "SELECT p.payment_method method,SUM(p.amount) amount FROM payments p JOIN fees f ON f.id=p.fee_id WHERE p.institution_id=? AND p.status='Success' AND f.academic_year=? GROUP BY p.payment_method ORDER BY amount DESC",
      [institutionId, academicYear],
      db,
    ),
    listPayments(institutionId, { limit: 5, academicYear }),
    rows('SELECT a.id,a.title,a.description,a.timestamp::text AS timestamp FROM activities a LEFT JOIN payments p ON p.id=a.payment_id LEFT JOIN fees f ON f.id=p.fee_id LEFT JOIN student_enrollments e ON e.student_id=a.student_id AND e.institution_id=a.institution_id AND e.academic_year=? WHERE a.institution_id=? AND ((f.academic_year=?) OR (e.id IS NOT NULL AND SUBSTRING(a.timestamp::text,1,10) BETWEEN ? AND ?)) ORDER BY a.timestamp DESC LIMIT 6', [academicYear,institutionId,academicYear,startDate,endDate], db),
    row<{income:number;expenses:number}>("SELECT COALESCE(SUM(CASE WHEN transaction_type='income' THEN amount_paise ELSE 0 END),0)::int income,COALESCE(SUM(CASE WHEN transaction_type='expense' THEN amount_paise ELSE 0 END),0)::int expenses FROM account_transactions WHERE institution_id=? AND academic_year=? AND status='Active'",[institutionId,academicYear],db),
  ]);
  return {
    students: students.count,
    teachers: teachers.count,
    staff: staff.count,
    present: attendance?.present ?? 0,
    absent: attendance?.absent ?? 0,
    fees: fees ?? { total: 0, collected: 0, pending: 0, overdue: 0 },
    collections: collections ?? { today: 0, month: 0, transactions: 0 },
    monthly: monthly.reverse(),
    methods,
    recentPayments,
    activities,
    finance: {income:(finance?.income??0)/100,expenses:(finance?.expenses??0)/100},
  };
}

export async function schoolReportAnalytics(institutionId:string,academicYear:string,from:string,to:string){
  validDate(from);validDate(to);if(from>to)throw new Error("The start date must be on or before the end date.");
  const days=Math.floor((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000)+1;if(days>366)throw new Error("Report date ranges cannot exceed 366 days.");
  const db=await ready(),year=await row<{name:string;startMonth:number;endMonth:number}>("SELECT name,start_month AS \"startMonth\",end_month AS \"endMonth\" FROM academic_years WHERE institution_id=? AND name=? AND status='Active'",[institutionId,academicYear],db);
  if(!year)throw new Error("Academic year unavailable.");
  const [studentCounts,classes,admissions,attendance,academics,fees,staff,paymentModes]=await Promise.all([
    row<{active:number;inactive:number;total:number;girls:number;boys:number}>("SELECT COUNT(*) FILTER (WHERE s.status='Active')::int AS active,COUNT(*) FILTER (WHERE s.status NOT IN ('Active','Deleted'))::int AS inactive,COUNT(*) FILTER (WHERE s.status<>'Deleted')::int AS total,COUNT(*) FILTER (WHERE LOWER(s.gender) IN ('female','girl'))::int AS girls,COUNT(*) FILTER (WHERE LOWER(s.gender) IN ('male','boy'))::int AS boys FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.academic_year=? AND e.status='Active'",[institutionId,academicYear],db),
    rows<{className:string;section:string;students:number}>("SELECT e.class_name AS \"className\",e.section,COUNT(*)::int students FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.academic_year=? AND e.status='Active' AND s.status='Active' GROUP BY e.class_name,e.section ORDER BY e.class_name,e.section LIMIT 12",[institutionId,academicYear],db),
    rows<{month:string;count:number}>("SELECT SUBSTRING(s.admission_date,1,7) AS month,COUNT(*)::int count FROM students s WHERE s.institution_id=? AND s.status<>'Deleted' AND s.admission_date>=? AND s.admission_date<=? AND s.admission_date<>'' GROUP BY SUBSTRING(s.admission_date,1,7) ORDER BY month",[institutionId,from,to],db),
    row<{recorded:number;present:number;late:number;halfDay:number;absent:number}>("SELECT COUNT(*) FILTER (WHERE a.status IN ('Present','Late','Absent','Half-day','Half Day'))::int recorded,COUNT(*) FILTER (WHERE a.status='Present')::int present,COUNT(*) FILTER (WHERE a.status='Late')::int late,COUNT(*) FILTER (WHERE a.status IN ('Half-day','Half Day'))::int \"halfDay\",COUNT(*) FILTER (WHERE a.status='Absent')::int absent FROM attendance a JOIN student_enrollments e ON e.student_id=a.student_id AND e.institution_id=a.institution_id AND e.academic_year=? AND e.status='Active' JOIN students s ON s.id=a.student_id AND s.institution_id=a.institution_id WHERE a.institution_id=? AND a.date>=? AND a.date<=? AND s.status<>'Deleted'",[academicYear,institutionId,from,to],db),
    row<{averagePercent:number|null;results:number;passed:number;failed:number}>("SELECT AVG(CASE WHEN COALESCE(r.mark_status,'Scored')='Scored' AND COALESCE(e.max_marks_cent,ROUND(e.max_marks*100))>0 THEN (COALESCE(r.marks_cent,ROUND(r.marks*100))*100.0/COALESCE(e.max_marks_cent,ROUND(e.max_marks*100))) END) AS \"averagePercent\",COUNT(*) FILTER (WHERE COALESCE(r.mark_status,'Scored')='Scored')::int results,COUNT(*) FILTER (WHERE r.status='Pass' AND COALESCE(r.mark_status,'Scored')='Scored')::int passed,COUNT(*) FILTER (WHERE r.status='Fail' AND COALESCE(r.mark_status,'Scored')='Scored')::int failed FROM class_results r JOIN class_exams e ON e.id=r.exam_id AND e.institution_id=r.institution_id WHERE r.institution_id=? AND e.academic_year=?",[institutionId,academicYear],db),
    row<{total:number;collected:number;outstanding:number}>("SELECT COALESCE(SUM(f.final_amount),0) total,COALESCE(SUM(COALESCE(p.collected,0)),0) collected,COALESCE(SUM(CASE WHEN f.final_amount>COALESCE(p.paid,0) THEN f.final_amount-COALESCE(p.paid,0) ELSE 0 END),0) outstanding FROM fees f LEFT JOIN (SELECT institution_id,fee_id,SUM(CASE WHEN payment_date>=? AND payment_date<=? THEN amount ELSE 0 END) collected,SUM(amount) paid FROM payments WHERE institution_id=? AND status='Success' GROUP BY institution_id,fee_id) p ON p.institution_id=f.institution_id AND p.fee_id=f.id WHERE f.institution_id=? AND f.academic_year=?",[from,to,institutionId,institutionId,academicYear],db),
    row<{teachers:number;staff:number}>("SELECT (SELECT COUNT(*)::int FROM teachers WHERE institution_id=? AND status='Active') teachers,(SELECT COUNT(*)::int FROM users WHERE institution_id=? AND role IN ('STAFF','ACCOUNTANT','LIBRARIAN') AND COALESCE(status,'Active')='Active') staff",[institutionId,institutionId],db),
    rows<{method:string;amount:number;count:number}>("SELECT p.payment_method method,COALESCE(SUM(p.amount),0) amount,COUNT(*)::int count FROM payments p JOIN fees f ON f.id=p.fee_id AND f.institution_id=p.institution_id WHERE p.institution_id=? AND f.academic_year=? AND p.status='Success' AND p.payment_date>=? AND p.payment_date<=? GROUP BY p.payment_method ORDER BY amount DESC",[institutionId,academicYear,from,to],db),
  ]);
  const recorded=Number(attendance?.recorded||0),present=Number(attendance?.present||0),late=Number(attendance?.late||0),halfDay=Number(attendance?.halfDay||0);
  return {academicYear,from,to,students:{active:Number(studentCounts?.active||0),inactive:Number(studentCounts?.inactive||0),total:Number(studentCounts?.total||0),girls:Number(studentCounts?.girls||0),boys:Number(studentCounts?.boys||0)},classes,admissions,attendance:{recorded,present,late,halfDay,absent:Number(attendance?.absent||0),percentage:recorded?Math.round(((present+late+halfDay*0.5)/recorded)*1000)/10:null},academics:{averagePercent:academics?.averagePercent===null||academics?.averagePercent===undefined?null:Math.round(Number(academics.averagePercent)*10)/10,results:Number(academics?.results||0),passed:Number(academics?.passed||0),failed:Number(academics?.failed||0)},fees:{total:Number(fees?.total||0),collected:Number(fees?.collected||0),outstanding:Number(fees?.outstanding||0)},staff:{teachers:Number(staff?.teachers||0),staff:Number(staff?.staff||0)},paymentModes};
}
export type CompleteSettingsInput = {
  name:string; academicYear:string; schoolCode:string; startMonth:number; endMonth:number;
  address:string; phone:string; email:string; diseCode:string; website:string; city:string; state:string; pinCode:string;
  principalName:string; registrationNumber:string; affiliation:string; motto:string; schoolType:string;
  feeReceiptTitle:string; feeReceiptSubheader:string; payslipTitle:string; payslipSubheader:string; footerText:string; signatureLabel:string;
  academicYears:{name:string;startMonth:number;endMonth:number;status:"Active"|"Archived"}[];
  classes:{name:string;sections:string[]}[];
  upiEnabled?: boolean;
  upiId?: string;
  payeeName?: string;
  paymentMethodName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  paymentInstructions?: string;
};

export async function getCompleteSettings(institutionId:string) {
  const db=await ready(), institution=await getInstitution(institutionId);
  const paymentSettings=await getSchoolPaymentSettings(institutionId);
  const years=await rows<{id:string;name:string;startMonth:number;endMonth:number;status:"Active"|"Archived";isActive:boolean}>('SELECT id,name,start_month AS "startMonth",end_month AS "endMonth",status,is_active AS "isActive" FROM academic_years WHERE institution_id=? ORDER BY name DESC',[institutionId],db);
  const classRows=await rows<{id:string;name:string;status:string}>('SELECT id,name,status FROM institution_classes WHERE institution_id=? ORDER BY sort_order,name',[institutionId],db);
  const sectionRows=await rows<{classId:string;name:string}>('SELECT class_id AS "classId",name FROM institution_sections WHERE institution_id=? AND status=\'Active\' ORDER BY sort_order,name',[institutionId],db);
  const assets=await rows<{kind:string}>('SELECT kind FROM school_assets WHERE institution_id=?',[institutionId],db);
  const rollCount=await row<{count:number}>("SELECT COUNT(*)::int count FROM students WHERE institution_id=? AND roll_number<>''",[institutionId],db);
  return {
    ...institution,
    ...paymentSettings,
    rollCount:rollCount?.count ?? 0,
    logoUrl:assets.some(x=>x.kind==='logo')?"/api/settings/assets/logo":"",
    signatureUrl:assets.some(x=>x.kind==='signature')?"/api/settings/assets/signature":"",
    qrCodeUrl:paymentSettings.qrCodeUrl || (assets.some(x=>x.kind==='payment-qr')?"/api/settings/assets/payment-qr":""),
    years,
    classes:classRows.map(item=>({id:item.id,name:item.name,active:item.status==='Active'&&item.name.trim().toUpperCase()!=="LG",sections:sectionRows.filter(x=>x.classId===item.id).map(x=>x.name)}))
  };
}

export async function saveCompleteSettings(institutionId:string,userId:string,input:CompleteSettingsInput){
  const db=await ready();
  await ensurePaymentSettingsSchema(db);
  await db.begin(async tx=>{
    await run("UPDATE institutions SET name=? WHERE id=?",[input.name,institutionId],tx);
    await run(`INSERT INTO settings(institution_id,academic_year,school_code,school_address,school_phone,school_email,dise_code,website,city,state,pin_code,principal_name,registration_number,affiliation,motto,school_type,fee_receipt_title,fee_receipt_subheader,payslip_title,payslip_subheader,footer_text,signature_label,upi_enabled,upi_id,payee_name,payment_method_name,bank_name,account_number,ifsc_code,payment_instructions) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(institution_id) DO UPDATE SET academic_year=EXCLUDED.academic_year,school_code=EXCLUDED.school_code,school_address=EXCLUDED.school_address,school_phone=EXCLUDED.school_phone,school_email=EXCLUDED.school_email,dise_code=EXCLUDED.dise_code,website=EXCLUDED.website,city=EXCLUDED.city,state=EXCLUDED.state,pin_code=EXCLUDED.pin_code,principal_name=EXCLUDED.principal_name,registration_number=EXCLUDED.registration_number,affiliation=EXCLUDED.affiliation,motto=EXCLUDED.motto,school_type=EXCLUDED.school_type,fee_receipt_title=EXCLUDED.fee_receipt_title,fee_receipt_subheader=EXCLUDED.fee_receipt_subheader,payslip_title=EXCLUDED.payslip_title,payslip_subheader=EXCLUDED.payslip_subheader,footer_text=EXCLUDED.footer_text,signature_label=EXCLUDED.signature_label,upi_enabled=COALESCE(EXCLUDED.upi_enabled,settings.upi_enabled),upi_id=COALESCE(EXCLUDED.upi_id,settings.upi_id),payee_name=COALESCE(EXCLUDED.payee_name,settings.payee_name),payment_method_name=COALESCE(EXCLUDED.payment_method_name,settings.payment_method_name),bank_name=COALESCE(EXCLUDED.bank_name,settings.bank_name),account_number=COALESCE(EXCLUDED.account_number,settings.account_number),ifsc_code=COALESCE(EXCLUDED.ifsc_code,settings.ifsc_code),payment_instructions=COALESCE(EXCLUDED.payment_instructions,settings.payment_instructions),updated_at=CURRENT_TIMESTAMP`,[institutionId,input.academicYear,normalizeSchoolCode(input.schoolCode),input.address,input.phone,input.email,input.diseCode,input.website,input.city,input.state,input.pinCode,input.principalName,input.registrationNumber,input.affiliation,input.motto,input.schoolType,input.feeReceiptTitle,input.feeReceiptSubheader,input.payslipTitle,input.payslipSubheader,input.footerText,input.signatureLabel,input.upiEnabled??null,input.upiId??null,input.payeeName??null,input.paymentMethodName??null,input.bankName??null,input.accountNumber??null,input.ifscCode??null,input.paymentInstructions??null],tx);
    await run("UPDATE academic_years SET is_active=FALSE WHERE institution_id=?",[institutionId],tx);
    for(const year of input.academicYears) await run("INSERT INTO academic_years(id,institution_id,name,start_month,end_month,status,is_active)VALUES(?,?,?,?,?,?,?) ON CONFLICT(institution_id,name) DO UPDATE SET start_month=EXCLUDED.start_month,end_month=EXCLUDED.end_month,status=EXCLUDED.status,is_active=EXCLUDED.is_active,updated_at=CURRENT_TIMESTAMP",[randomUUID(),institutionId,year.name,year.startMonth,year.endMonth,year.status,year.name===input.academicYear],tx);
    for(const [order,item] of input.classes.entries()){
      const saved=await row<{id:string}>("INSERT INTO institution_classes(id,institution_id,name,sort_order,status)VALUES(?,?,?,?,'Active') ON CONFLICT(institution_id,name) DO UPDATE SET sort_order=EXCLUDED.sort_order,status='Active',updated_at=CURRENT_TIMESTAMP RETURNING id",[randomUUID(),institutionId,item.name,order],tx);
      for(const [sectionOrder,name] of item.sections.entries()){
        const existing=await row<{id:string}>("SELECT id FROM institution_sections WHERE institution_id=? AND class_id=? AND LOWER(name)=LOWER(?)",[institutionId,saved.id,name],tx);
        if(existing)await run("UPDATE institution_sections SET sort_order=?,status='Active',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[sectionOrder,existing.id,institutionId],tx);
        else{
          await run("INSERT INTO institution_sections(id,institution_id,class_id,name,sort_order,status)VALUES(?,?,?,?,?,'Active')",[randomUUID(),institutionId,saved.id,name,sectionOrder],tx);
          await run("INSERT INTO classes(id,institution_id,name,section,teacher,academic_year,capacity,status)VALUES(?,?,?,?,?,?,40,'Active') ON CONFLICT(institution_id,name,section,academic_year) DO UPDATE SET status='Active'",[randomUUID(),institutionId,item.name,name,"",input.academicYear],tx);
        }
      }
      const keptSections=item.sections.length?item.sections:["__none__"];
      await run(`UPDATE institution_sections SET status='Inactive' WHERE institution_id=? AND class_id=? AND name NOT IN (${keptSections.map(()=>"?").join(",")})`,[institutionId,saved.id,...keptSections],tx);
      await run(`UPDATE classes SET status='Inactive' WHERE institution_id=? AND academic_year=? AND name=? AND section NOT IN (${keptSections.map(()=>"?").join(",")})`,[institutionId,input.academicYear,item.name,...keptSections],tx);
    }
    const keptClasses=input.classes.length?input.classes.map(x=>x.name):["__none__"];
    await run(`UPDATE institution_classes SET status='Inactive' WHERE institution_id=? AND name NOT IN (${keptClasses.map(()=>"?").join(",")})`,[institutionId,...keptClasses],tx);
    await run(`UPDATE classes SET status='Inactive' WHERE institution_id=? AND academic_year=? AND name NOT IN (${keptClasses.map(()=>"?").join(",")})`,[institutionId,input.academicYear,...keptClasses],tx);
    await run("UPDATE institution_classes SET status='Inactive',updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND UPPER(name)='LG'",[institutionId],tx);
    await audit(institutionId,userId,"Institution Settings Updated","Settings",institutionId,{academicYear:input.academicYear,classCount:input.classes.length},tx);
  });
  return getCompleteSettings(institutionId);
}

export async function putSchoolAsset(institutionId:string,userId:string,kind:string,mimeType:string,data:Buffer){const db=await ready();await run("INSERT INTO school_assets(id,institution_id,kind,mime_type,data,size_bytes)VALUES(?,?,?,?,?,?) ON CONFLICT(institution_id,kind) DO UPDATE SET mime_type=EXCLUDED.mime_type,data=EXCLUDED.data,size_bytes=EXCLUDED.size_bytes,updated_at=CURRENT_TIMESTAMP",[randomUUID(),institutionId,kind,mimeType,data,data.length],db);await audit(institutionId,userId,`${kind==='logo'?'Logo':kind==='signature'?'Signature':kind==='payment-qr'?'Payment QR Code':'Student Photo'} Updated`,"SchoolAsset",kind,{},db)}
export async function getSchoolAsset(institutionId:string,kind:string){return row<{mimeType:string;data:Buffer}>('SELECT mime_type AS "mimeType",data FROM school_assets WHERE institution_id=? AND kind=?',[institutionId,kind],await ready())}
export async function deleteSchoolAsset(institutionId:string,userId:string,kind:string){const db=await ready();await run("DELETE FROM school_assets WHERE institution_id=? AND kind=?",[institutionId,kind],db);await audit(institutionId,userId,`${kind==='logo'?'Logo':kind==='signature'?'Signature':kind==='payment-qr'?'Payment QR Code':'Student Photo'} Removed`,"SchoolAsset",kind,{},db)}

export type PromotionInput={sourceYear:string;targetYear:string;sourceClass:string;sourceSection:string;targetClass:string;targetSection:string;studentIds:string[]};
async function ensureStudentEnrollments(institutionId:string,sql?:Sql){const db=sql??await ready();await run("INSERT INTO student_enrollments(id,institution_id,student_id,academic_year,class_name,section,status) SELECT 'legacy-'||s.id||'-'||s.academic_year,s.institution_id,s.id,s.academic_year,s.class_name,s.section,CASE WHEN LOWER(s.status)='active' THEN 'Active' ELSE s.status END FROM students s WHERE s.institution_id=? AND s.academic_year<>'' ON CONFLICT(institution_id,student_id,academic_year) DO NOTHING",[institutionId],db)}
export async function promotionOptions(institutionId:string){const db=await ready();await ensureStudentEnrollments(institutionId,db);const settings=await getCompleteSettings(institutionId),classes=settings.classes.filter(x=>x.active).map(x=>({name:x.name,sections:x.sections}));return {years:settings.years.filter(x=>x.status==='Active').map(x=>x.name),classes,highestClass:classes.at(-1)?.name||""}}
export async function promotionCandidates(institutionId:string,sourceYear:string,sourceClass:string,sourceSection:string){await ensureStudentEnrollments(institutionId);return rows<{id:string;name:string;admission:string;parent:string;parentPhone:string;className:string;section:string;academicYear:string;status:string}>('SELECT s.id,s.name,s.admission,s.parent,s.parent_phone AS "parentPhone",e.class_name AS "className",e.section,e.academic_year AS "academicYear",s.status FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.academic_year=? AND e.class_name=? AND e.section=? ORDER BY s.name',[institutionId,sourceYear,sourceClass,sourceSection],await ready())}
export async function validatePromotion(institutionId:string,input:PromotionInput,sql?:Sql){const db=sql??await ready();await ensureStudentEnrollments(institutionId,db);const errors:string[]=[];if(input.sourceYear===input.targetYear)errors.push("Source and target academic years must be different.");const years=await rows<{name:string}>("SELECT name FROM academic_years WHERE institution_id=? AND status='Active' AND name IN (?,?)",[institutionId,input.sourceYear,input.targetYear],db);if(years.length!==2)errors.push("Source or target academic year is unavailable.");const configs=await rows<{name:string}>("SELECT name FROM institution_classes WHERE institution_id=? AND status='Active' AND name IN (?,?)",[institutionId,input.sourceClass,input.targetClass],db);if(new Set(configs.map(x=>x.name)).size!==new Set([input.sourceClass,input.targetClass]).size)errors.push("Source or target class is not configured.");for(const [className,section] of [[input.sourceClass,input.sourceSection],[input.targetClass,input.targetSection]])if(section){const valid=await row<{count:number}>("SELECT COUNT(*)::int count FROM institution_sections x JOIN institution_classes c ON c.id=x.class_id WHERE x.institution_id=? AND c.name=? AND x.name=? AND x.status='Active'",[institutionId,className,section],db);if(!valid.count)errors.push(`Section ${section} does not belong to ${className}.`)}
 const selected=Array.from(new Set(input.studentIds));if(!selected.length)errors.push("Select at least one student.");const items:selectedPromotionItem[]=selected.length?await rows(`SELECT s.id,s.name,s.admission,s.status,e.id AS "sourceEnrollmentId",e.class_name AS "previousClass",e.section AS "previousSection",e.academic_year AS "previousYear",CASE WHEN LOWER(s.status)<>'active' THEN 'Ineligible' WHEN target.id IS NOT NULL THEN 'Already promoted' ELSE 'Ready' END AS "promotionStatus" FROM students s JOIN student_enrollments e ON e.student_id=s.id AND e.institution_id=s.institution_id LEFT JOIN student_enrollments target ON target.student_id=s.id AND target.institution_id=s.institution_id AND target.academic_year=? WHERE s.institution_id=? AND s.id IN (${selected.map(()=>'?').join(',')}) AND e.academic_year=? AND e.class_name=? AND e.section=?`,[input.targetYear,institutionId,...selected,input.sourceYear,input.sourceClass,input.sourceSection],db):[];if(items.length!==selected.length)errors.push("Some selected students no longer belong to the source class or school.");return {valid:errors.length===0&&items.every(x=>x.promotionStatus==='Ready'),errors,items:items.map(x=>({...x,newYear:input.targetYear,newClass:input.targetClass,newSection:input.targetSection})),summary:{selected:selected.length,eligible:items.filter(x=>x.promotionStatus==='Ready').length,alreadyPromoted:items.filter(x=>x.promotionStatus==='Already promoted').length,errors:errors.length+items.filter(x=>x.promotionStatus==='Ineligible').length}}}
type selectedPromotionItem={id:string;name:string;admission:string;status:string;sourceEnrollmentId:string;previousClass:string;previousSection:string;previousYear:string;promotionStatus:string};
export async function promoteStudents(institutionId:string,userId:string,input:PromotionInput){const db=await ready(),options=await promotionOptions(institutionId);if(input.sourceClass===options.highestClass)throw new Error(`${input.sourceClass} is the highest configured class. Graduate eligible students instead.`);const batchId=randomUUID();let promoted=0;await db.begin(async tx=>{const preview=await validatePromotion(institutionId,input,tx);if(!preview.valid)throw new Error(preview.errors[0]||preview.items.find(x=>x.promotionStatus!=='Ready')?.promotionStatus||"Promotion validation failed.");await run("INSERT INTO promotion_batches(id,institution_id,source_academic_year,target_academic_year,source_class,source_section,target_class,target_section,promoted_by,status)VALUES(?,?,?,?,?,?,?,?,?,'Completed')",[batchId,institutionId,input.sourceYear,input.targetYear,input.sourceClass,input.sourceSection,input.targetClass,input.targetSection,userId],tx);for(const item of preview.items){const targetId=randomUUID();await run("INSERT INTO student_enrollments(id,institution_id,student_id,academic_year,class_name,section,status,promoted_from_enrollment_id,promoted_at,promoted_by)VALUES(?,?,?,?,?,?,'Active',?,CURRENT_TIMESTAMP,?)",[targetId,institutionId,item.id,input.targetYear,input.targetClass,input.targetSection,item.sourceEnrollmentId,userId],tx);await run("UPDATE student_enrollments SET status='Promoted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[item.sourceEnrollmentId,institutionId],tx);await run("UPDATE students SET academic_year=?,class_name=?,section=?,grade=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[input.targetYear,input.targetClass,input.targetSection,`${input.targetClass}${input.targetSection?`-${input.targetSection}`:''}`,item.id,institutionId],tx);await run("INSERT INTO promotion_items(id,batch_id,institution_id,student_id,source_enrollment_id,target_enrollment_id,status)VALUES(?,?,?,?,?,?,'Promoted')",[randomUUID(),batchId,institutionId,item.id,item.sourceEnrollmentId,targetId],tx);promoted++}await audit(institutionId,userId,"Students Promoted","PromotionBatch",batchId,{...input,studentIds:undefined,count:promoted},tx)});return {batchId,promoted}}

export async function graduateStudents(institutionId:string,userId:string,input:{academicYear:string;className:string;section:string;studentIds:string[];effectiveDate:string}){const db=await ready(),options=await promotionOptions(institutionId);if(!options.highestClass||input.className!==options.highestClass)throw new Error("Only students in the highest configured class can be graduated.");const ids=[...new Set(input.studentIds)];if(!ids.length)throw new Error("Select at least one eligible student.");let graduated=0;await db.begin(async tx=>{const eligible=await rows<{id:string}>(`SELECT s.id FROM students s JOIN student_enrollments e ON e.student_id=s.id AND e.institution_id=s.institution_id WHERE s.institution_id=? AND s.status='Active' AND e.academic_year=? AND e.class_name=? AND e.section=? AND e.status='Active' AND s.id IN (${ids.map(()=>'?').join(',')}) FOR UPDATE`,[institutionId,input.academicYear,input.className,input.section,...ids],tx);if(eligible.length!==ids.length)throw new Error("Some selected students are no longer eligible or are already graduated.");for(const item of eligible){await run("UPDATE students SET status='Graduated',leaving_date=?,leaving_reason='Completed highest configured class',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=? AND status='Active'",[input.effectiveDate,item.id,institutionId],tx);await run("UPDATE student_enrollments SET status='Graduated',updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND student_id=? AND academic_year=? AND status='Active'",[institutionId,item.id,input.academicYear],tx);graduated++}await audit(institutionId,userId,"Students Graduated","Graduation",undefined,{academicYear:input.academicYear,className:input.className,section:input.section,count:graduated,effectiveDate:input.effectiveDate},tx)});return{graduated}}
export async function listPromotionHistory(institutionId:string,search=""){const q=`%${search}%`;return rows('SELECT pi.id,pi.student_id AS "studentId",s.name AS "studentName",s.admission,se.class_name AS "previousClass",se.section AS "previousSection",se.academic_year AS "previousYear",te.class_name AS "newClass",te.section AS "newSection",te.academic_year AS "newYear",u.name AS "promotedBy",pb.promoted_at::text AS "promotedAt",pi.status FROM promotion_items pi JOIN promotion_batches pb ON pb.id=pi.batch_id JOIN students s ON s.id=pi.student_id JOIN student_enrollments se ON se.id=pi.source_enrollment_id JOIN student_enrollments te ON te.id=pi.target_enrollment_id JOIN users u ON u.id=pb.promoted_by WHERE pi.institution_id=? AND (s.name ILIKE ? OR s.admission ILIKE ?) ORDER BY pb.promoted_at DESC',[institutionId,q,q],await ready())}
export async function studentAcademicHistory(institutionId:string,studentId:string){return rows('SELECT e.id,e.academic_year AS "academicYear",e.class_name AS "className",e.section,e.status,e.promoted_at::text AS "promotedAt",u.name AS "promotedBy" FROM student_enrollments e LEFT JOIN users u ON u.id=e.promoted_by WHERE e.institution_id=? AND e.student_id=? ORDER BY e.academic_year DESC',[institutionId,studentId],await ready())}
export type DemotionInput={studentId:string;newClassId:string;newSectionId:string;academicYearId:string;reason:string;remarks:string};
export async function demotionOptions(institutionId:string,studentId:string){
  const db=await ready();await ensureStudentEnrollments(institutionId,db);
  const student=await row<{id:string;name:string;admission:string;rollNumber:string;className:string;section:string;academicYear:string;status:string}>('SELECT id,name,admission,roll_number AS "rollNumber",class_name AS "className",section,academic_year AS "academicYear",status FROM students WHERE institution_id=? AND id=?',[institutionId,studentId],db);
  if(!student)throw new Error("Student not found.");
  const classes=await rows<{id:string;name:string;sortOrder:number}>('SELECT id,name,sort_order AS "sortOrder" FROM institution_classes WHERE institution_id=? AND status=? ORDER BY sort_order,name',[institutionId,'Active'],db);
  const current=classes.find(item=>item.name===student.className);
  const lower=current?classes.filter(item=>item.sortOrder<current.sortOrder).reverse():[];
  const sections=lower.length?await rows<{id:string;classId:string;name:string}>('SELECT id,class_id AS "classId",name FROM institution_sections WHERE institution_id=? AND status=?',[institutionId,'Active'],db):[];
  const years=await rows<{id:string;name:string}>('SELECT id,name FROM academic_years WHERE institution_id=? AND status=? ORDER BY name DESC',[institutionId,'Active'],db);
  return {student,classes:lower.map(item=>({...item,sections:sections.filter(section=>section.classId===item.id)})),years};
}
export async function demotionHistory(institutionId:string,studentId:string){return rows<{id:string;previousClass:string;newClass:string;previousSection:string;newSection:string;previousYear:string;newYear:string;reason:string;remarks:string;changedBy:string;createdAt:string;undoneAt:string|null;undoneBy:string|null}>('SELECT d.id,d.previous_class AS "previousClass",d.new_class AS "newClass",d.previous_section AS "previousSection",d.new_section AS "newSection",d.previous_year AS "previousYear",d.new_year AS "newYear",d.reason,d.remarks,u.name AS "changedBy",d.created_at::text AS "createdAt",d.undone_at::text AS "undoneAt",ru.name AS "undoneBy" FROM student_demotions d JOIN users u ON u.id=d.changed_by LEFT JOIN users ru ON ru.id=d.undone_by WHERE d.institution_id=? AND d.student_id=? ORDER BY d.created_at DESC,d.id DESC',[institutionId,studentId],await ready())}
export async function demoteStudent(institutionId:string,userId:string,input:DemotionInput){
 const db=await ready(),id=randomUUID();
 await db.begin(async tx=>{
  await ensureStudentEnrollments(institutionId,tx);
  const student=await row<{className:string;section:string;academicYear:string;status:string}>('SELECT class_name AS "className",section,academic_year AS "academicYear",status FROM students WHERE institution_id=? AND id=?',[institutionId,input.studentId],tx);
  if(!student||student.status!=='Active')throw new Error("Active student not found.");
  const previous=await row<{id:string;sortOrder:number}>('SELECT id,sort_order AS "sortOrder" FROM institution_classes WHERE institution_id=? AND name=? AND status=?',[institutionId,student.className,'Active'],tx);
  const target=await row<{id:string;name:string;sortOrder:number}>('SELECT id,name,sort_order AS "sortOrder" FROM institution_classes WHERE institution_id=? AND id=? AND status=?',[institutionId,input.newClassId,'Active'],tx);
  if(!previous||!target||target.sortOrder>=previous.sortOrder)throw new Error("Choose an active class lower than the current class.");
  const section=await row<{id:string;name:string}>('SELECT id,name FROM institution_sections WHERE institution_id=? AND class_id=? AND id=? AND status=?',[institutionId,target.id,input.newSectionId,'Active'],tx);
  if(!section)throw new Error("Choose an active section in the lower class.");
  const year=await row<{id:string;name:string}>('SELECT id,name FROM academic_years WHERE institution_id=? AND id=? AND status=?',[institutionId,input.academicYearId,'Active'],tx);
  if(!year)throw new Error("Choose an active academic year.");
  const source=await row<{id:string}>('SELECT id FROM student_enrollments WHERE institution_id=? AND student_id=? AND academic_year=?',[institutionId,input.studentId,student.academicYear],tx);
  if(!source)throw new Error("Current enrollment not found.");
  const existing=await row<{id:string}>('SELECT id FROM student_enrollments WHERE institution_id=? AND student_id=? AND academic_year=?',[institutionId,input.studentId,year.name],tx);
  if(existing&&year.name!==student.academicYear)throw new Error("Student already has an enrollment in the selected academic year.");
  const previousSection=await row<{id:string}>('SELECT x.id FROM institution_sections x WHERE x.institution_id=? AND x.class_id=? AND x.name=?',[institutionId,previous.id,student.section],tx);
  const previousYear=await row<{id:string}>('SELECT id FROM academic_years WHERE institution_id=? AND name=?',[institutionId,student.academicYear],tx);
  await run('INSERT INTO student_demotions(id,institution_id,student_id,previous_class_id,new_class_id,previous_section_id,new_section_id,previous_academic_year_id,new_academic_year_id,previous_class,new_class,previous_section,new_section,previous_year,new_year,reason,remarks,changed_by)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,institutionId,input.studentId,previous.id,target.id,previousSection?.id||null,section.id,previousYear?.id||null,year.id,student.className,target.name,student.section,section.name,student.academicYear,year.name,input.reason.trim(),input.remarks.trim(),userId],tx);
  if(year.name===student.academicYear)await run('UPDATE student_enrollments SET class_name=?,section=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[target.name,section.name,source.id,institutionId],tx);
  else {await run('UPDATE student_enrollments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',['Transferred',source.id,institutionId],tx);await run('INSERT INTO student_enrollments(id,institution_id,student_id,academic_year,class_name,section,status)VALUES(?,?,?,?,?,? ,?)',[randomUUID(),institutionId,input.studentId,year.name,target.name,section.name,'Active'],tx)}
  await run('UPDATE students SET class_name=?,section=?,academic_year=?,grade=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[target.name,section.name,year.name,`${target.name}-${section.name}`,input.studentId,institutionId],tx);
  await audit(institutionId,userId,'Student Demoted','StudentDemotion',id,{studentId:input.studentId,from:student,to:{className:target.name,section:section.name,academicYear:year.name},reason:input.reason},tx);
 });return {id};
}
export async function undoStudentDemotion(institutionId:string,userId:string,id:string){const db=await ready();await db.begin(async tx=>{
 const item=await row<{studentId:string;previousClass:string;previousSection:string;previousYear:string;newClass:string;newSection:string;newYear:string;undoneAt:string|null}>('SELECT student_id AS "studentId",previous_class AS "previousClass",previous_section AS "previousSection",previous_year AS "previousYear",new_class AS "newClass",new_section AS "newSection",new_year AS "newYear",undone_at::text AS "undoneAt" FROM student_demotions WHERE institution_id=? AND id=?',[institutionId,id],tx);
 if(!item||item.undoneAt)throw new Error('Demotion not found or already undone.');
 const latest=await row<{id:string}>('SELECT id FROM student_demotions WHERE institution_id=? AND student_id=? AND undone_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 1',[institutionId,item.studentId],tx);
 const student=await row<{className:string;section:string;academicYear:string}>('SELECT class_name AS "className",section,academic_year AS "academicYear" FROM students WHERE institution_id=? AND id=?',[institutionId,item.studentId],tx);
 if(latest?.id!==id||!student||student.className!==item.newClass||student.section!==item.newSection||student.academicYear!==item.newYear)throw new Error('Student placement changed after this demotion. Review the current enrollment before restoring.');
 const destination=await row<{id:string}>('SELECT id FROM institution_classes WHERE institution_id=? AND name=? AND status=?',[institutionId,item.previousClass,'Active'],tx);
 const section=await row<{id:string}>('SELECT x.id FROM institution_sections x WHERE x.institution_id=? AND x.class_id=? AND x.name=? AND x.status=?',[institutionId,destination?.id||'',item.previousSection,'Active'],tx);
 if(!destination||!section)throw new Error('Previous class or section is no longer active. Restore its configuration first.');
 const priorEnrollment=await row<{id:string}>('SELECT id FROM student_enrollments WHERE institution_id=? AND student_id=? AND academic_year=?',[institutionId,item.studentId,item.previousYear],tx);
 if(!priorEnrollment)throw new Error('Previous enrollment is missing.');
 if(item.previousYear!==item.newYear){await run('UPDATE student_enrollments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND student_id=? AND academic_year=?',['Restored From',institutionId,item.studentId,item.newYear],tx)}
 await run('UPDATE student_enrollments SET class_name=?,section=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[item.previousClass,item.previousSection,'Active',priorEnrollment.id,institutionId],tx);
 await run('UPDATE students SET class_name=?,section=?,academic_year=?,grade=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND id=?',[item.previousClass,item.previousSection,item.previousYear,`${item.previousClass}-${item.previousSection}`,institutionId,item.studentId],tx);
 await run('UPDATE student_demotions SET undone_by=?,undone_at=CURRENT_TIMESTAMP WHERE institution_id=? AND id=?',[userId,institutionId,id],tx);
 await audit(institutionId,userId,'Student Demotion Undone','StudentDemotion',id,{studentId:item.studentId},tx);
 });return {id};}
export async function listAuditLogs(institutionId: string, limit = 100) {
  return await rows(
    'SELECT a.id,a.action,a.entity,a.entity_id AS "entityId",a.details,a.created_at::text AS "createdAt",u.name AS "userName" FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.institution_id=? ORDER BY a.created_at DESC LIMIT ?',
    [institutionId, limit],
    await ready(),
  );
}
export async function logExport(
  institutionId: string,
  userId: string,
  entity: string,
  count: number,
) {
  await audit(institutionId, userId, "Excel Exported", entity, undefined, {
    count,
  });
}
export async function logImport(
  institutionId: string,
  userId: string,
  entity: string,
  count: number,
) {
  const db = await ready();
  await audit(
    institutionId,
    userId,
    "Excel Imported",
    entity,
    undefined,
    { count },
    db,
  );
  await activity(
    institutionId,
    "import",
    "Import completed",
    `${count} ${entity.toLowerCase()} records imported`,
    undefined,
    undefined,
    undefined,
    db,
  );
  await notify(
    institutionId,
    userId,
    "import",
    "Import completed",
    `${count} ${entity.toLowerCase()} records imported successfully.`,
    db,
  );
}
export async function listModuleRecords(institutionId: string, module: string) {
  const data = await rows<{ id: string; data: Record<string, string> | string }>(
    "SELECT id,data FROM module_records WHERE institution_id=? AND module=? ORDER BY created_at DESC",
    [institutionId, module],
    await ready(),
  );
  return data.map((item) => {
    const payload = typeof item.data === "string" ? JSON.parse(item.data) : item.data;
    return { id: item.id, ...payload };
  });
}
export async function addModuleRecord(
  institutionId: string,
  module: string,
  data: Record<string, string>,
) {
  const record = { id: randomUUID(), ...data };
  await run(
    "INSERT INTO module_records(id,institution_id,module,data)VALUES(?,?,?,?::jsonb)",
    [record.id, institutionId, module, JSON.stringify(data)],
    await ready(),
  );
  return record;
}
export type TeacherModuleRecord = { id: string; teacherUserId?: string; [key: string]: any };
export async function listTeacherModuleRecords(institutionId:string,module:"teacher_homework"|"teacher_leave_requests",teacherUserId:string){const records=(await listModuleRecords(institutionId,module)) as TeacherModuleRecord[];return records.filter(item=>item.teacherUserId===teacherUserId)}
export async function addTeacherModuleRecord(institutionId:string,module:"teacher_homework"|"teacher_leave_requests",teacherUserId:string,data:Record<string,string>){const record=await addModuleRecord(institutionId,module,{...data,teacherUserId,createdAt:new Date().toISOString()});await audit(institutionId,teacherUserId,module==="teacher_homework"?"Homework Assigned":"Leave Requested",module,record.id,{...data,teacherUserId:undefined});return record}
export async function updateTeacherHomeworkStatus(institutionId:string,teacherUserId:string,id:string,status:"Active"|"Archived"){const records=await listTeacherModuleRecords(institutionId,"teacher_homework",teacherUserId),record=records.find(item=>item.id===id);if(!record)throw new Error("Homework not found.");const { id: _ignored, ...rest } = record; const data={...rest,status};const updated=await run("UPDATE module_records SET data=?::jsonb WHERE id=? AND institution_id=? AND module='teacher_homework'",[JSON.stringify(data),id,institutionId],await ready());if(!updated)throw new Error("Homework not found.");await audit(institutionId,teacherUserId,"Homework Status Updated","teacher_homework",id,{status});return{id,...data}}

export type SingleRecordKind="module"|"attendance"|"fee"|"payment"|"salary"|"account"|"class"|"section"|"timetable"|"exam"|"result"|"academic-year";
export async function setClassArchived(institutionId:string,userId:string,slug:string,academicYear:string,archived:boolean){
  const definition=(await listClassSummaries(institutionId,academicYear)).find(item=>item.slug===slug);
  if(!definition)throw new Error("Class not found.");
  const db=await ready();
  const found=await row<{count:number}>("SELECT COUNT(*)::int count FROM classes WHERE institution_id=? AND academic_year=? AND name=?",[institutionId,academicYear,definition.name],db);
  if(!found.count)throw new Error("Class not found.");
  const marker=`Class archived: ${definition.name} (${academicYear})`;
  await db.begin(async tx=>{
    await run("UPDATE classes SET status=? WHERE institution_id=? AND academic_year=? AND name=?",[archived?"Inactive":"Active",institutionId,academicYear,definition.name],tx);
    await run("UPDATE institution_classes SET status=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND name=?",[archived?"Inactive":"Active",institutionId,definition.name],tx);
    await run("UPDATE student_enrollments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND academic_year=? AND class_name=?",[archived?"Left Out":"Active",institutionId,academicYear,definition.name],tx);
    if(archived)await run("UPDATE students SET status='Left Out',leaving_date=?,leaving_reason=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND class_name=? AND academic_year=? AND status='Active'",[new Date().toISOString().slice(0,10),marker,institutionId,definition.name,academicYear],tx);
    else await run("UPDATE students SET status='Active',leaving_date=NULL,leaving_reason='',leaving_remarks='',updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND class_name=? AND academic_year=? AND status='Left Out' AND leaving_reason=?",[institutionId,definition.name,academicYear,marker],tx);
    await audit(institutionId,userId,archived?"Class Archived":"Class Restored","Class",slug,{academicYear,name:definition.name,studentStatus:archived?"Left Out":"Active"},tx);
  });
  return archived?"Class archived successfully.":"Class restored successfully.";
}
export async function actOnSingleRecord(institutionId:string,userId:string,kind:SingleRecordKind,id:string,reason:string,module?:string,academicYear?:string){
  const db=await ready();
  if(kind==="class"){
    if(!academicYear||!/^\d{4}-\d{4}$/.test(academicYear))throw new Error("Academic year is required.");
    return setClassArchived(institutionId,userId,id,academicYear,true);
  }
  if(kind==="module"){
    if(!module)throw new Error("Module is required.");
    const item=await row<{id:string}>("SELECT id FROM module_records WHERE id=? AND institution_id=? AND module=?",[id,institutionId,module],db);
    if(!item)throw new Error("Record not found.");
    await run("DELETE FROM module_records WHERE id=? AND institution_id=? AND module=?",[id,institutionId,module],db);
    await audit(institutionId,userId,"DELETE","ModuleRecord",id,{module,reason},db);
    return "Record deleted successfully.";
  }
  if(kind==="section"){
    await deleteClassSection(institutionId,id,userId);
    return "Section deleted successfully.";
  }
  if(kind==="account"){
    await voidAccountTransaction(institutionId,userId,id,reason);
    return "Transaction voided successfully.";
  }
  if(kind==="salary"){
    const salary=await row<{paymentStatus:string}>("SELECT payment_status AS \"paymentStatus\" FROM salaries WHERE id=? AND institution_id=?",[id,institutionId],db);
    if(!salary)throw new Error("Salary record not found.");
    if(Number((await row<{paid:number}>("SELECT paid_paise paid FROM salaries WHERE id=? AND institution_id=?",[id,institutionId],db))?.paid)>0)throw new Error("Salary with recorded payments cannot be cancelled.");
    await cancelAdminSalary(userId,institutionId,id);
    return "Salary record cancelled successfully.";
  }
  if(kind==="academic-year"){
    const year=await row<{name:string;isActive:boolean}>("SELECT name,is_active AS \"isActive\" FROM academic_years WHERE id=? AND institution_id=?",[id,institutionId],db);
    if(!year)throw new Error("Academic year not found.");
    if(year.isActive)throw new Error("Set another active year before archiving this one.");
    await run("UPDATE academic_years SET status='Archived',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[id,institutionId],db);
    await audit(institutionId,userId,"ARCHIVE","AcademicYear",id,{name:year.name,reason},db);
    return "Academic year archived successfully.";
  }
  if(kind==="payment"){
    await db.begin(async tx=>{
      const payment=await row<{feeId:string;studentId:string;receiptNumber:string;status:string}>("SELECT fee_id AS \"feeId\",student_id AS \"studentId\",receipt_number AS \"receiptNumber\",status FROM payments WHERE id=? AND institution_id=? FOR UPDATE",[id,institutionId],tx);
      if(!payment)throw new Error("Payment not found.");
      if(payment.status!=="Success")throw new Error("Payment is already voided.");
      await row("SELECT id FROM fees WHERE id=? AND institution_id=? FOR UPDATE",[payment.feeId,institutionId],tx);
      await run("UPDATE payments SET status='Voided' WHERE id=? AND institution_id=?",[id,institutionId],tx);
      await run("UPDATE receipts SET status='Voided' WHERE payment_id=? AND institution_id=?",[id,institutionId],tx);
      await run("UPDATE activities SET status='Voided' WHERE payment_id=? AND institution_id=?",[id,institutionId],tx);
      const balance=await row<{finalAmount:number;paidAmount:number}>("SELECT f.final_amount AS \"finalAmount\",(SELECT COALESCE(SUM(amount),0) FROM payments WHERE fee_id=f.id AND status='Success') AS \"paidAmount\" FROM fees f WHERE f.id=? AND f.institution_id=?",[payment.feeId,institutionId],tx);
      if(!balance)throw new Error("Fee record not found.");
      const paid=Math.min(Number(balance.finalAmount),Number(balance.paidAmount));
      await run("UPDATE fees SET paid_amount=?,pending_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[paid,Math.max(0,Number(balance.finalAmount)-paid),payment.feeId,institutionId],tx);
      await run("UPDATE students SET paid_fee=(SELECT COALESCE(SUM(paid_amount),0) FROM fees WHERE student_id=?),pending_fee=(SELECT COALESCE(SUM(pending_amount),0) FROM fees WHERE student_id=?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[payment.studentId,payment.studentId,payment.studentId,institutionId],tx);
      await audit(institutionId,userId,"VOID","Payment",id,{receiptNumber:payment.receiptNumber,reason},tx);
    });
    await refreshFees(institutionId,db);
    return "Fee payment voided successfully.";
  }
  const table={attendance:"attendance",fee:"fees",timetable:"timetable_entries",exam:"class_exams",result:"class_results"}[kind];
  if(!table)throw new Error("Unsupported record type.");
  const item=await row<{id:string;studentId?:string}>(`SELECT id${kind==="fee"||kind==="attendance"?',student_id AS "studentId"':''} FROM ${table} WHERE id=? AND institution_id=?`,[id,institutionId],db);
  if(!item)throw new Error("Record not found.");
  if(kind==="fee"){
    const payments=await row<{count:number}>("SELECT COUNT(*)::int count FROM payments WHERE fee_id=?",[id],db);
    if(payments.count)throw new Error("Fee records with payment history cannot be deleted. Void the payment first; its audit history remains protected.");
  }
  if(kind==="exam"){
    const results=await row<{count:number}>("SELECT COUNT(*)::int count FROM class_results WHERE exam_id=?",[id],db);
    if(results.count)throw new Error("Exam has student results. Remove the results first.");
  }
  await run(`DELETE FROM ${table} WHERE id=? AND institution_id=?`,[id,institutionId],db);
  if(kind==="attendance"&&item.studentId){
    await run("UPDATE students SET attendance=COALESCE((SELECT ROUND(100.0*SUM(CASE WHEN status IN ('Present','Late') THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0)) FROM attendance WHERE student_id=?),100),updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[item.studentId,item.studentId,institutionId],db);
  }
  if(kind==="fee"&&item.studentId){
    await run("UPDATE students SET total_fee=(SELECT COALESCE(SUM(final_amount),0) FROM fees WHERE student_id=?),paid_fee=(SELECT COALESCE(SUM(paid_amount),0) FROM fees WHERE student_id=?),pending_fee=(SELECT COALESCE(SUM(pending_amount),0) FROM fees WHERE student_id=?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[item.studentId,item.studentId,item.studentId,item.studentId,institutionId],db);
    await refreshFees(institutionId,db);
  }
  await audit(institutionId,userId,"DELETE",kind,id,{reason},db);
  return `${kind[0].toUpperCase()}${kind.slice(1)} record deleted successfully.`;
}

export async function getWhatsAppAddonSubscription(
  institutionId: string,
): Promise<WhatsAppAddonSummary | undefined> {
  const item = await row<WhatsAppAddonSummary>(
    `SELECT status,student_count AS "studentCount",price_per_student AS "pricePerStudent",amount_paid AS "amountPaid",activation_date::text AS "activationDate",expiry_date::text AS "expiryDate",payment_status AS "paymentStatus",razorpay_order_id AS "razorpayOrderId",razorpay_payment_id AS "razorpayPaymentId"
     FROM whatsapp_addon_subscriptions
     WHERE institution_id=?
     ORDER BY CASE WHEN status='ACTIVE' AND expiry_date>CURRENT_TIMESTAMP THEN 0 ELSE 1 END,created_at DESC
     LIMIT 1`,
    [institutionId],
    await ready(),
  );
  if (!item) return undefined;
  return {
    ...item,
    status:
      item.status === "ACTIVE" && new Date(item.expiryDate) <= new Date()
        ? "EXPIRED"
        : item.status,
    studentCount: Number(item.studentCount),
    pricePerStudent: Number(item.pricePerStudent),
    amountPaid: Number(item.amountPaid),
  };
}

export async function createPendingWhatsAppAddon(
  institutionId: string,
  orderId: string,
  requestedStudentCount: number,
  expectedAmount: number,
) {
  const db = await ready();
  const activeStudents = await getActiveStudentCountWithSql(institutionId, db);
  if (activeStudents < 1) throw new Error("Your school currently has no eligible active students. Add or reactivate a student before checkout.");
  const quote = whatsappAddonQuote(activeStudents);
  if (!quote || quote.amount !== expectedAmount || requestedStudentCount !== activeStudents)
    throw new Error("The eligible student count or WhatsApp add-on price changed. Refresh and try again.");
  const active = await row<{ id: string }>(
    "SELECT id FROM whatsapp_addon_subscriptions WHERE institution_id=? AND status='ACTIVE' AND expiry_date>CURRENT_TIMESTAMP LIMIT 1",
    [institutionId],
    db,
  );
  if (active) throw new Error("The WhatsApp Communication add-on is already active for this school.");
  const start = new Date();
  const end = addOneYear(start);
  await run(
    "INSERT INTO whatsapp_addon_subscriptions(id,institution_id,student_count,price_per_student,amount_paid,status,activation_date,expiry_date,razorpay_order_id)VALUES(?,?,?,?,?,'PENDING',?,?,?)",
    [randomUUID(), institutionId, quote.studentCount, quote.pricePerStudent, quote.amount, start, end, orderId],
    db,
  );
  return quote;
}

export async function findReusablePendingWhatsAppAddon(
  institutionId: string,
  studentCount: number,
  amount: number,
) {
  return row<{ orderId: string }>(
    `SELECT razorpay_order_id AS "orderId" FROM whatsapp_addon_subscriptions
     WHERE institution_id=? AND student_count=? AND amount_paid=? AND status='PENDING'
       AND payment_status='Pending' AND razorpay_payment_id IS NULL AND created_at>?
     ORDER BY created_at DESC LIMIT 1`,
    [institutionId, studentCount, amount, new Date(Date.now() - 15 * 60_000)],
    await ready(),
  );
}

export async function findWhatsAppAddonByOrder(orderId: string) {
  const item = await row<{
    id: string;
    institutionId: string;
    studentCount: number;
    pricePerStudent: number;
    amountPaid: number;
    status: string;
    paymentId: string | null;
  }>(
    'SELECT id,institution_id AS "institutionId",student_count AS "studentCount",price_per_student AS "pricePerStudent",amount_paid AS "amountPaid",status,razorpay_payment_id AS "paymentId" FROM whatsapp_addon_subscriptions WHERE razorpay_order_id=?',
    [orderId],
    await ready(),
  );
  return item
    ? {
        ...item,
        studentCount: Number(item.studentCount),
        pricePerStudent: Number(item.pricePerStudent),
        amountPaid: Number(item.amountPaid),
      }
    : undefined;
}

export type VerifiedPaymentConfirmation = {
  product: "subscription" | "whatsapp";
  productName: string;
  schoolName: string;
  amountPaid: number;
  currency: string;
  status: string;
  paymentStatus: string;
  orderId: string;
  paymentId: string | null;
  activationDate: string;
  expiryDate: string;
};

export async function getVerifiedPaymentConfirmation(
  institutionId: string,
  product: "subscription" | "whatsapp",
  orderId: string,
): Promise<VerifiedPaymentConfirmation | undefined> {
  const db = await ready();
  if (product === "subscription") {
    const item = await row<Omit<VerifiedPaymentConfirmation, "product">>(
      `SELECT p.name AS "productName",i.name AS "schoolName",s.amount_paid AS "amountPaid",s.currency,s.status,s.payment_status AS "paymentStatus",s.razorpay_order_id AS "orderId",s.razorpay_payment_id AS "paymentId",s.activation_date::text AS "activationDate",s.expiry_date::text AS "expiryDate"
       FROM subscriptions s JOIN institutions i ON i.id=s.institution_id JOIN subscription_plans p ON p.id=s.plan_id
       WHERE s.institution_id=? AND s.razorpay_order_id=? LIMIT 1`,
      [institutionId, orderId],
      db,
    );
    return item ? { ...item, product, amountPaid: Number(item.amountPaid) } : undefined;
  }
  const item = await row<Omit<VerifiedPaymentConfirmation, "product">>(
    `SELECT 'WhatsApp Communication Add-on' AS "productName",i.name AS "schoolName",w.amount_paid AS "amountPaid",w.currency,w.status,w.payment_status AS "paymentStatus",w.razorpay_order_id AS "orderId",w.razorpay_payment_id AS "paymentId",w.activation_date::text AS "activationDate",w.expiry_date::text AS "expiryDate"
     FROM whatsapp_addon_subscriptions w JOIN institutions i ON i.id=w.institution_id
     WHERE w.institution_id=? AND w.razorpay_order_id=? LIMIT 1`,
    [institutionId, orderId],
    db,
  );
  return item ? { ...item, product, amountPaid: Number(item.amountPaid) } : undefined;
}

export async function failWhatsAppAddon(
  orderId: string,
  status: "FAILED" | "CANCELLED" = "FAILED",
) {
  await run(
    "UPDATE whatsapp_addon_subscriptions SET status=?,payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE razorpay_order_id=? AND payment_status!='Paid' AND razorpay_payment_id IS NULL",
    [status, status === "FAILED" ? "Failed" : "Cancelled", orderId],
    await ready(),
  );
}

export async function activateVerifiedWhatsAppAddon(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  let institutionId = "";
  await ready();
  await connection().begin(async (tx) => {
    const item = await row<{
      id: string;
      institutionId: string;
      studentCount: number;
      pricePerStudent: number;
      amountPaid: number;
      status: string;
      paymentId: string | null;
    }>(
      'SELECT id,institution_id AS "institutionId",student_count AS "studentCount",price_per_student AS "pricePerStudent",amount_paid AS "amountPaid",status,razorpay_payment_id AS "paymentId" FROM whatsapp_addon_subscriptions WHERE razorpay_order_id=? FOR UPDATE',
      [orderId],
      tx,
    );
    if (!item) throw new Error("WhatsApp add-on order not found.");
    const quote = whatsappAddonQuote(Number(item.studentCount));
    if (
      !quote ||
      Number(item.pricePerStudent) !== WHATSAPP_ADDON_ANNUAL_PRICE_PER_STUDENT ||
      Number(item.amountPaid) !== quote.amount
    )
      throw new Error("WhatsApp add-on pricing validation failed.");
    institutionId = item.institutionId;
    if (item.paymentId && item.paymentId !== paymentId)
      throw new Error("WhatsApp add-on order is already linked to another payment.");
    if (item.status === "ACTIVE" && item.paymentId === paymentId) return;
    await run(
      "UPDATE whatsapp_addon_subscriptions SET status='ACTIVE',payment_status='Paid',razorpay_payment_id=?,razorpay_signature=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [paymentId, signature, item.id],
      tx,
    );
    await audit(
      item.institutionId,
      undefined,
      "WhatsApp Add-on Activated",
      "WhatsAppAddonSubscription",
      item.id,
      { orderId, paymentId, studentCount: item.studentCount, pricePerStudent: item.pricePerStudent },
      tx,
    );
  });
  const result = await getWhatsAppAddonSubscription(institutionId);
  if (!result) throw new Error("WhatsApp add-on activation could not be confirmed.");
  return result;
}

export async function getSubscription(
  institutionId: string,
): Promise<SubscriptionSummary> {
  const db = await ready(),
    item = await row<Omit<SubscriptionSummary, "studentUsage">>(
      'SELECT s.status,s.plan_id AS "planId",p.name AS "planName",s.student_capacity AS "studentCapacity",COALESCE(s.student_count_at_purchase,s.student_capacity) AS "studentCountAtPurchase",s.pricing_model AS "pricingModel",s.plan_version AS "planVersion",s.price_per_student AS "pricePerStudent",s.amount_paid AS "amountPaid",s.amount_paid AS "annualAmount",s.activation_date::text AS "activationDate",s.expiry_date::text AS "expiryDate",s.razorpay_order_id AS "razorpayOrderId",s.razorpay_payment_id AS "razorpayPaymentId",s.razorpay_signature AS "razorpaySignature",s.currency,s.payment_status AS "paymentStatus",s.auto_renew AS "autoRenew" FROM subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.institution_id=? ORDER BY CASE WHEN s.status IN (\'ACTIVE\',\'EXPIRING_SOON\') AND s.expiry_date>CURRENT_TIMESTAMP THEN 0 ELSE 1 END,s.created_at DESC LIMIT 1',
      [institutionId],
      db,
    ),
    usage = (
      await row<{ count: number }>(
        "SELECT COUNT(*)::int count FROM students WHERE institution_id=? AND LOWER(TRIM(status))='active'",
        [institutionId],
        db,
      )
    ).count,
    institution = await row<{ plannedStudentCount: number;startDate:string|null;endDate:string|null;createdAt:string }>(
      'SELECT planned_student_count AS "plannedStudentCount",subscription_start_date::text AS "startDate",subscription_end_date::text AS "endDate",created_at::text AS "createdAt" FROM institutions WHERE id=?',
      [institutionId],
      db,
    ),
    plannedStudentCount = Number(institution?.plannedStudentCount ?? 0),
    billingStudentCount = usage > 0 ? usage : plannedStudentCount,
    purchasePricePerStudent=ANNUAL_PRICE_PER_STUDENT;
  if (!item) {
    const starter=starterPlanForStudentCount(billingStudentCount);
    return {
      status: "UNPAID",
      planId: null,
      planName: null,
      studentCapacity: null,
      studentCountAtPurchase: null,
      pricingModel: starter?"FIXED":"PER_STUDENT",
      planVersion: 1,
      pricePerStudent: starter?0:purchasePricePerStudent,
      annualAmount: starter?STARTER_ANNUAL_PRICE:billingStudentCount*purchasePricePerStudent,
      amountPaid: 0,
      activationDate: institution?.startDate||null,
      expiryDate: institution?.endDate||null,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      studentUsage: usage,
      billingStudentCount,
      daysRemaining: 0,
      daysUntilStart: 0,
      durationProgress: 0,
      currency: "INR",
      paymentStatus: "Unpaid",
      autoRenew: false,
    };
  }
  const status = getSubscriptionStatus(item.status, item.expiryDate ?? undefined,new Date(),30,item.activationDate??undefined);
  if (status !== item.status)
    await run(
      "UPDATE subscriptions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE razorpay_order_id=?",
      [status, item.razorpayOrderId],
      db,
    );
  const daysRemaining=getDaysRemaining(item.expiryDate??undefined),start=item.activationDate?new Date(item.activationDate).getTime():0,end=item.expiryDate?new Date(item.expiryDate).getTime():0,daysUntilStart=start>Date.now()?Math.ceil((start-Date.now())/864e5):0,durationProgress=start&&end>start?Math.max(0,Math.min(100,Math.round((Date.now()-start)/(end-start)*100))):0;
  return { ...item, status, studentUsage: usage,billingStudentCount:usage>0?usage:plannedStudentCount||item.studentCapacity||0,daysRemaining,daysUntilStart,durationProgress,autoRenew:Boolean(item.autoRenew) };
}
export async function assertStudentCapacity(
  institutionId: string,
  additional = 1,
) {
  const item = await getSubscription(institutionId);
  if (!isSubscriptionActive(item.status) || !item.studentCapacity)
    throw new Error("SUBSCRIPTION_REQUIRED");
  if(!Number.isInteger(additional)||additional<0)throw new Error("Invalid student count change.");
  if(item.studentUsage+additional>item.studentCapacity)throw new Error(`CAPACITY_EXCEEDED:${item.studentUsage}:${item.studentCapacity}:${additional}`);
  return item;
}
export async function getSubscriptionCapacityQuote(institutionId:string,requestedCapacity:number){
 const db=await ready(),item=await row<{id:string;studentCapacity:number;amountPaid:number|string;activationDate:string;expiryDate:string;activeStudents:number}>(`SELECT s.id,s.student_capacity AS "studentCapacity",s.amount_paid AS "amountPaid",s.activation_date::text AS "activationDate",s.expiry_date::text AS "expiryDate",(SELECT COUNT(*) FROM students st WHERE st.institution_id=s.institution_id AND LOWER(TRIM(st.status))='active')::int AS "activeStudents" FROM subscriptions s WHERE s.institution_id=? AND s.status IN ('ACTIVE','EXPIRING_SOON') AND s.payment_status='Paid' AND s.expiry_date>CURRENT_TIMESTAMP ORDER BY s.expiry_date DESC LIMIT 1`,[institutionId],db);
 if(!item)throw new Error("An active paid subscription is required to change capacity.");
 return{subscriptionId:item.id,quote:subscriptionCapacityQuote({currentCapacity:item.studentCapacity,requestedCapacity,activeStudents:item.activeStudents,currentAnnualAmount:Number(item.amountPaid),startsAt:item.activationDate,expiresAt:item.expiryDate})};
}
export async function createPendingCapacityAdjustment(institutionId:string,userId:string,requestedCapacity:number,orderId:string){
 const{subscriptionId,quote}=await getSubscriptionCapacityQuote(institutionId,requestedCapacity);if(quote.direction!=="increase"||quote.amountDue<=0)throw new Error("This capacity change does not require payment.");
 await run("INSERT INTO subscription_adjustments(id,institution_id,subscription_id,old_capacity,new_capacity,amount,credit_amount,status,razorpay_order_id,created_by)VALUES(?,?,?,?,?,?,0,'PENDING',?,?)",[randomUUID(),institutionId,subscriptionId,quote.currentCapacity,quote.requestedCapacity,quote.amountDue,orderId,userId],await ready());return quote;
}
export async function applyCapacityDowngrade(institutionId:string,userId:string,requestedCapacity:number){
 const db=await ready(),{subscriptionId,quote}=await getSubscriptionCapacityQuote(institutionId,requestedCapacity);if(quote.direction==="increase")throw new Error("Additional payment is required for this change.");
 await db.begin(async tx=>{await run("UPDATE subscriptions SET student_capacity=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[quote.requestedCapacity,subscriptionId,institutionId],tx);await run("UPDATE institutions SET planned_student_count=? WHERE id=?",[quote.requestedCapacity,institutionId],tx);await run("INSERT INTO subscription_adjustments(id,institution_id,subscription_id,old_capacity,new_capacity,amount,credit_amount,status,created_by)VALUES(?,?,?,?,?,0,?,'CREDITED',?)",[randomUUID(),institutionId,subscriptionId,quote.currentCapacity,quote.requestedCapacity,quote.creditAmount,userId],tx);await audit(institutionId,userId,"Subscription Capacity Decreased","Subscription",subscriptionId,quote,tx)});return getSubscription(institutionId);
}
export async function findCapacityAdjustmentByOrder(orderId:string){return row<{id:string;institutionId:string;subscriptionId:string;oldCapacity:number;newCapacity:number;amount:number|string;status:string;paymentId:string|null}>('SELECT id,institution_id AS "institutionId",subscription_id AS "subscriptionId",old_capacity AS "oldCapacity",new_capacity AS "newCapacity",amount,status,razorpay_payment_id AS "paymentId" FROM subscription_adjustments WHERE razorpay_order_id=?',[orderId],await ready())}
export async function activateCapacityAdjustment(orderId:string,paymentId:string){const db=await ready();let institutionId="";await db.begin(async tx=>{const item=await row<{id:string;institutionId:string;subscriptionId:string;newCapacity:number;status:string;paymentId:string|null}>('SELECT id,institution_id AS "institutionId",subscription_id AS "subscriptionId",new_capacity AS "newCapacity",status,razorpay_payment_id AS "paymentId" FROM subscription_adjustments WHERE razorpay_order_id=? FOR UPDATE',[orderId],tx);if(!item)throw new Error("Capacity adjustment not found.");institutionId=item.institutionId;if(item.paymentId&&item.paymentId!==paymentId)throw new Error("Capacity adjustment is linked to another payment.");if(item.status==='PAID')return;await run("UPDATE subscription_adjustments SET status='PAID',razorpay_payment_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[paymentId,item.id],tx);await run("UPDATE subscriptions SET student_capacity=?,amount_paid=amount_paid+(SELECT amount FROM subscription_adjustments WHERE id=?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[item.newCapacity,item.id,item.subscriptionId,item.institutionId],tx);await run("UPDATE institutions SET planned_student_count=? WHERE id=?",[item.newCapacity,item.institutionId],tx);await audit(item.institutionId,undefined,"Subscription Capacity Increased","Subscription",item.subscriptionId,{orderId,paymentId,newCapacity:item.newCapacity},tx)});return getSubscription(institutionId)}

export async function saveSubscriptionStudentCount(institutionId:string,userId:string,studentCount:number){
  if(!Number.isInteger(studentCount)||studentCount<1||studentCount>100000)throw new Error("Student count must be between 1 and 100,000.");
  const db=await ready(),usage=(await row<{count:number}>("SELECT COUNT(*)::int count FROM students WHERE institution_id=? AND LOWER(TRIM(status))='active'",[institutionId],db)).count;
  if(studentCount<usage)throw new Error(`Student count cannot be lower than your ${usage} active students.`);
  await run("UPDATE institutions SET planned_student_count=? WHERE id=?",[studentCount,institutionId],db);
  await audit(institutionId,userId,"Subscription Student Count Updated","Subscription",institutionId,{studentCount},db);
  return getSubscription(institutionId);
}
async function getActiveStudentCountWithSql(institutionId: string, db: Sql) {
  if (!institutionId || typeof institutionId !== "string") {
    throw new Error("A valid school identifier is required to verify active students.");
  }
  const result = await row<{ count: number | string }>(
    "SELECT COUNT(*)::int count FROM students WHERE institution_id=? AND LOWER(TRIM(status))='active'",
    [institutionId],
    db,
  );
  if (!result || result.count === null || result.count === undefined)
    throw new Error("The eligible active-student count query returned no result.");
  return normalizeEligibleStudentCount(result.count);
}
export async function getActiveStudentCount(institutionId:string){
  return getActiveStudentCountWithSql(institutionId, await ready());
}
export async function getSubscriptionBillingStudentCount(institutionId:string){
  const db=await ready(),activeCount=await getActiveStudentCountWithSql(institutionId,db),institution=await row<{plannedStudentCount:number|string}>(
    'SELECT planned_student_count AS "plannedStudentCount" FROM institutions WHERE id=?',
    [institutionId],
    db,
  );
  if(!institution)throw new Error("School account not found.");
  const plannedCount=normalizeEligibleStudentCount(institution.plannedStudentCount);
  // A newly registered school has no student rows yet. Its persisted, server-side
  // registration count is the authoritative first-purchase snapshot. Once the
  // school has enrolled students, actual active enrollment becomes authoritative.
  return activeCount>0?activeCount:plannedCount;
}
export async function createPendingSubscription(
  institutionId: string,
  planId: string,
  orderId: string,
  expectedStudentCount: number,
  expectedAmount: number,
  expectedPricePerStudent: number,
) {
  const db=await ready(),institution=await row<{activeCount:number;plannedStudentCount:number;startDate:string|null;endDate:string|null;academicYear:string}>('SELECT (SELECT COUNT(*) FROM students active_student WHERE active_student.institution_id=i.id AND LOWER(TRIM(active_student.status))=\'active\')::int AS "activeCount",i.planned_student_count AS "plannedStudentCount",i.subscription_start_date::text AS "startDate",i.subscription_end_date::text AS "endDate",COALESCE(s.academic_year,\'\') AS "academicYear" FROM institutions i LEFT JOIN settings s ON s.institution_id=i.id WHERE i.id=?',[institutionId],db),studentCount=Number(institution?.activeCount||institution?.plannedStudentCount||0),plan = getPlan(planId,studentCount,ANNUAL_PRICE_PER_STUDENT);
  if (!plan) throw new Error("Invalid subscription plan");
  if(studentCount!==expectedStudentCount||plan.price!==expectedAmount||plan.pricePerStudent!==expectedPricePerStudent)throw new Error("The eligible student count or agreed price changed. Refresh the subscription page and try again.");
  if(!institution)throw new Error("School account not found.");
  const period=resolveSubscriptionPeriod(institution.startDate,institution.endDate,institution.academicYear);
  if(!institution.startDate||!institution.endDate||new Date(institution.endDate)<=new Date(institution.startDate))await run("UPDATE institutions SET subscription_start_date=?,subscription_end_date=? WHERE id=?",[period.startDate,period.endDate,institutionId],db);
  const conflict=await row<{id:string}>("SELECT id FROM subscriptions WHERE institution_id=? AND payment_status='Paid' AND activation_date<=? AND expiry_date>=? LIMIT 1",[institutionId,period.endDate,period.startDate],db);
  if(conflict)throw new Error("This subscription period overlaps an existing paid subscription.");
  await run(
    "INSERT INTO subscriptions(id,institution_id,plan_id,student_capacity,student_count_at_purchase,pricing_model,plan_version,price_per_student,amount_paid,status,activation_date,expiry_date,renewal_date,razorpay_order_id)VALUES(?,?,?,?,?,?,?,?,?,'PENDING',?,?,?,?)",
    [
      randomUUID(),
      institutionId,
      plan.id,
      plan.studentLimit,
      plan.studentCount,
      plan.pricingModel,
      plan.version,
      plan.pricePerStudent,
      plan.price,
      period.startDate,
      period.endDate,
      period.endDate,
      orderId,
    ],
    db,
  );
  return await getSubscription(institutionId);
}
export async function failSubscription(
  orderId: string,
  status: "FAILED" | "CANCELLED" = "FAILED",
) {
  await run(
    "UPDATE subscriptions SET status=?,payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE razorpay_order_id=? AND payment_status!='Paid' AND razorpay_payment_id IS NULL",
    [status, status === "FAILED" ? "Failed" : "Cancelled", orderId],
    await ready(),
  );
}
export async function findReusablePendingSubscription(institutionId:string,planId:string,studentCount:number,amount:number){
  return row<{orderId:string}>("SELECT razorpay_order_id AS \"orderId\" FROM subscriptions WHERE institution_id=? AND plan_id=? AND COALESCE(student_count_at_purchase,student_capacity)=? AND amount_paid=? AND status='PENDING' AND payment_status='Pending' AND razorpay_payment_id IS NULL AND created_at>? ORDER BY created_at DESC LIMIT 1",[institutionId,planId,studentCount,amount,new Date(Date.now()-15*60_000)],await ready());
}
export async function findSubscriptionByOrder(orderId: string) {
  return await row<{
    id: string;
    institutionId: string;
    planId: string;
    amountPaid: number;
    studentCount: number;
    pricePerStudent: number;
    pricingModel: string;
    status: string;
    paymentId: string | null;
  }>(
    'SELECT id,institution_id AS "institutionId",plan_id AS "planId",amount_paid AS "amountPaid",COALESCE(student_count_at_purchase,student_capacity) AS "studentCount",price_per_student AS "pricePerStudent",pricing_model AS "pricingModel",status,razorpay_payment_id AS "paymentId" FROM subscriptions WHERE razorpay_order_id=?',
    [orderId],
    await ready(),
  );
}
export async function recordWebhookEvent(id: string, type: string) {
  return (
    (await run(
      "INSERT INTO razorpay_webhook_events(id,event_type)VALUES(?,?) ON CONFLICT DO NOTHING",
      [id, type],
      await ready(),
    )) > 0
  );
}
export async function activateVerifiedSubscription(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  await ready();
  let institutionId = "";
  await connection().begin(async (tx) => {
    const item = await row<{
      id: string;
      institutionId: string;
      planId: string;
      status: string;
      paymentId: string | null;
      amountPaid: number;
      studentCount:number;
      pricePerStudent:number;
      pricingModel:string;
      activationDate:string;
      expiryDate:string;
    }>(
      'SELECT id,institution_id AS "institutionId",plan_id AS "planId",status,razorpay_payment_id AS "paymentId",amount_paid AS "amountPaid",COALESCE(student_count_at_purchase,student_capacity) AS "studentCount",price_per_student AS "pricePerStudent",pricing_model AS "pricingModel",activation_date::text AS "activationDate",expiry_date::text AS "expiryDate" FROM subscriptions WHERE razorpay_order_id=? FOR UPDATE',
      [orderId],
      tx,
    );
    if (!item) throw new Error("Subscription order not found");
    if(!isValidSubscriptionPricing(item))throw new Error("Subscription pricing validation failed.");
    institutionId = item.institutionId;
    if (item.paymentId && item.paymentId !== paymentId) throw new Error("Subscription order is already linked to another payment.");
    if ((item.status === "ACTIVE" || item.status === "UPCOMING" || item.status === "EXPIRING_SOON") && item.paymentId === paymentId) return;
    const now=new Date(),start=new Date(item.activationDate),expiry=new Date(item.expiryDate);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(expiry.getTime())||expiry<=start)throw new Error("Please select a valid subscription period.");
    const activatedStatus=start>now?"UPCOMING":"ACTIVE";
    await run(
      "UPDATE subscriptions SET status=?,payment_status='Paid',razorpay_payment_id=?,razorpay_signature=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [activatedStatus,paymentId,signature,item.id],
      tx,
    );
    await run(
      "INSERT INTO subscription_payments(id,institution_id,plan,student_capacity,student_count_at_purchase,pricing_model,plan_version,amount,razorpay_payment_id,payment_date,starts_at,ends_at,status) SELECT ?,s.institution_id,p.name,s.student_capacity,COALESCE(s.student_count_at_purchase,s.student_capacity),s.pricing_model,s.plan_version,s.amount_paid,?,?,?,?, 'SUCCESS' FROM subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.id=? ON CONFLICT(razorpay_payment_id) DO NOTHING",
      [
        randomUUID(),
        paymentId,
        now.toISOString().slice(0, 10),
        start,
        expiry,
        item.id,
      ],
      tx,
    );
    await audit(
      item.institutionId,
      undefined,
      "Subscription Activated",
      "Subscription",
      item.id,
      { planId: item.planId, orderId, paymentId },
      tx,
    );
    const recipients=await rows<{id:string}>("SELECT id FROM users WHERE institution_id=? AND role IN ('SCHOOL_ADMIN','SUPER_ADMIN') AND COALESCE(status,'Active')='Active'",[item.institutionId],tx);
    for(const recipient of recipients)await notify(item.institutionId,recipient.id,"subscription_payment","Payment Received",`₹${Number(item.amountPaid).toLocaleString("en-IN")} subscription payment received successfully. Payment ID: ${paymentId}. Date: ${now.toISOString()}. Status: Successful.`,tx,`subscription-payment-${paymentId}-${recipient.id}`);
  });
  return await getSubscription(institutionId);
}

export async function listUserNotifications(userId:string,limit=50){const db=await ready(),items=await rows<Record<string,unknown>>('SELECT id,type,title,description,link,delivery_status AS "deliveryStatus",read_at::text AS "readAt",created_at::text AS "createdAt" FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?',[userId,Math.min(Math.max(limit,1),100)],db),unread=(await row<{count:number}>('SELECT COUNT(*)::int count FROM notifications WHERE user_id=? AND read_at IS NULL',[userId],db)).count;return{items,unread}}
export async function markUserNotificationRead(userId:string,id?:string){const db=await ready();return id?run('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND read_at IS NULL',[id,userId],db):run('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL',[userId],db)}

export async function processSubscriptionLifecycle(now=new Date()){
 const db=await ready(),logId=randomUUID(),timestamp=now.toISOString();await run("INSERT INTO subscription_processing_logs(id,status)VALUES(?,'RUNNING')",[logId],db);
 let checked=0,expired=0,notifications=0;
 try{
  const settings=await row<{days:string;enabled:boolean;inApp:boolean}>('SELECT subscription_warning_days AS days,subscription_notifications_enabled AS enabled,in_app_notifications_enabled AS "inApp" FROM admin_settings WHERE id=\'global\'',[],db),schedule=(settings?.days||'30,15,7,3,1,0,-1').split(',').map(Number).filter(Number.isFinite),subscriptions=await rows<{id:string;institutionId:string;planName:string;expiryDate:string;status:string}>('SELECT s.id,s.institution_id AS "institutionId",p.name AS "planName",s.expiry_date::text AS "expiryDate",s.status FROM subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.payment_status=\'Paid\' AND s.expiry_date IS NOT NULL AND s.status NOT IN (\'CANCELLED\',\'SUSPENDED\',\'REFUNDED\',\'FAILED\')',[],db);
  for(const subscription of subscriptions){checked++;const days=Math.ceil((new Date(subscription.expiryDate).getTime()-now.getTime())/864e5),status=getSubscriptionStatus(subscription.status,subscription.expiryDate,now,Math.max(...schedule.filter(x=>x>=0),30));if(status!==subscription.status){await run('UPDATE subscriptions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[status,subscription.id],db);if(status==='EXPIRED')expired++}if(!settings?.enabled||!settings.inApp)continue;const milestone=days<0?'expired':String(days);if(!schedule.includes(days)&&!(days<0&&schedule.includes(-1)))continue;const inserted=await run("INSERT INTO subscription_notification_events(id,subscription_id,institution_id,milestone,status,sent_at)VALUES(?,?,?,?, 'SENT',?) ON CONFLICT(subscription_id,milestone) DO NOTHING",[randomUUID(),subscription.id,subscription.institutionId,milestone,timestamp],db);if(!inserted)continue;const users=await rows<{id:string;name:string}>('SELECT id,name FROM users WHERE institution_id=? AND status=\'Active\'',[subscription.institutionId],db),expiryLabel=new Intl.DateTimeFormat('en-IN',{dateStyle:'long',timeZone:'UTC'}).format(new Date(subscription.expiryDate)),isExpired=days<0;for(const user of users)await run('INSERT INTO notifications(id,institution_id,user_id,type,title,description,link,delivery_status)VALUES(?,?,?,?,?,?,?,\'SENT\')',[randomUUID(),subscription.institutionId,user.id,isExpired?'subscription_expired':'subscription_expiry',isExpired?'Your EduLedger subscription has expired':'Your EduLedger plan expires soon',isExpired?`Hello ${user.name}, your ${subscription.planName} subscription expired on ${expiryLabel}. Please renew your plan to restore access to premium features.`:`Hello ${user.name}, your ${subscription.planName} subscription will expire on ${expiryLabel}. You have ${Math.max(days,0)} day${days===1?'':'s'} remaining. Please renew your plan to continue using EduLedger.`,'/subscription'],db);notifications+=users.length}await run("UPDATE subscription_processing_logs SET status='COMPLETED',finished_at=CURRENT_TIMESTAMP,checked_count=?,expired_count=?,notification_count=? WHERE id=?",[checked,expired,notifications,logId],db);return{checked,expired,notifications,processedAt:timestamp}
 }catch(error){await run("UPDATE subscription_processing_logs SET status='FAILED',finished_at=CURRENT_TIMESTAMP,checked_count=?,expired_count=?,notification_count=?,error=? WHERE id=?",[checked,expired,notifications,error instanceof Error?error.message:'Unknown lifecycle error',logId],db);throw error}
}
export async function deleteAllRecords(
  institutionId: string,
  type: string,
  userId: string,
) {
  await ready();
  let count = 0;
  await connection().begin(async (tx) => {
    if (type === "students") {
      count = (
        await row<{ count: number }>(
          "SELECT COUNT(*)::int count FROM students WHERE institution_id=?",
          [institutionId],
          tx,
        )
      ).count;
      for (const table of [
        "receipts",
        "payments",
        "fees",
        "attendance",
        "students",
      ])
        await run(
          `DELETE FROM ${table} WHERE institution_id=?`,
          [institutionId],
          tx,
        );
    } else if (type === "teachers" || type === "classes")
      count = await run(
        `DELETE FROM ${type} WHERE institution_id=?`,
        [institutionId],
        tx,
      );
    else if (type === "attendance") {
      count = await run(
        "DELETE FROM attendance WHERE institution_id=?",
        [institutionId],
        tx,
      );
      await run(
        "UPDATE students SET attendance=100,updated_at=CURRENT_TIMESTAMP WHERE institution_id=?",
        [institutionId],
        tx,
      );
    } else if (type === "fees" || type === "reports") {
      count = (
        await row<{ count: number }>(
          "SELECT COUNT(*)::int count FROM fees WHERE institution_id=?",
          [institutionId],
          tx,
        )
      ).count;
      for (const table of ["receipts", "payments", "fees"])
        await run(
          `DELETE FROM ${table} WHERE institution_id=?`,
          [institutionId],
          tx,
        );
      await run(
        "UPDATE students SET total_fee=0,paid_fee=0,pending_fee=0,fee='Paid',updated_at=CURRENT_TIMESTAMP WHERE institution_id=?",
        [institutionId],
        tx,
      );
    } else if (type === "payments") {
      count = (
        await row<{ count: number }>(
          "SELECT COUNT(*)::int count FROM payments WHERE institution_id=?",
          [institutionId],
          tx,
        )
      ).count;
      await run(
        "DELETE FROM receipts WHERE institution_id=?",
        [institutionId],
        tx,
      );
      await run(
        "DELETE FROM payments WHERE institution_id=?",
        [institutionId],
        tx,
      );
      await run(
        "UPDATE fees SET paid_amount=0,pending_amount=final_amount,status=CASE WHEN due_date<CURRENT_DATE::text THEN 'Overdue' ELSE 'Pending' END,updated_at=CURRENT_TIMESTAMP WHERE institution_id=?",
        [institutionId],
        tx,
      );
      await run(
        "UPDATE students SET paid_fee=0,pending_fee=total_fee,fee=CASE WHEN EXISTS(SELECT 1 FROM fees WHERE student_id=students.id AND status='Overdue') THEN 'Overdue' WHEN total_fee=0 THEN 'Paid' ELSE 'Pending' END,updated_at=CURRENT_TIMESTAMP WHERE institution_id=?",
        [institutionId],
        tx,
      );
    } else if (type === "assignments" || type === "messages")
      count = await run(
        "DELETE FROM module_records WHERE institution_id=? AND module=?",
        [institutionId, type],
        tx,
      );
    else throw new Error("Unsupported section");
    await audit(
      institutionId,
      userId,
      "All Records Deleted",
      type,
      undefined,
      { count },
      tx,
    );
    await activity(
      institutionId,
      "delete",
      `${type} cleared`,
      `${count} records were deleted`,
      undefined,
      undefined,
      undefined,
      tx,
    );
  });
  return count;
}

async function seedDashboardDefaults(institutionId: string, academicYear: string, sql?: Sql) {
  const db = sql ?? await ready();
  await run(
    "INSERT INTO academic_years(id,institution_id,name,start_month,end_month,status,is_active) VALUES(?,?,?,?,?,'Active',TRUE) ON CONFLICT(institution_id,name) DO NOTHING",
    [randomUUID(), institutionId, academicYear, 4, 3],
    db,
  );
}

export async function listClassSummaries(institutionId: string, academicYear?: string) {
  const year = academicYear ?? (await getInstitution(institutionId)).academicYear;
  const [configured, configuredSections, classes, students, teachers] = await Promise.all([
    rows<{ name:string; sortOrder:number; status:string }>('SELECT name,sort_order AS "sortOrder",status FROM institution_classes WHERE institution_id=? ORDER BY sort_order,name',[institutionId],await ready()),
    rows<{ className:string; count:number }>('SELECT c.name AS "className",COUNT(s.id)::int count FROM institution_classes c LEFT JOIN institution_sections s ON s.class_id=c.id AND s.status=\'Active\' WHERE c.institution_id=? GROUP BY c.id,c.name',[institutionId],await ready()),
    rows<{ name: string; section: string; teacher: string; status: string }>(
      "SELECT name,section,teacher,status FROM classes WHERE institution_id=? AND academic_year=?",
      [institutionId, year], await ready()),
    rows<{ className: string; count: number }>(
      'SELECT e.class_name AS "className",COUNT(*)::int count FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.academic_year=? AND s.status<>\'Deleted\' GROUP BY e.class_name',
      [institutionId, year], await ready()),
    listTeachers(institutionId),
  ]);
  return configured.map((definition) => {
    const sections = classes.filter((item) => item.name === definition.name);
    const assigned = teachers.filter((teacher) => parseTeacherClasses(teacher.classes).includes(definition.name));
    return {
      name:definition.name,
      slug:definition.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),
      description:"Configured school class",
      academicYear: year,
      studentCount: students.find((item) => item.className === definition.name)?.count ?? 0,
      teacherCount: assigned.length,
      classTeacher: sections.find((item) => item.teacher)?.teacher || "Not Assigned",
      sectionCount: configuredSections.find(item=>item.className===definition.name)?.count ?? sections.length,
      status: definition.status,
    };
  });
}

export async function getClassWorkspace(institutionId: string, slug: string, academicYear?: string) {
  const year = academicYear ?? (await getInstitution(institutionId)).academicYear;
  const summaries = await listClassSummaries(institutionId, year);
  const summary = summaries.find((item) => item.slug === slug);
  if (!summary) return null;
  const definition=summary;
  const [sections, students, teachers, attendance, fees, payments, timetable, exams, results] = await Promise.all([
    rows('SELECT id,name,section,teacher,capacity,status FROM classes WHERE institution_id=? AND name=? AND academic_year=? ORDER BY section', [institutionId, definition.name, year], await ready()),
    listStudents(institutionId, { className: definition.name, academicYear:year, limit: 1000 }),
    listTeachers(institutionId),
    listAttendance(institutionId, { className: definition.name, academicYear:year }),
    listFees(institutionId, { className: definition.name, academicYear:year }),
    listPayments(institutionId, { className: definition.name, academicYear:year }),
    rows('SELECT t.id,t.section,t.subject,t.weekday,t.start_time AS "startTime",t.end_time AS "endTime",COALESCE(te.name,\'Unassigned\') AS "teacherName",t.teacher_id AS "teacherId" FROM timetable_entries t LEFT JOIN teachers te ON te.id=t.teacher_id AND te.institution_id=t.institution_id WHERE t.institution_id=? AND t.class_name=? AND t.academic_year=? AND COALESCE(t.status,\'Published\')<>\'Archived\' ORDER BY t.weekday,t.start_time', [institutionId, definition.name, year], await ready()).catch(() => []),
    rows('SELECT id,name,exam_date AS "examDate",section,subject,max_marks AS "maxMarks",passing_marks AS "passingMarks" FROM class_exams WHERE institution_id=? AND class_name=? AND academic_year=? ORDER BY exam_date DESC', [institutionId, definition.name, year], await ready()),
    rows('SELECT r.id,r.exam_id AS "examId",r.student_id AS "studentId",s.name AS "studentName",e.subject,r.marks,r.grade,r.status FROM class_results r JOIN students s ON s.id=r.student_id AND s.institution_id=r.institution_id JOIN class_exams e ON e.id=r.exam_id AND e.institution_id=r.institution_id WHERE r.institution_id=? AND e.class_name=? AND e.academic_year=? ORDER BY e.exam_date DESC,s.name', [institutionId, definition.name, year], await ready()),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = (attendance as { date: string; status: string }[]).filter((item) => item.date.slice(0, 10) === today);
  return { summary, sections, students, teachers, attendance, fees, payments, timetable, exams, results,
    metrics: {
      present: todayAttendance.filter((item) => item.status === "Present").length,
      absent: todayAttendance.filter((item) => item.status === "Absent").length,
      totalFees: (fees as { totalAmount: number }[]).reduce((sum, item) => sum + Number(item.totalAmount), 0),
      paidFees: (fees as { paidAmount: number }[]).reduce((sum, item) => sum + Number(item.paidAmount), 0),
      pendingFees: (fees as { pendingAmount: number }[]).reduce((sum, item) => sum + Number(item.pendingAmount), 0),
    }
  };
}

export async function addClassSection(institutionId: string, className: string, academicYear: string, section: string, teacher: string, capacity: number, userId: string) {
  const db = await ready();
  const configured = await row<{ count: number }>(
    "SELECT COUNT(*)::int count FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id WHERE c.institution_id=? AND c.name=? AND c.status='Active' AND s.name=? AND s.status='Active'",
    [institutionId, className, section],
    db,
  );
  if (!configured.count) throw new Error("Choose a class and section configured in Settings.");
  const item = await saveClass(institutionId, { name: className, section, teacher, academicYear, capacity, status: "Active" }, userId);
  return item;
}

export async function deleteClassSection(institutionId: string, id: string, userId: string) {
  const db = await ready();
  const item = await row<{ name: string; section: string; academicYear:string }>('SELECT name,section,academic_year AS "academicYear" FROM classes WHERE id=? AND institution_id=?', [id, institutionId], db);
  if (!item) throw new Error("Section not found");
  await ensureStudentEnrollments(institutionId,db);
  const active = await row<{ count: number }>('SELECT COUNT(*)::int count FROM student_enrollments WHERE institution_id=? AND academic_year=? AND class_name=? AND section=?', [institutionId,item.academicYear,item.name,item.section], db);
  if (active.count) throw new Error("Section contains student enrollment history and cannot be deleted.");
  const linked=await row<{count:number}>("SELECT ((SELECT COUNT(*) FROM timetable_entries WHERE institution_id=? AND academic_year=? AND class_name=? AND section=?)+(SELECT COUNT(*) FROM class_exams WHERE institution_id=? AND academic_year=? AND class_name=? AND section=?))::int count",[institutionId,item.academicYear,item.name,item.section,institutionId,item.academicYear,item.name,item.section],db);
  if(linked.count)throw new Error("Section contains timetable or exam records and cannot be deleted.");
  await run('DELETE FROM classes WHERE id=? AND institution_id=?', [id, institutionId], db);
  await audit(institutionId, userId, "Section Deleted", "Class", id, item, db);
}

export async function addTimetableEntry(institutionId: string, className: string, academicYear: string, input: { section: string; subject: string; teacherId?: string; weekday: number; startTime: string; endTime: string }) {
  const id = randomUUID();
  await run('INSERT INTO timetable_entries(id,institution_id,class_name,section,academic_year,subject,teacher_id,weekday,start_time,end_time)VALUES(?,?,?,?,?,?,?,?,?,?)', [id,institutionId,className,input.section,academicYear,input.subject,input.teacherId || null,input.weekday,input.startTime,input.endTime], await ready());
  return id;
}

export async function getTimetableSettings(institutionId: string): Promise<TimetableSettings> {
  const db = await ready();
  await ensureTimetableSchema(db).catch(() => {});
  try {
    const item = await row<{
      startTime: string;
      endTime: string;
      periodMinutes: number;
      shortBreakMinutes: number;
      lunchMinutes: number;
      periodsPerDay: number;
      workingDays: string;
      timezone: string;
    }>(
      `SELECT COALESCE(timetable_start_time, '09:00') AS "startTime",
              COALESCE(timetable_end_time, '16:00') AS "endTime",
              COALESCE(timetable_period_minutes, 40) AS "periodMinutes",
              COALESCE(timetable_short_break_minutes, 15) AS "shortBreakMinutes",
              COALESCE(timetable_lunch_minutes, 40) AS "lunchMinutes",
              COALESCE(timetable_periods_per_day, 9) AS "periodsPerDay",
              COALESCE(timetable_working_days, '1,2,3,4,5') AS "workingDays",
              COALESCE(timetable_timezone, 'Asia/Kolkata') AS timezone
       FROM settings WHERE institution_id=?`,
      [institutionId],
      db
    );
    if (!item) return defaultTimetableSettings;
    return {
      startTime: item.startTime || defaultTimetableSettings.startTime,
      endTime: item.endTime || defaultTimetableSettings.endTime,
      periodMinutes: Number(item.periodMinutes) || defaultTimetableSettings.periodMinutes,
      shortBreakMinutes: Number(item.shortBreakMinutes) || defaultTimetableSettings.shortBreakMinutes,
      lunchMinutes: Number(item.lunchMinutes) || defaultTimetableSettings.lunchMinutes,
      periodsPerDay: Number(item.periodsPerDay) || defaultTimetableSettings.periodsPerDay,
      workingDays: String(item.workingDays || "1,2,3,4,5").split(",").map(Number),
      timezone: item.timezone || defaultTimetableSettings.timezone,
    };
  } catch {
    return defaultTimetableSettings;
  }
}

export async function saveTimetableSettings(institutionId:string,userId:string,input:TimetableSettings){
  validateTimetableSettings(input);
  timetableSlots(input);
  const db=await ready();
  await ensureTimetableSchema(db);
  await run('INSERT INTO settings(institution_id)VALUES(?) ON CONFLICT(institution_id) DO NOTHING',[institutionId],db);
  await run('UPDATE settings SET timetable_start_time=?,timetable_end_time=?,timetable_period_minutes=?,timetable_short_break_minutes=?,timetable_lunch_minutes=?,timetable_periods_per_day=?,timetable_working_days=?,timetable_timezone=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=?',[input.startTime,input.endTime,input.periodMinutes,input.shortBreakMinutes,input.lunchMinutes,input.periodsPerDay,[...input.workingDays].sort().join(","),input.timezone,institutionId],db);
  await audit(institutionId,userId,"Timetable Settings Updated","Settings",institutionId,{...input},db);
  return getTimetableSettings(institutionId);
}

export type GeneratedTimetableEntry={weekday:number;startTime:string;endTime:string;subject:string;teacherId:string|null;teacherName:string};
export async function timetableContext(institutionId:string,className:string,section:string,academicYear:string){
  const db=await ready();
  await ensureTimetableSchema(db).catch(() => {});
  const target=await row<{id:string}>('SELECT id FROM classes WHERE institution_id=? AND name=? AND section=? AND academic_year=? AND status=?',[institutionId,className,section,academicYear,"Active"],db);
  if(!target)throw new Error("Choose an active class and section for this academic year.");
  const teachers=(await listTeachers(institutionId)).filter(item=>item.status==="Active"&&parseTeacherClasses(item.classes).includes(className)&&item.subject.trim());
  let existing: any[] = [];
  try {
    existing = await rows<{id:string;weekday:number;startTime:string;endTime:string;subject:string;teacherId:string|null;generated:boolean;className:string;section:string}>(
      'SELECT id,weekday,start_time AS "startTime",end_time AS "endTime",subject,teacher_id AS "teacherId",COALESCE(generated, FALSE) AS "generated",class_name AS "className",section FROM timetable_entries WHERE institution_id=? AND academic_year=? AND COALESCE(status, \'Published\')<>\'Archived\'',
      [institutionId,academicYear],
      db
    );
  } catch {
    existing = await rows<{id:string;weekday:number;startTime:string;endTime:string;subject:string;teacherId:string|null;generated:boolean;className:string;section:string}>(
      'SELECT id,weekday,start_time AS "startTime",end_time AS "endTime",subject,teacher_id AS "teacherId",FALSE AS "generated",class_name AS "className",section FROM timetable_entries WHERE institution_id=? AND academic_year=?',
      [institutionId,academicYear],
      db
    ).catch(() => []);
  }
  return {teachers,existing};
}

export async function previewWeeklyTimetable(institutionId:string,className:string,section:string,academicYear:string){
  const db = await ready();
  await ensureTimetableSchema(db).catch(() => {});
  const settings=await getTimetableSettings(institutionId),slots=timetableSlots(settings),{teachers,existing}=await timetableContext(institutionId,className,section,academicYear);
  const assignedSubjects=[...new Map(teachers.map(item=>[item.subject.trim().toLocaleLowerCase(),item.subject.trim()])).values()];
  if(!assignedSubjects.length)throw new Error("Assign at least one subject teacher to this class before generating a timetable.");
  const subjects=assignedSubjects;
  const manual=existing.filter(item=>item.className===className&&item.section===section&&!item.generated);
  const periods=slots.filter(slot=>slot.kind==="Period"),warnings:string[]=[];
  const availablePeriodCount=settings.workingDays.reduce((count,weekday)=>count+periods.filter(slot=>!manual.some(item=>item.weekday===weekday&&item.startTime<slot.endTime&&item.endTime>slot.startTime)).length,0);
  if(subjects.length>availablePeriodCount)warnings.push("There are more assigned subjects than available weekly periods. Adjust school timing or period duration, or move a manual entry.");
  const entries:GeneratedTimetableEntry[]=[];
  for(const weekday of settings.workingDays)for(const slot of periods){
    if(manual.some(item=>item.weekday===weekday&&item.startTime<slot.endTime&&item.endTime>slot.startTime))continue;
    const available=(subject:string)=>teachers.find(item=>item.subject.trim()===subject&&!(existing.some(booked=>booked.teacherId===item.id&&booked.weekday===weekday&&booked.startTime<slot.endTime&&booked.endTime>slot.startTime&&!(booked.generated&&booked.className===className&&booked.section===section)))&&!(entries.some(booked=>booked.teacherId===item.id&&booked.weekday===weekday&&booked.startTime<slot.endTime&&booked.endTime>slot.startTime)));
    const choices=subjects.map((_,index)=>subjects[(entries.length+index)%subjects.length]);
    const subject=choices.find(candidate=>available(candidate))||choices[0];
    const teacher=available(subject);
    if(!teacher&&!warnings.includes("Some periods have no available teacher because their subject is unassigned or the teacher has a timetable conflict."))warnings.push("Some periods have no available teacher because their subject is unassigned or the teacher has a timetable conflict.");
    entries.push({weekday,startTime:slot.startTime,endTime:slot.endTime,subject,teacherId:teacher?.id||null,teacherName:teacher?.name||"Unassigned"});
  }
  if(manual.length)warnings.push("Existing manual timetable entries are preserved. Generated periods that overlap them are skipped.");
  const scheduledSubjects=new Set(entries.map(item=>item.subject));
  const missingSubjects=subjects.filter(subject=>!scheduledSubjects.has(subject)&&!manual.some(item=>item.subject===subject));
  if(missingSubjects.length&&!warnings.some(warning=>warning.startsWith("There are more assigned subjects")))warnings.push(`No available generated period was assigned to: ${missingSubjects.join(", ")}. Adjust school timing, period duration, or manual entries.`);
  return {settings,slots,entries,warnings,manualCount:manual.length};
}

export async function applyWeeklyTimetable(institutionId:string,userId:string,className:string,section:string,academicYear:string){
  const db=await ready();
  await ensureTimetableSchema(db);
  const preview=await previewWeeklyTimetable(institutionId,className,section,academicYear);
  await db.begin(async tx=>{
    await run("UPDATE timetable_entries SET status='Draft' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",[institutionId,className,section,academicYear],tx);
    await run("UPDATE timetable_entries SET status='Archived' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND generated=TRUE AND status<>'Archived'",[institutionId,className,section,academicYear],tx);
    for(const item of preview.entries)await run("INSERT INTO timetable_entries(id,institution_id,class_name,section,academic_year,subject,teacher_id,weekday,start_time,end_time,generated,status)VALUES(?,?,?,?,?,?,?,?,?,?,TRUE,'Draft')",[randomUUID(),institutionId,className,section,academicYear,item.subject,item.teacherId,item.weekday,item.startTime,item.endTime],tx);
    await audit(institutionId,userId,"Weekly Timetable Generated","Timetable",undefined,{className,section,academicYear,periods:preview.entries.length,settings:preview.settings},tx);
  });
  return preview;
}

export async function addClassExam(institutionId: string, className: string, academicYear: string, input: { name: string; examDate: string; section: string; subject: string; maxMarks: number; passingMarks: number }) {
  const id = randomUUID();
  await run('INSERT INTO class_exams(id,institution_id,class_name,section,academic_year,name,exam_date,subject,max_marks,passing_marks)VALUES(?,?,?,?,?,?,?,?,?,?)', [id,institutionId,className,input.section,academicYear,input.name,input.examDate,input.subject,input.maxMarks,input.passingMarks], await ready());
  return id;
}

export async function addClassResult(institutionId: string, examId: string, studentId: string, marks: number) {
  const db=await ready();
  const exam = await row<{ maxMarks: number; passingMarks: number; className:string;section:string;academicYear:string }>('SELECT max_marks AS "maxMarks",passing_marks AS "passingMarks",class_name AS "className",section,academic_year AS "academicYear" FROM class_exams WHERE id=? AND institution_id=?', [examId,institutionId], db);
  if (!exam || marks < 0 || marks > exam.maxMarks) throw new Error("Invalid marks");
  const student=await row<{id:string}>('SELECT s.id FROM students s WHERE s.id=? AND s.institution_id=? AND s.status<>? AND (EXISTS(SELECT 1 FROM student_enrollments e WHERE e.student_id=s.id AND e.institution_id=s.institution_id AND e.academic_year=? AND e.class_name=? AND e.section=?) OR (s.academic_year=? AND s.class_name=? AND s.section=?))',[studentId,institutionId,"Deleted",exam.academicYear,exam.className,exam.section,exam.academicYear,exam.className,exam.section],db);
  if(!student)throw new Error("Student does not belong to this school, class, section, and academic year.");
  const percent = (marks / exam.maxMarks) * 100;
  const grade = percent >= 90 ? "A+" : percent >= 80 ? "A" : percent >= 70 ? "B" : percent >= 60 ? "C" : percent >= 50 ? "D" : "F";
  const id = randomUUID();
  await run('INSERT INTO class_results(id,institution_id,exam_id,student_id,marks,grade,status)VALUES(?,?,?,?,?,?,?) ON CONFLICT(exam_id,student_id) DO UPDATE SET marks=EXCLUDED.marks,grade=EXCLUDED.grade,status=EXCLUDED.status WHERE class_results.institution_id=EXCLUDED.institution_id', [id,institutionId,examId,studentId,marks,grade,marks >= exam.passingMarks ? "Pass" : "Fail"], db);
  return id;
}

export type AccountTransactionInput={transactionType:"income"|"expense";category:string;amountPaise:number;transactionDate:string;description:string;paymentMethod:string;referenceNumber:string;notes:string;academicYear:string};
const accountSelect='SELECT a.id,a.transaction_type AS "transactionType",a.category,a.amount_paise AS "amountPaise",a.transaction_date AS "transactionDate",a.description,a.payment_method AS "paymentMethod",a.reference_number AS "referenceNumber",a.source_type AS "sourceType",a.source_id AS "sourceId",a.status,a.notes,a.created_by AS "createdBy",u.name AS "createdByName",a.created_at::text AS "createdAt",a.updated_at::text AS "updatedAt" FROM account_transactions a JOIN users u ON u.id=a.created_by';
export type AccountTransaction={id:string;transactionType:"income"|"expense";category:string;amountPaise:number;transactionDate:string;description:string;paymentMethod:string;referenceNumber:string;sourceType:string;sourceId:string|null;status:string;notes:string;createdBy:string;createdByName:string;createdAt:string;updatedAt:string};

export async function getAccountTransactionsForVoucher(institutionId:string,ids:string[]){
 if(ids.length<1||ids.length>2||new Set(ids).size!==ids.length)return[];
 const db=await ready(),items=await Promise.all(ids.map(id=>row<AccountTransaction>(`${accountSelect} WHERE a.id=? AND a.institution_id=?`,[id,institutionId],db)));
 return items.every((item):item is AccountTransaction=>Boolean(item))?items:[];
}

export async function listAccountTransactions(institutionId:string,filters:{academicYear:string;search?:string;type?:string;category?:string;method?:string;from?:string;to?:string;limit?:number;offset?:number}){
 const where=["a.institution_id=?","a.academic_year=?"],args:unknown[]=[institutionId,filters.academicYear];
 if(filters.search){where.push("(a.description ILIKE ? OR a.reference_number ILIKE ? OR a.category ILIKE ?)");const q=`%${filters.search}%`;args.push(q,q,q)}
 if(filters.type){where.push("a.transaction_type=?");args.push(filters.type)}if(filters.category){where.push("a.category=?");args.push(filters.category)}if(filters.method){where.push("a.payment_method=?");args.push(filters.method)}if(filters.from){where.push("a.transaction_date>=?");args.push(filters.from)}if(filters.to){where.push("a.transaction_date<=?");args.push(filters.to)}
 const db=await ready(),total=(await row<{count:number}>(`SELECT COUNT(*)::int count FROM account_transactions a WHERE ${where.join(" AND ")}`,args,db)).count,limit=Math.min(filters.limit??25,10000),offset=Math.max(filters.offset??0,0);
 const items=await rows(`${accountSelect} WHERE ${where.join(" AND ")} ORDER BY a.transaction_date DESC,a.created_at DESC LIMIT ? OFFSET ?`,[...args,limit,offset],db);
 return{items,total,limit,offset};
}

export async function createAccountTransaction(institutionId:string,userId:string,input:AccountTransactionInput){
 const id=randomUUID(),db=await ready();await run('INSERT INTO account_transactions(id,institution_id,academic_year,transaction_type,category,amount_paise,transaction_date,description,payment_method,reference_number,notes,created_by)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[id,institutionId,input.academicYear,input.transactionType,input.category,input.amountPaise,input.transactionDate,input.description,input.paymentMethod,input.referenceNumber,input.notes,userId],db);await audit(institutionId,userId,"Account Transaction Created","AccountTransaction",id,input,db);return await row(`${accountSelect} WHERE a.id=? AND a.institution_id=?`,[id,institutionId],db);
}

export async function updateAccountTransaction(institutionId:string,userId:string,id:string,input:AccountTransactionInput){
 const db=await ready(),previous=await row<Record<string,unknown>>(`${accountSelect} WHERE a.id=? AND a.institution_id=?`,[id,institutionId],db);if(!previous)throw new Error("Transaction not found");if(previous.sourceType!=="cash_book")throw new Error("Imported ledger entries cannot be edited");if(previous.status==="Voided")throw new Error("Voided transactions cannot be edited");await run('UPDATE account_transactions SET academic_year=?,transaction_type=?,category=?,amount_paise=?,transaction_date=?,description=?,payment_method=?,reference_number=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[input.academicYear,input.transactionType,input.category,input.amountPaise,input.transactionDate,input.description,input.paymentMethod,input.referenceNumber,input.notes,id,institutionId],db);await audit(institutionId,userId,"Account Transaction Updated","AccountTransaction",id,{previous,next:input},db);return await row(`${accountSelect} WHERE a.id=? AND a.institution_id=?`,[id,institutionId],db);
}

export async function voidAccountTransaction(institutionId:string,userId:string,id:string,reason=""){
 const db=await ready(),previous=await row<Record<string,unknown>>(`${accountSelect} WHERE a.id=? AND a.institution_id=?`,[id,institutionId],db);if(!previous)throw new Error("Transaction not found");if(previous.status==="Voided")return previous;await run("UPDATE account_transactions SET status='Voided',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[id,institutionId],db);await audit(institutionId,userId,"Account Transaction Voided","AccountTransaction",id,{previous,reason},db);return{...previous,status:"Voided"};
}

function academicMonths(academicYear:string){const start=Number(academicYear.match(/\d{4}/)?.[0]||new Date().getFullYear());return Array.from({length:12},(_,i)=>{const date=new Date(Date.UTC(start,i+3,1));return{key:date.toISOString().slice(0,7),label:new Intl.DateTimeFormat("en-IN",{month:"short",year:"numeric",timeZone:"UTC"}).format(date)}})}
export async function accountsSummary(institutionId:string,academicYear:string){
 const db=await ready(),[fees,feePayments,ledger]=await Promise.all([
  row<{total:number}>('SELECT COALESCE(SUM(final_amount),0) total FROM fees WHERE institution_id=? AND academic_year=?',[institutionId,academicYear],db),
  row<{total:number}>('SELECT COALESCE(SUM(p.amount),0) total FROM payments p JOIN fees f ON f.id=p.fee_id WHERE p.institution_id=? AND f.academic_year=? AND p.status=\'Success\'',[institutionId,academicYear],db),
  rows<{transactionType:string;category:string;amountPaise:number;transactionDate:string;sourceType:string}>('SELECT transaction_type AS "transactionType",category,amount_paise AS "amountPaise",transaction_date AS "transactionDate",source_type AS "sourceType" FROM account_transactions WHERE institution_id=? AND academic_year=? AND status=\'Active\'',[institutionId,academicYear],db)
 ]);
 const paise=(value:number)=>Math.round(Number(value||0)*100),feeExpected=paise(fees.total),feeCollections=paise(feePayments.total),active=ledger.map(x=>({...x,amountPaise:Number(x.amountPaise)}));
 const nonFee=active.filter(x=>x.sourceType!=="fee_payment"),salary=nonFee.filter(x=>x.transactionType==="expense"&&["Staff Salaries","Salary/Payroll"].includes(x.category)).reduce((n,x)=>n+x.amountPaise,0),otherIncome=nonFee.filter(x=>x.transactionType==="income"&&x.category==="Other Income").reduce((n,x)=>n+x.amountPaise,0),cashIncome=nonFee.filter(x=>x.transactionType==="income"&&x.category!=="Other Income").reduce((n,x)=>n+x.amountPaise,0),otherExpenses=nonFee.filter(x=>x.transactionType==="expense"&&x.category==="Other Expenses").reduce((n,x)=>n+x.amountPaise,0),cashExpenses=nonFee.filter(x=>x.transactionType==="expense"&&!['Staff Salaries','Salary/Payroll','Other Expenses'].includes(x.category)).reduce((n,x)=>n+x.amountPaise,0),totalIncome=feeCollections+cashIncome+otherIncome,totalExpenses=salary+cashExpenses+otherExpenses;
 const monthly=academicMonths(academicYear).map(month=>{const entries=nonFee.filter(x=>x.transactionDate.startsWith(month.key)),fee=0;return{...month,feeCollections:fee,staffSalaries:entries.filter(x=>x.transactionType==="expense"&&["Staff Salaries","Salary/Payroll"].includes(x.category)).reduce((n,x)=>n+x.amountPaise,0),otherIncome:entries.filter(x=>x.transactionType==="income").reduce((n,x)=>n+x.amountPaise,0),otherExpenses:entries.filter(x=>x.transactionType==="expense"&&!["Staff Salaries","Salary/Payroll"].includes(x.category)).reduce((n,x)=>n+x.amountPaise,0)}});
 const paymentMonths=await rows<{month:string;amount:number}>('SELECT SUBSTRING(p.payment_date,1,7) AS "month",COALESCE(SUM(p.amount),0) amount FROM payments p JOIN fees f ON f.id=p.fee_id WHERE p.institution_id=? AND f.academic_year=? AND p.status=\'Success\' GROUP BY SUBSTRING(p.payment_date,1,7)',[institutionId,academicYear],db);for(const item of monthly){item.feeCollections=paise(paymentMonths.find(p=>p.month===item.key)?.amount||0)}
 return{academicYear,feeExpected,totalCollected:feeCollections,totalExpenses,netProfitLoss:totalIncome-totalExpenses,totalIncome,totalExpenditure:totalExpenses,incomeStreams:{feeCollections,cashBookIncome:cashIncome,otherIncome,grandTotal:totalIncome},expenditureStreams:{staffSalaries:salary,cashBookExpenses:cashExpenses,otherExpenses,grandTotal:totalExpenses},monthly:monthly.map(x=>({...x,income:x.feeCollections+x.otherIncome,expenses:x.staffSalaries+x.otherExpenses,net:x.feeCollections+x.otherIncome-x.staffSalaries-x.otherExpenses}))};
}

export type SalaryInput={employeeKey:string;month:number;year:number;basicPaise:number;allowancesPaise:number;bonusPaise:number;overtimePaise:number;otherEarningsPaise:number;deductionsPaise:number;advanceDeductionPaise:number;otherDeductionsPaise:number;notes:string};
export async function adminSalaryEmployees(){const db=await ready();return rows<{key:string;teacherId:string|null;userId:string|null;name:string;employeeId:string;role:string;department:string;designation:string;institutionId:string;school:string;joiningDate:string;defaultSalaryPaise:number}>(`SELECT 'teacher:'||t.id AS key,t.id AS "teacherId",NULL AS "userId",t.name,t.employee_id AS "employeeId",'Teacher' AS role,t.department,t.subject AS designation,t.institution_id AS "institutionId",i.name AS school,t.joining_date AS "joiningDate",CAST(ROUND(t.salary*100) AS INTEGER) AS "defaultSalaryPaise" FROM teachers t JOIN institutions i ON i.id=t.institution_id WHERE t.status='Active' UNION ALL SELECT 'user:'||u.id,NULL,u.id,u.name,u.id,'Staff','',u.role,u.institution_id,i.name,'',0 FROM users u JOIN institutions i ON i.id=u.institution_id WHERE u.role='STAFF' AND COALESCE(u.status,'Active')='Active' ORDER BY 4`,[],db)}
export async function adminSalaryData(filters:{search?:string;status?:string;month?:number;year?:number;school?:string;limit?:number;offset?:number}={}){const db=await ready(),where:string[]=["1=1"],args:unknown[]=[];if(filters.search){where.push('(s.employee_name ILIKE ? OR s.employee_number ILIKE ? OR s.payslip_number ILIKE ?)');args.push(`%${filters.search}%`,`%${filters.search}%`,`%${filters.search}%`)}if(filters.status){where.push('s.payment_status=?');args.push(filters.status)}if(filters.month){where.push('s.salary_month=?');args.push(filters.month)}if(filters.year){where.push('s.salary_year=?');args.push(filters.year)}if(filters.school){where.push('s.institution_id=?');args.push(filters.school)}const clause=where.join(' AND '),total=await row<{count:number}>(`SELECT COUNT(*)::int count FROM salaries s WHERE ${clause}`,args,db),items=await rows<Record<string,unknown>>(`SELECT s.id,s.institution_id AS "institutionId",i.name AS school,s.employee_key AS "employeeKey",s.employee_name AS "employeeName",s.employee_number AS "employeeId",s.employee_role AS role,s.department,s.designation,s.salary_month AS month,s.salary_year AS year,s.basic_paise AS "basicPaise",s.allowances_paise AS "allowancesPaise",s.bonus_paise AS "bonusPaise",s.overtime_paise AS "overtimePaise",s.other_earnings_paise AS "otherEarningsPaise",s.gross_paise AS "grossPaise",s.deductions_paise AS "deductionsPaise",s.advance_deduction_paise AS "advanceDeductionPaise",s.other_deductions_paise AS "otherDeductionsPaise",s.total_deductions_paise AS "totalDeductionsPaise",s.net_paise AS "netPaise",s.paid_paise AS "paidPaise",s.payment_status AS "paymentStatus",s.payment_date AS "paymentDate",s.payment_method AS "paymentMethod",s.payment_reference AS "paymentReference",s.payment_notes AS "paymentNotes",s.notes,s.payslip_number AS "payslipNumber",s.created_at::text AS "createdAt" FROM salaries s JOIN institutions i ON i.id=s.institution_id WHERE ${clause} ORDER BY s.salary_year DESC,s.salary_month DESC,s.created_at DESC LIMIT ? OFFSET ?`,[...args,Math.min(filters.limit||25,100),filters.offset||0],db),now=new Date(),currentMonth=now.getMonth()+1,currentYear=now.getFullYear(),summary=await row<Record<string,number>>(`SELECT COUNT(*)::int records,COALESCE(SUM(net_paise),0)::int "totalSalary",COALESCE(SUM(CASE WHEN payment_status='Paid' THEN paid_paise ELSE 0 END),0)::int paid,COALESCE(SUM(CASE WHEN payment_status NOT IN ('Paid','Cancelled') THEN net_paise-paid_paise ELSE 0 END),0)::int pending,COALESCE(SUM(CASE WHEN salary_month=? AND salary_year=? THEN net_paise ELSE 0 END),0)::int "currentMonth",COALESCE(SUM(CASE WHEN salary_year=? THEN net_paise ELSE 0 END),0)::int "thisYear" FROM salaries`,[currentMonth,currentYear,currentYear],db),employees=await adminSalaryEmployees();return{items,total:total.count,summary:{...summary,teachers:employees.filter(x=>x.role==='Teacher').length,staff:employees.filter(x=>x.role==='Staff').length,employees:employees.length},employees}}
export async function schoolSalaryData(institutionId:string,filters:{search?:string;status?:string;month?:number;year?:number;limit?:number;offset?:number}={}){
 const data=await adminSalaryData({...filters,school:institutionId}),db=await ready(),now=new Date(),month=now.getMonth()+1,year=now.getFullYear();
 const summary=await row<Record<string,number>>(`SELECT COUNT(*)::int records,COALESCE(SUM(net_paise),0)::int "totalSalary",COALESCE(SUM(CASE WHEN payment_status='Paid' THEN paid_paise ELSE 0 END),0)::int paid,COALESCE(SUM(CASE WHEN payment_status NOT IN ('Paid','Cancelled') THEN net_paise-paid_paise ELSE 0 END),0)::int pending,COALESCE(SUM(CASE WHEN salary_month=? AND salary_year=? THEN net_paise ELSE 0 END),0)::int "currentMonth",COALESCE(SUM(CASE WHEN salary_year=? THEN net_paise ELSE 0 END),0)::int "thisYear" FROM salaries WHERE institution_id=?`,[month,year,year,institutionId],db),employees=(await adminSalaryEmployees()).filter(item=>item.institutionId===institutionId);
 return{...data,summary:{...summary,teachers:employees.filter(item=>item.role==='Teacher').length,staff:employees.filter(item=>item.role==='Staff').length,employees:employees.length},employees};
}

export async function assignClassTeacher(institutionId:string,userId:string,classId:string,teacher:string){const db=await ready(),target=await row<{id:string;academicYear:string;name:string;section:string}>('SELECT id,academic_year AS "academicYear",name,section FROM classes WHERE id=? AND institution_id=? AND status=\'Active\'',[classId,institutionId],db);if(!target)throw new Error("Class section not found.");if(teacher){const exists=await row<{name:string;section:string}>('SELECT name,section FROM classes WHERE institution_id=? AND academic_year=? AND teacher=? AND id<>? AND status=\'Active\'',[institutionId,target.academicYear,teacher,classId],db);if(exists)throw new Error(`${teacher} is already class teacher for ${exists.name}-${exists.section}. Remove that assignment first.`);const valid=await row<{count:number}>('SELECT COUNT(*)::int count FROM teachers WHERE institution_id=? AND name=? AND status=\'Active\'',[institutionId,teacher],db);if(!valid.count)throw new Error("Choose an active teacher from this school.")}await run('UPDATE classes SET teacher=? WHERE id=? AND institution_id=?',[teacher,classId,institutionId],db);await audit(institutionId,userId,teacher?"Class Teacher Assigned":"Class Teacher Removed","Class",classId,{...target,teacher},db);return true}
export async function createAdminSalary(adminId:string,input:SalaryInput){const db=await ready(),employees=await adminSalaryEmployees(),employee=employees.find(x=>x.key===input.employeeKey);if(!employee)throw new Error('Employee not found.');const amounts=calculatePayrollAmounts(input),gross=amounts.grossPaise,totalDeductions=amounts.totalDeductionsPaise,net=amounts.netPaise;return db.begin(async tx=>{const id=randomUUID(),payslip=`PAY-${input.year}-${String(input.month).padStart(2,'0')}-${id.slice(0,8).toUpperCase()}`;await run('INSERT INTO salaries(id,institution_id,employee_key,teacher_id,user_id,employee_name,employee_number,employee_role,department,designation,salary_month,salary_year,basic_paise,allowances_paise,bonus_paise,overtime_paise,other_earnings_paise,gross_paise,deductions_paise,advance_deduction_paise,other_deductions_paise,total_deductions_paise,net_paise,payslip_number,notes,created_by)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,employee.institutionId,employee.key,employee.teacherId,employee.userId,employee.name,employee.employeeId,employee.role,employee.department,employee.designation,input.month,input.year,input.basicPaise,input.allowancesPaise,input.bonusPaise,input.overtimePaise,input.otherEarningsPaise,gross,input.deductionsPaise,input.advanceDeductionPaise,input.otherDeductionsPaise,totalDeductions,net,payslip,input.notes,adminId],tx);await audit(employee.institutionId,adminId,'Salary Added','Salary',id,{employee:employee.name,month:input.month,year:input.year,netPaise:net},tx);return{id,payslipNumber:payslip}})}
export async function updateAdminSalaryPayment(adminId:string,institutionId:string,id:string,input:{amountPaise:number;paymentDate:string;paymentMethod:string;paymentReference:string;paymentNotes:string;requestId:string}){const db=await ready();return db.begin(async tx=>{const repeated=await row<{transactionId:string}>('SELECT account_transaction_id AS "transactionId" FROM salary_payment_events WHERE institution_id=? AND request_id=?',[institutionId,input.requestId],tx);if(repeated){const item=await row<{status:string;reference:string}>('SELECT payment_status AS status,payment_reference AS reference FROM salaries WHERE id=? AND institution_id=?',[id,institutionId],tx);return{success:true,salaryPaymentId:id,transactionId:repeated.transactionId,reference:item?.reference||'',amount:input.amountPaise,paymentMethod:input.paymentMethod,status:item?.status||'',idempotent:true}}
const salary=await row<{netPaise:number;paidPaise:number;employeeName:string;salaryYear:number;existingReference:string}>(`SELECT net_paise AS "netPaise",paid_paise AS "paidPaise",employee_name AS "employeeName",salary_year AS "salaryYear",payment_reference AS "existingReference" FROM salaries WHERE id=? AND institution_id=? FOR UPDATE`,[id,institutionId],tx);if(!salary)throw new Error('Salary record not found.');const total=salary.paidPaise+input.amountPaise;if(input.amountPaise<=0||total>salary.netPaise)throw new Error('Payment must be greater than zero and cannot exceed the remaining salary.');const status=total===salary.netPaise?'Paid':'Partially Paid',reference=salary.existingReference||input.paymentReference.trim()||`SAL-${salary.salaryYear}-${id.slice(0,8).toUpperCase()}`,academicYear=`${Number(input.paymentDate.slice(0,4))-(Number(input.paymentDate.slice(5,7))<4?1:0)}-${Number(input.paymentDate.slice(0,4))+(Number(input.paymentDate.slice(5,7))<4?0:1)}`;await run('UPDATE salaries SET payment_status=?,paid_paise=?,payment_date=?,payment_method=?,payment_reference=?,payment_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[status,total,input.paymentDate,input.paymentMethod,reference,input.paymentNotes,id,institutionId],tx);await run("INSERT INTO account_transactions(id,institution_id,academic_year,transaction_type,category,amount_paise,transaction_date,description,payment_method,reference_number,source_type,source_id,status,notes,created_by)VALUES(?,?,?,'expense','Staff Salaries',?,?,?,?,?,'salary_payment',?,'Active',?,?) ON CONFLICT(institution_id,source_type,source_id) WHERE source_id IS NOT NULL DO UPDATE SET academic_year=EXCLUDED.academic_year,category='Staff Salaries',amount_paise=EXCLUDED.amount_paise,transaction_date=EXCLUDED.transaction_date,description=EXCLUDED.description,payment_method=EXCLUDED.payment_method,reference_number=EXCLUDED.reference_number,status='Active',notes=EXCLUDED.notes,updated_at=CURRENT_TIMESTAMP",[randomUUID(),institutionId,academicYear,total,input.paymentDate,`Salary payment - ${salary.employeeName}`,input.paymentMethod,reference,id,input.paymentNotes,adminId],tx);const ledger=await row<{id:string}>('SELECT id FROM account_transactions WHERE institution_id=? AND source_type=? AND source_id=?',[institutionId,'salary_payment',id],tx);await run('INSERT INTO salary_payment_events(id,institution_id,salary_id,request_id,amount_paise,account_transaction_id,created_by)VALUES(?,?,?,?,?,?,?)',[randomUUID(),institutionId,id,input.requestId,input.amountPaise,ledger.id,adminId],tx);await audit(institutionId,adminId,'Salary Payment Recorded','Salary',id,{amountPaise:input.amountPaise,totalPaidPaise:total,paymentMethod:input.paymentMethod,reference,transactionId:ledger.id},tx);return{success:true,salaryPaymentId:id,transactionId:ledger.id,reference,amount:input.amountPaise,paymentMethod:input.paymentMethod,status,idempotent:false}})}

export async function reconcileSalaryTransactions(institutionId:string,userId:string){const db=await ready();return db.begin(async tx=>{const salaries=await rows<{id:string;employeeName:string;paidPaise:number;paymentDate:string;paymentMethod:string;paymentReference:string;salaryYear:number}>('SELECT id,employee_name AS "employeeName",paid_paise AS "paidPaise",payment_date AS "paymentDate",payment_method AS "paymentMethod",payment_reference AS "paymentReference",salary_year AS "salaryYear" FROM salaries WHERE institution_id=? AND paid_paise>0 AND payment_status IN (\'Paid\',\'Partially Paid\') ORDER BY created_at,id FOR UPDATE',[institutionId],tx);let created=0,updated=0;for(const salary of salaries){const existing=await row<{id:string}>('SELECT id FROM account_transactions WHERE institution_id=? AND source_type=? AND source_id=?',[institutionId,'salary_payment',salary.id],tx),reference=salary.paymentReference||`SAL-${salary.salaryYear}-${salary.id.slice(0,8).toUpperCase()}`,date=salary.paymentDate||`${salary.salaryYear}-04-01`,academicYear=`${Number(date.slice(0,4))-(Number(date.slice(5,7))<4?1:0)}-${Number(date.slice(0,4))+(Number(date.slice(5,7))<4?0:1)}`;await run("INSERT INTO account_transactions(id,institution_id,academic_year,transaction_type,category,amount_paise,transaction_date,description,payment_method,reference_number,source_type,source_id,status,notes,created_by)VALUES(?,?,?,'expense','Staff Salaries',?,?,?,?,?,'salary_payment',?,'Active','Reconciled from salary payment',?) ON CONFLICT(institution_id,source_type,source_id) WHERE source_id IS NOT NULL DO UPDATE SET academic_year=EXCLUDED.academic_year,category='Staff Salaries',amount_paise=EXCLUDED.amount_paise,transaction_date=EXCLUDED.transaction_date,description=EXCLUDED.description,payment_method=EXCLUDED.payment_method,reference_number=EXCLUDED.reference_number,status='Active',updated_at=CURRENT_TIMESTAMP",[randomUUID(),institutionId,academicYear,salary.paidPaise,date,`Salary payment - ${salary.employeeName}`,salary.paymentMethod||'Other',reference,salary.id,userId],tx);if(existing)updated++;else created++}await audit(institutionId,userId,'Salary Transactions Reconciled','Salary',institutionId,{checked:salaries.length,created,updated,duplicates:0},tx);return{checked:salaries.length,created,updated,duplicates:0}})}
export async function cancelAdminSalary(adminId:string,institutionId:string,id:string){const db=await ready(),salary=await row<{paymentStatus:string}>(`SELECT payment_status AS "paymentStatus" FROM salaries WHERE id=? AND institution_id=?`,[id,institutionId],db);if(!salary)throw new Error('Salary record not found.');if(salary.paymentStatus==='Paid')throw new Error('Paid salary records cannot be cancelled.');await db.begin(async tx=>{await run("UPDATE salaries SET payment_status='Cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?",[id,institutionId],tx);await run("UPDATE account_transactions SET status='Voided',updated_at=CURRENT_TIMESTAMP WHERE institution_id=? AND source_type='salary_payment' AND source_id=?",[institutionId,id],tx);await audit(institutionId,adminId,'Salary Cancelled','Salary',id,{},tx)})}
export async function getAdminSalary(id:string,institutionId?:string){return row<Record<string,unknown>>(`SELECT s.*,i.name AS school,st.school_address AS address,st.school_phone AS phone,st.school_email AS email,st.payslip_title AS "payslipTitle",st.payslip_subheader AS "payslipSubheader",st.footer_text AS footer,st.signature_label AS "signatureLabel" FROM salaries s JOIN institutions i ON i.id=s.institution_id LEFT JOIN settings st ON st.institution_id=s.institution_id WHERE s.id=?${institutionId?" AND s.institution_id=?":""}`,[id,...(institutionId?[institutionId]:[])],await ready())}

export type AdminRange={from?:string;to?:string;search?:string;status?:string;school?:string;limit?:number;offset?:number};
const n=(value:unknown)=>Number(value||0);
export async function adminOverview(range:AdminRange={}){
 const db=await ready(),today=new Date().toISOString().slice(0,10),month=today.slice(0,7),year=today.slice(0,4),to=range.to||today,from=range.from||new Date(Date.now()-29*864e5).toISOString().slice(0,10),span=Math.max(1,Math.round((new Date(to).getTime()-new Date(from).getTime())/864e5)+1),previousTo=new Date(new Date(from).getTime()-864e5).toISOString().slice(0,10),previousFrom=new Date(new Date(from).getTime()-span*864e5).toISOString().slice(0,10);
 const nowIso=new Date().toISOString(),in7dIso=new Date(Date.now()+7*864e5).toISOString(),in15dIso=new Date(Date.now()+15*864e5).toISOString(),in30dIso=new Date(Date.now()+30*864e5).toISOString();
 const [users,schools,subs,subscriptionRevenue,paymentStates,growth,revenueTrend,recent,periodMetrics,recentSchools,platformStats,expiringStats,allTimeRevenue,trialSchoolsCount,addonStats]=await Promise.all([
  row<Record<string,number>>("SELECT COUNT(*)::int total,COALESCE(SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END),0)::int active,COALESCE(SUM(CASE WHEN status='Inactive' THEN 1 ELSE 0 END),0)::int inactive,COALESCE(SUM(CASE WHEN status='Suspended' THEN 1 ELSE 0 END),0)::int suspended,COALESCE(SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END),0)::int pending,COALESCE(SUM(CASE WHEN SUBSTRING(created_at::text,1,10)=? THEN 1 ELSE 0 END),0)::int \"today\",COALESCE(SUM(CASE WHEN SUBSTRING(created_at::text,1,7)=? THEN 1 ELSE 0 END),0)::int \"month\" FROM users WHERE role<>'SUPER_ADMIN'",[today,month],db),
  row<Record<string,number>>("SELECT COUNT(*)::int total,COALESCE(SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END),0)::int active,COALESCE(SUM(CASE WHEN status='Inactive' THEN 1 ELSE 0 END),0)::int inactive,COALESCE(SUM(CASE WHEN status='Suspended' THEN 1 ELSE 0 END),0)::int suspended,COALESCE(SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END),0)::int pending,COALESCE(SUM(CASE WHEN SUBSTRING(created_at::text,1,7)=? THEN 1 ELSE 0 END),0)::int \"month\" FROM institutions i WHERE NOT EXISTS(SELECT 1 FROM users owner WHERE owner.institution_id=i.id AND owner.role='SUPER_ADMIN')",[month],db),
  row<Record<string,number>>("SELECT COALESCE(SUM(CASE WHEN status='ACTIVE' AND expiry_date>CURRENT_TIMESTAMP THEN 1 ELSE 0 END),0)::int paid,COALESCE(SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END),0)::int trial,COALESCE(SUM(CASE WHEN status='EXPIRED' OR expiry_date<=CURRENT_TIMESTAMP THEN 1 ELSE 0 END),0)::int expired FROM subscriptions",[],db),
  row<{total:number}>("SELECT COALESCE(SUM(amount),0) total FROM subscription_payments WHERE status='SUCCESS' AND payment_date>=? AND payment_date<=?",[from,to],db),
  row<Record<string,number>>("SELECT COALESCE(SUM(CASE WHEN UPPER(status)='SUCCESS' THEN 1 ELSE 0 END),0)::int success,COALESCE(SUM(CASE WHEN UPPER(status)='PENDING' THEN 1 ELSE 0 END),0)::int pending,COALESCE(SUM(CASE WHEN UPPER(status)='FAILED' THEN 1 ELSE 0 END),0)::int failed,COALESCE(SUM(CASE WHEN UPPER(status)='REFUNDED' THEN 1 ELSE 0 END),0)::int refunded,COALESCE(SUM(CASE WHEN UPPER(status)='REFUNDED' THEN amount ELSE 0 END),0) AS \"refundedAmount\" FROM subscription_payments",[],db),
  rows<{period:string;users:number;schools:number}>("SELECT SUBSTRING(created_at::text,1,7) period,COUNT(*)::int users,COUNT(DISTINCT institution_id)::int schools FROM users WHERE role<>'SUPER_ADMIN' GROUP BY SUBSTRING(created_at::text,1,7) ORDER BY period DESC LIMIT 12",[],db),
  rows<{period:string;amount:number;subscriptions:number}>("SELECT period,SUM(amount) amount,SUM(subscriptions)::int subscriptions FROM (SELECT payment_date period,amount,0 subscriptions FROM subscription_payments WHERE status='SUCCESS' AND payment_date>=? AND payment_date<=? UNION ALL SELECT SUBSTRING(created_at::text,1,10) period,0 amount,1 subscriptions FROM subscriptions WHERE SUBSTRING(created_at::text,1,10)>=? AND SUBSTRING(created_at::text,1,10)<=?) x GROUP BY period ORDER BY period",[from,to,from,to],db),
  rows<Record<string,unknown>>("SELECT a.id,a.action,a.entity,a.entity_id AS \"entityId\",a.created_at::text AS \"createdAt\",u.name AS \"userName\",i.name AS \"schoolName\" FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN institutions i ON i.id=a.institution_id WHERE SUBSTRING(a.created_at::text,1,10)>=? AND SUBSTRING(a.created_at::text,1,10)<=? AND a.entity NOT IN ('Student','Fee','Payment','Salary','StaffAttendance','Timetable','ResultExamination','WhatsAppMessage') AND LOWER(a.action) NOT LIKE '%student%' AND LOWER(a.action) NOT LIKE '%fee%' AND LOWER(a.action) NOT LIKE '%salary%' AND LOWER(a.action) NOT LIKE '%attendance%' AND LOWER(a.action) NOT LIKE '%timetable%' AND LOWER(a.action) NOT LIKE '%marksheet%' ORDER BY a.created_at DESC LIMIT 8",[from,to],db),
  row<Record<string,number>>("SELECT (SELECT COUNT(*) FROM users WHERE role<>'SUPER_ADMIN' AND SUBSTRING(created_at::text,1,10)>=? AND SUBSTRING(created_at::text,1,10)<=?)::int \"newUsers\",(SELECT COUNT(*) FROM users WHERE role<>'SUPER_ADMIN' AND SUBSTRING(created_at::text,1,10)>=? AND SUBSTRING(created_at::text,1,10)<=?)::int \"previousUsers\",(SELECT COUNT(*) FROM institutions i WHERE SUBSTRING(i.created_at::text,1,10)>=? AND SUBSTRING(i.created_at::text,1,10)<=? AND NOT EXISTS(SELECT 1 FROM users owner WHERE owner.institution_id=i.id AND owner.role='SUPER_ADMIN'))::int \"newSchools\",(SELECT COUNT(*) FROM institutions i WHERE SUBSTRING(i.created_at::text,1,10)>=? AND SUBSTRING(i.created_at::text,1,10)<=? AND NOT EXISTS(SELECT 1 FROM users owner WHERE owner.institution_id=i.id AND owner.role='SUPER_ADMIN'))::int \"previousSchools\",(SELECT COUNT(*) FROM subscriptions WHERE SUBSTRING(created_at::text,1,10)>=? AND SUBSTRING(created_at::text,1,10)<=?)::int \"newSubscriptions\",(SELECT COUNT(*) FROM subscriptions WHERE SUBSTRING(created_at::text,1,10)>=? AND SUBSTRING(created_at::text,1,10)<=?)::int \"previousSubscriptions\"",[from,to,previousFrom,previousTo,from,to,previousFrom,previousTo,from,to,previousFrom,previousTo],db),
  rows<Record<string,unknown>>("SELECT i.id,i.name,i.status,i.created_at::text AS \"createdAt\",(SELECT COUNT(*) FROM students st WHERE st.institution_id=i.id AND st.status<>'Deleted')::int students,COALESCE(sp.name,'No plan') AS \"planName\",COALESCE(s.status,'NONE') AS \"subscriptionStatus\" FROM institutions i LEFT JOIN subscriptions s ON s.id=(SELECT s2.id FROM subscriptions s2 WHERE s2.institution_id=i.id ORDER BY s2.created_at DESC LIMIT 1) LEFT JOIN subscription_plans sp ON sp.id=s.plan_id WHERE NOT EXISTS(SELECT 1 FROM users owner WHERE owner.institution_id=i.id AND owner.role='SUPER_ADMIN') ORDER BY i.created_at DESC LIMIT 6",[],db),
  row<{totalStudents:number;totalTeachers:number;totalSchoolAdmins:number}>("SELECT (SELECT COUNT(*)::int FROM students WHERE status<>'Deleted') AS \"totalStudents\",(SELECT COUNT(*)::int FROM teachers WHERE status='Active') AS \"totalTeachers\",(SELECT COUNT(*)::int FROM users WHERE role='SCHOOL_ADMIN' AND status='Active') AS \"totalSchoolAdmins\"",[],db),
  row<{expiring7d:number;expiring15d:number;expiring30d:number}>("SELECT (SELECT COUNT(*)::int FROM subscriptions WHERE status='ACTIVE' AND expiry_date>? AND expiry_date<=?) AS \"expiring7d\",(SELECT COUNT(*)::int FROM subscriptions WHERE status='ACTIVE' AND expiry_date>? AND expiry_date<=?) AS \"expiring15d\",(SELECT COUNT(*)::int FROM subscriptions WHERE status='ACTIVE' AND expiry_date>? AND expiry_date<=?) AS \"expiring30d\"",[nowIso,in7dIso,nowIso,in15dIso,nowIso,in30dIso],db),
  row<{total:number}>("SELECT COALESCE(SUM(amount),0) total FROM subscription_payments WHERE status='SUCCESS'",[],db),
  row<{trial:number}>("SELECT COUNT(*)::int trial FROM institutions i WHERE NOT EXISTS(SELECT 1 FROM users owner WHERE owner.institution_id=i.id AND owner.role='SUPER_ADMIN') AND (i.status='Pending' OR EXISTS(SELECT 1 FROM subscriptions s WHERE s.institution_id=i.id AND (s.status='PENDING' OR s.payment_status<>'Paid')))",[],db),
  row<{revenue:number;active:number;pending:number;expired:number}>("SELECT COALESCE(SUM(CASE WHEN payment_status='Paid' AND razorpay_payment_id IS NOT NULL THEN amount_paid ELSE 0 END),0) revenue,COUNT(*) FILTER(WHERE status='ACTIVE' AND payment_status='Paid' AND expiry_date>CURRENT_TIMESTAMP)::int active,COUNT(*) FILTER(WHERE payment_status='Pending')::int pending,COUNT(*) FILTER(WHERE payment_status='Paid' AND expiry_date<=CURRENT_TIMESTAMP)::int expired FROM whatsapp_addon_subscriptions",[],db)
 ]);
 const weekStart=new Date(Date.now()-6*864e5).toISOString().slice(0,10),periodRevenue=await row<Record<string,number>>("SELECT COALESCE(SUM(CASE WHEN payment_date=? THEN amount ELSE 0 END),0) \"today\",COALESCE(SUM(CASE WHEN payment_date>=? THEN amount ELSE 0 END),0) \"week\",COALESCE(SUM(CASE WHEN SUBSTRING(payment_date,1,7)=? THEN amount ELSE 0 END),0) \"month\",COALESCE(SUM(CASE WHEN SUBSTRING(payment_date,1,4)=? THEN amount ELSE 0 END),0) \"year\" FROM subscription_payments WHERE status='SUCCESS'",[today,weekStart,month,year],db),totalRevenue=n(allTimeRevenue?.total),refundedAmount=n(paymentStates.refundedAmount),paymentAttempts=n(paymentStates.success)+n(paymentStates.pending)+n(paymentStates.failed)+n(paymentStates.refunded),schoolCount=n(schools.total);
 const change=(current:number,previous:number)=>previous?Math.round((current-previous)/previous*1000)/10:current?100:0;
 return{
  generatedAt:new Date().toISOString(),
  range:{from,to},
  users:{
   ...users,
   totalStudents:n(platformStats?.totalStudents),
   totalTeachers:n(platformStats?.totalTeachers),
   totalSchoolAdmins:n(platformStats?.totalSchoolAdmins),
   period:periodMetrics.newUsers,
   change:change(n(periodMetrics.newUsers),n(periodMetrics.previousUsers))
  },
  schools:{
   ...schools,
   paid:subs.paid,
   trial:n(trialSchoolsCount?.trial)||subs.trial,
   period:periodMetrics.newSchools,
   change:change(n(periodMetrics.newSchools),n(periodMetrics.previousSchools))
  },
  subscriptions:{
   ...subs,
   expiring7d:n(expiringStats?.expiring7d),
   expiring15d:n(expiringStats?.expiring15d),
   expiring30d:n(expiringStats?.expiring30d),
   expiringSoon:n(expiringStats?.expiring30d),
   period:periodMetrics.newSubscriptions,
   change:change(n(periodMetrics.newSubscriptions),n(periodMetrics.previousSubscriptions))
  },
  finance:{
   totalRevenue,
   subscriptionRevenue:totalRevenue,
   whatsappAddonRevenue:n(addonStats?.revenue),
   grossPlatformRevenue:totalRevenue+n(addonStats?.revenue),
   activeWhatsAppAddons:n(addonStats?.active),
   pendingWhatsAppAddons:n(addonStats?.pending),
   expiredWhatsAppAddons:n(addonStats?.expired),
   periodRevenue:n(subscriptionRevenue.total),
   refundedAmount,
   totalPayments:paymentAttempts,
   successful:paymentStates.success,
   pending:paymentStates.pending,
   failed:paymentStates.failed,
   refunded:paymentStates.refunded,
   paymentSuccessRate:paymentAttempts?Math.round(n(paymentStates.success)/paymentAttempts*1000)/10:0,
   averageRevenuePerSchool:schoolCount?Math.round(totalRevenue/schoolCount):0,
   subscriptionRate:schoolCount?Math.round(n(subs.paid)/schoolCount*1000)/10:0,
   todayRevenue:n(periodRevenue.today),
   weekRevenue:n(periodRevenue.week),
   monthRevenue:n(periodRevenue.month),
   yearRevenue:n(periodRevenue.year)
  },
  systemHealth:{percentage:100,status:"All systems operational"},
  growth:growth.reverse(),
  revenueTrend,
  recent,
  recentSchools
 };
}

export async function adminUsers(filters:AdminRange={}){const db=await ready(),where=["1=1"],args:unknown[]=[];if(filters.search){where.push("(u.name ILIKE ? OR u.email ILIKE ? OR i.name ILIKE ?)");const q=`%${filters.search}%`;args.push(q,q,q)}if(filters.status){where.push("u.status=?");args.push(filters.status)}if(filters.school){where.push("u.institution_id=?");args.push(filters.school)}const limit=Math.min(filters.limit||50,100),offset=Math.max(filters.offset||0,0);const total=(await row<{count:number}>(`SELECT COUNT(*)::int count FROM users u JOIN institutions i ON i.id=u.institution_id WHERE ${where.join(" AND ")}`,args,db)).count,items=await rows(`SELECT u.id,u.name,u.email,u.role,u.status,u.created_at::text AS \"createdAt\",u.last_login_at::text AS \"lastLogin\",i.id AS \"schoolId\",i.name AS \"schoolName\",COALESCE(sp.name,'No plan') AS \"planName\",COALESCE(s.status,'NONE') AS \"paymentStatus\" FROM users u JOIN institutions i ON i.id=u.institution_id LEFT JOIN subscriptions s ON s.id=(SELECT s2.id FROM subscriptions s2 WHERE s2.institution_id=i.id ORDER BY s2.created_at DESC LIMIT 1) LEFT JOIN subscription_plans sp ON sp.id=s.plan_id WHERE ${where.join(" AND ")} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,[...args,limit,offset],db);return{items,total,limit,offset}}
export async function adminSchools(filters:AdminRange={}){
 const db=await ready(),where=["NOT EXISTS(SELECT 1 FROM users owner WHERE owner.institution_id=i.id AND owner.role='SUPER_ADMIN')"],args:unknown[]=[];
 if(filters.search){
  where.push("(i.name ILIKE ? OR i.id ILIKE ? OR COALESCE(a.email,'') ILIKE ? OR COALESCE(st.school_email,'') ILIKE ?)");
  const q=`%${filters.search}%`;
  args.push(q,q,q,q);
 }
 if(filters.status){
  if(filters.status==="Trial"){
   where.push("(s.status='PENDING' OR sp.price_per_student=0)");
  }else if(filters.status==="Expired"){
   where.push("(s.status='EXPIRED' OR s.expiry_date <= CURRENT_TIMESTAMP)");
  }else{
   where.push("i.status=?");
   args.push(filters.status);
  }
 }
 const limit=Math.min(filters.limit||50,100),offset=Math.max(filters.offset||0,0);
 const total=(await row<{count:number}>(`SELECT COUNT(*)::int count FROM institutions i LEFT JOIN settings st ON st.institution_id=i.id LEFT JOIN users a ON a.id=(SELECT u.id FROM users u WHERE u.institution_id=i.id AND u.role='SCHOOL_ADMIN' ORDER BY u.created_at LIMIT 1) LEFT JOIN subscriptions s ON s.id=(SELECT s2.id FROM subscriptions s2 WHERE s2.institution_id=i.id ORDER BY s2.created_at DESC LIMIT 1) LEFT JOIN subscription_plans sp ON sp.id=s.plan_id WHERE ${where.join(" AND ")}`,args,db)).count;
 const items=await rows(`SELECT i.id,i.name,i.status,i.created_at::text AS \"createdAt\",
  a.name AS \"adminName\",
  COALESCE(NULLIF(st.school_email,''),a.email,'') AS email,
  COALESCE(st.school_phone, '') AS \"contactNumber\",
  st.school_address AS \"schoolAddress\",
  (SELECT COUNT(*) FROM students st_c WHERE st_c.institution_id=i.id AND st_c.status<>'Deleted')::int AS students,
  (SELECT COUNT(*) FROM teachers t WHERE t.institution_id=i.id AND t.status='Active')::int AS teachers,
  (SELECT COUNT(*) FROM classes c WHERE c.institution_id=i.id AND c.status='Active')::int AS classes,
  COALESCE(sp.name,'No plan') AS \"planName\",
  COALESCE(s.status,'NONE') AS \"subscriptionStatus\",
  COALESCE(s.amount_paid, 0) AS \"subscriptionAmount\",
  s.activation_date::text AS \"subscriptionStart\",
  s.expiry_date::text AS \"subscriptionEnd\",
  s.id AS \"subscriptionId\",
  COALESCE((SELECT SUM(x.amount) FROM subscription_payments x WHERE x.institution_id=i.id AND x.status='SUCCESS'),0) AS revenue
  FROM institutions i
  LEFT JOIN settings st ON st.institution_id=i.id
  LEFT JOIN users a ON a.id=(SELECT u.id FROM users u WHERE u.institution_id=i.id AND u.role='SCHOOL_ADMIN' ORDER BY u.created_at LIMIT 1)
  LEFT JOIN subscriptions s ON s.id=(SELECT s2.id FROM subscriptions s2 WHERE s2.institution_id=i.id ORDER BY s2.created_at DESC LIMIT 1)
  LEFT JOIN subscription_plans sp ON sp.id=s.plan_id
  WHERE ${where.join(" AND ")}
  ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,[...args,limit,offset],db);
 return{items,total,limit,offset};
}
export async function adminTransactions(filters:AdminRange={}){const db=await ready(),where=["1=1"],args:unknown[]=[];if(filters.search){where.push("(p.id ILIKE ? OR p.razorpay_payment_id ILIKE ? OR p.plan ILIKE ? OR i.name ILIKE ? OR i.id ILIKE ?)");const q=`%${filters.search}%`;args.push(q,q,q,q,q)}if(filters.status){where.push("UPPER(p.status)=?");args.push(filters.status.toUpperCase())}if(filters.school){where.push("p.institution_id=?");args.push(filters.school)}if(filters.from){where.push("p.payment_date>=?");args.push(filters.from)}if(filters.to){where.push("p.payment_date<=?");args.push(filters.to)}const limit=Math.min(filters.limit||50,100),offset=Math.max(filters.offset||0,0);const total=(await row<{count:number}>(`SELECT COUNT(*)::int count FROM subscription_payments p JOIN institutions i ON i.id=p.institution_id WHERE ${where.join(" AND ")}`,args,db)).count,items=await rows(`SELECT p.id,p.razorpay_payment_id AS \"transactionId\",p.razorpay_payment_id AS \"referenceId\",i.id AS \"schoolId\",i.name AS \"schoolName\",p.plan AS subscription,p.student_capacity AS \"studentCapacity\",p.amount,'INR' AS currency,'Razorpay' AS method,UPPER(p.status) AS status,p.payment_date AS \"paymentDate\",p.starts_at::text AS \"startsAt\",p.ends_at::text AS \"endsAt\" FROM subscription_payments p JOIN institutions i ON i.id=p.institution_id WHERE ${where.join(" AND ")} ORDER BY p.payment_date DESC,p.created_at DESC LIMIT ? OFFSET ?`,[...args,limit,offset],db);return{items,total,limit,offset}}
export async function adminSubscriptions(){
 const items = await rows<{
  id:string;schoolId:string;schoolName:string;planName:string;studentCapacity:number;
  studentCountAtPurchase:number;activeStudents:number;pricingModel:string;
  pricePerStudent:number;amountPaid:number;currency:string;paymentStatus:string;
  paymentReference:string;status:string;activationDate:string|null;expiryDate:string|null;
  renewalDate:string|null;createdAt:string;
 }>(`SELECT s.id,i.id AS \"schoolId\",i.name AS \"schoolName\",sp.name AS \"planName\",
  s.student_capacity AS \"studentCapacity\",
  COALESCE(s.student_count_at_purchase,s.student_capacity) AS \"studentCountAtPurchase\",
  (SELECT COUNT(*) FROM students st WHERE st.institution_id=i.id AND st.status<>'Deleted')::int AS \"activeStudents\",
  s.pricing_model AS \"pricingModel\",
  s.price_per_student AS \"pricePerStudent\",
  s.amount_paid AS \"amountPaid\",
  s.currency,
  s.payment_status AS \"paymentStatus\",
  s.razorpay_payment_id AS \"paymentReference\",
  CASE
    WHEN s.status IN ('CANCELLED','SUSPENDED','FAILED') THEN s.status
    WHEN s.payment_status='Failed' THEN 'PAYMENT FAILED'
    WHEN s.payment_status<>'Paid' THEN 'PENDING'
    WHEN s.expiry_date<=CURRENT_TIMESTAMP THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END AS status,
  s.activation_date::text AS \"activationDate\",
  s.expiry_date::text AS \"expiryDate\",
  s.renewal_date::text AS \"renewalDate\",
  s.created_at::text AS \"createdAt\"
  FROM subscriptions s
  JOIN institutions i ON i.id=s.institution_id
  JOIN subscription_plans sp ON sp.id=s.plan_id
  ORDER BY s.created_at DESC`,[],await ready());

 const now = Date.now();
 return items.map(s => {
  const expiryTime = s.expiryDate ? new Date(s.expiryDate).getTime() : 0;
  const daysUntilExpiry = expiryTime ? Math.round((expiryTime - now) / 864e5) : 0;
  let expiryWindow = "healthy";
  if (!expiryTime || expiryTime <= now) expiryWindow = "expired";
  else if (daysUntilExpiry <= 7) expiryWindow = "expiring_7d";
  else if (daysUntilExpiry <= 15) expiryWindow = "expiring_15d";
  else if (daysUntilExpiry <= 30) expiryWindow = "expiring_30d";
  return { ...s, daysUntilExpiry, expiryWindow };
 });
}
export async function adminManageSubscription(adminId:string,id:string,action:"extend"|"activate"|"cancel"|"suspend",days=0){
 const db=await ready(),item=await row<{institutionId:string;expiryDate:string|null}>(`SELECT institution_id AS "institutionId",expiry_date::text AS "expiryDate" FROM subscriptions WHERE id=?`,[id],db);
 if(!item)throw new Error("Subscription not found");
 if(action==="extend"||action==="activate"){
  const extensionDays = days > 0 ? days : 365;
  if(!Number.isInteger(extensionDays)||extensionDays<1||extensionDays>730)throw new Error("Extension must be between 1 and 730 days");
  const base=item.expiryDate&&new Date(item.expiryDate)>new Date()?new Date(item.expiryDate):new Date(),
   expiry=new Date(base.getTime()+extensionDays*864e5);
  await run("UPDATE subscriptions SET status='ACTIVE',payment_status='Paid',expiry_date=?,renewal_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",[expiry,expiry,id],db);
  await run("UPDATE institutions SET status='Active',subscription_start_date=COALESCE(subscription_start_date,CURRENT_TIMESTAMP),subscription_end_date=? WHERE id=?",[expiry,item.institutionId],db);
  await audit(item.institutionId,adminId,action==="activate"?"Subscription Activated":"Subscription Extended","Subscription",id,{days:extensionDays,expiryDate:expiry.toISOString()},db);
 }else{
  await run("UPDATE subscriptions SET status=?,auto_renew=FALSE,updated_at=CURRENT_TIMESTAMP WHERE id=?",[action==="cancel"?"CANCELLED":"SUSPENDED",id],db);
  if(action==="suspend")await run("UPDATE institutions SET status='Suspended' WHERE id=?",[item.institutionId],db);
  await audit(item.institutionId,adminId,action==="cancel"?"Subscription Cancelled":"Subscription Suspended","Subscription",id,{},db);
 }
 return true;
}
export async function adminAuditLogs(limit=100){return rows(`SELECT a.id,a.action,a.entity,a.entity_id AS \"entityId\",a.details,a.created_at::text AS \"createdAt\",u.name AS \"userName\",u.email,i.name AS \"schoolName\" FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN institutions i ON i.id=a.institution_id ORDER BY a.created_at DESC LIMIT ?`,[Math.min(limit,500)],await ready())}
export async function adminSetUserStatus(adminId:string,id:string,status:"Active"|"Inactive"|"Suspended"){if(adminId===id)throw new Error("The private admin account cannot be disabled");const db=await ready(),target=await row<{institutionId:string}>("SELECT institution_id AS \"institutionId\" FROM users WHERE id=?",[id],db);if(!target)throw new Error("User not found");await run("UPDATE users SET status=? WHERE id=?",[status,id],db);await audit(target.institutionId,adminId,`User ${status}`,"User",id,{status},db)}
export async function adminSetSchoolStatus(adminId:string,id:string,status:"Active"|"Inactive"|"Suspended",reason:string){const normalizedReason=reason.trim();if(normalizedReason.length<5||normalizedReason.length>500)throw new Error("A reason of 5–500 characters is required for school status changes.");const db=await ready(),target=await row<{id:string;status:string}>("SELECT id,status FROM institutions WHERE id=?",[id],db);if(!target)throw new Error("School not found");await run("UPDATE institutions SET status=? WHERE id=?",[status,id],db);await audit(id,adminId,`School ${status}`,"Institution",id,{before:{status:target.status},after:{status},reason:normalizedReason},db)}
export async function getAdminSettings(){const db=await ready();await run("INSERT INTO admin_settings(id)VALUES('global') ON CONFLICT(id) DO NOTHING",[],db);return row<Record<string,unknown>>('SELECT application_name AS "applicationName",support_email AS "supportEmail",currency,timezone,date_format AS "dateFormat",session_timeout_minutes AS "sessionTimeoutMinutes",subscription_warning_days AS "subscriptionWarningDays",subscription_notifications_enabled AS "subscriptionNotificationsEnabled",in_app_notifications_enabled AS "inAppNotificationsEnabled",email_notifications_enabled AS "emailNotificationsEnabled",subscription_grace_days AS "subscriptionGraceDays",updated_at::text AS "updatedAt" FROM admin_settings WHERE id=\'global\'',[],db)}
export async function saveAdminSettings(adminId:string,input:{applicationName:string;supportEmail:string;currency:string;timezone:string;dateFormat:string;sessionTimeoutMinutes:number;subscriptionWarningDays:string;subscriptionNotificationsEnabled:boolean;inAppNotificationsEnabled:boolean;emailNotificationsEnabled:boolean;subscriptionGraceDays:number}){const db=await ready();await run("INSERT INTO admin_settings(id,application_name,support_email,currency,timezone,date_format,session_timeout_minutes,subscription_warning_days,subscription_notifications_enabled,in_app_notifications_enabled,email_notifications_enabled,subscription_grace_days,updated_by)VALUES('global',?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET application_name=EXCLUDED.application_name,support_email=EXCLUDED.support_email,currency=EXCLUDED.currency,timezone=EXCLUDED.timezone,date_format=EXCLUDED.date_format,session_timeout_minutes=EXCLUDED.session_timeout_minutes,subscription_warning_days=EXCLUDED.subscription_warning_days,subscription_notifications_enabled=EXCLUDED.subscription_notifications_enabled,in_app_notifications_enabled=EXCLUDED.in_app_notifications_enabled,email_notifications_enabled=EXCLUDED.email_notifications_enabled,subscription_grace_days=EXCLUDED.subscription_grace_days,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP",[input.applicationName,input.supportEmail,input.currency,input.timezone,input.dateFormat,input.sessionTimeoutMinutes,input.subscriptionWarningDays,input.subscriptionNotificationsEnabled,input.inAppNotificationsEnabled,input.emailNotificationsEnabled,input.subscriptionGraceDays,adminId],db);const admin=await row<{institutionId:string}>("SELECT institution_id AS \"institutionId\" FROM users WHERE id=?",[adminId],db);if(admin)await audit(admin.institutionId,adminId,"Admin Settings Updated","AdminSettings","global",{subscriptionWarningDays:input.subscriptionWarningDays,subscriptionNotificationsEnabled:input.subscriptionNotificationsEnabled},db);return getAdminSettings()}

export type StaffPerson={key:string;name:string;department:string;designation:string;kind:"teacher"|"user"};
export type StaffSettings={workStartTime:string;workEndTime:string;lateAfterTime:string;breakMinutes:number;workingDays:number[];timezone:string;allowSelfCheckin:boolean;correctionRequiresApproval:boolean};
export type StaffAttendanceEntry={id:string;staffKey:string;date:string;status:StaffAttendanceStatus;checkInAt:string|null;checkOutAt:string|null;breakMinutes:number;totalWorkMinutes:number|null;remarks:string;name:string;department:string;designation:string};
const staffSettingsSelect='SELECT work_start_time AS "workStartTime",work_end_time AS "workEndTime",late_after_time AS "lateAfterTime",break_minutes AS "breakMinutes",working_days AS "workingDays",timezone,allow_self_checkin AS "allowSelfCheckin",correction_requires_approval AS "correctionRequiresApproval" FROM staff_attendance_settings WHERE institution_id=?';
const staffAttendanceSelect='SELECT id,staff_key AS "staffKey",attendance_date AS date,status,check_in_at::text AS "checkInAt",check_out_at::text AS "checkOutAt",break_minutes AS "breakMinutes",total_work_minutes AS "totalWorkMinutes",remarks FROM staff_attendance WHERE institution_id=?';

export async function listStaffPeople(institutionId:string):Promise<StaffPerson[]>{
 const db=await ready();
 const [teachers,users]=await Promise.all([
  rows<{id:string;name:string;department:string;designation:string}>("SELECT id,name,department,subject AS designation FROM teachers WHERE institution_id=? AND status='Active' ORDER BY name",[institutionId],db),
  rows<{id:string;name:string;role:string}>("SELECT id,name,role FROM users WHERE institution_id=? AND status='Active' AND role IN ('STAFF','ACCOUNTANT','LIBRARIAN','TEACHER','SCHOOL_ADMIN') ORDER BY name",[institutionId],db),
 ]);
 const roleDepartment:Record<string,string>={STAFF:'Support',ACCOUNTANT:'Office',LIBRARIAN:'Library',TEACHER:'Teaching',SCHOOL_ADMIN:'Office'};
 return [...teachers.map(item=>({key:`teacher:${item.id}`,name:item.name,department:item.department||'Teaching',designation:item.designation||'Teacher',kind:'teacher' as const})),...users.map(item=>({key:`user:${item.id}`,name:item.name,department:roleDepartment[item.role]||'Staff',designation:item.role.replaceAll('_',' '),kind:'user' as const}))].sort((a,b)=>a.name.localeCompare(b.name));
}

export async function getStaffAttendanceSettings(institutionId:string):Promise<StaffSettings>{
 const db=await ready();
 await run('INSERT INTO staff_attendance_settings(institution_id)VALUES(?) ON CONFLICT(institution_id) DO NOTHING',[institutionId],db);
 const item=await row<Omit<StaffSettings,'workingDays'>&{workingDays:string}>(staffSettingsSelect,[institutionId],db);
 return {...item,breakMinutes:Number(item.breakMinutes),workingDays:String(item.workingDays).split(',').map(Number),allowSelfCheckin:Boolean(item.allowSelfCheckin),correctionRequiresApproval:Boolean(item.correctionRequiresApproval)};
}

export async function saveStaffAttendanceSettings(institutionId:string,userId:string,input:StaffSettings){
 validTimezone(input.timezone);validTime(input.workStartTime);validTime(input.workEndTime);validTime(input.lateAfterTime);
 if(input.breakMinutes<0||input.breakMinutes>240||!input.workingDays.length||input.workingDays.some(day=>!Number.isInteger(day)||day<0||day>6))throw new Error('Invalid attendance settings.');
 const db=await ready();
 await run('INSERT INTO staff_attendance_settings(institution_id,work_start_time,work_end_time,late_after_time,break_minutes,working_days,timezone,allow_self_checkin,correction_requires_approval)VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(institution_id) DO UPDATE SET work_start_time=EXCLUDED.work_start_time,work_end_time=EXCLUDED.work_end_time,late_after_time=EXCLUDED.late_after_time,break_minutes=EXCLUDED.break_minutes,working_days=EXCLUDED.working_days,timezone=EXCLUDED.timezone,allow_self_checkin=EXCLUDED.allow_self_checkin,correction_requires_approval=EXCLUDED.correction_requires_approval,updated_at=CURRENT_TIMESTAMP',[institutionId,input.workStartTime,input.workEndTime,input.lateAfterTime,input.breakMinutes,[...new Set(input.workingDays)].sort().join(','),input.timezone,input.allowSelfCheckin,input.correctionRequiresApproval],db);
 await audit(institutionId,userId,'Staff Attendance Settings Updated','StaffAttendanceSettings',institutionId,{workStartTime:input.workStartTime,lateAfterTime:input.lateAfterTime,breakMinutes:input.breakMinutes,timezone:input.timezone},db);
 return getStaffAttendanceSettings(institutionId);
}

export type StaffAttendanceInput={staffKey:string;date:string;status:StaffAttendanceStatus;checkInTime?:string;checkOutTime?:string;overnight?:boolean;remarks:string;breakMinutes?:number};
function staffTimes(input:StaffAttendanceInput,settings:StaffSettings){
 const active=['Present','Late','Half Day','Work From Home'].includes(input.status);
 if(!active&&(input.checkInTime||input.checkOutTime))throw new Error('This status cannot include check-in or checkout times.');
 if(input.checkOutTime&&!input.checkInTime)throw new Error('Check-in is required before checkout.');
 const inAt=input.checkInTime?zonedInstant(input.date,input.checkInTime,settings.timezone):null;
 const outDate=input.overnight&&input.checkOutTime?nextDate(input.date):input.date;
 const outAt=input.checkOutTime?zonedInstant(outDate,input.checkOutTime,settings.timezone):null;
 if(inAt&&outAt&&!input.overnight&&outAt.getTime()<inAt.getTime())throw new Error('Checkout cannot be earlier than check-in without an overnight shift.');
 const breakMinutes=input.breakMinutes??settings.breakMinutes;
 if(!Number.isInteger(breakMinutes)||breakMinutes<0||breakMinutes>240)throw new Error('Break must be between 0 and 240 minutes.');
 return {inAt:inAt?.toISOString()||null,outAt:outAt?.toISOString()||null,breakMinutes,totalWorkMinutes:workingMinutes(inAt,outAt,breakMinutes)};
}

async function staffAttendanceRow(institutionId:string,id:string,db:Sql){return row<Omit<StaffAttendanceEntry,'name'|'department'|'designation'>>(`${staffAttendanceSelect} AND id=?`,[institutionId,id],db)}
export async function getStaffAttendanceRecord(institutionId:string,id:string){return staffAttendanceRow(institutionId,id,await ready())}
export async function saveStaffAttendance(institutionId:string,userId:string,input:StaffAttendanceInput,id?:string){
 validDate(input.date);
 const people=await listStaffPeople(institutionId),person=people.find(item=>item.key===input.staffKey);
 if(!person)throw new Error('Select a staff member from your school.');
 const settings=await getStaffAttendanceSettings(institutionId),times=staffTimes(input,settings),db=await ready();
 return db.begin(async tx=>{
  if(id){const previous=await staffAttendanceRow(institutionId,id,tx);if(!previous)throw new Error('Attendance record not found.');if(previous.staffKey!==input.staffKey)throw new Error('Staff member cannot be changed on an existing record.');
   await run('UPDATE staff_attendance SET attendance_date=?,status=?,check_in_at=?,check_out_at=?,break_minutes=?,total_work_minutes=?,remarks=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[input.date,input.status,times.inAt,times.outAt,times.breakMinutes,times.totalWorkMinutes,input.remarks,userId,id,institutionId],tx);
   await audit(institutionId,userId,'Staff Attendance Updated','StaffAttendance',id,{date:input.date,staffKey:input.staffKey,status:input.status,previousStatus:previous.status},tx);
   return (await staffAttendanceRow(institutionId,id,tx))!;
  }
  const createdId=randomUUID(),teacherId=person.kind==='teacher'?person.key.slice(8):null,staffUserId=person.kind==='user'?person.key.slice(5):null;
  await run('INSERT INTO staff_attendance(id,institution_id,staff_key,teacher_id,user_id,attendance_date,status,check_in_at,check_out_at,break_minutes,total_work_minutes,remarks,created_by,updated_by)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[createdId,institutionId,input.staffKey,teacherId,staffUserId,input.date,input.status,times.inAt,times.outAt,times.breakMinutes,times.totalWorkMinutes,input.remarks,userId,userId],tx);
  await audit(institutionId,userId,'Staff Attendance Marked','StaffAttendance',createdId,{date:input.date,staffKey:input.staffKey,status:input.status},tx);
  return (await staffAttendanceRow(institutionId,createdId,tx))!;
 });
}

export async function staffClockAction(institutionId:string,userId:string,staffKey:string,action:'checkin'|'checkout'){
 const person=(await listStaffPeople(institutionId)).find(item=>item.key===staffKey);if(!person)throw new Error('Select a staff member from your school.');
 const settings=await getStaffAttendanceSettings(institutionId),now=new Date(),local=schoolParts(now,settings.timezone),db=await ready();
 return db.begin(async tx=>{
  const today=await row<Omit<StaffAttendanceEntry,'name'|'department'|'designation'>>(`${staffAttendanceSelect} AND staff_key=? AND attendance_date=?`,[institutionId,staffKey,local.date],tx);
  if(action==='checkin'){
   if(today)throw new Error(today.checkInAt?'Staff member is already checked in or marked today.':'Attendance is already marked for this date.');
   const prior=await row<Omit<StaffAttendanceEntry,'name'|'department'|'designation'>>(`${staffAttendanceSelect} AND staff_key=? AND attendance_date=?`,[institutionId,staffKey,previousDate(local.date)],tx);
   if(prior?.checkInAt&&!prior.checkOutAt)throw new Error('Staff member has an open check-in from yesterday.');
   const id=randomUUID(),teacherId=person.kind==='teacher'?staffKey.slice(8):null,staffUserId=person.kind==='user'?staffKey.slice(5):null,status=local.time>settings.lateAfterTime?'Late':'Present';
   await run('INSERT INTO staff_attendance(id,institution_id,staff_key,teacher_id,user_id,attendance_date,status,check_in_at,break_minutes,remarks,created_by,updated_by)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[id,institutionId,staffKey,teacherId,staffUserId,local.date,status,now.toISOString(),settings.breakMinutes,'',userId,userId],tx);
   await audit(institutionId,userId,'Staff Checked In','StaffAttendance',id,{date:local.date,staffKey,status},tx);
   return (await staffAttendanceRow(institutionId,id,tx))!;
  }
  const prior=await row<Omit<StaffAttendanceEntry,'name'|'department'|'designation'>>(`${staffAttendanceSelect} AND staff_key=? AND attendance_date=?`,[institutionId,staffKey,previousDate(local.date)],tx);
  const existing=today?.checkInAt&&!today.checkOutAt?today:prior?.checkInAt&&!prior.checkOutAt?prior:today;
  if(!existing||!existing.checkInAt)throw new Error('No active check-in found for today or yesterday.');
  if(existing.checkOutAt)throw new Error('Staff member has already checked out.');
  const total=workingMinutes(new Date(existing.checkInAt),now,existing.breakMinutes);
  await run('UPDATE staff_attendance SET check_out_at=?,total_work_minutes=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[now.toISOString(),total,userId,existing.id,institutionId],tx);
  await audit(institutionId,userId,'Staff Checked Out','StaffAttendance',existing.id,{date:existing.date,staffKey,totalWorkMinutes:total},tx);
  return (await staffAttendanceRow(institutionId,existing.id,tx))!;
 });
}

export async function deleteStaffAttendance(institutionId:string,userId:string,id:string){const db=await ready(),item=await staffAttendanceRow(institutionId,id,db);if(!item)return false;await db.begin(async tx=>{await run('DELETE FROM staff_attendance WHERE id=? AND institution_id=?',[id,institutionId],tx);await audit(institutionId,userId,'Staff Attendance Deleted','StaffAttendance',id,{date:item.date,staffKey:item.staffKey,status:item.status},tx)});return true}

export async function staffAttendanceData(institutionId:string,date:string,month:string,staffKey?:string){
 validDate(date);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Select a valid month.');
 const db=await ready(),[people,settings,dailyRaw,monthlyRaw]=await Promise.all([listStaffPeople(institutionId),getStaffAttendanceSettings(institutionId),rows<Omit<StaffAttendanceEntry,'name'|'department'|'designation'>>(`${staffAttendanceSelect} AND attendance_date=?`,[institutionId,date],db),rows<Omit<StaffAttendanceEntry,'name'|'department'|'designation'>>(`${staffAttendanceSelect} AND attendance_date>=? AND attendance_date<?`,[institutionId,`${month}-01`,month==='9999-12'?'9999-12-31':nextDate(`${month}-${String(new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate()).padStart(2,'0')}`)],db)]);
 const selected=staffKey?people.filter(person=>person.key===staffKey):people;
 const daily=selected.map(person=>{const record=dailyRaw.find(item=>item.staffKey===person.key);return {...person,id:record?.id||null,date,status:record?.status||'Not Marked',checkInAt:record?.checkInAt||null,checkOutAt:record?.checkOutAt||null,breakMinutes:record?.breakMinutes||0,totalWorkMinutes:record?.totalWorkMinutes??null,remarks:record?.remarks||''}});
 const summary={totalStaff:selected.length,presentToday:daily.filter(item=>item.status==='Present').length,absentToday:daily.filter(item=>item.status==='Absent').length,lateToday:daily.filter(item=>item.status==='Late').length,onLeave:daily.filter(item=>item.status==='On Leave').length,notMarked:daily.filter(item=>item.status==='Not Marked').length};
 const monthly=selected.map(person=>{const items=monthlyRaw.filter(item=>item.staffKey===person.key);const count=(status:string)=>items.filter(item=>item.status===status).length;return {...person,present:count('Present')+count('Work From Home'),absent:count('Absent'),late:count('Late'),halfDay:count('Half Day'),leave:count('On Leave'),holiday:count('Holiday'),totalWorkMinutes:items.reduce((sum,item)=>sum+(item.totalWorkMinutes||0),0)}});
 return {date,month,settings,people,daily,summary,monthly};
}

export type TimetableEntryRecord={id:string;className:string;section:string;academicYear:string;weekday:number;startTime:string;endTime:string;subject:string;teacherId:string|null;teacherName:string;generated:boolean;status:"Draft"|"Published"|"Archived"};
export async function listTimetableEntries(institutionId:string,className:string,section:string,academicYear:string){
  const db=await ready();
  await ensureTimetableSchema(db).catch(() => {});
  try {
    return await rows<TimetableEntryRecord>(
      'SELECT t.id,t.class_name AS "className",t.section,t.academic_year AS "academicYear",t.weekday,t.start_time AS "startTime",t.end_time AS "endTime",t.subject,t.teacher_id AS "teacherId",COALESCE(te.name,\'Unassigned\') AS "teacherName",COALESCE(t.generated, FALSE) AS "generated",COALESCE(t.status, \'Published\') AS "status" FROM timetable_entries t LEFT JOIN teachers te ON te.id=t.teacher_id AND te.institution_id=t.institution_id WHERE t.institution_id=? AND t.class_name=? AND t.section=? AND t.academic_year=? AND COALESCE(t.status, \'Published\')<>\'Archived\' ORDER BY t.weekday,t.start_time',
      [institutionId,className,section,academicYear],
      db
    );
  } catch {
    return await rows<TimetableEntryRecord>(
      'SELECT t.id,t.class_name AS "className",t.section,t.academic_year AS "academicYear",t.weekday,t.start_time AS "startTime",t.end_time AS "endTime",t.subject,t.teacher_id AS "teacherId",COALESCE(te.name,\'Unassigned\') AS "teacherName",FALSE AS "generated",\'Published\' AS "status" FROM timetable_entries t LEFT JOIN teachers te ON te.id=t.teacher_id AND te.institution_id=t.institution_id WHERE t.institution_id=? AND t.class_name=? AND t.section=? AND t.academic_year=? ORDER BY t.weekday,t.start_time',
      [institutionId,className,section,academicYear],
      db
    ).catch(() => []);
  }
}
export async function updateTimetableEntry(institutionId:string,userId:string,id:string,input:{className:string;section:string;academicYear:string;weekday:number;startTime:string;endTime:string;subject:string;teacherId?:string|null}){
 const db=await ready();await ensureTimetableSchema(db);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime))throw new Error("Enter valid 24-hour start and end times.");timeMinutes(input.startTime);timeMinutes(input.endTime);if(timeMinutes(input.endTime)<=timeMinutes(input.startTime))throw new Error("End time must be after start time.");if(input.weekday<1||input.weekday>6)throw new Error("Choose Monday through Saturday.");
 const target=await row<{count:number}>("SELECT COUNT(*)::int count FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id WHERE c.institution_id=? AND c.name=? AND c.status='Active' AND s.name=? AND s.status='Active'",[institutionId,input.className,input.section],db);if(!target.count)throw new Error("Choose a configured class and section.");
 if(input.teacherId&&!await row<{id:string}>("SELECT id FROM teachers WHERE id=? AND institution_id=? AND status='Active'",[input.teacherId,institutionId],db))throw new Error("Choose an active teacher from this school.");
 const conflict=await row<{id:string}>("SELECT id FROM timetable_entries WHERE institution_id=? AND academic_year=? AND weekday=? AND status<>'Archived' AND id<>? AND ((class_name=? AND section=?) OR (? IS NOT NULL AND teacher_id=?)) AND start_time<? AND end_time>? LIMIT 1",[institutionId,input.academicYear,input.weekday,id,input.className,input.section,input.teacherId||null,input.teacherId||null,input.endTime,input.startTime],db);if(conflict)throw new Error("This period conflicts with another class or teacher entry.");
 const current=await row<{className:string;section:string;academicYear:string}>("SELECT class_name AS \"className\",section,academic_year AS \"academicYear\" FROM timetable_entries WHERE id=? AND institution_id=? AND status<>'Archived'",[id,institutionId],db);if(!current)throw new Error("Timetable entry not found.");
 await db.begin(async tx=>{await run("UPDATE timetable_entries SET status='Draft' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",[institutionId,current.className,current.section,current.academicYear],tx);await run("UPDATE timetable_entries SET status='Draft' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",[institutionId,input.className,input.section,input.academicYear],tx);const changed=await run("UPDATE timetable_entries SET class_name=?,section=?,academic_year=?,weekday=?,start_time=?,end_time=?,subject=?,teacher_id=?,generated=FALSE,status='Draft' WHERE id=? AND institution_id=?",[input.className,input.section,input.academicYear,input.weekday,input.startTime,input.endTime,input.subject,input.teacherId||null,id,institutionId],tx);if(!changed)throw new Error("Timetable entry not found.");await audit(institutionId,userId,"Timetable Entry Updated","Timetable",id,input,tx)});return listTimetableEntries(institutionId,input.className,input.section,input.academicYear);
}
export async function createTimetableEntry(institutionId:string,userId:string,input:{className:string;section:string;academicYear:string;weekday:number;startTime:string;endTime:string;subject:string;teacherId?:string|null}){
 const db=await ready();await ensureTimetableSchema(db);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime))throw new Error("Enter valid 24-hour start and end times.");timeMinutes(input.startTime);timeMinutes(input.endTime);if(timeMinutes(input.endTime)<=timeMinutes(input.startTime))throw new Error("End time must be after start time.");if(input.weekday<1||input.weekday>6)throw new Error("Choose Monday through Saturday.");
 const target=await row<{count:number}>("SELECT COUNT(*)::int count FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id WHERE c.institution_id=? AND c.name=? AND c.status='Active' AND s.name=? AND s.status='Active'",[institutionId,input.className,input.section],db);if(!target.count)throw new Error("Choose a configured class and section.");
 if(input.teacherId&&!await row<{id:string}>("SELECT id FROM teachers WHERE id=? AND institution_id=? AND status='Active'",[input.teacherId,institutionId],db))throw new Error("Choose an active teacher from this school.");
 const conflict=await row<{id:string}>("SELECT id FROM timetable_entries WHERE institution_id=? AND academic_year=? AND weekday=? AND status<>'Archived' AND ((class_name=? AND section=?) OR (? IS NOT NULL AND teacher_id=?)) AND start_time<? AND end_time>? LIMIT 1",[institutionId,input.academicYear,input.weekday,input.className,input.section,input.teacherId||null,input.teacherId||null,input.endTime,input.startTime],db);if(conflict)throw new Error("This period conflicts with another class or teacher entry.");
 const id=randomUUID();await db.begin(async tx=>{await run("UPDATE timetable_entries SET status='Draft' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",[institutionId,input.className,input.section,input.academicYear],tx);await run("INSERT INTO timetable_entries(id,institution_id,class_name,section,academic_year,weekday,start_time,end_time,subject,teacher_id,generated,status) VALUES(?,?,?,?,?,?,?,?,?,?,FALSE,'Draft')",[id,institutionId,input.className,input.section,input.academicYear,input.weekday,input.startTime,input.endTime,input.subject,input.teacherId||null],tx);await audit(institutionId,userId,"Timetable Entry Added","Timetable",id,input,tx)});return listTimetableEntries(institutionId,input.className,input.section,input.academicYear);
}
export async function deleteTimetableEntry(institutionId:string,userId:string,id:string){const db=await ready();await ensureTimetableSchema(db);const item=await row<{className:string;section:string;academicYear:string}>("SELECT class_name AS \"className\",section,academic_year AS \"academicYear\" FROM timetable_entries WHERE id=? AND institution_id=? AND status<>'Archived'",[id,institutionId],db);if(!item)throw new Error("Timetable entry not found.");await db.begin(async tx=>{await run("UPDATE timetable_entries SET status='Draft' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",[institutionId,item.className,item.section,item.academicYear],tx);await run("UPDATE timetable_entries SET status='Archived' WHERE id=? AND institution_id=?",[id,institutionId],tx);await audit(institutionId,userId,"Timetable Entry Archived","Timetable",id,item,tx)});return true}
export async function publishTimetable(institutionId:string,userId:string,className:string,section:string,academicYear:string){
 const db=await ready();await ensureTimetableSchema(db);const entries=await rows<{id:string;weekday:number;startTime:string;endTime:string;teacherId:string|null}>("SELECT id,weekday,start_time AS \"startTime\",end_time AS \"endTime\",teacher_id AS \"teacherId\" FROM timetable_entries WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",[institutionId,className,section,academicYear],db);
 if(!entries.length)throw new Error("Add at least one period before publishing the timetable.");
 for(const item of entries){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime)||timeMinutes(item.endTime)<=timeMinutes(item.startTime))throw new Error("Every timetable period must have valid start and end times.")}
 const all=await rows<{id:string;className:string;section:string;weekday:number;startTime:string;endTime:string;teacherId:string|null}>("SELECT id,class_name AS \"className\",section,weekday,start_time AS \"startTime\",end_time AS \"endTime\",teacher_id AS \"teacherId\" FROM timetable_entries WHERE institution_id=? AND academic_year=? AND status<>'Archived'",[institutionId,academicYear],db),mins=(time:string)=>timeMinutes(time);
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];if(a.weekday!==b.weekday||Math.max(mins(a.startTime),mins(b.startTime))>=Math.min(mins(a.endTime),mins(b.endTime)))continue;const sameTarget=(a.className===className&&a.section===section)||(b.className===className&&b.section===section);if(sameTarget&&a.className===b.className&&a.section===b.section)throw new Error("This timetable has overlapping periods for the selected class.");if(a.teacherId&&a.teacherId===b.teacherId)throw new Error("A teacher is assigned to overlapping periods. Resolve the conflict before publishing.")}
 await db.begin(async tx=>{await run("UPDATE timetable_entries SET status='Published' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",[institutionId,className,section,academicYear],tx);await audit(institutionId,userId,"Timetable Published","Timetable",undefined,{className,section,academicYear,periodCount:entries.length},tx)});
 return listTimetableEntries(institutionId,className,section,academicYear);
}

export type SaveClassTimetableInput = {
  className: string;
  section: string;
  academicYear: string;
  status?: "Draft" | "Published";
  entries: Array<{
    id?: string;
    weekday: number;
    startTime: string;
    endTime: string;
    subject: string;
    teacherId?: string | null;
  }>;
};

export async function saveClassTimetable(institutionId: string, userId: string, input: SaveClassTimetableInput) {
  const db = await ready();
  await ensureTimetableSchema(db);
  const { className, section, academicYear, entries } = input;
  const target = await row<{ count: number }>(
    "SELECT COUNT(*)::int count FROM institution_classes c JOIN institution_sections s ON s.class_id=c.id WHERE c.institution_id=? AND c.name=? AND c.status='Active' AND s.name=? AND s.status='Active'",
    [institutionId, className, section],
    db
  );
  if (!target.count) throw new Error("Choose a configured class and section.");

  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const timeClock = (t: string) => {
    try {
      const [h, m] = t.split(":").map(Number);
      const suffix = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
    } catch {
      return t;
    }
  };

  // 1. Basic validation of every period
  for (const item of entries) {
    if (!item.subject || !item.subject.trim()) {
      throw new Error("Every timetable period must have a subject name.");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.endTime)) {
      throw new Error(`Invalid period time format for '${item.subject}'. Use 24-hour HH:mm time.`);
    }
    if (timeMinutes(item.endTime) <= timeMinutes(item.startTime)) {
      throw new Error(`Period '${item.subject}' has invalid timings: end time (${item.endTime}) must be later than start time (${item.startTime}).`);
    }
    if (item.weekday < 1 || item.weekday > 6) {
      throw new Error(`Period '${item.subject}' must be assigned to Monday through Saturday.`);
    }
    if (item.teacherId) {
      const activeTeacher = await row<{ id: string; name: string }>(
        "SELECT id, name FROM teachers WHERE id=? AND institution_id=? AND status='Active'",
        [item.teacherId, institutionId],
        db
      );
      if (!activeTeacher) {
        throw new Error(`The assigned teacher for '${item.subject}' is not an active teacher in this school.`);
      }
    }
  }

  // 2. Validate internal collisions (within this class and section)
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (a.weekday !== b.weekday) continue;
      const aStart = timeMinutes(a.startTime), aEnd = timeMinutes(a.endTime);
      const bStart = timeMinutes(b.startTime), bEnd = timeMinutes(b.endTime);
      if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
        throw new Error(
          `Timetable conflict: '${a.subject}' (${timeClock(a.startTime)}–${timeClock(a.endTime)}) overlaps with '${b.subject}' (${timeClock(b.startTime)}–${timeClock(b.endTime)}) on ${dayNames[a.weekday]}.`
        );
      }
      if (a.teacherId && b.teacherId && a.teacherId === b.teacherId && Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
        throw new Error(
          `Timetable conflict: The same teacher is assigned to multiple overlapping periods on ${dayNames[a.weekday]}.`
        );
      }
    }
  }

  // 3. Validate external collisions (teacher double-booking in other classes of the same school and academic year)
  const teacherIds = [...new Set(entries.map((e) => e.teacherId).filter(Boolean))] as string[];
  if (teacherIds.length > 0) {
    const otherEntries = await rows<{
      className: string;
      section: string;
      weekday: number;
      startTime: string;
      endTime: string;
      teacherId: string;
      teacherName: string;
      subject: string;
    }>(
      `SELECT t.class_name AS "className", t.section, t.weekday, t.start_time AS "startTime", t.end_time AS "endTime", t.teacher_id AS "teacherId", COALESCE(te.name, 'Teacher') AS "teacherName", t.subject
       FROM timetable_entries t
       LEFT JOIN teachers te ON te.id = t.teacher_id AND te.institution_id = t.institution_id
       WHERE t.institution_id = ?
         AND t.academic_year = ?
         AND t.status <> 'Archived'
         AND NOT (t.class_name = ? AND t.section = ?)
         AND t.teacher_id IS NOT NULL`,
      [institutionId, academicYear, className, section],
      db
    );

    for (const entry of entries) {
      if (!entry.teacherId) continue;
      const eStart = timeMinutes(entry.startTime), eEnd = timeMinutes(entry.endTime);
      const conflict = otherEntries.find(
        (other) =>
          other.teacherId === entry.teacherId &&
          other.weekday === entry.weekday &&
          Math.max(eStart, timeMinutes(other.startTime)) < Math.min(eEnd, timeMinutes(other.endTime))
      );
      if (conflict) {
        throw new Error(
          `Timetable conflict: ${conflict.teacherName} is already assigned to ${conflict.className} ${conflict.section} on ${dayNames[entry.weekday]} from ${timeClock(conflict.startTime)} to ${timeClock(conflict.endTime)}.`
        );
      }
    }
  }

  // 4. Atomic transaction
  const targetStatus = input.status || "Published";
  await db.begin(async (tx) => {
    await run(
      "UPDATE timetable_entries SET status='Archived' WHERE institution_id=? AND class_name=? AND section=? AND academic_year=? AND status<>'Archived'",
      [institutionId, className, section, academicYear],
      tx
    );

    for (const entry of entries) {
      const id = entry.id && /^[0-9a-f-]{36}$/i.test(entry.id) ? entry.id : randomUUID();
      await run(
        "INSERT INTO timetable_entries(id, institution_id, class_name, section, academic_year, subject, teacher_id, weekday, start_time, end_time, generated, status) VALUES(?,?,?,?,?,?,?,?,?,?,FALSE,?)",
        [
          id,
          institutionId,
          className,
          section,
          academicYear,
          entry.subject.trim(),
          entry.teacherId || null,
          entry.weekday,
          entry.startTime,
          entry.endTime,
          targetStatus,
        ],
        tx
      );
    }

    await audit(institutionId, userId, "Timetable Edited", "Timetable", undefined, {
      className,
      section,
      academicYear,
      periodCount: entries.length,
      status: targetStatus,
    }, tx);
  });

  return listTimetableEntries(institutionId, className, section, academicYear);
}

export type ManagedExamination={id:string;name:string;academicYear:string;className:string;section:string;startDate:string;endDate:string;publicationDate:string|null;status:string;publishedAt:string|null;publishedBy:string|null};
export type ManagedSubject={id:string;subject:string;maximumCent:number;passingCent:number;required:boolean};
export async function getResultSettings(institutionId:string):Promise<ResultSettings>{
 const db=await ready();
 const item=await row<{gradeBands:string;overallPassPercent:number;requireSubjectPass:boolean;rankingEnabled:boolean;principalRemarks:string;classTeacherRemarks:string;reportFormat:string}>('SELECT result_grade_bands AS "gradeBands",result_overall_pass_percent AS "overallPassPercent",result_require_subject_pass AS "requireSubjectPass",result_ranking_enabled AS "rankingEnabled",result_principal_remarks AS "principalRemarks",result_class_teacher_remarks AS "classTeacherRemarks",result_report_format AS "reportFormat" FROM settings WHERE institution_id=?',[institutionId],db);
 if(!item)return defaultResultSettings;
 let gradeBands=defaultResultSettings.gradeBands;
 try{if(item.gradeBands)gradeBands=validateGradeBands(JSON.parse(item.gradeBands))}catch{gradeBands=defaultResultSettings.gradeBands}
 return{gradeBands,overallPassPercent:Number(item.overallPassPercent),requireSubjectPass:Boolean(item.requireSubjectPass),rankingEnabled:Boolean(item.rankingEnabled),principalRemarks:item.principalRemarks,classTeacherRemarks:item.classTeacherRemarks,reportFormat:item.reportFormat};
}
export async function saveResultSettings(institutionId:string,userId:string,input:ResultSettings){
 const gradeBands=validateGradeBands(input.gradeBands);
 if(!Number.isInteger(input.overallPassPercent)||input.overallPassPercent<0||input.overallPassPercent>100)throw new Error("Overall pass percentage must be 0–100.");
 const db=await ready();
 await run('INSERT INTO settings(institution_id)VALUES(?) ON CONFLICT(institution_id) DO NOTHING',[institutionId],db);
 await run('UPDATE settings SET result_grade_bands=?,result_overall_pass_percent=?,result_require_subject_pass=?,result_ranking_enabled=?,result_principal_remarks=?,result_class_teacher_remarks=?,result_report_format=?,updated_at=CURRENT_TIMESTAMP WHERE institution_id=?',[JSON.stringify(gradeBands),input.overallPassPercent,input.requireSubjectPass,input.rankingEnabled,input.principalRemarks,input.classTeacherRemarks,input.reportFormat,institutionId],db);
 await audit(institutionId,userId,"Result Settings Updated","Settings",institutionId,{...input,gradeBands},db);
 return getResultSettings(institutionId);
}
export async function resultStaffScope(institutionId:string,email:string){
 const teachers=await listTeachers(institutionId);
 return teachers.filter(item=>item.status==="Active"&&item.email.toLowerCase()===email.toLowerCase()).flatMap(item=>parseTeacherClasses(item.classes).map(className=>({className,subject:item.subject.trim()})));
}
export async function listManagedExaminations(institutionId:string,filters:{academicYear?:string;className?:string;section?:string;status?:string}={}):Promise<ManagedExamination[]>{
 const where=["institution_id=?"],args:unknown[]=[institutionId];
 for(const [key,column] of [["academicYear","academic_year"],["className","class_name"],["section","section"],["status","status"]] as const)if(filters[key]){where.push(`${column}=?`);args.push(filters[key])}
 return rows<ManagedExamination>(`SELECT id,name,academic_year AS "academicYear",class_name AS "className",section,start_date AS "startDate",end_date AS "endDate",publication_date AS "publicationDate",status,published_at::text AS "publishedAt",published_by AS "publishedBy" FROM result_examinations WHERE ${where.join(" AND ")} ORDER BY start_date DESC,name`,args,await ready());
}
export async function managedExamination(institutionId:string,id:string,db?:Sql){
 return row<ManagedExamination>('SELECT id,name,academic_year AS "academicYear",class_name AS "className",section,start_date AS "startDate",end_date AS "endDate",publication_date AS "publicationDate",status,published_at::text AS "publishedAt",published_by AS "publishedBy" FROM result_examinations WHERE institution_id=? AND id=?',[institutionId,id],db||await ready());
}
export type ManagedExamInput={name:string;academicYear:string;className:string;section:string;startDate:string;endDate:string;publicationDate?:string|null;subjects:{name:string;maximumMarks:number;passingMarks:number;required:boolean}[]};
export async function createManagedExamination(institutionId:string,userId:string,input:ManagedExamInput){
 validDate(input.startDate);validDate(input.endDate);if(input.publicationDate)validDate(input.publicationDate);
 if(input.endDate<input.startDate)throw new Error("Exam end date must be on or after the start date.");
 if(input.publicationDate&&input.publicationDate<input.endDate)throw new Error("Publication date must be on or after the exam end date.");
 if(!input.subjects.length)throw new Error("Add at least one subject.");
 const names=input.subjects.map(item=>item.name.trim().toLowerCase());
 if(new Set(names).size!==names.length)throw new Error("Subject names must be unique within an examination.");
 const db=await ready();
 const schoolClass=await row<{id:string}>('SELECT id FROM classes WHERE institution_id=? AND academic_year=? AND name=? AND section=? AND status=?',[institutionId,input.academicYear,input.className,input.section,"Active"],db);
 if(!schoolClass)throw new Error("Choose an active class and section in this academic year.");
 const subjects=input.subjects.map(item=>{const maximumCent=toCent(item.maximumMarks),passingCent=toCent(item.passingMarks);if(maximumCent<=0||passingCent>maximumCent)throw new Error("Each subject needs a positive maximum and passing marks within it.");return{...item,name:item.name.trim(),maximumCent,passingCent}});
 const id=randomUUID();
 await db.begin(async tx=>{
  await run('INSERT INTO result_examinations(id,institution_id,name,academic_year,class_name,section,start_date,end_date,publication_date,status,created_by)VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,institutionId,input.name.trim(),input.academicYear,input.className,input.section,input.startDate,input.endDate,input.publicationDate||null,"Draft",userId],tx);
  for(const subject of subjects)await run('INSERT INTO class_exams(id,institution_id,class_name,section,academic_year,name,exam_date,subject,max_marks,passing_marks,result_examination_id,max_marks_cent,passing_marks_cent,required)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[randomUUID(),institutionId,input.className,input.section,input.academicYear,input.name.trim(),input.startDate,subject.name,subject.maximumMarks,subject.passingMarks,id,subject.maximumCent,subject.passingCent,subject.required],tx);
  await audit(institutionId,userId,"Examination Created","ResultExamination",id,{name:input.name,className:input.className,section:input.section,academicYear:input.academicYear,subjects:subjects.map(item=>item.name)},tx);
 });
 return managedExamination(institutionId,id);
}
export async function managedResultDetail(institutionId:string,examId:string){
 const db=await ready(),exam=await managedExamination(institutionId,examId,db);
 if(!exam)throw new Error("Examination not found.");
 await ensureStudentEnrollments(institutionId,db);
 const [settings,subjects,students,marks]=await Promise.all([
  getResultSettings(institutionId),
  rows<ManagedSubject>('SELECT id,subject,COALESCE(max_marks_cent,CAST(ROUND(max_marks*100) AS INTEGER)) AS "maximumCent",COALESCE(passing_marks_cent,CAST(ROUND(passing_marks*100) AS INTEGER)) AS "passingCent",required FROM class_exams WHERE institution_id=? AND result_examination_id=? ORDER BY subject',[institutionId,examId],db),
  rows<{id:string;name:string;admission:string;rollNumber:string}>('SELECT s.id,s.name,s.admission,s.roll_number AS "rollNumber" FROM students s WHERE s.institution_id=? AND s.status<>? AND (EXISTS(SELECT 1 FROM student_enrollments e WHERE e.institution_id=s.institution_id AND e.student_id=s.id AND e.academic_year=? AND e.class_name=? AND e.section=?) OR EXISTS(SELECT 1 FROM class_results r JOIN class_exams ce ON ce.id=r.exam_id WHERE r.institution_id=s.institution_id AND r.student_id=s.id AND ce.result_examination_id=?)) ORDER BY s.name',[institutionId,"Deleted",exam.academicYear,exam.className,exam.section,examId],db),
  rows<{id:string;examId:string;studentId:string;obtainedCent:number|null;markStatus:MarkStatus;remarks:string}>('SELECT r.id,r.exam_id AS "examId",r.student_id AS "studentId",COALESCE(r.marks_cent,CAST(ROUND(r.marks*100) AS INTEGER)) AS "obtainedCent",r.mark_status AS "markStatus",r.remarks FROM class_results r JOIN class_exams e ON e.id=r.exam_id WHERE r.institution_id=? AND e.institution_id=? AND e.result_examination_id=?',[institutionId,institutionId,examId],db),
 ]);
 const results=students.map(student=>{
  const subjectMarks:SubjectOutcome[]=subjects.map(subject=>{const mark=marks.find(item=>item.studentId===student.id&&item.examId===subject.id);return{subjectId:subject.id,subject:subject.subject,maximumCent:Number(subject.maximumCent),passingCent:Number(subject.passingCent),required:Boolean(subject.required),obtainedCent:mark?.markStatus==="Scored"?Number(mark.obtainedCent):null,markStatus:mark?.markStatus||null,remarks:mark?.remarks||""}});
  return{...student,subjects:subjectMarks,...calculateStudentResult(subjectMarks,settings)};
 });
 return{exam,settings,subjects,students:results};
}
export async function saveManagedMarks(institutionId:string,userId:string,examId:string,subjectId:string,items:{studentId:string;markStatus:MarkStatus;obtainedMarks?:number|null;remarks:string}[]){
 if(!items.length||items.length>500||new Set(items.map(item=>item.studentId)).size!==items.length)throw new Error("Choose unique students for marks entry.");
 const db=await ready(),exam=await managedExamination(institutionId,examId,db);
 if(!exam)throw new Error("Examination not found.");
 if(!["Draft","Marks Entry Open"].includes(exam.status))throw new Error("Marks are locked. An administrator must reopen the examination.");
 const subject=await row<ManagedSubject>('SELECT id,subject,COALESCE(max_marks_cent,CAST(ROUND(max_marks*100) AS INTEGER)) AS "maximumCent",COALESCE(passing_marks_cent,CAST(ROUND(passing_marks*100) AS INTEGER)) AS "passingCent",required FROM class_exams WHERE id=? AND institution_id=? AND result_examination_id=?',[subjectId,institutionId,examId],db);
 if(!subject)throw new Error("Subject not found in this examination.");
 const settings=await getResultSettings(institutionId),valid=await rows<{id:string}>('SELECT e.student_id AS id FROM student_enrollments e JOIN students s ON s.id=e.student_id AND s.institution_id=e.institution_id WHERE e.institution_id=? AND e.academic_year=? AND e.class_name=? AND e.section=? AND s.status<>?',[institutionId,exam.academicYear,exam.className,exam.section,"Deleted"],db),allowed=new Set(valid.map(item=>item.id));
 const prepared=items.map(item=>{
  if(!allowed.has(item.studentId))throw new Error("Student is not enrolled in this class and academic year.");
  if(item.markStatus==="Scored"&&item.obtainedMarks==null)throw new Error("Enter obtained marks for scored students.");
  const cent=item.markStatus==="Scored"?toCent(Number(item.obtainedMarks)):null;
  if(cent!==null&&cent>Number(subject.maximumCent))throw new Error("Obtained marks cannot exceed the subject maximum.");
  const percentage=cent===null?0:Math.round(cent*10000/Number(subject.maximumCent));
  const grade=cent===null?"—":validateGradeBands(settings.gradeBands).find(band=>percentage>=band.minimum*100)?.grade||"F";
  return{...item,cent,grade,status:item.markStatus==="Scored"?(cent!<Number(subject.passingCent)?"Pass":"Fail"):item.markStatus};
 });
 await db.begin(async tx=>{
  for(const item of prepared)await run('INSERT INTO class_results(id,institution_id,exam_id,student_id,marks,grade,status,marks_cent,mark_status,remarks,updated_by)VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(exam_id,student_id) DO UPDATE SET marks=EXCLUDED.marks,grade=EXCLUDED.grade,status=EXCLUDED.status,marks_cent=EXCLUDED.marks_cent,mark_status=EXCLUDED.mark_status,remarks=EXCLUDED.remarks,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP',[randomUUID(),institutionId,subjectId,item.studentId,item.cent===null?0:item.cent/100,item.grade,item.status,item.cent,item.markStatus,item.remarks,userId],tx);
  await audit(institutionId,userId,"Examination Marks Saved","ResultExamination",examId,{subjectId,count:items.length,studentIds:items.map(item=>item.studentId)},tx);
 });
 return managedResultDetail(institutionId,examId);
}
export async function transitionManagedExamination(institutionId:string,userId:string,examId:string,action:"open"|"close"|"verify"|"approve"|"publish"|"reopen"|"archive"){
 const detail=await managedResultDetail(institutionId,examId),current=detail.exam.status;
 const rules:Record<typeof action,{from:string[];to:string}>={open:{from:["Draft","Marks Entry Closed"],to:"Marks Entry Open"},close:{from:["Marks Entry Open"],to:"Marks Entry Closed"},verify:{from:["Marks Entry Closed"],to:"Results Under Review"},approve:{from:["Results Under Review"],to:"Approved"},publish:{from:["Approved"],to:"Published"},reopen:{from:["Published","Approved","Results Under Review"],to:"Marks Entry Open"},archive:{from:["Published"],to:"Archived"}};
 const rule=rules[action];if(!rule.from.includes(current))throw new Error(`Cannot ${action} an examination in ${current} status.`);
 if(["verify","approve","publish"].includes(action)&&(!detail.subjects.length||detail.students.some(item=>item.status==="Incomplete")))throw new Error("Complete marks for every enrolled student and subject before review or publication.");
 if(action==="publish"&&detail.exam.publicationDate&&detail.exam.publicationDate>new Date().toISOString().slice(0,10))throw new Error("The publication date has not arrived.");
 const db=await ready();
 await db.begin(async tx=>{
  if(action==="publish"){
   const version=(await row<{version:number}>('SELECT COALESCE(MAX(version),0)+1 AS version FROM result_publication_snapshots WHERE examination_id=? AND institution_id=?',[examId,institutionId],tx)).version;
   await run('INSERT INTO result_publication_snapshots(id,institution_id,examination_id,version,snapshot,published_by)VALUES(?,?,?,?,?::jsonb,?)',[randomUUID(),institutionId,examId,version,JSON.stringify(detail),userId],tx);
  }
  await run('UPDATE result_examinations SET status=?,verified_by=CASE WHEN ?=? THEN ? ELSE verified_by END,approved_by=CASE WHEN ?=? THEN ? ELSE approved_by END,published_by=CASE WHEN ?=? THEN ? ELSE published_by END,published_at=CASE WHEN ?=? THEN CURRENT_TIMESTAMP ELSE published_at END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[rule.to,action,"verify",userId,action,"approve",userId,action,"publish",userId,action,"publish",examId,institutionId],tx);
  await audit(institutionId,userId,`Examination ${rule.to}`,"ResultExamination",examId,{from:current,to:rule.to,action},tx);
 });
 if(action==="publish")for(const student of detail.students)await queueAutomaticWhatsAppEvent(institutionId,userId,{studentId:student.id,event:"marksheet",idempotencyKey:`marksheet:${examId}:${student.id}`,values:{exam_name:detail.exam.name,class_name:detail.exam.className,section:detail.exam.section},documentKind:"Mark Sheet PDF",documentReference:`marksheet:${examId}:${student.id}`});
 return managedExamination(institutionId,examId);
}

type AutomaticWhatsAppEvent={studentId:string;event:"absence"|"fee_receipt"|"fee_reminder"|"marksheet";idempotencyKey:string;values:Record<string,string>;documentKind?:string;documentReference?:string};
const automaticTemplateNames:Record<AutomaticWhatsAppEvent["event"],string[]>={absence:["Absence Alert","Attendance"],fee_receipt:["Fee Receipt"],fee_reminder:["Fee Reminder"],marksheet:["Mark Sheet","Exam Result","Result"]};
const automaticSetting:Record<AutomaticWhatsAppEvent["event"],string>={absence:"auto_absence",fee_receipt:"auto_fee_receipt",fee_reminder:"auto_fee_reminder",marksheet:"auto_marksheet"};
async function queueAutomaticWhatsAppEvent(institutionId:string,userId:string,input:AutomaticWhatsAppEvent){
 if(!whatsappDispatchEnabled())return;
 try{
  const db=await ready(),setting=automaticSetting[input.event],config=await row<{enabled:boolean;automatic:boolean}>(`SELECT enabled,${setting} AS automatic FROM whatsapp_configurations WHERE institution_id=?`,[institutionId],db);
  if(!config?.enabled||!config.automatic)return;
  const names=automaticTemplateNames[input.event],placeholders=names.map(()=>"?").join(","),template=await row<{name:string;language:string;variables:string[]|string}>(`SELECT name,language,variables FROM whatsapp_templates WHERE institution_id=? AND enabled=TRUE AND name IN (${placeholders}) ORDER BY CASE name ${names.map((_,index)=>`WHEN ? THEN ${index}`).join(" ")} ELSE 99 END LIMIT 1`,[institutionId,...names,...names],db);
  if(!template)return;
  const student=await row<{name:string;className:string;section:string}>(`SELECT name,class_name AS "className",section FROM students WHERE institution_id=? AND id=?`,[institutionId,input.studentId],db),school=await row<{name:string}>("SELECT name FROM institutions WHERE id=?",[institutionId],db);
  if(!student)return;
  const variables=Array.isArray(template.variables)?template.variables:(()=>{try{return JSON.parse(template.variables) as string[]}catch{return[]}})();if(!whatsappTemplateVariablesSafe(variables))return;const values:Record<string,string>={student_name:student.name,class_name:student.className,section:student.section,school_name:school?.name||"School",...input.values};
  await queueWhatsAppMessage(institutionId,userId,{studentId:input.studentId,messageType:input.event==="absence"?"Absence Alert":input.event==="fee_receipt"?"Fee Receipt":input.event==="fee_reminder"?"Fee Reminder":"Mark Sheet",templateName:template.name,language:template.language,parameters:variables.map(variable=>values[variable]??""),idempotencyKey:input.idempotencyKey,documentKind:input.documentKind,documentReference:input.documentReference});
 }catch(error){
  const message=error instanceof Error?error.message:"Could not queue automatic WhatsApp notification.";
  const db=await ready(),student=await row<{name:string;parent:string;phone:string}>('SELECT name,parent,COALESCE(NULLIF(parent_whatsapp,\'\'),parent_phone) phone FROM students WHERE institution_id=? AND id=?',[institutionId,input.studentId],db);
  if(!student)return;
  await run("INSERT INTO whatsapp_messages(id,institution_id,student_id,recipient_name,recipient_phone,message_type,template_name,language,parameters,document_kind,document_reference,idempotency_key,status,error_message,sent_by,failed_at)VALUES(?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(institution_id,idempotency_key) DO NOTHING",[randomUUID(),institutionId,input.studentId,student.parent||student.name,student.phone||"",input.event,automaticTemplateNames[input.event][0],"en","[]",input.documentKind||null,input.documentReference||null,input.idempotencyKey,"Failed",message.slice(0,500),userId],db);
 }
}

export type WhatsAppConfigurationInput={enabled:boolean;businessNumber:string;autoAbsence:boolean;autoFeeReceipt:boolean;autoFeeReminder:boolean;autoMarksheet:boolean};
export async function getWhatsAppConfiguration(institutionId:string){
 const db=await ready();
 const item=await row<Record<string,unknown>&{businessNumber?:string;storedConfigurationStatus?:string}>('SELECT enabled,display_number AS "businessNumber",configuration_status AS "storedConfigurationStatus",webhook_status AS "webhookStatus",auto_absence AS "autoAbsence",auto_fee_receipt AS "autoFeeReceipt",auto_fee_reminder AS "autoFeeReminder",auto_marksheet AS "autoMarksheet",updated_at::text AS "updatedAt" FROM whatsapp_configurations WHERE institution_id=?',[institutionId],db);
 const provider=whatsappInstitutionProviderStatus(institutionId,String(item?.businessNumber||""));
 const disconnected=item?.storedConfigurationStatus==="Disconnected"&&!item.businessNumber;
 const configurationStatus=disconnected?"Disconnected":provider.state==="configuration_error"?"Server provider configuration error":provider.state==="not_configured"?"Provider onboarding required":provider.state==="pending_verification"?"Pending sender verification":provider.state==="invalid_number"?"Invalid business number":provider.state==="connected_unverified"?"Connected; live delivery not tested":"Dispatch enabled; live delivery not tested";
 const integrationState=disconnected?"disconnected":provider.state;
 return item?{...item,storedConfigurationStatus:undefined,provider:provider.provider,providerConfigured:provider.configured,senderVerified:provider.senderVerified,connectivityVerified:false,dispatchEnabled:provider.dispatchEnabled,integrationState,configurationStatus}:{enabled:false,businessNumber:"",configurationStatus:"Provider onboarding required",webhookStatus:"Not Configured",autoAbsence:false,autoFeeReceipt:false,autoFeeReminder:false,autoMarksheet:false,provider:provider.provider,providerConfigured:provider.configured,senderVerified:false,connectivityVerified:false,dispatchEnabled:provider.dispatchEnabled,integrationState};
}
export async function saveWhatsAppConfiguration(institutionId:string,userId:string,input:WhatsAppConfigurationInput){const db=await ready();let businessNumber="";try{businessNumber=normalizeWhatsAppNumber(input.businessNumber)}catch{throw new Error("Enter a valid authorized business number in international format.")}const provider=whatsappInstitutionProviderStatus(institutionId,businessNumber);if(input.enabled&&!provider.senderVerified)throw new Error("Complete provider onboarding and sender verification before enabling WhatsApp.");await run("INSERT INTO whatsapp_configurations(id,institution_id,enabled,display_number,configuration_status,auto_absence,auto_fee_receipt,auto_fee_reminder,auto_marksheet)VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(institution_id) DO UPDATE SET enabled=EXCLUDED.enabled,display_number=EXCLUDED.display_number,configuration_status=EXCLUDED.configuration_status,auto_absence=EXCLUDED.auto_absence,auto_fee_receipt=EXCLUDED.auto_fee_receipt,auto_fee_reminder=EXCLUDED.auto_fee_reminder,auto_marksheet=EXCLUDED.auto_marksheet,updated_at=CURRENT_TIMESTAMP",[randomUUID(),institutionId,input.enabled,businessNumber,provider.senderVerified?"Connected; live delivery not tested":"Pending sender verification",input.autoAbsence,input.autoFeeReceipt,input.autoFeeReminder,input.autoMarksheet],db);await audit(institutionId,userId,"WhatsApp Configuration Updated","WhatsAppConfiguration",institutionId,{enabled:input.enabled,senderVerified:provider.senderVerified,numberChanged:true},db);return getWhatsAppConfiguration(institutionId)}
export async function disconnectWhatsAppConfiguration(institutionId:string,userId:string){const db=await ready();await run("UPDATE whatsapp_configurations SET enabled=FALSE,display_number='',configuration_status='Disconnected',webhook_status='Not Configured',auto_absence=FALSE,auto_fee_receipt=FALSE,auto_fee_reminder=FALSE,auto_marksheet=FALSE,updated_at=CURRENT_TIMESTAMP WHERE institution_id=?",[institutionId],db);await audit(institutionId,userId,"WhatsApp Configuration Disconnected","WhatsAppConfiguration",institutionId,{providerCredentialsChanged:false},db);return getWhatsAppConfiguration(institutionId)}
export async function whatsappTemplates(institutionId:string){return rows<Record<string,unknown>>('SELECT id,name,category,language,provider_template_name AS "providerTemplateName",enabled,variables,approval_status AS "approvalStatus",rejection_reason AS "rejectionReason",last_synced_at::text AS "lastSyncedAt",created_at::text AS "createdAt",updated_at::text AS "updatedAt" FROM whatsapp_templates WHERE institution_id=? ORDER BY category,name',[institutionId],await ready())}
export async function saveWhatsAppTemplate(institutionId:string,userId:string,input:{id?:string;name:string;category:string;language:string;providerTemplateName:string;enabled:boolean;variables:string[]}){if(!whatsappTemplateVariablesSafe(input.variables))throw new Error("Template variables must use minimal notification fields; detailed marks, fees, contact data, and addresses are not allowed.");const id=input.id||randomUUID(),db=await ready();await run('INSERT INTO whatsapp_templates(id,institution_id,name,category,language,provider_template_name,enabled,variables)VALUES(?,?,?,?,?,?,?,?::jsonb) ON CONFLICT(institution_id,name) DO UPDATE SET category=EXCLUDED.category,language=EXCLUDED.language,provider_template_name=EXCLUDED.provider_template_name,enabled=EXCLUDED.enabled,variables=EXCLUDED.variables,updated_at=CURRENT_TIMESTAMP',[id,institutionId,input.name,input.category,input.language,input.providerTemplateName,input.enabled,JSON.stringify(input.variables)],db);await audit(institutionId,userId,"WhatsApp Template Saved","WhatsAppTemplate",id,{name:input.name,category:input.category},db);return whatsappTemplates(institutionId)}
export async function whatsappDashboard(institutionId:string,limit=50){const db=await ready(),rawItems=await rows<Record<string,unknown>>('SELECT m.id,m.student_id AS "studentId",s.name AS "studentName",m.recipient_name AS "recipientName",m.recipient_phone AS "recipientPhone",m.message_type AS "messageType",m.template_name AS "templateName",m.document_kind AS "documentKind",m.status,m.attempt_count AS "attemptCount",m.error_code AS "errorCode",m.error_message AS "errorMessage",u.name AS "sentBy",m.created_at::text AS "createdAt",m.updated_at::text AS "updatedAt" FROM whatsapp_messages m LEFT JOIN students s ON s.id=m.student_id AND s.institution_id=m.institution_id JOIN users u ON u.id=m.sent_by WHERE m.institution_id=? ORDER BY m.created_at DESC LIMIT ?',[institutionId,Math.min(Math.max(limit,1),200)],db),items=rawItems.map(item=>({...item,recipientPhone:maskWhatsAppNumber(String(item.recipientPhone||""))})),summary=await row<Record<string,number>>("SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='Queued')::int AS queued,COUNT(*) FILTER(WHERE status='Sent')::int AS sent,COUNT(*) FILTER(WHERE status='Delivered')::int AS delivered,COUNT(*) FILTER(WHERE status='Read')::int AS read,COUNT(*) FILTER(WHERE status='Failed')::int AS failed,COUNT(*) FILTER(WHERE document_kind IS NOT NULL)::int AS documents,COUNT(*) FILTER(WHERE created_at::date=CURRENT_DATE)::int AS today,COUNT(*) FILTER(WHERE DATE_TRUNC('month',created_at)=DATE_TRUNC('month',CURRENT_TIMESTAMP))::int AS monthly FROM whatsapp_messages WHERE institution_id=?",[institutionId],db);return{items,summary:{...summary,month:summary.monthly},templates:await whatsappTemplates(institutionId),configuration:await getWhatsAppConfiguration(institutionId)}}
export async function queueWhatsAppMessage(institutionId:string,userId:string,input:{studentId:string;messageType:string;templateName:string;language:string;parameters:string[];idempotencyKey:string;documentKind?:string;documentReference?:string;scheduledAt?:Date}){assertWhatsAppDispatchEnabled();const db=await ready(),configuration=await row<{enabled:boolean;businessNumber:string}>('SELECT enabled,display_number AS "businessNumber" FROM whatsapp_configurations WHERE institution_id=?',[institutionId],db),provider=whatsappInstitutionProviderStatus(institutionId,configuration?.businessNumber||"");if(!configuration?.enabled||!provider.senderVerified)throw new Error("WhatsApp sender configuration is not enabled and verified for this institution.");const student=await row<{id:string;name:string;parent:string;phone:string;status:string;consentStatus:ConsentStatus;attendance:boolean;academics:boolean;fees:boolean;notices:boolean;general:boolean}>('SELECT id,name,parent,COALESCE(NULLIF(parent_whatsapp,\'\'),parent_phone) phone,status,COALESCE(whatsapp_consent_status,\'UNKNOWN\') AS "consentStatus",whatsapp_attendance attendance,whatsapp_academics academics,whatsapp_fees fees,whatsapp_notices notices,whatsapp_general general FROM students WHERE id=? AND institution_id=?',[input.studentId,institutionId],db);if(!student)throw new Error("Student not found.");if(student.status!=="Active")throw new Error("Messages can only be queued for active students.");if(student.consentStatus!=="GRANTED")throw new Error(student.consentStatus==="OPTED_OUT"?"Parent has opted out of WhatsApp communication.":"Parent consent has not been established.");const category=messageCategory(input.messageType);if(!student[category])throw new Error(`Parent has not opted in to ${category} WhatsApp messages.`);let phone="",phoneError="";try{phone=normalizeWhatsAppNumber(student.phone);if(!phone)phoneError="Parent WhatsApp number is not available"}catch{phoneError="Invalid WhatsApp number"}if(phoneError)throw new Error(phoneError);const template=await row<{providerName:string;enabled:boolean;approvalStatus:string;category:string}>('SELECT provider_template_name AS "providerName",enabled,approval_status AS "approvalStatus",category FROM whatsapp_templates WHERE institution_id=? AND name=?',[institutionId,input.templateName],db);if(!template?.enabled||template.approvalStatus!=="APPROVED")throw new Error("Choose an enabled, provider-approved WhatsApp template.");const templateAuthorization=authorizeWhatsAppDispatch({dispatchEnabled:true,messageId:"queue-candidate",messageInstitutionId:institutionId,expectedInstitutionId:institutionId,studentId:student.id,studentInstitutionId:institutionId,studentStatus:student.status,guardianPhone:student.phone,queuedRecipientPhone:student.phone,consentStatus:student.consentStatus,categoryConsent:{attendance:student.attendance,academics:student.academics,fees:student.fees,notices:student.notices,general:student.general},configurationEnabled:true,senderVerified:true,templateEnabled:template.enabled,templateApprovalStatus:template.approvalStatus,templateCategory:template.category,messageType:input.messageType});if(!templateAuthorization.allowed)throw new Error("WhatsApp message is not authorized for this template category.");const id=randomUUID(),status=input.scheduledAt?"Scheduled":"Queued";await run("INSERT INTO whatsapp_messages(id,institution_id,student_id,recipient_name,recipient_phone,message_type,template_name,language,parameters,document_kind,document_reference,idempotency_key,sent_by,status,scheduled_at,next_attempt_at)VALUES(?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?) ON CONFLICT(institution_id,idempotency_key) DO NOTHING",[id,institutionId,student.id,student.parent,phone,input.messageType,input.templateName,input.language,JSON.stringify(input.parameters),input.documentKind||null,input.documentReference||null,input.idempotencyKey,userId,status,input.scheduledAt||null,input.scheduledAt||new Date()],db);await audit(institutionId,userId,"WhatsApp Message Queued","WhatsAppMessage",id,{studentId:student.id,messageType:input.messageType,templateName:input.templateName,status},db);return row<Record<string,unknown>>('SELECT id,status,scheduled_at::text AS "scheduledAt",created_at::text AS "createdAt" FROM whatsapp_messages WHERE institution_id=? AND idempotency_key=?',[institutionId,input.idempotencyKey],db)}
export async function retryWhatsAppMessage(institutionId:string,userId:string,id:string){assertWhatsAppDispatchEnabled();const db=await ready(),authorization=await authorizeWhatsAppJob(id,institutionId,db);if(!authorization.allowed)throw new Error("Message is not currently authorized for WhatsApp dispatch.");const changed=await run("UPDATE whatsapp_messages SET status='Queued',error_code='',error_message='',next_attempt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=? AND status='Failed'",[id,institutionId],db);if(!changed)throw new Error("Only failed messages can be retried.");await audit(institutionId,userId,"WhatsApp Message Retried","WhatsAppMessage",id,{},db);return true}
export async function enqueueWhatsAppFeeReminders(){assertWhatsAppDispatchEnabled();const db=await ready(),cutoff=new Date(Date.now()+7*86400000).toISOString().slice(0,10),items=await rows<{institutionId:string;studentId:string;feeId:string;pendingAmount:number;dueDate:string;userId:string}>('SELECT f.institution_id AS "institutionId",f.student_id AS "studentId",f.id AS "feeId",f.pending_amount AS "pendingAmount",f.due_date AS "dueDate",(SELECT u.id FROM users u WHERE u.institution_id=f.institution_id AND u.role IN (\'SCHOOL_ADMIN\',\'SUPER_ADMIN\') ORDER BY u.created_at LIMIT 1) AS "userId" FROM fees f JOIN whatsapp_configurations c ON c.institution_id=f.institution_id AND c.enabled=TRUE AND c.auto_fee_reminder=TRUE WHERE f.pending_amount>0 AND f.status IN (\'Pending\',\'Partially Paid\',\'Overdue\') AND f.due_date<=?',[cutoff],db);let queued=0;for(const item of items){if(!item.userId)continue;await queueAutomaticWhatsAppEvent(item.institutionId,item.userId,{studentId:item.studentId,event:"fee_reminder",idempotencyKey:`fee-reminder:${item.feeId}:${item.dueDate}`,values:{outstanding_amount:`₹${Number(item.pendingAmount).toLocaleString("en-IN")}`,due_date:item.dueDate}});queued++}return queued}

type AuthorizedWhatsAppJob={id:string;institutionId:string;recipientPhone:string;templateName:string;language:string;parameters:string[];attemptCount:number;documentReference:string|null};
async function authorizeWhatsAppJob(id:string,expectedInstitutionId:string,db:Sql,workerId?:string):Promise<{allowed:true;job:AuthorizedWhatsAppJob}|{allowed:false;reason:string}>{
 const item=await row<AuthorizedWhatsAppJob&{messageInstitutionId:string;studentId:string|null;studentInstitutionId:string|null;studentStatus:string|null;guardianPhone:string|null;consentStatus:string|null;attendance:boolean|null;academics:boolean|null;fees:boolean|null;notices:boolean|null;general:boolean|null;configurationEnabled:boolean|null;businessNumber:string|null;templateEnabled:boolean|null;templateApprovalStatus:string|null;templateCategory:string|null;messageType:string|null}>(`SELECT m.id,m.institution_id AS "institutionId",m.institution_id AS "messageInstitutionId",m.student_id AS "studentId",m.recipient_phone AS "recipientPhone",m.message_type AS "messageType",m.language,m.parameters,m.attempt_count AS "attemptCount",m.document_reference AS "documentReference",s.institution_id AS "studentInstitutionId",s.status AS "studentStatus",COALESCE(NULLIF(s.parent_whatsapp,''),s.parent_phone) AS "guardianPhone",s.whatsapp_consent_status AS "consentStatus",s.whatsapp_attendance attendance,s.whatsapp_academics academics,s.whatsapp_fees fees,s.whatsapp_notices notices,s.whatsapp_general general,c.enabled AS "configurationEnabled",c.display_number AS "businessNumber",t.enabled AS "templateEnabled",t.approval_status AS "templateApprovalStatus",t.category AS "templateCategory",t.provider_template_name AS "templateName" FROM whatsapp_messages m LEFT JOIN students s ON s.id=m.student_id AND s.institution_id=m.institution_id LEFT JOIN whatsapp_configurations c ON c.institution_id=m.institution_id LEFT JOIN whatsapp_templates t ON t.institution_id=m.institution_id AND t.name=m.template_name WHERE m.id=? AND m.institution_id=?${workerId?" AND m.lease_owner=? AND m.status='Sending'":""}`,[id,expectedInstitutionId,...(workerId?[workerId]:[])],db);
 if(!item)return{allowed:false,reason:"authorization_data_missing"};
 const provider=whatsappInstitutionProviderStatus(item.institutionId,item.businessNumber||"");
 const snapshot:WhatsAppDispatchAuthorizationSnapshot={dispatchEnabled:whatsappDispatchEnabled(),messageId:item.id,messageInstitutionId:item.messageInstitutionId,expectedInstitutionId,studentId:item.studentId,studentInstitutionId:item.studentInstitutionId,studentStatus:item.studentStatus,guardianPhone:item.guardianPhone,queuedRecipientPhone:item.recipientPhone,consentStatus:item.consentStatus,categoryConsent:{attendance:item.attendance===true,academics:item.academics===true,fees:item.fees===true,notices:item.notices===true,general:item.general===true},configurationEnabled:item.configurationEnabled===true,senderVerified:provider.senderVerified,templateEnabled:item.templateEnabled===true,templateApprovalStatus:item.templateApprovalStatus,templateCategory:item.templateCategory,messageType:item.messageType||""};
 const authorization=authorizeWhatsAppDispatch(snapshot);
 return authorization.allowed?{allowed:true,job:item}:{allowed:false,reason:authorization.reason};
}

export async function processWhatsAppQueue(limit=20){
 if(!whatsappDispatchEnabled())return{workerId:null,processed:0,sent:0,failed:0,retrying:0,uncertain:0,disabled:true};
 const db=await ready(),workerId=randomUUID(),leaseExpiry=new Date(Date.now()+2*60_000);await run("UPDATE whatsapp_messages SET status='Uncertain',outcome_class='ABANDONED_AFTER_CLAIM',lease_owner=NULL,lease_expires_at=NULL,error_message='Worker lease expired after dispatch may have started; manual reconciliation required.',updated_at=CURRENT_TIMESTAMP WHERE status='Sending' AND lease_expires_at<CURRENT_TIMESTAMP",[],db);const candidates=await rows<{id:string}>("SELECT id FROM whatsapp_messages WHERE status IN ('Queued','Scheduled') AND next_attempt_at<=CURRENT_TIMESTAMP AND (scheduled_at IS NULL OR scheduled_at<=CURRENT_TIMESTAMP) ORDER BY created_at LIMIT ?",[Math.min(Math.max(limit,1),100)],db),jobs=[] as {id:string;institutionId:string;recipientPhone:string;templateName:string;language:string;parameters:string[];attemptCount:number;documentReference:string|null}[];
 for(const candidate of candidates){const claimed=await run("UPDATE whatsapp_messages SET status='Sending',claimed_at=CURRENT_TIMESTAMP,lease_owner=?,lease_expires_at=?,last_worker_id=?,attempt_count=attempt_count+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('Queued','Scheduled') AND (lease_expires_at IS NULL OR lease_expires_at<CURRENT_TIMESTAMP)",[workerId,leaseExpiry,workerId,candidate.id],db);if(!claimed)continue;const job=await row<{id:string;institutionId:string;recipientPhone:string;templateName:string;language:string;parameters:string[];attemptCount:number;documentReference:string|null}>("SELECT m.id,m.institution_id AS \"institutionId\",m.recipient_phone AS \"recipientPhone\",t.provider_template_name AS \"templateName\",m.language,m.parameters,m.attempt_count AS \"attemptCount\",m.document_reference AS \"documentReference\" FROM whatsapp_messages m JOIN whatsapp_templates t ON t.institution_id=m.institution_id AND t.name=m.template_name AND t.enabled=TRUE AND t.approval_status='APPROVED' JOIN whatsapp_configurations c ON c.institution_id=m.institution_id AND c.enabled=TRUE JOIN students s ON s.id=m.student_id AND s.institution_id=m.institution_id AND s.status='Active' AND s.whatsapp_consent_status='GRANTED' WHERE m.id=? AND m.lease_owner=?",[candidate.id,workerId],db);if(job)jobs.push(job);else await run("UPDATE whatsapp_messages SET status='Failed',outcome_class='INELIGIBLE_AT_DISPATCH',error_message='Recipient, consent, template, or integration became ineligible before dispatch.',failed_at=CURRENT_TIMESTAMP,lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_owner=?",[candidate.id,workerId],db)}let sent=0,failed=0,retrying=0,uncertain=0;
 for(const job of jobs){
  try{
   const authorization=await authorizeWhatsAppJob(job.id,job.institutionId,db,workerId);
   if(!authorization.allowed){await run("UPDATE whatsapp_messages SET status='Failed',outcome_class='INELIGIBLE_AT_DISPATCH',error_code=?,error_message='Current recipient, consent, sender, template, or institution authorization failed before dispatch.',failed_at=CURRENT_TIMESTAMP,lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_owner=?",[authorization.reason,job.id,workerId],db);failed++;continue}
	   const current=authorization.job,rate=await row<{institutionDispatches:number;recipientDispatches:number}>(`SELECT COUNT(*) FILTER (WHERE id<>? AND COALESCE(sent_at,claimed_at)>=CURRENT_TIMESTAMP-INTERVAL '1 minute')::int AS "institutionDispatches",COUNT(*) FILTER (WHERE recipient_phone=? AND id<>? AND COALESCE(sent_at,claimed_at)>=CURRENT_TIMESTAMP-INTERVAL '1 minute')::int AS "recipientDispatches" FROM whatsapp_messages WHERE institution_id=? AND status IN ('Sending','Sent','Delivered','Read')`,[current.id,current.recipientPhone,current.id,current.institutionId],db),rateDecision=evaluateWhatsAppDispatchRateLimit({institutionDispatchesLastMinute:Number(rate?.institutionDispatches),recipientDispatchesLastMinute:Number(rate?.recipientDispatches)});
	   if(!rateDecision.allowed){await run("UPDATE whatsapp_messages SET status='Queued',outcome_class='RATE_LIMITED',error_code=?,error_message='Dispatch deferred by the server-side WhatsApp rate policy.',next_attempt_at=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_owner=?",[rateDecision.reason,new Date(Date.now()+rateDecision.retryAfterMs),current.id,workerId],db);retrying++;continue}
	   const credentials=whatsappProviderCredentials(current.institutionId),result=await metaCloudWhatsAppProvider.sendTemplate({to:current.recipientPhone,templateName:current.templateName,language:current.language,parameters:Array.isArray(current.parameters)?current.parameters:[]},credentials);
	   if(current.documentReference?.startsWith("receipt:")){const documentAuthorization=await authorizeWhatsAppJob(current.id,current.institutionId,db,workerId);if(!documentAuthorization.allowed){await run("UPDATE whatsapp_messages SET status='Sent',provider_message_id=?,sent_at=CURRENT_TIMESTAMP,outcome_class='ACCEPTED_DOCUMENT_BLOCKED',error_code=?,error_message='The template was accepted, but current authorization blocked the follow-up document.',lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_owner=?",[result.id,documentAuthorization.reason,current.id,workerId],db);sent++;continue}const receipt=current.documentReference.slice(8),expires=Date.now()+15*60_000,signature=signWhatsAppDocument(current.documentReference,expires),base=getSiteOrigin();await metaCloudWhatsAppProvider.sendDocument({to:documentAuthorization.job.recipientPhone,url:`${base}/api/receipts/${encodeURIComponent(receipt)}/pdf?wa_expires=${expires}&wa_signature=${encodeURIComponent(signature)}`,filename:`EduLedger_Receipt_${receipt}.pdf`},credentials)}
   await run("UPDATE whatsapp_messages SET status='Sent',provider_message_id=?,sent_at=CURRENT_TIMESTAMP,outcome_class='ACCEPTED',error_code='',error_message='',lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_owner=?",[result.id,current.id,workerId],db);sent++;
  }catch(error){const message=error instanceof Error?error.message:"WhatsApp send failed.",kind=error instanceof WhatsAppProviderError?error.kind:"uncertain",attempt=job.attemptCount,retry=kind==="retryable"&&attempt<3,nextAttempt=new Date(Date.now()+Math.min(60,5*Math.pow(2,Math.max(0,attempt-1)))*60_000+Math.floor(Math.random()*30_000));const status=kind==="uncertain"?"Uncertain":retry?"Queued":"Failed";await run("UPDATE whatsapp_messages SET status=?,outcome_class=?,error_code=?,error_message=?,failed_at=?,next_attempt_at=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_owner=?",[status,kind.toUpperCase(),error instanceof WhatsAppProviderError?error.providerCode||"":"",message.slice(0,500),status==="Failed"?new Date():null,nextAttempt,job.id,workerId],db);if(status==="Uncertain")uncertain++;else if(retry)retrying++;else failed++}
 }
 return{workerId,processed:sent+failed+retrying+uncertain,sent,failed,retrying,uncertain};
}
async function updateWhatsAppDeliveryWithSql(providerMessageId:string,status:string,errorCode:string,errorMessage:string,providerTimestamp:Date|undefined,db:Sql){const mapped:{[key:string]:string}={sent:"Sent",delivered:"Delivered",read:"Read",failed:"Failed"},next=mapped[status];if(!next)return 0;const current=await row<{id:string;institutionId:string;status:string;providerStatusAt?:Date|string}>('SELECT id,institution_id AS "institutionId",status,provider_status_at AS "providerStatusAt" FROM whatsapp_messages WHERE provider_message_id=?',[providerMessageId],db),currentProviderTimestamp=current?.providerStatusAt?new Date(current.providerStatusAt):undefined;if(!current||!mayApplyWhatsAppProviderEvent(current.status,next,currentProviderTimestamp,providerTimestamp))return 0;return run(`UPDATE whatsapp_messages SET status=?,error_code=?,error_message=?,sent_at=CASE WHEN ?='Sent' THEN COALESCE(sent_at,?) ELSE sent_at END,delivered_at=CASE WHEN ?='Delivered' THEN ? ELSE delivered_at END,read_at=CASE WHEN ?='Read' THEN ? ELSE read_at END,failed_at=CASE WHEN ?='Failed' THEN ? ELSE failed_at END,provider_status_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=? AND provider_message_id=? AND status=? AND (provider_status_at IS NULL OR provider_status_at<?)`,[next,errorCode,errorMessage,next,providerTimestamp,next,providerTimestamp,next,providerTimestamp,next,providerTimestamp,providerTimestamp,current.id,current.institutionId,providerMessageId,current.status,providerTimestamp],db)}
export async function updateWhatsAppDelivery(providerMessageId:string,status:string,errorCode="",errorMessage="",providerTimestamp?:Date){return updateWhatsAppDeliveryWithSql(providerMessageId,status,errorCode,errorMessage,providerTimestamp,await ready())}
export async function processWhatsAppWebhookStatus(input:{providerMessageId:string;status:string;timestamp?:Date;errorCode?:string;errorMessage?:string}){const db=await ready(),timestamp=input.timestamp&&Number.isFinite(input.timestamp.getTime())?input.timestamp:undefined,key=whatsappWebhookEventKey({...input,timestamp}),payloadHash=createHash("sha256").update(JSON.stringify({id:input.providerMessageId,status:input.status,timestamp:timestamp?.toISOString(),errorCode:input.errorCode||""})).digest("hex");return persistWhatsAppWebhookAtomically(db,tx=>run('INSERT INTO whatsapp_webhook_events(id,provider_event_key,provider_message_id,event_status,event_at,payload_hash)VALUES(?,?,?,?,?,?) ON CONFLICT(provider_event_key) DO NOTHING',[randomUUID(),key,input.providerMessageId,input.status,timestamp||null,payloadHash],tx).then(Boolean),tx=>updateWhatsAppDeliveryWithSql(input.providerMessageId,input.status,input.errorCode||"",input.errorMessage||"",timestamp,tx))}

export async function whatsappRecipients(institutionId:string){const items=await rows<Record<string,unknown>>('SELECT id,name,class_name AS "className",section,parent,COALESCE(NULLIF(parent_whatsapp,\'\'),parent_phone) AS "parentWhatsapp",whatsapp_enabled AS "whatsappEnabled",whatsapp_attendance AS "whatsappAttendance",whatsapp_academics AS "whatsappAcademics",whatsapp_fees AS "whatsappFees",whatsapp_notices AS "whatsappNotices",whatsapp_general AS "whatsappGeneral" FROM students WHERE institution_id=? AND LOWER(TRIM(status))=\'active\' ORDER BY class_name,section,name',[institutionId],await ready());return items.map(item=>({...item,parentWhatsapp:maskWhatsAppNumber(String(item.parentWhatsapp||""))}))}
export async function updateWhatsAppConsent(institutionId:string,userId:string,studentId:string,input:{whatsappEnabled:boolean;whatsappAttendance:boolean;whatsappAcademics:boolean;whatsappFees:boolean;whatsappNotices:boolean;whatsappGeneral:boolean}){const db=await ready(),student=await row<{phone:string}>('SELECT COALESCE(NULLIF(parent_whatsapp,\'\'),parent_phone) phone FROM students WHERE id=? AND institution_id=? AND status=\'Active\'',[studentId,institutionId],db);if(!student)throw new Error("Student not found.");let normalized="";try{normalized=normalizeWhatsAppNumber(student.phone)}catch{if(input.whatsappEnabled)throw new Error("A valid guardian WhatsApp number is required before recording consent.")}const status:ConsentStatus=input.whatsappEnabled?"GRANTED":"OPTED_OUT",fingerprint=normalized?createHash("sha256").update(normalized).digest("hex"):"missing";await db.begin(async tx=>{await run('UPDATE students SET whatsapp_enabled=?,whatsapp_consent_status=?,whatsapp_consent_at=CASE WHEN ?=\'GRANTED\' THEN CURRENT_TIMESTAMP ELSE whatsapp_consent_at END,whatsapp_consent_source=\'STAFF_RECORDED\',whatsapp_opted_out_at=CASE WHEN ?=\'OPTED_OUT\' THEN CURRENT_TIMESTAMP ELSE NULL END,whatsapp_attendance=?,whatsapp_academics=?,whatsapp_fees=?,whatsapp_notices=?,whatsapp_general=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=?',[input.whatsappEnabled,status,status,status,input.whatsappEnabled&&input.whatsappAttendance,input.whatsappEnabled&&input.whatsappAcademics,input.whatsappEnabled&&input.whatsappFees,input.whatsappEnabled&&input.whatsappNotices,input.whatsappEnabled&&input.whatsappGeneral,studentId,institutionId],tx);await run('INSERT INTO whatsapp_consent_events(id,institution_id,student_id,contact_fingerprint,status,source,changed_by)VALUES(?,?,?,?,?,?,?)',[randomUUID(),institutionId,studentId,fingerprint,status,"STAFF_RECORDED",userId],tx);await audit(institutionId,userId,"WhatsApp Consent Updated","Student",studentId,{status,source:"STAFF_RECORDED"},tx)});return true}

type WhatsAppAudienceCriteria={studentId?:string;className?:string;section?:string};
export async function previewWhatsAppAudience(institutionId:string,messageType:string,templateName:string,criteria:WhatsAppAudienceCriteria){
 const db=await ready(),templateRow=await row<{name:string;language:string;enabled:boolean;approvalStatus:string;variables:string[]|string}>('SELECT name,language,enabled,approval_status AS "approvalStatus",variables FROM whatsapp_templates WHERE institution_id=? AND name=?',[institutionId,templateName],db);
 if(!templateRow)throw new Error("Template not found.");
 const variables=Array.isArray(templateRow.variables)?templateRow.variables:(()=>{try{return JSON.parse(templateRow.variables)as string[]}catch{return[]}})(),template:TemplateRecord={...templateRow,variables};
 const clauses=["s.institution_id=?"],params:unknown[]=[institutionId];if(criteria.studentId){clauses.push("s.id=?");params.push(criteria.studentId)}if(criteria.className){clauses.push("s.class_name=?");params.push(criteria.className)}if(criteria.section){clauses.push("s.section=?");params.push(criteria.section)}
 if(!criteria.studentId&&!criteria.className)throw new Error("Choose a student or class.");
 const category=messageCategory(messageType),categoryColumn={attendance:"whatsapp_attendance",fees:"whatsapp_fees",academics:"whatsapp_academics",notices:"whatsapp_notices",general:"whatsapp_general"}[category];
 const source=await rows<{studentId:string;studentName:string;className:string;section:string;guardianName:string;phone:string;studentStatus:string;consentStatus:ConsentStatus;categoryAllowed:boolean;pendingFee:number;attendanceStatus:string;attendanceDate:string;schoolName:string}>(`SELECT s.id AS "studentId",s.name AS "studentName",s.class_name AS "className",s.section,s.parent AS "guardianName",COALESCE(NULLIF(s.parent_whatsapp,''),s.parent_phone) AS phone,s.status AS "studentStatus",COALESCE(s.whatsapp_consent_status,'UNKNOWN') AS "consentStatus",s.${categoryColumn} AS "categoryAllowed",s.pending_fee AS "pendingFee",COALESCE((SELECT a.status FROM attendance a WHERE a.institution_id=s.institution_id AND a.student_id=s.id ORDER BY a.date DESC LIMIT 1),'') AS "attendanceStatus",COALESCE((SELECT a.date FROM attendance a WHERE a.institution_id=s.institution_id AND a.student_id=s.id ORDER BY a.date DESC LIMIT 1),'') AS "attendanceDate",i.name AS "schoolName" FROM students s JOIN institutions i ON i.id=s.institution_id WHERE ${clauses.join(" AND ")} ORDER BY s.name LIMIT 501`,params,db);
 if(source.length>500)throw new Error("Audience exceeds the 500-student preview limit.");
 const records:AudienceRecord[]=source.map(item=>({...item,values:{guardian_name:item.guardianName,student_name:item.studentName,class_name:item.className,section:item.section,school_name:item.schoolName,attendance_status:item.attendanceStatus,date:item.attendanceDate,outstanding_amount:`₹${Number(item.pendingFee).toLocaleString("en-IN")}`}}));
 return buildAudiencePreview(records,template,Object.fromEntries(Object.entries(criteria).filter(([,value])=>value)) as Record<string,string>);
}

export async function prepareAndQueueWhatsAppMessage(institutionId:string,userId:string,input:{studentId:string;messageType:string;templateName:string;idempotencyKey:string;scheduledAt?:Date}){
 assertWhatsAppDispatchEnabled();
 const preview=await previewWhatsAppAudience(institutionId,input.messageType,input.templateName,{studentId:input.studentId});if(preview.eligibleMessages!==1)throw new Error("Recipient is not currently eligible for this message.");const recipient=preview.recipients[0];
 return queueWhatsAppMessage(institutionId,userId,{studentId:input.studentId,messageType:input.messageType,templateName:input.templateName,language:preview.template.language,parameters:recipient.parameters,idempotencyKey:input.idempotencyKey,scheduledAt:input.scheduledAt});
}
export async function scheduledWhatsAppMessages(institutionId:string){return rows<Record<string,unknown>>('SELECT id,message_type AS "messageType",template_name AS "templateName",status,scheduled_at::text AS "scheduledAt",created_at::text AS "createdAt" FROM whatsapp_messages WHERE institution_id=? ORDER BY created_at DESC LIMIT 200',[institutionId],await ready())}
export async function cancelWhatsAppMessage(institutionId:string,userId:string,id:string){const db=await ready(),changed=await run("UPDATE whatsapp_messages SET status='Cancelled',cancelled_at=CURRENT_TIMESTAMP,lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=? AND status IN ('Queued','Scheduled')",[id,institutionId],db);if(!changed)throw new Error("Only queued or scheduled messages can be cancelled.");await audit(institutionId,userId,"WhatsApp Message Cancelled","WhatsAppMessage",id,{},db)}
export async function rescheduleWhatsAppMessage(institutionId:string,userId:string,id:string,scheduledAt:Date){assertWhatsAppDispatchEnabled();const db=await ready(),authorization=await authorizeWhatsAppJob(id,institutionId,db);if(!authorization.allowed)throw new Error("Message is not currently authorized for WhatsApp dispatch.");const changed=await run("UPDATE whatsapp_messages SET status='Scheduled',scheduled_at=?,next_attempt_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND institution_id=? AND status='Scheduled'",[scheduledAt,scheduledAt,id,institutionId],db);if(!changed)throw new Error("Only scheduled messages can be rescheduled.");await audit(institutionId,userId,"WhatsApp Message Rescheduled","WhatsAppMessage",id,{scheduledAt:scheduledAt.toISOString()},db)}
export async function whatsappOperationalDiagnostics(institutionId:string){const db=await ready(),metrics=await row<Record<string,number>>(`SELECT COUNT(*) FILTER(WHERE status IN ('Queued','Scheduled'))::int pending,COUNT(*) FILTER(WHERE status='Sending' AND lease_expires_at<CURRENT_TIMESTAMP)::int "expiredLeases",COUNT(*) FILTER(WHERE status='Failed' AND outcome_class='RETRYABLE')::int "retryableFailures",COUNT(*) FILTER(WHERE status='Failed' AND outcome_class='PERMANENT')::int "permanentFailures",COUNT(*) FILTER(WHERE status='Uncertain')::int uncertain,COALESCE(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP-(MIN(created_at) FILTER(WHERE status IN ('Queued','Scheduled'))))),0)::int AS "oldestPendingSeconds" FROM whatsapp_messages WHERE institution_id=?`,[institutionId],db),configuration=await getWhatsAppConfiguration(institutionId),webhook=whatsappWebhookConfigurationStatus();return{metrics,readiness:{configurationPresent:configuration.providerConfigured,configurationValid:configuration.integrationState!=="configuration_error",webhookSecretsConfigured:webhook.configured,dispatchExplicitlyEnabled:whatsappDispatchEnabled(),providerConnectivityVerified:false,templateApprovalVerified:false,webhookReachabilityVerified:false,backgroundProcessingVerified:false,cronConfigured:true}}}

// ==========================================
// Parent Portal Core Database Functions
// ==========================================

export type DbParentChild = {
  id: string;
  name: string;
  admission: string;
  className: string;
  section: string;
  grade: string;
  rollNumber: string;
  gender: string;
  dateOfBirth: string;
  parent: string;
  parentPhone: string;
  parentEmail: string;
  address: string;
  admissionDate: string;
  attendance: number;
  fee: FeeStatus;
  totalFee: number;
  paidFee: number;
  pendingFee: number;
  status: string;
  academicYear: string;
  relationship: string;
  isPrimary: boolean;
};

export async function parentChildren(institutionId: string, parentUserId: string): Promise<DbParentChild[]> {
  const db = await ready();
  const parentUser = await row<{ email: string; name: string }>(
    "SELECT email, name FROM users WHERE id=? AND institution_id=?",
    [parentUserId, institutionId],
    db
  );
  if (!parentUser) return [];

  // Auto-link any matching students by parent email if not yet linked
  if (parentUser.email) {
    const unlinked = await rows<{ id: string }>(
      "SELECT id FROM students WHERE institution_id=? AND LOWER(parent_email)=? AND id NOT IN (SELECT student_id FROM parent_students WHERE parent_user_id=?)",
      [institutionId, parentUser.email.toLowerCase(), parentUserId],
      db
    );
    for (const s of unlinked) {
      await run(
        "INSERT INTO parent_students(id, institution_id, parent_user_id, student_id, relationship) VALUES(?,?,?,?,'Parent') ON CONFLICT DO NOTHING",
        [randomUUID(), institutionId, parentUserId, s.id],
        db
      );
    }
  }

  return await rows<DbParentChild>(
    `SELECT s.id, s.name, s.admission, s.class_name AS "className", s.section, s.grade,
            s.roll_number AS "rollNumber", s.gender, s.date_of_birth AS "dateOfBirth",
            s.parent, s.parent_phone AS "parentPhone", s.parent_email AS "parentEmail",
            s.address, s.admission_date AS "admissionDate", s.attendance, s.fee,
            s.total_fee AS "totalFee", s.paid_fee AS "paidFee", s.pending_fee AS "pendingFee",
            s.status, s.academic_year AS "academicYear",
            COALESCE(ps.relationship, 'Parent') AS relationship,
            COALESCE(ps.is_primary, TRUE) AS "isPrimary"
     FROM parent_students ps
     JOIN students s ON s.id = ps.student_id AND s.institution_id = ps.institution_id
     WHERE ps.institution_id = ? AND ps.parent_user_id = ?
     ORDER BY s.name ASC`,
    [institutionId, parentUserId],
    db
  );
}

export async function parentHasChild(institutionId: string, parentUserId: string, studentId: string): Promise<boolean> {
  const children = await parentChildren(institutionId, parentUserId);
  return children.some((c) => c.id === studentId);
}

export async function linkStudentToParent(
  institutionId: string,
  parentUserId: string,
  studentId: string,
  relationship = "Parent",
  isPrimary = true
) {
  const db = await ready();
  await run(
    "INSERT INTO parent_students(id, institution_id, parent_user_id, student_id, relationship, is_primary) VALUES(?,?,?,?,?,?) ON CONFLICT(parent_user_id, student_id) DO UPDATE SET relationship=EXCLUDED.relationship, is_primary=EXCLUDED.is_primary",
    [randomUUID(), institutionId, parentUserId, studentId, relationship, isPrimary],
    db
  );
  await audit(institutionId, parentUserId, "Linked Student", "parent_students", studentId, { relationship, isPrimary }, db);
}

export async function createParentInvitation(
  institutionId: string,
  createdBy: string,
  input: {
    studentId: string;
    parentName: string;
    parentEmail: string;
    parentPhone?: string;
    expiresInDays?: number;
  }
) {
  const db = await ready();
  const student = await row<{ id: string; name: string }>(
    "SELECT id, name FROM students WHERE id=? AND institution_id=?",
    [input.studentId, institutionId],
    db
  );
  if (!student) throw new Error("Student not found.");

  const code = `PRNT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const days = input.expiresInDays && input.expiresInDays > 0 ? input.expiresInDays : 14;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const id = randomUUID();

  await run(
    `INSERT INTO parent_invitations(id, institution_id, student_id, parent_name, parent_email, parent_phone, invitation_code, status, expires_at, created_by)
     VALUES(?,?,?,?,?,?,?,'PENDING',?,?)`,
    [
      id,
      institutionId,
      input.studentId,
      input.parentName.trim(),
      input.parentEmail.trim().toLowerCase(),
      input.parentPhone?.trim() || "",
      code,
      expiresAt,
      createdBy,
    ],
    db
  );

  await audit(institutionId, createdBy, "Created Parent Invitation", "parent_invitations", id, { studentId: input.studentId, code, expiresAt }, db);
  return { id, code, expiresAt, parentEmail: input.parentEmail, parentName: input.parentName, studentName: student.name };
}

export async function expireParentInvitation(id: string) {
  const db = await ready();
  await run("UPDATE parent_invitations SET status='EXPIRED' WHERE id=?", [id], db);
}

export async function activateParentAccount(
  institutionId: string | undefined,
  input: {
    invitationCode?: string;
    admission?: string;
    parentPhone?: string;
    email: string;
    passwordHash: string;
    name: string;
  }
) {
  const db = await ready();
  let studentId: string | null = null;
  let invitationId: string | null = null;
  let targetInstitutionId = institutionId || "";

  if (input.invitationCode) {
    const inv = await row<{ id: string; studentId: string; status: string; expiresAt: string; institutionId: string }>(
      `SELECT id, student_id AS "studentId", status, expires_at::text AS "expiresAt", institution_id AS "institutionId"
       FROM parent_invitations WHERE invitation_code=?`,
      [input.invitationCode.trim().toUpperCase()],
      db
    );
    if (!inv) throw new Error("Invalid invitation code.");
    if (inv.status !== "PENDING") throw new Error(`Invitation code is already ${inv.status.toLowerCase()}.`);
    if (new Date(inv.expiresAt).getTime() < Date.now()) {
      await run("UPDATE parent_invitations SET status='EXPIRED' WHERE id=?", [inv.id], db);
      throw new Error("Invitation code has expired. Please contact the school.");
    }
    studentId = inv.studentId;
    invitationId = inv.id;
    targetInstitutionId = inv.institutionId;
  } else if (input.admission && input.parentPhone) {
    const student = targetInstitutionId
      ? await row<{ id: string; institutionId: string }>(
          'SELECT id, institution_id AS "institutionId" FROM students WHERE institution_id=? AND admission=? AND (parent_phone=? OR parent_phone LIKE ?)',
          [targetInstitutionId, input.admission.trim(), input.parentPhone.trim(), `%${input.parentPhone.trim()}`],
          db
        )
      : await row<{ id: string; institutionId: string }>(
          'SELECT id, institution_id AS "institutionId" FROM students WHERE admission=? AND (parent_phone=? OR parent_phone LIKE ?)',
          [input.admission.trim(), input.parentPhone.trim(), `%${input.parentPhone.trim()}`],
          db
        );
    if (!student) throw new Error("No student found matching the provided admission number and parent phone.");
    studentId = student.id;
    targetInstitutionId = student.institutionId;
  } else {
    throw new Error("Provide an invitation code or student admission number with registered phone.");
  }

  const email = input.email.trim().toLowerCase();
  let user = await findUserByEmail(email);
  let userId: string;

  if (user) {
    if (user.institutionId !== targetInstitutionId) {
      throw new Error("An account with this email already belongs to a different school.");
    }
    userId = user.id;
    if (user.role !== "PARENT" && user.role !== "SUPER_ADMIN" && user.role !== "SCHOOL_ADMIN") {
      await run("UPDATE users SET role='PARENT' WHERE id=?", [userId], db);
    }
    await run("UPDATE users SET password_hash=?, name=? WHERE id=?", [input.passwordHash, input.name.trim(), userId], db);
  } else {
    userId = randomUUID();
    await run(
      "INSERT INTO users(id, email, name, password_hash, role, institution_id) VALUES(?,?,?,?, 'PARENT', ?)",
      [userId, email, input.name.trim(), input.passwordHash, targetInstitutionId],
      db
    );
  }

  if (studentId) {
    await linkStudentToParent(targetInstitutionId, userId, studentId, "Parent", true);
  }

  if (invitationId) {
    await run("UPDATE parent_invitations SET status='ACCEPTED', accepted_at=CURRENT_TIMESTAMP WHERE id=?", [invitationId], db);
  }

  await audit(targetInstitutionId, userId, "Activated Parent Account", "users", userId, { email, studentId }, db);
  return { userId, email, name: input.name, studentId, institutionId: targetInstitutionId };
}

export async function parentChildAttendance(institutionId: string, studentId: string, month?: string) {
  const db = await ready();
  const clauses = ["institution_id = ?", "student_id = ?"];
  const params: unknown[] = [institutionId, studentId];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    clauses.push("date LIKE ?");
    params.push(`${month}%`);
  }
  const records = await rows<{ id: string; date: string; status: string; remarks: string }>(
    `SELECT id, date, status, remarks FROM attendance WHERE ${clauses.join(" AND ")} ORDER BY date DESC`,
    params,
    db
  );
  const totalDays = records.length;
  let presentCount = 0, absentCount = 0, lateCount = 0, excusedCount = 0, halfDayCount = 0;
  for (const r of records) {
    if (r.status === "Present") presentCount++;
    else if (r.status === "Absent") absentCount++;
    else if (r.status === "Late") lateCount++;
    else if (r.status === "Excused" || r.status === "Leave") excusedCount++;
    else if (r.status === "Half-day" || r.status === "Half Day") halfDayCount++;
  }
  const effectivePresent = presentCount + lateCount + halfDayCount * 0.5;
  const attendancePercentage = totalDays > 0 ? Math.round((effectivePresent / totalDays) * 100) : 100;
  return {
    records,
    summary: {
      totalDays,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      halfDayCount,
      attendancePercentage,
    },
  };
}

export async function parentChildFees(institutionId: string, studentId: string) {
  const db = await ready();
  const invoices = await rows<{
    id: string;
    invoiceNumber: string;
    feeType: string;
    academicYear: string;
    originalAmount: number;
    discount: number;
    lateFee: number;
    finalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    dueDate: string;
    status: string;
  }>(
    `SELECT id, invoice_number AS "invoiceNumber", fee_type AS "feeType", academic_year AS "academicYear",
            total_amount AS "originalAmount", discount, 0 AS "lateFee",
            final_amount AS "finalAmount", paid_amount AS "paidAmount", pending_amount AS "pendingAmount",
            due_date AS "dueDate", status
     FROM fees WHERE institution_id = ? AND student_id = ? ORDER BY due_date DESC`,
    [institutionId, studentId],
    db
  );
  const payments = await rows<{
    id: string;
    receiptNumber: string;
    feeId: string;
    amount: number;
    paymentMethod: string;
    transactionId: string;
    paymentDate: string;
    status: string;
    notes: string;
  }>(
    `SELECT id, receipt_number AS "receiptNumber", fee_id AS "feeId", amount,
            payment_method AS "paymentMethod", transaction_id AS "transactionId",
            payment_date AS "paymentDate", status, notes
     FROM payments WHERE institution_id = ? AND student_id = ? ORDER BY payment_date DESC, created_at DESC`,
    [institutionId, studentId],
    db
  );
  const receipts = await rows<{
    id: string;
    receiptNumber: string;
    invoiceNumber: string;
    amount: number;
    paymentMethod: string;
    transactionId: string;
    issuedDate: string;
    status: string;
  }>(
    `SELECT id, receipt_number AS "receiptNumber", invoice_number AS "invoiceNumber",
            amount, payment_method AS "paymentMethod", transaction_id AS "transactionId",
            issued_date AS "issuedDate", status
     FROM receipts WHERE institution_id = ? AND student_id = ? ORDER BY issued_date DESC, created_at DESC`,
    [institutionId, studentId],
    db
  );
  const totalFee = invoices.reduce((acc, curr) => acc + curr.finalAmount, 0);
  const paidFee = payments.filter((p) => p.status === "Success").reduce((acc, curr) => acc + curr.amount, 0);
  const pendingFee = Math.max(0, totalFee - paidFee);
  const paymentSettings = await getSchoolPaymentSettings(institutionId);
  const qrPayments = await rows<{
    id: string;
    feeId: string;
    amount: number;
    utrNumber: string;
    paymentDate: string;
    screenshotAssetId: string | null;
    status: "PENDING" | "VERIFIED" | "REJECTED" | "REFUNDED";
    rejectionReason: string;
    notes: string;
    createdAt: string;
    verifiedAt: string | null;
  }>(
    `SELECT id, fee_id AS "feeId", amount, utr_number AS "utrNumber", payment_date AS "paymentDate",
            screenshot_asset_id AS "screenshotAssetId", status, rejection_reason AS "rejectionReason",
            notes, created_at::text AS "createdAt", verified_at::text AS "verifiedAt"
     FROM school_qr_payments
     WHERE institution_id = ? AND student_id = ?
     ORDER BY created_at DESC`,
    [institutionId, studentId],
    db
  );
  return {
    invoices,
    payments,
    receipts,
    summary: { totalFee, paidFee, pendingFee },
    paymentSettings,
    qrPayments,
  };
}

export async function getParentChildFeeInvoice(institutionId: string, studentId: string, feeId: string) {
  const db = await ready();
  return await row<{
    id: string;
    invoiceNumber: string;
    pendingAmount: number;
    finalAmount: number;
    status: string;
  }>(
    'SELECT id, invoice_number AS "invoiceNumber", pending_amount AS "pendingAmount", final_amount AS "finalAmount", status FROM fees WHERE institution_id=? AND student_id=? AND id=?',
    [institutionId, studentId, feeId],
    db
  );
}

export async function parentChildResults(institutionId: string, studentId: string) {
  const db = await ready();
  const snapshots = await rows<{ snapshot: Record<string, unknown> | string }>(
    `SELECT s.snapshot
     FROM result_publication_snapshots s
     WHERE s.institution_id = ? AND s.version = (
       SELECT MAX(latest.version) FROM result_publication_snapshots latest
       WHERE latest.institution_id = s.institution_id AND latest.examination_id = s.examination_id
     )
     ORDER BY s.published_at DESC`,
    [institutionId],
    db,
  );
  const results: Array<{
    id: string; examId: string; examName: string; subject: string; examDate: string;
    maxMarks: number; passingMarks: number; marks: number; grade: string; status: string; remarks: string;
  }> = [];

  for (const record of snapshots) {
    let snapshot: Record<string, unknown>;
    try {
      snapshot = typeof record.snapshot === "string" ? JSON.parse(record.snapshot) : record.snapshot;
    } catch {
      continue;
    }
    const exam = snapshot.exam as { id?: string; name?: string; startDate?: string } | undefined;
    const students = snapshot.students as Array<{
      id?: string;
      subjects?: Array<{ subjectId?: string; subject?: string; maximumCent?: number; passingCent?: number; obtainedCent?: number | null; markStatus?: string | null; remarks?: string }>;
    }> | undefined;
    const student = students?.find((item) => item.id === studentId);
    if (!exam?.id || !student) continue;
    const settings = snapshot.settings as { gradeBands?: Array<{ minimum: number; grade: string }> } | undefined;

    for (const subject of student.subjects || []) {
      if (!subject.subjectId) continue;
      const maximumCent = Number(subject.maximumCent || 0);
      const passingCent = Number(subject.passingCent || 0);
      const marksCent = subject.markStatus === "Scored" ? Number(subject.obtainedCent || 0) : 0;
      const percentage = maximumCent > 0 ? marksCent / maximumCent * 100 : 0;
      const grade = (settings?.gradeBands || [])
        .slice()
        .sort((a, b) => b.minimum - a.minimum)
        .find((band) => percentage >= band.minimum)?.grade || "—";
      results.push({
        id: `${exam.id}:${subject.subjectId}`,
        examId: exam.id,
        examName: exam.name || "Examination",
        subject: subject.subject || "Subject",
        examDate: exam.startDate || "",
        maxMarks: maximumCent / 100,
        passingMarks: passingCent / 100,
        marks: marksCent / 100,
        grade,
        status: subject.markStatus === "Absent" ? "Absent" : subject.markStatus === "Exempt" ? "Exempt" : marksCent >= passingCent ? "Pass" : "Fail",
        remarks: subject.remarks || "",
      });
    }
  }
  return results.sort((a, b) => b.examDate.localeCompare(a.examDate) || a.subject.localeCompare(b.subject));
}

export async function parentChildHomework(institutionId: string, className: string, section: string) {
  const records = (await listModuleRecords(institutionId, "teacher_homework")) as Array<{
    id: string;
    title: string;
    description: string;
    className: string;
    section: string;
    subject: string;
    dueDate: string;
    status: "Active" | "Archived";
    createdAt?: string;
  }>;
  return records.filter((hw) => {
    const matchClass = (hw.className || "").toLowerCase().trim() === className.toLowerCase().trim();
    const matchSection = !hw.section || hw.section.toLowerCase().trim() === section.toLowerCase().trim();
    return matchClass && matchSection;
  });
}

export async function parentChildTimetable(institutionId: string, className: string, section: string, academicYear: string) {
  const db = await ready();
  await ensureTimetableSchema(db).catch(() => {});
  try {
    return await rows<{
      id: string;
      subject: string;
      teacherName: string;
      weekday: number;
      startTime: string;
      endTime: string;
    }>(
      `SELECT t.id, t.subject, COALESCE(tc.name, '') AS "teacherName",
              t.weekday, t.start_time AS "startTime", t.end_time AS "endTime"
       FROM timetable_entries t
       LEFT JOIN teachers tc ON tc.id = t.teacher_id AND tc.institution_id = t.institution_id
       WHERE t.institution_id = ? AND t.class_name = ? AND (t.section = ? OR t.section = '') AND t.academic_year = ? AND COALESCE(t.status, 'Published')='Published'
       ORDER BY t.weekday ASC, t.start_time ASC`,
      [institutionId, className, section, academicYear],
      db
    );
  } catch {
    return await rows<{
      id: string;
      subject: string;
      teacherName: string;
      weekday: number;
      startTime: string;
      endTime: string;
    }>(
      `SELECT t.id, t.subject, COALESCE(tc.name, '') AS "teacherName",
              t.weekday, t.start_time AS "startTime", t.end_time AS "endTime"
       FROM timetable_entries t
       LEFT JOIN teachers tc ON tc.id = t.teacher_id AND tc.institution_id = t.institution_id
       WHERE t.institution_id = ? AND t.class_name = ? AND (t.section = ? OR t.section = '') AND t.academic_year = ?
       ORDER BY t.weekday ASC, t.start_time ASC`,
      [institutionId, className, section, academicYear],
      db
    ).catch(() => []);
  }
}

export async function parentChildOverview(institutionId: string, parentUserId: string, studentId: string) {
  const db = await ready();
  const children = await parentChildren(institutionId, parentUserId);
  const child = children.find((c) => c.id === studentId);
  if (!child) throw new Error("Child not found or access unauthorized.");

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const todayAttendance = await row<{ status: string; remarks: string }>(
    "SELECT status, remarks FROM attendance WHERE institution_id=? AND student_id=? AND date=?",
    [institutionId, studentId, todayStr],
    db
  );

  const attendanceData = await parentChildAttendance(institutionId, studentId);
  const feesData = await parentChildFees(institutionId, studentId);
  const resultsData = await parentChildResults(institutionId, studentId);
  const homeworkData = await parentChildHomework(institutionId, child.className, child.section);
  const timetableData = await parentChildTimetable(institutionId, child.className, child.section, child.academicYear);
  const announcements = await listModuleRecords(institutionId, "announcements");

  return {
    child,
    todayAttendance: todayAttendance?.status || "Not Marked",
    attendanceSummary: attendanceData.summary,
    recentAttendance: attendanceData.records.slice(0, 7),
    feesSummary: feesData.summary,
    pendingInvoices: feesData.invoices.filter((inv) => inv.status !== "Paid"),
    recentPayments: feesData.payments.slice(0, 5),
    recentResults: resultsData.slice(0, 5),
    activeHomework: homeworkData.filter((h) => h.status === "Active").slice(0, 5),
    todayTimetable: timetableData.filter((t) => {
      const jsDay = new Date().getDay();
      return t.weekday === (jsDay === 0 ? 7 : jsDay);
    }),
    announcements: announcements.slice(0, 5),
  };
}

export interface SchoolNotificationSettings {
  institutionId: string;
  pushEnabled: boolean;
  studentAbsent: boolean;
  attendanceCorrection: boolean;
  feePayment: boolean;
  feeReminders: boolean;
  homework: boolean;
  examResults: boolean;
  announcements: boolean;
  teacherLeave: boolean;
  updatedAt: string;
}

export async function getSchoolNotificationSettings(institutionId: string): Promise<SchoolNotificationSettings> {
  const db = await ready();
  let existing = await row<{
    institutionId: string;
    pushEnabled: boolean;
    studentAbsent: boolean;
    attendanceCorrection: boolean;
    feePayment: boolean;
    feeReminders: boolean;
    homework: boolean;
    examResults: boolean;
    announcements: boolean;
    teacherLeave: boolean;
    updatedAt: string;
  }>(
    `SELECT institution_id AS "institutionId",
            push_enabled AS "pushEnabled",
            student_absent AS "studentAbsent",
            attendance_correction AS "attendanceCorrection",
            fee_payment AS "feePayment",
            fee_reminders AS "feeReminders",
            homework AS "homework",
            exam_results AS "examResults",
            announcements AS "announcements",
            teacher_leave AS "teacherLeave",
            updated_at::text AS "updatedAt"
     FROM school_notification_settings WHERE institution_id=?`,
    [institutionId],
    db
  );

  if (!existing) {
    await run(
      `INSERT INTO school_notification_settings(
        institution_id, push_enabled, student_absent, attendance_correction,
        fee_payment, fee_reminders, homework, exam_results, announcements, teacher_leave
      ) VALUES (?, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
      ON CONFLICT(institution_id) DO NOTHING`,
      [institutionId],
      db
    );
    existing = await row(
      `SELECT institution_id AS "institutionId",
              push_enabled AS "pushEnabled",
              student_absent AS "studentAbsent",
              attendance_correction AS "attendanceCorrection",
              fee_payment AS "feePayment",
              fee_reminders AS "feeReminders",
              homework AS "homework",
              exam_results AS "examResults",
              announcements AS "announcements",
              teacher_leave AS "teacherLeave",
              updated_at::text AS "updatedAt"
       FROM school_notification_settings WHERE institution_id=?`,
      [institutionId],
      db
    );
  }

  return {
    institutionId,
    pushEnabled: Boolean(existing?.pushEnabled ?? true),
    studentAbsent: Boolean(existing?.studentAbsent ?? true),
    attendanceCorrection: Boolean(existing?.attendanceCorrection ?? true),
    feePayment: Boolean(existing?.feePayment ?? true),
    feeReminders: Boolean(existing?.feeReminders ?? true),
    homework: Boolean(existing?.homework ?? true),
    examResults: Boolean(existing?.examResults ?? true),
    announcements: Boolean(existing?.announcements ?? true),
    teacherLeave: Boolean(existing?.teacherLeave ?? true),
    updatedAt: existing?.updatedAt || new Date().toISOString(),
  };
}

export async function updateSchoolNotificationSettings(
  institutionId: string,
  settings: Partial<Omit<SchoolNotificationSettings, "institutionId" | "updatedAt">>
): Promise<SchoolNotificationSettings> {
  const current = await getSchoolNotificationSettings(institutionId);
  const next = {
    pushEnabled: settings.pushEnabled !== undefined ? settings.pushEnabled : current.pushEnabled,
    studentAbsent: settings.studentAbsent !== undefined ? settings.studentAbsent : current.studentAbsent,
    attendanceCorrection: settings.attendanceCorrection !== undefined ? settings.attendanceCorrection : current.attendanceCorrection,
    feePayment: settings.feePayment !== undefined ? settings.feePayment : current.feePayment,
    feeReminders: settings.feeReminders !== undefined ? settings.feeReminders : current.feeReminders,
    homework: settings.homework !== undefined ? settings.homework : current.homework,
    examResults: settings.examResults !== undefined ? settings.examResults : current.examResults,
    announcements: settings.announcements !== undefined ? settings.announcements : current.announcements,
    teacherLeave: settings.teacherLeave !== undefined ? settings.teacherLeave : current.teacherLeave,
  };

  const db = await ready();
  await run(
    `INSERT INTO school_notification_settings(
      institution_id, push_enabled, student_absent, attendance_correction,
      fee_payment, fee_reminders, homework, exam_results, announcements, teacher_leave, updated_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(institution_id) DO UPDATE SET
      push_enabled=EXCLUDED.push_enabled,
      student_absent=EXCLUDED.student_absent,
      attendance_correction=EXCLUDED.attendance_correction,
      fee_payment=EXCLUDED.fee_payment,
      fee_reminders=EXCLUDED.fee_reminders,
      homework=EXCLUDED.homework,
      exam_results=EXCLUDED.exam_results,
      announcements=EXCLUDED.announcements,
      teacher_leave=EXCLUDED.teacher_leave,
      updated_at=CURRENT_TIMESTAMP`,
    [
      institutionId,
      next.pushEnabled,
      next.studentAbsent,
      next.attendanceCorrection,
      next.feePayment,
      next.feeReminders,
      next.homework,
      next.examResults,
      next.announcements,
      next.teacherLeave,
    ],
    db
  );

  return getSchoolNotificationSettings(institutionId);
}

export async function registerDeviceToken(
  institutionId: string,
  userId: string,
  token: string,
  deviceType: string = "web",
  userAgent: string = ""
): Promise<{ id: string; token: string; status: string }> {
  const db = await ready();
  const id = randomUUID();
  await run(
    `INSERT INTO fcm_device_tokens(id, institution_id, user_id, token, device_type, user_agent, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)
     ON CONFLICT(token) DO UPDATE SET
       user_id=EXCLUDED.user_id,
       institution_id=EXCLUDED.institution_id,
       device_type=EXCLUDED.device_type,
       user_agent=EXCLUDED.user_agent,
       status='ACTIVE',
       revoked_at=NULL,
       updated_at=CURRENT_TIMESTAMP`,
    [id, institutionId, userId, token, deviceType, userAgent],
    db
  );
  const registered = await row<{ id: string; token: string; status: string }>(
    `SELECT id, token, status FROM fcm_device_tokens WHERE token=?`,
    [token],
    db
  );
  return registered || { id, token, status: "ACTIVE" };
}

export async function revokeDeviceToken(token: string, userId?: string): Promise<boolean> {
  const db = await ready();
  let sql = `UPDATE fcm_device_tokens SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE token=?`;
  const params: unknown[] = [token];
  if (userId) {
    sql += ` AND user_id=?`;
    params.push(userId);
  }
  const updated = await run(sql, params, db);
  return Boolean(updated);
}

export async function getUserActiveDeviceTokens(userId: string): Promise<
  Array<{ id: string; institutionId: string; token: string; deviceType: string; userAgent: string }>
> {
  const db = await ready();
  return rows(
    `SELECT id, institution_id AS "institutionId", token, device_type AS "deviceType", user_agent AS "userAgent"
     FROM fcm_device_tokens
     WHERE user_id=? AND status='ACTIVE'`,
    [userId],
    db
  );
}

export async function getPwaDiagnosticsData(institutionId: string) {
  const db = await ready();
  const tokenSummary = await rows<{ deviceType: string; count: number }>(
    `SELECT device_type AS "deviceType", COUNT(*)::int AS count
     FROM fcm_device_tokens
     WHERE institution_id = ? AND status = 'ACTIVE'
     GROUP BY device_type`,
    [institutionId],
    db
  ).catch(() => []);

  const totalActiveDevices = tokenSummary.reduce((sum: number, item: { count: number }) => sum + item.count, 0);

  const deliveryStats = await row<{
    total: number;
    delivered: number;
    pending: number;
    failed: number;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered,
       COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
     FROM notification_deliveries
     WHERE institution_id = ?`,
    [institutionId],
    db
  ).catch(() => ({ total: 0, delivered: 0, pending: 0, failed: 0 }));

  const notifSettings = await getSchoolNotificationSettings(institutionId).catch(() => null);

  return {
    tokenSummary,
    totalActiveDevices,
    deliveryStats: deliveryStats || { total: 0, delivered: 0, pending: 0, failed: 0 },
    notifSettings,
  };
}

export async function getNotificationEventByKey(eventKey: string) {
  const db = await ready();
  const res = await row<{
    id: string;
    institutionId: string;
    eventKey: string;
    eventType: string;
    title: string;
    body: string;
    data: unknown;
    deepLink: string;
    recipientUserIds: unknown;
    status: string;
    createdAt: string;
  }>(
    `SELECT id, institution_id AS "institutionId", event_key AS "eventKey", event_type AS "eventType",
            title, body, data, deep_link AS "deepLink", recipient_user_ids AS "recipientUserIds",
            status, created_at::text AS "createdAt"
     FROM notification_events WHERE event_key=?`,
    [eventKey],
    db
  );
  if (!res) return null;
  return {
    ...res,
    data: typeof res.data === "string" ? JSON.parse(res.data) : res.data || {},
    recipientUserIds: typeof res.recipientUserIds === "string" ? JSON.parse(res.recipientUserIds) : res.recipientUserIds || [],
  };
}

export async function createNotificationEvent(event: {
  institutionId: string;
  eventKey: string;
  eventType: string;
  title: string;
  body: string;
  deepLink?: string;
  data?: Record<string, unknown>;
  recipientUserIds: string[];
  status?: "QUEUED" | "PROCESSED" | "FAILED";
}) {
  const db = await ready();
  const id = randomUUID();
  await run(
    `INSERT INTO notification_events(id, institution_id, event_key, event_type, title, body, data, deep_link, recipient_user_ids, status)
     VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?::jsonb, ?)
     ON CONFLICT(event_key) DO NOTHING`,
    [
      id,
      event.institutionId,
      event.eventKey,
      event.eventType,
      event.title,
      event.body,
      JSON.stringify(event.data || {}),
      event.deepLink || "",
      JSON.stringify(event.recipientUserIds || []),
      event.status || "PROCESSED",
    ],
    db
  );
  return getNotificationEventByKey(event.eventKey);
}

export async function createInAppNotification(data: {
  institutionId: string;
  userId: string;
  type: string;
  title: string;
  description: string;
  link?: string;
  deliveryStatus?: string;
}) {
  const db = await ready();
  const id = randomUUID();
  await run(
    `INSERT INTO notifications(id, institution_id, user_id, type, title, description, link, delivery_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.institutionId,
      data.userId,
      data.type,
      data.title,
      data.description,
      data.link || "",
      data.deliveryStatus || "SENT",
    ],
    db
  );
  return id;
}

export async function recordNotificationDelivery(delivery: {
  institutionId: string;
  eventId?: string;
  notificationId?: string;
  userId: string;
  deviceTokenId?: string;
  channel: "FCM" | "IN_APP";
  status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "REVOKED";
  attemptCount?: number;
  maxAttempts?: number;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
  nextRetryAt?: string;
  sentAt?: string;
  deliveredAt?: string;
}) {
  const db = await ready();
  const id = randomUUID();
  await run(
    `INSERT INTO notification_deliveries(
      id, institution_id, event_id, notification_id, user_id, device_token_id,
      channel, status, attempt_count, max_attempts, provider_message_id,
      error_code, error_message, next_retry_at, sent_at, delivered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      delivery.institutionId,
      delivery.eventId || null,
      delivery.notificationId || null,
      delivery.userId,
      delivery.deviceTokenId || null,
      delivery.channel,
      delivery.status,
      delivery.attemptCount || 1,
      delivery.maxAttempts || 3,
      delivery.providerMessageId || null,
      delivery.errorCode || "",
      delivery.errorMessage || "",
      delivery.nextRetryAt || null,
      delivery.sentAt || null,
      delivery.deliveredAt || null,
    ],
    db
  );
  return id;
}

export async function updateNotificationDeliveryStatus(
  deliveryId: string,
  updates: {
    status: "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "REVOKED";
    providerMessageId?: string;
    errorCode?: string;
    errorMessage?: string;
    attemptCount?: number;
    nextRetryAt?: string | null;
    sentAt?: string;
    deliveredAt?: string;
  }
) {
  const db = await ready();
  let sql = `UPDATE notification_deliveries SET status=?, updated_at=CURRENT_TIMESTAMP`;
  const params: unknown[] = [updates.status];

  if (updates.providerMessageId !== undefined) {
    sql += `, provider_message_id=?`;
    params.push(updates.providerMessageId);
  }
  if (updates.errorCode !== undefined) {
    sql += `, error_code=?`;
    params.push(updates.errorCode);
  }
  if (updates.errorMessage !== undefined) {
    sql += `, error_message=?`;
    params.push(updates.errorMessage);
  }
  if (updates.attemptCount !== undefined) {
    sql += `, attempt_count=?`;
    params.push(updates.attemptCount);
  }
  if (updates.nextRetryAt !== undefined) {
    sql += `, next_retry_at=?`;
    params.push(updates.nextRetryAt);
  }
  if (updates.sentAt !== undefined) {
    sql += `, sent_at=?`;
    params.push(updates.sentAt);
  }
  if (updates.deliveredAt !== undefined) {
    sql += `, delivered_at=?`;
    params.push(updates.deliveredAt);
  }

  sql += ` WHERE id=?`;
  params.push(deliveryId);

  await run(sql, params, db);
}

export async function acknowledgeNotificationDelivery(
  institutionId: string,
  userId: string,
  deliveryId: string,
): Promise<boolean> {
  const db = await ready();
  const delivery = await row<{ notificationId: string | null }>(
    `UPDATE notification_deliveries
     SET status='DELIVERED', delivered_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
     WHERE id=? AND institution_id=? AND user_id=? AND channel='FCM' AND status='SENT'
     RETURNING notification_id AS "notificationId"`,
    [deliveryId, institutionId, userId],
    db,
  );
  if (!delivery) return false;
  if (delivery.notificationId) {
    await run(
      `UPDATE notifications SET delivery_status='DELIVERED'
       WHERE id=? AND institution_id=? AND user_id=?`,
      [delivery.notificationId, institutionId, userId],
      db,
    );
  }
  return true;
}

export async function failNotificationDelivery(
  deliveryId: string,
  error: { code: string; message: string; retryable: boolean; nextRetryDelaySeconds?: number }
) {
  const db = await ready();
  const delivery = await row<{ id: string; attemptCount: number; maxAttempts: number }>(
    `SELECT id, attempt_count AS "attemptCount", max_attempts AS "maxAttempts" FROM notification_deliveries WHERE id=?`,
    [deliveryId],
    db
  );
  if (!delivery) return;

  const nextAttempts = delivery.attemptCount + 1;
  const isRetryable = error.retryable && nextAttempts < delivery.maxAttempts;
  const status = isRetryable ? "PENDING" : "FAILED";
  const nextRetryAt = isRetryable
    ? new Date(Date.now() + (error.nextRetryDelaySeconds || 60) * 1000).toISOString()
    : null;

  await run(
    `UPDATE notification_deliveries
     SET status=?, attempt_count=?, error_code=?, error_message=?, next_retry_at=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [status, nextAttempts, error.code, error.message, nextRetryAt, deliveryId],
    db
  );
}

export async function getPendingDeliveriesForRetry(limit: number = 20) {
  const db = await ready();
  return rows<{
    id: string;
    institutionId: string;
    eventId: string;
    notificationId: string;
    userId: string;
    deviceTokenId: string;
    token: string;
    channel: string;
    attemptCount: number;
    maxAttempts: number;
    title: string;
    body: string;
    deepLink: string;
    data: unknown;
  }>(
    `SELECT d.id, d.institution_id AS "institutionId", d.event_id AS "eventId",
            d.notification_id AS "notificationId", d.user_id AS "userId",
            d.device_token_id AS "deviceTokenId", t.token, d.channel,
            d.attempt_count AS "attemptCount", d.max_attempts AS "maxAttempts",
            e.title, e.body, e.deep_link AS "deepLink", e.data
     FROM notification_deliveries d
     JOIN notification_events e ON e.id = d.event_id
     LEFT JOIN fcm_device_tokens t ON t.id = d.device_token_id
     WHERE d.status='PENDING' AND d.attempt_count > 0 AND d.attempt_count < d.max_attempts
       AND (d.next_retry_at IS NULL OR d.next_retry_at <= CURRENT_TIMESTAMP)
     ORDER BY d.created_at ASC
     LIMIT ?`,
    [limit],
    db
  );
}

export async function getParentsForStudent(institutionId: string, studentId: string): Promise<string[]> {
  const db = await ready();
  const records = await rows<{ parentUserId: string }>(
    `SELECT parent_user_id AS "parentUserId"
     FROM parent_students
     WHERE institution_id=? AND student_id=?`,
    [institutionId, studentId],
    db
  );
  return records.map((r) => r.parentUserId);
}

export async function getParentsForClass(
  institutionId: string,
  className: string,
  section?: string
): Promise<string[]> {
  const db = await ready();
  let sql = `SELECT DISTINCT ps.parent_user_id AS "parentUserId"
     FROM parent_students ps
     JOIN student_enrollments e ON e.student_id = ps.student_id AND e.institution_id = ps.institution_id
     WHERE ps.institution_id=? AND e.class_name=? AND e.status='Active'`;
  const params: unknown[] = [institutionId, className];
  if (section) {
    sql += ` AND (e.section=? OR e.section='')`;
    params.push(section);
  }
  const records = await rows<{ parentUserId: string }>(sql, params, db);
  return records.map((r) => r.parentUserId);
}

export async function getTeacherUserId(institutionId: string, teacherId: string): Promise<string | null> {
  const db = await ready();
  const teacher = await row<{ email: string }>(
    `SELECT email FROM teachers WHERE institution_id=? AND id=?`,
    [institutionId, teacherId],
    db
  );
  if (!teacher || !teacher.email) return null;

  const user = await row<{ id: string }>(
    `SELECT id FROM users WHERE institution_id=? AND LOWER(email)=LOWER(?)`,
    [institutionId, teacher.email.trim()],
    db
  );
  return user?.id || null;
}

export async function getAllInstitutionUserIds(institutionId: string): Promise<string[]> {
  const db = await ready();
  const records = await rows<{ id: string }>(
    `SELECT id FROM users WHERE institution_id=? AND status='Active'`,
    [institutionId],
    db
  );
  return records.map((r) => r.id);
}

export async function getUserNotificationDeliveries(userId: string) {
  const db = await ready();
  return rows<{
    id: string;
    eventId: string | null;
    channel: string;
    status: string;
    errorCode: string;
    deliveredAt: string | null;
    sentAt: string | null;
  }>(
    `SELECT id, event_id AS "eventId", channel, status, error_code AS "errorCode",
            delivered_at::text AS "deliveredAt", sent_at::text AS "sentAt"
     FROM notification_deliveries
     WHERE user_id=?
     ORDER BY created_at DESC`,
    [userId],
    db
  );
}

// ==========================================
// SCHOOL QR PAYMENTS & FEE ACCOUNTING ENGINE
// ==========================================

export type SchoolPaymentSettings = {
  institutionName: string;
  upiEnabled: boolean;
  upiId: string;
  payeeName: string;
  paymentMethodName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  paymentInstructions: string;
  qrCodeUrl: string;
};

export async function getSchoolPaymentSettings(institutionId: string): Promise<SchoolPaymentSettings> {
  const db = await ready();
  await ensurePaymentSettingsSchema(db).catch(() => {});
  try {
    const rowData = await row<{
      institutionName: string;
      upiEnabled: boolean;
      upiId: string;
      payeeName: string;
      paymentMethodName: string;
      bankName: string;
      accountNumber: string;
      ifscCode: string;
      paymentInstructions: string;
    }>(
      `SELECT i.name AS "institutionName",
              COALESCE(s.upi_enabled, FALSE) AS "upiEnabled",
              COALESCE(s.upi_id, '') AS "upiId",
              COALESCE(s.payee_name, '') AS "payeeName",
              COALESCE(s.payment_method_name, 'School UPI / QR Code') AS "paymentMethodName",
              COALESCE(s.bank_name, '') AS "bankName",
              COALESCE(s.account_number, '') AS "accountNumber",
              COALESCE(s.ifsc_code, '') AS "ifscCode",
              COALESCE(s.payment_instructions, '') AS "paymentInstructions"
       FROM institutions i
       LEFT JOIN settings s ON s.institution_id = i.id
       WHERE i.id = ?`,
      [institutionId],
      db
    );

    const assets = await rows<{ kind: string }>(
      `SELECT kind FROM school_assets WHERE institution_id = ? AND kind = 'payment-qr'`,
      [institutionId],
      db
    );

    return {
      institutionName: rowData?.institutionName || "",
      upiEnabled: Boolean(rowData?.upiEnabled),
      upiId: rowData?.upiId || "",
      payeeName: rowData?.payeeName || rowData?.institutionName || "",
      paymentMethodName: rowData?.paymentMethodName || "School UPI / QR Code",
      bankName: rowData?.bankName || "",
      accountNumber: rowData?.accountNumber || "",
      ifscCode: rowData?.ifscCode || "",
      paymentInstructions: rowData?.paymentInstructions || "",
      qrCodeUrl: assets.length > 0 ? `/api/settings/assets/payment-qr` : "",
    };
  } catch {
    const inst = await row<{ name: string }>("SELECT name FROM institutions WHERE id = ?", [institutionId], db).catch(() => null);
    return {
      institutionName: inst?.name || "",
      upiEnabled: false,
      upiId: "",
      payeeName: inst?.name || "",
      paymentMethodName: "School UPI / QR Code",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      paymentInstructions: "",
      qrCodeUrl: "",
    };
  }
}

export async function saveSchoolPaymentSettings(
  institutionId: string,
  userId: string,
  input: {
    upiEnabled?: boolean;
    upiId?: string;
    payeeName?: string;
    paymentMethodName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    paymentInstructions?: string;
  }
): Promise<SchoolPaymentSettings> {
  const db = await ready();
  await ensurePaymentSettingsSchema(db);
  await db.begin(async (tx) => {
    await run(
      `INSERT INTO settings(
         institution_id, upi_enabled, upi_id, payee_name, payment_method_name,
         bank_name, account_number, ifsc_code, payment_instructions
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(institution_id) DO UPDATE SET
         upi_enabled = COALESCE(EXCLUDED.upi_enabled, settings.upi_enabled),
         upi_id = COALESCE(EXCLUDED.upi_id, settings.upi_id),
         payee_name = COALESCE(EXCLUDED.payee_name, settings.payee_name),
         payment_method_name = COALESCE(EXCLUDED.payment_method_name, settings.payment_method_name),
         bank_name = COALESCE(EXCLUDED.bank_name, settings.bank_name),
         account_number = COALESCE(EXCLUDED.account_number, settings.account_number),
         ifsc_code = COALESCE(EXCLUDED.ifsc_code, settings.ifsc_code),
         payment_instructions = COALESCE(EXCLUDED.payment_instructions, settings.payment_instructions),
         updated_at = CURRENT_TIMESTAMP`,
      [
        institutionId,
        input.upiEnabled ?? false,
        input.upiId ?? "",
        input.payeeName ?? "",
        input.paymentMethodName ?? "School UPI / QR Code",
        input.bankName ?? "",
        input.accountNumber ?? "",
        input.ifscCode ?? "",
        input.paymentInstructions ?? "",
      ],
      tx
    );
    await audit(institutionId, userId, "School Payment Settings Updated", "Settings", institutionId, input, tx);
  });
  return getSchoolPaymentSettings(institutionId);
}

export type SchoolQrPaymentSubmission = {
  feeId: string;
  amount: number;
  utrNumber: string;
  paymentDate: string;
  notes?: string;
  screenshotBuffer?: Buffer;
  screenshotMime?: string;
};

export async function submitSchoolQrPayment(
  institutionId: string,
  studentId: string,
  input: SchoolQrPaymentSubmission
) {
  const db = await ready();
  await ensurePaymentSettingsSchema(db);
  const cleanUtr = input.utrNumber.trim();
  if (!cleanUtr || cleanUtr.length < 4 || cleanUtr.length > 50) {
    throw new Error("Enter a valid UTR or UPI transaction reference number.");
  }
  const cleanAmount = Number(input.amount);
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const paymentSettings = await getSchoolPaymentSettings(institutionId);
  if (!paymentSettings.upiEnabled) {
    throw new Error("School UPI / QR payments are currently disabled.");
  }

  // Ensure UTR uniqueness within the school (both in school_qr_payments and existing payments)
  const existingUtr = await row<{ id: string; status: string }>(
    `SELECT id, status FROM school_qr_payments WHERE institution_id = ? AND UPPER(utr_number) = UPPER(?)`,
    [institutionId, cleanUtr],
    db
  );
  if (existingUtr) {
    if (existingUtr.status === "VERIFIED") {
      throw new Error(`A payment with UTR "${cleanUtr}" has already been verified and credited.`);
    }
    if (existingUtr.status === "PENDING") {
      throw new Error(`A payment with UTR "${cleanUtr}" is currently pending verification by the school office.`);
    }
    throw new Error(`A payment with UTR "${cleanUtr}" has already been submitted (Status: ${existingUtr.status}).`);
  }

  const existingPayment = await row<{ id: string }>(
    `SELECT id FROM payments WHERE institution_id = ? AND UPPER(transaction_id) = UPPER(?) AND status <> 'Voided' LIMIT 1`,
    [institutionId, cleanUtr],
    db
  );
  if (existingPayment) {
    throw new Error(`A payment with reference "${cleanUtr}" is already recorded in the fee collection system.`);
  }

  // Verify fee invoice
  const fee = await row<{ id: string; pendingAmount: number; status: string }>(
    `SELECT id, pending_amount AS "pendingAmount", status FROM fees WHERE institution_id = ? AND student_id = ? AND id = ?`,
    [institutionId, studentId, input.feeId],
    db
  );
  if (!fee) {
    throw new Error("Fee invoice not found for this student.");
  }
  if (fee.pendingAmount <= 0 || fee.status === "Paid") {
    throw new Error("This fee invoice is already fully paid.");
  }
  if (cleanAmount > fee.pendingAmount) {
    throw new Error(`Amount ₹${cleanAmount} exceeds the pending balance of ₹${fee.pendingAmount}.`);
  }

  const id = randomUUID();
  let screenshotAssetId: string | null = null;

  if (input.screenshotBuffer && input.screenshotMime) {
    const kind = `payment-screenshot:${id}`;
    await putSchoolAsset(institutionId, studentId, kind, input.screenshotMime, input.screenshotBuffer);
    screenshotAssetId = kind;
  }

  await run(
    `INSERT INTO school_qr_payments(
       id, institution_id, student_id, fee_id, amount, utr_number, payment_date,
       screenshot_asset_id, status, rejection_reason, notes
     ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', '', ?)`,
    [
      id,
      institutionId,
      studentId,
      input.feeId,
      cleanAmount,
      cleanUtr,
      input.paymentDate || new Date().toISOString().slice(0, 10),
      screenshotAssetId,
      input.notes || "",
    ],
    db
  );

  return {
    id,
    institutionId,
    studentId,
    feeId: input.feeId,
    amount: cleanAmount,
    utrNumber: cleanUtr,
    paymentDate: input.paymentDate || new Date().toISOString().slice(0, 10),
    screenshotAssetId,
    status: "PENDING" as const,
  };
}

export async function listSchoolQrPayments(
  institutionId: string,
  filters?: {
    status?: string;
    search?: string;
    studentId?: string;
    limit?: number;
    offset?: number;
  }
) {
  const db = await ready();
  await ensurePaymentSettingsSchema(db);
  const where: string[] = ["qp.institution_id = ?"];
  const args: unknown[] = [institutionId];

  if (filters?.status && filters.status !== "All") {
    where.push("qp.status = ?");
    args.push(filters.status);
  }
  if (filters?.studentId) {
    where.push("qp.student_id = ?");
    args.push(filters.studentId);
  }
  if (filters?.search) {
    const q = `%${filters.search.trim()}%`;
    where.push("(s.name ILIKE ? OR s.admission ILIKE ? OR qp.utr_number ILIKE ? OR f.invoice_number ILIKE ?)");
    args.push(q, q, q, q);
  }

  const countRow = await row<{ count: number }>(
    `SELECT COUNT(*)::int count
     FROM school_qr_payments qp
     JOIN students s ON s.id = qp.student_id AND s.institution_id = qp.institution_id
     JOIN fees f ON f.id = qp.fee_id AND f.institution_id = qp.institution_id
     WHERE ${where.join(" AND ")}`,
    args,
    db
  );

  const limit = Math.min(filters?.limit ?? 50, 200);
  const offset = Math.max(filters?.offset ?? 0, 0);

  const items = await rows<{
    id: string;
    studentId: string;
    studentName: string;
    admission: string;
    rollNumber: string;
    className: string;
    section: string;
    photoPath: string | null;
    feeId: string;
    invoiceNumber: string;
    feeType: string;
    feeTotalAmount: number;
    feePaidAmount: number;
    feePendingAmount: number;
    amount: number;
    utrNumber: string;
    paymentDate: string;
    screenshotAssetId: string | null;
    status: "PENDING" | "VERIFIED" | "REJECTED" | "REFUNDED";
    rejectionReason: string;
    verifiedBy: string | null;
    verifiedByName: string | null;
    verifiedAt: string | null;
    paymentId: string | null;
    receiptNumber: string | null;
    notes: string;
    createdAt: string;
  }>(
    `SELECT qp.id,
            qp.student_id AS "studentId",
            s.name AS "studentName",
            s.admission,
            s.roll_number AS "rollNumber",
            s.class_name AS "className",
            s.section,
            s.photo_path AS "photoPath",
            qp.fee_id AS "feeId",
            f.invoice_number AS "invoiceNumber",
            f.fee_type AS "feeType",
            f.final_amount AS "feeTotalAmount",
            f.paid_amount AS "feePaidAmount",
            f.pending_amount AS "feePendingAmount",
            qp.amount,
            qp.utr_number AS "utrNumber",
            qp.payment_date AS "paymentDate",
            qp.screenshot_asset_id AS "screenshotAssetId",
            qp.status,
            qp.rejection_reason AS "rejectionReason",
            qp.verified_by AS "verifiedBy",
            u.name AS "verifiedByName",
            qp.verified_at::text AS "verifiedAt",
            qp.payment_id AS "paymentId",
            p.receipt_number AS "receiptNumber",
            qp.notes,
            qp.created_at::text AS "createdAt"
     FROM school_qr_payments qp
     JOIN students s ON s.id = qp.student_id AND s.institution_id = qp.institution_id
     JOIN fees f ON f.id = qp.fee_id AND f.institution_id = qp.institution_id
     LEFT JOIN users u ON u.id = qp.verified_by
     LEFT JOIN payments p ON p.id = qp.payment_id
     WHERE ${where.join(" AND ")}
     ORDER BY CASE WHEN qp.status = 'PENDING' THEN 0 ELSE 1 END, qp.created_at DESC
     LIMIT ? OFFSET ?`,
    [...args, limit, offset],
    db
  );

  return {
    total: countRow?.count ?? 0,
    items,
  };
}

export async function getSchoolQrPayment(institutionId: string, paymentId: string) {
  const db = await ready();
  await ensurePaymentSettingsSchema(db);
  return await row<{
    id: string;
    studentId: string;
    studentName: string;
    admission: string;
    rollNumber: string;
    className: string;
    section: string;
    photoPath: string | null;
    feeId: string;
    invoiceNumber: string;
    feeType: string;
    amount: number;
    utrNumber: string;
    paymentDate: string;
    screenshotAssetId: string | null;
    status: "PENDING" | "VERIFIED" | "REJECTED" | "REFUNDED";
    rejectionReason: string;
    verifiedBy: string | null;
    verifiedByName: string | null;
    verifiedAt: string | null;
    paymentId: string | null;
    receiptNumber: string | null;
    notes: string;
    createdAt: string;
  }>(
    `SELECT qp.id,
            qp.student_id AS "studentId",
            s.name AS "studentName",
            s.admission,
            s.roll_number AS "rollNumber",
            s.class_name AS "className",
            s.section,
            s.photo_path AS "photoPath",
            qp.fee_id AS "feeId",
            f.invoice_number AS "invoiceNumber",
            f.fee_type AS "feeType",
            qp.amount,
            qp.utr_number AS "utrNumber",
            qp.payment_date AS "paymentDate",
            qp.screenshot_asset_id AS "screenshotAssetId",
            qp.status,
            qp.rejection_reason AS "rejectionReason",
            qp.verified_by AS "verifiedBy",
            u.name AS "verifiedByName",
            qp.verified_at::text AS "verifiedAt",
            qp.payment_id AS "paymentId",
            p.receipt_number AS "receiptNumber",
            qp.notes,
            qp.created_at::text AS "createdAt"
     FROM school_qr_payments qp
     JOIN students s ON s.id = qp.student_id AND s.institution_id = qp.institution_id
     JOIN fees f ON f.id = qp.fee_id AND f.institution_id = qp.institution_id
     LEFT JOIN users u ON u.id = qp.verified_by
     LEFT JOIN payments p ON p.id = qp.payment_id
     WHERE qp.institution_id = ? AND qp.id = ?`,
    [institutionId, paymentId],
    db
  );
}

export async function verifySchoolQrPayment(
  institutionId: string,
  adminUserId: string,
  paymentId: string,
  options?: { notes?: string }
) {
  let resultReceiptNumber = "";
  let paymentRecordId = "";

  await ensurePaymentSettingsSchema();
  await connection().begin(async (tx) => {
    // 1. Lock QR payment row
    const qrRow = await row<{
      id: string;
      studentId: string;
      feeId: string;
      amount: number;
      utrNumber: string;
      paymentDate: string;
      status: string;
      notes: string;
    }>(
      `SELECT id, student_id AS "studentId", fee_id AS "feeId", amount, utr_number AS "utrNumber",
              payment_date AS "paymentDate", status, notes
       FROM school_qr_payments
       WHERE institution_id = ? AND id = ?
       FOR UPDATE`,
      [institutionId, paymentId],
      tx
    );

    if (!qrRow) {
      throw new Error("QR Payment verification request not found.");
    }

    if (qrRow.status === "VERIFIED") {
      throw new Error("This payment has already been verified.");
    }
    if (qrRow.status === "REJECTED") {
      throw new Error("Cannot verify a rejected payment without re-submission.");
    }

    // 2. Lock fee invoice
    const fee = await row<{
      id: string;
      studentId: string;
      studentName: string;
      invoiceNumber: string;
      academicYear: string;
      finalAmount: number;
      paidAmount: number;
      pendingAmount: number;
    }>(
      `SELECT f.id, f.student_id AS "studentId", s.name AS "studentName", f.invoice_number AS "invoiceNumber",
              f.academic_year AS "academicYear", f.final_amount AS "finalAmount", f.paid_amount AS "paidAmount",
              f.pending_amount AS "pendingAmount"
       FROM fees f
       JOIN students s ON s.id = f.student_id AND s.institution_id = f.institution_id
       WHERE f.institution_id = ? AND f.id = ?
       FOR UPDATE`,
      [institutionId, qrRow.feeId],
      tx
    );

    if (!fee) {
      throw new Error("Fee invoice associated with this payment was not found.");
    }

    const cents = Math.round(qrRow.amount * 100);
    const pendingCents = Math.round(Number(fee.pendingAmount) * 100);
    const paidCents = Math.round(Number(fee.paidAmount) * 100);
    const finalCents = Math.round(Number(fee.finalAmount) * 100);

    if (cents > pendingCents) {
      throw new Error(`Verified amount ₹${qrRow.amount} exceeds current pending fee of ₹${fee.pendingAmount}.`);
    }

    // Generate formal receipt number
    const receipt = await nextNumber(institutionId, "REC", new Date(qrRow.paymentDate), tx);
    resultReceiptNumber = receipt;
    paymentRecordId = randomUUID();

    const newPaidAmount = (paidCents + cents) / 100;
    const newRemainingAmount = Math.max(0, (finalCents - paidCents - cents) / 100);
    const newFeeStatus = newRemainingAmount === 0 ? "Paid" : "Partially Paid";

    // 3. Insert into payments
    await run(
      `INSERT INTO payments(
         id, institution_id, student_id, fee_id, receipt_number, amount,
         payment_method, transaction_id, payment_date, status, notes,
         request_id, created_by, original_amount, net_payable
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'Success', ?, ?, ?, ?, ?)`,
      [
        paymentRecordId,
        institutionId,
        fee.studentId,
        fee.id,
        receipt,
        qrRow.amount,
        "School UPI / QR Code",
        qrRow.utrNumber,
        qrRow.paymentDate,
        options?.notes || qrRow.notes || `Verified QR Payment (UTR: ${qrRow.utrNumber})`,
        `qr_${qrRow.id}`,
        adminUserId,
        fee.pendingAmount,
        fee.pendingAmount,
      ],
      tx
    );

    // 4. Update fees table
    await run(
      `UPDATE fees
       SET paid_amount = ?, pending_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND institution_id = ?`,
      [newPaidAmount, newRemainingAmount, newFeeStatus, fee.id, institutionId],
      tx
    );

    // 5. Update student fee totals
    await run(
      `UPDATE students
       SET paid_fee = (SELECT COALESCE(SUM(paid_amount), 0) FROM fees WHERE student_id = ? AND institution_id = ?),
           pending_fee = (SELECT COALESCE(SUM(pending_amount), 0) FROM fees WHERE student_id = ? AND institution_id = ?),
           total_fee = (SELECT COALESCE(SUM(final_amount), 0) FROM fees WHERE student_id = ? AND institution_id = ?),
           fee = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND institution_id = ?`,
      [fee.studentId, institutionId, fee.studentId, institutionId, fee.studentId, institutionId, newFeeStatus, fee.studentId, institutionId],
      tx
    );

    // 6. Insert into receipts
    await run(
      `INSERT INTO receipts(
         id, institution_id, receipt_number, student_id, payment_id,
         invoice_number, amount, payment_method, transaction_id, issued_date
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        institutionId,
        receipt,
        fee.studentId,
        paymentRecordId,
        fee.invoiceNumber,
        qrRow.amount,
        "School UPI / QR Code",
        qrRow.utrNumber,
        qrRow.paymentDate,
      ],
      tx
    );

    // 7. Insert into account_transactions (Cash Book - EXACTLY ONE INCOME ENTRY)
    await run(
      `INSERT INTO account_transactions(
         id, institution_id, academic_year, transaction_type, category,
         amount_paise, transaction_date, description, payment_method,
         reference_number, source_type, source_id, status, notes, created_by
       ) VALUES(?, ?, ?, 'income', 'Student Fee Collection', ?, ?, ?, ?, ?, 'fee_payment', ?, 'Active', ?, ?)`,
      [
        randomUUID(),
        institutionId,
        String(fee.academicYear || ""),
        cents,
        qrRow.paymentDate,
        `${fee.studentName} · ${fee.invoiceNumber} · UTR: ${qrRow.utrNumber}`,
        "UPI / QR Code",
        receipt,
        paymentRecordId,
        options?.notes || `Verified School QR payment (UTR: ${qrRow.utrNumber})`,
        adminUserId,
      ],
      tx
    );

    // 8. Update school_qr_payments record to VERIFIED
    await run(
      `UPDATE school_qr_payments
       SET status = 'VERIFIED',
           verified_by = ?,
           verified_at = CURRENT_TIMESTAMP,
           payment_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND institution_id = ?`,
      [adminUserId, paymentRecordId, qrRow.id, institutionId],
      tx
    );

    // 9. Activity & Audit
    await activity(
      institutionId,
      "payment",
      "QR Fee payment verified",
      `${fee.studentName} paid ₹${qrRow.amount.toLocaleString("en-IN")} via QR Code (UTR: ${qrRow.utrNumber})`,
      String(fee.studentId),
      paymentRecordId,
      qrRow.amount,
      tx
    );

    await audit(
      institutionId,
      adminUserId,
      "QR Payment Verified",
      "SchoolQRPayment",
      qrRow.id,
      { amount: qrRow.amount, utr: qrRow.utrNumber, receipt, invoice: fee.invoiceNumber },
      tx
    );
  });

  return {
    success: true,
    paymentId: paymentRecordId,
    receiptNumber: resultReceiptNumber,
  };
}

export async function rejectSchoolQrPayment(
  institutionId: string,
  adminUserId: string,
  paymentId: string,
  reason: string
) {
  const cleanReason = reason.trim();
  if (!cleanReason) {
    throw new Error("A rejection reason is required.");
  }

  await ensurePaymentSettingsSchema();
  await connection().begin(async (tx) => {
    const qrRow = await row<{ id: string; status: string; studentId: string; utrNumber: string }>(
      `SELECT id, status, student_id AS "studentId", utr_number AS "utrNumber"
       FROM school_qr_payments
       WHERE institution_id = ? AND id = ?
       FOR UPDATE`,
      [institutionId, paymentId],
      tx
    );

    if (!qrRow) {
      throw new Error("QR Payment verification request not found.");
    }
    if (qrRow.status === "VERIFIED") {
      throw new Error("Cannot reject an already verified payment.");
    }

    await run(
      `UPDATE school_qr_payments
       SET status = 'REJECTED',
           rejection_reason = ?,
           verified_by = ?,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND institution_id = ?`,
      [cleanReason, adminUserId, qrRow.id, institutionId],
      tx
    );

    await audit(
      institutionId,
      adminUserId,
      "QR Payment Rejected",
      "SchoolQRPayment",
      qrRow.id,
      { utr: qrRow.utrNumber, reason: cleanReason },
      tx
    );
  });

  return { success: true };
}

export async function refundSchoolQrPayment(
  institutionId: string,
  adminUserId: string,
  paymentId: string,
  reason: string
) {
  await ensurePaymentSettingsSchema();
  await connection().begin(async (tx) => {
    const qrRow = await row<{
      id: string;
      status: string;
      studentId: string;
      amount: number;
      utrNumber: string;
      paymentId: string | null;
      feeId: string;
    }>(
      `SELECT id, status, student_id AS "studentId", amount, utr_number AS "utrNumber",
              payment_id AS "paymentId", fee_id AS "feeId"
       FROM school_qr_payments
       WHERE institution_id = ? AND id = ?
       FOR UPDATE`,
      [institutionId, paymentId],
      tx
    );

    if (!qrRow || qrRow.status !== "VERIFIED") {
      throw new Error("Only verified QR payments can be refunded.");
    }

    if (qrRow.paymentId) {
      await run(
        `UPDATE account_transactions
         SET status = 'Voided', updated_at = CURRENT_TIMESTAMP
         WHERE institution_id = ? AND source_type = 'fee_payment' AND source_id = ?`,
        [institutionId, qrRow.paymentId],
        tx
      );
      await run(
        `UPDATE payments
         SET status = 'Voided'
         WHERE institution_id = ? AND id = ?`,
        [institutionId, qrRow.paymentId],
        tx
      );
      await run(
        `UPDATE fees
         SET paid_amount = GREATEST(0, paid_amount - ?),
             pending_amount = pending_amount + ?,
             status = 'Pending',
             updated_at = CURRENT_TIMESTAMP
         WHERE institution_id = ? AND id = ?`,
        [qrRow.amount, qrRow.amount, institutionId, qrRow.feeId],
        tx
      );
      await run(
        `UPDATE students
         SET paid_fee = (SELECT COALESCE(SUM(paid_amount), 0) FROM fees WHERE student_id = ? AND institution_id = ?),
             pending_fee = (SELECT COALESCE(SUM(pending_amount), 0) FROM fees WHERE student_id = ? AND institution_id = ?),
             fee = 'Pending', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND institution_id = ?`,
        [qrRow.studentId, institutionId, qrRow.studentId, institutionId, qrRow.studentId, institutionId],
        tx
      );
    }

    await run(
      `UPDATE school_qr_payments
       SET status = 'REFUNDED',
           rejection_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND institution_id = ?`,
      [reason || "Payment refunded", qrRow.id, institutionId],
      tx
    );

    await audit(
      institutionId,
      adminUserId,
      "QR Payment Refunded",
      "SchoolQRPayment",
      qrRow.id,
      { utr: qrRow.utrNumber, reason },
      tx
    );
  });

  return { success: true };
}

export async function getSchoolQrPaymentScreenshot(institutionId: string, paymentId: string) {
  const db = await ready();
  await ensurePaymentSettingsSchema(db);
  const payment = await row<{ screenshotAssetId: string | null }>(
    `SELECT screenshot_asset_id AS "screenshotAssetId" FROM school_qr_payments WHERE institution_id = ? AND id = ?`,
    [institutionId, paymentId],
    db
  );
  if (!payment || !payment.screenshotAssetId) return null;
  return getSchoolAsset(institutionId, payment.screenshotAssetId);
}
