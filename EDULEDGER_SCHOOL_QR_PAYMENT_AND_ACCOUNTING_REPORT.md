# EDULEDGER — SCHOOL PAYMENT QR CODE & AUTOMATED FEE ACCOUNTING REPORT

**Project:** EduLedger (`https://eduledger.co.in`)  
**Repository:** `gmsdesignstech/EDULEDGER01`  
**Branch:** `main`  
**Feature Scope:** School Payment QR Code Configuration, Parent Portal QR Submission, Admin Verification Dashboard, and Double-Entry Automated Cash Book Accounting.

---

## 1. Executive Summary

A complete, production-ready **School Payment QR Code Management and Fee Collection Integration** has been engineered and verified in EduLedger. This system empowers each institution administrator to configure their official school payment QR code, UPI ID, payee details, and bank account information. 

Parents can scan the school's official QR code or copy the UPI ID directly within their mobile-responsive portal, make a payment, and submit the transaction with the mandatory UTR / transaction reference number and optional payment screenshot. School administrators review submitted payments against their bank statement. Upon verification, the platform **atomically updates student fee ledgers, issues a valid receipt, and generates exactly one Cash Book entry** (`account_transactions`), making collections instantly visible across Financial Dashboards, Cash Books, and Daily/Monthly collection reports without manual bookkeeping.

```
       [School Admin]
             │
             ▼
┌──────────────────────────┐
│  Institution Settings    │ ─── Configures QR Image, UPI ID,
│  (School Payment Card)   │     Payee Name, Bank Details & Instructions
└──────────────────────────┘
             │
             ▼
┌──────────────────────────┐
│    Parent Fee Portal     │ ─── Scans QR / Copies UPI ID, submits
│ (Pay via School QR Modal)│     Amount, UTR & Payment Screenshot
└──────────────────────────┘
             │
             ▼ Status: PENDING (Zero financial impact)
┌──────────────────────────┐
│ Admin Verification Tab   │ ─── Audits UTR & Screenshot against
│ (/dashboard/payments)    │     real school bank statement
└──────────────────────────┘
             │
             ├──────────────────────────┐
             ▼ (Verified)               ▼ (Rejected)
┌──────────────────────────┐    ┌──────────────────────────┐
│ Atomic Financial Entry:  │    │ Payment Marked REJECTED  │
│ 1. `payments` record     │    │ - Student fees unchanged │
│ 2. `fees` balance updated│    │ - Reason shown to parent │
│ 3. `receipts` created    │    │ - NO Cash Book entry     │
│ 4. `account_transactions`│    └──────────────────────────┘
│    (1 Cash Book entry)   │
└──────────────────────────┘
```

---

## 2. Institution Settings — School Payment Configuration

### 2.1 UI Location and Architecture
Located directly on the `/dashboard/settings` page below the Institution Details card.
- **Toggle Control**: "Enable School QR Payments" (`upi_enabled`). When disabled, the QR payment option is cleanly hidden in the parent portal while retaining all existing payment settings.
- **QR Code Asset Storage**: Utilizes the secure `school_assets` infrastructure with asset kind `payment-qr`. Supports PNG, JPG, and WEBP formats up to 5MB.
- **Configuration Fields**:
  - `upi_id`: Official UPI Virtual Payment Address (e.g., `daralarqam@sbi` or `school@icici`).
  - `payee_name`: Official account holder name shown on UPI apps.
  - `payment_method_name`: Customizable label (e.g., "School UPI / PhonePe / GPay").
  - `bank_name`, `account_number`, `ifsc_code`: Optional direct NEFT/IMPS fallback details.
  - `payment_instructions`: School-specific instructions displayed to parents (e.g., "Mention Student Name and Admission No in UPI remarks").
- **Asset Actions**:
  - Live preview with automatic fallback placeholder if no QR is uploaded.
  - "Upload QR Code" / "Replace QR Code" with instant cache invalidation.
  - "Remove QR" action to reset the asset.

### 2.2 Security & Permissions
- Restricted exclusively to authenticated users with `SCHOOL_ADMIN` or `SUPER_ADMIN` roles.
- All database queries and asset lookups are strictly partitioned by `institution_id`.

---

## 3. Parent Fee Portal Integration

### 3.1 Seamless Dual-Payment Options
In `src/app/parent/fees/page.tsx`, when UPI payments are enabled by the school:
- Each invoice card displays both **"Pay via School QR"** (purple branding) and the existing **"Pay Now (Razorpay)"** button.
- Parents can choose their preferred payment method without disruption to existing online gateway workflows.

