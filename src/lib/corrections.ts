/* -------------------------------------------------------------------------
 * Reversal and adjustment are different operations, and conflating them
 * corrupts pack state:
 *
 *   Reversal   "this was recorded in error — it never happened."
 *              Restores the exact prior state: the 75 m goes back ON THE ROLL
 *              it came off.
 *   Adjustment "the shelf and the app disagree, and the shelf is right."
 *              Restores nothing; it records a new truth, with a reason.
 *   Return     "it happened, and now it's coming back."  (already exists)
 *              Creates a NEW 75 m offcut, because that is what physically
 *              arrives.
 *
 * This module holds the record of what a movement did, and the pure logic for
 * inverting it.
 * ---------------------------------------------------------------------- */

export type PackSnapshotRow = {
  id: string;
  remaining: number;
  originalSize: number | null;
  state: "OPEN" | "SCRAP";
  shelfSlotId: string | null;
};

/** Everything one movement changed, in a form that can be replayed backwards. */
export type AppliedPlan = {
  /** Net change to sealed counts, by pack size. Positive = added to stock. */
  sealedDelta: { packSize: number; delta: number }[];
  /** Open packs this movement created. Reversing deletes them. */
  created: PackSnapshotRow[];
  /** Open packs this movement deleted (consumed to exactly zero). Reversing
   * recreates them with their original ids. */
  deleted: PackSnapshotRow[];
  /** Open packs whose remaining or state changed. */
  changed: {
    id: string;
    before: { remaining: number; state: "OPEN" | "SCRAP" };
    after: { remaining: number; state: "OPEN" | "SCRAP" };
  }[];
  /** DefectiveItem rows created. Reversing deletes them — but only while they
   * are still QUARANTINED; once a claim is with the supplier the record is no
   * longer ours alone to erase. */
  defectiveIds: string[];
};

export function emptyAppliedPlan(): AppliedPlan {
  return { sealedDelta: [], created: [], deleted: [], changed: [], defectiveIds: [] };
}

export function addSealedDelta(plan: AppliedPlan, packSize: number, delta: number) {
  if (delta === 0) return;
  const existing = plan.sealedDelta.find((s) => s.packSize === packSize);
  if (existing) existing.delta += delta;
  else plan.sealedDelta.push({ packSize, delta });
}

export function serialiseAppliedPlan(plan: AppliedPlan): string {
  return JSON.stringify(plan);
}

/** Tolerant of null and malformed JSON: an unreadable plan means "cannot be
 * reversed", never a crash. */
export function parseAppliedPlan(raw: string | null | undefined): AppliedPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppliedPlan;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      sealedDelta: parsed.sealedDelta ?? [],
      created: parsed.created ?? [],
      deleted: parsed.deleted ?? [],
      changed: parsed.changed ?? [],
      defectiveIds: parsed.defectiveIds ?? [],
    };
  } catch {
    return null;
  }
}

export type ReversalObstacle =
  | { kind: "no_plan" }
  | { kind: "already_reversed" }
  | { kind: "pack_changed"; packId: string; expected: number; found: number }
  | { kind: "pack_missing"; packId: string }
  | { kind: "pack_reappeared"; packId: string }
  | { kind: "insufficient_sealed"; packSize: number; needed: number; available: number }
  | { kind: "defect_claimed"; defectiveId: string };

/** Checks the world still looks exactly as this movement left it.
 *
 * This is the heart of safe reversal. If someone has cut that roll again since,
 * restoring it would invent wire that no longer exists — so reversal refuses
 * and points at an adjustment instead. Being honest about the limit is what
 * makes the safe path trustworthy. */
export function findReversalObstacles(
  plan: AppliedPlan,
  world: {
    openPacks: Map<string, { remaining: number; state: "OPEN" | "SCRAP" }>;
    sealedCounts: Map<number, number>;
    defectiveStatuses: Map<string, string>;
  }
): ReversalObstacle[] {
  const obstacles: ReversalObstacle[] = [];

  for (const change of plan.changed) {
    const current = world.openPacks.get(change.id);
    if (!current) {
      obstacles.push({ kind: "pack_missing", packId: change.id });
      continue;
    }
    if (current.remaining !== change.after.remaining || current.state !== change.after.state) {
      obstacles.push({
        kind: "pack_changed",
        packId: change.id,
        expected: change.after.remaining,
        found: current.remaining,
      });
    }
  }

  for (const pack of plan.created) {
    const current = world.openPacks.get(pack.id);
    if (!current) {
      obstacles.push({ kind: "pack_missing", packId: pack.id });
    } else if (current.remaining !== pack.remaining || current.state !== pack.state) {
      obstacles.push({
        kind: "pack_changed",
        packId: pack.id,
        expected: pack.remaining,
        found: current.remaining,
      });
    }
  }

  // A pack this movement consumed to zero must still be gone; if something has
  // recreated it, restoring our copy would duplicate material.
  for (const pack of plan.deleted) {
    if (world.openPacks.has(pack.id)) {
      obstacles.push({ kind: "pack_reappeared", packId: pack.id });
    }
  }

  // Undoing a delta that ADDED sealed packs means removing them again — only
  // possible if they are still there.
  for (const { packSize, delta } of plan.sealedDelta) {
    if (delta > 0) {
      const available = world.sealedCounts.get(packSize) ?? 0;
      if (available < delta) {
        obstacles.push({ kind: "insufficient_sealed", packSize, needed: delta, available });
      }
    }
  }

  for (const id of plan.defectiveIds) {
    const status = world.defectiveStatuses.get(id);
    if (status && status !== "QUARANTINED") {
      obstacles.push({ kind: "defect_claimed", defectiveId: id });
    }
  }

  return obstacles;
}

export function describeObstacle(o: ReversalObstacle): string {
  switch (o.kind) {
    case "no_plan":
      return "This movement predates reversal support, so there is no record of what it changed. Use a stock adjustment instead.";
    case "already_reversed":
      return "This movement has already been reversed.";
    case "pack_changed":
      return `A pack has been used since (expected ${o.expected} left, found ${o.found}). Reversing would restore material that no longer exists — use a stock adjustment instead.`;
    case "pack_missing":
      return "A pack this movement touched no longer exists. Use a stock adjustment instead.";
    case "pack_reappeared":
      return "A pack this movement used up has been recreated since. Use a stock adjustment instead.";
    case "insufficient_sealed":
      return `Only ${o.available} sealed ${o.packSize} pack(s) remain but reversing would remove ${o.needed}. Use a stock adjustment instead.`;
    case "defect_claimed":
      return "A defective record from this movement has already been claimed with the supplier, so it cannot be erased.";
  }
}
