import { hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { accountsSummary, createAccount, createAdminSalary, listAccountTransactions, reconcileSalaryTransactions, saveTeacher, updateAdminSalaryPayment } from "../src/lib/db";

describe("salary accounting integration", () => {
  it("commits one idempotent expense transaction and reconciles safely", async () => {
    const stamp = Date.now();
    const admin = await createAccount({ name: "Payroll Admin", email: `payroll-${stamp}@example.com`, institution: `Payroll School ${stamp}`, passwordHash: await hash("password123", 4) });
    const teacher = await saveTeacher(admin.institutionId, { name: "Rahul Kumar", employeeId: `SAL-${stamp}`, email: "", phone: "9876543210", department: "Science", subject: "Physics", classes: "Class 8", joiningDate: "2026-04-01", salary: 25000, status: "Active" }, admin.id);
    const salary = await createAdminSalary(admin.id, { employeeKey: `teacher:${teacher.id}`, month: 9, year: 2026, basicPaise: 2500000, allowancesPaise: 0, bonusPaise: 0, overtimePaise: 0, otherEarningsPaise: 0, deductionsPaise: 0, advanceDeductionPaise: 0, otherDeductionsPaise: 0, notes: "" });
    const requestId = crypto.randomUUID();
    const payment = await updateAdminSalaryPayment(admin.id, admin.institutionId, salary.id, { amountPaise: 2500000, paymentDate: "2026-09-21", paymentMethod: "Cash", paymentReference: "", paymentNotes: "September payroll", requestId });
    const repeated = await updateAdminSalaryPayment(admin.id, admin.institutionId, salary.id, { amountPaise: 2500000, paymentDate: "2026-09-21", paymentMethod: "Cash", paymentReference: "", paymentNotes: "September payroll", requestId });
    expect(repeated).toMatchObject({ transactionId: payment.transactionId, idempotent: true });
    expect(payment.reference).toMatch(/^SAL-2026-/);
    const ledger = await listAccountTransactions(admin.institutionId, { academicYear: "2026-2027", type: "expense", category: "Staff Salaries" });
    expect(ledger.items).toHaveLength(1);
    expect(ledger.items[0]).toMatchObject({ sourceType: "salary_payment", sourceId: salary.id, amountPaise: 2500000, paymentMethod: "Cash", referenceNumber: payment.reference });
    expect((await accountsSummary(admin.institutionId, "2026-2027")).expenditureStreams.staffSalaries).toBe(2500000);
    expect(await reconcileSalaryTransactions(admin.institutionId, admin.id)).toMatchObject({ checked: 1, created: 0, updated: 1, duplicates: 0 });
    expect((await listAccountTransactions(admin.institutionId, { academicYear: "2026-2027", category: "Staff Salaries" })).items).toHaveLength(1);
  });
});
