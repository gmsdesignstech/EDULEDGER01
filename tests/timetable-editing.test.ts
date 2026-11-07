import { describe, expect, it } from "vitest";
import { timeMinutes } from "@/lib/timetable";

type TimetablePeriod = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherId?: string | null;
  teacherName?: string;
  className?: string;
  section?: string;
};

// Pure conflict validation engine (matching saveClassTimetable logic)
function validatePeriodConflicts(
  targetClass: { className: string; section: string },
  newPeriods: TimetablePeriod[],
  existingOtherClassPeriods: TimetablePeriod[] = []
): { valid: boolean; error?: string } {
  const days = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // 1. Basic period validation
  for (const p of newPeriods) {
    if (!p.subject || !p.subject.trim()) {
      return { valid: false, error: "Every timetable period must have a subject name." };
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.endTime)) {
      return { valid: false, error: `Invalid period time format for '${p.subject}'. Use 24-hour HH:mm time.` };
    }
    if (timeMinutes(p.endTime) <= timeMinutes(p.startTime)) {
      return {
        valid: false,
        error: `Period '${p.subject}' has invalid timings: end time (${p.endTime}) must be later than start time (${p.startTime}).`,
      };
    }
    if (p.weekday < 1 || p.weekday > 6) {
      return { valid: false, error: `Period '${p.subject}' must be assigned to Monday through Saturday.` };
    }
  }

  // 2. Internal overlaps within same class and section
  for (let i = 0; i < newPeriods.length; i++) {
    for (let j = i + 1; j < newPeriods.length; j++) {
      const a = newPeriods[i], b = newPeriods[j];
      if (a.weekday !== b.weekday) continue;
      const aStart = timeMinutes(a.startTime), aEnd = timeMinutes(a.endTime);
      const bStart = timeMinutes(b.startTime), bEnd = timeMinutes(b.endTime);

      if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
        return {
          valid: false,
          error: `Timetable conflict: '${a.subject}' (${a.startTime}–${a.endTime}) overlaps with '${b.subject}' (${b.startTime}–${b.endTime}) on ${days[a.weekday]}.`,
        };
      }
      if (a.teacherId && b.teacherId && a.teacherId === b.teacherId && Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
        return {
          valid: false,
          error: `Timetable conflict: The same teacher is assigned to multiple overlapping periods on ${days[a.weekday]}.`,
        };
      }
    }
  }

  // 3. External teacher double-booking conflicts across other classes
  for (const p of newPeriods) {
    if (!p.teacherId) continue;
    const pStart = timeMinutes(p.startTime), pEnd = timeMinutes(p.endTime);
    const conflict = existingOtherClassPeriods.find(
      (other) =>
        other.teacherId === p.teacherId &&
        other.weekday === p.weekday &&
        !(other.className === targetClass.className && other.section === targetClass.section) &&
        Math.max(pStart, timeMinutes(other.startTime)) < Math.min(pEnd, timeMinutes(other.endTime))
    );

    if (conflict) {
      return {
        valid: false,
        error: `Timetable conflict: ${conflict.teacherName || "This teacher"} is already assigned to ${conflict.className} ${conflict.section} on ${days[p.weekday]} from ${conflict.startTime} to ${conflict.endTime}.`,
      };
    }
  }

  return { valid: true };
}

