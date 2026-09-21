import test from "node:test";
import assert from "node:assert/strict";
import { orientPack, parseDeliveryPaste } from "./deliveryPaste.ts";

test("a plain quantity is read as loose", () => {
  const rows = parseDeliveryPaste("Wire 2.5mm\t150\nScrews M4\t60");
  assert.deepEqual(
    rows.map((r) => [r.name, r.loose, r.packSize, r.packCount]),
    [
      ["Wire 2.5mm", 150, null, null],
      ["Screws M4", 60, null, null],
    ]
  );
});

test("a 'count x size' cell is read as sealed packs, not loose", () => {
  const rows = parseDeliveryPaste("Wire 2.5mm\t2 x 400");
  assert.equal(rows[0].packCount, 2);
  assert.equal(rows[0].packSize, 400);
  assert.equal(rows[0].loose, null);
});

test("× and * are accepted, and units after the size are stripped", () => {
  assert.equal(parseDeliveryPaste("Wire\t3×90m")[0].packSize, 90);
  assert.equal(parseDeliveryPaste("Wire\t3 * 90 m")[0].packCount, 3);
});

test("a trailing total beside a pack cell is not added as loose", () => {
  const rows = parseDeliveryPaste("Wire 2.5mm\t2 x 400\t800");
  assert.equal(rows[0].packCount, 2);
  assert.equal(rows[0].packSize, 400);
  assert.equal(rows[0].loose, null);
});

test("a dimension in the name cell is not mistaken for a pack", () => {
  const rows = parseDeliveryPaste("Lug 2.5mm x 4mm\t50");
  assert.equal(rows[0].packSize, null);
  assert.equal(rows[0].loose, 50);
});

test("units in the quantity cell are stripped to a number", () => {
  const rows = parseDeliveryPaste("Wire 2.5mm\t150 m");
  assert.equal(rows[0].loose, 150);
  assert.equal(rows[0].quantityText, "150 m");
});

test("extra columns are tolerated — loose is the last numeric cell", () => {
  const rows = parseDeliveryPaste("Wire 2.5mm\tWIRE-2.5\tCable\t150");
  assert.equal(rows[0].name, "Wire 2.5mm");
  assert.equal(rows[0].loose, 150);
});

test("a header row is skipped", () => {
  const rows = parseDeliveryPaste("Item\tPacks\tQty\nWire 2.5mm\t150");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Wire 2.5mm");
});

test("a header row is kept when it is the only line", () => {
  assert.equal(parseDeliveryPaste("Wire 2.5mm").length, 1);
});

test("blank lines are dropped and empty paste produces no rows", () => {
  assert.equal(parseDeliveryPaste("Wire\t150\n\n\nScrews\t60\n").length, 2);
  assert.deepEqual(parseDeliveryPaste("   \n  "), []);
});

test("orientPack swaps a reversed pair using the item's known sizes", () => {
  assert.deepEqual(orientPack({ packCount: 400, packSize: 2 }, [400]), {
    packCount: 2,
    packSize: 400,
  });
});

test("orientPack leaves a pair alone when the size is already known", () => {
  assert.deepEqual(orientPack({ packCount: 2, packSize: 400 }, [400, 2]), {
    packCount: 2,
    packSize: 400,
  });
});

test("orientPack leaves a pair alone when nothing is known", () => {
  assert.deepEqual(orientPack({ packCount: 2, packSize: 400 }, []), {
    packCount: 2,
    packSize: 400,
  });
});
