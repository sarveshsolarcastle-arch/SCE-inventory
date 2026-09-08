import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import {
  addOpenPack,
  addPacks,
  applyInverse,
  commitAllocation,
  openPack,
  recalcItemStock,
  restock,
  AllocationFailedError,
  StaleApprovalError,
} from "./packs.ts";
import { createTestDb, makeContinuousItem, makeDiscreteItem, makeUser, type TestDb } from "./testDb.ts";

/* -------------------------------------------------------------------------
 * DB-layer coverage for packs.ts — flagged in PROGRESS.md as the single most
 * valuable untested surface in the project, `commitAllocation`'s synthetic
 * `new:<i>` pack-id resolution above all. Each test runs against a real,
 * freshly-migrated SQLite file (see testDb.ts) inside its own
 * prisma.$transaction, so nothing here can leak into another test.
 * ---------------------------------------------------------------------- */

let db: TestDb;

before(() => {
  db = createTestDb();
});

after(async () => {
  await db.cleanup();
});

test("recalcItemStock: sums sealed + open, excludes scrap, and is the only writer", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });

  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 3);
    await addPacks(tx, item.id, 600, 2);
    await addOpenPack(tx, item, 50);
    await addOpenPack(tx, item, 10); // at/below threshold -> scrap, excluded
    await recalcItemStock(tx, item.id);
  });

  const after1 = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(after1.currentStock, 3 * 400 + 2 * 600 + 50); // scrap NOT counted
  assert.equal(after1.scrapStock, 10);
});

test("addOpenPack: a length at or below the scrap threshold is created as SCRAP directly", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });

  const atThreshold = await prisma.$transaction((tx) => addOpenPack(tx, item, 15));
  const aboveThreshold = await prisma.$transaction((tx) => addOpenPack(tx, item, 16));

  assert.equal(atThreshold.scrapped, true, "exactly at the threshold scraps");
  assert.equal(aboveThreshold.scrapped, false);

  const rows = await prisma.openPack.findMany({ where: { itemId: item.id }, orderBy: { remaining: "asc" } });
  assert.deepEqual(rows.map((r) => [r.remaining, r.state]), [
    [15, "SCRAP"],
    [16, "OPEN"],
  ]);
});

test("openPack: the only entry point that opens a sealed pack; refuses when none is sealed", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma);
  const user = await makeUser(prisma);

  await assert.rejects(
    () => prisma.$transaction((tx) => openPack(tx, { itemId: item.id, packSize: 400, userId: user.id })),
    /No sealed 400 pack available/
  );

  await prisma.$transaction((tx) => addPacks(tx, item.id, 400, 1));
  const openPackId = await prisma.$transaction((tx) =>
    openPack(tx, { itemId: item.id, packSize: 400, userId: user.id })
  );

  const sealed = await prisma.packStock.findUniqueOrThrow({
    where: { itemId_packSize: { itemId: item.id, packSize: 400 } },
  });
  assert.equal(sealed.sealedCount, 0, "the sealed roll was consumed");

  const opened = await prisma.openPack.findUniqueOrThrow({ where: { id: openPackId } });
  assert.equal(opened.remaining, 400);
  assert.equal(opened.originalSize, 400);

  const logged = await prisma.transaction.findFirstOrThrow({ where: { itemId: item.id, type: "OPEN_PACK" } });
  assert.equal(logged.quantity, 400);
});

test("commitAllocation: best-fit cuts the smallest roll that fits, no opens needed", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addOpenPack(tx, item, 50);
    await addOpenPack(tx, item, 30);
    await addOpenPack(tx, item, 20);
    await recalcItemStock(tx, item.id);
  });

  const { plan } = await prisma.$transaction((tx) =>
    commitAllocation(
      tx,
      item,
      { sealedPacks: [], pieces: [{ length: 25, count: 1 }], loose: 0 },
      [],
      user.id
    )
  );

  assert.equal(plan.opens.length, 0, "no roll needed opening");
  const rows = await prisma.openPack.findMany({ where: { itemId: item.id }, orderBy: { remaining: "asc" } });
  // The 30 was cut to 5, which is at/below the 15 threshold -> scrapped; the
  // 50 and 20 are untouched.
  assert.deepEqual(rows.map((r) => [r.remaining, r.state]), [
    [5, "SCRAP"],
    [20, "OPEN"],
    [50, "OPEN"],
  ]);

  const refreshed = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
  // Stock drops by the WHOLE roll cut (30), not just the 25 issued — the 5m
  // stub is measured waste, not usable stock.
  assert.equal(refreshed.currentStock, 50 + 20);
  assert.equal(refreshed.scrapStock, 5);
});

