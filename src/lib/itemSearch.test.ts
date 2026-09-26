import test from "node:test";
import assert from "node:assert/strict";
import { editDistance, searchItems, stem, type SearchableItem } from "./itemSearch.ts";

const ITEMS: SearchableItem[] = [
  { name: "Copper Cable 4mm", sku: "CAB-4", category: "Cables" },
  { name: "Copper Cable 10mm", sku: "CAB-10", category: "Cables" },
  { name: "Copper Cable 16mm", sku: "CAB-16", category: "Cables" },
  { name: "Solar Panel 540W", sku: "PNL-540", category: "Panels" },
  { name: "Lithium Battery", sku: "BAT-LI", category: "Batteries" },
  { name: "MC4 Connector", sku: "MC4-CON", category: null },
  { name: "Cable Tie 200mm", sku: "TIE-200", category: "Fasteners" },
];

const names = (q: string) => searchItems(ITEMS, q).matches.map((m) => m.item.name);

test("stem folds simple plurals", () => {
  assert.equal(stem("cables"), "cable");
  assert.equal(stem("batteries"), "battery");
  assert.equal(stem("boxes"), "box");
  assert.equal(stem("glass"), "glass");
  assert.equal(stem("bus"), "bus");
});

test("edit distance counts a swap as one edit", () => {
  assert.equal(editDistance("cabel", "cable"), 1);
  assert.equal(editDistance("cable", "cable"), 0);
  assert.equal(editDistance("kitten", "sitting"), 3);
});

test("plural query finds the singular item (Cables → cable)", () => {
  const out = searchItems(ITEMS, "Cables");
  assert.equal(out.fuzzy, false);
  assert.equal(out.matches.length, 4);
});

test("singular query finds plural category and plural-named items", () => {
  assert.deepEqual(names("battery"), ["Lithium Battery"]);
  assert.deepEqual(names("batteries"), ["Lithium Battery"]);
});

test("everything the old substring search found is still found", () => {
  assert.deepEqual(names("cab-1"), ["Copper Cable 10mm", "Copper Cable 16mm"]);
  assert.deepEqual(names("PNL"), ["Solar Panel 540W"]);
  assert.equal(searchItems(ITEMS, "r").matches.length > 0, true);
});

test("all words must match, in any order", () => {
  assert.deepEqual(names("16mm copper"), ["Copper Cable 16mm"]);
  assert.deepEqual(names("copper panel"), []);
});

test("a typo gets close matches plus a did-you-mean", () => {
  const out = searchItems(ITEMS, "cabel");
  assert.equal(out.fuzzy, true);
  assert.equal(out.suggestion, "cable");
  assert.equal(out.matches.length, 4);
});

test("a typo inside a multi-word query is corrected in place", () => {
  const out = searchItems(ITEMS, "coper cable");
  assert.equal(out.fuzzy, true);
  assert.equal(out.suggestion, "copper cable");
});

test("no suggestion when the query already matches strictly", () => {
  assert.equal(searchItems(ITEMS, "cable").suggestion, null);
});

test("numbers are never fuzzy-matched: 12mm must not become 10mm", () => {
  assert.deepEqual(names("12mm"), []);
  assert.equal(searchItems(ITEMS, "12mm").fuzzy, false);
});

test("short words are not fuzzy-matched", () => {
  assert.equal(searchItems(ITEMS, "xyz").matches.length, 0);
});

test("nonsense finds nothing and suggests nothing", () => {
  const out = searchItems(ITEMS, "xyzzy plugh");
  assert.deepEqual(out, { matches: [], fuzzy: false, suggestion: null });
});

test("a name hit ranks above a category hit", () => {
  const out = searchItems(ITEMS, "cable");
  const top = out.matches.slice().sort((a, b) => b.score - a.score)[0].item.name;
  assert.match(top, /Cable/);
});

test("punctuation-only or empty query matches nothing rather than everything", () => {
  assert.equal(searchItems(ITEMS, "---").matches.length, 0);
});
