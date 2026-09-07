"use server";

/* The auth boundary and the transport shape. Operations live in
 * @/lib/approvals/ops/shelf — see ops/sites.ts for why, and actions/sites.ts
 * for why runOrRequest replaced requireCapability without loosening anything. */

import { NotPermittedError } from "@/lib/permissions";
import { redirect } from "next/navigation";
import {
  parseShelfCreateArgs,
  parseSlotBoxTypeArgs,
  parseSlotFrontRowArgs,
  parseSlotItemArgs,
} from "@/lib/approvals/args";
import { runOrRequest } from "@/lib/approvals/runOrRequest";
import { describeRequested, type RequestedResult } from "@/lib/approvals/outcome";

export async function createShelf(formData: FormData) {
  "use server";

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

  const outcome = await runOrRequest("shelf.create", args);

  redirect(
    outcome.kind === "executed"
      ? `/shelf/${outcome.value.id}`
      : `/approvals?sent=${outcome.requestId}`
  );
}

/* The three slot actions below are invoked from a popover inside the client
 * ShelfGrid. On the request path they redirect back to the SAME shelf page
 * rather than to the queue: bouncing someone out of the shelf they are working
 * on, mid-edit, to read a list — for a two-second relabel — is disorienting.
 * Returning to the shelf closes the popover on remount and lets the page
 * acknowledge the request from `?requested`.
 *
 * toggleFrontRow takes no FormData at all, so there is nowhere to type a
 * reason. That is why ApprovalRequest.reason is nullable, and why the frozen
 * summary has to do the explaining for these micro-actions. */

export async function updateSlotBoxType(
  shelfId: string,
  slotId: string,
  formData: FormData
) {
  "use server";

  const args = parseSlotBoxTypeArgs({
    shelfId,
    slotId,
    boxType: formData.get("boxType"),
  });

  const outcome = await runOrRequest("shelf.slot.boxType", args);
  if (outcome.kind !== "executed") redirect(`/shelf/${shelfId}?requested=${outcome.requestId}`);
}

export async function assignSlotItem(shelfId: string, slotId: string, formData: FormData) {
  "use server";

  const args = parseSlotItemArgs({ shelfId, slotId, itemId: formData.get("itemId") });

  const outcome = await runOrRequest("shelf.slot.item", args);
  if (outcome.kind !== "executed") redirect(`/shelf/${shelfId}?requested=${outcome.requestId}`);
}

export async function toggleFrontRow(shelfId: string, slotId: string) {
  "use server";

  const args = parseSlotFrontRowArgs({ shelfId, slotId });

  const outcome = await runOrRequest("shelf.slot.frontRow", args, null);
  if (outcome.kind !== "executed") redirect(`/shelf/${shelfId}?requested=${outcome.requestId}`);
}

export type DeleteShelfResult =
  | { ok: true }
  | { ok: false; message: string }
  | RequestedResult;

/** `reason` is optional because this is called from an onClick rather than a
 * form; it becomes the approval's reason when the caller can only request. */
export async function deleteShelf(
  shelfId: string,
  reason?: string
): Promise<DeleteShelfResult> {
  try {
    const outcome = await runOrRequest("shelf.delete", { shelfId }, reason?.trim() || null);
    return outcome.kind === "executed" ? { ok: true } : describeRequested(outcome);
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot delete shelves" };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete the shelf",
    };
  }
}
