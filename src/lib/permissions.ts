import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

/* -------------------------------------------------------------------------
 * Who can do what — the single source of truth.
 *
 * Roles WERE workspaces rather than permission levels: FINANCE brought stock
 * in and could not issue it, EMPLOYEE moved it to and from sites and could not
 * record a delivery, and each account saw one focused app. That stopped being
 * true on 2026-09-05, when the client retired the employee account and finance
 * took over its work outright. FINANCE is now the combined operational role.
 *
 * What still separates ADMIN is not volume of features but KIND: the two
 * operations that rewrite history (stock:reverse, stock:adjust), the two that
 * change structure (site:manage, shelf:manage/shelf:delete), plus accounts and
 * backups. Phase 11 Part 2 will let finance *request* the first four; accounts
 * and backups stay hard admin-only and are not requestable — an approval flow
 * that can mint an admin is not an approval flow, and an approved database
 * restore would erase the request that authorised it.
 *
 * EMPLOYEE is RETIRED, not removed. Removing the enum member needs a migration
 * with a hand-written backfill (precedent: 20260820150000_roles_finance_employee,
 * which renamed STAFF → EMPLOYEE exactly that way), and it would break any
 * existing employee login and every Record<Role, …> map in the app. So it stays,
 * keeps working for anyone still on it, and is simply no longer granted — move
 * those accounts to FINANCE one at a time from /users.
 *
 * A consequence worth naming rather than discovering: one FINANCE account can
 * now receive goods AND dispatch them with nobody else in the loop. The old
 * split was a real control, and it was traded away deliberately, not tidied.
 *
 * Adding a role is one edit here, not a hunt through the codebase.
 * ---------------------------------------------------------------------- */

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
  // read-only visibility of stock, history and reports
  | "ledger:view";

const ALL: Capability[] = [
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
  "ledger:view",
];

const CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: ALL,
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

export function can(role: Role | undefined, capability: Capability): boolean {
  return role ? CAPABILITIES[role].includes(capability) : false;
}

/** Where each role lands after signing in, and where it is sent when it hits a
 * page it has no business on. */
export const HOME_FOR_ROLE: Record<Role, string> = {
  ADMIN: "/dashboard",
  FINANCE: "/dashboard",
  EMPLOYEE: "/dashboard",
};

export class NotPermittedError extends Error {
  constructor(readonly capability: Capability) {
    super("You do not have permission to do that");
    this.name = "NotPermittedError";
  }
}

export type SessionUser = { id: string; role: Role; name?: string | null };

/** Reads the signed-in user, or null.
 *
 * Deliberately re-reads the row rather than trusting the JWT. Sessions are
 * stateless, so a token keeps asserting whatever was true when it was issued —
 * meaning a deactivated account would keep working until its token expired, and
 * a demoted one would keep its old powers. Both are silent: nothing looks
 * wrong. One indexed lookup per call buys deactivation and role changes that
 * take effect on the very next request, which is the only behaviour an admin
 * would expect from a button labelled "deactivate".
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const claimed = session?.user as { id?: string } | undefined;
  if (!claimed?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: claimed.id },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return { id: user.id, role: user.role, name: user.name };
}

/** Throws unless the signed-in user holds `capability`.
 *
 * THIS is the layer that actually matters. proxy.ts guards pages, but server
 * actions are directly invocable — anyone can replay the POST — so every action
 * must check for itself rather than trusting that the UI hid the button. */
export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  if (!can(user.role, capability)) throw new NotPermittedError(capability);
  return user;
}
