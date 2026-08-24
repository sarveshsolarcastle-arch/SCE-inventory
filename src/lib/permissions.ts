import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

/* -------------------------------------------------------------------------
 * Who can do what — the single source of truth.
 *
 * Roles are workspaces, not permission levels: FINANCE brings stock in and
 * cannot issue it; EMPLOYEE moves it to and from sites and cannot record a
 * delivery. Each account therefore sees one focused app rather than one
 * overloaded one.
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
  // quality
  | "defect:flag"
  | "defect:resolve"
  // rewriting history — admin only
  | "stock:reverse"
  | "stock:adjust"
  // accounts — admin only. Changing your OWN password is not a capability:
  // every signed-in user may do it, so gating it would be wrong.
  | "user:manage"
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
  "defect:flag",
  "defect:resolve",
  "stock:reverse",
  "stock:adjust",
  "user:manage",
  "ledger:view",
];

const CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: ALL,
  // Receives goods and owns the catalogue, plus read-only visibility so
  // consumption can be reconciled. Cannot issue stock. Sites stay admin-only.
  FINANCE: ["delivery:record", "item:manage", "defect:flag", "defect:resolve", "ledger:view"],
  // Moves material to and from sites. Cannot record a delivery.
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