describe("Timetable Editing - Conflict Detection & Validation", () => {
  const targetClass = { className: "Class 5", section: "A" };

  it("approves valid non-overlapping periods", () => {
    const periods: TimetablePeriod[] = [
      { id: "1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Mathematics", teacherId: "t1", teacherName: "Mr. Sharma" },
      { id: "2", weekday: 1, startTime: "09:40", endTime: "10:20", subject: "Science", teacherId: "t2", teacherName: "Mrs. Verma" },
      { id: "3", weekday: 1, startTime: "10:35", endTime: "11:15", subject: "English", teacherId: "t3", teacherName: "Ms. Khan" },
    ];
    const result = validatePeriodConflicts(targetClass, periods);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("detects internal class period overlap on the same weekday", () => {
    const periods: TimetablePeriod[] = [
      { id: "1", weekday: 1, startTime: "09:00", endTime: "09:45", subject: "Mathematics" },
      { id: "2", weekday: 1, startTime: "09:30", endTime: "10:15", subject: "Science" },
    ];
    const result = validatePeriodConflicts(targetClass, periods);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("overlaps with 'Science'");
    expect(result.error).toContain("on Monday");
  });

  it("allows identical time slots on different weekdays", () => {
    const periods: TimetablePeriod[] = [
      { id: "1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Mathematics" }, // Monday
      { id: "2", weekday: 2, startTime: "09:00", endTime: "09:40", subject: "Science" },     // Tuesday
    ];
    const result = validatePeriodConflicts(targetClass, periods);
    expect(result.valid).toBe(true);
  });

  it("detects teacher double-booking conflict across classes", () => {
    const newPeriods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "10:00", endTime: "10:45", subject: "Physics", teacherId: "teach-101", teacherName: "Dr. Ahmed" },
    ];
    const existingOtherClasses: TimetablePeriod[] = [
      {
        id: "p99",
        className: "Class 8",
        section: "B",
        weekday: 1,
        startTime: "10:00",
        endTime: "10:45",
        subject: "Physics Lab",
        teacherId: "teach-101",
        teacherName: "Dr. Ahmed",
      },
    ];
    const result = validatePeriodConflicts(targetClass, newPeriods, existingOtherClasses);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Dr. Ahmed is already assigned to Class 8 B on Monday from 10:00 to 10:45");
  });

  it("allows same teacher to teach in different non-overlapping time slots", () => {
    const newPeriods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Maths", teacherId: "teach-101", teacherName: "Dr. Ahmed" },
    ];
    const existingOtherClasses: TimetablePeriod[] = [
      {
        id: "p99",
        className: "Class 8",
        section: "B",
        weekday: 1,
        startTime: "10:00",
        endTime: "10:45",
        subject: "Physics",
        teacherId: "teach-101",
        teacherName: "Dr. Ahmed",
      },
    ];
    const result = validatePeriodConflicts(targetClass, newPeriods, existingOtherClasses);
    expect(result.valid).toBe(true);
  });

  it("allows same teacher in immediately adjacent back-to-back periods across different classes", () => {
    const newPeriods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Maths", teacherId: "teach-101", teacherName: "Dr. Ahmed" },
    ];
    const existingOtherClasses: TimetablePeriod[] = [
      {
        id: "p99",
        className: "Class 6",
        section: "A",
        weekday: 1,
        startTime: "09:40", // Starts exactly when Class 5 A ends
        endTime: "10:20",
        subject: "Maths",
        teacherId: "teach-101",
        teacherName: "Dr. Ahmed",
      },
    ];
    const result = validatePeriodConflicts(targetClass, newPeriods, existingOtherClasses);
    expect(result.valid).toBe(true);
  });

  it("detects conflict when teacher is assigned to Section A and Section B at the same time", () => {
    const sectionAPeriods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Science", teacherId: "teach-202", teacherName: "Ms. Khan" },
    ];
    const sectionBPeriods: TimetablePeriod[] = [
      {
        id: "p2",
        className: "Class 5",
        section: "B",
        weekday: 1,
        startTime: "09:00",
        endTime: "09:40",
        subject: "Science",
        teacherId: "teach-202",
        teacherName: "Ms. Khan",
      },
    ];
    const result = validatePeriodConflicts({ className: "Class 5", section: "A" }, sectionAPeriods, sectionBPeriods);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Ms. Khan is already assigned to Class 5 B on Monday from 09:00 to 09:40");
  });

  it("does not falsely conflict with the same class/section's own existing records during edit", () => {
    const currentClassPeriods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Maths (Updated)", teacherId: "teach-303", teacherName: "Mr. Roy" },
    ];
    const existingRecordsInDb: TimetablePeriod[] = [
      {
        id: "p1-old",
        className: "Class 5",
        section: "A", // SAME class & section!
        weekday: 1,
        startTime: "09:00",
        endTime: "09:40",
        subject: "Maths (Old)",
        teacherId: "teach-303",
        teacherName: "Mr. Roy",
      },
    ];
    // Existing records for the SAME class & section are excluded from other-class collision check
    const result = validatePeriodConflicts({ className: "Class 5", section: "A" }, currentClassPeriods, existingRecordsInDb);
    expect(result.valid).toBe(true);
  });

  it("rejects periods with end time <= start time", () => {
    const periods: TimetablePeriod[] = [
      { id: "1", weekday: 1, startTime: "10:00", endTime: "09:30", subject: "History" },
    ];
    const result = validatePeriodConflicts(targetClass, periods);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("end time (09:30) must be later than start time (10:00)");
  });

  it("rejects periods with empty subject", () => {
    const periods: TimetablePeriod[] = [
      { id: "1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "   " },
    ];
    const result = validatePeriodConflicts(targetClass, periods);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must have a subject name");
  });

  it("rejects periods with invalid time strings", () => {
    const periods: TimetablePeriod[] = [
      { id: "1", weekday: 1, startTime: "25:00", endTime: "09:40", subject: "Art" },
    ];
    const result = validatePeriodConflicts(targetClass, periods);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid period time format");
  });

  it("rejects invalid weekday numbers", () => {
    const periods: TimetablePeriod[] = [
      { id: "1", weekday: 7, startTime: "09:00", endTime: "09:40", subject: "Art" }, // 7 = Sunday
    ];
    const result = validatePeriodConflicts(targetClass, periods);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Monday through Saturday");
  });
});

