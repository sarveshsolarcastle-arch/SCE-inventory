/* Correction operations over a caller-owned transaction. See ops/sites.ts for
 * why these bodies do not live in the `"use server"` action file.
 *
 * Everything here takes an `actorId` rather than reading the session, because
 * approved work is attributed to the REQUESTER, not to the admin who approved
 * it: the finance user is the one who decided a movement was wrong, and
 * Transaction.userId is the accountability trail. Who approved it is recorded
 * separately, on the ApprovalRequest row. */

import type { Prisma } from "@/generated/prisma/client";
import { applyInverse, recalcItemStock, addPacks } from "@/lib/packs";
import {
  describeObstacle,
  findReversalObstacles,
  parseAppliedPlan,
  type ReversalObstacle,
} from "@/lib/corrections";
import { reconcileForMovement } from "@/lib/sitePickups";
import {
  describeAdjustment,
  describeRefusal,
  planAdjustment,
} from "@/lib/adjustment";
import type {
  ReverseDispatchArgs,
  ReverseTransactionArgs,
  StockAdjustArgs,
} from "../kinds";

type ReversibleMovement = {
  id: string;
  type: string;
  itemId: string;
  siteId: string | null;
  fromSiteId: string | null;
  dispatchId: string | null;
  quantity: number;
  appliedPlan: string | null;
  reversedAt: Date | null;
  createdAt: Date;
};

/** Everything standing in the way of reversing one movement, without changing
 * anything. Shared by the operation, which throws on the first obstacle, and
 * the approvals precheck, which shows it — so the admin reads the same sentence
 * the operation would have produced. */
export async function findObstaclesFor(
  tx: Prisma.TransactionClient,
  movement: ReversibleMovement
): Promise<ReversalObstacle[]> {
  const obstacles: ReversalObstacle[] = [];
  if (movement.reversedAt) obstacles.push({ kind: "already_reversed" });

  const plan = parseAppliedPlan(movement.appliedPlan);
  if (!plan) {
    obstacles.push({ kind: "no_plan" });
    return obstacles;
  }
  if (obstacles.length) return obstacles;

  const [openPacks, sealed, defective] = await Promise.all([
    tx.openPack.findMany({ where: { itemId: movement.itemId } }),
    tx.packStock.findMany({ where: { itemId: movement.itemId } }),
    plan.defectiveIds.length
      ? tx.defectiveItem.findMany({ where: { id: { in: plan.defectiveIds } } })
      : Promise.resolve([]),
  ]);

  obstacles.push(
    ...findReversalObstacles(plan, {
      openPacks: new Map(
        openPacks.map((p) => [p.id, { remaining: p.remaining, state: p.state }])
      ),
      sealedCounts: new Map(sealed.map((s) => [s.packSize, s.sealedCount])),
      defectiveStatuses: new Map(defective.map((d) => [d.id, d.status])),
    })
  );
  return obstacles;
}

/** The shared primitive behind both a single reversal and a whole-dispatch one:
 * verify the world still matches what this movement left behind, then restore
 * it. Throws (never returns a result) so a caller looping over many movements
 * in one transaction aborts the lot on the first obstacle — a batch reversal is
 * all-or-nothing for the same reason a batch dispatch is. */
async function reverseMovementTx(
  tx: Prisma.TransactionClient,
  movement: ReversibleMovement,
  actorId: string,
  reason: string
): Promise<void> {
  if (movement.type === "REVERSAL" || movement.type === "ADJUSTMENT") {
    throw new Error("Corrections cannot themselves be reversed — record a new one");
  }

  const obstacles = await findObstaclesFor(tx, movement);
  if (obstacles.length) throw new Error(describeObstacle(obstacles[0]));

  await applyInverse(tx, movement.itemId, parseAppliedPlan(movement.appliedPlan)!);

  await tx.transaction.update({
    where: { id: movement.id },
    data: { reversedAt: new Date() },
  });

  await tx.transaction.create({
    data: {
      type: "REVERSAL",
      quantity: movement.quantity,
      itemId: movement.itemId,
      siteId: movement.siteId,
      dispatchId: movement.dispatchId,
      userId: actorId,
      reason,
      reversesId: movement.id,
      note: `Reverses ${movement.type} of ${movement.createdAt.toLocaleDateString()}`,
    },
  });

  // Excluding the reversed movement changes what its site holds, so a pickup
  // flag there may now claim more than is present.
  await reconcileForMovement(tx, movement.itemId, [movement.siteId, movement.fromSiteId]);
}

