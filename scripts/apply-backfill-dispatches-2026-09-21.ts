/* Run with `npx tsx scripts/apply-backfill-dispatches-2026-09-21.ts --yes-apply <fragment>`.
 *
 * Backfills the first-ever ledger entries in this database: the client
 * confirmed on 2026-09-21 that the three "delivery lists" processed earlier
 * that day (which only topped up Item stock, no ledger rows) were actually
 * material that went straight back out to specific project sites. This
 * records that as real Dispatch batches / ISSUE transactions, dated to when
 * the client says it actually happened, using the same commitAllocation()
 * path the live dispatch UI uses -- so this reads on every site/item page
 * exactly like a dispatch entered through the app would.
 *
 * Deye String Inverter 10 KW is handled separately from the other two
 * batches: per the client (2026-09-21), one physical unit was installed at
 * Premnath, found faulty on site, and returned to the office; a second
 * (fresh) unit was then sent to replace it. The two stock-list additions
 * made earlier that day (+1 in list 1, +1 in "list 3") are corrected here:
 * one is pulled back out (it was never really new incoming stock -- it was
 * the returned faulty unit) and quarantined as a DefectiveItem; the other is
 * dispatched to Premnath as the replacement, same as an ordinary line.
 *
 * NOT modelled: a formal RETURN transaction for the faulty unit coming back
 * from Premnath. That would need the ORIGINAL install's dispatch date, which
 * isn't in any of the three lists or in what the client described, and
 * inventing one would misstate history rather than correct it. The
 * DefectiveItem row itself still carries source=RETURN and siteId=Premnath,
 * so the quarantine list correctly shows where it came from -- it just isn't
 * wired to a Transaction the way the live "return with defect" flow would.
 *
 * Same production guard as every other 2026-09 script.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl.ts";
import { commitAllocation, recalcItemStock, type ApprovedOpens } from "../src/lib/packs.ts";
import { nextChallanNo } from "../src/lib/challan.ts";
import { reconcileSitePickups } from "../src/lib/sitePickups.ts";
import { serialiseAppliedPlan } from "../src/lib/corrections.ts";
import type { AllocationRequest } from "../src/lib/allocation.ts";

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

const USER_NAME = "Durgesh Nandkumar Pawar"; // attribution, confirmed by client 2026-09-21

type Batch = {
  siteName: string;
  dateISO: string; // yyyy-mm-dd, client-given
  note: string;
  lines: { itemName: string; qty: number }[];
};

const YUVRAJ: Batch = {
  siteName: "Yuvraj Tamboskar",
  dateISO: "2026-09-12",
  note: "Backfilled 2026-09-21: list 1 material dispatched to site.",
  lines: [
    { itemName: "Jointer - Walkway", qty: 6 },
    { itemName: "DC Cable - 1 Core x 4 sqmm - Red", qty: 50 },
    { itemName: "DC Cable - 1 Core x 4 sqmm - Black", qty: 50 },
    { itemName: "SS Bolt M6X25mm (panel Earting)", qty: 40 },
    { itemName: "SS Nut M6 (panel Earting)", qty: 40 },
    { itemName: "SS Washer 6mm (panel Earthing)", qty: 80 },
    { itemName: "DCDB 1 in 1 out", qty: 1 },
    { itemName: "Cable Gland - PG20", qty: 2 },
    { itemName: "Metal Saddle", qty: 15 },
    { itemName: "Earthing Cable - 1 Core-6 sqmm -Cu- Green", qty: 30 },
    { itemName: "Earthing Cable - 1 Core-10 sqmm - Cu-Green", qty: 25 },
    { itemName: "AC Cable - 4 Core x 4 sqmm - Black", qty: 20 },
    { itemName: "RPVC Bend Pipe 25mm", qty: 20 },
    { itemName: "Tee Pipe", qty: 6 },
    { itemName: "MC4 Connector", qty: 10 },
    { itemName: "MC4 pair pin", qty: 10 },
    { itemName: "Cable Tie - Nylon 300mm - White", qty: 100 },
    { itemName: "RPVC -Elbow Pipe-white", qty: 15 },
    { itemName: "Rawal Plug - Large(35mm)", qty: 50 },
    { itemName: "ACDB- 3PH- 5-15KW", qty: 1 },
    { itemName: "Self-tapping Screw - 40x5mm", qty: 36 },
    { itemName: "Dummy Piece", qty: 3 },
    { itemName: "Earthing Connector", qty: 1 },
    { itemName: "Double Nail clamp", qty: 50 },
    { itemName: "Cable Tie - Metal- 300mm", qty: 100 },
    { itemName: "GI Screw", qty: 100 },
    { itemName: "Flexible Pipe - 25mm - Black", qty: 300 },
    { itemName: "Meter Box - Three Phase", qty: 1 },
    { itemName: "PVC Cable Tray 45x45mm", qty: 2 },
    { itemName: "LA Support", qty: 1 },
    { itemName: "Insulation Tape - Red", qty: 1 },
    { itemName: "Insulation Tape - Yellow", qty: 1 },
    { itemName: "Insulation Tape - Blue", qty: 1 },
    { itemName: "Insulation Tape - Black", qty: 1 },
    { itemName: "Insulation Tape - Green", qty: 1 },
  ],
};

const JOSHUA: Batch = {
  siteName: "Joshua Desouza",
  dateISO: "2026-09-11",
  note: "Backfilled 2026-09-21: list 2 material dispatched to site.",
  lines: [
    { itemName: "Earthing Cable - 1 Core-10 sqmm - Cu-Green", qty: 200 },
    { itemName: "RPVC Bend Pipe 25mm", qty: 12 },
    { itemName: "Tee Pipe", qty: 5 },
  ],
};

const PREMNATH: Batch = {
  siteName: "Premnath",
  dateISO: "2026-09-10",
  note: "Backfilled 2026-09-21: replacement inverter for the one returned faulty.",
  lines: [{ itemName: "Deye String Inverter 10 KW", qty: 1 }],
};

// Chronological order so challan numbers stay in date order even though all
// three are being entered today.
const BATCHES = [PREMNATH, JOSHUA, YUVRAJ];

function dateAt(iso: string): Date {
  return new Date(`${iso}T06:00:00.000Z`);
}

function requestFor(qty: number): AllocationRequest {
  return { sealedPacks: [], pieces: [], loose: qty };
}

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  const report: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findFirstOrThrow({ where: { name: USER_NAME } });
      const approvedOpens: ApprovedOpens = [];

      // --- Deye 10 KW correction: pull the phantom "returned faulty" unit
      // back out of good stock, before it's counted in any dispatch. -------
      const deye = await tx.item.findFirstOrThrow({ where: { name: "Deye String Inverter 10 KW" } });
      const deyeOpen = await tx.openPack.findFirstOrThrow({ where: { itemId: deye.id, state: "OPEN" } });
      if (deyeOpen.remaining < 1) throw new Error("Deye 10KW: not enough open stock to correct");
      await tx.openPack.update({ where: { id: deyeOpen.id }, data: { remaining: { decrement: 1 } } });
      await recalcItemStock(tx, deye.id);
      const premnathSite = await tx.site.findFirstOrThrow({ where: { name: "Premnath" } });
      const defect = await tx.defectiveItem.create({
        data: {
          itemId: deye.id,
          quantity: 1,
          source: "RETURN",
          siteId: premnathSite.id,
          userId: user.id,
          reportedAt: dateAt("2026-09-10"),
          note:
            "Installed at Premnath, found faulty on site, returned to office. " +
            "Backfilled 2026-09-21; no linked Transaction because the original " +
            "install date isn't on record.",
        },
      });
      report.push(
        `DEFECT  Deye String Inverter 10 KW x1 quarantined (source=RETURN, site=Premnath) [${defect.id}]`,
      );

      // --- The three dispatch batches ---------------------------------------
      for (const batch of BATCHES) {
        const site = await tx.site.findFirstOrThrow({ where: { name: batch.siteName } });
        const challanNo = await nextChallanNo(tx);
        const dispatch = await tx.dispatch.create({
          data: {
            challanNo,
            siteId: site.id,
            note: batch.note,
            userId: user.id,
            dispatchedAt: dateAt(batch.dateISO),
          },
        });
        report.push(`DISPATCH SCE/DC/${String(challanNo).padStart(4, "0")} -> ${batch.siteName} (${batch.dateISO})`);

        for (const line of batch.lines) {
          const item = await tx.item.findFirstOrThrow({ where: { name: line.itemName } });
          const request = requestFor(line.qty);

          const movement = await tx.transaction.create({
            data: {
              type: "ISSUE",
              quantity: line.qty,
              itemId: item.id,
              siteId: site.id,
              dispatchId: dispatch.id,
              userId: user.id,
              note: batch.note,
              createdAt: dateAt(batch.dateISO),
            },
          });

          const { applied } = await commitAllocation(tx, item, request, approvedOpens, user.id);
          await tx.transaction.update({
            where: { id: movement.id },
            data: { appliedPlan: serialiseAppliedPlan(applied) },
          });
          await reconcileSitePickups(tx, site.id, item.id);

          const fresh = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
          report.push(`  ISSUE  ${line.itemName} -${line.qty} -> stock=${fresh.currentStock}`);
        }
      }
    },
    { timeout: 180_000, maxWait: 30_000 },
  );

  console.log("\n" + report.join("\n"));
  console.log("\nDone.");
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
