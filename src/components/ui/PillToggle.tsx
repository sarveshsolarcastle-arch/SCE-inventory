export type PillOption<T extends string> = { value: T; label: string };

/**
 * Controlled, generic. `onChange` must stay `(v: T) => void` — never a raw
 * setState dispatcher — because callers like ShelfGrid's Front/Back switch
 * also need to run a side effect (closing the open popover) on change.
 */
export default function PillToggle<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex gap-0.5 rounded-pill border border-line-strong bg-surface-sunken p-0.5 ${className}`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`rounded-pill px-3.5 py-1.5 text-xs font-bold transition-colors ${
            value === opt.value
              ? "bg-surface text-ink shadow-card"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
