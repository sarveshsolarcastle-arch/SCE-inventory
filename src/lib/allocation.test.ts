import test from "node:test";
import assert from "node:assert/strict";
import {
  planAllocation,
  planBatch,
  planNeedsApproval,
  type AllocationRequest,
  type ItemRules,
  type PackSnapshot,
} from "./allocation.ts";

const WIRE: ItemRules = { measure: "CONTINUOUS", scrapThreshold: 15 };
const SCREWS: ItemRules = { measure: "DISCRETE", scrapThreshold: null };

function snap(open: number[], sealed: [number, number][] = []): PackSnapshot {
  return {
    open: open.map((remaining, i) => ({ id: `p${i}`, remaining })),
    sealed: sealed.map(([packSize, sealedCount]) => ({ packSize, sealedCount })),
  };
}

function req(partial: Partial<AllocationRequest> = {}): AllocationRequest {
  return { sealedPacks: [], pieces: [], loose: 0, ...partial };
}

function cut(lengths: number[]): AllocationRequest {
  return req({ pieces: lengths.map((length) => ({ length, count: 1 })) });
}

test("best-fit takes the smallest pack that fits, not the largest", () => {
  const s = snap([50, 30, 20]);
  const plan = planAllocation(WIRE, s, cut([25]));

  // Must cut the 30, leaving 5 — NOT the 50. The exception version of this rule
  // ("skip a pack whose remainder would be scrap") was rejected: it never
  // consumes small packs, so the open pile grows forever.
  assert.equal(plan.cuts.length, 1);
  assert.equal(plan.cuts[0].openPackId, "p1");
  assert.deepEqual(plan.scrap, [{ openPackId: "p1", length: 5 }]);
  assert.deepEqual(
    s.open.map((p) => p.remaining).sort((a, b) => a - b),
    [20, 50]
  );
  // Stock drops by 30 (25 issued + 5 written off), not 25.
  assert.equal(plan.totalBase, 30);
  assert.equal(plan.issuedBase, 25);
});

test("the reconsideration case: 150 m prompts, 75 m x2 does not", () => {
  const single = planAllocation(WIRE, snap([100, 95], [[400, 3]]), cut([150]));
  assert.ok(planNeedsApproval(single), "one continuous 150 m must need a fresh roll");
  assert.deepEqual(single.opens, [{ packSize: 400 }]);

  const s = snap([100, 95], [[400, 3]]);
  const split = planAllocation(WIRE, s, req({ pieces: [{ length: 75, count: 2 }] }));
  assert.deepEqual(split.opens, [], "75 x2 must come from the offcuts");
  assert.equal(split.errors.length, 0);
  assert.deepEqual(
    s.open.map((p) => p.remaining).sort((a, b) => a - b),
    [20, 25]
  );
});

test("a remainder of exactly zero is used up, not scrapped", () => {
  const s = snap([20]);
  const plan = planAllocation(WIRE, s, cut([20]));

  assert.deepEqual(plan.scrap, []);
  assert.deepEqual(plan.emptied, ["p0"]);
  assert.equal(s.open.length, 0);
  assert.equal(plan.totalBase, 20);
});

test("a remainder exactly at the threshold is scrapped", () => {
  const plan = planAllocation(WIRE, snap([65]), cut([50]));
  assert.deepEqual(plan.scrap, [{ openPackId: "p0", length: 15 }]);
});

test("a remainder just above the threshold survives", () => {
  const plan = planAllocation(WIRE, snap([66]), cut([50]));
  assert.deepEqual(plan.scrap, []);
});

test("a piece longer than any pack is a hard error, not a prompt", () => {
  const plan = planAllocation(WIRE, snap([100], [[400, 2]]), cut([500]));

  assert.deepEqual(plan.opens, [], "opening a 400 cannot help, so must not be offered");
  assert.deepEqual(plan.errors, [
    { kind: "no_single_pack", length: 500, largestAvailable: 400 },
  ]);
});

test("nothing opens implicitly — an open is always surfaced for approval", () => {
  const plan = planAllocation(WIRE, snap([], [[400, 3]]), cut([50]));
  assert.ok(planNeedsApproval(plan));
  assert.deepEqual(plan.opens, [{ packSize: 400 }]);
  assert.equal(plan.cuts[0].openPackId, "new:0");
  assert.equal(plan.cuts[0].remainderAfter, 350);
});