### 3.2 Modal Experience
- **School Identity & QR**: Displays the school name, verified badge, official QR code image with a 1-click **Download QR** button.
- **Copyable UPI ID**: Displays the configured UPI ID with a 1-click copy button and toast confirmation.
- **Account Details**: Clearly presents the Payee Name, Bank Name, Account Number, and IFSC code.
- **Flexible Amount**: Defaults to the full pending balance but supports partial payments.
- **Mandatory UTR**: Strict validation requiring the 12-digit UPI reference number or bank transaction ID.
- **Screenshot Proof**: Parents can upload a transaction screenshot (JPEG/PNG/WEBP up to 5MB) stored securely with encrypted access tokens.
- **Clear Verification Notice**: Notifies parents that static QR payments require office verification before receipts are unlocked.

### 3.3 "QR Submissions" Status Tracking Tab
A dedicated tab on the parent fee page displays all submitted QR payments:
- Shows Submission Date, Invoice ID, Amount, UTR Number, Screenshot indicator, and real-time status:
  - 🟡 **Pending Verification**: Awaiting school administrative review.
  - 🟢 **Verified**: Approved by school office with immediate receipt download access.
  - 🔴 **Rejected**: Displays the rejection reason entered by the administrator so parents can correct or re-submit.
  - ⚪ **Refunded**: Payment returned with transaction reference.

---

## 4. Admin Verification & Review Dashboard

### 4.1 Verification Workspace
Located in `/dashboard/payments` under the **"QR Payment Verification"** tab:
- **Pending Badge**: Real-time counter badge showing unprocessed submissions.
- **Submissions Table**: Filterable and sortable list containing Student Name, Class & Section, Invoice Number, Amount, UTR Number, Payment Date, and Current Status.
- **Review Modal**:
  - Full student profile and fee invoice breakdown.
  - Payment metadata (UTR, Date, Bank, Amount).
  - High-resolution screenshot viewer with zoom and "Open Full Size" option.
  - Direct actions: **"Verify & Add to Cash Book"** or **"Reject Payment"**.

### 4.2 Rejection Safety
- Rejection requires a mandatory administrative reason (e.g., "UTR not found in bank statement", "Amount mismatch").
- Rejection does not modify fee balances, does not generate a receipt, and strictly **never touches the Cash Book**.

---

## 5. Automated Fee Accounting & Double-Entry Cash Book Integrity

### 5.1 The Single-Entry Guarantee
To prevent duplicate revenue reporting, the verification engine executes a single atomic transaction that:
1. Updates the `school_qr_payments` record to `VERIFIED` with `verified_at` and `verified_by`.
2. Creates the official `payments` record (`payment_method = 'UPI / QR Code'`, `transaction_id = qr_payment.utr_number`).
3. Updates `fees` invoice balance (`paid_amount`, `pending_amount`, `status: 'Paid' | 'Partial'`).
4. Updates the aggregate balance on `students`.
5. Generates a formal `receipts` entry with unique sequential receipt number.
6. Inserts **EXACTLY ONE** entry into `account_transactions` (Cash Book):
   - `institution_id = qr_payment.institution_id`
   - `transaction_type = 'income'`
   - `category = 'Student Fee Collection'`
   - `amount_paise = cents` (100% accurate integer arithmetic)
   - `payment_method = 'UPI / QR Code'`
   - `reference_number = receipt.receipt_number`
   - `source_type = 'fee_payment'`
   - `source_id = payment.id`
   - `description = 'Fee payment via School QR (UTR: ...)'`
   - `status = 'Active'`

