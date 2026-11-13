import { describe, expect, it } from "vitest";
import { classifyDatabaseConfiguration, classifyDatabaseError } from "../scripts/db-health-check.mjs";

describe("Database Diagnostic Error Classification Suite", () => {
  it("distinguishes MISSING_CONFIGURATION (exit code 2)", () => {
    const res = classifyDatabaseConfiguration("");
    expect(res.status).toBe("MISSING_CONFIGURATION");
    expect(res.exitCode).toBe(2);
  });

  it("distinguishes INVALID_URL (exit code 2)", () => {
    const res1 = classifyDatabaseConfiguration("mysql://user:pass@localhost/db");
    expect(res1.status).toBe("INVALID_URL");
    expect(res1.exitCode).toBe(2);

    const res2 = classifyDatabaseConfiguration("not-even-a-url");
    expect(res2.status).toBe("INVALID_URL");
    expect(res2.exitCode).toBe(2);
  });

  it("distinguishes PLACEHOLDER_CONFIGURATION (exit code 2)", () => {
    const res1 = classifyDatabaseConfiguration("postgresql://USER:PASSWORD@HOST:5432/DATABASE");
    expect(res1.status).toBe("PLACEHOLDER_CONFIGURATION");
    expect(res1.exitCode).toBe(2);

    const res2 = classifyDatabaseConfiguration("postgresql://user:pass@placeholder:5432/eduledger");
    expect(res2.status).toBe("PLACEHOLDER_CONFIGURATION");
    expect(res2.exitCode).toBe(2);
  });

  it("accepts valid PostgreSQL configuration", () => {
    const res = classifyDatabaseConfiguration("postgresql://postgres:secret@db.supabase.co:5432/eduledger");
    expect(res.status).toBe("CONFIGURED");
    expect(res.exitCode).toBe(0);
    expect(res.host).toBe("db.supabase.co");
    expect(res.database).toBe("eduledger");
  });

  it("distinguishes DNS_FAILURE (exit code 1)", () => {
    const err = new Error("getaddrinfo ENOTFOUND db.example.com");
    (err as any).code = "ENOTFOUND";
    const res = classifyDatabaseError(err);
    expect(res.category).toBe("DNS_FAILURE");
    expect(res.exitCode).toBe(1);
  });

  it("distinguishes CONNECTION_REFUSED (exit code 1)", () => {
    const err = new Error("connect ECONNREFUSED 127.0.0.1:5432");
    (err as any).code = "ECONNREFUSED";
    const res = classifyDatabaseError(err);
    expect(res.category).toBe("CONNECTION_REFUSED");
    expect(res.exitCode).toBe(1);
  });

  it("distinguishes TLS_FAILURE (exit code 1)", () => {
    const err = new Error("self signed certificate in certificate chain");
    (err as any).code = "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
    const res = classifyDatabaseError(err);
    expect(res.category).toBe("TLS_FAILURE");
    expect(res.exitCode).toBe(1);
  });

  it("distinguishes AUTHENTICATION_FAILURE (exit code 1)", () => {
    const err = new Error("password authentication failed for user 'postgres'");
    (err as any).code = "28P01";
    const res = classifyDatabaseError(err);
    expect(res.category).toBe("AUTHENTICATION_FAILURE");
    expect(res.exitCode).toBe(1);
  });

  it("distinguishes DATABASE_NOT_FOUND (exit code 1)", () => {
    const err = new Error('database "eduledger_missing" does not exist');
    (err as any).code = "3D000";
    const res = classifyDatabaseError(err);
    expect(res.category).toBe("DATABASE_NOT_FOUND");
    expect(res.exitCode).toBe(1);
  });

  it("distinguishes QUERY_FAILURE (exit code 1)", () => {
    const err = new Error('relation "unknown_table" does not exist');
    (err as any).code = "42P01";
    const res = classifyDatabaseError(err);
    expect(res.category).toBe("QUERY_FAILURE");
    expect(res.exitCode).toBe(1);
  });
});

