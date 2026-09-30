/* Run with:
 *   npx tsx scripts/restore-z-remove-2026-09-24.ts <backup.sql>                       # report only
 *   npx tsx scripts/restore-z-remove-2026-09-24.ts <backup.sql> --yes-apply cosmosorigin
 *
 * Undoes the "Z Remove" half of cleanup-prod-2026-09-24.ts and NOTHING else.
 * The Admin ADJUSTMENT rows stay deleted, and no other table is touched.
 *
 * WHY NOT A FULL RESTORE. The in-app Restore replaces the whole database, so
 * anything recorded since the backup would be lost. This puts back only the
 * rows the cleanup removed for those items: the Item rows, their PackStock and
 * OpenPack rows, the ledger rows (the dispatch lines) and the ShelfSlot
 * assignments the cleanup cleared.
 *
 * HOW. The dump is loaded into a scratch SQLite file, the rows are SELECTed
 * from it (so values are copied verbatim, dates included), and inserted into
 * production in ONE atomic batch.
 *
 * NO SILENT FAILURE. Before writing, it refuses (exit 1, nothing written) if a
 * restored item's id or SKU is already taken, a ledger row's id already exists,
 * a shelf box is missing or has been given to a different item since, or the
 * dispatch/site/user a row points at is gone. After the batch it re-reads
 * production and compares every restored row to the backup's, printing
 * VERIFIED or VERIFICATION FAILED (exit 1).
 */
import "dotenv/config";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient, type Client, type InStatement } from "@libsql/client";

const args = process.argv.slice(2);
const backupFile: string | undefined = args.find((a) => a.endsWith(".sql"));
const flagIndex = args.indexOf("--yes-apply");
const apply = flagIndex !== -1;
const fragment = apply ? args[flagIndex + 1] : null;
const url = process.env.DATABASE_URL?.trim();

if (!backupFile) {
  console.error("Pass the backup .sql file to restore from.");
  process.exit(1);
}
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
console.log(`Target database: ${url}`);
console.log(`Backup:          ${backupFile}`);
console.log(apply ? "Mode: APPLY" : "Mode: report only (nothing will be written)");
if (apply && (!fragment || !url.includes(fragment))) {
  console.error(
    !fragment
      ? '\nRefusing to run. Pass --yes-apply <fragment> (e.g. "cosmosorigin").'
      : `\nRefusing to run. "${fragment}" does not appear in "${url}". Nothing was touched.`,
  );
  process.exit(1);
}

type Row = Record<string, unknown>;
const plain = (r: Row): Row => ({ ...r });

async function rows(c: Client, sql: string, params: unknown[] = []): Promise<Row[]> {
  const r = await c.execute({ sql, args: params as never[] });
  return r.rows.map(plain);
}

const marks = (n: number) => Array(n).fill("?").join(",");

function insert(table: string, row: Row): InStatement {
  const cols = Object.keys(row);
  return {
    sql: `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${marks(cols.length)})`,
    args: cols.map((c) => row[c]) as never[],
  };
}

