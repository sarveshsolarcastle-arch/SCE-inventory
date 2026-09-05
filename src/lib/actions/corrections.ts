"use server";

/* The auth boundary and the transport shape. Operations live in
 * @/lib/approvals/ops/corrections — see ops/sites.ts for why.
 *
 * Two different problems that are easy to conflate, and must not be:
 *
 *   Reversal    "this was recorded in error — it never happened", and restores
 *               the exact prior state, on the packs it actually came off.
 *   Adjustment  "the shelf and the app disagree — the shelf is right", and
 *               records a new truth, restoring nothing.
 *   (Return)    "it happened, and it is coming back" — the normal return flow,
 *               which creates a NEW offcut because that is what physically
 *               arrives.
 *
 * Conflating reversal and return silently corrupts pack state: a reversal puts
 * 75 m back on the roll it was cut from, a return creates a fresh 75 m offcut.
 */

import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import * as ops from "@/lib/approvals/ops/corrections";
import {
  parseReverseDispatchArgs,
  parseReverseTransactionArgs,
  parseStockAdjustArgs,
} from "@/lib/approvals/args";

export type CorrectionResult = { ok: true } | { ok: false; message: string };

function revalidateAll() {
  revalidatePath("/items", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/shelf");
  revalidatePath("/recycle");
  revalidatePath("/defective");
  revalidatePath("/sites", "layout");
  revalidatePath("/dispatches", "layout");
}

/** Undoes a movement recorded in error by restoring the exact prior state.
 *
 * Nothing is deleted: the original stays, marked reversed and excluded from
 * aggregation, and a REVERSAL row records who undid it and why. Refuses when
 * the packs involved have moved on since — see findReversalObstacles. */
export async function reverseTransaction(
  transactionId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const { id: userId } = await requireCapability("stock:reverse");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required to reverse a movement" };

  try {
    const args = parseReverseTransactionArgs({ transactionId, reason });
    await prisma.$transaction((tx) => ops.reverseTransaction(tx, args, userId));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Reversal failed" };
  }

  revalidateAll();
  return { ok: true };
}

export async function reverseDispatch(
  dispatchId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const { id: userId } = await requireCapability("stock:reverse");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required to reverse a dispatch" };

  try {
    const args = parseReverseDispatchArgs({ dispatchId, reason });
    await prisma.$transaction((tx) => ops.reverseDispatch(tx, args, userId));
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Dispatch reversal failed",
    };
  }

  revalidateAll();
  return { ok: true };
}

/** Records a physical count that disagrees with the ledger.
 *
 * What is STORED is the correction, not the count — see src/lib/adjustment.ts
 * for why that distinction is the whole point. The form still asks for what is
 * physically on the shelf, because asking a human to type "+3" is asking them
 * to do arithmetic against a number they cannot see; it just also submits the
 * ledger figure it showed them, so the server can work out the size of the
 * error they found and apply THAT.
 *
 * Field names, all from CorrectionPanel's AdjustStockForm:
 *   sealed_<packSize>        counted number of sealed packs of that size
 *   open_<packId>            counted remaining in that open pack
 *   ledger_<either of those> what the form displayed while they counted
 */
export async function adjustStock(
  itemId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const { id: userId } = await requireCapability("stock:adjust");

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required for a stock adjustment" };

  // Pick the count fields out FIRST, then validate them. Validating every entry
  // instead swept up `reason`, which the same form posts alongside the counts:
  // Number("annual count") is NaN, so every adjustment carrying a real reason
  // was refused as "not a whole number" and no count could ever be recorded.
  const counted = new Map<string, number>();
  const displayed = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    const isLedger = key.startsWith("ledger_");
    const rowKey = isLedger ? key.slice(7) : key;
    if (!rowKey.startsWith("sealed_") && !rowKey.startsWith("open_")) continue;

    const raw = String(value).trim();
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, message: "Counted quantities must be whole numbers of zero or more" };
    }
    (isLedger ? displayed : counted).set(rowKey, n);
  }

  const sealed: { packSize: number; counted: number; ledger: number }[] = [];
  const open: { packId: string; counted: number; ledger: number }[] = [];
  for (const [rowKey, count] of counted) {
    const ledger = displayed.get(rowKey);
    // No paired ledger figure means there is no way to know what error the
    // counter thought they were correcting, and falling back to an absolute
    // write would silently reintroduce exactly the bug this removes. Refuse.
    if (ledger === undefined) {
      return {
        ok: false,
        message: "This count form is out of date — reload the item page and count again.",
      };
    }

    if (rowKey.startsWith("sealed_")) {
      sealed.push({ packSize: Number(rowKey.slice(7)), counted: count, ledger });
    } else {
      open.push({ packId: rowKey.slice(5), counted: count, ledger });
    }
  }

  try {
    const args = parseStockAdjustArgs({ itemId, sealed, open, reason });
    await prisma.$transaction((tx) => ops.adjustStock(tx, args, userId));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Adjustment failed" };
  }

  revalidateAll();
  return { ok: true };
}
