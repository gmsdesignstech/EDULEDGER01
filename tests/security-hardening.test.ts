import { describe, expect, it } from "vitest";
import { consumeRateLimit, detectedImageMime, isCrossSiteMutation, spreadsheetSafeValue } from "../src/lib/security";

describe("security hardening primitives", () => {
  it("blocks cross-site mutations while allowing same-origin and read requests", () => {
    expect(isCrossSiteMutation(new Request("https://eduledger.test/api/students", { method: "POST", headers: { origin: "https://evil.test" } }))).toBe(true);
    expect(isCrossSiteMutation(new Request("https://eduledger.test/api/students", { method: "POST", headers: { origin: "https://eduledger.test" } }))).toBe(false);
    expect(isCrossSiteMutation(new Request("https://eduledger.test/api/students", { method: "GET", headers: { origin: "https://evil.test" } }))).toBe(false);
    expect(isCrossSiteMutation(new Request("https://eduledger.test/api/students", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }))).toBe(true);
  });

  it("enforces bounded authentication attempts", () => {
    const key = `test-${crypto.randomUUID()}`;
    expect(consumeRateLimit(key, 2, 60_000, 1_000).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000, 1_001).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000, 1_002)).toMatchObject({ allowed: false, remaining: 0 });
    expect(consumeRateLimit(key, 2, 60_000, 61_001).allowed).toBe(true);
  });

  it("detects image content instead of trusting the browser MIME declaration", () => {
    expect(detectedImageMime(Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe("image/png");
    expect(detectedImageMime(Uint8Array.from([0xff,0xd8,0xff,0xe0]))).toBe("image/jpeg");
    expect(detectedImageMime(new TextEncoder().encode("not an image"))).toBeNull();
  });

  it("neutralizes spreadsheet formulas without changing ordinary or numeric values", () => {
    expect(spreadsheetSafeValue("=HYPERLINK(\"https://evil.test\")")).toBe("'=HYPERLINK(\"https://evil.test\")");
    expect(spreadsheetSafeValue("  +cmd|' /C calc'!A0")).toBe("'  +cmd|' /C calc'!A0");
    expect(spreadsheetSafeValue("-125.50")).toBe("-125.50");
    expect(spreadsheetSafeValue("Student Name")).toBe("Student Name");
    expect(spreadsheetSafeValue(100)).toBe(100);
  });
});