test("commitAllocation: needing a sealed pack opened resolves the synthetic new:<i> id onto a real row", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 1);
    await recalcItemStock(tx, item.id);
  });

  const { plan, applied } = await prisma.$transaction((tx) =>
    commitAllocation(
      tx,
      item,
      { sealedPacks: [], pieces: [{ length: 150, count: 1 }], loose: 0 },
      [{ packSize: 400, count: 1 }],
      user.id
    )
  );

  assert.equal(plan.opens.length, 1);
  assert.equal(plan.opens[0].packSize, 400);

  const sealed = await prisma.packStock.findUniqueOrThrow({
    where: { itemId_packSize: { itemId: item.id, packSize: 400 } },
  });
  assert.equal(sealed.sealedCount, 0);

  const openRows = await prisma.openPack.findMany({ where: { itemId: item.id } });
  assert.equal(openRows.length, 1);
  assert.equal(openRows[0].remaining, 400 - 150);
  assert.equal(openRows[0].originalSize, 400);

  // The AppliedPlan's "created" entry must name the REAL row, not "new:0" —
  // this is the resolution the synthetic id exists to prove.
  assert.equal(applied.created.length, 1);
  assert.equal(applied.created[0].id, openRows[0].id);
  assert.ok(!applied.created[0].id.startsWith("new:"));
});

test("commitAllocation: exceeding the approved opens throws StaleApprovalError and writes nothing", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 1);
    await recalcItemStock(tx, item.id);
  });

  await assert.rejects(
    () =>
      prisma.$transaction((tx) =>
        commitAllocation(
          tx,
          item,
          { sealedPacks: [], pieces: [{ length: 150, count: 1 }], loose: 0 },
          [], // nothing approved, but this needs a 400 opened
          user.id
        )
      ),
    (err: unknown) => err instanceof StaleApprovalError
  );

  const sealed = await prisma.packStock.findUniqueOrThrow({
    where: { itemId_packSize: { itemId: item.id, packSize: 400 } },
  });
  assert.equal(sealed.sealedCount, 1, "the transaction rolled back — nothing opened");
  assert.equal(await prisma.openPack.count({ where: { itemId: item.id } }), 0);
});

test("commitAllocation: a piece longer than any pack is a hard error, not an open", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 5);
    await recalcItemStock(tx, item.id);
  });

  await assert.rejects(
    () =>
      prisma.$transaction((tx) =>
        commitAllocation(
          tx,
          item,
          { sealedPacks: [], pieces: [{ length: 500, count: 1 }], loose: 0 },
          [{ packSize: 400, count: 99 }], // even fully approved, still impossible
          user.id
        )
      ),
    (err: unknown) => err instanceof AllocationFailedError
  );

  const sealed = await prisma.packStock.findUniqueOrThrow({
    where: { itemId_packSize: { itemId: item.id, packSize: 400 } },
  });
  assert.equal(sealed.sealedCount, 5, "nothing opened for an impossible request");
});

test("commitAllocation: whole sealed rolls bypass the allocator entirely", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 3);
    await addOpenPack(tx, item, 90); // untouched offcut, proves no cut planning happened
    await recalcItemStock(tx, item.id);
  });

  const { plan } = await prisma.$transaction((tx) =>
    commitAllocation(
      tx,
      item,
      { sealedPacks: [{ packSize: 400, count: 2 }], pieces: [], loose: 0 },
      [],
      user.id
    )
  );

  assert.equal(plan.cuts.length, 0);
  assert.equal(plan.opens.length, 0);

  const sealed = await prisma.packStock.findUniqueOrThrow({
    where: { itemId_packSize: { itemId: item.id, packSize: 400 } },
  });
  assert.equal(sealed.sealedCount, 1);

  const offcut = await prisma.openPack.findFirstOrThrow({ where: { itemId: item.id } });
  assert.equal(offcut.remaining, 90, "the open offcut was never touched");
});

