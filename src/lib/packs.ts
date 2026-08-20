import type { Prisma } from "@/generated/prisma/client";
import {
  NEW_PACK_PREFIX,
  planAllocation,
  type AllocationPlan,
  type AllocationRequest,
  type ItemRules,
  type PackSnapshot,
} from "@/lib/allocation";

/* -------------------------------------------------------------------------
 * The database side of the pack model. Everything here takes a transaction
 * client, so callers control atomicity. The planning itself lives in
 * allocation.ts and stays pure.
 * ---------------------------------------------------------------------- */

/** Recomputes Item.currentStock and Item.scrapStock from the pack rows.
 *
 * Those two columns are a CACHE — PackStock and OpenPack are the truth. This is
 * the only function that writes them, so there is exactly one place for drift
 * to be prevented. Call it at the end of anything that touches packs. */
export async function recalcItemStock(
  tx: Prisma.TransactionClient,
  itemId: string
): Promise<void> {
  const [sealed, open] = await Promise.all([
    tx.packStock.findMany({ where: { itemId } }),
    tx.openPack.findMany({ where: { itemId } }),
  ]);

  const sealedTotal = sealed.reduce((s, g) => s + g.packSize * g.sealedCount, 0);
  const openTotal = open
    .filter((p) => p.state === "OPEN")
    .reduce((s, p) => s + p.remaining, 0);
  const scrapTotal = open
    .filter((p) => p.state === "SCRAP")
    .reduce((s, p) => s + p.remaining, 0);

  await tx.item.update({
    where: { id: itemId },
    data: { currentStock: sealedTotal + openTotal, scrapStock: scrapTotal },
  });
}

/** Reads an item's packs into the plain shape the pure planner expects. */
export async function readSnapshot(
  tx: Prisma.TransactionClient,
  itemId: string
): Promise<PackSnapshot> {
  const [sealed, open] = await Promise.all([
    tx.packStock.findMany({ where: { itemId }, orderBy: { packSize: "asc" } }),
    tx.openPack.findMany({
      where: { itemId, state: "OPEN" },
      orderBy: { remaining: "asc" },
    }),
  ]);
  return {
    sealed: sealed.map((g) => ({ packSize: g.packSize, sealedCount: g.sealedCount })),
    open: open.map((p) => ({ id: p.id, remaining: p.remaining })),
  };
}

export async function addPacks(
  tx: Prisma.TransactionClient,
  itemId: string,
  packSize: number,
  count: number
): Promise<void> {
  if (count <= 0) return;
  await tx.packStock.upsert({
    where: { itemId_packSize: { itemId, packSize } },
    create: { itemId, packSize, sealedCount: count },
    update: { sealedCount: { increment: count } },
  });
}

/** Adds loose material as its own open pack — a returned offcut, or unpackaged
 * stock arriving. Sub-threshold lengths land straight in the recycle list. */
export async function addOpenPack(
  tx: Prisma.TransactionClient,
  item: { id: string; measure: string; scrapThreshold: number | null },
  remaining: number,
  opts: { originalSize?: number | null; shelfSlotId?: string | null } = {}
): Promise<{ id: string; scrapped: boolean }> {
  if (remaining <= 0) throw new Error("An open pack must hold a positive quantity");

  const scrapped =
    item.measure === "CONTINUOUS" &&
    item.scrapThreshold != null &&
    remaining <= item.scrapThreshold;

  const created = await tx.openPack.create({
    data: {
      itemId: item.id,
      remaining,
      originalSize: opts.originalSize ?? null,
      shelfSlotId: opts.shelfSlotId ?? null,
      state: scrapped ? "SCRAP" : "OPEN",
    },
  });
  return { id: created.id, scrapped };
}

/** The ONLY function that opens a sealed pack. Never called implicitly: it runs
 * from an explicit confirmation, or the item page's "Open a pack" button. That
 * friction is the point — it is where someone reconsiders asking for 150 m when
 * two 75 m runs would come off the offcuts. */
export async function openPack(
  tx: Prisma.TransactionClient,
  args: {
    itemId: string;
    packSize: number;
    userId: string;
    shelfSlotId?: string | null;
    note?: string | null;
  }
): Promise<string> {
  const group = await tx.packStock.findUnique({
    where: { itemId_packSize: { itemId: args.itemId, packSize: args.packSize } },
  });
  if (!group || group.sealedCount < 1) {
    throw new Error(`No sealed ${args.packSize} pack available to open`);
  }

  await tx.packStock.update({
    where: { id: group.id },
    data: { sealedCount: { decrement: 1 } },
  });

  const created = await tx.openPack.create({
    data: {
      itemId: args.itemId,
      remaining: args.packSize,
      originalSize: args.packSize,
      shelfSlotId: args.shelfSlotId ?? null,
      state: "OPEN",
    },
  });

  await tx.transaction.create({
    data: {
      type: "OPEN_PACK",
      quantity: args.packSize,
      packSize: args.packSize,
      packCount: 1,
      itemId: args.itemId,
      userId: args.userId,
      note: args.note ?? null,
    },
  });

  return created.id;
}

export type ApprovedOpens = { packSize: number; count: number }[];

export class StaleApprovalError extends Error {
  constructor(readonly required: ApprovedOpens) {
    super(
      "Stock changed while you were reviewing — this now needs more packs opened than you approved."
    );
    this.name = "StaleApprovalError";
  }
}

export class AllocationFailedError extends Error {
  constructor(readonly plan: AllocationPlan, message: string) {
    super(message);
    this.name = "AllocationFailedError";
  }
}

