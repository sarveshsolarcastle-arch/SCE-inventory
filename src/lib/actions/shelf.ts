"use server";

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BOX_TYPES, type BoxType } from "@/lib/boxTypes";

export async function createShelf(formData: FormData) {
  "use server";
  await requireCapability("shelf:manage");

  const name = String(formData.get("name") ?? "").trim();
  const rows = Number(formData.get("rows") ?? 0);
  const columns = Number(formData.get("columns") ?? 0);
  const boxTypesRaw = String(formData.get("boxTypes") ?? "{}");

  if (!name) throw new Error("Name is required");
  if (!Number.isInteger(rows) || rows < 1 || rows > 20) {
    throw new Error("Rows must be between 1 and 20");
  }
  if (!Number.isInteger(columns) || columns < 1 || columns > 20) {
    throw new Error("Columns must be between 1 and 20");
  }

  let boxTypes: Record<string, BoxType>;
  try {
    boxTypes = JSON.parse(boxTypesRaw);
  } catch {
    boxTypes = {};
  }

  const shelf = await prisma.shelf.create({ data: { name, rows, columns } });

  const slots: {
    shelfId: string;
    side: "FRONT" | "BACK";
    row: number;
    column: number;
    tagCode: string;
    boxType: BoxType;
  }[] = [];
  for (const side of ["FRONT", "BACK"] as const) {
    for (let row = 1; row <= rows; row++) {
      for (let column = 1; column <= columns; column++) {
        const key = `${side}-${row}-${column}`;
        const boxType = BOX_TYPES.includes(boxTypes[key]) ? boxTypes[key] : "FRESH";
        slots.push({
          shelfId: shelf.id,
          side,
          row,
          column,
          tagCode: `${side === "FRONT" ? "F" : "B"}${row}-${column}`,
          boxType,
        });
      }
    }
  }
  await prisma.shelfSlot.createMany({ data: slots });

  revalidatePath("/shelf");
  redirect(`/shelf/${shelf.id}`);
}

/** Relabels a slot's condition (Fresh/Opened/Recyclable). A slot no longer
 * stores a quantity — how much is in a box is derived from the item's packs —
 * so this only changes the label. An item may now occupy several boxes of the
 * same condition, so nothing else is freed up. */
export async function updateSlotBoxType(
  shelfId: string,
  slotId: string,
  formData: FormData
) {
  "use server";
  await requireCapability("shelf:manage");

  const boxTypeRaw = String(formData.get("boxType") ?? "");
  if (!(BOX_TYPES as readonly string[]).includes(boxTypeRaw)) {
    throw new Error("Invalid box type");
  }

  await prisma.shelfSlot.update({
    where: { id: slotId },
    data: { boxType: boxTypeRaw as BoxType },
  });

  revalidatePath(`/shelf/${shelfId}`);
  revalidatePath("/items");
  revalidatePath("/dashboard");
  revalidatePath("/shelf/suggestions");
}

/** Assigns (or clears) which item lives in a box. Placement is a physical fact
 * that cannot be derived, so it is set by hand — but only the placement: the
 * quantity shown comes from the item's packs. */
export async function assignSlotItem(
  shelfId: string,
  slotId: string,
  formData: FormData
) {
  "use server";
  await requireCapability("shelf:manage");

  const itemId = String(formData.get("itemId") ?? "") || null;

  await prisma.$transaction(async (tx) => {
    const slot = await tx.shelfSlot.findUniqueOrThrow({ where: { id: slotId } });

    // Open packs sitting in this box belong to whoever occupied it.
    if (slot.itemId && slot.itemId !== itemId) {
      await tx.openPack.updateMany({
        where: { shelfSlotId: slotId },
        data: { shelfSlotId: null },
      });
    }

    await tx.shelfSlot.update({ where: { id: slotId }, data: { itemId } });

    // An Opened or Recyclable box is defined by the individual packs in it, so
    // adopt any of this item's packs of the matching state that aren't already
    // in a box. Without this the box would stay permanently empty: nothing else
    // ever sets an open pack's location.
    if (itemId && (slot.boxType === "OPENED" || slot.boxType === "RECYCLABLE")) {
      await tx.openPack.updateMany({
        where: {
          itemId,
          shelfSlotId: null,
          state: slot.boxType === "OPENED" ? "OPEN" : "SCRAP",
        },
        data: { shelfSlotId: slotId },
      });
    }
  });

  revalidatePath(`/shelf/${shelfId}`);
  revalidatePath("/items");
  revalidatePath("/shelf/suggestions");
}

export async function toggleFrontRow(shelfId: string, slotId: string) {
  "use server";
  await requireCapability("shelf:manage");

  const slot = await prisma.shelfSlot.findUniqueOrThrow({ where: { id: slotId } });
  await prisma.shelfSlot.update({
    where: { id: slotId },
    data: { isFrontRow: !slot.isFrontRow },
  });

  revalidatePath(`/shelf/${shelfId}`);
  revalidatePath("/dashboard");
  revalidatePath("/shelf/suggestions");
}

export type DeleteShelfResult = { ok: true } | { ok: false; message: string };

/** Removes a shelf that was set up wrongly or physically taken away.
 *
 * Unlike `deleteSite`, this one WARNS rather than blocks, and that difference
 * is a schema fact rather than a preference. A site is referenced by
 * `Transaction.siteId`, an OPTIONAL relation, so deleting a site with history
 * would silently blank the siteId on every one of its movements and cost the
 * accountability trail. A shelf is referenced by nothing of the kind: it is
 * furniture. `ShelfSlot.itemId` is nullable, quantities are never stored on a
 * slot (they are derived from the item's packs), and no transaction, dispatch
 * or delivery points at a shelf at all. So a delete here destroys placement —
 * where things sit — and no history whatsoever. Stock is untouched: an item
 * assigned to a demolished box still has exactly the packs it had.
 *
 * Two ordering details that are not optional:
 *
 * 1. **Open packs are unplaced explicitly**, not left to the foreign key.
 *    `OpenPack.shelfSlotId` is declared `ON DELETE SET NULL`, so in principle
 *    the database would do it — but only with `PRAGMA foreign_keys=ON`, which
 *    is per-connection state this code does not own. If it were ever off, the
 *    packs would keep pointing at slot ids that no longer exist, and nothing
 *    would report an error: the shelf map would just stop showing packs that
 *    the item still holds. Doing it in SQL we can see costs one statement and
 *    removes the dependency. Same `updateMany` as `assignSlotItem` uses.
 * 2. **Slots are deleted before the shelf.** `ShelfSlot.shelfId` is
 *    `ON DELETE RESTRICT`, so deleting the shelf first simply fails.
 *
 * All three run in one transaction, so a shelf cannot end up half-demolished.
 */
export async function deleteShelf(shelfId: string): Promise<DeleteShelfResult> {
  try {
    await requireCapability("shelf:delete");
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot delete shelves" };
    }
    return { ok: false, message: "Not signed in" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const shelf = await tx.shelf.findUnique({ where: { id: shelfId } });
      if (!shelf) throw new Error("That shelf no longer exists");

      await tx.openPack.updateMany({
        where: { shelfSlot: { shelfId } },
        data: { shelfSlotId: null },
      });
      await tx.shelfSlot.deleteMany({ where: { shelfId } });
      await tx.shelf.delete({ where: { id: shelfId } });
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete the shelf",
    };
  }

  revalidatePath("/shelf");
  revalidatePath("/items");
  revalidatePath("/dashboard");
  revalidatePath("/shelf/suggestions");
  return { ok: true };
}
