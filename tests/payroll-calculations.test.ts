import { describe, expect, it } from "vitest";
import { calculatePayrollAmounts } from "../src/lib/payroll-calculations";

describe("payroll calculations", () => {
  it("totals earnings and deductions exactly in paise", () => {
    expect(calculatePayrollAmounts({
      basicPaise: 2500001,
      allowancesPaise: 150050,
      bonusPaise: 9999,
      overtimePaise: 0,
      otherEarningsPaise: 25,
      deductionsPaise: 50000,
      advanceDeductionPaise: 10000,
      otherDeductionsPaise: 9,
    })).toEqual({ grossPaise: 2660075, totalDeductionsPaise: 60009, netPaise: 2600066 });
  });

  it("rejects negative, fractional-paise, unsafe and over-gross deductions", () => {
    const base = { basicPaise: 10000, allowancesPaise: 0, bonusPaise: 0, overtimePaise: 0, otherEarningsPaise: 0, deductionsPaise: 0, advanceDeductionPaise: 0, otherDeductionsPaise: 0 };
    expect(() => calculatePayrollAmounts({ ...base, basicPaise: -1 })).toThrow("non-negative whole paise");
    expect(() => calculatePayrollAmounts({ ...base, basicPaise: 1.5 })).toThrow("non-negative whole paise");
    expect(() => calculatePayrollAmounts({ ...base, basicPaise: Number.MAX_SAFE_INTEGER, allowancesPaise: 1 })).toThrow("exact calculation range");
    expect(() => calculatePayrollAmounts({ ...base, deductionsPaise: 10001 })).toThrow("Deductions cannot exceed gross salary");
  });
});
