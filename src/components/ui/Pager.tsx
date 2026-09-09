import Link from "next/link";
import { pageCount, describeRange, PER_PAGE } from "@/lib/pagination";

/** URL-state pagination — links, not React state, the same rule FilterPills
 * states explicitly. Copies SortableTh's param-preserving approach: every
 * other current search param survives a page change. Renders nothing when
 * everything fits on one page. */
export default function Pager({
  total,
  page,
  perPage = PER_PAGE,
  basePath,
  searchParams,
}: {
  total: number;
  page: number;
  perPage?: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const last = pageCount(total, perPage);
  if (last <= 1) return null;

  function hrefFor(p: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  const atStart = page <= 1;
  const atEnd = page >= last;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <span className="font-semibold text-ink-subtle">{describeRange(total, page, perPage)}</span>
      <div className="flex items-center gap-2">
        {atStart ? (
          <span className="rounded-control border border-line-strong px-3 py-1.5 text-xs font-bold text-ink-subtle opacity-40">
            Prev
          </span>
        ) : (
          <Link
            href={hrefFor(page - 1)}
            className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted hover:text-ink"
          >
            Prev
          </Link>
        )}
        {atEnd ? (
          <span className="rounded-control border border-line-strong px-3 py-1.5 text-xs font-bold text-ink-subtle opacity-40">
            Next
          </span>
        ) : (
          <Link
            href={hrefFor(page + 1)}
            className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted hover:text-ink"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
