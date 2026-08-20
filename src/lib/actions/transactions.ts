"use server";

import { prisma } from "@/lib/prisma";
import {
  NotPermittedError,
  requireCapability,
  type Capability,
} from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AllocationFailedError,
  StaleApprovalError,
  commitAllocation,
  readSnapshot,
  recalcItemStock,
  restock,
  openPack as openSealedPack,
  type ApprovedOpens,
} from "@/lib/packs";
import { planAllocation, type AllocationRequest } from "@/lib/allocation";
import { piecesTotal, type Piece } from "@/lib/units";
import { serialiseAppliedPlan } from "@/lib/corrections";

type TxType = "STOCK_IN" | "ISSUE" | "RETURN";

/** What the client sends for one movement. A bare quantity on a CONTINUOUS item
 * means ONE continuous piece — pieces are only pieces when entered as pieces. */
export type MovementInput = {
  itemId: string;
  type: TxType;
  siteId?: string | null;
  note?: string | null;
  /** Whole sealed packs, handed over or received untouched. */
  sealedPacks?: { packSize: number; count: number }[];
  /** CONTINUOUS only. */
  pieces?: Piece[];
  /** DISCRETE quantity, or loose material on a stock-in. */
  loose?: number;
  /** Portion of a RETURN that comes back damaged and must not re-enter stock. */
  defectiveQty?: number;
  /** Opens the user has explicitly agreed to on the confirmation screen. */
  approvedOpens?: ApprovedOpens;
};

export type MovementResult =
  | { ok: true }
  | { ok: false; message: string; needsApproval?: ApprovedOpens };

function requestOf(input: MovementInput): AllocationRequest {
  return {
    sealedPacks: input.sealedPacks ?? [],
    pieces: input.pieces ?? [],
    loose: input.loose ?? 0,
  };
}

function totalOf(request: AllocationRequest): number {
  const sealed = request.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0);
  return sealed + piecesTotal(request.pieces) + request.loose;
}

function positiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function validate(input: MovementInput, request: AllocationRequest): string | null {
  if (!input.itemId) return "Choose an item";
  if (!["STOCK_IN", "ISSUE", "RETURN"].includes(input.type)) return "Invalid transaction";

  for (const p of request.sealedPacks) {
    if (!positiveInt(p.packSize) || !positiveInt(p.count)) {
      return "Pack sizes and counts must be whole numbers greater than zero";
    }
  }
  for (const p of request.pieces) {
    if (!positiveInt(p.length) || !positiveInt(p.count)) {
      return "Piece lengths and counts must be whole numbers greater than zero";
    }
  }
  // Stricter than the old Number.isFinite check, which let 2.5 reach an Int column.
  if (request.loose !== 0 && !positiveInt(request.loose)) {
    return "Quantity must be a whole number greater than zero";
  }
  if (totalOf(request) <= 0) return "Enter a quantity";

  if ((input.type === "ISSUE" || input.type === "RETURN") && !input.siteId) {
    return "A site is required for issue/return transactions";
  }
  if (input.defectiveQty != null) {
    if (input.type !== "RETURN") return "Only returns can carry a defective quantity";
    if (!Number.isInteger(input.defectiveQty) || input.defectiveQty < 0) {
      return "Defective quantity must be a whole number";
    }
    if (input.defectiveQty > totalOf(request)) {
      return "Defective quantity cannot exceed the quantity returned";
    }
  }
  return null;
}

/** Net quantity of an item currently at a site (ISSUE − RETURN). */
async function netAtSite(
  tx: { transaction: { findMany: typeof prisma.transaction.findMany } },
  itemId: string,
  siteId: string
): Promise<number> {
  const rows = await tx.transaction.findMany({
    where: { itemId, siteId, type: { in: ["ISSUE", "RETURN"] }, reversedAt: null },
  });
  return rows.reduce((sum, t) => sum + (t.type === "ISSUE" ? t.quantity : -t.quantity), 0);
}

/** Which capability a movement needs depends on its type — a finance account can
 * record incoming stock but must not be able to issue it, and vice versa. */
const CAPABILITY_FOR_TYPE: Record<TxType, Capability> = {
  STOCK_IN: "delivery:record",
  ISSUE: "stock:issue",
  RETURN: "stock:return",
};

