"use server";

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { describeSiteBlockers } from "@/lib/siteBlockers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createSite(formData: FormData) {
  "use server";
  await requireCapability("site:manage");

  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) throw new Error("Name is required");

  const site = await prisma.site.create({ data: { name, location, notes } });

  revalidatePath("/sites");
  redirect(`/sites/${site.id}`);
}

export type DeleteSiteResult = { ok: true } | { ok: false; message: string };

/** Removes a site added by mistake.
 *
 * Only ever a site with NOTHING attached. That guard is not politeness, it is
 * the whole reason this function is shaped the way it is: `Transaction.siteId`
 * is an OPTIONAL relation, so Prisma's default referential action for it is
 * `SetNull` — deleting a site that has history would not fail, it would quietly
 * blank the siteId on every one of its movements. The ledger would still
 * balance and no error would appear anywhere; the rows would simply stop
 * saying where the material went. A mis-click would cost exactly the
 * accountability trail this app was built to provide.
 *
 * So the count and the delete run inside one transaction — checking first and
 * deleting after would leave a window where a dispatch lands in between and is
 * silently orphaned by the delete that follows.
 */
export async function deleteSite(siteId: string): Promise<DeleteSiteResult> {
  try {
    await requireCapability("site:manage");
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot delete sites" };
    }
    return { ok: false, message: "Not signed in" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const site = await tx.site.findUnique({ where: { id: siteId } });
      if (!site) throw new Error("That site no longer exists");

      const counts = {
        transactions: await tx.transaction.count({
          // Both directions: a transfer OUT of this site carries it as
          // fromSiteId only, and would not be caught by siteId alone.
          where: { OR: [{ siteId }, { fromSiteId: siteId }] },
        }),
        dispatches: await tx.dispatch.count({ where: { siteId } }),
        deliveries: await tx.delivery.count({ where: { siteId } }),
        defectiveItems: await tx.defectiveItem.count({ where: { siteId } }),
        pickups: await tx.sitePickup.count({ where: { siteId } }),
      };

      // The same function the approvals pre-check will call, so what an admin is
      // shown before approving and what the operation refuses with cannot drift.
      const blocked = describeSiteBlockers(site.name, counts);
      if (blocked) throw new Error(blocked);

      await tx.site.delete({ where: { id: siteId } });
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete the site",
    };
  }

  revalidatePath("/sites");
  revalidatePath("/at-sites");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateSite(siteId: string, formData: FormData) {
  "use server";
  await requireCapability("site:manage");

  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name) throw new Error("Name is required");

  await prisma.site.update({
    where: { id: siteId },
    data: { name, location, notes },
  });

  revalidatePath("/sites");
  revalidatePath(`/sites/${siteId}`);
  redirect(`/sites/${siteId}`);
}
