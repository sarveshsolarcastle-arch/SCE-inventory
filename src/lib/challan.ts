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

import type { Prisma } from "@/generated/prisma/client";

/** The key of the counter row in `Sequence`. */
export const CHALLAN_SEQUENCE_KEY = "challan";

/** How wide the number is zero-padded before it runs on. Four digits covers
 * 9999 challans; beyond that `formatChallanNo` simply gets longer rather than
 * wrapping, because a number that repeats is worse than one that is untidy. */
const PAD = 4;

/** "SCE/DC/0042". Pure — safe to call from a client component. */
export function formatChallanNo(n: number): string {
  return `SCE/DC/${String(n).padStart(PAD, "0")}`;
}

/**
 * The next number in the series.
 *
 * One atomic `UPDATE … SET value = value + 1`, so two dispatches saved at the
 * same instant cannot be handed the same number — which a `max(challanNo) + 1`
 * read-then-write would allow. The upsert is for the case where the counter row
 * is missing (a database migrated by hand, say): allocating from 1 is right,
 * because `challanNo` is unique and a duplicate would be refused anyway.
 */
export async function nextChallanNo(tx: Prisma.TransactionClient): Promise<number> {
  const row = await tx.sequence.upsert({
    where: { key: CHALLAN_SEQUENCE_KEY },
    create: { key: CHALLAN_SEQUENCE_KEY, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
