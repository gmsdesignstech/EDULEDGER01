import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { createAccount, deleteStaffAttendance, getStaffAttendanceSettings, saveStaffAttendance, saveStaffAttendanceSettings, saveTeacher, staffAttendanceData } from "../src/lib/db";
import { previousDate, validDate, workingMinutes, zonedInstant } from "../src/lib/staff-time";

describe("staff attendance", () => {
  it("validates dates and calculates overnight hours in the school timezone", () => {
    expect(() => validDate("2026-02-30")).toThrow("valid attendance date");
    expect(previousDate("2026-01-01")).toBe("2025-12-31");
    const checkIn = zonedInstant("2026-09-17", "22:00", "Asia/Kolkata");
    const checkOut = zonedInstant("2026-09-18", "06:00", "Asia/Kolkata");
    expect(workingMinutes(checkIn, checkOut, 30)).toBe(450);
  });

  it("persists records, prevents duplicates, reports by month, and isolates schools", async () => {
    const stamp = Date.now();
    const first = await createAccount({ name: "Attendance Admin", email: `staff-attendance-${stamp}@example.com`, institution: `Attendance School ${stamp}`, passwordHash: await hash("password123", 4) });
    const second = await createAccount({ name: "Other Admin", email: `staff-attendance-other-${stamp}@example.com`, institution: `Other School ${stamp}`, passwordHash: await hash("password123", 4) });
    const teacher = await saveTeacher(first.institutionId, { name: "Test Teacher", employeeId: `AT-${stamp}`, email: "", phone: "9876543210", department: "Science", subject: "Physics", classes: "Class 8", joiningDate: "2026-04-01", salary: 30000, status: "Active" }, first.id);
    const settings = await getStaffAttendanceSettings(first.institutionId);
    await saveStaffAttendanceSettings(first.institutionId, first.id, { ...settings, timezone: "Asia/Kolkata", breakMinutes: 30 });
    const input = { staffKey: `teacher:${teacher.id}`, date: "2026-09-17", status: "Present" as const, checkInTime: "22:00", checkOutTime: "06:00", overnight: true, remarks: "Night shift" };
    const saved = await saveStaffAttendance(first.institutionId, first.id, input);
    expect(saved.totalWorkMinutes).toBe(450);
    await expect(saveStaffAttendance(first.institutionId, first.id, input)).rejects.toThrow();
    expect((await staffAttendanceData(first.institutionId, "2026-09-17", "2026-09")).monthly.find(item => item.key === input.staffKey)?.totalWorkMinutes).toBe(450);
    expect((await staffAttendanceData(second.institutionId, "2026-09-17", "2026-09")).daily.some(item => item.key === input.staffKey)).toBe(false);
    await expect(saveStaffAttendance(second.institutionId, second.id, input)).rejects.toThrow("your school");
    const changed = await saveStaffAttendance(first.institutionId, first.id, { ...input, status: "Late", remarks: "Corrected" }, saved.id);
    expect(changed.status).toBe("Late");
    expect(await deleteStaffAttendance(second.institutionId, second.id, saved.id)).toBe(false);
    expect(await deleteStaffAttendance(first.institutionId, first.id, saved.id)).toBe(true);
  });
});
