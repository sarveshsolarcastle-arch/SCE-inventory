"use server";

import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { piecesTotal } from "@/lib/units";
import { recordDelivery, type DeliveryLineInput } from "@/lib/actions/deliveries";
import { recordDispatch, type DispatchInput, type DispatchResult } from "@/lib/actions/dispatches";

/* -------------------------------------------------------------------------
 * "Stock_In and Stock_Out in one window" — for material that is not in the
 * store's records yet but has to leave for a site anyway.
 *
 * It takes EXACTLY what the Stock_Out form takes, and then does the two
 * ordinary things in the ordinary order, each through its own existing action:
 *
 *   1. recordDelivery — a normal Stock_In into the store for exactly the
 *      quantities being sent out, so the ledger has the receipt,
 *   2. recordDispatch — the normal Stock_Out to the site, with its numbered
 *      challan.
 *
 * Nothing here writes a stock movement itself and nothing is bypassed: the
 * store ends up where it started, and both records and the challan are the
 * ones the two screens would have made. Items must already be registered —
 * registering one stays the ordinary Items-page job.
 *
 * NOT atomic across the two steps, and that is stated rather than hidden: if
 * the Stock_In succeeds and the dispatch then fails, the Stock_In is a real,
 * recorded receipt and stays; the message says so.
 * ---------------------------------------------------------------------- */

export async function recordStockInThenDispatch(input: DispatchInput): Promise<DispatchResult> {
  try {
    await requireCapability("delivery:record");
    await requireCapability("stock:issue");
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot record a Stock_In and a Stock_Out" };
    }
    return { ok: false, message: "Not signed in" };
  }

  // One Stock_In line per sealed-pack size, plus one loose line for whatever
  // was entered as cut pieces or a plain quantity — the same shapes the
  // Stock_In form itself produces.
  const stockLines: DeliveryLineInput[] = [];
  for (const line of input.lines) {
    for (const p of line.sealedPacks) {
      stockLines.push({
        itemId: line.itemId,
        packSize: p.packSize,
        packCount: p.count,
        loose: 0,
        defectiveQty: 0,
      });
    }
    const loose = piecesTotal(line.pieces) + line.loose;
    if (loose > 0) {
      stockLines.push({ itemId: line.itemId, packSize: null, packCount: 0, loose, defectiveQty: 0 });
    }
  }
  if (!stockLines.length) return { ok: false, message: "Add at least one line" };

  const stocked = await recordDelivery({
    reference: input.reference,
    note: input.note || "Stock_In to cover the Stock_Out entered alongside it",
    lines: stockLines,
  });
  if (!stocked.ok) {
    return {
      ok: false,
      message: `Nothing was recorded. ${stocked.errors?.[0]?.message ?? stocked.message}`,
    };
  }

  const dispatched = await recordDispatch({
    ...input,
    // The Stock_In has just made the stock available, so there is no earlier
    // review of a pack to open to approve — the server plans it at commit.
    lines: input.lines.map((l) => ({ ...l, approvedOpens: [] })),
  });
  if (!dispatched.ok) {
    return {
      ...dispatched,
      message: `The Stock_In was recorded, but the Stock_Out was not: ${dispatched.message} Record the Stock_Out from the Stock_Out page.`,
    };
  }
  return dispatched;
}
