/* Run with `npx tsx scripts/apply-stock-corrections-2026-09-21.ts --yes-apply <fragment>`.
 *
 * Applies the corrections the client gave in chat on 2026-09-21 after
 * reviewing "correct stock count .xlsx" against the catalogue
 * replace-stock-2026-09.ts loaded two days earlier:
 *
 *   RENAMES  -- same physical item, sheet uses a different name and/or the
 *               recount found a different quantity. Renames the existing
 *               Item (new name -> regenerated SKU) and, where a quantity was
 *               given, replaces its packs with a single new loose quantity.
 *   SPLIT    -- "Cable Tie - Nylon 300mm" (800 pcs, untracked by colour) is
 *               retired and replaced by two colour-specific items.
 *   NEW      -- items the recount found that don't exist in the catalogue at
 *               all (new Cable Gland sizes, Copper Ring Lug sizes, EPDM
 *               rubber, MC4 pair pin, Earthing chamber).
 *
 * Same production guard as the other 2026-09 scripts, and same "no ledger
 * rows" rule: this corrects the opening balance, it does not record a
 * movement, because none happened -- the count sheet says what was already
 * on the shelf, counted more carefully.
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl.ts";
import { addOpenPack, recalcItemStock } from "../src/lib/packs.ts";

const url = resolveDatabaseUrl();
const args = process.argv.slice(2);
const flagIndex = args.indexOf("--yes-apply");
const fragment = flagIndex === -1 ? null : args[flagIndex + 1];

console.log(`Target database: ${url}`);
if (!fragment || !url.includes(fragment)) {
  console.error(
    !fragment
      ? '\nRefusing to run. Pass --yes-apply <fragment> (e.g. "cosmosorigin").'
      : `\nRefusing to run. "${fragment}" does not appear in "${url}". Nothing was touched.`,
  );
  process.exit(1);
}

function skuify(name: string): string {
  const base = name.replace(/\s*\((?:new|old)\)\s*$/i, "");
  const cleaned = base.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
  const parts = cleaned.split("-").filter(Boolean);
  const out = parts.map((p) => (/^[A-Z]+$/.test(p) && p.length > 5 ? p.slice(0, 5) : p));
  return out.join("-").slice(0, 40);
}

type Rename = { oldName: string; newName: string; newQty?: number };
const RENAMES: Rename[] = [
  { oldName: "Bend Pipe", newName: "RPVC Bend Pipe 25mm", newQty: 237 },
  { oldName: "Elbow Pipe-Black", newName: "RPVC -Elbow Pipe-black" },
  { oldName: "Elbow Pipe-white", newName: "RPVC -Elbow Pipe-white", newQty: 17 },
  { oldName: "Channel Spring Nut", newName: "M6 Spring Nut" },
  { oldName: "Flange Nut - 5.5mm", newName: "Flange Nut - 5mm", newQty: 27 },
  { oldName: "Flange Nut - 7.5mm", newName: "Flange Nut - 7mm" }, // 67, unchanged
  { oldName: "Self-tapping Screw - 65x5.5mm", newName: "Self-tapping Screw - 65x5mm" },
  { oldName: "SS T Head Bolt for L Foot", newName: "SS T Head Bolt -40" },
  {
    oldName: "Stainless Steel Flat Washer - 22mm OD / 11mm ID",
    newName: "Stainless Steel Flat Washer - 20mm OD / 11mm ID",
    newQty: 20,
  },
  { oldName: "T-Nut - 40mm for rails", newName: "T-Nut - 40mm for rails", newQty: 70 },
  { oldName: "earthing rod -2m", newName: "Earthing rod cu 2mm", newQty: 6 },
  { oldName: "earthing rod-1m", newName: "Earthing rod cu 1m", newQty: 3 },
  { oldName: "End Clamp (40mm) for Rails", newName: "End Clamp (30mm) for Rails", newQty: 24 },
  { oldName: "End Clamp (50mm) for Rails", newName: "End Clamp (35mm) for Rails", newQty: 58 },
  { oldName: "Mid Clamp (50mm) for Rails", newName: "Mid Clamp (35mm) for Rails", newQty: 25 },
];

const SPLIT = {
  oldName: "Cable Tie - Nylon 300mm",
  newItems: [
    { name: "Cable Tie - Nylon 300mm - Black", qty: 250 },
    { name: "Cable Tie - Nylon 300mm - White", qty: 400 },
  ],
};

type NewItem = {
  name: string;
  qty: number;
  baseUnit: string;
  packUnit: string | null;
  measure: "DISCRETE" | "CONTINUOUS";
  category: string | null;
};
const NEW_ITEMS: NewItem[] = [
  { name: "Copper Ring Lug - 25-10 sqmm", qty: 3, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Copper Ring Lug - 35-8 sqmm", qty: 3, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Copper Ring Lug - 35-HEX", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Copper Ring Lug - 25-8 sqmm", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Cable Gland - 25mm - black", qty: 3, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Cable Gland - PG13.5", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Cable Gland - PG19", qty: 18, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Cable Gland - PG21", qty: 31, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Cable Gland - PG25", qty: 12, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Cable Gland - PG7", qty: 2, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Cable Gland - PG9", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "EPDM rubber", qty: 298, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
  { name: "MC4 pair pin", qty: 64, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Earthing chamber", qty: 6, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
];

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function setSingleOpenPackQty(tx: Prisma.TransactionClient, item: { id: string; measure: string; scrapThreshold: number | null }, qty: number) {
  await tx.openPack.deleteMany({ where: { itemId: item.id } });
  await tx.packStock.deleteMany({ where: { itemId: item.id } });
  if (qty > 0) await addOpenPack(tx, item, qty);
  await recalcItemStock(tx, item.id);
}

async function main() {
  const report: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      // --- RENAMES --------------------------------------------------------
      for (const r of RENAMES) {
        const item = await tx.item.findFirst({ where: { name: r.oldName } });
        if (!item) throw new Error(`RENAME: source item not found: "${r.oldName}"`);
        const newSku = skuify(r.newName);
        await tx.item.update({
          where: { id: item.id },
          data: { name: r.newName, sku: newSku },
        });
        if (r.newQty !== undefined) {
          await setSingleOpenPackQty(tx, item, r.newQty);
        }
        const fresh = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
        report.push(
          `RENAME  "${r.oldName}" -> "${fresh.name}" [${fresh.sku}] stock=${fresh.currentStock}${
            r.newQty === undefined ? " (unchanged)" : ""
          }`,
        );
      }

      // --- SPLIT ------------------------------------------------------------
      const splitSrc = await tx.item.findFirst({ where: { name: SPLIT.oldName } });
      if (!splitSrc) throw new Error(`SPLIT: source item not found: "${SPLIT.oldName}"`);
      await tx.openPack.deleteMany({ where: { itemId: splitSrc.id } });
      await tx.packStock.deleteMany({ where: { itemId: splitSrc.id } });
      await tx.item.delete({ where: { id: splitSrc.id } });
      report.push(`DELETE  "${SPLIT.oldName}" (split into ${SPLIT.newItems.length} items)`);
      for (const ni of SPLIT.newItems) {
        const created = await tx.item.create({
          data: {
            name: ni.name,
            sku: skuify(ni.name),
            category: splitSrc.category,
            baseUnit: splitSrc.baseUnit,
            packUnit: splitSrc.packUnit,
            measure: splitSrc.measure,
            minStock: 0,
            scrapThreshold: null,
          },
        });
        await addOpenPack(tx, created, ni.qty);
        await recalcItemStock(tx, created.id);
        const fresh = await tx.item.findUniqueOrThrow({ where: { id: created.id } });
        report.push(`CREATE  "${fresh.name}" [${fresh.sku}] stock=${fresh.currentStock}`);
      }

      // --- NEW ITEMS --------------------------------------------------------
      for (const ni of NEW_ITEMS) {
        const sku = skuify(ni.name);
        const existing = await tx.item.findUnique({ where: { sku } });
        if (existing) throw new Error(`NEW: sku collision for "${ni.name}" -> ${sku}`);
        const created = await tx.item.create({
          data: {
            name: ni.name,
            sku,
            category: ni.category,
            baseUnit: ni.baseUnit,
            packUnit: ni.packUnit,
            measure: ni.measure,
            minStock: 0,
            scrapThreshold: null,
          },
        });
        await addOpenPack(tx, created, ni.qty);
        await recalcItemStock(tx, created.id);
        const fresh = await tx.item.findUniqueOrThrow({ where: { id: created.id } });
        report.push(`CREATE  "${fresh.name}" [${fresh.sku}] stock=${fresh.currentStock}`);
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  console.log("\n" + report.join("\n"));
  console.log(`\nDone: ${RENAMES.length} renamed, 1 split into ${SPLIT.newItems.length}, ${NEW_ITEMS.length} new.`);
}

main()
  .catch((error) => {
    console.error("\nApply failed:", error instanceof Error ? error.message : error);
    console.error("Nothing was written -- the whole apply is one transaction.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