async function main() {
  // ---- Load the backup into a scratch file and read the rows from there.
  const dir = await mkdtemp(path.join(tmpdir(), "z-restore-"));
  const scratch = createClient({ url: `file:${path.join(dir, "backup.db").replace(/\\/g, "/")}` });
  const prod = createClient({ url: url as string, authToken: process.env.TURSO_AUTH_TOKEN });

  try {
    await scratch.executeMultiple(await readFile(backupFile as string, "utf-8"));

    const items = await rows(scratch, `SELECT * FROM "Item" WHERE name LIKE '%z remove%'`);
    if (!items.length) throw new Error("The backup contains no Z Remove items. Wrong backup file?");
    const ids = items.map((i) => i.id);
    const inIds = marks(ids.length);

    const packStock = await rows(scratch, `SELECT * FROM "PackStock" WHERE itemId IN (${inIds})`, ids);
    const openPacks = await rows(scratch, `SELECT * FROM "OpenPack" WHERE itemId IN (${inIds})`, ids);
    const txs = await rows(scratch, `SELECT * FROM "Transaction" WHERE itemId IN (${inIds}) ORDER BY createdAt`, ids);
    const slots = await rows(scratch, `SELECT id, tagCode, itemId FROM "ShelfSlot" WHERE itemId IN (${inIds})`, ids);
    const defects = await rows(scratch, `SELECT id FROM "DefectiveItem" WHERE itemId IN (${inIds})`, ids);
    const pickups = await rows(scratch, `SELECT id FROM "SitePickup" WHERE itemId IN (${inIds})`, ids);

    console.log(`\nIn the backup, for the Z Remove items:`);
    console.log(`  items ${items.length}   packStock ${packStock.length}   openPacks ${openPacks.length}   ledger rows ${txs.length}   shelf boxes ${slots.length}`);
    for (const i of items) console.log(`    ${i.name}  [${i.sku}]  stock ${i.currentStock}`);
    if (defects.length || pickups.length) {
      throw new Error(`Backup has ${defects.length} defect(s) and ${pickups.length} pickup(s) on these items; this script does not restore those.`);
    }
    // A restored ledger row that is itself a reversal, or is reversed, must have
    // its partner in the set, or the unique reversesId link would dangle.
    const txIds = new Set(txs.map((t) => t.id));
    for (const t of txs) {
      if (t.reversesId && !txIds.has(t.reversesId)) throw new Error(`Ledger row ${t.id} reverses a row outside the restore set.`);
    }

    // ---- Preconditions on production.
    const problems: string[] = [];
    const taken = await rows(prod, `SELECT id, sku FROM "Item" WHERE id IN (${inIds}) OR sku IN (${marks(items.length)})`, [...ids, ...items.map((i) => i.sku)]);
    for (const t of taken) problems.push(`An item with id ${t.id} / sku ${t.sku} already exists in production.`);

    if (txs.length) {
      const txTaken = await rows(prod, `SELECT id FROM "Transaction" WHERE id IN (${marks(txs.length)})`, txs.map((t) => t.id));
      for (const t of txTaken) problems.push(`Ledger row ${t.id} already exists in production.`);
      for (const [table, col] of [["Dispatch", "dispatchId"], ["Delivery", "deliveryId"], ["Transfer", "transferId"], ["Site", "siteId"], ["Site", "fromSiteId"], ["User", "userId"]] as const) {
        const wanted = [...new Set(txs.map((t) => t[col]).filter(Boolean))] as string[];
        if (!wanted.length) continue;
        const found = new Set((await rows(prod, `SELECT id FROM "${table}" WHERE id IN (${marks(wanted.length)})`, wanted)).map((r) => r.id));
        for (const w of wanted) if (!found.has(w)) problems.push(`${table} ${w} (referenced by ${col}) no longer exists in production.`);
      }
    }
    for (const s of slots) {
      const [now] = await rows(prod, `SELECT id, itemId FROM "ShelfSlot" WHERE id = ?`, [s.id]);
      if (!now) problems.push(`Shelf box ${s.tagCode} (${s.id}) no longer exists.`);
      else if (now.itemId !== null) problems.push(`Shelf box ${s.tagCode} has since been given to item ${now.itemId}.`);
    }
    const packSlots = [...new Set(openPacks.map((o) => o.shelfSlotId).filter(Boolean))] as string[];
    if (packSlots.length) {
      const found = new Set((await rows(prod, `SELECT id FROM "ShelfSlot" WHERE id IN (${marks(packSlots.length)})`, packSlots)).map((r) => r.id));
      for (const p of packSlots) if (!found.has(p)) problems.push(`Shelf box ${p} (used by an open pack) no longer exists.`);
    }

    if (problems.length) {
      console.error("\nWOULD REFUSE -- nothing written:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }
    if (!apply) {
      console.log("\nReport only. Re-run with --yes-apply <fragment> to restore these rows.");
      return;
    }

    // ---- One atomic batch: parents first (Item), then rows that point at it.
    const stmts: InStatement[] = [
      ...items.map((r) => insert("Item", r)),
      ...packStock.map((r) => insert("PackStock", r)),
      ...openPacks.map((r) => insert("OpenPack", r)),
      ...txs.map((r) => insert("Transaction", r)),
      ...slots.map((s): InStatement => ({ sql: `UPDATE "ShelfSlot" SET itemId = ? WHERE id = ? AND itemId IS NULL`, args: [s.itemId, s.id] as never[] })),
    ];
    await prod.batch(stmts, "write");
    console.log(`\nApplied ${stmts.length} statements in one batch.`);

    // ---- Independent re-read: every restored row must equal the backup's.
    const bad: string[] = [];
    const same = (a: Row, b: Row) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
    for (const [table, want] of [["Item", items], ["PackStock", packStock], ["OpenPack", openPacks], ["Transaction", txs]] as const) {
      for (const w of want) {
        const [got] = await rows(prod, `SELECT * FROM "${table}" WHERE id = ?`, [w.id]);
        if (!got || !same(got, w)) bad.push(`${table} ${w.id} differs from the backup or is missing`);
      }
    }
    for (const s of slots) {
      const [got] = await rows(prod, `SELECT itemId FROM "ShelfSlot" WHERE id = ?`, [s.id]);
      if (got?.itemId !== s.itemId) bad.push(`ShelfSlot ${s.tagCode} not reassigned`);
    }
    const [adj] = await rows(prod, `SELECT COUNT(*) AS n FROM "Transaction" t JOIN "User" u ON u.id = t.userId WHERE t.type = 'ADJUSTMENT' AND u.name = 'Admin'`);
    console.log(
      `\n${bad.length ? "VERIFICATION FAILED" : "VERIFIED"}: restored ${items.length} item(s), ${packStock.length} packStock, ${openPacks.length} open pack(s), ` +
        `${txs.length} ledger row(s), ${slots.length} shelf box(es).\n  Admin adjustments in production (must stay 0): ${adj.n}`,
    );
    for (const b of bad) console.error(`  - ${b}`);
    if (bad.length || Number(adj.n) !== 0) process.exitCode = 1;
  } finally {
    scratch.close();
    prod.close();
    await rm(dir, { recursive: true, force: true }).catch(() => {}); // Windows may still hold the scratch file; harmless
  }
}

main().catch((error) => {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
