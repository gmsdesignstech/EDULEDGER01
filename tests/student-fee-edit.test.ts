import { hash } from "bcryptjs";
import { describe, expect, it } from "vitest";
import {
  addStudent,
  createAccount,
  getStudent,
  listFees,
  listPayments,
  normalizeStudentFee,
  recordPayment,
  updateStudent,
} from "../src/lib/db";
import { configureSchoolCode } from "./configure-school-code";

describe("student total fee editing", () => {
  it("updates invoices and summaries without changing successful payments or receipts", async () => {
    const stamp = Date.now();
    const admin = await createAccount({
      name: "Fee Edit Admin",
      email: `fee-edit-${stamp}@example.com`,
      institution: `Fee Edit School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    const outsider = await createAccount({
      name: "Outside Admin",
      email: `fee-edit-outside-${stamp}@example.com`,
      institution: `Outside Fee School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    await configureSchoolCode(admin.institutionId, admin.id);
    const student = await addStudent(admin.institutionId, {
      name: "Fee Edit Student",
      admission: `FEE-${stamp}`,
      gender: "Female",
      dateOfBirth: "2016-01-01",
      className: "Class 2",
      section: "A",
      parent: "Parent",
      parentPhone: "9876543210",
      parentEmail: "",
      address: "",
      admissionDate: "2026-04-01",
      totalFee: 40200,
      academicYear: "2026-2027",
      dueDate: "2027-03-01",
    }, admin.id);
    const fee = (await listFees(admin.institutionId, { academicYear: "2026-2027" }))[0];
    const payment = await recordPayment(admin.institutionId, admin.id, {
      feeId: String(fee.id),
      amount: 5000,
      method: "UPI",
      paymentDate: "2026-09-28",
      transactionId: `TX-${stamp}`,
      notes: "",
      requestId: crypto.randomUUID(),
    });

    const updated = await updateStudent(admin.institutionId, student.id, { totalFee: 35000 }, admin.id);
    expect(updated).toMatchObject({ totalFee: 35000, paidFee: 5000, pendingFee: 30000, fee: "Partially Paid" });
    expect(await getStudent(admin.institutionId, student.id)).toMatchObject({ totalFee: 35000, paidFee: 5000, pendingFee: 30000 });
    expect((await listFees(admin.institutionId, { academicYear: "2026-2027" }))[0]).toMatchObject({ finalAmount: 35000, paidAmount: 5000, pendingAmount: 30000 });
    expect((await listPayments(admin.institutionId, { search: payment.receiptNumber })).map(item => item.id)).toEqual([payment.id]);

    await expect(updateStudent(admin.institutionId, student.id, { totalFee: 4999 }, admin.id)).rejects.toThrow("cannot be lower than recorded successful payments");
    expect(await getStudent(admin.institutionId, student.id)).toMatchObject({ totalFee: 35000, paidFee: 5000, pendingFee: 30000 });
    await expect(updateStudent(outsider.institutionId, student.id, { totalFee: 25000 }, outsider.id)).rejects.toThrow("Student not found");

    const unpaid = await addStudent(admin.institutionId, {
      name: "Zero Fee Student",
      admission: `ZERO-${stamp}`,
      gender: "Male",
      dateOfBirth: "2017-01-01",
      className: "Class 2",
      section: "A",
      parent: "Parent",
      parentPhone: "",
      parentEmail: "",
      address: "",
      admissionDate: "2026-04-01",
      totalFee: 25500,
      academicYear: "2026-2027",
      dueDate: "2027-03-01",
    }, admin.id);
    expect(await updateStudent(admin.institutionId, unpaid.id, { totalFee: 0 }, admin.id)).toMatchObject({ totalFee: 0, paidFee: 0, pendingFee: 0, fee: "Paid" });
  });

  it("supports zero and validates malformed fee values in cents", async () => {
    expect(normalizeStudentFee(0)).toBe(0);
    expect(normalizeStudentFee("25500.25")).toBe(25500.25);
    expect(() => normalizeStudentFee(-1)).toThrow("Total Fee");
    expect(() => normalizeStudentFee("not-a-fee")).toThrow("Total Fee");
    expect(() => normalizeStudentFee(10.001)).toThrow("two decimal places");
  });
});
