import Link from "next/link";

export type FilterPillOption = { value: string; label: string; href: string };

/** URL-state filters — deliberately links, not PillToggle (which is React state). */
export default function FilterPills({
  options,
  active,
  className = "",
}: {
  options: FilterPillOption[];
  active: string;
  className?: string;
}) {
  return (
    <div className={`inline-flex flex-wrap gap-1.5 ${className}`}>
      {options.map((opt) => (
        <Link
          key={opt.value}
          href={opt.href}
          className={`rounded-pill border px-3 py-1.5 text-xs font-bold ${
            active === opt.value
              ? "border-accent bg-accent-soft text-accent-hover"
              : "border-line-strong bg-surface text-ink-muted hover:text-ink"
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
