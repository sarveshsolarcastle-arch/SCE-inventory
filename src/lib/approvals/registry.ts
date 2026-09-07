/* -------------------------------------------------------------------------
 * The operations registry — one entry per thing a FINANCE user may ask an
 * admin to carry out, and the single place that binds a kind to the code
 * behind it.
 *
 * WHY A REGISTRY AT ALL. An ApprovalRequest is not a note describing an
 * intention, it is REPLAYABLE: `kind` names an entry here and `args` is its
 * JSON payload, re-parsed when an admin approves — exactly as
 * Transaction.appliedPlan is re-parsed at reversal time. Approving does not
 * "unlock a button", it runs the operation, attributed to the requester.
 * Without a table like this the approve path would need a switch of its own,
 * and the two spellings of "what site.delete means" would drift.
 *
 * A NAMING COLLISION TO AVOID, repeated from kinds.ts because this is the file
 * a newcomer opens first: "approval" is already taken in this codebase.
 * ApprovedOpens (packs.ts) and needsApproval (transactions.ts, dispatches.ts)
 * are the IN-REQUEST handshake where one user confirms "yes, break open 2
 * sealed packs" — same request, same person, nothing to do with roles.
 *
 * IMPORTS RUN ONE WAY: actions → registry → ops. The operation bodies live in
 * plain modules under ops/ rather than in the `"use server"` action files,
 * because every async export of those files is a network-reachable RPC
 * endpoint — see the header of ops/sites.ts. Nothing here may import from
 * @/lib/actions.
 * ---------------------------------------------------------------------- */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { describeObstacle } from "@/lib/corrections";
import { describeSiteBlockers } from "@/lib/siteBlockers";
import { describeRefusal, planAdjustment } from "@/lib/adjustment";
import * as siteOps from "./ops/sites";
import * as shelfOps from "./ops/shelf";
import * as correctionOps from "./ops/corrections";
import {
  parseReverseDispatchArgs,
  parseReverseTransactionArgs,
  parseShelfCreateArgs,
  parseShelfDeleteArgs,
  parseSiteCreateArgs,
  parseSiteDeleteArgs,
  parseSiteUpdateArgs,
  parseSlotBoxTypeArgs,
  parseSlotFrontRowArgs,
  parseSlotItemArgs,
  parseStockAdjustArgs,
} from "./args";
import type { ArgsFor, OperationKind } from "./kinds";
import { formatPrecheck, type Precheck } from "./precheck";
import { describeKind } from "./summary";
import { revalidateCorrections, revalidateShelf, revalidateSites } from "./revalidate";

/** What each operation hands back on success. Void for the ones whose whole
 * effect is in the database — only the three that create or rename something
 * have anything to say, and only so the direct path can navigate to it. */
export type ResultFor<K extends OperationKind> = {
  "site.create": { id: string; name: string };
  "site.update": { id: string; name: string };
  "site.delete": { name: string };
  "shelf.create": { id: string; name: string };
  "shelf.delete": { name: string };
  "shelf.slot.boxType": void;
  "shelf.slot.item": void;
  "shelf.slot.frontRow": void;
  "stock.reverseTransaction": void;
  "stock.reverseDispatch": void;
  "stock.adjust": void;
}[K];

export type Operation<Args, Result> = {
  /** PURE. Validates a payload from a form OR round-tripped through the
   * database. Runs on both paths, so what an admin approves is checked by the
   * same code that checked what finance asked for. */
  parse(raw: unknown): Args;

  /** Built SERVER-side at request time and frozen into ApprovalRequest.summary.
   * Never from a requester-supplied label: finance could otherwise label a
   * delete of site A as "delete site B" and phish an approval out of an admin
   * who read only the summary. */
  summarise(args: Args): Promise<string>;

  /** Identifies the row acted on, to collapse duplicate pending requests. Null
   * where there is nothing sensible to key on. */
  targetKey(args: Args): string | null;

  /** Re-run LIVE at render time on /approvals. Never writes. The frozen summary
   * says what was asked; this says what would happen now, and the gap between
   * them is the whole point. */
  precheck(args: Args): Promise<Precheck>;

  /** Runs inside a transaction the CALLER owns — the approve path needs the
   * status flip and the work in one transaction, and Prisma has no nested
   * interactive transactions. Must not redirect: redirect() throws
   * NEXT_REDIRECT, which the approve path's catch would misread as an execution
   * failure and record as a bogus FAILED. */
  execute(tx: Prisma.TransactionClient, args: Args, actorId: string): Promise<Result>;

  /** After commit, on both the direct and the approved path. Never inside the
   * transaction callback: it would advertise a change that later rolled back. */
  revalidate(args: Args, result: Result): void;
};

