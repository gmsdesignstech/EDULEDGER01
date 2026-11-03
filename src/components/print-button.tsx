"use client";
import { useEffect } from "react";

export function PrintButton({label="Print receipt"}:{label?:string}={}) {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") === "1") {
      const timer = window.setTimeout(() => window.print(), 250);
      return () => window.clearTimeout(timer);
    }
  }, []);
  return (
    <button className="btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
