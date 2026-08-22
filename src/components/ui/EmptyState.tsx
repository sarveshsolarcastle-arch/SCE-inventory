import type { ReactNode } from "react";

export default function EmptyState({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-4 py-10 text-center text-sm font-semibold text-ink-subtle ${className}`}>
      {children}
    </div>
  );
}
