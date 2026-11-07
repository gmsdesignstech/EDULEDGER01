# Schema inventory

**Status:** source-derived inventory; not the deployed database schema. All definitions below are from the current, modified working-tree `src/lib/db.ts`, with Prisma and historical migrations recorded separately. The working tree already contained changes before this audit. PostgreSQL execution and catalog verification were not performed.

## Runtime table definitions

Found **56** distinct runtime `CREATE TABLE IF NOT EXISTS` names. Column definitions are preserved verbatim to retain type, nullability, defaults, inline checks, uniqueness, and foreign-key details. Table-level constraints are listed separately. `institution_id` presence is a storage ownership signal only; it does not prove authorization or tenant isolation.

### `institutions`

Source: `src/lib/db.ts:355`. School key: **no direct `institution_id` field in this definition**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `name` | `name TEXT NOT NULL` |
| `planned_student_count` | `planned_student_count INTEGER NOT NULL DEFAULT 0` |
| `subscription_start_date` | `subscription_start_date TIMESTAMPTZ` |
| `subscription_end_date` | `subscription_end_date TIMESTAMPTZ` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `users`

Source: `src/lib/db.ts:356`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `email` | `email TEXT NOT NULL UNIQUE` |
| `name` | `name TEXT NOT NULL` |
| `password_hash` | `password_hash TEXT NOT NULL` |
| `role` | `role TEXT NOT NULL` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `sessions`

Source: `src/lib/db.ts:357`. School key: **no direct `institution_id` field in this definition**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `token` | `token TEXT PRIMARY KEY` |
| `user_id` | `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `expires_at` | `expires_at TIMESTAMPTZ NOT NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `students`

Source: `src/lib/db.ts:358`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name` | `name TEXT NOT NULL` |
| `admission` | `admission TEXT NOT NULL` |
| `gender` | `gender TEXT NOT NULL DEFAULT ''` |
| `photo_path` | `photo_path TEXT` |
| `date_of_birth` | `date_of_birth TEXT NOT NULL DEFAULT ''` |
| `class_name` | `class_name TEXT NOT NULL DEFAULT ''` |
| `section` | `section TEXT NOT NULL DEFAULT ''` |
| `grade` | `grade TEXT NOT NULL` |
| `parent` | `parent TEXT NOT NULL` |
| `roll_number` | `roll_number TEXT NOT NULL DEFAULT ''` |
| `parent_phone` | `parent_phone TEXT NOT NULL DEFAULT ''` |
| `parent_email` | `parent_email TEXT NOT NULL DEFAULT ''` |
| `address` | `address TEXT NOT NULL DEFAULT ''` |
| `admission_date` | `admission_date TEXT NOT NULL DEFAULT ''` |
| `attendance` | `attendance INTEGER NOT NULL DEFAULT 100` |
| `fee` | `fee TEXT NOT NULL DEFAULT 'Pending'` |
| `total_fee` | `total_fee DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `paid_fee` | `paid_fee DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `pending_fee` | `pending_fee DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active'` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,admission)`

### `module_records`

Source: `src/lib/db.ts:359`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL` |
| `module` | `module TEXT NOT NULL` |
| `data` | `data JSONB NOT NULL DEFAULT '{}'::jsonb` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `teachers`

Source: `src/lib/db.ts:360`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name` | `name TEXT NOT NULL` |
| `employee_id` | `employee_id TEXT NOT NULL` |
| `email` | `email TEXT NOT NULL DEFAULT ''` |
| `phone` | `phone TEXT NOT NULL DEFAULT ''` |
| `department` | `department TEXT NOT NULL DEFAULT ''` |
| `subject` | `subject TEXT NOT NULL DEFAULT ''` |
| `assigned_classes` | `assigned_classes TEXT NOT NULL DEFAULT ''` |
| `joining_date` | `joining_date TEXT NOT NULL` |
| `salary` | `salary DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active'` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,employee_id)`

### `classes`

Source: `src/lib/db.ts:361`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name` | `name TEXT NOT NULL` |
| `section` | `section TEXT NOT NULL` |
| `teacher` | `teacher TEXT NOT NULL DEFAULT ''` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `capacity` | `capacity INTEGER NOT NULL DEFAULT 40` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active'` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,name,section,academic_year)`

### `attendance`

Source: `src/lib/db.ts:362`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `date` | `date TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Leave','Excused','Half-day','Half Day'))` |
| `remarks` | `remarks TEXT NOT NULL DEFAULT ''` |
| `marked_by` | `marked_by TEXT NOT NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(student_id,date)`

### `attendance_audit_logs`

Source: `src/lib/db.ts:363`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `attendance_id` | `attendance_id TEXT` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `class_name` | `class_name TEXT NOT NULL` |
| `section` | `section TEXT NOT NULL` |
| `date` | `date TEXT NOT NULL` |
| `previous_status` | `previous_status TEXT` |
| `new_status` | `new_status TEXT NOT NULL` |
| `previous_remarks` | `previous_remarks TEXT NOT NULL DEFAULT ''` |
| `new_remarks` | `new_remarks TEXT NOT NULL DEFAULT ''` |
| `changed_by` | `changed_by TEXT NOT NULL REFERENCES users(id)` |
| `reason` | `reason TEXT NOT NULL DEFAULT ''` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `school_holidays`

Source: `src/lib/db.ts:364`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `date` | `date TEXT NOT NULL` |
| `name` | `name TEXT NOT NULL` |
| `type` | `type TEXT NOT NULL DEFAULT 'Public Holiday' CHECK(type IN ('Public Holiday','School Holiday','Vacation','Weather Emergency','Administrative'))` |
| `description` | `description TEXT NOT NULL DEFAULT ''` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,date)`

### `fees`

Source: `src/lib/db.ts:365`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `invoice_number` | `invoice_number TEXT NOT NULL UNIQUE` |
| `fee_type` | `fee_type TEXT NOT NULL DEFAULT 'Annual Fee'` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `total_amount` | `total_amount DOUBLE PRECISION NOT NULL CHECK(total_amount>=0)` |
| `discount` | `discount DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `final_amount` | `final_amount DOUBLE PRECISION NOT NULL CHECK(final_amount>=0)` |
| `paid_amount` | `paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `pending_amount` | `pending_amount DOUBLE PRECISION NOT NULL CHECK(pending_amount>=0)` |
| `due_date` | `due_date TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `payments`

Source: `src/lib/db.ts:366`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id)` |
| `fee_id` | `fee_id TEXT NOT NULL REFERENCES fees(id)` |
| `receipt_number` | `receipt_number TEXT NOT NULL UNIQUE` |
| `amount` | `amount DOUBLE PRECISION NOT NULL CHECK(amount>0)` |
| `payment_method` | `payment_method TEXT NOT NULL` |
| `transaction_id` | `transaction_id TEXT NOT NULL DEFAULT ''` |
| `payment_date` | `payment_date TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL DEFAULT 'Success'` |
| `notes` | `notes TEXT NOT NULL DEFAULT ''` |
| `request_id` | `request_id TEXT` |
| `created_by` | `created_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `receipts`

Source: `src/lib/db.ts:367`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `receipt_number` | `receipt_number TEXT NOT NULL UNIQUE` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id)` |
| `payment_id` | `payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id)` |
| `invoice_number` | `invoice_number TEXT NOT NULL` |
| `amount` | `amount DOUBLE PRECISION NOT NULL` |
| `payment_method` | `payment_method TEXT NOT NULL` |
| `transaction_id` | `transaction_id TEXT NOT NULL DEFAULT ''` |
| `issued_date` | `issued_date TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL DEFAULT 'Issued'` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `activities`

Source: `src/lib/db.ts:368`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `type` | `type TEXT NOT NULL` |
| `title` | `title TEXT NOT NULL` |
| `description` | `description TEXT NOT NULL` |
| `student_id` | `student_id TEXT` |
| `payment_id` | `payment_id TEXT` |
| `amount` | `amount DOUBLE PRECISION` |
| `timestamp` | `timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `status` | `status TEXT NOT NULL DEFAULT 'Success'` |

### `notifications`

Source: `src/lib/db.ts:369`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `user_id` | `user_id TEXT` |
| `type` | `type TEXT NOT NULL` |
| `title` | `title TEXT NOT NULL` |
| `description` | `description TEXT NOT NULL DEFAULT ''` |
| `read_at` | `read_at TIMESTAMPTZ` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `whatsapp_configurations`

Source: `src/lib/db.ts:370`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE` |
| `enabled` | `enabled BOOLEAN NOT NULL DEFAULT FALSE` |
| `business_account_id` | `business_account_id TEXT NOT NULL DEFAULT ''` |
| `phone_number_id` | `phone_number_id TEXT NOT NULL DEFAULT ''` |
| `display_number` | `display_number TEXT NOT NULL DEFAULT ''` |
| `access_token_ciphertext` | `access_token_ciphertext TEXT NOT NULL DEFAULT ''` |
| `configuration_status` | `configuration_status TEXT NOT NULL DEFAULT 'Not Configured'` |
| `webhook_status` | `webhook_status TEXT NOT NULL DEFAULT 'Not Configured'` |
| `auto_absence` | `auto_absence BOOLEAN NOT NULL DEFAULT FALSE` |
| `auto_fee_receipt` | `auto_fee_receipt BOOLEAN NOT NULL DEFAULT FALSE` |
| `auto_fee_reminder` | `auto_fee_reminder BOOLEAN NOT NULL DEFAULT FALSE` |
| `auto_marksheet` | `auto_marksheet BOOLEAN NOT NULL DEFAULT FALSE` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `whatsapp_templates`

Source: `src/lib/db.ts:371`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE` |
| `name` | `name TEXT NOT NULL` |
| `category` | `category TEXT NOT NULL` |
| `language` | `language TEXT NOT NULL DEFAULT 'en'` |
| `provider_template_name` | `provider_template_name TEXT NOT NULL` |
| `enabled` | `enabled BOOLEAN NOT NULL DEFAULT TRUE` |
| `variables` | `variables JSONB NOT NULL DEFAULT '[]'::jsonb` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,name)`

### `whatsapp_messages`

Source: `src/lib/db.ts:372`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `student_id` | `student_id TEXT REFERENCES students(id) ON DELETE SET NULL` |
| `recipient_name` | `recipient_name TEXT NOT NULL DEFAULT ''` |
| `recipient_phone` | `recipient_phone TEXT NOT NULL` |
| `message_type` | `message_type TEXT NOT NULL` |
| `template_name` | `template_name TEXT NOT NULL` |
| `language` | `language TEXT NOT NULL DEFAULT 'en'` |
| `parameters` | `parameters JSONB NOT NULL DEFAULT '[]'::jsonb` |
| `document_kind` | `document_kind TEXT` |
| `document_reference` | `document_reference TEXT` |
| `provider_message_id` | `provider_message_id TEXT` |
| `idempotency_key` | `idempotency_key TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL DEFAULT 'Queued'` |
| `attempt_count` | `attempt_count INTEGER NOT NULL DEFAULT 0` |
| `next_attempt_at` | `next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `error_code` | `error_code TEXT NOT NULL DEFAULT ''` |
| `error_message` | `error_message TEXT NOT NULL DEFAULT ''` |
| `sent_by` | `sent_by TEXT NOT NULL REFERENCES users(id)` |
| `sent_at` | `sent_at TIMESTAMPTZ` |
| `delivered_at` | `delivered_at TIMESTAMPTZ` |
| `read_at` | `read_at TIMESTAMPTZ` |
| `failed_at` | `failed_at TIMESTAMPTZ` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,idempotency_key)`
- `UNIQUE(provider_message_id)`

### `whatsapp_consent_events`

Source: `src/lib/db.ts:373`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `contact_fingerprint` | `contact_fingerprint TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL` |
| `source` | `source TEXT NOT NULL` |
| `changed_by` | `changed_by TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `occurred_at` | `occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `whatsapp_webhook_events`

Source: `src/lib/db.ts:374`. School key: **no direct `institution_id` field in this definition**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `provider_event_key` | `provider_event_key TEXT NOT NULL UNIQUE` |
| `provider_message_id` | `provider_message_id TEXT NOT NULL` |
| `event_status` | `event_status TEXT NOT NULL` |
| `event_at` | `event_at TIMESTAMPTZ` |
| `payload_hash` | `payload_hash TEXT NOT NULL` |
| `processed_at` | `processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `whatsapp_addon_subscriptions`

Source: `src/lib/db.ts:375`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `student_count` | `student_count INTEGER NOT NULL CHECK(student_count>0)` |
| `price_per_student` | `price_per_student DOUBLE PRECISION NOT NULL CHECK(price_per_student>0)` |
| `amount_paid` | `amount_paid DOUBLE PRECISION NOT NULL CHECK((student_count<=100 AND amount_paid=10000) OR (student_count>100 AND amount_paid=student_count*price_per_student))` |
| `status` | `status TEXT NOT NULL CHECK(status IN ('PENDING','ACTIVE','EXPIRED','FAILED','CANCELLED'))` |
| `payment_status` | `payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending','Paid','Failed','Cancelled'))` |
| `currency` | `currency TEXT NOT NULL DEFAULT 'INR' CHECK(currency='INR')` |
| `activation_date` | `activation_date TIMESTAMPTZ NOT NULL` |
| `expiry_date` | `expiry_date TIMESTAMPTZ NOT NULL` |
| `razorpay_order_id` | `razorpay_order_id TEXT NOT NULL UNIQUE` |
| `razorpay_payment_id` | `razorpay_payment_id TEXT UNIQUE` |
| `razorpay_signature` | `razorpay_signature TEXT` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `CHECK(expiry_date>activation_date)`

### `settings`

Source: `src/lib/db.ts:376`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `institution_id` | `institution_id TEXT PRIMARY KEY REFERENCES institutions(id)` |
| `academic_year` | `academic_year TEXT NOT NULL DEFAULT '2026-2027'` |
| `school_address` | `school_address TEXT NOT NULL DEFAULT ''` |
| `school_phone` | `school_phone TEXT NOT NULL DEFAULT ''` |
| `school_email` | `school_email TEXT NOT NULL DEFAULT ''` |
| `logo_url` | `logo_url TEXT NOT NULL DEFAULT ''` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `academic_years`

Source: `src/lib/db.ts:377`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name` | `name TEXT NOT NULL` |
| `start_month` | `start_month INTEGER NOT NULL DEFAULT 4 CHECK(start_month BETWEEN 1 AND 12)` |
| `end_month` | `end_month INTEGER NOT NULL DEFAULT 3 CHECK(end_month BETWEEN 1 AND 12)` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Archived'))` |
| `is_active` | `is_active BOOLEAN NOT NULL DEFAULT FALSE` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,name)`

### `institution_classes`

Source: `src/lib/db.ts:378`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name` | `name TEXT NOT NULL` |
| `sort_order` | `sort_order INTEGER NOT NULL DEFAULT 0` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive'))` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,name)`

### `institution_sections`

