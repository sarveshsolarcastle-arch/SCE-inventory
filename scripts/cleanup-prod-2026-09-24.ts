/* Run with:
 *   npx tsx scripts/cleanup-prod-2026-09-24.ts                       # report only
 *   npx tsx scripts/cleanup-prod-2026-09-24.ts --yes-apply cosmosorigin
 *
 * Two clean-ups the client asked for before handover:
 *
 *   1. Every item named "Z Remove" -- added by mistake -- is removed from the
 *      registered-items list, together with everything hanging off it.
 *   2. Every ADJUSTMENT written by the user named "Admin" -- the dev team's
 *      own corrections -- is erased from the official record.
 *
 * DEFAULT IS A REPORT. Nothing is written without --yes-apply <fragment>, and
 * the fragment must appear in the target URL (same guard as the other 2026-09
 * scripts). Applying takes a full dump through dumpDatabase() first, so there
 * is a known-good copy from seconds earlier.
 *
 * NO SILENT FAILURE. The write is one transaction that checks its own result
 * and THROWS -- rolling everything back -- if any of these is false: the row
 * counts deleted match the plan; no "Z Remove" item and no Admin ADJUSTMENT
 * remains; item and transaction totals fell by exactly the planned amount; no
 * other item's currentStock/scrapStock moved; no transaction points at a
 * missing item. After commit it re-reads the database independently and prints
 * VERIFIED or VERIFICATION FAILED (exit code 1).
 *
 * WHAT DELETING AN ADJUSTMENT DOES AND DOES NOT DO. Stock truth is PackStock +
 * OpenPack; Item.currentStock is a cache of it. An ADJUSTMENT row is the audit
 * trail of a correction already applied to the packs, so erasing the row
 * removes the record but does NOT undo the correction: the shelf keeps whatever
 * the adjustment left it holding.
 *
 * REVERSALS. A REVERSAL points at the movement it undoes (reversesId, unique),
 * so a reversed adjustment's reversal is deleted with it.
 *
 * Z REMOVE ITEMS. Their ledger rows (e.g. lines on a dispatch), packs, defects
 * and pickups are deleted with them and their shelf boxes are unassigned. The
 * report names every dispatch/delivery/transfer that loses lines and how many
 * remain. Refused (nothing written): a document left with NO lines, or a
 * DefectiveItem tied to an affected transaction on some other item.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl.ts";
import { dumpDatabase } from "../src/lib/backup/dump.ts";

const url = resolveDatabaseUrl();
const args = process.argv.slice(2);
const flagIndex = args.indexOf("--yes-apply");
const apply = flagIndex !== -1;
const fragment = apply ? args[flagIndex + 1] : null;

console.log(`Target database: ${url}`);
console.log(apply ? "Mode: APPLY" : "Mode: report only (nothing will be written)");
if (apply && (!fragment || !url.includes(fragment))) {
  console.error(
    !fragment
      ? '\nRefusing to run. Pass --yes-apply <fragment> (e.g. "cosmosorigin").'
      : `\nRefusing to run. "${fragment}" does not appear in "${url}". Nothing was touched.`,
  );
  process.exit(1);
}

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ---- Who is "Admin"? Exact name match, case-sensitive: "Anshul" is an ADMIN
  // by role but is a real person and is deliberately NOT swept up.
  const admins = await prisma.user.findMany({ where: { name: "Admin" }, select: { id: true, name: true, email: true, role: true } });
  console.log(`\nUsers named "Admin": ${admins.length}`);
  for (const u of admins) console.log(`  ${u.email}  (${u.role})`);
  const adminIds = admins.map((u) => u.id);

  // ---- Adjustments to erase, and the reversals that must go with them.
  const adjustments = await prisma.transaction.findMany({
    where: { type: "ADJUSTMENT", userId: { in: adminIds } },
    select: { id: true, itemId: true, quantity: true, createdAt: true, item: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const adjustmentIds = adjustments.map((t) => t.id);
  const reversals = adjustmentIds.length
    ? await prisma.transaction.findMany({
        where: { type: "REVERSAL", reversesId: { in: adjustmentIds } },
        select: { id: true, userId: true, user: { select: { name: true } } },
      })
    : [];
  const doomedTxIds = [...adjustmentIds, ...reversals.map((r) => r.id)];

  console.log(`\nADJUSTMENT rows by "Admin": ${adjustments.length}`);
  for (const t of adjustments) console.log(`  ${t.createdAt.toISOString().slice(0, 16)}  ${t.item.name}  qty ${t.quantity}`);
  console.log(`Reversals of those adjustments (deleted with them): ${reversals.length}`);
  for (const r of reversals) console.log(`  ${r.id}  by ${r.user.name}`);

  const otherAdjusters = await prisma.transaction.count({
    where: { type: "ADJUSTMENT", userId: { notIn: adminIds } },
  });
  console.log(`ADJUSTMENT rows by anyone else (kept): ${otherAdjusters}`);

  // ---- "Z Remove" items, matched case-insensitively anywhere in the name
  // (SQLite LIKE), so "Z REMOVE", "z remove" and "Z Remove - old" all count.
  const zItems = await prisma.item.findMany({
    where: { name: { contains: "Z Remove" } },
    select: { id: true, name: true, sku: true, currentStock: true },
  });
  const zIds = zItems.map((i) => i.id);
  console.log(`\nItems named "Z Remove": ${zItems.length}`);

  // Every ledger row on those items goes with them. A reversal always shares
  // its target's item, so item-scoped selection already covers reversals.
  const zTx = zIds.length
    ? await prisma.transaction.findMany({
        where: { itemId: { in: zIds } },
        select: { id: true, type: true, dispatchId: true, deliveryId: true, transferId: true, item: { select: { sku: true } } },
      })
    : [];
  const doomedTx = new Set([...doomedTxIds, ...zTx.map((t) => t.id)]);

  const [defectsOnZ, pickupsOnZ] = zIds.length
    ? await Promise.all([
        prisma.defectiveItem.count({ where: { itemId: { in: zIds } } }),
        prisma.sitePickup.count({ where: { itemId: { in: zIds } } }),
      ])
    : [0, 0];

  for (const item of zItems) {
    const rows = zTx.filter((t) => t.item.sku === item.sku);
    console.log(`  ${item.name}  [${item.sku}]  stock ${item.currentStock}  ledger rows ${rows.length} (${rows.map((r) => r.type).join(",") || "none"})`);
  }
  console.log(`Ledger rows on Z items (deleted with them): ${zTx.length}   defects: ${defectsOnZ}   pickups: ${pickupsOnZ}`);

  const problems: string[] = [];
  const blockingDefects = doomedTxIds.length
    ? await prisma.defectiveItem.count({ where: { transactionId: { in: doomedTxIds } } })
    : 0;
  if (blockingDefects) problems.push(`${blockingDefects} DefectiveItem row(s) reference an affected transaction.`);

  // Documents that lose lines. A challan is a document people hold, so say
  // exactly how many lines it loses; one left with NO lines is refused.
  for (const [kind, field] of [["Dispatch", "dispatchId"], ["Delivery", "deliveryId"], ["Transfer", "transferId"]] as const) {
    const lost = new Map<string, number>();
    for (const t of zTx) {
      const id = t[field];
      if (id) lost.set(id, (lost.get(id) ?? 0) + 1);
    }
    for (const [id, n] of lost) {
      const remaining = await prisma.transaction.count({ where: { [field]: id, id: { notIn: [...doomedTx] } } });
      console.log(`  ${kind} ${id}: loses ${n} line(s), ${remaining} remain`);
      if (remaining === 0) problems.push(`${kind} ${id} would be left with no lines.`);
    }
  }

  if (problems.length) {
    console.error("\nWOULD REFUSE -- nothing written:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  if (!apply) {
    console.log("\nReport only. Re-run with --yes-apply <fragment> to make these changes.");
    return;
  }

  // ---- Backup, snapshot, then one transaction that PROVES its own result.
  const { sql, rowCounts } = await dumpDatabase();
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `pre-cleanup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
  await writeFile(file, sql, "utf-8");
  console.log(`\nBackup written: ${file}  (${Object.values(rowCounts).reduce((a, b) => a + b, 0)} rows)`);

  const snapshot = async (c: Pick<PrismaClient, "item" | "transaction">) => {
    const items = await c.item.findMany({ where: { id: { notIn: zIds } }, select: { id: true, currentStock: true, scrapStock: true } });
    return { items, itemTotal: await c.item.count(), txTotal: await c.transaction.count() };
  };
  const before = await snapshot(prisma);

  // "Fails silently" is the failure to design out, so every assertion THROWS,
  // and a throw inside $transaction rolls the whole thing back.
  const check = (ok: boolean, what: string) => {
    if (!ok) throw new Error(`Post-condition failed, rolling back: ${what}`);
  };

  await prisma.$transaction(
    async (tx) => {
      const txGone = await tx.transaction.deleteMany({ where: { id: { in: [...doomedTx] } } });
      check(txGone.count === doomedTx.size, `deleted ${txGone.count} transactions, expected ${doomedTx.size}`);

      await tx.defectiveItem.deleteMany({ where: { itemId: { in: zIds } } });
      await tx.sitePickup.deleteMany({ where: { itemId: { in: zIds } } });
      await tx.packStock.deleteMany({ where: { itemId: { in: zIds } } });
      await tx.openPack.deleteMany({ where: { itemId: { in: zIds } } });
      await tx.shelfSlot.updateMany({ where: { itemId: { in: zIds } }, data: { itemId: null } });
      const itemsGone = await tx.item.deleteMany({ where: { id: { in: zIds } } });
      check(itemsGone.count === zIds.length, `deleted ${itemsGone.count} items, expected ${zIds.length}`);

      check((await tx.item.count({ where: { name: { contains: "Z Remove" } } })) === 0, 'a "Z Remove" item still exists');
      check(
        (await tx.transaction.count({ where: { type: "ADJUSTMENT", userId: { in: adminIds } } })) === 0,
        'an "Admin" ADJUSTMENT still exists',
      );

      const after = await snapshot(tx);
      check(after.itemTotal === before.itemTotal - zIds.length, `item count ${after.itemTotal}, expected ${before.itemTotal - zIds.length}`);
      check(after.txTotal === before.txTotal - doomedTx.size, `transaction count ${after.txTotal}, expected ${before.txTotal - doomedTx.size}`);
      const was = new Map(before.items.map((i) => [i.id, i]));
      for (const i of after.items) {
        const b = was.get(i.id);
        check(!!b && b.currentStock === i.currentStock && b.scrapStock === i.scrapStock, `stock of item ${i.id} changed`);
      }
      const [orphan] = await tx.$queryRaw<{ c: number | bigint }[]>`SELECT COUNT(*) AS c FROM "Transaction" WHERE itemId NOT IN (SELECT id FROM "Item")`;
      check(Number(orphan.c) === 0, "a transaction points at a missing item");
    },
    { timeout: 120_000 },
  );

  // ---- Independent re-read after commit: trust the database, not our own tx.
  const final = await snapshot(prisma);
  const stillZ = await prisma.item.count({ where: { name: { contains: "Z Remove" } } });
  const stillAdj = await prisma.transaction.count({ where: { type: "ADJUSTMENT", userId: { in: adminIds } } });
  const ok =
    stillZ === 0 &&
    stillAdj === 0 &&
    final.txTotal === before.txTotal - doomedTx.size &&
    final.itemTotal === before.itemTotal - zIds.length;
  console.log(
    `\n${ok ? "VERIFIED" : "VERIFICATION FAILED"}: ${zIds.length} item(s) and ${doomedTx.size} transaction row(s) deleted ` +
      `(${adjustments.length} Admin adjustment(s), ${reversals.length} reversal(s), ${zTx.length} on Z items).\n` +
      `  Z Remove items left: ${stillZ}   Admin adjustments left: ${stillAdj}\n` +
      `  items ${before.itemTotal} -> ${final.itemTotal}   transactions ${before.txTotal} -> ${final.txTotal}`,
  );
  if (!ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
