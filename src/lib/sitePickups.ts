import type { Prisma } from "@/generated/prisma/client";
import { itemQuantityAtSite } from "@/lib/stock";
import { effectiveFlagged } from "@/lib/siteBalance";

/* -------------------------------------------------------------------------
 * Tidying the stored "awaiting collection" rows.
 *
 * A SitePickup row says "N units of this item at this site are not in use —
 * we have given up collecting them for now". But the site's actual holding is
 * derived from the ledger, not stored, so the stored number goes stale the
 * moment anything moves: material returned, consumed, or transferred away.
 *
 * IMPORTANT: this is housekeeping, NOT the correctness guarantee. Every read
 * path runs the stored number through `effectiveFlagged`, so a flag can never
 * be *shown* claiming more than the site holds even if a writer forgets to
 * call this. That is deliberate — the failure mode here is silent, and making
 * correctness depend on every future writer remembering a call would be the
 * weakest possible enforcement. This function only keeps the rows tidy and
 * deletes ones that have reached zero.
 * ---------------------------------------------------------------------- */

/** Persists the clamp and deletes a flag whose material is all gone.
 * Safe to call when no flag exists — it simply does nothing. */
export async function reconcileSitePickups(
  tx: Prisma.TransactionClient,
  siteId: string,
  itemId: string
): Promise<void> {
  const flag = await tx.sitePickup.findUnique({
    where: { siteId_itemId: { siteId, itemId } },
  });
  if (!flag) return;

  const held = await itemQuantityAtSite(tx, itemId, siteId);
  const clamped = effectiveFlagged(flag.quantity, held);

  if (clamped === 0) {
    await tx.sitePickup.delete({ where: { id: flag.id } });
    return;
  }
  if (clamped !== flag.quantity) {
    await tx.sitePickup.update({ where: { id: flag.id }, data: { quantity: clamped } });
  }
}

/** Every site+item pair a movement touched. A TRANSFER touches two sites, so
 * both ends need reconciling. */
export async function reconcileForMovement(
  tx: Prisma.TransactionClient,
  itemId: string,
  siteIds: (string | null | undefined)[]
): Promise<void> {
  for (const siteId of new Set(siteIds.filter((s): s is string => !!s))) {
    await reconcileSitePickups(tx, siteId, itemId);
  }
}
