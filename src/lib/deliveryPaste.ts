/* -------------------------------------------------------------------------
 * Turns text pasted from a supplier's spreadsheet into delivery rows.
 *
 * A delivery line is not just a quantity: material arrives either as sealed
 * packs or as loose stock, and the two land differently (sealed packs stay
 * sealed, loose becomes an OpenPack). So a cell written "2 x 400" is read as
 * TWO PACKS OF 400 — count first, size second — and any plain number is read
 * as loose. Nothing here guesses that a bare "400" was a roll: the row is
 * shown with the figure where it was read, for the user to move.
 *
 * Splitting is shared with the dispatch parser in paste.ts.
 *
 * Pure, no DB — item matching happens separately in matching.ts.
 * ---------------------------------------------------------------------- */

import { findNumericCell, splitPasteCells, splitPasteLines } from "./paste.ts";

export type ParsedDeliveryRow = {
  sourceText: string;
  name: string;
  /** The cell the numbers were read from, echoed back for the row label. */
  quantityText: string;
  /** Both set, or both null — a pack is a count AND a size or it is neither. */
  packCount: number | null;
  packSize: number | null;
  /** Material outside any pack. Null when the line only named packs: the
   * trailing total on "Wire | 2 x 400 | 800" is the same 800, not 800 more. */
  loose: number | null;
};

/** "2 x 400", "2×400", "2 * 400 m". Anchored, so a name cell like
 * "Lug 2.5mm x 4mm" cannot be mistaken for a pack expression. */
const PACK_EXPRESSION = /^(\d+)\s*[x×*]\s*(\d+(?:\.\d+)?)/i;

function findPackCell(
  cells: string[]
): { index: number; text: string; packCount: number; packSize: number } | null {
  for (let i = cells.length - 1; i >= 1; i--) {
    const match = cells[i].match(PACK_EXPRESSION);
    if (!match) continue;
    const packCount = Math.round(Number(match[1]));
    const packSize = Math.round(Number(match[2]));
    if (packCount > 0 && packSize > 0) {
      return { index: i, text: cells[i], packCount, packSize };
    }
  }
  return null;
}

export function parseDeliveryPaste(raw: string): ParsedDeliveryRow[] {
  const lines = splitPasteLines(raw);
  if (!lines.length) return [];

  const rows = lines.map((line): ParsedDeliveryRow => {
    const cells = splitPasteCells(line);
    const name = cells[0] ?? line;
    const pack = findPackCell(cells);
    if (pack) {
      return {
        sourceText: line,
        name,
        quantityText: pack.text,
        packCount: pack.packCount,
        packSize: pack.packSize,
        loose: null,
      };
    }
    const found = findNumericCell(cells);
    return {
      sourceText: line,
      name,
      quantityText: found?.text ?? "",
      packCount: null,
      packSize: null,
      loose: found?.value ?? null,
    };
  });

  // A header row's quantity cells are labels ("Qty", "Packs"), not numbers.
  const first = rows[0];
  const looksLikeHeader = rows.length > 1 && first.loose === null && first.packSize === null;
  return looksLikeHeader ? rows.slice(1) : rows;
}

/** "400 x 2" on a challan means 2 rolls of 400, not 400 rolls of 2. The words
 * do not say which is which, so the ITEM does: when the second number is not
 * a pack size this item has ever had and the first one is, they are the wrong
 * way round. Conservative on purpose — with no known sizes to go on, what was
 * pasted stands. */
export function orientPack(
  pack: { packCount: number; packSize: number },
  knownPackSizes: readonly number[]
): { packCount: number; packSize: number } {
  const sizes = new Set(knownPackSizes);
  if (!sizes.has(pack.packSize) && sizes.has(pack.packCount)) {
    return { packCount: pack.packSize, packSize: pack.packCount };
  }
  return pack;
}
