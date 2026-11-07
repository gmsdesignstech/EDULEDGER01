import { describe, expect, it } from "vitest";
import {
  assertAccountingPeriodOpen,
  calculateIncomeAndExpenditure,
  calculateTrialBalance,
  reversalLines,
  validateJournalLines,
  type JournalAccount,
  type JournalLine,
} from "../src/lib/accounting-engine";

const accounts: JournalAccount[] = [
  { id: "cash", name: "Cash", group: "ASSET" },
  { id: "receivable", name: "Fee receivable", group: "ASSET" },
  { id: "income", name: "Tuition income", group: "INCOME" },
  { id: "expense", name: "Stationery expense", group: "EXPENSE" },
  { id: "fund", name: "School fund", group: "FUND" },
];

describe("paise-based accounting primitives", () => {
  it("accepts balanced multi-line journals and rejects imbalance or invalid line amounts", () => {
    const lines: JournalLine[] = [
      { accountId: "cash", accountGroup: "ASSET", debitPaise: 10001, creditPaise: 0 },
      { accountId: "income", accountGroup: "INCOME", debitPaise: 0, creditPaise: 10001 },
    ];
    expect(validateJournalLines(lines)).toEqual({ debitPaise: 10001, creditPaise: 10001 });
    expect(() => validateJournalLines([...lines, { ...lines[0], debitPaise: 1 }])).toThrow("must equal");
    expect(() => validateJournalLines([{ ...lines[0], debitPaise: 1.5 }, lines[1]])).toThrow("whole-paise");
  });

  it("creates an equal and opposite reversal without mutating the original lines", () => {
    const original: JournalLine[] = [
      { accountId: "cash", accountGroup: "ASSET", debitPaise: 2500, creditPaise: 0 },
      { accountId: "income", accountGroup: "INCOME", debitPaise: 0, creditPaise: 2500 },
    ];
    const reversed = reversalLines(original);
    expect(reversed).toEqual([
      { accountId: "cash", accountGroup: "ASSET", debitPaise: 0, creditPaise: 2500 },
      { accountId: "income", accountGroup: "INCOME", debitPaise: 2500, creditPaise: 0 },
    ]);
    expect(original[0].debitPaise).toBe(2500);
  });

  it("calculates trial balance and income/expenditure totals from posted lines", () => {
    const posted: JournalLine[] = [
      { accountId: "cash", accountGroup: "ASSET", debitPaise: 8000, creditPaise: 0 },
      { accountId: "receivable", accountGroup: "ASSET", debitPaise: 10000, creditPaise: 0 },
      { accountId: "receivable", accountGroup: "ASSET", debitPaise: 0, creditPaise: 8000 },
      { accountId: "income", accountGroup: "INCOME", debitPaise: 0, creditPaise: 10000 },
      { accountId: "expense", accountGroup: "EXPENSE", debitPaise: 2000, creditPaise: 0 },
      { accountId: "cash", accountGroup: "ASSET", debitPaise: 0, creditPaise: 2000 },
      { accountId: "cash", accountGroup: "ASSET", debitPaise: 2000, creditPaise: 0 },
      { accountId: "fund", accountGroup: "FUND", debitPaise: 0, creditPaise: 2000 },
    ];
    const trialBalance = calculateTrialBalance(accounts, posted);
    expect(trialBalance.reduce((sum, row) => sum + row.debitPaise, 0)).toBe(12000);
    expect(trialBalance.reduce((sum, row) => sum + row.creditPaise, 0)).toBe(12000);
    expect(trialBalance.find(row => row.id === "cash")).toMatchObject({ debitPaise: 8000, creditPaise: 0 });
    expect(calculateIncomeAndExpenditure(trialBalance)).toEqual({ incomePaise: 10000, expenditurePaise: 2000, surplusPaise: 8000 });
    expect(() => calculateTrialBalance(accounts, [{ ...posted[0], accountId: "another-school-account" }])).toThrow("outside this chart");
  });

  it("allows posting only into open periods", () => {
    expect(() => assertAccountingPeriodOpen("OPEN")).not.toThrow();
    expect(() => assertAccountingPeriodOpen("CLOSED")).toThrow("closed accounting period");
  });
});
