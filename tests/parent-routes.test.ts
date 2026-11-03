import { beforeEach, describe, expect, it, vi } from "vitest";

const testContext = vi.hoisted(() => ({
  user: {
    id: "parent-user-1",
    email: "parent@school.test",
    name: "Rajesh Kumar",
    role: "PARENT",
    institutionId: "inst-school-1",
  } as { id: string; email: string; name: string; role: string; institutionId: string } | null,
  children: [
    {
      id: "std-child-1",
      name: "Aarav Kumar",
      admission: "ADM-001",
      className: "Class 7",
      section: "A",
      grade: "7",
      rollNumber: "12",
      gender: "Male",
      dateOfBirth: "2012-05-15",
      parent: "Rajesh Kumar",
      parentPhone: "9876543210",
      parentEmail: "parent@school.test",
      address: "123 Park Street",
      admissionDate: "2024-04-01",
      attendance: 95,
      fee: "Pending",
      totalFee: 40000,
      paidFee: 20000,
      pendingFee: 20000,
      status: "Active",
      academicYear: "2026-2027",
      relationship: "Father",
      isPrimary: true,
    },
  ],
}));

vi.mock("../src/lib/session", () => ({
  currentUser: vi.fn(async () => testContext.user),
}));

vi.mock("../src/lib/db", () => ({
  parentChildren: vi.fn(async (instId: string, parentUserId: string) => {
    if (instId === "inst-school-1" && parentUserId === "parent-user-1") {
      return testContext.children;
    }
    return [];
  }),
  parentHasChild: vi.fn(async (instId: string, parentUserId: string, studentId: string) => {
    if (instId === "inst-school-1" && parentUserId === "parent-user-1") {
      return testContext.children.some((c) => c.id === studentId);
    }
    return false;
  }),
  parentChildOverview: vi.fn(async (_instId: string, _uid: string, studentId: string) => {
    const child = testContext.children.find((c) => c.id === studentId);
    if (!child) throw new Error("Child not found or access unauthorized.");
    return {
      child,
      todayAttendance: "Present",
      attendanceSummary: { totalDays: 20, presentCount: 19, absentCount: 1, lateCount: 0, attendancePercentage: 95 },
      recentAttendance: [],
      feesSummary: { totalFee: 40000, paidFee: 20000, pendingFee: 20000 },
      pendingInvoices: [],
      recentPayments: [],
      recentResults: [],
      activeHomework: [],
      todayTimetable: [],
      announcements: [],
    };
  }),
  parentChildAttendance: vi.fn(async () => ({
    records: [{ id: "att-1", date: "2026-10-01", status: "Present", remarks: "" }],
    summary: { totalDays: 1, presentCount: 1, absentCount: 0, lateCount: 0, excusedCount: 0, halfDayCount: 0, attendancePercentage: 100 },
  })),
  parentChildFees: vi.fn(async () => ({
    invoices: [{ id: "fee-1", invoiceNumber: "INV-001", feeType: "Tuition", finalAmount: 20000, pendingAmount: 20000, status: "Pending", dueDate: "2026-11-01" }],
    payments: [],
    receipts: [],
    summary: { totalFee: 20000, paidFee: 0, pendingFee: 20000 },
  })),
  getParentChildFeeInvoice: vi.fn(async (_instId, studentId, feeId) => {
    if (studentId === "std-child-1" && feeId === "11111111-1111-4111-8111-111111111111") {
      return { id: feeId, invoiceNumber: "INV-001", pendingAmount: 10000, finalAmount: 20000, status: "Partially Paid" };
    }
    return null;
  }),
  parentChildResults: vi.fn(async () => [
    { id: "res-1", examId: "ex-1", examName: "Unit Test", subject: "Math", marks: 45, maxMarks: 50, passingMarks: 20, grade: "A", status: "Pass", remarks: "" },
  ]),
  parentChildHomework: vi.fn(async () => [
    { id: "hw-1", title: "Math Worksheet", description: "Complete exercises", className: "Class 7", section: "A", subject: "Math", dueDate: "2026-10-10", status: "Active" },
  ]),
  parentChildTimetable: vi.fn(async () => [
    { id: "tt-1", subject: "Math", teacherName: "Mr. Sharma", weekday: 1, startTime: "09:00", endTime: "09:45" },
  ]),
  listUserNotifications: vi.fn(async () => ({
    items: [{ id: "notif-1", type: "fee_due", title: "Fee Due", description: "Tuition fee is due", createdAt: "2026-10-01T00:00:00Z" }],
    unread: 1,
  })),
  markUserNotificationRead: vi.fn(async () => 1),
  listModuleRecords: vi.fn(async () => [
    { id: "ann-1", title: "Sports Day", message: "Annual sports day on Friday." },
  ]),
}));

import { GET as getChildren } from "../src/app/api/parent/children/route";
import { GET as getOverview } from "../src/app/api/parent/children/[id]/overview/route";
import { GET as getAttendance } from "../src/app/api/parent/children/[id]/attendance/route";
import { GET as getFees } from "../src/app/api/parent/children/[id]/fees/route";
import { GET as getResults } from "../src/app/api/parent/children/[id]/results/route";
import { GET as getHomework } from "../src/app/api/parent/children/[id]/homework/route";
import { GET as getTimetable } from "../src/app/api/parent/children/[id]/timetable/route";
import { POST as payFee } from "../src/app/api/parent/children/[id]/pay-fee/route";
import { GET as getNotifications, POST as markNotifications } from "../src/app/api/parent/notifications/route";
import { GET as getAnnouncements } from "../src/app/api/parent/announcements/route";

