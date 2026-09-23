"use server";

/* The auth boundary and the transport shape. Operations live in
 * @/lib/approvals/ops/corrections — see ops/sites.ts for why, and
 * actions/sites.ts for why runOrRequest replaced requireCapability without
 * loosening anything.
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
 *
 * All three collect a mandatory reason already, so the approval reason comes
 * for free — it is the same sentence, and it should be: "why are you undoing
 * this" and "why are you asking me to undo this" are one question.
 */

import { NotPermittedError } from "@/lib/permissions";
import {
  parseReverseDispatchArgs,
  parseReverseTransactionArgs,
  parseReverseTransferArgs,
  parseStockAdjustArgs,
} from "@/lib/approvals/args";
import { runOrRequest } from "@/lib/approvals/runOrRequest";
import { describeRequested, type RequestedResult } from "@/lib/approvals/outcome";

export type CorrectionResult =
  | { ok: true }
  | { ok: false; message: string }
  | RequestedResult;

/** Every failure here is a sentence for the user, never a throw: these actions
 * are called from CorrectionPanel and the reversal buttons, which render
 * `result.message` in an Alert. A NotPermittedError is the one case worth
 * naming separately — it is not a refusal by the operation, it is the account. */
function refusal(error: unknown, fallback: string): CorrectionResult {
  if (error instanceof NotPermittedError) {
    return { ok: false, message: "Your account cannot correct stock records" };
  }
  return { ok: false, message: error instanceof Error ? error.message : fallback };
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
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required to reverse a movement" };

  try {
    const args = parseReverseTransactionArgs({ transactionId, reason });
    const outcome = await runOrRequest("stock.reverseTransaction", args, reason);
    return outcome.kind === "executed" ? { ok: true } : describeRequested(outcome);
  } catch (error) {
    return refusal(error, "Reversal failed");
  }
}

export async function reverseDispatch(
  dispatchId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required to reverse a dispatch" };

  try {
    const args = parseReverseDispatchArgs({ dispatchId, reason });
    const outcome = await runOrRequest("stock.reverseDispatch", args, reason);
    return outcome.kind === "executed" ? { ok: true } : describeRequested(outcome);
  } catch (error) {
    return refusal(error, "Dispatch reversal failed");
  }
}

/** Reverses every not-yet-reversed line of a batch transfer in one go — same
 * shape as reverseDispatch, and for the same reason: a wrong multi-item
 * transfer should take one reason and one approval to undo, not one per
 * line. */
export async function reverseTransfer(
  transferId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required to reverse a transfer" };

  try {
    const args = parseReverseTransferArgs({ transferId, reason });
    const outcome = await runOrRequest("stock.reverseTransfer", args, reason);
    return outcome.kind === "executed" ? { ok: true } : describeRequested(outcome);
  } catch (error) {
    return refusal(error, "Transfer reversal failed");
  }
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
 * Under an approval that stops being a nicety. The gap between counting and
 * applying becomes hours, and only the size of an error survives legitimate
 * movement in between.
 *
 * Field names, all from CorrectionPanel's AdjustStockForm:
 *   sealed_<packSize>        counted number of sealed packs of that size
 *   open_<packId>            counted remaining in that open pack
 *   ledger_<either of those> what the form displayed while they counted
 *   new_<key>                a piece found with NO row behind it at all —
 *                             see adjustment.ts's NewOpenLine. Never paired
 *                             with a ledger_ field: there is nothing prior to
 *                             disagree with, so the whole value is the length.
 *   newsealedsize_<key>      paired with newsealedcount_<key> below: a whole
 *   newsealedcount_<key>     sealed pack SIZE the item has no row for at all
 *                             yet (a fresh 500 m roll where 500 is new). Also
 *                             never paired with ledger_ — folded straight
 *                             into `sealed` below with ledger 0, since
 *                             planAdjustment already upserts a size it has
 *                             never seen.
 */
export async function adjustStock(
  itemId: string,
  formData: FormData
): Promise<CorrectionResult> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { ok: false, message: "A reason is required for a stock adjustment" };

  // Pick the count fields out FIRST, then validate them. Validating every entry
  // instead swept up `reason`, which the same form posts alongside the counts:
  // Number("annual count") is NaN, so every adjustment carrying a real reason
  // was refused as "not a whole number" and no count could ever be recorded.
  const counted = new Map<string, number>();
  const displayed = new Map<string, number>();
  const newLengths: number[] = [];
  const newSealedSize = new Map<string, number>();
  const newSealedCount = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("new_")) {
      const raw = String(value).trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        return { ok: false, message: "A new cut length must be a whole number greater than zero" };
      }
      newLengths.push(n);
      continue;
    }

    if (key.startsWith("newsealedsize_") || key.startsWith("newsealedcount_")) {
      const isSize = key.startsWith("newsealedsize_");
      const rowKey = key.slice(isSize ? 14 : 15);
      const raw = String(value).trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        return {
          ok: false,
          message: isSize
            ? "A new pack size must be a whole number greater than zero"
            : "A new pack's count must be a whole number greater than zero",
        };
      }
      (isSize ? newSealedSize : newSealedCount).set(rowKey, n);
      continue;
    }

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

  // A row is a pair — a size with no count (or vice versa) is a form left
  // half-filled, not a row to silently drop.
  const newSealedKeys = new Set([...newSealedSize.keys(), ...newSealedCount.keys()]);
  for (const rowKey of newSealedKeys) {
    const packSize = newSealedSize.get(rowKey);
    const count = newSealedCount.get(rowKey);
    if (packSize === undefined || count === undefined) {
      return { ok: false, message: "A new pack size needs both a size and a count." };
    }
    sealed.push({ packSize, counted: count, ledger: 0 });
  }

  const newOpen = newLengths.map((length) => ({ length }));

  try {
    const args = parseStockAdjustArgs({ itemId, sealed, open, newOpen, reason });
    const outcome = await runOrRequest("stock.adjust", args, reason);
    return outcome.kind === "executed" ? { ok: true } : describeRequested(outcome);
  } catch (error) {
    return refusal(error, "Adjustment failed");
  }
}
