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
  { key: "defectiveItems", one: "defective-item record", many: "defective-item records" },
  { key: "pickups", one: "collection flag", many: "collection flags" },
];

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