export async function recordMovement(input: MovementInput): Promise<MovementResult> {
  let userId: string;
  try {
    // Checked here, not just in the UI: server actions are directly invocable,
    // so hiding a button proves nothing.
    const user = await requireCapability(CAPABILITY_FOR_TYPE[input.type]);
    userId = user.id;
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: `Your account cannot record a ${input.type} transaction` };
    }
    return { ok: false, message: "Not signed in" };
  }

  const request = requestOf(input);
  const invalid = validate(input, request);
  if (invalid) return { ok: false, message: invalid };

  const total = totalOf(request);
  const siteId = input.siteId || null;
  const note = input.note?.trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUniqueOrThrow({ where: { id: input.itemId } });

      if (input.type === "RETURN" && siteId) {
        const atSite = await netAtSite(tx, item.id, siteId);
        if (atSite < total) {
          throw new AllocationFailedError(
            { cuts: [], opens: [], scrap: [], emptied: [], sealedTaken: [], totalBase: 0, issuedBase: 0, errors: [] },
            `Cannot return more than what's currently at the site (${atSite} ${item.baseUnit})`
          );
        }
      }

      const movement = await tx.transaction.create({
        data: {
          type: input.type,
          quantity: total,
          itemId: item.id,
          // Stock-in is never against a site; the paired direct-to-site form
          // arrives in a later phase.
          siteId: input.type === "STOCK_IN" ? null : siteId,
          userId,
          note,
          packSize: request.sealedPacks[0]?.packSize ?? null,
          packCount: request.sealedPacks.reduce((s, p) => s + p.count, 0) || null,
          pieces: request.pieces.length ? JSON.stringify(request.pieces) : null,
          defectiveQty: input.defectiveQty || null,
        },
      });

      if (input.type === "ISSUE") {
        const { applied } = await commitAllocation(
          tx,
          item,
          request,
          input.approvedOpens ?? [],
          userId
        );
        await tx.transaction.update({
          where: { id: movement.id },
          data: { appliedPlan: serialiseAppliedPlan(applied) },
        });
        return;
      }

      // STOCK_IN and RETURN both add material. On a return the defective portion
      // is quarantined rather than restocked: the site still loses the full
      // amount (its ledger must be right), but the store gains only the good part.
      const lengths = request.pieces.flatMap((p) =>
        Array.from({ length: p.count }, () => p.length)
      );
      if (request.loose > 0) lengths.push(request.loose);
      const looseBase = lengths.reduce((s, l) => s + l, 0);

      const defective = input.defectiveQty ?? 0;
      // Which individual offcut was damaged is not knowable from a single
      // number, so the good remainder comes back as one pack rather than
      // guessing an attribution across pieces.
      const goodLengths =
        defective === 0
          ? lengths
          : looseBase > defective
            ? [looseBase - defective]
            : [];

      const { applied } = await restock(tx, item, {
        sealedPacks: request.sealedPacks,
        lengths: goodLengths,
        userId,
      });

      if (defective > 0) {
        const row = await tx.defectiveItem.create({
          data: {
            itemId: item.id,
            quantity: defective,
            source: "RETURN",
            transactionId: movement.id,
            siteId,
            userId,
            note,
          },
        });
        applied.defectiveIds.push(row.id);
      }

      await tx.transaction.update({
        where: { id: movement.id },
        data: { appliedPlan: serialiseAppliedPlan(applied) },
      });
    });
  } catch (error) {
    if (error instanceof StaleApprovalError) {
      return { ok: false, message: error.message, needsApproval: error.required };
    }
    if (error instanceof AllocationFailedError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidateStock(input.itemId, siteId);
  return { ok: true };
}

/** Explicitly opens one sealed pack — the storeman opening a roll at the shelf,
 * rather than as part of an issue. */
export async function openPackAction(formData: FormData) {
  "use server";
  const { id: userId } = await requireCapability("stock:issue");

  const itemId = String(formData.get("itemId") ?? "");
  const packSize = Number(formData.get("packSize") ?? 0);
  const shelfSlotId = String(formData.get("shelfSlotId") ?? "") || null;
  if (!itemId || !Number.isInteger(packSize) || packSize <= 0) {
    throw new Error("Choose a pack size to open");
  }

  await prisma.$transaction(async (tx) => {
    await openSealedPack(tx, { itemId, packSize, userId, shelfSlotId });
    await recalcItemStock(tx, itemId);
  });

  revalidateStock(itemId, null);
  redirect(`/items/${itemId}`);
}

function revalidateStock(itemId: string, siteId: string | null) {
  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  revalidatePath("/dashboard");
  revalidatePath("/shelf");
  revalidatePath("/shelf/suggestions");
  revalidatePath("/recycle");
  revalidatePath("/defective");
  if (siteId) revalidatePath(`/sites/${siteId}`);
}
