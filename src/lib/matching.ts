/* -------------------------------------------------------------------------
 * Matches a name pasted from a spreadsheet to an item in the catalogue.
 *
 * Exact SKU/name first, then fuzzy via the Dice coefficient over character
 * bigrams — cheap, no dependency, and good enough for "wire 2.5mm sq" to find
 * "Wire 2.5mm²". A score above SUGGEST_THRESHOLD pre-fills as a *suggestion*;
 * below that the row is *unmatched*. When the top two scores are close, ONE
 * of them being silently chosen would be worse than asking, so the row comes
 * back *ambiguous* with both candidates instead.
 *
 * Pure, no DB — takes whatever item list the caller already has in memory.
 * ---------------------------------------------------------------------- */

export type MatchableItem = { id: string; name: string; sku: string };

export type MatchCandidate = { itemId: string; name: string; sku: string; score: number };

export type MatchResult =
  | { status: "exact"; itemId: string }
  | { status: "suggested"; itemId: string; score: number }
  | { status: "ambiguous"; candidates: MatchCandidate[] }
  | { status: "unmatched" };

const SUGGEST_THRESHOLD = 0.6;
/** Scores within this of the best one are treated as tied — pick one and the
 * risk is silently dispatching the wrong item. */
const AMBIGUOUS_GAP = 0.08;

function normalise(s: string): string {
  return s.trim().toLowerCase();
}

function bigrams(s: string): string[] {
  const norm = s.replace(/[^a-z0-9]+/g, " ").trim();
  if (norm.length < 2) return norm ? [norm] : [];
  const grams: string[] = [];
  for (let i = 0; i < norm.length - 1; i++) grams.push(norm.slice(i, i + 2));
  return grams;
}

/** 2·|A∩B| / (|A|+|B|) over character bigrams. 1 = identical, 0 = nothing shared. */
export function diceCoefficient(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return a === b ? 1 : 0;

  const counts = new Map<string, number>();
  for (const g of A) counts.set(g, (counts.get(g) ?? 0) + 1);

  let intersection = 0;
  for (const g of B) {
    const remaining = counts.get(g) ?? 0;
    if (remaining > 0) {
      intersection++;
      counts.set(g, remaining - 1);
    }
  }
  return (2 * intersection) / (A.length + B.length);
}

export function matchItem(query: string, items: readonly MatchableItem[]): MatchResult {
  const q = normalise(query);
  if (!q) return { status: "unmatched" };

  const exact = items.find((i) => normalise(i.name) === q || normalise(i.sku) === q);
  if (exact) return { status: "exact", itemId: exact.id };

  const scored: MatchCandidate[] = items
    .map((i) => ({
      itemId: i.id,
      name: i.name,
      sku: i.sku,
      score: Math.max(diceCoefficient(q, normalise(i.name)), diceCoefficient(q, normalise(i.sku))),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < SUGGEST_THRESHOLD) return { status: "unmatched" };

  const tied = scored.filter((s) => best.score - s.score < AMBIGUOUS_GAP);
  if (tied.length > 1) return { status: "ambiguous", candidates: tied };

  return { status: "suggested", itemId: best.itemId, score: best.score };
}
