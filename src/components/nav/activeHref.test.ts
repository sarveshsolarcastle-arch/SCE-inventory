import test from "node:test";
import assert from "node:assert/strict";
import { activeHref } from "./activeHref.ts";

const HREFS = ["/dashboard", "/dispatches", "/dispatches/new", "/items"];

test("exact match wins when nothing longer also matches", () => {
  assert.equal(activeHref("/dashboard", HREFS), "/dashboard");
});

test("longest matching prefix wins over a shorter one", () => {
  assert.equal(activeHref("/dispatches/new", HREFS), "/dispatches/new");
});

test("a detail route under a list link matches the list link", () => {
  assert.equal(activeHref("/dispatches/abc123", HREFS), "/dispatches");
});

test("no match returns null", () => {
  assert.equal(activeHref("/login", HREFS), null);
});

test("a path that merely starts with the same characters does not match", () => {
  // /items should not light up for /itemsfoo
  assert.equal(activeHref("/itemsfoo", HREFS), null);
});

/* Query-aware matching — "Returns Ledger" is the Ledger page pre-filtered, so
 * the two share a path and can only be told apart by the query string. */
const LEDGER_HREFS = ["/ledger", "/ledger?type=RETURN", "/transactions/new"];

test("a filtered link wins over the same page unfiltered", () => {
  assert.equal(activeHref("/ledger?type=RETURN", LEDGER_HREFS), "/ledger?type=RETURN");
});

test("the unfiltered link wins when no filter is applied", () => {
  assert.equal(activeHref("/ledger", LEDGER_HREFS), "/ledger");
});

test("a different filter falls back to the unfiltered link", () => {
  assert.equal(activeHref("/ledger?type=TRANSFER", LEDGER_HREFS), "/ledger");
});

test("extra params in the current URL do not break a filtered match", () => {
  assert.equal(
    activeHref("/ledger?type=RETURN&page=2&q=wire", LEDGER_HREFS),
    "/ledger?type=RETURN"
  );
});

test("param order does not matter", () => {
  assert.equal(activeHref("/ledger?page=2&type=RETURN", LEDGER_HREFS), "/ledger?type=RETURN");
});

test("a longer path still wins when neither link carries a query", () => {
  assert.equal(activeHref("/dispatches/new", HREFS), "/dispatches/new");
});
