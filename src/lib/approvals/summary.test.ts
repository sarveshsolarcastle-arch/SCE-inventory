import test from "node:test";
import assert from "node:assert/strict";
import { describeKind } from "./summary.ts";
import { formatPrecheck } from "./precheck.ts";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  isPending,
  type ApprovalStatusValue,
} from "./status.ts";

const STATUSES: ApprovalStatusValue[] = [
  "PENDING",
  "APPROVED",
  "FAILED",
  "REJECTED",
  "CANCELLED",
];

test("a summary names the thing, not its id, when a name is known", () => {
  assert.equal(
    describeKind("site.delete", { siteId: "ckx1" }, { site: "North Yard" }),
    'Delete North Yard'
  );
});

test("a missing name degrades to the id rather than throwing", () => {
  // The queue page renders every row; one unresolvable name must not take the
  // whole page down.
  assert.match(describeKind("site.delete", { siteId: "ckx1" }), /ckx1/);
  assert.match(describeKind("site.delete", {}, { site: "   " }), /site \?/);
});

test("an unknown kind still renders as history", () => {
  // A row whose kind was removed from the registry has to keep displaying.
  assert.equal(describeKind("site.obliterate", {}), 'Carry out "site.obliterate"');
});

test("emptying a box and filling it read differently", () => {
  const args = { shelfId: "s1", slotId: "x", itemId: null };
  assert.match(describeKind("shelf.slot.item", args, { shelf: "Shelf A" }), /^Empty/);
  assert.match(
    describeKind("shelf.slot.item", { ...args, itemId: "i1" }, { item: "Wire 2.5mm²" }),
    /Put Wire 2\.5mm²/
  );
});

test("deleting a shelf says what is actually lost", () => {
  // Not stock — placement. The wording exists so nobody reads it as stock loss.
  assert.match(
    describeKind("shelf.delete", { shelfId: "s1" }, { shelf: "Shelf A" }),
    /where its boxes sit/
  );
});

test("the two reversals are distinguishable at a glance", () => {
  assert.match(
    describeKind("stock.reverseDispatch", { dispatchId: "d1" }, { dispatch: "CH-1042" }),
    /every line of CH-1042/
  );
  assert.match(
    describeKind("stock.reverseTransaction", { transactionId: "t1" }),
    /Reverse a stock movement/
  );
});

test("a blocked precheck quotes the operation's own refusal", () => {
  const { tone, message } = formatPrecheck({
    kind: "blocked",
    reason: '"North Yard" still has 1 dispatch attached',
  });
  assert.equal(tone, "danger");
  // "will now fail" rather than "cannot be approved": approving is still
  // permitted and produces a FAILED row, which is an honest outcome.
  assert.match(message, /will now fail/);
  assert.match(message, /1 dispatch attached/);
});

test("the four precheck outcomes are visually distinct", () => {
  assert.equal(formatPrecheck({ kind: "clear" }).tone, "ok");
  assert.equal(formatPrecheck({ kind: "blocked", reason: "x" }).tone, "danger");
  assert.equal(formatPrecheck({ kind: "destructive", consequence: "x" }).tone, "warn");
  assert.equal(formatPrecheck({ kind: "missing", what: "That site" }).tone, "neutral");
});

test("a destructive precheck passes its consequence through verbatim", () => {
  // It is composed by the operation, which knows the counts.
  const message = "5 boxes have an item assigned. No stock is lost.";
  assert.equal(formatPrecheck({ kind: "destructive", consequence: message }).message, message);
});

test("every status has a tone and a label", () => {
  for (const status of STATUSES) {
    assert.ok(APPROVAL_STATUS_TONE[status], `${status} has no tone`);
    assert.ok(APPROVAL_STATUS_LABEL[status], `${status} has no label`);
  }
});

test("FAILED does not read as half-done", () => {
  // The status write and the work share one transaction, so a rollback takes
  // both: FAILED always means nothing happened.
  assert.match(APPROVAL_STATUS_LABEL.FAILED, /could not be carried out/);
  assert.equal(APPROVAL_STATUS_TONE.FAILED, "danger");
});

test("only PENDING is still in the queue", () => {
  assert.equal(isPending("PENDING"), true);
  for (const status of STATUSES.filter((s) => s !== "PENDING")) {
    assert.equal(isPending(status), false, status);
  }
});