Source: `src/lib/db.ts:379`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `class_id` | `class_id TEXT NOT NULL REFERENCES institution_classes(id) ON DELETE RESTRICT` |
| `name` | `name TEXT NOT NULL` |
| `sort_order` | `sort_order INTEGER NOT NULL DEFAULT 0` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive'))` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(class_id,name)`

### `school_assets`

Source: `src/lib/db.ts:380`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `kind` | `kind TEXT NOT NULL CHECK(kind IN ('logo','signature') OR kind LIKE 'student-photo:%')` |
| `mime_type` | `mime_type TEXT NOT NULL` |
| `data` | `data BYTEA NOT NULL` |
| `size_bytes` | `size_bytes INTEGER NOT NULL` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,kind)`

### `student_enrollments`

Source: `src/lib/db.ts:381`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `class_name` | `class_name TEXT NOT NULL` |
| `section` | `section TEXT NOT NULL DEFAULT ''` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active'` |
| `promoted_from_enrollment_id` | `promoted_from_enrollment_id TEXT REFERENCES student_enrollments(id) ON DELETE SET NULL` |
| `promoted_at` | `promoted_at TIMESTAMPTZ` |
| `promoted_by` | `promoted_by TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,student_id,academic_year)`

### `promotion_batches`

Source: `src/lib/db.ts:382`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `source_academic_year` | `source_academic_year TEXT NOT NULL` |
| `target_academic_year` | `target_academic_year TEXT NOT NULL` |
| `source_class` | `source_class TEXT NOT NULL` |
| `source_section` | `source_section TEXT NOT NULL DEFAULT ''` |
| `target_class` | `target_class TEXT NOT NULL` |
| `target_section` | `target_section TEXT NOT NULL DEFAULT ''` |
| `promoted_by` | `promoted_by TEXT NOT NULL REFERENCES users(id)` |
| `promoted_at` | `promoted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `status` | `status TEXT NOT NULL DEFAULT 'Completed'` |
| `correction_reason` | `correction_reason TEXT` |

### `promotion_items`

Source: `src/lib/db.ts:383`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `batch_id` | `batch_id TEXT NOT NULL REFERENCES promotion_batches(id) ON DELETE RESTRICT` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `source_enrollment_id` | `source_enrollment_id TEXT NOT NULL REFERENCES student_enrollments(id)` |
| `target_enrollment_id` | `target_enrollment_id TEXT NOT NULL REFERENCES student_enrollments(id)` |
| `status` | `status TEXT NOT NULL DEFAULT 'Promoted'` |
| `error_message` | `error_message TEXT NOT NULL DEFAULT ''` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,student_id,target_enrollment_id)`

### `student_demotions`

Source: `src/lib/db.ts:384`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `previous_class_id` | `previous_class_id TEXT REFERENCES institution_classes(id)` |
| `new_class_id` | `new_class_id TEXT REFERENCES institution_classes(id)` |
| `previous_section_id` | `previous_section_id TEXT REFERENCES institution_sections(id)` |
| `new_section_id` | `new_section_id TEXT REFERENCES institution_sections(id)` |
| `previous_academic_year_id` | `previous_academic_year_id TEXT REFERENCES academic_years(id)` |
| `new_academic_year_id` | `new_academic_year_id TEXT REFERENCES academic_years(id)` |
| `previous_class` | `previous_class TEXT NOT NULL` |
| `new_class` | `new_class TEXT NOT NULL` |
| `previous_section` | `previous_section TEXT NOT NULL` |
| `new_section` | `new_section TEXT NOT NULL` |
| `previous_year` | `previous_year TEXT NOT NULL` |
| `new_year` | `new_year TEXT NOT NULL` |
| `reason` | `reason TEXT NOT NULL` |
| `remarks` | `remarks TEXT NOT NULL DEFAULT ''` |
| `changed_by` | `changed_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `undone_by` | `undone_by TEXT REFERENCES users(id)` |
| `undone_at` | `undone_at TIMESTAMPTZ` |

### `counters`

Source: `src/lib/db.ts:385`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `institution_id` | `institution_id TEXT NOT NULL` |
| `kind` | `kind TEXT NOT NULL` |
| `year` | `year TEXT NOT NULL` |
| `value` | `value INTEGER NOT NULL DEFAULT 0` |

Table constraints:
- `PRIMARY KEY(institution_id,kind,year)`

### `audit_logs`

Source: `src/lib/db.ts:386`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `user_id` | `user_id TEXT` |
| `action` | `action TEXT NOT NULL` |
| `entity` | `entity TEXT NOT NULL` |
| `entity_id` | `entity_id TEXT` |
| `details` | `details JSONB NOT NULL DEFAULT '{}'::jsonb` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `subscription_plans`

Source: `src/lib/db.ts:387`. School key: **no direct `institution_id` field in this definition**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `name` | `name TEXT NOT NULL UNIQUE` |
| `student_limit` | `student_limit INTEGER NOT NULL` |
| `price` | `price DOUBLE PRECISION NOT NULL` |
| `billing_period` | `billing_period TEXT NOT NULL DEFAULT 'year'` |
| `active` | `active BOOLEAN NOT NULL DEFAULT TRUE` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `subscriptions`

Source: `src/lib/db.ts:388`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `plan_id` | `plan_id TEXT NOT NULL REFERENCES subscription_plans(id)` |
| `student_capacity` | `student_capacity INTEGER NOT NULL` |
| `price_per_student` | `price_per_student DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `amount_paid` | `amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `status` | `status TEXT NOT NULL` |
| `activation_date` | `activation_date TIMESTAMPTZ` |
| `expiry_date` | `expiry_date TIMESTAMPTZ` |
| `razorpay_order_id` | `razorpay_order_id TEXT NOT NULL UNIQUE` |
| `razorpay_payment_id` | `razorpay_payment_id TEXT UNIQUE` |
| `razorpay_signature` | `razorpay_signature TEXT` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `subscription_payments`

Source: `src/lib/db.ts:389`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `plan` | `plan TEXT NOT NULL` |
| `student_capacity` | `student_capacity INTEGER NOT NULL` |
| `amount` | `amount DOUBLE PRECISION NOT NULL` |
| `razorpay_payment_id` | `razorpay_payment_id TEXT NOT NULL UNIQUE` |
| `payment_date` | `payment_date TEXT NOT NULL` |
| `starts_at` | `starts_at TIMESTAMPTZ NOT NULL` |
| `ends_at` | `ends_at TIMESTAMPTZ NOT NULL` |
| `status` | `status TEXT NOT NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `subscription_adjustments`

Source: `src/lib/db.ts:390`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `subscription_id` | `subscription_id TEXT NOT NULL REFERENCES subscriptions(id)` |
| `old_capacity` | `old_capacity INTEGER NOT NULL` |
| `new_capacity` | `new_capacity INTEGER NOT NULL` |
| `amount` | `amount DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `credit_amount` | `credit_amount DOUBLE PRECISION NOT NULL DEFAULT 0` |
| `status` | `status TEXT NOT NULL` |
| `razorpay_order_id` | `razorpay_order_id TEXT UNIQUE` |
| `razorpay_payment_id` | `razorpay_payment_id TEXT UNIQUE` |
| `created_by` | `created_by TEXT REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `razorpay_webhook_events`

Source: `src/lib/db.ts:391`. School key: **no direct `institution_id` field in this definition**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `event_type` | `event_type TEXT NOT NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `subscription_notification_events`

Source: `src/lib/db.ts:392`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `subscription_id` | `subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `milestone` | `milestone TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL DEFAULT 'SENT'` |
| `attempts` | `attempts INTEGER NOT NULL DEFAULT 1` |
| `last_error` | `last_error TEXT NOT NULL DEFAULT ''` |
| `sent_at` | `sent_at TIMESTAMPTZ` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(subscription_id,milestone)`

### `subscription_processing_logs`

Source: `src/lib/db.ts:393`. School key: **no direct `institution_id` field in this definition**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `started_at` | `started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `finished_at` | `finished_at TIMESTAMPTZ` |
| `status` | `status TEXT NOT NULL` |
| `checked_count` | `checked_count INTEGER NOT NULL DEFAULT 0` |
| `expired_count` | `expired_count INTEGER NOT NULL DEFAULT 0` |
| `notification_count` | `notification_count INTEGER NOT NULL DEFAULT 0` |
| `error` | `error TEXT NOT NULL DEFAULT ''` |

### `timetable_entries`

Source: `src/lib/db.ts:394`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `class_name` | `class_name TEXT NOT NULL` |
| `section` | `section TEXT NOT NULL` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `subject` | `subject TEXT NOT NULL` |
| `teacher_id` | `teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL` |
| `weekday` | `weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 6)` |
| `start_time` | `start_time TEXT NOT NULL` |
| `end_time` | `end_time TEXT NOT NULL` |
| `generated` | `generated BOOLEAN NOT NULL DEFAULT FALSE` |
| `status` | `status TEXT NOT NULL DEFAULT 'Published' CHECK(status IN ('Draft','Published','Archived'))` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `class_exams`

Source: `src/lib/db.ts:396`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `class_name` | `class_name TEXT NOT NULL` |
| `section` | `section TEXT NOT NULL` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `name` | `name TEXT NOT NULL` |
| `exam_date` | `exam_date TEXT NOT NULL` |
| `subject` | `subject TEXT NOT NULL` |
| `max_marks` | `max_marks DOUBLE PRECISION NOT NULL` |
| `passing_marks` | `passing_marks DOUBLE PRECISION NOT NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `class_results`

Source: `src/lib/db.ts:397`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `exam_id` | `exam_id TEXT NOT NULL REFERENCES class_exams(id) ON DELETE CASCADE` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `marks` | `marks DOUBLE PRECISION NOT NULL` |
| `grade` | `grade TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(exam_id,student_id)`

### `account_transactions`

Source: `src/lib/db.ts:398`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `transaction_type` | `transaction_type TEXT NOT NULL CHECK(transaction_type IN ('income','expense'))` |
| `category` | `category TEXT NOT NULL` |
| `amount_paise` | `amount_paise INTEGER NOT NULL CHECK(amount_paise>0)` |
| `transaction_date` | `transaction_date TEXT NOT NULL` |
| `description` | `description TEXT NOT NULL` |
| `payment_method` | `payment_method TEXT NOT NULL` |
| `reference_number` | `reference_number TEXT NOT NULL DEFAULT ''` |
| `source_type` | `source_type TEXT NOT NULL DEFAULT 'cash_book'` |
| `source_id` | `source_id TEXT` |
| `status` | `status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Voided'))` |
| `notes` | `notes TEXT NOT NULL DEFAULT ''` |
| `created_by` | `created_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `salaries`

Source: `src/lib/db.ts:399`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `employee_key` | `employee_key TEXT NOT NULL` |
| `teacher_id` | `teacher_id TEXT REFERENCES teachers(id) ON DELETE RESTRICT` |
| `user_id` | `user_id TEXT REFERENCES users(id) ON DELETE RESTRICT` |
| `employee_name` | `employee_name TEXT NOT NULL` |
| `employee_number` | `employee_number TEXT NOT NULL` |
| `employee_role` | `employee_role TEXT NOT NULL` |
| `department` | `department TEXT NOT NULL DEFAULT ''` |
| `designation` | `designation TEXT NOT NULL DEFAULT ''` |
| `salary_month` | `salary_month INTEGER NOT NULL CHECK(salary_month BETWEEN 1 AND 12)` |
| `salary_year` | `salary_year INTEGER NOT NULL CHECK(salary_year BETWEEN 2000 AND 2200)` |
| `basic_paise` | `basic_paise INTEGER NOT NULL CHECK(basic_paise>=0)` |
| `allowances_paise` | `allowances_paise INTEGER NOT NULL DEFAULT 0 CHECK(allowances_paise>=0)` |
| `bonus_paise` | `bonus_paise INTEGER NOT NULL DEFAULT 0 CHECK(bonus_paise>=0)` |
| `overtime_paise` | `overtime_paise INTEGER NOT NULL DEFAULT 0 CHECK(overtime_paise>=0)` |
| `other_earnings_paise` | `other_earnings_paise INTEGER NOT NULL DEFAULT 0 CHECK(other_earnings_paise>=0)` |
| `gross_paise` | `gross_paise INTEGER NOT NULL CHECK(gross_paise>=0)` |
| `deductions_paise` | `deductions_paise INTEGER NOT NULL DEFAULT 0 CHECK(deductions_paise>=0)` |
| `advance_deduction_paise` | `advance_deduction_paise INTEGER NOT NULL DEFAULT 0 CHECK(advance_deduction_paise>=0)` |
| `other_deductions_paise` | `other_deductions_paise INTEGER NOT NULL DEFAULT 0 CHECK(other_deductions_paise>=0)` |
| `total_deductions_paise` | `total_deductions_paise INTEGER NOT NULL CHECK(total_deductions_paise>=0)` |
| `net_paise` | `net_paise INTEGER NOT NULL CHECK(net_paise>=0)` |
| `paid_paise` | `paid_paise INTEGER NOT NULL DEFAULT 0 CHECK(paid_paise>=0)` |
| `payment_status` | `payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending','Paid','Partially Paid','Cancelled','On Hold'))` |
| `payment_date` | `payment_date TEXT` |
| `payment_method` | `payment_method TEXT` |
| `payment_reference` | `payment_reference TEXT NOT NULL DEFAULT ''` |
| `payment_notes` | `payment_notes TEXT NOT NULL DEFAULT ''` |
| `notes` | `notes TEXT NOT NULL DEFAULT ''` |
| `payslip_number` | `payslip_number TEXT NOT NULL UNIQUE` |
| `created_by` | `created_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(employee_key,salary_month,salary_year)`

### `salary_payment_events`

Source: `src/lib/db.ts:400`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `salary_id` | `salary_id TEXT NOT NULL REFERENCES salaries(id) ON DELETE RESTRICT` |
| `request_id` | `request_id TEXT NOT NULL` |
| `amount_paise` | `amount_paise INTEGER NOT NULL CHECK(amount_paise>0)` |
| `account_transaction_id` | `account_transaction_id TEXT NOT NULL REFERENCES account_transactions(id) ON DELETE RESTRICT` |
| `created_by` | `created_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,request_id)`

### `parent_students`

Source: `src/lib/db.ts:401`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `parent_user_id` | `parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `relationship` | `relationship TEXT NOT NULL DEFAULT 'Parent'` |
| `is_primary` | `is_primary BOOLEAN NOT NULL DEFAULT TRUE` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(parent_user_id,student_id)`

### `parent_invitations`

