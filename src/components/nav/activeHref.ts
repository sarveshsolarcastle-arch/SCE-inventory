/**
 * Which nav link is currently active. Most-specific-match-wins, across two
 * axes.
 *
 * PATH: a naive `startsWith` lights both "Delivery Ledger" (/dispatches) and
 * "Stock_Out" (/dispatches/new) on /dispatches/new, so the longest matching
 * prefix wins.
 *
 * QUERY: "Returns Ledger" is /ledger?type=RETURN — the same page as "Ledger",
 * told to filter itself. Comparing paths alone would light BOTH, and then the
 * longer-path rule could not separate them, since the path is identical. So a
 * link's query params must all be present with the same values in the current
 * URL, and a link that matches on more params beats one that matches on fewer.
 * That gives /ledger?type=RETURN on the filtered page and plain /ledger on the
 * unfiltered one, without either needing to know about the other.
 *
 * `current` may carry a query string; hrefs may too. Extra params in the
 * current URL are ignored, so /ledger?type=RETURN&page=2 still lights Returns
 * Ledger rather than falling back to Ledger.
 */

function split(url: string): { path: string; params: URLSearchParams } {
  const q = url.indexOf("?");
  if (q === -1) return { path: url, params: new URLSearchParams() };
  return { path: url.slice(0, q), params: new URLSearchParams(url.slice(q + 1)) };
}

export function activeHref(current: string, hrefs: string[]): string | null {
  const here = split(current);

  let best: string | null = null;
  let bestParams = -1;
  let bestPath = -1;

  for (const href of hrefs) {
    const link = split(href);

    const pathMatches = here.path === link.path || here.path.startsWith(`${link.path}/`);
    if (!pathMatches) continue;

    // Every param the LINK names must match. Params the current URL carries
    // beyond those — a page number, a search term — are none of its business.
    let paramCount = 0;
    let paramsMatch = true;
    for (const [key, value] of link.params) {
      if (here.params.get(key) !== value) {
        paramsMatch = false;
        break;
      }
      paramCount++;
    }
    if (!paramsMatch) continue;

    if (paramCount > bestParams || (paramCount === bestParams && link.path.length > bestPath)) {
      best = href;
      bestParams = paramCount;
      bestPath = link.path.length;
    }
  }

  return best;
}
