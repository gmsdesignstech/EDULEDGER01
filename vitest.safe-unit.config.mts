import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Explicit database-free unit suites; PostgreSQL integration tests stay in the guarded main config. */
export default defineConfig({
  test: {
    include: [
      "tests/accounting-engine.test.ts",
      "tests/api-response.test.ts",
      "tests/auth-redirect.test.ts",
      "tests/dashboard-loading-resilience.test.ts",
      "tests/database-environment-separation.test.ts",
      "tests/import-large-file.test.ts",
      "tests/import-schema.test.ts",
      "tests/notifications-provider.test.ts",
      "tests/parent-fee-payment-verification.test.ts",
      "tests/pwa-completion.test.ts",
      "tests/pwa.test.ts",
      "tests/payroll-calculations.test.ts",
      "tests/postgres-test-guard.test.ts",
      "tests/qr-fee-accounting.test.ts",
      "tests/registration-validation.test.ts",
      "tests/security-hardening.test.ts",
      "tests/security.test.ts",
      "tests/student-id-card.test.ts",
      "tests/subscription-capacity.test.ts",
      "tests/subscription-period.test.ts",
      "tests/timetable-editing.test.ts",
      "tests/whatsapp-messaging.test.ts",
      "tests/whatsapp-pricing.test.ts",
    ],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
});
