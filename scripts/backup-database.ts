/* Run with `npm run db:backup`.
 *
 * Dumps the live database to backups/inventory-<date>.sql and prints
 * per-table row counts, so the caller (a person, or the nightly GitHub
 * Actions job in .github/workflows/backup.yml) has a record of what was
 * captured without opening the file. Uses the same dumpDatabase() the
 * in-app "Download a copy" button and the Restore flow's safety copy use —
 * one implementation for all three, so they can never quietly disagree
 * about what a backup contains.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import { dumpDatabase } from "../src/lib/backup/dump";

async function main() {
  const { sql, rowCounts } = await dumpDatabase();

  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(process.cwd(), "backups");
  const file = path.join(dir, `inventory-${date}.sql`);

  await mkdir(dir, { recursive: true });
  await writeFile(file, sql, "utf-8");

  const totalRows = Object.values(rowCounts).reduce((sum, n) => sum + n, 0);
  console.log(`Wrote ${file}`);
  console.log(`Total rows: ${totalRows}`);
  for (const [table, count] of Object.entries(rowCounts).sort()) {
    console.log(`  ${table}: ${count}`);
  }

  if (totalRows === 0) {
    console.error("WARNING: every table is empty. Double-check DATABASE_URL before trusting this backup.");
  }
}

main().catch((error) => {
  console.error("Backup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
