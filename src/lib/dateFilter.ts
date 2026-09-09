/** Parses a `?from=`/`?to=` calendar-day filter into a `Date`, or `null` for
 * anything absent, malformed, or out of range — a hostile, truncated, or
 * hand-edited `?from=` must not reach `new Date()` as something that produces
 * an Invalid Date, which Prisma then throws on rather than silently ignoring.
 * `endOfDay` pushes `to` to the last instant of the day, matching the
 * `<input type="date">` it comes from: without it, `to` means midnight and a
 * same-day filter returns nothing. */
export function parseDateFilter(raw: string | undefined, endOfDay: boolean): Date | null {
  const match = raw ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null;
  if (!match) return null;

  const date = new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  if (Number.isNaN(date.getTime())) return null;

  // A calendar date that doesn't exist (2026-02-30) does not produce an
  // Invalid Date — JS silently rolls it over into a nearby real one instead —
  // so the round trip is checked explicitly rather than trusted.
  const [, y, m, d] = match;
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }

  return date;
}
