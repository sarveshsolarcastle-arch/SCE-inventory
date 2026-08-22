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
