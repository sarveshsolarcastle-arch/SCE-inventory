/* Run with `npm run db:seed:demo` (or
 * `npx tsx scripts/seed-demo.ts --yes-demo dev.db`).
 *
 * Loads a SHOWCASE dataset: ten items chosen so that every shape the app can
 * hold is on screen somewhere, plus six weeks of movement behind them. It is
 * for demoing the app, never for a database anyone depends on — it WIPES every
 * operational record before it writes (users are kept, exactly as
 * reset-data.ts keeps them).
 *
 * WHY TEN. The brief was "no more than 10 items, but all types". The catalogue
 * below is picked by COVERAGE rather than by realism-of-count — each item earns
 * its place by being the only one that exercises something:
 *
 *   continuous + packaged ......... DC cable (sealed rolls AND cut lengths)
 *   two pack sizes on one item .... earthing cable (100 m and 200 m rolls)
 *   continuous + unpackaged ....... flexible pipe (offcuts only, in cm)
 *   discrete + packaged ........... cable ties, rawal plugs (packets of 100)
 *   pack size of one .............. insulation tape (a "pack" IS a roll)
 *   discrete + unpackaged ......... end clamps, inverters
 *   pallet-packed equipment ....... solar modules
 *   scrap / recycle ............... pipe and DC cable offcuts under threshold
 *   low stock ..................... rawal plugs, earthing cable, tape
 *   out of stock .................. inverters (all four went to Powai)
 *
 * WHY THE STOCK IS NOT WRITTEN TO Item.currentStock. Same reason as
 * import-stock.ts: that column is a CACHE and recalcItemStock() is its only
 * writer. Everything here goes through the real pack primitives in packs.ts,
 * and the corrections/shelf work goes through the real operations in
 * lib/approvals/ops — so the demo cannot show a state the app itself could
 * never reach.
 *
 * The one thing that IS re-implemented here is the body of recordDelivery /
 * recordDispatch / recordMovement. Those live in `"use server"` files that
 * check a session and call revalidatePath(), neither of which exists in a
 * script. The re-implementation is deliberately thin: it writes the Transaction
 * row and then hands the actual stock effect to commitAllocation / restock, the
 * same functions the actions call, so pack state cannot drift from the app's.
 *
 * THE URL GUARD is stricter than reset-data.ts's. That one takes any URL you
 * can name a fragment of; this one additionally refuses anything that is not a
 * local `file:` database, with no override. Demo fixtures on the client's live
 * pilot would not be a mistake worth making recoverable.
 */
import { config as loadEnv } from "dotenv";
import type { Item, Prisma } from "../src/generated/prisma/client";
import { resolveDatabaseUrl } from "../src/lib/databaseUrl.ts";

/* `.env.local` FIRST, which is what `next dev` does and what plain
 * `dotenv/config` does not. It matters here more than anywhere: `.env` in this
 * repo points DATABASE_URL at the live Turso pilot and `.env.local` is the
 * override that keeps local work off it, so a script reading only `.env` sees
 * production. The other scripts survive that because their fragment guard
 * catches it; this one would simply refuse to run at all, which is safe but
 * useless. Earlier files win — dotenv does not overwrite a key already set. */
loadEnv({ path: [".env.local", ".env"], quiet: true });

const url = resolveDatabaseUrl();
const args = process.argv.slice(2);
const flagIndex = args.indexOf("--yes-demo");
const fragment = flagIndex === -1 ? null : args[flagIndex + 1];

console.log(`Target database: ${url}`);

if (!url.startsWith("file:")) {
  console.error(
    "\nRefusing to run. This seeder wipes the database and fills it with\n" +
      "invented stock, so it only ever runs against a local `file:` database.\n" +
      `DATABASE_URL is "${url}". Nothing was written.\n\n` +
      "If you meant to demo locally, .env.local should set\n" +
      '  DATABASE_URL="file:./dev.db"',
  );
  process.exit(1);
}

if (!fragment || !url.includes(fragment)) {
  console.error(
    !fragment
      ? "\nRefusing to run. Pass --yes-demo <fragment>, a distinctive part of\n" +
          'the URL above (e.g. "dev.db"). This is the confirmation that you\n' +
          "know which database you are about to empty and refill."
      : `\nRefusing to run. You confirmed "${fragment}", but DATABASE_URL is\n` +
          `"${url}", which does not contain it. Nothing was written.`,
  );
  process.exit(1);
}

/* The guard has passed, so pin the environment to the URL it passed against
 * BEFORE anything imports @/lib/prisma. That module builds its client at import
 * time from process.env, so pinning here is what makes "this script talks to
 * the pilot" unreachable rather than merely checked-for. Everything below is
 * therefore a dynamic import inside main(). */
process.env.DATABASE_URL = url;
process.env.TURSO_AUTH_TOKEN = "";

/** Captured before the first write. Every row the app's own code creates gets
 * `createdAt = now()`, and backdating means finding exactly those rows: they
 * are the ones at or after this instant. Rows already stamped into the past
 * fall out of the filter on their own, so no bookkeeping is needed. */
const RUN_START = new Date();

const at = (iso: string) => new Date(iso);

