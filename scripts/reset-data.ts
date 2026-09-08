/* Run with `npx tsx scripts/reset-data.ts --yes-wipe <fragment>`.
 *
 * Erases every operational record — items, packs, movements, dispatches,
 * deliveries, sites, shelves, defects, approvals — and keeps User rows, so the
 * logins still work afterwards. Written for the 2026-09 reset, where the pilot
 * data was judged not worth migrating.
 *
 * WHY THE ARGUMENT. `.env` in this repo points DATABASE_URL at the live Turso
 * pilot; `.env.local` overrides it for `next dev`, but the Prisma CLI and plain
 * `tsx` scripts load `.env` ONLY (see prisma.config.ts). A reset script that
 * simply read the environment and started deleting would therefore default to
 * production — exactly the silent-wrong-database failure databaseUrl.ts was
 * written to make impossible. So the caller has to name a fragment of the URL
 * they believe they are pointed at, and this refuses if it does not match.
 * Typing the fragment is the confirmation; there is no prompt, because this
 * also has to be runnable non-interactively.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl.ts";
import { CHALLAN_SEQUENCE_KEY } from "../src/lib/challan.ts";

const url = resolveDatabaseUrl();

const args = process.argv.slice(2);
const flagIndex = args.indexOf("--yes-wipe");
const fragment = flagIndex === -1 ? null : args[flagIndex + 1];

console.log(`Target database: ${url}`);

if (!fragment) {
  console.error(
    "\nRefusing to run. Pass --yes-wipe <fragment>, where <fragment> is a\n" +
      "distinctive part of the URL above (e.g. \"dev.db\" or \"sce-inventory\").\n" +
      "This is the confirmation step: it proves you know which database you are\n" +
      "about to empty. Take a backup first with `npm run db:backup`.",
  );
  process.exit(1);
}

if (!url.includes(fragment)) {
  console.error(
    `\nRefusing to run. You confirmed "${fragment}", but DATABASE_URL is\n` +
      `"${url}", which does not contain it. Nothing was deleted.`,
  );
  process.exit(1);
}

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

/* Order matters: children before parents, because most of these relations are
 * REQUIRED (Prisma refuses the delete) and the optional ones would be worse —
 * Transaction.siteId is optional, so deleting Site first would SetNull and
 * quietly orphan the ledger instead of failing. Transaction goes in one
 * deleteMany despite its self-relation (`reverses`): emptying the whole table
 * at once leaves no dangling pointer to complain about. */
const ORDER = [
  "approvalRequest",
  "defectiveItem",
  "sitePickup",
  "transaction",
  "dispatch",
  "delivery",
  "openPack",
  "packStock",
  "shelfSlot",
  "shelf",
  "site",
  "item",
] as const;

async function main() {
  const deleted: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    for (const model of ORDER) {
      // The union above is checked against the generated client, so a model
      // renamed in schema.prisma breaks this at compile time rather than
      // leaving a table silently un-emptied.
      const result = await (tx[model] as { deleteMany: () => Promise<{ count: number }> }).deleteMany();
      deleted[model] = result.count;
    }

    // The challan counter goes back to zero WITH the dispatches, not without
    // them. Leaving it where it was would start the client's first real challan
    // at SCE/DC/0006 with no 1-5 behind it — a series with a hole at the front
    // is exactly what `challanNo` being unique-and-required exists to prevent.
    //
    // Safe here and ONLY here: this runs in the same transaction that deletes
    // every Dispatch, so there is no row left for a reissued number to collide
    // with. Never reset this counter on its own — if any challan has been
    // printed on paper, rewinding hands two documents one identity.
    await tx.sequence.upsert({
      where: { key: CHALLAN_SEQUENCE_KEY },
      update: { value: 0 },
      create: { key: CHALLAN_SEQUENCE_KEY, value: 0 },
    });
  });

  for (const [model, count] of Object.entries(deleted).sort()) {
    console.log(`  deleted ${String(count).padStart(6)}  ${model}`);
  }

  const users = await prisma.user.count();
  console.log(`\nKept ${users} user account${users === 1 ? "" : "s"}.`);

  // Not a formality: an empty run means the URL guard passed against a database
  // that was already empty, which usually means the wrong one was targeted.
  const total = Object.values(deleted).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    console.warn("WARNING: nothing was deleted. Was this the database you meant?");
  }
}

main()
  .catch((error) => {
    console.error("Reset failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
