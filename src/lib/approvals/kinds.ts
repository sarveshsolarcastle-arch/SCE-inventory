/* -------------------------------------------------------------------------
 * The operations a FINANCE user may ask an admin to carry out, and the shape
 * of each one's arguments.
 *
 * Pure — types and one table, no database, no framework. registry.ts binds
 * these names to the code that executes them; this file is what the pure
 * parsers, summaries and prechecks can all import without dragging Prisma in.
 *
 * A NAMING COLLISION TO AVOID. "Approval" is already taken in this codebase
 * and means something unrelated: ApprovedOpens (packs.ts) and needsApproval
 * (transactions.ts, dispatches.ts) are the IN-REQUEST handshake where one user
 * confirms "yes, break open 2 sealed packs" — same request, same person,
 * nothing to do with roles. Everything in this feature lives under
 * ApprovalRequest / approvals/ and must not reuse those names.
 * ---------------------------------------------------------------------- */

import type { Capability } from "@/lib/capabilities";

export type OperationKind =
  | "site.create"
  | "site.update"
  | "site.delete"
  | "shelf.create"
  | "shelf.delete"
  | "shelf.slot.boxType"
  | "shelf.slot.item"
  | "shelf.slot.frontRow"
  | "stock.reverseTransaction"
  | "stock.reverseDispatch"
  | "stock.adjust";

export const OPERATION_KINDS: readonly OperationKind[] = [
  "site.create",
  "site.update",
  "site.delete",
  "shelf.create",
  "shelf.delete",
  "shelf.slot.boxType",
  "shelf.slot.item",
  "shelf.slot.frontRow",
  "stock.reverseTransaction",
  "stock.reverseDispatch",
  "stock.adjust",
];

/** Which capability each operation needs. Derived from here rather than stored
 * on the request row, so capabilities.ts stays the single source: a row's
 * capability is a fact about its kind, not about when it was raised. */
export const CAPABILITY_FOR_KIND: Record<OperationKind, Capability> = {
  "site.create": "site:manage",
  "site.update": "site:manage",
  "site.delete": "site:manage",
  "shelf.create": "shelf:manage",
  // NOT shelf:manage — relabelling a box and demolishing the shelf it sits on
  // are different-sized actions, and the split exists so granting one never
  // silently grants the other.
  "shelf.delete": "shelf:delete",
  "shelf.slot.boxType": "shelf:manage",
  "shelf.slot.item": "shelf:manage",
  "shelf.slot.frontRow": "shelf:manage",
  "stock.reverseTransaction": "stock:reverse",
  "stock.reverseDispatch": "stock:reverse",
  "stock.adjust": "stock:adjust",
};

export type BoxType = "FRESH" | "OPENED" | "RECYCLABLE";

export type SiteCreateArgs = {
  name: string;
  location: string | null;
  notes: string | null;
};
export type SiteUpdateArgs = SiteCreateArgs & { siteId: string };
export type SiteDeleteArgs = { siteId: string };

export type ShelfCreateArgs = {
  name: string;
  rows: number;
  columns: number;
  /** slot key ("FRONT-1-2") → box type, from the wizard's second step. */
  boxTypes: Record<string, BoxType>;
};
export type ShelfDeleteArgs = { shelfId: string };
export type SlotBoxTypeArgs = { shelfId: string; slotId: string; boxType: BoxType };
/** itemId null clears the box. */
export type SlotItemArgs = { shelfId: string; slotId: string; itemId: string | null };
export type SlotFrontRowArgs = { shelfId: string; slotId: string };

export type ReverseTransactionArgs = { transactionId: string; reason: string };
export type ReverseDispatchArgs = { dispatchId: string; reason: string };

/** Carries the LEDGER FIGURES the counter was shown, not just what they
 * counted — which is the whole reason a delayed approval can be applied
 * correctly. See src/lib/adjustment.ts: what is durable in a count is the size
 * of the error, and the error is only knowable relative to what the screen
 * said at the time. Without these an approval sitting overnight would apply a
 * stale total. */
export type StockAdjustArgs = {
  itemId: string;
  sealed: { packSize: number; counted: number; ledger: number }[];
  open: { packId: string; counted: number; ledger: number }[];
  reason: string;
};

export type ArgsFor<K extends OperationKind> = {
  "site.create": SiteCreateArgs;
  "site.update": SiteUpdateArgs;
  "site.delete": SiteDeleteArgs;
  "shelf.create": ShelfCreateArgs;
  "shelf.delete": ShelfDeleteArgs;
  "shelf.slot.boxType": SlotBoxTypeArgs;
  "shelf.slot.item": SlotItemArgs;
  "shelf.slot.frontRow": SlotFrontRowArgs;
  "stock.reverseTransaction": ReverseTransactionArgs;
  "stock.reverseDispatch": ReverseDispatchArgs;
  "stock.adjust": StockAdjustArgs;
}[K];

export function isOperationKind(value: unknown): value is OperationKind {
  return typeof value === "string" && (OPERATION_KINDS as readonly string[]).includes(value);
}
