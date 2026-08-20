/* -------------------------------------------------------------------------
 * How a site's holding is computed. Pure — no database, no framework, so it
 * is unit-testable and runs anywhere. stock.ts is the DB side that feeds it,
 * the same split as allocation.ts / packs.ts.
 *
 *   + ISSUE(siteId=S)         material sent out from the store
 *   − RETURN(siteId=S)        material brought back
 *   − CONSUME(siteId=S)       material used up on site
 *   + TRANSFER(siteId=S)      arrived from another site
 *   − TRANSFER(fromSiteId=S)  left for another site
 * ---------------------------------------------------------------------- */

/** Transaction types that move a site's balance. */
export const SITE_MOVEMENT_TYPES = ["ISSUE", "RETURN", "CONSUME", "TRANSFER"] as const;

export type SiteMovement = {
  type: string;
  quantity: number;
  siteId: string | null;
  fromSiteId: string | null;
};

/** Signed contribution of one movement to `siteId`'s balance.
 *
 * A TRANSFER is the only row that can touch two sites — adding to one and
 * removing from the other — so it has to be read relative to the site being
 * asked about, not in the absolute. */
export function siteDelta(t: SiteMovement, siteId: string): number {
  if (t.type === "TRANSFER") {
    if (t.siteId === siteId) return t.quantity;
    if (t.fromSiteId === siteId) return -t.quantity;
    return 0;
  }
  if (t.siteId !== siteId) return 0;
  return t.type === "ISSUE" ? t.quantity : -t.quantity;
}

export function netAtSite(
  movements: readonly SiteMovement[],
  siteId: string
): number {
  return movements.reduce((sum, t) => sum + siteDelta(t, siteId), 0);
}

/** How much of a site's holding is actually awaiting collection.
 *
 * `SitePickup.quantity` is an **intent**, not a fact. At-site balances are
 * derived from the ledger rather than stored, so a stored flag goes stale the
 * moment material is returned, consumed, or transferred away — and the
 * failure is silent: a flag quietly claims material the site no longer has,
 * and nothing errors.
 *
 * `reconcileSitePickups` tidies the stored rows after a movement, but relying
 * on that alone would make correctness depend on every current and future
 * writer remembering to call it. So the number anyone actually READS is
 * derived here instead, and cannot exceed the balance no matter what the
 * database holds. Same reasoning as ShelfSlot storing no quantity: derived
 * contents cannot drift.
 *
 * A negative or absent balance means nothing is flagged.
 */
export function effectiveFlagged(storedFlag: number, held: number): number {
  if (!Number.isFinite(storedFlag) || storedFlag <= 0) return 0;
  if (!Number.isFinite(held) || held <= 0) return 0;
  return Math.min(storedFlag, held);
}

/** How long the material still at a site has been sitting there.
 *
 * Computed FIFO: walk the movements chronologically keeping lots, letting
 * withdrawals consume the oldest first, and report the date of the oldest lot
 * still contributing. A plain "earliest issue date" would overstate age badly
 * whenever material was returned and later re-issued — and the whole point of
 * the number is to answer "is the detour worth it", so it has to describe the
 * material actually there now. Returns null when nothing is left. */
export function oldestContributingDate(
  movements: readonly (SiteMovement & { createdAt: Date })[],
  siteId: string
): Date | null {
  const lots: { date: Date; remaining: number }[] = [];

  for (const t of [...movements].sort((a, b) => +a.createdAt - +b.createdAt)) {
    const delta = siteDelta(t, siteId);
    if (delta > 0) {
      lots.push({ date: t.createdAt, remaining: delta });
      continue;
    }
    let toRemove = -delta;
    while (toRemove > 0 && lots.length) {
      const oldest = lots[0];
      const taken = Math.min(toRemove, oldest.remaining);
      oldest.remaining -= taken;
      toRemove -= taken;
      if (oldest.remaining === 0) lots.shift();
    }
  }

  return lots.length ? lots[0].date : null;
}