test("commitAllocation: discrete items pool across open packs and never scrap", async () => {
  const { prisma } = db;
  const item = await makeDiscreteItem(prisma);
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addOpenPack(tx, item, 30);
    await addOpenPack(tx, item, 20);
    await addOpenPack(tx, item, 10);
    await recalcItemStock(tx, item.id);
  });

  await prisma.$transaction((tx) =>
    commitAllocation(tx, item, { sealedPacks: [], pieces: [], loose: 60 }, [], user.id)
  );

  assert.equal(await prisma.openPack.count({ where: { itemId: item.id, state: "SCRAP" } }), 0);
  const refreshed = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(refreshed.currentStock, 0, "60 drawn from exactly 60 pooled across three packs");
});

test("restock: sealed packs go back sealed, loose lengths become open packs, sub-threshold scraps", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  const { scrappedLengths } = await prisma.$transaction((tx) =>
    restock(tx, item, { sealedPacks: [{ packSize: 400, count: 2 }], lengths: [40, 12], userId: user.id })
  );

  assert.deepEqual(scrappedLengths, [12]);

  const sealed = await prisma.packStock.findUniqueOrThrow({
    where: { itemId_packSize: { itemId: item.id, packSize: 400 } },
  });
  assert.equal(sealed.sealedCount, 2);

  const rows = await prisma.openPack.findMany({ where: { itemId: item.id }, orderBy: { remaining: "asc" } });
  assert.deepEqual(rows.map((r) => [r.remaining, r.state]), [
    [12, "SCRAP"],
    [40, "OPEN"],
  ]);

  const refreshed = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(refreshed.currentStock, 2 * 400 + 40);
  assert.equal(refreshed.scrapStock, 12);
});

test("applyInverse: replays an AppliedPlan backwards, restoring the exact prior pack state", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  await prisma.$transaction(async (tx) => {
    await addPacks(tx, item.id, 400, 2);
    await recalcItemStock(tx, item.id);
  });

  const before = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });

  const { applied } = await prisma.$transaction((tx) =>
    commitAllocation(
      tx,
      item,
      { sealedPacks: [], pieces: [{ length: 120, count: 1 }], loose: 0 },
      [{ packSize: 400, count: 1 }],
      user.id
    )
  );

  // Sanity: the issue actually changed something, or the reversal proves nothing.
  const midway = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
  assert.notEqual(midway.currentStock, before.currentStock);

  await prisma.$transaction((tx) => applyInverse(tx, item.id, applied));

  const restored = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(restored.currentStock, before.currentStock);
  assert.equal(restored.scrapStock, before.scrapStock);

  const sealed = await prisma.packStock.findUniqueOrThrow({
    where: { itemId_packSize: { itemId: item.id, packSize: 400 } },
  });
  assert.equal(sealed.sealedCount, 2, "the opened roll was restored to sealed");
  assert.equal(await prisma.openPack.count({ where: { itemId: item.id } }), 0);
});

test("applyInverse: a cut roll's remainder is restored, not just compensated with a fresh row", async () => {
  const { prisma } = db;
  const item = await makeContinuousItem(prisma, { scrapThreshold: 15 });
  const user = await makeUser(prisma);

  const created = await prisma.$transaction((tx) => addOpenPack(tx, item, 95));
  await prisma.$transaction((tx) => recalcItemStock(tx, item.id));

  const { applied } = await prisma.$transaction((tx) =>
    commitAllocation(tx, item, { sealedPacks: [], pieces: [{ length: 75, count: 1 }], loose: 0 }, [], user.id)
  );

  const cutRow = await prisma.openPack.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(cutRow.remaining, 20, "95 - 75");

  await prisma.$transaction((tx) => applyInverse(tx, item.id, applied));

  const restoredRow = await prisma.openPack.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(restoredRow.remaining, 95, "same roll, restored to its original length");
  assert.equal(await prisma.openPack.count({ where: { itemId: item.id } }), 1, "no compensating row created");
});
