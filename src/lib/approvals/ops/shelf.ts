/* Shelf operations over a caller-owned transaction. See ops/sites.ts for why
 * these bodies do not live in the `"use server"` action file. */

import type { Prisma } from "@/generated/prisma/client";
import { BOX_TYPES, type BoxType } from "@/lib/boxTypes";
import type {
  ShelfCreateArgs,
  ShelfDeleteArgs,
  SlotBoxTypeArgs,
  SlotFrontRowArgs,
  SlotItemArgs,
} from "../kinds";

export async function createShelf(
  tx: Prisma.TransactionClient,
  args: ShelfCreateArgs
): Promise<{ id: string; name: string }> {
  const shelf = await tx.shelf.create({
    data: { name: args.name, rows: args.rows, columns: args.columns },
  });

  const slots: {
    shelfId: string;
    side: "FRONT" | "BACK";
    row: number;
    column: number;
    tagCode: string;
    boxType: BoxType;
  }[] = [];
  for (const side of ["FRONT", "BACK"] as const) {
    for (let row = 1; row <= args.rows; row++) {
      for (let column = 1; column <= args.columns; column++) {
        const key = `${side}-${row}-${column}`;
        const chosen = args.boxTypes[key];
        slots.push({
          shelfId: shelf.id,
          side,
          row,
          column,
          tagCode: `${side === "FRONT" ? "F" : "B"}${row}-${column}`,
          boxType: BOX_TYPES.includes(chosen) ? chosen : "FRESH",
        });
      }
    }
  }
  await tx.shelfSlot.createMany({ data: slots });

  return { id: shelf.id, name: shelf.name };
}

/** Relabels a slot's condition (Fresh/Opened/Recyclable). A slot no longer
 * stores a quantity — how much is in a box is derived from the item's packs —
 * so this only changes the label. */
export async function updateSlotBoxType(
  tx: Prisma.TransactionClient,
  args: SlotBoxTypeArgs
): Promise<void> {
  await tx.shelfSlot.update({
    where: { id: args.slotId },
    data: { boxType: args.boxType },
  });
}

/** Assigns (or clears) which item lives in a box. Placement is a physical fact
 * that cannot be derived, so it is set by hand — but only the placement: the
 * quantity shown comes from the item's packs. */
export async function assignSlotItem(
  tx: Prisma.TransactionClient,
  args: SlotItemArgs
): Promise<void> {
  const slot = await tx.shelfSlot.findUniqueOrThrow({ where: { id: args.slotId } });

  // Open packs sitting in this box belong to whoever occupied it.
  if (slot.itemId && slot.itemId !== args.itemId) {
    await tx.openPack.updateMany({
      where: { shelfSlotId: args.slotId },
      data: { shelfSlotId: null },
    });
  }

  await tx.shelfSlot.update({ where: { id: args.slotId }, data: { itemId: args.itemId } });

  // An Opened or Recyclable box is defined by the individual packs in it, so
  // adopt any of this item's packs of the matching state that aren't already
  // in a box. Without this the box would stay permanently empty: nothing else
  // ever sets an open pack's location.
  if (args.itemId && (slot.boxType === "OPENED" || slot.boxType === "RECYCLABLE")) {
    await tx.openPack.updateMany({
      where: {
        itemId: args.itemId,
        shelfSlotId: null,
        state: slot.boxType === "OPENED" ? "OPEN" : "SCRAP",
      },
      data: { shelfSlotId: args.slotId },
    });
  }
}

export async function toggleFrontRow(
  tx: Prisma.TransactionClient,
  args: SlotFrontRowArgs
): Promise<void> {
  const slot = await tx.shelfSlot.findUniqueOrThrow({ where: { id: args.slotId } });
  await tx.shelfSlot.update({
    where: { id: args.slotId },
    data: { isFrontRow: !slot.isFrontRow },
  });
}

/** What deleting a shelf would destroy — placement, and nothing else. Shared by
 * the confirm dialog and the approvals precheck. */
export async function countShelfContents(
  tx: Prisma.TransactionClient,
  shelfId: string
): Promise<{ assignedBoxes: number; placedPacks: number }> {
  return {
    assignedBoxes: await tx.shelfSlot.count({ where: { shelfId, itemId: { not: null } } }),
    // Every pack recorded as sitting on this shelf, in ANY state — the warning
    // counts scrap packs in Recyclable boxes too.
    placedPacks: await tx.openPack.count({ where: { shelfSlot: { shelfId } } }),
  };
}

/** Removes a shelf that was set up wrongly or physically taken away.
 *
 * Unlike deleteSite this WARNS rather than blocks, and the difference is a
 * schema fact rather than a preference. A site is referenced by
 * `Transaction.siteId`, an optional relation, so deleting one with history
 * would silently blank the siteId on every movement. A shelf is referenced by
 * nothing of the kind: it is furniture. `ShelfSlot.itemId` is nullable,
 * quantities are never stored on a slot, and no transaction, dispatch or
 * delivery points at a shelf. So a delete here destroys placement — where
 * things sit — and no history whatsoever. Stock is untouched.
 *
 * Two ordering details that are not optional:
 *
 * 1. Open packs are unplaced EXPLICITLY, not left to the foreign key.
 *    `OpenPack.shelfSlotId` is declared ON DELETE SET NULL, so in principle the
 *    database would do it — but only under `PRAGMA foreign_keys=ON`, which is
 *    per-connection state this code does not own. If it were ever off, packs
 *    would keep pointing at slot ids that no longer exist and nothing would
 *    report an error: the shelf map would just stop showing packs the item
 *    still holds.
 * 2. Slots are deleted BEFORE the shelf. `ShelfSlot.shelfId` is ON DELETE
 *    RESTRICT, so deleting the shelf first simply fails.
 */
export async function deleteShelf(
  tx: Prisma.TransactionClient,
  args: ShelfDeleteArgs
): Promise<{ name: string }> {
  const shelf = await tx.shelf.findUnique({ where: { id: args.shelfId } });
  if (!shelf) throw new Error("That shelf no longer exists");

  await tx.openPack.updateMany({
    where: { shelfSlot: { shelfId: args.shelfId } },
    data: { shelfSlotId: null },
  });
  await tx.shelfSlot.deleteMany({ where: { shelfId: args.shelfId } });
  await tx.shelf.delete({ where: { id: args.shelfId } });

  return { name: shelf.name };
}
