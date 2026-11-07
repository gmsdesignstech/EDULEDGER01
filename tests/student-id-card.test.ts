import { describe, expect, it } from "vitest";
import { formatParentPhone } from "@/lib/student-id-card";

describe("Student ID Card - Parent Phone Formatting", () => {
  it("formats standard 10-digit Indian mobile numbers as +91 XXXXX XXXXX", () => {
    expect(formatParentPhone("9876543210")).toBe("+91 98765 43210");
    expect(formatParentPhone("9123456789")).toBe("+91 91234 56789");
  });

  it("handles numbers with spaces, dashes, or parentheses", () => {
    expect(formatParentPhone("98765-43210")).toBe("+91 98765 43210");
    expect(formatParentPhone("(98765) 43210")).toBe("+91 98765 43210");
    expect(formatParentPhone(" 98765 43210 ")).toBe("+91 98765 43210");
  });

  it("handles 12-digit Indian numbers with country prefix 91", () => {
    expect(formatParentPhone("919876543210")).toBe("+91 98765 43210");
    expect(formatParentPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("handles 11-digit numbers with leading 0", () => {
    expect(formatParentPhone("09876543210")).toBe("+91 98765 43210");
  });

  it("returns 'Not Provided' when phone number is missing, blank, or placeholder dash", () => {
    expect(formatParentPhone(null)).toBe("Not Provided");
    expect(formatParentPhone(undefined)).toBe("Not Provided");
    expect(formatParentPhone("")).toBe("Not Provided");
    expect(formatParentPhone("   ")).toBe("Not Provided");
    expect(formatParentPhone("—")).toBe("Not Provided");
    expect(formatParentPhone("-")).toBe("Not Provided");
    expect(formatParentPhone("null")).toBe("Not Provided");
    expect(formatParentPhone("123")).toBe("Not Provided"); // too short to be valid phone
  });

  it("preserves formatted international numbers", () => {
    const formatted = formatParentPhone("+447911123456");
    expect(formatted.startsWith("+")).toBe(true);
    expect(formatted).toContain("44");
  });
});

describe("Student Initials Fallback Logic", () => {
  function getInitials(name: string): string {
    return (
      name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "ST"
    );
  }

  it("extracts 2-letter uppercase initials from full names", () => {
    expect(getInitials("Mohammed Nabeel")).toBe("MN");
    expect(getInitials("Fatima Zahra")).toBe("FZ");
    expect(getInitials("Abrar")).toBe("A");
    expect(getInitials("Syed Mohammad Ali Raza")).toBe("SM");
  });

  it("falls back to ST if name is empty", () => {
    expect(getInitials("")).toBe("ST");
    expect(getInitials("   ")).toBe("ST");
  });
});

