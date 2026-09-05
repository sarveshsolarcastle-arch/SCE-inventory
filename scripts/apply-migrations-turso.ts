/* Applies Prisma migrations to a database `prisma migrate deploy` cannot reach.
 *
 *   npm run db:migrate:turso              # status only — reads, never writes
 *   npm run db:migrate:turso -- --apply   # apply what is pending
 *   npm run db:migrate:turso -- --baseline
 *
 * WHY THIS EXISTS. `prisma migrate deploy` fails against Turso with
 * `P1013: the URL must start with the protocol file:` — Prisma's migration
 * engine does not understand `libsql://`, and Prisma's own docs say Turso
 * migrations go through direct SQL execution instead. The first ten migrations
 * were applied that way in August 2026 by a one-off script that was then
 * **discarded**, which left the project with a live database it had no
 * supported way to migrate again. This is that script, kept this time.
 *
 * WHAT PRISMA DOES THAT A BARE `executeMultiple` DOES NOT. Applying the SQL is
 * the easy half; the half that gets forgotten is `_prisma_migrations`, the
 * table Prisma reads to decide what has already run. Skip it and the schema
 * changes while Prisma still believes the migration is pending — so the next
 * `migrate dev` reports drift and offers to reset the database. This script
 * writes that row, with the same SHA-256-of-the-file checksum Prisma computes
 * (verified against the local database's existing rows), so `migrate status`
 * stays truthful afterwards.
 *
 * SAFETY. Status is the default: you have to ask for a write. Before applying
 * anything it takes a full dump through the same `dumpDatabase()` the nightly
 * backup and the in-app Restore use, so there is a known-good copy from
 * seconds earlier — no promises required from whoever runs it. A migration
 * whose file has changed since it was applied is treated as drift and stops
 * everything, rather than being quietly re-run.
 *
 * WHICH DATABASE IT TALKS TO. `.env`, via dotenv — NOT `.env.local`. That is
 * deliberate and the opposite of `next dev`: the app in development is pinned
 * to `file:./dev.db` by `.env.local` so it cannot write to the client's stock,
 * while an ops script like this one is *for* the deployment database, same as
 * `npm run db:backup`. Both are right, and the split is easy to forget — so the
 * target host is printed before anything else happens, and a real environment
 * variable still beats both files:
 *
 *   DATABASE_URL="file:./dev.db" npm run db:migrate:turso
 *
 * ONE STATE THIS IS LIKELY TO FIND. If the ten August migrations were applied
 * without recording them, the remote `_prisma_migrations` is missing or empty
 * while the tables all exist. Applying then would try to CREATE TABLE over live
 * data and fail. The script detects that — schema present, bookkeeping absent —
 * and tells you to run `--baseline`, which records migrations as applied
 * WITHOUT executing them. That is `prisma migrate resolve --applied` by hand,
 * and it is only ever right when the schema already matches.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import { createClient, type Client } from "@libsql/client";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl";
import { dumpDatabase } from "../src/lib/backup/dump";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/** Prisma's own DDL for this table, copied verbatim so a database created by
 * this script and one created by `migrate deploy` are indistinguishable. */
const MIGRATIONS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

type Migration = { name: string; sql: string; checksum: string };
type AppliedRow = {
  name: string;
  checksum: string;
  finished: boolean;
  rolledBack: boolean;
};

/** Migration directories are timestamp-prefixed, so lexical order is
 * chronological order — the order Prisma applies them in, and the only order
 * in which they are valid. */
async function readMigrations(): Promise<Migration[]> {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  const migrations: Migration[] = [];
  for (const name of dirs) {
    const file = path.join(MIGRATIONS_DIR, name, "migration.sql");
    // Hash the raw bytes, not a decoded string: that is what Prisma checksums,
    // and decoding would let a CRLF checkout produce a different digest.
    const raw = await readFile(file);
    migrations.push({
      name,
      sql: raw.toString("utf-8"),
      checksum: createHash("sha256").update(raw).digest("hex"),
    });
  }
  return migrations;
}

async function readApplied(client: Client): Promise<AppliedRow[] | null> {
  try {
    const result = await client.execute(
      `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`
    );
    return result.rows.map((row) => ({
      name: String(row.migration_name),
      checksum: String(row.checksum),
      finished: row.finished_at !== null,
      rolledBack: row.rolled_back_at !== null,
    }));
  } catch {
    // No such table — either a virgin database or one migrated without
    // bookkeeping. Which of those it is depends on whether tables exist.
    return null;
  }
}

async function hasApplicationTables(client: Client): Promise<boolean> {
  const result = await client.execute(
    `SELECT count(*) AS n FROM sqlite_schema
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`
  );
  return Number(result.rows[0]?.n ?? 0) > 0;
}

