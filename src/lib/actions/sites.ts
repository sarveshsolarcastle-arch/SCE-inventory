"use server";

/* The auth boundary and the transport shape, and nothing else. The operations
 * themselves live in @/lib/approvals/ops/sites, as plain functions over a
 * transaction — see the header there for why they cannot live in this file.
 *
 * Every async export here is a network-reachable RPC endpoint, because of the
 * `"use server"` above. That is the whole reason each one starts with
 * requireCapability: hiding a button proves nothing. */

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as ops from "@/lib/approvals/ops/sites";
import { parseSiteCreateArgs, parseSiteUpdateArgs } from "@/lib/approvals/args";

function revalidateSites(siteId?: string) {
  revalidatePath("/sites");
  if (siteId) revalidatePath(`/sites/${siteId}`);
  revalidatePath("/at-sites");
  revalidatePath("/dashboard");
}

export async function createSite(formData: FormData) {
  "use server";
  await requireCapability("site:manage");

  const args = parseSiteCreateArgs({
    name: formData.get("name"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });

  const site = await prisma.$transaction((tx) => ops.createSite(tx, args));

  revalidateSites();
  // Outside the transaction: redirect() throws NEXT_REDIRECT, which inside
  // would roll the write back.
  redirect(`/sites/${site.id}`);
}

export async function updateSite(siteId: string, formData: FormData) {
  "use server";
  await requireCapability("site:manage");

  const args = parseSiteUpdateArgs({
    siteId,
    name: formData.get("name"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });

  await prisma.$transaction((tx) => ops.updateSite(tx, args));

  revalidateSites(siteId);
  redirect(`/sites/${siteId}`);
}

export type DeleteSiteResult = { ok: true } | { ok: false; message: string };

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
    await prisma.$transaction((tx) => ops.deleteSite(tx, { siteId }));
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete the site",
    };
  }

  revalidateSites();
  return { ok: true };
}
