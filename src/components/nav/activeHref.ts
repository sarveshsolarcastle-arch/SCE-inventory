/**
 * Longest-match-wins. A naive `startsWith` lights both "Dispatches" and
 * "Dispatch to Site" on /dispatches/new — this picks the one whose href is
 * the longest matching prefix, so exactly one nav link is ever active.
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}
