import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The isolated PWA prototype uses Node's native test runner and has its own
    // package script. Keep those .mjs suites out of the main Vitest project.
    include: ["tests/**/*.test.ts"],
    // The test worker receives only the explicitly designated PostgreSQL target.
    // globalSetup validates the shell environment and refuses an inherited DATABASE_URL.
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      TEST_DATABASE_PRODUCTION_IDENTITY: process.env.TEST_DATABASE_PRODUCTION_IDENTITY ?? "",
      TEST_DATABASE_TARGET_CONFIRMED_DISPOSABLE: process.env.TEST_DATABASE_TARGET_CONFIRMED_DISPOSABLE ?? "",
      TEST_DATABASE_ALLOW_SCHEMA_INIT: process.env.TEST_DATABASE_ALLOW_SCHEMA_INIT ?? "",
      EDULEDGER_TEST_TARGET_ISOLATED: process.env.EDULEDGER_TEST_TARGET_ISOLATED ?? "",
      EDULEDGER_ALLOW_SCHEMA_INITIALIZATION: process.env.TEST_DATABASE_ALLOW_SCHEMA_INIT ?? "",
      EDULEDGER_ENVIRONMENT: "test",
    },
    globalSetup: ["./tests/global-setup.ts"],
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
