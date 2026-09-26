/* -------------------------------------------------------------------------
 * Forgiving search for the Items list.
 *
 * Two tiers, kept apart so a typo never pollutes a good result:
 *
 *   strict — every query word equals, starts, or is contained in a word of the
 *            item's name / SKU / category, after stripping a plural ("cables" →
 *            "cable"). The raw whole query as a substring also counts, so
 *            anything the old `contains` search found is still found.
 *   fuzzy  — only used when NOTHING is strict. A query word within a small edit
 *            distance of an item word ("cabel" → "cable") still matches, and
 *            the corrected query comes back as a "did you mean" suggestion.
 *
 * Words containing a digit are never fuzzy-matched: "10mm" and "16mm" are one
 * edit apart but are different products.
 *
 * Pure, no DB — the caller hands over the items it already loaded.
 * ---------------------------------------------------------------------- */

export type SearchableItem = { name: string; sku: string; category: string | null };

export type SearchMatch<T> = { item: T; score: number };

export type SearchOutcome<T> = {
  matches: SearchMatch<T>[];
  /** True when there was no strict match and these are close-spelling matches. */
  fuzzy: boolean;
  /** The query re-spelled from the top fuzzy match, or null. */
  suggestion: string | null;
};

/** Field weights: a hit in the name outranks the same hit in SKU or category. */
const FIELD_WEIGHT = { name: 1, sku: 0.85, category: 0.8 } as const;
type Field = keyof typeof FIELD_WEIGHT;

const MIN_FUZZY_LENGTH = 4;

function wordsOf(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Strips a plural so "cables"/"cable", "batteries"/"battery", "boxes"/"box"
 * compare equal. Deliberately crude — it only has to be applied identically to
 * both sides. */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (/(?:xes|ches|shes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) return word.slice(0, -1);
  return word;
}

/** Optimal-string-alignment distance: insert, delete, substitute, or swap two
 * neighbours, each costing 1 — so "cabel" → "cable" is 1, not 2. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function maxTypos(len: number): number {
  return len >= 8 ? 2 : 1;
}

type WordHit = { score: number; strict: boolean; word: string };

/** How well one query word matches one item word; null = not at all. */
function matchWord(qStem: string, itemWord: string, itemStem: string): Omit<WordHit, "word"> | null {
  if (qStem === itemStem) return { score: 1, strict: true };
  if (itemStem.startsWith(qStem)) return { score: 0.9, strict: true };
  if (itemStem.includes(qStem)) return { score: 0.7, strict: true };

  if (
    qStem.length >= MIN_FUZZY_LENGTH &&
    !/\d/.test(qStem) &&
    !/\d/.test(itemWord) &&
    Math.abs(qStem.length - itemStem.length) <= maxTypos(qStem.length)
  ) {
    const d = editDistance(qStem, itemStem);
    if (d <= maxTypos(qStem.length)) return { score: 0.6 - 0.1 * d, strict: false };
  }
  return null;
}

type PreparedWord = { word: string; stem: string; field: Field };

function prepare(item: SearchableItem): PreparedWord[] {
  const out: PreparedWord[] = [];
  const fields: [Field, string | null][] = [
    ["name", item.name],
    ["sku", item.sku],
    ["category", item.category],
  ];
  for (const [field, text] of fields) {
    if (!text) continue;
    for (const word of wordsOf(text)) out.push({ word, stem: stem(word), field });
  }
  return out;
}

/** Best hit for one query word across all of an item's words. */
function bestHit(qStem: string, words: readonly PreparedWord[]): WordHit | null {
  let best: WordHit | null = null;
  for (const w of words) {
    const hit = matchWord(qStem, w.word, w.stem);
    if (!hit) continue;
    const score = hit.score * FIELD_WEIGHT[w.field];
    if (!best || score > best.score) best = { score, strict: hit.strict, word: w.word };
  }
  return best;
}

type Scored = { score: number; strict: boolean; corrections: (string | null)[] };

function scoreItem(
  item: SearchableItem,
  raw: string,
  qWords: readonly string[],
  qStems: readonly string[],
): Scored | null {
  // The whole typed query appearing verbatim is the old `contains` behaviour —
  // always a strict match, and the best kind.
  const haystacks = [item.name, item.sku, item.category ?? ""].map((s) => s.toLowerCase());
  if (raw && haystacks.some((h) => h.includes(raw))) {
    const bonus = haystacks[0].startsWith(raw) ? 1 : 0;
    return { score: 10 + bonus, strict: true, corrections: qWords.map(() => null) };
  }
  if (qStems.length === 0) return null;

  const words = prepare(item);
  let total = 0;
  let strict = true;
  const corrections: (string | null)[] = [];
  for (const qStem of qStems) {
    const hit = bestHit(qStem, words);
    if (!hit) return null;
    total += hit.score;
    if (!hit.strict) strict = false;
    corrections.push(hit.strict ? null : hit.word);
  }
  return { score: total, strict, corrections };
}

export function searchItems<T extends SearchableItem>(items: readonly T[], query: string): SearchOutcome<T> {
  const raw = query.trim().toLowerCase();
  const qWords = wordsOf(query);
  const qStems = qWords.map(stem);

  const strictMatches: SearchMatch<T>[] = [];
  const fuzzyMatches: (SearchMatch<T> & { corrections: (string | null)[] })[] = [];
  for (const item of items) {
    const scored = scoreItem(item, raw, qWords, qStems);
    if (!scored) continue;
    if (scored.strict) strictMatches.push({ item, score: scored.score });
    else fuzzyMatches.push({ item, score: scored.score, corrections: scored.corrections });
  }

  if (strictMatches.length > 0) return { matches: strictMatches, fuzzy: false, suggestion: null };
  if (fuzzyMatches.length === 0) return { matches: [], fuzzy: false, suggestion: null };

  let top = fuzzyMatches[0];
  for (const m of fuzzyMatches) if (m.score > top.score) top = m;
  const suggestion = qWords.map((w, i) => top.corrections[i] ?? w).join(" ");

  return {
    matches: fuzzyMatches.map(({ item, score }) => ({ item, score })),
    fuzzy: true,
    suggestion: suggestion === qWords.join(" ") ? null : suggestion,
  };
}
