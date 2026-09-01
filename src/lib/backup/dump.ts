import { createClient, type Value } from "@libsql/client";
import { resolveDatabaseUrl } from "@/lib/databaseUrl";

/* -------------------------------------------------------------------------
 * Dumping the database to a portable SQL script.
 *
 * This talks to libSQL directly rather than through Prisma, deliberately:
 * a dump has to survive schema drift and cover `_prisma_migrations` too, and
 * Prisma Client only knows about the models in schema.prisma. Reading
 * `sqlite_schema` and SELECT * instead means the dump is exactly what is in
 * the database, not what the schema currently claims should be there.
 *
 * Used by both the nightly GitHub Actions job (scripts/backup-database.ts)
 * and the in-app Restore flow (restore.ts takes a safety copy this way
 * before overwriting anything) — one implementation, so a backup can never
 * silently drift from what a restore expects.
 * ---------------------------------------------------------------------- */

export type DumpResult = {
  /** A full SQL script: schema + data, wrapped in a transaction. Executable
   * top-to-bottom against an empty OR an existing database — it drops each
   * table it is about to recreate first. */
  sql: string;
  /** Row count per table, for a human-readable record of what was captured. */
  rowCounts: Record<string, number>;
};

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function encodeLiteral(value: Value): string {
  if (value === null) return "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot encode non-finite number ${value} as a SQL literal`);
    }
    return String(value);
  }
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (value instanceof ArrayBuffer) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }
  throw new Error(`Cannot encode value of type ${typeof value} as a SQL literal`);
}

/** Dumps every application table: DDL from `sqlite_schema`, then every row as
 * an INSERT, wrapped in one transaction with a DROP TABLE per table up
 * front — so the script is also directly usable as a restore script against
 * a database that already has the old (or a partial) schema in it. */
export async function dumpDatabase(): Promise<DumpResult> {
  const client = createClient({
    url: resolveDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const schema = await client.execute(
      `SELECT type, name, sql FROM sqlite_schema
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
       ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END`,
    );

    const tableNames = schema.rows
      .filter((row) => row.type === "table")
      .map((row) => String(row.name));

    if (tableNames.length === 0) {
      throw new Error("No tables found in the database — refusing to write an empty dump");
    }

    const lines: string[] = [
      `-- Inventory database dump — ${new Date().toISOString()}`,
      "PRAGMA foreign_keys=OFF;",
      "BEGIN TRANSACTION;",
    ];

    // Drop first so this script can also serve as a restore against a
    // database that isn't empty.
    for (const table of tableNames) {
      lines.push(`DROP TABLE IF EXISTS ${quoteIdent(table)};`);
    }
    for (const row of schema.rows) {
      lines.push(`${String(row.sql)};`);
    }

    const rowCounts: Record<string, number> = {};

    for (const table of tableNames) {
      const data = await client.execute(`SELECT * FROM ${quoteIdent(table)}`);
      rowCounts[table] = data.rows.length;

      const columns = data.columns.map(quoteIdent).join(", ");
      for (const row of data.rows) {
        const values = data.columns
          .map((col) => encodeLiteral(row[col] as Value))
          .join(", ");
        lines.push(`INSERT INTO ${quoteIdent(table)} (${columns}) VALUES (${values});`);
      }
    }

    lines.push("COMMIT;", "PRAGMA foreign_keys=ON;");

    return { sql: lines.join("\n") + "\n", rowCounts };
  } finally {
    client.close();
  }
}
