"use server";

import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
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