/* NO `redirectTo` here, though stage 4c had one. It turned out to have exactly
 * one consumer each — the action that owns it — because /approvals deliberately
 * ignores it: where to go after a write is a fact about the screen the user was
 * on, not about the operation. Two places describing one navigation, reached
 * through an optional call, cost more than the literal `redirect()` now sitting
 * in the action beside the form it belongs to. Removed in stage 5, when the
 * second consumer failed to appear. */

/* Deliberately NO `capability` field on Operation, though the plan sketched
 * one. It already exists — CAPABILITY_FOR_KIND in kinds.ts — in a file pure
 * enough to be tested, and a second copy here would be a second thing to keep
 * right, with a wrong entry producing no type error and no visible symptom
 * until someone could do work they should have had to ask for. Callers read
 * CAPABILITY_FOR_KIND[kind].
 *
 * Same instinct in the mapped type below rather than a plain object literal: a
 * missing entry becomes a compile error instead of an `undefined` discovered at
 * the moment an admin clicks Approve. */
type Registry = { [K in OperationKind]: Operation<ArgsFor<K>, ResultFor<K>> };

/* ---- shared lookups for summaries and prechecks ----------------------- */

/** Summaries and prechecks read through the plain client, never a transaction:
 * they write nothing, and a precheck must reflect the world as it is at the
 * instant the admin looks. `prisma` satisfies TransactionClient structurally,
 * so the ops helpers take it unchanged. */
const db: Prisma.TransactionClient = prisma;

async function siteName(siteId: string): Promise<string | null> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true },
  });
  return site?.name ?? null;
}

async function shelfName(shelfId: string): Promise<string | null> {
  const shelf = await prisma.shelf.findUnique({
    where: { id: shelfId },
    select: { name: true },
  });
  return shelf?.name ?? null;
}

async function slotLabel(slotId: string): Promise<string | null> {
  const slot = await prisma.shelfSlot.findUnique({
    where: { id: slotId },
    select: { tagCode: true },
  });
  return slot ? `box ${slot.tagCode}` : null;
}

async function itemName(itemId: string): Promise<string | null> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { name: true },
  });
  return item?.name ?? null;
}

/** A movement named the way a human would name it, so an admin approving a
 * reversal reads what is being undone rather than a cuid. */
async function movementLabel(transactionId: string): Promise<string | null> {
  const movement = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      type: true,
      quantity: true,
      createdAt: true,
      item: { select: { name: true, baseUnit: true } },
    },
  });
  if (!movement) return null;
  return (
    `the ${movement.type} of ${movement.quantity} ${movement.item.baseUnit} of ` +
    `${movement.item.name} on ${movement.createdAt.toLocaleDateString()}`
  );
}

async function dispatchLabel(dispatchId: string): Promise<string | null> {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: {
      reference: true,
      dispatchedAt: true,
      site: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
  });
  if (!dispatch) return null;
  const named = dispatch.reference ? `dispatch ${dispatch.reference}` : "the dispatch";
  return (
    `${named} to ${dispatch.site.name} of ` +
    `${dispatch.dispatchedAt.toLocaleDateString()} (${dispatch._count.transactions} lines)`
  );
}

/** "The row this acts on has gone since it was asked for." Not a failure to
 * warn about — there is simply nothing left to do. */
function missing(what: string): Precheck {
  return formatPrecheck({ kind: "missing", what });
}

const CLEAR: Precheck = formatPrecheck({ kind: "clear" });

/* ---- the registry ------------------------------------------------------ */

