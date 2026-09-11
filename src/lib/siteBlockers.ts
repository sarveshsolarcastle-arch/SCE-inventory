/* -------------------------------------------------------------------------
 * What is still attached to a site, and therefore what deleting it would
 * destroy. Pure — no database — so the sentence a user reads can be tested,
 * and so the same function can serve two callers that must never disagree:
 * `deleteSite`, which throws it, and (from Phase 11 Part 2) the approvals
 * pre-check, which shows an admin what will happen *before* they approve.
 *
 * Those two drifting apart is the specific failure this prevents: an admin
 * reading "nothing blocks this" and then getting a refusal, or worse, the
 * reverse. One function, one sentence.
 *
 * The guard itself is not politeness. `Transaction.siteId` is an OPTIONAL
 * relation, so Prisma's default referential action is SetNull — deleting a site
 * with history would not fail, it would quietly blank the siteId on every one
 * of its movements. The ledger would still balance and nothing would error;
 * the rows would simply stop saying where the material went.
 * ---------------------------------------------------------------------- */

export type SiteBlockerCounts = {
  transactions: number;
  dispatches: number;
  deliveries: number;
  /** Batch Transfer documents touching this site, either end. Its lines are
   * ALSO counted under `transactions` — same overlap dispatches/deliveries
   * already have with their own ISSUE/STOCK_IN lines — so the message can
   * name "N transfer challans" specifically rather than leaving them
   * invisible inside a generic "N stock movements". */
  transfers: number;
  defectiveItems: number;
  pickups: number;
};

/** Ordered worst-first, so the message leads with the thing that matters most.
 * Plurals are spelled out rather than derived: appending "s" turns "dispatch"
 * into "dispatchs", which is what the original inline version did. */
const BLOCKERS: {
  key: keyof SiteBlockerCounts;
  one: string;
  many: string;
}[] = [
  { key: "transactions", one: "stock movement", many: "stock movements" },
  { key: "dispatches", one: "dispatch", many: "dispatches" },
  { key: "deliveries", one: "delivery", many: "deliveries" },
  { key: "transfers", one: "transfer challan", many: "transfer challans" },
  { key: "defectiveItems", one: "defective-item record", many: "defective-item records" },
  { key: "pickups", one: "collection flag", many: "collection flags" },
];

/** Every kind of attachment that blocks a delete, plural, worst-first — for
 * UI copy that has to say WHAT counts as "attached" before there is anything
 * to count yet, such as DeleteSiteButton's hint under the button. Reads
 * straight off BLOCKERS rather than being retyped, which is what let that
 * hint drift out of step with this list before: it listed three kinds by
 * hand and silently stopped naming the other three, `transfers` included,
 * once they existed. */
export const BLOCKER_KIND_NAMES: readonly string[] = BLOCKERS.map(({ many }) => many);

/** "stock movements, dispatches, deliveries, transfer challans, defective-item
 * records or collection flags" — BLOCKER_KIND_NAMES as one English list, for
 * the same hint. Kept as its own export, not inlined at the call site, so the
 * join rule (Oxford-comma-free, "or" before the last) lives in one place. */
export const ATTACHMENT_KINDS_SUMMARY: string = (() => {
  const names = BLOCKER_KIND_NAMES;
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
})();

export function siteBlockerPhrases(counts: SiteBlockerCounts): string[] {
  return BLOCKERS.filter(({ key }) => counts[key] > 0).map(
    ({ key, one, many }) => `${counts[key]} ${counts[key] === 1 ? one : many}`
  );
}

/** The refusal message, or null when the site is safe to delete. */
export function describeSiteBlockers(
  siteName: string,
  counts: SiteBlockerCounts
): string | null {
  const attached = siteBlockerPhrases(counts);
  if (!attached.length) return null;

  return (
    `"${siteName}" cannot be deleted — it still has ${attached.join(", ")} attached. ` +
    `Deleting it would break that history. Rename it instead if it was entered by mistake.`
  );
}