describe("Timetable Editing - Period Reordering & State Management", () => {
  it("swaps timings correctly when reordering periods", () => {
    const dayPeriods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Maths" },
      { id: "p2", weekday: 1, startTime: "09:40", endTime: "10:20", subject: "English" },
    ];

    // Move Period 2 Up (swap with Period 1)
    const p1 = dayPeriods[0];
    const p2 = dayPeriods[1];

    const swapped = dayPeriods.map((p) => {
      if (p.id === p1.id) return { ...p, startTime: p2.startTime, endTime: p2.endTime };
      if (p.id === p2.id) return { ...p, startTime: p1.startTime, endTime: p1.endTime };
      return p;
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    expect(swapped[0].subject).toBe("English");
    expect(swapped[0].startTime).toBe("09:00");
    expect(swapped[0].endTime).toBe("09:40");

    expect(swapped[1].subject).toBe("Maths");
    expect(swapped[1].startTime).toBe("09:40");
    expect(swapped[1].endTime).toBe("10:20");
  });

  it("deleting a period removes it and preserves the remaining periods", () => {
    const periods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Maths" },
      { id: "p2", weekday: 1, startTime: "09:40", endTime: "10:20", subject: "English" },
      { id: "p3", weekday: 1, startTime: "10:35", endTime: "11:15", subject: "Science" },
    ];

    const afterDelete = periods.filter((p) => p.id !== "p2");
    expect(afterDelete).toHaveLength(2);
    expect(afterDelete.map((p) => p.subject)).toEqual(["Maths", "Science"]);
  });

  it("adding a period places it after the last period of that day", () => {
    const periods: TimetablePeriod[] = [
      { id: "p1", weekday: 1, startTime: "09:00", endTime: "09:40", subject: "Maths" },
      { id: "p2", weekday: 1, startTime: "09:40", endTime: "10:20", subject: "English" },
    ];

    const last = periods[periods.length - 1];
    const newStart = last.endTime; // "10:20"
    const periodMinutes = 40;
    const [h, m] = newStart.split(":").map(Number);
    const endMinutes = h * 60 + m + periodMinutes;
    const newEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    const newPeriod: TimetablePeriod = {
      id: "p3",
      weekday: 1,
      startTime: newStart,
      endTime: newEnd,
      subject: "Computer Science",
    };

    const updated = [...periods, newPeriod];
    expect(updated).toHaveLength(3);
    expect(updated[2].startTime).toBe("10:20");
    expect(updated[2].endTime).toBe("11:00");
  });
});

