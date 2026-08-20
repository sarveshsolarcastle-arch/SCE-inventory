"use server";

import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createItem(formData: FormData) {
  "use server";
  await requireCapability("item:manage");

  const fields = readItemFields(formData);

  // Deliberately no starting stock: it used to write currentStock with no
  // Transaction behind it, so seeded stock had no audit trail and updateItem
  // could never correct it. Stock now arrives through a recorded movement.
  const item = await prisma.item.create({ data: fields });

  revalidatePath("/items");
  redirect(`/items/${item.id}`);
}

/** Shared parsing/validation for the create and edit forms. */
function readItemFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const baseUnit = String(formData.get("baseUnit") ?? "pcs").trim() || "pcs";
  const packUnit = String(formData.get("packUnit") ?? "").trim() || null;
  const measure = String(formData.get("measure") ?? "DISCRETE") === "CONTINUOUS"
    ? ("CONTINUOUS" as const)
    : ("DISCRETE" as const);
  const minStock = Number(formData.get("minStock") ?? 0);

  const thresholdRaw = String(formData.get("scrapThreshold") ?? "").trim();
  const scrapThreshold =
    measure === "CONTINUOUS" && thresholdRaw !== "" ? Number(thresholdRaw) : null;

  if (!name || !sku) throw new Error("Name and SKU are required");
  if (!Number.isInteger(minStock) || minStock < 0) {
    throw new Error("Minimum stock must be a whole number of " + baseUnit);
  }
  if (scrapThreshold !== null && (!Number.isInteger(scrapThreshold) || scrapThreshold < 0)) {
    throw new Error("Scrap threshold must be a whole number");
  }

  return { name, sku, category, baseUnit, packUnit, measure, minStock, scrapThreshold };
}

export async function updateItem(itemId: string, formData: FormData) {
  "use server";
  await requireCapability("item:manage");

  const fields = readItemFields(formData);

  const packSizes = await prisma.packStock.findMany({
    where: { itemId, sealedCount: { gt: 0 } },
    orderBy: { packSize: "asc" },
    take: 1,
  });
  // A threshold at or above the smallest pack size would scrap a delivery on
  // arrival — the pack would be born below the usable line.
  if (fields.scrapThreshold !== null && packSizes[0] && fields.scrapThreshold >= packSizes[0].packSize) {
    throw new Error(
      `Scrap threshold must be below the smallest pack size in stock (${packSizes[0].packSize} ${fields.baseUnit})`
    );
  }

  await prisma.item.update({ where: { id: itemId }, data: fields });

  revalidatePath("/items");
  revalidatePath(`/items/${itemId}`);
  redirect(`/items/${itemId}`);
}
