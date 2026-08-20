import test from "node:test";
import assert from "node:assert/strict";
import { parseDispatchPaste } from "./dispatchPaste.ts";

test("parses tab-separated lines into name and quantity", () => {
  const rows = parseDispatchPaste("Wire 2.5mm\t150\nScrews M4\t60");
  assert.deepEqual(
    rows.map((r) => [r.name, r.quantity]),
    [["Wire 2.5mm", 150], ["Screws M4", 60]]
  );
});

test("skips a header row when its quantity cell is a label", () => {
  const rows = parseDispatchPaste("Item\tQty\nWire 2.5mm\t150");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Wire 2.5mm");
});

test("units in the quantity cell are stripped to a number", () => {
  const rows = parseDispatchPaste("Wire 2.5mm\t150 m");
  assert.equal(rows[0].quantity, 150);
  assert.equal(rows[0].quantityText, "150 m");
});

test("extra columns are tolerated — quantity is the last numeric cell", () => {
  const rows = parseDispatchPaste("Wire 2.5mm\tWIRE-2.5\tCable\t150");
  assert.equal(rows[0].name, "Wire 2.5mm");
  assert.equal(rows[0].quantity, 150);
});

test("a line with no numeric cell parses with quantity null", () => {
  const rows = parseDispatchPaste("Wire 2.5mm");
  assert.equal(rows[0].quantity, null);
});

test("blank lines are dropped", () => {
  const rows = parseDispatchPaste("Wire 2.5mm\t150\n\n\nScrews M4\t60\n");
  assert.equal(rows.length, 2);
});

test("empty paste produces no rows", () => {
  assert.deepEqual(parseDispatchPaste(""), []);
  assert.deepEqual(parseDispatchPaste("   \n  "), []);
});
