/* -------------------------------------------------------------------------
 * Turns text pasted from a spreadsheet into rows of {name, quantity}.
 *
 * Excel copies as TSV, so lines split on newlines and cells on tabs. A sheet
 * may carry extra columns (a SKU, a description) or units in the quantity
 * cell ("150 m") — the quantity is read as the LAST cell that contains a
 * number, and everything else is ignored. A header row ("Item", "Qty") is
 * skipped when its own "quantity" cell fails to parse as a number.
 *
 * Pure, no DB — item matching happens separately in matching.ts.
 * ---------------------------------------------------------------------- */

export type ParsedDispatchRow = {
  sourceText: string;
  name: string;
  quantityText: string;
  /** null when no cell on the line looked like a number. */
  quantity: number | null;
};

function splitCells(line: string): string[] {
  const byTab = line.split("\t").map((c) => c.trim()).filter((c) => c !== "");
  if (byTab.length >= 2) return byTab;
  // Tabs sometimes collapse to runs of spaces on the way through a paste.
  const bySpace = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c !== "");
  return bySpace.length >= 2 ? bySpace : byTab;
}

function findQuantityCell(cells: string[]): { text: string; value: number } | null {
  for (let i = cells.length - 1; i >= 1; i--) {
    const match = cells[i].match(/-?\d+(\.\d+)?/);
    if (match) return { text: cells[i], value: Math.round(Number(match[0])) };
  }
  return null;
}

export function parseDispatchPaste(raw: string): ParsedDispatchRow[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (!lines.length) return [];

  const rows = lines.map((line) => {
    const cells = splitCells(line);
    const name = cells[0] ?? line;
    const found = findQuantityCell(cells);
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
