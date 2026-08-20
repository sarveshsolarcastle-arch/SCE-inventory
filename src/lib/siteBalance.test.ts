import test from "node:test";
import assert from "node:assert/strict";
import { siteDelta, oldestContributingDate } from "./siteBalance.ts";

const A = "site-a";
const B = "site-b";

function mv(
  type: string,
  quantity: number,
  opts: { siteId?: string | null; fromSiteId?: string | null; day?: number } = {}
) {
  return {
    type,
    quantity,
    siteId: opts.siteId ?? null,
    fromSiteId: opts.fromSiteId ?? null,
    createdAt: new Date(2026, 0, opts.day ?? 1),
  };
}

test("an issue adds to the site it went to", () => {
  assert.equal(siteDelta(mv("ISSUE", 100, { siteId: A }), A), 100);
});

test("a return and a consume both subtract", () => {
  assert.equal(siteDelta(mv("RETURN", 30, { siteId: A }), A), -30);
  assert.equal(siteDelta(mv("CONSUME", 40, { siteId: A }), A), -40);
});

test("consuming is what finally lets a site's holding go down without coming back", () => {
  const rows = [mv("ISSUE", 1200, { siteId: A }), mv("CONSUME", 1000, { siteId: A })];
  assert.equal(
    rows.reduce((s, t) => s + siteDelta(t, A), 0),
    200
  );
});

test("a transfer adds at the destination and subtracts at the origin", () => {
  const transfer = mv("TRANSFER", 500, { siteId: B, fromSiteId: A });
  assert.equal(siteDelta(transfer, B), 500);
  assert.equal(siteDelta(transfer, A), -500);
});

test("a transfer between two other sites does not touch a third", () => {
  const transfer = mv("TRANSFER", 500, { siteId: B, fromSiteId: A });
  assert.equal(siteDelta(transfer, "site-c"), 0);
});

test("a movement for another site contributes nothing", () => {
  assert.equal(siteDelta(mv("ISSUE", 100, { siteId: B }), A), 0);
});

test("FIFO age reports the oldest material still present", () => {
  // 100 arrives day 1, 50 more day 10; 100 is consumed. What is left is 50
  // from day 10 — NOT day 1, which no longer contributes.
  const date = oldestContributingDate(
    [
      mv("ISSUE", 100, { siteId: A, day: 1 }),
      mv("ISSUE", 50, { siteId: A, day: 10 }),
      mv("CONSUME", 100, { siteId: A, day: 12 }),
    ],
    A
  );
  assert.equal(date?.getDate(), 10);
});

test("age reflects a re-issue rather than the first issue ever", () => {
  // The trap a plain "earliest issue date" falls into: everything came back,
  // then new material arrived. Age must date from the re-issue.
  const date = oldestContributingDate(
    [
      mv("ISSUE", 100, { siteId: A, day: 1 }),
      mv("RETURN", 100, { siteId: A, day: 5 }),
      mv("ISSUE", 40, { siteId: A, day: 20 }),
    ],
    A
  );
  assert.equal(date?.getDate(), 20);
});

test("partially drawing a lot leaves it as the oldest contributor", () => {
  const date = oldestContributingDate(
    [
      mv("ISSUE", 100, { siteId: A, day: 3 }),
      mv("ISSUE", 50, { siteId: A, day: 9 }),
      mv("CONSUME", 60, { siteId: A, day: 11 }),
    ],
    A
  );
  // 40 of the day-3 lot survives, so day 3 is still the oldest.
  assert.equal(date?.getDate(), 3);
});

test("material transferred in is aged from its arrival at THIS site", () => {
  const date = oldestContributingDate(
    [mv("TRANSFER", 200, { siteId: B, fromSiteId: A, day: 15 })],
    B
  );
  assert.equal(date?.getDate(), 15);
});

test("nothing left means no age at all", () => {
  const date = oldestContributingDate(
    [mv("ISSUE", 100, { siteId: A, day: 1 }), mv("RETURN", 100, { siteId: A, day: 4 })],
    A
  );
  assert.equal(date, null);
});
