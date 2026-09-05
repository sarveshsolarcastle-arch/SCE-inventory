/* -------------------------------------------------------------------------
 * Planning a stock adjustment. Pure — no database, no framework — so the
 * arithmetic that decides what a physical count does to the ledger is
 * unit-testable. actions/corrections.ts is the DB side that executes the plan,
 * the same split as allocation.ts / packs.ts and siteBalance.ts / stock.ts.
 *
 * THE POINT OF THIS MODULE: a count records a CORRECTION OF KNOWN SIZE, not a
 * snapshot. The person counting says "the shelf holds 13, the screen says 10",
 * and what is durable in that is the +3, not the 13. The 13 is stale the moment
 * anything legitimate happens afterwards — and something can, because time
 * passes between reading the shelf and pressing Submit, and under an approval
 * queue that gap becomes hours.
 *
 *   Ledger says 10; the shelf holds 13 — three packs received and never booked
 *   in. The correction is filed at 10am. At 11am two packs are legitimately
 *   dispatched: ledger 8, shelf 11. It is applied at noon.
 *
 *     absolute:  sets sealed to 13, re-inventing the two dispatched packs.
 *                No error anywhere.
 *     delta:     8 + 3 = 11. Correct.
 *
 * The delta is right because the SIZE OF AN ERROR is invariant under legitimate
 * movement, while a total is not. It also disposes of a silent failure that has
 * nothing to do with elapsed hours: opening a sealed pack decrements
 * sealedCount and creates an OpenPack, and an absolute write overwrites that
 * decrement, silently re-inventing the pack that was opened. Under a delta the
 * correction applies to the new lower figure and the new open pack is left
 * alone — right, because the counter never made a claim about it.
 *
 * What is deliberately NOT generalised: reversal. stock:reverse refuses when
 * the world has moved on, and that refusal is the feature — appliedPlan exists
 * so restoring a roll that has since been cut cannot invent wire that no longer
 * exists. A delta would break it. This is for adjustment alone.
 * ---------------------------------------------------------------------- */

/** One line of the count form. `ledger` is the figure the form DISPLAYED to
 * the person counting — not whatever the database holds now — because the
 * correction only means anything relative to the number they were disagreeing
 * with. */
export type SealedCount = { packSize: number; counted: number; ledger: number };
export type OpenCount = { packId: string; counted: number; ledger: number };

export type AdjustmentInput = {
  sealed: readonly SealedCount[];
  open: readonly OpenCount[];
};

/** What the packs actually hold right now, read inside the transaction. */
export type AdjustmentState = {
  sealed: readonly { packSize: number; sealedCount: number }[];
  open: readonly { id: string; remaining: number; originalSize: number | null }[];
};

/** Every way an adjustment can be refused. All of them are LOUD: there is no
 * silent outcome left, which is the whole gain over the absolute write. */
export type AdjustmentRefusal =
  /** The open pack being corrected is gone — used up or scrapped since the
   * count. A delta cannot apply to a row that no longer exists, and the packs
   * cannot be pooled instead: the entire point of OpenPack is that a 30 m and a
   * 50 m remainder are not interchangeable. */
  | { kind: "pack_gone"; packId: string }
  /** Applying the correction would drive a figure below zero. Refuse, never
   * clamp — a clamp would silently record something nobody counted. */
  | { kind: "negative"; label: string; current: number; delta: number }
  /** An open pack cannot hold more than the pack it was opened from. */
  | { kind: "exceeds_original"; packId: string; result: number; originalSize: number };

export type SealedChange = { packSize: number; delta: number; from: number; to: number };
export type OpenChange = {
  packId: string;
  delta: number;
  from: number;
  to: number;
  /** A correction landing on exactly zero removes the pack, the same rule the
   * absolute version applied to a counted zero — just reached by arithmetic. */
  deletes: boolean;
};

export type AdjustmentPlan = {
  sealed: SealedChange[];
  open: OpenChange[];
  refusals: AdjustmentRefusal[];
  /** Total the counter said was on the shelf, in base units. */
  countedTotal: number;
  /** Total the form showed them while they counted, in base units. */
  ledgerAtCount: number;
};

/** The correction itself: what the counter found, minus what they were told. */
export function computeDelta(counted: number, ledger: number): number {
  return counted - ledger;
}

