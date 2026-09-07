import test from "node:test";
import assert from "node:assert/strict";
import {
  ASK,
  controlLabel,
  noticeFor,
  pendingLabel,
  requestHint,
  type ControlMode,
} from "./labels.ts";
import { capabilityMode, type CapabilityMode } from "../capabilities.ts";

test("a control says what the role can actually do with it", () => {
  assert.equal(controlLabel("do", "Delete site", "delete this site"), "Delete site");
  assert.equal(
    controlLabel("request", "Delete site", "delete this site"),
    "Ask an admin to delete this site"
  );
});

test("`none` is worded as `do`, because nothing renders it", () => {
  // A call site in `none` mode renders no control at all, so the label is
  // never read. It falls to the `do` wording rather than throwing: a stray
  // render should show a plain verb, not crash a page.
  assert.equal(controlLabel("none", "Delete site", "delete this site"), "Delete site");
});

test("the phrase is spelled one way", () => {
  assert.ok(controlLabel("request", "x", "y").startsWith(ASK));
  assert.equal(ASK, "Ask an admin to");
});

test("nothing is being deleted while a request is in flight", () => {
  // "Deleting…" under a button that raises a request would claim the deletion
  // had started. It has not, and it may never.
  assert.equal(pendingLabel("do", "Deleting…"), "Deleting…");
  assert.equal(pendingLabel("request", "Deleting…"), "Sending…");
});

test("the hint appears only where it is true", () => {
  assert.equal(requestHint("do"), null);
  assert.equal(requestHint("none"), null);
  const hint = requestHint("request");
  assert.ok(hint);
  assert.match(hint, /approve/i);
});

/* ---- the one that guards a real defect ------------------------------- */

test("a raised request is not shown in the red used for failures", () => {
  const raised = noticeFor({
    ok: false,
    requested: true,
    message: 'Sent to the admins for approval: "Delete Borivali Site".',
  });

  // `ok: false` is honest — the delete did not happen — but it is not a
  // failure, and DeleteSiteButton renders `danger` for everything it is given.
  assert.equal(raised.tone, "info");
});

test("a genuine refusal stays red", () => {
  const refused = noticeFor({
    ok: false,
    message: "Borivali Site still has 15 stock movements attached",
  });

  assert.equal(refused.tone, "danger");
});

test("danger is the default for anything unrecognised", () => {
  // If a new result arm appears without a `requested` flag, it must land on
  // the loud side. Silently reassuring someone about a failure is the worse
  // of the two mistakes.
  const unknown = noticeFor({ ok: false, message: "something else" } as {
    ok: false;
    message: string;
  });
  assert.equal(unknown.tone, "danger");
});

test("the message is passed through untouched", () => {
  // The operations' own sentences are the whole information content here —
  // "expected 90 left, found 85". Rewording or truncating one would destroy
  // the only explanation the user gets.
  const message = "expected 90 left, found 85";
  assert.equal(noticeFor({ ok: false, message }).message, message);
});

/* ---- the copied type cannot drift ------------------------------------ */

test("ControlMode and CapabilityMode are the same three modes", () => {
  // labels.ts re-declares ControlMode so it can stay import-free. This is the
  // check that the copy still matches: both assignments have to compile, and
  // the round trip has to preserve every value.
  const fromCapability: ControlMode[] = (
    ["do", "request", "none"] satisfies CapabilityMode[]
  ) as ControlMode[];
  const toCapability: CapabilityMode[] = fromCapability;

  assert.deepEqual(toCapability, ["do", "request", "none"]);
  // And the producer really does only ever return those three.
  assert.equal(capabilityMode("ADMIN", "site:manage"), "do");
  assert.equal(capabilityMode("FINANCE", "site:manage"), "request");
  assert.equal(capabilityMode("FINANCE", "user:manage"), "none");
  assert.equal(capabilityMode(undefined, "site:manage"), "none");
});

test("the prefix is never composed twice", () => {
  // Live verification produced this twice: a control nested inside a paragraph
  // that already said "Ask an admin to …" was given an `asking` phrase that
  // read as a request in its own right, and the button came out saying "Ask an
  // admin to send the request". The rule is that `asking` is a bare verb
  // phrase — the object of the ask, never another ask.
  const doubled = controlLabel("request", "Confirm", "send the request to an admin");
  assert.equal(
    doubled.split("admin").length - 1,
    2,
    "this is the shape that reads wrong — the call site, not this function, is what must avoid it"
  );

  // What a correct call site produces: exactly one mention.
  for (const asking of [
    "delete this site",
    "delete this shelf",
    "add a site",
    "add a shelf",
    "create this site",
    "create this shelf",
    "change this site",
    "save these changes",
    "correct this item's stock",
    "reverse this",
    "change the item",
    "change the box type",
    "mark this front-row",
    "unmark front-row",
  ]) {
    const label = controlLabel("request", "x", asking);
    assert.equal(label.split(ASK).length - 1, 1, `"${label}" says it twice`);
    assert.ok(!/\brequest\b/i.test(asking), `"${asking}" re-states the ask`);
  }
});