Source: `src/lib/db.ts:402`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id` | `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `parent_name` | `parent_name TEXT NOT NULL` |
| `parent_email` | `parent_email TEXT NOT NULL` |
| `parent_phone` | `parent_phone TEXT NOT NULL DEFAULT ''` |
| `invitation_code` | `invitation_code TEXT NOT NULL UNIQUE` |
| `status` | `status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','EXPIRED'))` |
| `expires_at` | `expires_at TIMESTAMPTZ NOT NULL` |
| `created_by` | `created_by TEXT REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `accepted_at` | `accepted_at TIMESTAMPTZ` |

### `fcm_device_tokens`

Source: `src/lib/db.ts:403`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `user_id` | `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `token` | `token TEXT NOT NULL UNIQUE` |
| `device_type` | `device_type TEXT NOT NULL DEFAULT 'web'` |
| `user_agent` | `user_agent TEXT NOT NULL DEFAULT ''` |
| `status` | `status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','EXPIRED'))` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `revoked_at` | `revoked_at TIMESTAMPTZ` |

### `notification_events`

Source: `src/lib/db.ts:404`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `event_key` | `event_key TEXT NOT NULL UNIQUE` |
| `event_type` | `event_type TEXT NOT NULL` |
| `title` | `title TEXT NOT NULL` |
| `body` | `body TEXT NOT NULL` |
| `data` | `data JSONB NOT NULL DEFAULT '{}'::jsonb` |
| `deep_link` | `deep_link TEXT NOT NULL DEFAULT ''` |
| `recipient_user_ids` | `recipient_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb` |
| `status` | `status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK(status IN ('QUEUED','PROCESSED','FAILED'))` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `notification_deliveries`

Source: `src/lib/db.ts:405`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `event_id` | `event_id TEXT REFERENCES notification_events(id) ON DELETE CASCADE` |
| `notification_id` | `notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL` |
| `user_id` | `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `device_token_id` | `device_token_id TEXT REFERENCES fcm_device_tokens(id) ON DELETE SET NULL` |
| `channel` | `channel TEXT NOT NULL DEFAULT 'FCM' CHECK(channel IN ('FCM','IN_APP'))` |
| `status` | `status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','DELIVERED','FAILED','REVOKED'))` |
| `attempt_count` | `attempt_count INTEGER NOT NULL DEFAULT 0` |
| `max_attempts` | `max_attempts INTEGER NOT NULL DEFAULT 3` |
| `provider_message_id` | `provider_message_id TEXT` |
| `error_code` | `error_code TEXT NOT NULL DEFAULT ''` |
| `error_message` | `error_message TEXT NOT NULL DEFAULT ''` |
| `next_retry_at` | `next_retry_at TIMESTAMPTZ` |
| `sent_at` | `sent_at TIMESTAMPTZ` |
| `delivered_at` | `delivered_at TIMESTAMPTZ` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `school_notification_settings`

Source: `src/lib/db.ts:406`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `institution_id` | `institution_id TEXT PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE` |
| `push_enabled` | `push_enabled BOOLEAN NOT NULL DEFAULT TRUE` |
| `student_absent` | `student_absent BOOLEAN NOT NULL DEFAULT TRUE` |
| `attendance_correction` | `attendance_correction BOOLEAN NOT NULL DEFAULT TRUE` |
| `fee_payment` | `fee_payment BOOLEAN NOT NULL DEFAULT TRUE` |
| `fee_reminders` | `fee_reminders BOOLEAN NOT NULL DEFAULT TRUE` |
| `homework` | `homework BOOLEAN NOT NULL DEFAULT TRUE` |
| `exam_results` | `exam_results BOOLEAN NOT NULL DEFAULT TRUE` |
| `announcements` | `announcements BOOLEAN NOT NULL DEFAULT TRUE` |
| `teacher_leave` | `teacher_leave BOOLEAN NOT NULL DEFAULT TRUE` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `admin_settings`

Source: `src/lib/db.ts:452`. School key: **no direct `institution_id` field in this definition**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `application_name` | `application_name TEXT NOT NULL DEFAULT 'EduLedger'` |
| `support_email` | `support_email TEXT NOT NULL DEFAULT ''` |
| `currency` | `currency TEXT NOT NULL DEFAULT 'INR'` |
| `timezone` | `timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'` |
| `date_format` | `date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY'` |
| `session_timeout_minutes` | `session_timeout_minutes INTEGER NOT NULL DEFAULT 10080` |
| `updated_by` | `updated_by TEXT` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `result_examinations`

Source: `src/lib/db.ts:487`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name` | `name TEXT NOT NULL` |
| `academic_year` | `academic_year TEXT NOT NULL` |
| `class_name` | `class_name TEXT NOT NULL` |
| `section` | `section TEXT NOT NULL` |
| `start_date` | `start_date TEXT NOT NULL` |
| `end_date` | `end_date TEXT NOT NULL` |
| `publication_date` | `publication_date TEXT` |
| `status` | `status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Marks Entry Open','Marks Entry Closed','Results Under Review','Approved','Published','Archived'))` |
| `created_by` | `created_by TEXT REFERENCES users(id)` |
| `verified_by` | `verified_by TEXT REFERENCES users(id)` |
| `approved_by` | `approved_by TEXT REFERENCES users(id)` |
| `published_by` | `published_by TEXT REFERENCES users(id)` |
| `published_at` | `published_at TIMESTAMPTZ` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,academic_year,class_name,section,name)`

### `result_publication_snapshots`

Source: `src/lib/db.ts:490`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `examination_id` | `examination_id TEXT NOT NULL REFERENCES result_examinations(id) ON DELETE RESTRICT` |
| `version` | `version INTEGER NOT NULL` |
| `snapshot` | `snapshot JSONB NOT NULL` |
| `published_by` | `published_by TEXT NOT NULL REFERENCES users(id)` |
| `published_at` | `published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(examination_id,version)`

### `staff_attendance_settings`

Source: `src/lib/db.ts:500`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `institution_id` | `institution_id TEXT PRIMARY KEY REFERENCES institutions(id)` |
| `work_start_time` | `work_start_time TEXT NOT NULL DEFAULT '09:00'` |
| `work_end_time` | `work_end_time TEXT NOT NULL DEFAULT '17:00'` |
| `late_after_time` | `late_after_time TEXT NOT NULL DEFAULT '09:15'` |
| `break_minutes` | `break_minutes INTEGER NOT NULL DEFAULT 30` |
| `working_days` | `working_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6'` |
| `timezone` | `timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'` |
| `allow_self_checkin` | `allow_self_checkin BOOLEAN NOT NULL DEFAULT FALSE` |
| `correction_requires_approval` | `correction_requires_approval BOOLEAN NOT NULL DEFAULT FALSE` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `staff_attendance`

Source: `src/lib/db.ts:501`. School key: **present (`institution_id`)**. Required access: authenticated server-side role/tenant authorization; exact route-level policy not declared by DDL.

| Column | SQL definition (source text) |
|---|---|
| `id` | `id TEXT PRIMARY KEY` |
| `institution_id` | `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `staff_key` | `staff_key TEXT NOT NULL` |
| `teacher_id` | `teacher_id TEXT REFERENCES teachers(id) ON DELETE RESTRICT` |
| `user_id` | `user_id TEXT REFERENCES users(id) ON DELETE RESTRICT` |
| `attendance_date` | `attendance_date TEXT NOT NULL` |
| `status` | `status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Half Day','On Leave','Holiday','Work From Home'))` |
| `check_in_at` | `check_in_at TIMESTAMPTZ` |
| `check_out_at` | `check_out_at TIMESTAMPTZ` |
| `break_minutes` | `break_minutes INTEGER NOT NULL DEFAULT 0` |
| `total_work_minutes` | `total_work_minutes INTEGER` |
| `remarks` | `remarks TEXT NOT NULL DEFAULT ''` |
| `created_by` | `created_by TEXT REFERENCES users(id)` |
| `updated_by` | `updated_by TEXT REFERENCES users(id)` |
| `created_at` | `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Table constraints:
- `UNIQUE(institution_id,staff_key,attendance_date)`
- `CHECK((teacher_id IS NULL) <> (user_id IS NULL))`

## Runtime index declarations

Found 58 `CREATE INDEX IF NOT EXISTS` declarations that can be extracted statically. Conditional index creation and indexes created by dynamic code paths may be additional.

| Source line | Name | Unique | Table | Key expression | Predicate/extra |
|---:|---|---:|---|---|---|
| 395 | `idx_timetable_active_slot` | yes | `timetable_entries` | `institution_id,class_name,section,academic_year,weekday,start_time` | `WHERE status<>'Archived';` |
| 407 | `idx_students_institution` | no | `students` | `institution_id` | `;` |
| 408 | `idx_sessions_user` | no | `sessions` | `user_id` | `;` |
| 409 | `idx_users_email_lower` | yes | `users` | `LOWER(email)` | `;` |
| 410 | `idx_users_single_super_admin` | yes | `users` | `role` | `WHERE role='SUPER_ADMIN';` |
| 411 | `idx_module_records` | no | `module_records` | `institution_id,module` | `;` |
| 412 | `idx_attendance_scope` | no | `attendance` | `institution_id,date,status` | `;` |
| 413 | `idx_attendance_audit_scope` | no | `attendance_audit_logs` | `institution_id,class_name,section,date` | `;` |
| 414 | `idx_attendance_audit_student` | no | `attendance_audit_logs` | `student_id,date` | `;` |
| 415 | `idx_school_holidays_scope` | no | `school_holidays` | `institution_id,academic_year,date` | `;` |
| 416 | `idx_fees_scope` | no | `fees` | `institution_id,status,due_date` | `;` |
| 417 | `idx_payments_scope` | no | `payments` | `institution_id,payment_date,created_at` | `;` |
| 418 | `idx_timetable_class` | no | `timetable_entries` | `institution_id,class_name,academic_year` | `;` |
| 419 | `idx_exams_class` | no | `class_exams` | `institution_id,class_name,academic_year` | `;` |
| 420 | `idx_accounts_scope` | no | `account_transactions` | `institution_id,academic_year,transaction_date,status` | `;` |
| 421 | `idx_salaries_scope` | no | `salaries` | `institution_id,salary_year,salary_month,payment_status` | `;` |
| 422 | `idx_salaries_employee` | no | `salaries` | `employee_key,created_at` | `;` |
| 423 | `idx_salaries_payment_date` | no | `salaries` | `payment_date` | `;` |
| 424 | `idx_salary_payment_events_salary` | no | `salary_payment_events` | `institution_id,salary_id,created_at` | `;` |
| 425 | `idx_subscriptions_expiry` | no | `subscriptions` | `status,expiry_date` | `;` |
| 426 | `idx_subscription_adjustments_school` | no | `subscription_adjustments` | `institution_id,status,created_at` | `;` |
| 427 | `idx_notifications_user_read` | no | `notifications` | `user_id,read_at,created_at` | `;` |
| 428 | `idx_whatsapp_queue` | no | `whatsapp_messages` | `status,next_attempt_at` | `;` |
| 429 | `idx_whatsapp_history` | no | `whatsapp_messages` | `institution_id,created_at DESC` | `;` |
| 430 | `idx_whatsapp_student` | no | `whatsapp_messages` | `institution_id,student_id,created_at DESC` | `;` |
| 431 | `idx_whatsapp_addon_school` | no | `whatsapp_addon_subscriptions` | `institution_id,status,expiry_date` | `;` |
| 432 | `idx_accounts_source` | yes | `account_transactions` | `institution_id,source_type,source_id` | `WHERE source_id IS NOT NULL;` |
| 433 | `idx_academic_years_scope` | no | `academic_years` | `institution_id,status,is_active` | `;` |
| 434 | `idx_institution_classes_scope` | no | `institution_classes` | `institution_id,status,sort_order` | `;` |
| 435 | `idx_institution_sections_scope` | no | `institution_sections` | `institution_id,class_id,status,sort_order` | `;` |
| 436 | `idx_enrollments_scope` | no | `student_enrollments` | `institution_id,academic_year,class_name,section,status` | `;` |
| 437 | `idx_promotion_batches_scope` | no | `promotion_batches` | `institution_id,promoted_at` | `;` |
| 438 | `idx_promotion_items_scope` | no | `promotion_items` | `institution_id,student_id,created_at` | `;` |
| 439 | `idx_student_demotions_scope` | no | `student_demotions` | `institution_id,student_id,created_at` | `;` |
| 440 | `idx_parent_students_user` | no | `parent_students` | `parent_user_id` | `;` |
| 441 | `idx_parent_students_student` | no | `parent_students` | `student_id` | `;` |
| 442 | `idx_parent_invitations_code` | no | `parent_invitations` | `invitation_code,status` | `;` |
| 443 | `idx_parent_invitations_student` | no | `parent_invitations` | `institution_id,student_id` | `;` |
| 444 | `idx_fcm_tokens_user` | no | `fcm_device_tokens` | `user_id, status` | `;` |
| 445 | `idx_fcm_tokens_inst` | no | `fcm_device_tokens` | `institution_id, status` | `;` |
| 446 | `idx_notif_events_key` | no | `notification_events` | `event_key` | `;` |
| 447 | `idx_notif_events_inst` | no | `notification_events` | `institution_id, event_type` | `;` |
| 448 | `idx_notif_deliv_status` | no | `notification_deliveries` | `status, next_retry_at` | `;` |
| 449 | `idx_notif_deliv_user` | no | `notification_deliveries` | `user_id, created_at DESC` | `;` |
| 450 | `idx_notif_deliv_event` | no | `notification_deliveries` | `event_id` | `;` |
| 475 | `idx_payments_request_id` | yes | `payments` | `institution_id,request_id` | `WHERE request_id IS NOT NULL");` |
| 484 | `idx_timetable_active_slot` | yes | `timetable_entries` | `institution_id,class_name,section,academic_year,weekday,start_time` | `WHERE status<>'Archived'");` |
| 485 | `idx_timetable_published_scope` | no | `timetable_entries` | `institution_id,academic_year,class_name,section,weekday,start_time` | `WHERE status='Published'");` |
| 488 | `idx_result_examinations_scope` | no | `result_examinations` | `institution_id,academic_year,class_name,section,status` | `;` |
| 489 | `idx_result_examinations_publish` | no | `result_examinations` | `institution_id,status,published_at` | `;` |
| 491 | `idx_result_snapshots_scope` | no | `result_publication_snapshots` | `institution_id,examination_id,version` | `;` |
| 496 | `idx_class_exam_group_subject` | yes | `class_exams` | `result_examination_id,subject` | `WHERE result_examination_id IS NOT NULL");` |
| 497 | `idx_class_results_exam` | no | `class_results` | `institution_id,exam_id,student_id` | `");` |
| 499 | `students_school_roll_unique` | yes | `students` | `institution_id,roll_number` | `WHERE roll_number<>''");` |
| 502 | `idx_staff_attendance_date` | no | `staff_attendance` | `institution_id,attendance_date,status` | `;` |
| 503 | `idx_staff_attendance_person` | no | `staff_attendance` | `institution_id,staff_key,attendance_date` | `;` |
| 535 | `idx_attendance_scope` | no | `attendance` | `institution_id,date,status` | `;` |
| 713 | `students_school_roll_unique` | yes | `students` | `institution_id,roll_number` | `WHERE roll_number<>\'\'');` |

## Runtime incremental column patches

