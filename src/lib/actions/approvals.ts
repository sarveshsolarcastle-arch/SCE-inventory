"use server";

/* The auth boundary and the transport shape. The claim, the work and the
 * FAILED bookkeeping live in @/lib/approvals/decide — see ops/sites.ts for why
 * bodies do not live in a `"use server"` file.
 *
 * These are the three endpoints where the capability check carries the most
 * weight in the whole app: every async export here is directly invocable, and
 * `approveRequest` is, by construction, a way to run an admin-only operation.
 * If it did not check, a finance user could raise a request and then approve
 * it themselves with a replayed POST — which is not an approval workflow, it is
 * a self-service escalation.
 *
 * Hence the split that already exists in capabilities.ts: `approval:view` for
 * seeing the queue (ADMIN + FINANCE, so finance can follow its own requests)
 * and `approval:decide` for answering it (ADMIN only). Withdrawing is neither —
 * it is something the REQUESTER does to their own row, so it is gated on
 * ownership inside the same `where` clause rather than on a capability.
 */

import { requireCapability, currentUser } from "@/lib/permissions";
import {
  approveRequest as approve,
  cancelRequest as cancel,
  rejectRequest as reject,
  type DecisionResult,
} from "@/lib/approvals/decide";

export type { DecisionResult };

export async function approveRequest(requestId: string): Promise<DecisionResult> {
  const admin = await requireCapability("approval:decide");
  return approve(requestId, admin.id);
}

export async function rejectRequest(
  requestId: string,
  formData: FormData
): Promise<DecisionResult> {
  const admin = await requireCapability("approval:decide");
  const note = String(formData.get("note") ?? "").trim();
  return reject(requestId, admin.id, note || null);
}

/** Withdrawing your own pending request. Deliberately NOT gated on
 * `approval:decide` — that would stop the only people who ever need it — and
 * deliberately not gated on `approval:view` alone either, which would let any
 * viewer withdraw anyone's. The check that matters is ownership, and it rides
 * inside cancelRequest's `where` so it cannot be raced. */
export async function cancelRequest(requestId: string): Promise<DecisionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Not signed in" };
  return cancel(requestId, user.id);
}
