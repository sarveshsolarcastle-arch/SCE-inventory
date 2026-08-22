import type { HTMLAttributes } from "react";
import type { BadgeTone } from "./tones";

export type BadgeVariant = "soft" | "outline";

const SOFT: Record<BadgeTone, string> = {
  ok: "border-ok-line bg-ok-soft text-ok-ink",
  warn: "border-warn-line bg-warn-soft text-warn-ink",
  danger: "border-danger-line bg-danger-soft text-danger-ink",
  info: "border-info-line bg-info-soft text-info-ink",
  special: "border-special-line bg-special-soft text-special-ink",
  neutral: "border-line-strong bg-surface-sunken text-ink-muted",
};

const OUTLINE: Record<BadgeTone, string> = {
  ok: "border-ok-line bg-surface text-ok-ink",
  warn: "border-warn-line bg-surface text-warn-ink",
  danger: "border-danger-line bg-surface text-danger-ink",
  info: "border-info-line bg-surface text-info-ink",
  special: "border-special-line bg-surface text-special-ink",
  neutral: "border-line-strong bg-surface text-ink-muted",
};

export default function Badge({
  tone = "neutral",
  variant = "soft",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; variant?: BadgeVariant }) {
  const toneClasses = (variant === "outline" ? OUTLINE : SOFT)[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${toneClasses} ${className}`}
      {...props}
    />
  );
}
