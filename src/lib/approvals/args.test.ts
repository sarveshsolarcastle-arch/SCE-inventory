import test from "node:test";
import assert from "node:assert/strict";
import {
  InvalidArgsError,
  parseReverseTransactionArgs,
  parseShelfCreateArgs,
  parseSiteCreateArgs,
  parseSiteDeleteArgs,
  parseSlotBoxTypeArgs,
  parseSlotItemArgs,
  parseStockAdjustArgs,
} from "./args.ts";
import { CAPABILITY_FOR_KIND, OPERATION_KINDS, isOperationKind } from "./kinds.ts";

/* These parsers run twice: once from a form, and again hours later against
 * JSON that round-tripped through the database and was ultimately supplied by
 * the requester. The second pass is what these tests are really about. */

test("every operation kind has a capability, and no orphans either way", () => {
  for (const kind of OPERATION_KINDS) {
    assert.ok(CAPABILITY_FOR_KIND[kind], `${kind} has no capability`);
  }
  assert.equal(Object.keys(CAPABILITY_FOR_KIND).length, OPERATION_KINDS.length);
});

test("shelf.delete needs shelf:delete, not shelf:manage", () => {
  // The split exists so granting the relabel never silently grants the demolish.
  assert.equal(CAPABILITY_FOR_KIND["shelf.delete"], "shelf:delete");
  assert.equal(CAPABILITY_FOR_KIND["shelf.slot.boxType"], "shelf:manage");
});

test("an unknown kind is not a kind", () => {
  assert.equal(isOperationKind("site.delete"), true);
  assert.equal(isOperationKind("site.destroy"), false);
  assert.equal(isOperationKind(null), false);
  assert.equal(isOperationKind(42), false);
});

test("a site needs a name; location and notes are optional", () => {
  assert.deepEqual(parseSiteCreateArgs({ name: "North Yard" }), {
    name: "North Yard",
    location: null,
    notes: null,
  });
  assert.throws(() => parseSiteCreateArgs({ name: "   " }), InvalidArgsError);
  assert.throws(() => parseSiteCreateArgs({}), InvalidArgsError);
});

test("a cleared field and a round-tripped null mean the same thing", () => {
  // "" comes from a form the user emptied; null comes back from JSON. If these
  // diverged, editing a site to clear its notes would behave differently
  // depending on whether an admin approved it or finance did it directly.
  const fromForm = parseSiteCreateArgs({ name: "A", location: "", notes: "" });
  const fromJson = parseSiteCreateArgs({ name: "A", location: null, notes: null });
  assert.deepEqual(fromForm, fromJson);
});

test("values are trimmed, so approval and direct execution agree", () => {
  assert.deepEqual(parseSiteDeleteArgs({ siteId: "  site-1  " }), { siteId: "site-1" });
});

test("garbage is refused rather than coerced", () => {
  assert.throws(() => parseSiteDeleteArgs(null), InvalidArgsError);
  assert.throws(() => parseSiteDeleteArgs([]), InvalidArgsError);
  assert.throws(() => parseSiteDeleteArgs("site-1"), InvalidArgsError);
  assert.throws(() => parseSiteDeleteArgs({ siteId: 7 }), InvalidArgsError);
});

test("shelf dimensions are bounded at the door, not left to fail on an admin", () => {
  const ok = parseShelfCreateArgs({ name: "B", rows: 4, columns: 5 });
  assert.deepEqual(ok, { name: "B", rows: 4, columns: 5, boxTypes: {} });

  assert.throws(() => parseShelfCreateArgs({ name: "B", rows: 0, columns: 5 }), InvalidArgsError);
  assert.throws(() => parseShelfCreateArgs({ name: "B", rows: 21, columns: 5 }), InvalidArgsError);
  assert.throws(() => parseShelfCreateArgs({ name: "B", rows: 2.5, columns: 5 }), InvalidArgsError);
  assert.throws(() => parseShelfCreateArgs({ name: "B", rows: "4", columns: 5 }), InvalidArgsError);
});

