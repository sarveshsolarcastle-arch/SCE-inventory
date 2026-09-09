import type { ReactNode } from "react";

export default function SearchBar({
  name = "q",
  defaultValue,
  placeholder,
  action,
  className = "",
  children,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  action?: string;
  className?: string;
  /** Hidden inputs for other active filters, so submitting this search box
   * alone does not drop them — a GET form submission replaces the query
   * string with its own fields only. */
  children?: ReactNode;
}) {
  return (
    <form
      action={action}
      className={`flex w-full max-w-sm items-center gap-2 rounded-control border border-line-strong bg-surface px-3 py-2 ${className}`}
    >
      {children}
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-ink-subtle"
      >
        <circle cx="9" cy="9" r="6" />
        <path d="m17 17-3.5-3.5" />
      </svg>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
      />
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
