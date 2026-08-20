import type { Prisma } from "@/generated/prisma/client";
import { itemQuantityAtSite } from "@/lib/stock";

/* -------------------------------------------------------------------------
 * Keeping the "awaiting collection" flag honest.
 *
 * A SitePickup row says "N units of this item at this site are not in use —
 * we have given up collecting them for now". But the site's actual holding is
 * derived from the ledger, not stored, so the flag can be left claiming more
 * than the site has the moment anything moves: material returned, consumed,
 * or transferred away.
 *
 * So this runs after EVERY movement touching a site+item pair, clamping the
 * flag down to what is really there and deleting it once nothing is left.
 * ---------------------------------------------------------------------- */

/** Clamps a pickup flag to the site's real balance; deletes it at zero.
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

  if (held <= 0) {
    await tx.sitePickup.delete({ where: { id: flag.id } });
    return;
  }
  if (flag.quantity > held) {
    await tx.sitePickup.update({ where: { id: flag.id }, data: { quantity: held } });
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
