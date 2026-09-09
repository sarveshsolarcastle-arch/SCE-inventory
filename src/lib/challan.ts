/* -------------------------------------------------------------------------
 * The delivery challan number.
 *
 * Split the way units.ts is split: a pure formatter that client components and
 * tests can call freely, and one database helper that takes the CALLER's
 * transaction — the same ownership rule as src/lib/approvals/ops/*, and for the
 * same reason. The number must be allocated in the same transaction that writes
 * the Dispatch, or a dispatch that fails half-way through would burn a number
 * and leave a gap in what is supposed to be a gap-free official series.
 * ---------------------------------------------------------------------- */

import type { Delivery, Prisma, Site } from "@/generated/prisma/client";

/** The key of the counter row in `Sequence`. */
export const CHALLAN_SEQUENCE_KEY = "challan";

/** The site delivery challan's own series — deliberately separate from
 * `CHALLAN_SEQUENCE_KEY` so `SCE/DC/…` (Dispatch) and `SCE/SDC/…` (a
 * direct-to-site Delivery) never share a counter, and therefore never share
 * a number even though they format to visibly different strings. */
export const SITE_CHALLAN_SEQUENCE_KEY = "siteChallan";

/** How wide the number is zero-padded before it runs on. Four digits covers
 * 9999 challans; beyond that `formatChallanNo` simply gets longer rather than
 * wrapping, because a number that repeats is worse than one that is untidy. */
const PAD = 4;

/** "SCE/DC/0042". Pure — safe to call from a client component. */
export function formatChallanNo(n: number): string {
  return `SCE/DC/${String(n).padStart(PAD, "0")}`;
}

/** "SCE/SDC/0042" — the site delivery challan's own format, told apart from
 * `formatChallanNo` at a glance so the two documents are never confused. */
export function formatSiteChallanNo(n: number): string {
  return `SCE/SDC/${String(n).padStart(PAD, "0")}`;
}

/**
 * The next number in the given series (default: the Dispatch series, so
 * existing callers are unchanged).
 *
 * One atomic `UPDATE … SET value = value + 1`, so two writers saved at the
 * same instant cannot be handed the same number — which a `max(challanNo) + 1`
 * read-then-write would allow. The upsert is for the case where the counter row
 * is missing (a database migrated by hand, say): allocating from 1 is right,
 * because `challanNo` is unique and a duplicate would be refused anyway.
 */
export async function nextChallanNo(
  tx: Prisma.TransactionClient,
  key: string = CHALLAN_SEQUENCE_KEY
): Promise<number> {
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

/**
 * The one place the "numbered ⟺ direct-to-site" pair is tested. A store
 * delivery (siteId null) has no challan to print; a direct-to-site delivery
 * always should, but the type only guarantees `challanNo` is nullable, so
 * every reader — the detail page's Print button, the list page's badge, the
 * challan route's guard — goes through here rather than each re-deriving the
 * same two-field check and risking one of them drifting.
 */
export function siteChallanOf(
  delivery: Pick<Delivery, "challanNo"> & { site: Site | null }
): { challanNo: number; site: Site } | null {
  if (!delivery.site || delivery.challanNo == null) return null;
  return { challanNo: delivery.challanNo, site: delivery.site };
}
