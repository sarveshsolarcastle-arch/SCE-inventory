/* Run with `npx tsx scripts/replace-stock-2026-09.ts --yes-replace <fragment>`.
 *
 * REPLACES the entire catalogue and opening stock with
 * scripts/stock-import-2026-09.json (built from "newly updated (1).xlsx",
 * supplied 2026-09-19), superseding the load import-stock.ts did from the
 * earlier "Pack Structure v3" sheet.
 *
 * Unlike import-stock.ts, this DELETES every existing Item, PackStock and
 * OpenPack row first. That is safe on THIS run only because nothing else
 * references an Item yet: Transaction, Dispatch, Delivery, Transfer,
 * DefectiveItem, SitePickup and ShelfSlot are all at 0 rows on production as
 * of 2026-09-19 (verified read-only before writing this script). If that is
 * no longer true when this runs, the delete of Item will fail on a foreign
 * key rather than orphan anything -- Prisma's relations are not cascading
 * here (see schema.prisma), so a real ledger existing by the time this runs
 * is a reason to stop, not a reason to add `onDelete: Cascade`.
 *
 * NO LEDGER ROWS ARE WRITTEN for the new opening stock either, same as
 * import-stock.ts and for the same reason: there is no paper trail behind a
 * spreadsheet's numbers.
 *
 * Same production guard as import-stock.ts and reset-data.ts: prisma.config.ts
 * / a bare `dotenv/config` import loads `.env` only, which points at the
 * live Turso pilot, not `.env.local`'s dev.db.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl.ts";
import { addOpenPack, addPacks, recalcItemStock } from "../src/lib/packs.ts";

type ImportItem = {
  sku: string;
  name: string;
  category: string | null;
  measure: "DISCRETE" | "CONTINUOUS";
  baseUnit: string;
  packUnit: string | null;
  sealed: { packSize: number; count: number }[];
  loose: number[];
  mergedFrom: number[];
  expectedTotal: number;
};

const url = resolveDatabaseUrl();
const args = process.argv.slice(2);
const flagIndex = args.indexOf("--yes-replace");
const fragment = flagIndex === -1 ? null : args[flagIndex + 1];

console.log(`Target database: ${url}`);

if (!fragment || !url.includes(fragment)) {
  console.error(
    !fragment
      ? "\nRefusing to run. Pass --yes-replace <fragment>, a distinctive part of\n" +
          'the URL above (e.g. "dev.db" or "cosmosorigin"). This DELETES every\n' +
          "existing item and its stock before reloading, so this confirmation\n" +
          "matters more than the one on import-stock.ts."
      : `\nRefusing to run. You confirmed "${fragment}", but DATABASE_URL is\n` +
          `"${url}", which does not contain it. Nothing was touched.`,
  );
  process.exit(1);
}

const file = path.join(process.cwd(), "scripts", "stock-import-2026-09.json");
const items: ImportItem[] = JSON.parse(readFileSync(file, "utf-8"));

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  const guardCounts = await Promise.all([
    prisma.transaction.count(),
    prisma.dispatch.count(),
    prisma.delivery.count(),
    prisma.transfer.count(),
    prisma.defectiveItem.count(),
    prisma.sitePickup.count(),
    prisma.shelfSlot.count(),
  ]);
  const guardNames = [
    "Transaction",
    "Dispatch",
    "Delivery",
    "Transfer",
    "DefectiveItem",
    "SitePickup",
    "ShelfSlot",
  ];
  const nonZero = guardNames.filter((_, i) => guardCounts[i] > 0);
  if (nonZero.length) {
    console.error(
      `\nRefusing to run: ${nonZero.join(", ")} now have rows referencing items.\n` +
        "Deleting Item would fail on (or orphan) those. This script was only ever\n" +
        "safe for the empty-ledger state verified on 2026-09-19. Nothing was touched.",
    );
    process.exit(1);
  }

  const before = await prisma.item.count();
  const created: { sku: string; total: number; unit: string }[] = [];

  await prisma.$transaction(
    async (tx) => {
      await tx.openPack.deleteMany({});
      await tx.packStock.deleteMany({});
      await tx.item.deleteMany({});

      for (const row of items) {
        const item = await tx.item.create({
          data: {
            name: row.name,
            sku: row.sku,
            category: row.category,
            baseUnit: row.baseUnit,
            packUnit: row.packUnit,
            measure: row.measure,
            minStock: 0,
            scrapThreshold: null,
          },
        });

        for (const group of row.sealed) {
          await addPacks(tx, item.id, group.packSize, group.count);
        }
        for (const remaining of row.loose) {
          await addOpenPack(tx, item, remaining);
        }

        await recalcItemStock(tx, item.id);

        const fresh = await tx.item.findUniqueOrThrow({
          where: { id: item.id },
          select: { currentStock: true },
        });
        if (fresh.currentStock !== row.expectedTotal) {
          throw new Error(
            `${row.sku}: expected ${row.expectedTotal} ${row.baseUnit}, ` +
              `derived ${fresh.currentStock}`,
          );
        }
        created.push({ sku: row.sku, total: fresh.currentStock, unit: row.baseUnit });
      }
    },
    { timeout: 180_000, maxWait: 30_000 },
  );

  console.log(`\nDeleted ${before} old items and their packs.`);
  console.log(`Created ${created.length} new items.`);
  const byUnit = new Map<string, number>();
  for (const c of created) byUnit.set(c.unit, (byUnit.get(c.unit) ?? 0) + 1);
  for (const [unit, n] of [...byUnit].sort()) console.log(`  ${String(n).padStart(4)}  in ${unit}`);
  console.log(`  ${created.filter((c) => c.total === 0).length} at zero stock`);
}

main()
  .catch((error) => {
    console.error("\nReplace failed:", error instanceof Error ? error.message : error);
    console.error("Nothing was written -- the whole replace is one transaction.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
