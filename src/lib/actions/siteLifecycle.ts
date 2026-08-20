"use server";

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { itemQuantityAtSite } from "@/lib/stock";
import { reconcileSitePickups } from "@/lib/sitePickups";

/* -------------------------------------------------------------------------
 * What happens to material after it reaches a site.
 *
 * None of these touch packs. Packs are a store-side concept — a site holds
 * plain base-unit quantities, not rolls — so there is no allocator here, no
 * scrap, and no open-pack prompt. Store `currentStock` is untouched by every
 * action in this file: the material left the store when it was issued.
 * ---------------------------------------------------------------------- */

export type SiteResult = { ok: true } | { ok: false; message: string };

/** Books material as used up at a site. Zero delta to store stock, negative
 * against the site's holding. Accepts several items at once so a whole site
 * visit is recorded in one pass. */
export async function consumeAtSite(
  siteId: string,
  input: { itemId: string; quantity: number }[],
  note?: string | null
): Promise<SiteResult> {
  let userId: string;
  try {
    ({ id: userId } = await requireCapability("stock:consume"));
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot record consumption" };
    }
    return { ok: false, message: "Not signed in" };
  }

  const lines = input.filter((l) => l.itemId && l.quantity > 0);
  if (!lines.length) return { ok: false, message: "Enter a quantity to consume" };

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return { ok: false, message: "Consumed quantities must be whole numbers above zero" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const item = await tx.item.findUniqueOrThrow({ where: { id: line.itemId } });
        const held = await itemQuantityAtSite(tx, line.itemId, siteId);
        if (line.quantity > held) {
          throw new Error(
            `Cannot consume ${line.quantity} ${item.baseUnit} of ${item.name} — only ${held} ${item.baseUnit} is at this site`
          );
        }

        await tx.transaction.create({
          data: {
            type: "CONSUME",
            quantity: line.quantity,
            itemId: line.itemId,
            siteId,
            userId,
            note: note?.trim() || null,
          },
        });

        // Consuming flagged material is allowed — the UI warns first — so the
        // flag has to be clamped down afterwards rather than blocking.
        await reconcileSitePickups(tx, siteId, line.itemId);
      }
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not record consumption",
    };
  }

  revalidateSites(siteId);
  return { ok: true };
}

/** Moves material site A → B without it passing through the store.
 *
 * A dedicated TRANSFER row, not a RETURN+ISSUE pair: pairing would create an
 * OpenPack on the way in and immediately consume it on the way out, churning
 * pack state for material that never comes within a mile of the shelf. */
export async function transferBetweenSites(
  input: { fromSiteId: string; toSiteId: string; itemId: string; quantity: number; note?: string | null }
): Promise<SiteResult> {
  let userId: string;
  try {
    ({ id: userId } = await requireCapability("stock:transfer"));
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot transfer material between sites" };
    }
    return { ok: false, message: "Not signed in" };
  }

  const { fromSiteId, toSiteId, itemId, quantity } = input;
  if (!fromSiteId || !toSiteId) return { ok: false, message: "Choose both sites" };
  if (fromSiteId === toSiteId) return { ok: false, message: "Choose two different sites" };
  if (!itemId) return { ok: false, message: "Choose an item" };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: "Quantity must be a whole number above zero" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
      // Guarded against what the ORIGIN actually holds, using the same
      // balance function the return guard uses.
      const held = await itemQuantityAtSite(tx, itemId, fromSiteId);
      if (quantity > held) {
        throw new Error(
          `Cannot transfer ${quantity} ${item.baseUnit} — the origin site holds only ${held} ${item.baseUnit}`
        );
      }

      await tx.transaction.create({
        data: {
          type: "TRANSFER",
          quantity,
          itemId,
          siteId: toSiteId, // destination
          fromSiteId, // origin
          userId,
          note: input.note?.trim() || null,
        },
      });

      // Both ends moved, so both ends' flags may be stale.
      await reconcileSitePickups(tx, fromSiteId, itemId);
      await reconcileSitePickups(tx, toSiteId, itemId);
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not record the transfer",
    };
  }

  revalidateSites(fromSiteId);
  revalidateSites(toSiteId);
  return { ok: true };
}

/** Flags material as awaiting collection — not lost, not consumed, just not
 * worth a trip yet. Labels the material; never moves it, so store stock and
 * the site's balance are both untouched. Setting zero clears the flag. */
export async function markForPickup(
  input: { siteId: string; itemId: string; quantity: number; note?: string | null }
): Promise<SiteResult> {
  let userId: string;
  try {
    ({ id: userId } = await requireCapability("site:pickup"));
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot flag material for collection" };
    }
    return { ok: false, message: "Not signed in" };
  }

  const { siteId, itemId, quantity } = input;
  if (!siteId || !itemId) return { ok: false, message: "Choose a site and an item" };
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { ok: false, message: "Quantity must be a whole number of zero or more" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
      const held = await itemQuantityAtSite(tx, itemId, siteId);
      if (quantity > held) {
        throw new Error(
          `Cannot flag ${quantity} ${item.baseUnit} — this site holds only ${held} ${item.baseUnit}`
        );
      }

      if (quantity === 0) {
        await tx.sitePickup.deleteMany({ where: { siteId, itemId } });
        return;
      }

      await tx.sitePickup.upsert({
        where: { siteId_itemId: { siteId, itemId } },
        create: { siteId, itemId, quantity, userId, note: input.note?.trim() || null },
        update: { quantity, userId, note: input.note?.trim() || null, markedAt: new Date() },
      });
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not flag for collection",
    };
  }

  revalidateSites(siteId);
  return { ok: true };
}

function revalidateSites(siteId: string) {
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  revalidatePath("/at-sites");
  revalidatePath("/dashboard");
}