export async function reverseTransaction(
  tx: Prisma.TransactionClient,
  args: ReverseTransactionArgs,
  actorId: string
): Promise<void> {
  const movement = await tx.transaction.findUniqueOrThrow({
    where: { id: args.transactionId },
  });
  await reverseMovementTx(tx, movement, actorId, args.reason);
}

/** Reverses every not-yet-reversed line of a batch dispatch, atomically: one
 * row failing its obstacle check aborts the whole dispatch's reversal, same as
 * the dispatch's own all-or-nothing commit. Each compensating REVERSAL row
 * carries the same dispatchId as the ISSUE it undoes, so the dispatch and site
 * pages group them as one event rather than N loose corrections. */
export async function reverseDispatch(
  tx: Prisma.TransactionClient,
  args: ReverseDispatchArgs,
  actorId: string
): Promise<void> {
  const movements = await tx.transaction.findMany({
    where: { dispatchId: args.dispatchId, type: "ISSUE", reversedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!movements.length) throw new Error("Nothing left to reverse on this dispatch");

  for (const movement of movements) {
    await reverseMovementTx(tx, movement, actorId, args.reason);
  }
}

/** Applies a counted stock correction.
 *
 * What is applied is the DIFFERENCE between what was counted and the ledger
 * figure the counter was looking at — never the count itself. See
 * src/lib/adjustment.ts: the size of an error survives legitimate movement
 * between the count and its application, whereas a total does not. That
 * mattered before approvals existed (a dispatch could land between opening the
 * form and pressing submit) and matters far more now, when the gap can be
 * hours. */
export async function adjustStock(
  tx: Prisma.TransactionClient,
  args: StockAdjustArgs,
  actorId: string
): Promise<void> {
  const item = await tx.item.findUniqueOrThrow({ where: { id: args.itemId } });
  const before = item.currentStock;

  // Only OPEN packs, matching what the count form renders. A pack scrapped
  // since the count therefore reads as gone, which is right: the counter was
  // looking at usable stock.
  const [sealedNow, openNow] = await Promise.all([
    tx.packStock.findMany({ where: { itemId: args.itemId } }),
    tx.openPack.findMany({ where: { itemId: args.itemId, state: "OPEN" } }),
  ]);

  const plan = planAdjustment(
    { sealed: args.sealed, open: args.open },
    {
      sealed: sealedNow.map((g) => ({ packSize: g.packSize, sealedCount: g.sealedCount })),
      open: openNow.map((p) => ({
        id: p.id,
        remaining: p.remaining,
        originalSize: p.originalSize,
      })),
    }
  );

  // All or nothing: a partial count is not a count.
  if (plan.refusals.length) {
    throw new Error(plan.refusals.map((r) => describeRefusal(r, item.baseUnit)).join(" "));
  }

  for (const change of plan.sealed) {
    if (change.delta > 0) {
      // upsert, so a size the store had run out of can be corrected back up
      await addPacks(tx, args.itemId, change.packSize, change.delta);
    } else {
      await tx.packStock.update({
        where: { itemId_packSize: { itemId: args.itemId, packSize: change.packSize } },
        data: { sealedCount: { decrement: -change.delta } },
      });
    }
  }

  for (const change of plan.open) {
    if (change.deletes) {
      await tx.openPack.delete({ where: { id: change.packId } });
    } else {
      await tx.openPack.update({
        where: { id: change.packId },
        data: { remaining: { increment: change.delta } },
      });
    }
  }

  await recalcItemStock(tx, args.itemId);
  const after = (await tx.item.findUniqueOrThrow({ where: { id: args.itemId } }))
    .currentStock;

  // Recorded even when the correction is zero: that a count was taken and
  // agreed is itself worth knowing.
  await tx.transaction.create({
    data: {
      type: "ADJUSTMENT",
      // The real effect on stock, which is what the reports aggregate — not the
      // size of the correction, which the note carries instead.
      quantity: Math.abs(after - before),
      itemId: args.itemId,
      userId: actorId,
      reason: args.reason,
      note: describeAdjustment(plan, before, after, item.baseUnit),
    },
  });
}
