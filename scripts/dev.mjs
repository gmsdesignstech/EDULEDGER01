import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { PostgresInstance } from "pg-embedded";

// This launcher runs before Next.js, so load the local environment file before
// deciding whether the embedded development database is needed.
const localEnvironment = path.resolve(".env.local");
if (existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);

const hasExternalDatabase = Boolean(process.env.DATABASE_URL);
let database;

function run(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { ...options, stdio: options.stdio ?? "pipe" });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr?.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

function findBundledPostgresBin() {
  const root = path.join(process.env.USERPROFILE ?? "", ".theseus", "postgresql");
  if (!existsSync(root)) return undefined;
  const versions = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return versions
    .map((version) => path.join(root, version, "bin"))
    .find((bin) => existsSync(path.join(bin, "postgres.exe")));
}

async function isLocalPostgresReady() {
  const bin = findBundledPostgresBin();
  if (!bin) return false;
  const result = await run(
    path.join(bin, "pg_isready.exe"),
    ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", "eduledger"],
  );
  return result.code === 0;
}

async function startPostgresDirectly(dataDir) {
  const bin = findBundledPostgresBin();
  if (!bin) throw new Error("The bundled PostgreSQL binaries were not found.");

  const environment = { ...process.env, PGPASSWORD: "eduledger-local" };
  const server = spawn(
    path.join(bin, "postgres.exe"),
    ["-D", dataDir, "-F", "-p", "54329"],
    { env: environment, stdio: ["ignore", "ignore", "inherit"], windowsHide: true },
  );
  let startupError;
  server.once("error", (error) => (startupError = error));

  const readyArgs = ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", "postgres"];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (startupError) throw startupError;
    if (server.exitCode !== null) throw new Error(`PostgreSQL exited during startup with code ${server.exitCode}.`);
    const result = await run(path.join(bin, "pg_isready.exe"), readyArgs, { env: environment });
    if (result.code === 0) break;
    if (attempt === 59) throw new Error("PostgreSQL did not become ready within 30 seconds.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const exists = await run(path.join(bin, "psql.exe"), [...readyArgs, "-tAc", "SELECT 1 FROM pg_database WHERE datname='eduledger'"], { env: environment });
  if (exists.code !== 0) throw new Error(`Could not inspect local databases: ${exists.stderr.trim()}`);
  if (exists.stdout.trim() !== "1") {
    const created = await run(path.join(bin, "createdb.exe"), ["-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "eduledger"], { env: environment });
    if (created.code !== 0) throw new Error(`Could not create the EduLedger database: ${created.stderr.trim()}`);
  }

  let running = true;
  return {
    get state() { return running ? "Running" : "Stopped"; },
    async stop() {
      if (!running) return;
      const result = await run(path.join(bin, "pg_ctl.exe"), ["stop", "--pgdata", dataDir, "--mode", "fast", "--wait"], { env: environment, stdio: "inherit" });
      running = false;
      if (result.code !== 0) throw new Error(`pg_ctl stop exited with code ${result.code}.`);
    },
  };
}

function removeStalePostmasterPid(dataDir) {
  const pidFile = path.join(dataDir, "postmaster.pid");
  if (!existsSync(pidFile)) return;

  const pid = Number.parseInt(readFileSync(pidFile, "utf8").split(/\r?\n/, 1)[0], 10);
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      return;
    } catch (error) {
      if (error?.code === "EPERM") return;
      if (error?.code !== "ESRCH") throw error;
    }
  }

  unlinkSync(pidFile);
  console.warn(`Removed stale PostgreSQL PID file (process ${pid || "unknown"} is not running).`);
}

if (!hasExternalDatabase) {
  const dataDir = path.resolve("data/postgres");
  if (await isLocalPostgresReady()) {
    process.env.DATABASE_URL =
      "postgresql://postgres:eduledger-local@127.0.0.1:54329/eduledger";
    console.log("Using the existing local PostgreSQL server on port 54329.");
  } else try {
    removeStalePostmasterPid(dataDir);
    database = new PostgresInstance({
      port: 54329,
      username: "postgres",
      password: "eduledger-local",
      databaseName: "postgres",
      dataDir,
      persistent: true,
      setupTimeout: 300,
    });
    await database.start();
    if (!(await database.databaseExists("eduledger"))) {
      await database.createDatabase("eduledger");
    }
    process.env.DATABASE_URL =
      "postgresql://postgres:eduledger-local@127.0.0.1:54329/eduledger";
    console.log("Local PostgreSQL is ready on port 54329.");
  } catch (error) {
    if (process.platform === "win32") {
      console.warn("The embedded pg_ctl launcher failed; retrying with the PostgreSQL engine directly.");
      try {
        removeStalePostmasterPid(dataDir);
        database = await startPostgresDirectly(dataDir);
        process.env.DATABASE_URL = "postgresql://postgres:eduledger-local@127.0.0.1:54329/eduledger";
        console.log("Local PostgreSQL is ready on port 54329 (direct Windows launcher)." );
      } catch (fallbackError) {
        database = undefined;
        console.error("Embedded PostgreSQL could not start:", error);
        console.error("Direct PostgreSQL startup also failed:", fallbackError);
        console.warn("Using the local SQLite database for this development session.");
      }
    } else {
      database = undefined;
      console.error("Embedded PostgreSQL could not start:", error);
      console.warn("Using the local SQLite database for this development session.");
    }
  }
}

const next = spawn(
  process.execPath,
  [path.resolve("node_modules/next/dist/bin/next"), "dev"],
  {
  env: process.env,
  stdio: "inherit",
  },
);

let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (next.exitCode === null) next.kill("SIGINT");
  if (database?.state === "Running") {
    try {
      await database.stop();
    } catch (error) {
      console.error("Could not stop local PostgreSQL cleanly:", error);
    }
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => void stop(0));
process.on("SIGTERM", () => void stop(0));
next.on("exit", (code) => void stop(code ?? 0));
next.on("error", (error) => {
  console.error("Could not start Next.js:", error);
  void stop(1);
});
