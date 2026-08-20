import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  SITE_MOVEMENT_TYPES,
  siteDelta,
  netAtSite,
  oldestContributingDate,
} from "@/lib/siteBalance";

/* -------------------------------------------------------------------------
 * The database side of a site's holding. The arithmetic itself is pure and
 * lives in siteBalance.ts — same split as allocation.ts / packs.ts.
 *
 * Phases 1-5 were all shaped around NOT touching this function; the
 * direct-to-site delivery pairing exists precisely so it kept working
 * unchanged. Phase 6 spends that budget deliberately, because a site's
 * holding could not otherwise ever go down except by material coming back,
 * so the list grew forever and stopped describing what was actually there.
 *
 * The return guard reads this same code, so it correctly refuses to take back
 * material already booked as consumed or transferred away.
 * ---------------------------------------------------------------------- */

export { siteDelta, netAtSite, oldestContributingDate } from "@/lib/siteBalance";

/** Rows that could affect this site's balance, from either direction. */
function whereTouchingSite(siteId: string): Prisma.TransactionWhereInput {
  return {
    type: { in: [...SITE_MOVEMENT_TYPES] },
    // A reversed movement is excluded rather than cancelled by an opposing
    // row: it never happened, so it should not appear in a balance at all.
    reversedAt: null,
    OR: [{ siteId }, { fromSiteId: siteId }],
  };
}

/** Net quantity of each item currently at a site, positive only. */
export async function materialsAtSite(siteId: string) {
  const transactions = await prisma.transaction.findMany({
    where: whereTouchingSite(siteId),
    include: { item: true },
  });

  const net = new Map<string, { item: (typeof transactions)[number]["item"]; quantity: number }>();
  for (const t of transactions) {
    const entry = net.get(t.itemId) ?? { item: t.item, quantity: 0 };
    entry.quantity += siteDelta(t, siteId);
    net.set(t.itemId, entry);
  }

  return [...net.values()]
    .filter((e) => e.quantity > 0)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}

/** One item's balance at one site. Takes a transaction client so guards can
 * read it inside the same transaction they are about to write in. */
export async function itemQuantityAtSite(
  tx: Prisma.TransactionClient,
  itemId: string,
  siteId: string
): Promise<number> {
  const rows = await tx.transaction.findMany({
    where: { itemId, ...whereTouchingSite(siteId) },
  });
  return netAtSite(rows, siteId);
}

/** Every site holding material, with each item's quantity, how much is
 * flagged for collection, and how long it has been there. One query for the
 * ledger and one for the flags, rather than per-site round trips. */
export async function materialAcrossSites() {
  const [movements, pickups] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: { in: [...SITE_MOVEMENT_TYPES] }, reversedAt: null },
      include: { item: true, site: true, fromSite: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sitePickup.findMany(),
  ]);

  // Which sites each movement is relevant to — a transfer touches two.
  const siteIds = new Set<string>();
  for (const t of movements) {
    if (t.siteId) siteIds.add(t.siteId);
    if (t.fromSiteId) siteIds.add(t.fromSiteId);
  }

  const flagged = new Map(pickups.map((p) => [`${p.siteId}:${p.itemId}`, p]));
  const bySite = new Map<
    string,
    {
      site: { id: string; name: string; location: string | null };
      items: {
        item: (typeof movements)[number]["item"];
        quantity: number;
        flagged: number;
        oldest: Date | null;
      }[];
    }
  >();

  for (const siteId of siteIds) {
    const relevant = movements.filter((t) => t.siteId === siteId || t.fromSiteId === siteId);
    const site =
      relevant.find((t) => t.siteId === siteId)?.site ??
      relevant.find((t) => t.fromSiteId === siteId)?.fromSite;
    if (!site) continue;

    const byItem = new Map<string, typeof relevant>();
    for (const t of relevant) {
      byItem.set(t.itemId, [...(byItem.get(t.itemId) ?? []), t]);
    }

    const items = [...byItem.entries()]
      .map(([itemId, rows]) => ({
        item: rows[0].item,
        quantity: netAtSite(rows, siteId),
        flagged: flagged.get(`${siteId}:${itemId}`)?.quantity ?? 0,
        oldest: oldestContributingDate(rows, siteId),
      }))
      .filter((e) => e.quantity > 0)
      .sort((a, b) => a.item.name.localeCompare(b.item.name));

    if (items.length) {
      bySite.set(siteId, { site, items });
    }
  }

  return [...bySite.values()].sort((a, b) => a.site.name.localeCompare(b.site.name));
}
