/* Pure presentation for a request's lifecycle. No database, no framework. */

export type ApprovalStatusValue =
  | "PENDING"
  | "APPROVED"
  | "FAILED"
  | "REJECTED"
  | "CANCELLED";

export type StatusTone = "warn" | "ok" | "danger" | "neutral";

export const APPROVAL_STATUS_TONE: Record<ApprovalStatusValue, StatusTone> = {
  PENDING: "warn",
  APPROVED: "ok",
  // FAILED is not a softer REJECTED: it means an admin said yes and the
  // operation then refused, so it reads as an error rather than a decision.
  FAILED: "danger",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatusValue, string> = {
  PENDING: "Awaiting an admin",
  APPROVED: "Approved",
  // Worded so nobody reads it as "half happened". The status write and the work
  // share one transaction, so a rollback takes both.
  FAILED: "Approved, but could not be carried out",
  REJECTED: "Declined",
  CANCELLED: "Withdrawn",
};

/** A request is answered once it leaves PENDING; only then is it out of the
 * queue. Used for the admin's count and for hiding the Withdraw button. */
export function isPending(status: string): boolean {
  return status === "PENDING";
}
