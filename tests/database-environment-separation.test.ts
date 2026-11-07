import { describe, expect, it } from "vitest";
import {
  parseTarget,
  sameTarget,
  assertPreviewPostgresTarget,
  assertDevelopmentPostgresTarget,
  assertTestPostgresTarget,
} from "../src/lib/postgres-target";

describe("Database Environment Separation & Target Isolation", () => {
  const productionIdentity = "postgresql://ep-production.us-east-1.aws.neon.tech:5432/eduledger_production";
  const isolatedPreviewUrl = "postgresql://preview_user:p_secret123@ep-preview.us-east-1.aws.neon.tech:5432/eduledger_preview?sslmode=require";
  const collidingPreviewUrl = "postgresql://preview_user:p_secret123@ep-production.us-east-1.aws.neon.tech:5432/eduledger_production?sslmode=require";
  const validDevUrl = "postgresql://dev_user:dev_pass@localhost:5432/eduledger_dev";
  const invalidDevUrlNoMarker = "postgresql://dev_user:dev_pass@localhost:5432/eduledger_other";
  const validTestUrl = "postgresql://test_user:test_pass@localhost:5432/eduledger_test";
  const invalidTestUrlNoMarker = "postgresql://test_user:test_pass@localhost:5432/eduledger_staging";

  describe("parseTarget", () => {
    it("parses valid PostgreSQL connection URLs correctly", () => {
      const parsed = parseTarget(isolatedPreviewUrl);
      expect(parsed).toEqual({
        host: "ep-preview.us-east-1.aws.neon.tech",
        port: "5432",
        database: "eduledger_preview",
      });
    });

    it("rejects non-PostgreSQL protocols", () => {
      expect(() => parseTarget("mysql://user:pass@localhost:3306/db")).toThrow(
        "EduLedger requires a PostgreSQL connection URL.",
      );
      expect(() => parseTarget("sqlite:///path/to/db.sqlite")).toThrow(
        "EduLedger requires a PostgreSQL connection URL.",
      );
    });

    it("rejects credentials when parsing a production identity", () => {
      expect(() =>
        parseTarget("postgresql://user:pass@ep-production.us-east-1.aws.neon.tech:5432/db", true),
      ).toThrow("Database identity must not contain credentials.");
    });

    it("rejects invalid URLs without crashing", () => {
      expect(() => parseTarget("not-a-valid-url")).toThrow(
        "Database target is not a valid PostgreSQL URL or identity.",
      );
    });
  });

  describe("sameTarget", () => {
    it("identifies matching targets even with different credentials and query parameters", () => {
      const targetA = parseTarget("postgresql://user_a:pass_a@db.example.com:5432/school_db?sslmode=require");
      const targetB = parseTarget("postgresql://user_b:pass_b@db.example.com:5432/school_db?sslmode=disable");
      expect(sameTarget(targetA, targetB)).toBe(true);
    });

    it("identifies distinct targets when host or database differs", () => {
      const targetA = parseTarget("postgresql://user:pass@db-prod.example.com:5432/school_db");
      const targetB = parseTarget("postgresql://user:pass@db-preview.example.com:5432/school_db");
      expect(sameTarget(targetA, targetB)).toBe(false);

      const targetC = parseTarget("postgresql://user:pass@db-prod.example.com:5432/school_db_preview");
      expect(sameTarget(targetA, targetC)).toBe(false);
    });
  });

  describe("Preview Isolation (assertPreviewPostgresTarget)", () => {
    it("accepts an isolated preview database target", () => {
      expect(() =>
        assertPreviewPostgresTarget(isolatedPreviewUrl, productionIdentity),
      ).not.toThrow();
    });

    it("throws and blocks preview if preview target matches production identity", () => {
      expect(() =>
        assertPreviewPostgresTarget(collidingPreviewUrl, productionIdentity),
      ).toThrow("Preview PostgreSQL target matches the configured production identity");
    });

    it("does not leak database credentials in error messages", () => {
      try {
        assertPreviewPostgresTarget(collidingPreviewUrl, productionIdentity);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        expect(message).not.toContain("p_secret123");
        expect(message).not.toContain("preview_user");
      }
    });
  });

  describe("Development Isolation (assertDevelopmentPostgresTarget)", () => {
    it("accepts a dev-marked database that does not match production", () => {
      expect(() =>
        assertDevelopmentPostgresTarget(validDevUrl, productionIdentity),
      ).not.toThrow();
    });

    it("rejects dev database missing a dev marker", () => {
      expect(() =>
        assertDevelopmentPostgresTarget(invalidDevUrlNoMarker, productionIdentity),
      ).toThrow("Development PostgreSQL database name must contain a dev marker.");
    });

    it("rejects dev database if it accidentally matches production", () => {
      const devMatchingProd = "postgresql://dev_user:pass@ep-production.us-east-1.aws.neon.tech:5432/eduledger_production";
      expect(() =>
        assertDevelopmentPostgresTarget(devMatchingProd, productionIdentity),
      ).toThrow();
    });
  });

  describe("Test Isolation (assertTestPostgresTarget)", () => {
    it("accepts a test-marked database that does not match production", () => {
      expect(() =>
        assertTestPostgresTarget(validTestUrl, productionIdentity),
      ).not.toThrow();
    });

    it("rejects test database missing a test marker", () => {
      expect(() =>
        assertTestPostgresTarget(invalidTestUrlNoMarker, productionIdentity),
      ).toThrow("Test PostgreSQL database name must contain a test marker.");
    });
  });
});

