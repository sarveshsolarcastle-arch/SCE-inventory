import test from "node:test";
import assert from "node:assert/strict";
import {
  describeSiteBlockers,
  siteBlockerPhrases,
  type SiteBlockerCounts,
} from "./siteBlockers.ts";

function counts(over: Partial<SiteBlockerCounts> = {}): SiteBlockerCounts {
  return {
    transactions: 0,
    dispatches: 0,
    deliveries: 0,
    defectiveItems: 0,
    pickups: 0,
    ...over,
  };
}

test("a site with nothing attached is safe to delete", () => {
  assert.equal(describeSiteBlockers("North Yard", counts()), null);
});

test("the message names what would be broken, and says what to do instead", () => {
  const message = describeSiteBlockers("North Yard", counts({ transactions: 3 }));
  assert.match(message!, /"North Yard" cannot be deleted/);
  assert.match(message!, /3 stock movements/);
  assert.match(message!, /Rename it instead/);
});

test("one of something is singular", () => {
  assert.deepEqual(siteBlockerPhrases(counts({ transactions: 1 })), ["1 stock movement"]);
  assert.deepEqual(siteBlockerPhrases(counts({ deliveries: 1 })), ["1 delivery"]);
});

test("dispatch and delivery pluralise as English, not by appending s", () => {
  // The inline version this was extracted from built plurals with `+ "s"`,
  // which produced "2 dispatchs" and "2 deliverys" in a message shown to a user
  // at the moment they are being refused something.
  assert.deepEqual(siteBlockerPhrases(counts({ dispatches: 2 })), ["2 dispatches"]);
  assert.deepEqual(siteBlockerPhrases(counts({ deliveries: 2 })), ["2 deliveries"]);
});

test("blockers are listed worst-first, whatever order the counts arrive in", () => {
  const phrases = siteBlockerPhrases(
    counts({ pickups: 1, deliveries: 2, transactions: 5 })
  );
  assert.deepEqual(phrases, ["5 stock movements", "2 deliveries", "1 collection flag"]);
});

test("every blocker is reported, not just the first", () => {
  const phrases = siteBlockerPhrases(
    counts({ transactions: 1, dispatches: 1, deliveries: 1, defectiveItems: 1, pickups: 1 })
  );
  assert.equal(phrases.length, 5);
});

test("a zero count is not a blocker", () => {
  assert.equal(describeSiteBlockers("North Yard", counts({ dispatches: 0 })), null);
});
