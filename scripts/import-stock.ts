/* Run with `npx tsx scripts/import-stock.ts --yes-import <fragment>`.
 *
 * Loads the opening stock catalogue from scripts/stock-import.json — the
 * client's "Current Stock — Pack Structure v3" sheet, resolved into the app's
 * pack model. Written for the 2026-09 reload after the data reset.
 *
 * NO LEDGER ROWS ARE WRITTEN. The client asked for these items to exist "as if
 * they were always there", so there is no Delivery and no STOCK_IN Transaction
 * behind them. That is a deliberate one-off: every movement from here on is
 * recorded normally, but the opening balance itself has no paper trail, because
 * there was none to import.
 *
 * WHY THE STOCK IS NOT JUST WRITTEN TO Item.currentStock. That column is a
 * CACHE — PackStock and OpenPack are the truth, and recalcItemStock() is the
 * only thing allowed to write it (see the header in packs.ts). Setting it
 * directly would look correct until the first dispatch, at which point
 * recalcItemStock would recompute it from empty pack tables and every quantity
 * would drop to zero. So this creates the packs and lets the cache be derived.
 *
 * The URL guard is the same one reset-data.ts carries, for the same reason:
 * prisma.config.ts loads `.env` only, so an unguarded script here defaults to
 * the live pilot.
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
  category: string;
  measure: "DISCRETE" | "CONTINUOUS";
  baseUnit: string;
  packUnit: string | null;
  sealed: { packSize: number; count: number }[];
  /** One entry per physical piece — offcuts are individual objects, not a sum. */
  loose: number[];
  shelfHint: string | null;
  mergedFrom: number[];
  expectedTotal: number;
};

const url = resolveDatabaseUrl();
const args = process.argv.slice(2);
const flagIndex = args.indexOf("--yes-import");
const fragment = flagIndex === -1 ? null : args[flagIndex + 1];

console.log(`Target database: ${url}`);

if (!fragment || !url.includes(fragment)) {
  console.error(
    !fragment
      ? '\nRefusing to run. Pass --yes-import <fragment>, a distinctive part of\n' +
          'the URL above (e.g. "dev.db" or "cosmosorigin"). This is the\n' +
          'confirmation that you know which database you are loading into.'
      : `\nRefusing to run. You confirmed "${fragment}", but DATABASE_URL is\n` +
          `"${url}", which does not contain it. Nothing was written.`,
  );
  process.exit(1);
}

const file = path.join(process.cwd(), "scripts", "stock-import.json");
const items: ImportItem[] = JSON.parse(readFileSync(file, "utf-8"));

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Refuse rather than merge. Running this twice would add a second set of
  // packs to every item and silently double the opening stock — and "the
  // numbers are all doubled" is a far harder thing to notice than "it did not
  // run". Clear the catalogue first if a reload is really wanted.
  const existing = await prisma.item.findMany({
    where: { sku: { in: items.map((i) => i.sku) } },
    select: { sku: true },
  });
  if (existing.length) {
    console.error(
      `\nRefusing to run: ${existing.length} of these SKUs already exist ` +
        `(e.g. ${existing.slice(0, 3).map((e) => e.sku).join(", ")}).\n` +
        "Importing again would double their stock. Nothing was written.",
    );
    process.exit(1);
  }

  const created: { sku: string; total: number; unit: string }[] = [];

  await prisma.$transaction(
    async (tx) => {
      for (const row of items) {
        const item = await tx.item.create({
          data: {
            name: row.name,
            sku: row.sku,
            category: row.category || null,
            baseUnit: row.baseUnit,
            packUnit: row.packUnit,
            measure: row.measure,
            // No reorder points in the source sheet, and inventing them would
            // fill the dashboard with alerts nobody chose. Set them in the app.
            minStock: 0,
            // Null, so addOpenPack cannot decide a short offcut is scrap during
            // an import. Whether a 26 cm pipe end is worth keeping is the
            // client's call, made per item, not this script's.
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
        // The cache is what the app renders, so it is what gets checked —
        // agreeing with the sheet in this script's own arithmetic proves
        // nothing about what a user will see.
        if (fresh.currentStock !== row.expectedTotal) {
          throw new Error(
            `${row.sku}: expected ${row.expectedTotal} ${row.baseUnit}, ` +
              `derived ${fresh.currentStock}`,
          );
        }
        created.push({ sku: row.sku, total: fresh.currentStock, unit: row.baseUnit });
      }
    },
    // 103 items, each several round trips. The 5s default is nowhere near
    // enough against a remote database.
    { timeout: 180_000, maxWait: 30_000 },
  );

  console.log(`\nCreated ${created.length} items.`);
  const byUnit = new Map<string, number>();
  for (const c of created) byUnit.set(c.unit, (byUnit.get(c.unit) ?? 0) + 1);
  for (const [unit, n] of [...byUnit].sort()) console.log(`  ${String(n).padStart(4)}  in ${unit}`);
  console.log(`  ${created.filter((c) => c.total === 0).length} at zero stock`);
}

main()
  .catch((error) => {
    console.error("\nImport failed:", error instanceof Error ? error.message : error);
    console.error("Nothing was written — the whole import is one transaction.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
