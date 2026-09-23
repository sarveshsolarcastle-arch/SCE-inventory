import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDelta,
  planAdjustment,
  describeAdjustment,
  describeRefusal,
  type AdjustmentState,
} from "./adjustment.ts";

const PACK = "pack-1";

function state(over: Partial<AdjustmentState> = {}): AdjustmentState {
  return { sealed: [], open: [], ...over };
}

test("the delta is what was found minus what the screen claimed", () => {
  assert.equal(computeDelta(13, 10), 3);
  assert.equal(computeDelta(8, 10), -2);
  assert.equal(computeDelta(10, 10), 0);
});

test("THE CASE THIS EXISTS FOR: a legitimate dispatch between count and apply is preserved", () => {
  // Counted 13 against a ledger of 10. Two packs dispatched before it applied,
  // so the ledger now reads 8. The correction is +3, not "set it to 13".
  const plan = planAdjustment(
    { sealed: [{ packSize: 1, counted: 13, ledger: 10 }], open: [] },
    state({ sealed: [{ packSize: 1, sealedCount: 8 }] })
  );

  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.sealed, [{ packSize: 1, delta: 3, from: 8, to: 11 }]);
  // The absolute version wrote 13 here, re-inventing the two dispatched packs.
  assert.notEqual(plan.sealed[0].to, 13);
});

test("a line the counter agreed with writes nothing at all", () => {
  const plan = planAdjustment(
    {
      sealed: [{ packSize: 400, counted: 2, ledger: 2 }],
      open: [{ packId: PACK, counted: 90, ledger: 90 }],
    },
    state({
      sealed: [{ packSize: 400, sealedCount: 5 }],
      open: [{ id: PACK, remaining: 20, originalSize: 400 }],
    })
  );

  // Both rows agreed, so neither is applied — and crucially neither is REFUSED
  // for disagreeing with a database that has moved on underneath them.
  assert.deepEqual(plan.sealed, []);
  assert.deepEqual(plan.open, []);
  assert.deepEqual(plan.refusals, []);
});

test("a correction that would go negative is refused, never clamped", () => {
  // Sealed 10, counted 6 (a -4 correction), then 8 dispatched: 2 - 4 = -2.
  const plan = planAdjustment(
    { sealed: [{ packSize: 1, counted: 6, ledger: 10 }], open: [] },
    state({ sealed: [{ packSize: 1, sealedCount: 2 }] })
  );

  assert.deepEqual(plan.sealed, []);
  assert.equal(plan.refusals.length, 1);
  assert.deepEqual(plan.refusals[0], {
    kind: "negative",
    label: "sealed 1 packs",
    current: 2,
    delta: -4,
  });
});

test("an open pack that has since been used up refuses the whole count", () => {
  const plan = planAdjustment(
    { sealed: [], open: [{ packId: PACK, counted: 85, ledger: 90 }] },
    state({ open: [] })
  );

  assert.deepEqual(plan.open, []);
  assert.deepEqual(plan.refusals, [{ kind: "pack_gone", packId: PACK }]);
});

test("a pack cannot be corrected to hold more than the roll it came off", () => {
  const plan = planAdjustment(
    { sealed: [], open: [{ packId: PACK, counted: 450, ledger: 90 }] },
    state({ open: [{ id: PACK, remaining: 90, originalSize: 400 }] })
  );

  assert.deepEqual(plan.refusals, [
    { kind: "exceeds_original", packId: PACK, result: 450, originalSize: 400 },
  ]);
});

test("an offcut with no known original size has no upper bound", () => {
  // Returned offcuts are created with originalSize null — there is no roll to
  // measure them against, so nothing to exceed.
  const plan = planAdjustment(
    { sealed: [], open: [{ packId: PACK, counted: 450, ledger: 90 }] },
    state({ open: [{ id: PACK, remaining: 90, originalSize: null }] })
  );

  assert.deepEqual(plan.refusals, []);
  assert.equal(plan.open[0].to, 450);
});

test("a correction landing on exactly zero deletes the pack", () => {
  const plan = planAdjustment(
    { sealed: [], open: [{ packId: PACK, counted: 0, ledger: 40 }] },
    state({ open: [{ id: PACK, remaining: 40, originalSize: 400 }] })
  );

  assert.deepEqual(plan.open, [
    { packId: PACK, delta: -40, from: 40, to: 0, deletes: true },
  ]);
});

test("zero is reached by arithmetic, not by the counter typing it", () => {
  // Counted 0 against a ledger of 40, but 10 came back meanwhile: 50 - 40 = 10.
  // The pack survives, because the counter's claim was "40 short", not "empty".
  const plan = planAdjustment(
    { sealed: [], open: [{ packId: PACK, counted: 0, ledger: 40 }] },
    state({ open: [{ id: PACK, remaining: 50, originalSize: 400 }] })
  );

  assert.equal(plan.open[0].to, 10);
  assert.equal(plan.open[0].deletes, false);
});

test("the silent failure: a pack opened between count and apply is left alone", () => {
  // Sealed 3 -> 2 and a new 400 m open pack appeared, because someone opened a
  // roll. The counter's +1 sealed correction applies to the NEW figure, and the
  // pack they never saw is untouched. The absolute write set sealed back to 4,
  // re-inventing the roll that was opened.
  const plan = planAdjustment(
    { sealed: [{ packSize: 400, counted: 4, ledger: 3 }], open: [] },
    state({
      sealed: [{ packSize: 400, sealedCount: 2 }],
      open: [{ id: "opened-since", remaining: 400, originalSize: 400 }],
    })
  );

  assert.deepEqual(plan.sealed, [{ packSize: 400, delta: 1, from: 2, to: 3 }]);
  assert.deepEqual(plan.open, []);
});

