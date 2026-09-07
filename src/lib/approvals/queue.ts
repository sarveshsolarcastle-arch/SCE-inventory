/* -------------------------------------------------------------------------
 * The one query the app shell adds: how many requests are waiting for you.
 *
 * "For you" means two different things, which is why the count is not simply
 * "all PENDING". An admin is being asked to act, so they see everything
 * outstanding. A finance user is following requests they raised, so they see
 * their own — a badge telling them how many things OTHER people are waiting on
 * would be noise they cannot act on.
 *
 * ROLE-GATED BEFORE IT QUERIES. A role without `approval:view` pays nothing at
 * all: no round trip, on every page of the app. That matters because AppShell
 * renders on every navigation.
 *
 * LIVENESS, stated rather than discovered: there is no polling and no
 * subscription. An admin sitting still on one page sees nothing until they
 * navigate. AppShell already calls auth(), so the tree is dynamic and the count
 * is fresh on every navigation — which for this app, where the queue is
 * answered within the working day, is the whole requirement. Anything more is a
 * websocket nobody asked for.
 * ---------------------------------------------------------------------- */

import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/capabilities";

/** Just enough of the viewer to decide what they should be counting. Takes the
 * shape AppShell already has from its session cast rather than demanding a
 * currentUser() round trip: the pill is display-only, and /approvals re-checks
 * for itself against the live row. */
export type QueueViewer = { id: string; role: Role | undefined };

/** Pending requests this viewer should be told about. Zero for anyone who
 * cannot see the queue, without touching the database. */
export async function pendingApprovalCount(
  viewer: QueueViewer | null | undefined
): Promise<number> {
  if (!viewer || !can(viewer.role, "approval:view")) return 0;

  // One indexed COUNT, on @@index([status, createdAt]) — and for the requester
  // half, @@index([requestedById]).
  return prisma.approvalRequest.count({
    where: can(viewer.role, "approval:decide")
      ? { status: "PENDING" }
      : { status: "PENDING", requestedById: viewer.id },
  });
}
