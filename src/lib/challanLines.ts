import type { DeliveryLine, Item, Transaction } from "@/generated/prisma/client";
import { describeMovement } from "./units.ts";

/* -------------------------------------------------------------------------
 * What the printed challan table actually needs from a line: a name, some
 * descriptive text, a number, a unit and a remark — nothing about ledger rows.
 *
 * ChallanSheet used to take Transaction rows with their Item attached, which
 * was fine while every challan line WAS a stock movement. A paper-only site
 * challan has no Item and no Transaction behind it, so the sheet now takes
 * this plain shape and each route converts whatever it has. The conversion
 * lives here, in one place, so the two sources cannot drift apart in how they
 * are worded on paper.
 * ---------------------------------------------------------------------- */

export type ChallanLine = {
  id: string;
  name: string;
  /** The "Description" column — for a stock movement, the spelled-out
   * "2 × 400 m rolls + 30 m"; for a typed line, whatever was typed. */
  description: string;
  quantity: number;
  unit: string;
  /** The "Remarks" column. */
  note: string | null;
};

/** A real ledger movement, the way every stock-backed challan has always
 * printed it. */
export function lineFromTransaction(
  t: Pick<Transaction, "id" | "quantity" | "packSize" | "packCount" | "pieces" | "note"> & {
    item: Item;
  }
): ChallanLine {
  return {
    id: t.id,
    name: t.item.name,
    description: describeMovement(t.item, t),
    quantity: t.quantity,
    unit: t.item.baseUnit,
    note: t.note,
  };
}

/** A typed line from a paper-only site challan. */
export function lineFromDeliveryLine(l: DeliveryLine): ChallanLine {
  return {
    id: l.id,
    name: l.name,
    description: l.description ?? "",
    quantity: l.quantity,
    unit: l.unit,
    note: l.remark,
  };
}

/** Sums a column of quantities without printing float noise (0.1 + 0.2). Typed
 * lines may carry decimals; stock-backed ones are integers and pass through
 * unchanged. */
export function sumQuantities(quantities: number[]): number {
  const total = quantities.reduce((sum, q) => sum + q, 0);
  return Math.round(total * 1000) / 1000;
}
