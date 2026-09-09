/* Pure pagination arithmetic, kept out of the page the same way capabilities.ts
 * and challan.ts keep logic out of theirs — so a hostile `?page=` value is
 * tested here rather than discovered on a live list page. */

export const PER_PAGE = 50;

/** 1-based. Anything absent, non-numeric, zero or negative becomes 1 — a
 *  hostile ?page=-5 must not reach Prisma's `skip`. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || !Number.isInteger(n) || n < 1) return 1;
  return n;
}

export function pageArgs(page: number, perPage: number = PER_PAGE): { skip: number; take: number } {
  return { skip: (page - 1) * perPage, take: perPage };
}

/** At least 1, even for an empty set — there is always "page 1 of 1" to show,
 * never "page 1 of 0". */
export function pageCount(total: number, perPage: number = PER_PAGE): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** "51-100 of 214" — the sentence the pager renders. Clamps `page` to the
 * valid range first, so a page past the end still describes something real. */
export function describeRange(total: number, page: number, perPage: number = PER_PAGE): string {
  if (total === 0) return "0 of 0";
  const last = pageCount(total, perPage);
  const clamped = Math.min(Math.max(page, 1), last);
  const start = (clamped - 1) * perPage + 1;
  const end = Math.min(clamped * perPage, total);
  return `${start}-${end} of ${total}`;
}

/** Once `total` is known, a page requested past the end (`?page=99999`) must
 * not run a query that returns nothing with a page number that then renders
 * an empty table — it should fall back to the actual last page, the same way
 * `?page=0` falls back to the first. Callers re-run `pageArgs`/`findMany`
 * with the clamped value rather than the raw one. */
export function clampPage(page: number, total: number, perPage: number = PER_PAGE): number {
  return Math.min(page, pageCount(total, perPage));
}
