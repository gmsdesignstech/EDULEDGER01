"use client";
import { useCallback, useEffect } from "react";

export function PrintButton({label="Print receipt",waitForImages=false}:{label?:string;waitForImages?:boolean}={}) {
  const print = useCallback(async () => {
    if (waitForImages) {
      await document.fonts?.ready;
      await Promise.all(Array.from(document.images).map((image) => image.decode().catch(() => undefined)));
    }
    window.print();
  }, [waitForImages]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") === "1") {
      const timer = window.setTimeout(() => void print(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [print]);
  return (
    <button className="btn-primary" onClick={() => void print()}>
      {label}
    </button>
  );
}
