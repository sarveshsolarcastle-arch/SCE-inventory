import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatChallanNo,
  formatSiteChallanNo,
  formatTransferChallanNo,
  siteChallanOf,
} from "./challan.ts";

test("pads to four digits", () => {
  assert.equal(formatChallanNo(1), "SCE/DC/0001");
  assert.equal(formatChallanNo(42), "SCE/DC/0042");
  assert.equal(formatChallanNo(1234), "SCE/DC/1234");
});

test("runs on past four digits rather than wrapping", () => {
  // A fifth digit is untidy; a number that repeats would be a false record.
  assert.equal(formatChallanNo(12345), "SCE/DC/12345");
});

test("every number formats to a distinct string", () => {
  const seen = new Set<string>();
  for (let n = 1; n <= 2000; n++) seen.add(formatChallanNo(n));
  assert.equal(seen.size, 2000);
});

test("site challan format is told apart from the dispatch one", () => {
  assert.equal(formatSiteChallanNo(1), "SCE/SDC/0001");
  assert.equal(formatSiteChallanNo(42), "SCE/SDC/0042");
  assert.notEqual(formatSiteChallanNo(42), formatChallanNo(42));
});

test("transfer challan format is told apart from the other two", () => {
  assert.equal(formatTransferChallanNo(1), "SCE/TC/0001");
  assert.equal(formatTransferChallanNo(42), "SCE/TC/0042");
  assert.notEqual(formatTransferChallanNo(42), formatChallanNo(42));
  assert.notEqual(formatTransferChallanNo(42), formatSiteChallanNo(42));
});

test("the three challan formats are mutually distinct for the same n", () => {
  for (let n = 1; n <= 500; n++) {
    const formats = [formatChallanNo(n), formatSiteChallanNo(n), formatTransferChallanNo(n)];
    assert.equal(new Set(formats).size, 3, `n=${n} produced a collision: ${formats}`);
  }
});

test("siteChallanOf refuses a store delivery", () => {
  assert.equal(siteChallanOf({ challanNo: null, site: null }), null);
});

test("siteChallanOf refuses a site delivery with no number", () => {
  const site = { id: "s1", name: "Site One" } as never;
  assert.equal(siteChallanOf({ challanNo: null, site }), null);
});

test("siteChallanOf accepts a numbered site delivery", () => {
  const site = { id: "s1", name: "Site One" } as never;
  assert.deepEqual(siteChallanOf({ challanNo: 7, site }), { challanNo: 7, site });
});
