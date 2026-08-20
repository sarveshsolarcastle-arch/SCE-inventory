"use server";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { applyInverse, recalcItemStock, addPacks } from "@/lib/packs";
import {
  describeObstacle,
  findReversalObstacles,
  parseAppliedPlan,
  type ReversalObstacle,
} from "@/lib/corrections";
import { reconcileForMovement } from "@/lib/sitePickups";

export type CorrectionResult = { ok: true } | { ok: false; message: string };

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

/** The shared primitive behind both a single reversal and a whole-dispatch
 * one: verify the world still matches what this movement left behind, then
 * restore it. Throws (never returns a result) so a caller looping over many
 * movements in one $transaction aborts the lot on the first obstacle — a
 * batch reversal is all-or-nothing for the same reason a batch dispatch is. */
async function reverseMovementTx(
  tx: Prisma.TransactionClient,
  movement: ReversibleMovement,
  userId: string,
  reason: string
): Promise<void> {
  const obstacles: ReversalObstacle[] = [];
  if (movement.reversedAt) obstacles.push({ kind: "already_reversed" });
  if (movement.type === "REVERSAL" || movement.type === "ADJUSTMENT") {
    throw new Error("Corrections cannot themselves be reversed — record a new one");
  }

  const plan = parseAppliedPlan(movement.appliedPlan);
  if (!plan) obstacles.push({ kind: "no_plan" });

  if (plan && !obstacles.length) {
    const itemId = movement.itemId;
    const [openPacks, sealed, defective] = await Promise.all([
      tx.openPack.findMany({ where: { itemId } }),
      tx.packStock.findMany({ where: { itemId } }),
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
  }

  if (obstacles.length) throw new Error(describeObstacle(obstacles[0]));

  await applyInverse(tx, movement.itemId, plan!);

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
      userId,
      reason,
      reversesId: movement.id,
      note: `Reverses ${movement.type} of ${movement.createdAt.toLocaleDateString()}`,
    },
  });

  // Excluding the reversed movement changes what its site holds, so a pickup
  // flag there may now claim more than is present.
  await reconcileForMovement(tx, movement.itemId, [movement.siteId, movement.fromSiteId]);
}

/** Undoes a movement recorded in error by restoring the exact prior state.
 *
 * Nothing is deleted: the original stays, marked reversed and excluded from
 * aggregation, and a REVERSAL row records who undid it and why. Refuses when
 * the packs involved have moved on since — see findReversalObstacles. */
export async function reverseTransaction(
  transactionId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const { id: userId } = await requireCapability("stock:reverse");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required to reverse a movement" };

  try {
    await prisma.$transaction(async (tx) => {
      const movement = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
      await reverseMovementTx(tx, movement, userId, reason);
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Reversal failed" };
  }

  revalidateAll();
  return { ok: true };
}

/** Reverses every not-yet-reversed line of a batch dispatch, atomically: one
 * row failing its obstacle check aborts the whole dispatch's reversal, same
 * as the dispatch's own all-or-nothing commit. Each compensating REVERSAL
 * row carries the same dispatchId as the ISSUE it undoes, so the dispatch
 * page groups them as one event rather than N loose corrections. */
export async function reverseDispatch(
  dispatchId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const { id: userId } = await requireCapability("stock:reverse");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required to reverse a dispatch" };

  try {
    await prisma.$transaction(async (tx) => {
      const movements = await tx.transaction.findMany({
        where: { dispatchId, type: "ISSUE", reversedAt: null },
        orderBy: { createdAt: "asc" },
      });
      if (!movements.length) {
        throw new Error("Nothing left to reverse on this dispatch");
      }
      for (const movement of movements) {
        await reverseMovementTx(tx, movement, userId, reason);
      }
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Dispatch reversal failed",
    };
  }

  revalidateAll();
  return { ok: true };
}

/** Records a physical count that disagrees with the ledger, with the count
 * winning. Works at pack level, because "set the quantity" is ambiguous once an
 * item has both sealed and open stock. */
export async function adjustStock(
  itemId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const { id: userId } = await requireCapability("stock:adjust");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required for a stock adjustment" };

  // sealed_<packSize> = counted number of sealed packs of that size
  // open_<packId>     = counted remaining in that open pack
  const sealedCounts = new Map<number, number>();
  const openRemaining = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    const raw = String(value).trim();
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, message: "Counted quantities must be whole numbers of zero or more" };
    }
    if (key.startsWith("sealed_")) sealedCounts.set(Number(key.slice(7)), n);
    else if (key.startsWith("open_")) openRemaining.set(key.slice(5), n);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
      const before = item.currentStock;

      for (const [packSize, counted] of sealedCounts) {
        const existing = await tx.packStock.findUnique({
          where: { itemId_packSize: { itemId, packSize } },
        });
        if (existing) {
          await tx.packStock.update({
            where: { id: existing.id },
            data: { sealedCount: counted },
          });
        } else if (counted > 0) {
          await addPacks(tx, itemId, packSize, counted);
        }
      }

      for (const [packId, counted] of openRemaining) {
        if (counted === 0) {
          await tx.openPack.delete({ where: { id: packId } });
        } else {
          await tx.openPack.update({ where: { id: packId }, data: { remaining: counted } });
        }
      }

      await recalcItemStock(tx, itemId);
      const after = (await tx.item.findUniqueOrThrow({ where: { id: itemId } })).currentStock;

      // Recorded even when the delta is zero: that a count was taken and agreed
      // is itself worth knowing.
      await tx.transaction.create({
        data: {
          type: "ADJUSTMENT",
          quantity: Math.abs(after - before),
          itemId,
          userId,
          reason,
          note: `Counted ${after} ${item.baseUnit}, ledger said ${before}`,
        },
      });
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Adjustment failed" };
  }

  revalidateAll();
  return { ok: true };
}

function revalidateAll() {
  revalidatePath("/items", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/shelf");
  revalidatePath("/recycle");
  revalidatePath("/defective");
  revalidatePath("/sites", "layout");
  revalidatePath("/dispatches", "layout");
}
