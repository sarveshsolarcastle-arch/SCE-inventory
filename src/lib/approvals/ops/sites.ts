/* -------------------------------------------------------------------------
 * Site operations, as plain functions over a caller-owned transaction.
 *
 * WHY THEY LIVE HERE AND NOT IN actions/sites.ts. That file carries a top-level
 * `"use server"`, which makes EVERY async export a network-reachable RPC
 * endpoint. The obvious way to let the approval path reuse a body — export an
 * unguarded `deleteSiteCore` from the action file — would therefore publish an
 * unauthenticated delete to the internet. That is exactly the hazard
 * permissions.ts warns about: actions are directly invocable, and anyone can
 * replay the POST. So the bodies live in a plain module, and the action file
 * keeps only a thin guarded wrapper.
 *
 * Imports run one way — actions → registry → ops — so no cycle is possible.
 *
 * Every function takes a `tx` the CALLER owns, because the approval path needs
 * the status flip and the work in ONE transaction (Prisma has no nested
 * interactive transactions), and because a mid-batch failure must roll back the
 * lot. None of them redirect or revalidate: `redirect()` throws NEXT_REDIRECT,
 * which the approve path's catch would misread as an execution failure and
 * record as a bogus FAILED.
 * ---------------------------------------------------------------------- */

import type { Prisma } from "@/generated/prisma/client";
import { describeSiteBlockers, type SiteBlockerCounts } from "@/lib/siteBlockers";
import type { SiteCreateArgs, SiteDeleteArgs, SiteUpdateArgs } from "../kinds";

/** What is attached to a site right now. Shared by `deleteSite`, which refuses
 * on it, and the registry's precheck, which shows it — so an admin cannot be
 * told one thing and the operation do another. */
export async function countSiteBlockers(
  tx: Prisma.TransactionClient,
  siteId: string
): Promise<SiteBlockerCounts> {
  return {
    transactions: await tx.transaction.count({
      // Both directions: a transfer OUT of this site carries it as fromSiteId
      // only, and would not be caught by siteId alone.
      where: { OR: [{ siteId }, { fromSiteId: siteId }] },
    }),
    dispatches: await tx.dispatch.count({ where: { siteId } }),
    deliveries: await tx.delivery.count({ where: { siteId } }),
    defectiveItems: await tx.defectiveItem.count({ where: { siteId } }),
    pickups: await tx.sitePickup.count({ where: { siteId } }),
  };
}

export async function createSite(
  tx: Prisma.TransactionClient,
  args: SiteCreateArgs
): Promise<{ id: string; name: string }> {
  const site = await tx.site.create({
    data: { name: args.name, location: args.location, notes: args.notes },
  });
  return { id: site.id, name: site.name };
}

export async function updateSite(
  tx: Prisma.TransactionClient,
  args: SiteUpdateArgs
): Promise<{ id: string; name: string }> {
  const site = await tx.site.update({
    where: { id: args.siteId },
    data: { name: args.name, location: args.location, notes: args.notes },
  });
  return { id: site.id, name: site.name };
}

/** Removes a site added by mistake — and ONLY one with nothing attached.
 *
 * That guard is not politeness, it is the reason this function is shaped the
 * way it is. `Transaction.siteId` is an OPTIONAL relation, so Prisma's default
 * referential action is SetNull: deleting a site with history would not fail,
 * it would quietly blank the siteId on every one of its movements. The ledger
 * would still balance and nothing would error; the rows would simply stop
 * saying where the material went. A mis-click would cost exactly the
 * accountability trail this app was built to provide.
 *
 * The count and the delete therefore share the caller's transaction — checking
 * first and deleting after would leave a window for a dispatch to land in
 * between and be silently orphaned by the delete that follows. */
export async function deleteSite(
  tx: Prisma.TransactionClient,
  args: SiteDeleteArgs
): Promise<{ name: string }> {
  const site = await tx.site.findUnique({ where: { id: args.siteId } });
  if (!site) throw new Error("That site no longer exists");

  const blocked = describeSiteBlockers(site.name, await countSiteBlockers(tx, args.siteId));
  if (blocked) throw new Error(blocked);

  await tx.site.delete({ where: { id: args.siteId } });
  return { name: site.name };
}
