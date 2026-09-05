"use server";

/* The auth boundary and the transport shape. Operations live in
 * @/lib/approvals/ops/shelf — see ops/sites.ts for why. */

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as ops from "@/lib/approvals/ops/shelf";
import {
  parseShelfCreateArgs,
  parseSlotBoxTypeArgs,
  parseSlotFrontRowArgs,
  parseSlotItemArgs,
} from "@/lib/approvals/args";

function revalidateShelf(shelfId?: string) {
  revalidatePath("/shelf");
  if (shelfId) revalidatePath(`/shelf/${shelfId}`);
  revalidatePath("/items");
  revalidatePath("/dashboard");
  revalidatePath("/shelf/suggestions");
}

export async function createShelf(formData: FormData) {
  "use server";
  await requireCapability("shelf:manage");

  let boxTypes: unknown = {};
  try {
    boxTypes = JSON.parse(String(formData.get("boxTypes") ?? "{}"));
  } catch {
    boxTypes = {};
  }

  const args = parseShelfCreateArgs({
    name: formData.get("name"),
    rows: Number(formData.get("rows") ?? 0),
    columns: Number(formData.get("columns") ?? 0),
    boxTypes,
  });

  const shelf = await prisma.$transaction((tx) => ops.createShelf(tx, args));

  revalidateShelf();
  redirect(`/shelf/${shelf.id}`);
}

export async function updateSlotBoxType(
  shelfId: string,
  slotId: string,
  formData: FormData
) {
  "use server";
  await requireCapability("shelf:manage");

  const args = parseSlotBoxTypeArgs({
    shelfId,
    slotId,
    boxType: formData.get("boxType"),
  });

  await prisma.$transaction((tx) => ops.updateSlotBoxType(tx, args));
  revalidateShelf(shelfId);
}

export async function assignSlotItem(shelfId: string, slotId: string, formData: FormData) {
  "use server";
  await requireCapability("shelf:manage");

  const args = parseSlotItemArgs({ shelfId, slotId, itemId: formData.get("itemId") });

  await prisma.$transaction((tx) => ops.assignSlotItem(tx, args));
  revalidateShelf(shelfId);
}

export async function toggleFrontRow(shelfId: string, slotId: string) {
  "use server";
  await requireCapability("shelf:manage");

  const args = parseSlotFrontRowArgs({ shelfId, slotId });

  await prisma.$transaction((tx) => ops.toggleFrontRow(tx, args));
  revalidateShelf(shelfId);
}

export type DeleteShelfResult = { ok: true } | { ok: false; message: string };

export async function deleteShelf(shelfId: string): Promise<DeleteShelfResult> {
  try {
    await requireCapability("shelf:delete");
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot delete shelves" };
    }
    return { ok: false, message: "Not signed in" };
  }

  try {
    await prisma.$transaction((tx) => ops.deleteShelf(tx, { shelfId }));
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete the shelf",
    };
  }

  revalidateShelf();
  return { ok: true };
}
