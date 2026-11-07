export type PayrollAmountsInput = {
  basicPaise: number;
  allowancesPaise: number;
  bonusPaise: number;
  overtimePaise: number;
  otherEarningsPaise: number;
  deductionsPaise: number;
  advanceDeductionPaise: number;
  otherDeductionsPaise: number;
};

export function calculatePayrollAmounts(input: PayrollAmountsInput) {
  const earnings = [input.basicPaise, input.allowancesPaise, input.bonusPaise, input.overtimePaise, input.otherEarningsPaise];
  const deductions = [input.deductionsPaise, input.advanceDeductionPaise, input.otherDeductionsPaise];
  if ([...earnings, ...deductions].some((amount) => !Number.isSafeInteger(amount) || amount < 0)) {
    throw new Error("Payroll amounts must be non-negative whole paise within the exact calculation range.");
  }
  const gross = earnings.reduce((sum, amount) => sum + BigInt(amount), 0n);
  const totalDeductions = deductions.reduce((sum, amount) => sum + BigInt(amount), 0n);
  const net = gross - totalDeductions;
  if (gross > BigInt(Number.MAX_SAFE_INTEGER) || totalDeductions > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Payroll total exceeds the supported exact calculation range.");
  }
  if (net < 0n) throw new Error("Deductions cannot exceed gross salary.");
  return { grossPaise: Number(gross), totalDeductionsPaise: Number(totalDeductions), netPaise: Number(net) };
}