Initialization also runs incremental `ALTER TABLE ... ADD COLUMN` patches and per-dialect branches. The direct SQL literals found by static scan are listed here; object/array-driven additions are summarized below and are not equivalent to a baseline migration.

| Source line | Table | Added definition |
|---:|---|---|
| 473 | `payments` | `request_id TEXT` |
| 474 | `payments` | `request_id TEXT` |
| 478 | `timetable_entries` | `generated BOOLEAN NOT NULL DEFAULT FALSE` |
| 479 | `timetable_entries` | `status TEXT NOT NULL DEFAULT 'Published'` |
| 481 | `timetable_entries` | `generated BOOLEAN NOT NULL DEFAULT FALSE` |
| 482 | `timetable_entries` | `status TEXT NOT NULL DEFAULT 'Published'` |
| 510 | `subscriptions` | `price_per_student DOUBLE PRECISION NOT NULL DEFAULT 0` |
| 510 | `subscriptions` | `price_per_student NUMERIC(12,2) NOT NULL DEFAULT 0` |
| 511 | `institutions` | `planned_student_count INTEGER NOT NULL DEFAULT 0` |
| 511 | `institutions` | `subscription_start_date TIMESTAMPTZ` |
| 511 | `institutions` | `subscription_end_date TIMESTAMPTZ` |
| 511 | `institutions` | `planned_student_count INTEGER NOT NULL DEFAULT 0` |
| 511 | `institutions` | `subscription_start_date TIMESTAMPTZ` |
| 511 | `institutions` | `subscription_end_date TIMESTAMPTZ` |

### `additions` map (runtime-generated ADD COLUMN patches)

- `settings`: `result_grade_bands TEXT NOT NULL DEFAULT ''`, `result_overall_pass_percent INTEGER NOT NULL DEFAULT 35`, `result_require_subject_pass BOOLEAN NOT NULL DEFAULT TRUE`, `result_ranking_enabled BOOLEAN NOT NULL DEFAULT FALSE`, `result_principal_remarks TEXT NOT NULL DEFAULT ''`, `result_class_teacher_remarks TEXT NOT NULL DEFAULT ''`, `result_report_format TEXT NOT NULL DEFAULT 'Standard'`, `timetable_start_time TEXT NOT NULL DEFAULT '09:00'`, `timetable_end_time TEXT NOT NULL DEFAULT '16:00'`, `timetable_period_minutes INTEGER NOT NULL DEFAULT 40`, `timetable_short_break_minutes INTEGER NOT NULL DEFAULT 15`, `timetable_lunch_minutes INTEGER NOT NULL DEFAULT 40`, `timetable_periods_per_day INTEGER NOT NULL DEFAULT 9`, `timetable_working_days TEXT NOT NULL DEFAULT '1,2,3,4,5'`, `timetable_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'`, `school_code TEXT NOT NULL DEFAULT ''`, `dise_code TEXT NOT NULL DEFAULT ''`, `website TEXT NOT NULL DEFAULT ''`, `city TEXT NOT NULL DEFAULT ''`, `state TEXT NOT NULL DEFAULT ''`, `pin_code TEXT NOT NULL DEFAULT ''`, `principal_name TEXT NOT NULL DEFAULT ''`, `registration_number TEXT NOT NULL DEFAULT ''`, `affiliation TEXT NOT NULL DEFAULT ''`, `motto TEXT NOT NULL DEFAULT ''`, `school_type TEXT NOT NULL DEFAULT ''`, `fee_receipt_title TEXT NOT NULL DEFAULT 'Fee Payment Receipt'`, `fee_receipt_subheader TEXT NOT NULL DEFAULT 'Standard Fee Receipt Template'`, `payslip_title TEXT NOT NULL DEFAULT 'Pay Slip'`, `payslip_subheader TEXT NOT NULL DEFAULT 'Standard Pay Slip Template'`, `footer_text TEXT NOT NULL DEFAULT ''`, `signature_label TEXT NOT NULL DEFAULT 'Authorized Signatory'`, `attendance_correction_window_hours INTEGER NOT NULL DEFAULT 24`
- `students`: `blood_group TEXT`, `mother_name TEXT`, `special_quota TEXT`, `special_quota_description TEXT`, `academic_year TEXT NOT NULL DEFAULT ''`, `leaving_date TEXT`, `leaving_reason TEXT NOT NULL DEFAULT ''`, `graduation_date TEXT`, `leaving_remarks TEXT NOT NULL DEFAULT ''`, `photo_path TEXT`
- `payments`: `payment_frequency TEXT NOT NULL DEFAULT 'Custom'`, `original_amount DOUBLE PRECISION NOT NULL DEFAULT 0`, `discount_type TEXT NOT NULL DEFAULT 'Fixed'`, `discount_value DOUBLE PRECISION NOT NULL DEFAULT 0`, `discount_amount DOUBLE PRECISION NOT NULL DEFAULT 0`, `discount_reason TEXT NOT NULL DEFAULT ''`, `late_fee DOUBLE PRECISION NOT NULL DEFAULT 0`, `net_payable DOUBLE PRECISION NOT NULL DEFAULT 0`
- `users`: `status TEXT NOT NULL DEFAULT 'Active'`, `last_login_at TIMESTAMPTZ`
- `institutions`: `status TEXT NOT NULL DEFAULT 'Active'`
- `subscriptions`: `payment_status TEXT NOT NULL DEFAULT 'Pending'`, `plan_type TEXT NOT NULL DEFAULT 'Yearly'`, `currency TEXT NOT NULL DEFAULT 'INR'`, `renewal_date TIMESTAMPTZ`, `auto_renew BOOLEAN NOT NULL DEFAULT FALSE`, `last_notification_sent TIMESTAMPTZ`, `grace_period_days INTEGER NOT NULL DEFAULT 0`
- `notifications`: `link TEXT NOT NULL DEFAULT ''`, `delivery_status TEXT NOT NULL DEFAULT 'SENT'`
- `admin_settings`: `subscription_warning_days TEXT NOT NULL DEFAULT '30,15,7,3,1,0,-1'`, `subscription_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`, `in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE`, `email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE`, `subscription_grace_days INTEGER NOT NULL DEFAULT 0`

### `fixedPricingAdditions` map (runtime-generated ADD COLUMN patches)

- `subscriptions`: `student_count_at_purchase INTEGER`, `pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT'`, `plan_version INTEGER NOT NULL DEFAULT 1`
- `subscription_plans`: `pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT'`, `plan_version INTEGER NOT NULL DEFAULT 1`, `effective_at TIMESTAMPTZ`, `eligible_new_schools BOOLEAN NOT NULL DEFAULT FALSE`
- `subscription_payments`: `student_count_at_purchase INTEGER`, `pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT'`, `plan_version INTEGER NOT NULL DEFAULT 1`

### `resultAdditions` map (runtime-generated result columns)

- `class_exams`: `result_examination_id TEXT REFERENCES result_examinations(id)`, `max_marks_cent INTEGER`, `passing_marks_cent INTEGER`, `required BOOLEAN NOT NULL DEFAULT TRUE`
- `class_results`: `marks_cent INTEGER`, `mark_status TEXT NOT NULL DEFAULT 'Scored'`, `remarks TEXT NOT NULL DEFAULT ''`, `updated_by TEXT REFERENCES users(id)`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`

### `whatsappStudentAdditions` → `students`

- `parent_relationship TEXT NOT NULL DEFAULT ''`, `parent_whatsapp TEXT NOT NULL DEFAULT ''`, `alternate_whatsapp TEXT NOT NULL DEFAULT ''`, `whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE`, `whatsapp_attendance BOOLEAN NOT NULL DEFAULT FALSE`, `whatsapp_academics BOOLEAN NOT NULL DEFAULT FALSE`, `whatsapp_fees BOOLEAN NOT NULL DEFAULT FALSE`, `whatsapp_notices BOOLEAN NOT NULL DEFAULT FALSE`, `whatsapp_general BOOLEAN NOT NULL DEFAULT FALSE`, `whatsapp_consent_status TEXT NOT NULL DEFAULT 'UNKNOWN'`, `whatsapp_consent_at TIMESTAMPTZ`, `whatsapp_consent_source TEXT NOT NULL DEFAULT ''`, `whatsapp_opted_out_at TIMESTAMPTZ`, `whatsapp_contact_verified_at TIMESTAMPTZ`

### `templateAdditions` → `whatsapp_templates`

- `approval_status TEXT NOT NULL DEFAULT 'UNKNOWN'`, `provider_category TEXT NOT NULL DEFAULT ''`, `rejection_reason TEXT NOT NULL DEFAULT ''`, `provider_updated_at TIMESTAMPTZ`, `last_synced_at TIMESTAMPTZ`

### `messageAdditions` → `whatsapp_messages`

- `scheduled_at TIMESTAMPTZ`, `cancelled_at TIMESTAMPTZ`, `claimed_at TIMESTAMPTZ`, `lease_owner TEXT`, `lease_expires_at TIMESTAMPTZ`, `provider_status_at TIMESTAMPTZ`, `outcome_class TEXT NOT NULL DEFAULT ''`, `last_worker_id TEXT NOT NULL DEFAULT ''`

## Prisma schema representation (separate from runtime DDL)

The repository has 43 Prisma models and four enums. The following names are verified source declarations, not proof of tables in PostgreSQL. `@@map`/`@map` mappings and each model field are in `prisma/schema.prisma`; runtime code does not import Prisma Client.

### Prisma enum `Role`

Source: `prisma/schema.prisma:10`; values: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`, `ACCOUNTANT`, `LIBRARIAN`, `STAFF`.

### Prisma enum `Status`

Source: `prisma/schema.prisma:21`; values: `ACTIVE`, `INACTIVE`, `PENDING`, `APPROVED`, `REJECTED`, `WAITLISTED`.

### Prisma enum `PaymentStatus`

Source: `prisma/schema.prisma:30`; values: `CREATED`, `PAID`, `FAILED`, `REFUNDED`.

### Prisma enum `AttendanceStatus`

Source: `prisma/schema.prisma:37`; values: `PRESENT`, `ABSENT`, `LATE`, `LEAVE`, `EXCUSED`, `HALF_DAY`.

### Prisma model `Institution`

Source: `prisma/schema.prisma:46`.

```text
id                  String              @id @default(cuid())
name                String
type                String
status              String              @default("Active")
plannedStudentCount Int                 @default(0) @map("planned_student_count")
subscriptionStartDate DateTime?          @map("subscription_start_date")
subscriptionEndDate   DateTime?          @map("subscription_end_date")
createdAt           DateTime            @default(now())
users               User[]
classes             Class[]
students            Student[]
teachers            Teacher[]
fees                Fee[]
subscriptions       Subscription[]
subscriptionAdjustments SubscriptionAdjustment[]
whatsappAddonSubscriptions WhatsAppAddonSubscription[]
institutionSettings InstitutionSetting?
academicYears       AcademicYear[]
configuredClasses   InstitutionClass[]
schoolAssets        SchoolAsset[]
resultExaminations  ResultExamination[]
demotions           StudentDemotion[]
```

### Prisma model `User`

Source: `prisma/schema.prisma:71`.

```text
id            String         @id @default(cuid())
email         String         @unique
passwordHash  String?
name          String
phone         String?
role          Role
status        String         @default("Active")
lastLoginAt   DateTime?
verifiedAt    DateTime?
institutionId String?
institution   Institution?   @relation(fields: [institutionId], references: [id])
student       Student?
teacher       Teacher?
parent        Parent?
notifications Notification[]
sent          Message[]      @relation("Sent")
received      Message[]      @relation("Received")
auditLogs     AuditLog[]
demotionsChanged StudentDemotion[] @relation("DemotionChangedBy")
demotionsUndone StudentDemotion[] @relation("DemotionUndoneBy")
createdAt     DateTime       @default(now())
@@index([institutionId, role])
```

### Prisma model `Student`

Source: `prisma/schema.prisma:97`.

```text
id             String       @id @default(cuid())
admissionNo    String       @unique
photoPath      String?      @map("photo_path")
rollNumber     String?      @map("roll_number")
bloodGroup     String?      @map("blood_group")
motherName     String?      @map("mother_name")
specialQuota   String?      @map("special_quota")
specialQuotaDescription String? @map("special_quota_description")
userId         String       @unique
user           User         @relation(fields: [userId], references: [id])
institutionId  String
institution    Institution  @relation(fields: [institutionId], references: [id])
classId        String?
class          Class?       @relation(fields: [classId], references: [id])
parentId       String?
parent         Parent?      @relation(fields: [parentId], references: [id])
status         Status       @default(ACTIVE)
academicYear   String       @default("")
leavingDate    DateTime?
leavingReason  String       @default("")
graduationDate DateTime?
parentRelationship String @default("") @map("parent_relationship")
parentWhatsapp String @default("") @map("parent_whatsapp")
alternateWhatsapp String @default("") @map("alternate_whatsapp")
whatsappEnabled Boolean @default(false) @map("whatsapp_enabled")
whatsappAttendance Boolean @default(false) @map("whatsapp_attendance")
whatsappAcademics Boolean @default(false) @map("whatsapp_academics")
whatsappFees Boolean @default(false) @map("whatsapp_fees")
whatsappNotices Boolean @default(false) @map("whatsapp_notices")
whatsappGeneral Boolean @default(false) @map("whatsapp_general")
attendance     Attendance[]
fees           Fee[]
results        Result[]
managedResults ClassResultRecord[]
demotions      StudentDemotion[]
submissions    Submission[]
documents      Document[]
@@index([institutionId, classId])
```

### Prisma model `InstitutionSetting`

Source: `prisma/schema.prisma:139`.

```text
institutionId       String      @id
institution         Institution @relation(fields: [institutionId], references: [id])
academicYear        String
resultGradeBands           String  @default("") @map("result_grade_bands")
resultOverallPassPercent   Int     @default(35) @map("result_overall_pass_percent")
resultRequireSubjectPass   Boolean @default(true) @map("result_require_subject_pass")
resultRankingEnabled       Boolean @default(false) @map("result_ranking_enabled")
resultPrincipalRemarks     String  @default("") @map("result_principal_remarks")
resultClassTeacherRemarks  String  @default("") @map("result_class_teacher_remarks")
resultReportFormat         String  @default("Standard") @map("result_report_format")
timetableStartTime          String  @default("09:00") @map("timetable_start_time")
timetableEndTime            String  @default("16:00") @map("timetable_end_time")
timetablePeriodMinutes      Int     @default(40) @map("timetable_period_minutes")
timetableShortBreakMinutes  Int     @default(15) @map("timetable_short_break_minutes")
timetableLunchMinutes       Int     @default(40) @map("timetable_lunch_minutes")
timetablePeriodsPerDay      Int     @default(9) @map("timetable_periods_per_day")
timetableWorkingDays        String  @default("1,2,3,4,5,6") @map("timetable_working_days")
timetableTimezone           String  @default("Asia/Kolkata") @map("timetable_timezone")
schoolCode          String      @default("") @map("school_code")
schoolAddress       String      @default("")
schoolPhone         String      @default("")
schoolEmail         String      @default("")
diseCode            String      @default("")
website             String      @default("")
city                String      @default("")
state               String      @default("")
pinCode             String      @default("")
principalName       String      @default("")
registrationNumber  String      @default("")
affiliation         String      @default("")
motto               String      @default("")
schoolType          String      @default("")
feeReceiptTitle     String      @default("Fee Payment Receipt")
feeReceiptSubheader String      @default("Standard Fee Receipt Template")
payslipTitle        String      @default("Pay Slip")
payslipSubheader    String      @default("Standard Pay Slip Template")
footerText          String      @default("")
signatureLabel      String      @default("Authorized Signatory")
updatedAt           DateTime    @updatedAt
@@map("settings")
```

