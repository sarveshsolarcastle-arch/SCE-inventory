import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyAppliedPlan,
  findReversalObstacles,
  parseAppliedPlan,
  serialiseAppliedPlan,
  type AppliedPlan,
} from "./corrections.ts";

function world(
  open: [string, number, "OPEN" | "SCRAP"][] = [],
  sealed: [number, number][] = [],
  defective: [string, string][] = []
) {
  return {
    openPacks: new Map(open.map(([id, remaining, state]) => [id, { remaining, state }])),
    sealedCounts: new Map(sealed),
    defectiveStatuses: new Map(defective),
  };
}

function planWith(patch: Partial<AppliedPlan>): AppliedPlan {
  return { ...emptyAppliedPlan(), ...patch };
}

test("a world untouched since the movement has no obstacles", () => {
  const plan = planWith({
    changed: [{ id: "p1", before: { remaining: 95, state: "OPEN" }, after: { remaining: 20, state: "OPEN" } }],
  });
  assert.deepEqual(findReversalObstacles(plan, world([["p1", 20, "OPEN"]])), []);
});

test("refuses when the pack has been cut again — the key safety case", () => {
  const plan = planWith({
    changed: [{ id: "p1", before: { remaining: 95, state: "OPEN" }, after: { remaining: 20, state: "OPEN" } }],
  });
  // Someone took another 5 m. Restoring to 95 would invent wire that is gone.
  const obstacles = findReversalObstacles(plan, world([["p1", 15, "OPEN"]]));
  assert.equal(obstacles.length, 1);
  assert.deepEqual(obstacles[0], {
    kind: "pack_changed", packId: "p1", expected: 20, found: 15,
  });
});

test("refuses when a pack it touched has since vanished", () => {
  const plan = planWith({
    changed: [{ id: "p1", before: { remaining: 95, state: "OPEN" }, after: { remaining: 20, state: "OPEN" } }],
  });
  assert.deepEqual(findReversalObstacles(plan, world([])), [
    { kind: "pack_missing", packId: "p1" },
  ]);
});

test("refuses when a pack it consumed to zero has been recreated", () => {
  const plan = planWith({
    deleted: [{ id: "p9", remaining: 20, originalSize: 400, state: "OPEN", shelfSlotId: null }],
  });
  assert.deepEqual(findReversalObstacles(plan, world([["p9", 20, "OPEN"]])), [
    { kind: "pack_reappeared", packId: "p9" },
  ]);
  assert.deepEqual(findReversalObstacles(plan, world([])), []);
});

test("a scrapped remainder is only reversible while still scrapped", () => {
  const plan = planWith({
    changed: [{ id: "p1", before: { remaining: 65, state: "OPEN" }, after: { remaining: 15, state: "SCRAP" } }],
  });
  assert.deepEqual(findReversalObstacles(plan, world([["p1", 15, "SCRAP"]])), []);
  assert.equal(findReversalObstacles(plan, world([["p1", 15, "OPEN"]])).length, 1);
});

test("refuses to un-add sealed packs that are no longer there", () => {
  // The movement added 3 sealed rolls; two have since been issued.
  const plan = planWith({ sealedDelta: [{ packSize: 400, delta: 3 }] });
  assert.deepEqual(findReversalObstacles(plan, world([], [[400, 1]])), [
    { kind: "insufficient_sealed", packSize: 400, needed: 3, available: 1 },
  ]);
  assert.deepEqual(findReversalObstacles(plan, world([], [[400, 3]])), []);
});

test("un-taking sealed packs is always possible", () => {
  // A negative delta means the movement consumed them; reversing puts them back,
  // which nothing can obstruct.
  const plan = planWith({ sealedDelta: [{ packSize: 400, delta: -2 }] });
  assert.deepEqual(findReversalObstacles(plan, world([], [[400, 0]])), []);
});

test("refuses once a defective record has been claimed with the supplier", () => {
  const plan = planWith({ defectiveIds: ["d1"] });
  assert.deepEqual(findReversalObstacles(plan, world([], [], [["d1", "QUARANTINED"]])), []);
  assert.deepEqual(findReversalObstacles(plan, world([], [], [["d1", "CLAIMED"]])), [
    { kind: "defect_claimed", defectiveId: "d1" },
  ]);
});

test("a created pack must still be exactly as it was left", () => {
  const plan = planWith({
    created: [{ id: "n1", remaining: 350, originalSize: 400, state: "OPEN", shelfSlotId: null }],
  });
  assert.deepEqual(findReversalObstacles(plan, world([["n1", 350, "OPEN"]])), []);
  assert.equal(findReversalObstacles(plan, world([["n1", 300, "OPEN"]])).length, 1);
});

test("round-trips through JSON, and malformed input is not reversible", () => {
  const plan = planWith({ sealedDelta: [{ packSize: 400, delta: -1 }] });
  assert.deepEqual(parseAppliedPlan(serialiseAppliedPlan(plan)), plan);
  assert.equal(parseAppliedPlan(null), null);
  assert.equal(parseAppliedPlan("not json"), null);
});
