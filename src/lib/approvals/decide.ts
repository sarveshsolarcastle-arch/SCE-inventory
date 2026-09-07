/* -------------------------------------------------------------------------
 * Answering a request: approve, reject, withdraw.
 *
 * THE ONE THING THAT MUST NOT BE GOT WRONG IS THE CLAIM. Two admins clicking
 * Approve at the same instant must not run the operation twice. The lock is a
 * conditional update whose ROW COUNT is the guard, and it lives INSIDE the same
 * transaction as the work:
 *
 *   updateMany({ where: { id, status: "PENDING" }, … })   ← the guard
 *   if (claim.count === 0) throw new AlreadyAnswered()
 *   await op.execute(tx, args, row.requestedById)
 *
 * SQLite/libsql serialises write transactions, so the second admin's
 * transaction cannot start writing until the first commits — at which point its
 * `WHERE status = 'PENDING'` matches nothing and returns count 0.
 *
 * Three consequences of sharing that transaction, all worth stating because
 * each one is a thing somebody would otherwise add:
 *
 *   NO `EXECUTING` STATE IS NEEDED. There is no crash window: a failure
 *   mid-flight rolls the claim back too, and the request is simply still
 *   pending. An intermediate status would only be needed if the claim and the
 *   work could not share a transaction.
 *
 *   `FAILED` IS HONEST BECAUSE OF THAT ROLLBACK. It means "nothing happened,
 *   here is why" — never "half happened". The FAILED row is written afterwards
 *   by a SECOND guarded updateMany, again on `status: "PENDING"`, so a racing
 *   admin cannot be trampled by it either.
 *
 *   THE WORK IS ATTRIBUTED TO THE REQUESTER, not to the admin who approved.
 *   The finance user is the one who decided a movement was wrong, and
 *   Transaction.userId is the accountability trail. Who approved it is recorded
 *   separately, on the ApprovalRequest row.
 *
 * Plain module, no "use server" — see ops/sites.ts for why that matters.
 * ---------------------------------------------------------------------- */

import { prisma } from "@/lib/prisma";
import { APPROVAL_STATUS_LABEL, type ApprovalStatusValue } from "./status";
import { erasedOperationFor } from "./registry";
import { isOperationKind } from "./kinds";
import { revalidateApprovals } from "./revalidate";
import { TRANSACTION_TIMEOUT_MS } from "./runOrRequest";

/** Thrown by the claim when the row left PENDING before we got there. Its only
 * job is to travel out of the transaction callback distinguishably, so the
 * catch can tell "someone beat us" from "the operation refused". */
export class AlreadyAnswered extends Error {
  constructor() {
    super("Another admin answered this first");
    this.name = "AlreadyAnswered";
  }
}

export type DecisionResult =
  | { ok: true; message: string }
  /** `retry` marks the one case where the request is still PENDING and trying
   * again is the right move. Everything else is answered. */
  | { ok: false; message: string; retry?: boolean };

/** Whether an error means "the database was busy", rather than "the operation
 * refused".
 *
 * THIS DISTINCTION IS THE POINT. Under contention Prisma surfaces a busy or
 * timed-out transaction; recording that as FAILED would burn a perfectly good
 * request — the admin would see "could not be carried out" for something that
 * was never attempted. It is the one case where the row must stay PENDING.
 *
 * Detection is by code and message, which is unavoidably approximate. The
 * trade-off is deliberate and falls this way round: a missed busy costs one
 * burned request, while treating every unrecognised error as retryable would
 * leave genuine refusals sitting in the queue forever, re-failing on each
 * retry with no explanation ever recorded. */
function isBusy(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  // P2028 is Prisma's transaction API error, which is what an interactive
  // transaction timeout arrives as.
  if (code === "P2028") return true;
  const message = error instanceof Error ? error.message : "";
  return /SQLITE_BUSY|database is locked|transaction already closed|timed out|timeout/i.test(
    message
  );
}

function alreadyAnswered(status: ApprovalStatusValue | string): DecisionResult {
  const label = APPROVAL_STATUS_LABEL[status as ApprovalStatusValue] ?? status;
  return { ok: false, message: `Another admin answered this first — it is now "${label}".` };
}

/** Runs the request's operation, attributed to whoever raised it.
 *
 * `adminId` is only recorded, never used as the actor: see the header. */