/** Plans every line against the packs as they are NOW.
 *
 * Rows whose delta is zero produce no change at all — the counter agreed with
 * the ledger on that line, so there is nothing to write and nothing that can
 * fail. That matters: it means an unchanged line cannot be refused because some
 * unrelated pack moved underneath it.
 *
 * Refusals are collected rather than thrown on the first one, so a count comes
 * back naming everything wrong with it at once — the same choice recordDelivery
 * and recordDispatch make for their per-row errors. The caller refuses the
 * WHOLE adjustment if any survive: a partial count is not a count. */
export function planAdjustment(
  input: AdjustmentInput,
  state: AdjustmentState
): AdjustmentPlan {
  const sealedNow = new Map(state.sealed.map((s) => [s.packSize, s.sealedCount]));
  const openNow = new Map(state.open.map((p) => [p.id, p]));

  const plan: AdjustmentPlan = {
    sealed: [],
    open: [],
    refusals: [],
    countedTotal: 0,
    ledgerAtCount: 0,
  };

  for (const row of input.sealed) {
    plan.countedTotal += row.counted * row.packSize;
    plan.ledgerAtCount += row.ledger * row.packSize;

    const delta = computeDelta(row.counted, row.ledger);
    if (delta === 0) continue;

    // A missing group is not an error for a positive correction — packs of a
    // size the store has run out of still leave the row at zero, and the
    // executor upserts. A negative correction against nothing is impossible.
    const from = sealedNow.get(row.packSize) ?? 0;
    const to = from + delta;
    if (to < 0) {
      plan.refusals.push({
        kind: "negative",
        label: `sealed ${row.packSize} packs`,
        current: from,
        delta,
      });
      continue;
    }
    plan.sealed.push({ packSize: row.packSize, delta, from, to });
  }

  for (const row of input.open) {
    plan.countedTotal += row.counted;
    plan.ledgerAtCount += row.ledger;

    const delta = computeDelta(row.counted, row.ledger);
    if (delta === 0) continue;

    const pack = openNow.get(row.packId);
    if (!pack) {
      plan.refusals.push({ kind: "pack_gone", packId: row.packId });
      continue;
    }

    const to = pack.remaining + delta;
    if (to < 0) {
      plan.refusals.push({
        kind: "negative",
        label: "an open pack",
        current: pack.remaining,
        delta,
      });
      continue;
    }
    if (pack.originalSize !== null && to > pack.originalSize) {
      plan.refusals.push({
        kind: "exceeds_original",
        packId: row.packId,
        result: to,
        originalSize: pack.originalSize,
      });
      continue;
    }

    plan.open.push({
      packId: row.packId,
      delta,
      from: pack.remaining,
      to,
      deletes: to === 0,
    });
  }

  return plan;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** The sentence an admin or a storeman reads when a count is refused. Says what
 * moved and by how much, because "adjustment failed" tells them nothing about
 * whether to recount. */
export function describeRefusal(refusal: AdjustmentRefusal, baseUnit: string): string {
  switch (refusal.kind) {
    case "pack_gone":
      return (
        "One of the open packs you counted has been used up or scrapped since. " +
        "Open packs are not interchangeable, so this count cannot be applied to " +
        "what is left — reload the item and count again."
      );
    case "negative":
      return (
        `Applying this count would leave ${refusal.label} at ` +
        `${refusal.current + refusal.delta}: stock has moved since you counted, ` +
        `and there is now only ${refusal.current} to apply ${signed(refusal.delta)} to. ` +
        `Reload the item and count again.`
      );
    case "exceeds_original":
      return (
        `That correction would put ${refusal.result} ${baseUnit} into a pack opened ` +
        `from a ${refusal.originalSize} ${baseUnit} one, which cannot be right. ` +
        `Record a delivery if this is new stock.`
      );
  }
}

/** The ADJUSTMENT row's note. Two moments have to be legible in it now — what
 * was counted against what the screen said, and what that correction did when
 * it was actually applied — because under an approval queue those can be hours
 * and several movements apart. */
export function describeAdjustment(
  plan: AdjustmentPlan,
  before: number,
  after: number,
  baseUnit: string
): string {
  const correction = plan.countedTotal - plan.ledgerAtCount;
  return (
    `Counted ${plan.countedTotal} ${baseUnit} against a ledger of ` +
    `${plan.ledgerAtCount} (${signed(correction)}). ` +
    `Applied to a ledger of ${before}, giving ${after}.`
  );
}
