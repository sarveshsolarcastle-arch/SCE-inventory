/* -------------------------------------------------------------------------
 * The three-way gate every guarded write goes through.
 *
 *   holds the capability   → run it now
 *   may only REQUEST it    → write an ApprovalRequest row and say so
 *   neither                → NotPermittedError, exactly as before
 *
 * ASKING IS NOT A PERMISSION. This function is the only place the second table
 * is consulted; `can()` and `requireCapability` are unchanged and stay the hard
 * gate. Nothing here softens them — the difference is only whether a refusal
 * becomes a request instead of an error. When an admin later approves, the work
 * runs under a capability that admin genuinely holds.
 *
 * WHAT THIS FILE MUST NOT DO. It never redirects and never revalidates the
 * caller's own page beyond the operation's own list: `redirect()` throws
 * NEXT_REDIRECT, and a throw here is indistinguishable from a failed write to
 * the callers that catch. Callers decide where to go, from the Outcome.
 * ---------------------------------------------------------------------- */

import { prisma } from "@/lib/prisma";
import { NotPermittedError, currentUser } from "@/lib/permissions";
import { can, canRequest } from "@/lib/capabilities";
import { CAPABILITY_FOR_KIND, type ArgsFor, type OperationKind } from "./kinds";
import { OPERATIONS, type ResultFor } from "./registry";
import { revalidateApprovals } from "./revalidate";

/** How the attempt ended. Three arms rather than a boolean, because "we did not
 * do it, and that is fine" and "we did not do it, and something is wrong" must
 * never look alike to a caller. */
export type Outcome<R> =
  | { kind: "executed"; value: R }
  /** Queued. `summary` is the frozen sentence an admin will read. */
  | { kind: "requested"; requestId: string; summary: string }
  /** An identical request was already waiting, so nothing new was queued and
   * the caller is pointed at the existing one. */
  | { kind: "duplicate"; requestId: string; summary: string };

/** The interactive-transaction budget for a direct execution.
 *
 * Prisma's default is 5s. The heaviest operation here is
 * stock.reverseDispatch, which loops reverseMovementTx over every ISSUE line:
 * a 15-row dispatch is 90+ sequential statements, about 1.4s at the ~15 ms per
 * statement measured from Mumbai — and about 20s, timing out every single
 * time, at the ~230 ms it was paying before the region fix.
 *
 * SO `vercel.json` HAS STOPPED BEING A PERFORMANCE TWEAK AND BECOME A
 * CORRECTNESS DEPENDENCY. Its `"regions": ["bom1"]` keeps the app in the same
 * region as the Turso database; delete it and this timeout stops being
 * generous and starts being unreachable. The explicit number is here so that
 * failure would be a clear timeout rather than a mystery. */
export const TRANSACTION_TIMEOUT_MS = 20_000;

export async function runOrRequest<K extends OperationKind>(
  kind: K,
  args: ArgsFor<K>,
  reason: string | null = null
): Promise<Outcome<ResultFor<K>>> {
  const op = OPERATIONS[kind];
  const capability = CAPABILITY_FOR_KIND[kind];

  const user = await currentUser();
  if (!user) throw new Error("Not signed in");

  // Re-parsed even though the caller has typed arguments in hand, so that the
  // direct path and the approved path execute a payload normalised by exactly
  // the same function. Anything a caller assembled by hand is validated here
  // rather than at the moment an admin clicks Approve.
  const parsed = op.parse(args);

  if (can(user.role, capability)) {
    const value = await prisma.$transaction((tx) => op.execute(tx, parsed, user.id), {
      timeout: TRANSACTION_TIMEOUT_MS,
    });
    // After commit, never inside the callback: revalidating a write that then
    // rolled back would advertise a change that did not happen.
    op.revalidate(parsed, value);
    return { kind: "executed", value };
  }

  if (!canRequest(user.role, capability)) throw new NotPermittedError(capability);

  // Built server-side from the row as it is now — never from a label the
  // requester supplied, or finance could label a delete of site A as "delete
  // site B" and phish an approval out of an admin who read only the summary.
  const summary = await op.summarise(parsed);
  const targetKey = op.targetKey(parsed);
  const payload = JSON.stringify(parsed);

  const outcome = await prisma.$transaction(async (tx) => {
    // Collapse duplicates INSIDE the transaction. Two finance users can
    // otherwise queue "delete site X" twice, and the second becomes a
    // confusing FAILED moments after the first succeeds. A partial unique
    // index would enforce this in SQL, but Prisma cannot express
    // `WHERE status = 'PENDING'`, so migrate dev would report drift forever —
    // application-code check, and the transaction is what makes it hold.
    if (targetKey) {
      const existing = await tx.approvalRequest.findFirst({
        where: { kind, targetKey, status: "PENDING" },
        select: { id: true, summary: true },
      });
      if (existing) {
        return {
          kind: "duplicate" as const,
          requestId: existing.id,
          summary: existing.summary,
        };
      }
    }

    const row = await tx.approvalRequest.create({
      data: {
        kind,
        args: payload,
        summary,
        reason,
        targetKey,
        requestedById: user.id,
      },
      select: { id: true },
    });
    return { kind: "requested" as const, requestId: row.id, summary };
  });

  // Only a genuinely new row changes the queue or the header pill.
  if (outcome.kind === "requested") revalidateApprovals();

  return outcome;
}