test("box types are checked against the real set", () => {
  assert.equal(
    parseSlotBoxTypeArgs({ shelfId: "s", slotId: "x", boxType: "OPENED" }).boxType,
    "OPENED"
  );
  assert.throws(
    () => parseSlotBoxTypeArgs({ shelfId: "s", slotId: "x", boxType: "MOULDY" }),
    InvalidArgsError
  );
  assert.throws(
    () => parseShelfCreateArgs({ name: "B", rows: 1, columns: 1, boxTypes: { "FRONT-1-1": "NOPE" } }),
    InvalidArgsError
  );
});

test("emptying a box is a real request, not a missing argument", () => {
  assert.equal(parseSlotItemArgs({ shelfId: "s", slotId: "x", itemId: null }).itemId, null);
  assert.equal(parseSlotItemArgs({ shelfId: "s", slotId: "x", itemId: "" }).itemId, null);
  assert.equal(parseSlotItemArgs({ shelfId: "s", slotId: "x", itemId: "i1" }).itemId, "i1");
});

test("a reversal must carry its reason", () => {
  assert.throws(
    () => parseReverseTransactionArgs({ transactionId: "t1" }),
    InvalidArgsError
  );
  assert.throws(
    () => parseReverseTransactionArgs({ transactionId: "t1", reason: "  " }),
    InvalidArgsError
  );
});

test("THE ONE THAT MATTERS: a stock count cannot lose its ledger figures", () => {
  // Without `ledger` the delta cannot be computed and the operation would be
  // back to an absolute write — the exact bug Part 3 removed. It must be
  // required on every line rather than defaulted.
  assert.throws(
    () =>
      parseStockAdjustArgs({
        itemId: "i1",
        sealed: [{ packSize: 400, counted: 3 }],
        reason: "count",
      }),
    InvalidArgsError
  );

  const ok = parseStockAdjustArgs({
    itemId: "i1",
    sealed: [{ packSize: 400, counted: 3, ledger: 2 }],
    open: [{ packId: "p1", counted: 85, ledger: 90 }],
    reason: "annual count",
  });
  assert.equal(ok.sealed[0].ledger, 2);
  assert.equal(ok.open[0].ledger, 90);
});

test("a ledger figure of zero is a figure, not a missing one", () => {
  const parsed = parseStockAdjustArgs({
    itemId: "i1",
    sealed: [{ packSize: 400, counted: 2, ledger: 0 }],
    reason: "found two",
  });
  assert.equal(parsed.sealed[0].ledger, 0);
});

test("counting the same pack twice is refused, not resolved by iteration order", () => {
  assert.throws(
    () =>
      parseStockAdjustArgs({
        itemId: "i1",
        sealed: [
          { packSize: 400, counted: 3, ledger: 2 },
          { packSize: 400, counted: 5, ledger: 2 },
        ],
        reason: "count",
      }),
    /same pack size was counted twice/
  );

  assert.throws(
    () =>
      parseStockAdjustArgs({
        itemId: "i1",
        open: [
          { packId: "p1", counted: 10, ledger: 20 },
          { packId: "p1", counted: 30, ledger: 20 },
        ],
        reason: "count",
      }),
    /same open pack was counted twice/
  );
});

test("a count covering nothing is not a count", () => {
  assert.throws(
    () => parseStockAdjustArgs({ itemId: "i1", sealed: [], open: [], reason: "x" }),
    /at least one pack/
  );
});

test("negative counts are refused", () => {
  assert.throws(
    () =>
      parseStockAdjustArgs({
        itemId: "i1",
        open: [{ packId: "p1", counted: -1, ledger: 20 }],
        reason: "count",
      }),
    InvalidArgsError
  );
});

test("a full round trip through JSON survives, which is the real use", () => {
  const original = {
    itemId: "i1",
    sealed: [{ packSize: 400, counted: 3, ledger: 2 }],
    open: [{ packId: "p1", counted: 85, ledger: 90 }],
    reason: "annual count",
  };
  const roundTripped = JSON.parse(JSON.stringify(parseStockAdjustArgs(original)));
  assert.deepEqual(parseStockAdjustArgs(roundTripped), parseStockAdjustArgs(original));
});
