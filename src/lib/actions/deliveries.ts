"use server";

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { addPacks, addOpenPack, recalcItemStock } from "@/lib/packs";
import { emptyAppliedPlan, addSealedDelta, serialiseAppliedPlan } from "@/lib/corrections";
import { reconcileSitePickups } from "@/lib/sitePickups";

/* -------------------------------------------------------------------------
 * Recording goods received. Deliveries trickle — usually one or two item
 * types as stock runs out — so this is the lighter of the two batch flows:
 * 3 blank rows rather than 15, and no Excel paste (ruled out with the user).
 *
 * What actually matters here is the Delivery record: supplier, challan
 * reference, and above all DESTINATION.
 *
 * Deliveries only ever ADD material, so nothing here touches the allocator:
 * no cut planning, no best-fit, no open-a-pack prompt. Sealed packs go in as
 * sealed, loose material becomes an OpenPack, and anything at or below the
 * scrap threshold lands straight in the recycle list via addOpenPack.
 * ---------------------------------------------------------------------- */

export type DeliveryLineInput = {
  itemId: string;
  /** Sealed packs received. packSize may be new to the item — that is how a
   * 400 m and a 600 m roll of one material get on record with no setup. */
  packSize: number | null;
  packCount: number;
  /** Material outside any pack. */
  loose: number;
  /** Of the above, how much arrived damaged. Never enters stock at all. */
  defectiveQty: number;
};

export type DeliveryInput = {
  reference?: string | null;
  supplier?: string | null;
  note?: string | null;
  /** null = into the store. Set = delivered direct to that site, never
   * touching the store. */
  siteId?: string | null;
  lines: DeliveryLineInput[];
};

export type DeliveryResult =
  | { ok: true; deliveryId: string }
  | { ok: false; message: string; errors?: { rowIndex: number; message: string }[] };

function positiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function lineTotal(line: DeliveryLineInput): number {
  return (line.packSize ?? 0) * line.packCount + line.loose;
}

