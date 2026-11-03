"use client";

import { Printer } from "lucide-react";

export function SalarySlipPrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn-secondary"><Printer className="size-4" />Print</button>;
}