async function recordApplied(client: Client, migration: Migration, startedAt: Date) {
  await client.execute({
    sql: `INSERT INTO "_prisma_migrations"
            ("id", "checksum", "finished_at", "migration_name", "logs",
             "rolled_back_at", "started_at", "applied_steps_count")
          VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
    args: [
      randomUUID(),
      migration.checksum,
      new Date().toISOString(),
      migration.name,
      startedAt.toISOString(),
    ],
  });
}

async function takeSafetyCopy(): Promise<string> {
  const { sql, rowCounts } = await dumpDatabase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups");
  const file = path.join(dir, `pre-migration-${stamp}.sql`);
  await mkdir(dir, { recursive: true });
  await writeFile(file, sql, "utf-8");
  const rows = Object.values(rowCounts).reduce((sum, n) => sum + n, 0);
  console.log(`  safety copy: ${file} (${rows} rows)`);
  return file;
}

/** The host, never the credentials — this gets pasted into terminals and
 * tickets, and the auth token travels in a separate variable for a reason. */
function describeTarget(url: string): string {
  if (url.startsWith("file:")) return url;
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable URL)";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const baseline = args.includes("--baseline");

  if (apply && baseline) {
    throw new Error("--apply and --baseline do opposite things; pick one");
  }

  const url = resolveDatabaseUrl();
  const migrations = await readMigrations();
  console.log(`Target:     ${describeTarget(url)}`);
  console.log(`Migrations: ${migrations.length} on disk\n`);

  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  try {
    const appliedRows = await readApplied(client);

    // --baseline exists precisely to resolve this state, so it must be allowed
    // through the guard that reports it.
    if (!baseline && appliedRows === null && (await hasApplicationTables(client))) {
      console.error(
        "This database has application tables but no _prisma_migrations table.\n" +
          "Its schema was changed outside Prisma's bookkeeping — which is exactly\n" +
          "what happened to the Turso pilot in August 2026.\n\n" +
          "Applying now would run CREATE TABLE over live data and fail. If the schema\n" +
          "already matches these migrations, record them without running them:\n\n" +
          "  npm run db:migrate:turso -- --baseline\n"
      );
      process.exitCode = 1;
      return;
    }

    const applied = new Map((appliedRows ?? []).map((r) => [r.name, r]));

    const drifted = migrations.filter((m) => {
      const row = applied.get(m.name);
      return row && row.checksum !== m.checksum;
    });
    const unfinished = (appliedRows ?? []).filter((r) => !r.finished || r.rolledBack);
    const pending = migrations.filter((m) => !applied.has(m.name));

    for (const m of migrations) {
      const row = applied.get(m.name);
      const state = !row
        ? "PENDING"
        : row.checksum !== m.checksum
          ? "DRIFT — file changed since it was applied"
          : !row.finished || row.rolledBack
            ? "FAILED — needs resolving by hand"
            : "applied";
      console.log(`  ${state === "applied" ? " " : "!"} ${m.name}  ${state}`);
    }
    console.log("");

    if (drifted.length || unfinished.length) {
      console.error(
        "Refusing to touch this database.\n" +
          "A migration recorded as applied no longer matches the file on disk, or a\n" +
          "previous attempt did not finish. Re-running would apply SQL that is not\n" +
          "what the recorded checksum promises. Resolve by hand before continuing."
      );
      process.exitCode = 1;
      return;
    }

    if (!pending.length) {
      console.log("Nothing pending — the database is up to date.");
      return;
    }

    if (!apply && !baseline) {
      console.log(
        `${pending.length} migration(s) pending. This was a read-only check; nothing was\n` +
          "written. To apply them:\n\n" +
          "  npm run db:migrate:turso -- --apply\n"
      );
      return;
    }

    // Both write paths record bookkeeping, so both get a safety copy first —
    // a wrong baseline is as hard to unpick as a half-applied migration. But an
    // empty database has nothing to lose and dumpDatabase() refuses to write an
    // empty dump, so skip it there: that is the ordinary case for a brand-new
    // database, which is how Part B's offline production will be created.
    if (await hasApplicationTables(client)) {
      console.log(baseline ? "Taking a safety copy before baselining…" : "Taking a safety copy before applying…");
      await takeSafetyCopy();
    } else {
      console.log("Empty database — no safety copy needed.");
    }
    console.log("");

    await client.executeMultiple(MIGRATIONS_TABLE_DDL);

    for (const migration of pending) {
      const startedAt = new Date();
      if (baseline) {
        console.log(`  recording (not running) ${migration.name}`);
      } else {
        console.log(`  applying ${migration.name}`);
        try {
          // executeMultiple, not batch(): Prisma's SQLite migrations carry their
          // own PRAGMA foreign_keys / defer_foreign_keys around table rebuilds,
          // and those are no-ops inside a transaction. Let the SQL do what it
          // was generated to do.
          await client.executeMultiple(migration.sql);
        } catch (error) {
          console.error(
            `\nFAILED while applying ${migration.name}:\n  ` +
              (error instanceof Error ? error.message : String(error)) +
              "\n\nNothing was recorded for it, so this migration still reads as pending.\n" +
              "The database may be half-changed: check it against the safety copy above\n" +
              "before running anything else."
          );
          process.exitCode = 1;
          return;
        }
      }
      await recordApplied(client, migration, startedAt);
    }

    console.log(
      `\nDone — ${pending.length} migration(s) ${baseline ? "recorded as applied" : "applied"}.\n` +
        "Confirm with: npx prisma migrate status"
    );
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error("Migration script failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
