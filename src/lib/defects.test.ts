import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { DefectError, markStockDefective, validateMarkDefective, type MarkDefectiveInput } from "./defects.ts";
import { addOpenPack, addPacks, applyInverse, recalcItemStock, StaleApprovalError } from "./packs.ts";
import { findReversalObstacles, parseAppliedPlan } from "./corrections.ts";
import { createTestDb, makeContinuousItem, makeDiscreteItem, makeUser, type TestDb } from "./testDb.ts";

/* -------------------------------------------------------------------------
 * markStockDefective: DB-layer coverage against a real migrated SQLite file.
 * Every test asserts the same three things move together — the stock cache, the
 * DefectiveItem rows, and the ledger row — because that agreement is the whole
 * feature, and reversal is checked by replaying the recorded plan.
 * ---------------------------------------------------------------------- */

let db: TestDb;
before(() => {
  db = createTestDb();
});
after(async () => {
  await db.cleanup();
});

function input(itemId: string, over: Partial<MarkDefectiveInput> = {}): MarkDefectiveInput {
  return { itemId, sealedPacks: [], pieces: [], loose: 0, openPackIds: [], note: null, approvedOpens: [], ...over };
}

test("validateMarkDefective: refuses empty, fractional and duplicate input", () => {
  assert.equal(validateMarkDefective(input("i")), "Enter a quantity");
  assert.match(validateMarkDefective(input("i", { loose: 2.5 }))!, /whole number/);
  assert.match(validateMarkDefective(input("i", { sealedPacks: [{ packSize: 400, count: 0 }] }))!, /greater than zero/);
  assert.match(validateMarkDefective(input("i", { openPackIds: ["a", "a"] }))!, /twice/);
  assert.equal(validateMarkDefective(input("i", { openPackIds: ["a"] })), null);
  assert.equal(validateMarkDefective(input("")), "Choose an item");
});

test("discrete loose quantity: leaves stock, lands as one STOCK defect row, ledger row written", async () => {
  const { prisma } = db;
  const item = await makeDiscreteItem(prisma);
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addOpenPack(tx, item, 100);
    await recalcItemStock(tx, item.id);
  });

  const result = await prisma.$transaction((tx) =>
    markStockDefective(tx, input(item.id, { loose: 30, note: "cracked heads" }), user.id)
  );
  assert.equal(result.total, 30);

  const after1 = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(after1.currentStock, 70);

  const rows = await prisma.defectiveItem.findMany({ where: { itemId: item.id } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantity, 30);
  assert.equal(rows[0].source, "STOCK");
  assert.equal(rows[0].status, "QUARANTINED");
  assert.equal(rows[0].transactionId, result.transactionId);
  assert.equal(rows[0].note, "cracked heads");

  const tx = await prisma.transaction.findUniqueOrThrow({ where: { id: result.transactionId } });
  assert.equal(tx.type, "DEFECT");
  assert.equal(tx.quantity, 30);
  assert.equal(tx.siteId, null);
  assert.ok(tx.appliedPlan, "reversal needs the plan");
});

test("sealed packs: one defect row per size with packSize/packCount; sealed count drops", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma);
  const user = await makeUser(prisma);
  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 3);
    await addPacks(tx, item.id, 600, 2);
    await recalcItemStock(tx, item.id);
  });

  await prisma.$transaction((tx) =>
    markStockDefective(
      tx,
      input(item.id, { sealedPacks: [{ packSize: 400, count: 2 }, { packSize: 600, count: 1 }] }),
      user.id
    )
  );

  const stock = await prisma.packStock.findMany({ where: { itemId: item.id }, orderBy: { packSize: "asc" } });
  assert.deepEqual(stock.map((s) => [s.packSize, s.sealedCount]), [[400, 1], [600, 1]]);
  assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).currentStock, 400 + 600);

  const rows = await prisma.defectiveItem.findMany({ where: { itemId: item.id }, orderBy: { packSize: "asc" } });
  assert.deepEqual(rows.map((r) => [r.packSize, r.packCount, r.quantity]), [[400, 2, 800], [600, 1, 600]]);
});

test("more than is on the shelf is refused and writes nothing", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma);
  const user = await makeUser(prisma);
  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 1);
    await recalcItemStock(tx, item.id);
  });

  await assert.rejects(
    () => prisma.$transaction((tx) => markStockDefective(tx, input(item.id, { sealedPacks: [{ packSize: 400, count: 2 }] }), user.id)),
    /Only 1 sealed 400/
  );
  assert.equal(await prisma.defectiveItem.count({ where: { itemId: item.id } }), 0);
  assert.equal(await prisma.transaction.count({ where: { itemId: item.id, type: "DEFECT" } }), 0);
  assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).currentStock, 400);
});