export async function recordDelivery(input: DeliveryInput): Promise<DeliveryResult> {
  let userId: string;
  try {
    const user = await requireCapability("delivery:record");
    userId = user.id;
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot record a delivery" };
    }
    return { ok: false, message: "Not signed in" };
  }

  const lines = input.lines.filter((l) => l.itemId || lineTotal(l) > 0);
  if (!lines.length) return { ok: false, message: "Add at least one line" };

  // Everything is validated BEFORE any write, and every error is collected
  // rather than stopping at the first, so a mis-typed grid comes back fully
  // annotated instead of one row at a time.
  const items = await prisma.item.findMany({
    where: { id: { in: lines.map((l) => l.itemId).filter(Boolean) } },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const errors: { rowIndex: number; message: string }[] = [];
  lines.forEach((line, rowIndex) => {
    const item = itemById.get(line.itemId);
    if (!item) {
      errors.push({ rowIndex, message: "Choose an item" });
      return;
    }
    if (line.packCount > 0 && !positiveInt(line.packCount)) {
      errors.push({ rowIndex, message: "Pack count must be a whole number greater than zero" });
    }
    if (line.packCount > 0 && !positiveInt(line.packSize)) {
      errors.push({ rowIndex, message: "Enter the pack size" });
    }
    if (line.packSize != null && line.packCount > 0 && !item.packUnit) {
      errors.push({ rowIndex, message: `${item.name} is not a packaged item` });
    }
    // A pack born at or below the threshold would be scrapped on arrival.
    if (
      positiveInt(line.packSize) &&
      item.measure === "CONTINUOUS" &&
      item.scrapThreshold != null &&
      line.packSize <= item.scrapThreshold
    ) {
      errors.push({
        rowIndex,
        message: `Pack size must be above the ${item.scrapThreshold} ${item.baseUnit} scrap threshold`,
      });
    }
    if (line.loose !== 0 && !positiveInt(line.loose)) {
      errors.push({ rowIndex, message: "Loose quantity must be a whole number greater than zero" });
    }
    const total = lineTotal(line);
    if (total <= 0) errors.push({ rowIndex, message: "Enter a quantity" });
    if (line.defectiveQty < 0 || !Number.isInteger(line.defectiveQty)) {
      errors.push({ rowIndex, message: "Defective must be a whole number" });
    }
    if (line.defectiveQty > total) {
      errors.push({ rowIndex, message: "Cannot mark more defective than was delivered" });
    }
  });

  if (errors.length) {
    return { ok: false, message: "Some rows need fixing before this can be recorded", errors };
  }

  const siteId = input.siteId || null;
  let deliveryId = "";

  await prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.create({
      data: {
        reference: input.reference?.trim() || null,
        supplier: input.supplier?.trim() || null,
        note: input.note?.trim() || null,
        siteId,
        userId,
      },
    });
    deliveryId = delivery.id;

    for (const line of lines) {
      const item = itemById.get(line.itemId)!;
      const total = lineTotal(line);
      const defective = line.defectiveQty;
      const good = total - defective;

      const applied = emptyAppliedPlan();

      // Defective goods NEVER enter stock — not even briefly. Ten arrive with
      // two damaged and the delivery records 8 good and 2 quarantined, rather
      // than adding 10 and removing 2, so currentStock is never inflated by
      // goods that were never good.
      if (defective > 0) {
        const row = await tx.defectiveItem.create({
          data: {
            itemId: item.id,
            quantity: defective,
            // Only attribute the defect to whole packs when the damage
            // accounts for entire packs; a partial is recorded as loose.
            packSize: line.packSize && defective % line.packSize === 0 ? line.packSize : null,
            packCount:
              line.packSize && defective % line.packSize === 0
                ? defective / line.packSize
                : null,
            source: "DELIVERY",
            deliveryId: delivery.id,
            userId,
            note: input.note?.trim() || null,
          },
        });
        applied.defectiveIds.push(row.id);
      }

      if (good > 0) {
        // Packs are only created when the material actually lands in the
        // store. Direct to site it never touches the shelf, so no pack rows
        // exist and currentStock is untouched — the honest answer, since it
        // was never there. Leftovers come home later as ordinary returns.
        if (!siteId) {
          // How much of the good portion is still whole sealed packs. Damage
          // comes off the loose part first, then off packs.
          const goodPackCount =
            line.packSize && line.packCount > 0
              ? Math.min(line.packCount, Math.floor(good / line.packSize))
              : 0;
          const goodLoose = good - goodPackCount * (line.packSize ?? 0);

          if (goodPackCount > 0 && line.packSize) {
            await addPacks(tx, item.id, line.packSize, goodPackCount);
            addSealedDelta(applied, line.packSize, goodPackCount);
          }
          if (goodLoose > 0) {
            const { id, scrapped } = await addOpenPack(tx, item, goodLoose);
            applied.created.push({
              id,
              remaining: goodLoose,
              originalSize: null,
              state: scrapped ? "SCRAP" : "OPEN",
              shelfSlotId: null,
            });
            if (scrapped) {
              await tx.transaction.create({
                data: {
                  type: "SCRAP",
                  quantity: goodLoose,
                  itemId: item.id,
                  userId,
                  deliveryId: delivery.id,
                  note: `Delivered loose at or below the ${item.scrapThreshold} ${item.baseUnit} threshold`,
                },
              });
            }
          }
          await recalcItemStock(tx, item.id);
        }

        await tx.transaction.create({
          data: {
            type: "STOCK_IN",
            quantity: good,
            itemId: item.id,
            userId,
            deliveryId: delivery.id,
            note: input.note?.trim() || null,
            packSize: line.packSize,
            packCount: line.packCount || null,
            appliedPlan: serialiseAppliedPlan(applied),
          },
        });

        // Direct-to-site pairs that STOCK_IN with an immediate ISSUE sharing
        // this deliveryId, netting to zero at the office. That is the whole
        // trick: materialsAtSite sees the ISSUE, so the site correctly holds
        // the material, so returning the opened leftovers later passes the
        // return guard — with no new logic anywhere downstream.
        if (siteId) {
          await tx.transaction.create({
            data: {
              type: "ISSUE",
              quantity: good,
              itemId: item.id,
              siteId,
              userId,
              deliveryId: delivery.id,
              note: input.note?.trim() || null,
              packSize: line.packSize,
              packCount: line.packCount || null,
            },
          });
          // Only ever raises this site's balance, so no flag can be left
          // over-claiming — called anyway so every writer of a site movement
          // looks the same, rather than each one needing the reader to work
          // out which direction it moves.
          await reconcileSitePickups(tx, siteId, item.id);
        }
      }
    }
  });

  revalidateDelivery(siteId);
  return { ok: true, deliveryId };
}

/** Moves a defective row along its claim lifecycle. Marking REPLACED links
 * the delivery that made good on it, so an unfulfilled claim is a query
 * rather than someone's memory. */
export async function updateDefectiveStatus(
  defectiveId: string,
  formData: FormData
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await requireCapability("defect:resolve");
  } catch {
    return { ok: false, message: "Your account cannot resolve supplier claims" };
  }

  const status = String(formData.get("status") ?? "");
  if (!["QUARANTINED", "CLAIMED", "REPLACED"].includes(status)) {
    return { ok: false, message: "Unknown status" };
  }
  const replacedByDeliveryId = String(formData.get("replacedByDeliveryId") ?? "") || null;

  if (status === "REPLACED" && !replacedByDeliveryId) {
    return {
      ok: false,
      message:
        "Choose the delivery that replaced these goods — a replacement arrives as an ordinary delivery",
    };
  }

  await prisma.defectiveItem.update({
    where: { id: defectiveId },
    data: {
      status: status as "QUARANTINED" | "CLAIMED" | "REPLACED",
      replacedByDeliveryId: status === "REPLACED" ? replacedByDeliveryId : null,
    },
  });

  revalidatePath("/defective");
  revalidatePath("/deliveries", "layout");
  return { ok: true };
}

function revalidateDelivery(siteId: string | null) {
  revalidatePath("/items", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/shelf");
  revalidatePath("/shelf/suggestions");
  revalidatePath("/recycle");
  revalidatePath("/defective");
  revalidatePath("/deliveries");
  if (siteId) revalidatePath(`/sites/${siteId}`);
}