describe("Parent Portal Route Handlers & Security Enforcement", () => {
  beforeEach(() => {
    testContext.user = {
      id: "parent-user-1",
      email: "parent@school.test",
      name: "Rajesh Kumar",
      role: "PARENT",
      institutionId: "inst-school-1",
    };
  });

  it("blocks unauthenticated requests with 401", async () => {
    testContext.user = null;
    const res = (await getChildren()) as Response;
    expect(res.status).toBe(401);
  });

  it("blocks non-parent users with 403", async () => {
    testContext.user = {
      id: "teacher-user-1",
      email: "teacher@school.test",
      name: "Teacher User",
      role: "TEACHER",
      institutionId: "inst-school-1",
    };
    const res = (await getChildren()) as Response;
    expect(res.status).toBe(403);
  });

  it("returns linked children for authenticated parent", async () => {
    const res = (await getChildren()) as Response;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.children).toHaveLength(1);
    expect(data.children[0].name).toBe("Aarav Kumar");
  });

  it("DENIES access with 403 when parent accesses an unlinked child's overview", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/unlinked-child-999/overview");
    const res = (await getOverview(req, { params: Promise.resolve({ id: "unlinked-child-999" }) })) as Response;
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/not authorized/i);
  });

  it("permits access with 200 when parent accesses their own linked child's overview", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/std-child-1/overview");
    const res = (await getOverview(req, { params: Promise.resolve({ id: "std-child-1" }) })) as Response;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.overview.child.name).toBe("Aarav Kumar");
  });

  it("DENIES access with 403 when parent queries attendance for unlinked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/stranger-std/attendance");
    const res = (await getAttendance(req, { params: Promise.resolve({ id: "stranger-std" }) })) as Response;
    expect(res.status).toBe(403);
  });

  it("ALLOWS attendance query for linked child", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/std-child-1/attendance");
    const res = (await getAttendance(req, { params: Promise.resolve({ id: "std-child-1" }) })) as Response;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.records).toHaveLength(1);
  });

  it("DENIES access with 403 when parent queries fees for unlinked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/stranger-std/fees");
    const res = (await getFees(req, { params: Promise.resolve({ id: "stranger-std" }) })) as Response;
    expect(res.status).toBe(403);
  });

  it("DENIES fee payment initiation with 403 for unlinked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/stranger-std/pay-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeId: "11111111-1111-4111-8111-111111111111" }),
    });
    const res = (await payFee(req, { params: Promise.resolve({ id: "stranger-std" }) })) as Response;
    expect(res.status).toBe(403);
  });

  it("ALLOWS fee payment initiation for linked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/std-child-1/pay-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeId: "11111111-1111-4111-8111-111111111111" }),
    });
    const res = (await payFee(req, { params: Promise.resolve({ id: "std-child-1" }) })) as Response;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.feeId).toBe("11111111-1111-4111-8111-111111111111");
    expect(data.order).toBeDefined();
  });

  it("DENIES exam results query with 403 for unlinked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/stranger-std/results");
    const res = (await getResults(req, { params: Promise.resolve({ id: "stranger-std" }) })) as Response;
    expect(res.status).toBe(403);
  });

  it("ALLOWS exam results query for linked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/std-child-1/results");
    const res = (await getResults(req, { params: Promise.resolve({ id: "std-child-1" }) })) as Response;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results[0].subject).toBe("Math");
  });

  it("DENIES homework query with 403 for unlinked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/stranger-std/homework");
    const res = (await getHomework(req, { params: Promise.resolve({ id: "stranger-std" }) })) as Response;
    expect(res.status).toBe(403);
  });

  it("ALLOWS homework query for linked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/std-child-1/homework");
    const res = (await getHomework(req, { params: Promise.resolve({ id: "std-child-1" }) })) as Response;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.homework[0].title).toBe("Math Worksheet");
  });

  it("DENIES timetable query with 403 for unlinked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/stranger-std/timetable");
    const res = (await getTimetable(req, { params: Promise.resolve({ id: "stranger-std" }) })) as Response;
    expect(res.status).toBe(403);
  });

  it("ALLOWS timetable query for linked student", async () => {
    const req = new Request("https://eduledger.invalid/api/parent/children/std-child-1/timetable");
    const res = (await getTimetable(req, { params: Promise.resolve({ id: "std-child-1" }) })) as Response;
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.timetable[0].subject).toBe("Math");
  });

  it("manages notifications and circulars for parent", async () => {
    const notifsRes = (await getNotifications()) as Response;
    expect(notifsRes.status).toBe(200);
    const notifs = await notifsRes.json();
    expect(notifs.unread).toBe(1);

    const markReq = new Request("https://eduledger.invalid/api/parent/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "notif-1" }),
    });
    const markRes = (await markNotifications(markReq)) as Response;
    expect(markRes.status).toBe(200);

    const annRes = (await getAnnouncements()) as Response;
    expect(annRes.status).toBe(200);
    const ann = await annRes.json();
    expect(ann.announcements[0].title).toBe("Sports Day");
  });
});