test("a cut length needing a sealed pack opened asks first, and writes nothing until approved", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma);
  const user = await makeUser(prisma);
  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 1);
    await recalcItemStock(tx, item.id);
  });

  await assert.rejects(
    () => prisma.$transaction((tx) => markStockDefective(tx, input(item.id, { pieces: [{ length: 50, count: 1 }] }), user.id)),
    (e: unknown) => e instanceof StaleApprovalError && e.required[0].packSize === 400
  );
  assert.equal(await prisma.defectiveItem.count({ where: { itemId: item.id } }), 0);

  await prisma.$transaction((tx) =>
    markStockDefective(
      tx,
      input(item.id, { pieces: [{ length: 50, count: 1 }], approvedOpens: [{ packSize: 400, count: 1 }] }),
      user.id
    )
  );
  const open = await prisma.openPack.findMany({ where: { itemId: item.id, state: "OPEN" } });
  assert.deepEqual(open.map((p) => p.remaining), [350]);
  assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).currentStock, 350);
  assert.equal((await prisma.defectiveItem.findFirstOrThrow({ where: { itemId: item.id } })).quantity, 50);
});

test("whole open pack: removed and recorded, and an already-gone pack is refused not skipped", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma);
  const user = await makeUser(prisma);
  const packId = await prisma.$transaction(async (tx) => {
    const { id } = await addOpenPack(tx, item, 47);
    await addOpenPack(tx, item, 90);
    await recalcItemStock(tx, item.id);
    return id;
  });

  await prisma.$transaction((tx) => markStockDefective(tx, input(item.id, { openPackIds: [packId] }), user.id));

  assert.equal(await prisma.openPack.count({ where: { id: packId } }), 0);
  assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).currentStock, 90);
  assert.equal((await prisma.defectiveItem.findFirstOrThrow({ where: { itemId: item.id } })).quantity, 47);

  await assert.rejects(
    () => prisma.$transaction((tx) => markStockDefective(tx, input(item.id, { openPackIds: [packId] }), user.id)),
    (e: unknown) => e instanceof DefectError
  );
});

test("a whole open pack plus a cut in one go never cuts from the pack that was picked", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma);
  const user = await makeUser(prisma);
  const [small, big] = await prisma.$transaction(async (tx) => {
    const a = await addOpenPack(tx, item, 60);
    const b = await addOpenPack(tx, item, 200);
    await recalcItemStock(tx, item.id);
    return [a.id, b.id];
  });

  // Best-fit would cut 50 from the 60 — the very pack being written off.
  await prisma.$transaction((tx) =>
    markStockDefective(tx, input(item.id, { openPackIds: [small], pieces: [{ length: 50, count: 1 }] }), user.id)
  );

  const left = await prisma.openPack.findMany({ where: { itemId: item.id, state: "OPEN" } });
  assert.deepEqual(left.map((p) => [p.id, p.remaining]), [[big, 150]]);
  const row = await prisma.defectiveItem.findFirstOrThrow({ where: { itemId: item.id } });
  assert.equal(row.quantity, 60 + 50);
});

test("reversal: replaying the plan restores packs and removes the defect rows", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma);
  const user = await makeUser(prisma);
  const packId = await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 2);
    const { id } = await addOpenPack(tx, item, 47);
    await recalcItemStock(tx, item.id);
    return id;
  });

  const { transactionId } = await prisma.$transaction((tx) =>
    markStockDefective(tx, input(item.id, { sealedPacks: [{ packSize: 400, count: 1 }], openPackIds: [packId] }), user.id)
  );
  assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).currentStock, 400);

  const movement = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
  const plan = parseAppliedPlan(movement.appliedPlan)!;
  assert.equal(plan.defectiveIds.length, 2);

  await prisma.$transaction((tx) => applyInverse(tx, item.id, plan));

  assert.equal((await prisma.item.findUniqueOrThrow({ where: { id: item.id } })).currentStock, 800 + 47);
  assert.equal(await prisma.defectiveItem.count({ where: { itemId: item.id } }), 0);
  const restored = await prisma.openPack.findUniqueOrThrow({ where: { id: packId } });
  assert.equal(restored.remaining, 47);
});

test("reversal is blocked once the supplier claim has started", async () => {
  const { prisma } = db;
  const item = await makeDiscreteItem(prisma);
  const user = await makeUser(prisma);
  await prisma.$transaction(async (tx) => {
    await addOpenPack(tx, item, 100);
    await recalcItemStock(tx, item.id);
  });
  const { transactionId } = await prisma.$transaction((tx) => markStockDefective(tx, input(item.id, { loose: 10 }), user.id));

  await prisma.defectiveItem.updateMany({ where: { transactionId }, data: { status: "CLAIMED" } });

  const plan = parseAppliedPlan((await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } })).appliedPlan)!;
  const rows = await prisma.defectiveItem.findMany({ where: { id: { in: plan.defectiveIds } } });
  const obstacles = findReversalObstacles(plan, {
    openPacks: new Map((await prisma.openPack.findMany({ where: { itemId: item.id } })).map((p) => [p.id, { remaining: p.remaining, state: p.state }])),
    sealedCounts: new Map(),
    defectiveStatuses: new Map(rows.map((r) => [r.id, r.status])),
  });
  assert.ok(obstacles.some((o) => o.kind === "defect_claimed"));
});
