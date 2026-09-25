import { test } from "node:test";
import assert from "node:assert/strict";
import { lineFromDeliveryLine, lineFromTransaction, sumQuantities } from "./challanLines.ts";

test("a typed line prints exactly what was typed, with blanks for what was not", () => {
  const line = lineFromDeliveryLine({
    id: "l1",
    deliveryId: "d1",
    name: "Shade Net 4m",
    description: null,
    quantity: 2.5,
    unit: "roll",
    remark: null,
    position: 0,
  });
  assert.deepEqual(line, {
    id: "l1",
    name: "Shade Net 4m",
    description: "",
    quantity: 2.5,
    unit: "roll",
    note: null,
  });
});

test("a stock-backed line keeps its spelled-out pack breakdown", () => {
  const line = lineFromTransaction({
    id: "t1",
    quantity: 860,
    packSize: 400,
    packCount: 2,
    pieces: null,
    note: "north bay",
    item: {
      name: "DC Cable",
      baseUnit: "m",
      packUnit: "roll",
    } as never,
  });
  assert.equal(line.name, "DC Cable");
  assert.equal(line.unit, "m");
  assert.equal(line.quantity, 860);
  assert.equal(line.note, "north bay");
  assert.match(line.description, /2 × 400 m rolls/);
});

test("summing decimals does not print float noise", () => {
  assert.equal(sumQuantities([0.1, 0.2]), 0.3);
  assert.equal(sumQuantities([2.5, 1]), 3.5);
  assert.equal(sumQuantities([]), 0);
});
