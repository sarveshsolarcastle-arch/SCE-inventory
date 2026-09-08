import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaLibSql } from "@prisma/adapter-libsql";

/* -------------------------------------------------------------------------
 * A throwaway SQLite database for DB-layer tests, migrated the same way
 * `dev.db` is — `prisma migrate deploy` against a `file:` URL — rather than
 * copying `dev.db` itself, which carries hand-verified fixture data that a
 * test run should not depend on or disturb. Never points at Turso: only ever
 * a fresh file in the OS temp directory, deleted afterwards.
 *
 * NOT named *.test.ts on purpose — the test runner globs `src/**\/*.test.ts`,
 * and a helper is not a test.
 * ---------------------------------------------------------------------- */

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

export type TestDb = {
  prisma: PrismaClient;
  /** Disconnects and deletes the temp database file. Call in `after()`. */
  cleanup: () => Promise<void>;
};

/** Creates a fresh, fully-migrated SQLite database in a temp directory and
 * returns a Prisma client pointed at it. Slow-ish (~1s, spawns the Prisma
 * CLI) — call once per test FILE in `before()`, not per test. */
export function createTestDb(): TestDb {
  const dir = mkdtempSync(join(tmpdir(), "inv-testdb-"));
  const dbPath = join(dir, "test.db");
  const url = `file:${dbPath}`;

  // `shell: true` is required on Windows to run the `.cmd` shim at all; the
  // arguments here are fixed literals, never user input, so the escaping
  // caveat that comes with it does not apply.
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
    shell: true,
  });

  const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url }) });

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      // Windows can hold the sqlite file handle open briefly after disconnect
      // even once the client has been told to let go. Deleting the temp dir
      // is housekeeping, not correctness — each test gets its own fresh
      // directory, so a leftover one here does not leak into another test.
      // Swallow rather than fail the test over an OS-level cleanup race; the
      // OS temp directory gets swept on its own.
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort
      }
    },
  };
}

/** A minimal continuous item (wire-shaped): packaged, scraps below 15. */
export async function makeContinuousItem(
  prisma: PrismaClient,
  overrides: Partial<{
    sku: string;
    name: string;
    baseUnit: string;
    packUnit: string;
    scrapThreshold: number;
  }> = {}
) {
  return prisma.item.create({
    data: {
      sku: overrides.sku ?? `WIRE-${Math.random().toString(36).slice(2, 8)}`,
      name: overrides.name ?? "Test Wire",
      category: "Cable",
      baseUnit: overrides.baseUnit ?? "m",
      packUnit: overrides.packUnit ?? "roll",
      measure: "CONTINUOUS",
      scrapThreshold: overrides.scrapThreshold ?? 15,
      minStock: 0,
    },
  });
}

/** A minimal discrete item (screws-shaped): packaged, no scrap threshold. */
export async function makeDiscreteItem(
  prisma: PrismaClient,
  overrides: Partial<{ sku: string; name: string; baseUnit: string; packUnit: string }> = {}
) {
  return prisma.item.create({
    data: {
      sku: overrides.sku ?? `SCR-${Math.random().toString(36).slice(2, 8)}`,
      name: overrides.name ?? "Test Screws",
      category: "Fixings",
      baseUnit: overrides.baseUnit ?? "pcs",
      packUnit: overrides.packUnit ?? "packet",
      measure: "DISCRETE",
      scrapThreshold: null,
      minStock: 0,
    },
  });
}

export async function makeUser(prisma: PrismaClient, role: "ADMIN" | "FINANCE" | "EMPLOYEE" = "ADMIN") {
  return prisma.user.create({
    data: {
      name: "Test User",
      email: `test-${Math.random().toString(36).slice(2, 8)}@example.com`,
      passwordHash: "x",
      role,
    },
  });
}
