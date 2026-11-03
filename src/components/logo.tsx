import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="EduLedger home"
      className={cn(
        "flex items-center gap-3 font-black tracking-tight",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-12 shrink-0 rounded-xl border border-slate-200 bg-white bg-no-repeat shadow-sm"
        style={{
          backgroundImage: "url('/eduledger-logo.jpeg')",
          backgroundPosition: "center 35%",
          backgroundSize: "220%",
        }}
      />
      <span>
        EDU<span className="text-brand">LEDGER</span>
      </span>
    </Link>
  );
}
