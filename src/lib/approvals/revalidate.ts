/* -------------------------------------------------------------------------
 * Which cached paths each operation invalidates.
 *
 * Extracted so the two paths that can run an operation cannot disagree. A
 * direct execution revalidates from the action file; an approved one
 * revalidates from the registry, minutes or hours later and from a different
 * request. If those two lists drifted apart, the approved path would leave a
 * stale page behind and the bug would only ever show up for finance — the one
 * role whose work goes through the queue.
 *
 * Deliberately not inside the transaction callback in either case: revalidation
 * after a write that later rolls back would advertise a change that did not
 * happen.
 * ---------------------------------------------------------------------- */

import { revalidatePath } from "next/cache";

export function revalidateSites(siteId?: string) {
  revalidatePath("/sites");
  if (siteId) revalidatePath(`/sites/${siteId}`);
  revalidatePath("/at-sites");
  revalidatePath("/dashboard");
}

export function revalidateShelf(shelfId?: string) {
  revalidatePath("/shelf");
  if (shelfId) revalidatePath(`/shelf/${shelfId}`);
  revalidatePath("/items");
  revalidatePath("/dashboard");
  revalidatePath("/shelf/suggestions");
}

/** Corrections reach everywhere: a reversal changes pack state, which changes
 * stock, which changes every page that aggregates it. Cheaper to invalidate
 * broadly than to reason about which report a given reversal touched. */
export function revalidateCorrections() {
  revalidatePath("/items", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/shelf");
  revalidatePath("/recycle");
  revalidatePath("/defective");
  revalidatePath("/sites", "layout");
  revalidatePath("/dispatches", "layout");
}

/** The queue's own pages. Raising, approving, rejecting or withdrawing a
 * request all change the pill in the header, which every page renders. */
export function revalidateApprovals() {
  revalidatePath("/approvals");
  revalidatePath("/", "layout");
}