const OPENING = at("2026-07-31T09:00:00");
const DELIVERY_1 = at("2026-08-03T10:20:00");
const DISPATCH_1 = at("2026-08-06T08:45:00");
const DELIVERY_2 = at("2026-08-11T11:30:00");
const DISPATCH_2 = at("2026-08-14T09:10:00");
const CONSUMED = at("2026-08-18T17:40:00");
const TRANSFERRED = at("2026-08-21T13:05:00");
const DISPATCH_3 = at("2026-08-25T08:30:00");
const RETURNED = at("2026-08-28T16:15:00");
const FLAGGED = at("2026-09-01T12:00:00");
const COUNTED = at("2026-09-03T15:20:00");
const MISBOOKED = at("2026-09-04T10:05:00");
const CORRECTED = at("2026-09-05T09:35:00");
const REQUESTED = at("2026-09-07T14:50:00");

type Req = {
  sealedPacks: { packSize: number; count: number }[];
  pieces: { length: number; count: number }[];
  loose: number;
};

const req = (r: Partial<Req>): Req => ({
  sealedPacks: r.sealedPacks ?? [],
  pieces: r.pieces ?? [],
  loose: r.loose ?? 0,
});

const totalOf = (r: Req): number =>
  r.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0) +
  r.pieces.reduce((s, p) => s + p.length * p.count, 0) +
  r.loose;

