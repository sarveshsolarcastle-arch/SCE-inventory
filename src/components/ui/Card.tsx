import type { HTMLAttributes, ReactNode } from "react";
import type { BadgeTone } from "./tones";

const TITLE_ICON_TONE: Record<BadgeTone, string> = {
  ok: "bg-ok-soft text-ok-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  special: "bg-special-soft text-special-ink",
  neutral: "bg-surface text-ink-muted",
};

/**
 * Never sets overflow-hidden: the shelf grid's popover (ShelfGrid.tsx) is
 * absolutely positioned inside a Card and would be silently clipped.
 * TableWrap is the only primitive allowed to clip overflow.
 */
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-card ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-t-card border-b border-line bg-surface-sunken px-4 py-3 ${className}`}
      {...props}
    />
  );
}

export function CardTitle({
  icon,
  tone = "info",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { icon?: ReactNode; tone?: BadgeTone }) {
  return (
    <h2 className={`flex items-center gap-2 text-sm font-extrabold text-ink ${className}`} {...props}>
      {icon && (
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${TITLE_ICON_TONE[tone]}`}
        >
          {icon}
        </span>
      )}
      {children}
    </h2>
  );
}

export function CardBody({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className}`} {...props} />;
}
