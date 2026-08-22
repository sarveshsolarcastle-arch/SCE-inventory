import Link from "next/link";
import type { ReactNode } from "react";

/** Emits a `?sort=&dir=` link, preserving every other current search param. */
export default function SortableTh({
  label,
  sortKey,
  currentSort,
  currentDir,
  basePath,
  searchParams,
}: {
  label: ReactNode;
  sortKey: string;
  currentSort?: string;
  currentDir?: "asc" | "desc";
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const active = currentSort === sortKey;
  const nextDir: "asc" | "desc" = active && currentDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value) params.set(key, value);
  }
  params.set("sort", sortKey);
  params.set("dir", nextDir);

  return (
    <th className="border-b border-line px-4 py-2.5 text-left text-[11px] font-bold tracking-wide text-ink-subtle uppercase whitespace-nowrap">
      <Link
        href={`${basePath}?${params.toString()}`}
        className="inline-flex items-center gap-1 hover:text-ink"
      >
        {label}
        <svg
          width="11"
          height="11"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={active ? "opacity-100" : "opacity-40"}
        >
          {active && currentDir === "asc" ? (
            <path d="M6 12l4-4 4 4" />
          ) : (
            <path d="M6 8l4 4 4-4" />
          )}
        </svg>
      </Link>
    </th>
  );
}
