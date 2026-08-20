"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    throw new Error("Only admins can manage sites");
  }
}

export async function createSite(formData: FormData) {
  "use server";
  await requireAdmin();

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
  await requireAdmin();

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