test("a positive correction against a size with no row starts from zero", () => {
  const plan = planAdjustment(
    { sealed: [{ packSize: 600, counted: 2, ledger: 0 }], open: [] },
    state({ sealed: [] })
  );

  assert.deepEqual(plan.sealed, [{ packSize: 600, delta: 2, from: 0, to: 2 }]);
});

test("a negative correction against a size with no row is refused", () => {
  const plan = planAdjustment(
    { sealed: [{ packSize: 600, counted: 0, ledger: 2 }], open: [] },
    state({ sealed: [] })
  );

  assert.equal(plan.refusals[0].kind, "negative");
});

test("every refusal is collected, not just the first", () => {
  const plan = planAdjustment(
    {
      sealed: [{ packSize: 1, counted: 0, ledger: 10 }],
      open: [{ packId: PACK, counted: 5, ledger: 40 }],
    },
    state({ sealed: [{ packSize: 1, sealedCount: 2 }], open: [] })
  );

  assert.equal(plan.refusals.length, 2);
  assert.deepEqual(
    plan.refusals.map((r) => r.kind),
    ["negative", "pack_gone"]
  );
});

test("totals are summed in base units across sealed and open lines", () => {
  const plan = planAdjustment(
    {
      sealed: [
        { packSize: 400, counted: 3, ledger: 2 },
        { packSize: 600, counted: 2, ledger: 2 },
      ],
      open: [{ packId: PACK, counted: 85, ledger: 90 }],
    },
    state({
      sealed: [
        { packSize: 400, sealedCount: 2 },
        { packSize: 600, sealedCount: 2 },
      ],
      open: [{ id: PACK, remaining: 90, originalSize: 400 }],
    })
  );

  assert.equal(plan.ledgerAtCount, 2 * 400 + 2 * 600 + 90);
  assert.equal(plan.countedTotal, 3 * 400 + 2 * 600 + 85);
  assert.equal(plan.countedTotal - plan.ledgerAtCount, 395);
});

test("the note names both moments, so a delayed approval is legible", () => {
  const plan = planAdjustment(
    { sealed: [{ packSize: 1, counted: 13, ledger: 10 }], open: [] },
    state({ sealed: [{ packSize: 1, sealedCount: 8 }] })
  );

  assert.equal(
    describeAdjustment(plan, 8, 11, "pcs"),
    "Counted 13 pcs against a ledger of 10 (+3). Applied to a ledger of 8, giving 11."
  );
});

test("a piece with no ledger row at all becomes a new open pack, not a delta", () => {
  const plan = planAdjustment(
    { sealed: [], open: [], newOpen: [{ length: 50 }] },
    state()
  );

  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.newOpen, [{ length: 50 }]);
  // Counted, but never charged against the ledger it never appeared on — that
  // is what makes the correction total come out including it automatically.
  assert.equal(plan.countedTotal, 50);
  assert.equal(plan.ledgerAtCount, 0);
});

test("a new piece sits alongside an ordinary correction to an existing open pack", () => {
  // The exact motivating case: an existing 12 m open roll is corrected, AND a
  // separate, never-booked-in 50 m offcut is found at the same count.
  const plan = planAdjustment(
    {
      sealed: [],
      open: [{ packId: PACK, counted: 10, ledger: 12 }],
      newOpen: [{ length: 50 }],
    },
    state({ open: [{ id: PACK, remaining: 12, originalSize: 400 }] })
  );

  assert.deepEqual(plan.refusals, []);
  assert.deepEqual(plan.open, [
    { packId: PACK, delta: -2, from: 12, to: 10, deletes: false },
  ]);
  assert.deepEqual(plan.newOpen, [{ length: 50 }]);
  assert.equal(plan.countedTotal, 10 + 50);
  assert.equal(plan.ledgerAtCount, 12);
});

test("a new-piece length of zero or less is silently dropped, not refused", () => {
  // Mirrors a delta of zero on an existing row: nothing to write, nothing to
  // fail on. The form never sends one of these — this guards the pure
  // function itself against a stray blank row reaching it some other way.
  const plan = planAdjustment(
    { sealed: [], open: [], newOpen: [{ length: 0 }, { length: -5 }] },
    state()
  );

  assert.deepEqual(plan.newOpen, []);
  assert.equal(plan.countedTotal, 0);
});

test("newOpen is optional, so every call site that predates it still type-checks", () => {
  const plan = planAdjustment({ sealed: [], open: [] }, state());
  assert.deepEqual(plan.newOpen, []);
});

test("the note folds a new piece into the correction with no special-casing", () => {
  const plan = planAdjustment(
    { sealed: [], open: [], newOpen: [{ length: 50 }] },
    state()
  );

  assert.equal(
    describeAdjustment(plan, 100, 150, "m"),
    "Counted 50 m against a ledger of 0 (+50). Applied to a ledger of 100, giving 150."
  );
});

test("a refusal explains itself well enough to act on", () => {
  const gone = describeRefusal({ kind: "pack_gone", packId: PACK }, "m");
  assert.match(gone, /count again/);

  const negative = describeRefusal(
    { kind: "negative", label: "sealed 400 packs", current: 2, delta: -4 },
    "m"
  );
  assert.match(negative, /only 2 to apply -4 to/);
});
