/* -------------------------------------------------------------------------
 * Turns text pasted from a spreadsheet into rows of {name, quantity}.
 *
 * A sheet may carry extra columns (a SKU, a description) or units in the
 * quantity cell ("150 m") — the quantity is read as the LAST cell that
 * contains a number, and everything else is ignored. A header row ("Item",
 * "Qty") is skipped when its own "quantity" cell fails to parse as a number.
 *
 * Splitting lives in paste.ts, shared with the delivery parser.
 *
 * Pure, no DB — item matching happens separately in matching.ts.
 * ---------------------------------------------------------------------- */

import { findNumericCell, splitPasteCells, splitPasteLines } from "./paste.ts";

export type ParsedDispatchRow = {
  sourceText: string;
  name: string;
  quantityText: string;
  /** null when no cell on the line looked like a number. */
  quantity: number | null;
};

export function parseDispatchPaste(raw: string): ParsedDispatchRow[] {
  const lines = splitPasteLines(raw);
  if (!lines.length) return [];

  const rows = lines.map((line) => {
    const cells = splitPasteCells(line);
    const name = cells[0] ?? line;
    const found = findNumericCell(cells);
    return {
      sourceText: line,
      name,
      quantityText: found?.text ?? "",
      quantity: found?.value ?? null,
    };
  });

  // A header row's "quantity" cell is a label ("Qty"), not a number.
  const looksLikeHeader = rows.length > 1 && rows[0].quantity === null;
  return looksLikeHeader ? rows.slice(1) : rows;
}