async function main() {
  const { prisma } = await import("../src/lib/prisma.ts");
  const { addPacks, addOpenPack, recalcItemStock, commitAllocation, restock } =
    await import("../src/lib/packs.ts");
  const { serialiseAppliedPlan, emptyAppliedPlan, addSealedDelta } = await import(
    "../src/lib/corrections.ts"
  );
  const {
    nextChallanNo,
    formatChallanNo,
    formatSiteChallanNo,
    formatTransferChallanNo,
    SITE_CHALLAN_SEQUENCE_KEY,
    TRANSFER_CHALLAN_SEQUENCE_KEY,
    CHALLAN_SEQUENCE_KEYS,
  } = await import("../src/lib/challan.ts");
  const { describeKind } = await import("../src/lib/approvals/summary.ts");
  const shelfOps = await import("../src/lib/approvals/ops/shelf.ts");
  const correctionOps = await import("../src/lib/approvals/ops/corrections.ts");
  const bcrypt = (await import("bcryptjs")).default;

  /* ---- the two accounts the demo is driven from ----------------------- */

  // EMPLOYEE is retired (see the Role enum), so a showcase needs only these
  // two. Upserted with `update: {}` so re-running never resets a password
  // somebody has already been handed for the demo.
  const accounts = [
    { name: "Admin", email: "admin@example.com", role: "ADMIN" as const, password: "admin123" },
    { name: "Finance", email: "finance@example.com", role: "FINANCE" as const, password: "finance123" },
  ];
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        name: account.name,
        email: account.email,
        passwordHash: await bcrypt.hash(account.password, 10),
        role: account.role,
      },
    });
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: accounts[0].email } });
  const finance = await prisma.user.findUniqueOrThrow({ where: { email: accounts[1].email } });

  /* ---- what gets emptied, in the order reset-data.ts empties it -------- */

  const WIPE_ORDER = [
    "approvalRequest",
    "defectiveItem",
    "sitePickup",
    "transaction",
    "dispatch",
    "delivery",
    "transfer",
    "openPack",
    "packStock",
    "shelfSlot",
    "shelf",
    "site",
    "item",
  ] as const;

  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      /* ---- wipe, inside the same transaction as the refill -------------
       * So a seed that fails half-way leaves the database it found, rather
       * than an empty one. */
      for (const model of WIPE_ORDER) {
        await (tx[model] as { deleteMany: () => Promise<{ count: number }> }).deleteMany();
      }
      // Safe only because every Dispatch and Delivery has just gone with it —
      // see the same note in reset-data.ts. The demo challans then run 0001,
      // 0002, 0003 in each series.
      for (const key of CHALLAN_SEQUENCE_KEYS) {
        await tx.sequence.upsert({
          where: { key },
          update: { value: 0 },
          create: { key, value: 0 },
        });
      }

      /* ---- backdating ------------------------------------------------- */

      /** Moves every row written since the last call back to `when`. Called at
       * the end of each step, so the ledger reads as six weeks of work rather
       * than as one afternoon. */
      const stamp = async (when: Date) => {
        const movements = await tx.transaction.findMany({
          where: { createdAt: { gte: RUN_START } },
          select: { id: true },
        });
        if (movements.length) {
          await tx.transaction.updateMany({
            where: { id: { in: movements.map((m) => m.id) } },
            data: { createdAt: when },
          });
        }
        const packs = await tx.openPack.findMany({
          where: { openedAt: { gte: RUN_START } },
          select: { id: true },
        });
        if (packs.length) {
          await tx.openPack.updateMany({
            where: { id: { in: packs.map((p) => p.id) } },
            data: { openedAt: when },
          });
        }
      };

      /* ---- sites ------------------------------------------------------ */

      // The customer / address / project fields are filled in because they are
      // what a delivery challan PRINTS. A site with only a name demos the app
      // with the most interesting page in it half blank.
      const andheri = await tx.site.create({
        data: {
          name: "Andheri Rooftop",
          location: "Andheri East",
          customerName: "Sunview Realty Pvt Ltd",
          address: "Plot 14, MIDC Cross Road B,\nAndheri East, Mumbai 400 093",
          projectCode: "SR/2026/11",
          notes: "180 kWp rooftop across Blocks A and B. Access via the service lift only.",
        },
      });
      const powai = await tx.site.create({
        data: {
          name: "Powai Warehouse",
          location: "Powai",
          customerName: "Hiranandani Estates Ltd",
          address: "Warehouse B, Saki Vihar Road,\nPowai, Mumbai 400 076",
          projectCode: "HE/2026/04",
          notes: "Modules delivered direct to site by the supplier — they never reach the store.",
        },
      });
      const vasai = await tx.site.create({
        data: {
          name: "Vasai Industrial Shed",
          location: "Vasai East",
          customerName: "Zenith Polymers Ltd",
          address: "Survey 88/2, Gauraipada,\nVasai East, Palghar 401 208",
          projectCode: "ZP/2026/19",
        },
      });

      /* ---- the catalogue, with its opening balance --------------------- */

      type Fixture = {
        sku: string;
        name: string;
        category: string;
        measure: "CONTINUOUS" | "DISCRETE";
        baseUnit: string;
        packUnit: string | null;
        scrapThreshold: number | null;
        minStock: number;
        sealed: { packSize: number; count: number }[];
        /** One entry per physical piece — offcuts are individual, never summed. */
        loose: number[];
      };

      const fixtures: Fixture[] = [
        {
          sku: "CBL-DC-RED-4",
          name: "DC Cable, single core 4 sqmm, Red",
          category: "Material",
          measure: "CONTINUOUS",
          baseUnit: "m",
          packUnit: "roll",
          scrapThreshold: 15,
          minStock: 400,
          sealed: [{ packSize: 500, count: 3 }],
          loose: [320, 85],
        },
        {
          sku: "CBL-DC-BLK-4",
          name: "DC Cable, single core 4 sqmm, Black",
          category: "Material",
          measure: "CONTINUOUS",
          baseUnit: "m",
          packUnit: "roll",
          scrapThreshold: 15,
          minStock: 400,
          sealed: [{ packSize: 500, count: 1 }],
          loose: [180, 60],
        },
        {
          // The two-pack-size case: 100 m and 200 m rolls of one material, which
          // is what makes "which roll do I open" a real question.
          sku: "CBL-ERT-6",
          name: "Earthing Cable 6 sqmm, Green",
          category: "Material",
          measure: "CONTINUOUS",
          baseUnit: "m",
          packUnit: "roll",
          scrapThreshold: 10,
          minStock: 400,
          sealed: [
            { packSize: 100, count: 2 },
            { packSize: 200, count: 1 },
          ],
          loose: [45],
        },
        {
          // Continuous but never packaged, and counted in cm: the 18 cm end
          // below lands straight in the recycle list on creation.
          sku: "FLP-20",
          name: "Flexible Pipe 20 mm, Black",
          category: "Material",
          measure: "CONTINUOUS",
          baseUnit: "cm",
          packUnit: null,
          scrapThreshold: 25,
          minStock: 600,
          sealed: [],
          loose: [300, 250, 200, 54, 18],
        },
        {
          sku: "TIE-CBL-NYL",
          name: "Cable Ties 200 mm, Nylon",
          category: "Fixing",
          measure: "DISCRETE",
          baseUnit: "pcs",
          packUnit: "packet",
          scrapThreshold: null,
          minStock: 400,
          sealed: [{ packSize: 100, count: 6 }],
          loose: [45],
        },
        {
          sku: "PLG-RAW-BIG",
          name: "Rawal Plug, Big (12 mm)",
          category: "Fixing",
          measure: "DISCRETE",
          baseUnit: "pcs",
          packUnit: "packet",
          scrapThreshold: null,
          minStock: 250,
          sealed: [{ packSize: 100, count: 1 }],
          loose: [31],
        },
        {
          sku: "END-CLM-35",
          name: "End Clamp 35 mm",
          category: "Fixing",
          measure: "DISCRETE",
          baseUnit: "pcs",
          packUnit: null,
          scrapThreshold: null,
          minStock: 100,
          sealed: [],
          loose: [180],
        },
        {
          // A "pack" here IS one roll — pack size 1. Worth demoing because it is
          // the degenerate case every pack-aware screen has to render sensibly.
          sku: "TAP-INS-BLK",
          name: "Insulation Tape, Black",
          category: "Material",
          measure: "DISCRETE",
          baseUnit: "pcs",
          packUnit: "roll",
          scrapThreshold: null,
          minStock: 30,
          sealed: [{ packSize: 1, count: 8 }],
          loose: [],
        },
        {
          sku: "INV-5K",
          name: "Inverter 5 kW, String",
          category: "Equipment",
          measure: "DISCRETE",
          baseUnit: "pcs",
          packUnit: null,
          scrapThreshold: null,
          minStock: 2,
          sealed: [],
          loose: [4],
        },
        {
          sku: "MOD-540",
          name: "Solar Module 540 Wp Mono PERC",
          category: "Equipment",
          measure: "DISCRETE",
          baseUnit: "pcs",
          packUnit: "pallet",
          scrapThreshold: null,
          minStock: 20,
          sealed: [{ packSize: 30, count: 2 }],
          loose: [12],
        },
      ];

      const items: Record<string, Item> = {};

      for (const fixture of fixtures) {
        const item = await tx.item.create({
          data: {
            sku: fixture.sku,
            name: fixture.name,
            category: fixture.category,
            baseUnit: fixture.baseUnit,
            packUnit: fixture.packUnit,
            measure: fixture.measure,
            scrapThreshold: fixture.scrapThreshold,
            minStock: fixture.minStock,
          },
        });
        for (const group of fixture.sealed) {
          await addPacks(tx, item.id, group.packSize, group.count);
        }
        for (const remaining of fixture.loose) {
          await addOpenPack(tx, item, remaining);
        }
        await recalcItemStock(tx, item.id);
        items[fixture.sku] = await tx.item.findUniqueOrThrow({ where: { id: item.id } });
      }

      // The opening balance is deliberately unbacked by any ledger row — same
      // choice import-stock.ts makes, and for the same reason: there was no
      // paper trail to import. Every movement AFTER this point is recorded.
      await stamp(OPENING);

      /* ---- the movement helpers --------------------------------------- */

      /** Material leaving the store. Writes the ISSUE row, then hands the pack
       * effect to the same commitAllocation the app's dispatch form calls. */
      const issue = async (opts: {
        item: Item;
        siteId: string;
        request: Req;
        userId: string;
        note?: string | null;
        dispatchId?: string | null;
        /** Deliberately generous — `exceedsApproval` only checks that the plan
         * needs no MORE opens than these, so over-approving is safe and keeps
         * the fixture from having to re-derive the planner's choices. */
        approvedOpens?: { packSize: number; count: number }[];
      }) => {
        const { request } = opts;
        const movement = await tx.transaction.create({
          data: {
            type: "ISSUE",
            quantity: totalOf(request),
            itemId: opts.item.id,
            siteId: opts.siteId,
            dispatchId: opts.dispatchId ?? null,
            userId: opts.userId,
            note: opts.note ?? null,
            packSize: request.sealedPacks[0]?.packSize ?? null,
            packCount: request.sealedPacks.reduce((s, p) => s + p.count, 0) || null,
            pieces: request.pieces.length ? JSON.stringify(request.pieces) : null,
          },
        });
        const { applied } = await commitAllocation(
          tx,
          opts.item,
          request,
          opts.approvedOpens ?? [],
          opts.userId,
        );
        await tx.transaction.update({
          where: { id: movement.id },
          data: { appliedPlan: serialiseAppliedPlan(applied) },
        });
        return movement.id;
      };

      /** Material coming back from a site, optionally with a damaged portion
       * that is quarantined instead of restocked. */
      const returnFromSite = async (opts: {
        item: Item;
        siteId: string;
        lengths: number[];
        defectiveQty?: number;
        userId: string;
        note?: string | null;
      }) => {
        const total = opts.lengths.reduce((s, l) => s + l, 0);
        const defective = opts.defectiveQty ?? 0;
        const movement = await tx.transaction.create({
          data: {
            type: "RETURN",
            quantity: total,
            itemId: opts.item.id,
            siteId: opts.siteId,
            userId: opts.userId,
            note: opts.note ?? null,
            defectiveQty: defective || null,
          },
        });

        // Which individual offcut was damaged is not knowable from one number,
        // so the good remainder comes back as a single pack — the same choice
        // recordMovement makes rather than guessing an attribution.
        const goodLengths =
          defective === 0 ? opts.lengths : total > defective ? [total - defective] : [];

        const { applied } = await restock(tx, opts.item, {
          lengths: goodLengths,
          userId: opts.userId,
        });

        if (defective > 0) {
          const row = await tx.defectiveItem.create({
            data: {
              itemId: opts.item.id,
              quantity: defective,
              source: "RETURN",
              transactionId: movement.id,
              siteId: opts.siteId,
              userId: opts.userId,
              note: opts.note ?? null,
              reportedAt: RETURNED,
            },
          });
          applied.defectiveIds.push(row.id);
        }

        await tx.transaction.update({
          where: { id: movement.id },
          data: { appliedPlan: serialiseAppliedPlan(applied) },
        });
        return movement.id;
      };

      /* ---- 3 Aug: a delivery into the store ---------------------------- */

      const delivery1 = await tx.delivery.create({
        data: {
          reference: "PC/INV/8841",
          supplier: "Polycab Wires Pvt Ltd",
          receivedAt: DELIVERY_1,
          note: "Monthly cable and consumables top-up.",
          userId: finance.id,
        },
      });

      // Two whole 500 m rolls, straight to the sealed shelf.
      await addPacks(tx, items["CBL-DC-RED-4"].id, 500, 2);
      await recalcItemStock(tx, items["CBL-DC-RED-4"].id);
      {
        const applied = emptyAppliedPlan();
        addSealedDelta(applied, 500, 2);
        await tx.transaction.create({
          data: {
            type: "STOCK_IN",
            quantity: 1000,
            itemId: items["CBL-DC-RED-4"].id,
            userId: finance.id,
            deliveryId: delivery1.id,
            packSize: 500,
            packCount: 2,
            appliedPlan: serialiseAppliedPlan(applied),
          },
        });
      }

      // 24 rolls of tape ordered, 2 crushed in transit. The damaged two NEVER
      // enter stock — 22 are booked in and 2 are quarantined for the claim.
      await addPacks(tx, items["TAP-INS-BLK"].id, 1, 22);
      await recalcItemStock(tx, items["TAP-INS-BLK"].id);
      {
        const applied = emptyAppliedPlan();
        addSealedDelta(applied, 1, 22);
        const damaged = await tx.defectiveItem.create({
          data: {
            itemId: items["TAP-INS-BLK"].id,
            quantity: 2,
            packSize: 1,
            packCount: 2,
            source: "DELIVERY",
            deliveryId: delivery1.id,
            userId: finance.id,
            status: "CLAIMED",
            note: "Two rolls crushed in transit. Claim raised with Polycab, credit note pending.",
            reportedAt: DELIVERY_1,
          },
        });
        applied.defectiveIds.push(damaged.id);
        await tx.transaction.create({
          data: {
            type: "STOCK_IN",
            quantity: 22,
            itemId: items["TAP-INS-BLK"].id,
            userId: finance.id,
            deliveryId: delivery1.id,
            packSize: 1,
            packCount: 24,
            appliedPlan: serialiseAppliedPlan(applied),
          },
        });
      }

      // One more pallet of modules.
      await addPacks(tx, items["MOD-540"].id, 30, 1);
      await recalcItemStock(tx, items["MOD-540"].id);
      {
        const applied = emptyAppliedPlan();
        addSealedDelta(applied, 30, 1);
        await tx.transaction.create({
          data: {
            type: "STOCK_IN",
            quantity: 30,
            itemId: items["MOD-540"].id,
            userId: finance.id,
            deliveryId: delivery1.id,
            packSize: 30,
            packCount: 1,
            appliedPlan: serialiseAppliedPlan(applied),
          },
        });
      }

      await stamp(DELIVERY_1);

      /* ---- 6 Aug: SCE/DC/0001 to Andheri Rooftop ----------------------- */

      const challan1 = await nextChallanNo(tx);
      const dispatch1 = await tx.dispatch.create({
        data: {
          challanNo: challan1,
          reference: "SR/PO/0442",
          siteId: andheri.id,
          dispatchedAt: DISPATCH_1,
          deliveredBy: "Suresh Yadav (Tempo MH-02 CJ 4471)",
          receivedBy: "A. Deshmukh, Site Engineer",
          note: "First consignment for Block A.",
          userId: finance.id,
        },
      });

      // Two 120 m runs. Both come off open rolls, so nothing is opened.
      await issue({
        item: items["CBL-DC-RED-4"],
        siteId: andheri.id,
        dispatchId: dispatch1.id,
        request: req({ pieces: [{ length: 120, count: 2 }] }),
        userId: finance.id,
        note: "String runs, Block A rows 1-2",
      });
      await issue({
        item: items["MOD-540"],
        siteId: andheri.id,
        dispatchId: dispatch1.id,
        request: req({ sealedPacks: [{ packSize: 30, count: 1 }] }),
        userId: finance.id,
        note: "One sealed pallet",
      });
      await issue({
        item: items["TIE-CBL-NYL"],
        siteId: andheri.id,
        dispatchId: dispatch1.id,
        request: req({ loose: 250 }),
        userId: finance.id,
        approvedOpens: [{ packSize: 100, count: 6 }],
      });
      await issue({
        item: items["END-CLM-35"],
        siteId: andheri.id,
        dispatchId: dispatch1.id,
        request: req({ loose: 40 }),
        userId: finance.id,
      });

      await stamp(DISPATCH_1);

      /* ---- 11 Aug: a delivery that never touches the store -------------- */

      // The supplier drops 60 modules straight at Powai. This writes a
      // STOCK_IN and an immediate ISSUE sharing one deliveryId — they net to
      // zero at the office, and the site correctly holds the material. No pack
      // rows are created, because nothing ever sat on a shelf.
      //
      // Numbered like a real direct-to-site delivery — otherwise the demo's
      // one example of this path has no Print challan button to show off.
      const siteChallan2 = await nextChallanNo(tx, SITE_CHALLAN_SEQUENCE_KEY);
      const delivery2 = await tx.delivery.create({
        data: {
          reference: "WE/DC/2291",
          supplier: "Waaree Energies Ltd",
          receivedAt: DELIVERY_2,
          siteId: powai.id,
          challanNo: siteChallan2,
          deliveredBy: "Waaree Energies transport",
          receivedBy: "K. Salunkhe, Store In-charge",
          note: "Delivered direct to site by the supplier — never received at the store.",
          userId: finance.id,
        },
      });
      for (const type of ["STOCK_IN", "ISSUE"] as const) {
        await tx.transaction.create({
          data: {
            type,
            quantity: 60,
            itemId: items["MOD-540"].id,
            siteId: type === "ISSUE" ? powai.id : null,
            userId: finance.id,
            deliveryId: delivery2.id,
            packSize: 30,
            packCount: 2,
            note: "Delivered direct to site by the supplier — never received at the store.",
          },
        });
      }

      await stamp(DELIVERY_2);

      /* ---- 14 Aug: SCE/DC/0002 to Powai Warehouse ---------------------- */

      const challan2 = await nextChallanNo(tx);
      const dispatch2 = await tx.dispatch.create({
        data: {
          challanNo: challan2,
          reference: "HE/GRN/0774",
          siteId: powai.id,
          dispatchedAt: DISPATCH_2,
          deliveredBy: "Ramesh Pawar",
          receivedBy: "K. Salunkhe, Store In-charge",
          userId: finance.id,
        },
      });

      await issue({
        item: items["CBL-DC-BLK-4"],
        siteId: powai.id,
        dispatchId: dispatch2.id,
        request: req({ pieces: [{ length: 150, count: 1 }] }),
        userId: finance.id,
        note: "Inverter to combiner box",
      });
      // 80 m of earthing cable, and no open remainder is long enough — so a
      // sealed roll is opened. That prompt is the pack model's whole point.
      await issue({
        item: items["CBL-ERT-6"],
        siteId: powai.id,
        dispatchId: dispatch2.id,
        request: req({ pieces: [{ length: 80, count: 1 }] }),
        userId: finance.id,
        approvedOpens: [
          { packSize: 100, count: 1 },
          { packSize: 200, count: 1 },
        ],
      });
      await issue({
        item: items["INV-5K"],
        siteId: powai.id,
        dispatchId: dispatch2.id,
        request: req({ loose: 4 }),
        userId: finance.id,
        // Empties the store of inverters — the out-of-stock case on the items list.
        note: "All four units, for the 20 kW block",
      });
      await issue({
        item: items["PLG-RAW-BIG"],
        siteId: powai.id,
        dispatchId: dispatch2.id,
        request: req({ loose: 100 }),
        userId: finance.id,
        approvedOpens: [{ packSize: 100, count: 1 }],
      });

      await stamp(DISPATCH_2);

      /* ---- 18 Aug: material used up at Andheri ------------------------- */

      // CONSUME is zero-delta to the store — this material left when it was
      // issued. Without it a site's list is "everything ever sent, minus what
      // came back" and grows forever.
      for (const line of [
        { sku: "MOD-540", quantity: 25 },
        { sku: "CBL-DC-RED-4", quantity: 200 },
        { sku: "END-CLM-35", quantity: 30 },
      ]) {
        await tx.transaction.create({
          data: {
            type: "CONSUME",
            quantity: line.quantity,
            itemId: items[line.sku].id,
            siteId: andheri.id,
            userId: finance.id,
            note: "Installed on the Block A array",
          },
        });
      }

      await stamp(CONSUMED);

      /* ---- 21 Aug: Powai → Vasai, without passing through the store ----
       * A real Transfer document, not a bare TRANSFER Transaction — the same
       * grouping record transferBatch (siteLifecycle.ts) writes, and the one
       * thing the site-to-site transfer itself needs to show up on
       * `/transfers` and to have a printable challan. An orphan row here
       * (transferId left null) would reproduce, on every fresh seed, exactly
       * the malformed-legacy-row shape the backfill migration's own NULL
       * guard exists to tolerate — not demonstrate it. */
      const transferChallan1 = await nextChallanNo(tx, TRANSFER_CHALLAN_SEQUENCE_KEY);
      const transfer1 = await tx.transfer.create({
        data: {
          challanNo: transferChallan1,
          fromSiteId: powai.id,
          toSiteId: vasai.id,
          transferredAt: TRANSFERRED,
          note: "Twenty spares moved straight across from Powai",
          userId: finance.id,
        },
      });

      await tx.transaction.create({
        data: {
          type: "TRANSFER",
          quantity: 20,
          itemId: items["MOD-540"].id,
          siteId: vasai.id, // destination
          fromSiteId: powai.id, // origin
          transferId: transfer1.id,
          userId: finance.id,
          note: "Twenty spares moved straight across from Powai",
        },
      });

      await stamp(TRANSFERRED);

      /* ---- 25 Aug: SCE/DC/0003 to Vasai Industrial Shed ---------------- */

      // No deliveredBy / receivedBy: printed before the driver was known, so
      // the challan renders those as ruled lines to fill in by hand.
      const challan3 = await nextChallanNo(tx);
      const dispatch3 = await tx.dispatch.create({
        data: {
          challanNo: challan3,
          siteId: vasai.id,
          dispatchedAt: DISPATCH_3,
          note: "Conduit and earthing for the shed roof.",
          userId: finance.id,
        },
      });

      // Takes one 200 cm offcut exactly to zero: used up, not scrapped.
      await issue({
        item: items["FLP-20"],
        siteId: vasai.id,
        dispatchId: dispatch3.id,
        request: req({ pieces: [{ length: 200, count: 1 }] }),
        userId: finance.id,
        note: "Conduit run, north bay",
      });
      await issue({
        item: items["TAP-INS-BLK"],
        siteId: vasai.id,
        dispatchId: dispatch3.id,
        request: req({ sealedPacks: [{ packSize: 1, count: 6 }] }),
        userId: finance.id,
      });
      await issue({
        item: items["CBL-ERT-6"],
        siteId: vasai.id,
        dispatchId: dispatch3.id,
        request: req({ pieces: [{ length: 60, count: 1 }] }),
        userId: finance.id,
        approvedOpens: [
          { packSize: 100, count: 1 },
          { packSize: 200, count: 1 },
        ],
      });
      // 75 m off an 80 m offcut leaves 5 m, which is at or below the 15 m scrap
      // threshold — so it drops out of stock and onto the recycle list, with a
      // SCRAP row of its own.
      await issue({
        item: items["CBL-DC-RED-4"],
        siteId: vasai.id,
        dispatchId: dispatch3.id,
        request: req({ pieces: [{ length: 75, count: 1 }] }),
        userId: finance.id,
        note: "Final string run to the inverter",
      });

      await stamp(DISPATCH_3);

      /* ---- 28 Aug: two returns from Andheri ---------------------------- */

      await returnFromSite({
        item: items["CBL-DC-RED-4"],
        siteId: andheri.id,
        lengths: [40],
        userId: finance.id,
        note: "Surplus run coiled back from Block A",
      });
      // 30 ties back, 10 of them crushed. The site loses all 30 (its ledger
      // must be right); the store gains only the 20 good ones.
      await returnFromSite({
        item: items["TIE-CBL-NYL"],
        siteId: andheri.id,
        lengths: [30],
        defectiveQty: 10,
        userId: finance.id,
        note: "Ten came back crushed in the crate",
      });

      await stamp(RETURNED);

      /* ---- 1 Sep: material flagged for collection ---------------------- */

      // Flagging LABELS material; it never moves it. It exists so that tidying
      // up a site's list cannot quietly write off pipe that is sitting on a
      // roof, entirely retrievable.
      await tx.sitePickup.create({
        data: {
          siteId: vasai.id,
          itemId: items["FLP-20"].id,
          quantity: 200,
          note: "Left coiled on the shed roof — collect on the next Palghar run",
          markedAt: FLAGGED,
          userId: finance.id,
        },
      });
      await tx.sitePickup.create({
        data: {
          siteId: powai.id,
          itemId: items["MOD-540"].id,
          quantity: 15,
          note: "Spare modules stacked in the security cabin",
          markedAt: FLAGGED,
          userId: finance.id,
        },
      });

      /* ---- 3 Sep: a physical count disagrees with the ledger ----------- */

      // Through the real operation, so what the demo shows is exactly what an
      // approved count would do: a CORRECTION OF KNOWN SIZE, not the snapshot.
      {
        const clampPack = await tx.openPack.findFirstOrThrow({
          where: { itemId: items["END-CLM-35"].id, state: "OPEN" },
        });
        await correctionOps.adjustStock(
          tx,
          {
            itemId: items["END-CLM-35"].id,
            sealed: [],
            open: [
              { packId: clampPack.id, counted: 135, ledger: clampPack.remaining },
            ],
            reason: "Monthly cycle count — five clamps short in box B2-1",
          },
          admin.id,
        );
      }

      await stamp(COUNTED);

      /* ---- 4 Sep: an issue booked to the wrong site ... ---------------- */

      const misbooked = await issue({
        item: items["TIE-CBL-NYL"],
        siteId: vasai.id,
        request: req({ loose: 100 }),
        userId: finance.id,
        approvedOpens: [{ packSize: 100, count: 6 }],
        note: "Ties for the shed roof",
      });

      await stamp(MISBOOKED);

      /* ---- ... and 5 Sep: reversed, not deleted ------------------------ */

      // Reversal keeps the original and marks it excluded, replaying its
      // appliedPlan backwards — the 100 ties go back onto the packs they came
      // off, and refuse to if anything has touched them since.
      await correctionOps.reverseTransaction(
        tx,
        {
          transactionId: misbooked,
          reason: "Booked to Vasai in error — these ties went to Andheri on SCE/DC/0001",
        },
        admin.id,
      );

      await stamp(CORRECTED);

      /* ---- 7 Sep: two requests waiting for an admin -------------------- */

      // Written as rows rather than through runOrRequest, which needs a
      // session. The summary is still built by the app's own describeKind, so
      // what the queue renders is what the app would have frozen there.
      const siteUpdateArgs = {
        siteId: vasai.id,
        name: "Vasai Industrial Shed",
        location: "Vasai East",
        customerName: "Zenith Polymers Ltd",
        address: "Gate 3, Survey 88/2, Gauraipada,\nVasai East, Palghar 401 208",
        projectCode: "ZP/2026/19-A",
        notes: "Client sent a corrected gate number and project code for the challan.",
      };
      await tx.approvalRequest.create({
        data: {
          kind: "site.update",
          args: JSON.stringify(siteUpdateArgs),
          summary: describeKind("site.update", { ...siteUpdateArgs }, { site: vasai.name }),
          reason: "Their accounts team rejected the last challan — wrong gate number and project code.",
          targetKey: `Site:${vasai.id}`,
          requestedById: finance.id,
          createdAt: REQUESTED,
        },
      });

      const dispatch2Lines = await tx.transaction.count({
        where: { dispatchId: dispatch2.id },
      });
      const reverseArgs = {
        dispatchId: dispatch2.id,
        reason: "Powai says the 14 Aug consignment was signed for by the wrong contractor.",
      };
      await tx.approvalRequest.create({
        data: {
          kind: "stock.reverseDispatch",
          args: JSON.stringify(reverseArgs),
          summary: describeKind(
            "stock.reverseDispatch",
            { ...reverseArgs },
            {
              dispatch:
                `dispatch ${dispatch2.reference} to ${powai.name} of ` +
                `${DISPATCH_2.toLocaleDateString()} (${dispatch2Lines} lines)`,
            },
          ),
          reason: reverseArgs.reason,
          targetKey: `Dispatch:${dispatch2.id}`,
          requestedById: finance.id,
          createdAt: REQUESTED,
        },
      });

      /* ---- the shelf --------------------------------------------------- */

      // Last, so that assignSlotItem adopts the open and scrap packs the six
      // weeks above actually left behind. A box stores no quantity — how much
      // is in it is derived from the packs pointing at it.
      const rack = await shelfOps.createShelf(tx, {
        name: "Rack A",
        rows: 3,
        columns: 3,
        boxTypes: {
          "FRONT-1-1": "FRESH",
          "FRONT-1-2": "OPENED",
          "FRONT-1-3": "FRESH",
          // OPENED, not FRESH: the only sealed packet of plugs was broken open
          // on SCE/DC/0002, so what is physically in this box is the part-used
          // packet. A Fresh box would correctly render "no sealed packs".
          "FRONT-2-1": "OPENED",
          "FRONT-2-2": "OPENED",
          "FRONT-2-3": "FRESH",
          "FRONT-3-1": "OPENED",
          "FRONT-3-2": "RECYCLABLE",
          "FRONT-3-3": "FRESH",
          "BACK-1-1": "FRESH",
          "BACK-1-2": "OPENED",
          "BACK-1-3": "RECYCLABLE",
          "BACK-2-1": "OPENED",
          "BACK-2-2": "FRESH",
          "BACK-2-3": "OPENED",
          "BACK-3-1": "FRESH",
          "BACK-3-2": "FRESH",
          "BACK-3-3": "FRESH",
        },
      });

      const placement: { tag: string; sku: string | null; frontRow?: boolean }[] = [
        { tag: "F1-1", sku: "CBL-DC-RED-4", frontRow: true },
        { tag: "F1-2", sku: "CBL-DC-RED-4", frontRow: true },
        { tag: "F1-3", sku: "TIE-CBL-NYL", frontRow: true },
        { tag: "F2-1", sku: "PLG-RAW-BIG" },
        { tag: "F2-2", sku: "CBL-DC-BLK-4" },
        { tag: "F2-3", sku: "CBL-DC-BLK-4" },
        { tag: "F3-1", sku: "FLP-20" },
        { tag: "F3-2", sku: "FLP-20" },
        { tag: "F3-3", sku: "TAP-INS-BLK" },
        { tag: "B1-1", sku: "CBL-ERT-6" },
        { tag: "B1-2", sku: "CBL-ERT-6" },
        { tag: "B1-3", sku: "CBL-DC-RED-4" },
        { tag: "B2-1", sku: "END-CLM-35" },
        { tag: "B2-2", sku: "MOD-540" },
        { tag: "B2-3", sku: "MOD-540" },
        // B3-* left empty on purpose: an unassigned box is a real state, and
        // the shelf map has to read sensibly with holes in it.
      ];

      for (const place of placement) {
        const slot = await tx.shelfSlot.findFirstOrThrow({
          where: { shelfId: rack.id, tagCode: place.tag },
        });
        await shelfOps.assignSlotItem(tx, {
          shelfId: rack.id,
          slotId: slot.id,
          itemId: place.sku ? items[place.sku].id : null,
        });
        if (place.frontRow) {
          await shelfOps.toggleFrontRow(tx, { shelfId: rack.id, slotId: slot.id });
        }
      }
    },
    { timeout: 180_000, maxWait: 30_000 },
  );

  /* ---- what came out ------------------------------------------------- */

  const report = await prisma.item.findMany({
    orderBy: { sku: "asc" },
    select: {
      sku: true,
      name: true,
      baseUnit: true,
      packUnit: true,
      measure: true,
      minStock: true,
      currentStock: true,
      scrapStock: true,
    },
  });

  console.log("\nCatalogue");
  for (const item of report) {
    const low = item.currentStock < item.minStock ? "  LOW" : "";
    const scrap = item.scrapStock ? `  (+${item.scrapStock} ${item.baseUnit} scrap)` : "";
    console.log(
      `  ${item.sku.padEnd(14)} ${String(item.currentStock).padStart(5)} ${item.baseUnit.padEnd(4)}` +
        ` ${item.measure.padEnd(10)} ${(item.packUnit ?? "—").padEnd(7)}${scrap}${low}`,
    );
  }

  const [movements, dispatches, deliveries, transfers, defects, pickups, pending, slots] =
    await Promise.all([
      prisma.transaction.count(),
      prisma.dispatch.count(),
      prisma.delivery.count(),
      prisma.transfer.count(),
      prisma.defectiveItem.count(),
      prisma.sitePickup.count(),
      prisma.approvalRequest.count({ where: { status: "PENDING" } }),
      prisma.shelfSlot.count({ where: { itemId: { not: null } } }),
    ]);

  const challans = await prisma.dispatch.findMany({
    orderBy: { challanNo: "asc" },
    select: { challanNo: true, site: { select: { name: true } } },
  });
  const transferChallans = await prisma.transfer.findMany({
    orderBy: { challanNo: "asc" },
    select: { challanNo: true, fromSite: { select: { name: true } }, toSite: { select: { name: true } } },
  });
  const siteChallans = await prisma.delivery.findMany({
    where: { challanNo: { not: null } },
    orderBy: { challanNo: "asc" },
    select: { challanNo: true, site: { select: { name: true } } },
  });

  console.log(
    `\n  ${report.length} items, ${movements} movements, ${dispatches} dispatches, ` +
      `${deliveries} deliveries, ${transfers} transfers,\n  ${defects} defective rows, ` +
      `${pickups} pickup flags, ${pending} pending approvals, ${slots} boxes assigned.`,
  );
  for (const c of challans) {
    console.log(`  ${formatChallanNo(c.challanNo)}  →  ${c.site.name}`);
  }
  for (const c of siteChallans) {
    // c.challanNo is non-null by the where clause; c.site is non-null because
    // a numbered delivery is a direct-to-site one by construction.
    console.log(`  ${formatSiteChallanNo(c.challanNo!)}  →  ${c.site!.name} (direct)`);
  }
  for (const c of transferChallans) {
    console.log(`  ${formatTransferChallanNo(c.challanNo)}  →  ${c.fromSite.name} → ${c.toSite.name}`);
  }
  for (const a of accounts) {
    console.log(`  ${a.role.padEnd(8)} ${a.email} / ${a.password}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("\nDemo seed failed:", error instanceof Error ? error.message : error);
  console.error("Nothing was written — the whole seed is one transaction.");
  process.exitCode = 1;
});