### Prisma model `AcademicYear`

Source: `prisma/schema.prisma:183`.

```text
id            String      @id @default(cuid())
institutionId String
institution   Institution @relation(fields: [institutionId], references: [id])
name          String
startMonth    Int         @default(4)
endMonth      Int         @default(3)
status        String      @default("Active")
isActive      Boolean     @default(false)
createdAt     DateTime    @default(now())
updatedAt     DateTime    @updatedAt
previousDemotions StudentDemotion[] @relation("DemotionPreviousYear")
newDemotions StudentDemotion[] @relation("DemotionNewYear")
@@unique([institutionId, name])
@@index([institutionId, status, isActive])
@@map("academic_years")
```

### Prisma model `InstitutionClass`

Source: `prisma/schema.prisma:202`.

```text
id            String               @id @default(cuid())
institutionId String
institution   Institution          @relation(fields: [institutionId], references: [id])
name          String
sortOrder     Int                  @default(0)
status        String               @default("Active")
sections      InstitutionSection[]
createdAt     DateTime             @default(now())
updatedAt     DateTime             @updatedAt
previousDemotions StudentDemotion[] @relation("DemotionPreviousClass")
newDemotions StudentDemotion[] @relation("DemotionNewClass")
@@unique([institutionId, name])
@@index([institutionId, status, sortOrder])
@@map("institution_classes")
```

### Prisma model `InstitutionSection`

Source: `prisma/schema.prisma:220`.

```text
id            String           @id @default(cuid())
institutionId String
classId       String
schoolClass   InstitutionClass @relation(fields: [classId], references: [id])
name          String
sortOrder     Int              @default(0)
status        String           @default("Active")
createdAt     DateTime         @default(now())
updatedAt     DateTime         @updatedAt
previousDemotions StudentDemotion[] @relation("DemotionPreviousSection")
newDemotions StudentDemotion[] @relation("DemotionNewSection")
@@unique([classId, name])
@@index([institutionId, classId, status, sortOrder])
@@map("institution_sections")
```

### Prisma model `StudentDemotion`

Source: `prisma/schema.prisma:238`.

```text
id                     String @id
institutionId          String @map("institution_id")
institution            Institution @relation(fields: [institutionId], references: [id])
studentId              String @map("student_id")
student                Student @relation(fields: [studentId], references: [id])
previousClassId        String? @map("previous_class_id")
previousClassRecord    InstitutionClass? @relation("DemotionPreviousClass", fields: [previousClassId], references: [id])
newClassId             String? @map("new_class_id")
newClassRecord         InstitutionClass? @relation("DemotionNewClass", fields: [newClassId], references: [id])
previousSectionId      String? @map("previous_section_id")
previousSectionRecord  InstitutionSection? @relation("DemotionPreviousSection", fields: [previousSectionId], references: [id])
newSectionId           String? @map("new_section_id")
newSectionRecord       InstitutionSection? @relation("DemotionNewSection", fields: [newSectionId], references: [id])
previousAcademicYearId String? @map("previous_academic_year_id")
previousYearRecord     AcademicYear? @relation("DemotionPreviousYear", fields: [previousAcademicYearId], references: [id])
newAcademicYearId      String? @map("new_academic_year_id")
newYearRecord          AcademicYear? @relation("DemotionNewYear", fields: [newAcademicYearId], references: [id])
previousClass          String @map("previous_class")
newClass               String @map("new_class")
previousSection        String @map("previous_section")
newSection             String @map("new_section")
previousYear           String @map("previous_year")
newYear                String @map("new_year")
reason                 String
remarks                String @default("")
changedById            String @map("changed_by")
changedBy              User @relation("DemotionChangedBy", fields: [changedById], references: [id])
createdAt              DateTime @default(now()) @map("created_at")
undoneById             String? @map("undone_by")
undoneBy               User? @relation("DemotionUndoneBy", fields: [undoneById], references: [id])
undoneAt               DateTime? @map("undone_at")
@@index([institutionId, studentId, createdAt], map: "idx_student_demotions_scope")
@@map("student_demotions")
```

### Prisma model `SchoolAsset`

Source: `prisma/schema.prisma:275`.

```text
id            String      @id @default(cuid())
institutionId String
institution   Institution @relation(fields: [institutionId], references: [id])
kind          String
mimeType      String
data          Bytes
sizeBytes     Int
updatedAt     DateTime    @updatedAt
@@unique([institutionId, kind])
@@map("school_assets")
```

### Prisma model `Teacher`

Source: `prisma/schema.prisma:289`.

```text
id            String      @id @default(cuid())
employeeNo    String      @unique
userId        String      @unique
user          User        @relation(fields: [userId], references: [id])
institutionId String
institution   Institution @relation(fields: [institutionId], references: [id])
subjects      Subject[]
documents     Document[]
```

### Prisma model `StaffAttendance`

Source: `prisma/schema.prisma:300`.

```text
id               String    @id
institutionId    String    @map("institution_id")
staffKey         String    @map("staff_key")
teacherId        String?   @map("teacher_id")
userId           String?   @map("user_id")
attendanceDate   String    @map("attendance_date")
status           String
checkInAt        DateTime? @map("check_in_at")
checkOutAt       DateTime? @map("check_out_at")
breakMinutes     Int       @default(0) @map("break_minutes")
totalWorkMinutes Int?      @map("total_work_minutes")
remarks          String    @default("")
createdBy        String?   @map("created_by")
updatedBy        String?   @map("updated_by")
createdAt        DateTime  @default(now()) @map("created_at")
updatedAt        DateTime  @updatedAt @map("updated_at")
@@unique([institutionId, staffKey, attendanceDate])
@@index([institutionId, attendanceDate, status])
@@index([institutionId, staffKey, attendanceDate])
@@map("staff_attendance")
```

### Prisma model `StaffAttendanceSetting`

Source: `prisma/schema.prisma:324`.

```text
institutionId              String   @id @map("institution_id")
workStartTime              String   @default("09:00") @map("work_start_time")
workEndTime                String   @default("17:00") @map("work_end_time")
lateAfterTime              String   @default("09:15") @map("late_after_time")
breakMinutes               Int      @default(30) @map("break_minutes")
workingDays                String   @default("1,2,3,4,5,6") @map("working_days")
timezone                   String   @default("Asia/Kolkata")
allowSelfCheckin           Boolean  @default(false) @map("allow_self_checkin")
correctionRequiresApproval Boolean  @default(false) @map("correction_requires_approval")
updatedAt                  DateTime @updatedAt @map("updated_at")
@@map("staff_attendance_settings")
```

### Prisma model `Parent`

Source: `prisma/schema.prisma:339`.

```text
id       String    @id @default(cuid())
userId   String    @unique
user     User      @relation(fields: [userId], references: [id])
students Student[]
```

### Prisma model `Class`

Source: `prisma/schema.prisma:346`.

```text
id            String       @id @default(cuid())
name          String
section       String
institutionId String
institution   Institution  @relation(fields: [institutionId], references: [id])
students      Student[]
subjects      Subject[]
timetable     Timetable[]
assignments   Assignment[]
@@unique([institutionId, name, section])
```

### Prisma model `Subject`

Source: `prisma/schema.prisma:360`.

```text
id        String      @id @default(cuid())
name      String
code      String
classId   String
class     Class       @relation(fields: [classId], references: [id])
teacherId String?
teacher   Teacher?    @relation(fields: [teacherId], references: [id])
exams     Exam[]
timetable Timetable[]
```

### Prisma model `Attendance`

Source: `prisma/schema.prisma:372`.

```text
id        String           @id @default(cuid())
date      DateTime
status    AttendanceStatus
studentId String
student   Student          @relation(fields: [studentId], references: [id])
markedBy  String
@@unique([studentId, date])
@@index([date, status])
```

### Prisma model `Admission`

Source: `prisma/schema.prisma:384`.

```text
id            String   @id @default(cuid())
institutionId String
applicantName String
email         String
status        Status   @default(PENDING)
data          Json
createdAt     DateTime @default(now())
```

### Prisma model `Fee`

Source: `prisma/schema.prisma:394`.

```text
id            String      @id @default(cuid())
title         String
amount        Decimal     @db.Decimal(12, 2)
dueDate       DateTime
studentId     String
student       Student     @relation(fields: [studentId], references: [id])
institutionId String
institution   Institution @relation(fields: [institutionId], references: [id])
payments      Payment[]
```

### Prisma model `Payment`

Source: `prisma/schema.prisma:406`.

```text
id                String        @id @default(cuid())
amount            Decimal       @db.Decimal(12, 2)
status            PaymentStatus @default(CREATED)
method            String?
providerOrderId   String?       @unique
providerPaymentId String?       @unique
feeId             String?
fee               Fee?          @relation(fields: [feeId], references: [id])
invoice           Invoice?
createdAt         DateTime      @default(now())
```

### Prisma model `Invoice`

Source: `prisma/schema.prisma:419`.

```text
id        String   @id @default(cuid())
number    String   @unique
paymentId String   @unique
payment   Payment  @relation(fields: [paymentId], references: [id])
tax       Decimal  @db.Decimal(12, 2)
issuedAt  DateTime @default(now())
```

### Prisma model `Exam`

Source: `prisma/schema.prisma:428`.

```text
id        String   @id @default(cuid())
name      String
startsAt  DateTime
subjectId String
subject   Subject  @relation(fields: [subjectId], references: [id])
results   Result[]
```

### Prisma model `ResultExamination`

Source: `prisma/schema.prisma:437`.

```text
id              String    @id
institutionId   String    @map("institution_id")
institution     Institution @relation(fields: [institutionId], references: [id])
name            String
academicYear    String    @map("academic_year")
className       String    @map("class_name")
section         String
startDate       String    @map("start_date")
endDate         String    @map("end_date")
publicationDate String?   @map("publication_date")
status          String    @default("Draft")
createdBy       String?   @map("created_by")
verifiedBy      String?   @map("verified_by")
approvedBy      String?   @map("approved_by")
publishedBy     String?   @map("published_by")
publishedAt     DateTime? @map("published_at")
createdAt       DateTime  @default(now()) @map("created_at")
updatedAt       DateTime  @updatedAt @map("updated_at")
subjects        ClassExamRecord[]
snapshots       ResultPublicationSnapshot[]
@@unique([institutionId, academicYear, className, section, name])
@@index([institutionId, academicYear, className, section, status])
@@map("result_examinations")
```

### Prisma model `ResultPublicationSnapshot`

Source: `prisma/schema.prisma:464`.

```text
id            String   @id
institutionId String   @map("institution_id")
examinationId String   @map("examination_id")
examination   ResultExamination @relation(fields: [examinationId], references: [id])
version       Int
snapshot      Json
publishedBy   String   @map("published_by")
publishedAt   DateTime @default(now()) @map("published_at")
@@unique([examinationId, version])
@@index([institutionId, examinationId, version])
@@map("result_publication_snapshots")
```

### Prisma model `ClassExamRecord`

Source: `prisma/schema.prisma:479`.

```text
id                  String    @id
institutionId       String    @map("institution_id")
className           String    @map("class_name")
section             String
academicYear        String    @map("academic_year")
name                String
examDate            String    @map("exam_date")
subject             String
maxMarks            Float     @map("max_marks")
passingMarks        Float     @map("passing_marks")
resultExaminationId String?   @map("result_examination_id")
resultExamination   ResultExamination? @relation(fields: [resultExaminationId], references: [id])
maxMarksCent        Int?      @map("max_marks_cent")
passingMarksCent    Int?      @map("passing_marks_cent")
required            Boolean  @default(true)
createdAt           DateTime  @default(now()) @map("created_at")
marks               ClassResultRecord[]
@@unique([resultExaminationId, subject])
@@index([institutionId, className, academicYear])
@@map("class_exams")
```

### Prisma model `ClassResultRecord`

Source: `prisma/schema.prisma:503`.

```text
id            String    @id
institutionId String    @map("institution_id")
examId        String    @map("exam_id")
exam          ClassExamRecord @relation(fields: [examId], references: [id])
studentId     String    @map("student_id")
student       Student   @relation(fields: [studentId], references: [id])
marks         Float
marksCent     Int?      @map("marks_cent")
markStatus    String    @default("Scored") @map("mark_status")
remarks       String    @default("")
grade         String
status        String
updatedBy     String?   @map("updated_by")
createdAt     DateTime  @default(now()) @map("created_at")
updatedAt     DateTime  @updatedAt @map("updated_at")
@@unique([examId, studentId])
@@index([institutionId, examId, studentId])
@@map("class_results")
```

### Prisma model `Result`

Source: `prisma/schema.prisma:525`.

```text
id        String  @id @default(cuid())
marks     Decimal @db.Decimal(5, 2)
grade     String
examId    String
exam      Exam    @relation(fields: [examId], references: [id])
studentId String
student   Student @relation(fields: [studentId], references: [id])
@@unique([examId, studentId])
```

### Prisma model `Assignment`

Source: `prisma/schema.prisma:537`.

```text
id          String       @id @default(cuid())
title       String
description String
dueAt       DateTime
classId     String
class       Class        @relation(fields: [classId], references: [id])
submissions Submission[]
```

### Prisma model `Submission`

Source: `prisma/schema.prisma:547`.

```text
id           String     @id @default(cuid())
assignmentId String
assignment   Assignment @relation(fields: [assignmentId], references: [id])
studentId    String
student      Student    @relation(fields: [studentId], references: [id])
fileUrl      String?
marks        Decimal?   @db.Decimal(5, 2)
feedback     String?
submittedAt  DateTime   @default(now())
@@unique([assignmentId, studentId])
```

### Prisma model `Timetable`

Source: `prisma/schema.prisma:561`.

```text
id        String  @id @default(cuid())
classId   String
class     Class   @relation(fields: [classId], references: [id])
subjectId String
subject   Subject @relation(fields: [subjectId], references: [id])
weekday   Int
startsAt  String
endsAt    String
room      String
@@unique([classId, weekday, startsAt])
```

### Prisma model `LibraryBook`

Source: `prisma/schema.prisma:575`.

```text
id           String               @id @default(cuid())
title        String
author       String
isbn         String               @unique
copies       Int
transactions LibraryTransaction[]
```

