import type { MeasureType } from "@/generated/prisma/enums";
import type { Piece } from "@/lib/units";

/* -------------------------------------------------------------------------
 * Pure allocation planning. No database, no framework, no side effects.
 *
 * The same function drives the confirmation screen, the unit tests and the
 * commit, so a preview can never disagree with what actually happens. It also
 * runs in the browser, so a batch re-plans instantly as rows are edited.
 * ---------------------------------------------------------------------- */

export type ItemRules = {
  measure: MeasureType;
  /** CONTINUOUS only. An open pack left at or below this stops being stock. */
  scrapThreshold: number | null;
};

export type OpenPackSnapshot = { id: string; remaining: number };
export type SealedSnapshot = { packSize: number; sealedCount: number };

export type PackSnapshot = {
  open: OpenPackSnapshot[];
  sealed: SealedSnapshot[];
};

export type AllocationRequest = {
  /** Whole sealed packs handed over untouched — these bypass the allocator. */
  sealedPacks: { packSize: number; count: number }[];
  /** CONTINUOUS: every piece must come from ONE pack. Wire is not joined. */
  pieces: Piece[];
  /** DISCRETE: a pooled quantity, freely combined across open packs. */
  loose: number;
};

export type AllocationError =
  /** No single pack — open or sealed — could ever supply a piece this long.
   * Opening something would not help, so this is a hard stop, not a prompt. */
  | { kind: "no_single_pack"; length: number; largestAvailable: number }
  | { kind: "insufficient"; needed: number; available: number }
  | { kind: "insufficient_sealed"; packSize: number; requested: number; available: number };

export type AllocationPlan = {
  /** `openPackId` is either a real id, or `new:<i>` referring to `opens[i]`. */
  cuts: { openPackId: string; length: number; remainderAfter: number }[];
  /** One entry per pack that must be opened, in the order they are opened. */
  opens: { packSize: number }[];
  /** Remainders that would fall at or below the scrap threshold. */
  scrap: { openPackId: string; length: number }[];
  /** Open packs consumed exactly to zero — used up, not scrapped. */
  emptied: string[];
  sealedTaken: { packSize: number; count: number }[];
  /** Total base units leaving stock, INCLUDING scrap. */
  totalBase: number;
  /** Base units actually handed over (excludes scrap). */
  issuedBase: number;
  errors: AllocationError[];
};

export const NEW_PACK_PREFIX = "new:";

function emptyPlan(): AllocationPlan {
  return {
    cuts: [], opens: [], scrap: [], emptied: [], sealedTaken: [],
    totalBase: 0, issuedBase: 0, errors: [],
  };
}

/** A working copy the planner mutates freely, so `planBatch` can thread one
 * inventory through many rows and have them compete for stock realistically. */
export function cloneSnapshot(snap: PackSnapshot): PackSnapshot {
  return {
    open: snap.open.map((p) => ({ ...p })),
    sealed: snap.sealed.map((g) => ({ ...g })),
  };
}

function expandPieces(pieces: readonly Piece[]): number[] {
  const out: number[] = [];
  for (const p of pieces) {
    for (let i = 0; i < p.count; i++) out.push(p.length);
  }
  // Longest first: the hardest pieces get the choice of packs, and short ones
  // mop up whatever is left.
  return out.sort((a, b) => b - a);
}

function largestAvailable(snap: PackSnapshot): number {
  const maxOpen = snap.open.reduce((m, p) => Math.max(m, p.remaining), 0);
  const maxSealed = snap.sealed.reduce(
    (m, g) => (g.sealedCount > 0 ? Math.max(m, g.packSize) : m),
    0
  );
  return Math.max(maxOpen, maxSealed);
}

/** Applies a cut's aftermath: used up entirely, scrapped, or left usable. */
function settle(
  plan: AllocationPlan,
  snap: PackSnapshot,
  pack: OpenPackSnapshot,
  rules: ItemRules
) {
  if (pack.remaining === 0) {
    // Consumed exactly — the pack is gone, and this is NOT a scrap event.
    plan.emptied.push(pack.id);
    snap.open = snap.open.filter((p) => p !== pack);
    return;
  }
  const threshold = rules.scrapThreshold;
  if (rules.measure === "CONTINUOUS" && threshold != null && pack.remaining <= threshold) {
    plan.scrap.push({ openPackId: pack.id, length: pack.remaining });
    plan.totalBase += pack.remaining;
    snap.open = snap.open.filter((p) => p !== pack);
  }
}

/** Takes whole sealed packs without opening anything. */
function takeSealed(
  plan: AllocationPlan,
  snap: PackSnapshot,
  request: AllocationRequest
) {
  for (const take of request.sealedPacks) {
    if (take.count <= 0) continue;
    const group = snap.sealed.find((g) => g.packSize === take.packSize);
    const available = group?.sealedCount ?? 0;
    if (available < take.count) {
      plan.errors.push({
        kind: "insufficient_sealed",
        packSize: take.packSize,
        requested: take.count,
        available,
      });
      continue;
    }
    group!.sealedCount -= take.count;
    plan.sealedTaken.push({ packSize: take.packSize, count: take.count });
    const base = take.packSize * take.count;
    plan.totalBase += base;
    plan.issuedBase += base;
  }
}

