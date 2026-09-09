import test from "node:test";
import assert from "node:assert/strict";
import { parsePage, pageArgs, pageCount, describeRange, clampPage, PER_PAGE } from "./pagination.ts";

test("parsePage defaults to 1", () => {
  assert.equal(parsePage(undefined), 1);
});

test("parsePage rejects garbage", () => {
  for (const raw of ["abc", "-5", "0", "1e9", "", "NaN", "1.5"]) {
    assert.equal(parsePage(raw), raw === "1e9" ? 1e9 : 1, `parsePage(${JSON.stringify(raw)})`);
  }
});

test("parsePage accepts a real page", () => {
  assert.equal(parsePage("3"), 3);
});

test("pageArgs computes skip/take", () => {
  assert.deepEqual(pageArgs(1), { skip: 0, take: PER_PAGE });
  assert.deepEqual(pageArgs(2), { skip: PER_PAGE, take: PER_PAGE });
  assert.deepEqual(pageArgs(3, 10), { skip: 20, take: 10 });
});

test("pageCount divides exactly", () => {
  assert.equal(pageCount(100, 50), 2);
});

test("pageCount on an empty set is 1, not 0", () => {
  assert.equal(pageCount(0, 50), 1);
});

test("pageCount rounds up a partial last page", () => {
  assert.equal(pageCount(101, 50), 3);
});

test("describeRange on an empty set", () => {
  assert.equal(describeRange(0, 1, 50), "0 of 0");
});

test("describeRange on a full first page", () => {
  assert.equal(describeRange(214, 1, 50), "1-50 of 214");
});

test("describeRange on a partial last page", () => {
  assert.equal(describeRange(214, 5, 50), "201-214 of 214");
});

test("describeRange clamps a page beyond the end to the last page", () => {
  assert.equal(describeRange(214, 99999, 50), "201-214 of 214");
});

test("clampPage leaves an in-range page untouched", () => {
  assert.equal(clampPage(2, 214, 50), 2);
});

test("clampPage pulls a page past the end back to the last page", () => {
  assert.equal(clampPage(99999, 214, 50), 5);
});

test("clampPage on an empty set clamps to page 1, not 0", () => {
  assert.equal(clampPage(5, 0, 50), 1);
});
