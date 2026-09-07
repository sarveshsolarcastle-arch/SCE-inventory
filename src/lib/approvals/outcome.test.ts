import test from "node:test";
import assert from "node:assert/strict";
import { describeRequested } from "./outcome.ts";

test("a queued request is not reported as success", () => {
  const result = describeRequested({
    kind: "requested",
    requestId: "req_1",
    summary: "Delete Borivali Site",
  });

  // The whole point of the third arm. Every component in the app branches on
  // `ok`, and DeleteSiteButton navigates to /sites when it is true — which
  // would announce a deletion that has not happened.
  assert.equal(result.ok, false);
  assert.equal(result.requested, true);
  assert.equal(result.requestId, "req_1");
});

test("the message names what was asked for, and reads as a sentence", () => {
  const { message } = describeRequested({
    kind: "requested",
    requestId: "req_1",
    summary: "Delete Borivali Site",
  });

  assert.match(message, /approval/i);
  assert.match(message, /Delete Borivali Site/);
  assert.ok(message.endsWith("."));
});

test("a duplicate says so, and points at the request already waiting", () => {
  const result = describeRequested({
    kind: "duplicate",
    requestId: "req_first",
    summary: "Delete Shelf A, and everything recorded about where its boxes sit",
  });

  assert.equal(result.requestId, "req_first");
  assert.match(result.message, /already/i);
  // Naming it matters: "already requested" on its own reads as a bug to
  // someone with several requests in flight.
  assert.match(result.message, /Delete Shelf A/);
});

test("the two arms do not produce the same sentence", () => {
  const args = { requestId: "req_1", summary: "Delete Borivali Site" };
  assert.notEqual(
    describeRequested({ ...args, kind: "requested" }).message,
    describeRequested({ ...args, kind: "duplicate" }).message
  );
});
