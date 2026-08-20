import test from "node:test";
import assert from "node:assert/strict";
import { matchItem, type MatchableItem } from "./matching.ts";

const ITEMS: MatchableItem[] = [
  { id: "i1", name: "Wire 2.5mm²", sku: "WIRE-2.5" },
  { id: "i2", name: "Wire 4mm²", sku: "WIRE-4" },
  { id: "i3", name: "Screws M4", sku: "SCR-M4" },
  { id: "i4", name: "Inverter 5kW", sku: "INV-5K" },
];

test("exact match on name, case-insensitive", () => {
  assert.deepEqual(matchItem("screws m4", ITEMS), { status: "exact", itemId: "i3" });
});

test("exact match on SKU", () => {
  assert.deepEqual(matchItem("inv-5k", ITEMS), { status: "exact", itemId: "i4" });
});

test("a typo still suggests the right item", () => {
  const result = matchItem("wire 2.5mm sq", ITEMS);
  assert.equal(result.status, "suggested");
  assert.equal((result as { itemId: string }).itemId, "i1");
});

test("nonsense text is unmatched, not forced onto the nearest item", () => {
  assert.deepEqual(matchItem("xyzzy plugh quux", ITEMS), { status: "unmatched" });
});

test("two items tied on score come back ambiguous rather than picking one", () => {
  // "ABX" and "ABY" share exactly one bigram with "AB" ("ab") and differ only
  // in their second, non-matching bigram — their scores against "AB" are
  // therefore mathematically equal, not just close.
  const tied: MatchableItem[] = [
    { id: "x1", name: "ABX", sku: "X1" },
    { id: "x2", name: "ABY", sku: "X2" },
  ];
  const result = matchItem("AB", tied);
  assert.equal(result.status, "ambiguous");
  const ids = (result as { candidates: { itemId: string }[] }).candidates
    .map((c) => c.itemId)
    .sort();
  assert.deepEqual(ids, ["x1", "x2"]);
});

test("blank query is unmatched", () => {
  assert.deepEqual(matchItem("   ", ITEMS), { status: "unmatched" });
});