export async function approveRequest(
  requestId: string,
  adminId: string
): Promise<DecisionResult> {
  const row = await prisma.approvalRequest.findUnique({ where: { id: requestId } });
  if (!row) return { ok: false, message: "That request no longer exists." };
  if (row.status !== "PENDING") return alreadyAnswered(row.status);

  // A row whose kind has since been removed from the registry must not take the
  // page down, and must not be silently approvable either.
  if (!isOperationKind(row.kind)) {
    return await markFailed(
      requestId,
      adminId,
      `This app no longer knows how to carry out "${row.kind}".`
    );
  }
  const op = erasedOperationFor(row.kind);

  // Re-parsed, never trusted: the string in ApprovalRequest.args was ultimately
  // supplied by the requester. Exactly how Transaction.appliedPlan is re-parsed
  // at reversal time rather than believed. A payload that cannot be parsed can
  // never be carried out, so it is answered rather than left in the queue.
  let args: unknown;
  try {
    args = op.parse(JSON.parse(row.args));
  } catch (error) {
    return await markFailed(
      requestId,
      adminId,
      error instanceof Error ? error.message : "The stored request is not valid"
    );
  }

  let result: unknown;
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const claim = await tx.approvalRequest.updateMany({
          // The guard. Not a read-then-write: the row count IS the lock.
          where: { id: requestId, status: "PENDING" },
          data: { status: "APPROVED", decidedById: adminId, decidedAt: new Date() },
        });
        if (claim.count === 0) throw new AlreadyAnswered();
        return await op.execute(tx, args, row.requestedById);
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
    );
  } catch (error) {
    if (error instanceof AlreadyAnswered) {
      const now = await prisma.approvalRequest.findUnique({
        where: { id: requestId },
        select: { status: true },
      });
      return alreadyAnswered(now?.status ?? "APPROVED");
    }
    if (isBusy(error)) {
      return {
        ok: false,
        retry: true,
        message:
          "The database was busy, so nothing was done and the request is still waiting. Try again.",
      };
    }
    return await markFailed(
      requestId,
      adminId,
      error instanceof Error ? error.message : "The operation refused"
    );
  }

  // After commit, never inside the callback: revalidating a write that later
  // rolled back would advertise a change that did not happen.
  op.revalidate(args, result);
  revalidateApprovals();
  return { ok: true, message: `Done — ${row.summary}` };
}

/** Writes the FAILED row, guarded on PENDING so a racing admin is not
 * trampled. Nothing was written by the operation: the claim and the work shared
 * one transaction, so the rollback took both.
 *
 * DELIBERATELY DOES NOT REVALIDATE, and this is not an oversight — it was found
 * by testing the page. `revalidatePath("/approvals")` inside a server action
 * makes Next re-render the page with the action's response, which removes this
 * row from the pending list and therefore UNMOUNTS the component waiting to
 * display the refusal. The admin would watch the card vanish and never learn
 * whether it was carried out, raced, or refused — losing the one sentence this
 * whole path exists to produce.
 *
 * Nothing is hidden by leaving it out. No domain data changed (the transaction
 * rolled back), only this request's own status, and /approvals is dynamic — it
 * re-queries on the next navigation, or on the refresh button the message is
 * shown beside. */
async function markFailed(
  requestId: string,
  adminId: string,
  note: string
): Promise<DecisionResult> {
  await prisma.approvalRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: {
      status: "FAILED",
      decidedById: adminId,
      decidedAt: new Date(),
      decisionNote: note,
    },
  });
  return {
    ok: false,
    message: `Nothing was done — the operation refused: ${note}`,
  };
}

export async function rejectRequest(
  requestId: string,
  adminId: string,
  note: string | null
): Promise<DecisionResult> {
  // Same guarded updateMany, no transaction needed: there is no work to share
  // one with.
  const claim = await prisma.approvalRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: {
      status: "REJECTED",
      decidedById: adminId,
      decidedAt: new Date(),
      decisionNote: note,
    },
  });
  if (claim.count === 0) {
    const now = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
    return alreadyAnswered(now?.status ?? "REJECTED");
  }

  revalidateApprovals();
  return { ok: true, message: "Declined." };
}

/** Withdrawn by the requester while still pending.
 *
 * The ownership check rides INSIDE the same `where` as the status guard, so it
 * cannot be raced and cannot be bypassed by a replayed POST: there is no window
 * between "is this yours" and "withdraw it". */
export async function cancelRequest(
  requestId: string,
  requesterId: string
): Promise<DecisionResult> {
  const claim = await prisma.approvalRequest.updateMany({
    where: { id: requestId, status: "PENDING", requestedById: requesterId },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      message: "That request is not yours to withdraw, or an admin has already answered it.",
    };
  }

  revalidateApprovals();
  return { ok: true, message: "Withdrawn." };
}
