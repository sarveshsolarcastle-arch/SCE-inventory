import { test } from "node:test";
import assert from "node:assert/strict";
import { formatChallanNo } from "./challan.ts";

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
