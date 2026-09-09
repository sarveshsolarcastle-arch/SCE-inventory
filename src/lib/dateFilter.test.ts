import test from "node:test";
import assert from "node:assert/strict";
import { parseDateFilter } from "./dateFilter.ts";

test("absent is null", () => {
  assert.equal(parseDateFilter(undefined, false), null);
  assert.equal(parseDateFilter("", false), null);
});

test("garbage that doesn't even look like a date is null", () => {
  for (const raw of ["abc", "'; DROP TABLE", "2026", "2026-01", "not-a-date"]) {
    assert.equal(parseDateFilter(raw, false), null, `parseDateFilter(${JSON.stringify(raw)})`);
  }
});

test("shape matches but the calendar date does not exist", () => {
  assert.equal(parseDateFilter("2026-13-40", false), null);
  assert.equal(parseDateFilter("2026-02-30", false), null);
});

test("a real date parses to start of day by default", () => {
  const d = parseDateFilter("2026-03-05", false);
  assert.ok(d);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
  assert.equal(d.getSeconds(), 0);
});

test("endOfDay pushes to the last instant of the day", () => {
  const d = parseDateFilter("2026-03-05", true);
  assert.ok(d);
  assert.equal(d.getHours(), 23);
  assert.equal(d.getMinutes(), 59);
  assert.equal(d.getSeconds(), 59);
  assert.equal(d.getMilliseconds(), 999);
});

test("both calls agree on the same calendar day", () => {
  const start = parseDateFilter("2026-03-05", false)!;
  const end = parseDateFilter("2026-03-05", true)!;
  assert.equal(start.getFullYear(), end.getFullYear());
  assert.equal(start.getMonth(), end.getMonth());
  assert.equal(start.getDate(), end.getDate());
  assert.ok(start < end);
});
