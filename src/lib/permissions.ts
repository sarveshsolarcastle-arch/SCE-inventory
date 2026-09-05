import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";
import { can, type Capability } from "@/lib/capabilities";

/* -------------------------------------------------------------------------
 * The auth-aware half of permissions: reading who is signed in, and refusing
 * them. The tables themselves — and the pure `can` / `canRequest` /
 * `capabilityMode` over them — live in capabilities.ts, which imports nothing
 * and is therefore covered by tests. This file re-exports all of it, so
 * "adding a role is one edit" stays true and callers need not know or care
 * which half a symbol comes from.
 *
 * Roles WERE workspaces rather than permission levels: FINANCE brought stock
 * in and could not issue it, EMPLOYEE moved it to and from sites and could not
 * record a delivery, and each account saw one focused app. That stopped being
 * true on 2026-09-05, when the client retired the employee account and finance
 * took over its work outright. FINANCE is now the combined operational role.
 *
 * What still separates ADMIN is not volume of features but KIND: the two
 * operations that rewrite history (stock:reverse, stock:adjust), the three
 * that change structure (site:manage, shelf:manage, shelf:delete), plus
 * accounts and backups. Finance may REQUEST the first five; accounts and
 * backups are requestable by nobody — see REQUESTABLE in capabilities.ts for
 * why that is a fact about `restoreDatabase` rather than a policy preference.
 *
 * A consequence worth naming rather than discovering: one FINANCE account can
 * now receive goods AND dispatch them with nobody else in the loop. The old
 * split was a real control, and it was traded away deliberately, not tidied.
 * ---------------------------------------------------------------------- */

export {
  ALL_CAPABILITIES,
  CAPABILITIES,
  REQUESTABLE,
  can,
  canRequest,
  capabilityMode,
  HOME_FOR_ROLE,
  type Capability,
  type CapabilityMode,
} from "@/lib/capabilities";

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

/** Throws unless the signed-in user HOLDS `capability` — being able to request
 * it is not enough, and must never become enough.
 *
 * THIS is the layer that actually matters. proxy.ts guards pages, but server
 * actions are directly invocable — anyone can replay the POST — so every action
 * must check for itself rather than trusting that the UI hid the button.
 *
 * Unchanged by the approvals work on purpose: `runOrRequest` decides whether an
 * attempt becomes a request, and the operation it eventually runs is executed
 * by an ADMIN who does hold the capability. This guard stays absolute. */
export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  if (!can(user.role, capability)) throw new NotPermittedError(capability);
  return user;
}
