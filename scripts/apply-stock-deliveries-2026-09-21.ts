/* Run with `npx tsx scripts/apply-stock-deliveries-2026-09-21.ts --yes-apply <fragment>`.
 *
 * Applies the three delivery/stock-count lists the client gave in chat on
 * 2026-09-21 (after the earlier catalogue replace and the recount
 * corrections applied the same day). Unlike those two, this is additive:
 * every existing item below gets a new loose OpenPack for the DELTA amount
 * (on top of whatever packs it already has), not a reset to an absolute
 * total -- these lists describe stock arriving/being counted in on top of
 * what's already on the shelf, not a fresh count of the whole item.
 *
 * Three renames are bundled in (the client identified these as the same
 * physical item under a different name while reviewing the lists):
 *   Threaded Screw            -> GI Screw              (+100)
 *   Metal Flat Screw          -> GI Flat Screw         (+0)
 *   Flexible Pipe - 20mm - Black -> Flexible Pipe - 25mm - Black (+300 cm)
 *
 * No ledger rows are written, same as every other 2026-09 load script --
 * this corrects/tops-up the opening balance, it isn't a recorded movement.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
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

type Rename = { oldName: string; newName: string; delta: number };
const RENAMES: Rename[] = [
  { oldName: "Threaded Screw", newName: "GI Screw", delta: 100 },
  { oldName: "Metal Flat Screw", newName: "GI Flat Screw", delta: 0 },
  { oldName: "Flexible Pipe - 20mm - Black", newName: "Flexible Pipe - 25mm - Black", delta: 300 },
];

const ADDS: Record<string, number> = {
  "Jointer - Walkway": 6,
  "Deye String Inverter 10 KW": 2,
  "DC Cable - 1 Core x 4 sqmm - Red": 50,
  "DC Cable - 1 Core x 4 sqmm - Black": 50,
  "SS Bolt M6X25mm (panel Earting)": 40,
  "SS Nut M6 (panel Earting)": 40,
  "SS Washer 6mm (panel Earthing)": 80,
  "DCDB 1 in 1 out": 1,
  "Cable Gland - PG20": 2,
  "Metal Saddle": 15,
  "Earthing Cable - 1 Core-6 sqmm -Cu- Green": 30,
  "Earthing Cable - 1 Core-10 sqmm - Cu-Green": 225, // 25 (list1) + 100 + 100 (list2)
  "AC Cable - 4 Core x 4 sqmm - Black": 20,
  "RPVC Bend Pipe 25mm": 32, // 20 (list1) + 12 (list2)
  "Tee Pipe": 11, // 6 (list1) + 5 (list2)
  "MC4 Connector": 10,
  "MC4 pair pin": 10,
  "Cable Tie - Nylon 300mm - White": 100,
  "RPVC -Elbow Pipe-white": 15,
  "Rawal Plug - Large(35mm)": 50,
  "ACDB- 3PH- 5-15KW": 1,
  "Self-tapping Screw - 40x5mm": 36,
  "Dummy Piece": 3,
  "Earthing Connector": 1,
  "Double Nail clamp": 50,
  "Cable Tie - Metal- 300mm": 100,
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
  { name: "Meter Box - Three Phase", qty: 1, baseUnit: "pcs", packUnit: null, measure: "DISCRETE", category: "Equipment" },
  { name: "PVC Cable Tray 45x45mm", qty: 2, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
  { name: "LA Support", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Fixing" },
  { name: "Insulation Tape - Red", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
  { name: "Insulation Tape - Yellow", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
  { name: "Insulation Tape - Blue", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
  { name: "Insulation Tape - Black", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
  { name: "Insulation Tape - Green", qty: 1, baseUnit: "pcs", packUnit: "packet", measure: "DISCRETE", category: "Material" },
];

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  const report: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      // --- RENAMES (+ optional delta) --------------------------------------
      for (const r of RENAMES) {
        const item = await tx.item.findFirst({ where: { name: r.oldName } });
        if (!item) throw new Error(`RENAME: source item not found: "${r.oldName}"`);
        const newSku = skuify(r.newName);
        await tx.item.update({ where: { id: item.id }, data: { name: r.newName, sku: newSku } });
        if (r.delta > 0) {
          await addOpenPack(tx, item, r.delta);
          await recalcItemStock(tx, item.id);
        }
        const fresh = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
        report.push(`RENAME  "${r.oldName}" -> "${fresh.name}" [${fresh.sku}] +${r.delta} -> stock=${fresh.currentStock}`);
      }

      // --- ADDS ---------------------------------------------------------
      for (const [name, delta] of Object.entries(ADDS)) {
        const item = await tx.item.findFirst({ where: { name } });
        if (!item) throw new Error(`ADD: item not found: "${name}"`);
        await addOpenPack(tx, item, delta);
        await recalcItemStock(tx, item.id);
        const fresh = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
        report.push(`ADD     "${name}" +${delta} -> stock=${fresh.currentStock}`);
      }

      // --- NEW ITEMS ------------------------------------------------------
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
  console.log(`\nDone: ${RENAMES.length} renamed, ${Object.keys(ADDS).length} topped up, ${NEW_ITEMS.length} new.`);
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