function summariseOpens(plan: AllocationPlan): ApprovedOpens {
  const bySize = new Map<number, number>();
  for (const o of plan.opens) bySize.set(o.packSize, (bySize.get(o.packSize) ?? 0) + 1);
  return [...bySize.entries()]
    .map(([packSize, count]) => ({ packSize, count }))
    .sort((a, b) => a.packSize - b.packSize);
}

function exceedsApproval(required: ApprovedOpens, approved: ApprovedOpens): boolean {
  return required.some((need) => {
    const ok = approved.find((a) => a.packSize === need.packSize);
    return (ok?.count ?? 0) < need.count;
  });
}

export function describeAllocationErrors(
  plan: AllocationPlan,
  baseUnit: string
): string[] {
  return plan.errors.map((e) => {
    switch (e.kind) {
      case "no_single_pack":
        return `No single pack can provide a continuous ${e.length} ${baseUnit} — largest available is ${e.largestAvailable} ${baseUnit}.`;
      case "insufficient":
        return `Not enough stock: ${e.needed} ${baseUnit} requested, only ${e.available} ${baseUnit} available.`;
      case "insufficient_sealed":
        return `Only ${e.available} sealed ${e.packSize} ${baseUnit} pack(s) available, ${e.requested} requested.`;
    }
  });
}

/** Re-plans against freshly read rows INSIDE the transaction, then applies the
 * result. Re-planning is not belt-and-braces: someone else may have drawn stock
 * between the preview and the submit, and opening a pack nobody agreed to is
 * exactly what this design exists to prevent. */
export async function commitAllocation(
  tx: Prisma.TransactionClient,
  item: {
    id: string;
    baseUnit: string;
    measure: ItemRules["measure"];
    scrapThreshold: number | null;
  },
  request: AllocationRequest,
  approvedOpens: ApprovedOpens,
  userId: string
): Promise<AllocationPlan> {
  const snapshot = await readSnapshot(tx, item.id);
  const plan = planAllocation(
    { measure: item.measure, scrapThreshold: item.scrapThreshold },
    snapshot,
    request
  );

  if (plan.errors.length) {
    throw new AllocationFailedError(
      plan,
      describeAllocationErrors(plan, item.baseUnit).join(" ")
    );
  }

  const required = summariseOpens(plan);
  if (exceedsApproval(required, approvedOpens)) throw new StaleApprovalError(required);

  // Open packs first, in plan order, so `new:<i>` ids resolve to real rows.
  const newPackIds: string[] = [];
  for (const open of plan.opens) {
    newPackIds.push(
      await openPack(tx, { itemId: item.id, packSize: open.packSize, userId })
    );
  }
  const resolve = (id: string) =>
    id.startsWith(NEW_PACK_PREFIX)
      ? newPackIds[Number(id.slice(NEW_PACK_PREFIX.length))]
      : id;

  for (const take of plan.sealedTaken) {
    await tx.packStock.update({
      where: { itemId_packSize: { itemId: item.id, packSize: take.packSize } },
      data: { sealedCount: { decrement: take.count } },
    });
  }

  // The planner already computed each pack's final remainder, so apply the last
  // one per pack rather than replaying every cut.
  const finalRemainder = new Map<string, number>();
  for (const c of plan.cuts) finalRemainder.set(resolve(c.openPackId), c.remainderAfter);

  const emptied = new Set(plan.emptied.map(resolve));
  const scrapped = new Map(plan.scrap.map((s) => [resolve(s.openPackId), s.length]));

  for (const [packId, remaining] of finalRemainder) {
    if (emptied.has(packId)) {
      await tx.openPack.delete({ where: { id: packId } });
      continue;
    }
    if (scrapped.has(packId)) {
      await tx.openPack.update({
        where: { id: packId },
        data: { remaining, state: "SCRAP" },
      });
      await tx.transaction.create({
        data: {
          type: "SCRAP",
          quantity: remaining,
          itemId: item.id,
          userId,
          note: `Offcut at or below the ${item.scrapThreshold} ${item.baseUnit} threshold`,
        },
      });
      continue;
    }
    await tx.openPack.update({ where: { id: packId }, data: { remaining } });
  }

  await recalcItemStock(tx, item.id);
  return plan;
}

/** Puts material back into stock: a return, or a delivery of loose stock.
 * Sealed packs go back as sealed; loose lengths become open packs, and anything
 * at or below the scrap threshold lands straight in the recycle list. */
export async function restock(
  tx: Prisma.TransactionClient,
  item: { id: string; measure: ItemRules["measure"]; scrapThreshold: number | null },
  args: {
    sealedPacks?: { packSize: number; count: number }[];
    lengths?: number[];
    userId: string;
  }
): Promise<{ scrappedLengths: number[] }> {
  for (const p of args.sealedPacks ?? []) {
    await addPacks(tx, item.id, p.packSize, p.count);
  }

  const scrappedLengths: number[] = [];
  for (const length of args.lengths ?? []) {
    const { scrapped } = await addOpenPack(tx, item, length);
    if (scrapped) {
      scrappedLengths.push(length);
      await tx.transaction.create({
        data: {
          type: "SCRAP",
          quantity: length,
          itemId: item.id,
          userId: args.userId,
          note: `Returned offcut at or below the ${item.scrapThreshold} threshold`,
        },
      });
    }
  }

  await recalcItemStock(tx, item.id);
  return { scrappedLengths };
}
