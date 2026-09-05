import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_CAPABILITIES,
  CAPABILITIES,
  REQUESTABLE,
  can,
  canRequest,
  capabilityMode,
  HOME_FOR_ROLE,
  type Capability,
} from "./capabilities.ts";

const ROLES = ["ADMIN", "FINANCE", "EMPLOYEE"] as const;

/* The point of this file is not the three trivial functions — it is the
 * invariants holding the two tables together. Each one below is something the
 * design depends on and that nothing else would catch: a wrong entry produces
 * no type error, no runtime error, and no visible symptom until someone either
 * cannot do their job or can do someone else's. */

test("every role's capabilities are real capabilities", () => {
  for (const role of ROLES) {
    for (const capability of CAPABILITIES[role]) {
      assert.ok(
        ALL_CAPABILITIES.includes(capability),
        `${role} holds unknown capability ${capability}`
      );
    }
  }
});

test("admin holds everything", () => {
  for (const capability of ALL_CAPABILITIES) {
    assert.ok(can("ADMIN", capability), `ADMIN should hold ${capability}`);
  }
});

test("THE INVARIANT: the two tables are disjoint for every role", () => {
  // Requesting something you already hold is a request the queue should never
  // contain — it would sit there pending while the requester could simply do it.
  for (const role of ROLES) {
    for (const capability of REQUESTABLE[role]) {
      assert.ok(
        !CAPABILITIES[role].includes(capability),
        `${role} can both do and request ${capability}`
      );
    }
  }
});

test("THE INVARIANT: user:manage and backup:manage are requestable by nobody", () => {
  // An approval flow that can mint an admin is not an approval flow; and an
  // approved restore would drop the table holding the request that authorised
  // it. Neither is a preference to be revisited casually.
  for (const role of ROLES) {
    assert.ok(!REQUESTABLE[role].includes("user:manage"), `${role} may request user:manage`);
    assert.ok(
      !REQUESTABLE[role].includes("backup:manage"),
      `${role} may request backup:manage`
    );
  }
});

test("THE INVARIANT: a role that can request anything can see the queue", () => {
  // Otherwise finance raises requests it has no way to follow, and every
  // outcome — approved, rejected, failed — is invisible to the person who asked.
  for (const role of ROLES) {
    if (REQUESTABLE[role].length > 0) {
      assert.ok(
        can(role, "approval:view"),
        `${role} may request things but cannot see the queue`
      );
    }
  }
});

test("THE INVARIANT: deciding implies seeing", () => {
  for (const role of ROLES) {
    if (can(role, "approval:decide")) {
      assert.ok(can(role, "approval:view"), `${role} can decide but not view`);
    }
  }
});

test("THE INVARIANT: every requestable capability is held by someone who can decide", () => {
  // A request nobody is able to carry out would sit pending forever.
  for (const role of ROLES) {
    for (const capability of REQUESTABLE[role]) {
      const deciders = ROLES.filter(
        (r) => can(r, "approval:decide") && can(r, capability)
      );
      assert.ok(
        deciders.length > 0,
        `${role} may request ${capability} but no decider holds it`
      );
    }
  }
});

test("an admin never requests — it would be asking itself", () => {
  for (const capability of ALL_CAPABILITIES) {
    assert.equal(canRequest("ADMIN", capability), false);
  }
});

test("the retired employee role gains nothing on its way out", () => {
  assert.deepEqual(REQUESTABLE.EMPLOYEE, []);
});

test("finance may request exactly the five structural and history-rewriting powers", () => {
  assert.deepEqual([...REQUESTABLE.FINANCE].sort(), [
    "shelf:delete",
    "shelf:manage",
    "site:manage",
    "stock:adjust",
    "stock:reverse",
  ]);
});

test("finance does the day-to-day stock work outright, not by asking", () => {
  const outright: Capability[] = [
    "delivery:record",
    "stock:issue",
    "stock:return",
    "stock:consume",
    "stock:transfer",
    "site:pickup",
    "item:manage",
  ];
  for (const capability of outright) {
    assert.equal(capabilityMode("FINANCE", capability), "do", capability);
  }
});

test("capabilityMode collapses the three cases the pages care about", () => {
  assert.equal(capabilityMode("ADMIN", "site:manage"), "do");
  assert.equal(capabilityMode("FINANCE", "site:manage"), "request");
  assert.equal(capabilityMode("EMPLOYEE", "site:manage"), "none");
  assert.equal(capabilityMode("FINANCE", "user:manage"), "none");
  assert.equal(capabilityMode(undefined, "ledger:view"), "none");
});

test("no role at all can do or request anything", () => {
  assert.equal(can(undefined, "ledger:view"), false);
  assert.equal(canRequest(undefined, "site:manage"), false);
});

test("every role has somewhere to land", () => {
  for (const role of ROLES) {
    assert.ok(HOME_FOR_ROLE[role]?.startsWith("/"), `${role} has no home`);
  }
});
