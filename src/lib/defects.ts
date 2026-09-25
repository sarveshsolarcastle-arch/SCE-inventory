import type { Prisma } from "@/generated/prisma/client";
import type { AllocationRequest } from "./allocation.ts";
import {
  emptyAppliedPlan,
  serialiseAppliedPlan,
  type AppliedPlan,
} from "./corrections.ts";
import { commitAllocation, recalcItemStock, type ApprovedOpens } from "./packs.ts";
import { piecesTotal, type Piece } from "./units.ts";

/* -------------------------------------------------------------------------
 * Marking stock defective whenever it is noticed.
 *
 * Until this existed a defect could only be declared at two moments: on a
 * delivery (damaged on arrival) and on a return (came back damaged). Anything
 * that went bad while sitting on the shelf had no way in, so the only option was
 * a stock adjustment — which writes it off as "missing", loses the fact that
 * it was defective, and leaves nothing to claim from the supplier.
 *
 * This is a store-side movement. It takes the material out of stock exactly the
 * way an ISSUE does — same allocator, same open-a-sealed-pack handshake, same
 * appliedPlan — so reversal needs no new code: replaying the plan backwards puts
 * the packs back and deletes the DefectiveItem rows (only while still
 * QUARANTINED; see findReversalObstacles). What differs from an issue is where
 * the goods END UP: a DefectiveItem for the supplier claim, not a site.
 * ---------------------------------------------------------------------- */

export type MarkDefectiveInput = {
  itemId: string;
  /** Whole sealed packs that are defective. */
  sealedPacks: { packSize: number; count: number }[];
  /** CONTINUOUS only: cut lengths that are defective, taken from one pack each. */
  pieces: Piece[];
  /** DISCRETE only: a loose quantity, pooled across open packs. */
  loose: number;
  /** Specific open packs that are defective in their entirety. Picked by id
   * rather than planned, because for wire "the roll with 47 m left" is a
   * particular roll, not any 47 m the allocator happens to find. */
  openPackIds: string[];
  note: string | null;
  approvedOpens: ApprovedOpens;
};

/** A refusal that is a sentence for the user, never a crash. */
export class DefectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DefectError";
  }
}

function positiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/** Pure shape check. The database-dependent refusals (not enough stock, an open
 * pack that is gone) are raised by markStockDefective inside the transaction,
 * where they are read fresh. */
export function validateMarkDefective(input: MarkDefectiveInput): string | null {
  if (!input.itemId) return "Choose an item";

  for (const p of input.sealedPacks) {
    if (!positiveInt(p.packSize) || !positiveInt(p.count)) {
      return "Pack sizes and counts must be whole numbers greater than zero";
    }
  }
  for (const p of input.pieces) {
    if (!positiveInt(p.length) || !positiveInt(p.count)) {
      return "Piece lengths and counts must be whole numbers greater than zero";
    }
  }
  if (input.loose !== 0 && !positiveInt(input.loose)) {
    return "Quantity must be a whole number greater than zero";
  }
  if (new Set(input.openPackIds).size !== input.openPackIds.length) {
    return "The same open pack was chosen twice";
  }

  const sealedTotal = input.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0);
  const requested = sealedTotal + piecesTotal(input.pieces) + input.loose;
  if (requested <= 0 && input.openPackIds.length === 0) return "Enter a quantity";
  return null;
}

/** Takes the requested material out of stock and records it as defective, all
 * inside the caller's transaction. Throws DefectError / AllocationFailedError /
 * StaleApprovalError; the action turns each into a message.
 *
 * ORDER MATTERS. Whole open packs are removed BEFORE the allocator reads its
 * snapshot, so a pack chosen here can never also be picked to be cut from. */
export async function markStockDefective(
  tx: Prisma.TransactionClient,
  input: MarkDefectiveInput,
  userId: string
): Promise<{ transactionId: string; total: number }> {
  const item = await tx.item.findUniqueOrThrow({ where: { id: input.itemId } });
  const note = input.note?.trim() || null;

  // A pack that has since been used up, scrapped or already marked is refused
  // rather than skipped: the person picked THAT pack, and quietly marking
  // fewer than they asked for is a silent failure.
  const wholeOpen = input.openPackIds.length
    ? await tx.openPack.findMany({
        where: { id: { in: input.openPackIds }, itemId: item.id, state: "OPEN" },
      })
    : [];
  if (wholeOpen.length !== input.openPackIds.length) {
    throw new DefectError(
      "One of the open packs you picked has been used up or moved since you loaded this page — reload and choose again."
    );
  }

  const request: AllocationRequest = {
    sealedPacks: input.sealedPacks,
    pieces: input.pieces,
    loose: input.loose,
  };
  const sealedTotal = input.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0);
  const allocatedTotal = sealedTotal + piecesTotal(input.pieces) + input.loose;
  const wholeOpenTotal = wholeOpen.reduce((s, p) => s + p.remaining, 0);
  const total = allocatedTotal + wholeOpenTotal;

  const movement = await tx.transaction.create({
    data: {
      type: "DEFECT",
      quantity: total,
      itemId: item.id,
      siteId: null,
      userId,
      note,
      packSize: input.sealedPacks[0]?.packSize ?? null,
      packCount: input.sealedPacks.reduce((s, p) => s + p.count, 0) || null,
      pieces: input.pieces.length ? JSON.stringify(input.pieces) : null,
    },
  });

  let applied: AppliedPlan = emptyAppliedPlan();

  for (const pack of wholeOpen) {
    applied.deleted.push({
      id: pack.id,
      remaining: pack.remaining,
      originalSize: pack.originalSize,
      state: pack.state,
      shelfSlotId: pack.shelfSlotId,
    });
    await tx.openPack.delete({ where: { id: pack.id } });
  }

  if (allocatedTotal > 0) {
    const result = await commitAllocation(tx, item, request, input.approvedOpens, userId);
    // commitAllocation's plan is the one that reversal replays; the packs
    // deleted above belong in it too so they are restored with their slots.
    result.applied.deleted.unshift(...applied.deleted);
    applied = result.applied;
  }

  // One row per sealed size keeps packSize/packCount meaningful for the claim
  // ("2 × 400 m rolls"). Everything else — cut lengths, a loose quantity, and
  // whole open packs — has no pack shape worth preserving, so it is one row.
  for (const p of input.sealedPacks) {
    const row = await tx.defectiveItem.create({
      data: {
        itemId: item.id,
        quantity: p.packSize * p.count,
        packSize: p.packSize,
        packCount: p.count,
        source: "STOCK",
        transactionId: movement.id,
        userId,
        note,
      },
    });
    applied.defectiveIds.push(row.id);
  }
  const rest = total - sealedTotal;
  if (rest > 0) {
    const row = await tx.defectiveItem.create({
      data: {
        itemId: item.id,
        quantity: rest,
        source: "STOCK",
        transactionId: movement.id,
        userId,
        note,
      },
    });
    applied.defectiveIds.push(row.id);
  }

  await recalcItemStock(tx, item.id);
  await tx.transaction.update({
    where: { id: movement.id },
    data: { appliedPlan: serialiseAppliedPlan(applied) },
  });

  return { transactionId: movement.id, total };
}