### Prisma model `LibraryTransaction`

Source: `prisma/schema.prisma:584`.

```text
id         String      @id @default(cuid())
bookId     String
book       LibraryBook @relation(fields: [bookId], references: [id])
userId     String
issuedAt   DateTime    @default(now())
dueAt      DateTime
returnedAt DateTime?
fine       Decimal     @default(0) @db.Decimal(10, 2)
```

### Prisma model `Transport`

Source: `prisma/schema.prisma:595`.

```text
id            String @id @default(cuid())
institutionId String
route         String
vehicleNo     String
driverName    String
stops         Json
```

### Prisma model `Event`

Source: `prisma/schema.prisma:604`.

```text
id            String   @id @default(cuid())
institutionId String
title         String
startsAt      DateTime
type          String
audience      Role[]
```

### Prisma model `Notice`

Source: `prisma/schema.prisma:613`.

```text
id            String    @id @default(cuid())
institutionId String
title         String
content       String
priority      String
audience      Role[]
publishedAt   DateTime?
expiresAt     DateTime?
```

### Prisma model `Notification`

Source: `prisma/schema.prisma:624`.

```text
id        String    @id @default(cuid())
userId    String
user      User      @relation(fields: [userId], references: [id])
type      String
title     String
readAt    DateTime?
createdAt DateTime  @default(now())
@@index([userId, readAt])
```

### Prisma model `Message`

Source: `prisma/schema.prisma:636`.

```text
id         String    @id @default(cuid())
senderId   String
sender     User      @relation("Sent", fields: [senderId], references: [id])
receiverId String
receiver   User      @relation("Received", fields: [receiverId], references: [id])
body       String
readAt     DateTime?
createdAt  DateTime  @default(now())
```

### Prisma model `SubscriptionPlan`

Source: `prisma/schema.prisma:647`.

```text
id            String         @id
name          String         @unique
price         Decimal        @db.Decimal(12, 2)
studentLimit  Int
teacherLimit  Int            @default(0)
billingPeriod String         @default("year")
active        Boolean        @default(true)
pricingModel  String         @default("PER_STUDENT") @map("pricing_model")
planVersion   Int            @default(1) @map("plan_version")
effectiveAt   DateTime?      @map("effective_at")
eligibleNewSchools Boolean   @default(false) @map("eligible_new_schools")
features      Json
subscriptions Subscription[]
createdAt     DateTime       @default(now())
updatedAt     DateTime       @updatedAt
```

### Prisma model `Subscription`

Source: `prisma/schema.prisma:665`.

```text
id                String           @id @default(cuid())
institutionId     String
institution       Institution      @relation(fields: [institutionId], references: [id])
planId            String
plan              SubscriptionPlan @relation(fields: [planId], references: [id])
studentCapacity   Int
studentCountAtPurchase Int?           @map("student_count_at_purchase")
pricingModel      String              @default("PER_STUDENT") @map("pricing_model")
planVersion       Int                 @default(1) @map("plan_version")
pricePerStudent   Decimal          @default(0) @db.Decimal(12, 2)
amountPaid        Decimal          @default(0) @db.Decimal(12, 2)
status            String
activationDate    DateTime?
expiryDate        DateTime?
razorpayOrderId   String           @unique
razorpayPaymentId String?          @unique
razorpaySignature String?
createdAt         DateTime         @default(now())
updatedAt         DateTime         @updatedAt
adjustments      SubscriptionAdjustment[]
@@index([institutionId, status, expiryDate])
```

### Prisma model `SubscriptionAdjustment`

Source: `prisma/schema.prisma:690`.

```text
id                String       @id
institutionId     String       @map("institution_id")
institution       Institution  @relation(fields: [institutionId], references: [id], onDelete: Restrict)
subscriptionId    String       @map("subscription_id")
subscription      Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Restrict)
oldCapacity       Int          @map("old_capacity")
newCapacity       Int          @map("new_capacity")
amount            Decimal      @default(0) @db.Decimal(12, 2)
creditAmount      Decimal      @default(0) @map("credit_amount") @db.Decimal(12, 2)
status            String
razorpayOrderId   String?      @unique @map("razorpay_order_id")
razorpayPaymentId String?      @unique @map("razorpay_payment_id")
createdBy         String?      @map("created_by")
createdAt         DateTime     @default(now()) @map("created_at")
updatedAt         DateTime     @updatedAt @map("updated_at")
@@index([institutionId, status, createdAt])
@@map("subscription_adjustments")
```

### Prisma model `WhatsAppAddonSubscription`

Source: `prisma/schema.prisma:711`.

```text
id                String      @id @default(cuid())
institutionId     String      @map("institution_id")
institution       Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)
studentCount      Int         @map("student_count")
pricePerStudent   Decimal     @map("price_per_student") @db.Decimal(12, 2)
amountPaid        Decimal     @map("amount_paid") @db.Decimal(12, 2)
status            String
paymentStatus     String      @default("Pending") @map("payment_status")
currency          String      @default("INR")
activationDate    DateTime    @map("activation_date")
expiryDate        DateTime    @map("expiry_date")
razorpayOrderId   String      @unique @map("razorpay_order_id")
razorpayPaymentId String?     @unique @map("razorpay_payment_id")
razorpaySignature String?     @map("razorpay_signature")
createdAt         DateTime    @default(now()) @map("created_at")
updatedAt         DateTime    @updatedAt @map("updated_at")
@@index([institutionId, status, expiryDate])
@@map("whatsapp_addon_subscriptions")
```

### Prisma model `Document`

Source: `prisma/schema.prisma:733`.

```text
id        String   @id @default(cuid())
name      String
url       String
mimeType  String
studentId String?
student   Student? @relation(fields: [studentId], references: [id])
teacherId String?
teacher   Teacher? @relation(fields: [teacherId], references: [id])
createdAt DateTime @default(now())
```

### Prisma model `AuditLog`

Source: `prisma/schema.prisma:745`.

```text
id            String   @id @default(cuid())
userId        String?
user          User?    @relation(fields: [userId], references: [id])
institutionId String?
action        String
entity        String
entityId      String?
metadata      Json?
ip            String?
createdAt     DateTime @default(now())
@@index([institutionId, createdAt])
```

### Prisma model `AdminSetting`

Source: `prisma/schema.prisma:760`.

```text
id                    String   @id
applicationName       String   @default("EduLedger")
supportEmail          String   @default("")
currency              String   @default("INR")
timezone              String   @default("Asia/Kolkata")
dateFormat            String   @default("DD/MM/YYYY")
sessionTimeoutMinutes Int      @default(10080)
updatedBy             String?
updatedAt             DateTime @updatedAt
@@map("admin_settings")
```

## Historical migration DDL declarations (quarantined/unverified)

The following definitions are historical SQL text only. They do not establish that the objects exist or that files were applied. Overlapping names are intentionally shown as separate definitions; no canonical merge is inferred.

### `database/migrations/202609200001_registration_core.sql`

**CREATE TABLE `institutions` (line 1)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `name TEXT NOT NULL` |
| `status TEXT NOT NULL DEFAULT 'Active'` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `users` (line 8)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `email TEXT NOT NULL` |
| `name TEXT NOT NULL` |
| `password_hash TEXT NOT NULL` |
| `role TEXT NOT NULL` |
| `status TEXT NOT NULL DEFAULT 'Active'` |
| `last_login_at TIMESTAMPTZ` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `sessions` (line 23)**

| Definition |
|---|
| `token TEXT PRIMARY KEY` |
| `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `expires_at TIMESTAMPTZ NOT NULL` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `settings` (line 32)**

| Definition |
|---|
| `institution_id TEXT PRIMARY KEY REFERENCES institutions(id)` |
| `academic_year TEXT NOT NULL DEFAULT '2026-2027'` |
| `school_address TEXT NOT NULL DEFAULT ''` |
| `school_phone TEXT NOT NULL DEFAULT ''` |
| `school_email TEXT NOT NULL DEFAULT ''` |
| `logo_url TEXT NOT NULL DEFAULT ''` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 42 | `institutions` | `status TEXT NOT NULL DEFAULT 'Active'` |
| 43 | `users` | `status TEXT NOT NULL DEFAULT 'Active'` |
| 44 | `users` | `last_login_at TIMESTAMPTZ` |
| 45 | `settings` | `school_email TEXT NOT NULL DEFAULT ''` |

### `prisma/migrations/202609110001_annual_subscriptions/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `SubscriptionPlan` | `"billingPeriod" TEXT NOT NULL DEFAULT 'year'` |
| 2 | `SubscriptionPlan` | `"active" BOOLEAN NOT NULL DEFAULT true` |
| 3 | `SubscriptionPlan` | `"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| 4 | `SubscriptionPlan` | `"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| 9 | `Subscription` | `"studentCapacity" INTEGER NOT NULL DEFAULT 0` |
| 10 | `Subscription` | `"amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0` |
| 11 | `Subscription` | `"razorpayOrderId" TEXT` |
| 12 | `Subscription` | `"razorpayPaymentId" TEXT` |
| 13 | `Subscription` | `"razorpaySignature" TEXT` |
| 14 | `Subscription` | `"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| 15 | `Subscription` | `"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `prisma/migrations/202609140001_institution_settings/migration.sql`

**CREATE TABLE `academic_years` (line 21)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name TEXT NOT NULL` |
| `start_month INTEGER NOT NULL DEFAULT 4 CHECK(start_month BETWEEN 1 AND 12)` |
| `end_month INTEGER NOT NULL DEFAULT 3 CHECK(end_month BETWEEN 1 AND 12)` |
| `status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Archived'))` |
| `is_active BOOLEAN NOT NULL DEFAULT FALSE` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,name)` |

**CREATE TABLE `institution_classes` (line 22)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name TEXT NOT NULL` |
| `sort_order INTEGER NOT NULL DEFAULT 0` |
| `status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive'))` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,name)` |

**CREATE TABLE `institution_sections` (line 23)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `class_id TEXT NOT NULL REFERENCES institution_classes(id) ON DELETE RESTRICT` |
| `name TEXT NOT NULL` |
| `sort_order INTEGER NOT NULL DEFAULT 0` |
| `status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive'))` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(class_id,name)` |

**CREATE TABLE `school_assets` (line 24)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `kind TEXT NOT NULL CHECK(kind IN ('logo','signature'))` |
| `mime_type TEXT NOT NULL` |
| `data BYTEA NOT NULL` |
| `size_bytes INTEGER NOT NULL` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,kind)` |

**CREATE TABLE `student_enrollments` (line 28)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `academic_year TEXT NOT NULL` |
| `class_name TEXT NOT NULL` |
| `section TEXT NOT NULL DEFAULT ''` |
| `status TEXT NOT NULL DEFAULT 'Active'` |
| `promoted_from_enrollment_id TEXT REFERENCES student_enrollments(id) ON DELETE SET NULL` |
| `promoted_at TIMESTAMPTZ` |
| `promoted_by TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,student_id,academic_year)` |

**CREATE TABLE `promotion_batches` (line 29)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `source_academic_year TEXT NOT NULL` |
| `target_academic_year TEXT NOT NULL` |
| `source_class TEXT NOT NULL` |
| `source_section TEXT NOT NULL DEFAULT ''` |
| `target_class TEXT NOT NULL` |
| `target_section TEXT NOT NULL DEFAULT ''` |
| `promoted_by TEXT NOT NULL REFERENCES users(id)` |
| `promoted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `status TEXT NOT NULL DEFAULT 'Completed'` |
| `correction_reason TEXT` |

**CREATE TABLE `promotion_items` (line 30)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `batch_id TEXT NOT NULL REFERENCES promotion_batches(id) ON DELETE RESTRICT` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `source_enrollment_id TEXT NOT NULL REFERENCES student_enrollments(id)` |
| `target_enrollment_id TEXT NOT NULL REFERENCES student_enrollments(id)` |
| `status TEXT NOT NULL DEFAULT 'Promoted'` |
| `error_message TEXT NOT NULL DEFAULT ''` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,student_id,target_enrollment_id)` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `settings` | `dise_code TEXT NOT NULL DEFAULT ''` |
| 2 | `settings` | `website TEXT NOT NULL DEFAULT ''` |
| 3 | `settings` | `city TEXT NOT NULL DEFAULT ''` |
| 4 | `settings` | `state TEXT NOT NULL DEFAULT ''` |
| 5 | `settings` | `pin_code TEXT NOT NULL DEFAULT ''` |
| 6 | `settings` | `principal_name TEXT NOT NULL DEFAULT ''` |
| 7 | `settings` | `registration_number TEXT NOT NULL DEFAULT ''` |
| 8 | `settings` | `affiliation TEXT NOT NULL DEFAULT ''` |
| 9 | `settings` | `motto TEXT NOT NULL DEFAULT ''` |
| 10 | `settings` | `school_type TEXT NOT NULL DEFAULT ''` |
| 11 | `settings` | `fee_receipt_title TEXT NOT NULL DEFAULT 'Fee Payment Receipt'` |
| 12 | `settings` | `fee_receipt_subheader TEXT NOT NULL DEFAULT 'Standard Fee Receipt Template'` |
| 13 | `settings` | `payslip_title TEXT NOT NULL DEFAULT 'Pay Slip'` |
| 14 | `settings` | `payslip_subheader TEXT NOT NULL DEFAULT 'Standard Pay Slip Template'` |
| 15 | `settings` | `footer_text TEXT NOT NULL DEFAULT ''` |
| 16 | `settings` | `signature_label TEXT NOT NULL DEFAULT 'Authorized Signatory'` |
| 17 | `students` | `academic_year TEXT NOT NULL DEFAULT ''` |
| 18 | `students` | `leaving_date TEXT` |
| 19 | `students` | `leaving_reason TEXT NOT NULL DEFAULT ''` |
| 20 | `students` | `graduation_date TEXT` |

### `prisma/migrations/202609140002_private_admin/migration.sql`

**CREATE TABLE `admin_settings` (line 4)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `application_name TEXT NOT NULL DEFAULT 'EduLedger'` |
| `support_email TEXT NOT NULL DEFAULT ''` |
| `currency TEXT NOT NULL DEFAULT 'INR'` |
| `timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'` |
| `date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY'` |
| `session_timeout_minutes INTEGER NOT NULL DEFAULT 10080` |
| `updated_by TEXT` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `users` | `status TEXT NOT NULL DEFAULT 'Active'` |
| 2 | `users` | `last_login_at TIMESTAMPTZ` |
| 3 | `institutions` | `status TEXT NOT NULL DEFAULT 'Active'` |

### `prisma/migrations/202609140003_salary_management/migration.sql`

