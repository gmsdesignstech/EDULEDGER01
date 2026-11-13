import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Explicit database-free unit suites; PostgreSQL integration tests stay in the guarded main config. */
export default defineConfig({
  test: {
    include: [
      "tests/accounting-engine.test.ts",
      "tests/api-response.test.ts",
      "tests/auth-redirect.test.ts",
      "tests/credential-pdf.test.ts",
      "tests/dashboard-loading-resilience.test.ts",
      "tests/database-environment-separation.test.ts",
      "tests/firebase-activation.test.ts",
      "tests/import-large-file.test.ts",
      "tests/import-schema.test.ts",
      "tests/multi-school-access.test.ts",
      "tests/notifications-provider.test.ts",
      "tests/parent-fee-payment-verification.test.ts",
      "tests/password-reset.test.ts",
      "tests/pwa-completion.test.ts",
      "tests/pwa-installation-and-diagnostics.test.ts",
      "tests/pwa-multi-install.test.ts",
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
      "tests/whatsapp-rate-limit.test.ts",
      "tests/whatsapp-n8n-integration.test.ts",
      "tests/whatsapp-e2e-simulation.test.ts",
      "tests/whatsapp-dispatch-safety.test.ts",
      "tests/whatsapp-worker.test.ts",
      "tests/db-health-check.test.ts",
      "tests/teacher-portal-auth.test.ts",
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