test("opening picks the smallest sealed size that fits the piece", () => {
  const plan = planAllocation(WIRE, snap([], [[100, 1], [400, 1], [600, 1]]), cut([150]));
  assert.deepEqual(plan.opens, [{ packSize: 400 }]);
});

test("whole sealed packs bypass the allocator entirely", () => {
  const s = snap([50, 30], [[400, 3]]);
  const plan = planAllocation(WIRE, s, req({ sealedPacks: [{ packSize: 400, count: 2 }] }));

  assert.deepEqual(plan.cuts, [], "no cut planning for whole rolls");
  assert.deepEqual(plan.opens, []);
  assert.deepEqual(plan.scrap, []);
  assert.deepEqual(plan.sealedTaken, [{ packSize: 400, count: 2 }]);
  assert.equal(plan.totalBase, 800);
  assert.deepEqual(s.open.map((p) => p.remaining), [50, 30], "offcuts untouched");
  assert.equal(s.sealed[0].sealedCount, 1);
});

test("taking more sealed packs than exist is rejected", () => {
  const plan = planAllocation(WIRE, snap([], [[400, 1]]), req({
    sealedPacks: [{ packSize: 400, count: 2 }],
  }));
  assert.deepEqual(plan.errors, [
    { kind: "insufficient_sealed", packSize: 400, requested: 2, available: 1 },
  ]);
});

test("discrete items pool across open packs", () => {
  const s = snap([30, 20, 10]);
  const plan = planAllocation(SCREWS, s, req({ loose: 60 }));

  // 60 screws from packets of 30/20/10 is fine — they are countable units.
  // The identical request against wire is impossible; see the next test.
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.totalBase, 60);
  assert.equal(s.open.length, 0);
});

test("continuous items cannot pool — the same numbers fail", () => {
  const plan = planAllocation(WIRE, snap([30, 20, 10]), cut([60]));
  assert.equal(plan.errors.length, 1);
  assert.equal(plan.errors[0].kind, "no_single_pack");
});

test("discrete items never scrap, whatever the remainder", () => {
  const s = snap([30]);
  const plan = planAllocation(
    { measure: "DISCRETE", scrapThreshold: 15 },
    s,
    req({ loose: 28 })
  );
  assert.deepEqual(plan.scrap, [], "two screws left is still two usable screws");
  assert.equal(s.open[0].remaining, 2);
});

test("running short of discrete stock reports what was available", () => {
  const plan = planAllocation(SCREWS, snap([10]), req({ loose: 60 }));
  assert.deepEqual(plan.errors, [{ kind: "insufficient", needed: 60, available: 10 }]);
});

test("planBatch threads one inventory, so rows compete for the same stock", () => {
  const rules = new Map([["wire", WIRE]]);
  const snapshots = new Map([["wire", snap([95], [[400, 2]])]]);
  const rows = [
    { itemId: "wire", request: cut([75]) },
    { itemId: "wire", request: cut([75]) },
  ];

  const results = planBatch(rules, snapshots, rows);

  // Row 1 takes the 95. Row 2 must then need a fresh roll — if both show a
  // clean cut, the batch is not threading state and the commit would overdraw.
  assert.deepEqual(results[0].plan.opens, []);
  assert.deepEqual(results[1].plan.opens, [{ packSize: 400 }]);
});

test("planBatch does not mutate the caller's snapshots", () => {
  const snapshots = new Map([["wire", snap([95])]]);
  planBatch(new Map([["wire", WIRE]]), snapshots, [
    { itemId: "wire", request: cut([75]) },
  ]);
  assert.equal(snapshots.get("wire")!.open[0].remaining, 95);
});

test("a mixed row cuts pieces and hands over sealed rolls in one go", () => {
  const s = snap([95], [[400, 3]]);
  const plan = planAllocation(WIRE, s, req({
    sealedPacks: [{ packSize: 400, count: 2 }],
    pieces: [{ length: 75, count: 1 }],
  }));

  assert.deepEqual(plan.sealedTaken, [{ packSize: 400, count: 2 }]);
  assert.equal(plan.cuts.length, 1);
  assert.deepEqual(plan.opens, [], "the offcut covers the cut, so nothing opens");
  assert.equal(plan.totalBase, 875);
  assert.equal(s.sealed[0].sealedCount, 1);
});

test("longest pieces are placed first", () => {
  // Naive left-to-right would put 30 into the 40 and then strand the 60.
  const s = snap([40, 60]);
  const plan = planAllocation(WIRE, s, req({
    pieces: [{ length: 30, count: 1 }, { length: 60, count: 1 }],
  }));
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.opens.length, 0);
});