**CREATE TABLE `salaries` (line 1)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `employee_key TEXT NOT NULL` |
| `teacher_id TEXT REFERENCES teachers(id) ON DELETE RESTRICT` |
| `user_id TEXT REFERENCES users(id) ON DELETE RESTRICT` |
| `employee_name TEXT NOT NULL` |
| `employee_number TEXT NOT NULL` |
| `employee_role TEXT NOT NULL` |
| `department TEXT NOT NULL DEFAULT ''` |
| `designation TEXT NOT NULL DEFAULT ''` |
| `salary_month INTEGER NOT NULL CHECK(salary_month BETWEEN 1 AND 12)` |
| `salary_year INTEGER NOT NULL CHECK(salary_year BETWEEN 2000 AND 2200)` |
| `basic_paise INTEGER NOT NULL CHECK(basic_paise>=0)` |
| `allowances_paise INTEGER NOT NULL DEFAULT 0 CHECK(allowances_paise>=0)` |
| `bonus_paise INTEGER NOT NULL DEFAULT 0 CHECK(bonus_paise>=0)` |
| `overtime_paise INTEGER NOT NULL DEFAULT 0 CHECK(overtime_paise>=0)` |
| `other_earnings_paise INTEGER NOT NULL DEFAULT 0 CHECK(other_earnings_paise>=0)` |
| `gross_paise INTEGER NOT NULL CHECK(gross_paise>=0)` |
| `deductions_paise INTEGER NOT NULL DEFAULT 0 CHECK(deductions_paise>=0)` |
| `advance_deduction_paise INTEGER NOT NULL DEFAULT 0 CHECK(advance_deduction_paise>=0)` |
| `other_deductions_paise INTEGER NOT NULL DEFAULT 0 CHECK(other_deductions_paise>=0)` |
| `total_deductions_paise INTEGER NOT NULL CHECK(total_deductions_paise>=0)` |
| `net_paise INTEGER NOT NULL CHECK(net_paise>=0)` |
| `paid_paise INTEGER NOT NULL DEFAULT 0 CHECK(paid_paise>=0)` |
| `payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Pending','Paid','Partially Paid','Cancelled','On Hold'))` |
| `payment_date TEXT` |
| `payment_method TEXT` |
| `payment_reference TEXT NOT NULL DEFAULT ''` |
| `payment_notes TEXT NOT NULL DEFAULT ''` |
| `notes TEXT NOT NULL DEFAULT ''` |
| `payslip_number TEXT NOT NULL UNIQUE` |
| `created_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(employee_key,salary_month,salary_year)` |

### `prisma/migrations/202609150001_subscription_lifecycle/migration.sql`

**CREATE TABLE `subscription_notification_events` (line 16)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `milestone TEXT NOT NULL` |
| `status TEXT NOT NULL DEFAULT 'SENT'` |
| `attempts INTEGER NOT NULL DEFAULT 1` |
| `last_error TEXT NOT NULL DEFAULT ''` |
| `sent_at TIMESTAMPTZ` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(subscription_id,milestone)` |

**CREATE TABLE `subscription_processing_logs` (line 17)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `finished_at TIMESTAMPTZ` |
| `status TEXT NOT NULL` |
| `checked_count INTEGER NOT NULL DEFAULT 0` |
| `expired_count INTEGER NOT NULL DEFAULT 0` |
| `notification_count INTEGER NOT NULL DEFAULT 0` |
| `error TEXT NOT NULL DEFAULT ''` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `subscriptions` | `payment_status TEXT NOT NULL DEFAULT 'Pending'` |
| 2 | `subscriptions` | `plan_type TEXT NOT NULL DEFAULT 'Yearly'` |
| 3 | `subscriptions` | `currency TEXT NOT NULL DEFAULT 'INR'` |
| 4 | `subscriptions` | `renewal_date TIMESTAMPTZ` |
| 5 | `subscriptions` | `auto_renew BOOLEAN NOT NULL DEFAULT FALSE` |
| 6 | `subscriptions` | `last_notification_sent TIMESTAMPTZ` |
| 7 | `subscriptions` | `grace_period_days INTEGER NOT NULL DEFAULT 0` |
| 8 | `notifications` | `link TEXT NOT NULL DEFAULT ''` |
| 9 | `notifications` | `delivery_status TEXT NOT NULL DEFAULT 'SENT'` |
| 10 | `admin_settings` | `subscription_warning_days TEXT NOT NULL DEFAULT '30,15,7,3,1,0,-1'` |
| 11 | `admin_settings` | `subscription_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE` |
| 12 | `admin_settings` | `in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE` |
| 13 | `admin_settings` | `email_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE` |
| 14 | `admin_settings` | `subscription_grace_days INTEGER NOT NULL DEFAULT 0` |

### `prisma/migrations/202609160001_student_personal_fields/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `students` | `blood_group TEXT` |
| 2 | `students` | `mother_name TEXT` |

### `prisma/migrations/202609160002_student_special_quota/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `students` | `special_quota TEXT` |
| 2 | `students` | `special_quota_description TEXT` |

### `prisma/migrations/202609160003_student_roll_numbers/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `settings` | `school_code TEXT NOT NULL DEFAULT ''` |

### `prisma/migrations/202609170001_staff_attendance/migration.sql`

**CREATE TABLE `staff_attendance_settings` (line 1)**

| Definition |
|---|
| `institution_id TEXT PRIMARY KEY REFERENCES institutions(id)` |
| `work_start_time TEXT NOT NULL DEFAULT '09:00'` |
| `work_end_time TEXT NOT NULL DEFAULT '17:00'` |
| `late_after_time TEXT NOT NULL DEFAULT '09:15'` |
| `break_minutes INTEGER NOT NULL DEFAULT 30` |
| `working_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6'` |
| `timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'` |
| `allow_self_checkin BOOLEAN NOT NULL DEFAULT FALSE` |
| `correction_requires_approval BOOLEAN NOT NULL DEFAULT FALSE` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `staff_attendance` (line 14)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `staff_key TEXT NOT NULL` |
| `teacher_id TEXT REFERENCES teachers(id) ON DELETE RESTRICT` |
| `user_id TEXT REFERENCES users(id) ON DELETE RESTRICT` |
| `attendance_date TEXT NOT NULL` |
| `status TEXT NOT NULL CHECK (status IN ('Present','Absent','Late','Half Day','On Leave','Holiday','Work From Home'))` |
| `check_in_at TIMESTAMPTZ` |
| `check_out_at TIMESTAMPTZ` |
| `break_minutes INTEGER NOT NULL DEFAULT 0` |
| `total_work_minutes INTEGER` |
| `remarks TEXT NOT NULL DEFAULT ''` |
| `created_by TEXT REFERENCES users(id)` |
| `updated_by TEXT REFERENCES users(id)` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE (institution_id, staff_key, attendance_date)` |
| `CHECK ((teacher_id IS NULL) <> (user_id IS NULL))` |

### `prisma/migrations/202609170002_timetable_timing/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `settings` | `timetable_start_time TEXT NOT NULL DEFAULT '09:00'` |
| 2 | `settings` | `timetable_end_time TEXT NOT NULL DEFAULT '16:00'` |
| 3 | `settings` | `timetable_period_minutes INTEGER NOT NULL DEFAULT 40` |
| 4 | `settings` | `timetable_short_break_minutes INTEGER NOT NULL DEFAULT 15` |
| 5 | `settings` | `timetable_lunch_minutes INTEGER NOT NULL DEFAULT 40` |
| 6 | `settings` | `timetable_periods_per_day INTEGER NOT NULL DEFAULT 9` |
| 7 | `settings` | `timetable_working_days TEXT NOT NULL DEFAULT '1,2,3,4,5'` |
| 8 | `settings` | `timetable_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'` |
| 9 | `timetable_entries` | `generated BOOLEAN NOT NULL DEFAULT FALSE` |

### `prisma/migrations/202609170003_student_results/migration.sql`

**CREATE TABLE `result_examinations` (line 1)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `name TEXT NOT NULL` |
| `academic_year TEXT NOT NULL` |
| `class_name TEXT NOT NULL` |
| `section TEXT NOT NULL` |
| `start_date TEXT NOT NULL` |
| `end_date TEXT NOT NULL` |
| `publication_date TEXT` |
| `status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Marks Entry Open','Marks Entry Closed','Results Under Review','Approved','Published','Archived'))` |
| `created_by TEXT REFERENCES users(id)` |
| `verified_by TEXT REFERENCES users(id)` |
| `approved_by TEXT REFERENCES users(id)` |
| `published_by TEXT REFERENCES users(id)` |
| `published_at TIMESTAMPTZ` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE (institution_id,academic_year,class_name,section,name)` |

**CREATE TABLE `result_publication_snapshots` (line 23)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `examination_id TEXT NOT NULL REFERENCES result_examinations(id) ON DELETE RESTRICT` |
| `version INTEGER NOT NULL` |
| `snapshot JSONB NOT NULL` |
| `published_by TEXT NOT NULL REFERENCES users(id)` |
| `published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE (examination_id,version)` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 35 | `class_exams` | `result_examination_id TEXT REFERENCES result_examinations(id)` |
| 36 | `class_exams` | `max_marks_cent INTEGER` |
| 37 | `class_exams` | `passing_marks_cent INTEGER` |
| 38 | `class_exams` | `required BOOLEAN NOT NULL DEFAULT TRUE` |
| 41 | `class_results` | `marks_cent INTEGER` |
| 42 | `class_results` | `mark_status TEXT NOT NULL DEFAULT 'Scored'` |
| 43 | `class_results` | `remarks TEXT NOT NULL DEFAULT ''` |
| 44 | `class_results` | `updated_by TEXT REFERENCES users(id)` |
| 45 | `class_results` | `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| 48 | `settings` | `result_grade_bands TEXT NOT NULL DEFAULT ''` |
| 49 | `settings` | `result_overall_pass_percent INTEGER NOT NULL DEFAULT 35` |
| 50 | `settings` | `result_require_subject_pass BOOLEAN NOT NULL DEFAULT TRUE` |
| 51 | `settings` | `result_ranking_enabled BOOLEAN NOT NULL DEFAULT FALSE` |
| 52 | `settings` | `result_principal_remarks TEXT NOT NULL DEFAULT ''` |
| 53 | `settings` | `result_class_teacher_remarks TEXT NOT NULL DEFAULT ''` |
| 54 | `settings` | `result_report_format TEXT NOT NULL DEFAULT 'Standard'` |

### `prisma/migrations/202609180001_student_demotions/migration.sql`

**CREATE TABLE `student_demotions` (line 1)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `previous_class_id TEXT REFERENCES institution_classes(id)` |
| `new_class_id TEXT REFERENCES institution_classes(id)` |
| `previous_section_id TEXT REFERENCES institution_sections(id)` |
| `new_section_id TEXT REFERENCES institution_sections(id)` |
| `previous_academic_year_id TEXT REFERENCES academic_years(id)` |
| `new_academic_year_id TEXT REFERENCES academic_years(id)` |
| `previous_class TEXT NOT NULL` |
| `new_class TEXT NOT NULL` |
| `previous_section TEXT NOT NULL` |
| `new_section TEXT NOT NULL` |
| `previous_year TEXT NOT NULL` |
| `new_year TEXT NOT NULL` |
| `reason TEXT NOT NULL` |
| `remarks TEXT NOT NULL DEFAULT ''` |
| `changed_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `undone_by TEXT REFERENCES users(id)` |
| `undone_at TIMESTAMPTZ` |

### `prisma/migrations/202609180002_payment_idempotency/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `payments` | `request_id TEXT` |

### `prisma/migrations/202609190001_finance_payment_details/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `payments` | `payment_frequency TEXT NOT NULL DEFAULT 'Custom'` |
| 2 | `payments` | `original_amount NUMERIC(12,2) NOT NULL DEFAULT 0` |
| 3 | `payments` | `discount_type TEXT NOT NULL DEFAULT 'Fixed'` |
| 4 | `payments` | `discount_value NUMERIC(12,2) NOT NULL DEFAULT 0` |
| 5 | `payments` | `discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0` |
| 6 | `payments` | `discount_reason TEXT NOT NULL DEFAULT ''` |
| 7 | `payments` | `late_fee NUMERIC(12,2) NOT NULL DEFAULT 0` |
| 8 | `payments` | `net_payable NUMERIC(12,2) NOT NULL DEFAULT 0` |
| 9 | `students` | `leaving_remarks TEXT NOT NULL DEFAULT ''` |

### `prisma/migrations/202609210001_whatsapp_integration/migration.sql`

**CREATE TABLE `whatsapp_configurations` (line 11)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE` |
| `enabled BOOLEAN NOT NULL DEFAULT FALSE` |
| `business_account_id TEXT NOT NULL DEFAULT ''` |
| `phone_number_id TEXT NOT NULL DEFAULT ''` |
| `display_number TEXT NOT NULL DEFAULT ''` |
| `access_token_ciphertext TEXT NOT NULL DEFAULT ''` |
| `configuration_status TEXT NOT NULL DEFAULT 'Not Configured'` |
| `webhook_status TEXT NOT NULL DEFAULT 'Not Configured'` |
| `auto_absence BOOLEAN NOT NULL DEFAULT FALSE` |
| `auto_fee_receipt BOOLEAN NOT NULL DEFAULT FALSE` |
| `auto_fee_reminder BOOLEAN NOT NULL DEFAULT FALSE` |
| `auto_marksheet BOOLEAN NOT NULL DEFAULT FALSE` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `whatsapp_templates` (line 18)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE` |
| `name TEXT NOT NULL` |
| `category TEXT NOT NULL` |
| `language TEXT NOT NULL DEFAULT 'en'` |
| `provider_template_name TEXT NOT NULL` |
| `enabled BOOLEAN NOT NULL DEFAULT TRUE` |
| `variables JSONB NOT NULL DEFAULT '[]'::jsonb` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,name)` |

**CREATE TABLE `whatsapp_messages` (line 22)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `student_id TEXT REFERENCES students(id) ON DELETE SET NULL` |
| `recipient_name TEXT NOT NULL DEFAULT ''` |
| `recipient_phone TEXT NOT NULL` |
| `message_type TEXT NOT NULL` |
| `template_name TEXT NOT NULL` |
| `language TEXT NOT NULL DEFAULT 'en'` |
| `parameters JSONB NOT NULL DEFAULT '[]'::jsonb` |
| `document_kind TEXT` |
| `document_reference TEXT` |
| `provider_message_id TEXT` |
| `idempotency_key TEXT NOT NULL` |
| `status TEXT NOT NULL DEFAULT 'Queued'` |
| `attempt_count INTEGER NOT NULL DEFAULT 0` |
| `next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `error_code TEXT NOT NULL DEFAULT ''` |
| `error_message TEXT NOT NULL DEFAULT ''` |
| `sent_by TEXT NOT NULL REFERENCES users(id)` |
| `sent_at TIMESTAMPTZ` |
| `delivered_at TIMESTAMPTZ` |
| `read_at TIMESTAMPTZ` |
| `failed_at TIMESTAMPTZ` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,idempotency_key)` |
| `UNIQUE(provider_message_id)` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `students` | `parent_relationship TEXT NOT NULL DEFAULT ''` |
| 2 | `students` | `parent_whatsapp TEXT NOT NULL DEFAULT ''` |
| 3 | `students` | `alternate_whatsapp TEXT NOT NULL DEFAULT ''` |
| 4 | `students` | `whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE` |
| 5 | `students` | `whatsapp_attendance BOOLEAN NOT NULL DEFAULT FALSE` |
| 6 | `students` | `whatsapp_academics BOOLEAN NOT NULL DEFAULT FALSE` |
| 7 | `students` | `whatsapp_fees BOOLEAN NOT NULL DEFAULT FALSE` |
| 8 | `students` | `whatsapp_notices BOOLEAN NOT NULL DEFAULT FALSE` |
| 9 | `students` | `whatsapp_general BOOLEAN NOT NULL DEFAULT FALSE` |

### `prisma/migrations/202609210003_salary_accounting/migration.sql`

**CREATE TABLE `salary_payment_events` (line 1)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `salary_id TEXT NOT NULL REFERENCES salaries(id) ON DELETE RESTRICT` |
| `request_id TEXT NOT NULL` |
| `amount_paise INTEGER NOT NULL CHECK(amount_paise>0)` |
| `account_transaction_id TEXT NOT NULL REFERENCES account_transactions(id) ON DELETE RESTRICT` |
| `created_by TEXT NOT NULL REFERENCES users(id)` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,request_id)` |

