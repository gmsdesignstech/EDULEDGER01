import { describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard Page Loading Resilience & Decoupled Schema Suite", () => {
  it("verifies getInstitution is strictly decoupled from payment/UPI columns", () => {
    const dbSource = fs.readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf-8");

    // Extract getInstitution function implementation
    const getInstitutionMatch = dbSource.match(/export async function getInstitution\(institutionId: string\) \{([\s\S]*?)\n\}/);
    expect(getInstitutionMatch).toBeTruthy();
    const funcBody = getInstitutionMatch![1];

    // Must NOT contain payment/upi columns in SQL or return type
    expect(funcBody).not.toContain("s.upi_enabled");
    expect(funcBody).not.toContain("upiEnabled");
    expect(funcBody).not.toContain("upiId");
    expect(funcBody).not.toContain("payeeName");
    expect(funcBody).not.toContain("paymentMethodName");
    expect(funcBody).not.toContain("paymentInstructions");

    // Must contain essential school branding fields
    expect(funcBody).toContain("i.id");
    expect(funcBody).toContain("i.name");
    expect(funcBody).toContain("academicYear");
    expect(funcBody).toContain("schoolCode");
  });

  it("verifies ensurePaymentSettingsSchema is idempotent and exported", () => {
    const dbSource = fs.readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf-8");

    expect(dbSource).toContain("export async function ensurePaymentSettingsSchema");
    expect(dbSource).toContain("ALTER TABLE settings ADD COLUMN IF NOT EXISTS upi_enabled BOOLEAN");
    expect(dbSource).toContain("CREATE TABLE IF NOT EXISTS school_qr_payments");
  });

  it("verifies getSchoolPaymentSettings contains safe fallback handling", () => {
    const dbSource = fs.readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf-8");

    const getPaymentSettingsMatch = dbSource.match(/export async function getSchoolPaymentSettings\(institutionId: string\)[\s\S]*?\{([\s\S]*?)\n\}/);
    expect(getPaymentSettingsMatch).toBeTruthy();
    const body = getPaymentSettingsMatch![1];

    // Must wrap in try-catch and have ensurePaymentSettingsSchema
    expect(body).toContain("ensurePaymentSettingsSchema");
    expect(body).toContain("try {");
    expect(body).toContain("catch");
    expect(body).toContain("upiEnabled: false");
  });

  it("verifies error.tsx provides recovery links beyond try-again button", () => {
    const errorSource = fs.readFileSync(path.join(process.cwd(), "src/app/error.tsx"), "utf-8");

    expect(errorSource).toContain("Return to Dashboard");
    expect(errorSource).toContain("/dashboard");
    expect(errorSource).toContain("Return Home");
    expect(errorSource).toContain("error.digest");
    expect(errorSource).toContain("Try again");
  });

  it("verifies ensureEssentialProductionSchema and ensureTimetableSchema are exported and cover timetable columns", () => {
    const dbSource = fs.readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf-8");

    expect(dbSource).toContain("export async function ensureEssentialProductionSchema");
    expect(dbSource).toContain("export async function ensureTimetableSchema");
    expect(dbSource).toContain("ALTER TABLE settings ADD COLUMN IF NOT EXISTS timetable_start_time TEXT");
    expect(dbSource).toContain("ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS generated BOOLEAN");
    expect(dbSource).toContain("ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS status TEXT");
    expect(dbSource).toContain("idx_timetable_active_slot");
  });

  it("verifies getTimetableSettings and listTimetableEntries contain resilient fallbacks", () => {
    const dbSource = fs.readFileSync(path.join(process.cwd(), "src/lib/db.ts"), "utf-8");

    const getTimetableSettingsMatch = dbSource.match(/export async function getTimetableSettings\([\s\S]*?\n\}/);
    expect(getTimetableSettingsMatch).toBeTruthy();
    expect(getTimetableSettingsMatch![0]).toContain("ensureTimetableSchema");
    expect(getTimetableSettingsMatch![0]).toContain("defaultTimetableSettings");

    const listEntriesMatch = dbSource.match(/export async function listTimetableEntries\([\s\S]*?\n\}/);
    expect(listEntriesMatch).toBeTruthy();
    expect(listEntriesMatch![0]).toContain("ensureTimetableSchema");
    expect(listEntriesMatch![0]).toContain("COALESCE(t.status");

    const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/timetable/route.ts"), "utf-8");
    expect(routeSource).toContain("ensureTimetableSchema");
  });
});

