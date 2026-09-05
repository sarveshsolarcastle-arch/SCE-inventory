/* -------------------------------------------------------------------------
 * Who can do what, and who may ASK to do what — the two tables, and the pure
 * functions over them.
 *
 * Split out of permissions.ts so it can be tested. permissions.ts imports
 * `@/lib/auth` and `@/lib/prisma` at module scope, and the `@/` alias does not
 * resolve under `node --experimental-strip-types`, which is why there has never
 * been a permissions.test.ts. Everything here imports nothing but a type, which
 * strip-types erases entirely — so the invariants at the bottom of this file's
 * test are enforced by `npm test` instead of by remembering them.
 *
 * permissions.ts re-exports all of this, so "adding a role is one edit" stays
 * true and no caller needs to know the split happened.
 *
 * ASKING IS NOT A PERMISSION. REQUESTABLE is a SECOND table, never a softening
 * of `can()`. Every `requireCapability` in the app depends on `can()` meaning
 * "may do it, now, alone" — if requesting quietly counted as holding, the guard
 * on every write action would start passing for people who have only asked.
 * `can()` is unchanged and stays the hard gate; `canRequest()` only decides
 * whether an attempt becomes a request instead of a refusal.
 * ---------------------------------------------------------------------- */

import type { Role } from "@/generated/prisma/enums";

export type Capability =
  // inbound
  | "delivery:record"
  // outbound and site work
  | "stock:issue"
  | "stock:return"
  | "stock:consume"
  | "stock:transfer"
  | "site:pickup"
  // catalogue and layout
  | "item:manage"
  | "site:manage"
  | "shelf:manage"
  // Removing a shelf outright — admin only, and deliberately NOT folded into
  // `shelf:manage`. Relabelling a box and demolishing the shelf it sits on are
  // different-sized actions, and `shelf:manage` is admin-only today only
  // because of how the table below happens to be filled in. Granting it to
  // FINANCE later would silently hand over the delete too. A separate
  // capability makes that impossible to do by accident.
  | "shelf:delete"
  // quality
  | "defect:flag"
  | "defect:resolve"
  // rewriting history — admin only
  | "stock:reverse"
  | "stock:adjust"
  // accounts — admin only. Changing your OWN password is not a capability:
  // every signed-in user may do it, so gating it would be wrong.
  | "user:manage"
  // reading and restoring database backups — admin only. Restoring
  // overwrites every table, so this sits with stock:reverse and
  // stock:adjust as history-rewriting territory.
  | "backup:manage"
  // The approval queue itself, split for the same reason shelf:manage and
  // shelf:delete are: seeing the queue and answering it are different-sized
  // actions. FINANCE needs `view` to follow its own requests; only ADMIN
  // decides. Keeping them separate also means the nav filter needs no change.
  | "approval:view"
  | "approval:decide"
  // read-only visibility of stock, history and reports
  | "ledger:view";

export const ALL_CAPABILITIES: readonly Capability[] = [
  "delivery:record",
  "stock:issue",
  "stock:return",
  "stock:consume",
  "stock:transfer",
  "site:pickup",
  "item:manage",
  "site:manage",
  "shelf:manage",
  "shelf:delete",
  "defect:flag",
  "defect:resolve",
  "stock:reverse",
  "stock:adjust",
  "user:manage",
  "backup:manage",
  "approval:view",
  "approval:decide",
  "ledger:view",
];

export const CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: ALL_CAPABILITIES,
  // The combined operational role: receives goods, owns the catalogue, and
  // since 2026-09-05 moves material as well. Everything except the operations
  // that rewrite history or change structure, plus accounts and backups.
  FINANCE: [
    "delivery:record",
    "item:manage",
    "defect:flag",
    "defect:resolve",
    "ledger:view",
    // The EMPLOYEE workspace, folded in wholesale. Kept as its own block rather
    // than merged into the list above so the takeover stays legible: these five
    // are here because the employee account was retired, not because finance
    // was ever meant to move material.
    "stock:issue",
    "stock:return",
    "stock:consume",
    "stock:transfer",
    "site:pickup",
    // Sees the queue, to follow the requests it raised. Cannot answer them.
    "approval:view",
  ],
  // RETIRED 2026-09-05 — kept so existing logins keep working and every
  // Record<Role, …> stays total, but no longer granted to new accounts. Its
  // five capabilities now live in FINANCE above. Do not add to this list;
  // move the account to FINANCE instead.
  EMPLOYEE: [
    "stock:issue",
    "stock:return",
    "stock:consume",
    "stock:transfer",
    "site:pickup",
    "defect:flag",
    "ledger:view",
  ],
};

/** What a role may ASK an admin to do on its behalf. Disjoint from
 * CAPABILITIES by construction — asking for something you already hold is
 * meaningless, and the test enforces it.
 *
 * TWO CAPABILITIES ARE DELIBERATELY ABSENT AND MUST STAY ABSENT:
 *
 *   user:manage    — an approval flow that can mint an admin is not an
 *                    approval flow. Account management stays hard admin-only,
 *                    at the client's explicit instruction.
 *   backup:manage  — `restoreDatabase` drops and recreates every table. An
 *                    approved restore would erase the ApprovalRequest row that
 *                    authorised it AND the record of which admin approved it.
 *                    The feature would delete its own audit trail. This is not
 *                    a policy preference, it is a fact about what restore does.
 */
export const REQUESTABLE: Record<Role, readonly Capability[]> = {
  // An admin never requests; it would be asking itself.
  ADMIN: [],
  FINANCE: ["site:manage", "shelf:manage", "shelf:delete", "stock:reverse", "stock:adjust"],
  // The role is being retired. Giving it a new power on the way out makes no
  // sense.
  EMPLOYEE: [],
};

export function can(role: Role | undefined, capability: Capability): boolean {
  return role ? CAPABILITIES[role].includes(capability) : false;
}

/** Whether this role may raise a request for something it does not hold.
 * Never true for something it DOES hold — that would be a request to do what
 * you can already do, which the queue should never contain. */
export function canRequest(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  return !can(role, capability) && REQUESTABLE[role].includes(capability);
}

/** What this role's button should say. The one function pages call, so
 * `can() || canRequest()` never gets spelled out — and mis-spelled — per page. */
export type CapabilityMode = "do" | "request" | "none";

export function capabilityMode(
  role: Role | undefined,
  capability: Capability
): CapabilityMode {
  if (can(role, capability)) return "do";
  if (canRequest(role, capability)) return "request";
  return "none";
}

/** Where each role lands after signing in, and where it is sent when it hits a
 * page it has no business on. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  ADMIN: "/dashboard",
  FINANCE: "/dashboard",
  EMPLOYEE: "/dashboard",
};
