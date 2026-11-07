/**
 * Exact, paise-based primitives for the forthcoming posted-journal accounting
 * workflow. These helpers intentionally do not post or persist records.
 */
export type AccountGroup = "ASSET" | "LIABILITY" | "FUND" | "INCOME" | "EXPENSE";
export type JournalLine = {
  accountId: string;
  accountGroup: AccountGroup;
  debitPaise: number;
  creditPaise: number;
};
export type JournalAccount = { id: string; name: string; group: AccountGroup };
export type TrialBalanceRow = JournalAccount & { debitPaise: number; creditPaise: number };

function safePositiveInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateJournalLines(lines: JournalLine[]) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error("A journal entry must contain at least two lines.");
  }
  let debit = 0n;
  let credit = 0n;
  for (const line of lines) {
    if (!line.accountId || !["ASSET", "LIABILITY", "FUND", "INCOME", "EXPENSE"].includes(line.accountGroup)) {
      throw new Error("Every journal line must reference a valid account.");
    }
    const hasDebit = safePositiveInteger(line.debitPaise);
    const hasCredit = safePositiveInteger(line.creditPaise);
    if (hasDebit === hasCredit || (line.debitPaise !== 0 && !hasDebit) || (line.creditPaise !== 0 && !hasCredit)) {
      throw new Error("Each journal line must contain exactly one positive whole-paise debit or credit.");
    }
    debit += BigInt(line.debitPaise);
    credit += BigInt(line.creditPaise);
  }
  if (debit <= 0n || debit !== credit) {
    throw new Error("Journal debits must equal credits and be greater than zero.");
  }
  if (debit > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Journal total exceeds the supported exact monetary range.");
  }
  return { debitPaise: Number(debit), creditPaise: Number(credit) };
}

export function reversalLines(lines: JournalLine[]): JournalLine[] {
  validateJournalLines(lines);
  return lines.map((line) => ({ ...line, debitPaise: line.creditPaise, creditPaise: line.debitPaise }));
}

export function calculateTrialBalance(accounts: JournalAccount[], postedLines: JournalLine[]): TrialBalanceRow[] {
  const totals = new Map<string, { debit: bigint; credit: bigint }>();
  const accountGroups = new Map<string, AccountGroup>();
  for (const account of accounts) {
    if (totals.has(account.id)) throw new Error("The chart contains duplicate account identifiers.");
    totals.set(account.id, { debit: 0n, credit: 0n });
    accountGroups.set(account.id, account.group);
  }
  for (const line of postedLines) {
    const total = totals.get(line.accountId);
    if (!total) throw new Error("A posted journal line references an account outside this chart.");
    if (accountGroups.get(line.accountId) !== line.accountGroup) throw new Error("A posted journal line has a mismatched account group.");
    const hasDebit = safePositiveInteger(line.debitPaise);
    const hasCredit = safePositiveInteger(line.creditPaise);
    if (hasDebit === hasCredit || (line.debitPaise !== 0 && !hasDebit) || (line.creditPaise !== 0 && !hasCredit)) {
      throw new Error("Every posted journal line must contain exactly one positive whole-paise debit or credit.");
    }
    total.debit += BigInt(line.debitPaise);
    total.credit += BigInt(line.creditPaise);
  }
  return accounts.map((account) => {
    const total = totals.get(account.id)!;
    const debitNormal = account.group === "ASSET" || account.group === "EXPENSE";
    const signed = debitNormal
      ? total.debit - total.credit
      : total.credit - total.debit;
    if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new Error("Account balance exceeds the supported exact monetary range.");
    }
    const normalBalance = signed > 0n ? Number(signed) : 0;
    const oppositeBalance = signed < 0n ? Number(-signed) : 0;
    return {
      ...account,
      debitPaise: debitNormal ? normalBalance : oppositeBalance,
      creditPaise: debitNormal ? oppositeBalance : normalBalance,
    };
  });
}

export function calculateIncomeAndExpenditure(rows: TrialBalanceRow[]) {
  let income = 0n;
  let expenditure = 0n;
  for (const row of rows) {
    if (row.group === "INCOME") income += BigInt(row.creditPaise) - BigInt(row.debitPaise);
    if (row.group === "EXPENSE") expenditure += BigInt(row.debitPaise) - BigInt(row.creditPaise);
  }
  const net = income - expenditure;
  for (const amount of [income, expenditure, net]) {
    if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new Error("Statement total exceeds the supported exact monetary range.");
    }
  }
  return { incomePaise: Number(income), expenditurePaise: Number(expenditure), surplusPaise: Number(net) };
}

export function assertAccountingPeriodOpen(status: string) {
  if (status !== "OPEN") throw new Error("Posting is not allowed in a closed accounting period.");
}
