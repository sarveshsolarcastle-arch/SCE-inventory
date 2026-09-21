/* -------------------------------------------------------------------------
 * Shared plumbing for turning text pasted from a spreadsheet into rows.
 *
 * Excel copies as TSV, so lines split on newlines and cells on tabs. What
 * each parser then makes of the cells differs — a dispatch wants one
 * quantity, a delivery wants packs and loose — so only the splitting and the
 * "which cell is a number" question live here.
 *
 * Pure, no DB.
 * ---------------------------------------------------------------------- */

export function splitPasteLines(raw: string): string[] {
  return raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
}

export function splitPasteCells(line: string): string[] {
  const byTab = line.split("\t").map((c) => c.trim()).filter((c) => c !== "");
  if (byTab.length >= 2) return byTab;
  // Tabs sometimes collapse to runs of spaces on the way through a paste.
  const bySpace = line.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c !== "");
  return bySpace.length >= 2 ? bySpace : byTab;
}

/** The rightmost cell holding a number, never cell 0 — that is the name, and
 * "Wire 2.5mm" is not a quantity. `skip` drops cells a caller has already
 * claimed for something else. */
export function findNumericCell(
  cells: string[],
  skip: (index: number) => boolean = () => false
): { text: string; value: number } | null {
  for (let i = cells.length - 1; i >= 1; i--) {
    if (skip(i)) continue;
    const match = cells[i].match(/-?\d+(\.\d+)?/);
    if (match) return { text: cells[i], value: Math.round(Number(match[0])) };
  }
  return null;
}
