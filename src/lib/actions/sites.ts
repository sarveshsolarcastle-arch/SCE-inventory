"use server";

import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
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