### 5.2 Database-Enforced Anti-Duplication
The database enforces a unique constraint on `account_transactions`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_source 
ON account_transactions(institution_id, source_type, source_id) 
WHERE source_id IS NOT NULL;
```
Even under network retries or concurrent clicks, duplicate Cash Book entries are physically blocked at the database engine level.

### 5.3 Financial Reports & Analytics Impact
Because verified QR payments populate standard `payments`, `receipts`, and `account_transactions` tables:
- **Cash Book (`/dashboard/accounts`)**: Appears immediately as active Income with receipt voucher references.
- **Daily & Monthly Collections (`/dashboard/reports`)**: Automatically aggregated into cash flow statements, fee collection summaries, and income charts.
- **Pending/Rejected Submissions**: Zero presence in financial tables, preventing inflated revenue or accounting discrepancies.

### 5.4 Refund Handling
If a verified payment is refunded:
- The payment record status changes to `Refunded`.
- The linked `account_transactions` entry is marked `status = 'Voided'` (preserving complete audit trails without orphan deletions).
- The student's fee invoice balance is atomically restored.

---

## 6. Multi-Tenant Data Isolation & Collision Prevention

1. **School Isolation**: Every query in `getSchoolPaymentSettings`, `saveSchoolPaymentSettings`, `submitSchoolQrPayment`, `listSchoolQrPayments`, `verifySchoolQrPayment`, and `rejectSchoolQrPayment` strictly filters by `institution_id`. School A administrators cannot view or modify School B settings or payments.
2. **Duplicate UTR Protection**: Enforced at the schema level:
   ```sql
   UNIQUE(institution_id, utr_number)
   ```
   A parent cannot accidentally or intentionally submit the same UTR multiple times within the same school.
3. **Secure Screenshot Streaming**: Screenshots are stored under `school_assets` with scoped ownership and streamed through `/api/fees/qr-payments/[id]/screenshot` only after validating the requester's role or parent-child link.

---

## 7. Verification & Test Results

The entire implementation has undergone rigorous unit, integration, and static analysis verification:

### 7.1 Vitest Automated Test Suite (`tests/qr-fee-accounting.test.ts`)
| Test Case | Verification Target | Result |
| :--- | :--- | :--- |
| **Test 1** | Save & retrieve school payment settings | ✅ PASSED |
| **Test 2** | Parent submission in PENDING status | ✅ PASSED |
| **Test 3** | Reject duplicate UTR within the same institution | ✅ PASSED |
| **Test 4** | Permit identical UTR across different institutions | ✅ PASSED |
| **Test 5** | Verify payment, update fee invoice, create receipt | ✅ PASSED |
| **Test 6** | Exact single entry in `account_transactions` (Cash Book) | ✅ PASSED |
| **Test 7** | Double verification idempotency (no duplicate entries) | ✅ PASSED |
| **Test 8** | Rejection sets status, reason, leaves Cash Book clean | ✅ PASSED |
| **Test 9** | Partial payment balance calculation | ✅ PASSED |
| **Test 10** | Refund voids Cash Book entry and restores balance | ✅ PASSED |
| **Test 11** | Multi-tenant isolation for list/query operations | ✅ PASSED |
| **Test 12** | Prevent verification on already rejected payments | ✅ PASSED |

**Complete Vitest Suite Execution:**
- **Test Files**: 22 passed (100%)
- **Tests**: 207 passed (100%)
- **Failures**: 0

### 7.2 Type Checking & Static Linting
- **TypeScript**: `npm run typecheck` returned **0 errors**.
- **ESLint**: `npm run lint` returned **0 errors and 0 warnings**.

### 7.3 Next.js Production Build
- **Compiler**: Next.js 16.0.7 / Webpack production compilation.
- **Route Manifest**: Successfully compiled and generated **145 / 145 pages and API endpoints** with zero regressions.

---

## 8. Summary of Created & Modified Files

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── fees/qr-payments/
│   │   │   │   ├── route.ts                            [NEW] Admin list, verify, reject, refund API
│   │   │   │   └── [id]/screenshot/route.ts            [NEW] Secure screenshot asset streaming API
│   │   │   ├── parent/children/[id]/
│   │   │   │   └── qr-payment/route.ts                 [NEW] Parent QR payment submission API
│   │   │   └── settings/
│   │   │       ├── assets/[kind]/route.ts              [MODIFIED] Added 'payment-qr' asset support
│   │   │       ├── payment/route.ts                    [NEW] Payment settings GET/POST API
│   │   │       └── route.ts                            [MODIFIED] Payment metadata validation
│   │   └── parent/fees/page.tsx                        [MODIFIED] QR payment modal & submissions tab
│   ├── components/
│   │   ├── payments.tsx                                [MODIFIED] Admin QR Verification tab & modal
│   │   └── settings.tsx                                [MODIFIED] School Payment Settings card & QR upload
│   └── lib/
│       └── db.ts                                       [MODIFIED] QR schema, tables & accounting engine
└── tests/
    ├── qr-fee-accounting.test.ts                       [NEW] 12 comprehensive automated test specs
    └── vitest.safe-unit.config.mts                     [MODIFIED] Registered test suite
```

---

## 9. Conclusion

The School Payment QR Code Configuration & Automated Fee Accounting feature is completely implemented, verified, and ready for deployment. It adheres to all EduLedger design patterns, database constraints, multi-tenant isolation requirements, and accounting safeguards. Existing Razorpay online checkout and manual fee collection workflows remain 100% operational and undisturbed.