export const OPERATIONS: Registry = {
  "site.create": {
    parse: parseSiteCreateArgs,
    summarise: async (args) => describeKind("site.create", { ...args }),
    // Nothing exists yet to key on, so key on the NAME: two people asking for
    // the same new site is the duplicate worth collapsing, and an exact match
    // is the only one that can be collapsed safely.
    targetKey: (args) => `Site:new:${args.name.toLowerCase()}`,
    precheck: async () => CLEAR,
    execute: (tx, args) => siteOps.createSite(tx, args),
    revalidate: () => revalidateSites(),
  },

  "site.update": {
    parse: parseSiteUpdateArgs,
    summarise: async (args) =>
      describeKind("site.update", { ...args }, { site: await siteName(args.siteId) }),
    targetKey: (args) => `Site:${args.siteId}`,
    precheck: async (args) =>
      (await siteName(args.siteId)) === null ? missing("That site") : CLEAR,
    execute: (tx, args) => siteOps.updateSite(tx, args),
    revalidate: (args) => revalidateSites(args.siteId),
  },

  "site.delete": {
    parse: parseSiteDeleteArgs,
    summarise: async (args) =>
      describeKind("site.delete", { ...args }, { site: await siteName(args.siteId) }),
    targetKey: (args) => `Site:${args.siteId}`,
    // The precheck the feature was really built for. A site that was empty when
    // finance asked may have had a dispatch sent to it since, and the admin
    // must read that BEFORE approving — in the operation's own words, from the
    // operation's own function, so the two cannot drift.
    precheck: async (args) => {
      const name = await siteName(args.siteId);
      if (name === null) return missing("That site");
      const blocked = describeSiteBlockers(
        name,
        await siteOps.countSiteBlockers(db, args.siteId)
      );
      return blocked ? formatPrecheck({ kind: "blocked", reason: blocked }) : CLEAR;
    },
    execute: (tx, args) => siteOps.deleteSite(tx, args),
    revalidate: () => revalidateSites(),
  },

  "shelf.create": {
    parse: parseShelfCreateArgs,
    summarise: async (args) => describeKind("shelf.create", { ...args }),
    targetKey: (args) => `Shelf:new:${args.name.toLowerCase()}`,
    precheck: async () => CLEAR,
    execute: (tx, args) => shelfOps.createShelf(tx, args),
    revalidate: () => revalidateShelf(),
  },

  "shelf.delete": {
    parse: parseShelfDeleteArgs,
    summarise: async (args) =>
      describeKind("shelf.delete", { ...args }, { shelf: await shelfName(args.shelfId) }),
    targetKey: (args) => `Shelf:${args.shelfId}`,
    // WARNS rather than blocks, and the difference is a schema fact rather than
    // a preference: a shelf is furniture. Nothing points at it but its own
    // slots, so a delete destroys placement — where things sit — and no history
    // whatsoever. Stock is untouched. See ops/shelf.ts.
    precheck: async (args) => {
      if ((await shelfName(args.shelfId)) === null) return missing("That shelf");
      const { assignedBoxes, placedPacks } = await shelfOps.countShelfContents(
        db,
        args.shelfId
      );
      if (!assignedBoxes && !placedPacks) return CLEAR;
      return formatPrecheck({
        kind: "destructive",
        consequence:
          `This will work, and will forget where things sit: ${assignedBoxes} ` +
          `${assignedBoxes === 1 ? "box has" : "boxes have"} an item assigned and ` +
          `${placedPacks} ${placedPacks === 1 ? "pack is" : "packs are"} recorded on ` +
          `this shelf. No stock and no history is lost.`,
      });
    },
    execute: (tx, args) => shelfOps.deleteShelf(tx, args),
    revalidate: () => revalidateShelf(),
  },

  "shelf.slot.boxType": {
    parse: parseSlotBoxTypeArgs,
    summarise: async (args) =>
      describeKind(
        "shelf.slot.boxType",
        { ...args },
        { shelf: await shelfName(args.shelfId), slot: await slotLabel(args.slotId) }
      ),
    targetKey: (args) => `ShelfSlot:${args.slotId}`,
    precheck: async (args) =>
      (await slotLabel(args.slotId)) === null ? missing("That box") : CLEAR,
    execute: (tx, args) => shelfOps.updateSlotBoxType(tx, args),
    revalidate: (args) => revalidateShelf(args.shelfId),
  },

  "shelf.slot.item": {
    parse: parseSlotItemArgs,
    summarise: async (args) =>
      describeKind(
        "shelf.slot.item",
        { ...args },
        {
          shelf: await shelfName(args.shelfId),
          slot: await slotLabel(args.slotId),
          item: args.itemId ? await itemName(args.itemId) : null,
        }
      ),
    targetKey: (args) => `ShelfSlot:${args.slotId}`,
    precheck: async (args) => {
      if ((await slotLabel(args.slotId)) === null) return missing("That box");
      if (args.itemId && (await itemName(args.itemId)) === null) {
        return missing("The item this would put in it");
      }
      return CLEAR;
    },
    execute: (tx, args) => shelfOps.assignSlotItem(tx, args),
    revalidate: (args) => revalidateShelf(args.shelfId),
  },

  "shelf.slot.frontRow": {
    parse: parseSlotFrontRowArgs,
    summarise: async (args) =>
      describeKind(
        "shelf.slot.frontRow",
        { ...args },
        { shelf: await shelfName(args.shelfId), slot: await slotLabel(args.slotId) }
      ),
    targetKey: (args) => `ShelfSlot:${args.slotId}`,
    precheck: async (args) =>
      (await slotLabel(args.slotId)) === null ? missing("That box") : CLEAR,
    execute: (tx, args) => shelfOps.toggleFrontRow(tx, args),
    revalidate: (args) => revalidateShelf(args.shelfId),
  },

  "stock.reverseTransaction": {
    parse: parseReverseTransactionArgs,
    summarise: async (args) =>
      describeKind(
        "stock.reverseTransaction",
        { ...args },
        { movement: await movementLabel(args.transactionId) }
      ),
    targetKey: (args) => `Transaction:${args.transactionId}`,
    // The admin reads the SAME sentence the operation would produce, because it
    // comes from the same describeObstacle over the same findObstaclesFor.
    precheck: async (args) => {
      const movement = await prisma.transaction.findUnique({
        where: { id: args.transactionId },
      });
      if (!movement) return missing("That stock movement");
      if (movement.type === "REVERSAL" || movement.type === "ADJUSTMENT") {
        return formatPrecheck({
          kind: "blocked",
          reason: "corrections cannot themselves be reversed — record a new one",
        });
      }
      const obstacles = await correctionOps.findObstaclesFor(db, movement);
      return obstacles.length
        ? formatPrecheck({ kind: "blocked", reason: describeObstacle(obstacles[0]) })
        : CLEAR;
    },
    execute: (tx, args, actorId) => correctionOps.reverseTransaction(tx, args, actorId),
    revalidate: () => revalidateCorrections(),
  },

  "stock.reverseDispatch": {
    parse: parseReverseDispatchArgs,
    summarise: async (args) =>
      describeKind(
        "stock.reverseDispatch",
        { ...args },
        { dispatch: await dispatchLabel(args.dispatchId) }
      ),
    targetKey: (args) => `Dispatch:${args.dispatchId}`,
    // Checks EVERY line, not just the first. The operation is all-or-nothing —
    // one obstacle anywhere aborts the batch — so an admin told "ready" because
    // line 1 was fine would be misled. A dozen small reads, on a page that
    // holds a handful of pending requests.
    precheck: async (args) => {
      if ((await dispatchLabel(args.dispatchId)) === null) return missing("That dispatch");
      const movements = await prisma.transaction.findMany({
        where: { dispatchId: args.dispatchId, type: "ISSUE", reversedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (!movements.length) {
        return formatPrecheck({
          kind: "blocked",
          reason: "nothing is left to reverse on this dispatch",
        });
      }
      for (const movement of movements) {
        const obstacles = await correctionOps.findObstaclesFor(db, movement);
        if (obstacles.length) {
          return formatPrecheck({
            kind: "blocked",
            reason: describeObstacle(obstacles[0]),
          });
        }
      }
      return CLEAR;
    },
    execute: (tx, args, actorId) => correctionOps.reverseDispatch(tx, args, actorId),
    revalidate: () => revalidateCorrections(),
  },

  "stock.adjust": {
    parse: parseStockAdjustArgs,
    summarise: async (args) =>
      describeKind("stock.adjust", { ...args }, { item: await itemName(args.itemId) }),
    targetKey: (args) => `Item:${args.itemId}`,
    // Re-plans the count against the packs as they are NOW. What gets applied
    // is the size of the error the counter found, which survives legitimate
    // movement in the meantime — so an approval sitting overnight is still
    // correct. What does NOT survive is a pack used up or scrapped since: that
    // refuses the whole count, and the admin should read it here rather than
    // after clicking.
    precheck: async (args) => {
      const item = await prisma.item.findUnique({
        where: { id: args.itemId },
        select: { baseUnit: true },
      });
      if (!item) return missing("That item");

      const [sealedNow, openNow] = await Promise.all([
        prisma.packStock.findMany({ where: { itemId: args.itemId } }),
        prisma.openPack.findMany({ where: { itemId: args.itemId, state: "OPEN" } }),
      ]);
      const plan = planAdjustment(
        { sealed: args.sealed, open: args.open },
        {
          sealed: sealedNow.map((g) => ({
            packSize: g.packSize,
            sealedCount: g.sealedCount,
          })),
          open: openNow.map((p) => ({
            id: p.id,
            remaining: p.remaining,
            originalSize: p.originalSize,
          })),
        }
      );
      return plan.refusals.length
        ? formatPrecheck({
            kind: "blocked",
            reason: plan.refusals.map((r) => describeRefusal(r, item.baseUnit)).join(" "),
          })
        : CLEAR;
    },
    execute: (tx, args, actorId) => correctionOps.adjustStock(tx, args, actorId),
    revalidate: () => revalidateCorrections(),
  },
};

/** The registry entry for a kind, typed to that kind's arguments and result. */
export function operationFor<K extends OperationKind>(
  kind: K
): Operation<ArgsFor<K>, ResultFor<K>> {
  return OPERATIONS[kind];
}
