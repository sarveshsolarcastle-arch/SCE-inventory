/* Run with `npx tsx scripts/fix-continuous-issues-2026-09-21.ts --yes-apply <fragment>`.
 *
 * Fixes a bug in apply-backfill-dispatches-2026-09-21.ts: every line for a
 * CONTINUOUS item (measured in m/cm) was built with `loose: qty` instead of
 * `pieces: [{length: qty, count: 1}]`. planAllocation's continuous path only
 * ever reads `request.pieces` (see planContinuous in allocation.ts) and
 * completely ignores `loose`, so commitAllocation ran with an effectively
 * empty request: no error, no pack touched, but the Transaction row had
 * already been created with the real quantity. Net effect: 7 ISSUE rows
 * exist with a non-zero quantity and a *completely empty* appliedPlan
 * ("sealedDelta":[],"created":[],"deleted":[],"changed":[]) -- confirmed
 * read-only against production before this script was written. Because
 * nothing was actually applied, these are safe to delete outright (no pack
 * state needs reversing) and redo correctly, keeping the same dispatch,
 * site, date, user and note.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl.ts";
import { commitAllocation, type ApprovedOpens } from "../src/lib/packs.ts";
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

const BROKEN_ITEM_NAMES = [
  "DC Cable - 1 Core x 4 sqmm - Red",
  "DC Cable - 1 Core x 4 sqmm - Black",
  "Earthing Cable - 1 Core-6 sqmm -Cu- Green",
  "Earthing Cable - 1 Core-10 sqmm - Cu-Green",
  "AC Cable - 4 Core x 4 sqmm - Black",
  "Flexible Pipe - 25mm - Black",
];

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  const report: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      const items = await tx.item.findMany({ where: { name: { in: BROKEN_ITEM_NAMES } } });

      for (const item of items) {
        // Ascending by (backdated) createdAt: Earthing Cable 10sqmm has two
        // broken rows (Joshua 11th, Yuvraj 12th) and must be re-cut in that
        // order so the 225 m delivery pack is consumed Joshua-first, exactly
        // as it would have been had the original run worked.
        const broken = await tx.transaction.findMany({
          where: { itemId: item.id, type: "ISSUE" },
          orderBy: { createdAt: "asc" },
        });

        for (const bad of broken) {
          const plan = JSON.parse(bad.appliedPlan ?? "{}");
          const isEmpty =
            (plan.sealedDelta?.length ?? 0) === 0 &&
            (plan.created?.length ?? 0) === 0 &&
            (plan.deleted?.length ?? 0) === 0 &&
            (plan.changed?.length ?? 0) === 0;
          if (!isEmpty) {
            throw new Error(
              `${item.name}: transaction ${bad.id} has a non-empty appliedPlan -- ` +
                `NOT one of the phantom rows, refusing to touch it.`,
            );
          }
          if (!bad.siteId || !bad.dispatchId) {
            throw new Error(`${item.name}: transaction ${bad.id} is missing siteId/dispatchId`);
          }

          const { id, quantity, siteId, dispatchId, userId, note, createdAt } = bad;
          await tx.transaction.delete({ where: { id } });
          report.push(`DELETE  phantom ISSUE ${item.name} qty=${quantity} [${id}]`);

          const request: AllocationRequest = {
            sealedPacks: [],
            pieces: [{ length: quantity, count: 1 }],
            loose: 0,
          };
          const approvedOpens: ApprovedOpens = [];

          const movement = await tx.transaction.create({
            data: {
              type: "ISSUE",
              quantity,
              itemId: item.id,
              siteId,
              dispatchId,
              userId,
              note,
              createdAt,
            },
          });

          const { applied } = await commitAllocation(tx, item, request, approvedOpens, userId);
          await tx.transaction.update({
            where: { id: movement.id },
            data: { appliedPlan: serialiseAppliedPlan(applied) },
          });

          const fresh = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
          report.push(`REISSUE ${item.name} -${quantity} -> stock=${fresh.currentStock} [${movement.id}]`);
        }
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  console.log("\n" + report.join("\n"));
  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error("\nFix failed:", error instanceof Error ? error.message : error);
    console.error("Nothing was written -- the whole fix is one transaction.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