### `prisma/migrations/202609220001_per_student_annual_pricing/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 3 | `subscriptions` | `price_per_student NUMERIC(12,2) NOT NULL DEFAULT 0` |

### `prisma/migrations/202609220002_subscription_onboarding/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `institutions` | `planned_student_count INTEGER NOT NULL DEFAULT 0` |

### `prisma/migrations/202609230001_school_subscription_period/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `institutions` | `"subscription_start_date" TIMESTAMPTZ` |
| 2 | `institutions` | `"subscription_end_date" TIMESTAMPTZ` |

### `prisma/migrations/202610140001_whatsapp_addon_billing/migration.sql`

**CREATE TABLE `whatsapp_addon_subscriptions` (line 3)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `student_count INTEGER NOT NULL CHECK (student_count > 0)` |
| `price_per_student NUMERIC(12, 2) NOT NULL CHECK (price_per_student > 0)` |
| `amount_paid NUMERIC(12, 2) NOT NULL` |
| `status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'FAILED', 'CANCELLED'))` |
| `payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Cancelled'))` |
| `currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR')` |
| `activation_date TIMESTAMPTZ NOT NULL` |
| `expiry_date TIMESTAMPTZ NOT NULL` |
| `razorpay_order_id TEXT NOT NULL UNIQUE` |
| `razorpay_payment_id TEXT UNIQUE` |
| `razorpay_signature TEXT` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `CONSTRAINT whatsapp_addon_amount_matches_students CHECK ((student_count <= 100 AND amount_paid = 10000) OR (student_count > 100 AND amount_paid = student_count * price_per_student))` |
| `CONSTRAINT whatsapp_addon_period_valid CHECK (expiry_date > activation_date)` |

### `prisma/migrations/202610150001_whatsapp_production_hardening/migration.sql`

**CREATE TABLE `whatsapp_webhook_events` (line 33)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `provider_event_key TEXT NOT NULL UNIQUE` |
| `provider_message_id TEXT NOT NULL` |
| `event_status TEXT NOT NULL` |
| `event_at TIMESTAMPTZ` |
| `payload_hash TEXT NOT NULL` |
| `processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `whatsapp_consent_events` (line 43)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT` |
| `contact_fingerprint TEXT NOT NULL` |
| `status TEXT NOT NULL CHECK (status IN ('GRANTED','OPTED_OUT','UNKNOWN'))` |
| `source TEXT NOT NULL` |
| `changed_by TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `whatsapp_campaigns` (line 55)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT` |
| `idempotency_key TEXT NOT NULL` |
| `audience_fingerprint TEXT NOT NULL` |
| `criteria JSONB NOT NULL` |
| `message_type TEXT NOT NULL` |
| `template_name TEXT NOT NULL` |
| `scheduled_at TIMESTAMPTZ` |
| `status TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING','QUEUED','CANCELLED','FAILED'))` |
| `eligible_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_count >= 0)` |
| `queued_count INTEGER NOT NULL DEFAULT 0 CHECK (queued_count >= 0)` |
| `excluded_count INTEGER NOT NULL DEFAULT 0 CHECK (excluded_count >= 0)` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `completed_at TIMESTAMPTZ` |
| `UNIQUE(institution_id, idempotency_key)` |
| `CHECK (queued_count <= eligible_count)` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 5 | `students` | `whatsapp_consent_status TEXT NOT NULL DEFAULT 'UNKNOWN'` |
| 6 | `students` | `whatsapp_consent_at TIMESTAMPTZ` |
| 7 | `students` | `whatsapp_consent_source TEXT NOT NULL DEFAULT ''` |
| 8 | `students` | `whatsapp_opted_out_at TIMESTAMPTZ` |
| 9 | `students` | `whatsapp_contact_verified_at TIMESTAMPTZ` |
| 11 | `whatsapp_configurations` | `test_mode BOOLEAN NOT NULL DEFAULT TRUE` |
| 12 | `whatsapp_configurations` | `default_country_code TEXT NOT NULL DEFAULT '91'` |
| 13 | `whatsapp_configurations` | `webhook_last_received_at TIMESTAMPTZ` |
| 15 | `whatsapp_templates` | `approval_status TEXT NOT NULL DEFAULT 'UNKNOWN'` |
| 16 | `whatsapp_templates` | `provider_category TEXT NOT NULL DEFAULT ''` |
| 17 | `whatsapp_templates` | `rejection_reason TEXT NOT NULL DEFAULT ''` |
| 18 | `whatsapp_templates` | `provider_updated_at TIMESTAMPTZ` |
| 19 | `whatsapp_templates` | `last_synced_at TIMESTAMPTZ` |
| 21 | `whatsapp_messages` | `scheduled_at TIMESTAMPTZ` |
| 22 | `whatsapp_messages` | `cancelled_at TIMESTAMPTZ` |
| 23 | `whatsapp_messages` | `claimed_at TIMESTAMPTZ` |
| 24 | `whatsapp_messages` | `lease_owner TEXT` |
| 25 | `whatsapp_messages` | `lease_expires_at TIMESTAMPTZ` |
| 26 | `whatsapp_messages` | `provider_status_at TIMESTAMPTZ` |
| 27 | `whatsapp_messages` | `outcome_class TEXT NOT NULL DEFAULT ''` |
| 28 | `whatsapp_messages` | `last_worker_id TEXT NOT NULL DEFAULT ''` |
| 29 | `whatsapp_messages` | `campaign_id TEXT` |
| 30 | `whatsapp_messages` | `audience JSONB NOT NULL DEFAULT '{}'::jsonb` |
| 31 | `whatsapp_messages` | `request_payload_hash TEXT NOT NULL DEFAULT ''` |

### `prisma/migrations/202610240001_fixed_starter_pricing/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 3 | `subscription_plans` | `pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT',` |
| 9 | `subscriptions` | `student_count_at_purchase INTEGER,` |
| 18 | `subscription_payments` | `student_count_at_purchase INTEGER,` |

### `prisma/migrations/202610270001_subscription_capacity_adjustments/migration.sql`

**CREATE TABLE `subscription_adjustments` (line 3)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT` |
| `subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT` |
| `old_capacity INTEGER NOT NULL CHECK (old_capacity > 0)` |
| `new_capacity INTEGER NOT NULL CHECK (new_capacity > 0)` |
| `amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0)` |
| `credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0)` |
| `status TEXT NOT NULL CHECK (status IN ('PENDING','PAID','CREDITED','FAILED','CANCELLED'))` |
| `razorpay_order_id TEXT UNIQUE` |
| `razorpay_payment_id TEXT UNIQUE` |
| `created_by TEXT REFERENCES users(id) ON DELETE SET NULL` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `prisma/migrations/202611030001_attendance_upgrade/migration.sql`

**CREATE TABLE `attendance_audit_logs` (line 13)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `attendance_id TEXT` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `academic_year TEXT NOT NULL` |
| `class_name TEXT NOT NULL` |
| `section TEXT NOT NULL` |
| `date TEXT NOT NULL` |
| `previous_status TEXT` |
| `new_status TEXT NOT NULL` |
| `previous_remarks TEXT NOT NULL DEFAULT ''` |
| `new_remarks TEXT NOT NULL DEFAULT ''` |
| `changed_by TEXT NOT NULL REFERENCES users(id)` |
| `reason TEXT NOT NULL DEFAULT ''` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `school_holidays` (line 35)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `academic_year TEXT NOT NULL` |
| `date TEXT NOT NULL` |
| `name TEXT NOT NULL` |
| `type TEXT NOT NULL DEFAULT 'Public Holiday' CHECK(type IN ('Public Holiday','School Holiday','Vacation','Weather Emergency','Administrative'))` |
| `description TEXT NOT NULL DEFAULT ''` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(institution_id,date)` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 10 | `settings` | `attendance_correction_window_hours INTEGER NOT NULL DEFAULT 24` |

### `prisma/migrations/202611030002_parent_portal/migration.sql`

**CREATE TABLE `parent_students` (line 4)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `relationship TEXT NOT NULL DEFAULT 'Parent'` |
| `is_primary BOOLEAN NOT NULL DEFAULT TRUE` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE(parent_user_id, student_id)` |

**CREATE TABLE `parent_invitations` (line 19)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `parent_name TEXT NOT NULL` |
| `parent_email TEXT NOT NULL` |
| `parent_phone TEXT NOT NULL DEFAULT ''` |
| `invitation_code TEXT NOT NULL UNIQUE` |
| `status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','EXPIRED'))` |
| `expires_at TIMESTAMPTZ NOT NULL` |
| `created_by TEXT REFERENCES users(id)` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `accepted_at TIMESTAMPTZ` |

### `prisma/migrations/202611030003_notification_engine/migration.sql`

**CREATE TABLE `fcm_device_tokens` (line 4)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `token TEXT NOT NULL UNIQUE` |
| `device_type TEXT NOT NULL DEFAULT 'web'` |
| `user_agent TEXT NOT NULL DEFAULT ''` |
| `status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','EXPIRED'))` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `revoked_at TIMESTAMPTZ` |

**CREATE TABLE `notification_events` (line 21)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `event_key TEXT NOT NULL UNIQUE` |
| `event_type TEXT NOT NULL` |
| `title TEXT NOT NULL` |
| `body TEXT NOT NULL` |
| `data JSONB NOT NULL DEFAULT '{}'::jsonb` |
| `deep_link TEXT NOT NULL DEFAULT ''` |
| `recipient_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb` |
| `status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK(status IN ('QUEUED','PROCESSED','FAILED'))` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `notification_deliveries` (line 39)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `event_id TEXT REFERENCES notification_events(id) ON DELETE CASCADE` |
| `notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL` |
| `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `device_token_id TEXT REFERENCES fcm_device_tokens(id) ON DELETE SET NULL` |
| `channel TEXT NOT NULL DEFAULT 'FCM' CHECK(channel IN ('FCM','IN_APP'))` |
| `status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','DELIVERED','FAILED','REVOKED'))` |
| `attempt_count INTEGER NOT NULL DEFAULT 0` |
| `max_attempts INTEGER NOT NULL DEFAULT 3` |
| `provider_message_id TEXT` |
| `error_code TEXT NOT NULL DEFAULT ''` |
| `error_message TEXT NOT NULL DEFAULT ''` |
| `next_retry_at TIMESTAMPTZ` |
| `sent_at TIMESTAMPTZ` |
| `delivered_at TIMESTAMPTZ` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `school_notification_settings` (line 65)**

| Definition |
|---|
| `institution_id TEXT PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE` |
| `push_enabled BOOLEAN NOT NULL DEFAULT TRUE` |
| `student_absent BOOLEAN NOT NULL DEFAULT TRUE` |
| `attendance_correction BOOLEAN NOT NULL DEFAULT TRUE` |
| `fee_payment BOOLEAN NOT NULL DEFAULT TRUE` |
| `fee_reminders BOOLEAN NOT NULL DEFAULT TRUE` |
| `homework BOOLEAN NOT NULL DEFAULT TRUE` |
| `exam_results BOOLEAN NOT NULL DEFAULT TRUE` |
| `announcements BOOLEAN NOT NULL DEFAULT TRUE` |
| `teacher_leave BOOLEAN NOT NULL DEFAULT TRUE` |
| `updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

### `prisma/migrations/202611050001_student_photo_path/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 1 | `students` | `photo_path TEXT` |

### `prisma/migrations/202611050002_attendance_schema_recovery/migration.sql`

**CREATE TABLE `attendance_audit_logs` (line 13)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `attendance_id TEXT` |
| `student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE` |
| `academic_year TEXT NOT NULL` |
| `class_name TEXT NOT NULL` |
| `section TEXT NOT NULL` |
| `date TEXT NOT NULL` |
| `previous_status TEXT` |
| `new_status TEXT NOT NULL` |
| `previous_remarks TEXT NOT NULL DEFAULT ''` |
| `new_remarks TEXT NOT NULL DEFAULT ''` |
| `changed_by TEXT NOT NULL REFERENCES users(id)` |
| `reason TEXT NOT NULL DEFAULT ''` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

**CREATE TABLE `school_holidays` (line 38)**

| Definition |
|---|
| `id TEXT PRIMARY KEY` |
| `institution_id TEXT NOT NULL REFERENCES institutions(id)` |
| `academic_year TEXT NOT NULL` |
| `date TEXT NOT NULL` |
| `name TEXT NOT NULL` |
| `type TEXT NOT NULL DEFAULT 'Public Holiday'     CHECK (type IN ('Public Holiday', 'School Holiday', 'Vacation', 'Weather Emergency', 'Administrative'))` |
| `description TEXT NOT NULL DEFAULT ''` |
| `created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `UNIQUE (institution_id, date)` |

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 10 | `settings` | `attendance_correction_window_hours INTEGER NOT NULL DEFAULT 24` |

### `prisma/migrations/202611050004_timetable_publication_state/migration.sql`

**ALTER TABLE ADD COLUMN declarations**

| Line | Table | Definition |
|---:|---|---|
| 2 | `timetable_entries` | `status TEXT NOT NULL DEFAULT 'Published'` |

## Important interpretation limits

- This inventory preserves runtime source definitions plus Prisma source declarations. It does not merge conflicts into a fabricated canonical schema.
- Runtime `initialize()` adds columns later and contains data-dependent index checks, seed/upsert operations, and dialect-specific behavior; a fresh-create definition alone is incomplete.
- Source declarations cannot establish existing triggers, functions, views, extensions, sequences, grants, RLS, actual database indexes, or migration ledger contents.
- DDL has no per-role database permission model. Application roles/route authorization must be audited separately.
- Some column/reference semantics are modelled through generic JSON/module tables or dynamically composed query paths; no missing relationship has been invented.