/** Opens the smallest sealed pack that can supply `minSize`. Returns the new
 * working pack, or null when no sealed size is big enough. */
function openSmallestSealed(
  plan: AllocationPlan,
  snap: PackSnapshot,
  minSize: number
): OpenPackSnapshot | null {
  const candidate = snap.sealed
    .filter((g) => g.sealedCount > 0 && g.packSize >= minSize)
    .sort((a, b) => a.packSize - b.packSize)[0];
  if (!candidate) return null;

  candidate.sealedCount -= 1;
  const pack: OpenPackSnapshot = {
    id: `${NEW_PACK_PREFIX}${plan.opens.length}`,
    remaining: candidate.packSize,
  };
  plan.opens.push({ packSize: candidate.packSize });
  snap.open.push(pack);
  return pack;
}

function planContinuous(
  plan: AllocationPlan,
  snap: PackSnapshot,
  request: AllocationRequest,
  rules: ItemRules
) {
  for (const length of expandPieces(request.pieces)) {
    // Best-fit: the SMALLEST open pack that still fits. Always — no exception
    // for stubs. Deliberately paired with auto-scrap: the exception version
    // ("skip it if the remainder would be scrap") never consumes small packs,
    // so the open pile grows forever.
    let pack = snap.open
      .filter((p) => p.remaining >= length)
      .sort((a, b) => a.remaining - b.remaining)[0];

    if (!pack) {
      const opened = openSmallestSealed(plan, snap, length);
      if (!opened) {
        plan.errors.push({
          kind: "no_single_pack",
          length,
          largestAvailable: largestAvailable(snap),
        });
        continue;
      }
      pack = opened;
    }

    pack.remaining -= length;
    plan.cuts.push({
      openPackId: pack.id,
      length,
      remainderAfter: pack.remaining,
    });
    plan.totalBase += length;
    plan.issuedBase += length;
    settle(plan, snap, pack, rules);
  }
}

function planDiscrete(
  plan: AllocationPlan,
  snap: PackSnapshot,
  request: AllocationRequest,
  rules: ItemRules
) {
  let need = request.loose;
  if (need <= 0) return;

  while (need > 0) {
    // Smallest first, to close packs out rather than leave a trail of dregs.
    let pack = snap.open.sort((a, b) => a.remaining - b.remaining)[0];

    if (!pack) {
      const opened = openSmallestSealed(plan, snap, 1);
      if (!opened) {
        plan.errors.push({
          kind: "insufficient",
          needed: request.loose,
          available: request.loose - need,
        });
        return;
      }
      pack = opened;
    }

    const take = Math.min(need, pack.remaining);
    pack.remaining -= take;
    need -= take;
    plan.cuts.push({
      openPackId: pack.id,
      length: take,
      remainderAfter: pack.remaining,
    });
    plan.totalBase += take;
    plan.issuedBase += take;
    settle(plan, snap, pack, rules);
  }
}

/** Plans one request against one item's packs, mutating `snap` so a caller can
 * thread the same inventory through several rows. */
export function planAllocation(
  rules: ItemRules,
  snap: PackSnapshot,
  request: AllocationRequest
): AllocationPlan {
  const plan = emptyPlan();
  takeSealed(plan, snap, request);
  if (rules.measure === "CONTINUOUS") {
    planContinuous(plan, snap, request, rules);
  } else {
    planDiscrete(plan, snap, request, rules);
  }
  return plan;
}

export type BatchRow<T = unknown> = {
  itemId: string;
  request: AllocationRequest;
  meta?: T;
};

export type BatchResult<T = unknown> = {
  row: BatchRow<T>;
  index: number;
  plan: AllocationPlan;
};

/** Plans a whole batch against ONE shared inventory, in row order.
 *
 * This is what stops two rows each being told they can have the same 95 m roll:
 * every row sees the stock the rows above it already claimed. A consequence
 * worth knowing — editing row 3 can change row 11's plan, so callers re-plan the
 * whole batch on any edit. That is cheap because this is pure and in-memory. */
export function planBatch<T>(
  rules: ReadonlyMap<string, ItemRules>,
  snapshots: ReadonlyMap<string, PackSnapshot>,
  rows: readonly BatchRow<T>[]
): BatchResult<T>[] {
  const working = new Map<string, PackSnapshot>();
  for (const [itemId, snap] of snapshots) working.set(itemId, cloneSnapshot(snap));

  return rows.map((row, index) => {
    const itemRules = rules.get(row.itemId);
    const snap = working.get(row.itemId);
    if (!itemRules || !snap) {
      const plan = emptyPlan();
      plan.errors.push({ kind: "insufficient", needed: 0, available: 0 });
      return { row, index, plan };
    }
    return { row, index, plan: planAllocation(itemRules, snap, row.request) };
  });
}

export function planNeedsApproval(plan: AllocationPlan): boolean {
  return plan.opens.length > 0;
}

export function planIsBlocked(plan: AllocationPlan): boolean {
  return plan.errors.length > 0;
}
